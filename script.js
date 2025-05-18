

let currentDate = new Date();
let moodData = {};
let startDate = null;
try {
  moodData = JSON.parse(localStorage.getItem("moodData") || "{}");
  startDate = localStorage.getItem("startDate") || null;
} catch (e) {
  console.error("Error accessing localStorage:", e);
  alert("Unable to access local storage. Some features may not work.");
}
let selectedMood = null;
let selectedMoodName = null;
let selectedDateKey = null;
let originalNote = "";
let tempMood = null; // Temporary mood for current date before saving

// Web Audio API for simple sound effects with fallback
let audioCtx = null;
try {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
  console.warn("Web Audio API not supported:", e);
}
function playMoodSound(mood) {
  if (!audioCtx) return;
  try {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    const frequencies = {
      '😊': 440, // Happy: A4 note (cheerful)
      '🙂': 392, // Content: G4 note (calm)
      '😐': 349, // Neutral: F4 note (balanced)
      '😢': 220, // Sad: A3 note (low)
      '😣': 523, // Angry: C5 note (sharp)
      '😴': 110, // Tired: A2 note (deep)
    };

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequencies[mood] || 440, audioCtx.currentTime);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Error playing sound:", e);
  }
}

function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return "UTC";
  }
}

function isCurrentDateEditable() {
  const now = new Date();
  const istTime = now.toLocaleString("en-US", { timeZone: getUserTimeZone(), hour: "numeric", minute: "numeric", hour12: false });
  const [hour, minute] = istTime.split(":").map(Number);
  const isCurrentDate =
    currentDate.getFullYear() === now.getFullYear() &&
    currentDate.getMonth() === now.getMonth() &&
    currentDate.getDate() === now.getDate();
  return isCurrentDate && (hour < 23 || (hour === 23 && minute <= 59));
}

function isLastDay(dateKey) {
  const now = new Date();
  const lastDay = new Date(now);
  lastDay.setDate(now.getDate() - 1);
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === lastDay.getFullYear() &&
    date.getMonth() === lastDay.getMonth() &&
    date.getDate() === lastDay.getDate()
  );
}

function isDateAfterStartDate(dateKey) {
  if (!startDate) return true; // No start date set yet, allow all dates
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  return date >= start;
}

function updateMoodLogState() {
  const moodLog = document.querySelector(".mood-log");
  const moodOptions = document.querySelectorAll(".mood-option");
  const noteInput = document.getElementById("noteInput");
  const saveButton = document.getElementById("saveButton");

  const isCurrent = isCurrentDateEditable();
  const isLast = selectedDateKey && isLastDay(selectedDateKey);

  if (isCurrent || isLast) {
    moodLog.classList.remove("disabled");
    moodOptions.forEach(opt => {
      opt.classList.remove("disabled");
      opt.setAttribute("aria-checked", opt.dataset.mood === selectedMood ? "true" : "false");
      opt.onclick = () => selectMood(opt.dataset.mood, opt.dataset.label);
      opt.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectMood(opt.dataset.mood, opt.dataset.label);
        }
      };
    });
    noteInput.disabled = false;
    saveButton.disabled = !selectedMood;
    saveButton.onclick = saveMood;
  } else {
    moodLog.classList.add("disabled");
    moodOptions.forEach(opt => {
      opt.classList.add("disabled");
      opt.setAttribute("aria-checked", "false");
      opt.onclick = null;
      opt.onkeydown = null;
    });
    noteInput.disabled = true;
    saveButton.disabled = true;
  }
}

function updateCurrentDateEmoji(mood) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const calendar = document.getElementById("calendar");
  const dayContainers = calendar.querySelectorAll(".day-container");
  dayContainers.forEach(container => {
    const dayEl = container.querySelector(".day");
    const date = parseInt(dayEl.innerText, 10);
    const isToday = date === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
    if (isToday) {
      const emojiEl = container.querySelector(".mood-emoji");
      emojiEl.innerText = mood && isDateAfterStartDate(todayKey) ? mood : "";
    }
  });
}

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const lastDay = new Date(today);
  lastDay.setDate(today.getDate() - 1);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const lastDayKey = `${lastDay.getFullYear()}-${lastDay.getMonth() + 1}-${lastDay.getDate()}`;

  document.getElementById("monthLabel").innerText =
    currentDate.toLocaleString("default", { month: "long" }) + " " + year;

  for (let i = 1; i <= daysInMonth; i++) {
    const key = `${year}-${month + 1}-${i}`;
    const mood = moodData[key]?.mood || (key === todayKey && tempMood);
    const dayContainer = document.createElement("div");
    dayContainer.className = "day-container";
    
    const emojiEl = document.createElement("span");
    emojiEl.className = "mood-emoji";
    emojiEl.innerText = (mood && isDateAfterStartDate(key)) ? mood : "";
    emojiEl.setAttribute("aria-hidden", "true");
    dayContainer.appendChild(emojiEl);

    const dayEl = document.createElement("div");
    dayEl.className = "day";
    dayEl.innerText = i;
    dayEl.setAttribute("aria-label", `Day ${i} ${mood ? `, mood: ${moodData[key]?.moodName || selectedMoodName}` : ""}`);
    dayEl.setAttribute("tabindex", "0");

    const isToday = isCurrentMonth && i === today.getDate();
    const isLast = isCurrentMonth && i === lastDay.getDate();

    if (!isToday && !isLast) {
      dayEl.classList.add("disabled");
      dayEl.onclick = null;
      dayEl.onkeydown = null;
    } else {
      if (isToday) {
        dayEl.classList.add("selected");
        selectedDateKey = key;
      }
      dayEl.onclick = () => {
        document.querySelectorAll(".day").forEach(el => el.classList.remove("selected"));
        dayEl.classList.add("selected");
        selectedDateKey = key;
        originalNote = moodData[key]?.note || "";
        document.getElementById("noteInput").value = originalNote;
        selectedMood = moodData[key]?.mood || tempMood || null;
        selectedMoodName = moodData[key]?.moodName || (tempMood ? document.querySelector(`.mood-option[data-mood="${tempMood}"]`)?.dataset.label : null);
        currentDate.setDate(i);
        updateMoodLogState();
      };
      dayEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dayEl.onclick();
        }
      };
    }

    dayContainer.appendChild(dayEl);
    calendar.appendChild(dayContainer);
  }

  selectedDateKey = todayKey;
  originalNote = moodData[todayKey]?.note || "";
  document.getElementById("noteInput").value = originalNote;
  selectedMood = moodData[todayKey]?.mood || tempMood || null;
  selectedMoodName = moodData[todayKey]?.moodName || (tempMood ? document.querySelector(`.mood-option[data-mood="${tempMood}"]`)?.dataset.label : null);
  updateMoodLogState();
}

function selectMood(mood, moodName) {
  if (!isCurrentDateEditable() && !isLastDay(selectedDateKey)) {
    alert("Mood can only be set for today or yesterday.");
    return;
  }
  selectedMood = mood;
  selectedMoodName = moodName;
  document.querySelectorAll(".mood-option").forEach(opt => {
    opt.setAttribute("aria-checked", opt.dataset.mood === mood ? "true" : "false");
  });
  if (isCurrentDateEditable()) {
    tempMood = mood;
    updateCurrentDateEmoji(mood);
  }
  alert(`Mood selected for ${isCurrentDateEditable() ? 'today' : 'yesterday'}. You can change it again if needed.`);
  updateMoodLogState();
  playMoodSound(mood);
}

function saveMood() {
  if (!isCurrentDateEditable() && !isLastDay(selectedDateKey)) {
    alert("Mood can only be set for today or yesterday.");
    return;
  }
  if (!selectedMood) {
    alert("Please select a mood.");
    return;
  }
  const note = document.getElementById("noteInput").value;
  if (note.length > 100) {
    alert("Note cannot exceed 100 characters.");
    return;
  }
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  const key = `${year}-${month}-${day}`;
  moodData[key] = {
    mood: selectedMood,
    moodName: selectedMoodName,
    note: note,
  };
  if (!startDate) {
    startDate = key;
    try {
      localStorage.setItem("startDate", startDate);
    } catch (e) {
      console.error("Error saving startDate to localStorage:", e);
    }
  }
  tempMood = null; // Clear temp mood after saving
  try {
    localStorage.setItem("moodData", JSON.stringify(moodData));
  } catch (e) {
    console.error("Error saving to localStorage:", e);
    alert("Unable to save mood. Please check browser settings.");
  }
  originalNote = note;
  renderCalendar();
  checkConsecutiveSadMoods();
  const tips = getMoodTips(selectedMood);
  if (tips.length > 0) {
    alert('Tip: ' + tips[Math.floor(Math.random() * tips.length)]);
  }
}

function resetMoodData() {
  if (confirm("Are you sure you want to reset all mood data? This cannot be undone.")) {
    moodData = {};
    startDate = null;
    tempMood = null;
    try {
      localStorage.setItem("moodData", JSON.stringify(moodData));
      localStorage.removeItem("startDate");
      localStorage.removeItem("welcomeShown");
    } catch (e) {
      console.error("Error resetting localStorage:", e);
      alert("Unable to reset data. Please check browser settings.");
    }
    renderCalendar();
    document.getElementById("statsDisplay").innerHTML = "";
    alert("All mood data has been reset.");
  }
}

function checkConsecutiveSadMoods() {
  const now = new Date();
  const sadEmojis = ['😢', '😔'];
  let consecutiveSadDays = 0;

  for (let i = 0; i < 4; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    if (sadEmojis.includes(moodData[key]?.mood)) {
      consecutiveSadDays++;
    } else break;
  }

  if (consecutiveSadDays >= 3) {
    const messages = [
      "Remember, tough times don't last forever. Consider talking to someone you trust.",
      "Your feelings are valid. Would you like to try some mood-lifting activities?",
      "You're stronger than you think. How about going for a walk or calling a friend?"
    ];
    alert(messages[Math.floor(Math.random() * messages.length)]);
  }
}

function showWelcomePopup() {
  if (!localStorage.getItem('welcomeShown')) {
    alert('Welcome to Mood Tracker! Track moods with a sleek Poppins font UI. Click a mood emoji to see it above today’s date instantly (until 11:59 PM). Edit yesterday’s mood and note. Emojis show from your first entry. Only today and yesterday are enabled.');
    try {
      localStorage.setItem('welcomeShown', 'true');
    } catch (e) {
      console.error("Error setting welcomeShown:", e);
    }
  }
}

function getMoodTips(mood) {
  const tips = {
    '😊': ['Keep spreading the joy!', 'Share your happiness with others'],
    '🙂': ['Great mood! Stay active to maintain it'],
    '😐': ['Try something new today', 'How about a short walk?'],
    '😢': ['Talk to a friend', 'Practice deep breathing', 'Consider journaling'],
    '😣': ['Take a break', 'Try some calming exercises', 'Listen to soothing music'],
    '😴': ['Get some rest', 'Take a power nap', 'Consider an earlier bedtime']
  };
  return tips[mood] || [];
}

function showMoodInsights() {
  const display = document.getElementById('statsDisplay');
  const now = new Date();
  const weekData = [];
  const moodCounts = {};

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    weekData.push(moodData[key]?.mood || (key === `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}` && tempMood) || null);
    if ((moodData[key]?.mood || (key === `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}` && tempMood)) && isDateAfterStartDate(key)) {
      const mood = moodData[key]?.mood || tempMood;
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
  }

  const mostFrequent = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])[0];

  const maxHeight = 100;
  const maxCount = Math.max(...Object.values(moodCounts), 1);
  const chartData = weekData.map(mood => mood && isDateAfterStartDate(`${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate() - (6 - weekData.indexOf(mood))}`) ? (moodCounts[mood] || 1) / maxCount * maxHeight : 10);

  display.innerHTML = `
    <h3>Weekly Mood Summary</h3>
    <p>Most frequent mood: ${mostFrequent ? `${mostFrequent[0]} (${moodData[Object.keys(moodData).find(k => moodData[k].mood === mostFrequent[0])]?.moodName || document.querySelector(`.mood-option[data-mood="${mostFrequent[0]}"]`)?.dataset.label})` : 'No data'}</p>
    <div class="mood-chart">
      ${chartData.map((height, index) => 
        `<div class="bar" style="height: ${height}px" aria-label="Mood on ${new Date(now).setDate(now.getDate() - (6 - index))}: ${weekData[index] || 'No mood'}">${weekData[index] || ''}</div>`
      ).join('')}
    </div>
  `;
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

function showStats(type) {
  const display = document.getElementById("statsDisplay");
  display.innerHTML = "";
  const now = new Date();
  const entries = [];

  for (const key in moodData) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const diff = (now - date) / (1000 * 3600 * 24);

    if (
      (type === "week" && diff <= 7) ||
      (type === "lastMonth" && m === now.getMonth() + 1) ||
      (type === "year" && y === now.getFullYear())
    ) {
      if (isDateAfterStartDate(key)) {
        entries.push({
          date: `${m}/${d}/${y}`,
          mood: moodData[key].mood,
          moodName: moodData[key].moodName,
          note: moodData[key].note || "No note",
        });
      }
    }
  }

  if (entries.length === 0) {
    display.innerHTML = "<p>No moods logged for this period.</p>";
    return;
  }

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  entries.forEach(entry => {
    const entryDiv = document.createElement("div");
    entryDiv.className = "stats-entry";
    entryDiv.innerHTML = `
      <p><strong>Date:</strong> ${entry.date}</p>
      <p><strong>Mood:</strong> ${entry.mood} (${entry.moodName})</p>
      <p><strong>Note:</strong> ${entry.note}</p>
    `;
    display.appendChild(entryDiv);
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute(
    "data-theme",
    currentTheme === "dark" ? "light" : "dark"
  );
  updateDarkModeIcon();
}

function updateDarkModeIcon() {
  const toggleButton = document.querySelector(".dark-mode-toggle");
  const currentTheme = document.documentElement.getAttribute("data-theme");
  toggleButton.innerText = currentTheme === "dark" ? "☀️" : "🌙";
  toggleButton.classList.add("pulse");
  setTimeout(() => toggleButton.classList.remove("pulse"), 500);
}

function checkMoodLoggedToday() {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  return !!moodData[todayKey]?.mood;
}

if ("Notification" in window && Notification.permission !== "denied") {
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      const now = new Date();
      const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0);
      let timeToNotification = targetTime - now;
      if (timeToNotification < 0) timeToNotification += 86400000;

      setTimeout(() => {
        setInterval(() => {
          if (!checkMoodLoggedToday()) {
            new Notification("Don't forget to log your mood before 11:59 PM!");
          }
        }, 86400000);
        if (!checkMoodLoggedToday()) {
          new Notification("Don't forget to log your mood before 11:59 PM!");
        }
      }, timeToNotification);
    }
  });
}

showWelcomePopup();
updateDarkModeIcon();
renderCalendar();
showMoodInsights();
 