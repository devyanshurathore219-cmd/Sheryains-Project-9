// Global error logger for client diagnostics
window.addEventListener('error', (event) => {
  const token = localStorage.getItem('aura_token');
  fetch('http://localhost:8080/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error ? event.error.stack : null,
      origin: window.location.href,
      token: token ? 'exists' : 'null'
    })
  }).catch(() => {});
});

document.addEventListener('DOMContentLoaded', () => {
  // Initialize icons
  lucide.createIcons();

  // Determine API base dynamically (support VS Code Live Server on port 5500)
  const API_BASE = window.location.port === '5500' ? 'http://localhost:8080' : '';

  // --- API Client Layer ---
  async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('aura_token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(API_BASE + url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
      // Auto logout on token expiration/unauthorized access
      if (localStorage.getItem('aura_token')) {
        logout();
      }
    }
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // --- Core State ---
  let state = {
    todos: [],
    planner: {},
    goals: [],
    theme: localStorage.getItem('aura_theme') || 'dark',
    currentQuote: null,
    user: null
  };

  // --- Auth UI Elements ---
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegisterBtn = document.getElementById('show-register-btn');
  const showLoginBtn = document.getElementById('show-login-btn');
  const authErrorMsg = document.getElementById('auth-error-msg');
  
  // Header User Widgets
  const userMenuWidget = document.getElementById('user-menu-widget');
  const headerUsername = document.getElementById('header-username');
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // --- Theme Manager ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aura_theme', theme);
    state.theme = theme;
  }
  // Initial Theme Apply
  applyTheme(state.theme);
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // --- Clock Engine ---
  const timeText = document.getElementById('time-text');
  const dateText = document.getElementById('date-text');
  function updateClock() {
    const now = new Date();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const formattedHours = String(hours).padStart(2, '0');
    
    timeText.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateText.textContent = now.toLocaleDateString('en-US', options);
    
    updateDynamicBackground(now.getHours());
    highlightPlannerCurrentHour(now.getHours());
  }


  // --- Dynamic Background Manager ---
  let lastBackgroundClass = '';
  function updateDynamicBackground(hour) {
    let backgroundClass = 'bg-night';
    if (hour >= 5 && hour < 12) {
      backgroundClass = 'bg-morning';
    } else if (hour >= 12 && hour < 17) {
      backgroundClass = 'bg-afternoon';
    } else if (hour >= 17 && hour < 20) {
      backgroundClass = 'bg-evening';
    } else {
      backgroundClass = 'bg-night';
    }
    if (backgroundClass !== lastBackgroundClass) {
      document.body.className = ''; 
      document.body.classList.add(backgroundClass);
      lastBackgroundClass = backgroundClass;
    }
  }

  // --- Authentication Management ---
  async function checkAuth() {
    const token = localStorage.getItem('aura_token');
    if (!token) {
      showAuthScreen();
      return;
    }
    try {
      const user = await apiFetch('/api/auth/me');
      loginSuccess(user, token);
    } catch (err) {
      console.warn("Auth verify failed, clearing session: ", err);
      logout();
    }
  }

  function showAuthScreen() {
    state.user = null;
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    userMenuWidget.classList.add('hidden');
    adminPanelBtn.classList.add('hidden');
    authErrorMsg.textContent = '';
  }

  function loginSuccess(user, token) {
    state.user = user;
    localStorage.setItem('aura_token', token);
    
    // UI Update
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userMenuWidget.classList.remove('hidden');
    headerUsername.textContent = user.username;
    
    if (user.role === 'admin') {
      adminPanelBtn.classList.remove('hidden');
    } else {
      adminPanelBtn.classList.add('hidden');
    }
    
    // Load app datasets
    loadAllData();
  }

  function logout() {
    localStorage.removeItem('aura_token');
    state.user = null;
    showAuthScreen();
    // Return to dashboard home in router state
    navigateTo('dashboard-home');
  }

  // Auth Forms Switchers
  if (showRegisterBtn && loginForm && registerForm && authErrorMsg) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      authErrorMsg.textContent = '';
    });
  }

  if (showLoginBtn && loginForm && registerForm && authErrorMsg) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      registerForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      authErrorMsg.textContent = '';
    });
  }

  // Login Submit
  if (loginForm && authErrorMsg) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorMsg.textContent = '';
      const userEl = document.getElementById('login-username');
      const passEl = document.getElementById('login-password');
      if (!userEl || !passEl) return;
      const username = userEl.value.trim();
      const password = passEl.value;
      
      try {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        loginSuccess(data.user, data.token);
      } catch (err) {
        authErrorMsg.textContent = err.message || 'Login failed';
      }
    });
  }

  // Register Submit
  if (registerForm && authErrorMsg) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authErrorMsg.textContent = '';
      const userEl = document.getElementById('register-username');
      const passEl = document.getElementById('register-password');
      if (!userEl || !passEl) return;
      const username = userEl.value.trim();
      const password = passEl.value;

      try {
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        loginSuccess(data.user, data.token);
      } catch (err) {
        authErrorMsg.textContent = err.message || 'Registration failed';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // --- Navigation Router ---
  const activeViews = document.querySelectorAll('.view-section');
  const clickableCards = document.querySelectorAll('.clickable-card');
  const backButtons = document.querySelectorAll('.back-btn');

  function navigateTo(targetId) {
    const currentActive = document.querySelector('.view-section.active');
    const targetSection = document.getElementById(targetId);
    
    if (currentActive && targetSection && currentActive !== targetSection) {
      currentActive.style.opacity = '0';
      currentActive.style.transform = 'translateY(12px)';
      
      setTimeout(() => {
        currentActive.classList.remove('active');
        currentActive.style.display = 'none';
        
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        
        // Reset scroll position on view shift
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        // Force reflow
        targetSection.offsetHeight;
        
        targetSection.style.opacity = '1';
        targetSection.style.transform = 'translateY(0)';
        
        // Route Hooks
        if (targetId === 'planner-section') {
          scrollToCurrentPlannerHour();
        } else if (targetId === 'admin-section') {
          loadAdminStats();
          loadAdminTab('stats');
        }
      }, 250);
    }
  }

  // Dashboard grid cards routing triggers
  clickableCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetFeature = card.getAttribute('data-target');
      navigateTo(`${targetFeature}-section`);
    });
  });

  // Back button triggers
  backButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo('dashboard-home');
      syncDashboardSublabels();
    });
  });

  adminPanelBtn.addEventListener('click', () => {
    navigateTo('admin-section');
  });

  document.getElementById('admin-back-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    navigateTo('dashboard-home');
    syncDashboardSublabels();
  });

  function syncDashboardSublabels() {
    updateTodoStatusSublabel();
    updatePlannerStatusSublabel();
    updateGoalsProgress();
  }

  // --- Weather Widget Module ---
  const weatherLoading = document.getElementById('weather-loading');
  const weatherContent = document.getElementById('weather-content');
  const weatherTemp = document.getElementById('weather-temp');
  const weatherCity = document.getElementById('weather-city');
  const weatherDesc = document.getElementById('weather-desc');
  const weatherIconContainer = document.getElementById('weather-icon-container');

  const weatherCodes = {
    0: { desc: "Clear sky", icon: "sun" },
    1: { desc: "Mainly clear", icon: "cloud-sun" },
    2: { desc: "Partly cloudy", icon: "cloud-sun" },
    3: { desc: "Overcast", icon: "cloud" },
    45: { desc: "Foggy", icon: "cloud" },
    48: { desc: "Depositing rime fog", icon: "cloud" },
    51: { desc: "Light drizzle", icon: "cloud-drizzle" },
    53: { desc: "Moderate drizzle", icon: "cloud-drizzle" },
    55: { desc: "Dense drizzle", icon: "cloud-drizzle" },
    56: { desc: "Light freezing drizzle", icon: "snowflake" },
    57: { desc: "Dense freezing drizzle", icon: "snowflake" },
    61: { desc: "Slight rain", icon: "cloud-rain" },
    63: { desc: "Moderate rain", icon: "cloud-rain" },
    65: { desc: "Heavy rain", icon: "cloud-rain" },
    66: { desc: "Light freezing rain", icon: "snowflake" },
    67: { desc: "Heavy freezing rain", icon: "snowflake" },
    71: { desc: "Slight snow fall", icon: "snowflake" },
    73: { desc: "Moderate snow fall", icon: "snowflake" },
    75: { desc: "Heavy snow fall", icon: "snowflake" },
    77: { desc: "Snow grains", icon: "snowflake" },
    80: { desc: "Slight rain showers", icon: "cloud-rain" },
    81: { desc: "Moderate rain showers", icon: "cloud-rain" },
    82: { desc: "Violent rain showers", icon: "cloud-lightning" },
    85: { desc: "Slight snow showers", icon: "snowflake" },
    86: { desc: "Heavy snow showers", icon: "snowflake" },
    95: { desc: "Thunderstorm", icon: "cloud-lightning" },
    96: { desc: "Thunderstorm with slight hail", icon: "cloud-lightning" },
    99: { desc: "Thunderstorm with heavy hail", icon: "cloud-lightning" }
  };

  function fetchWeather(lat, lon, cityName = "Current Location") {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    
    fetch(weatherUrl)
      .then(res => {
        if (!res.ok) throw new Error("Weather API failed");
        return res.json();
      })
      .then(data => {
        const current = data.current_weather;
        if (!current) throw new Error("No weather data found");
        const temp = Math.round(current.temperature);
        const code = current.weathercode;
        const mapped = weatherCodes[code] || { desc: "Unknown", icon: "cloud" };

        weatherTemp.textContent = `${temp}°C`;
        weatherCity.textContent = cityName;
        weatherDesc.textContent = mapped.desc;
        weatherIconContainer.innerHTML = `<i data-lucide="${mapped.icon}"></i>`;
        
        weatherLoading.classList.add('hidden');
        weatherContent.classList.remove('hidden');
        lucide.createIcons();
      })
      .catch(err => {
        console.error("Weather fetch error: ", err);
        weatherTemp.textContent = "--°C";
        weatherCity.textContent = "Offline/API Error";
        weatherDesc.textContent = "Unable to fetch";
        weatherIconContainer.innerHTML = `<i data-lucide="cloud-off"></i>`;
        weatherLoading.classList.add('hidden');
        weatherContent.classList.remove('hidden');
        lucide.createIcons();
      });
  }

  function reverseGeocodeAndFetchWeather(lat, lon) {
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    
    fetch(geocodeUrl, { headers: { 'User-Agent': 'AuraDashboardApp/1.0' } })
      .then(res => {
        if (!res.ok) throw new Error("Reverse geocode failed");
        return res.json();
      })
      .then(data => {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || "Local Region";
        fetchWeather(lat, lon, city);
      })
      .catch(() => {
        fetchWeather(lat, lon, "Local Area");
      });
  }

  function initializeWeather() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lon = position.coords.longitude.toFixed(4);
          reverseGeocodeAndFetchWeather(lat, lon);
        },
        (error) => {
          console.warn("Geolocation denied/failed. Defaulting to London:", error);
          fetchWeather(51.5074, -0.1278, "London");
        },
        { timeout: 8000 }
      );
    } else {
      fetchWeather(51.5074, -0.1278, "London");
    }
  }
  initializeWeather();

  // --- Load Data Pipeline ---
  async function loadAllData() {
    try {
      // Run concurrent requests for todos, planner, goals, and quote
      const [todos, planner, goals] = await Promise.all([
        apiFetch('/api/todos'),
        apiFetch('/api/planner'),
        apiFetch('/api/goals')
      ]);

      state.todos = todos;
      state.planner = planner;
      state.goals = goals;

      renderTodos();
      renderPlanner();
      renderGoals();
      fetchNewQuote(); // fetch random quote from server database
    } catch (err) {
      console.error("Error loading profile dataset: ", err);
    }
  }

  // --- Todo List Module ---
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const todoEmptyState = document.getElementById('todo-empty-state');
  const todoFilters = document.querySelectorAll('.todo-filters .filter-btn');
  let currentTodoFilter = 'all';

  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    
    try {
      const todo = await apiFetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ text, important: false })
      });
      state.todos.push(todo);
      renderTodos();
      todoInput.value = '';
      todoInput.focus();
    } catch (err) {
      alert("Failed to add task: " + err.message);
    }
  });

  function updateTodoStatusSublabel() {
    const remainingCount = state.todos.filter(t => !t.completed).length;
    document.getElementById('todo-card-status').innerHTML = `<span>${remainingCount} tasks remaining</span>`;
  }

  todoFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      todoFilters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      currentTodoFilter = btn.getAttribute('data-filter');
      renderTodos();
    });
  });

  todoList.addEventListener('click', async (e) => {
    const target = e.target;
    const taskItem = target.closest('.task-item');
    if (!taskItem) return;
    const todoId = taskItem.getAttribute('data-id');
    const todoIndex = state.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) return;

    const todo = state.todos[todoIndex];

    if (target.closest('.checkbox-custom')) {
      // Toggle Complete
      try {
        const updated = await apiFetch(`/api/todos/${todoId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: !todo.completed })
        });
        state.todos[todoIndex] = updated;
        renderTodos();
      } catch (err) {
        alert("Failed to update task: " + err.message);
      }
    } else if (target.closest('.star-btn')) {
      // Toggle Important
      try {
        const updated = await apiFetch(`/api/todos/${todoId}`, {
          method: 'PUT',
          body: JSON.stringify({ important: !todo.important })
        });
        state.todos[todoIndex] = updated;
        renderTodos();
      } catch (err) {
        alert("Failed to update task: " + err.message);
      }
    } else if (target.closest('.delete-btn')) {
      // Delete task
      try {
        await apiFetch(`/api/todos/${todoId}`, { method: 'DELETE' });
        state.todos.splice(todoIndex, 1);
        renderTodos();
      } catch (err) {
        alert("Failed to delete task: " + err.message);
      }
    }
  });

  function renderTodos() {
    todoList.innerHTML = '';
    let filtered = state.todos;
    
    if (currentTodoFilter === 'active') {
      filtered = state.todos.filter(t => !t.completed);
    } else if (currentTodoFilter === 'important') {
      filtered = state.todos.filter(t => t.important);
    } else if (currentTodoFilter === 'completed') {
      filtered = state.todos.filter(t => t.completed);
    }
    
    if (filtered.length === 0) {
      todoEmptyState.classList.remove('hidden');
      todoList.classList.add('hidden');
    } else {
      todoEmptyState.classList.add('hidden');
      todoList.classList.remove('hidden');
      
      const sorted = [...filtered].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        if (a.important !== b.important) {
          return a.important ? -1 : 1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      sorted.forEach(todo => {
        const li = document.createElement('li');
        li.className = `task-item ${todo.completed ? 'completed' : ''} ${todo.important ? 'important' : ''}`;
        li.setAttribute('data-id', todo.id);
        li.innerHTML = `
          <div class="task-item-left">
            <div class="checkbox-custom" role="checkbox" aria-checked="${todo.completed}">
              <i data-lucide="check"></i>
            </div>
            <span class="task-text">${escapeHtml(todo.text)}</span>
          </div>
          <div class="task-item-actions">
            <button class="action-btn star-btn ${todo.important ? 'active' : ''}" aria-label="Mark Important">
              <i data-lucide="star"></i>
            </button>
            <button class="action-btn delete-btn" aria-label="Delete Task">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        todoList.appendChild(li);
      });
      lucide.createIcons();
    }
    updateTodoStatusSublabel();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  // --- Daily Planner Module ---
  const plannerTimetable = document.getElementById('planner-timetable');
  const plannerHours = [
    { label: "08:00 AM", hour24: 8 },
    { label: "09:00 AM", hour24: 9 },
    { label: "10:00 AM", hour24: 10 },
    { label: "11:00 AM", hour24: 11 },
    { label: "12:00 PM", hour24: 12 },
    { label: "01:00 PM", hour24: 13 },
    { label: "02:00 PM", hour24: 14 },
    { label: "03:00 PM", hour24: 15 },
    { label: "04:00 PM", hour24: 16 },
    { label: "05:00 PM", hour24: 17 },
    { label: "06:00 PM", hour24: 18 },
    { label: "07:00 PM", hour24: 19 },
    { label: "08:00 PM", hour24: 20 },
    { label: "09:00 PM", hour24: 21 }
  ];

  function renderPlanner() {
    plannerTimetable.innerHTML = '';
    
    plannerHours.forEach(slot => {
      const savedText = state.planner[slot.label] || '';
      
      const div = document.createElement('div');
      div.className = 'planner-slot';
      div.setAttribute('data-hour24', slot.hour24);
      div.setAttribute('data-label', slot.label);
      
      div.innerHTML = `
        <div class="planner-time-label">${slot.label}</div>
        <textarea class="planner-input" placeholder="Add plan or notes..." rows="1">${escapeHtml(savedText)}</textarea>
        <div class="planner-slot-actions">
          <button class="action-btn clear-slot-btn" aria-label="Clear Plan">
            <i data-lucide="x"></i>
          </button>
        </div>
      `;
      plannerTimetable.appendChild(div);
    });
    lucide.createIcons();
    attachPlannerListeners();
    updatePlannerStatusSublabel();
  }

  let plannerSaveTimeout = null;
  function attachPlannerListeners() {
    const textareas = plannerTimetable.querySelectorAll('.planner-input');
    
    textareas.forEach(textarea => {
      autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        autoResizeTextarea(textarea);
        
        // Debounce database save (300ms)
        clearTimeout(plannerSaveTimeout);
        plannerSaveTimeout = setTimeout(() => {
          savePlannerSlot(textarea);
        }, 300);
      });
      
      textarea.addEventListener('blur', () => {
        savePlannerSlot(textarea);
      });
    });

    plannerTimetable.addEventListener('click', async (e) => {
      const clearBtn = e.target.closest('.clear-slot-btn');
      if (!clearBtn) return;
      const slot = clearBtn.closest('.planner-slot');
      const label = slot.getAttribute('data-label');
      const textarea = slot.querySelector('.planner-input');
      
      textarea.value = '';
      autoResizeTextarea(textarea);
      state.planner[label] = '';
      
      try {
        await apiFetch('/api/planner', {
          method: 'POST',
          body: JSON.stringify({ label, text: '' })
        });
        updatePlannerStatusSublabel();
      } catch (err) {
        console.error("Failed to clear planner slot:", err);
      }
    });
  }

  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
  }

  async function savePlannerSlot(textarea) {
    const slot = textarea.closest('.planner-slot');
    if (!slot) return;
    const label = slot.getAttribute('data-label');
    const text = textarea.value.trim();
    
    if (state.planner[label] === text) return; // avoid duplicate calls
    state.planner[label] = text;
    
    try {
      await apiFetch('/api/planner', {
        method: 'POST',
        body: JSON.stringify({ label, text })
      });
      updatePlannerStatusSublabel();
    } catch (err) {
      console.error("Failed to save planner slot:", err);
    }
  }

  function highlightPlannerCurrentHour(currentHour24) {
    const slots = plannerTimetable.querySelectorAll('.planner-slot');
    slots.forEach(slot => {
      const hour24 = parseInt(slot.getAttribute('data-hour24'));
      if (hour24 === currentHour24) {
        slot.classList.add('current-hour');
      } else {
        slot.classList.remove('current-hour');
      }
    });
  }

  function scrollToCurrentPlannerHour() {
    const current = plannerTimetable.querySelector('.planner-slot.current-hour');
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function updatePlannerStatusSublabel() {
    const filledSlotsCount = Object.values(state.planner).filter(text => text && text.trim().length > 0).length;
    document.getElementById('planner-card-status').innerHTML = `<span>${filledSlotsCount} slots filled</span>`;
  }

  // --- Daily Goals Module ---
  const goalsForm = document.getElementById('goals-form');
  const goalInput = document.getElementById('goal-input');
  const goalsList = document.getElementById('goals-list');
  const goalsEmptyState = document.getElementById('goals-empty-state');
  
  const goalsProgressFill = document.getElementById('goals-progress-fill');
  const goalsProgressFillLarge = document.getElementById('goals-progress-fill-large');
  const goalsProgressText = document.getElementById('goals-progress-text');
  const goalsCardStatus = document.getElementById('goals-card-status');

  goalsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = goalInput.value.trim();
    if (!text) return;
    
    try {
      const goal = await apiFetch('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      state.goals.push(goal);
      renderGoals();
      goalInput.value = '';
      goalInput.focus();
    } catch (err) {
      alert("Failed to add goal: " + err.message);
    }
  });

  function updateGoalsProgress() {
    const total = state.goals.length;
    const completed = state.goals.filter(g => g.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    goalsProgressFill.style.width = `${percentage}%`;
    goalsProgressFillLarge.style.width = `${percentage}%`;
    goalsProgressText.textContent = `${completed} of ${total} completed`;
    goalsCardStatus.innerHTML = `<span>${percentage}% completed</span>`;
  }

  goalsList.addEventListener('click', async (e) => {
    const target = e.target;
    const item = target.closest('.task-item');
    if (!item) return;
    const goalId = item.getAttribute('data-id');
    const index = state.goals.findIndex(g => g.id === goalId);
    if (index === -1) return;

    const goal = state.goals[index];

    if (target.closest('.checkbox-custom')) {
      try {
        const updated = await apiFetch(`/api/goals/${goalId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: !goal.completed })
        });
        state.goals[index] = updated;
        renderGoals();
      } catch (err) {
        alert("Failed to update goal: " + err.message);
      }
    } else if (target.closest('.delete-btn')) {
      try {
        await apiFetch(`/api/goals/${goalId}`, { method: 'DELETE' });
        state.goals.splice(index, 1);
        renderGoals();
      } catch (err) {
        alert("Failed to delete goal: " + err.message);
      }
    }
  });

  function renderGoals() {
    goalsList.innerHTML = '';
    if (state.goals.length === 0) {
      goalsEmptyState.classList.remove('hidden');
      goalsList.classList.add('hidden');
    } else {
      goalsEmptyState.classList.add('hidden');
      goalsList.classList.remove('hidden');
      state.goals.forEach(goal => {
        const li = document.createElement('li');
        li.className = `task-item ${goal.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', goal.id);
        li.innerHTML = `
          <div class="task-item-left">
            <div class="checkbox-custom" role="checkbox" aria-checked="${goal.completed}">
              <i data-lucide="check"></i>
            </div>
            <span class="task-text">${escapeHtml(goal.text)}</span>
          </div>
          <div class="task-item-actions">
            <button class="action-btn delete-btn" aria-label="Delete Goal">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        goalsList.appendChild(li);
      });
      lucide.createIcons();
    }
    updateGoalsProgress();
  }

  // --- Pomodoro Timer Module ---
  let pomodoro = {
    timeLeft: 1500, 
    duration: 1500,
    intervalId: null,
    isRunning: false,
    type: 'work' 
  };

  const timerTimeDisplay = document.getElementById('timer-time-display');
  const timerStartBtn = document.getElementById('timer-start');
  const timerPauseBtn = document.getElementById('timer-pause');
  const timerResetBtn = document.getElementById('timer-reset');
  const timerProgressRing = document.getElementById('timer-progress-ring');
  const timerSessionType = document.getElementById('timer-session-type');
  const pomodoroCardStatus = document.getElementById('pomodoro-card-status');
  const timerPresetButtons = document.querySelectorAll('.timer-presets .preset-btn');
  
  const ringCircumference = 283;
  timerProgressRing.style.strokeDasharray = ringCircumference;

  function updateTimerDisplay() {
    const mins = Math.floor(pomodoro.timeLeft / 60);
    const secs = pomodoro.timeLeft % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    timerTimeDisplay.textContent = formatted;
    
    const percentRemaining = pomodoro.timeLeft / pomodoro.duration;
    const offset = ringCircumference - (percentRemaining * ringCircumference);
    timerProgressRing.style.strokeDashoffset = offset;
    
    const badgeText = pomodoro.type === 'work' ? 'Focus Session' : 'Break Time';
    pomodoroCardStatus.innerHTML = `<span>${badgeText} (${formatted})</span>`;
  }

  function startTimer() {
    if (pomodoro.isRunning) return;
    pomodoro.isRunning = true;
    timerStartBtn.classList.add('hidden');
    timerPauseBtn.classList.remove('hidden');
    
    pomodoro.intervalId = setInterval(() => {
      pomodoro.timeLeft--;
      updateTimerDisplay();
      if (pomodoro.timeLeft <= 0) {
        clearInterval(pomodoro.intervalId);
        pomodoro.isRunning = false;
        timerStartBtn.classList.remove('hidden');
        timerPauseBtn.classList.add('hidden');
        
        playTimerAlarm();
        handleSessionEnd();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!pomodoro.isRunning) return;
    clearInterval(pomodoro.intervalId);
    pomodoro.isRunning = false;
    timerStartBtn.classList.remove('hidden');
    timerPauseBtn.classList.add('hidden');
    
    const mins = Math.floor(pomodoro.timeLeft / 60);
    const secs = pomodoro.timeLeft % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    pomodoroCardStatus.innerHTML = `<span>Paused (${formatted})</span>`;
  }

  function resetTimer() {
    clearInterval(pomodoro.intervalId);
    pomodoro.isRunning = false;
    pomodoro.timeLeft = pomodoro.duration;
    
    timerStartBtn.classList.remove('hidden');
    timerPauseBtn.classList.add('hidden');
    
    updateTimerDisplay();
  }

  function setTimerPreset(durationSeconds, sessionType) {
    clearInterval(pomodoro.intervalId);
    pomodoro.isRunning = false;
    pomodoro.duration = durationSeconds;
    pomodoro.timeLeft = durationSeconds;
    pomodoro.type = sessionType;

    timerSessionType.textContent = sessionType === 'work' ? 'Work Session' : 
                                   sessionType === 'break' ? 'Short Break' : 'Long Break';
    
    if (sessionType === 'work') {
      timerSessionType.className = 'timer-session-badge';
    } else {
      timerSessionType.className = 'timer-session-badge break';
    }
    
    timerStartBtn.classList.remove('hidden');
    timerPauseBtn.classList.add('hidden');
    updateTimerDisplay();
  }

  async function handleSessionEnd() {
    // Log the focus session to the database!
    try {
      await apiFetch('/api/focus-sessions', {
        method: 'POST',
        body: JSON.stringify({
          duration: pomodoro.duration,
          type: pomodoro.type
        })
      });
    } catch (err) {
      console.error("Failed to log focus session to backend stats: ", err);
    }

    const alertMessage = pomodoro.type === 'work' 
      ? "Work session complete! Time to take a well-deserved break." 
      : "Break is over! Prepare to refocus on your goals.";
    alert(alertMessage);

    // Auto toggle preset
    if (pomodoro.type === 'work') {
      timerPresetButtons.forEach(btn => btn.classList.remove('active'));
      const breakBtn = document.querySelector('[data-type="break"]');
      if (breakBtn) breakBtn.classList.add('active');
      setTimerPreset(300, 'break');
    } else {
      timerPresetButtons.forEach(btn => btn.classList.remove('active'));
      const workBtn = document.querySelector('[data-type="work"]');
      if (workBtn) workBtn.classList.add('active');
      setTimerPreset(1500, 'work');
    }
  }

  function playTimerAlarm() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      const now = audioCtx.currentTime;
      playBeep(987.77, now, 0.25); // B5
      playBeep(1318.51, now + 0.3, 0.4); // E6
    } catch (e) {
      console.warn("Audio alarm playback blocked/unsupported:", e);
    }
  }

  timerStartBtn.addEventListener('click', startTimer);
  timerPauseBtn.addEventListener('click', pauseTimer);
  timerResetBtn.addEventListener('click', resetTimer);

  timerPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timerPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dur = parseInt(btn.getAttribute('data-duration'));
      const type = btn.getAttribute('data-type');
      setTimerPreset(dur, type);
    });
  });

  updateTimerDisplay();

  // --- Motivation Quotes Module ---
  const quotePreview = document.getElementById('quote-preview');
  const quoteFullText = document.getElementById('quote-full-text');
  const quoteFullAuthor = document.getElementById('quote-full-author');
  const quoteLoader = document.getElementById('quote-loader');
  const quoteContentWrapper = document.getElementById('quote-content-wrapper');
  const newQuoteBtn = document.getElementById('new-quote-btn');

  function renderQuote(quoteObj) {
    state.currentQuote = quoteObj;
    quotePreview.textContent = `"${quoteObj.quote}"`;
    quoteFullText.textContent = quoteObj.quote;
    quoteFullAuthor.textContent = `— ${quoteObj.author}`;
    
    quoteLoader.classList.add('hidden');
    quoteContentWrapper.classList.remove('hidden');
  }

  function fetchNewQuote() {
    quoteLoader.classList.remove('hidden');
    quoteContentWrapper.classList.add('hidden');
    
    apiFetch('/api/quotes/random')
      .then(data => {
        renderQuote(data);
      })
      .catch(err => {
        console.warn("Failed to load quote, showing generic: ", err);
        renderQuote({ quote: "Form follows focus.", author: "Aura System" });
      });
  }

  newQuoteBtn.addEventListener('click', fetchNewQuote);

  // --- Admin Console Interface Module ---
  const adminTabButtons = document.querySelectorAll('.admin-tab-btn');
  const adminTabContents = document.querySelectorAll('.admin-tab-content');

  adminTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      loadAdminTab(tabId);
    });
  });

  function loadAdminTab(tabId) {
    adminTabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    adminTabContents.forEach(content => {
      if (content.id === `admin-tab-${tabId}`) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });

    // Fetch tab specific datasets
    if (tabId === 'stats') {
      loadAdminStats();
    } else if (tabId === 'users') {
      loadAdminUsers();
    } else if (tabId === 'quotes') {
      loadAdminCustomQuotes();
    } else if (tabId === 'settings') {
      loadAdminSettings();
    }
  }

  // 1. Load Overview Metrics
  async function loadAdminStats() {
    try {
      const stats = await apiFetch('/api/admin/stats');
      document.getElementById('admin-stat-users').textContent = stats.totalUsers;
      document.getElementById('admin-stat-focus').textContent = `${stats.totalFocusMinutes}m`;
      document.getElementById('admin-stat-tasks').textContent = `${stats.completionRate}%`;
      document.getElementById('admin-stat-goals').textContent = `${stats.goalCompletionRate}%`;
    } catch (err) {
      console.error("Failed to load admin stats dashboard: ", err);
    }
  }

  // 2. Users Management
  const adminUsersTbody = document.getElementById('admin-users-tbody');
  async function loadAdminUsers() {
    try {
      const users = await apiFetch('/api/admin/users');
      adminUsersTbody.innerHTML = '';
      
      users.forEach(u => {
        const tr = document.createElement('tr');
        const roleLabel = u.role === 'admin' ? 'Administrator' : 'User';
        const dateFormatted = new Date(u.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        // Hide delete/promote operations on the root seed admin u_admin
        const isRootAdmin = u.id === 'u_admin';
        const actionHtml = isRootAdmin 
          ? `<span class="text-muted" style="font-size: 0.85rem;">System Owner</span>` 
          : `
            <div class="table-actions-cell">
              <button class="glass-btn table-action-btn role-toggle-btn" data-id="${u.id}" data-role="${u.role}">
                Toggle Role
              </button>
              <button class="glass-btn table-action-btn delete-btn user-delete-btn" data-id="${u.id}" style="color: var(--danger-color); border-color: rgba(239, 68, 68, 0.2);">
                Delete
              </button>
            </div>
          `;

        tr.innerHTML = `
          <td><strong>${escapeHtml(u.username)}</strong></td>
          <td><span class="role-badge ${u.role}">${roleLabel}</span></td>
          <td>${dateFormatted}</td>
          <td>${actionHtml}</td>
        `;
        adminUsersTbody.appendChild(tr);
      });
      attachAdminUserActions();
    } catch (err) {
      console.error("Failed to load user records: ", err);
    }
  }

  function attachAdminUserActions() {
    // Toggle role button handlers
    adminUsersTbody.querySelectorAll('.role-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        const currentRole = btn.getAttribute('data-role');
        const nextRole = currentRole === 'admin' ? 'user' : 'admin';
        
        try {
          await apiFetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role: nextRole })
          });
          loadAdminUsers();
        } catch (err) {
          alert("Error updating user role: " + err.message);
        }
      });
    });

    // Delete user button handlers
    adminUsersTbody.querySelectorAll('.user-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        if (!confirm("Are you sure you want to permanently delete this user and all associated productivity data? This action is irreversible.")) {
          return;
        }
        try {
          await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
          loadAdminUsers();
        } catch (err) {
          alert("Error deleting user: " + err.message);
        }
      });
    });
  }

  // 3. Custom Quotes Management
  const adminQuotesList = document.getElementById('admin-quotes-list');
  const adminQuotesEmpty = document.getElementById('admin-quotes-empty');
  const adminAddQuoteForm = document.getElementById('admin-add-quote-form');

  async function loadAdminCustomQuotes() {
    try {
      const customQuotes = await apiFetch('/api/admin/quotes');
      adminQuotesList.innerHTML = '';
      
      if (customQuotes.length === 0) {
        adminQuotesEmpty.classList.remove('hidden');
        adminQuotesList.classList.add('hidden');
      } else {
        adminQuotesEmpty.classList.add('hidden');
        adminQuotesList.classList.remove('hidden');
        
        customQuotes.forEach(q => {
          const li = document.createElement('li');
          li.className = 'admin-quote-item';
          li.innerHTML = `
            <div class="admin-quote-item-content">
              <span class="admin-quote-item-text">"${escapeHtml(q.quote)}"</span>
              <span class="admin-quote-item-author">— ${escapeHtml(q.author)}</span>
            </div>
            <button class="action-btn delete-btn quote-delete-btn" data-id="${q.id}" aria-label="Delete Quote">
              <i data-lucide="trash-2"></i>
            </button>
          `;
          adminQuotesList.appendChild(li);
        });
        lucide.createIcons();
        attachAdminQuoteActions();
      }
    } catch (err) {
      console.error("Failed to load admin custom quotes list:", err);
    }
  }

  function attachAdminQuoteActions() {
    adminQuotesList.querySelectorAll('.quote-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const quoteId = btn.getAttribute('data-id');
        try {
          await apiFetch(`/api/admin/quotes/${quoteId}`, { method: 'DELETE' });
          loadAdminCustomQuotes();
        } catch (err) {
          alert("Failed to delete quote: " + err.message);
        }
      });
    });
  }

  adminAddQuoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const quote = document.getElementById('admin-quote-text').value.trim();
    const author = document.getElementById('admin-quote-author').value.trim();

    try {
      await apiFetch('/api/admin/quotes', {
        method: 'POST',
        body: JSON.stringify({ quote, author })
      });
      document.getElementById('admin-quote-text').value = '';
      document.getElementById('admin-quote-author').value = '';
      loadAdminCustomQuotes();
    } catch (err) {
      alert("Failed to add custom quote: " + err.message);
    }
  });

  // 4. System Settings
  const adminConfigRegistration = document.getElementById('admin-config-registration');
  async function loadAdminSettings() {
    try {
      const config = await apiFetch('/api/admin/config');
      adminConfigRegistration.checked = config.registrationEnabled;
    } catch (err) {
      console.error("Failed to load registration toggle setting: ", err);
    }
  }

  adminConfigRegistration.addEventListener('change', async () => {
    const registrationEnabled = adminConfigRegistration.checked;
    try {
      await apiFetch('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ registrationEnabled })
      });
    } catch (err) {
      alert("Failed to update registration settings: " + err.message);
      // Revert checked state
      adminConfigRegistration.checked = !registrationEnabled;
    }
  });

  // Start Clock and Auth Flow Check on App Boot
  updateClock();
  setInterval(updateClock, 1000);
  checkAuth();
});
