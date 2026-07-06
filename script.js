/* -------------------------------------------------------------
 * Aura - Premium Productivity Dashboard JavaScript
 * Modular structures for navigation, weather, todos, planner,
 * goals, pomodoro timer, and motivational quotes.
 * ------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize icons
  lucide.createIcons();
  // --- Local Fallback Quotes Catalog ---
  const localQuotes = [
    { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { quote: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { quote: "Productivity is being able to do things that you were never able to do before.", author: "Franz Kafka" },
    { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { quote: "Do not wait; the time will never be 'just right.'", author: "Napoleon Hill" },
    { quote: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { quote: "Your mind is for having ideas, not holding them.", author: "David Allen" },
    { quote: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
    { quote: "Done is better than perfect.", author: "Sheryl Sandberg" },
    { quote: "Yesterday you said tomorrow. Just do it.", author: "Nike" },
    { quote: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
    { quote: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
    { quote: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
    { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { quote: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
    { quote: "Don't count the days, make the days count.", author: "Muhammad Ali" },
    { quote: "Make each day your masterpiece.", author: "John Wooden" },
    { quote: "Keep close to Nature's heart... and break clear away, once in a while, and climb a mountain or spend a week in the woods. Wash your spirit clean.", author: "John Muir" }
  ];
  // --- Core State ---
  let state = {
    todos: JSON.parse(localStorage.getItem('aura_todos')) || [],
    planner: JSON.parse(localStorage.getItem('aura_planner')) || {},
    goals: JSON.parse(localStorage.getItem('aura_goals')) || [],
    theme: localStorage.getItem('aura_theme') || 'dark',
    currentQuote: null
  };
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
  // --- Time & Date Engine ---
  const timeText = document.getElementById('time-text');
  const dateText = document.getElementById('date-text');
  function updateClock() {
    const now = new Date();
    
    // Format Time: HH:MM:SS AM/PM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // The hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');
    
    timeText.textContent = `${formattedHours}:${minutes}:${seconds} ${ampm}`;
    // Format Date: Monday, July 6, 2026
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateText.textContent = now.toLocaleDateString('en-US', options);
    // Dynamic Background triggers checking hourly
    updateDynamicBackground(now.getHours());
    
    // Highlight Current hour in planner
    highlightPlannerCurrentHour(now.getHours());
  }
  // Run Clock immediately & start interval
  updateClock();
  setInterval(updateClock, 1000);
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
      document.body.className = ''; // Reset all classes
      document.body.classList.add(backgroundClass);
      lastBackgroundClass = backgroundClass;
    }
  }
  // --- Navigation Router ---
  const activeViews = document.querySelectorAll('.view-section');
  const clickableCards = document.querySelectorAll('.clickable-card');
  const backButtons = document.querySelectorAll('.back-btn');
  function navigateTo(targetId) {
    const currentActive = document.querySelector('.view-section.active');
    const targetSection = document.getElementById(targetId);
    
    if (currentActive && targetSection && currentActive !== targetSection) {
      // Fade out current
      currentActive.style.opacity = '0';
      currentActive.style.transform = 'translateY(12px)';
      
      setTimeout(() => {
        currentActive.classList.remove('active');
        
        // Setup target before fade in
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        
        // Force reflow
        targetSection.offsetHeight;
        
        // Fade in target
        targetSection.style.opacity = '1';
        targetSection.style.transform = 'translateY(0)';
        
        // If navigation target requires custom hook, execute it
        if (targetId === 'planner-section') {
          scrollToCurrentPlannerHour();
        }
      }, 250);
    }
  }
  // Card triggers
  clickableCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetFeature = card.getAttribute('data-target');
      navigateTo(`${targetFeature}-section`);
    });
  });
  // Back button triggers
  backButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid double click issues
      navigateTo('dashboard-home');
      // Refresh status indicators on home screen when returning
      updateTodoStatusSublabel();
      updatePlannerStatusSublabel();
      updateGoalsProgress();
    });
  });
  // --- Weather Widget Module ---
  const weatherLoading = document.getElementById('weather-loading');
  const weatherContent = document.getElementById('weather-content');
  const weatherTemp = document.getElementById('weather-temp');
  const weatherCity = document.getElementById('weather-city');
  const weatherDesc = document.getElementById('weather-desc');
  const weatherIconContainer = document.getElementById('weather-icon-container');
  // WMO Code Translation Map
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
        // Update DOM
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
        // Fallback info display
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
    // Attempt reverse geocoding via OpenStreetMap Nominatim
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
        // Fallback to coordinates format as city name
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
          console.warn("Geolocation denied or failed. Loading London, UK as default: ", error);
          // Fallback to London, UK
          fetchWeather(51.5074, -0.1278, "London");
        },
        { timeout: 8000 }
      );
    } else {
      // Browser doesn't support geolocation
      fetchWeather(51.5074, -0.1278, "London");
    }
  }
  initializeWeather();
  // --- Todo List Module ---
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');
  const todoEmptyState = document.getElementById('todo-empty-state');
  const todoFilters = document.querySelectorAll('.todo-filters .filter-btn');
  let currentTodoFilter = 'all';
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    const newTodo = {
      id: Date.now(),
      text: text,
      completed: false,
      important: false
    };
    state.todos.push(newTodo);
    saveTodos();
    renderTodos();
    todoInput.value = '';
    todoInput.focus();
  });
  function saveTodos() {
    localStorage.setItem('aura_todos', JSON.stringify(state.todos));
    updateTodoStatusSublabel();
  }
  function updateTodoStatusSublabel() {
    const remainingCount = state.todos.filter(t => !t.completed).length;
    document.getElementById('todo-card-status').innerHTML = `<span>${remainingCount} tasks remaining</span>`;
  }
  // Filter Buttons
  todoFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      todoFilters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      currentTodoFilter = btn.getAttribute('data-filter');
      renderTodos();
    });
  });
  // Event Delegation for List actions
  todoList.addEventListener('click', (e) => {
    const target = e.target;
    const taskItem = target.closest('.task-item');
    if (!taskItem) return;
    const todoId = parseInt(taskItem.getAttribute('data-id'));
    // Find the matching todo in state
    const todoIndex = state.todos.findIndex(t => t.id === todoId);
    if (todoIndex === -1) return;
    if (target.closest('.checkbox-custom')) {
      // Toggle complete
      state.todos[todoIndex].completed = !state.todos[todoIndex].completed;
      saveTodos();
      renderTodos();
    } else if (target.closest('.star-btn')) {
      // Toggle important
      state.todos[todoIndex].important = !state.todos[todoIndex].important;
      saveTodos();
      renderTodos();
    } else if (target.closest('.delete-btn')) {
      // Delete todo
      state.todos.splice(todoIndex, 1);
      saveTodos();
      renderTodos();
    }
  });
  function renderTodos() {
    todoList.innerHTML = '';
    
    // Filter logic
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
      // Sort: important tasks first, completed tasks last
      const sorted = [...filtered].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        if (a.important !== b.important) {
          return a.important ? -1 : 1;
        }
        return b.id - a.id;
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
  // HTML escape helper
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }
  // Initial Todo Render
  renderTodos();
  // --- Daily Planner Module ---
  const plannerTimetable = document.getElementById('planner-timetable');
  
  // Schedule Hours configuration (8 AM to 9 PM)
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
  function attachPlannerListeners() {
    const textareas = plannerTimetable.querySelectorAll('.planner-input');
    
    textareas.forEach(textarea => {
      // Auto-resize height on input
      autoResizeTextarea(textarea);
      textarea.addEventListener('input', () => {
        autoResizeTextarea(textarea);
        savePlannerSlot(textarea);
      });
      // Blur save
      textarea.addEventListener('blur', () => {
        savePlannerSlot(textarea);
      });
    });
    // Clear slot handler
    plannerTimetable.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('.clear-slot-btn');
      if (!clearBtn) return;
      const slot = clearBtn.closest('.planner-slot');
      const label = slot.getAttribute('data-label');
      const textarea = slot.querySelector('.planner-input');
      textarea.value = '';
      autoResizeTextarea(textarea);
      state.planner[label] = '';
      localStorage.setItem('aura_planner', JSON.stringify(state.planner));
      updatePlannerStatusSublabel();
    });
  }
  function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
  }
  function savePlannerSlot(textarea) {
    const slot = textarea.closest('.planner-slot');
    const label = slot.getAttribute('data-label');
    const text = textarea.value.trim();
    state.planner[label] = text;
    localStorage.setItem('aura_planner', JSON.stringify(state.planner));
    updatePlannerStatusSublabel();
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
    document.getElementById('planner-card-status').innerHTML = `<span>${filledSlotsCount} time blocks scheduled</span>`;
  }
  // Initial render
  renderPlanner();
  // --- Daily Goals Module ---
  const goalsForm = document.getElementById('goals-form');
  const goalInput = document.getElementById('goal-input');
  const goalsList = document.getElementById('goals-list');
  const goalsEmptyState = document.getElementById('goals-empty-state');
  
  const goalsProgressFill = document.getElementById('goals-progress-fill');
  const goalsProgressFillLarge = document.getElementById('goals-progress-fill-large');
  const goalsProgressText = document.getElementById('goals-progress-text');
  const goalsCardStatus = document.getElementById('goals-card-status');
  goalsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = goalInput.value.trim();
    if (!text) return;
    const newGoal = {
      id: Date.now(),
      text: text,
      completed: false
    };
    state.goals.push(newGoal);
    saveGoals();
    renderGoals();
    goalInput.value = '';
    goalInput.focus();
  });
  function saveGoals() {
    localStorage.setItem('aura_goals', JSON.stringify(state.goals));
    updateGoalsProgress();
  }
  function updateGoalsProgress() {
    const total = state.goals.length;
    const completed = state.goals.filter(g => g.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    // Update progress bars & text
    goalsProgressFill.style.width = `${percentage}%`;
    goalsProgressFillLarge.style.width = `${percentage}%`;
    goalsProgressText.textContent = `${completed} of ${total} completed`;
    goalsCardStatus.innerHTML = `<span>${percentage}% completed</span>`;
  }
  goalsList.addEventListener('click', (e) => {
    const target = e.target;
    const item = target.closest('.task-item');
    if (!item) return;
    const goalId = parseInt(item.getAttribute('data-id'));
    const index = state.goals.findIndex(g => g.id === goalId);
    if (index === -1) return;
    if (target.closest('.checkbox-custom')) {
      state.goals[index].completed = !state.goals[index].completed;
      saveGoals();
      renderGoals();
    } else if (target.closest('.delete-btn')) {
      state.goals.splice(index, 1);
      saveGoals();
      renderGoals();
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
  // Initial Render
  renderGoals();
  // --- Pomodoro Timer Module ---
  let pomodoro = {
    timeLeft: 1500, // 25 mins in seconds
    duration: 1500,
    intervalId: null,
    isRunning: false,
    type: 'work' // 'work', 'break', 'long-break'
  };
  const timerTimeDisplay = document.getElementById('timer-time-display');
  const timerStartBtn = document.getElementById('timer-start');
  const timerPauseBtn = document.getElementById('timer-pause');
  const timerResetBtn = document.getElementById('timer-reset');
  const timerProgressRing = document.getElementById('timer-progress-ring');
  const timerSessionType = document.getElementById('timer-session-type');
  const pomodoroCardStatus = document.getElementById('pomodoro-card-status');
  const timerPresetButtons = document.querySelectorAll('.timer-presets .preset-btn');
  // Circ = 2 * PI * r = 2 * PI * 45 = 282.74 ≈ 283
  const ringCircumference = 283;
  timerProgressRing.style.strokeDasharray = ringCircumference;
  function updateTimerDisplay() {
    const mins = Math.floor(pomodoro.timeLeft / 60);
    const secs = pomodoro.timeLeft % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    // Update main clock text
    timerTimeDisplay.textContent = formatted;
    // Update SVG progress ring
    const percentRemaining = pomodoro.timeLeft / pomodoro.duration;
    const offset = ringCircumference - (percentRemaining * ringCircumference);
    timerProgressRing.style.strokeDashoffset = offset;
    // Update dashboard state status
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
    
    // Update card label to "Paused"
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
    // Style updates
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
  function handleSessionEnd() {
    const alertMessage = pomodoro.type === 'work' 
      ? "Work session complete! Time to take a well-deserved break." 
      : "Break is over! Prepare to refocus on your goals.";
    alert(alertMessage);
    // Auto toggle to next recommended state (don't start automatically, let user click play)
    if (pomodoro.type === 'work') {
      // Switch to short break
      timerPresetButtons.forEach(btn => btn.classList.remove('active'));
      const breakBtn = document.querySelector('[data-type="break"]');
      if (breakBtn) breakBtn.classList.add('active');
      setTimerPreset(300, 'break');
    } else {
      // Switch back to work
      timerPresetButtons.forEach(btn => btn.classList.remove('active'));
      const workBtn = document.querySelector('[data-type="work"]');
      if (workBtn) workBtn.classList.add('active');
      setTimerPreset(1500, 'work');
    }
  }
  // Synthetic beep sound via browser Web Audio API
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
      // Play dual chime: high-pitch sweet ring
      const now = audioCtx.currentTime;
      playBeep(987.77, now, 0.25); // B5
      playBeep(1318.51, now + 0.3, 0.4); // E6
    } catch (e) {
      console.warn("Audio alarm playback blocked/unsupported: ", e);
    }
  }
  // Setup control listeners
  timerStartBtn.addEventListener('click', startTimer);
  timerPauseBtn.addEventListener('click', pauseTimer);
  timerResetBtn.addEventListener('click', resetTimer);
  // Setup presets
  timerPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      timerPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dur = parseInt(btn.getAttribute('data-duration'));
      const type = btn.getAttribute('data-type');
      setTimerPreset(dur, type);
    });
  });
  // Initial Pomodoro timer setup
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
    
    // Update preview card
    quotePreview.textContent = `"${quoteObj.quote}"`;
    // Update full details in Quotes overlay view
    quoteFullText.textContent = quoteObj.quote;
    quoteFullAuthor.textContent = `— ${quoteObj.author}`;
    
    quoteLoader.classList.add('hidden');
    quoteContentWrapper.classList.remove('hidden');
  }
  function fetchNewQuote() {
    quoteLoader.classList.remove('hidden');
    quoteContentWrapper.classList.add('hidden');
    // Fetch random quote via DummyJSON API (very fast, supports CORS)
    fetch('https://dummyjson.com/quotes/random')
      .then(res => {
        if (!res.ok) throw new Error("API failed");
        return res.json();
      })
      .then(data => {
        renderQuote({ quote: data.quote, author: data.author });
      })
      .catch(err => {
        console.warn("Could not fetch quote from API, using fallback: ", err);
        // Choose random from fallback local list
        const randIndex = Math.floor(Math.random() * localQuotes.length);
        renderQuote(localQuotes[randIndex]);
      });
  }
  newQuoteBtn.addEventListener('click', fetchNewQuote);
  // Load first quote on boot
  fetchNewQuote();
});