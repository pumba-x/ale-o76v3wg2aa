// Автоподбор разрешения кадра. Чистый счётчик без обращения к окну и часам: на вход — интервалы между кадрами, на выход — новый масштаб холста или ничего.
//
// Владелец 14.10.2026, пробуя игру на iPhone: «два qr выдавали разные уровни качества» — один и тот же экран то чёткий, то с видимыми пикселями. Прежний подбор (скользящее среднее кадра
// выше 42 мс на протяжении 45 кадров → холст меньше на пятую часть, до половины, назад не возвращается) срабатывал от разовых подвисаний первых секунд (собирается сцена, расшифровываются
// звук и картинки), и картинка навсегда оставалась мягкой. Теперь:
//   · решает МЕДИАНА интервалов за окно 2 с, а не среднее: разовые провалы по 100–250 мс её не двигают;
//   · первые секунды игры, смена сцены и возвращение на вкладку (hold) в счёт не идут;
//   · шаг вниз — только после двух медленных окон подряд (4 с), на 15 %, а после него проверка: если медиана не упала хотя бы на 8 %, дело не в числе пикселей,
//     шаг откатывается и подбор выключается до конца сеанса (мягкая картинка без выигрыша хуже всего);
//   · шаг вверх (на 20 %) после десяти секунд плавной работы; если после подъёма снова стало медленно, подъёмы закрываются на 2 минуты, а при повторе — на 4, 8… (не больше получаса);
//   · пол выше, чем был: на телефоне 0,7 (холст не реже 1,4 пикселя на пиксель CSS — мягко, но без «квадратов»), у больших окон 0,5.
// Экономичный режим iOS (30 к/с, 33 мс на кадр) порога не задевает.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const CFG = {
    gap: 0.25,            // интервал длиннее — вкладку усыпляли или собиралась сцена: в счёт не идёт, окно начинается заново
    window: 2.0,          // секунд на окно измерения
    slowMedian: 0.036,    // медиана интервалов выше — окно «медленное» (меньше 28 к/с)
    fastP90: 0.022,       // 90-й процентиль ниже — окно «плавное» (от 45 к/с)
    slowNeeded: 2,        // медленных окон подряд до шага вниз
    fastNeeded: 5,        // плавных окон подряд до шага вверх
    stepDown: 0.85, stepUp: 1.2,
    settle: 4.0,          // после смены разрешения окна не оцениваются: холст пересоздаётся, браузеру нужно время
    gain: 0.92,           // шаг вниз остаётся, только если медиана после него не больше 92 % прежней
    flipWindow: 25,       // подняли, и за это время снова пришлось идти вниз — подъёмы закрываются на noUpFor секунд (при повторе вдвое дольше, не больше maxNoUp)
    noUpFor: 120, maxNoUp: 1800,
    start: 8.0,           // первые секунды игры не оцениваются
    floorTouch: 0.7, floorWide: 0.5,
  };

  const ms = (s) => (s * 1000).toFixed(1) + ' мс';

  function create(opts) {
    opts = opts || {};
    const cfg = Object.assign({}, CFG, opts.cfg);
    const q = {
      cfg, floor: opts.floor !== undefined ? opts.floor : cfg.floorWide,
      scale: 1, clock: 0, graceUntil: cfg.start,
      buf: [], winT: 0, slow: 0, fast: 0, probe: null, locked: false, noUpUntil: 0, lastUp: -1e9, flips: 0,
      log: [], last: null,          // log — что решали (для экрана статистики и проверок); last — итог последнего окна { t, median, p90, n }

      // Не оценивать ближайшие sec секунд (смена сцены, возвращение на вкладку, смена размера окна).
      hold(sec) { this.graceUntil = Math.max(this.graceUntil, this.clock + sec); this.buf.length = 0; this.winT = 0; this.slow = 0; this.fast = 0; },
      // Другая сцена — другая нагрузка: проверка последнего шага вниз, не успевшая состояться, теряет смысл (шаг остаётся, но не проверенным).
      cancelProbe() { this.probe = null; },

      // Интервал очередного кадра (с). Возвращает новый масштаб, если пора его сменить, иначе null.
      frame(raw) {
        if (!(raw > 0)) return null;
        if (raw > cfg.gap) { this.buf.length = 0; this.winT = 0; return null; }
        this.clock += raw;
        if (this.clock < this.graceUntil) return null;
        this.buf.push(raw); this.winT += raw;
        if (this.winT < cfg.window) return null;
        return this._judge();
      },

      _note(text) { this.log.push({ t: this.clock, text }); if (this.log.length > 12) this.log.shift(); },
      _set(to, text) { const from = this.scale; this.scale = to; this._note(text + ': ' + from.toFixed(2) + ' → ' + to.toFixed(2)); },

      _judge() {
        const s = this.buf.slice().sort((a, b) => a - b), n = s.length;
        const median = s[n >> 1], p90 = s[Math.min(n - 1, Math.floor(n * 0.9))];
        this.buf.length = 0; this.winT = 0;
        this.last = { t: this.clock, median, p90, n };
        if (this.probe) {            // проверка прошлого шага вниз: помог ли он
          const pr = this.probe; this.probe = null;
          if (median > pr.before * cfg.gain) {
            this._set(pr.from, 'откат (медиана ' + ms(median) + ' не лучше ' + ms(pr.before) + ', подбор выключен)');
            this.locked = true; this.slow = 0; this.fast = 0; this.hold(cfg.settle);
            return this.scale;
          }
        }
        if (median > cfg.slowMedian) { this.slow++; this.fast = 0; }
        else { this.slow = 0; this.fast = p90 < cfg.fastP90 ? this.fast + 1 : 0; }
        if (this.slow >= cfg.slowNeeded && !this.locked && this.scale > this.floor + 1e-6) {
          const from = this.scale, to = Math.max(this.floor, from * cfg.stepDown);
          if (this.clock - this.lastUp < cfg.flipWindow) { this.flips++; this.noUpUntil = this.clock + Math.min(cfg.maxNoUp, cfg.noUpFor * Math.pow(2, this.flips - 1)); }
          this.probe = { from, before: median };
          this._set(to, 'вниз (медиана ' + ms(median) + ')');
          this.hold(cfg.settle);
          return to;
        }
        if (this.fast >= cfg.fastNeeded && !this.locked && this.scale < 1 - 1e-6 && this.clock >= this.noUpUntil) {
          const to = Math.min(1, this.scale * cfg.stepUp);
          this._set(to, 'вверх (плавно ' + cfg.fastNeeded * cfg.window + ' с)');
          this.lastUp = this.clock; this.hold(cfg.settle);
          return to;
        }
        return null;
      },
    };
    return q;
  }

  Ale.Quality = { CFG, create };
})();
