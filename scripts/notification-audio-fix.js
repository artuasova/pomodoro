(function(){
  // Надёжные уведомления и звук для Pomodoro
  // - Запрашиваем разрешение на уведомления при загрузке
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission().catch(()=>{}); } catch(e) {}
  }

  // Показать уведомление (безопасно)
  function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch(e) {}
    }
  }

  // Разрешение на воспроизведение аудио: выполняется при первом действии пользователя
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    // Попробуем играть «пустой» элемент Audio, это обычно снимает ограничение в браузерах
    try {
      const silent = new Audio();
      // Не устанавливаем src — просто попытка play() часто достаточна
      silent.play().then(() => {
        audioUnlocked = true;
      }).catch(()=>{
        // Если не сработало — попытаемся создать AudioContext и resume()
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            if (ctx.state === 'suspended') ctx.resume().then(()=>{ audioUnlocked = true; }).catch(()=>{});
          }
        } catch(e) {}
      });
    } catch(e) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          if (ctx.state === 'suspended') ctx.resume().then(()=>{ audioUnlocked = true; }).catch(()=>{});
        }
      } catch(e) {}
    }
  }

  // Автоматически привяжем разблокировку аудио к кнопке старта, если она есть
  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', unlockAudio, { once: true });

    // Также прислушаемся к кнопке включения музыки, если есть
    const musicToggle = document.getElementById('music-toggle-btn');
    if (musicToggle) musicToggle.addEventListener('click', unlockAudio, { once: true });
  });

  // Проиграть звук по src — учитываем ползунок громкости из DOM
  function playSoundSrc(src) {
    try {
      // Если ещё не было взаимодействия — попытаться всё равно (некоторые браузеры проиграют после первого user gesture)
      const audio = new Audio(src);
      const volEl = document.getElementById('volume-slider') || document.getElementById('settings-volume-slider');
      const vol = volEl ? parseFloat(volEl.value) : 0.5;
      audio.volume = isNaN(vol) ? 0.5 : vol;
      // Попытка воспроизвести — обернута в catch
      audio.play().catch(()=>{});
    } catch(e) {}
  }

  // Воспроизвести случайный звуковой файл для режима и типа ("start" | "end")
  function playSoundForMode(mode, type) {
    try {
      if (typeof AUDIO_FILES === 'undefined') return;
      const set = AUDIO_FILES[mode] && AUDIO_FILES[mode][type];
      if (!set || !set.length) return;
      const src = set[Math.floor(Math.random() * set.length)];
      // Если аудио явно разблокировано — воспроизводим
      if (audioUnlocked) {
        playSoundSrc(src);
        return;
      }
      // Если ещё не разблокировано — всё равно попробуем воспроизвести (чтобы браузер зарегистрировал попытку)
      playSoundSrc(src);
    } catch(e) {}
  }

  // Надёжный таймер: опирается на реальное время окончания, а не на setInterval
  class PomodoroTimer {
    constructor() {
      this.timerEnd = null;
      this.timerActive = false;
      this.mode = 'focus';
      this._tickHandle = null;
    }
    start(seconds, mode, onTick, onEnd) {
      this.mode = mode || 'focus';
      this.timerEnd = Date.now() + seconds * 1000;
      this.timerActive = true;
      this.onTick = onTick;
      this.onEnd = onEnd;
      this._tick();
    }
    _tick() {
      if (!this.timerActive) return;
      const remaining = Math.max(0, Math.round((this.timerEnd - Date.now()) / 1000));
      try { if (typeof this.onTick === 'function') this.onTick(remaining); } catch(e) {}
      if (remaining <= 0) {
        this.timerActive = false;
        try { if (typeof this.onEnd === 'function') this.onEnd(); } catch(e) {}
        // Уведомление и звук при окончании
        try { showNotification((PHRASES && PHRASES[this.mode] && PHRASES[this.mode].notificationTitle) || 'Таймер', (PHRASES && PHRASES[this.mode] && PHRASES[this.mode].end && PHRASES[this.mode].end[0]) || 'Сессия завершена'); } catch(e) {}
        try { playSoundForMode(this.mode, 'end'); } catch(e) {}
        return;
      }
      // Вычисляем задержку до следующего срабатывания (чтобы синхронизироваться с целым секундами)
      const msToNextSecond = 1000 - (Date.now() % 1000) || 1000;
      this._tickHandle = setTimeout(() => this._tick(), msToNextSecond);
    }
    stop() {
      this.timerActive = false;
      if (this._tickHandle) clearTimeout(this._tickHandle);
    }
    getRemaining() {
      return this.timerActive ? Math.max(0, Math.round((this.timerEnd - Date.now()) / 1000)) : 0;
    }
  }

  // Экспортим в глобальную область для простого использования из существующего кода
  window.pomodoroUtils = window.pomodoroUtils || {};
  window.pomodoroUtils.showNotification = showNotification;
  window.pomodoroUtils.unlockAudio = unlockAudio;
  window.pomodoroUtils.playSoundForMode = playSoundForMode;
  window.pomodoroUtils.PomodoroTimer = PomodoroTimer;

})();
