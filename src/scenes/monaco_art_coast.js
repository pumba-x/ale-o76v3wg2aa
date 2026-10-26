// Монако, берег с камнями и пещерой (сцена coast, ширина 2600). Рисуется кодом в манере Парижа и Киева; общие кисти — Ale.MonacoArt.kit (monaco_art.js).
// Слева направо (мировые x): дорога над морем у остановки такси (X.stop; стена набережной, склон с виллой, соснами и бугенвиллеей) → две каменные ступени вниз → камни над водой СТРОГО по Ale.COAST.stones
// (верх каждого — ровная плоскость на высоте верха из списка, бока уходят под воду и остаются внутри ширины камня) → широкий камень C → скалы-обрывы справа с щелью-входом в пещеру на X.cave (над камнем F).
// Дали (параллакс): небо с облаками (0,06) → горы, тёплое низкое солнце с золотой дорожкой по воде, дальний берег и паруса (0,2) → скалистые островки с пиниями (0,45) → камни, склон и обрыв (мир).
// Вода ПЕРЕДНЕГО плана — coastFront (z = 90): прозрачная с волной по линии sc.coast.waterY поверх китёныша и боков камней, пена у камней, блики. Свет пещеры — sc.coast.caveGlow (0…1): тёплое свечение из щели, пятно на камне F, пылинки.
// Щель частично закрыта передним слоем скалы (валун справа и нависающая плита, z = 60), но герой у входа (X.cave ± 100) остаётся впереди щели; стрелку над входом рисует сцена.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const MA = (Ale.MonacoArt = Ale.MonacoArt || {});
  const K = MA.kit;
  const { TAU, dens, mix, rgba, hazed, hash, par, guard, sprite, deco } = K;
  const HAZE = '#f6e4cc';
  const HZ = 410, VY = 150;                                      // линия горизонта моря и экранная высота верха слоя вида
  // Нарисованный закат над морем (заказ 27, view_coast_sunset 2170×725): небо, горы, островки, деревня, паруса и вода с дорожкой солнца — одной картиной (1:1, параллакс 0,2), горизонт картины
  // (строка hz) стоит на HZ. Нет картины — прежние слои кодом (sky, vista, градиент моря).
  const PAINT = { name: 'view_coast_sunset', hz: 412, sunX: 868, par: 0.2 };
  const paintImg = () => { const im = Ale.Assets && Ale.Assets.images && Ale.Assets.images[PAINT.name]; return im && (im.naturalWidth || im.width) ? im : null; };
  const MID_Y = 330;                                             // верх слоя островков
  const CLIFF_UP = 200;                                          // насколько слой обрыва справа поднят над верхним краем кадра
  const ROCK = ['#f2dcb8', '#d3b894', '#a08670'];                // известняк: свет слева, середина, тень справа
  const ROCK_D = ['#cbb89c', '#a8937c', '#78675a'];              // более тёмный (у воды, в тени)
  const PINEP = { hi: '#86b868', mid: '#4a8842', lo: '#28603a', edge: 'rgba(10,44,28,0.5)', dark: 'rgba(10,48,28,0.4)', light: 'rgba(196,232,146,0.4)' };

  // =================================================================== скала: заливка, пласты, трещины
  // pathFn() строит контур; (bx, by, bw, bh) — габарит; o: pal, strata (шаг пластов), cracks (число), lw (контур)
  function rockFill(g, pathFn, bx, by, bw, bh, seed, o) {
    o = o || {};
    const R = A.rng(seed), P = o.pal || ROCK;
    pathFn(); g.fillStyle = A.linG(g, bx, 0, bx + bw, 0, [[0, P[0]], [0.5, P[1]], [1, P[2]]]); g.fill();
    g.save(); pathFn(); g.clip();
    A.gradV(g, bx, by, bw, bh, [[0, 'rgba(255,244,210,0.26)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(24,30,56,0.3)']]);
    for (let y = by + R.range(5, 12); y < by + bh; y += R.range(11, 24)) {
      g.strokeStyle = R.chance(0.55) ? 'rgba(88,66,46,0.3)' : 'rgba(255,248,226,0.26)'; g.lineWidth = R.range(1, 2.4);
      g.beginPath(); g.moveTo(bx - 6, y); for (let x = bx; x <= bx + bw + 10; x += 22) g.lineTo(x, y + Math.sin(x * 0.06 + y * 0.3) * 2.2 + R.range(-1.2, 1.2)); g.stroke();
    }
    const nc = o.cracks === undefined ? Math.round(bw * bh / 7000) : o.cracks;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < nc; i++) {
      let x = bx + R.range(0, bw), y = by + R.range(4, bh * 0.8); g.strokeStyle = 'rgba(54,38,30,0.5)'; g.lineWidth = R.range(1, 2); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += R.range(-9, 9); y += R.range(7, 18); g.lineTo(x, y); } g.stroke();
      g.strokeStyle = 'rgba(255,248,226,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2 + 1, y - 40); g.lineTo(x + 1, y - 22); g.stroke();
    }
    for (let i = 0; i < bw * bh / 3000; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(255,248,228,0.16)' : 'rgba(70,50,36,0.14)'; const px = bx + R.range(0, bw), py = by + R.range(0, bh); g.beginPath(); g.ellipse(px, py, R.range(3, 9), R.range(1.5, 4), R.range(-0.3, 0.3), 0, TAU); g.fill(); }
    for (let i = 0; i < bw * bh / 12000; i++) { g.fillStyle = R.pick(['rgba(214,170,64,0.34)', 'rgba(160,176,70,0.3)', 'rgba(226,150,70,0.24)']); g.beginPath(); g.ellipse(bx + R.range(0, bw), by + R.range(6, bh * 0.7), R.range(3, 8), R.range(2, 4.4), 0, 0, TAU); g.fill(); }        // лишайники
    A.grain(g, bx, by, bw, bh, 0.18, 'overlay', seed + 3, 0.6);
    g.restore();
    pathFn(); g.lineWidth = o.lw || 3; g.strokeStyle = o.line || OUT; g.lineJoin = 'round'; g.stroke();
  }
  // Пучок травы с мелкими цветами: основание в (x, y), высота ≈ 14·s
  function tuft(g, x, y, s, seed) {
    const R = A.rng(seed);
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) { g.strokeStyle = R.pick(['#5a9a48', '#78b052', '#3f7c3c', '#8cc060']); g.lineWidth = 1.8 * s; g.beginPath(); g.moveTo(x + R.range(-4, 4) * s, y); g.quadraticCurveTo(x + R.range(-6, 6) * s, y - 8 * s, x + R.range(-9, 9) * s, y - R.range(9, 15) * s); g.stroke(); }
    if (R.chance(0.7)) for (let i = 0; i < 3; i++) { g.fillStyle = R.pick(['#fff4d0', '#f4c43a', '#f08a9a']); g.beginPath(); g.arc(x + R.range(-7, 7) * s, y - R.range(8, 14) * s, 1.8 * s, 0, TAU); g.fill(); }
  }
  // Агава: розетка мясистых серо-зелёных листьев
  function agave(g, x, y, s, seed) {
    const R = A.rng(seed);
    g.lineJoin = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.34 + R.range(-0.08, 0.08), L = (26 + R.range(0, 12)) * s, w = 6 * s;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 1.1, -L * 0.6, 0, -L); g.quadraticCurveTo(w * 1.1, -L * 0.6, w, 0); g.closePath();
      g.fillStyle = A.linG(g, -w, 0, w, 0, [[0, '#9cc4a0'], [0.5, '#6aa088'], [1, '#3e7a64']]); g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(20,56,44,0.7)'; g.stroke();
      g.restore();
    }
  }

  // =================================================================== камни
  // Камень по строкам Ale.COAST.stones [левый, правый, верх]: плоская верхняя плоскость ровно на высоте верха, бока внутри ширины, уходят вниз под воду. kind: 'quay' | 'step' | 'rock'
  function stoneShape(g, w, H, R, kind) {
    const L = [], Rt = [];
    for (let y = 0; y <= H; y += 13) {
      const k = y < 15 ? 0 : (kind === 'rock' ? 1 : 0.22), j = (y > H * 0.5 ? 1.7 : 1) * k;
      L.push(k ? R.range(0, 9) * j : 0); Rt.push(k ? R.range(0, 9) * j : 0);
    }
    return () => {
      const n = L.length, rr = kind === 'rock' ? 6 : 2;
      g.beginPath(); g.moveTo(L[0] + rr, 0); g.lineTo(w - Rt[0] - rr, 0); g.quadraticCurveTo(w - Rt[0], 0, w - Rt[0], rr);
      for (let i = 1; i < n; i++) g.lineTo(w - Rt[i], i * 13);
      g.lineTo(w - Rt[n - 1] - 4, H);
      g.lineTo(L[n - 1] + 4, H);
      for (let i = n - 1; i >= 1; i--) g.lineTo(L[i], i * 13);
      g.lineTo(L[0], rr); g.quadraticCurveTo(L[0], 0, L[0] + rr, 0); g.closePath();
    };
  }
  function drawStone(g, s, i, kind, waterY) {
    const w = s[1] - s[0], top = s[2], H = 770 - top, R = A.rng(100 + i * 17), yW = waterY - top;
    g.lineJoin = 'round'; g.lineCap = 'round';
    const path = stoneShape(g, w, H, R, kind);
    if (kind === 'rock') rockFill(g, path, 0, 0, w, H, 200 + i, { pal: ROCK });
    else {
      // тёсаные блоки набережной и ступеней: ряды, швы, обкатанная кромка
      const bh = kind === 'quay' ? 28 : 22;
      path(); g.fillStyle = A.linG(g, 0, 0, w, 0, [[0, '#e6dcc6'], [0.5, '#cbbfa6'], [1, '#9c8f7c']]); g.fill();
      g.save(); path(); g.clip();
      for (let row = 0, y = 12; y < H; row++, y += bh) {
        const bw2 = kind === 'quay' ? 74 : 54;
        for (let x = -(row % 2) * bw2 / 2; x < w; x += bw2 + R.range(-6, 10)) { if (R.chance(0.4)) { g.fillStyle = R.chance(0.5) ? 'rgba(255,248,228,0.18)' : 'rgba(90,70,50,0.12)'; g.fillRect(x + 1, y + 1, bw2 - 2, bh - 2); } g.fillStyle = 'rgba(80,60,44,0.4)'; g.fillRect(x, y, 1.8, bh); }
        g.fillStyle = 'rgba(80,60,44,0.42)'; g.fillRect(0, y, w, 1.8); g.fillStyle = 'rgba(255,250,232,0.34)'; g.fillRect(0, y + 1.8, w, 1.4);
      }
      A.gradV(g, 0, 0, w, H, [[0, 'rgba(255,244,210,0.24)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(24,30,56,0.3)']]);
      A.grain(g, 0, 0, w, H, 0.18, 'overlay', 300 + i, 0.6);
      g.restore();
      path(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      A.box(g, -2, -1, w + 4, 13, { fill: A.linG(g, 0, 0, w, 0, [[0, '#f4ecd8'], [1, '#d4c8ae']]), lw: 2.8, hi: 'rgba(255,255,255,0.6)' });                      // верхняя плита
    }
    g.save(); path(); g.clip();
    // мокрая полоса у ватерлинии, водоросли и ракушки
    A.gradV(g, 0, yW - 40, w, 52, [[0, 'rgba(40,66,56,0)'], [0.6, 'rgba(36,72,60,0.42)'], [1, 'rgba(24,60,64,0.62)']]);
    for (let k = 0; k < w / 6; k++) { g.fillStyle = R.chance(0.7) ? 'rgba(250,248,236,0.9)' : 'rgba(200,196,180,0.8)'; g.beginPath(); g.arc(R.range(2, w - 2), yW + R.range(-22, 0), R.range(0.8, 1.7), 0, TAU); g.fill(); }
    for (let k = 0; k < w / 30; k++) { g.fillStyle = 'rgba(60,120,70,0.5)'; g.beginPath(); g.ellipse(R.range(0, w), yW - R.range(0, 8), R.range(8, 18), R.range(3, 6), 0, 0, TAU); g.fill(); }
    g.restore();
    // верхняя кромка: светлая полоса и кустики
    g.save(); path(); g.clip(); g.fillStyle = 'rgba(255,242,208,0.42)'; g.fillRect(0, 1.5, w, 5); g.restore();
    if (kind === 'rock') {
      const nt = Math.max(2, Math.round(w / 55));
      for (let k = 0; k < nt; k++) { const tx = 14 + (k + R.range(0.1, 0.9)) * (w - 28) / nt; if (R.chance(0.35)) agave(g, tx, 1, R.range(0.55, 0.8), 400 + i * 9 + k); else tuft(g, tx, 1.5, R.range(0.8, 1.2), 500 + i * 9 + k); }
    } else if (kind === 'step') { g.fillStyle = 'rgba(70,120,70,0.5)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(R.range(6, w - 6), 12 + R.range(0, 4), R.range(5, 10), 2, 0, 0, TAU); g.fill(); } }
  }

  // =================================================================== склон слева, дорога и стена набережной
  function hillLeft(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const R = A.rng(15), roadY = 520, WALL_W = 570;                      // стена и дорога кончаются у края набережной (x = 560, камень 0 — [0, 560]): раньше торчали на 20 юн. дальше, над первой ступенью
    const top = (x) => { const t = Math.min(1, Math.max(0, x / 800)); return 178 + 332 * (t * t * (3 - 2 * t)) + 12 * Math.sin(x * 0.03); };
    // дальний склон (позади): светлые террасы с соснами
    const cut = () => { g.beginPath(); g.moveTo(-10, roadY); g.lineTo(-10, top(-10)); for (let x = 0; x <= 800; x += 10) g.lineTo(x, top(x)); g.quadraticCurveTo(806, 580, 770, 624); g.lineTo(716, 700); g.lineTo(560, 700); g.lineTo(560, roadY); g.closePath(); };
    rockFill(g, cut, -10, 150, 820, 552, 41, { pal: ['#f4dfbc', '#dcc3a0', '#c4a988'], cracks: 34, lw: 3.4 });
    g.save(); cut(); g.clip(); A.gradV(g, 560, 590, 250, 70, [[0, 'rgba(40,66,56,0)'], [1, 'rgba(32,70,64,0.55)']]); g.restore();
    // уступы и кустарник по склону
    for (let x = 40; x < 760; x += R.range(60, 110)) { const y = top(x) + R.range(26, 150); K.mound(g, x, Math.min(y, roadY - 40), R.range(26, 50), R.range(14, 24), K.LEAF, 50 + Math.round(x), { lw: 2.6 }); if (R.chance(0.4)) agave(g, x + 30, Math.min(y + 4, roadY - 40), R.range(0.8, 1.2), Math.round(x)); }
    // бугенвиллея стекает со склона
    K.bougainvillea(g, 214, top(260) - 4, 120, 190, 77);
    K.bougainvillea(g, 430, top(470) + 10, 90, 130, 78);
    // вилла на вершине
    const vx = 40, vb = top(150) + 2;
    g.fillStyle = A.linG(g, 0, vb - 100, 0, vb, [[0, '#fbeccd'], [1, '#ecd4a8']]); g.fillRect(vx, vb - 96, 170, 96); g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(vx, vb - 96, 170, 96);
    g.beginPath(); g.moveTo(vx - 12, vb - 94); g.lineTo(vx + 30, vb - 138); g.lineTo(vx + 140, vb - 138); g.lineTo(vx + 182, vb - 94); g.closePath(); g.fillStyle = A.linG(g, 0, vb - 138, 0, vb - 94, [[0, '#d8784a'], [1, '#b85634']]); g.fill(); g.stroke();
    for (let k = 0; k < 4; k++) K.archWin(g, vx + 24 + k * 40, vb - 18, 22, 46, { glass: 'day', frame: '#fff3da', shutters: k % 2 ? '#5f8f7a' : '#3f6f8f', keystone: false, sill: false });
    // подпорная стена под виллой: склон справа от виллы уходит вниз (на правом краю почти на 50 юн. ниже основания), и без стены правый угол дома и сосна над ним висели в воздухе
    { const bx1 = vx + 198, lower = (x) => Math.max(vb, top(x) + 1.5), x0 = 148;
      g.beginPath(); g.moveTo(x0, vb); g.lineTo(bx1, vb); g.lineTo(bx1, lower(bx1)); for (let x = bx1; x >= x0; x -= 6) g.lineTo(x, lower(x)); g.closePath();
      g.fillStyle = A.linG(g, x0, 0, bx1, 0, [[0, '#ecdfc4'], [1, '#cdbd9f']]); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(80,60,44,0.4)'; g.lineWidth = 1.8; g.beginPath();
      for (let y = vb + 14; y < vb + 60; y += 14) { g.moveTo(x0, y); g.lineTo(bx1, y); }
      for (let r = 0, y = vb; y < vb + 60; r++, y += 14) for (let x = x0 + (r % 2) * 20; x < bx1; x += 40) { g.moveTo(x, y); g.lineTo(x, y + 14); }
      g.stroke();
      A.gradV(g, x0, vb, bx1 - x0, 60, [[0, 'rgba(255,244,210,0.28)'], [1, 'rgba(24,30,56,0.22)']]);
      g.restore();
      g.lineWidth = 3; g.strokeStyle = OUT; g.beginPath(); g.moveTo(x0, vb); g.lineTo(bx1, vb); g.lineTo(bx1, lower(bx1)); g.stroke();
      A.box(g, vx - 12, vb - 2, bx1 - vx + 14, 8, { fill: A.linG(g, 0, vb - 2, 0, vb + 6, [[0, '#f4ecd8'], [1, '#d4c8ae']]), lw: 2.4, hi: 'rgba(255,255,255,0.6)' }); }       // карниз стены под домом
    for (const px of [vx + 10, vx + 150]) K.pine(g, px, vb + 2, R.range(120, 150), R.range(44, 58), Math.round(px), PINEP, { tw: 12 });
    K.pine(g, 330, top(330) + 8, 130, 54, 71, PINEP, { tw: 12 }); K.pine(g, 520, top(520) + 6, 100, 44, 72, PINEP, { tw: 10 });
    // подпорная стена набережной: тёсаные блоки, арки, цветы
    const wy = roadY - 34;
    g.fillStyle = A.linG(g, 0, wy, 0, roadY, [[0, '#e0d4ba'], [1, '#bfb094']]); g.fillRect(-10, wy, WALL_W, roadY - wy); g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(-10, wy, WALL_W, roadY - wy);
    for (let x = -10; x < WALL_W - 10; x += 52) { g.fillStyle = 'rgba(80,60,44,0.4)'; g.fillRect(x, wy, 1.8, roadY - wy); }
    g.fillStyle = 'rgba(80,60,44,0.4)'; g.fillRect(-10, wy + 16, WALL_W, 1.8);
    A.box(g, -14, wy - 8, WALL_W + 8, 10, { fill: A.linG(g, 0, wy - 8, 0, wy + 2, [[0, '#f4ecd8'], [1, '#d4c8ae']]), lw: 2.6, hi: 'rgba(255,255,255,0.6)' });
    // дорога: асфальт с разметкой и тротуар у кромки
    const rd = A.linG(g, 0, roadY, 0, 552, [[0, '#7a7a88'], [1, '#5c5c6c']]);
    g.fillStyle = rd; g.fillRect(-10, roadY, WALL_W, 32); g.fillStyle = 'rgba(255,248,226,0.55)'; for (let x = 6; x < 530; x += 70) g.fillRect(x, 535, 36, 3);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-10, roadY, WALL_W, 3);
    for (let i = 0; i < 160; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; g.fillRect(R.range(-10, WALL_W - 12), R.range(roadY, 552), R.range(1, 3), R.range(1, 2)); }
    A.gradV(g, -10, 550, WALL_W, 12, [[0, '#d8ccb4'], [1, '#bdb096']]); g.fillStyle = 'rgba(80,60,44,0.4)'; for (let x = 0; x < WALL_W - 10; x += 48) g.fillRect(x, 550, 1.8, 10);
    g.fillStyle = OUT; g.fillRect(-10, 550, WALL_W, 2);
    // кусты и цветы вдоль стены
    for (let x = 30; x < 560; x += R.range(60, 110)) K.flowerBed(g, x, roadY - 4, R.range(30, 50), 600 + Math.round(x), { h: 18 });
  }
  function bench(g) {
    g.lineJoin = 'round';
    A.shadow(g, 4, 3, 60, 0.28);
    for (const x of [-48, 48]) { g.fillStyle = '#2c2c36'; g.fillRect(x - 4, -28, 8, 28); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(x - 4, -28, 8, 28); }
    A.box(g, -62, -38, 124, 12, { fill: A.linG(g, 0, -38, 0, -26, [[0, '#d09a62'], [1, '#8a5a34']]), lw: 2.8, hi: 'rgba(255,240,200,0.45)' });
    A.box(g, -62, -68, 124, 22, { fill: A.linG(g, 0, -68, 0, -46, [[0, '#c48a52'], [1, '#7a4a2a']]), lw: 2.8, hi: 'rgba(255,240,200,0.45)' });
    for (const x of [-52, 52]) { g.fillStyle = '#2c2c36'; g.fillRect(x - 3, -48, 6, 14); g.strokeRect(x - 3, -48, 6, 14); }
  }
  // Современный фонарь набережной: изогнутая мачта и плоская лампа, мягкое тёплое свечение
  function roadLamp(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -230); g.quadraticCurveTo(0, -262, 30, -262); g.stroke(); g.strokeStyle = '#3a4a52'; g.lineWidth = 5; g.stroke();
    A.box(g, -8, -10, 16, 10, { fill: '#2c3a40', lw: 2.4, r: 2 });
    A.box(g, 20, -270, 44, 12, { fill: A.linG(g, 0, -270, 0, -258, [[0, '#566a74'], [1, '#2a3a42']]), lw: 2.6, r: 5 });
    g.fillStyle = 'rgba(255,240,180,0.9)'; g.fillRect(26, -258, 32, 3);
  }

  // =================================================================== обрыв справа и вход в пещеру
  const CRACK = (cx, by) => [[cx - 30, by], [cx - 26, by - 40], [cx - 30, by - 84], [cx - 20, by - 124], [cx - 8, by - 152], [cx + 6, by - 164], [cx + 14, by - 146], [cx + 22, by - 108], [cx + 28, by - 66], [cx + 26, by - 30], [cx + 32, by]];
  function cliffRight(g, ox, cx, cy) {
    // ox — левый край слоя в мире; рисуем в координатах слоя, база обрыва — y = cy (верх камня F)
    g.lineJoin = 'round'; g.lineCap = 'round';
    const R = A.rng(88), W = 440;
    const edge = (y) => { const t = (cy - y) / (cy - 10); return 88 + 190 * Math.pow(Math.max(0, Math.min(1, t)), 0.9) + 14 * Math.sin(y * 0.05); };      // основание обрыва (≈ 96) стоит на камне F, а не нависает слева над водой: раньше левый нижний угол (x ≈ 40) висел на 56 юн. левее камня и обрывался плоским низом над морем
    const UP = -CLIFF_UP;                                                     // обрыв продолжается за верхний край кадра: раньше его плоская верхушка с обводкой и обрубок сосны висели на 10 юн. ниже края экрана
    const wall = () => { g.beginPath(); g.moveTo(edge(cy) - 6, cy + 34); for (let y = cy; y >= UP; y -= 12) g.lineTo(edge(y), y); g.lineTo(W, UP); g.lineTo(W, cy + 34); g.closePath(); };
    rockFill(g, wall, 0, UP, W, cy + 24 - UP, 91, { pal: ROCK, cracks: 40 + Math.round(CLIFF_UP / 12), lw: 3.4 });
    // уступы с растениями
    for (let k = 0; k < 7; k++) { const y = cy - 60 - k * 62 + R.range(-10, 10), x = edge(y) + R.range(14, 120); K.mound(g, x, y, R.range(22, 40), R.range(12, 20), K.OLIVE, 90 + k, { lw: 2.4 }); if (k % 2) agave(g, x + 40, y + 2, R.range(0.8, 1.1), 95 + k); }
    // сосны растут из уступов на склоне обрыва (раньше две стояли «на вершине» y = 30: кроны сидят на верхушке ствола и целиком уходили за верхний край кадра, оставался голый обрубок)
    for (const [y, dx, h, rx, sd] of [[236, 60, 100, 54, 81], [140, 120, 92, 48, 82]]) { const x = edge(y) + dx; K.mound(g, x, y + 4, 34, 15, K.OLIVE, 85 + sd, { lw: 2.4 }); K.pine(g, x, y, h, rx, sd, PINEP, { tw: 12 }); }
    // щель: тёмная, с неровными краями и мхом
    const pts = CRACK(cx - ox, cy);
    const crack = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
    crack(); g.fillStyle = A.linG(g, 0, cy - 170, 0, cy, [[0, '#0c0610'], [0.5, '#1c1220'], [1, '#2c1e2a']]); g.fill();
    g.save(); crack(); g.clip(); A.edge(g, cx - ox - 40, cy - 170, 80, 170, 'l', 24, 'rgba(0,0,0,0.5)'); A.edge(g, cx - ox - 40, cy - 170, 80, 170, 'r', 24, 'rgba(0,0,0,0.5)'); g.restore();
    crack(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,246,220,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(pts[1][0] - 2, pts[1][1]); for (let i = 2; i <= 4; i++) g.lineTo(pts[i][0] - 2, pts[i][1]); g.stroke();                       // светлая кромка слева
    for (let k = 0; k < 8; k++) { g.strokeStyle = '#3f7c3c'; g.lineWidth = 2; g.beginPath(); const x = cx - ox - 14 + k * 4, y = cy - 160 + Math.abs(k - 3.5) * 5; g.moveTo(x, y); g.quadraticCurveTo(x + R.range(-4, 4), y + 14, x + R.range(-6, 6), y + R.range(22, 40)); g.stroke(); }       // плющ над входом
    K.bougainvillea(g, cx - ox - 70, cy - 190, 40, 80, 99);
  }
  // Передний слой скалы у входа: валун справа от щели с агавами и нависающая над ней плита. Начало — (X.cave − ox, база)
  function frontRock(g) {
    g.lineJoin = 'round';
    const R = A.rng(93);
    const boulder = () => { g.beginPath(); g.moveTo(-8, 4); g.lineTo(-4, -60); g.quadraticCurveTo(-2, -128, 30, -156); g.quadraticCurveTo(70, -176, 110, -150); g.quadraticCurveTo(140, -120, 144, -60); g.lineTo(150, 4); g.closePath(); };
    rockFill(g, boulder, -8, -176, 160, 180, 94, { pal: ROCK_D, cracks: 8, lw: 3.4 });
    agave(g, 60, -158, 1.0, 96); agave(g, 104, -148, 0.8, 97); tuft(g, 24, -146, 1.1, 98);
    // нависающая плита над щелью (выше головы героини)
    const slab = () => { g.beginPath(); g.moveTo(-96, -204); g.lineTo(-90, -262); g.quadraticCurveTo(-40, -282, 22, -268); g.lineTo(30, -234); g.quadraticCurveTo(6, -208, -30, -200); g.quadraticCurveTo(-62, -194, -96, -204); g.closePath(); };
    g.fillStyle = 'rgba(40,24,24,0.3)'; g.beginPath(); g.ellipse(-34, -196, 70, 13, 0, 0, TAU); g.fill();
    rockFill(g, slab, -96, -282, 128, 84, 95, { pal: ['#f2dcb8', '#d6bb97', '#a58b74'], cracks: 3, lw: 3.2 });
    tuft(g, -70, -262, 1.0, 99);
  }

  // =================================================================== дали
  function ridge(g, w, base, amp, seed, col, o) {
    o = o || {};
    const R = A.rng(seed), f1 = R.range(0.0035, 0.006), f2 = R.range(0.011, 0.017), f3 = R.range(0.028, 0.05), p1 = R.range(0, 6), p2 = R.range(0, 6), p3 = R.range(0, 6);
    const prof = (x) => base - amp * (0.5 + 0.3 * Math.sin(x * f1 + p1) + 0.2 * Math.sin(x * f2 + p2) + 0.07 * Math.sin(x * f3 + p3));
    g.beginPath(); g.moveTo(0, base + 30); for (let x = 0; x <= w; x += 7) g.lineTo(x, prof(x)); g.lineTo(w, base + 30); g.closePath();
    g.fillStyle = A.linG(g, 0, base - amp, 0, base, [[0, col[0]], [1, col[1]]]); g.fill();
    if (o.gullies) { g.save(); g.clip(); g.strokeStyle = o.gullies; g.lineWidth = 1.5; g.lineCap = 'round'; for (let x = 4; x < w; x += R.range(9, 20)) { const y = prof(x); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + R.range(-8, 16), y + R.range(26, 90)); g.stroke(); } g.restore(); }
    if (o.rim) { g.strokeStyle = o.rim; g.lineWidth = 1.8; g.beginPath(); for (let x = 0; x <= w; x += 7) { if (x) g.lineTo(x, prof(x)); else g.moveTo(x, prof(x)); } g.stroke(); }
  }
  function sail(g, x, y, s, seed) {
    const R = A.rng(seed), line = mix(OUT, HAZE, 0.5);
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-26, -7); g.quadraticCurveTo(0, -4, 28, -8); g.lineTo(22, 0); g.lineTo(-20, 0); g.closePath(); g.fillStyle = mix('#fbf8f0', HAZE, 0.2); g.fill(); g.lineWidth = 1.4; g.strokeStyle = line; g.stroke();
    g.strokeStyle = mix('#8a7a6a', HAZE, 0.2); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -7); g.lineTo(0, -58); g.stroke();
    g.fillStyle = mix('#f6f2e8', HAZE, 0.12); g.beginPath(); g.moveTo(2, -10); g.lineTo(2, -54); g.lineTo(24, -11); g.closePath(); g.fill(); g.lineWidth = 1; g.strokeStyle = line; g.stroke();
    g.fillStyle = mix(R.pick(['#d84a3a', '#2a6ab0', '#f0b030']), HAZE, 0.2); g.beginPath(); g.moveTo(-2, -12); g.lineTo(-2, -46); g.lineTo(-18, -12); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  function vistaLayer(w, h) {
    return A.layer(w, h, (g) => {
      g.translate(0, -VY);
      const R = A.rng(33);
      // дальние горы и берег с белыми домиками
      ridge(g, w, HZ + 4, 150, 31, ['#b4bde0', '#f0e2d6'], { rim: 'rgba(255,238,206,0.5)', gullies: 'rgba(96,108,166,0.13)' });
      ridge(g, w, HZ + 6, 86, 32, ['#9eaed4', '#ecdcce'], { rim: 'rgba(255,230,190,0.55)', gullies: 'rgba(92,104,160,0.14)' });
      for (let x = 0; x < w; x += R.range(8, 16)) { const bw = R.range(7, 15), bh = R.range(4, 12); g.fillStyle = mix(R.pick(['#f6e4cc', '#f1d3b0', '#eab99a', '#fbf4e4']), HAZE, 0.45); g.fillRect(x, HZ + 3 - bh, bw, bh + 2); }
      // солнце: тёплое, низкое, с ореолом, и золотая дорожка по воде
      const sx = w * 0.3, sy = 318;
      A.glow(g, sx, sy, 330, 'rgba(255,214,150,', 0.55); A.glow(g, sx, sy, 130, 'rgba(255,238,190,', 0.75);
      g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(sx, sy, 30, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(sx, sy, 22, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,214,140,0.5)'; g.fillRect(0, HZ - 1, w, 2.4);
      g.save(); g.beginPath(); g.moveTo(sx - 26, HZ); g.lineTo(sx + 26, HZ); g.lineTo(sx + 150, VY + 390); g.lineTo(sx - 150, VY + 390); g.closePath(); g.clip();
      g.fillStyle = A.linG(g, 0, HZ, 0, VY + 390, [[0, 'rgba(255,244,200,0.6)'], [0.5, 'rgba(255,226,160,0.28)'], [1, 'rgba(255,214,140,0.1)']]); g.fillRect(sx - 160, HZ, 320, 400); g.restore();
      // паруса вдали
      for (const [x, y, s] of [[w * 0.12, HZ + 14, 0.6], [w * 0.5, HZ + 22, 0.7], [w * 0.62, HZ + 12, 0.5], [w * 0.84, HZ + 28, 0.82], [w * 0.95, HZ + 16, 0.55]]) sail(g, x, y, s, Math.round(x));
    }, dens(1.5));
  }
  // Скалистые островки с пиниями (параллакс 0,45)
  function midLayer(w, h) {
    return A.layer(w, h, (g) => {
      g.translate(0, -MID_Y);
      const R = A.rng(45), base = 566;
      for (const [x, ww, hh, sd] of [[260, 190, 120, 1], [820, 150, 86, 2], [1300, 230, 150, 3], [1760, 140, 96, 4]]) {
        const body = () => { g.beginPath(); g.moveTo(x - ww / 2, base + 10); g.lineTo(x - ww * 0.44, base - hh * 0.5); g.quadraticCurveTo(x - ww * 0.3, base - hh * 0.98, x - ww * 0.04, base - hh); g.quadraticCurveTo(x + ww * 0.2, base - hh * 1.02, x + ww * 0.38, base - hh * 0.55); g.lineTo(x + ww / 2, base + 10); g.closePath(); };
        rockFill(g, body, x - ww / 2, base - hh, ww, hh + 10, 400 + sd, { pal: ['#dfd0b6', '#bba68c', '#8c7c70'].map((c) => mix(c, HAZE, 0.2)), cracks: 4, lw: 2.2, line: mix(OUT, HAZE, 0.3) });
        K.pine(g, x - ww * 0.1, base - hh + 8, R.range(34, 50), R.range(22, 30), 410 + sd, hazed(PINEP, 0.2, HAZE), { tw: 8, line: mix(OUT, HAZE, 0.3) });
        if (ww > 160) K.pine(g, x + ww * 0.18, base - hh * 0.62, R.range(26, 38), 20, 420 + sd, hazed(PINEP, 0.2, HAZE), { tw: 6, line: mix(OUT, HAZE, 0.3) });
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(x, base + 6, ww * 0.54, 5, 0, 0, TAU); g.fill();
      }
      A.edge(g, 0, base - 30, w, 60, 'b', 60, 'rgba(255,240,214,0.2)');
      if (paintImg()) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(112,72,120,0.3)'; g.fillRect(0, MID_Y, w, h); g.globalCompositeOperation = 'source-over'; }       // на картине солнце за островками: они темнее и теплее фиолетовые, а не ровный камень
    }, dens(1.4));
  }
  function skyClouds(w, h) {
    return K.skyLayer(w, h, 12, w * 0.3, 250);
  }

  // =================================================================== вода переднего плана, пена, свет пещеры
  // Вода переднего плана (z = 90): прозрачное тело с волнистой кромкой по линии sc.coast.waterY, светлый гребень, пена у камней и блики; закрывает нижнюю часть китёныша и боков камней
  function drawWater(ctx, sc, X, t) {
    const wy = (sc.coast && sc.coast.waterY) || X.waterY, cam = sc.lastCam || { x: 0 }, x0 = cam.x - 40, w = sc.game.viewW + 80, H = 140;
    const surf = (x) => wy + Math.sin(x * 0.045 + t * 2) * 2.4 + Math.sin(x * 0.11 - t * 1.3) * 1.4;
    const gr = ctx.createLinearGradient(0, wy - 6, 0, wy + H);
    gr.addColorStop(0, 'rgba(96,196,230,0.58)'); gr.addColorStop(0.3, 'rgba(48,146,204,0.76)'); gr.addColorStop(1, 'rgba(22,86,152,0.94)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x0, wy + H); ctx.lineTo(x0, surf(x0));
    for (let x = x0; x <= x0 + w; x += 16) ctx.lineTo(x, surf(x));
    ctx.lineTo(x0 + w, wy + H); ctx.closePath(); ctx.fill();
    // светлый гребень волны и тонкая тень под ним
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(232,250,255,0.85)'; ctx.lineWidth = 2.4; ctx.beginPath(); for (let x = x0; x <= x0 + w; x += 16) { if (x > x0) ctx.lineTo(x, surf(x)); else ctx.moveTo(x, surf(x)); } ctx.stroke();
    ctx.strokeStyle = 'rgba(20,80,140,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = x0; x <= x0 + w; x += 16) { if (x > x0) ctx.lineTo(x, surf(x) + 5); else ctx.moveTo(x, surf(x) + 5); } ctx.stroke();
    // блики на поверхности: короткие светлые штрихи
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 18; i++) { const ph = t * (0.7 + hash(i) * 0.8) + i * 3.1; if (Math.sin(ph) < 0.3) continue; const x = x0 + hash(i * 5.3) * w, y = wy + 10 + hash(i * 2.9) * 58, len = 7 + hash(i * 1.7) * 12; ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); }
    ctx.stroke();
    // пена: у боков камней и вдоль линии воды на их передней грани
    ctx.fillStyle = 'rgba(250,254,255,0.78)'; ctx.beginPath();
    X.stones.forEach((s, i) => {
      if (s[1] < x0 - 30 || s[0] > x0 + w + 30) return;
      for (const [ex, d] of [[s[0], -1], [s[1], 1]]) for (let k = 0; k < 4; k++) {
        const ph = t * 1.5 + i * 1.3 + k * 1.9, rx = 7 + 5 * Math.sin(ph) + k * 1.6, cx = ex + d * (rx * 0.5 + 3 * Math.sin(ph * 0.8)), cy = surf(cx) + 2 + k * 0.6;
        ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, 2.8 + k * 0.3, 0, 0, TAU);
      }
      const n = Math.max(2, Math.round((s[1] - s[0]) / 36));
      for (let k = 0; k < n; k++) { const ph = t * 1.2 + i * 2.1 + k * 2.7, fx = s[0] + (k + 0.5) * (s[1] - s[0]) / n + 6 * Math.sin(ph), rx = 9 + 3 * Math.sin(ph * 1.3); ctx.moveTo(fx + rx, surf(fx) + 1); ctx.ellipse(fx, surf(fx) + 1, rx, 2.4, 0, 0, TAU); }
    });
    ctx.fill();
  }
  // Свет из щели, когда путь найден: тёплое сияние внутри, пятно на камне F, мягкий ореол и пылинки в луче
  function drawCaveLight(ctx, X, top, k, t) {
    const cx = X.cave, pts = CRACK(cx, top);
    ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.clip();
    const gr = ctx.createLinearGradient(0, top - 170, 0, top);
    gr.addColorStop(0, 'rgba(255,252,214,' + k.toFixed(3) + ')'); gr.addColorStop(0.5, 'rgba(255,214,110,' + k.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,150,60,' + k.toFixed(3) + ')');
    ctx.fillStyle = gr; ctx.fillRect(cx - 40, top - 170, 80, 172);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * k * (0.8 + 0.2 * Math.sin(t * 2.2))).toFixed(3) + ')'; ctx.fillRect(cx - 8, top - 150, 16, 150);
    A.edge(ctx, cx - 36, top - 170, 72, 170, 'l', 14, 'rgba(120,60,10,0.4)'); A.edge(ctx, cx - 36, top - 170, 72, 170, 'r', 14, 'rgba(120,60,10,0.4)');
    ctx.restore();
    A.glow(ctx, cx, top - 90, 230, 'rgba(255,206,110,', 0.6 * k * (0.88 + 0.12 * Math.sin(t * 2.2)));
    A.glow(ctx, cx, top - 70, 90, 'rgba(255,246,196,', 0.7 * k);
    ctx.save(); ctx.translate(cx, top + 4); ctx.scale(1, 0.14); A.glow(ctx, 0, 0, 120, 'rgba(255,224,150,', 0.55 * k); ctx.restore();                           // пятно света на камне
    A.beam(ctx, cx, top - 30, 40, cx - 90, top + 4, 140, 0.16 * k, 'rgba(255,230,160,');
    ctx.fillStyle = 'rgba(255,248,214,' + (0.8 * k).toFixed(3) + ')'; ctx.beginPath();
    for (let i = 0; i < 9; i++) { const u = (t * (0.06 + 0.02 * (i % 3)) + i * 0.137) % 1, x = cx + (hash(i * 3.1) - 0.5) * 70 + Math.sin(t * 0.8 + i) * 8, y = top - 10 - u * 150; ctx.moveTo(x + 1.5, y); ctx.arc(x, y, 1.2 + (i % 2) * 0.5, 0, TAU); }
    ctx.fill();
  }

  // =================================================================== сборка
  MA.coastPaint = PAINT;                                          // для проверок: где в картине горизонт и солнце
  MA.coastLayers = guard('coastLayers', function (game, WIDTH, X) {
    const painted = !!paintImg();
    const sky = painted ? null : skyClouds(par(WIDTH, 0.06), 300);
    const vista = painted ? null : vistaLayer(par(WIDTH, 0.2), 420);
    const mid = midLayer(par(WIDTH, 0.45), 290);
    const wy = X.waterY;
    const stones = X.stones.map((s, i) => { const kind = i === 0 ? 'quay' : i < 3 ? 'step' : 'rock'; return sprite(s[1] - s[0] + 60, 770 - s[2] + 60, 30, 30, dens(1.6), (g) => drawStone(g, s, i, kind, wy)); });
    const hill = sprite(830, 760, 20, 40, dens(1.5), hillLeft);                 // скала склона уходит вниз до y = 700 за ступенями и в воду: при высоте 590 нижний край обрезался плоской линией над морем («язык» повис над водой); 40 сверху — кроны сосен у виллы упирались в верх слоя
    const top = X.stones[X.stones.length - 1][2], ox = X.cave - 270;
    const cliff = sprite(450, top + 60 + CLIFF_UP, 0, CLIFF_UP, dens(1.5), (g) => cliffRight(g, ox, X.cave, top));
    return { sky, vista, mid, stones, hill, cliff, cliffOx: ox };
  });
  MA.coastBack = guard('coastBack', function (ctx, cam, game, sc, L) {
    const W = game.viewW, H = game.viewH, t = sc.time, X = Ale.COAST;
    const im = paintImg();
    if (im) { ctx.fillStyle = '#9fb4e6'; ctx.fillRect(0, 0, W, H); ctx.drawImage(im, -cam.x * PAINT.par, HZ - PAINT.hz); }
    else { K.skyFill(ctx, W, H); if (L.sky) A.blitView(ctx, L.sky, -cam.x * 0.06, 0, W); }
    // чайки: медленно плывут по небу, взмахи по времени
    ctx.strokeStyle = 'rgba(43,26,32,0.8)'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const sp = 14 + i * 5, span = W + 300, x = ((i * 260 + t * sp) % span) - 150, y = 150 + i * 36 + Math.sin(t * 0.6 + i * 2) * 14, f = Math.sin(t * (6 + i) + i), sz = 6 + (i % 2) * 2;
      ctx.moveTo(x - sz * 1.6, y + f * 3); ctx.quadraticCurveTo(x - sz * 0.7, y - sz * 0.8 - f * 3, x, y); ctx.quadraticCurveTo(x + sz * 0.7, y - sz * 0.8 - f * 3, x + sz * 1.6, y + f * 3);
    }
    ctx.stroke();
    if (!im) {
      A.blitView(ctx, L.vista, -cam.x * 0.2, VY, W);
      // море от горизонта до низа кадра (градиент на кадр: дёшево)
      A.gradV(ctx, 0, HZ, W, H - HZ, [[0, '#b2eaee'], [0.03, '#86d6e6'], [0.14, '#58bce0'], [0.45, '#2e90cc'], [1, '#1d6aaa']]);
    }
    // блики на воде в солнечной дорожке (у картины — поверх её дорожки, уже и реже)
    { const ox = -cam.x * 0.2 + (im ? PAINT.sunX : 0.3 * par(X.width, 0.2)), wk = im ? 0.5 : 1.1;
      ctx.strokeStyle = 'rgba(255,250,224,0.9)'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const u = hash(i * 3.7), v = hash(i * 7.3 + 1.1), ph = t * (0.8 + hash(i) * 0.9) + i * 2.3;
        if (Math.sin(ph) < (im ? 0.35 : 0.15)) continue;
        const y = HZ + 6 + v * v * 232, x = ox + (u - 0.5) * ((im ? 60 : 110) + (y - HZ) * wk), len = 5 + (y - HZ) * 0.12;
        if (x < -20 || x > W + 20) continue;
        ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
      }
      ctx.stroke(); }
    A.blitView(ctx, L.mid, -cam.x * 0.45, MID_Y, W);
    A.beam(ctx, W * 0.1, -30, 120, W * 0.1 + 380, 620, 260, 0.05, 'rgba(255,238,190,'); A.beam(ctx, W * 0.4, -30, 90, W * 0.4 + 330, 620, 200, 0.035, 'rgba(255,238,190,');
    // мир: склон с дорогой, обрыв, камни
    if (cam.x < 840) L.hill(ctx, -cam.x, 0);
    if (cam.x + W > L.cliffOx - 20) L.cliff(ctx, L.cliffOx - cam.x, 0);
    X.stones.forEach((s, i) => { if (s[1] > cam.x - 40 && s[0] < cam.x + W + 40) L.stones[i](ctx, s[0] - cam.x, s[2]); });
  });
  MA.coastDecor = guard('coastDecor', function (X, sc) {
    const out = [];
    const SK = X.stones, topF = SK[SK.length - 1][2], RD = X.road - 8;
    const put = (name, ax, ay, z, hw, w, h, ox, oy, scale, fn, shadow) => { const spr = sprite(w, h, ox, oy, scale, fn); deco(out, sc, name, ax, z, hw, (ctx) => { if (shadow) A.shadow(ctx, ax, ay + 2, shadow[0], shadow[1]); spr(ctx, ax, ay); }); return spr; };
    put('bench', 372, RD + 2, 14, 80, 150, 90, 75, 82, dens(1.7), bench);
    for (const lx of [64, 488]) { const ls = sprite(110, 300, 40, 290, dens(1.7), roadLamp); deco(out, sc, 'roadLamp', lx, 14, 70, (ctx, t) => { A.shadow(ctx, lx, RD + 2, 18, 0.3); ls(ctx, lx, RD); A.glow(ctx, lx + 42, RD - 262, 70, 'rgba(255,230,160,', 0.3 + 0.05 * Math.sin(t * 3 + lx)); }); }
    // перила вдоль ступеней: стойки на каждой ступени и поручень по ломаной (позади героини)
    deco(out, sc, 'stepRail', 650, 15, 130, (ctx) => {
      const pts = [[560, 584], [620, 584], [660, 606], [726, 606]].map(([x, y]) => [x, y - 4 - 58]);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = '#3a4a52'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 1.4) : ctx.moveTo(x, y - 1.4))); ctx.stroke();
      for (const [x, y] of pts) { ctx.strokeStyle = OUT; ctx.lineWidth = 6.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 58); ctx.stroke(); ctx.strokeStyle = '#3a4a52'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#e8c04a'; ctx.beginPath(); ctx.arc(x, y - 2, 3.4, 0, TAU); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke(); }
    });
    // свет пещеры (поверх обрыва, позади героини)
    deco(out, sc, 'caveLight', X.cave, 7, 220, (ctx, t) => { const k = sc.coast ? Math.max(0, Math.min(1, sc.coast.caveGlow || 0)) : 0; if (k > 0.001) drawCaveLight(ctx, X, topF, k, t); });
    return out;
  });
  MA.coastFront = guard('coastFront', function (X, sc) {
    const out = [], topF = X.stones[X.stones.length - 1][2];
    const fr = sprite(300, 480, 110, 440, dens(1.6), frontRock);
    deco(out, sc, 'frontRock', X.cave + 80, 60, 180, (ctx) => fr(ctx, X.cave + 20, topF + 8));
    out.push({ x: 0, z: 90, name: 'water', draw: guard('water', (ctx, t) => drawWater(ctx, sc, X, t)) });
    return out;
  });
})();
