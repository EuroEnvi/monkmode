const STORAGE_KEY = "monk_mode_data";

const DEFAULT_CATEGORIES = [
  { id: "c_morning", name: "УТРО", emoji: "☀️" },
  { id: "c_focus", name: "ФОКУС", emoji: "⚙️" },
  { id: "c_body", name: "ТЕЛО", emoji: "🥗" },
  { id: "c_social", name: "СВЯЗИ", emoji: "🤝" },
  { id: "c_night", name: "ВЕЧЕР", emoji: "🌙" },
  { id: "c_other", name: "ПРОЧЕЕ", emoji: "📦" },
];

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

// РАНГИ ИГРЫ
const RANKS = [
  { name: "Странник", minXp: 0, theme: "theme-novice" },
  { name: "Адепт", minXp: 1000, theme: "theme-adept" },
  { name: "Мастер", minXp: 5000, theme: "theme-master" },
  { name: "Монах", minXp: 10000, theme: "theme-monk" },
  { name: "Легенда", minXp: 25000, theme: "theme-legend" },
];

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  categories: DEFAULT_CATEGORIES,
  habits: DEFAULT_HABITS,
  logs: [],
  lastProcessedDate: null, // Для отслеживания штрафов
};

let currentEditId = null;

const elements = {
  habitsList: document.getElementById("habits-list"),
  totalXp: document.getElementById("total-xp"),
  rankName: document.getElementById("rank-name"),
  progressFill: document.getElementById("progress-fill"),
  dailyProgressText: document.getElementById("daily-progress-text"),
  currentDate: document.getElementById("current-date"),
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
  catModal: document.getElementById("category-modal"),
  catContent: document.getElementById("category-content"),
  btnOpenCat: document.getElementById("btn-open-categories"),
  btnCloseCat: document.getElementById("btn-close-category"),
  catList: document.getElementById("categories-list"),
  newCatEmoji: document.getElementById("new-cat-emoji"),
  newCatName: document.getElementById("new-cat-name"),
  btnAddCat: document.getElementById("btn-add-cat"),
  statsModal: document.getElementById("stats-modal"),
  statsContent: document.getElementById("stats-content"),
  btnStats: document.getElementById("btn-stats"),
  btnCloseStats: document.getElementById("btn-close-stats"),
  statCompleted: document.getElementById("stat-completed"),
  statMaxStreak: document.getElementById("stat-max-streak"),
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

// === ДВИЖОК ШТРАФОВ ЗА ПРОКРАСТИНАЦИЮ ===
function processPenalties() {
  const today = getTodayStr();

  // Если первый запуск вообще - просто ставим дату и выходим
  if (!appData.lastProcessedDate) {
    appData.lastProcessedDate = today;
    saveData();
    return;
  }

  if (appData.lastProcessedDate === today) return; // Уже проверяли сегодня

  let lastDate = new Date(appData.lastProcessedDate);
  const currentDate = new Date(today);
  let burnedXP = 0;

  // Сдвигаем на 1 день вперед от последнего входа
  lastDate.setDate(lastDate.getDate() + 1);

  // Проходим по всем пропущенным дням
  while (lastDate < currentDate) {
    const dateStr = lastDate.toISOString().split("T")[0];

    appData.habits.forEach((habit) => {
      const done = appData.logs.some(
        (l) => l.habitId === habit.id && l.date === dateStr,
      );
      if (!done) {
        // Штраф: 50% от стоимости задачи
        burnedXP += Math.floor(habit.xp / 2);
      }
    });
    lastDate.setDate(lastDate.getDate() + 1);
  }

  if (burnedXP > 0) {
    appData.totalXP -= burnedXP;
    if (appData.totalXP < 0) appData.totalXP = 0;
    alert(
      `🔥 ШТРАФ ЗА ПРОКРАСТИНАЦИЮ 🔥\n\nВы пропустили выполнение задач в прошлые дни.\nСгорело очков: -${burnedXP} XP.\n\nДисциплина требует жертв.`,
    );
  }

  appData.lastProcessedDate = today;
  saveData();
}

// === ПОДСЧЕТ СТРИКОВ (ОГОНЬ) ===
function getStreak(habitId) {
  let streak = 0;
  let checkDate = new Date();
  const todayStr = checkDate.toISOString().split("T")[0];

  // Если сегодня задача еще не выполнена, стрик считается со вчерашнего дня
  const hasToday = appData.logs.some(
    (l) => l.habitId === habitId && l.date === todayStr,
  );
  if (!hasToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const hasLog = appData.logs.some(
      (l) => l.habitId === habitId && l.date === dateStr,
    );
    if (hasLog) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// === ОБНОВЛЕНИЕ РАНГА И ТЕМЫ ===
function updateRankTheme() {
  const currentRank =
    RANKS.slice()
      .reverse()
      .find((r) => appData.totalXP >= r.minXp) || RANKS[0];
  elements.rankName.textContent = currentRank.name;

  // Меняем тему в CSS
  document.body.className = `cloud-tunnel text-white font-sans ${currentRank.theme}`;
}

function moveHabit(id, direction) {
  const habit = appData.habits.find((h) => h.id === id);
  if (!habit) return;
  const catHabits = appData.habits.filter(
    (h) => h.categoryId === habit.categoryId,
  );
  const indexInCat = catHabits.findIndex((h) => h.id === id);

  if (direction === -1 && indexInCat > 0)
    swapInGlobalArray(id, catHabits[indexInCat - 1].id);
  else if (direction === 1 && indexInCat < catHabits.length - 1)
    swapInGlobalArray(id, catHabits[indexInCat + 1].id);
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
  updateRankTheme(); // Применяем стиль ранга

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

  appData.categories.forEach((cat) => {
    const catHabits = appData.habits.filter((h) => h.categoryId === cat.id);
    if (catHabits.length === 0 && cat.id !== "c_other") return;

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

      // Считаем стрик
      const streak = getStreak(habit.id);
      const streakHtml =
        streak >= 3
          ? `<span class="ml-2 text-xs text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]">🔥 ${streak}</span>`
          : "";

      const el = document.createElement("div");
      el.className = `glass-task p-4 rounded-2xl mb-2 flex justify-between items-center ${isCompletedToday ? "completed" : ""}`;

      el.innerHTML = `
                <div class="flex-1 cursor-pointer toggle-area">
                    <p class="font-semibold text-sm ${isCompletedToday ? "opacity-50 line-through" : "text-white"}">
                        ${habit.title} ${streakHtml}
                    </p>
                    <p class="text-[10px] opacity-50 uppercase mt-0.5 tracking-wider">XP: ${habit.xp}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex flex-col items-center justify-center -space-y-2 mr-1">
                        <button class="move-up p-1 text-white/20 hover:text-white transition-colors ${indexInCat === 0 ? "invisible" : ""}"><i class="ph-bold ph-caret-up text-lg"></i></button>
                        <button class="move-down p-1 text-white/20 hover:text-white transition-colors ${indexInCat === catHabits.length - 1 ? "invisible" : ""}"><i class="ph-bold ph-caret-down text-lg"></i></button>
                    </div>
                    <button class="edit-btn text-white/20 hover:text-white transition-colors p-2"><i class="ph ph-pencil-simple text-lg"></i></button>
                    <div class="toggle-area h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompletedToday ? "border-transparent shadow-[0_0_10px_rgba(255,255,255,0.2)]" : "border-white/10"}" style="${isCompletedToday ? "background-color: var(--accent); color: #000;" : ""}">
                        ${isCompletedToday ? '<i class="ph-bold ph-check text-xs"></i>' : ""}
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
  if (appData.totalXP < 0) appData.totalXP = 0;
  saveData();
  renderUI();
}

function updateCategorySelect() {
  elements.categorySelect.innerHTML = "";
  appData.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    opt.className = "bg-slate-900 text-white";
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
    } else appData.habits.push({ id: Date.now(), title, xp, categoryId });
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

function renderCategoriesList() {
  elements.catList.innerHTML = "";
  appData.categories.forEach((cat) => {
    const el = document.createElement("div");
    el.className =
      "flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl";
    el.innerHTML = `<div class="flex items-center gap-2"><span class="text-xl">${cat.emoji}</span><span class="font-bold text-sm tracking-widest">${cat.name}</span></div>`;
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
      updateCategorySelect();
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

// === СТАТИСТИКА ===
elements.btnStats.onclick = () => {
  // Подсчет максимального стрика за все время
  let globalMaxStreak = 0;
  appData.habits.forEach((h) => {
    let max = getStreak(h.id); // Для простоты берем текущий стрик.
    if (max > globalMaxStreak) globalMaxStreak = max;
  });

  gsap.to(elements.statCompleted, {
    innerHTML: appData.logs.length,
    duration: 1,
    snap: "innerHTML",
  });
  gsap.to(elements.statMaxStreak, {
    innerHTML: globalMaxStreak,
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

elements.btnResetToday.onclick = () => {
  if (!confirm("Точно снять все галочки за сегодня? XP сгорит.")) return;
  const today = getTodayStr();
  appData.logs
    .filter((l) => l.date === today)
    .forEach((log) => {
      const habit = appData.habits.find((h) => h.id === log.habitId);
      if (habit) appData.totalXP -= habit.xp;
    });
  if (appData.totalXP < 0) appData.totalXP = 0;
  appData.logs = appData.logs.filter((l) => l.date !== today);
  saveData();
  renderUI();
  elements.btnCloseStats.click();
};

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

elements.btnImport.onclick = () => elements.fileImport.click();
elements.fileImport.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const importedData = JSON.parse(event.target.result);
      if (importedData.habits && importedData.logs) {
        appData = importedData;
        saveData();
        renderUI();
        alert("База восстановлена!");
        elements.btnCloseStats.click();
      } else alert("Неверный формат.");
    } catch (err) {
      alert("Ошибка файла.");
    }
    elements.fileImport.value = "";
  };
  reader.readAsText(file);
};

// СТАРТ
processPenalties(); // Сначала проверяем штрафы
renderUI(); // Затем рендерим (внутри обновится тема)

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
