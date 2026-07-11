const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = 'aura_dashboard_super_secret_key_987249871239';

// Middlewares
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Error logger for client diagnostics
app.post('/api/log-error', (req, res) => {
  console.error('[CLIENT ERROR]', req.body);
  const logMsg = `[${new Date().toISOString()}] ${JSON.stringify(req.body)}\n`;
  try {
    require('fs').appendFileSync(path.join(__dirname, 'client_errors.log'), logMsg);
  } catch (e) {}
  res.sendStatus(200);
});

app.use(express.static(__dirname));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// Admin Check Middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
}

// --- AUTHENTICATION ENDPOINTS ---

// Register User
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be at least 3 chars; password at least 6 chars' });
  }

  const config = db.getConfig();
  if (!config.registrationEnabled) {
    return res.status(403).json({ error: 'Public registration is disabled by the administrator' });
  }

  try {
    const existing = db.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }
    const user = db.createUser(username, password, 'user');
    
    // Generate Token
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Generate Token
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TODO LIST ENDPOINTS ---

app.get('/api/todos', authenticateToken, (req, res) => {
  res.json(db.getTodos(req.user.id));
});

app.post('/api/todos', authenticateToken, (req, res) => {
  const { text, important } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Task text is required' });
  }
  const todo = db.createTodo(req.user.id, text, important);
  res.status(201).json(todo);
});

app.put('/api/todos/:id', authenticateToken, (req, res) => {
  const { text, completed, important } = req.body;
  try {
    const todo = db.updateTodo(req.user.id, req.params.id, { text, completed, important });
    res.json(todo);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/todos/:id', authenticateToken, (req, res) => {
  try {
    db.deleteTodo(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// --- DAILY PLANNER ENDPOINTS ---

app.get('/api/planner', authenticateToken, (req, res) => {
  res.json(db.getPlanner(req.user.id));
});

app.post('/api/planner', authenticateToken, (req, res) => {
  const { label, text } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'Time block label is required' });
  }
  const slot = db.savePlannerSlot(req.user.id, label, text || '');
  res.json(slot);
});

// --- DAILY GOALS ENDPOINTS ---

app.get('/api/goals', authenticateToken, (req, res) => {
  res.json(db.getGoals(req.user.id));
});

app.post('/api/goals', authenticateToken, (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Goal text is required' });
  }
  const goal = db.createGoal(req.user.id, text);
  res.status(201).json(goal);
});

app.put('/api/goals/:id', authenticateToken, (req, res) => {
  const { text, completed } = req.body;
  try {
    const goal = db.updateGoal(req.user.id, req.params.id, { text, completed });
    res.json(goal);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/goals/:id', authenticateToken, (req, res) => {
  try {
    db.deleteGoal(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// --- POMODORO TIMER LOGGING ---

app.get('/api/focus-sessions', authenticateToken, (req, res) => {
  res.json(db.getFocusSessions(req.user.id));
});

app.post('/api/focus-sessions', authenticateToken, (req, res) => {
  const { duration, type } = req.body;
  if (!duration || !type) {
    return res.status(400).json({ error: 'Session duration and type are required' });
  }
  const session = db.logFocusSession(req.user.id, parseInt(duration), type);
  res.status(201).json(session);
});

// --- QUOTES ENDPOINTS ---

app.get('/api/quotes/random', (req, res) => {
  const quotes = db.getQuotes();
  if (quotes.length === 0) {
    return res.json({ quote: "Form follows focus.", author: "Aura System" });
  }
  const rand = quotes[Math.floor(Math.random() * quotes.length)];
  res.json({ id: rand.id, quote: rand.quote, author: rand.author });
});

// --- ADMINISTRATOR ENDPOINTS (Admin Only) ---

// Get Dashboard Statistics
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  res.json(db.getAdminStats());
});

// Get User Table
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json(users);
});

// Update User Role
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (role !== 'admin' && role !== 'user') {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const updated = db.updateUserRole(req.params.id, role);
    res.json({ id: updated.id, username: updated.username, role: updated.role });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete User
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List Custom Quotes
app.get('/api/admin/quotes', authenticateToken, requireAdmin, (req, res) => {
  const customQuotes = db.getQuotes().filter(q => q.isCustom);
  res.json(customQuotes);
});

// Add Custom Quote
app.post('/api/admin/quotes', authenticateToken, requireAdmin, (req, res) => {
  const { quote, author } = req.body;
  if (!quote || !author) {
    return res.status(400).json({ error: 'Quote text and author are required' });
  }
  const newQuote = db.addCustomQuote(quote, author);
  res.status(201).json(newQuote);
});

// Delete Custom Quote
app.delete('/api/admin/quotes/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.deleteCustomQuote(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get System Configuration
app.get('/api/admin/config', authenticateToken, requireAdmin, (req, res) => {
  res.json(db.getConfig());
});

// Update System Configuration
app.put('/api/admin/config', authenticateToken, requireAdmin, (req, res) => {
  const { registrationEnabled } = req.body;
  const config = db.updateConfig({ registrationEnabled });
  res.json(config);
});

// Fallback to index.html for SPA page refresh
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Aura server running at http://localhost:${PORT}/`);
});
