// Оформление заднего двора почты: тёплое вечернее небо, каменная стена с плющом, кирпичный тыл почты со служебной дверью,
// конюшенный навес с сеном, брусчатка с травой. Всё рисуется кодом (см. paris_kit*.js).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, K = Ale.Paris, OUT = A.OUT;

  // Лист плюща: трёхлопастный, вытянутый вдоль +x от черешка (0,0) к кончику; s — длина.
  function ivyLeaf(g, x, y, ang, s, col) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(s * 0.12, -s * 0.62, s * 0.72, -s * 0.66, s * 0.62, -s * 0.2);          // верхняя боковая лопасть
    g.bezierCurveTo(s * 0.8, -s * 0.16, s * 0.98, -s * 0.06, s * 1.2, 0);                     // к кончику
    g.bezierCurveTo(s * 0.98, s * 0.06, s * 0.8, s * 0.16, s * 0.62, s * 0.2);
    g.bezierCurveTo(s * 0.72, s * 0.66, s * 0.12, s * 0.62, 0, 0);                            // нижняя боковая лопасть
    g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(24,44,26,0.85)'; g.stroke();
    g.strokeStyle = 'rgba(220,240,175,0.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(s * 0.04, 0); g.lineTo(s * 1.05, 0); g.moveTo(s * 0.34, 0); g.lineTo(s * 0.56, -s * 0.3); g.moveTo(s * 0.34, 0); g.lineTo(s * 0.56, s * 0.3); g.stroke();
    g.restore();
  }

  // Плющ: плети вьются вниз от верха стены, листья сидят на черешках вдоль побегов, есть боковые побеги.
  function ivy(g, x, y, w, h, seed) {
    const R = A.rng(seed), cols = ['#3d7542', '#4a8748', '#5a9a52', '#6aa95a', '#7fb35a'];
    const shoot = (sx, sy, ang0, len, sz, depth) => {
      let px = sx, py = sy, ang = ang0, step = R.range(8, 12);
      const pts = [[px, py]];
      for (let d = 0; d < len; d += step) { ang = Ale.clamp(ang + R.range(-0.42, 0.42), 0.75, 2.4); px += Math.cos(ang) * step; py += Math.sin(ang) * step; pts.push([px, py]); }
      // стебель: тёмная обводка, светлее внутри
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(28,40,26,0.9)'; g.lineWidth = Math.max(2.4, sz * 0.32) + 1.6; g.beginPath(); pts.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy))); g.stroke();
      g.strokeStyle = '#5b6a3c'; g.lineWidth = Math.max(2.4, sz * 0.32); g.beginPath(); pts.forEach(([qx, qy], i) => (i ? g.lineTo(qx, qy) : g.moveTo(qx, qy))); g.stroke();
      g.lineCap = 'butt';
      // листья по обе стороны стебля, крупнее у корня
      pts.forEach(([qx, qy], i) => {
        if (i === 0) return;
        const k = 1 - i / pts.length, s2 = sz * (0.72 + 0.4 * k) * R.range(0.85, 1.15);
        const side = i % 2 ? 1 : -1, a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
        ivyLeaf(g, qx, qy, a + side * R.range(0.7, 1.35), s2, R.pick(cols));
        if (R.chance(0.55)) ivyLeaf(g, qx, qy, a - side * R.range(0.8, 1.5), s2 * 0.9, R.pick(cols));
        if (depth < 1 && i > 2 && i < pts.length - 2 && R.chance(0.28)) shoot(qx, qy, a + side * R.range(0.5, 1.0), len * R.range(0.3, 0.5), sz * 0.85, depth + 1);
      });
      ivyLeaf(g, px, py, ang, sz * 0.7, cols[3]);                                                // верхушка
    };
    const n = Math.max(3, Math.round(w / 55));
    for (let i = 0; i < n; i++) shoot(x + (i + R.range(0.1, 0.9)) * (w / n), y + R.range(-4, 4), Math.PI / 2 + R.range(-0.3, 0.3), h * R.range(0.45, 1.0), R.range(11, 15), 0);
    // «шапка» из листьев над плетями: плющ переливается через парапет
    for (let i = 0; i < w / 9; i++) ivyLeaf(g, x + R.range(0, w), y - R.range(2, 10), R.range(0.3, 2.8), R.range(9, 13), R.pick(cols));
  }

  // Кирпичная кладка с потёртостями (тыл почты).
  function brickWall(g, x, y, w, h, seed) {
    const R = A.rng(seed);
    A.bricks(g, x, y, w, h, { bw: 44, bh: 19, mortar: '#4a3630', colors: ['#a86a52', '#9a5a45', '#b47358', '#8f5340'], seed });
    A.grain(g, x, y, w, h, 0.18, 'overlay', seed);
    A.blotches(g, x, y, w, h, Math.round(w * h / 30000), seed, 'rgba(50,25,20,', 'rgba(255,220,190,');
  }

  // Конюшенный навес: столбы, скат с черепицей, сено, лампа.
  function shed(w, h) {
    return A.layer(w + 40, h + 40, (g) => {
      g.translate(20, 20);
      // задняя стенка из досок и сено внутри
      A.wood(g, 20, 58, w - 40, h - 58, { base: '#5f3b28', seed: 51, dir: 'v', lineGap: 10, knots: true, grain: 0.18 });             // стенка начинается сразу под балкой (низ балки — 58): раньше между ними была 12-юнитная щель, и в ней виднелась каменная стена
      g.fillStyle = 'rgba(20,10,8,0.35)'; g.fillRect(20, 58, w - 40, h - 58);
      A.edge(g, 20, 58, w - 40, 52, 't', 52, 'rgba(0,0,0,0.5)');
      // сено кучей
      g.fillStyle = '#e4b95a'; g.beginPath(); g.moveTo(w * 0.3, h); g.quadraticCurveTo(w * 0.42, h - 70, w * 0.62, h - 34); g.quadraticCurveTo(w * 0.78, h - 60, w - 30, h); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(160,110,30,0.6)'; g.lineWidth = 1.6; const R = A.rng(4); for (let i = 0; i < 44; i++) { const sx = R.range(w * 0.32, w - 40), sy = h - R.range(6, 60); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + R.range(-16, 16), sy - R.range(4, 12)); g.stroke(); }
      // столбы
      for (const px of [10, w - 26]) { A.box(g, px, 50, 16, h - 50, { fill: '#7a4e33', lw: 3.4 }); A.wood(g, px + 1.5, 52, 13, h - 54, { base: '#7a4e33', seed: px, dir: 'v', knots: false }); }
      // балка и скат крыши (черепица)
      A.box(g, -6, 42, w + 12, 16, { fill: '#6a422c', lw: 3.4 });
      g.beginPath(); g.moveTo(-16, 46); g.lineTo(w * 0.5, -6); g.lineTo(w + 16, 46); g.closePath(); g.fillStyle = A.linG(g, 0, -6, 0, 46, [[0, '#c77a52'], [1, '#a4553b']]); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(70,30,20,0.4)'; g.lineWidth = 1.6; for (let y = 4, r = 0; y < 46; y += 9, r++) { g.beginPath(); g.moveTo(-16, y); g.lineTo(w + 16, y); g.stroke(); for (let x = -16 + (r % 2) * 10; x < w + 16; x += 20) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); } }
      A.speckle(g, -16, -6, w + 32, 60, 0.2, 9);
      g.restore(); g.lineWidth = 3.4; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-16, 46); g.lineTo(w * 0.5, -6); g.lineTo(w + 16, 46); g.closePath(); g.stroke();
      // фонарь под крышей
      A.glow(g, w * 0.22, 84, 60, 'rgba(255,200,120,', 0.5);
      g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(w * 0.22, 58); g.lineTo(w * 0.22, 70); g.stroke();
      A.box(g, w * 0.22 - 9, 70, 18, 24, { fill: '#2b2320', lw: 2.6, r: 3 }); g.fillStyle = '#ffdd9a'; g.fillRect(w * 0.22 - 5, 74, 10, 16);
    }, 2);
  }

  function trough(w) {
    return A.layer(w + 10, 60, (g) => {
      A.box(g, 5, 14, w, 34, { fill: '#8b5a3c', lw: 3.6, r: 4, hi: 'rgba(255,255,255,0.2)' });
      A.wood(g, 7, 16, w - 4, 30, { base: '#8b5a3c', seed: 61, knots: true });
      g.fillStyle = '#7fb6d6'; g.fillRect(12, 18, w - 14, 8); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(16, 19, w * 0.4, 2.4);
      // латунная табличка с именем на лицевой доске
      A.box(g, w / 2 - 36, 29, 78, 14, { fill: '#d9b45a', lw: 2, r: 2, hi: 'rgba(255,255,255,0.4)' });
      A.text(g, 'PRESLYUKAN', w / 2 + 3, 36.5, 10, '#4a2f14');
      for (const x of [16, w - 12]) A.box(g, x, 46, 10, 12, { fill: '#5f3b28', lw: 3 });
    }, 2);
  }

  function hayBale() {
    return A.layer(96, 64, (g) => {
      A.box(g, 4, 6, 88, 54, { fill: '#e4b95a', lw: 3.6, r: 6, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.16)' });
      const R = A.rng(6); g.save(); A.rrPath(g, 4, 6, 88, 54, 6); g.clip();
      g.strokeStyle = 'rgba(150,100,25,0.55)'; g.lineWidth = 1.6; for (let i = 0; i < 60; i++) { const x = R.range(6, 90), y = R.range(8, 58); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R.range(-12, 12), y + R.range(-3, 3)); g.stroke(); }
      A.speckle(g, 0, 0, 96, 64, 0.18, 4); g.restore();
      g.strokeStyle = '#7a5a3a'; g.lineWidth = 3.4; for (const x of [28, 68]) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x, 60); g.stroke(); }
    }, 2);
  }

  function barrel(w, h) {
    return A.layer(w + 8, h + 8, (g) => {
      g.beginPath(); g.moveTo(4 + w * 0.08, 4); g.quadraticCurveTo(4 - w * 0.08, 4 + h / 2, 4 + w * 0.08, 4 + h); g.lineTo(4 + w * 0.92, 4 + h); g.quadraticCurveTo(4 + w * 1.08, 4 + h / 2, 4 + w * 0.92, 4); g.closePath();
      g.fillStyle = A.linG(g, 4, 0, 4 + w, 0, [[0, '#7a4e33'], [0.35, '#b07a4c'], [0.7, '#9a6a42'], [1, '#5f3b28']]); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
      g.save(); g.clip(); A.grain(g, 0, 0, w + 8, h + 8, 0.2, 'overlay', 3); g.restore();
      g.strokeStyle = 'rgba(43,26,32,0.45)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(4 + i * w / 6, 6); g.lineTo(4 + i * w / 6, h + 2); g.stroke(); }
      for (const yy of [h * 0.18, h * 0.82]) { g.fillStyle = '#4a4f5c'; g.fillRect(2, 4 + yy - 5, w + 4, 10); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(2, 4 + yy - 5, w + 4, 10); }
    }, 2);
  }

  // Двор целиком: небо, дымчатый Париж, стена с плющом, тыл почты, брусчатка.
  function drawYard(g, W, H, X) {
    // небо и закат
    A.gradV(g, 0, 0, W, 470, [[0, '#7db9e0'], [0.55, '#cfe2df'], [0.85, '#f8dfae'], [1, '#f7cf96']]);
    A.glow(g, W * 0.16, 330, 420, 'rgba(255,214,140,', 0.7);
    // дымчатые дома за стеной
    // Эйфелева башня — дальше домов: рисуется ДО ленты домов и стоит в проёме, который лента оставляет свободным (раньше её рисовали поверх домов: сквозь решётку были видны окна и ставни)
    const t = K.tower(300, { haze: 0.5, color: '#9a8aa2', line: '#7a6a88', hi: '#b8a8c0', hazeColor: '244,220,196' }), tx0 = W * 0.58;
    g.drawImage(t.c, tx0, 470 - t.h + 10, t.w, t.h);
    Ale.StreetArt.buildingStrip(g, W, 470, 71, { haze: 0.42, hazeColor: '244,220,196', lit: 0.05, widths: [230, 270, 310], floors: [3, 4, 5], scale: 0.9, gaps: 0.15, clear: [tx0 - 14, tx0 + t.w + 14] });
    // стена: тёсаный камень
    const wallTop = 350;
    A.plaster(g, 0, wallTop, W, 584 - wallTop, [[0, '#d8c8a4'], [0.6, '#c9b892'], [1, '#b8a480']], { seed: 61, grain: 0.18, dark: 'rgba(70,45,30,', light: 'rgba(255,240,200,' });
    g.strokeStyle = 'rgba(60,40,28,0.4)'; g.lineWidth = 1.8;
    for (let y = wallTop + 34, r = 0; y < 584; y += 34, r++) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (r % 2) * 46; x < W; x += 92) { g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x, y); g.stroke(); } }
    A.box(g, -6, wallTop - 14, W + 12, 18, { fill: '#e4d6b4', lw: 3.4, hi: 'rgba(255,255,255,0.4)' });        // парапет
    g.fillStyle = 'rgba(80,55,35,0.28)'; for (let x = 0; x < W; x += 12) g.fillRect(x, wallTop - 8, 7, 6);
    A.edge(g, 0, wallTop, W, 60, 't', 60, 'rgba(50,30,20,0.22)');
    ivy(g, 420, wallTop + 6, 330, 140, 3); ivy(g, 980, wallTop + 4, 260, 120, 8); ivy(g, 1560, wallTop + 10, 240, 110, 12);
    // тыл почты слева: кирпич, служебная дверь, окно с ящиком цветов, водосточная труба
    const bw = 520;
    brickWall(g, 0, wallTop - 120, bw, 584 - wallTop + 120, 5);
    g.strokeStyle = OUT; g.lineWidth = 3.4; g.strokeRect(0, wallTop - 120, bw, 584 - wallTop + 120);
    A.box(g, -6, wallTop - 134, bw + 12, 16, { fill: '#e4d6b4', lw: 3.4, hi: 'rgba(255,255,255,0.4)' });
    // дверь (та же, что и с другой стороны: зелёная)
    const dx = X.door;
    A.box(g, dx - 62, 350, 124, 234, { fill: '#3f5f57', lw: 4, hi: 'rgba(255,255,255,0.15)' });
    A.box(g, dx - 50, 362, 100, 222, { fill: '#4d7a6c', lw: 3 });
    A.wood(g, dx - 48, 364, 96, 218, { base: '#4d7a6c', seed: 33, dir: 'v', knots: false, grain: 0.15 });
    A.box(g, dx - 36, 380, 72, 84, { fill: '#a6c9c0', lw: 3.4 });
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(dx, 380); g.lineTo(dx, 464); g.stroke();
    A.box(g, dx - 36, 480, 72, 94, { fill: 'rgba(0,0,0,0.13)', lw: 2.4 });
    g.fillStyle = '#d9a441'; g.beginPath(); g.arc(dx + 30, 500, 5, 0, 6.3); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    Ale.PostArt.plate(g, dx, 336, 140, 26, 'ENTRÉE DE SERVICE', 11, '#2e8f5a', '#f6fff0');
    // окно
    K.win(g, 330, 400, 40, 78, { shutter: '#7a2e3b', flowers: true, lit: true, curtain: true });
    // труба и лампа
    g.fillStyle = A.linG(g, 452, 0, 468, 0, [[0, '#6a6f7c'], [0.5, '#9aa0ae'], [1, '#5a5f6c']]); g.fillRect(452, wallTop - 110, 16, 584 - wallTop + 100); g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(452, wallTop - 110, 16, 584 - wallTop + 100);
    A.box(g, 446, wallTop - 118, 28, 14, { fill: '#8a909e', lw: 2.6, r: 2, hi: 'rgba(255,255,255,0.35)' });                       // воронка водостока: труба начинается не в воздухе, а у кромки крыши (раньше её верх висел без крепления)
    A.glow(g, 236, 380, 70, 'rgba(255,214,140,', 0.5); A.box(g, 228, 368, 16, 24, { fill: '#2b2320', lw: 2.6, r: 3 }); g.fillStyle = '#ffdd9a'; g.fillRect(232, 372, 8, 16);
    // арочные ворота вправо — дорога
    const gx = X.gate, gw = 200;
    g.beginPath(); g.moveTo(gx - gw / 2, 584); g.lineTo(gx - gw / 2, 440); g.arc(gx, 440, gw / 2, Math.PI, 0); g.lineTo(gx + gw / 2, 584); g.closePath();
    g.fillStyle = A.linG(g, 0, 340, 0, 584, [[0, '#9ec9ea'], [0.6, '#f6e2b8'], [1, '#e9c99a']]); g.fill();
    g.lineWidth = 4.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#e4d6b4'; g.lineWidth = 12; g.beginPath(); g.arc(gx, 440, gw / 2 + 8, Math.PI, 0); g.moveTo(gx - gw / 2 - 8, 440); g.lineTo(gx - gw / 2 - 8, 584); g.moveTo(gx + gw / 2 + 8, 440); g.lineTo(gx + gw / 2 + 8, 584); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.arc(gx, 440, gw / 2 + 14, Math.PI, 0); g.stroke();
    // дорога за воротами: дымка и силуэты деревьев
    g.save(); g.beginPath(); g.moveTo(gx - gw / 2 + 4, 584); g.lineTo(gx - gw / 2 + 4, 440); g.arc(gx, 440, gw / 2 - 4, Math.PI, 0); g.lineTo(gx + gw / 2 - 4, 584); g.closePath(); g.clip();
    g.fillStyle = 'rgba(120,150,110,0.7)'; for (const [tx, ty, r] of [[gx - 50, 520, 34], [gx + 20, 510, 44], [gx + 70, 530, 30]]) { g.beginPath(); g.arc(tx, ty, r, 0, 6.3); g.fill(); }
    A.gradV(g, gx - gw / 2, 500, gw, 84, [[0, 'rgba(230,210,170,0)'], [1, 'rgba(210,190,150,0.9)']]);
    g.restore();
    // земля: брусчатка с травой
    A.cobbles(g, 0, 584, W, 136, { base: ['#a29a86', '#7c7466'], seed: 9, grass: 0.06 });
    // соломинки
    const R = A.rng(15);
    for (let i = 0; i < 90; i++) { const sx = X.shed - 60 + R.range(-120, 380), sy = 592 + R.range(0, 100); g.strokeStyle = 'rgba(214,170,70,0.85)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + R.range(-10, 10), sy + R.range(-3, 3)); g.stroke(); }
    A.gradV(g, 0, 584, W, 136, [[0, 'rgba(255,224,170,0.08)'], [1, 'rgba(30,12,10,0.4)']]);
    A.edge(g, 0, 584, W, 16, 't', 16, 'rgba(30,16,10,0.4)');
    g.fillStyle = OUT; g.fillRect(0, 582, W, 3.4);
    // луч закатного солнца
    A.beam(g, 260, 340, 220, 720, 620, 320, 0.16, 'rgba(255,224,160,');
  }

  Ale.YardArt = { drawYard, shed, trough, hayBale, barrel, ivy };
})();
