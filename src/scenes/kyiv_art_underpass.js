// Киев: подземный переход от выхода метро к парку (сцена kyivApproach, src/scenes/kyiv_approach.js). Рисуется кодом, один статичный слой 2700×720 юнитов.
// Контракт: KA.underpass(g, w, h, X) рисует весь фон в слой w×h юнитов (X — Ale.KYIV_APPROACH: kiosks, stairs, ...); KA.underpassProps(X) возвращает слои низких препятствий { bags, kiosk, cart, bin }.
// Устройство кадра: герои идут по y = 600 на фоне стены; нижняя стена и пол (y 400–600) спокойные, середней яркости, чтобы герои и тараканы читались; детали, вывески и свет — выше и дальше.
// Слева — зал у выхода из метро (арка и лестница вниз, синяя «М», схема линий), посередине — коридор с киосками «КАВА», «КВІТИ», «ПРЕСА», «ТЕЛЕФОНИ», афишами и мозаикой с киевскими каштанами и куполами,
// справа — лестница наверх к дневному свету (кроны каштанов и красный корпус, как в парке). Все надписи — украинские. Вся случайность — только A.rng (детерминизм).
// Порядок рисования: потолок → плитка, фриз, цоколь, карниз → пол с лужами и мусором → арка метро и лестница на улицу → киоски → вывески, афиши, мозаика → мелочи, сколы, наклейки → отражение в граните → свет.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const WALL = 584;                                                                  // линия, где стена встречает пол (герои ходят по y = 600, на сцене FY)

  const KA = (Ale.KyivArt = Ale.KyivArt || {});

  // ---- разметка по высоте (юниты слоя): потолок, карниз, плитка, фриз, цоколь
  const CEIL = 196, TOP = 214, BAND0 = 382, BAND1 = 414, PLINTH = 498;
  const LAMPS = [62, 325, 540, 760, 985, 1210, 1425, 1640, 1850, 2060, 2270];       // светильники в ряд (над киосками — над 760, 1210, 1640)
  const BEAMS = [432, 872, 1317, 1745, 2165];                                         // поперечные балки потолка
  const CREAM = ['#ece0c0', '#e8dab6', '#efe5ca', '#e5d6ae'];                         // глазурованная плитка верха стены
  const SAND = ['#d9c493', '#d3bc89', '#decc9c', '#cfb785'];                          // нижняя плитка чуть темнее и теплее: на ней читаются светлая кофта и белые кроссовки
  const GROUT = '#ad9a76';
  const STAIR = { l: 2308, r: 2692 };                                                 // проём лестницы на улицу: задаётся в KA.underpass по X.stairs (2380 − 72), выход X.exit = 2560 попадает в его правую половину

  // ---------------------------------------------------------------- общие помощники
  const lerp = (a, b, t) => a + (b - a) * t;
  function rgbOf(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hex(p) { return '#' + p.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const p = rgbOf(a), q = rgbOf(b); return hex(p.map((v, i) => v + (q[i] - v) * t)); }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  // Надпись, сжатая по ширине, если не влезает в maxW.
  function fit(g, str, cx, cy, maxW, size, fill, o) {
    o = o || {};
    g.save(); g.font = (o.weight || 'bold') + ' ' + size + 'px ' + Ale.FONT;
    const k = Math.min(1, maxW / g.measureText(str).width);
    g.translate(cx, cy); g.scale(k, 1); A.text(g, str, 0, 0, size, fill, o); g.restore();
  }
  // Мягкая тень предмета, висящего перед стеной.
  function hangShadow(g, x, y, w, h, a) {
    for (let i = 3; i >= 1; i--) { g.fillStyle = 'rgba(46,28,24,' + (a / 3).toFixed(3) + ')'; A.rrPath(g, x - i * 2 + 3, y - i + 6, w + i * 4, h + i * 4, 6 + i * 2); g.fill(); }
  }
  // Светящийся эллипс (свет лампы на стене и на полу): kx, ky — растяжение по осям.
  function pool(g, x, y, r, kx, ky, color, a) { g.save(); g.translate(x, y); g.scale(kx, ky); A.glow(g, 0, 0, r, color, a); g.restore(); }

  // ---------------------------------------------------------------- глазурованная плитка «кабанчик»
  // Ряды вразбежку; у каждой плитки свой тон, фаска света сверху-слева и тень снизу-справа, швы затёрты.
  function tileField(g, x0, y0, x1, y1, tw, th, cols, seed, grout) {
    const R = A.rng(seed || 3);
    g.fillStyle = grout || GROUT; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let r = 0, y = y0; y < y1 - 0.5; r++, y += th) {
      const off = (r % 2) * tw / 2;
      for (let x = x0 - off; x < x1; x += tw) {
        const bx = Math.max(x0, x + 1), bw = Math.min(x1, x + tw - 1) - bx, by = y + 1, bh = Math.min(th - 2, y1 - y - 1);
        if (bw <= 0.5 || bh <= 0.5) continue;
        g.fillStyle = cols[(R.next() * cols.length) | 0]; g.fillRect(bx, by, bw, bh);
        const t = R.next();
        if (t < 0.2) { g.fillStyle = 'rgba(255,250,225,0.12)'; g.fillRect(bx, by, bw, bh); }
        else if (t < 0.38) { g.fillStyle = 'rgba(120,85,40,0.08)'; g.fillRect(bx, by, bw, bh); }
        g.fillStyle = 'rgba(255,255,240,0.34)'; g.fillRect(bx, by, bw, 1.6); g.fillRect(bx, by, 1.6, bh);
        g.fillStyle = 'rgba(90,60,30,0.2)'; g.fillRect(bx, by + bh - 1.6, bw, 1.6); g.fillRect(bx + bw - 1.6, by, 1.6, bh);
      }
    }
  }

  // ---------------------------------------------------------------- потолок
  // mode: undefined — горит, 'half' — горит половина трубок, 'dead' — перегорела
  function lamp(g, cx, y, len, mode) {
    const l = cx - len / 2;
    if (mode !== 'dead') { pool(g, cx, y + 10, len * 0.8, 1.25, 0.55, 'rgba(255,238,188,', mode === 'half' ? 0.4 : 0.7); }
    g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(l + 16, y - 14); g.lineTo(l + 16, y + 2); g.moveTo(l + len - 16, y - 14); g.lineTo(l + len - 16, y + 2); g.stroke();
    A.box(g, l, y, len, 17, { fill: '#d2ccc0', lw: 3, r: 4, hi: 'rgba(255,255,255,0.5)', lo: 'rgba(0,0,0,0.16)' });
    const lit = A.linG(g, 0, y + 3, 0, y + 14, [[0, '#fffef2'], [1, '#ffeeb0']]);
    g.fillStyle = mode === 'dead' ? '#b4ab9c' : mode === 'half' ? '#b4ab9c' : lit; A.rrPath(g, l + 7, y + 3.6, len - 14, 9.6, 3); g.fill();
    if (mode === 'half') { g.save(); A.rrPath(g, l + 7, y + 3.6, len - 14, 9.6, 3); g.clip(); g.fillStyle = lit; g.fillRect(l + len / 2, y + 3, len / 2, 12); g.restore(); }
    g.fillStyle = 'rgba(40,28,24,0.55)'; for (let x = l + 7 + (len - 14) / 4; x < l + len - 8; x += (len - 14) / 4) g.fillRect(x - 0.7, y + 3.6, 1.4, 9.6);   // трубки люминесцентных ламп
  }

  function tray(g, W, y, h) {
    // кабельный лоток вдоль стены: сетка, пучки кабелей, подвесы к потолку
    g.strokeStyle = OUT; g.lineWidth = 2.4;
    for (let x = 60; x < W; x += 150) { g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x, y + 1); g.stroke(); g.fillStyle = '#9a9ca6'; g.fillRect(x - 5, y - 4, 10, 5); }
    A.gradV(g, 0, y, W, h, [[0, '#6b6c76'], [1, '#3f4048']]);
    g.save(); g.beginPath(); g.rect(0, y, W, h); g.clip();
    g.strokeStyle = 'rgba(12,12,20,0.5)'; g.lineWidth = 1.1;
    for (let x = 0; x < W; x += 6) { g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y + h - 2); g.stroke(); }
    for (const [dy, col, lw] of [[5, '#1c1a20', 4.4], [10.5, '#8a8d98', 3.4], [14.5, '#8a3a34', 2.6]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, y + dy); g.lineTo(W, y + dy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, y + 2, W, 1.6);
    g.restore();
    g.fillStyle = OUT; g.fillRect(0, y, W, 2.6); g.fillRect(0, y + h - 2.2, W, 2.6);
  }

  function beam(g, x) {
    // поперечная бетонная балка: цилиндрическое освещение, торец на стене
    const w = 46, l = x - w / 2;
    g.fillStyle = A.linG(g, l, 0, l + w, 0, [[0, '#a3938c'], [0.22, '#86797a'], [1, '#4d434b']]); g.fillRect(l, 0, w, CEIL + 4);
    g.save(); g.beginPath(); g.rect(l, 0, w, CEIL + 4); g.clip(); A.grain(g, l, 0, w, CEIL + 4, 0.28, 'overlay', 61 + (x % 9)); g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2.8; g.beginPath(); g.moveTo(l, 0); g.lineTo(l, CEIL); g.moveTo(l + w, 0); g.lineTo(l + w, CEIL); g.stroke();
  }

  // Торец балки, спускающийся на стену перед карнизом: балка выступает, под ней на плитку ложится тень.
  function beamEnd(g, x) {
    const w = 52, l = x - w / 2;
    A.edge(g, l - 6, TOP + 14, w + 12, 30, 't', 30, 'rgba(40,24,16,0.34)');
    A.box(g, l, CEIL - 4, w, 36, { fill: '#8d807c', lw: 3, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.2)' });
    g.fillStyle = A.linG(g, l, 0, l + w, 0, [[0, 'rgba(255,255,255,0.18)'], [0.3, 'rgba(255,255,255,0)'], [1, 'rgba(20,10,20,0.3)']]); g.fillRect(l + 1.5, CEIL - 2.5, w - 3, 33);
    g.save(); g.beginPath(); g.rect(l, CEIL - 4, w, 36); g.clip(); A.grain(g, l, CEIL - 4, w, 36, 0.3, 'overlay', 62); g.restore();
  }

  function ceiling(g, W) {
    A.gradV(g, 0, 0, W, CEIL, [[0, '#2f2830'], [0.45, '#5c515a'], [1, '#8f827c']]);
    g.save(); g.beginPath(); g.rect(0, 0, W, CEIL); g.clip();
    A.blotches(g, 0, 0, W, CEIL, 30, 71, 'rgba(18,8,22,', 'rgba(255,232,196,');
    A.grain(g, 0, 0, W, CEIL, 0.2, 'overlay', 72);
    // панельный потолок: ряды сгущаются к стене (перспектива), панели шириной 66; у каждой свой тон, фаска света сверху-слева
    const R = A.rng(73), rows = [0, 40, 88, 124, 150, 170, 186, CEIL];
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = rows[r], hh = rows[r + 1] - y0;
      for (let x = -((r * 29) % 66); x < W; x += 66) {
        const t = R.next();
        g.fillStyle = t < 0.3 ? 'rgba(255,240,220,0.07)' : t < 0.6 ? 'rgba(20,10,30,0.09)' : 'rgba(0,0,0,0)'; g.fillRect(x, y0, 66, hh);
        g.fillStyle = 'rgba(255,245,230,0.12)'; g.fillRect(x + 1, y0 + 1, 64, 1.4); g.fillRect(x + 1, y0 + 1, 1.4, hh - 1);
      }
    }
    g.strokeStyle = 'rgba(24,12,28,0.34)'; g.lineWidth = 1.6;
    for (const y of rows.slice(1, 7)) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let r = 0; r < rows.length - 1; r++) for (let x = -((r * 29) % 66); x < W; x += 66) { g.beginPath(); g.moveTo(x, rows[r]); g.lineTo(x, rows[r + 1]); g.stroke(); }
    g.restore();
    // воздуховод вверху кадра, ближе к зрителю: фланцы через каждые 180
    A.gradV(g, 0, -4, W, 52, [[0, '#3d3d46'], [0.55, '#6c6c76'], [1, '#52525c']]);
    for (let x = 90; x < W; x += 180) { A.box(g, x - 8, -4, 16, 54, { fill: '#7c7c86', lw: 2.6, hi: 'rgba(255,255,255,0.25)' }); }
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 8, W, 2); g.fillStyle = OUT; g.fillRect(0, 47, W, 3);
    A.edge(g, 0, 50, W, 26, 't', 26, 'rgba(12,6,16,0.4)');
    // труба с хомутами
    A.box(g, -4, 66, W + 8, 9, { fill: '#8d929b', lw: 2.6, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.2)' });
    for (let x = 40; x < W; x += 110) A.box(g, x, 63, 8, 15, { fill: '#5a5e68', lw: 2.2 });
    tray(g, W, 164, 20);
    for (const x of BEAMS) beam(g, x);
    for (const x of LAMPS) lamp(g, x, 120, 124, x === 1425 ? 'dead' : x === 540 ? 'half' : undefined);
  }

  // ---------------------------------------------------------------- стена: карниз, фриз, цоколь
  function cornice(g, W) {
    A.gradV(g, 0, CEIL, W, TOP - CEIL, [[0, '#d3ccc0'], [1, '#9f978c']]);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, CEIL + 3, W, 2);
    g.fillStyle = OUT; g.fillRect(0, CEIL - 1, W, 2.8); g.fillRect(0, TOP - 2, W, 3);
    A.grain(g, 0, CEIL, W, TOP - CEIL, 0.2, 'overlay', 63);
    A.edge(g, 0, TOP, W, 36, 't', 36, 'rgba(60,40,24,0.36)');
  }

  function band(g, W) {
    // фриз: синяя глазурованная плитка с жёлтыми полосами и ромбовым узором (цвета флага тихо присутствуют в стене)
    const y0 = BAND0, y1 = BAND1, m = (y0 + y1) / 2;
    A.gradV(g, 0, y0, W, y1 - y0, [[0, '#4a73b8'], [0.5, '#2f5aa0'], [1, '#234684']]);
    g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip();
    for (let x = 0; x < W; x += 32) {
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 31, y0, 1.6, y1 - y0);
      g.fillStyle = '#f0c648'; g.beginPath(); g.moveTo(x + 16, m - 8); g.lineTo(x + 24, m); g.lineTo(x + 16, m + 8); g.lineTo(x + 8, m); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 8, m - 0.8, 4, 1.6);
    }
    g.fillStyle = '#f0c648'; g.fillRect(0, y0 + 3, W, 2.4); g.fillRect(0, y1 - 5.4, W, 2.4);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y0 + 1, W, 1.6);
    A.grain(g, 0, y0, W, y1 - y0, 0.2, 'overlay', 64);
    g.restore();
    g.fillStyle = OUT; g.fillRect(0, y0 - 1, W, 2.8); g.fillRect(0, y1 - 1.4, W, 2.8);
  }

  function plinth(g, W) {
    // гранитный цоколь: плиты со стыками, полированный блик, крапинки; сверху полка, внизу плинтус
    const y0 = PLINTH, y1 = WALL, R = A.rng(21);
    A.gradV(g, 0, y0, W, y1 - y0, [[0, '#947f8a'], [1, '#6f5e69']]);
    g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip();
    for (let x = -R.range(0, 100); x < W;) {
      const sw = R.range(120, 190);
      g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(30,10,30,0.08)'; g.fillRect(x, y0 + 10, sw, y1 - y0 - 18);
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(x + sw * 0.18, y1 - 8); g.lineTo(x + sw * 0.4, y0 + 10); g.lineTo(x + sw * 0.56, y0 + 10); g.lineTo(x + sw * 0.34, y1 - 8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(28,12,28,0.6)'; g.fillRect(x + sw - 1, y0 + 8, 2, y1 - y0 - 8);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + sw + 1, y0 + 8, 1.2, y1 - y0 - 8);
      x += sw;
    }
    for (let i = 0; i < W * (y1 - y0) / 70; i++) { g.fillStyle = i % 2 ? 'rgba(255,240,240,0.2)' : 'rgba(25,10,25,0.24)'; g.fillRect(R.range(0, W), R.range(y0, y1), 1.3, 1.3); }
    A.grain(g, 0, y0, W, y1 - y0, 0.22, 'overlay', 65);
    g.restore();
    A.box(g, -4, y0, W + 8, 10, { fill: '#ad97a1', lw: 3, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.2)' });
    A.box(g, -4, y1 - 9, W + 8, 9, { fill: '#4f4048', lw: 2.6, hi: 'rgba(255,255,255,0.12)' });
  }

  // Живопись по плитке: зерно, тёплые и холодные пятна, косые блики глазури, потемнение у карниза и у цоколя.
  function wallFinish(g, W) {
    g.save(); g.beginPath(); g.rect(0, TOP, W, PLINTH - TOP); g.clip();
    A.grain(g, 0, TOP, W, PLINTH - TOP, 0.16, 'overlay', 6);
    A.blotches(g, 0, TOP, W, PLINTH - TOP, Math.round(W / 170), 24, 'rgba(255,170,90,', 'rgba(230,240,255,');
    const zone = g.createLinearGradient(0, 0, W, 0);
    zone.addColorStop(0, 'rgba(190,206,232,0.14)'); zone.addColorStop(0.22, 'rgba(190,206,232,0.04)'); zone.addColorStop(0.38, 'rgba(255,200,120,0.05)'); zone.addColorStop(0.78, 'rgba(255,196,110,0.04)'); zone.addColorStop(1, 'rgba(255,252,230,0.15)');
    g.fillStyle = zone; g.fillRect(0, TOP, W, PLINTH - TOP);
    for (const x of [260, 640, 1010, 1380, 1760, 2120, 2480]) { g.fillStyle = 'rgba(255,255,248,0.07)'; poly(g, [[x, TOP], [x + 46, TOP], [x - 40, PLINTH], [x - 86, PLINTH]]); g.fill(); g.fillStyle = 'rgba(255,255,248,0.045)'; poly(g, [[x + 60, TOP], [x + 80, TOP], [x - 6, PLINTH], [x - 26, PLINTH]]); g.fill(); }
    g.restore();
  }

  // Потёки, пятна влаги и грязь на плитке: лёгкие, чтобы не мешать героям.
  function grime(g, W) {
    const R = A.rng(17);
    g.save(); g.beginPath(); g.rect(0, TOP, W, PLINTH - TOP); g.clip();
    A.blotches(g, 0, TOP, W, PLINTH - TOP, Math.round(W / 150), 18, 'rgba(110,80,40,', 'rgba(255,250,228,');
    // потёки сверху вниз (от кабельного лотка и швов): тонкие, к низу сходят на нет
    for (let i = 0; i < W / 110; i++) {
      const x = R.range(0, W), hh = R.range(40, 130), ww = R.range(1.2, 3.4);
      const gr = g.createLinearGradient(0, TOP, 0, TOP + hh); gr.addColorStop(0, 'rgba(96,70,40,0.2)'); gr.addColorStop(1, 'rgba(96,70,40,0)');
      g.fillStyle = gr; g.fillRect(x - ww / 2, TOP, ww, hh); g.fillRect(x + ww * 2.4, TOP, ww * 0.6, hh * 0.6);
    }
    A.edge(g, 0, PLINTH - 44, W, 44, 'b', 44, 'rgba(76,52,28,0.24)');
    g.restore();
  }

  // ---------------------------------------------------------------- пол: гранитные плиты рядами, ближе к зрителю крупнее
  function floor(g, W, H) {
    A.gradV(g, 0, WALL, W, H - WALL, [[0, '#aaa5b2'], [1, '#7f7a8a']]);
    const R = A.rng(41), rows = [[WALL, 22, 80], [WALL + 22, 30, 104], [WALL + 52, 40, 132], [WALL + 92, 44, 164]];
    g.save(); g.beginPath(); g.rect(0, WALL, W, H - WALL); g.clip();
    rows.forEach(([y, hh, tw], r) => {
      for (let x = -((r * 37) % tw); x < W; x += tw) {
        const t = R.next();
        g.fillStyle = t < 0.3 ? 'rgba(255,255,255,0.09)' : t < 0.6 ? 'rgba(30,18,44,0.10)' : t < 0.8 ? 'rgba(255,225,210,0.06)' : 'rgba(40,50,90,0.09)';
        g.fillRect(x, y, tw, hh);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1, y + 1, tw - 2, 1.6);
        g.fillStyle = 'rgba(30,18,44,0.46)'; g.fillRect(x, y, 2, hh);
      }
      g.fillStyle = 'rgba(30,18,44,0.5)'; g.fillRect(0, y, W, 2);
    });
    // тёмная вставка с ромбами вдоль всего перехода: узор из тёмного и светлого гранита (ниже линии, где стоят герои)
    g.fillStyle = 'rgba(58,40,72,0.32)'; g.fillRect(0, WALL + 40, W, 11);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, WALL + 39, W, 1.4); g.fillRect(0, WALL + 51, W, 1.4);
    for (let x = 26; x < W; x += 52) { g.fillStyle = 'rgba(214,196,226,0.34)'; poly(g, [[x, WALL + 45.5], [x + 9, WALL + 41.5], [x + 18, WALL + 45.5], [x + 9, WALL + 49.5]]); g.fill(); }
    for (let i = 0; i < W * (H - WALL) / 60; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.2)' : 'rgba(30,16,40,0.2)'; g.fillRect(R.range(0, W), R.range(WALL, H), 1.3, 1.3); }
    A.grain(g, 0, WALL, W, H - WALL, 0.2, 'overlay', 66);
    A.edge(g, 0, WALL, W, 26, 't', 26, 'rgba(36,20,40,0.34)');
    g.restore();
  }

  // ---------------------------------------------------------------- проход с перспективой (лестница вверх на улицу и вниз в метро)
  // near и far — прямоугольники ближнего и дальнего края {l, r, t, b}; всё, что внутри, сходится к дальнему. Ступени сгущаются к дальнему краю.
  const at = (n, f, s) => ({ l: lerp(n.l, f.l, s), r: lerp(n.r, f.r, s), t: lerp(n.t, f.t, s), b: lerp(n.b, f.b, s) });
  function steps(count, k) { const e = 1 - 1 / (1 + k * count), out = []; for (let i = 0; i <= count; i++) out.push((1 - 1 / (1 + k * i)) / e); return out; }

  // Плитка на боковой стене прохода: горизонтальные швы идут к дальнему краю, вертикальные — по глубине.
  function wallGrid(g, n, f, side, tileH, a) {
    g.strokeStyle = 'rgba(86,64,36,' + a + ')'; g.lineWidth = 1.2;
    const x0 = side < 0 ? n.l : n.r, x1 = side < 0 ? f.l : f.r, k = (f.b - f.t) / (n.b - n.t);
    for (let y = n.t + tileH; y < n.b; y += tileH) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, f.t + (y - n.t) * k); g.stroke(); }
    for (const s of steps(9, 0.55).slice(1, 9)) { const r = at(n, f, s); g.beginPath(); g.moveTo(side < 0 ? r.l : r.r, r.t); g.lineTo(side < 0 ? r.l : r.r, r.b); g.stroke(); }
  }

  // ---------------------------------------------------------------- вход в метро (слева): арка с каменным обрамлением, вниз уходит лестница
  function metroPortal(g) {
    const cx = 175, a = 116, sp = 374, V = { x: cx, y: 440 }, k = 0.27;
    const N = { l: cx - a, r: cx + a, b: WALL }, F = { l: cx - a * k, r: cx + a * k, b: V.y + (WALL - V.y) * k };
    const farSp = V.y + (sp - V.y) * k, ray = (x, y, kk) => [V.x + (x - V.x) * kk, V.y + (y - V.y) * kk];
    const shape = (r, bottom) => { g.beginPath(); g.moveTo(cx - r, bottom); g.lineTo(cx - r, sp); g.arc(cx, sp, r, Math.PI, 0); g.lineTo(cx + r, bottom); g.closePath(); };
    // обрамление: тёсаный светлый камень, клинья свода и замковый камень
    shape(a + 22, WALL); g.fillStyle = A.linG(g, cx - a - 22, 0, cx + a + 22, 0, [[0, '#d6cdbb'], [0.5, '#efe9da'], [1, '#c7bea9']]); g.fill();
    g.save(); shape(a + 22, WALL); g.clip(); A.grain(g, cx - a - 22, sp - a - 22, 2 * a + 44, 2 * a + 44 + 200, 0.24, 'overlay', 81); A.blotches(g, cx - a - 22, sp - a - 22, 2 * a + 44, 330, 4, 82, 'rgba(90,70,60,', 'rgba(255,255,255,');
    g.strokeStyle = 'rgba(90,70,56,0.5)'; g.lineWidth = 1.4;
    for (let t = 1; t < 15; t++) { const an = Math.PI + t * Math.PI / 15; g.beginPath(); g.moveTo(cx + Math.cos(an) * a, sp + Math.sin(an) * a); g.lineTo(cx + Math.cos(an) * (a + 22), sp + Math.sin(an) * (a + 22)); g.stroke(); }
    for (let y = sp + 20; y < WALL; y += 36) { for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * a, y); g.lineTo(cx + sx * (a + 22), y); g.stroke(); } }
    g.restore();
    shape(a + 22, WALL); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#f6f0e0'; poly(g, [[cx - 14, sp - a - 24], [cx + 14, sp - a - 24], [cx + 11, sp - a + 2], [cx - 11, sp - a + 2]]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    // проём: свод, стены, лестница вниз
    g.save(); shape(a, WALL); g.clip();
    g.fillStyle = '#16101a'; g.fillRect(N.l, sp - a, 2 * a, WALL - sp + a);
    g.fillStyle = A.linG(g, 0, sp - a, 0, farSp, [[0, '#9a8b80'], [0.4, '#6a5b5e'], [1, '#2c2330']]); g.fillRect(N.l, sp - a, 2 * a, farSp - sp + a);          // свод: светлее у ближней арки, темнее вдаль
    const wallL = A.linG(g, N.l, 0, F.l, 0, [[0, '#b4a27c'], [0.5, '#6c5b52'], [1, '#2c2330']]), wallR = A.linG(g, N.r, 0, F.r, 0, [[0, '#a69473'], [0.5, '#64544d'], [1, '#2a212e']]);
    g.fillStyle = wallL; poly(g, [[N.l, sp], [F.l, farSp], [F.l, F.b], [N.l, N.b]]); g.fill();
    g.fillStyle = wallR; poly(g, [[N.r, sp], [F.r, farSp], [F.r, F.b], [N.r, N.b]]); g.fill();
    // дальний край: тёмная арка с тёплым светом станции внизу
    g.beginPath(); g.moveTo(F.l, F.b); g.lineTo(F.l, farSp); g.arc(cx, farSp, a * k, Math.PI, 0); g.lineTo(F.r, F.b); g.closePath(); g.fillStyle = A.linG(g, 0, farSp - a * k, 0, F.b, [[0, '#0e0a12'], [1, '#4a3430']]); g.fill();
    // кольца свода и лучи: тонкие линии дают объём
    g.strokeStyle = 'rgba(40,28,34,0.34)'; g.lineWidth = 1.3;
    for (let i = 1; i < 12; i++) { const an = Math.PI + i * Math.PI / 12, p0 = [cx + Math.cos(an) * a, sp + Math.sin(an) * a], p1 = ray(p0[0], p0[1], k); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    for (const sRing of steps(9, 0.5).slice(1, 9)) {
      const kk = lerp(1, k, sRing), r = a * kk, spk = V.y + (sp - V.y) * kk, fb = V.y + (WALL - V.y) * kk;
      g.beginPath(); g.moveTo(cx - r, fb); g.lineTo(cx - r, spk); g.arc(cx, spk, r, Math.PI, 0); g.lineTo(cx + r, fb); g.stroke();
    }
    g.strokeStyle = 'rgba(86,64,36,0.3)'; g.lineWidth = 1.2;
    for (let y = sp + 28; y < N.b; y += 28) { const q = ray(N.l, y, k), q2 = ray(N.r, y, k); g.beginPath(); g.moveTo(N.l, y); g.lineTo(q[0], q[1]); g.moveTo(N.r, y); g.lineTo(q2[0], q2[1]); g.stroke(); }
    // ступени вниз: видны проступи, на ближнем краю каждой — светлая кромка
    const st = steps(11, 0.42);
    for (let i = 0; i < 11; i++) {
      const p = at({ l: N.l, r: N.r, t: 0, b: N.b }, { l: F.l, r: F.r, t: 0, b: F.b }, st[i]), q = at({ l: N.l, r: N.r, t: 0, b: N.b }, { l: F.l, r: F.r, t: 0, b: F.b }, st[i + 1]);
      g.fillStyle = A.linG(g, 0, p.b, 0, q.b, [[0, mix('#948898', '#2c2430', st[i])], [1, mix('#847888', '#201a26', st[i + 1])]]); poly(g, [[p.l, p.b], [p.r, p.b], [q.r, q.b], [q.l, q.b]]); g.fill();
      g.fillStyle = 'rgba(240,230,210,' + (0.62 * (1 - st[i])).toFixed(2) + ')'; poly(g, [[p.l, p.b - 3 * (1 - st[i])], [p.r, p.b - 3 * (1 - st[i])], [p.r, p.b], [p.l, p.b]]); g.fill();
      g.strokeStyle = 'rgba(14,8,18,0.65)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(q.l, q.b); g.lineTo(q.r, q.b); g.stroke();
    }
    // поручни: нержавеющая труба вдоль каждой стены и посередине, на стойках
    for (const [x0, x1] of [[N.l + 14, F.l + 3], [N.r - 14, F.r - 3], [cx, cx]]) {
      g.strokeStyle = OUT; g.lineWidth = 5.5; g.beginPath(); g.moveTo(x0, N.b - 92); g.lineTo(x1, F.b - 16); g.stroke();
      g.strokeStyle = '#c9ced6'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, N.b - 92); g.lineTo(x1, F.b - 16); g.stroke();
      g.strokeStyle = 'rgba(30,24,34,0.7)'; g.lineWidth = 2; for (const sp2 of st.slice(0, 9)) { g.beginPath(); g.moveTo(lerp(x0, x1, sp2), lerp(N.b - 92, F.b - 16, sp2)); g.lineTo(lerp(x0 + (x0 < cx ? -14 : x0 > cx ? 14 : 0), x1 + (x0 < cx ? -3 : x0 > cx ? 3 : 0), sp2), lerp(N.b, F.b, sp2)); g.stroke(); }
    }
    A.edge(g, N.l, sp - a, 2 * a, 60, 't', 60, 'rgba(10,6,14,0.45)');
    A.grain(g, N.l, sp - a, 2 * a, WALL - sp + a, 0.2, 'overlay', 83);
    g.restore();
    shape(a, WALL); g.lineWidth = 3.4; g.strokeStyle = OUT; g.stroke();
    // вывеска «МЕТРО» над аркой
    A.box(g, cx - 66, sp - a - 24 - 22, 132, 22, { fill: '#1f4a96', lw: 3, r: 3, hi: 'rgba(255,255,255,0.28)', lo: 'rgba(0,0,0,0.2)' });
    A.text(g, 'М Е Т Р О', cx, sp - a - 24 - 10.5, 15, '#ffffff', { stroke: OUT, lw: 2.8 });
  }

  // ---------------------------------------------------------------- лестница на улицу (справа)
  function foliage(g, x0, y0, x1, y1, n, seed) {
    // кроны каштанов в манере парка: сочная листва с тёмной обводкой, редкие жёлтые листья
    const R = A.rng(seed), pal = ['#62ae4c', '#a8de76', '#3a7c3e', '#78ba50', '#4a8e3e', '#62ae4c', '#d6c23a'];
    for (let i = 0; i < n; i++) {
      const x = R.range(x0, x1), y = R.range(y0, y1), r = R.range(5, 10.5), c = R.pick(pal);
      g.fillStyle = mix(c, '#12301a', 0.45); g.beginPath(); g.arc(x + 1.2, y + 2, r, 0, 6.3); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.lineWidth = 1.1; g.strokeStyle = 'rgba(20,58,36,0.5)'; g.stroke();
      g.fillStyle = mix(c, '#ffffd0', 0.36); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.36, r * 0.44, 0, 6.3); g.fill();
    }
  }
  function exitStairs(g) {
    const cx = (STAIR.l + STAIR.r) / 2, N = { l: STAIR.l, r: STAIR.r, t: 232, b: WALL }, F = { l: cx - 82, r: cx + 82, t: 300, b: 396 }, st = steps(13, 0.34);
    g.save(); g.beginPath(); g.rect(N.l, N.t, N.r - N.l, N.b - N.t); g.clip();
    g.fillStyle = '#d7cba8'; g.fillRect(N.l, N.t, N.r - N.l, N.b - N.t);
    // боковые стены: плитка, к дневному свету светлее
    g.fillStyle = A.linG(g, N.l, 0, F.l, 0, [[0, '#cdbd96'], [1, '#f4ecd2']]); poly(g, [[N.l, N.t], [F.l, F.t], [F.l, F.b], [N.l, N.b]]); g.fill();
    g.fillStyle = A.linG(g, N.r, 0, F.r, 0, [[0, '#c3b28c'], [1, '#f1e8cc']]); poly(g, [[N.r, N.t], [F.r, F.t], [F.r, F.b], [N.r, N.b]]); g.fill();
    g.fillStyle = A.linG(g, 0, N.t, 0, F.t, [[0, '#8c7f78'], [1, '#d9cfb8']]); poly(g, [[N.l, N.t], [N.r, N.t], [F.r, F.t], [F.l, F.t]]); g.fill();
    wallGrid(g, N, F, -1, 28, 0.28); wallGrid(g, N, F, 1, 28, 0.28);
    // светильники на потолке лестницы (в перспективе)
    for (const sl of [0.18, 0.5]) { const q = at(N, F, sl), w = (q.r - q.l) * 0.16, y = q.t + 3; g.fillStyle = '#fffbe4'; g.fillRect(cx - w / 2, y, w, 4 - sl * 2); g.strokeStyle = OUT; g.lineWidth = 1.2; g.strokeRect(cx - w / 2, y, w, 4 - sl * 2); A.glow(g, cx, y + 6, 60 - sl * 40, 'rgba(255,244,200,', 0.35); }
    // дневной свет в конце лестницы: небо, красный корпус, кроны каштанов (как в парке — этот выход ведёт туда)
    g.fillStyle = A.linG(g, 0, F.t, 0, F.b, [[0, '#7ab8ec'], [0.45, '#b4daf2'], [0.8, '#e2f0f2'], [1, '#f6f4e4']]); g.fillRect(F.l, F.t, F.r - F.l, F.b - F.t);
    g.save(); g.beginPath(); g.rect(F.l, F.t, F.r - F.l, F.b - F.t); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(F.l + 46, F.t + 36, 22, 6.4, 0, 0, 6.3); g.ellipse(F.l + 62, F.t + 32, 14, 5.4, 0, 0, 6.3); g.fill();
    // красный корпус: терракотовые стены, зелёная кровля, белые колонны портика и окна
    const bx = F.r - 64;
    g.fillStyle = '#5b6e64'; g.fillRect(bx, F.t + 24, 70, 10); g.fillStyle = A.linG(g, bx, 0, bx + 70, 0, [[0, '#e0644a'], [0.5, '#d4503a'], [1, '#b43c2d']]); g.fillRect(bx, F.t + 34, 70, F.b - F.t);
    g.fillStyle = '#f3e9d6'; g.fillRect(bx, F.t + 33, 70, 3); for (const dx of [10, 26, 42]) g.fillRect(bx + dx, F.t + 38, 5, 40);
    g.fillStyle = 'rgba(70,90,120,0.8)'; for (const dx of [54, 62]) g.fillRect(bx + dx, F.t + 42, 6, 12);
    g.strokeStyle = 'rgba(43,26,32,0.7)'; g.lineWidth = 1.4; g.strokeRect(bx, F.t + 34, 70, F.b - F.t);
    g.fillStyle = '#4a3326'; g.fillRect(F.l + 12, F.t + 8, 6, F.b - F.t);                                      // ствол каштана
    g.restore();
    g.save(); g.beginPath(); g.rect(F.l, F.t, F.r - F.l, F.b - F.t); g.clip();
    foliage(g, F.l - 6, F.t - 6, F.r + 6, F.t + 22, 34, 91); foliage(g, F.l - 4, F.b - 30, F.r + 4, F.b - 2, 28, 92);
    g.fillStyle = '#e9e1cc'; g.fillRect(F.l, F.b - 5, F.r - F.l, 5);                                           // улица наверху лестницы
    g.restore();
    A.glow(g, cx, F.t + 40, 130, 'rgba(255,255,238,', 0.6);
    // ступени вверх: видны подступёнки, на верхней кромке — светлая полоса и жёлтая противоскользящая лента
    for (let i = 0; i < 13; i++) {
      const p = at(N, F, st[i]), q = at(N, F, st[i + 1]), c = i % 2 ? '#aaa5b2' : '#bcb7c4';
      g.fillStyle = A.linG(g, 0, p.b, 0, q.b, [[0, mix(c, '#fff6dc', st[i] * 0.55)], [1, mix(c, '#fff6dc', st[i + 1] * 0.55)]]);
      poly(g, [[p.l, p.b], [p.r, p.b], [q.r, q.b], [q.l, q.b]]); g.fill();
      const th = 4 * (1 - st[i + 1]);
      g.fillStyle = '#e4c445'; poly(g, [[q.l, q.b], [q.r, q.b], [q.r, q.b + th], [q.l, q.b + th]]); g.fill();
      g.fillStyle = 'rgba(255,248,226,0.55)'; poly(g, [[q.l, q.b + th], [q.r, q.b + th], [q.r, q.b + th + 2 * (1 - st[i + 1])], [q.l, q.b + th + 2 * (1 - st[i + 1])]]); g.fill();
      g.strokeStyle = 'rgba(40,28,40,0.58)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.l, p.b); g.lineTo(p.r, p.b); g.stroke();
    }
    A.beam(g, cx, F.b - 20, 150, cx, N.b, 330, 0.1, 'rgba(255,252,226,');
    const Rd = A.rng(95); for (let i = 0; i < 46; i++) { g.fillStyle = 'rgba(255,255,244,' + Rd.range(0.3, 0.75).toFixed(2) + ')'; g.beginPath(); g.arc(Rd.range(cx - 110, cx + 110), Rd.range(F.b - 10, N.b - 30), Rd.range(0.6, 1.5), 0, 6.3); g.fill(); }
    // пандус для колясок вдоль левой стены: рифлёная металлическая полоса поверх ступеней, по краям бортики
    {
      const q = [[N.l + 6, N.b - 1], [N.l + 46, N.b - 1], [F.l + 11, F.b - 3], [F.l + 3, F.b - 3]], ln = (t, i, j) => [lerp(q[i][0], q[j][0], t), lerp(q[i][1], q[j][1], t)];
      g.fillStyle = A.linG(g, q[0][0], 0, q[1][0], 0, [[0, '#7d8490'], [0.35, '#c4cad4'], [1, '#6d7480']]); poly(g, q); g.fill();
      g.save(); poly(g, q); g.clip();
      for (const t of st) { const a = ln(t, 0, 3), b = ln(t, 1, 2); g.strokeStyle = 'rgba(30,30,40,0.55)'; g.lineWidth = 1.5 * (1 - t * 0.6); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 0.9 * (1 - t * 0.6); g.beginPath(); g.moveTo(a[0], a[1] - 1.4); g.lineTo(b[0], b[1] - 1.4); g.stroke(); }
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = 2.4; g.lineJoin = 'round'; poly(g, q); g.stroke();
    }
    // перила: у стен и по центру, на стойках
    for (const [x0, x1] of [[N.l + 16, F.l + 3], [N.r - 16, F.r - 3], [cx, cx]]) {
      g.strokeStyle = OUT; g.lineWidth = 5.5; g.beginPath(); g.moveTo(x0, N.b - 96); g.lineTo(x1, F.b - 30); g.stroke();
      g.strokeStyle = '#d6dbe2'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, N.b - 96); g.lineTo(x1, F.b - 30); g.stroke();
      g.strokeStyle = 'rgba(40,36,48,0.75)'; g.lineWidth = 2; const e0 = x0 < cx ? N.l : x0 > cx ? N.r : cx, e1 = x0 < cx ? F.l : x0 > cx ? F.r : cx;
      for (const sp2 of st.slice(0, 10)) { g.beginPath(); g.moveTo(lerp(x0, x1, sp2), lerp(N.b - 96, F.b - 30, sp2)); g.lineTo(lerp(e0 + (x0 < cx ? 10 : x0 > cx ? -10 : 0), e1 + (x0 < cx ? 2 : x0 > cx ? -2 : 0), sp2), lerp(N.b, F.b, sp2)); g.stroke(); }
    }
    A.grain(g, N.l, N.t, N.r - N.l, N.b - N.t, 0.18, 'overlay', 84);
    g.fillStyle = 'rgba(255,255,244,0.09)'; g.fillRect(F.l, F.t, F.r - F.l, F.b - F.t);                 // яркий выход: сияние выплёскивается на стены, потолок и ступени
    pool(g, cx, F.t + 46, 190, 1.15, 0.95, 'rgba(255,255,236,', 0.32);
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.strokeRect(N.l, N.t, N.r - N.l, N.b - N.t);
  }

  // ---------------------------------------------------------------- киоски вдоль стены
  // Значок на вывеске (белый с контуром): стакан с паром, тюльпан, газета, телефон.
  function icon(g, kind, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.lineWidth = 1.8; g.strokeStyle = OUT; g.lineJoin = 'round'; g.fillStyle = '#fff8e8';
    if (kind === 'cup') {
      g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, -4); g.lineTo(5.6, 9); g.lineTo(-5.6, 9); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(9, 2.5, 3.8, -1.4, 1.4); g.stroke();
      g.strokeStyle = 'rgba(255,248,232,0.95)'; g.lineWidth = 1.7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-3.5, -7); g.quadraticCurveTo(-6.5, -11, -3.5, -15); g.moveTo(2.5, -7); g.quadraticCurveTo(-0.5, -11, 2.5, -15); g.stroke();
    } else if (kind === 'flower') {
      g.strokeStyle = '#2f6a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 2); g.lineTo(0, 12); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-7, -2); g.quadraticCurveTo(-8, -13, -3, -13); g.lineTo(0, -7); g.lineTo(3, -13); g.quadraticCurveTo(8, -13, 7, -2); g.quadraticCurveTo(0, 6, -7, -2); g.closePath(); g.fill(); g.stroke();
    } else if (kind === 'news') {
      g.fillRect(-9, -9, 18, 18); g.strokeRect(-9, -9, 18, 18);
      g.fillStyle = OUT; g.fillRect(-6, -6, 12, 3.4); g.fillRect(-6, 0, 5, 2); g.fillRect(-6, 4, 5, 2); g.fillRect(0, 0, 6, 6);
    } else {
      A.rrPath(g, -5.5, -10, 11, 20, 2.6); g.fill(); g.stroke();
      g.fillStyle = '#4a7fd0'; g.fillRect(-3.6, -7, 7.2, 12); g.fillStyle = OUT; g.beginPath(); g.arc(0, 7.6, 1.2, 0, 6.3); g.fill();
    }
    g.restore();
  }

  function cup(g, x, y, w, h, o) {
    // бумажный стаканчик (x — центр, y — донышко): белый, коричневый «рукав», по желанию крышка
    o = o || {};
    g.lineWidth = 1.8; g.strokeStyle = OUT; g.lineJoin = 'round';
    g.fillStyle = '#fbf5e8'; poly(g, [[x - w / 2, y - h], [x + w / 2, y - h], [x + w * 0.36, y], [x - w * 0.36, y]]); g.fill(); g.stroke();
    g.fillStyle = o.sleeve || '#a8683a'; poly(g, [[x - w * 0.46, y - h * 0.68], [x + w * 0.46, y - h * 0.68], [x + w * 0.4, y - h * 0.26], [x - w * 0.4, y - h * 0.26]]); g.fill();
    if (o.lid) { g.fillStyle = '#3a2f34'; A.rrPath(g, x - w * 0.56, y - h - 3.6, w * 1.12, 4.6, 1.6); g.fill(); g.stroke(); }
  }

  function bouquet(g, x, baseY, seed, cols) {
    // букет в крафтовой бумаге: веер стеблей, цветки с тёмным контуром
    const R = A.rng(seed);
    g.lineCap = 'round';
    const heads = [];
    for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4 + R.range(-0.08, 0.08), len = R.range(34, 52); heads.push([x + Math.sin(a) * len * 0.8, baseY - 18 - Math.cos(a) * len]); }
    g.strokeStyle = '#2f7a3a'; g.lineWidth = 2.2; for (const [hx, hy] of heads) { g.beginPath(); g.moveTo(x, baseY - 12); g.lineTo(hx, hy); g.stroke(); }
    g.fillStyle = '#4b9a46'; for (const [hx, hy] of heads) { g.beginPath(); g.ellipse(hx + (hx < x ? 5 : -5), hy + 14, 5, 2.4, hx < x ? -0.7 : 0.7, 0, 6.3); g.fill(); }
    for (const [hx, hy] of heads) { g.beginPath(); g.arc(hx, hy, R.range(5.4, 7.4), 0, 6.3); g.fillStyle = R.pick(cols); g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(43,26,32,0.85)'; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(hx - 1.6, hy - 1.8, 1.8, 0, 6.3); g.fill(); }
    g.fillStyle = '#d9b583'; poly(g, [[x - 16, baseY - 30], [x + 16, baseY - 30], [x + 6, baseY], [x - 6, baseY]]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(120,80,40,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 8, baseY - 28); g.lineTo(x - 3, baseY - 2); g.moveTo(x + 8, baseY - 28); g.lineTo(x + 3, baseY - 2); g.stroke();
    g.lineCap = 'butt';
  }

  function bucket(g, x, baseY, seed, cols) {
    // оцинкованное ведро с цветами (стоит на полу у киоска)
    const R = A.rng(seed);
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -0.9 + i * 0.22 + R.range(-0.05, 0.05), len = R.range(40, 70), hx = x + Math.sin(a) * len * 0.7, hy = baseY - 22 - Math.cos(a) * len;
      g.strokeStyle = '#2f7a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + Math.sin(a) * 6, baseY - 24); g.lineTo(hx, hy); g.stroke();
      g.beginPath(); g.arc(hx, hy, R.range(5.4, 7.6), 0, 6.3); g.fillStyle = R.pick(cols); g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(43,26,32,0.85)'; g.stroke();
    }
    g.lineCap = 'butt';
    g.fillStyle = A.linG(g, x - 15, 0, x + 15, 0, [[0, '#8c939f'], [0.35, '#d5dae2'], [1, '#6f7682']]);
    poly(g, [[x - 15, baseY - 28], [x + 15, baseY - 28], [x + 12, baseY - 1], [x - 12, baseY - 1]]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 14, baseY - 22, 28, 2);
  }

  function goodsCoffee(g, cx, wt, wb) {
    g.fillStyle = 'rgba(255,214,150,0.14)'; g.fillRect(cx - 86, wt, 172, 10);
    A.box(g, cx - 20, wt + 12, 58, 40, { fill: '#25302c', lw: 2.4, r: 2 });                                       // меню мелом
    g.fillStyle = 'rgba(255,255,255,0.72)'; for (let i = 0; i < 4; i++) { g.fillRect(cx - 14, wt + 20 + i * 8.4, 24 - (i % 2) * 6, 1.8); g.fillRect(cx + 20, wt + 20 + i * 8.4, 12, 1.8); }
    A.box(g, cx - 80, wt + 30, 44, 44, { fill: '#454a54', lw: 2.4, r: 3, hi: 'rgba(255,255,255,0.2)' });           // кофемашина
    A.box(g, cx - 84, wt + 22, 52, 12, { fill: '#a1a8b2', lw: 2.4, r: 3, hi: 'rgba(255,255,255,0.5)' });
    g.fillStyle = '#7dea96'; g.fillRect(cx - 70, wt + 41, 13, 6); g.fillStyle = '#e8564a'; g.beginPath(); g.arc(cx - 48, wt + 44, 2.4, 0, 6.3); g.fill();
    g.fillStyle = '#8b919b'; g.fillRect(cx - 67, wt + 56, 4, 9); g.fillRect(cx - 55, wt + 56, 4, 9);
    A.box(g, cx - 78, wt + 66, 40, 6, { fill: '#2a2d34', lw: 2 });
    for (const [x, n] of [[cx + 48, 5], [cx + 62, 4], [cx + 76, 3]]) for (let i = 0; i < n; i++) cup(g, x, wb - 3 - i * 9, 11, 15);
  }

  function goodsFlowers(g, cx, wt, wb) {
    g.fillStyle = A.linG(g, 0, wt, 0, wb, [[0, '#6f8a76'], [1, '#a2b69a']]); g.fillRect(cx - 86, wt, 172, wb - wt);
    A.box(g, cx - 86, wb - 18, 172, 18, { fill: '#8d6a48', lw: 2.4 });
    const cols = ['#e2384a', '#f06c8e', '#f7c948', '#fff6e4', '#b46ad6', '#ff9a4a'];
    [[cx - 62, 1], [cx - 22, 2], [cx + 20, 3], [cx + 60, 4]].forEach(([x, sd]) => bouquet(g, x, wb - 4, 30 + sd, cols));
    g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 86, wt + 9); g.lineTo(cx + 86, wt + 9); g.stroke();       // бельевая верёвка с цветами
    for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % 6]; g.beginPath(); g.arc(cx - 76 + i * 19, wt + 13, 3.4, 0, 6.3); g.fill(); }
  }

  function goodsPress(g, cx, wt, wb) {
    const R = A.rng(33), cov = ['#d94a4a', '#3a7fc4', '#f2c14b', '#4aa070', '#8f5ac4', '#f08a3a', '#2a2f3a', '#e9e4d6'];
    g.fillStyle = '#4a3a30'; g.fillRect(cx - 86, wt, 172, wb - wt);
    for (let r = 0; r < 3; r++) {
      const y = wt + 5 + r * 23;
      for (let i = 0; i < 11; i++) {
        const x = cx - 84 + i * 15.6, c = R.pick(cov);
        g.fillStyle = c; g.fillRect(x, y, 13, 18); g.strokeStyle = OUT; g.lineWidth = 1.2; g.strokeRect(x, y, 13, 18);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x + 1.5, y + 2, 10, 3.2); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 2, y + 7, 9, 8);
      }
      g.fillStyle = '#8d6a48'; g.fillRect(cx - 86, y + 18, 172, 3);
    }
  }

  function goodsPhones(g, cx, wt, wb) {
    g.fillStyle = '#c4b190'; g.fillRect(cx - 86, wt, 172, wb - wt);
    g.fillStyle = 'rgba(60,44,28,0.4)'; for (let x = cx - 82; x < cx + 86; x += 8) for (let y = wt + 6; y < wb; y += 8) { g.beginPath(); g.arc(x, y, 1, 0, 6.3); g.fill(); }
    const cs = ['#2a2f3a', '#e8564a', '#4a8fd0', '#f2c14b', '#8f5ac4', '#4aa070', '#f08ab0', '#e9e4d6'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      const x = cx - 84 + i * 17, y = wt + 6 + r * 34;
      A.box(g, x, y, 13, 25, { fill: cs[(i + r * 3) % cs.length], lw: 1.8, r: 3, hi: 'rgba(255,255,255,0.3)', hiH: 3 });
      g.fillStyle = OUT; g.beginPath(); g.arc(x + 4.4, y + 5, 2.4, 0, 6.3); g.fill();
    }
    g.strokeStyle = '#f4f0e6'; g.lineWidth = 1.8; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + 24 + i * 12, wt + 8); g.bezierCurveTo(cx + 18 + i * 12, wt + 24, cx + 34 + i * 12, wt + 30, cx + 26 + i * 12, wt + 46); g.stroke(); }
    A.box(g, cx + 62, wt + 20, 22, 36, { fill: '#2a2f3a', lw: 2.2, r: 3 }); g.fillStyle = '#7fc4ff'; g.fillRect(cx + 64.5, wt + 24, 17, 26);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(cx + 64.5, wt + 24, 17, 4);
  }

  // Киоск: вывеска-короб, полосатый козырёк, окно с товаром, прилавок, тумба. kind — чем торгует.
  function kiosk(g, cx, name, col, kind, tag) {
    const L = cx - 100, R = cx + 100, goods = { coffee: goodsCoffee, flowers: goodsFlowers, press: goodsPress, phones: goodsPhones }[kind];
    const ic = { coffee: 'cup', flowers: 'flower', press: 'news', phones: 'phone' }[kind];
    g.fillStyle = 'rgba(48,28,20,0.2)'; g.fillRect(L + 6, 344, 206, WALL - 344);                                      // тень на стене справа и снизу
    A.shadow(g, cx, WALL + 5, 130, 0.36);
    // корпус
    A.box(g, L, 352, 200, WALL - 352, { fill: '#d3cdc0', lw: 3.4 });
    g.fillStyle = A.linG(g, L, 0, R, 0, [[0, 'rgba(255,255,255,0.3)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(40,24,30,0.28)']]); g.fillRect(L + 1.7, 353.7, 196.6, WALL - 355.4);
    g.save(); g.beginPath(); g.rect(L, 352, 200, WALL - 352); g.clip(); A.grain(g, L, 352, 200, WALL - 352, 0.2, 'overlay', 90 + (cx % 7)); g.restore();
    A.box(g, L - 4, 340, 208, 13, { fill: '#a09a8e', lw: 3, r: 2, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.2)' });
    // вывеска
    A.box(g, L + 4, 355, 192, 30, { fill: col, lw: 3, r: 3, hi: 'rgba(255,255,255,0.3)', hiH: 5, lo: 'rgba(0,0,0,0.25)' });
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.4; A.rrPath(g, L + 8.5, 359.5, 183, 21, 2); g.stroke();
    fit(g, name, cx, 370.5, 112, 22, '#fff8e8', { stroke: OUT, lw: 3.4 });
    icon(g, ic, L + 26, 370, 1); icon(g, ic, R - 26, 370, 1);
    // окно
    const wl = L + 14, wr = R - 14, wt = 413, wb = 486;
    g.save(); g.beginPath(); g.rect(wl, wt, wr - wl, wb - wt); g.clip();
    A.gradV(g, wl, wt, wr - wl, wb - wt, [[0, '#33261f'], [1, '#5e4a3c']]);
    goods(g, cx, wt, wb);
    g.fillStyle = 'rgba(255,255,255,0.09)'; poly(g, [[wl + 14, wb], [wl + 52, wt], [wl + 80, wt], [wl + 42, wb]]); g.fill(); poly(g, [[wl + 96, wb], [wl + 126, wt], [wl + 142, wt], [wl + 112, wb]]); g.fill();
    A.edge(g, wl, wt, wr - wl, 20, 't', 20, 'rgba(0,0,0,0.5)');
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(wl, wt, wr - wl, wb - wt);
    // козырёк: полосы цвета киоска и кремовые; у большинства волнистый край, у «ПРЕСА» — прямой
    const n = 10, sw = 212 / n;
    for (let i = 0; i < n; i++) {
      const x = L - 6 + i * sw, c = i % 2 ? '#fbf0d8' : col;
      g.fillStyle = A.linG(g, 0, 385, 0, 420, [[0, c], [1, mix(c, '#000000', 0.2)]]);
      if (kind === 'press') {
        poly(g, [[x, 385], [x + sw, 385], [x + sw + 1.5, 410], [x - 1.5, 410]]); g.fill();
        g.lineWidth = 2.6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(x - 1.5, 410); g.lineTo(x, 385); g.stroke();
      } else {
        g.beginPath(); g.moveTo(x, 385); g.lineTo(x + sw, 385); g.lineTo(x + sw, 408); g.arc(x + sw / 2, 408, sw / 2, 0, Math.PI); g.lineTo(x, 385); g.closePath(); g.fill();
        g.lineWidth = 2.6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(x, 385); g.lineTo(x, 408); g.arc(x + sw / 2, 408, sw / 2, Math.PI, 0, true); g.lineTo(x + sw, 385); g.stroke();
      }
    }
    if (kind === 'press') { g.lineWidth = 2.8; g.strokeStyle = OUT; g.beginPath(); g.moveTo(L - 7.5, 410); g.lineTo(R + 7.5, 410); g.moveTo(R + 6, 385); g.lineTo(R + 7.5, 410); g.stroke(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(L - 6, 410, 212, 3); }
    g.fillStyle = OUT; g.fillRect(L - 6, 384, 212, 3);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(L - 4, 388, 208, 2);
    if (kind === 'flowers') {                                                                               // гирлянда флажков над вывеской
      const cols = ['#f06c8e', '#f7c948', '#fff6e4', '#62ae4c', '#b46ad6'];
      g.strokeStyle = 'rgba(43,26,32,0.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(L + 2, 326); g.quadraticCurveTo(cx, 344, R - 2, 326); g.stroke();
      for (let i = 1; i < 12; i++) { const t = i / 12, px = lerp(L + 2, R - 2, t), py = 326 + 18 * 2 * t * (1 - t) + 1; g.fillStyle = cols[i % 5]; poly(g, [[px - 5, py], [px + 5, py], [px, py + 11]]); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(43,26,32,0.8)'; g.stroke(); }
    }
    // прилавок и тумба
    A.box(g, L - 8, 486, 216, 12, { fill: '#e8e1d2', lw: 3, r: 2, hi: 'rgba(255,255,255,0.6)', lo: 'rgba(60,40,30,0.2)' });
    const cab = mix(col, '#241a22', 0.4);
    A.box(g, L + 6, 498, 188, 78, { fill: cab, lw: 3, hi: 'rgba(255,255,255,0.12)' });
    for (const x of [L + 14, L + 108]) { A.box(g, x, 508, 78, 58, { fill: 'rgba(0,0,0,0.16)', lw: 2.2, stroke: 'rgba(20,10,16,0.8)' }); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 2, 510, 74, 2.6); g.fillRect(x + 2, 510, 2.6, 54); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 2, 562, 74, 2.6); }
    g.save(); g.beginPath(); g.rect(L + 6, 498, 188, 78); g.clip(); A.grain(g, L + 6, 498, 188, 78, 0.2, 'overlay', 94 + (cx % 5)); g.restore();
    A.box(g, L, 576, 200, 8, { fill: '#4a3f46', lw: 2.6 });
    // эмаль: сколы и потёртость снизу
    A.edge(g, L + 6, 540, 188, 36, 'b', 36, 'rgba(10,6,12,0.28)');
    // ценник-палатка на прилавке и наклейка «оплата картой» на тумбе
    g.fillStyle = '#fffaf0'; g.fillRect(L + 12, 474, 26, 12); g.lineWidth = 1.6; g.strokeStyle = OUT; g.strokeRect(L + 12, 474, 26, 12);
    fit(g, tag, L + 25, 480.4, 22, 8.4, '#c8302a', {});
    A.box(g, R - 40, 512, 22, 14, { fill: '#f4f0e6', lw: 1.8, r: 2 }); g.fillStyle = '#2b3a5a'; g.fillRect(R - 38.4, 515.4, 19, 3.4); g.fillStyle = '#d9b44a'; g.fillRect(R - 37, 521, 5, 3.4);
  }

  function kiosksAll(g, X) {
    // чем торгует киоск, берём по надписи на вывеске (запасной вариант — по порядку); ценники и вид витрины — у каждого свои
    const byName = { 'КАВА': ['coffee', '35 грн'], 'КВІТИ': ['flowers', 'від 60'], 'ПРЕСА': ['press', '15 грн'] }, byIndex = [['coffee', '35 грн'], ['flowers', 'від 60'], ['press', '15 грн']];
    let fx = null;
    X.kiosks.forEach(([x, name, col], i) => {
      const [kind, tag] = byName[name] || byIndex[i % 3];
      kiosk(g, x, name, col, kind, tag);
      if (kind === 'flowers') fx = x;
    });
    kiosk(g, 1960, 'ТЕЛЕФОНИ', '#4a4f9a', 'phones', 'від 99');                                   // четвёртый киоск — только на стене, в игре у него нет препятствия
    // ведёрки с цветами у киоска «КВІТИ»
    if (fx !== null) {
      const cols = ['#e2384a', '#f06c8e', '#f7c948', '#fff6e4', '#b46ad6', '#ff9a4a'];
      bucket(g, fx - 36, WALL + 4, 11, cols); bucket(g, fx + 58, WALL + 3, 12, cols);
    }
  }

  // ---------------------------------------------------------------- вывески, афиши, мозаика, схема метро
  function arrow(g, x, y, s, dir, col) {
    // стрелка: dir 1 — вправо, -1 — влево, 0 — вверх
    g.save(); g.translate(x, y); g.scale(s, s); if (dir === 0) g.rotate(-Math.PI / 2); else if (dir < 0) g.scale(-1, 1);
    g.fillStyle = col || '#ffffff'; g.beginPath(); g.moveTo(-12, -3.6); g.lineTo(2, -3.6); g.lineTo(2, -9); g.lineTo(13, 0); g.lineTo(2, 9); g.lineTo(2, 3.6); g.lineTo(-12, 3.6); g.closePath(); g.fill();
    g.restore();
  }
  function pictoStairs(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#ffffff'; g.lineWidth = 3.2; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-11, 9); g.lineTo(-5, 9); g.lineTo(-5, 3); g.lineTo(1, 3); g.lineTo(1, -3); g.lineTo(7, -3); g.lineTo(7, -9); g.lineTo(12, -9); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-7, -4, 2.8, 0, 6.3); g.fill(); g.restore();
  }
  function pictoMetro(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.beginPath(); g.arc(0, 0, 13, 0, 6.3); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    A.text(g, 'М', 0, 1.4, 17, '#1f4fa3'); g.restore();
  }
  function pictoTree(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, -4, 8, 0, 6.3); g.arc(-6, 2, 6, 0, 6.3); g.arc(6, 2, 6, 0, 6.3); g.fill(); g.fillRect(-1.8, 2, 3.6, 9); g.restore();
  }
  function pictoRun(g, x, y, s) {
    // бегущий человечек к выходу (зелёный знак эвакуации)
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(1, -9, 2.8, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(-2, -2); g.lineTo(2, -5); g.lineTo(6, -2); g.moveTo(1, -5); g.lineTo(-1, 3); g.lineTo(-6, 8); g.moveTo(-1, 3); g.lineTo(3, 6); g.lineTo(3, 10); g.stroke();
    g.restore();
  }
  function pictoWheel(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(-1, -9, 2.6, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(-1, -5); g.lineTo(-1, 2); g.lineTo(6, 2); g.lineTo(8, 9); g.moveTo(-1, -2); g.lineTo(5, -2); g.stroke();
    g.beginPath(); g.arc(-2.5, 6, 6.5, 0.6, 5.3); g.stroke(); g.restore();
  }

  // Подвесная вывеска на тягах от балки: цветная плита с белой окантовкой, значок слева, стрелка справа. Тяги стоят между лампами (балки — посреди промежутка).
  function hanger(g, cx, top, spread) {
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(cx - spread - 8, 94); g.lineTo(cx + spread + 8, 94); g.stroke();
    g.lineWidth = 3.2; for (const dx of [-spread, spread]) { g.beginPath(); g.moveTo(cx + dx, 94); g.lineTo(cx + dx, top + 3); g.stroke(); }
    g.strokeStyle = '#aab0ba'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - spread - 8, 93); g.lineTo(cx + spread + 8, 93); g.stroke();
    for (const dx of [-spread, spread]) { g.beginPath(); g.moveTo(cx + dx - 0.6, 96); g.lineTo(cx + dx - 0.6, top); g.stroke(); }
    g.lineCap = 'butt';
  }
  function hangSign(g, cx, top, w, h, fill, str, o) {
    o = o || {};
    hanger(g, cx, top, 34);
    hangShadow(g, cx - w / 2, top, w, h, 0.32);
    A.box(g, cx - w / 2, top, w, h, { fill, lw: 3.4, r: 6, hi: 'rgba(255,255,255,0.22)', lo: 'rgba(0,0,0,0.22)' });
    g.strokeStyle = '#f4f0e6'; g.lineWidth = 2; A.rrPath(g, cx - w / 2 + 5, top + 5, w - 10, h - 10, 3); g.stroke();
    const mid = top + h / 2, l = cx - w / 2 + 12, r = cx + w / 2 - 12;
    let tl = l, tr = r;
    if (o.icon) { o.icon(g, l + 14, mid, 1); tl = l + 32; }
    if (o.arrow !== undefined) { arrow(g, r - 12, mid, 1, o.arrow); tr = r - 28; }
    fit(g, str, (tl + tr) / 2, mid + 1, tr - tl, o.size || 21, '#ffffff', { stroke: OUT, lw: 3 });
  }

  function hangClock(g, cx, top, r) {
    hanger(g, cx, top + 4, 18);
    hangShadow(g, cx - r, top, r * 2, r * 2, 0.3);
    const cy = top + r;
    g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fillStyle = A.linG(g, cx - r, cy - r, cx + r, cy + r, [[0, '#d7dae0'], [1, '#8d929c']]); g.fill(); g.lineWidth = 3.4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(cx, cy, r - 5, 0, 6.3); g.fillStyle = '#f8f4e8'; g.fill(); g.lineWidth = 1.8; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, c = Math.sin(a), d = -Math.cos(a), l = i % 3 ? 4 : 7; g.strokeStyle = OUT; g.lineWidth = i % 3 ? 1.6 : 2.6; g.beginPath(); g.moveTo(cx + c * (r - 7), cy + d * (r - 7)); g.lineTo(cx + c * (r - 7 - l), cy + d * (r - 7 - l)); g.stroke(); }
    g.lineCap = 'round'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(4.0) * r * 0.46, cy - Math.cos(4.0) * r * 0.46); g.stroke();
    g.lineWidth = 2.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(0.9) * r * 0.7, cy - Math.cos(0.9) * r * 0.7); g.stroke(); g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, 2.6, 0, 6.3); g.fillStyle = OUT; g.fill();
  }

  // Световой короб с афишей: алюминиевая рама, подсветка, блик на стекле.
  function lightbox(g, cx, top, w, h, art) {
    hangShadow(g, cx - w / 2, top, w, h, 0.3);
    A.box(g, cx - w / 2, top, w, h, { fill: '#c3c7cf', lw: 3.2, r: 3, hi: 'rgba(255,255,255,0.6)', lo: 'rgba(0,0,0,0.18)' });
    const x = cx - w / 2 + 6, y = top + 6, ww = w - 12, hh = h - 12;
    g.save(); g.beginPath(); g.rect(x, y, ww, hh); g.clip();
    art(g, x, y, ww, hh);
    g.fillStyle = 'rgba(255,255,255,0.13)'; poly(g, [[x, y + hh * 0.7], [x + ww * 0.6, y], [x + ww * 0.82, y], [x, y + hh * 0.95]]); g.fill();
    A.edge(g, x, y, ww, 10, 't', 10, 'rgba(0,0,0,0.25)');
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2.2; g.strokeRect(x, y, ww, hh);
  }
  function posterConcert(g, x, y, w, h) {
    A.gradV(g, x, y, w, h, [[0, '#2b1a5a'], [1, '#8a2e6a']]);
    g.fillStyle = 'rgba(255,230,140,0.22)'; for (const dx of [0.2, 0.5, 0.8]) { poly(g, [[x + w * dx, y], [x + w * (dx - 0.18), y + h * 0.7], [x + w * (dx + 0.18), y + h * 0.7]]); g.fill(); }
    fit(g, 'КОНЦЕРТ', x + w / 2, y + h * 0.15, w - 8, 14, '#ffd84a', { stroke: OUT, lw: 3 });
    // гитара
    g.save(); g.translate(x + w / 2, y + h * 0.6); g.rotate(-0.35);
    g.fillStyle = '#e8803a'; g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 13, 13, 15, 0, 0, 6.3); g.ellipse(0, -3, 9.5, 10.5, 0, 0, 6.3); g.fill(); g.stroke();
    g.fillStyle = '#3a2218'; g.beginPath(); g.arc(0, 8, 4.6, 0, 6.3); g.fill(); g.fillStyle = '#6a3a22'; g.fillRect(-2.6, -30, 5.2, 24); g.strokeRect(-2.6, -30, 5.2, 24); g.fillRect(-4, -36, 8, 7); g.strokeRect(-4, -36, 8, 7);
    g.restore();
    g.fillStyle = '#ffffff'; for (const [dx, dy] of [[0.18, 0.4], [0.82, 0.5], [0.76, 0.3]]) { g.beginPath(); g.arc(x + w * dx, y + h * dy, 3, 0, 6.3); g.fill(); g.fillRect(x + w * dx + 2, y + h * dy - 11, 1.8, 11); }
    fit(g, 'ЖИВА МУЗИКА', x + w / 2, y + h * 0.9, w - 8, 9, '#ffffff', { stroke: OUT, lw: 2.4 });
  }
  function posterCinema(g, x, y, w, h) {
    A.gradV(g, x, y, w, h, [[0, '#7a1f2a'], [1, '#3c0f1c']]);
    g.fillStyle = '#16101a'; g.fillRect(x, y, 9, h); g.fillRect(x + w - 9, y, 9, h);
    g.fillStyle = '#f4efe2'; for (let yy = y + 4; yy < y + h - 4; yy += 11) { g.fillRect(x + 2.4, yy, 4.2, 6); g.fillRect(x + w - 6.6, yy, 4.2, 6); }
    fit(g, 'КІНО', x + w / 2, y + h * 0.2, w - 26, 24, '#ffd84a', { stroke: OUT, lw: 3.4 });
    // стаканчик попкорна
    const cx = x + w / 2, by = y + h * 0.78;
    g.fillStyle = '#fffaf0'; for (const [dx, dy, r] of [[-9, -22, 7], [0, -26, 8], [9, -22, 7], [-4, -17, 6], [5, -16, 6]]) { g.beginPath(); g.arc(cx + dx, by + dy, r, 0, 6.3); g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(43,26,32,0.7)'; g.stroke(); }
    poly(g, [[cx - 14, by - 16], [cx + 14, by - 16], [cx + 10, by + 8], [cx - 10, by + 8]]); g.fillStyle = '#e8403a'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#fffaf0'; for (const dx of [-8, 0, 8]) { poly(g, [[cx + dx - 2.4, by - 16], [cx + dx + 2.4, by - 16], [cx + dx + 1.8, by + 8], [cx + dx - 1.8, by + 8]]); g.fill(); }
    fit(g, 'СЬОГОДНІ', x + w / 2, y + h * 0.94, w - 26, 9, '#ffffff', { stroke: OUT, lw: 2.4 });
  }
  function posterBank(g, x, y, w, h) {
    A.gradV(g, x, y, w, h, [[0, '#1f6f6a'], [1, '#2e9a8a']]);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(x, y + h * 0.7); g.bezierCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.6, y + h * 0.9, x + w, y + h * 0.6); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
    fit(g, 'БАНК', x + w / 2, y + h * 0.22, w - 8, 25, '#ffffff', { stroke: OUT, lw: 3.4 });
    for (const [dx, dy] of [[0.3, 0.58], [0.5, 0.52], [0.7, 0.6]]) {                                         // монеты: стопка из эллипса, боковины и нижней дуги
      const cx = x + w * dx, cy = y + h * dy;
      g.beginPath(); g.ellipse(cx, cy, 11, 4.6, 0, 0, 6.3); g.fillStyle = '#f2c94c'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
      g.fillRect(cx - 11, cy, 22, 5); g.beginPath(); g.ellipse(cx, cy + 5, 11, 4.6, 0, 0, Math.PI); g.fill(); g.stroke(); g.strokeRect(cx - 11, cy, 22, 5);
    }
    fit(g, 'ДЛЯ ВСІХ', x + w / 2, y + h * 0.9, w - 8, 10, '#ffffff', { stroke: OUT, lw: 2.4 });
  }
  function posterTravel(g, x, y, w, h) {
    A.gradV(g, x, y, w, h, [[0, '#4aa8e0'], [1, '#cfeaf5']]);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(x + w * 0.25, y + h * 0.4, 14, 5, 0, 0, 6.3); g.ellipse(x + w * 0.7, y + h * 0.28, 11, 4, 0, 0, 6.3); g.fill();
    g.save(); g.translate(x + w * 0.5, y + h * 0.52); g.rotate(-0.4); g.fillStyle = '#ffffff'; g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(-16, -6, 14, -4); g.lineTo(24, 0); g.lineTo(14, 4); g.quadraticCurveTo(-16, 6, -22, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-4, -3); g.lineTo(-12, -16); g.lineTo(-6, -16); g.lineTo(6, -4); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-4, 3); g.lineTo(-12, 16); g.lineTo(-6, 16); g.lineTo(6, 4); g.closePath(); g.fill(); g.stroke(); g.restore();
    fit(g, 'ПОДОРОЖІ', x + w / 2, y + h * 0.14, w - 6, 13, '#1f4fa3', { stroke: '#ffffff', lw: 3 });
    fit(g, 'ЛІТАЙ З НАМИ', x + w / 2, y + h * 0.9, w - 6, 8.5, '#ffffff', { stroke: OUT, lw: 2.2 });
  }

  // Мозаичное панно (киевские каштаны, золотые купола, волны Днепра): рисуем гладко, поверх кладём сетку смальты.
  function mosaic(g, cx, top, w, h) {
    hangShadow(g, cx - w / 2 - 4, top - 4, w + 8, h + 8, 0.3);
    A.box(g, cx - w / 2 - 6, top - 6, w + 12, h + 12, { fill: '#ebe3d0', lw: 3.6, hi: 'rgba(255,255,255,0.5)', lo: 'rgba(60,40,30,0.2)' });
    const x = cx - w / 2, y = top;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    A.gradV(g, x, y, w, h, [[0, '#1c3b82'], [0.62, '#2f66b0'], [1, '#4a8cc4']]);
    // солнце с лучами
    const sx = x + w * 0.8, sy = y + h * 0.24;
    g.fillStyle = '#f4c542'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; poly(g, [[sx + Math.cos(a - 0.12) * 22, sy + Math.sin(a - 0.12) * 22], [sx + Math.cos(a) * 34, sy + Math.sin(a) * 34], [sx + Math.cos(a + 0.12) * 22, sy + Math.sin(a + 0.12) * 22]]); g.fill(); }
    g.beginPath(); g.arc(sx, sy, 17, 0, 6.3); g.fillStyle = '#ffd95a'; g.fill();
    // золотые купола слева: белые барабаны, луковичные главки с крестами
    for (const [dx, dy, s] of [[0.15, 0.5, 1.15], [0.28, 0.42, 1.5], [0.4, 0.52, 1]]) {
      const bx = x + w * dx, by = y + h * dy; g.fillStyle = '#f2efe4'; g.fillRect(bx - 6.4 * s, by + 10 * s, 12.8 * s, 20 * s); g.fillStyle = '#7aa0c8'; g.fillRect(bx - 1.8 * s, by + 16 * s, 3.6 * s, 8 * s);
      g.fillStyle = A.linG(g, bx - 10 * s, 0, bx + 10 * s, 0, [[0, '#c98a22'], [0.4, '#ffd95a'], [1, '#b8761a']]); g.beginPath(); g.moveTo(bx - 9 * s, by + 10 * s); g.bezierCurveTo(bx - 14 * s, by - 3 * s, bx - 2 * s, by - 6 * s, bx, by - 14 * s); g.bezierCurveTo(bx + 2 * s, by - 6 * s, bx + 14 * s, by - 3 * s, bx + 9 * s, by + 10 * s); g.closePath(); g.fill();
      g.strokeStyle = '#ffe9a0'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(bx, by - 14 * s); g.lineTo(bx, by - 22 * s); g.moveTo(bx - 3.6 * s, by - 18.5 * s); g.lineTo(bx + 3.6 * s, by - 18.5 * s); g.stroke();
    }
    // лист каштана: семь пальчатых долей, расходящихся от черешка
    const lx = x + w * 0.64, ly = y + h * 0.9;
    const leaves = [[-1.42, 36, 11, '#4f9a3e'], [-0.96, 50, 15, '#7fb040'], [-0.48, 62, 18, '#d8b032'], [0, 70, 20, '#f2c43a'], [0.48, 62, 18, '#d8b032'], [0.96, 50, 15, '#7fb040'], [1.42, 36, 11, '#4f9a3e']];
    g.strokeStyle = '#7a5a22'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(lx, ly + 14); g.lineTo(lx, ly - 4); g.stroke();
    for (const [a, len, wid, c] of leaves) {
      g.save(); g.translate(lx, ly - 4); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-wid * 0.5, -len * 0.22, -wid * 0.95, -len * 0.62, 0, -len); g.bezierCurveTo(wid * 0.95, -len * 0.62, wid * 0.5, -len * 0.22, 0, 0); g.closePath();
      g.fillStyle = c; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(70,46,8,0.7)'; g.stroke();
      g.fillStyle = 'rgba(255,255,220,0.28)'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-wid * 0.5, -len * 0.22, -wid * 0.95, -len * 0.62, 0, -len); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,10,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, -len * 0.92); g.stroke(); g.restore();
    }
    // волны Днепра
    for (let r = 0; r < 3; r++) { g.fillStyle = ['#cfe6f4', '#7fb6dc', '#3b78b8'][r]; g.beginPath(); g.moveTo(x, y + h); for (let i = 0; i <= 12; i++) g.lineTo(x + i * w / 12, y + h - 9 - r * 7 + Math.sin(i * 1.7 + r) * 3); g.lineTo(x + w, y + h); g.closePath(); g.fill(); }
    g.restore();
    // смальта: сетка 6×6 и случайные плитки светлее/темнее
    const R = A.rng(55);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let yy = y; yy < y + h; yy += 6) for (let xx = x; xx < x + w; xx += 6) { const t = R.next(); if (t < 0.3) { g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(xx, yy, 6, 6); } else if (t < 0.55) { g.fillStyle = 'rgba(0,0,20,0.1)'; g.fillRect(xx, yy, 6, 6); } }
    g.strokeStyle = 'rgba(24,20,36,0.5)'; g.lineWidth = 0.9;
    for (let xx = x; xx <= x + w; xx += 6) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
    for (let yy = y; yy <= y + h; yy += 6) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    A.edge(g, x, y, w, 10, 't', 10, 'rgba(0,0,0,0.25)');
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(x, y, w, h);
    fit(g, 'КИЇВ', cx, y + h - 11, 60, 13, '#ffe9a0', { stroke: '#1c2f66', lw: 3 });
  }

  // Схема метро на стене: три линии (красная, синяя, зелёная) и пересадочные узлы.
  function scheme(g, cx, top, w, h) {
    hangShadow(g, cx - w / 2, top, w, h, 0.3);
    A.box(g, cx - w / 2, top, w, h, { fill: '#c3c7cf', lw: 3.2, r: 3, hi: 'rgba(255,255,255,0.6)' });
    const x = cx - w / 2 + 5, y = top + 5, ww = w - 10, hh = h - 10;
    g.fillStyle = '#f6f2e6'; g.fillRect(x, y, ww, hh);
    g.fillStyle = '#1f4fa3'; g.fillRect(x, y, ww, 14); fit(g, 'СХЕМА МЕТРО', cx, y + 7.4, ww - 8, 9.5, '#ffffff', { weight: 'bold' });
    const L = (pts, col) => { g.strokeStyle = col; g.lineWidth = 3.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(x + ww * px, y + hh * py) : g.moveTo(x + ww * px, y + hh * py))); g.stroke(); };
    L([[0.06, 0.5], [0.3, 0.5], [0.55, 0.47], [0.94, 0.4]], '#d9382f');
    L([[0.3, 0.2], [0.3, 0.5], [0.46, 0.66], [0.46, 0.94]], '#2b6fd0');
    L([[0.08, 0.84], [0.46, 0.66], [0.7, 0.5], [0.94, 0.3]], '#2f9a4a');
    g.lineCap = 'butt';
    for (const [px, py, r] of [[0.3, 0.5, 4.2], [0.46, 0.66, 4.2], [0.55, 0.47, 2.6], [0.7, 0.5, 4.2], [0.18, 0.5, 2.6], [0.3, 0.3, 2.6], [0.46, 0.8, 2.6], [0.82, 0.35, 2.6], [0.2, 0.74, 2.6]]) { g.beginPath(); g.arc(x + ww * px, y + hh * py, r, 0, 6.3); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
    g.fillStyle = '#e8403a'; g.beginPath(); g.arc(x + ww * 0.62, y + hh * 0.72, 3, 0, 6.3); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();     // «вы здесь»
    g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(x, y, ww, hh);
  }

  // Доска объявлений с отрывными листками: бумажки разного цвета, внизу — бахрома из телефонных «язычков».
  function tearBoard(g, cx, top, w, h) {
    hangShadow(g, cx - w / 2, top, w, h, 0.28);
    A.box(g, cx - w / 2, top, w, h, { fill: '#9ab0c8', lw: 3.2, r: 3, hi: 'rgba(255,255,255,0.3)' });
    const R = A.rng(37), x = cx - w / 2;
    [[5, 6, 28, 38, '#fff6e4'], [38, 10, 27, 30, '#f5e3a0'], [8, 48, 24, 34, '#d9ecf2'], [36, 44, 28, 40, '#fff6e4']].forEach(([px, py, pw, ph, c]) => {
      g.fillStyle = c; g.fillRect(x + px, top + py, pw, ph); g.strokeStyle = OUT; g.lineWidth = 1.4; g.strokeRect(x + px, top + py, pw, ph);
      g.fillStyle = 'rgba(43,26,32,0.5)'; for (let i = 0; i < 3; i++) g.fillRect(x + px + 3, top + py + 5 + i * 5, pw - 6 - (i === 2 ? 8 : 0), 1.8);
      for (let tx = x + px + 1; tx < x + px + pw - 3; tx += 5) { g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 0.9; g.strokeRect(tx, top + py + ph - 9, 4.6, 9); if (R.chance(0.3)) { g.fillStyle = '#9ab0c8'; g.fillRect(tx + 0.5, top + py + ph - 8, 3.8, 8); } }
      g.fillStyle = '#d63a3a'; g.beginPath(); g.arc(x + px + pw / 2, top + py + 2.4, 1.8, 0, 6.3); g.fill();
    });
  }

  function hallFeatures(g) {
    // «М» над входом в метро: световой короб на тягах
    hanger(g, 175, 100, 26);
    hangShadow(g, 133, 98, 84, 84, 0.32);
    A.box(g, 133, 98, 84, 84, { fill: '#f6f2e4', lw: 4, r: 10, hi: 'rgba(255,255,255,0.6)', lo: 'rgba(60,60,80,0.18)' });
    g.strokeStyle = '#1f4fa3'; g.lineWidth = 4; A.rrPath(g, 140, 105, 70, 70, 6); g.stroke();
    A.text(g, 'М', 175, 142, 62, '#1f4fa3', { stroke: '#1f4fa3', lw: 2 });
    A.glow(g, 175, 140, 100, 'rgba(210,230,255,', 0.3);
    // схема метро, табличка «ПІДЗЕМНИЙ ПЕРЕХІД», афиша
    scheme(g, 402, 262, 128, 100);
    A.box(g, 478, 236, 160, 26, { fill: '#1f4fa3', lw: 3, r: 4, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
    fit(g, 'ПІДЗЕМНИЙ ПЕРЕХІД', 558, 249.5, 146, 13.5, '#ffffff', { stroke: OUT, lw: 2.4 });
    lightbox(g, 560, 274, 80, 100, posterConcert);
  }

  function corridorFeatures(g, X) {
    hangSign(g, 432, 140, 214, 46, '#1f4fa3', 'ВИХІД У МІСТО', { arrow: 1, icon: (c, x, y) => pictoStairs(c, x, y, 1) });
    hangSign(g, 872, 140, 176, 46, '#1f4fa3', 'МЕТРО', { arrow: -1, icon: (c, x, y) => pictoMetro(c, x, y, 1), size: 22 });
    hangClock(g, 1317, 140, 28);
    hangSign(g, 1745, 140, 176, 46, '#2f7a4a', 'ПАРК', { arrow: 1, icon: (c, x, y) => pictoTree(c, x, y, 1), size: 22 });
    hangSign(g, 2165, 140, 236, 46, '#1f4fa3', 'ВИХІД У МІСТО', { arrow: 1, icon: (c, x, y) => pictoStairs(c, x, y, 1), size: 22 });
    mosaic(g, 985, 238, 196, 134);
    lightbox(g, 1368, 258, 84, 118, posterCinema); lightbox(g, 1482, 258, 84, 118, posterBank);
    tearBoard(g, 1800, 272, 72, 96);
    lightbox(g, 2112, 262, 76, 112, posterTravel);
  }

  // ---------------------------------------------------------------- мелочи: камеры, датчики, решётки, огнетушитель, знаки, сколы, наклейки
  function camera(g, x, y) {
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 76); g.lineTo(x, y); g.stroke();
    A.box(g, x - 10, y, 20, 8, { fill: '#e6e2d8', lw: 2.4, r: 3, hi: 'rgba(255,255,255,0.6)' });
    g.beginPath(); g.arc(x, y + 8, 9, 0, Math.PI); g.fillStyle = '#272630'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x - 1, y + 8, 5.5, 0.4, 1.4); g.stroke();
    g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(x + 6.4, y + 4, 1.4, 0, 6.3); g.fill();
  }
  function vent(g, x, y, w, h) {
    A.box(g, x - w / 2, y, w, h, { fill: '#cfc9bd', lw: 2.6, r: 2, hi: 'rgba(255,255,255,0.4)' });
    g.fillStyle = '#4a4650'; for (let yy = y + 4; yy < y + h - 3; yy += 4.6) g.fillRect(x - w / 2 + 4, yy, w - 8, 2);
  }
  function smoke(g, x, y) {
    g.beginPath(); g.ellipse(x, y, 7, 3.4, 0, 0, 6.3); g.fillStyle = '#f0ece0'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#4ae06a'; g.beginPath(); g.arc(x + 2.6, y - 0.4, 1, 0, 6.3); g.fill();
  }
  function extinguisher(g, x, y) {
    // красный огнетушитель на стене с табличкой над ним
    A.box(g, x - 14, y - 74, 28, 28, { fill: '#d8372c', lw: 2.6, r: 2 });
    g.fillStyle = '#ffffff'; A.rrPath(g, x - 5, y - 62, 8, 14, 2.4); g.fill(); g.fillRect(x - 3, y - 66, 4, 5); g.fillRect(x - 6, y - 68, 8, 2.6);       // значок: баллон, головка и ручка
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + 2, y - 66); g.quadraticCurveTo(x + 9, y - 66, x + 8, y - 58); g.stroke();
    g.fillStyle = 'rgba(46,28,24,0.25)'; A.rrPath(g, x - 5, y - 40, 20, 46, 6); g.fill();
    A.box(g, x - 9, y - 38, 18, 46, { fill: '#d8372c', lw: 2.8, r: 5, hi: 'rgba(255,255,255,0.35)', lo: 'rgba(0,0,0,0.2)' });
    A.box(g, x - 4.4, y - 46, 8.8, 9, { fill: '#2a2a32', lw: 2.2, r: 2 });
    g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + 4, y - 44); g.quadraticCurveTo(x + 18, y - 40, x + 14, y - 20); g.stroke(); g.strokeStyle = '#2a2a32'; g.lineWidth = 1.8; g.stroke();
    A.box(g, x - 7, y - 24, 14, 12, { fill: '#f6f0e0', lw: 1.6 });
  }
  function chip(g, x, y, w, h, seed) {
    // скол плитки: тёмный цемент с неровным краем
    const R = A.rng(seed);
    g.beginPath(); g.moveTo(x, y + h * 0.3); g.lineTo(x + w * 0.3, y); g.lineTo(x + w * 0.7, y + R.range(0, 3)); g.lineTo(x + w, y + h * 0.4); g.lineTo(x + w * 0.85, y + h); g.lineTo(x + w * 0.2, y + h - R.range(0, 3)); g.closePath();
    g.fillStyle = '#a99c84'; g.fill(); g.lineWidth = 1.3; g.strokeStyle = 'rgba(43,26,32,0.55)'; g.stroke();
    g.fillStyle = 'rgba(255,255,240,0.28)'; g.fillRect(x + w * 0.2, y + h - 3, w * 0.6, 1.6);
  }
  function sticker(g, kind, x, y) {
    g.save(); g.translate(x, y);
    if (kind === 'heart') { g.rotate(-0.15); g.beginPath(); g.moveTo(0, 7); g.bezierCurveTo(-12, -2, -6, -11, 0, -4); g.bezierCurveTo(6, -11, 12, -2, 0, 7); g.fillStyle = '#e8403a'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(43,26,32,0.75)'; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(-3.4, -3, 1.6, 0, 6.3); g.fill(); }
    else { g.beginPath(); g.arc(0, 0, 7, 0, 6.3); g.fillStyle = '#f6d34a'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(43,26,32,0.75)'; g.stroke(); g.fillStyle = OUT; g.beginPath(); g.arc(-2.6, -1.8, 1, 0, 6.3); g.arc(2.6, -1.8, 1, 0, 6.3); g.fill(); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 1, 3.2, 0.2, 2.9); g.stroke(); }
    g.restore();
  }
  function rulesPanel(g, cx, top) {
    // правила поведения в переходе: три запрета (курить, велосипед, собака без поводка)
    hangShadow(g, cx - 27, top, 54, 84, 0.28);
    A.box(g, cx - 27, top, 54, 84, { fill: '#f4f0e6', lw: 3, r: 3, hi: 'rgba(255,255,255,0.6)' });
    fit(g, 'ЗАБОРОНЕНО', cx, top + 8.5, 46, 8, '#c8302a', {});
    [0, 1, 2].forEach((i) => {
      const y = top + 28 + i * 18;
      g.beginPath(); g.arc(cx, y, 7.4, 0, 6.3); g.fillStyle = '#fff8ee'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = '#d8372c'; g.stroke();
      g.strokeStyle = OUT; g.fillStyle = OUT; g.lineWidth = 1.5;
      if (i === 0) { g.fillRect(cx - 4.4, y - 0.8, 6.6, 1.8); g.fillStyle = '#e07a2a'; g.fillRect(cx + 2.4, y - 0.8, 2, 1.8); }
      else if (i === 1) { g.beginPath(); g.arc(cx - 3, y + 1.6, 2.2, 0, 6.3); g.arc(cx + 3, y + 1.6, 2.2, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(cx - 3, y + 1.6); g.lineTo(cx, y - 2.6); g.lineTo(cx + 3, y + 1.6); g.stroke(); }
      else { g.beginPath(); g.ellipse(cx, y + 0.4, 3.6, 2, 0, 0, 6.3); g.fill(); g.fillRect(cx + 2.4, y - 3, 2.4, 2.6); g.fillRect(cx - 3.2, y + 1.6, 1.2, 2.4); g.fillRect(cx + 1.6, y + 1.6, 1.2, 2.4); }
      g.strokeStyle = '#d8372c'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 5.2, y - 5.2); g.lineTo(cx + 5.2, y + 5.2); g.stroke();
    });
  }
  function exitSign(g, cx, top) {
    hangShadow(g, cx - 28, top, 56, 28, 0.28);
    A.box(g, cx - 28, top, 56, 28, { fill: '#2e8f5a', lw: 3, r: 3, hi: 'rgba(255,255,255,0.3)' });
    pictoRun(g, cx - 14, top + 14, 0.95); fit(g, 'ВИХІД', cx + 12, top + 14.5, 30, 9.5, '#ffffff', {});
  }
  function wheelSign(g, cx, top) {
    hangShadow(g, cx - 16, top, 32, 32, 0.28);
    A.box(g, cx - 16, top, 32, 32, { fill: '#1f4fa3', lw: 3, r: 3, hi: 'rgba(255,255,255,0.3)' });
    pictoWheel(g, cx, top + 16, 0.95);
  }

  function details(g, W) {
    // потолок: камеры, датчики, решётки вентиляции
    for (const x of [650, 1097, 1532, 1955]) camera(g, x, 82);
    for (const x of [250, 640, 1100, 1480, 1940]) smoke(g, x, 152);
    for (const x of [262, 1010, 1480, 1960]) vent(g, x, 84, 46, 20);
    // стена: сколы, наклейки, подтёки накипи, огнетушитель
    for (const [x, y, w, h, sd] of [[636, 292, 26, 16, 1], [1436, 436, 22, 14, 2], [1856, 304, 24, 15, 3], [996, 470, 20, 13, 4], [2162, 456, 24, 14, 5], [366, 462, 20, 12, 6], [1100, 252, 20, 13, 7]]) chip(g, x, y, w, h, sd);
    sticker(g, 'heart', 944, 448); sticker(g, 'smile', 1086, 470); sticker(g, 'smile', 462, 440); sticker(g, 'heart', 1612, 300);
    for (const x of [1100, 1900, 2030, 700]) { const gr = g.createLinearGradient(0, TOP, 0, TOP + 70); gr.addColorStop(0, 'rgba(255,250,236,0.55)'); gr.addColorStop(1, 'rgba(255,250,236,0)'); g.fillStyle = gr; g.fillRect(x, TOP, 2.6, 70); g.fillRect(x + 6, TOP, 1.6, 44); }
    extinguisher(g, 2112, 500);
    // распределительный шкаф в зале (не дверь: войти нельзя) и баллончик-граффити на цоколе
    A.box(g, 354, 428, 52, 70, { fill: '#6f8294', lw: 3, r: 2, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
    g.save(); g.beginPath(); g.rect(354, 428, 52, 70); g.clip(); A.grain(g, 354, 428, 52, 70, 0.26, 'overlay', 87); g.restore();
    g.strokeStyle = 'rgba(20,28,38,0.7)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(380, 430); g.lineTo(380, 496); g.stroke();
    g.fillStyle = '#26303c'; for (let yy = 478; yy < 494; yy += 4) g.fillRect(358, yy, 18, 1.8);
    A.box(g, 384, 440, 16, 14, { fill: '#f2cf3a', lw: 1.8 }); g.fillStyle = OUT; g.beginPath(); g.moveTo(393, 442); g.lineTo(388, 450); g.lineTo(392, 450); g.lineTo(390, 453); g.lineTo(396, 446); g.lineTo(392, 446); g.closePath(); g.fill();
    A.box(g, 372, 411, 16, 20, { fill: '#8d929b', lw: 2.2 });
    g.save(); g.translate(898, 532); g.rotate(-0.12); g.lineCap = 'round';                                   // сердце-граффити: синий контур со светлым ореолом и жёлтое подчёркивание
    for (const [lw, col] of [[8, 'rgba(255,214,60,0.3)'], [4.6, '#2a5db0']]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(-18, -4, -10, -20, 0, -9); g.bezierCurveTo(10, -20, 18, -4, 0, 6); g.stroke();
    }
    g.strokeStyle = '#f2cf3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-20, 12); g.lineTo(22, 10); g.stroke(); g.restore();
    // лобби перед лестницей: правила, знак выхода, знак для колясок
    rulesPanel(g, 2190, 276);
    exitSign(g, 2252, 262); wheelSign(g, 2252, 296);
  }

  // ---------------------------------------------------------------- пол: коврик, тактильная полоса, решётка, лужи, мусор, каштановые листья
  // Путь неровного овала (для луж и пятен): вершины на эллипсе с разбросом, плавная кривая через середины рёбер.
  function blobPath(g, cx, cy, rw, rh, seed, amp) {
    const R = A.rng(seed), n = 12, p = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.2832, k = 1 + R.range(-amp, amp); p.push([cx + Math.cos(a) * rw * k, cy + Math.sin(a) * rh * k]); }
    const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    g.beginPath(); const s0 = m(p[n - 1], p[0]); g.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) { const e = m(p[i], p[(i + 1) % n]); g.quadraticCurveTo(p[i][0], p[i][1], e[0], e[1]); }
    g.closePath();
  }
  function puddle(g, cx, cy, rw, rh, seed) {
    blobPath(g, cx, cy, rw * 1.07, rh * 1.18, seed, 0.16); g.fillStyle = 'rgba(26,20,44,0.26)'; g.fill();
    blobPath(g, cx, cy, rw, rh, seed, 0.16);
    g.fillStyle = A.linG(g, 0, cy - rh, 0, cy + rh, [[0, 'rgba(170,180,206,0.6)'], [1, 'rgba(78,86,122,0.62)']]); g.fill();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(236,240,252,0.4)'; g.stroke();
    g.save(); blobPath(g, cx, cy, rw, rh, seed, 0.16); g.clip();
    g.fillStyle = 'rgba(246,250,255,0.5)'; g.beginPath(); g.ellipse(cx - rw * 0.2, cy - rh * 0.25, rw * 0.45, rh * 0.28, 0, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + rw * 0.1, cy + rh * 0.25); g.lineTo(cx + rw * 0.7, cy + rh * 0.2); g.stroke();
    g.restore();
  }
  function paperBall(g, x, y, r, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(30,18,40,0.22)'; g.beginPath(); g.ellipse(1, r * 0.8, r * 1.1, r * 0.4, 0, 0, 6.3); g.fill();
    g.fillStyle = '#f2eee2'; g.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, k = i % 2 ? 0.82 : 1; g.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k * 0.9); } g.closePath(); g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(43,26,32,0.7)'; g.stroke();
    g.strokeStyle = 'rgba(43,26,32,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-r * 0.6, -r * 0.2); g.lineTo(r * 0.1, r * 0.3); g.lineTo(r * 0.5, -r * 0.4); g.stroke(); g.restore();
  }
  function butt(g, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#f4efe2'; g.fillRect(-4, -1.2, 5, 2.4); g.fillStyle = '#d9962f'; g.fillRect(1, -1.2, 3, 2.4); g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 0.9; g.strokeRect(-4, -1.2, 8, 2.4); g.restore();
  }
  function leaf(g, x, y, rot, s, col) {
    // лист каштана на полу: пять пальчатых долей
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s * 0.55);
    for (const [a, len] of [[-1.2, 9], [-0.6, 12], [0, 14], [0.6, 12], [1.2, 9]]) {
      g.save(); g.rotate(a); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-3.4, -len * 0.3, -2.6, -len * 0.8, 0, -len); g.bezierCurveTo(2.6, -len * 0.8, 3.4, -len * 0.3, 0, 0); g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(70,40,10,0.7)'; g.stroke(); g.restore();
    }
    g.restore();
  }
  function conker(g, x, y, husk) {
    // каштан: блестящий коричневый, с матовым пятном; по желанию — зелёная колючая оболочка рядом
    g.fillStyle = 'rgba(30,18,40,0.25)'; g.beginPath(); g.ellipse(x + 1, y + 4, 6.4, 2.2, 0, 0, 6.3); g.fill();
    if (husk) {
      g.fillStyle = '#7fae4a'; g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.arc(x + 12, y, 7, 0, 6.3); g.fill(); g.stroke();
      g.strokeStyle = '#4f7a30'; for (let i = 0; i < 10; i++) { const a = i * 0.628; g.beginPath(); g.moveTo(x + 12 + Math.cos(a) * 6, y + Math.sin(a) * 6); g.lineTo(x + 12 + Math.cos(a) * 10, y + Math.sin(a) * 10); g.stroke(); }
    }
    g.beginPath(); g.arc(x, y, 5.2, 0, 6.3); g.fillStyle = A.linG(g, x - 5, y - 5, x + 5, y + 5, [[0, '#b0652e'], [0.5, '#7a3a18'], [1, '#4a220e']]); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#d9a46a'; g.beginPath(); g.ellipse(x + 1.4, y - 3, 2.6, 1.6, 0.2, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(x - 1.8, y - 1.2, 1.2, 0.8, -0.6, 0, 6.3); g.fill();
  }

  function floorDetails(g, W, H) {
    const R = A.rng(77);
    g.save(); g.beginPath(); g.rect(0, WALL, W, H - WALL); g.clip();
    A.blotches(g, 0, WALL, W, H - WALL, 28, 61, 'rgba(40,30,60,', 'rgba(255,250,240,');
    // трещины в плитах
    g.strokeStyle = 'rgba(30,18,44,0.4)'; g.lineWidth = 1.1;
    for (const [x, y] of [[640, 660], [1330, 640], [1930, 700], [820, 690], [2050, 650], [1520, 704]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + R.range(8, 16), y + R.range(4, 9)); g.lineTo(x + R.range(20, 34), y + R.range(-2, 8)); g.lineTo(x + R.range(40, 56), y + R.range(2, 12)); g.stroke(); }
    // резиновый коврик у выхода из метро
    poly(g, [[74, 598], [276, 598], [296, 640], [54, 640]]); g.fillStyle = A.linG(g, 0, 598, 0, 640, [[0, '#3a3640'], [1, '#2a2630']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.save(); poly(g, [[74, 598], [276, 598], [296, 640], [54, 640]]); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1.4; for (let y = 604; y < 640; y += 5) { g.beginPath(); g.moveTo(40, y); g.lineTo(300, y); g.stroke(); } A.grain(g, 50, 598, 250, 42, 0.3, 'overlay', 78); g.restore();
    // тактильная полоса и решётка водостока у подножия лестницы
    const tl = STAIR.l - 12, tw = STAIR.r - tl;
    g.fillStyle = A.linG(g, 0, 590, 0, 610, [[0, '#d4b844'], [1, '#bfa23a']]); g.fillRect(tl, 590, tw, 20);
    for (let x = tl + 8; x < STAIR.r; x += 13) for (let y = 596; y < 610; y += 7) { g.fillStyle = 'rgba(255,240,160,0.75)'; g.beginPath(); g.ellipse(x, y, 3, 2, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(80,60,10,0.4)'; g.beginPath(); g.ellipse(x + 1, y + 1.4, 3, 1.2, 0, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(60,40,10,0.65)'; g.fillRect(tl, 589, tw, 1.8); g.fillRect(tl, 609, tw, 1.8);
    A.box(g, tl, 640, tw, 16, { fill: '#8d919b', lw: 2.6, hi: 'rgba(255,255,255,0.3)' });
    g.fillStyle = '#25232c'; for (let x = tl + 6; x < STAIR.r - 4; x += 8) g.fillRect(x, 645, 4.6, 8);
    // лужи: у входа из метро, у лестницы (отражает дневной свет), посреди перехода
    puddle(g, 346, 652, 62, 8, 3); puddle(g, 2196, 668, 104, 11, 4); puddle(g, 1186, 692, 66, 8, 5); puddle(g, 1786, 678, 50, 6.5, 6);
    // мусор
    for (const [x, y, r, a] of [[880, 652, 5, 0.3], [1536, 692, 6, 1.1], [2020, 666, 5, 2], [646, 684, 4.4, 0.7], [1296, 702, 5, 1.6]]) paperBall(g, x, y, r, a);
    for (const [x, y, a] of [[724, 642, 0.4], [1262, 654, 2.3], [1962, 686, 5.4], [1132, 702, 3.1], [466, 692, 1], [1654, 664, 4]]) butt(g, x, y, a);
    // жвачка
    g.fillStyle = 'rgba(40,30,50,0.4)'; for (const [x, y] of [[760, 664], [1410, 650], [1856, 684], [596, 700], [2060, 690]]) { g.beginPath(); g.ellipse(x, y, 3, 1.6, 0, 0, 6.3); g.fill(); }
    // упавший стаканчик и листовка
    g.save(); g.translate(1706, 676); g.rotate(1.2); cup(g, 0, 0, 12, 16, { lid: true }); g.restore();
    g.save(); g.translate(1012, 664); g.rotate(0.22); g.fillStyle = '#f4efe2'; g.fillRect(-12, -7, 24, 14); g.strokeStyle = 'rgba(43,26,32,0.7)'; g.lineWidth = 1.2; g.strokeRect(-12, -7, 24, 14);
    g.fillStyle = '#e8564a'; g.fillRect(-9, -4, 9, 3); g.fillStyle = 'rgba(43,26,32,0.45)'; g.fillRect(-9, 1, 17, 1.6); g.fillRect(-9, 4, 11, 1.6); g.restore();
    // «классики» мелом на плитах у киоска «ТЕЛЕФОНИ» (в перспективе: квадраты низкие), пролитый кофе у «КАВА», лепестки у «КВІТИ», газетный лист у «ПРЕСА»
    {
      const Rh = A.rng(78), x0 = 1792, y0 = 654, sw = 31, sh = 17;
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 7; i++) {
        const x = x0 + i * sw, col = i % 3 === 2 ? 'rgba(255,196,214,0.88)' : 'rgba(255,255,255,0.84)';
        g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x + Rh.range(-1, 1), y0 + Rh.range(-0.8, 0.8)); g.lineTo(x + sw + Rh.range(-1, 1), y0 + Rh.range(-0.8, 0.8)); g.lineTo(x + sw + Rh.range(-1, 1), y0 + sh + Rh.range(-0.8, 0.8)); g.lineTo(x + Rh.range(-1, 1), y0 + sh + Rh.range(-0.8, 0.8)); g.closePath(); g.stroke();
        g.save(); g.translate(x + sw / 2, y0 + sh / 2 + 0.6); g.scale(1, 0.55); A.text(g, String(i + 1), 0, 0, 13, col, {}); g.restore();
      }
      g.strokeStyle = 'rgba(255,255,255,0.84)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x0 + 7 * sw + 17, y0 + sh / 2, 17, 9, 0, -Math.PI / 2, Math.PI / 2); g.stroke(); g.beginPath(); g.moveTo(x0 + 7 * sw + 17, y0 - 0.5); g.lineTo(x0 + 7 * sw + 17, y0 + sh + 0.5); g.stroke();
      g.lineCap = 'butt'; g.lineJoin = 'miter';
    }
    g.fillStyle = 'rgba(86,52,30,0.5)'; g.beginPath(); g.ellipse(846, 668, 15, 4.6, 0.1, 0, 6.3); g.ellipse(868, 676, 4, 1.6, 0, 0, 6.3); g.ellipse(826, 674, 3, 1.3, 0, 0, 6.3); g.fill();
    g.save(); g.translate(880, 664); g.rotate(0.4); cup(g, 0, 0, 11, 15, { lid: false }); g.restore();
    for (const [x, y, c] of [[1136, 664, '#f06c8e'], [1156, 676, '#fff6e4'], [1196, 658, '#f7c948'], [1244, 672, '#f06c8e'], [1286, 662, '#fff6e4'], [1262, 688, '#b46ad6'], [1170, 692, '#f7c948']]) {
      g.save(); g.translate(x, y); g.rotate(x * 0.07); g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, 4.4, 2.2, 0, 0, 6.3); g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(43,26,32,0.6)'; g.stroke(); g.restore();
    }
    g.save(); g.translate(1566, 672); g.rotate(-0.25); g.fillStyle = '#e4dfd2'; poly(g, [[-16, -8], [14, -10], [17, 6], [-12, 9]]); g.fill(); g.lineWidth = 1.3; g.strokeStyle = 'rgba(43,26,32,0.7)'; g.stroke();
    g.fillStyle = 'rgba(43,26,32,0.5)'; for (let i = 0; i < 4; i++) g.fillRect(-12, -5 + i * 3.4, 22 - (i % 2) * 6, 1.3);
    g.fillStyle = 'rgba(43,26,32,0.35)'; g.fillRect(-12, -6, 8, 5); g.restore();
    // листья каштана и каштаны: принесены с улицы, больше всего у лестницы
    for (const [x, y, a, c] of [[2306, 642, 0.4, '#d9a030'], [2346, 672, 2.2, '#c8741f'], [2404, 652, 4.1, '#e0b43a'], [2468, 694, 1.3, '#b8601c'], [2530, 658, 5.2, '#d9a030'], [2616, 676, 3.4, '#e0b43a'],
      [2660, 644, 0.9, '#c8741f'], [2248, 652, 2.8, '#d9a030'], [2150, 698, 1.8, '#c8741f'], [2040, 700, 5, '#e0b43a'], [420, 700, 0.5, '#d9a030'], [236, 664, 3.6, '#c8741f']]) leaf(g, x, y, a, 1, c);
    conker(g, 2374, 680, false); conker(g, 2574, 694, true); conker(g, 2152, 702, false);
    g.restore();
  }

  // Отражение низа стены и киосков в мокром граните: нижняя полоса слоя копируется один раз во временный холст вверх ногами, гасится градиентом и кладётся под линию стены.
  function reflection(g, W) {
    const c = g.canvas, k = c.width / W, n = 46, t = document.createElement('canvas');
    t.width = c.width; t.height = Math.max(1, Math.ceil(n * k));
    const tg = t.getContext('2d');
    tg.save(); tg.translate(0, t.height); tg.scale(1, -1); tg.drawImage(c, 0, Math.round((WALL - 2 - n) * k), c.width, t.height, 0, 0, c.width, t.height); tg.restore();
    tg.globalCompositeOperation = 'destination-in';
    const gr = tg.createLinearGradient(0, 0, 0, t.height); gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = gr; tg.fillRect(0, 0, t.width, t.height);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(t, 0, Math.round((WALL + 3) * k)); g.restore();
    t.width = 0; t.height = 0;                                                    // временный холст сразу освобождаем (память на iPhone)
  }

  // ---------------------------------------------------------------- свет: пятна под лампами, свечение коробов и киосков, отражения на полу, дневной свет с лестницы
  function lighting(g, W, H, X) {
    // стена чуть темнее между лампами; под лампами — тёплые пятна
    g.fillStyle = 'rgba(40,24,44,0.09)'; g.fillRect(0, TOP, W, WALL - TOP);
    for (const x of LAMPS) {
      if (x === 1425) continue;
      const k = x === 540 ? 0.55 : 1;
      pool(g, x, CEIL + 78, 180, 1.25, 1.5, 'rgba(255,240,192,', 0.24 * k);
      pool(g, x, WALL + 52, 120, 1.5, 0.7, 'rgba(255,246,214,', 0.24 * k);
    }
    // светящиеся вывески и афиши
    for (const [x, y, r] of [[560, 324, 74], [1368, 317, 78], [1482, 317, 78], [2112, 318, 74]]) A.glow(g, x, y, r, 'rgba(255,246,222,', 0.2);
    const kx = X.kiosks.map((k) => k[0]).concat([1960]);
    for (const x of kx) { A.glow(g, x, 372, 130, 'rgba(255,232,196,', 0.22); pool(g, x, 452, 110, 1.3, 0.62, 'rgba(255,214,150,', 0.16); pool(g, x, WALL + 46, 90, 1.7, 0.6, 'rgba(255,226,180,', 0.2); }
    // отражения ламп в мокром граните
    for (const x of LAMPS) if (x !== 1425) pool(g, x, 654, 86, 0.5, 0.95, 'rgba(255,248,222,', x === 540 ? 0.11 : 0.2);
    // дневной свет с лестницы: заливает подножие, ложится на пол и на соседнюю стену
    const sx = (STAIR.l + STAIR.r) / 2;
    pool(g, sx, 470, 330, 1.3, 1.1, 'rgba(255,252,226,', 0.2);
    pool(g, sx, 650, 260, 1.6, 0.5, 'rgba(255,252,230,', 0.46);
    pool(g, 2196, 668, 90, 1.4, 0.4, 'rgba(255,255,255,', 0.3);
    // свет станции у входа в метро
    pool(g, 175, 600, 150, 1.5, 0.5, 'rgba(255,220,160,', 0.22);
    A.edge(g, 0, 0, 150, H, 'l', 150, 'rgba(18,8,22,0.5)'); A.edge(g, W - 150, 0, 150, H, 'r', 150, 'rgba(18,8,22,0.4)');
  }

  // ---------------------------------------------------------------- главная функция
  KA.underpass = function (g, w, h, X) {
    STAIR.l = X.stairs - 72; STAIR.r = STAIR.l + 384;
    g.fillStyle = '#3a3238'; g.fillRect(0, 0, w, h);
    ceiling(g, w);
    tileField(g, 0, TOP, w, BAND0, 56, 28, CREAM, 3);
    tileField(g, 0, BAND1, w, PLINTH, 56, 28, SAND, 5);
    wallFinish(g, w);
    band(g, w);
    grime(g, w);
    plinth(g, w);
    cornice(g, w);
    for (const x of BEAMS) beamEnd(g, x);
    floor(g, w, h);
    g.fillStyle = OUT; g.fillRect(0, WALL - 1.5, w, 3);
    floorDetails(g, w, h);
    metroPortal(g);
    exitStairs(g);
    kiosksAll(g, X);
    hallFeatures(g);
    corridorFeatures(g, X);
    details(g, w);
    reflection(g, w);
    lighting(g, w, h, X);
  };

  // ---------------------------------------------------------------- низкие препятствия (рисуются сущностями перед стеной; размеры — коробки столкновений, герои их перепрыгивают)
  // Клетчатая «челночная» сумка: красно-синяя ткань в клетку, ручки, молния, складки.
  function plaidBag(g, x, y, w, h, base, c1, seed) {
    const bag = () => { g.beginPath(); g.moveTo(x + 4, y + h); g.quadraticCurveTo(x - 3, y + h * 0.5, x + 5, y + 7); g.quadraticCurveTo(x + w / 2, y - 2, x + w - 5, y + 7); g.quadraticCurveTo(x + w + 3, y + h * 0.5, x + w - 4, y + h); g.closePath(); };
    // ручки
    g.strokeStyle = OUT; g.lineWidth = 5.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + w * 0.3, y + 8); g.bezierCurveTo(x + w * 0.3, y - 8, x + w * 0.62, y - 8, x + w * 0.62, y + 8); g.stroke();
    g.strokeStyle = '#d9c28a'; g.lineWidth = 3; g.stroke(); g.lineCap = 'butt';
    bag(); g.fillStyle = base; g.fill();
    g.save(); bag(); g.clip();
    g.globalAlpha = 0.82; g.fillStyle = c1;
    for (let xx = x - 2 + (seed % 3); xx < x + w; xx += 11) g.fillRect(xx, y, 4.6, h);
    for (let yy = y + 2 + (seed % 4); yy < y + h; yy += 11) g.fillRect(x, yy, w, 4.6);
    g.globalAlpha = 0.85; g.fillStyle = '#f6efe0';
    for (let xx = x + 5 + (seed % 3); xx < x + w; xx += 11) g.fillRect(xx, y, 1.3, h);
    for (let yy = y + 7 + (seed % 4); yy < y + h; yy += 11) g.fillRect(x, yy, w, 1.3);
    g.globalAlpha = 1;
    g.fillStyle = A.linG(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,0.28)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(20,10,30,0.34)']]); g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.strokeStyle = 'rgba(20,10,30,0.3)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + w * 0.2, y + h * 0.4); g.quadraticCurveTo(x + w * 0.34, y + h * 0.58, x + w * 0.22, y + h * 0.82); g.moveTo(x + w * 0.74, y + h * 0.32); g.quadraticCurveTo(x + w * 0.62, y + h * 0.56, x + w * 0.78, y + h * 0.8); g.stroke();
    g.fillStyle = 'rgba(20,10,30,0.4)'; g.fillRect(x, y + 8, w, 3);                      // шов у горловины
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + w * 0.5 - 7, y + 4, 14, 2.4);   // бегунок молнии
    g.restore();
    bag(); g.lineWidth = 3.4; g.lineJoin = 'round'; g.strokeStyle = OUT; g.stroke();
  }

  function propBags(g, w, h) {
    // верх самой высокой сумки стоит на верхней грани коробки столкновений (y = 2 от края слоя), героиня встаёт на неё
    plaidBag(g, 2, 24, 50, 40, '#cf3a3a', '#2a5db0', 0);                  // слева, ниже
    plaidBag(g, 30, 3, 46, 61, '#2a5db0', '#cf3a3a', 1);                  // за ней, выше
    // багет торчит из средней сумки наискосок, не выше её верха
    g.save(); g.translate(52, 30); g.rotate(-0.95); A.rrPath(g, -4.4, -26, 8.8, 30, 4); g.fillStyle = '#d9a455'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(120,70,20,0.7)'; g.lineWidth = 1.6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-3, -22 + i * 6); g.lineTo(3, -19 + i * 6); g.stroke(); }
    g.restore();
    plaidBag(g, 62, 32, 32, 32, '#2f8a4a', '#e2c43a', 2);                 // справа, маленькая
  }

  function propKiosk(g, w, h) {
    // тележка «ПИРІЖКИ»: колёса, горчичная тумба, витрина с пирожками, полосатый козырёк
    for (const x of [22, 88]) { g.beginPath(); g.arc(x, 76, 8, 0, 6.3); g.fillStyle = '#2b2630'; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.beginPath(); g.arc(x, 76, 3, 0, 6.3); g.fillStyle = '#c0c4d0'; g.fill(); }
    A.box(g, 6, 40, 98, 31, { fill: '#d9a23a', lw: 3.6, hi: 'rgba(255,255,255,0.35)', lo: 'rgba(80,40,0,0.25)' });
    g.save(); g.beginPath(); g.rect(6, 40, 98, 31); g.clip(); A.grain(g, 6, 40, 98, 31, 0.24, 'overlay', 96); g.fillStyle = '#c4452e'; g.fillRect(6, 62, 98, 6); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(6, 62, 98, 1.6); g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(6, 62, 98, 6);
    fit(g, 'ПИРІЖКИ', 55, 52, 84, 13, '#fff8e8', { stroke: OUT, lw: 3 });
    A.box(g, 2, 32, 106, 9, { fill: '#efe5cf', lw: 3, r: 2, hi: 'rgba(255,255,255,0.7)', lo: 'rgba(60,40,30,0.2)' });
    // витрина
    g.fillStyle = 'rgba(150,200,220,0.5)'; g.fillRect(12, 9, 86, 23); g.fillStyle = '#4a2f22'; g.fillRect(14, 11, 82, 19);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {                                              // два ряда пирожков с бликом
      const x = 21 + i * 13.4, y = 17 + r * 9.4;
      g.beginPath(); g.ellipse(x, y, 6, 3.6, 0, 0, 6.3); g.fillStyle = r ? '#e0a448' : '#c98a3a'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = 'rgba(43,26,32,0.85)'; g.stroke();
      g.fillStyle = 'rgba(255,230,160,0.5)'; g.beginPath(); g.ellipse(x - 1.4, y - 1.2, 2.6, 1, 0, 0, 6.3); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.22)'; poly(g, [[16, 31], [40, 9], [52, 9], [28, 31]]); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(12, 9, 86, 23);
    for (const x of [12, 98]) { g.fillStyle = '#b8bcc6'; g.fillRect(x - 2, 8, 4, 25); g.lineWidth = 1.8; g.strokeRect(x - 2, 8, 4, 25); }
    // козырёк
    for (let i = 0; i < 8; i++) {
      const x0 = 5 + i * 12.5, x1 = x0 + 12.5, xm = x0 + 6.25;
      g.fillStyle = i % 2 ? '#fbf0d8' : '#c4452e'; g.beginPath(); g.moveTo(x0, 1); g.lineTo(x1, 1); g.lineTo(x1, 8); g.arc(xm, 8, 6.25, 0, Math.PI); g.lineTo(x0, 1); g.closePath(); g.fill();
      g.lineWidth = 2.4; g.strokeStyle = OUT; g.beginPath(); g.moveTo(x0, 1); g.lineTo(x0, 8); g.arc(xm, 8, 6.25, Math.PI, 0, true); g.lineTo(x1, 1); g.stroke();
    }
    g.fillStyle = OUT; g.fillRect(5, 0, 100, 2.6);
  }

  function propCart(g, w, h) {
    // платформенная тележка с ящиками: ручка слева, четыре колёсика, стяжка-ремень
    for (const x of [18, 36, 86, 104]) { g.beginPath(); g.arc(x, 64, 6, 0, 6.3); g.fillStyle = '#2b2630'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(); g.beginPath(); g.arc(x, 64, 2.2, 0, 6.3); g.fillStyle = '#c0c4d0'; g.fill(); }
    // ручка-стойка
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(12, 54); g.lineTo(9, 10); g.lineTo(22, 6); g.stroke(); g.strokeStyle = '#6a707e'; g.lineWidth = 3.6; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10.6, 52); g.lineTo(7.6, 12); g.stroke(); g.lineCap = 'butt';
    // платформа
    A.box(g, 6, 52, 108, 9, { fill: '#4d5361', lw: 3.4, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.25)' });
    // ящики
    const box = (x, y, bw, bh, c, rot) => {
      g.save(); g.translate(x + bw / 2, y + bh / 2); g.rotate(rot); g.translate(-bw / 2, -bh / 2);
      A.box(g, 0, 0, bw, bh, { fill: c, lw: 3.2, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(60,30,0,0.22)' });
      g.save(); g.beginPath(); g.rect(0, 0, bw, bh); g.clip(); A.grain(g, 0, 0, bw, bh, 0.28, 'overlay', 98);
      g.fillStyle = 'rgba(240,226,190,0.55)'; g.fillRect(bw / 2 - 4, 0, 8, bh);                                    // скотч
      g.fillStyle = '#fbf6e8'; g.fillRect(5, bh - 13, 17, 9); g.fillStyle = 'rgba(43,26,32,0.7)'; g.fillRect(7, bh - 11, 12, 1.4); g.fillRect(7, bh - 8, 8, 1.4);   // наклейка
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bw / 2 - 4, 0); g.lineTo(bw / 2 - 4, bh); g.moveTo(bw / 2 + 4, 0); g.lineTo(bw / 2 + 4, bh); g.stroke();
      g.restore();
    };
    box(26, 22, 62, 30, '#c9a06a', 0); box(52, 4, 48, 19, '#d8b47e', -0.05);
    g.strokeStyle = OUT; g.lineWidth = 5.4; g.beginPath(); g.moveTo(22, 46); g.lineTo(92, 46); g.stroke(); g.strokeStyle = '#3a6fd0'; g.lineWidth = 3; g.stroke();     // ремень
  }

  function propBin(g, w, h) {
    // сортировочный бак: две секции с цветными крышками (жёлтая — пластик, синяя — бумага), ножки, наклейки
    for (const [x, c, hole, label] of [[3, '#e8c23a', true, 'ПЛАСТИК'], [45, '#3a6fd0', false, 'ПАПІР']]) {
      for (const dx of [5, 31]) { g.fillStyle = '#25232c'; g.fillRect(x + dx, 54, 6, 6); }
      A.box(g, x, 12, 40, 44, { fill: '#4a5560', lw: 3.4, r: 3, hi: 'rgba(255,255,255,0.2)', lo: 'rgba(0,0,0,0.25)' });
      g.save(); g.beginPath(); g.rect(x, 12, 40, 44); g.clip(); A.grain(g, x, 12, 40, 44, 0.26, 'overlay', 99);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 3, 14, 3, 40); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 48, 40, 8);
      g.restore();
      A.box(g, x - 2, 3, 44, 12, { fill: c, lw: 3.2, r: 3, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.22)' });
      if (hole) { g.fillStyle = '#1c1820'; g.beginPath(); g.ellipse(x + 20, 9, 9, 3.4, 0, 0, 6.3); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke(); }
      else { g.fillStyle = '#1c1820'; A.rrPath(g, x + 8, 7, 24, 4.4, 2); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke(); }
      A.box(g, x + 6, 22, 28, 28, { fill: '#f4efe2', lw: 2, r: 2 });
      g.strokeStyle = c === '#e8c23a' ? '#a8860a' : '#1f4fa3'; g.lineWidth = 2.2; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x + 20, 26); g.lineTo(x + 27, 38); g.lineTo(x + 13, 38); g.closePath(); g.stroke();                       // знак переработки
      fit(g, label, x + 20, 45.5, 26, 6.6, '#2b1a20', {});
    }
    g.fillStyle = '#f4efe2'; g.save(); g.translate(60, 6); g.rotate(0.5); g.beginPath(); g.arc(0, 0, 3.6, 0, 6.3); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(43,26,32,0.7)'; g.stroke(); g.restore();   // смятая бумажка на крышке
  }

  KA.underpassProps = function (X) {
    const mk = (w, h, fn) => A.layer(w + 12, h + 12, (g) => { g.translate(6, 6); fn(g, w, h); }, 2);
    return { bags: mk(96, 64, propBags), kiosk: mk(110, 84, propKiosk), cart: mk(120, 70, propCart), bin: mk(88, 60, propBin) };
  };
})();
