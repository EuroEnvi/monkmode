const STORAGE_KEY = "monk_mode_data";

// Инициализация
let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  habits: [],
  logs: [],
};

let currentEditId = null; // Флаг текущего редактирования

// DOM Элементы
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
  btnExport: document.getElementById("btn-export"),
};

// Утилиты дат
const getTodayStr = () => new Date().toISOString().split("T")[0];
const getTimeStr = () => new Date().toTimeString().substring(0, 5);

// GSAP Анимации при старте
gsap.from("#app-container", {
  y: 30,
  opacity: 0,
  duration: 1,
  ease: "power3.out",
});
gsap.to("#app-container", {
  y: -5,
  duration: 3,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function triggerVibration() {
  if (navigator.vibrate) navigator.vibrate(50);
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

  appData.habits.forEach((habit) => {
    dailyPotentialXP += habit.xp;

    const isCompletedToday = appData.logs.some(
      (l) => l.habitId === habit.id && l.date === today,
    );
    if (isCompletedToday) dailyEarnedXP += habit.xp;

    const el = document.createElement("div");
    el.className = `glass-task p-4 rounded-xl mb-3 flex justify-between items-center ${isCompletedToday ? "completed" : ""}`;

    el.innerHTML = `
            <div class="flex-1 cursor-pointer toggle-area">
                <p class="font-semibold ${isCompletedToday ? "text-teal-300 line-through" : "text-white"}">${habit.title}</p>
                <p class="text-xs opacity-60">XP: ${habit.xp}</p>
            </div>
            <div class="flex items-center gap-4">
                <button class="edit-btn text-white/40 hover:text-white transition-colors p-1">
                    <i class="ph ph-pencil-simple text-xl"></i>
                </button>
                <div class="toggle-area h-7 w-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${isCompletedToday ? "border-teal-400 bg-teal-400/20" : "border-white/30"}">
                    ${isCompletedToday ? '<i class="ph-bold ph-check text-teal-400"></i>' : ""}
                </div>
            </div>
        `;

    // Вешаем события на зоны клика
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

// Управление модалкой
const openModal = (habitId = null) => {
  currentEditId = habitId;
  elements.modal.classList.remove("hidden");
  gsap.to(elements.modal, { opacity: 1, duration: 0.2 });
  gsap.to(elements.modalContent, {
    scale: 1,
    duration: 0.3,
    ease: "back.out(1.7)",
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

// Сохранение / Обновление
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

// Удаление задачи
elements.btnDelete.onclick = () => {
  if (currentEditId) {
    appData.habits = appData.habits.filter((h) => h.id !== currentEditId);
    saveData();
    closeModal();
    renderUI();
  }
};

// Экспорт CSV
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

// Запуск
renderUI();

// Service Worker для PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("SW зарегистрирован:", reg.scope);
      })
      .catch((err) => console.log("SW ошибка:", err));
  });
}
