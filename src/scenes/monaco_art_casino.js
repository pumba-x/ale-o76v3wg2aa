// Монако, зал казино (сцена monacoCasino, ширина 1700). Рисуется кодом в манере Парижа и Киева; общие кисти — Ale.MonacoArt.kit (monaco_art.js).
// Слева направо (мировые x): выход (X.exit: дверь со светом улицы и зелёной вывеской «SORTIE») → барная ниша с зеркальными полками и стойка с табуретами → стол блэкджека → бордовая стена с колоннами из мрамора →
// ТРИ АВТОМАТА (X.slotLeft, X.slotCrown, X.slotRight: у «своего» на табло золотая корона, как на красной фишке; у остальных — бубна и трефа), между ними зеркала и картина → стол рулетки с тяжёлыми шторами.
// Потолок с кессонами и пять хрустальных люстр, золотые бра на колоннах, красный ковёр с золотым узором и мраморный плинтус. Всё неподвижное собрано в слои (A.layer), живое — на кадр: огни рамки автомата,
// барабаны (покой, вращение, три короны), рычаг, фишка в приёмнике, пачка из лотка, свечение победы, блики на хрустале и пламя бра.
// Состояние автомата st = sc.slot = { stage: 'chipInBag' | 'chipInserted' | 'jackpot', lever 0…1, spin, glow 0…1, pack 0…1, insert 0…1 }: оформление читает его только у среднего («короны»); остальные — всегда в покое.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const MA = (Ale.MonacoArt = Ale.MonacoArt || {});
  const K = MA.kit;
  const { FY, WALL, TAU, dens, mix, lighter, darker, rgba, hash, guard, sprite, deco } = K;

  const GOLD = ['#fff2b0', '#f0c452', '#a8741a'];
  const MARB = ['#fbf3e2', '#eadfc8', '#bfae92'];
  const WOOD = ['#8a4c34', '#5e2e22', '#34170f'];
  const COLS = [190, 620, 910, 1210, 1510];                       // оси колонн
  const CHANDS = [525, 765, 1065, 1365, 1610];                    // люстры
  const HALL_H = 592;                                             // высота слоя стены (до пола)

  // =================================================================== общие кисти зала
  const gold = (g, y0, y1) => A.linG(g, 0, y0, 0, y1, [[0, GOLD[0]], [0.5, GOLD[1]], [1, GOLD[2]]]);
  // Форма рамы (прямоугольник со скруглением или арка) с отступом grow наружу; arch — полукруг сверху радиуса w/2 (y — верх арки)
  function framePath(g, x, y, w, h, arch, r, grow) {
    const x0 = x - grow, y0 = y - grow, x1 = x + w + grow, y1 = y + h + grow;
    if (arch) { const rr = (x1 - x0) / 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + rr); g.arc((x0 + x1) / 2, y0 + rr, rr, Math.PI, 0); g.lineTo(x1, y1); g.closePath(); }
    else A.rrPath(g, x0, y0, x1 - x0, y1 - y0, (r === undefined ? 8 : r) + grow * 0.3);
  }
  // Золочёная рама: наружный багет, тёмный жёлоб, светлый внутренний кант. Возвращает функцию формы (grow) для заливки содержимого
  function frame(g, x, y, w, h, o) {
    o = o || {};
    const shape = (grow) => framePath(g, x, y, w, h, o.arch, o.r, grow);
    shape(12); g.fillStyle = A.linG(g, x, y, x + w, y + h, [[0, GOLD[0]], [0.3, GOLD[1]], [0.65, GOLD[2]], [1, GOLD[1]]]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    shape(7); g.fillStyle = A.linG(g, x, y, x + w, y + h, [[0, '#a8741a'], [1, '#5a3a0a']]); g.fill();
    shape(3.6); g.fillStyle = A.linG(g, x, y, x + w, y + h, [[0, GOLD[0]], [0.5, GOLD[1]], [1, GOLD[2]]]); g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(60,30,6,0.85)'; g.stroke();
    // жемчужины по багету
    g.fillStyle = 'rgba(255,248,214,0.8)';
    if (!o.arch) { for (let px = x + 12; px < x + w - 8; px += 18) { g.beginPath(); g.arc(px, y - 9, 1.8, 0, TAU); g.arc(px, y + h + 9, 1.8, 0, TAU); g.fill(); } for (let py = y + 12; py < y + h - 8; py += 18) { g.beginPath(); g.arc(x - 9, py, 1.8, 0, TAU); g.arc(x + w + 9, py, 1.8, 0, TAU); g.fill(); } }
    shape(0); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    return shape;
  }
  // Зеркало: тёплое серебро, отражение зала (огни люстр, бордовая стена, зелёное сукно стола), косые блики
  function mirrorFill(g, shape, x, y, w, h, seed) {
    const R = A.rng(seed);
    g.save(); shape(0); g.clip();
    g.fillStyle = A.linG(g, x, y, x + w * 0.4, y + h, [[0, '#eaf0f2'], [0.45, '#b9c8cf'], [1, '#6f8590']]); g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle = A.linG(g, 0, y + h * 0.4, 0, y + h, [[0, 'rgba(122,32,50,0)'], [1, 'rgba(122,32,50,0.42)']]); g.fillRect(x, y + h * 0.4, w, h * 0.6);                    // отражение ковра и стены
    g.fillStyle = 'rgba(30,110,72,0.28)'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.86, w * 0.3, h * 0.035, 0, 0, TAU); g.fill();         // зелёное сукно
    for (let i = 0; i < 5; i++) A.glow(g, x + R.range(0.15, 0.85) * w, y + R.range(0.06, 0.4) * h, R.range(18, 34), 'rgba(255,224,160,', 0.55);      // огни люстр
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.beginPath(); g.moveTo(x + w * 0.08, y + h); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.54, y); g.lineTo(x + w * 0.22, y + h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(x + w * 0.5, y + h); g.lineTo(x + w * 0.72, y); g.lineTo(x + w * 0.78, y); g.lineTo(x + w * 0.56, y + h); g.closePath(); g.fill();
    A.edge(g, x, y, w, 18, 't', 18, 'rgba(50,24,16,0.42)'); A.edge(g, x, y, 14, h, 'l', 14, 'rgba(50,24,16,0.25)');
    g.restore();
  }
  // Картина: закат над гаванью Монако (небо, солнце и дорожка, скала с дворцом, яхты, холмы)
  function harborPainting(g, shape, x, y, w, h) {
    g.save(); shape(0); g.clip();
    g.fillStyle = A.linG(g, 0, y, 0, y + h, [[0, '#2f3f78'], [0.35, '#9a5a86'], [0.6, '#f7a070'], [0.72, '#ffd89a'], [0.73, '#3a6a96'], [1, '#183a5e']]); g.fillRect(x - 4, y - 4, w + 8, h + 8);
    const hy = y + h * 0.72;
    A.glow(g, x + w * 0.64, hy - 6, w * 0.5, 'rgba(255,226,160,', 0.7); g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(x + w * 0.64, hy - 12, w * 0.05, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,230,160,0.4)'; for (let i = 0; i < 9; i++) g.fillRect(x + w * 0.64 - 18 + i * 3, hy + 4 + i * (h * 0.027), 36 - i * 3, 2.4);                            // дорожка
    g.fillStyle = '#3b2a46'; g.beginPath(); g.moveTo(x, hy); g.lineTo(x, hy - h * 0.12); g.quadraticCurveTo(x + w * 0.1, hy - h * 0.2, x + w * 0.22, hy - h * 0.1); g.lineTo(x + w * 0.3, hy - h * 0.08); g.lineTo(x + w * 0.34, hy); g.closePath(); g.fill();            // скала
    g.fillStyle = '#5a4258'; g.fillRect(x + w * 0.1, hy - h * 0.22, w * 0.1, h * 0.06); g.fillRect(x + w * 0.12, hy - h * 0.28, w * 0.025, h * 0.07);
    g.fillStyle = '#2a2140'; for (const [bx, s] of [[0.42, 1], [0.8, 1.3], [0.9, 0.8]]) { g.beginPath(); g.moveTo(x + w * bx - 14 * s, hy + 4); g.lineTo(x + w * bx + 16 * s, hy + 4); g.lineTo(x + w * bx + 10 * s, hy - 3); g.lineTo(x + w * bx - 12 * s, hy - 3); g.fill(); g.fillRect(x + w * bx - 1, hy - 24 * s, 1.6, 22 * s); g.beginPath(); g.moveTo(x + w * bx, hy - 24 * s); g.lineTo(x + w * bx + 10 * s, hy - 5); g.lineTo(x + w * bx, hy - 5); g.fill(); }
    g.fillStyle = '#2a1e3c'; g.beginPath(); g.moveTo(x + w, hy); g.lineTo(x + w, hy - h * 0.1); g.quadraticCurveTo(x + w * 0.86, hy - h * 0.14, x + w * 0.74, hy); g.closePath(); g.fill();
    A.edge(g, x, y, w, h, 'b', 30, 'rgba(10,6,24,0.35)');
    g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.moveTo(x + w * 0.1, y + h); g.lineTo(x + w * 0.4, y); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.2, y + h); g.fill();
    g.restore();
  }
  // Узор штофных обоев: бордовый фон, тиснёные лепестки и точки
  function damask(g, x0, y0, w, h) {
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.fillStyle = A.linG(g, 0, y0, 0, y0 + h, [[0, '#5e1628'], [0.35, '#86223a'], [0.75, '#7a1f33'], [1, '#601428']]); g.fillRect(x0, y0, w, h);
    const R = A.rng(5);
    for (let row = 0, cy = y0 + 38; cy < y0 + h + 40; row++, cy += 76) for (let cx = x0 + (row % 2) * 30 + 30; cx < x0 + w + 40; cx += 60) {
      g.save(); g.translate(cx, cy);
      g.beginPath(); g.moveTo(0, -30); g.bezierCurveTo(11, -22, 19, -11, 13, 0); g.bezierCurveTo(19, 12, 9, 23, 0, 31); g.bezierCurveTo(-9, 23, -19, 12, -13, 0); g.bezierCurveTo(-19, -11, -11, -22, 0, -30); g.closePath();
      g.fillStyle = 'rgba(255,150,140,0.12)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(30,0,10,0.22)'; g.stroke();
      g.beginPath(); g.ellipse(0, 0, 4, 9, 0, 0, TAU); g.fillStyle = 'rgba(255,214,160,0.2)'; g.fill();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 13, 0); g.quadraticCurveTo(s * 26, -6, s * 24, -18); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,200,160,0.2)'; g.stroke(); }
      g.fillStyle = 'rgba(240,196,82,0.45)'; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.arc(0, -22, 1.2, 0, TAU); g.arc(0, 22, 1.2, 0, TAU); g.fill();
      g.restore();
    }
    A.grain(g, x0, y0, w, h, 0.15, 'overlay', 7, 0.6);
    A.blotches(g, x0, y0, w, h, Math.round(w * h / 60000), 9, 'rgba(30,0,10,', 'rgba(255,170,150,');
    g.restore();
  }
  // Панели цоколя: тёмный орех, обрамлённые золотой тягой, дубовый поручень и плинтус
  function wainscot(g, x0, y0, w, h) {
    g.fillStyle = A.linG(g, 0, y0, 0, y0 + h, [[0, WOOD[1]], [1, WOOD[2]]]); g.fillRect(x0, y0, w, h);
    const R = A.rng(8);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    for (let x = x0 + 8; x < x0 + w; x += 124) {
      const px = x, py = y0 + 22, pw = 108, ph = h - 46;
      g.fillStyle = A.linG(g, 0, py, 0, py + ph, [[0, '#6e3a2a'], [1, '#4a2418']]); g.fillRect(px, py, pw, ph);
      g.strokeStyle = 'rgba(255,200,150,0.14)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const ly = py + 5 + i * (ph - 10) / 8; g.beginPath(); g.moveTo(px + 3, ly + R.range(-1.5, 1.5)); g.lineTo(px + pw - 3, ly + R.range(-1.5, 1.5)); g.stroke(); }
      g.fillStyle = 'rgba(255,214,160,0.2)'; g.fillRect(px, py, pw, 3); g.fillRect(px, py, 3, ph); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py + ph - 3, pw, 3); g.fillRect(px + pw - 3, py, 3, ph);
      g.strokeStyle = 'rgba(240,196,82,0.8)'; g.lineWidth = 1.6; g.strokeRect(px - 3, py - 3, pw + 6, ph + 6);
    }
    g.restore();
    A.box(g, x0, y0, w, 16, { fill: A.linG(g, 0, y0, 0, y0 + 16, [[0, '#a8643e'], [1, '#6a3a22']]), lw: 2.4, hi: 'rgba(255,230,190,0.4)' });
    g.fillStyle = gold(g, y0 + 5, y0 + 9); g.fillRect(x0, y0 + 4, w, 3);
    A.box(g, x0, y0 + h - 20, w, 20, { fill: A.linG(g, 0, y0 + h - 20, 0, y0 + h, [[0, '#4a2418'], [1, '#2a120c']]), lw: 2.4 });
    g.fillStyle = gold(g, y0 + h - 15, y0 + h - 12); g.fillRect(x0, y0 + h - 15, w, 2.4);
  }
  // Потолок: тёмные кессоны с золотым багетом и розетками
  function ceiling(g, W) {
    g.fillStyle = A.linG(g, 0, 0, 0, 76, [[0, '#160a12'], [1, '#34162a']]); g.fillRect(0, 0, W, 76);
    for (let x = 0; x < W; x += 212) {
      const cx = x + 106;
      g.fillStyle = '#220f1a'; g.fillRect(x + 12, 8, 188, 54);
      g.strokeStyle = rgba(GOLD[1], 0.9); g.lineWidth = 2.2; g.strokeRect(x + 12, 8, 188, 54); g.strokeStyle = rgba(GOLD[2], 0.8); g.lineWidth = 1.2; g.strokeRect(x + 20, 15, 172, 40);
      g.fillStyle = 'rgba(255,214,140,0.09)'; g.fillRect(x + 20, 15, 172, 7);
      g.fillStyle = gold(g, 22, 50); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.beginPath(); g.ellipse(cx + Math.cos(a) * 9, 35 + Math.sin(a) * 9, 4.4, 2.6, a, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(cx, 35, 4.6, 0, TAU); g.fillStyle = '#e04a3c'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
    }
  }
  // Карниз: золотой багет с яйцом-и-стрелкой и зубчиками
  function cornice(g, W, y) {
    g.fillStyle = gold(g, y, y + 34); g.fillRect(0, y, W, 34); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, y + 1, W, 3);
    g.fillStyle = 'rgba(80,44,10,0.45)'; for (let x = 4; x < W; x += 16) { g.beginPath(); g.ellipse(x + 6, y + 13, 4, 6.4, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(80,44,10,0.55)'; for (let x = 3; x < W; x += 12) g.fillRect(x, y + 24, 6, 8);
    g.fillStyle = 'rgba(255,248,210,0.5)'; for (let x = 3; x < W; x += 12) g.fillRect(x, y + 24, 1.6, 8);
    g.fillStyle = OUT; g.fillRect(0, y + 33, W, 2.6); g.fillRect(0, y - 1, W, 2);
    A.edge(g, 0, y + 35, W, 30, 't', 30, 'rgba(24,0,8,0.45)');
  }
  // Бра на стене: латунная подложка, изогнутый рожок, матовый тюльпан
  function sconce(g, cx, cy) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.ellipse(cx, cy + 12, 9, 15, 0, 0, TAU); g.fillStyle = gold(g, cy - 4, cy + 28); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy + 6); g.quadraticCurveTo(cx + 18, cy + 4, cx + 18, cy - 12); g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#f4ecd4'; g.fillRect(cx + 14, cy - 22, 8, 12); g.lineWidth = 1.6; g.strokeStyle = OUT; g.strokeRect(cx + 14, cy - 22, 8, 12);
    g.beginPath(); g.moveTo(cx + 18, cy - 20); g.bezierCurveTo(cx + 2, cy - 30, cx + 6, cy - 54, cx + 18, cy - 54); g.bezierCurveTo(cx + 30, cy - 54, cx + 34, cy - 30, cx + 18, cy - 20); g.closePath();
    g.fillStyle = A.linG(g, 0, cy - 54, 0, cy - 20, [[0, '#fffbe6'], [1, '#ffe4a0']]); g.fill(); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(cx + 12, cy - 42, 3, 8, -0.2, 0, TAU); g.fill();
  }
  // Тяжёлая бархатная штора с подхватом: сверху широкая, у подхвата узкая, ниже расходится складками. side = +1 — свисает вправо от оси xw, −1 — влево
  function drape(g, xw, side, y0, y1, W0, tie) {
    const ty = y0 + (y1 - y0) * 0.56, wid = (t) => { const d = (y) => Math.abs(y - ty); const y = y0 + (y1 - y0) * t; return W0 * (0.34 + 0.66 * Math.min(1, d(y) / ((y1 - y0) * 0.5))) * (t > 0.56 ? 1.15 : 1); };
    const pts = []; for (let i = 0; i <= 28; i++) { const t = i / 28; pts.push([wid(t), y0 + (y1 - y0) * t, t]); }
    g.beginPath(); g.moveTo(xw, y0);
    for (const [w, y] of pts) g.lineTo(xw + side * w, y);
    g.lineTo(xw, y1); g.closePath();
    g.fillStyle = A.linG(g, xw, 0, xw + side * W0, 0, side > 0 ? [[0, '#5a1022'], [0.5, '#8c1f38'], [1, '#c43a52']] : [[0, '#c43a52'], [0.5, '#8c1f38'], [1, '#5a1022']]); g.fill();
    g.save(); g.clip();
    for (let k = 1; k < 6; k++) { const u = k / 6; g.beginPath(); for (let i = 0; i <= 28; i++) { const [w, y] = pts[i]; if (i) g.lineTo(xw + side * w * u + Math.sin(i * 0.5 + k) * 1.4, y); else g.moveTo(xw + side * w * u, y); } g.strokeStyle = k % 2 ? 'rgba(30,0,10,0.34)' : 'rgba(255,170,170,0.2)'; g.lineWidth = 2.4; g.stroke(); }
    A.edge(g, Math.min(xw, xw + side * W0), y0, W0, 40, 't', 40, 'rgba(20,0,6,0.5)');
    g.restore();
    g.lineWidth = 2.6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.beginPath(); g.moveTo(xw, y0); for (const [w, y] of pts) g.lineTo(xw + side * w, y); g.lineTo(xw, y1); g.stroke();
    // золотой шнур-подхват и кисть
    const tx = xw + side * wid((ty - y0) / (y1 - y0)) * 0.5;
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(xw, ty - 6); g.quadraticCurveTo(tx, ty + 6, xw + side * wid((ty - y0) / (y1 - y0)) + side * 2, ty - 4); g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 3.6; g.stroke();
    const kx = xw + side * wid((ty - y0) / (y1 - y0)) * 0.5; g.fillStyle = gold(g, ty, ty + 30); g.beginPath(); g.arc(kx, ty + 6, 4.4, 0, TAU); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(kx - 4, ty + 9); g.lineTo(kx - 6, ty + 28); g.lineTo(kx + 6, ty + 28); g.lineTo(kx + 4, ty + 9); g.closePath(); g.fill(); g.stroke();
  }
  // Ламбрекен над проёмом: золотая тесьма и волнистая бархатная кайма
  function valance(g, x0, x1, y) {
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); for (let i = 0; i <= 8; i++) { const x = x1 - i * (x1 - x0) / 8; g.quadraticCurveTo(x + (x1 - x0) / 16, y + 34 + (i % 2) * 6, x, y + 12); }
    g.closePath(); g.fillStyle = A.linG(g, 0, y, 0, y + 40, [[0, '#7a1a2e'], [1, '#a42c42']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = gold(g, y, y + 9); g.fillRect(x0, y, x1 - x0, 9); g.lineWidth = 2; g.strokeRect(x0, y, x1 - x0, 9);
  }

  // =================================================================== бутылки и барная ниша
  function bottle(g, x, base, h, w, col, kind) {
    const nk = h * 0.28, bw = w / 2;
    g.beginPath(); g.moveTo(x - bw, base); g.lineTo(x - bw, base - h + nk + 5); g.quadraticCurveTo(x - bw, base - h + nk, x - bw * 0.4, base - h + nk - 2); g.lineTo(x - bw * 0.36, base - h + 3); g.lineTo(x + bw * 0.36, base - h + 3); g.lineTo(x + bw * 0.4, base - h + nk - 2); g.quadraticCurveTo(x + bw, base - h + nk, x + bw, base - h + nk + 5); g.lineTo(x + bw, base); g.closePath();
    g.fillStyle = A.linG(g, x - bw, 0, x + bw, 0, [[0, lighter(col, 0.3)], [0.4, col], [1, darker(col, 0.4)]]); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = kind === 'champ' ? '#e8c04a' : '#f6efe0'; g.fillRect(x - bw + 1, base - h * 0.5, w - 2, h * 0.22);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - bw + 2, base - h + nk + 4, 2, h * 0.5);
    g.fillStyle = kind === 'champ' ? '#e8c04a' : '#2a1a20'; g.fillRect(x - bw * 0.4, base - h, bw * 0.8, 6);
  }
  function barNiche(g, x0, x1, top, bot) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const shape = frame(g, x0, top, w, bot - top, { arch: true });
    g.save(); shape(0); g.clip();
    g.fillStyle = A.linG(g, 0, top, 0, bot, [[0, '#ddc8a8'], [1, '#a88c6c']]); g.fillRect(x0, top, w, bot - top);                                  // зеркальная задняя стенка
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(x0 + w * 0.12, bot); g.lineTo(x0 + w * 0.34, top); g.lineTo(x0 + w * 0.44, top); g.lineTo(x0 + w * 0.22, bot); g.fill();
    const R = A.rng(12), COLS_B = ['#b8741e', '#2f7a4a', '#c8d6e0', '#7a1f2e', '#d2a42a', '#2a5a9a', '#e8e0cc'];
    for (const [sy, hh] of [[bot - 214, 56], [bot - 140, 62], [bot - 70, 58]]) {
      A.glow(g, cx, sy - 8, w * 0.55, 'rgba(255,214,140,', 0.3);
      for (let x = x0 + 16; x < x1 - 14; x += R.range(17, 24)) bottle(g, x, sy, hh * R.range(0.8, 1.1), R.range(11, 16), R.pick(COLS_B), R.chance(0.2) ? 'champ' : 'x');
      g.fillStyle = A.linG(g, 0, sy, 0, sy + 7, [[0, 'rgba(255,255,255,0.7)'], [1, 'rgba(160,200,200,0.6)']]); g.fillRect(x0, sy, w, 7); g.fillStyle = gold(g, sy + 7, sy + 11); g.fillRect(x0, sy + 7, w, 3); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(x0, sy, w, 10);       // стеклянная полка
    }
    A.edge(g, x0, top, w, 20, 't', 20, 'rgba(50,24,16,0.4)');
    g.restore();
    // вывеска над нишей
    A.box(g, cx - 38, top - 52, 76, 28, { fill: A.linG(g, 0, top - 52, 0, top - 24, [[0, '#1c4a44'], [1, '#0e2e2c']]), lw: 2.6, r: 4 });
    K.goldText(g, 'BAR', cx, top - 38, 22, { spacing: 7, font: Ale.FONT });
  }

  // =================================================================== стена зала
  function hallWall(g, W) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    ceiling(g, W);
    damask(g, 0, 70, W, 400);
    wainscot(g, 0, 470, W, 122);
    cornice(g, W, 70);
    // бра-тёплые пятна на стене и колонны
    for (const cx of COLS) { A.glow(g, cx, 330, 120, 'rgba(255,214,140,', 0.14); }
    // ---- пролёты
    // выход: мраморное обрамление и рельефные пилястры
    // барная ниша
    barNiche(g, 224, 470, 172, 476);
    // арочное зеркало над столом блэкджека
    { const x = 506, y = 196, w = 88, h = 150; const sh = frame(g, x, y, w, h, { arch: true }); mirrorFill(g, sh, x, y, w, h, 2); }
    // зеркала и картина над автоматами
    { const x = 665, y = 140, w = 200, h = 196; const sh = frame(g, x, y, w, h, { r: 16 }); mirrorFill(g, sh, x, y, w, h, 3); }
    { const x = 945, y = 150, w = 230, h = 180; const sh = frame(g, x, y, w, h, { r: 6 }); harborPainting(g, sh, x, y, w, h); }
    { const x = 1265, y = 140, w = 200, h = 196; const sh = frame(g, x, y, w, h, { r: 16 }); mirrorFill(g, sh, x, y, w, h, 4); }
    // картина в правой нише (над рулеткой): овальное зеркало
    { const x = 1556, y = 150, w = 120, h = 190; const sh = frame(g, x, y, w, h, { arch: true }); mirrorFill(g, sh, x, y, w, h, 6); }
    // колонны
    for (const cx of COLS) {
      g.fillStyle = 'rgba(24,0,8,0.28)'; g.fillRect(cx + 20, 104, 26, 480); A.edge(g, cx + 20, 104, 26, 480, 'l', 26, 'rgba(24,0,8,0.32)');
      K.column(g, cx, 104, 584, 44, { pal: MARB, cap: GOLD[1], veins: 'rgba(120,90,70,0.2)' });
    }
    for (const cx of [14, W - 14]) K.column(g, cx, 104, 584, 40, { pal: MARB, cap: GOLD[1], veins: 'rgba(120,90,70,0.2)' });
    // бра на колоннах
    for (const cx of COLS.slice(1)) sconce(g, cx, 338);
    // шторы у правого проёма и ламбрекен
    drape(g, W - 36, -1, 108, 584, 52);
    valance(g, 1530, W - 8, 100);
    // общий тёплый свет под люстрами
    for (const cx of CHANDS) A.glow(g, cx, 130, 300, 'rgba(255,214,140,', 0.16);
    A.edge(g, 0, 70, W, 520, 'b', 80, 'rgba(24,0,8,0.28)');
  }

  // =================================================================== пол
  function hallFloor(WIDTH) {
    const SH = 0.36;
    return A.layer(WIDTH, 720 - WALL + 12, (g, w, h) => {
      const R = A.rng(23), y0 = 13, hh = h - y0;
      g.save(); g.beginPath(); g.rect(0, y0, w, hh); g.clip(); g.transform(1, 0, SH, 1, -SH * y0, 0);
      const xa = -SH * h - 30, xb = w + 30;
      g.fillStyle = A.linG(g, 0, y0, 0, y0 + hh, [[0, '#7c1c30'], [0.5, '#8a2236'], [1, '#6c1628']]); g.fillRect(xa, y0, xb - xa, hh);
      let rh = 14, y = y0;
      for (let row = 0; y < y0 + hh; row++) {
        const rhh = Math.min(rh, y0 + hh - y), pw = 64 + row * 6;
        for (let x = xa - (row % 2) * pw / 2; x < xb; x += pw) {
          const cx = x + pw / 2, cy = y + rhh / 2;
          g.fillStyle = 'rgba(240,196,82,0.2)'; g.beginPath(); g.moveTo(cx, cy - rhh * 0.44); g.lineTo(cx + pw * 0.3, cy); g.lineTo(cx, cy + rhh * 0.44); g.lineTo(cx - pw * 0.3, cy); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(240,196,82,0.36)'; g.lineWidth = 1.2; g.stroke();
          g.fillStyle = 'rgba(240,196,82,0.5)'; g.beginPath(); g.ellipse(cx, cy, pw * 0.05, rhh * 0.14, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(20,0,8,0.1)'; g.fillRect(x, y, 1.4, rhh);
        }
        g.fillStyle = 'rgba(20,0,8,0.12)'; g.fillRect(xa, y, xb - xa, 1.4);
        y += rhh; rh += 2.4;
      }
      // золотая кайма вдоль дальнего края
      g.fillStyle = '#d8b24a'; g.fillRect(xa, y0 + 8, xb - xa, 3.4); g.fillStyle = 'rgba(255,248,200,0.6)'; g.fillRect(xa, y0 + 8, xb - xa, 1.2); g.fillStyle = 'rgba(20,0,8,0.5)'; g.fillRect(xa, y0 + 11.4, xb - xa, 1.6);
      g.restore();
      for (const cx of CHANDS) { g.save(); g.translate(cx, 60); g.scale(1, 0.22); A.glow(g, 0, 0, 220, 'rgba(255,214,140,', 0.24); g.restore(); }       // пятна света от люстр
      g.save(); g.translate(90, 56); g.scale(1, 0.22); A.glow(g, 0, 0, 120, 'rgba(255,240,200,', 0.34); g.restore();                                      // дневной свет от выхода
      A.gradV(g, 0, 13, w, h - 13, [[0, 'rgba(40,0,10,0.34)'], [0.2, 'rgba(40,0,10,0)'], [1, 'rgba(255,214,160,0.06)']]);
      A.grain(g, 0, y0, w, hh, 0.16, 'overlay', 23, 0.55);
      // мраморный плинтус
      A.gradV(g, 0, 0, w, 14, [[0, '#3a2a30'], [0.5, '#241418'], [1, '#150a0e']]);
      g.fillStyle = gold(g, 1, 4); g.fillRect(0, 1, w, 2.6); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 5, w, 1.6);
      g.fillStyle = OUT; g.fillRect(0, 13, w, 2);
    }, dens(1.5));
  }

  // =================================================================== люстра, стойка, столы, дверь
  // Люстра: цепь, колпак, три яруса колец со свечами-лампами и хрустальными подвесками. Опора — точка крепления к потолку (0, 0); высота ≈ 190
  function chandelier(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (let y = 0; y < 50; y += 9) { g.beginPath(); g.ellipse(0, y + 4, 3.2, 5.2, 0, 0, TAU); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = GOLD[1]; g.stroke(); }
    g.beginPath(); g.moveTo(-9, 52); g.quadraticCurveTo(0, 40, 9, 52); g.lineTo(20, 70); g.lineTo(-20, 70); g.closePath(); g.fillStyle = gold(g, 40, 70); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    A.box(g, -4.6, 70, 9.2, 66, { fill: A.linG(g, -5, 0, 5, 0, [[0, GOLD[0]], [0.5, GOLD[1]], [1, GOLD[2]]]), lw: 2.4 });
    const tiers = [{ rx: 86, ry: 15, y: 84, n: 9 }, { rx: 62, ry: 11, y: 110, n: 7 }, { rx: 38, ry: 7, y: 132, n: 5 }];
    const R = A.rng(61);
    for (const T of tiers) {
      // дальняя половина кольца и лампы
      const ring = (a0, a1, lw) => { g.beginPath(); g.ellipse(0, T.y, T.rx, T.ry, 0, a0, a1); g.lineWidth = lw; };
      const lamps = (front) => { for (let k = 0; k < T.n; k++) { const a = k * TAU / T.n + 0.3; const isFront = Math.sin(a) > 0; if (isFront !== front) continue; const lx = Math.cos(a) * T.rx, ly = T.y + Math.sin(a) * T.ry;
        g.fillStyle = '#fbf3dc'; g.fillRect(lx - 2.6, ly - 14, 5.2, 14); g.lineWidth = 1.4; g.strokeStyle = OUT; g.strokeRect(lx - 2.6, ly - 14, 5.2, 14);
        g.beginPath(); g.moveTo(lx - 3.4, ly - 14); g.quadraticCurveTo(lx, ly - 30, lx + 3.4, ly - 14); g.closePath(); g.fillStyle = A.linG(g, 0, ly - 28, 0, ly - 14, [[0, '#fffbe0'], [1, '#ffd870']]); g.fill(); g.lineWidth = 1.2; g.stroke(); } };
      ring(Math.PI, TAU, 8); g.strokeStyle = OUT; g.stroke(); ring(Math.PI, TAU, 4.4); g.strokeStyle = GOLD[1]; g.stroke();
      lamps(false);
      for (const sgn of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(sgn * 3, T.y - 24); g.quadraticCurveTo(sgn * T.rx * 0.5, T.y - 30, sgn * T.rx, T.y); g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 2.8; g.stroke(); }
      ring(0, Math.PI, 8); g.strokeStyle = OUT; g.stroke(); ring(0, Math.PI, 4.4); g.strokeStyle = gold(g, T.y, T.y + T.ry); g.stroke();
      lamps(true);
      // подвески по передней дуге
      const m = Math.round(T.rx / 7);
      for (let k = 0; k <= m; k++) {
        const a = k * Math.PI / m, px = Math.cos(a) * T.rx, py = T.y + Math.sin(a) * T.ry + 2, L = (k % 2 ? 13 : 22) * (T.rx / 70 + 0.5) * R.range(0.9, 1.1);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - 3.4, py + L * 0.55); g.quadraticCurveTo(px, py + L * 1.05, px + 3.4, py + L * 0.55); g.closePath();
        g.fillStyle = A.linG(g, px - 3, py, px + 3, py + L, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(176,214,246,0.85)']]); g.fill(); g.lineWidth = 1.1; g.strokeStyle = 'rgba(60,76,120,0.8)'; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(px - 0.8, py + L * 0.2, 1.4, L * 0.3);
      }
    }
    g.beginPath(); g.moveTo(-6, 136); g.lineTo(6, 136); g.lineTo(8, 150); g.quadraticCurveTo(0, 190, -8, 150); g.closePath(); g.fillStyle = A.linG(g, -6, 136, 6, 190, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(160,206,244,0.9)']]); g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(60,76,120,0.85)'; g.stroke();
  }
  // Стойка бара: тёмный орех, золотой кант, мраморная столешница, латунная подножка; на столешнице бокалы. Начало — середина основания
  function barCounter(g, w) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const hw = w / 2;
    A.shadow(g, 4, 3, hw + 20, 0.3);
    A.box(g, -hw, -100, w, 100, { fill: A.linG(g, 0, -100, 0, 0, [[0, WOOD[0]], [1, WOOD[2]]]), lw: 3.2 });
    for (let x = -hw + 12; x < hw - 40; x += 56) {
      g.fillStyle = A.linG(g, 0, -88, 0, -22, [[0, '#6e3a2a'], [1, '#3e1c12']]); g.fillRect(x, -88, 46, 60); g.fillStyle = 'rgba(255,214,160,0.2)'; g.fillRect(x, -88, 46, 3); g.strokeStyle = 'rgba(240,196,82,0.85)'; g.lineWidth = 1.6; g.strokeRect(x - 2.4, -90, 50.8, 64.8);
    }
    g.fillStyle = gold(g, -12, -6); g.fillRect(-hw, -16, w, 3.4); g.strokeStyle = OUT; g.lineWidth = 1.4; g.strokeRect(-hw, -16, w, 3.4);
    A.box(g, -hw - 12, -112, w + 24, 13, { fill: A.linG(g, 0, -112, 0, -99, [[0, MARB[0]], [1, MARB[2]]]), lw: 3, hi: 'rgba(255,255,255,0.7)' });
    g.strokeStyle = 'rgba(150,120,90,0.4)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-hw + i * w / 6 + 6, -111); g.lineTo(-hw + i * w / 6 + 30, -100); g.stroke(); }
    g.fillStyle = gold(g, -100, -96); g.fillRect(-hw - 12, -99, w + 24, 3);
    // на столешнице: два бокала и бутылка шампанского в ведёрке
    for (const gx of [-hw * 0.5, -hw * 0.1]) { g.beginPath(); g.moveTo(gx - 8, -140); g.lineTo(gx + 8, -140); g.lineTo(gx + 1.6, -122); g.lineTo(gx + 1.6, -114); g.lineTo(gx + 7, -113); g.lineTo(gx - 7, -113); g.lineTo(gx - 1.6, -114); g.lineTo(gx - 1.6, -122); g.closePath(); g.fillStyle = 'rgba(220,240,250,0.8)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(240,190,70,0.8)'; g.beginPath(); g.moveTo(gx - 6.4, -137); g.lineTo(gx + 6.4, -137); g.lineTo(gx + 1.2, -124); g.lineTo(gx - 1.2, -124); g.closePath(); g.fill(); }
    const bx = hw * 0.52;
    g.beginPath(); g.moveTo(bx - 16, -112); g.lineTo(bx + 16, -112); g.lineTo(bx + 13, -146); g.lineTo(bx - 13, -146); g.closePath(); g.fillStyle = A.linG(g, bx - 16, 0, bx + 16, 0, [[0, '#e0e6ee'], [0.5, '#c4ccd8'], [1, '#8d97a8']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    bottle(g, bx, -134, 56, 14, '#2f5a3c', 'champ');
    // табуреты
    for (const sx of [-hw * 0.62, -hw * 0.2, hw * 0.22, hw * 0.64]) {
      A.shadow(g, sx, 14, 20, 0.28);
      g.strokeStyle = OUT; g.lineWidth = 7.4; g.beginPath(); g.moveTo(sx, 12); g.lineTo(sx, -34); g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 3.6; g.stroke();
      g.beginPath(); g.ellipse(sx, 12, 17, 5, 0, 0, TAU); g.fillStyle = gold(g, 8, 17); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = GOLD[1]; g.lineWidth = 3; g.beginPath(); g.ellipse(sx, -6, 12, 3.4, 0, 0, TAU); g.stroke();
      g.fillStyle = A.linG(g, sx - 18, 0, sx + 18, 0, [[0, '#d83a52'], [0.5, '#a42c42'], [1, '#6a1426']]); g.beginPath(); g.moveTo(sx - 18, -34); g.lineTo(sx - 16, -48); g.quadraticCurveTo(sx, -54, sx + 16, -48); g.lineTo(sx + 18, -34); g.quadraticCurveTo(sx, -28, sx - 18, -34); g.closePath(); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(sx - 5, -45, 7, 2.4, -0.1, 0, TAU); g.fill();
    }
  }
  // Стол рулетки (спереди): тёмная ножка-тумба, мягкий бортик, зелёное сукно с разметкой, колесо, фишки
  function rouletteTable(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 6, 4, 126, 0.3);
    A.box(g, -96, -62, 192, 62, { fill: A.linG(g, 0, -62, 0, 0, [[0, WOOD[0]], [1, WOOD[2]]]), lw: 3.2 });
    for (const px of [-82, 14]) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px, -54, 66, 40); g.strokeStyle = 'rgba(240,196,82,0.85)'; g.lineWidth = 1.6; g.strokeRect(px, -54, 66, 40); }
    g.fillStyle = gold(g, -14, -8); g.fillRect(-96, -14, 192, 3);
    A.box(g, -104, -76, 208, 16, { fill: A.linG(g, 0, -76, 0, -60, [[0, '#4a2018'], [1, '#2a1010']]), lw: 3.2, r: 6, hi: 'rgba(255,214,170,0.4)' });                                                         // мягкий бортик
    const felt = () => { g.beginPath(); g.moveTo(-92, -76); g.lineTo(-64, -102); g.lineTo(84, -102); g.lineTo(100, -76); g.closePath(); };
    felt(); g.fillStyle = A.linG(g, 0, -102, 0, -76, [[0, '#1c7a4c'], [1, '#0e5a38']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.save(); felt(); g.clip();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { g.fillStyle = (c + r) % 3 === 1 ? '#222' : '#c8323c'; if (c === 0 && r === 1) g.fillStyle = '#148a50'; g.fillRect(-12 + c * 8.4 - r * 3.4, -98 + r * 6.6, 7, 5.6); }
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.strokeRect(-14, -99, 104, 21);
    // колесо: деревянная чаша, цветные сектора, золотой конус
    g.restore();
    const wx = -52, wy = -90;
    g.beginPath(); g.ellipse(wx, wy, 31, 11, 0, 0, TAU); g.fillStyle = A.linG(g, 0, wy - 11, 0, wy + 11, [[0, '#a8643e'], [1, '#5a2e1c']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    for (let k = 0; k < 20; k++) { const a0 = k * TAU / 20, a1 = (k + 1) * TAU / 20; g.beginPath(); g.moveTo(wx, wy); g.ellipse(wx, wy, 24, 8, 0, a0, a1); g.closePath(); g.fillStyle = k === 0 ? '#148a50' : k % 2 ? '#c8323c' : '#1c1618'; g.fill(); }
    g.beginPath(); g.ellipse(wx, wy, 11, 3.8, 0, 0, TAU); g.fillStyle = '#d8b24a'; g.fill(); g.lineWidth = 1.2; g.stroke(); g.beginPath(); g.arc(wx, wy - 4, 2.6, 0, TAU); g.fillStyle = GOLD[0]; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(wx - 10, wy - 4, 8, 2, -0.2, 0, TAU); g.fill();
    // фишки
    for (const [cx, cy, col, n] of [[8, -86, '#c8323c', 4], [22, -84, '#2a5a9a', 3], [64, -90, '#1c1618', 5], [74, -88, '#f4efe0', 3]]) for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? lighter(col, 0.2) : col; g.beginPath(); g.ellipse(cx, cy - i * 2.2, 5.4, 1.9, 0, 0, TAU); g.fill(); g.lineWidth = 0.9; g.strokeStyle = OUT; g.stroke(); }
  }
  // Крупье за столом рулетки (стоит за сукном, ниже пояса его закрывает стол): чёрный жилет, белая рубашка, красная бабочка, зализанные волосы и усики;
  // правая рука открытой ладонью приглашает к столу, левая лежит на сукне. Запасная фигура кодом (владелец 03.10.2026: «нас зовут»): с 04.10.2026 крупье нарисован (кадры crp_*, drawCroupier ниже),
  // эта рисуется, только если кадров нет в сборке.
  function croupierFigure(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const skin = A.linG(g, 0, -214, 0, -178, [[0, '#f4c9a0'], [1, '#d99a72']]);
    const limb = (pts, w, col) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.strokeStyle = OUT; g.lineWidth = w + 4.4; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
    // низ (скрыт столом): брюки
    g.fillStyle = '#1b1416'; g.fillRect(-17, -118, 34, 62);
    // левая рука (у зрителя слева): на сукне
    limb([[-25, -168], [-35, -142], [-30, -112]], 12, '#f3efe6');
    g.beginPath(); g.ellipse(-30, -108, 6.4, 5, 0.2, 0, TAU); g.fillStyle = skin; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
    // жилет и рубашка
    g.beginPath(); g.moveTo(-27, -170); g.quadraticCurveTo(0, -178, 27, -170); g.lineTo(23, -112); g.lineTo(-23, -112); g.closePath();
    g.fillStyle = A.linG(g, -27, 0, 27, 0, [[0, '#2a2226'], [0.5, '#16110f'], [1, '#2a2226']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(-10, -173); g.lineTo(10, -173); g.lineTo(0, -128); g.closePath(); g.fillStyle = '#f7f2e8'; g.fill(); g.lineWidth = 1.8; g.stroke();
    g.fillStyle = gold(g, -150, -122); for (const by of [-148, -138, -128]) { g.beginPath(); g.arc(0, by + 0, 1.8, 0, TAU); g.fill(); }
    g.fillStyle = gold(g, -160, -154); g.fillRect(-20, -160, 8, 5); g.lineWidth = 1; g.strokeStyle = OUT; g.strokeRect(-20, -160, 8, 5);               // нагрудная табличка без надписи
    // правая рука: приглашающий жест
    limb([[25, -168], [43, -150], [54, -170]], 12, '#f3efe6');
    g.beginPath(); g.ellipse(56, -176, 6, 8, -0.5, 0, TAU); g.fillStyle = skin; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
    // шея, голова
    g.fillStyle = '#d99a72'; g.fillRect(-5, -184, 10, 12);
    g.beginPath(); g.ellipse(0, -198, 15.5, 18, 0, 0, TAU); g.fillStyle = skin; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    for (const ex of [-15, 15]) { g.beginPath(); g.ellipse(ex, -197, 3.4, 5, 0, 0, TAU); g.fillStyle = '#e6aa82'; g.fill(); g.lineWidth = 1.6; g.stroke(); }
    // волосы: зализаны назад, блик
    g.beginPath(); g.moveTo(-16, -200); g.quadraticCurveTo(-18, -222, 0, -222); g.quadraticCurveTo(18, -222, 16, -200); g.quadraticCurveTo(10, -212, 0, -211); g.quadraticCurveTo(-10, -212, -16, -200); g.closePath();
    g.fillStyle = '#1a1214'; g.fill(); g.lineWidth = 2.2; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-8, -216); g.quadraticCurveTo(-1, -219, 7, -215); g.stroke();
    // лицо: брови, глаза, нос, усики, спокойная улыбка
    g.strokeStyle = '#1a1214'; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, -206); g.lineTo(-3, -207); g.moveTo(3, -207); g.lineTo(9, -206); g.stroke();
    for (const ex of [-6, 6]) { g.beginPath(); g.ellipse(ex, -200, 2, 2.6, 0, 0, TAU); g.fillStyle = '#2a1a16'; g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.6, -201, 0.7, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(150,80,50,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -200); g.lineTo(-1.6, -193); g.lineTo(1.4, -192.6); g.stroke();
    g.strokeStyle = '#1a1214'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-8, -188.4); g.quadraticCurveTo(-4, -191.6, 0, -189.6); g.quadraticCurveTo(4, -191.6, 8, -188.4); g.stroke();
    g.strokeStyle = 'rgba(120,50,40,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4, -185); g.quadraticCurveTo(0, -182.4, 4, -185); g.stroke();
    // красная бабочка
    g.fillStyle = '#c8323c'; g.lineWidth = 1.8; g.strokeStyle = OUT;
    g.beginPath(); g.moveTo(0, -176); g.lineTo(-11, -181); g.lineTo(-11, -171); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -176); g.lineTo(11, -181); g.lineTo(11, -171); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, -176, 3.2, 0, TAU); g.fillStyle = '#9a1e2a'; g.fill(); g.stroke();
  }
  // Крупье, нарисованный по пояс (заказ 22, 04.10.2026): четыре кадра, поза — sc.croupierPose ('rest' по умолчанию — руки сложены на столе, 'invite' — приглашающая ладонь, 'regret' — «жаль»,
  // 'bow' — ладонь на груди и лёгкий поклон). Спрайты смотрят вправо, игрок подходит слева — рисуем зеркально. Низ спрайта — ровный срез по ремню: он опущен на CUT юнитов выше основания стола,
  // то есть за сукно (стол рисуется выше по z и закрывает срез); голова при этом на высоте обычного взрослого за столом. Дышит едва заметно (сжатие по высоте от низа). Возвращает false, если
  // кадра нет в сборке — тогда рисуется прежняя фигура кодом (croupierFigure).
  const CROUPIER = MA.CROUPIER = { frames: { rest: 'crp_rest', invite: 'crp_invite', regret: 'crp_regret', bow: 'crp_bow' }, cut: 96 };
  function drawCroupier(ctx, x, t, pose) {
    const name = CROUPIER.frames[pose] || CROUPIER.frames.rest;
    if (!Ale.Assets.sprites[name]) return false;
    Ale.drawSprite(ctx, name, x, WALL + 10 - CROUPIER.cut, { flip: true, sy: 1 + 0.007 * Math.sin((t || 0) * 2.1) });
    return true;
  }
  // Стол блэкджека: полукруглое сукно, дуги ставок, золотая надпись; спереди бортик и ножка
  function blackjackTable(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 4, 4, 100, 0.3);
    g.beginPath(); g.moveTo(-70, 0); g.lineTo(-62, -60); g.lineTo(62, -60); g.lineTo(70, 0); g.closePath(); g.fillStyle = A.linG(g, 0, -60, 0, 0, [[0, WOOD[0]], [1, WOOD[2]]]); g.fill(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = gold(g, -14, -8); g.fillRect(-69, -14, 138, 3);
    g.beginPath(); g.ellipse(0, -66, 92, 17, 0, 0, TAU); g.fillStyle = A.linG(g, 0, -80, 0, -50, [[0, '#3a1a14'], [1, '#1c0a0a']]); g.fill(); g.lineWidth = 3.2; g.stroke();
    g.beginPath(); g.ellipse(0, -70, 82, 12.4, 0, 0, TAU); g.fillStyle = A.linG(g, 0, -82, 0, -58, [[0, '#1c7a4c'], [1, '#0e5a38']]); g.fill(); g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; for (const px of [-48, -16, 16, 48]) { g.beginPath(); g.ellipse(px, -66, 9, 3.4, 0, 0, TAU); g.stroke(); }
    g.beginPath(); g.ellipse(0, -73, 54, 6, 0, Math.PI * 0.06, Math.PI * 0.94); g.strokeStyle = 'rgba(240,196,82,0.8)'; g.stroke();
    K.goldText(g, 'BLACKJACK', 0, -72, 8.4, { spacing: 2.4, font: Ale.FONT });
    for (const [cx, cy, col, n] of [[-66, -66, '#c8323c', 3], [64, -66, '#2a5a9a', 4], [48, -62, '#f4efe0', 2]]) for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? lighter(col, 0.2) : col; g.beginPath(); g.ellipse(cx, cy - i * 2.2, 5.2, 1.8, 0, 0, TAU); g.fill(); g.lineWidth = 0.9; g.strokeStyle = OUT; g.stroke(); }
    g.fillStyle = '#f8f4e8'; for (const [cx, cy, a] of [[-44, -62, -0.2], [-36, -61, 0.1]]) { g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-4.6, -3, 9.2, 6); g.lineWidth = 0.9; g.strokeStyle = OUT; g.strokeRect(-4.6, -3, 9.2, 6); g.fillStyle = '#c8323c'; g.fillRect(-2, -1.4, 2.4, 2.8); g.restore(); g.fillStyle = '#f8f4e8'; }
  }
  // Дверь выхода: мраморный наличник, двустворчатая дверь с тёплым стеклом (за ним дневной свет улицы), латунные ручки, зелёная вывеска «SORTIE» с человечком. Начало — середина основания
  function exitDoor(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const hw = 62, h = 232;
    A.box(g, -hw - 14, -h - 10, hw * 2 + 28, h + 10, { fill: A.linG(g, -hw - 14, 0, hw + 14, 0, [[0, MARB[0]], [0.5, MARB[1]], [1, MARB[2]]]), lw: 3.2, hi: 'rgba(255,255,255,0.6)' });
    A.box(g, -hw - 20, -h - 24, hw * 2 + 40, 16, { fill: gold(g, -h - 24, -h - 8), lw: 3, r: 3 });
    A.box(g, -hw, -h, hw * 2, h, { fill: '#3a1c18', lw: 3 });
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 2 : -hw, w = hw - 2;
      g.fillStyle = A.linG(g, x0, 0, x0 + w, 0, [[0, WOOD[0]], [1, WOOD[2]]]); g.fillRect(x0, -h, w, h);
      g.fillStyle = A.linG(g, 0, -h + 12, 0, -86, [[0, '#cdeaf6'], [0.45, '#fff0cc'], [1, '#ffd890']]); g.fillRect(x0 + 8, -h + 12, w - 16, h - 98);
      g.strokeStyle = gold(g, 0, 1); g.strokeStyle = GOLD[1]; g.lineWidth = 2.4; g.strokeRect(x0 + 8, -h + 12, w - 16, h - 98);
      g.strokeStyle = 'rgba(230,180,70,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + w / 2, -h + 12); g.lineTo(x0 + w / 2, -86); g.moveTo(x0 + 8, -150); g.lineTo(x0 + w - 8, -150); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(x0 + 12, -86); g.lineTo(x0 + 26, -h + 12); g.lineTo(x0 + 36, -h + 12); g.lineTo(x0 + 22, -86); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0 + 8, -76, w - 16, 54); g.strokeStyle = GOLD[1]; g.lineWidth = 1.8; g.strokeRect(x0 + 8, -76, w - 16, 54);
      A.box(g, x0 + (s > 0 ? 6 : w - 12), -118, 6, 40, { fill: gold(g, -118, -78), lw: 2, r: 3 });
    }
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -h); g.lineTo(0, 0); g.stroke();
    // вывеска
    const sy = -h - 62;
    A.box(g, -62, sy, 124, 32, { fill: A.linG(g, 0, sy, 0, sy + 32, [[0, '#33c070'], [1, '#128048']]), lw: 3, r: 6, hi: 'rgba(255,255,255,0.4)' });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-40, sy + 8.6, 3.2, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-40, sy + 12); g.lineTo(-44, sy + 21); g.moveTo(-40, sy + 12); g.lineTo(-36, sy + 19); g.lineTo(-30, sy + 17); g.moveTo(-44, sy + 15); g.lineTo(-49, sy + 14); g.moveTo(-40, sy + 18); g.lineTo(-37, sy + 25); g.stroke();
    A.text(g, 'SORTIE', 12, sy + 17, 17, '#ffffff', { stroke: 'rgba(0,60,24,0.7)', lw: 3 });
    // коврик
    g.beginPath(); g.moveTo(-66, 8); g.lineTo(66, 8); g.lineTo(78, 22); g.lineTo(-78, 22); g.closePath(); g.fillStyle = '#5a1020'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-60, 11); g.lineTo(60, 11); g.stroke();
  }

  // =================================================================== автоматы
  // Корона — тот же силуэт, что на красной фишке (items.js, chip): три зубца, пояс; scale 1 = размер на фишке
  function drawCrown(g, s) {
    g.save(); g.scale(s, s); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-9.5, 5.6); g.lineTo(-10.5, -5); g.lineTo(-5, 0); g.lineTo(0, -8); g.lineTo(5, 0); g.lineTo(10.5, -5); g.lineTo(9.5, 5.6); g.closePath();
    g.fillStyle = A.linG(g, 0, -8, 0, 6, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']]); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#e4b73a'; g.fillRect(-9.5, 5.6, 19, 2.6); g.lineWidth = 1; g.strokeRect(-9.5, 5.6, 19, 2.6);
    g.fillStyle = '#e04a3c'; for (const [x, y] of [[-10.5, -5], [0, -8], [10.5, -5]]) { g.beginPath(); g.arc(x, y, 1.15, 0, TAU); g.fill(); }
    g.restore();
  }
  const SYMS = ['crown', 'cherry', 'seven', 'diamond', 'club', 'bar', 'bell'];
  // Символ барабана в ячейке 44×44 с центром (cx, cy)
  function drawSym(g, name, cx, cy) {
    g.save(); g.translate(cx, cy); g.lineJoin = 'round'; g.lineCap = 'round';
    if (name === 'crown') drawCrown(g, 1.7);
    else if (name === 'cherry') {
      g.strokeStyle = '#2f6a38'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-7, 8); g.quadraticCurveTo(-4, -8, 6, -14); g.moveTo(8, 9); g.quadraticCurveTo(8, -6, 6, -14); g.stroke();
      g.fillStyle = '#3f9a48'; g.beginPath(); g.ellipse(10, -14, 7, 3, 0.3, 0, TAU); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
      for (const [x, y] of [[-8, 10], [9, 11]]) { g.beginPath(); g.arc(x, y, 8.4, 0, TAU); g.fillStyle = A.linG(g, x - 6, y - 6, x + 6, y + 8, [[0, '#ff6a5a'], [1, '#b01e2a']]); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 3, y - 3, 2, 0, TAU); g.fill(); }
    } else if (name === 'seven') {
      g.font = 'bold 40px ' + Ale.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = OUT; g.strokeText('7', 0, 2); g.fillStyle = A.linG(g, 0, -18, 0, 20, [[0, '#ff6a5a'], [1, '#c01828']]); g.fillText('7', 0, 2);
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,230,160,0.8)'; g.strokeText('7', -0.8, 1);
    } else if (name === 'diamond') {
      g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 0); g.lineTo(0, 17); g.lineTo(-12, 0); g.closePath(); g.fillStyle = A.linG(g, -12, -17, 12, 17, [[0, '#ff6a5a'], [0.5, '#d62c3a'], [1, '#8c1220']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(-1, -12); g.lineTo(-7, -1); g.lineTo(-3, -1); g.closePath(); g.fill();
    } else if (name === 'club') {
      const lobes = [[0, -8], [-9, 4], [9, 4]];
      g.lineWidth = 4.4; g.strokeStyle = OUT; for (const [x, y] of lobes) { g.beginPath(); g.arc(x, y, 8, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(-3, 4); g.lineTo(-6, 17); g.lineTo(6, 17); g.lineTo(3, 4); g.closePath(); g.stroke();
      g.fillStyle = '#26202c'; for (const [x, y] of lobes) { g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); } g.beginPath(); g.moveTo(-3, 4); g.lineTo(-6, 17); g.lineTo(6, 17); g.lineTo(3, 4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.arc(-3, -11, 2.6, 0, TAU); g.fill();
    } else if (name === 'bar') {
      A.box(g, -17, -9, 34, 18, { fill: A.linG(g, 0, -9, 0, 9, [[0, '#3a3a46'], [1, '#14141c']]), lw: 2.2, r: 3 }); A.text(g, 'BAR', 0, 0.5, 12, '#f6efe0');
    } else if (name === 'bell') {
      g.beginPath(); g.moveTo(-13, 11); g.quadraticCurveTo(-13, -4, -8, -9); g.quadraticCurveTo(0, -17, 8, -9); g.quadraticCurveTo(13, -4, 13, 11); g.closePath(); g.fillStyle = A.linG(g, -13, 0, 13, 0, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#a8741a']]); g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.arc(0, 14, 3.4, 0, TAU); g.fillStyle = '#b8862a'; g.fill(); g.stroke(); g.beginPath(); g.arc(0, -13, 2.6, 0, TAU); g.fill(); g.stroke();
    }
    g.restore();
  }
  // Кэш спрайтов автоматов (пересоздаётся после смены сцены, когда холсты освобождены)
  const cache = {};
  function cached(key, build) { const c = cache[key]; if (c && c.L && c.L.c.width) return c; return (cache[key] = build()); }
  function symAtlas() {
    return cached('atlas', () => { const L = A.layer(44 * SYMS.length, 44, (g) => { SYMS.forEach((n, i) => drawSym(g, n, 22 + i * 44, 22)); }, 2.4); return { L, k: 2.4, c: L.c }; });
  }
  function sym(ctx, name, x, y, s) {
    const a = symAtlas(), i = SYMS.indexOf(name), px = a.L.c.width / a.L.w;
    ctx.drawImage(a.L.c, i * 44 * px, 0, 44 * px, 44 * px, x - 22 * s, y - 22 * s, 44 * s, 44 * s);
  }
  const SLOT = {
    crown: { body: ['#5a5a6c', '#2c2c38', '#0e0e16'], trim: GOLD, badge: ['#5a1a2a', '#1c0a12'], idle: ['bar', 'cherry', 'bell'] },
    left: { body: ['#4670c0', '#2a4e92', '#122a5c'], trim: ['#ffffff', '#dfe6f2', '#8c98b4'], badge: ['#fffaf0', '#e8dec8'], idle: ['seven', 'diamond', 'cherry'] },
    right: { body: ['#35996a', '#1f6a4a', '#0c3e2a'], trim: GOLD, badge: ['#fffaf0', '#e8dec8'], idle: ['bell', 'club', 'bar'] },
  };
  const REEL = { y0: -192, y1: -136, xs: [-37, 0, 37], w: 34 };
  const CUP = { x: 0, y: -84, r: 19 };
  const LEVER = { px: 70, py: -146 };
  const BULBS = []; for (let i = 0; i < 9; i++) BULBS.push([-50 + i * 12.5, -243]); for (const y of [-232, -219, -207]) BULBS.push([-56, y], [56, y]);
  function emblem(g, kind) {
    if (kind === 'crown') { g.save(); g.scale(1.95, 1.95); g.translate(0, 0.4); drawCrown(g, 1); g.restore(); }
    else if (kind === 'left') drawSym(g, 'diamond', 0, 0);
    else drawSym(g, 'club', 0, 0);
  }
  // Тело автомата: корпус цвета «своего» набора, золочёная арка табло с эмблемой, окно барабанов, пульт, щель и чаша приёмника, лоток выдачи, рельса рычага. Начало — середина основания
  function slotBody(g, kind) {
    const P = SLOT[kind], T = P.trim;
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.box(g, -77, -16, 154, 16, { fill: A.linG(g, 0, -16, 0, 0, [[0, T[1]], [1, T[2]]]), lw: 2.8, r: 3, hi: 'rgba(255,255,255,0.45)' });
    const cab = () => { g.beginPath(); g.moveTo(-66, -16); g.lineTo(-66, -232); g.quadraticCurveTo(-66, -256, -42, -256); g.lineTo(42, -256); g.quadraticCurveTo(66, -256, 66, -232); g.lineTo(66, -16); g.closePath(); };
    cab(); g.fillStyle = A.linG(g, -66, 0, 66, 0, [[0, P.body[0]], [0.45, P.body[1]], [1, P.body[2]]]); g.fill();
    g.save(); cab(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(-62, -252, 7, 232);
    A.grain(g, -66, -256, 132, 240, 0.14, 'overlay', 41 + kind.length, 0.5);
    g.strokeStyle = rgba(T[1], 0.6); g.lineWidth = 1.6; g.strokeRect(-58, -248, 116, 226);
    A.edge(g, -66, -60, 132, 44, 'b', 44, 'rgba(0,0,0,0.3)');
    g.restore();
    cab(); g.lineWidth = 3.6; g.strokeStyle = OUT; g.stroke();
    // табло с эмблемой
    A.box(g, -58, -250, 116, 48, { fill: A.linG(g, 0, -250, 0, -202, [[0, P.badge[1]], [1, mix(P.badge[1], '#000000', 0.2)]]), lw: 2.8, r: 12 });
    g.strokeStyle = rgba(T[1], 0.9); g.lineWidth = 2; g.beginPath(); A.rrPath(g, -54, -246, 108, 40, 9); g.stroke();
    g.beginPath(); g.arc(0, -226, 21, 0, TAU); g.fillStyle = A.linG(g, -14, -240, 14, -212, [[0, P.badge[0]], [1, P.badge[1]]]); g.fill(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
    g.lineWidth = 2.6; g.strokeStyle = T[1]; g.beginPath(); g.arc(0, -226, 18.4, 0, TAU); g.stroke();
    g.save(); g.translate(0, -226); emblem(g, kind); g.restore();
    // окно барабанов
    A.box(g, -62, -200, 124, 70, { fill: A.linG(g, 0, -200, 0, -130, [[0, T[0]], [0.5, T[1]], [1, T[2]]]), lw: 3.2, r: 6 });
    A.box(g, -56, -194, 112, 58, { fill: '#17101a', lw: 2.2, r: 3 });
    for (const x of REEL.xs) { A.box(g, x - REEL.w / 2, REEL.y0, REEL.w, REEL.y1 - REEL.y0, { fill: A.linG(g, x - 17, 0, x + 17, 0, [[0, '#f0e6d2'], [0.5, '#fffaf0'], [1, '#d8cbb0']]), lw: 1.6 }); A.edge(g, x - 17, REEL.y0, 34, 56, 't', 14, 'rgba(0,0,0,0.3)'); A.edge(g, x - 17, REEL.y0, 34, 56, 'b', 14, 'rgba(0,0,0,0.3)'); }
    // пульт: кнопки
    g.beginPath(); g.moveTo(-60, -130); g.lineTo(60, -130); g.lineTo(64, -108); g.lineTo(-64, -108); g.closePath(); g.fillStyle = A.linG(g, 0, -130, 0, -108, [[0, mix(P.body[1], '#000000', 0.25)], [1, P.body[2]]]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = rgba(T[1], 0.8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-60, -128); g.lineTo(60, -128); g.stroke();
    // щель и чаша приёмника фишки
    A.box(g, -17, -108, 34, 6, { fill: '#17101a', lw: 1.8, r: 3 }); g.fillStyle = rgba(T[0], 0.7); g.fillRect(-15, -108, 30, 1.4);
    g.beginPath(); g.arc(CUP.x, CUP.y, CUP.r + 3.6, 0, TAU); g.fillStyle = A.linG(g, CUP.x - 22, CUP.y - 22, CUP.x + 22, CUP.y + 22, [[0, T[0]], [0.5, T[1]], [1, T[2]]]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(CUP.x, CUP.y, CUP.r, 0, TAU); g.fillStyle = A.linG(g, CUP.x, CUP.y - 18, CUP.x, CUP.y + 18, [[0, '#0c060a'], [1, '#3a2630']]); g.fill(); g.lineWidth = 2; g.stroke();
    // лоток выдачи
    A.box(g, -45, -64, 90, 44, { fill: A.linG(g, 0, -64, 0, -20, [[0, T[1]], [1, T[2]]]), lw: 2.8, r: 5, hi: 'rgba(255,255,255,0.4)' });
    A.box(g, -38, -57, 76, 32, { fill: A.linG(g, 0, -57, 0, -25, [[0, '#0c060a'], [1, '#2a1620']]), lw: 2, r: 3 });
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(-36, -55, 72, 3);
    // рельса рычага справа
    A.box(g, 64, -206, 12, 86, { fill: A.linG(g, 64, 0, 76, 0, [[0, '#f0f2f8'], [1, '#7a8094']]), lw: 2.4, r: 4 });
    g.fillStyle = '#17101a'; g.fillRect(68.4, -196, 3.2, 66);
  }
  function slotSprite(kind) {
    return cached('slot_' + kind, () => { const spr = sprite(170, 290, 85, 276, dens(2), (g) => slotBody(g, kind)); return { L: spr.L, draw: spr }; });
  }

  // Живая часть автомата: огни рамки, барабаны, рычаг, фишка в чаше, пачка из лотка, свечение победы
  function slotDynamic(ctx, x, kind, st, t) {
    const crown = kind === 'crown', P = SLOT[kind];
    st = st || {};
    const stage = crown ? st.stage : 'chipInBag', jack = crown && stage === 'jackpot';
    const glow = crown ? Math.max(0, Math.min(1, st.glow || 0)) : 0, spin = crown && !!st.spin;
    const lever = crown ? Math.max(0, Math.min(1, st.lever || 0)) : 0, pack = crown ? Math.max(0, Math.min(1, st.pack || 0)) : 0;
    const insert = !crown ? 0 : stage !== 'chipInBag' ? (st.insert === undefined ? 1 : st.insert) : Math.max(0, Math.min(1, st.insert || 0));
    const ph = kind === 'left' ? 1.3 : kind === 'right' ? 2.1 : 0;
    ctx.save(); ctx.translate(x, FY);
    // огни рамки табло
    ctx.fillStyle = '#7a5a30'; ctx.beginPath();
    BULBS.forEach(([bx, by], i) => { const on = jack ? (Math.floor(t * 6 + i % 2) % 2 === 0) : ((i + Math.floor(t * 5 + ph)) % 3 === 0); if (!on) { ctx.moveTo(bx + 2.8, by); ctx.arc(bx, by, 2.8, 0, TAU); } });
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,150,0.3)'; ctx.beginPath();
    BULBS.forEach(([bx, by], i) => { const on = jack ? (Math.floor(t * 6 + i % 2) % 2 === 0) : ((i + Math.floor(t * 5 + ph)) % 3 === 0); if (on) { ctx.moveTo(bx + 7, by); ctx.arc(bx, by, 7, 0, TAU); } });
    ctx.fill(); ctx.fillStyle = '#fff6c4'; ctx.beginPath();
    BULBS.forEach(([bx, by], i) => { const on = jack ? (Math.floor(t * 6 + i % 2) % 2 === 0) : ((i + Math.floor(t * 5 + ph)) % 3 === 0); if (on) { ctx.moveTo(bx + 3.2, by); ctx.arc(bx, by, 3.2, 0, TAU); } });
    ctx.fill();
    // барабаны
    for (let j = 0; j < 3; j++) {
      const rx = REEL.xs[j];
      ctx.save(); ctx.beginPath(); ctx.rect(rx - 17, REEL.y0, 34, REEL.y1 - REEL.y0); ctx.clip();
      if (spin) {
        const sp = 300 + j * 60, off = (t * sp) % 40, base = Math.floor(t * sp / 40) + j * 3;
        for (let k = -1; k <= 2; k++) sym(ctx, SYMS[((base - k) % SYMS.length + SYMS.length) % SYMS.length], rx, -164 + k * 40 + off - 40, 0.72);
        ctx.fillStyle = 'rgba(255,250,240,0.28)'; ctx.fillRect(rx - 17, REEL.y0, 34, 56);
      } else sym(ctx, jack ? 'crown' : P.idle[j], rx, -164, 0.78);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.moveTo(-54, -192); ctx.lineTo(-14, -192); ctx.lineTo(-40, -136); ctx.lineTo(-54, -136); ctx.closePath(); ctx.fill();            // блик стекла
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(6, -192); ctx.lineTo(22, -192); ctx.lineTo(-4, -136); ctx.lineTo(-20, -136); ctx.closePath(); ctx.fill();
    // кнопки пульта: тихо дышат
    for (const [bx, col] of [[-28, '#e04a3c'], [0, '#f0c452'], [28, '#4ac878']]) { const k = 0.7 + 0.3 * Math.sin(t * 3 + bx); ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(bx, -118, 6.4, 0, TAU); ctx.fill(); ctx.fillStyle = col; ctx.globalAlpha = 0.6 + 0.4 * k; ctx.beginPath(); ctx.arc(bx, -118, 4.8, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(bx - 1.4, -119.6, 1.4, 0, TAU); ctx.fill(); }
    // фишка в приёмнике: опускается в чашу и остаётся (видна, пока автомат её держит)
    if (crown && insert > 0.001) {
      const k = Math.min(1, insert), y = CUP.y - 46 * (1 - k) * (1 - k), a = Math.min(1, k * 4);
      ctx.save(); ctx.beginPath(); ctx.rect(-40, -140, 80, 56 + CUP.r); ctx.clip(); ctx.globalAlpha = a;
      Ale.drawSprite(ctx, 'it_chip', CUP.x, y, { sx: 0.5, sy: 0.5 });
      ctx.restore();
      ctx.strokeStyle = 'rgba(20,6,10,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(CUP.x, CUP.y, CUP.r - 0.5, 0.2, 2.9); ctx.stroke();       // тень бортика чаши на фишке
    }
    // рычаг: латунное плечо и красный шар по дуге
    { const by = -206 + lever * 106, bxx = 83 + 9 * Math.sin(Math.PI * lever);
      ctx.strokeStyle = OUT; ctx.lineWidth = 8.4; ctx.beginPath(); ctx.moveTo(LEVER.px, LEVER.py); ctx.lineTo(bxx, by); ctx.stroke();
      ctx.strokeStyle = '#d4d8e4'; ctx.lineWidth = 4.6; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(LEVER.px - 1, LEVER.py - 1); ctx.lineTo(bxx - 1, by - 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(LEVER.px, LEVER.py, 6, 0, TAU); ctx.fillStyle = '#8a90a6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      const gr = ctx.createRadialGradient(bxx - 3, by - 3, 1, bxx, by, 11); gr.addColorStop(0, '#ff8a7a'); gr.addColorStop(0.55, '#d82c2c'); gr.addColorStop(1, '#8a1018');
      ctx.beginPath(); ctx.arc(bxx, by, 10.4, 0, TAU); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(bxx - 3.4, by - 4, 3, 2, -0.5, 0, TAU); ctx.fill(); }
    // пачка денег выезжает из лотка
    if (pack > 0.001) {
      A.glow(ctx, 0, -42 - 20 * pack, 50, 'rgba(255,226,140,', 0.4 * Math.min(1, pack * 2));
      Ale.drawSprite(ctx, 'it_cash', 0, -38 - 20 * pack, { sx: 0.55 + 0.5 * pack, sy: 0.55 + 0.5 * pack, alpha: Math.min(1, pack * 3) });
    }
    ctx.restore();
    // свечение: у «своего» автомата — тихое мерцание вокруг короны (вызывает интерес), при победе — яркое
    if (crown) {
      A.glow(ctx, x, FY - 226, 46, 'rgba(255,224,140,', 0.16 + 0.05 * Math.sin(t * 3) + 0.22 * glow);
      if (glow > 0.001) { const k = glow * (0.75 + 0.25 * Math.sin(t * 8)); A.glow(ctx, x, FY - 226, 70, 'rgba(255,244,190,', 0.34 * k); A.glow(ctx, x, FY - 164, 70, 'rgba(255,240,180,', 0.18 * k); }
    }
  }
  MA.slotMachine = guard('slotMachine', function (ctx, x, kind, st, t) {
    kind = SLOT[kind] ? kind : 'right';
    const S = slotSprite(kind), gl = kind === 'crown' && st ? Math.max(0, Math.min(1, st.glow || 0)) : 0;
    A.shadow(ctx, x + 4, FY + 4, 88, 0.34);
    if (gl > 0.001) A.glow(ctx, x, FY - 140, 190, 'rgba(255,214,120,', 0.34 * gl * (0.8 + 0.2 * Math.sin((t || 0) * 8)));                // ореол победы позади автомата
    S.draw(ctx, x, FY);
    slotDynamic(ctx, x, kind, st, t || 0);
  });

  // =================================================================== сборка
  MA.casinoLayers = guard('casinoLayers', function (game, WIDTH, X) {
    const wall = A.layer(WIDTH, HALL_H, (g) => hallWall(g, WIDTH), dens(1.5));
    const floor = hallFloor(WIDTH);
    symAtlas(); for (const k of ['crown', 'left', 'right']) slotSprite(k);
    return { wall, floor };
  });
  MA.casinoBack = guard('casinoBack', function (ctx, cam, game, sc, L) {
    const W = game.viewW;
    ctx.fillStyle = '#2a1018'; ctx.fillRect(0, 0, W, game.viewH);
    A.blitView(ctx, L.wall, -cam.x, 0, W);
    A.blitView(ctx, L.floor, -cam.x, WALL - 4, W);
  });
  MA.casinoDecor = guard('casinoDecor', function (X, sc) {
    const out = [];
    const put = (name, ax, ay, z, hw, w, h, ox, oy, scale, fn) => { const spr = sprite(w, h, ox, oy, scale, fn); deco(out, sc, name, ax, z, hw, (ctx) => spr(ctx, ax, ay)); return spr; };
    // выход
    put('exitDoor', X.exit, WALL, 8, 100, 190, 330, 95, 300, dens(1.7), exitDoor);
    // бар и столы
    put('bar', 347, WALL + 12, 20, 200, 300, 220, 150, 210, dens(1.7), (g) => barCounter(g, 232));
    put('blackjack', 540, WALL + 10, 19, 100, 200, 120, 100, 100, dens(1.8), blackjackTable);
    put('roulette', 1594, WALL + 10, 19, 130, 260, 170, 130, 160, dens(1.8), rouletteTable);
    // крупье за столом рулетки (позади него по глубине, z 18 < 19): нарисованный по пояс, кадр — по sc.croupierPose; нет картинок в сборке — прежняя фигура кодом
    let figure = null;
    deco(out, sc, 'croupier', X.croupier, 18, 80, (ctx, t) => {
      if (drawCroupier(ctx, X.croupier, t, sc.croupierPose)) return;
      figure = figure || sprite(140, 240, 70, 232, dens(1.8), croupierFigure);
      figure(ctx, X.croupier, WALL + 10);
    });
    // люстры (на кадр — блеск хрусталя и мягкое свечение)
    const chS = sprite(240, 210, 120, 8, dens(1.8), chandelier);
    CHANDS.forEach((cx, i) => deco(out, sc, 'chandelier', cx, 12, 160, (ctx, t) => {
      chS(ctx, cx, 0, false, i % 2 ? 0.94 : 1);
      A.glow(ctx, cx, 112, 150, 'rgba(255,226,160,', 0.2 + 0.03 * Math.sin(t * 1.7 + i));
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ph = t * (0.9 + 0.25 * k) + i * 2.1 + k * 1.7, v = Math.sin(ph); if (v < 0.78) continue;
        const gx = cx + (hash(i * 9 + k) - 0.5) * 150, gy = 96 + hash(i * 5 + k * 3) * 70, r = 3 + (v - 0.78) * 22;
        ctx.moveTo(gx - r, gy); ctx.lineTo(gx + r, gy); ctx.moveTo(gx, gy - r); ctx.lineTo(gx, gy + r);
      }
      ctx.stroke();
    }));
    // пламя бра: тихо мерцает
    for (const cx of COLS.slice(1)) deco(out, sc, 'sconceGlow', cx, 11, 90, (ctx, t) => A.glow(ctx, cx + 18, 296, 90, 'rgba(255,224,150,', 0.32 + 0.06 * Math.sin(t * 5 + cx)));
    // три автомата
    for (const [k, x] of [['left', X.slotLeft], ['crown', X.slotCrown], ['right', X.slotRight]]) deco(out, sc, 'slot_' + k, x, 22, 120, (ctx, t) => MA.slotMachine(ctx, x, k, sc.slot, t));
    return out;
  });
  MA.casinoFront = guard('casinoFront', function (X, sc) { return []; });
})();
