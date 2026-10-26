// Значки управления: векторные, в одной манере с остальным интерфейсом (тёмно-сливовый контур, тёплые заливки на кремовом).
// Один набор путей рисуется и в DOM (SVG на экранных кнопках, index.html / touch.js), и на холсте (клавиши в обучающих плашках, памятка паузы, окно «Как играть»), поэтому
// кнопка на экране и её картинка в подсказке — один и тот же рисунок (владелец 12.10.2026: «ужасные иконки», раньше на кнопках стояли системные эмодзи 🦶🍅 и знаки ◀ ▶ ⬆).
// Поле значка 32×32. Операция: { d — путь SVG, f — заливка, s — толщина линии, c — цвет линии (по умолчанию контур), o — толщина тёмной подложки под линией (обводка штриха) }.
// Просмотр всех значков без игры: tests/icons.html.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const INK = '#3a2431';
  const COLORS = { ink: INK, cream: '#fff6e4', white: '#ffffff', red: '#e8445a', green: '#5aa648', gold: '#ffc94d', orange: '#f2994a', blue: '#4a86e0', wood: '#c98a52', steel: '#c9ced6', none: 'none' };

  // Слова-метки в текстах («@jump») → значок. Старые знаки (◀ ▶ ⬆ ▼ 🦶 🍅 🏹 🎯 🎳 ! II ↕) тоже понимаются: ими прежде подписывали клавиши в text.js.
  const GLYPH = { '◀': 'left', '▶': 'right', '⬆': 'jump', '▼': 'down', '🦶': 'stomp', '🍅': 'throw', '🏹': 'sling', '🎯': 'darts', '🎳': 'bowl', '!': 'interact', 'II': 'pause', '↕': 'updown' };

  // Эллипс (центр, полуоси, поворот в градусах) → путь SVG из двух дуг
  const ell = (cx, cy, rx, ry, deg) => {
    const a = (deg || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), f = (v) => +v.toFixed(2);
    const dx = 2 * rx * c, dy = 2 * rx * sn;
    return 'M' + f(cx - rx * c) + ' ' + f(cy - rx * sn) + ' a' + rx + ' ' + ry + ' ' + (deg || 0) + ' 1 0 ' + f(dx) + ' ' + f(dy) + ' a' + rx + ' ' + ry + ' ' + (deg || 0) + ' 1 0 ' + f(-dx) + ' ' + f(-dy) + ' Z';
  };

  const ICONS = {
    left: [{ d: 'M19.8 6.2 L10.2 16 L19.8 25.8', s: 5.6 }],
    right: [{ d: 'M12.2 6.2 L21.8 16 L12.2 25.8', s: 5.6 }],
    down: [{ d: 'M6.2 12.2 L16 21.8 L25.8 12.2', s: 5.6 }],
    jump: [{ d: 'M16 26.2 V8.4 M7.6 15.6 L16 7.2 L24.4 15.6', s: 5.2 }],
    updown: [{ d: 'M16 5.6 V26.4 M10.4 11.2 L16 5.6 L21.6 11.2 M10.4 20.8 L16 26.4 L21.6 20.8', s: 3.8 }],
    pause: [{ d: 'M11.2 7.6 V24.4 M20.8 7.6 V24.4', s: 5.6 }],
    interact: [{ d: 'M16 6.4 V17.8', s: 5.8 }, { d: ell(16, 24.6, 3, 3), f: 'ink' }],
    // лапка («Туп лапой»): большая подушечка и четыре пальца
    stomp: [
      { d: 'M16 14.4 C20.8 14.4 25 18 25 22.2 C25 25.6 22.6 27.6 19.8 27.6 C18.2 27.6 17.2 26.8 16 26.8 C14.8 26.8 13.8 27.6 12.2 27.6 C9.4 27.6 7 25.6 7 22.2 C7 18 11.2 14.4 16 14.4 Z', f: 'orange', s: 2 },
      { d: ell(11.2, 8.6, 2.8, 3.6, -14), f: 'orange', s: 1.8 },
      { d: ell(20.8, 8.6, 2.8, 3.6, 14), f: 'orange', s: 1.8 },
      { d: ell(5.4, 14.2, 2.5, 3.3, -42), f: 'orange', s: 1.8 },
      { d: ell(26.6, 14.2, 2.5, 3.3, 42), f: 'orange', s: 1.8 },
    ],
    // помидор
    throw: [
      { d: 'M16 8.4 C23.6 7.4 29 12.2 29 18.6 C29 24.8 23.4 29.2 16 29.2 C8.6 29.2 3 24.8 3 18.6 C3 12.2 8.4 7.4 16 8.4 Z', f: 'red', s: 2.2 },
      { d: 'M8 18 C8.2 14.8 9.8 12.8 12.6 12', s: 2.2, c: 'white' },
      { d: 'M16 10.4 L11.4 5 L15 7.4 L14 2.4 L16 5.8 L18 2.4 L17 7.4 L20.6 5 Z', f: 'green', s: 1.8 },
    ],
    // рогатка
    sling: [
      { d: 'M16 28 V18.6 M16 18.6 L7.8 5.8 M16 18.6 L24.2 5.8', s: 4.8, c: 'wood', o: 8.6 },
      { d: 'M8.2 7 Q16 16.6 23.8 7', s: 2.2, c: 'red', o: 5.2 },
      { d: ell(16, 12.4, 3, 3), f: 'gold', s: 1.8 },
    ],
    // дартс: мишень и дротик, воткнутый в центр
    darts: [
      { d: ell(13.4, 18.6, 11.4, 11.4), f: 'white', s: 2 },
      { d: ell(13.4, 18.6, 8.1, 8.1), f: 'red', s: 1.5 },
      { d: ell(13.4, 18.6, 5, 5), f: 'white', s: 1.4 },
      { d: ell(13.4, 18.6, 2.1, 2.1), f: 'red', s: 1.2 },
      { d: 'M14.8 17.2 L23.4 8.6', s: 2.8, c: 'steel', o: 6 },
      { d: 'M22.2 9.8 L25.4 13 L26.2 5.8 Z', f: 'red', s: 1.7 },
      { d: 'M22.2 9.8 L19 6.6 L26.2 5.8 Z', f: 'red', s: 1.7 },
    ],
    // шар для боулинга
    bowl: [
      { d: ell(16, 16.8, 12.4, 12.4), f: 'blue', s: 2.2 },
      { d: 'M8 12.8 Q9.6 9.6 13 8.2', s: 2.2, c: 'white' },
      { d: ell(12.4, 12.6, 1.9, 1.9), f: 'ink' },
      { d: ell(18.2, 10.8, 1.9, 1.9), f: 'ink' },
      { d: ell(16, 16.6, 2.1, 2.1), f: 'ink' },
    ],
    // «Поделиться» из Safari (квадрат со стрелкой вверх)
    share: [{ d: 'M10.4 13.2 H8.4 V27 H23.6 V13.2 H21.6 M16 20.4 V5.2 M11 10.2 L16 5.2 L21 10.2', s: 2.6 }],
  };

  const paths = {};
  const path2d = (name, i) => { const k = name + ':' + i; return paths[k] || (paths[k] = new Path2D(ICONS[name][i].d)); };

  Ale.Icons = {
    INK, COLORS, names: Object.keys(ICONS),

    // «@jump» или старый знак → имя значка (или null)
    nameOf(tok) {
      if (typeof tok !== 'string') return null;
      const n = tok.charAt(0) === '@' ? tok.slice(1) : GLYPH[tok];
      return n && Object.prototype.hasOwnProperty.call(ICONS, n) ? n : null;
    },
    is(tok) { return !!this.nameOf(tok); },

    // Разметка SVG для кнопки в DOM (те же пути и цвета, что у draw); ink — другой цвет «тёмных» линий (светлая надпись на тёмной плашке)
    svg(name, ink) {
      const ops = ICONS[name]; if (!ops) return '';
      const col = (k) => (k === 'ink' && ink ? ink : COLORS[k] || k);
      let s = '<svg class="ico" viewBox="0 0 32 32" aria-hidden="true" focusable="false">';
      for (const o of ops) {
        const line = (w, c) => '<path d="' + o.d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
        if (o.o) s += line(o.o, INK);
        if (o.f) s += '<path d="' + o.d + '" fill="' + col(o.f) + '"' + (o.s ? ' stroke="' + col(o.c || 'ink') + '" stroke-width="' + o.s + '" stroke-linecap="round" stroke-linejoin="round"' : '') + '/>';
        else if (o.s) s += line(o.s, col(o.c || 'ink'));
      }
      return s + '</svg>';
    },

    // Значок на холсте: центр (cx, cy), сторона size; ink — другой цвет «тёмных» линий
    draw(ctx, name, cx, cy, size, ink) {
      const ops = ICONS[name]; if (!ops) return;
      const col = (k) => (k === 'ink' && ink ? ink : COLORS[k] || k);
      ctx.save();
      ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 32, size / 32);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ops.forEach((o, i) => {
        const p = path2d(name, i);
        if (o.o) { ctx.lineWidth = o.o; ctx.strokeStyle = INK; ctx.stroke(p); }
        if (o.f) { ctx.fillStyle = col(o.f); ctx.fill(p); }
        if (o.s) { ctx.lineWidth = o.s; ctx.strokeStyle = col(o.c || 'ink'); ctx.stroke(p); }
      });
      ctx.restore();
    },

    // «Наклейка»: кремовый круг с тёмным контуром и тенью снизу, как у клавиш в плашках (on — нажатая: золотая)
    disc(ctx, cx, cy, r, on) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.12, r, 0, 6.2832); ctx.fillStyle = 'rgba(58,36,49,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fillStyle = on ? '#ffd98a' : '#fff6e4'; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    },

    // Круглая кнопка со значком (клавиша в подсказке): тот же вид, что у кнопки на экране
    button(ctx, tok, cx, cy, r, on) {
      const n = this.nameOf(tok); if (!n) return;
      this.disc(ctx, cx, cy, r, on);
      this.draw(ctx, n, cx, cy, r * 1.16);
    },
  };
})();
