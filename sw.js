const CACHE_NAME = "impulse-v4"; // При серьезных изменениях меняй цифру (v3, v4...)
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
];

// Установка: кэшируем файлы и заставляем новый SW активироваться немедленно
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Не ждем, пока пользователь закроет все вкладки
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

// Активация: безжалостно сносим старые кэши (например, impulse-v1)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Удаляем старый кэш:", cache);
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  self.clients.claim(); // Перехватываем управление моментально
});

// Стратегия: Сначала сеть (Network First), если нет сети - берем из кэша
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если интернет есть, обновляем файл в кэше "на лету" и отдаем пользователю
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Интернета нет? Достаем из заначки завхоза
        return caches.match(event.request);
      }),
  );
});
