// Общие мелочи: математика, детерминированный ГСЧ, easing.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  // Свой ключ объекта (не унаследованный): в таблицах по имени из ссылки или сохранения «constructor» и «toString» иначе находят функции Object (18.10.2026: ?scene=constructor оставлял чёрный экран навсегда)
  Ale.own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // Вход в сцену (entry) приходит из ссылки и из сохранения, а сцены ищут его в таблицах вида ROUTES[entry]: «constructor», «toString», «__proto__» находили бы унаследованное свойство и роняли рисование каждый кадр
  // (?scene=transit&entry=constructor). Допустимо только простое имя из латиницы, цифр и «_», которого нет у обычного объекта; иначе — «start» (18.10.2026).
  Ale.safeEntry = (e) => (typeof e === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(e) && !(e in Object.prototype)) ? e : 'start';
  Ale.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  Ale.lerp = (a, b, t) => a + (b - a) * t;
  Ale.approach = (v, to, d) => (v < to ? Math.min(v + d, to) : Math.max(v - d, to));
  Ale.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  Ale.smooth = (t) => { t = Ale.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // Верхний левый угол + размер. Касание границами не считается пересечением.
  Ale.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // Детерминированный генератор (mulberry32). Игровая логика и косметика используют разные потоки,
  // чтобы частицы не сбивали повторяемость боя.
  class Rng {
    constructor(seed) { this.s = (seed | 0) >>> 0; }
    seed(s) { this.s = (s | 0) >>> 0; return this; }
    next() {
      this.s = (this.s + 0x6D2B79F5) | 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
  }
  Ale.Rng = Rng;
  Ale.rng = new Rng(1234);     // игровые решения (ИИ, разброс)
  Ale.fxRng = new Rng(777);    // косметика

  Ale.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  };

  // Простая шкала «анимации по времени»: возвращает индекс кадра для списка длительностей.
  Ale.frameAt = (durations, t) => {
    let acc = 0;
    for (let i = 0; i < durations.length; i++) { acc += durations[i]; if (t < acc) return i; }
    return durations.length - 1;
  };
  Ale.sum = (arr) => arr.reduce((a, b) => a + b, 0);

  Ale.DEBUG = { boxes: false, fps: false };
})();
