const STORAGE_KEY = "monk_mode_data";

// Инициализация
let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  totalXP: 0,
  habits: [],
  logs: [],
};

// DOM Элементы
const elements = {
  habitsList: document.getElementById("habits-list"),
  totalXp: document.getElementById("total-xp"),
  progressFill: document.getElementById("progress-fill"),
  dailyProgressText: document.getElementById("daily-progress-text"),
  currentDate: document.getElementById("current-date"),
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modal-content"),
  titleInput: document.getElementById("habit-title"),
  xpInput: document.getElementById("habit-xp"),
  btnAdd: document.getElementById("btn-add"),
  btnCancel: document.getElementById("btn-cancel"),
  btnSave: document.getElementById("btn-save"),
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
// Эффект левитации
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

// Вибрация (Haptic feedback)
function triggerVibration() {
  if (navigator.vibrate) navigator.vibrate(50);
}

function renderUI() {
  const today = getTodayStr();

  // Дата в шапке
  const options = { weekday: "long", month: "long", day: "numeric" };
  elements.currentDate.textContent = new Date().toLocaleDateString(
    "ru-RU",
    options,
  );

  // Общий XP (с анимацией счетчика)
  gsap.to(elements.totalXp, {
    innerHTML: appData.totalXP,
    duration: 0.5,
    snap: "innerHTML",
  });

  // Считаем прогресс дня
  let dailyPotentialXP = 0;
  let dailyEarnedXP = 0;

  elements.habitsList.innerHTML = "";

  appData.habits.forEach((habit) => {
    dailyPotentialXP += habit.xp;

    // Midnight reset логика: проверяем лог за сегодня
    const isCompletedToday = appData.logs.some(
      (l) => l.habitId === habit.id && l.date === today,
    );
    if (isCompletedToday) dailyEarnedXP += habit.xp;

    // Рендер карточки
    const el = document.createElement("div");
    el.className = `glass-task p-4 rounded-xl mb-3 flex justify-between items-center cursor-pointer ${isCompletedToday ? "completed" : ""}`;
    el.innerHTML = `
            <div>
                <p class="font-semibold ${isCompletedToday ? "text-teal-300 line-through" : "text-white"}">${habit.title}</p>
                <p class="text-xs opacity-60">XP: ${habit.xp}</p>
            </div>
            <div class="h-6 w-6 rounded-full border-2 flex items-center justify-center ${isCompletedToday ? "border-teal-400 bg-teal-400/20" : "border-white/30"}">
                ${isCompletedToday ? '<i class="ph-bold ph-check text-teal-400"></i>' : ""}
            </div>
        `;

    el.onclick = () => toggleHabit(habit.id);
    elements.habitsList.appendChild(el);
  });

  // Обновляем прогресс-бар
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
    // Откат
    appData.logs.splice(logIndex, 1);
    appData.totalXP -= habit.xp;
  } else {
    // Выполнение
    appData.logs.push({ date: today, habitId: id, time: getTimeStr() });
    appData.totalXP += habit.xp;
  }

  saveData();
  renderUI();
}

// Управление модалкой
const openModal = () => {
  elements.modal.classList.remove("hidden");
  gsap.to(elements.modal, { opacity: 1, duration: 0.2 });
  gsap.to(elements.modalContent, {
    scale: 1,
    duration: 0.3,
    ease: "back.out(1.7)",
  });
};

const closeModal = () => {
  gsap.to(elements.modalContent, { scale: 0.95, duration: 0.2 });
  gsap.to(elements.modal, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      elements.modal.classList.add("hidden");
      elements.titleInput.value = "";
      elements.xpInput.value = "";
    },
  });
};

elements.btnAdd.onclick = openModal;
elements.btnCancel.onclick = closeModal;

elements.btnSave.onclick = () => {
  const title = elements.titleInput.value.trim();
  const xp = parseInt(elements.xpInput.value) || 0;

  if (title && xp > 0) {
    appData.habits.push({ id: Date.now(), title, xp });
    saveData();
    closeModal();
    renderUI();
  }
};

// Модуль экспорта CSV (Сложная логика сводной таблицы)
elements.btnExport.onclick = () => {
  if (appData.logs.length === 0) return alert("Нет данных для выгрузки");

  // Получаем уникальные даты и сортируем
  const dates = [...new Set(appData.logs.map((l) => l.date))].sort();

  // Формируем заголовок CSV: Дата, Привычка 1, Привычка 2...
  let csvContent =
    "Дата," + appData.habits.map((h) => `"${h.title}"`).join(",") + "\n";

  // Заполняем строки
  dates.forEach((date) => {
    let row = [date];
    appData.habits.forEach((habit) => {
      const log = appData.logs.find(
        (l) => l.date === date && l.habitId === habit.id,
      );
      row.push(log ? log.time : ""); // Если выполнено - пишем время, иначе пусто
    });
    csvContent += row.join(",") + "\n";
  });

  // Создаем файл и скачиваем
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

// Регистрация Service Worker для PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        console.log("SW зарегистрирован:", reg.scope);
      })
      .catch((err) => console.log("SW ошибка регистрации:", err));
  });
}
