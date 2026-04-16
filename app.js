const STORAGE_KEY = "monk_mode_data";

// Базовые категории
const DEFAULT_CATEGORIES = [
  { id: "c_morning", name: "УТРО", emoji: "☀️" },
  { id: "c_focus", name: "ФОКУС", emoji: "⚙️" },
  { id: "c_body", name: "ТЕЛО", emoji: "🥗" },
  { id: "c_social", name: "СВЯЗИ", emoji: "🤝" },
  { id: "c_night", name: "ВЕЧЕР", emoji: "🌙" },
  { id: "c_other", name: "ПРОЧЕЕ", emoji: "📦" },
];

// Базовые привычки (привязаны к ID категорий)
const DEFAULT_HABITS = [
  { id: 1, title: "Ранний подъем", xp: 10, categoryId: "c_morning" },
  {
    id: 2,
    title: "Главная задача (Deep Work)",
    xp: 100,
    categoryId: "c_focus",
  },
  { id: 3, title: "Тренировка", xp: 50, categoryId: "c_body" },
];

// Загрузка или инициализация
let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  categories: DEFAULT_CATEGORIES,
  habits: DEFAULT_HABITS,
  logs: [],
};

// МИГРАЦИЯ СТАРЫХ ДАННЫХ (Защита от поломки)
if (!appData.categories) {
  appData.categories = DEFAULT_CATEGORIES;
  appData.habits.forEach((h) => {
    if (typeof h.category === "string") {
      const matchedCat = appData.categories.find(
        (c) => h.category.includes(c.name) || h.category.includes(c.emoji),
      );
      h.categoryId = matchedCat ? matchedCat.id : "c_other";
      delete h.category;
    }
  });
  saveData();
}

let currentEditId = null;

// Элементы DOM
const elements = {
  habitsList: document.getElementById("habits-list"),
  totalXp: document.getElementById("total-xp"),
  progressFill: document.getElementById("progress-fill"),
  dailyProgressText: document.getElementById("daily-progress-text"),
  currentDate: document.getElementById("current-date"),

  // Модалка задач
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modal-content"),
  modalTitle: document.getElementById("modal-title"),
  titleInput: document.getElementById("habit-title"),
  xpInput: document.getElementById("habit-xp"),
  categorySelect: document.getElementById("habit-category"),
  btnAdd: document.getElementById("btn-add"),
  btnCancel: document.getElementById("btn-cancel"),
  btnSave: document.getElementById("btn-save"),
  btnDelete: document.getElementById("btn-delete"),

  // Модалка Категорий
  catModal: document.getElementById("category-modal"),
  catContent: document.getElementById("category-content"),
  btnOpenCat: document.getElementById("btn-open-categories"),
  btnCloseCat: document.getElementById("btn-close-category"),
  catList: document.getElementById("categories-list"),
  newCatEmoji: document.getElementById("new-cat-emoji"),
  newCatName: document.getElementById("new-cat-name"),
  btnAddCat: document.getElementById("btn-add-cat"),

  // Статистика и Настройки
  statsModal: document.getElementById("stats-modal"),
  statsContent: document.getElementById("stats-content"),
  btnStats: document.getElementById("btn-stats"),
  btnCloseStats: document.getElementById("btn-close-stats"),
  statCompleted: document.getElementById("stat-completed"),
  statDays: document.getElementById("stat-days"),
  statXp: document.getElementById("stat-xp"),

  btnResetToday: document.getElementById("btn-reset-today"),
  btnExport: document.getElementById("btn-export-backup"),
  btnImport: document.getElementById("btn-import-backup"),
  fileImport: document.getElementById("file-import"),
};

const getTodayStr = () => new Date().toISOString().split("T")[0];
const getTimeStr = () => new Date().toTimeString().substring(0, 5);

gsap.from("#app-container", {
  y: 20,
  opacity: 0,
  duration: 0.8,
  ease: "power3.out",
});

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function triggerVibration() {
  if (navigator.vibrate) navigator.vibrate(50);
}

// Перестановка задач внутри категории
function moveHabit(id, direction) {
  const habit = appData.habits.find((h) => h.id === id);
  if (!habit) return;

  const catHabits = appData.habits.filter(
    (h) => h.categoryId === habit.categoryId,
  );
  const indexInCat = catHabits.findIndex((h) => h.id === id);

  if (direction === -1 && indexInCat > 0) {
    swapInGlobalArray(id, catHabits[indexInCat - 1].id);
  } else if (direction === 1 && indexInCat < catHabits.length - 1) {
    swapInGlobalArray(id, catHabits[indexInCat + 1].id);
  }
}

function swapInGlobalArray(id1, id2) {
  const idx1 = appData.habits.findIndex((h) => h.id === id1);
  const idx2 = appData.habits.findIndex((h) => h.id === id2);
  [appData.habits[idx1], appData.habits[idx2]] = [
    appData.habits[idx2],
    appData.habits[idx1],
  ];
  saveData();
  renderUI();
}

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

  // Рендер по категориям
  appData.categories.forEach((cat) => {
    const catHabits = appData.habits.filter((h) => h.categoryId === cat.id);
    if (catHabits.length === 0 && cat.id !== "c_other") return; // Прячем пустые категории (кроме "ПРОЧЕЕ", если надо)

    if (catHabits.length > 0) {
      const header = document.createElement("div");
      header.className =
        "text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-3 mt-6 first:mt-2 ml-1 flex items-center gap-2";
      header.innerHTML = `<span>${cat.emoji}</span> <span>${cat.name}</span>`;
      elements.habitsList.appendChild(header);
    }

    catHabits.forEach((habit, indexInCat) => {
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
                    <p class="text-[10px] opacity-50 uppercase mt-0.5 tracking-wider">XP: ${habit.xp}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex flex-col items-center justify-center -space-y-2 mr-1">
                        <button class="move-up p-1 text-white/20 hover:text-white transition-colors ${indexInCat === 0 ? "invisible" : ""}">
                            <i class="ph-bold ph-caret-up text-lg"></i>
                        </button>
                        <button class="move-down p-1 text-white/20 hover:text-white transition-colors ${indexInCat === catHabits.length - 1 ? "invisible" : ""}">
                            <i class="ph-bold ph-caret-down text-lg"></i>
                        </button>
                    </div>
                    <button class="edit-btn text-white/20 hover:text-white transition-colors p-2">
                        <i class="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <div class="toggle-area h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompletedToday ? "border-teal-400 bg-teal-400/20 shadow-[0_0_10px_rgba(45,212,191,0.2)]" : "border-white/10"}">
                        ${isCompletedToday ? '<i class="ph-bold ph-check text-teal-400 text-xs"></i>' : ""}
                    </div>
                </div>
            `;

      el.querySelectorAll(".toggle-area").forEach((area) => {
        area.onclick = () => toggleHabit(habit.id);
      });

      const btnUp = el.querySelector(".move-up");
      if (btnUp)
        btnUp.onclick = (e) => {
          e.stopPropagation();
          moveHabit(habit.id, -1);
        };

      const btnDown = el.querySelector(".move-down");
      if (btnDown)
        btnDown.onclick = (e) => {
          e.stopPropagation();
          moveHabit(habit.id, 1);
        };

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
  elements.dailyProgressText.textContent = `${progressPercent}% выполнено`;
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
  if (appData.totalXP < 0) appData.totalXP = 0; // Защита от минуса
  saveData();
  renderUI();
}

// === Управление задачами ===
function updateCategorySelect() {
  elements.categorySelect.innerHTML = "";
  appData.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    opt.className = "bg-slate-900 text-white"; // Фикс прозрачности системного селекта
    elements.categorySelect.appendChild(opt);
  });
}

const openModal = (habitId = null) => {
  currentEditId = habitId;
  updateCategorySelect();

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
    elements.categorySelect.value = habit.categoryId || "c_other";
    elements.modalTitle.textContent = "Изменить";
    elements.btnDelete.classList.remove("hidden");
  } else {
    elements.titleInput.value = "";
    elements.xpInput.value = "";
    elements.categorySelect.value = "c_other";
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
  const categoryId = elements.categorySelect.value;

  if (title && xp > 0) {
    if (currentEditId) {
      const habit = appData.habits.find((h) => h.id === currentEditId);
      habit.title = title;
      habit.xp = xp;
      habit.categoryId = categoryId;
    } else {
      appData.habits.push({ id: Date.now(), title, xp, categoryId });
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

// === РЕДАКТОР КАТЕГОРИЙ ===
function renderCategoriesList() {
  elements.catList.innerHTML = "";
  appData.categories.forEach((cat) => {
    const el = document.createElement("div");
    el.className =
      "flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl";
    el.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xl">${cat.emoji}</span>
                <span class="font-bold text-sm tracking-widest">${cat.name}</span>
            </div>
        `;
    // Удалять "ПРОЧЕЕ" нельзя - это дефолтный мусорник
    if (cat.id !== "c_other") {
      const delBtn = document.createElement("button");
      delBtn.className = "text-red-400 hover:text-red-300 p-1";
      delBtn.innerHTML = '<i class="ph-bold ph-trash"></i>';
      delBtn.onclick = () => deleteCategory(cat.id);
      el.appendChild(delBtn);
    }
    elements.catList.appendChild(el);
  });
}

function deleteCategory(id) {
  if (!confirm("Удалить блок? Задачи будут перенесены в 'ПРОЧЕЕ'.")) return;

  appData.categories = appData.categories.filter((c) => c.id !== id);
  // Переносим осиротевшие задачи
  appData.habits.forEach((h) => {
    if (h.categoryId === id) h.categoryId = "c_other";
  });

  saveData();
  renderCategoriesList();
  renderUI();
}

elements.btnOpenCat.onclick = () => {
  renderCategoriesList();
  elements.catModal.classList.remove("hidden");
  gsap.to(elements.catModal, { opacity: 1, duration: 0.2 });
  gsap.to(elements.catContent, {
    scale: 1,
    duration: 0.3,
    ease: "back.out(1.5)",
  });
};

elements.btnCloseCat.onclick = () => {
  gsap.to(elements.catContent, { scale: 0.95, duration: 0.2 });
  gsap.to(elements.catModal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      elements.catModal.classList.add("hidden");
      updateCategorySelect(); // Обновляем селект в форме задачи
    },
  });
};

elements.btnAddCat.onclick = () => {
  const emoji = elements.newCatEmoji.value.trim() || "📌";
  const name = elements.newCatName.value.trim().toUpperCase();
  if (name) {
    appData.categories.push({ id: "c_" + Date.now(), name, emoji });
    saveData();
    elements.newCatEmoji.value = "";
    elements.newCatName.value = "";
    renderCategoriesList();
    renderUI();
  }
};

// === СТАТИСТИКА И ДАННЫЕ ===
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

// Сброс дня (Undo)
elements.btnResetToday.onclick = () => {
  if (!confirm("Точно снять все галочки за сегодня? XP за них сгорит.")) return;

  const today = getTodayStr();
  const todayLogs = appData.logs.filter((l) => l.date === today);

  // Вычитаем XP за сегодня
  todayLogs.forEach((log) => {
    const habit = appData.habits.find((h) => h.id === log.habitId);
    if (habit) appData.totalXP -= habit.xp;
  });

  if (appData.totalXP < 0) appData.totalXP = 0;

  // Оставляем логи только за прошлые дни
  appData.logs = appData.logs.filter((l) => l.date !== today);

  saveData();
  renderUI();
  elements.btnCloseStats.click(); // Закрываем модалку
};

// Экспорт БД (Бэкап JSON)
elements.btnExport.onclick = () => {
  const dataStr = JSON.stringify(appData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `impulse_backup_${getTodayStr()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// Импорт БД (Восстановление JSON)
elements.btnImport.onclick = () => elements.fileImport.click();

elements.fileImport.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      // Базовая проверка структуры
      if (importedData.habits && importedData.logs && importedData.categories) {
        appData = importedData;
        saveData();
        renderUI();
        alert("База данных успешно восстановлена!");
        elements.btnCloseStats.click();
      } else {
        alert("Файл поврежден или имеет неверный формат.");
      }
    } catch (err) {
      alert("Ошибка чтения файла JSON.");
    }
    elements.fileImport.value = ""; // Сброс инпута
  };
  reader.readAsText(file);
};

// Старт
renderUI();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
