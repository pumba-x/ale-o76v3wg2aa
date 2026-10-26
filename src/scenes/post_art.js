// Оформление почты: комната, стойка, окошко кассы, мешки, скамья. Всё рисуется кодом: штукатурка, обои, крашеные панели,
// дерево с волокнами, паркет, латунь — с зерном, мягкими тенями и лучами света из окон.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;

  const P = {
    wall1: '#efdcb4', wall2: '#f6e8c8', wood: '#8b5a3c', woodDark: '#5f3b28', woodLight: '#b98357',
    brass: '#d9a441', brassDark: '#9a6b22', cream: '#fff6e4', wine: '#7a2e3b', teal: '#2f6f73', navy: '#2a3a55',
    green: '#2f5f57', greenDark: '#234a44', greenLight: '#3d7268',
  };
  Ale.PostPalette = P;

  function archPath(g, x, y, w, h) {
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  }

  // Эйфелева башня: ажурный силуэт (для окон и постеров).
  function tower(g, cx, baseY, h, color, line) {
    const w = h * 0.34;
    g.save();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(cx - w / 2, baseY); g.quadraticCurveTo(cx - w * 0.18, baseY - h * 0.42, cx - h * 0.014, baseY - h * 0.92); g.lineTo(cx - h * 0.006, baseY - h);
    g.lineTo(cx + h * 0.006, baseY - h); g.lineTo(cx + h * 0.014, baseY - h * 0.92); g.quadraticCurveTo(cx + w * 0.18, baseY - h * 0.42, cx + w / 2, baseY);
    g.lineTo(cx + w * 0.34, baseY); g.quadraticCurveTo(cx, baseY - h * 0.2, cx - w * 0.34, baseY); g.closePath(); g.fill();
    g.fillRect(cx - w * 0.36, baseY - h * 0.36, w * 0.72, h * 0.028); g.fillRect(cx - w * 0.2, baseY - h * 0.66, w * 0.4, h * 0.022);
    g.fillRect(cx - w * 0.05, baseY - h * 0.99, w * 0.1, h * 0.04);
    g.strokeStyle = line || color; g.lineWidth = Math.max(0.6, h * 0.006);
    for (let i = 0; i < 6; i++) { const t = i / 6; g.beginPath(); g.moveTo(cx - w * (0.34 - t * 0.2), baseY - h * (0.02 + t * 0.32)); g.lineTo(cx + w * (0.34 - (t + 0.16) * 0.2), baseY - h * (0.02 + (t + 0.16) * 0.32)); g.stroke(); }
    g.restore();
  }

  // Окно с видом на крыши Парижа и башню.
  function windowArch(g, cx, y, w, h, o) {
    o = o || {};
    const x = cx - w / 2;
    archPath(g, x - 12, y - 12, w + 24, h + 12); g.fillStyle = '#f3e2c0'; g.fill();
    A.grain(g, x - 12, y - 12, w + 24, h + 12, 0.16, 'overlay', 5);
    g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.save(); archPath(g, x, y, w, h); g.clip();
    // вид на крыши Парижа и башню — нарисованная панорама
    if (!A.image(g, 'view_paris_day', x, y, w, h, { at: o.at === undefined ? 0.69 : o.at, zoom: 1.1, top: 0.35 })) A.gradV(g, x, y, w, h, [[0, '#7fbfe4'], [0.55, '#c8e6ee'], [1, '#f8efd2']]);
    g.restore();
    // переплёт
    g.strokeStyle = '#f3e2c0'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, y + h); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    archPath(g, x, y, w, h); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    // блик на стекле
    g.save(); archPath(g, x, y, w, h); g.clip(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + 10, y + h); g.lineTo(x + 46, y + 20); g.lineTo(x + 66, y + 20); g.lineTo(x + 30, y + h); g.fill(); g.restore();
    // подоконник
    A.box(g, x - 18, y + h + 2, w + 36, 12, { fill: '#e2cca0', stroke: OUT, lw: 3, hi: 'rgba(255,255,255,0.4)' });
  }

  function curtain(g, x, y, h, dir) {
    // штора, подхваченная лентой: складки и зерно ткани
    const w = 36;
    g.save();
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + dir * w, y); g.quadraticCurveTo(x + dir * (w + 6), y + h * 0.5, x + dir * (w - 12), y + h);
    g.lineTo(x, y + h); g.closePath();
    g.fillStyle = A.linG(g, x, 0, x + dir * w, 0, [[0, '#5a1f2a'], [0.5, P.wine], [1, '#9a4050']]); g.fill();
    g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.clip(); A.grain(g, Math.min(x, x + dir * w) - 4, y, w + 12, h, 0.2, 'overlay', 3);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + dir * i * 7, y + 4); g.quadraticCurveTo(x + dir * (i * 7 + 3), y + h * 0.5, x + dir * (i * 7 - 4), y + h - 2); g.stroke(); }
    g.restore();
    g.fillStyle = '#4a1822'; g.fillRect(Math.min(x, x + dir * w), y - 7, w, 9); g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(Math.min(x, x + dir * w), y - 7, w, 9);
    g.fillStyle = P.brass; g.beginPath(); g.arc(x + dir * (w - 12), y + h * 0.56, 5, 0, 6.3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  }

  function pendantLamp(g, x, cordLen) {
    g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, 58); g.lineTo(x, cordLen + 10); g.stroke();                       // шнур доходит до верхушки абажура (она на cordLen + 10), а не обрывается над ним
    A.glow(g, x, cordLen + 34, 170, 'rgba(255,214,140,', 0.42);
    g.beginPath(); g.moveTo(x - 32, cordLen + 30); g.quadraticCurveTo(x, cordLen - 10, x + 32, cordLen + 30); g.closePath();
    g.fillStyle = A.linG(g, x - 32, 0, x + 32, 0, [[0, '#245a5e'], [0.4, '#3a8a8e'], [1, '#1f4c50']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 21, cordLen + 21, 8, 8);                                                       // блик — внутри абажура (раньше торчал над его плечом на обои)
    g.beginPath(); g.ellipse(x, cordLen + 33, 13, 7, 0, 0, 6.3); g.fillStyle = '#fff2c4'; g.fill(); g.lineWidth = 2; g.stroke();
  }

  function frame(g, x, y, w, h, inner) {
    A.box(g, x, y, w, h, { fill: '#6a422c', lw: 3, r: 3, hi: 'rgba(255,255,255,0.18)' });
    g.save(); g.beginPath(); g.rect(x + 8, y + 8, w - 16, h - 16); g.clip(); inner(g, x + 8, y + 8, w - 16, h - 16); g.restore();
    g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    A.edge(g, x + 8, y + 8, w - 16, h - 16, 't', 10, 'rgba(0,0,0,0.25)');
  }

  function plant(g, x, y, s) {
    // горшок и листья
    A.box(g, x - 22 * s, y - 40 * s, 44 * s, 40 * s, { fill: '#b4553a', lw: 3, r: 5, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
    A.box(g, x - 26 * s, y - 48 * s, 52 * s, 12 * s, { fill: '#c76a4a', lw: 3, r: 4 });
    const R = A.rng(Math.round(x));
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI / 2 + (i - 5) * 0.31 + R.range(-0.08, 0.08), len = R.range(60, 104) * s;
      g.save(); g.translate(x, y - 48 * s); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-17 * s, -len * 0.5, 0, -len); g.quadraticCurveTo(17 * s, -len * 0.5, 0, 0);
      g.fillStyle = i % 3 === 0 ? '#5a9a54' : i % 3 === 1 ? '#3f7a43' : '#4f8a4b'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -len * 0.8); g.stroke();
      g.restore();
    }
  }

  // Старый туристический плакат: нарисованная афиша в раме и подпись под ней.
  const POSTER = { paris: ['poster_paris', 'PARIS'], monaco: ['poster_monaco', 'MONACO'], nice: ['poster_nice', 'NICE'], flights: ['poster_flights', 'VOLS'] };
  function poster(g, x, y, w, h, kind) {
    const P_ = POSTER[kind] || POSTER.paris;
    frame(g, x, y, w, h, (c, ix, iy, iw, ih) => {
      if (!A.image(c, P_[0], ix, iy, iw, ih, { top: 0.4 })) { c.fillStyle = '#e8b76c'; c.fillRect(ix, iy, iw, ih); }
      // подпись на полосе снизу
      const bh = Math.round(ih * 0.17);
      c.fillStyle = 'rgba(38,24,32,0.62)'; c.fillRect(ix, iy + ih - bh, iw, bh);
      A.text(c, P_[1], ix + iw / 2, iy + ih - bh / 2, Math.round(iw * 0.17), '#fff2c4');
    });
  }

  function wallClock(g, cx, cy, r) {
    g.beginPath(); g.arc(cx, cy, r + 9, 0, 6.3); g.fillStyle = A.linG(g, cx - r, cy - r, cx + r, cy + r, [[0, '#c9982f'], [0.5, '#f0cf78'], [1, '#a87a22']]); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fillStyle = '#fff6e4'; g.fill(); g.lineWidth = 3; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.strokeStyle = OUT; g.lineWidth = i % 3 ? 2 : 4; g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4)); g.lineTo(cx + Math.sin(a) * (r - (i % 3 ? 9 : 14)), cy - Math.cos(a) * (r - (i % 3 ? 9 : 14))); g.stroke(); }
    g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(3.4) * r * 0.5, cy - Math.cos(3.4) * r * 0.5); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(1.1) * r * 0.78, cy - Math.cos(1.1) * r * 0.78); g.stroke(); g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fillStyle = OUT; g.fill();
  }

  // Стена почтовых ящиков: латунные ячейки с номерами, из некоторых торчат письма.
  function pigeonholes(g, mx, my, cols, rows) {
    const cw = 44, ch = 52, R = A.rng(21);
    A.box(g, mx - 12, my - 12, cols * cw + 24, rows * ch + 24, { fill: '#5f3b28', lw: 4, r: 4, hi: 'rgba(255,255,255,0.14)' });
    A.wood(g, mx - 8, my - 8, cols * cw + 16, rows * ch + 16, { base: '#6a422c', seed: 6, knots: false });
    let n = 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, n++) {
      const bx = mx + c * cw, by = my + r * ch;
      A.box(g, bx + 2, by + 2, cw - 4, ch - 4, { fill: '#cf9c44', lw: 2.5, r: 3, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.24)' });
      A.grain(g, bx + 2, by + 2, cw - 4, ch - 4, 0.18, 'overlay', 11);
      const letter = R.chance(0.32);
      if (letter) { g.save(); g.translate(bx + cw / 2, by + ch * 0.54); g.rotate(R.range(-0.2, 0.2)); g.fillStyle = '#fff6e4'; g.fillRect(-13, -9, 26, 18); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(-13, -9, 26, 18); g.beginPath(); g.moveTo(-13, -9); g.lineTo(0, 1); g.lineTo(13, -9); g.stroke(); g.restore(); }
      if (!letter) { g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(bx + cw / 2, by + ch * 0.66, 3.2, 0, 6.3); g.fill(); g.fillRect(bx + cw / 2 - 1.2, by + ch * 0.66, 2.4, 7); }        // письмо торчит из ячейки и закрывает замочную скважину
      A.text(g, String(n), bx + cw / 2, by + 11, 11, '#4a3220');                                                                                          // номер над письмом, а не под его клапаном (раньше линии конверта перечёркивали цифры)
    }
  }

  // Доска объявлений с записками.
  function noticeBoard(g, x, y, w, h) {
    A.box(g, x, y, w, h, { fill: '#c9975a', lw: 4, r: 4, hi: 'rgba(255,255,255,0.2)' });
    A.grain(g, x, y, w, h, 0.25, 'overlay', 8);
    const pins = [[8, 12, 44, 40, '#fff6e4', -0.05], [58, 18, 34, 50, '#f5e3a0', 0.06], [98, 12, 44, 36, '#fff6e4', 0.03], [10, 62, 52, 40, '#d9ecf2', 0.04], [72, 68, 66, 32, '#fff6e4', -0.03]];
    for (const [px, py, pw, ph, c, r] of pins) {
      g.save(); g.translate(x + px + pw / 2, y + py + ph / 2); g.rotate(r); g.fillStyle = c; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.lineWidth = 1.8; g.strokeStyle = OUT; g.strokeRect(-pw / 2, -ph / 2, pw, ph);
      g.fillStyle = 'rgba(43,26,32,0.5)'; for (let i = 0; i < 3; i++) g.fillRect(-pw / 2 + 5, -ph / 2 + 8 + i * 9, pw - 10 - (i === 2 ? 12 : 0), 2.2);
      g.fillStyle = '#d63a3a'; g.beginPath(); g.arc(0, -ph / 2 + 4, 3.2, 0, 6.3); g.fill(); g.restore();
    }
  }

  // Табличка с надписью (латунь или эмаль).
  function plate(g, cx, cy, w, h, str, size, fill, ink) {
    A.box(g, cx - w / 2, cy - h / 2, w, h, { fill, lw: 3, r: 5, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.2)' });
    A.text(g, str, cx, cy + 1, size, ink);
  }

  // Мышиная норка в плинтусе: тёмная арка, крошки сыра.
  function mouseHole(g, x, baseY) {
    g.beginPath(); g.moveTo(x - 22, baseY); g.lineTo(x - 22, baseY - 18); g.arc(x, baseY - 18, 22, Math.PI, 0); g.lineTo(x + 22, baseY); g.closePath();
    g.fillStyle = '#120a0e'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = OUT; g.stroke();
    A.glow(g, x, baseY - 16, 30, 'rgba(0,0,0,', 0.45);
    g.strokeStyle = '#7a4e33'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 26, baseY); g.lineTo(x + 26, baseY); g.stroke();
    g.fillStyle = '#f1cf5a'; for (const [dx, dy] of [[-34, -2], [-40, -4], [30, -2]]) { g.beginPath(); g.moveTo(x + dx, baseY + dy); g.lineTo(x + dx + 6, baseY + dy); g.lineTo(x + dx + 3, baseY + dy - 5); g.closePath(); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(); }
  }

  // ---------------------------------------------------------------- комната целиком
  function drawRoom(g, W, H, X) {
    // стена: обои в полоску (линия основания стены — y = 580; герои ходят по «полосе» пола на y = 600)
    A.wallpaper(g, 0, 0, W, 580, [P.wall1, '#f1e1bc', P.wall2], 'rgba(150,100,70,0.09)', 46, { seed: 11 });
    // потолочный карниз с зубчиками и полкой
    A.gradV(g, 0, 0, W, 62, [[0, '#a97b4f'], [0.6, '#cda677'], [1, '#e2c495']]);
    A.grain(g, 0, 0, W, 62, 0.2, 'overlay', 2);
    g.fillStyle = OUT; g.fillRect(0, 58, W, 3);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 44, W, 3);
    for (let x = 14; x < W; x += 36) { g.fillStyle = 'rgba(80,50,30,0.3)'; g.fillRect(x, 8, 20, 9); g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(x, 8, 20, 2.5); }
    A.edge(g, 0, 62, W, 70, 't', 70, 'rgba(60,30,14,0.22)');
    // панели-цоколь: крашеное дерево с молдингом
    A.wood(g, 0, 440, W, 140, { base: P.green, seed: 13, dir: 'v', lineGap: 9, knots: false, grain: 0.16 });
    for (let x = 0; x < W; x += 132) {
      A.box(g, x + 16, 466, 100, 92, { fill: 'rgba(0,0,0,0.13)', lw: 2, stroke: 'rgba(20,40,36,0.85)' });
      g.fillStyle = 'rgba(190,230,210,0.14)'; g.fillRect(x + 18, 468, 96, 4); g.fillRect(x + 18, 468, 4, 88);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 18, 552, 96, 4);
    }
    A.box(g, -4, 432, W + 8, 16, { fill: P.woodLight, lw: 3, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.2)' });
    A.wood(g, -4, 432, W + 8, 16, { base: P.woodLight, seed: 3, knots: false, grain: 0.14 });
    g.fillStyle = OUT; g.fillRect(-4, 446, W + 8, 2.4);
    A.edge(g, 0, 448, W, 30, 't', 26, 'rgba(0,0,0,0.25)');
    // плинтус
    A.wood(g, 0, 564, W, 16, { base: '#3f2a1e', seed: 5, knots: false }); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 564, W, 3);
    // пол
    A.parquet(g, 0, 580, W, 140, { base: '#b57a45', plankH: 26, seed: 3 });
    A.gradV(g, 0, 580, W, 140, [[0, 'rgba(255,225,170,0.10)'], [1, 'rgba(30,10,10,0.4)']]);
    g.fillStyle = OUT; g.fillRect(0, 578, W, 3.5);
    A.edge(g, 0, 580, W, 22, 't', 22, 'rgba(30,14,8,0.34)');

    // ковровая дорожка перед стойкой и у двери
    const rug = (x0, x1) => {
      g.save(); g.beginPath(); g.moveTo(x0 + 30, 612); g.lineTo(x1 - 30, 612); g.lineTo(x1, 656); g.lineTo(x0, 656); g.closePath();
      g.fillStyle = A.linG(g, x0, 0, x1, 0, [[0, '#7a2432'], [0.5, '#96303f'], [1, '#7a2432']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.clip();
      A.grain(g, x0, 612, x1 - x0, 44, 0.22, 'overlay', 5);
      g.strokeStyle = '#d9a441'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 40, 619); g.lineTo(x1 - 40, 619); g.lineTo(x1 - 12, 649); g.lineTo(x0 + 12, 649); g.closePath(); g.stroke();
      g.fillStyle = 'rgba(217,164,65,0.6)'; for (let px = x0 + 70; px < x1 - 60; px += 46) { g.beginPath(); g.moveTo(px, 634); g.lineTo(px + 6, 640); g.lineTo(px, 646); g.lineTo(px - 6, 640); g.fill(); }
      g.restore();
    };
    rug(X.counter + 20, X.counter + X.counterW - 20);
    rug(X.door - 110, X.door + 250);

    // окна и лучи света
    for (const wx of [X.window1, X.window2]) {
      windowArch(g, wx, 150, 176, 268);
      curtain(g, wx - 102, 150, 300, 1); curtain(g, wx + 102, 150, 300, -1);
      A.beam(g, wx, 430, 170, wx + 170, 580, 230, 0.22);
      A.beam(g, wx, 430, 140, wx - 50, 580, 100, 0.10);
    }

    // дверь на улицу
    const dx = X.door, dy = 350, dw = 132, dh = 230;
    A.box(g, dx - dw / 2 - 12, dy - 14, dw + 24, dh + 14, { fill: '#5f3b28', lw: 4, hi: 'rgba(255,255,255,0.15)' });
    A.wood(g, dx - dw / 2 - 12, dy - 14, dw + 24, dh + 14, { base: '#5f3b28', seed: 21, dir: 'v', grain: 0.16, knots: false });
    A.box(g, dx - dw / 2, dy, dw, dh, { fill: '#8b5a3c', lw: 3 });
    A.wood(g, dx - dw / 2 + 1.5, dy + 1.5, dw - 3, dh - 3, { base: '#8b5a3c', seed: 22, dir: 'v', knots: false });
    g.save(); archPath(g, dx - 44, dy + 18, 88, 100); g.clip();
    A.gradV(g, dx - 44, dy + 18, 88, 100, [[0, '#a6d9ee'], [1, '#fff3d0']]);
    g.fillStyle = '#d9c3a0'; g.fillRect(dx - 44, dy + 90, 88, 30); g.fillStyle = '#b8a288'; g.fillRect(dx - 20, dy + 70, 26, 50);
    g.fillStyle = '#c8593a'; g.fillRect(dx + 8, dy + 60, 24, 30);
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(dx - 20, dy + 70, 26, 50); g.strokeRect(dx + 8, dy + 60, 24, 30);                     // у домов за дверью тот же контур, что у остального интерьера
    g.restore(); archPath(g, dx - 44, dy + 18, 88, 100); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(dx, dy + 18); g.lineTo(dx, dy + 118); g.moveTo(dx - 44, dy + 68); g.lineTo(dx + 44, dy + 68); g.stroke();
    A.box(g, dx - 44, dy + 138, 88, 72, { fill: 'rgba(0,0,0,0.14)', lw: 2.5 });
    g.fillStyle = P.brass; g.beginPath(); g.arc(dx + 46, dy + 130, 7, 0, 6.3); g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke();
    plate(g, dx, 300, 128, 44, 'POSTE', 27, '#2b4b8f', '#fff6e4');

    // картины и плакаты, часы, доска объявлений
    noticeBoard(g, X.bench - 74, 210, 150, 116);
    poster(g, X.poster - 50, 192, 100, 132, 'paris');
    poster(g, X.poster2 - 44, 200, 88, 118, 'monaco');
    poster(g, 865 - 44, 204, 88, 118, 'nice');                 // «галерея» афиш: над мешками и справа от шкафа (левее висит лампа)
    poster(g, X.cabinet + 112 - 44, 156, 88, 118, 'flights');
    wallClock(g, X.clock, 180, 40);

    // стена почтовых ящиков
    pigeonholes(g, X.mail, 236, 6, 4);

    // служебный выход справа
    const bx = X.backDoor, by = 340, bw = 138, bh = 240;
    A.box(g, bx - bw / 2 - 12, by - 14, bw + 24, bh + 14, { fill: '#3f5f57', lw: 4, hi: 'rgba(255,255,255,0.15)' });
    A.box(g, bx - bw / 2, by, bw, bh, { fill: '#4d7a6c', lw: 3 });
    A.wood(g, bx - bw / 2 + 1.5, by + 1.5, bw - 3, bh - 3, { base: '#4d7a6c', seed: 30, dir: 'v', knots: false, grain: 0.15 });
    A.box(g, bx - 46, by + 22, 92, 100, { fill: '#a6c9c0', lw: 3.5, hi: 'rgba(255,255,255,0.3)' });
    g.save(); g.beginPath(); g.rect(bx - 46, by + 22, 92, 100); g.clip(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(bx - 46, by + 122); g.lineTo(bx - 6, by + 22); g.lineTo(bx + 16, by + 22); g.lineTo(bx - 24, by + 122); g.fill(); g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(bx, by + 22); g.lineTo(bx, by + 122); g.stroke();
    A.box(g, bx - 46, by + 142, 92, 72, { fill: 'rgba(0,0,0,0.13)', lw: 2.5 });
    A.box(g, bx - 56, by + 132, 112, 12, { fill: '#c9c9d0', lw: 3, r: 5, hi: 'rgba(255,255,255,0.5)' });     // ручка-«антипаника»
    plate(g, bx, by - 34, 150, 32, 'SORTIE DE SERVICE', 12.5, '#2e8f5a', '#f6fff0');

    // мышиная норка в плинтусе
    mouseHole(g, X.mouse, 578);

    // лампы, растения
    pendantLamp(g, X.door + 240, 100); pendantLamp(g, X.clerk, 90); pendantLamp(g, X.mail + 130, 100); pendantLamp(g, X.cabinet, 104);
    plant(g, 44, 586, 0.95); plant(g, X.counter - 62, 586, 1.05); plant(g, X.cabinet - 132, 586, 0.9);
    // общее затемнение по краям комнаты
    A.edge(g, 0, 62, 90, 520, 'l', 90, 'rgba(30,14,10,0.30)'); A.edge(g, W - 90, 62, 90, 520, 'r', 90, 'rgba(30,14,10,0.30)');
  }

  // ---------------------------------------------------------------- стойка
  function counterFront(g, w, h) {
    A.wood(g, 0, 0, w, h, { base: '#7a4e33', seed: 17, dir: 'v', lineGap: 10, knots: false, grain: 0.15 });
    g.fillStyle = OUT; g.fillRect(0, 0, w, 3);
    const n = Math.floor(w / 100), pw = (w - 20) / n;
    for (let i = 0; i < n; i++) {
      const px = 10 + i * pw;
      A.box(g, px + 6, 26, pw - 12, h - 40, { fill: 'rgba(0,0,0,0.16)', lw: 2.5, stroke: 'rgba(43,26,32,0.85)' });
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px + 8, 28, pw - 16, 4); g.fillRect(px + 8, 28, 4, h - 44);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px + 8, h - 18, pw - 16, 4);
    }
  }

  Ale.PostArt = { P, drawRoom, windowArch, curtain, frame, plant, archPath, counterFront, tower, plate, poster, pendantLamp, noticeBoard };
})();
