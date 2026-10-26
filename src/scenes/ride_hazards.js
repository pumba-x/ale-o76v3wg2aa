// Препятствия скачки: ящик, бочка, дорожный барьер и конусы. Все яркие, с толстым тёмным контуром и красно-белой/оранжевой раскраской,
// чтобы на бежево-серых улицах Парижа они сразу читались как «через это надо прыгнуть», а не как часть фона.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;

  // Размеры «по картинке» в юнитах; столкновение считается по сжатому до 80% прямоугольнику (см. Hazard.hurtbox в ride.js)
  const DEFS = {
    crate: { w: 62, h: 64 },
    barrel: { w: 54, h: 80 },
    barrier: { w: 134, h: 62 },
    cones: { w: 100, h: 64 },
  };

  // Полоса красно-белой сигнальной ленты в прямоугольнике (x, y, w, h)
  function tape(g, x, y, w, h, seed) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#f6f0e0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#d63a2f';
    for (let sx = x - h * 2; sx < x + w + h; sx += h * 1.2) { g.beginPath(); g.moveTo(sx, y + h); g.lineTo(sx + h * 0.6, y + h); g.lineTo(sx + h * 1.6, y); g.lineTo(sx + h, y); g.closePath(); g.fill(); }
    A.grain(g, x, y, w, h, 0.18, 'overlay', seed || 3);
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  }

  function crate() {
    const { w, h } = DEFS.crate;
    return A.layer(w + 12, h + 10, (g) => {
      g.translate(6, 4);
      // светлое дерево с явным контуром
      A.box(g, 0, 0, w, h, { fill: '#d9a25a', lw: 4.4, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(80,40,10,0.28)', hiH: 5, loH: 7 });
      A.wood(g, 3, 3, w - 6, h - 6, { base: '#d9a25a', seed: 71, knots: true, grain: 0.18, lineGap: 6 });
      // доски и раскос
      g.strokeStyle = 'rgba(60,30,12,0.7)'; g.lineWidth = 2.6;
      for (const y of [h * 0.33, h * 0.66]) { g.beginPath(); g.moveTo(3, y); g.lineTo(w - 3, y); g.stroke(); }
      g.strokeStyle = '#8a5a2c'; g.lineWidth = 9; g.beginPath(); g.moveTo(9, h - 9); g.lineTo(w - 9, 9); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(9, h - 14); g.lineTo(w - 14, 9); g.moveTo(14, h - 9); g.lineTo(w - 9, 14); g.stroke();
      // металлические уголки
      g.fillStyle = '#4a4f5c'; for (const [cx, cy] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) { g.beginPath(); g.arc(cx, cy, 4.4, 0, 6.3); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
      // сигнальная лента сверху
      tape(g, 2, 2, w - 4, 13, 5);
    }, 2);
  }

  function barrel() {
    const { w, h } = DEFS.barrel;
    return A.layer(w + 12, h + 10, (g) => {
      g.translate(6, 4);
      const body = () => { g.beginPath(); g.moveTo(w * 0.1, 0); g.quadraticCurveTo(-w * 0.04, h / 2, w * 0.1, h); g.lineTo(w * 0.9, h); g.quadraticCurveTo(w * 1.04, h / 2, w * 0.9, 0); g.closePath(); };
      body(); g.fillStyle = A.linG(g, 0, 0, w, 0, [[0, '#8a2418'], [0.3, '#e0523a'], [0.62, '#c93a2b'], [1, '#7a2016']]); g.fill();
      g.save(); body(); g.clip(); A.grain(g, 0, 0, w, h, 0.26, 'overlay', 73);
      // белая полоса с предупреждающим треугольником
      g.fillStyle = '#f6f0e0'; g.fillRect(0, h * 0.38, w, h * 0.24); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, h * 0.38, w * 0.2, h * 0.24); g.fillRect(w * 0.82, h * 0.38, w * 0.2, h * 0.24);
      g.fillStyle = '#26221f'; g.beginPath(); g.moveTo(w / 2, h * 0.4); g.lineTo(w / 2 + 10, h * 0.6); g.lineTo(w / 2 - 10, h * 0.6); g.closePath(); g.fill();
      g.fillStyle = '#ffd24a'; g.beginPath(); g.moveTo(w / 2, h * 0.45); g.lineTo(w / 2 + 6.5, h * 0.575); g.lineTo(w / 2 - 6.5, h * 0.575); g.closePath(); g.fill();
      g.restore();
      body(); g.lineWidth = 4.4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
      // стальные обручи
      for (const yy of [h * 0.14, h * 0.86]) { g.fillStyle = A.linG(g, 0, yy - 5, 0, yy + 5, [[0, '#7b8190'], [0.5, '#4a4f5c'], [1, '#2f333b']]); g.fillRect(-1, yy - 5, w + 2, 10); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(-1, yy - 5, w + 2, 10); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(1, yy - 4, w - 2, 2); }
    }, 2);
  }

  function barrier() {
    const { w, h } = DEFS.barrier;
    return A.layer(w + 12, h + 24, (g) => {
      g.translate(6, 16);
      // ножки-«козлы»
      for (const px of [18, w - 18]) {
        g.fillStyle = '#6a707e'; g.beginPath(); g.moveTo(px - 12, h); g.lineTo(px - 4, 12); g.lineTo(px + 4, 12); g.lineTo(px + 12, h); g.closePath(); g.fill(); g.lineWidth = 3.4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(px - 3, 14, 2.6, h - 20);
      }
      // две красно-белые доски
      tape(g, 0, 8, w, 17, 11); tape(g, 4, 30, w - 8, 17, 13);
      // жёлтая мигалка сверху
      A.box(g, w / 2 - 12, -10, 24, 13, { fill: '#26221f', lw: 3, r: 3 });
      g.fillStyle = '#ffd24a'; g.beginPath(); g.ellipse(w / 2, -8, 9, 7, 0, Math.PI, 0); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      A.box(g, w / 2 - 24, 12 + 24, 48, 11, { fill: '#e4b73a', lw: 2.6, r: 3 }); A.text(g, 'TRAVAUX', w / 2, 12 + 24 + 6, 8.5, '#3a2431');
    }, 2);
  }

  function cones() {
    const { w, h } = DEFS.cones;
    return A.layer(w + 12, h + 10, (g) => {
      g.translate(6, 4);
      const cone = (cx, s) => {
        const ch = h * s, cw = 38 * s, top = h - ch;
        // основание
        A.box(g, cx - cw / 2 - 3, h - 8 * s, cw + 6, 8 * s, { fill: '#26221f', lw: 3 });
        g.save(); g.beginPath(); g.moveTo(cx - cw / 2, h - 8 * s); g.lineTo(cx - 5 * s, top); g.quadraticCurveTo(cx, top - 3 * s, cx + 5 * s, top); g.lineTo(cx + cw / 2, h - 8 * s); g.closePath();
        g.fillStyle = A.linG(g, cx - cw / 2, 0, cx + cw / 2, 0, [[0, '#c4501a'], [0.4, '#ff8a2a'], [1, '#c4501a']]); g.fill();
        g.clip(); A.grain(g, cx - cw, top, cw * 2, ch, 0.24, 'overlay', 79);
        // белая светоотражающая полоса
        g.fillStyle = '#f6f0e0'; g.beginPath(); g.moveTo(cx - cw * 0.34, top + ch * 0.42); g.lineTo(cx + cw * 0.34, top + ch * 0.42); g.lineTo(cx + cw * 0.42, top + ch * 0.62); g.lineTo(cx - cw * 0.42, top + ch * 0.62); g.closePath(); g.fill();
        g.restore();
        g.beginPath(); g.moveTo(cx - cw / 2, h - 8 * s); g.lineTo(cx - 5 * s, top); g.quadraticCurveTo(cx, top - 3 * s, cx + 5 * s, top); g.lineTo(cx + cw / 2, h - 8 * s); g.closePath(); g.lineWidth = 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
      };
      cone(w * 0.2, 0.86); cone(w * 0.8, 0.86); cone(w * 0.5, 1);
    }, 2);
  }

  // Знак-предупреждение над препятствием (появляется, когда до него ≈ секунда пути)
  function marker() {
    return A.layer(48, 46, (g) => {
      g.translate(24, 24);
      g.beginPath(); g.moveTo(0, -20); g.lineTo(20, 15); g.lineTo(-20, 15); g.closePath();
      g.fillStyle = '#ffd24a'; g.fill(); g.lineWidth = 4.4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(-12, 10); g.lineTo(-2, -9); g.lineTo(2, -9); g.lineTo(-6, 10); g.closePath(); g.fill();
      A.text(g, '!', 0, 4, 22, '#26221f');
    }, 2);
  }

  Ale.RideHazards = {
    DEFS,
    makeSprites() { return { crate: crate(), barrel: barrel(), barrier: barrier(), cones: cones(), marker: marker() }; },
  };
})();
