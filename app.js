const STORAGE_KEY = "monk_mode_data";

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  habits: [],
  logs: [],
};

let currentEditId = null;

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
  btnAdd: document.getElementById("btn-add"),
  btnCancel: document.getElementById("btn-cancel"),
  btnSave: document.getElementById("btn-save"),
  btnDelete: document.getElementById("btn-delete"),

  // Модалка статистики
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

// Инициализация анимации (теперь без левитации, чтобы не дергался fixed экран)
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

function moveHabit(index, direction) {
  if (direction === -1 && index > 0) {
    const temp = appData.habits[index];
    appData.habits[index] = appData.habits[index - 1];
    appData.habits[index - 1] = temp;
  } else if (direction === 1 && index < appData.habits.length - 1) {
    const temp = appData.habits[index];
    appData.habits[index] = appData.habits[index + 1];
    appData.habits[index + 1] = temp;
  }
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

  appData.habits.forEach((habit, index) => {
    dailyPotentialXP += habit.xp;
    const isCompletedToday = appData.logs.some(
      (l) => l.habitId === habit.id && l.date === today,
    );
    if (isCompletedToday) dailyEarnedXP += habit.xp;

    const el = document.createElement("div");
    el.className = `glass-task p-4 rounded-2xl mb-3 flex justify-between items-center ${isCompletedToday ? "completed" : ""}`;

    el.innerHTML = `
            <div class="flex-1 cursor-pointer toggle-area">
                <p class="font-semibold text-sm ${isCompletedToday ? "text-teal-300 line-through" : "text-white"}">${habit.title}</p>
                <p class="text-[10px] opacity-60 uppercase tracking-wider mt-1">XP: ${habit.xp}</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex flex-col items-center justify-center -space-y-2">
                    <button class="move-up p-1 text-white/20 hover:text-white transition-colors ${index === 0 ? "invisible" : ""}">
                        <i class="ph-bold ph-caret-up text-lg"></i>
                    </button>
                    <button class="move-down p-1 text-white/20 hover:text-white transition-colors ${index === appData.habits.length - 1 ? "invisible" : ""}">
                        <i class="ph-bold ph-caret-down text-lg"></i>
                    </button>
                </div>
                <button class="edit-btn text-white/30 hover:text-white transition-colors p-2">
                    <i class="ph ph-pencil-simple text-xl"></i>
                </button>
                <div class="toggle-area h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompletedToday ? "border-teal-400 bg-teal-400/20 shadow-[0_0_10px_rgba(45,212,191,0.3)]" : "border-white/20"}">
                    ${isCompletedToday ? '<i class="ph-bold ph-check text-teal-400"></i>' : ""}
                </div>
            </div>
        `;

    const toggleAreas = el.querySelectorAll(".toggle-area");
    toggleAreas.forEach((area) => {
      area.onclick = () => toggleHabit(habit.id);
    });

    const btnUp = el.querySelector(".move-up");
    if (btnUp)
      btnUp.onclick = (e) => {
        e.stopPropagation();
        moveHabit(index, -1);
      };

    const btnDown = el.querySelector(".move-down");
    if (btnDown)
      btnDown.onclick = (e) => {
        e.stopPropagation();
        moveHabit(index, 1);
      };

    el.querySelector(".edit-btn").onclick = (e) => {
      e.stopPropagation();
      openModal(habit.id);
    };

    elements.habitsList.appendChild(el);
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

  saveData();
  renderUI();
}

// === Модалка Задач ===
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
    elements.modalTitle.textContent = "Редактировать";
    elements.btnSave.textContent = "Сохранить";
    elements.btnDelete.classList.remove("hidden");
  } else {
    elements.titleInput.value = "";
    elements.xpInput.value = "";
    elements.modalTitle.textContent = "Новая задача";
    elements.btnSave.textContent = "Создать";
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
      appData.habits.push({ id: Date.now(), title, xp });
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

// === Модалка Статистики ===
elements.btnStats.onclick = () => {
  // Подсчет данных
  const uniqueDays = new Set(appData.logs.map((l) => l.date)).size;

  // Анимация чисел
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

// === Экспорт CSV ===
elements.btnExport.onclick = () => {
  if (appData.logs.length === 0) return alert("Нет данных для выгрузки");

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
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `impulse_report_${getTodayStr()}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Старт
renderUI();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
