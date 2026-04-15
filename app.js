const STORAGE_KEY = "monk_mode_data";

// Базовый пак задач для старта
const DEFAULT_HABITS = [
  { id: 1, title: "Ранний подъем", xp: 10, category: "☀️ УТРО" },
  { id: 2, title: "Стакан воды", xp: 5, category: "☀️ УТРО" },
  { id: 3, title: "Контрастный душ", xp: 15, category: "☀️ УТРО" },
  { id: 4, title: "Зарядка / Разминка", xp: 20, category: "☀️ УТРО" },

  { id: 5, title: "Главная задача (Deep Work)", xp: 100, category: "⚙️ ФОКУС" },
  { id: 6, title: "Разбор почты / сообщений", xp: 20, category: "⚙️ ФОКУС" },
  { id: 7, title: "Изучение нового (15 мин)", xp: 30, category: "⚙️ ФОКУС" },

  { id: 8, title: "Тренировка", xp: 50, category: "🥗 ТЕЛО" },
  { id: 9, title: "10 000 шагов", xp: 30, category: "🥗 ТЕЛО" },
  { id: 10, title: "Никакого сахара", xp: 40, category: "🥗 ТЕЛО" },

  { id: 11, title: "Звонок близким", xp: 30, category: "🤝 СВЯЗИ" },
  { id: 12, title: "Уборка (15 минут)", xp: 20, category: "🤝 СВЯЗИ" },

  { id: 13, title: "Планирование завтра", xp: 20, category: "🌙 ВЕЧЕР" },
  { id: 14, title: "Чтение (10 стр)", xp: 20, category: "🌙 ВЕЧЕР" },
  { id: 15, title: "Отбой до 23:30", xp: 30, category: "🌙 ВЕЧЕР" },
];

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  habits: DEFAULT_HABITS, // Зашиваем список сюда
  logs: [],
};

let currentEditId = null;

const elements = {
  habitsList: document.getElementById("habits-list"),
  totalXp: document.getElementById("total-xp"),
  progressFill: document.getElementById("progress-fill"),
  dailyProgressText: document.getElementById("daily-progress-text"),
  currentDate: document.getElementById("current-date"),
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modal-content"),
  modalTitle: document.getElementById("modal-title"),
  titleInput: document.getElementById("habit-title"),
  xpInput: document.getElementById("habit-xp"),
  btnAdd: document.getElementById("btn-add"),
  btnCancel: document.getElementById("btn-cancel"),
  btnSave: document.getElementById("btn-save"),
  btnDelete: document.getElementById("btn-delete"),
  statsModal: document.getElementById("stats-modal"),
  statsContent: document.getElementById("stats-content"),
  btnStats: document.getElementById("btn-stats"),
  btnCloseStats: document.getElementById("btn-close-stats"),
  statCompleted: document.getElementById("stat-completed"),
  statDays: document.getElementById("stat-days"),
  statXp: document.getElementById("stat-xp"),
  btnExport: document.getElementById("btn-export"),
};

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getTimeStr = () => new Date().toTimeString().substring(0, 5);

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function triggerVibration() {
  if (navigator.vibrate) navigator.vibrate(50);
}

// Рендер с группировкой по категориям
function renderUI() {
  const today = getTodayStr();
  const options = { weekday: "long", month: "long", day: "numeric" };
  elements.currentDate.textContent = new Date().toLocaleDateString(
    "ru-RU",
    options,
  );

  gsap.to(elements.totalXp, {
    innerHTML: appData.totalXP,
    duration: 0.5,
    snap: "innerHTML",
  });

  let dailyPotentialXP = 0;
  let dailyEarnedXP = 0;

  elements.habitsList.innerHTML = "";

  // Группируем задачи по категориям
  const categories = [
    ...new Set(appData.habits.map((h) => h.category || "ПРОЧЕЕ")),
  ];

  categories.forEach((catName) => {
    // Создаем заголовок категории
    const header = document.createElement("div");
    header.className =
      "text-[10px] uppercase tracking-[0.2em] opacity-40 mb-3 mt-6 first:mt-2 ml-1";
    header.textContent = catName;
    elements.habitsList.appendChild(header);

    // Фильтруем задачи этой категории
    const catHabits = appData.habits.filter(
      (h) => (h.category || "ПРОЧЕЕ") === catName,
    );

    catHabits.forEach((habit) => {
      const indexInFullList = appData.habits.findIndex(
        (h) => h.id === habit.id,
      );
      dailyPotentialXP += habit.xp;
      const isCompletedToday = appData.logs.some(
        (l) => l.habitId === habit.id && l.date === today,
      );
      if (isCompletedToday) dailyEarnedXP += habit.xp;

      const el = document.createElement("div");
      el.className = `glass-task p-4 rounded-2xl mb-2 flex justify-between items-center ${isCompletedToday ? "completed" : ""}`;

      el.innerHTML = `
                <div class="flex-1 cursor-pointer toggle-area">
                    <p class="font-semibold text-sm ${isCompletedToday ? "text-teal-300 line-through" : "text-white"}">${habit.title}</p>
                    <p class="text-[10px] opacity-50 uppercase mt-0.5">XP: ${habit.xp}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="edit-btn text-white/20 hover:text-white transition-colors p-2">
                        <i class="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <div class="toggle-area h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompletedToday ? "border-teal-400 bg-teal-400/20 shadow-[0_0_10px_rgba(45,212,191,0.2)]" : "border-white/10"}">
                        ${isCompletedToday ? '<i class="ph-bold ph-check text-teal-400 text-xs"></i>' : ""}
                    </div>
                </div>
            `;

      const toggleAreas = el.querySelectorAll(".toggle-area");
      toggleAreas.forEach((area) => {
        area.onclick = () => toggleHabit(habit.id);
      });

      el.querySelector(".edit-btn").onclick = (e) => {
        e.stopPropagation();
        openModal(habit.id);
      };

      elements.habitsList.appendChild(el);
    });
  });

  const progressPercent =
    dailyPotentialXP === 0
      ? 0
      : Math.round((dailyEarnedXP / dailyPotentialXP) * 100);
  gsap.to(elements.progressFill, {
    width: `${progressPercent}%`,
    duration: 0.6,
    ease: "power2.out",
  });
  elements.dailyProgressText.textContent = `${progressPercent}% выполнено сегодня`;
}

function toggleHabit(id) {
  triggerVibration();
  const today = getTodayStr();
  const habit = appData.habits.find((h) => h.id === id);
  if (!habit) return;

  const logIndex = appData.logs.findIndex(
    (l) => l.habitId === id && l.date === today,
  );

  if (logIndex > -1) {
    appData.logs.splice(logIndex, 1);
    appData.totalXP -= habit.xp;
  } else {
    appData.logs.push({ date: today, habitId: id, time: getTimeStr() });
    appData.totalXP += habit.xp;
  }

  saveData();
  renderUI();
}

// Модалка Задач
const openModal = (habitId = null) => {
  currentEditId = habitId;
  elements.modal.classList.remove("hidden");
  gsap.to(elements.modal, { opacity: 1, duration: 0.2 });
  gsap.to(elements.modalContent, {
    scale: 1,
    duration: 0.3,
    ease: "back.out(1.5)",
  });

  if (habitId) {
    const habit = appData.habits.find((h) => h.id === habitId);
    elements.titleInput.value = habit.title;
    elements.xpInput.value = habit.xp;
    elements.modalTitle.textContent = "Изменить";
    elements.btnDelete.classList.remove("hidden");
  } else {
    elements.titleInput.value = "";
    elements.xpInput.value = "";
    elements.modalTitle.textContent = "Новая задача";
    elements.btnDelete.classList.add("hidden");
  }
};

const closeModal = () => {
  gsap.to(elements.modalContent, { scale: 0.95, duration: 0.2 });
  gsap.to(elements.modal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      elements.modal.classList.add("hidden");
      currentEditId = null;
    },
  });
};

elements.btnAdd.onclick = () => openModal();
elements.btnCancel.onclick = closeModal;

elements.btnSave.onclick = () => {
  const title = elements.titleInput.value.trim();
  const xp = parseInt(elements.xpInput.value) || 0;
  if (title && xp > 0) {
    if (currentEditId) {
      const habit = appData.habits.find((h) => h.id === currentEditId);
      habit.title = title;
      habit.xp = xp;
    } else {
      // Новая задача по умолчанию летит в "ПРОЧЕЕ"
      appData.habits.push({ id: Date.now(), title, xp, category: "📦 ПРОЧЕЕ" });
    }
    saveData();
    closeModal();
    renderUI();
  }
};

elements.btnDelete.onclick = () => {
  if (currentEditId) {
    appData.habits = appData.habits.filter((h) => h.id !== currentEditId);
    saveData();
    closeModal();
    renderUI();
  }
};

// Модалка Статистики
elements.btnStats.onclick = () => {
  const uniqueDays = new Set(appData.logs.map((l) => l.date)).size;
  gsap.to(elements.statCompleted, {
    innerHTML: appData.logs.length,
    duration: 1,
    snap: "innerHTML",
  });
  gsap.to(elements.statDays, {
    innerHTML: uniqueDays,
    duration: 1,
    snap: "innerHTML",
  });
  gsap.to(elements.statXp, {
    innerHTML: appData.totalXP,
    duration: 1.5,
    snap: "innerHTML",
  });

  elements.statsModal.classList.remove("hidden");
  gsap.to(elements.statsModal, { opacity: 1, duration: 0.2 });
  gsap.to(elements.statsContent, {
    scale: 1,
    duration: 0.4,
    ease: "back.out(1.2)",
  });
};

elements.btnCloseStats.onclick = () => {
  gsap.to(elements.statsContent, { scale: 0.95, duration: 0.2 });
  gsap.to(elements.statsModal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      elements.statsModal.classList.add("hidden");
    },
  });
};

// Экспорт CSV
elements.btnExport.onclick = () => {
  if (appData.logs.length === 0) return alert("Нет данных");
  const dates = [...new Set(appData.logs.map((l) => l.date))].sort();
  let csvContent =
    "Дата," + appData.habits.map((h) => `"${h.title}"`).join(",") + "\n";
  dates.forEach((date) => {
    let row = [date];
    appData.habits.forEach((habit) => {
      const log = appData.logs.find(
        (l) => l.date === date && l.habitId === habit.id,
      );
      row.push(log ? log.time : "");
    });
    csvContent += row.join(",") + "\n";
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `impulse_report.csv`;
  link.click();
};

renderUI();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
