// Раскладка облачков-подсказок (реплики вне диалогов: Бубел что-то подсказывает, герои говорят на ходу). Чистая функция без рисования и без обращений к игре — её читают UI._drawHints
// и проверки (tests/suite_polish.js). Владелец 11.10.2026: «реплики вне диалогов не должны перекрывать персонажей, другие реплики и что-то важное».
//
// Раньше каждое облачко ставилось само по себе — над головой говорящего, поднятое над стоящими под ним героями, — и два облачка рядом (Алеся и Бубел на берегу Днепра) налезали друг на друга.
// Теперь облачки раскладываются по очереди (старые стоят на месте, новое подстраивается): для каждого перебирается сетка положений вокруг желаемого (сдвиги вбок и стопка вверх), и выбирается то,
// где меньше всего перекрытий с уже стоящими облачками, с важными местами экрана (панели, знак действия, полоса босса) и с телами героев; при равенстве — ближе к желаемому и к прошлому
// положению (облачко не прыгает между равноценными местами). Хвост, проходящий сквозь другое облачко, штрафуется: стопка над соседом выбирается, только если сдвиг вбок невозможен.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const area = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  };
  const grow = (r, k) => ({ x: r.x - k, y: r.y - k, w: r.w + 2 * k, h: r.h + 2 * k });
  // Веса: стоимость за пиксель площади перекрытия (облачко с облачком — самое дорогое, тело героя — дешевле: тень от хвоста пересекает его по необходимости) и за пиксель смещения
  const K = { bubble: 1.0, fixed: 0.8, body: 0.5, dist: 0.05, slant: 0.06, stay: 0.03, tailCross: 400, gap: 8 };
  const DX = [0, -0.35, 0.35, -0.7, 0.7, -1.05, 1.05, -1.4, 1.4];          // сдвиги вбок в долях ширины облачка
  const DY = [0, -0.55, -1.1, -1.65, -2.2];                                // сдвиги вверх в долях высоты облачка (стопка)

  // Хвост идёт от низа облачка к головам: если на пути чужое облачко — штраф (отрезок пробуется точками)
  function tailCrosses(x, y, w, h, ax, ay, others) {
    const tx = Math.max(x + 26, Math.min(x + w - 26, ax)), y0 = y + h, y1 = ay - 4;
    if (y1 <= y0 + 2) return 0;
    let n = 0;
    for (let i = 1; i <= 8; i++) {
      const u = i / 8, px = tx + (ax - tx) * u, py = y0 + (y1 - y0) * u;
      for (const o of others) if (px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h) { n++; break; }
    }
    return n;
  }

  // items: [{ id, ax, ay — макушка говорящего (экранные), w, h — размер облачка, bx, by — желаемое положение (над головой, уже поднятое над стоящими под ним), prev: {x, y}|null }]
  // fixed: [{ x, y, w, h }] — что нельзя закрывать; bodies: [{ owner, x, y, w, h }] — тела героев (владелец облачка не в счёт)
  // view: { W, H, minY (выше — панель с сердцами и целью), margin, leftX / leftY (при y < leftY облачко не левее leftX: счётчик помидоров) }
  // Возвращает массив положений в порядке items: { x, y, cost, overlap } (overlap — площадь перекрытий с облачками, важным и телами; 0 — чисто)
  function solve(items, fixed, bodies, view) {
    const M = view.margin === undefined ? 12 : view.margin, minY = view.minY === undefined ? 96 : view.minY;
    const minX = view.minX || 0, maxX = view.maxX === undefined ? view.W : view.maxX;          // границы по x (безопасные поля кадра: вырез iPhone); без них — весь кадр
    const placed = [], out = [];
    for (const it of items) {
      const bw = it.w, bh = it.h;
      let best = null;
      for (const ky of DY) {
        const y = it.by + ky * (bh + K.gap);
        if (ky !== 0 && y < minY) continue;                              // выше панели нельзя; базовое положение вызывающий уже прижал
        for (const kx of DX) {
          let x = Math.max(minX + M, Math.min(maxX - bw - M, it.bx + kx * bw));
          if (view.leftY !== undefined && y < view.leftY && x < view.leftX) x = Math.min(maxX - bw - M, view.leftX);
          const r = { x, y, w: bw, h: bh }, rg = grow(r, 4);
          let cost = K.dist * (Math.abs(x - it.bx) + 1.3 * Math.abs(y - it.by));
          cost += K.slant * Math.max(0, Math.abs(x + bw / 2 - it.ax) - bw * 0.5);
          let ov = 0, o;
          for (const p of placed) { o = area(rg, p); ov += o; cost += K.bubble * o; }
          for (const f of fixed) { o = area(rg, f); ov += o; cost += K.fixed * o; }
          for (const b of bodies) if (b.owner !== it.id) { o = area(r, b); ov += o; cost += K.body * o; }
          cost += K.tailCross * tailCrosses(x, y, bw, bh, it.ax, it.ay, placed);
          if (it.prev) cost += K.stay * (Math.abs(x - it.prev.x) + Math.abs(y - it.prev.y));
          if (!best || cost < best.cost - 1e-9) best = { x, y, cost, overlap: ov };
        }
      }
      out.push(best); placed.push({ x: best.x, y: best.y, w: bw, h: bh });
    }
    return out;
  }

  Ale.HintLayout = { solve, area, K };
})();
