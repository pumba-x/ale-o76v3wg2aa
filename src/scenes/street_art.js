// Оформление улицы: небо, дальний силуэт с Эйфелевой башней, османовские дома, лавки, тротуар и мостовая, портал ASSAS,
// уличная мебель (навесы, столики, лавка-киоск, скамья, клумба). Дома и достопримечательности — из «набора Парижа» (paris_kit*.js).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, K = Ale.Paris, OUT = A.OUT;
  const P_BRASS = '#d9a441';

  function sky(g, W, H, o) {
    o = o || {};
    A.gradV(g, 0, 0, W, H, o.stops || [[0, '#6fb7e4'], [0.5, '#a9d6ec'], [0.85, '#f5e6c4'], [1, '#fbe9c9']]);
    A.glow(g, W * (o.sunX || 0.78), H * 0.28, 360, 'rgba(255,240,190,', 0.7);
    A.grain(g, 0, 0, W, H, 0.05, 'overlay', 3);
  }

  // Облака: несколько пухлых спрайтов на длинной полосе (замкнута по ширине — плывёт по кругу).
  function clouds(g, W, H) {
    const R = A.rng(4), kinds = [K.cloud(240, 1), K.cloud(180, 2), K.cloud(300, 3), K.cloud(150, 4)];
    for (let i = 0; i < 8; i++) {
      const L = kinds[i % kinds.length], cx = R.range(0, W), cy = R.range(30, H * 0.62);
      for (const dx of [-W, 0, W]) g.drawImage(L.c, cx + dx, cy, L.w, L.h);
    }
  }

  // Лента домов вдоль baseY: случайные ширины/этажность из зерна seed. haze — дымка (для дальних планов).
  function buildingStrip(g, W, baseY, seed, o) {
    o = o || {};
    const R = A.rng(seed);
    let x = -R.range(20, 90), i = 0;
    while (x < W + 40) {
      // просвет между домами (перекрёсток): за ним виден дальний план с башней
      if (o.gaps && i > 0 && R.chance(o.gaps)) { x += R.range(150, 250); i++; continue; }
      const w = R.pick(o.widths || [230, 260, 300, 340]), fl = R.pick(o.floors || [3, 4, 4, 5]);
      const L = K.building({ w, floors: fl, seed: seed * 100 + i, haze: o.haze, hazeColor: o.hazeColor, lit: o.lit, scale: o.scale || 1.0 });
      if (!(o.clear && x + w > o.clear[0] && x < o.clear[1])) g.drawImage(L.c, x - L.pad, baseY - L.h, L.w, L.h);           // o.clear — [x0, x1]: здесь дома не рисуются (в просвете стоит что-то дальнее, например башня); остальная лента не меняется
      L.c.width = 0; L.c.height = 0;                 // спрайт дома больше не нужен: лента уже содержит его пиксели
      R.range(0, 8); x += w - 1; i++;                // дома стоят вплотную, как в настоящем квартале: прежний просвет в 1–8 юн. давал голубой шов между соседними фасадами (случайное число берём, как раньше, чтобы остальные дома остались прежними)
    }
  }

  // Дальний план: дымчатые дома, Эйфелева башня и Нотр-Дам.
  function skyline(g, W, H, towerX) {
    buildingStrip(g, W, H - 150, 21, { haze: 0.66, hazeColor: '238,224,236', lit: 0, widths: [180, 220, 260], floors: [2, 3, 3, 4], scale: 0.8 });
    const nd = K.notreDame({ haze: 0.3, color: '#b9b0c9', dark: '#9a90b3' }), t = K.tower(360, { haze: 0.5, color: '#8b7fa0', line: '#6e6488', hi: '#a89bc0', hazeColor: '236,224,238' });
    g.drawImage(nd.c, towerX - 620, H - 150 - nd.h + 6, nd.w, nd.h);
    g.drawImage(t.c, towerX - t.w / 2, H - 150 - t.h + 14, t.w, t.h);
    A.gradV(g, 0, H - 270, W, 270, [[0, 'rgba(251,233,201,0)'], [1, 'rgba(251,233,201,0.9)']]);
  }

  // Средний план: османовские дома в лёгкой дымке (стена улицы).
  function facades(g, W, H) {
    buildingStrip(g, W, 590, 33, { haze: 0.18, lit: 0.1, scale: 1.25, gaps: 0.22, floors: [3, 3, 4, 4, 5] });
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(235,225,215,0.10)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';        // дымка только поверх домов: раньше покрывала и прозрачное небо над крышами, и верх слоя читался светлой полосой поперёк неба
  }

  // ---------------------------------------------------------------- навесы
  function awningPath(g, x, y, w, drop, stripes, c1, c2) {
    const n = stripes, sw = w / n;
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y); g.lineTo(x + (i + 1) * sw + 4, y + drop); g.lineTo(x + i * sw - 4, y + drop); g.closePath();
      g.fillStyle = i % 2 ? c1 : c2; g.fill();
      g.beginPath(); g.arc(x + (i + 0.5) * sw, y + drop, sw / 2 + 2, 0, Math.PI); g.fillStyle = i % 2 ? c1 : c2; g.fill();
    }
    g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
    for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x + (i + 0.5) * sw, y + drop, sw / 2 + 2, 0, Math.PI); g.stroke(); }
    g.beginPath(); g.moveTo(x - 4, y + drop); g.lineTo(x, y); g.moveTo(x + w + 4, y + drop); g.lineTo(x + w, y); g.stroke();
    // складки полотна
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1.6; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x + (i + 0.5) * sw, y + 2); g.lineTo(x + (i + 0.5) * sw, y + drop); g.stroke(); }
  }

  function awning(g, w, drop, c1, c2) {
    return A.layer(w + 16, drop + 40, (c) => { c.translate(8, 4); awningPath(c, 0, 0, w, drop, Math.round(w / 34), c1, c2); c.setTransform(1, 0, 0, 1, 0, 0); }, 2);
  }

  // ---------------------------------------------------------------- тротуар и мостовая
  function groundStrip(g, W) {
    // тротуар: плиты с фасками, швами и потёртостями
    A.gradV(g, 0, 580, W, 40, [[0, '#d8cdb8'], [1, '#c9bda4']]);
    A.grain(g, 0, 580, W, 40, 0.14, 'overlay', 4);
    g.strokeStyle = 'rgba(43,26,32,0.35)'; g.lineWidth = 1.6;
    for (let x = 0; x < W; x += 74) { g.beginPath(); g.moveTo(x, 580); g.lineTo(x + 18, 620); g.stroke(); }
    g.beginPath(); g.moveTo(0, 600); g.lineTo(W, 600); g.stroke();
    A.edge(g, 0, 580, W, 22, 't', 22, 'rgba(60,40,30,0.25)');
    A.box(g, -4, 618, W + 8, 14, { fill: '#a89e8a', lw: 3, hi: 'rgba(255,255,255,0.35)' });        // бордюр
    // мостовая: брусчатка рядами, ближе к зрителю — крупнее
    A.gradV(g, 0, 632, W, 88, [[0, '#7f7a86'], [1, '#5c5866']]);
    const R = A.rng(6);
    for (let y = 634, row = 0; y < 720; row++) {
      const sh = 9 + row * 1.6, sw = 20 + row * 3.4;
      for (let x = ((row * 7) % 5) * -6 - (row % 2) * sw / 2; x < W; x += sw + 3) {
        const c = R.next();
        g.fillStyle = c < 0.34 ? 'rgba(255,255,255,0.09)' : c < 0.68 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,220,0.04)';
        A.rrPath(g, x + 1, y + 1, sw, sh, 3); g.fill();
        g.strokeStyle = 'rgba(20,16,30,0.32)'; g.lineWidth = 1; g.stroke();
      }
      y += sh + 3;
    }
    A.edge(g, 0, 632, W, 16, 't', 16, 'rgba(20,14,26,0.4)');
    g.fillStyle = OUT; g.fillRect(0, 578, W, 3);
  }

  // ---------------------------------------------------------------- портал ASSAS
  function portal(g, cx, baseY) {
    const w = 380, h = 420, x = cx - w / 2;
    A.plaster(g, x, baseY - h, w, h, [[0, '#efe3c8'], [1, '#e0cfaa']], { seed: 41, grain: 0.14 });
    g.strokeStyle = 'rgba(70,50,35,0.28)'; g.lineWidth = 1.5; for (let y = baseY - h + 40, r = 0; y < baseY; y += 34, r++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); for (let bx = x + (r % 2) * 40; bx < x + w; bx += 80) { g.beginPath(); g.moveTo(bx, y - 34); g.lineTo(bx, y); g.stroke(); } }
    g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, baseY - h, w, h);
    // фронтон с рельефом
    g.beginPath(); g.moveTo(x - 30, baseY - h); g.lineTo(cx, baseY - h - 96); g.lineTo(x + w + 30, baseY - h); g.closePath();
    g.fillStyle = A.linG(g, 0, baseY - h - 96, 0, baseY - h, [[0, '#f6ecd4'], [1, '#e8d8b6']]); g.fill(); g.lineWidth = 4; g.stroke();
    g.beginPath(); g.moveTo(x - 6, baseY - h - 6); g.lineTo(cx, baseY - h - 78); g.lineTo(x + w + 6, baseY - h - 6); g.strokeStyle = 'rgba(43,26,32,0.4)'; g.lineWidth = 2; g.stroke();
    A.box(g, x - 30, baseY - h, w + 60, 22, { fill: '#f4ead4', lw: 3.5, hi: 'rgba(255,255,255,0.4)' });
    g.fillStyle = 'rgba(80,55,35,0.28)'; for (let dx = x - 26; dx < x + w + 26; dx += 12) g.fillRect(dx, baseY - h + 14, 7, 7);
    A.text(g, 'ASSAS', cx, baseY - h - 44, 44, '#c8a860', { stroke: OUT, lw: 6 });
    // колонны с каннелюрами
    for (const dx of [-150, -70, 70, 150]) {
      const colx = cx + dx - 16;
      g.fillStyle = A.linG(g, colx, 0, colx + 32, 0, [[0, '#f8f0dc'], [0.5, '#f0e4c8'], [1, '#d6c39c']]); g.fillRect(colx, baseY - h + 22, 32, h - 46);
      g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(colx, baseY - h + 22, 32, h - 46);
      g.strokeStyle = 'rgba(43,26,32,0.22)'; g.lineWidth = 1.6; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(colx + i * 8, baseY - h + 26); g.lineTo(colx + i * 8, baseY - 30); g.stroke(); }
      A.box(g, colx - 6, baseY - h + 16, 44, 10, { fill: '#f4ead4', lw: 3 }); A.box(g, colx - 6, baseY - 30, 44, 12, { fill: '#e6d6b0', lw: 3 });
    }
    // тяжёлая дверь с бронзовыми заклёпками
    A.box(g, cx - 56, baseY - 250, 112, 250, { fill: '#5b3a2c', lw: 4, hi: 'rgba(255,255,255,0.15)' });
    A.wood(g, cx - 54, baseY - 248, 108, 246, { base: '#5b3a2c', seed: 43, dir: 'v', knots: false, grain: 0.16 });
    for (const [px, py, pw, ph] of [[cx - 46, baseY - 240, 44, 110], [cx + 2, baseY - 240, 44, 110], [cx - 46, baseY - 118, 44, 108], [cx + 2, baseY - 118, 44, 108]]) { A.box(g, px, py, pw, ph, { fill: '#7a5038', lw: 3 }); A.wood(g, px + 1.5, py + 1.5, pw - 3, ph - 3, { base: '#7a5038', seed: px, dir: 'v', knots: false }); }
    g.fillStyle = P_BRASS; for (const dx of [-12, 12]) { g.beginPath(); g.arc(cx + dx, baseY - 120, 6, 0, 6.3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
    // ступени
    for (let i = 0; i < 3; i++) A.box(g, cx - 130 - i * 22, baseY - 10 + i * 4, 260 + i * 44, 10, { fill: '#d9ccb0', lw: 3, hi: 'rgba(255,255,255,0.35)' });
    // флаги
    for (const dx of [-186, 186]) { g.fillStyle = '#7a2e3b'; g.fillRect(cx + dx - 14, baseY - 330, 28, 92); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx + dx - 14, baseY - 330, 28, 92); g.fillStyle = '#d9a441'; g.fillRect(cx + dx - 14, baseY - 330, 28, 8); }
    A.edge(g, x, baseY - h, 24, h, 'l', 24, 'rgba(60,40,30,0.2)'); A.edge(g, x + w - 24, baseY - h, 24, h, 'r', 24, 'rgba(60,40,30,0.2)');
  }

  // ---------------------------------------------------------------- мебель
  function cafeTable() {
    // круглый мраморный столик и два плетёных стула, вид сбоку
    return A.layer(190, 112, (g) => {
      const x = 95, baseY = 108;
      g.fillStyle = '#2b3a3a'; g.fillRect(x - 3, baseY - 88, 6, 88); g.strokeStyle = OUT; g.lineWidth = 2.5; g.strokeRect(x - 3, baseY - 88, 6, 88);
      A.box(g, x - 34, baseY - 96, 68, 9, { fill: '#efe3c6', lw: 3, r: 4, hi: 'rgba(255,255,255,0.5)' });
      g.fillStyle = '#2b3a3a'; g.fillRect(x - 18, baseY - 6, 36, 6); g.strokeRect(x - 18, baseY - 6, 36, 6);
      // чашка на столике
      g.fillStyle = '#fff'; g.fillRect(x - 6, baseY - 108, 12, 11); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(x - 6, baseY - 108, 12, 11);
      for (const side of [-1, 1]) {
        const cx = x + side * 66;
        g.strokeStyle = '#2b3a3a'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - 16, baseY); g.lineTo(cx - 12, baseY - 44); g.moveTo(cx + 16, baseY); g.lineTo(cx + 12, baseY - 44); g.stroke();
        g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
        A.box(g, cx - 20, baseY - 50, 40, 8, { fill: '#c7562f', lw: 3, r: 3 });
        g.strokeStyle = '#2b3a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + side * -16, baseY - 46); g.lineTo(cx + side * -16, baseY - 100); g.stroke();
        g.strokeStyle = '#8a4a2a'; g.lineWidth = 3; for (let yy = baseY - 96; yy < baseY - 58; yy += 9) { g.beginPath(); g.moveTo(cx + side * -16, yy); g.lineTo(cx + side * -16 + side * 16, yy + 2); g.stroke(); }
        g.lineCap = 'butt';
      }
    }, 2);
  }

  // Цветочный ящик: тёмно-зелёная крашеная доска с латунной кромкой и алыми геранями — насыщенный, контрастный к бежевым фасадам: сразу видно, что это предмет, а не фон.
  function planter() {
    return A.layer(100, 74, (g) => {
      A.box(g, 5, 20, 90, 48, { fill: '#2f6a4f', lw: 4.4, r: 4, hi: 'rgba(255,255,255,0.28)', lo: 'rgba(0,0,0,0.3)', hiH: 5, loH: 8 });
      A.wood(g, 8, 24, 84, 40, { base: '#2f6a4f', seed: 8, dir: 'v', lineGap: 14, knots: false, grain: 0.14 });
      g.strokeStyle = 'rgba(15,40,30,0.75)'; g.lineWidth = 2.2; for (const x of [33, 67]) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 66); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.16)'; for (const x of [12, 38, 72]) g.fillRect(x, 26, 3, 36);
      A.box(g, 1, 14, 98, 13, { fill: '#d9a441', lw: 4.2, r: 3, hi: 'rgba(255,255,255,0.45)', lo: 'rgba(90,50,10,0.3)' });        // латунная кромка
      const R = A.rng(8);
      for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(10 + i * 8.6, 12 - R.range(0, 6), R.range(8, 12), 0, 6.3); g.fillStyle = i % 2 ? '#5f9a52' : '#3f8a44'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(); }
      const cols = ['#e2384a', '#f0505f', '#fff6e4', '#e2384a']; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(15 + i * 14, 5 - (i % 2) * 4, 5.6, 0, 6.3); g.fillStyle = cols[i % 4]; g.fill(); g.lineWidth = 2; g.stroke(); }
    }, 2);
  }

  // Каменный парапет: тёмный серо-синий камень со светлой плитой сверху и мхом — отличается от кремовых стен домов, поэтому не сливается с фоном.
  function stoneWall() {
    return A.layer(140, 126, (g) => {
      A.box(g, 10, 18, 120, 108, { fill: '#7c8398', lw: 4.6, hi: 'rgba(255,255,255,0.22)', lo: 'rgba(0,0,0,0.25)', hiH: 4, loH: 10 });
      A.plaster(g, 12, 20, 116, 104, [[0, '#8d95a9'], [1, '#6b7388']], { seed: 12, grain: 0.22 });
      g.strokeStyle = 'rgba(30,34,52,0.65)'; g.lineWidth = 2.4;
      for (let y = 38; y < 120; y += 22) { g.beginPath(); g.moveTo(12, y); g.lineTo(128, y); g.stroke(); }
      for (let y = 38, r = 0; y < 120; y += 22, r++) for (let x = 12 + (r % 2) * 30; x < 128; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 22); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (let y = 40, r = 0; y < 120; y += 22, r++) for (let x = 14 + (r % 2) * 30; x < 126; x += 60) g.fillRect(x, y, 24, 3);
      const R = A.rng(12); g.fillStyle = 'rgba(96,150,84,0.55)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(R.range(16, 124), R.range(100, 122), R.range(6, 12), R.range(3, 5), 0, 0, 6.3); g.fill(); }   // мох у основания
      A.box(g, 0, 4, 140, 18, { fill: '#c9cfdb', lw: 4.6, r: 3, hi: 'rgba(255,255,255,0.5)', lo: 'rgba(40,44,64,0.28)' });        // светлая плита-парапет
    }, 2);
  }

  // Газетный киоск: зелёный корпус, витрина с журналами, полосатый навес.
  function kiosk() {
    return A.layer(190, 210, (g) => {
      A.box(g, 20, 96, 150, 114, { fill: '#2f5f6a', lw: 4, hi: 'rgba(255,255,255,0.15)' });
      A.wood(g, 22, 98, 146, 110, { base: '#2f5f6a', seed: 15, dir: 'v', lineGap: 9, knots: false, grain: 0.16 });
      A.box(g, 36, 122, 118, 60, { fill: '#e9d9b0', lw: 3.5, r: 3 });
      const R = A.rng(3); const cc = ['#e35a6b', '#f4b942', '#7ac0e8', '#fff6e4', '#8ecb7a'];
      for (let i = 0; i < 7; i++) { g.fillStyle = cc[i % 5]; g.fillRect(42 + i * 15, 130, 11, 34); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(42 + i * 15, 130, 11, 34); g.fillStyle = 'rgba(43,26,32,0.45)'; g.fillRect(44 + i * 15, 136, R.range(3, 7), 2.4); }
      A.text(g, 'JOURNAUX', 95, 196, 15, '#fff6e4');
      awningPath(g, 12, 98, 166, 26, 6, '#c7562f', '#fff6e4');
    }, 2);
  }

  function bench() {
    return A.layer(160, 96, (g) => {
      for (let i = 0; i < 3; i++) { A.box(g, 6, 6 + i * 16, 148, 12, { fill: '#2f6f73', lw: 3, r: 3, hi: 'rgba(255,255,255,0.2)' }); A.wood(g, 8, 8 + i * 16, 144, 8, { base: '#2f6f73', seed: 20 + i, knots: false, grain: 0.14 }); }
      A.box(g, 0, 56, 160, 14, { fill: '#2f6f73', lw: 3.5, r: 3, hi: 'rgba(255,255,255,0.25)' });
      A.box(g, 12, 70, 12, 26, { fill: '#2b3a3a', lw: 3 }); A.box(g, 136, 70, 12, 26, { fill: '#2b3a3a', lw: 3 });
    }, 2);
  }

  Ale.StreetArt = { sky, clouds, skyline, facades, buildingStrip, awning, awningPath, groundStrip, portal, cafeTable, planter, stoneWall, kiosk, bench };
})();
