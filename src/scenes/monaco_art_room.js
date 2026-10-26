// Монако, комната-сюрприз в пещере (сцена birthdayRoom, ширина 1800). Рисуется кодом в манере Парижа и Киева; общие кисти — Ale.MonacoArt.kit (monaco_art.js).
// Пещера, украшенная к празднику: тёплая скала с сосульками-сталактитами, гирлянды лампочек и флажки, баннер «С ДНЁМ РОЖДЕНИЯ, АЛЕСЯ!» над семьёй (X.banner), ниши со свечами, золотые шары «2» и «3» у входа, шары-гроздья,
// подарки; справа длинный праздничный стол с тортом и 23 свечами (X.table; sc.room.candles — сколько горит: пламя мерцает, погасшая свеча дымит), столик с пультом (X.remoteTable, пока sc.room.remote === true),
// у правой стены — место портала (X.portal; sc.room.portal 0…1: нет — стена, растёт — голубо-фиолетовый вихрь с искрами). В стене над столом — проём пещеры к ночному морю (звёзды, луна, огни дальнего берега).
// Семья стоит на ковре в середине (X.marina … X.grandfather), поэтому там нет стола и крупных предметов. Неподвижное собрано в слои (A.layer), живое — на кадр: пламя, гирлянды, звёзды, шары, портал, дым.
// Снимок «очками» (Ale.Photo) рисует сцену на отдельный холст — все функции берут холст только из аргумента ctx и вид — из sc.lastCam.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const MA = (Ale.MonacoArt = Ale.MonacoArt || {});
  const K = MA.kit;
  const { FY, WALL, TAU, dens, lighter, darker, rgba, hash, guard, sprite, deco } = K;
  const WIN = { x0: 1126, x1: 1476, top: 150, sill: 404 };            // проём в стене над столом: ночное море
  const GOLD = ['#fff2b0', '#f0c452', '#a8741a'];
  const CANDLES = 23;
  const BAL = ['#ff6f9c', '#ffcc4a', '#40c8c0', '#ff7a5a', '#fff4e8', '#a98cff', '#7adf9a'];
  const RANK = (() => { const R = A.rng(23), a = Array.from({ length: CANDLES }, (_, i) => i); for (let i = CANDLES - 1; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; })();      // порядок, в котором гаснут свечи
  const gold = (g, y0, y1) => A.linG(g, 0, y0, 0, y1, [[0, GOLD[0]], [0.5, GOLD[1]], [1, GOLD[2]]]);

  // =================================================================== пещерная скала
  function caveRock(g, W, H) {
    const R = A.rng(7);
    g.fillStyle = A.linG(g, 0, 0, 0, H, [[0, '#2c1f30'], [0.25, '#503c44'], [0.6, '#7e5e4e'], [1, '#926f58']]); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 110; i++) {
      const cx = R.range(0, W), cy = R.range(40, H - 10), rw = R.range(60, 190), rh = R.range(40, 120), n = R.int(5, 8), pts = [];
      for (let k = 0; k < n; k++) { const a = k * TAU / n + R.range(-0.25, 0.25); pts.push([cx + Math.cos(a) * rw * R.range(0.6, 1), cy + Math.sin(a) * rh * R.range(0.6, 1)]); }
      g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      const lit = R.next(); g.fillStyle = lit > 0.5 ? 'rgba(255,214,170,' + (0.03 + 0.09 * (lit - 0.5)).toFixed(3) + ')' : 'rgba(20,8,24,' + (0.05 + 0.12 * (0.5 - lit)).toFixed(3) + ')'; g.fill();
      g.strokeStyle = 'rgba(24,10,26,0.2)'; g.lineWidth = 1.4; g.stroke();
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let y = 80 + R.range(0, 20); y < H; y += R.range(24, 52)) { g.strokeStyle = R.chance(0.5) ? 'rgba(255,224,190,0.12)' : 'rgba(24,10,26,0.2)'; g.lineWidth = R.range(1.2, 3); g.beginPath(); g.moveTo(-6, y); for (let x = 0; x <= W + 12; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 4 + R.range(-2, 2)); g.stroke(); }
    for (let i = 0; i < 60; i++) { let x = R.range(0, W), y = R.range(60, H - 80); g.strokeStyle = 'rgba(20,8,24,0.4)'; g.lineWidth = R.range(1.2, 2.4); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += R.range(-10, 10); y += R.range(10, 24); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 16; i++) A.glow(g, R.range(0, W), R.range(150, 520), R.range(120, 260), R.pick(['rgba(214,120,90,', 'rgba(224,170,90,', 'rgba(150,100,170,']), 0.11);
    A.gradV(g, 0, 0, W, H, [[0, 'rgba(8,2,14,0.55)'], [0.3, 'rgba(8,2,14,0.12)'], [0.8, 'rgba(255,170,90,0.05)'], [1, 'rgba(40,16,10,0.25)']]);
    A.grain(g, 0, 0, W, H, 0.2, 'overlay', 17, 0.6);
  }
  // Сталактит: тёмная капля скалы с бликом слева; (x, y0) — основание под потолком
  function drip(g, x, y0, w, len) {
    g.beginPath(); g.moveTo(x - w / 2, y0 - 2); g.quadraticCurveTo(x - w * 0.34, y0 + len * 0.5, x + 1, y0 + len); g.quadraticCurveTo(x + w * 0.34, y0 + len * 0.5, x + w / 2, y0 - 2); g.closePath();
    g.fillStyle = A.linG(g, x - w / 2, 0, x + w / 2, 0, [[0, '#6a4a50'], [0.45, '#40303c'], [1, '#1c1220']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,214,170,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - w * 0.22, y0 + 2); g.quadraticCurveTo(x - w * 0.14, y0 + len * 0.5, x, y0 + len * 0.85); g.stroke();
  }
  function winPath(g) {
    const { x0, x1, top, sill } = WIN, cx = (x0 + x1) / 2;
    g.beginPath(); g.moveTo(x0 + 6, sill);
    g.lineTo(x0 - 6, sill - 90); g.quadraticCurveTo(x0 - 14, top + 80, x0 + 40, top + 36); g.quadraticCurveTo(cx - 50, top - 14, cx + 20, top - 6); g.quadraticCurveTo(x1 - 14, top + 6, x1 + 2, top + 70); g.lineTo(x1 + 12, sill - 70); g.lineTo(x1 - 4, sill); g.closePath();
  }

  // =================================================================== ночное море в проёме
  // Нарисованное ночное море (заказ 27, view_night_sea): полная луна, звёзды, горы, огни города на берегу и лунная дорожка. Картина (3:2) вписана «по заполнению» в проём 410×290: луна — правее середины,
  // дорожка под ней; MOON_X — где в мире стоит луна, чтобы блики на воде ложились на дорожку. Нет картины — прежнее ночное море кодом.
  const NIGHT = { name: 'view_night_sea', moonK: 0.688 };
  const nightPainted = () => !!(Ale.Assets && Ale.Assets.images && Ale.Assets.images[NIGHT.name]);
  function nightView(g, w, h) {
    if (A.image(g, NIGHT.name, 0, 0, w, h, { at: 0.5, zoom: 1, top: 0 })) return;
    const R = A.rng(33), hy = h * 0.66;
    g.fillStyle = A.linG(g, 0, 0, 0, hy, [[0, '#080e30'], [0.45, '#232b70'], [0.8, '#6a4688'], [1, '#e8946c']]); g.fillRect(0, 0, w, hy + 2);
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,236,' + R.range(0.3, 0.9).toFixed(2) + ')'; g.beginPath(); g.arc(R.range(0, w), R.range(0, hy * 0.8), R.range(0.5, 1.3), 0, TAU); g.fill(); }
    A.glow(g, w * 0.7, hy * 0.32, 80, 'rgba(255,238,190,', 0.5); g.fillStyle = '#fff8dc'; g.beginPath(); g.arc(w * 0.7, hy * 0.32, 15, 0, TAU); g.fill(); g.fillStyle = 'rgba(210,190,150,0.5)'; g.beginPath(); g.arc(w * 0.7 - 4, hy * 0.32 - 2, 5, 0, TAU); g.arc(w * 0.7 + 5, hy * 0.32 + 5, 3.4, 0, TAU); g.fill();
    // силуэт дальнего берега с огнями города
    g.fillStyle = '#14163c'; g.beginPath(); g.moveTo(0, hy + 2); for (let x = 0; x <= w; x += 8) g.lineTo(x, hy - 14 - 16 * Math.sin(x * 0.03) - 9 * Math.sin(x * 0.09 + 1)); g.lineTo(w, hy + 2); g.closePath(); g.fill();
    for (let i = 0; i < 70; i++) { const x = R.range(0, w), y = hy - R.range(0, 20); g.fillStyle = R.pick(['rgba(255,226,140,0.95)', 'rgba(255,200,110,0.9)', 'rgba(255,244,200,0.9)']); g.fillRect(x, y, 1.6, 1.6); }
    const sea = A.linG(g, 0, hy, 0, h, [[0, '#2a3a78'], [0.4, '#16255a'], [1, '#0a1238']]); g.fillStyle = sea; g.fillRect(0, hy, w, h - hy + 2);
    g.save(); g.beginPath(); g.moveTo(w * 0.7 - 14, hy); g.lineTo(w * 0.7 + 14, hy); g.lineTo(w * 0.7 + 50, h); g.lineTo(w * 0.7 - 50, h); g.closePath(); g.clip();
    g.fillStyle = A.linG(g, 0, hy, 0, h, [[0, 'rgba(255,240,200,0.6)'], [1, 'rgba(255,240,200,0.1)']]); g.fillRect(w * 0.7 - 60, hy, 120, h - hy); g.restore();
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(180,200,255,' + R.range(0.06, 0.2).toFixed(2) + ')'; g.fillRect(R.range(0, w), hy + R.range(3, h - hy), R.range(8, 28), 1.2); }
  }

  // =================================================================== гирлянды, флажки, баннер, ниши
  // Гирлянды лампочек: [x0, y0, x1, y1, провис, число]; лампочки считаются один раз и для слоя, и для свечения на кадр
  const STRINGS = [[-10, 112, 660, 158, 46, 20], [560, 140, 1220, 128, 52, 20], [1100, 112, 1810, 154, 44, 21], [180, 214, 760, 236, 36, 15]];
  const BULBS = [];
  for (const [x0, y0, x1, y1, sag, n] of STRINGS) for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; BULBS.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u + sag * 4 * u * (1 - u), c: ['#fff0c0', '#ffe08a', '#ffd0a0', '#fff4d8', '#ffe8b0'][i % 5], ph: i * 1.7 }); }
  function wires(g) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [x0, y0, x1, y1, sag] of STRINGS) { g.strokeStyle = 'rgba(14,8,16,0.9)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= 24; k++) { const u = k / 24, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + sag * 4 * u * (1 - u); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    for (const b of BULBS) {
      g.fillStyle = '#2a2024'; g.fillRect(b.x - 2, b.y - 1, 4, 6);
      g.beginPath(); g.ellipse(b.x, b.y + 9, 4.6, 6.4, 0, 0, TAU); g.fillStyle = b.c; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(b.x - 1.4, b.y + 7, 1.2, 2, 0, 0, TAU); g.fill();
    }
  }
  function bunting(g, x0, y0, x1, y1, sag, n, seed) {
    const R = A.rng(seed), cols = ['#ff6f9c', '#ffcc4a', '#40c8c0', '#ff7a5a', '#a98cff', '#7adf9a'];
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(14,8,16,0.85)'; g.lineWidth = 1.8; g.beginPath();
    for (let k = 0; k <= 30; k++) { const u = k / 30, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + sag * 4 * u * (1 - u); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + sag * 4 * u * (1 - u), sl = (y1 - y0 + sag * 4 * (1 - 2 * u)) / (x1 - x0), w = 20, hh = 26 + R.range(-3, 3);
      g.save(); g.translate(x, y); g.rotate(Math.atan(sl) * 0.7);
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(0, hh); g.closePath(); g.fillStyle = cols[i % cols.length]; g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-w / 2 + 2, 2); g.lineTo(-1, 2); g.lineTo(-w / 4 - 1, hh * 0.5); g.closePath(); g.fill();
      g.restore();
    }
  }
  // Баннер «С ДНЁМ РОЖДЕНИЯ, АЛЕСЯ!»: тканая лента с провисом, буквы по дуге в разных цветах, розетки на концах
  const BANNER_TEXT = 'С ДНЁМ РОЖДЕНИЯ, АЛЕСЯ!';
  function banner(g, cx, cy) {
    const sag = 24, h = 104;
    g.save(); g.font = 'bold 44px ' + Ale.FONT;
    const chars = Array.from(BANNER_TEXT), sp = 3, adv = chars.map((c) => g.measureText(c).width + sp), total = adv.reduce((a, b) => a + b, 0) - sp;
    g.restore();
    const hw = total / 2 + 54, y0 = cy - h / 2 - sag / 2, yT = (x) => y0 + sag * (1 - Math.pow((x - cx) / hw, 2));       // верх ленты: у краёв y0, посередине провис
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + s * hw, y0 + 2); g.lineTo(cx + s * (hw + 46), y0 - 76); g.stroke(); g.strokeStyle = '#d8c090'; g.lineWidth = 2.6; g.stroke();
      // верёвка привязана к крюку в стене (раньше её конец просто обрывался в воздухе и баннер казался повешенным на палки)
      const hx = cx + s * (hw + 46), hy = y0 - 76;
      g.fillStyle = '#5c4e42'; g.beginPath(); g.arc(hx, hy, 7, 0, TAU); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = '#c4b49a'; g.beginPath(); g.arc(hx - 2, hy - 2, 2.2, 0, TAU); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.arc(hx, hy + 3, 5.5, 0, TAU); g.stroke(); g.strokeStyle = '#d8c090'; g.lineWidth = 2.4; g.stroke();
    }
    const fabric = () => {
      g.beginPath(); g.moveTo(cx - hw, yT(cx - hw));
      for (let x = cx - hw; x <= cx + hw; x += 8) g.lineTo(x, yT(x));
      g.lineTo(cx + hw, yT(cx + hw) + h);
      const n = 14; for (let i = n; i >= 0; i--) { const x = cx - hw + i * 2 * hw / n; g.lineTo(x, yT(x) + h + (i % 2 ? 11 : 0)); }
      g.closePath();
    };
    fabric(); g.fillStyle = A.linG(g, 0, y0, 0, y0 + h + sag, [[0, '#fff8e6'], [1, '#ffe8c4']]); g.fill(); g.lineWidth = 3.4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    g.save(); fabric(); g.clip();
    for (let k = 1; k < 12; k++) { const x = cx - hw + k * (2 * hw) / 12; g.fillStyle = k % 2 ? 'rgba(160,100,60,0.07)' : 'rgba(255,255,255,0.3)'; g.fillRect(x - 10, y0 - 10, 20, h + sag + 30); }
    g.strokeStyle = '#ff9ab4'; g.lineWidth = 2.4; g.setLineDash([8, 6]); g.beginPath(); for (let x = cx - hw + 10; x <= cx + hw - 10; x += 8) { const y = yT(x) + 11; if (x === cx - hw + 10) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.setLineDash([]);
    g.beginPath(); for (let x = cx - hw + 10; x <= cx + hw - 10; x += 8) { const y = yT(x) + h - 5; if (x === cx - hw + 10) g.moveTo(x, y); else g.lineTo(x, y); } g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]);
    A.grain(g, cx - hw, y0 - 10, hw * 2, h + sag + 30, 0.12, 'overlay', 5, 0.6);
    g.restore();
    // буквы по дуге ленты
    const cols = ['#ff5a7a', '#f0a020', '#20b0b8', '#7a60e0', '#ff7a4a', '#30b060'];
    let x = cx - total / 2;
    g.save(); g.font = 'bold 44px ' + Ale.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    chars.forEach((c, i) => {
      const w = adv[i] - sp, mx = x + w / 2, by = yT(mx) + h / 2 + 1, slope = (yT(mx + 1) - yT(mx - 1)) / 2;
      g.save(); g.translate(mx, by); g.rotate(Math.atan(slope));
      if (c !== ' ') { g.lineWidth = 8; g.strokeStyle = OUT; g.strokeText(c, 0, 0); g.fillStyle = cols[i % cols.length]; g.fillText(c, 0, 0); g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.strokeText(c, -0.8, -1.2); }
      g.restore();
      x += adv[i];
    });
    g.restore();
    for (const s of [-1, 1]) {                                                                                         // розетки на концах
      const rx = cx + s * (hw - 4), ry = yT(rx) + 12;
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8; g.fillStyle = k % 2 ? '#ff6f9c' : '#ffcc4a'; g.beginPath(); g.ellipse(rx + Math.cos(a) * 11, ry + Math.sin(a) * 11, 8, 4.4, a, 0, TAU); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
      g.beginPath(); g.arc(rx, ry, 6.4, 0, TAU); g.fillStyle = '#fff4d0'; g.fill(); g.lineWidth = 2; g.stroke();
    }
  }
  // Ниша со свечами: вырезанная в камне арка с подсвеченным нутром, латунная полочка, 3–4 свечи (пламя — на кадр)
  const NICHES = [[200, 3], [310, 4], [420, 3], [530, 4], [1566, 4]];
  const NICHE_BASE = 470;
  const CAND = (i) => { const R = A.rng(60 + i * 7), n = NICHES[i][1], out = []; for (let k = 0; k < n; k++) out.push({ dx: (k - (n - 1) / 2) * 13 + R.range(-2, 2), h: R.range(22, 40), c: R.pick(['#fff4dc', '#ffd9e0', '#d8f0f0', '#fff0b8']) }); return out; };
  const CANDS = NICHES.map((_, i) => CAND(i));
  function niche(g, i) {
    const cx = NICHES[i][0], base = NICHE_BASE, w = 64, h = 108;
    const path = (grow) => { g.beginPath(); g.moveTo(cx - w / 2 - grow, base + grow * 0.3); g.lineTo(cx - w / 2 - grow, base - h + w / 2); g.arc(cx, base - h + w / 2, w / 2 + grow, Math.PI, 0); g.lineTo(cx + w / 2 + grow, base + grow * 0.3); g.closePath(); };
    path(8); g.fillStyle = A.linG(g, cx - 40, 0, cx + 40, 0, [[0, '#b08a70'], [1, '#5e4440']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    path(0); g.fillStyle = A.linG(g, 0, base - h, 0, base, [[0, '#3a1c1c'], [0.5, '#c86a34'], [1, '#f0a050']]); g.fill();
    g.save(); path(0); g.clip(); A.glow(g, cx, base - 40, 56, 'rgba(255,214,130,', 0.6); A.edge(g, cx - w / 2, base - h, w, h, 'l', 14, 'rgba(30,8,8,0.5)'); A.edge(g, cx - w / 2, base - h, w, h, 'r', 14, 'rgba(30,8,8,0.35)'); A.edge(g, cx - w / 2, base - h, w, 24, 't', 24, 'rgba(30,8,8,0.5)'); g.restore();
    path(0); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    A.box(g, cx - w / 2 - 8, base - 2, w + 16, 8, { fill: gold(g, base - 2, base + 6), lw: 2.4, r: 2 });                              // латунная полочка
    for (const c of CANDS[i]) {
      const x = cx + c.dx;
      g.fillStyle = '#c89a3a'; g.beginPath(); g.ellipse(x, base - 1, 6, 2.2, 0, 0, TAU); g.fill();
      g.fillStyle = c.c; g.fillRect(x - 3.2, base - 2 - c.h, 6.4, c.h); g.lineWidth = 1.5; g.strokeStyle = OUT; g.strokeRect(x - 3.2, base - 2 - c.h, 6.4, c.h);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 2, base - 2 - c.h, 1.6, c.h); g.fillStyle = 'rgba(180,120,80,0.3)'; g.fillRect(x + 0.6, base - 2 - c.h, 2, c.h);
      g.fillStyle = '#2a1a20'; g.fillRect(x - 0.5, base - 2 - c.h - 4, 1, 4);
    }
    // цветочки у ниши
    K.flowerBed(g, cx - 28, base + 12, 56, 700 + i, { h: 14, cols: ['#ff6f9c', '#fff4e8', '#ffcc4a'] });
  }

  // =================================================================== стена пещеры (слой)
  function roomWall(g, W, H) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    caveRock(g, W, H);
    // потолок: тёмная масса со сталактитами
    const R = A.rng(19);
    const ceil = (x) => 54 + 20 * Math.sin(x * 0.011 + 1) + 12 * Math.sin(x * 0.037);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); for (let x = W; x >= 0; x -= 12) g.lineTo(x, ceil(x)); g.closePath();
    g.fillStyle = A.linG(g, 0, 0, 0, 90, [[0, '#120a16'], [1, '#2e2030']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    for (let x = 30; x < W; x += R.range(40, 90)) drip(g, x, ceil(x) - 4, R.range(14, 34), R.range(18, 70));
    // проём в стене: прозрачное окно, кромка и подоконник из камня
    g.save(); g.globalCompositeOperation = 'destination-out'; winPath(g); g.fill(); g.restore();
    winPath(g); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,214,170,0.4)'; g.stroke();
    A.box(g, WIN.x0 - 14, WIN.sill - 4, WIN.x1 - WIN.x0 + 30, 16, { fill: A.linG(g, 0, WIN.sill - 4, 0, WIN.sill + 12, [[0, '#d8b090'], [1, '#8a6450']]), lw: 3, r: 4, hi: 'rgba(255,240,210,0.5)' });
    for (let k = 0; k < 9; k++) { const x = WIN.x0 + 40 + k * 36; g.strokeStyle = '#3f7c3c'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, WIN.top + 30 - Math.abs(k - 4) * -1); g.quadraticCurveTo(x + R.range(-6, 6), WIN.top + 62, x + R.range(-8, 8), WIN.top + R.range(70, 110)); g.stroke(); }          // плющ над проёмом
    A.beam(g, 1300, WIN.sill, 300, 1190, 590, 500, 0.09, 'rgba(160,190,255,');                                              // лунный свет из проёма на стол и пол
    // вход слева: тёмный проход в пещеру
    const door = () => { g.beginPath(); g.moveTo(-10, 584); g.lineTo(-10, 330); g.quadraticCurveTo(70, 296, 140, 360); g.lineTo(168, 584); g.closePath(); };
    door(); g.fillStyle = A.linG(g, 0, 330, 0, 584, [[0, '#0a0610'], [1, '#1c1424']]); g.fill();
    g.save(); door(); g.clip(); A.glow(g, 20, 520, 130, 'rgba(120,150,220,', 0.16); g.restore();
    door(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,214,170,0.35)'; g.stroke();
    // ниши
    NICHES.forEach((_, i) => niche(g, i));
    // тёплые пятна света от гирлянд
    for (const b of BULBS) if (b.ph % 3 < 1.9) A.glow(g, b.x, b.y + 34, 70, 'rgba(255,214,140,', 0.07);
    for (const [cx] of NICHES) A.glow(g, cx, NICHE_BASE - 40, 120, 'rgba(255,190,110,', 0.2);
    // флажки, гирлянды, баннер
    bunting(g, 14, 176, 560, 214, 32, 20, 3); bunting(g, 1250, 196, 1790, 170, 30, 20, 4);
    wires(g);
    A.edge(g, 0, 0, W, H, 'b', 60, 'rgba(10,4,12,0.3)');
  }

  // =================================================================== пол
  // Пол поднят: линия ходьбы (FY) лежит на 24 юнита глубже верхней кромки плит, и персонажи стоят на полу, а не парят над его верхом (владелец 03.10.2026)
  const FLOOR_UP = 24;
  function roomFloor(WIDTH) {
    const SH = 0.36;
    return A.layer(WIDTH, 720 - WALL + 12 + FLOOR_UP, (g, w, h) => {
      const R = A.rng(27), y0 = 13, hh = h - y0;
      g.save(); g.beginPath(); g.rect(0, y0, w, hh); g.clip(); g.transform(1, 0, SH, 1, -SH * y0, 0);
      const xa = -SH * h - 30, xb = w + 30;
      // каменные плиты
      g.fillStyle = 'rgba(40,24,28,0.7)'; g.fillRect(xa, y0, xb - xa, hh);
      const tones = ['#b89678', '#a98a6e', '#c4a284', '#9c7e66', '#b2927a'];
      let rh = 9, y = y0;
      for (let row = 0; y < y0 + hh; row++) {
        const rhh = Math.min(rh, y0 + hh - y), sw = 64 + row * 8;
        for (let x = xa - (row % 2) * sw / 2 - R.range(0, 12); x < xb; x += sw) { g.fillStyle = R.pick(tones); g.fillRect(x + 1.3, y + 1.3, sw - 2.6, rhh - 2.6); g.fillStyle = 'rgba(255,240,210,0.2)'; g.fillRect(x + 1.3, y + 1.3, sw - 2.6, Math.min(2.4, rhh * 0.3)); }
        y += rhh; rh += 1.2;
      }
      // ковёр-дорожка: бирюзовое поле, золотая кайма и ромбы
      const cx0 = 150, cx1 = 1520;
      g.fillStyle = 'rgba(20,10,14,0.55)'; g.fillRect(cx0 - 5, y0 + 4, cx1 - cx0 + 10, hh);
      g.fillStyle = A.linG(g, 0, y0, 0, y0 + hh, [[0, '#1a6a72'], [1, '#124e5c']]); g.fillRect(cx0, y0 + 6, cx1 - cx0, hh);
      let ry = y0 + 6, rr = 15;
      for (let row = 0; ry < y0 + hh; row++) {
        const rhh = Math.min(rr, y0 + hh - ry), pw = 92 + row * 8;
        for (let x = cx0 - (row % 2) * pw / 2; x < cx1; x += pw) { const mx = x + pw / 2, my = ry + rhh / 2; g.strokeStyle = 'rgba(240,196,82,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(mx, my - rhh * 0.46); g.lineTo(mx + pw * 0.34, my); g.lineTo(mx, my + rhh * 0.46); g.lineTo(mx - pw * 0.34, my); g.closePath(); g.stroke(); g.fillStyle = 'rgba(255,122,100,0.45)'; g.beginPath(); g.ellipse(mx, my, pw * 0.07, rhh * 0.16, 0, 0, TAU); g.fill(); }
        ry += rhh; rr += 2.6;
      }
      g.strokeStyle = '#d8b24a'; g.lineWidth = 3.4; g.strokeRect(cx0, y0 + 6, cx1 - cx0, hh + 4); g.strokeStyle = 'rgba(255,248,200,0.5)'; g.lineWidth = 1; g.strokeRect(cx0 + 4, y0 + 10, cx1 - cx0 - 8, hh + 4);
      g.fillStyle = '#f0c452'; for (let x = cx0 + 2; x < cx1; x += 7) g.fillRect(x, y0 + 8, 2, 6);
      g.restore();
      A.gradV(g, 0, 13, w, h - 13, [[0, 'rgba(24,8,16,0.4)'], [0.2, 'rgba(24,8,16,0)'], [1, 'rgba(255,214,160,0.05)']]);
      A.grain(g, 0, y0, w, hh, 0.16, 'overlay', 27, 0.55);
      // конфетти на полу
      for (let i = 0; i < 160; i++) { g.save(); g.translate(R.range(0, w), R.range(22, h - 8)); g.rotate(R.range(0, TAU)); g.fillStyle = R.pick(BAL); g.fillRect(-2.4, -1, 4.8, 2); g.restore(); }
      // кромка: тёмный плинтус у стены
      A.gradV(g, 0, 0, w, 14, [[0, '#4a3a3a'], [1, '#2a1c22']]); g.fillStyle = 'rgba(255,214,170,0.3)'; g.fillRect(0, 2, w, 2); g.fillStyle = OUT; g.fillRect(0, 0, w, 3); g.fillRect(0, 13, w, 2);
    }, dens(1.5));
  }

  // =================================================================== шары, подарки, торшер, стол
  function balloon(g, x, y, rx, ry, col, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.beginPath(); g.moveTo(0, ry); g.bezierCurveTo(-rx * 1.1, ry * 0.5, -rx * 1.05, -ry * 1.05, 0, -ry); g.bezierCurveTo(rx * 1.05, -ry * 1.05, rx * 1.1, ry * 0.5, 0, ry); g.closePath();
    g.fillStyle = A.linG(g, -rx, -ry, rx, ry, [[0, lighter(col, 0.35)], [0.45, col], [1, darker(col, 0.32)]]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.ellipse(-rx * 0.4, -ry * 0.4, rx * 0.2, ry * 0.32, -0.5, 0, TAU); g.fill();
    g.fillStyle = darker(col, 0.25); g.beginPath(); g.moveTo(-3.4, ry + 4); g.lineTo(3.4, ry + 4); g.lineTo(0, ry - 1); g.closePath(); g.fill(); g.lineWidth = 1.4; g.stroke();
    g.restore();
  }
  // Гроздь шаров на ниточках к грузику на полу. Начало — грузик (0, 0); шары — на высоте ≈ −260…−320; foil — два золотых числа «2» и «3»
  function balloonCluster(g, seed, foil) {
    const R = A.rng(seed), knot = [0, -220];
    g.lineCap = 'round';
    const items = [];
    if (foil) { items.push({ x: -34, y: -300, num: '2', a: -0.1 }, { x: 34, y: -296, num: '3', a: 0.1 }); }
    else for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + R.range(-0.2, 0.2), d = i ? R.range(22, 38) : 0; items.push({ x: Math.cos(a) * d, y: -292 + Math.sin(a) * d * 0.8, col: BAL[i % BAL.length], a: Math.cos(a) * 0.2 }); }
    for (const b of items) { g.strokeStyle = OUT; g.lineWidth = 3.2; g.beginPath(); g.moveTo(b.x, b.y + (foil ? 54 : 24)); g.quadraticCurveTo((b.x + knot[0]) / 2 + R.range(-6, 6), (b.y + knot[1]) / 2, knot[0], knot[1]); g.stroke(); g.strokeStyle = '#f6efe0'; g.lineWidth = 1.2; g.stroke(); }
    g.strokeStyle = OUT; g.lineWidth = 3.2; g.beginPath(); g.moveTo(knot[0], knot[1]); g.lineTo(0, -12); g.stroke(); g.strokeStyle = '#f6efe0'; g.lineWidth = 1.2; g.stroke();
    A.shadow(g, 0, 4, 22, 0.3);
    A.box(g, -13, -16, 26, 16, { fill: A.linG(g, 0, -16, 0, 0, [[0, '#ff9ab4'], [1, '#c8486a']]), lw: 2.6, r: 3 }); g.fillStyle = '#ffe08a'; g.fillRect(-13, -9, 26, 3);
    for (const b of items) {
      if (foil) {
        g.save(); g.translate(b.x, b.y); g.rotate(b.a);
        g.font = 'bold 104px ' + Ale.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.lineWidth = 12; g.strokeStyle = OUT; g.strokeText(b.num, 0, 0); g.fillStyle = A.linG(g, 0, -52, 0, 52, [[0, '#fff6c0'], [0.4, '#f6cc4c'], [0.75, '#c8901c'], [1, '#f0c452']]); g.fillText(b.num, 0, 0);
        g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.strokeText(b.num, -2, -2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-26, -40, 6, 30);
        g.restore();
      } else balloon(g, b.x, b.y, 17, 21, b.col, b.a);
    }
  }
  function gift(g, x, base, w, h, col, rib, tilt) {
    g.save(); g.translate(x, base); g.rotate(tilt || 0); g.lineJoin = 'round';
    g.fillStyle = A.linG(g, -w / 2, 0, w / 2, 0, [[0, lighter(col, 0.25)], [0.6, col], [1, darker(col, 0.3)]]); g.fillRect(-w / 2, -h, w, h); g.lineWidth = 2.6; g.strokeStyle = OUT; g.strokeRect(-w / 2, -h, w, h);
    g.fillStyle = darker(col, 0.12); g.fillRect(-w / 2 - 3, -h - 9, w + 6, 10); g.strokeRect(-w / 2 - 3, -h - 9, w + 6, 10);
    g.fillStyle = rib; g.fillRect(-4, -h - 9, 8, h + 9); g.strokeStyle = OUT; g.lineWidth = 1.4; g.strokeRect(-4, -h - 9, 8, h + 9);
    g.beginPath(); g.ellipse(-8, -h - 14, 9, 5.4, -0.5, 0, TAU); g.ellipse(8, -h - 14, 9, 5.4, 0.5, 0, TAU); g.fillStyle = rib; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(0, -h - 11, 4, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }
  // Торшер: латунная стойка, тёплый тканевой абажур
  function floorLamp(g) {
    g.lineJoin = 'round';
    A.shadow(g, 3, 3, 26, 0.3);
    g.beginPath(); g.ellipse(0, -4, 20, 6, 0, 0, TAU); g.fillStyle = gold(g, -10, 2); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -150); g.stroke(); g.strokeStyle = GOLD[1]; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.moveTo(-26, -150); g.lineTo(26, -150); g.lineTo(18, -196); g.lineTo(-18, -196); g.closePath(); g.fillStyle = A.linG(g, -26, 0, 26, 0, [[0, '#fff4d0'], [0.5, '#ffe49a'], [1, '#e8b860']]); g.fill(); g.lineWidth = 2.8; g.stroke();
    g.strokeStyle = 'rgba(180,120,40,0.4)'; g.lineWidth = 1.4; for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(k * 40, -150); g.lineTo(k * 28, -196); g.stroke(); }
  }
  // Праздничный стол: белая скатерть до пола с кружевной каймой, дорожка, шампанское, макаруны, торт (тело; свечи и пламя — на кадр). Начало — середина стола на полу
  const TOP = 92;
  function table(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 8, 6, 226, 0.34);
    // скатерть: передняя стенка со складками и фестонами
    const cloth = () => { g.beginPath(); g.moveTo(-200, -TOP); g.lineTo(200, -TOP); g.lineTo(206, -4); for (let x = 206; x > -206; x -= 22) g.quadraticCurveTo(x - 11, 8, x - 22, -4); g.closePath(); };
    cloth(); g.fillStyle = A.linG(g, -200, 0, 200, 0, [[0, '#fff8ec'], [0.5, '#f6ecd8'], [1, '#dcccb2']]); g.fill();
    g.save(); cloth(); g.clip();
    for (let k = 0; k < 14; k++) { const x = -190 + k * 28; g.fillStyle = k % 2 ? 'rgba(140,100,70,0.08)' : 'rgba(255,255,255,0.5)'; g.fillRect(x, -TOP, 12, TOP + 10); }
    g.fillStyle = A.linG(g, 0, -34, 0, 0, [[0, 'rgba(255,240,210,0)'], [1, 'rgba(240,196,82,0.36)']]); g.fillRect(-210, -34, 420, 40);
    g.strokeStyle = 'rgba(190,150,100,0.5)'; g.lineWidth = 1.2; for (let x = -200; x < 200; x += 22) { g.beginPath(); g.arc(x + 11, -20, 9, 0, Math.PI); g.stroke(); }                         // кружево
    A.edge(g, -200, -TOP, 400, 20, 't', 20, 'rgba(120,80,40,0.28)');
    g.restore();
    cloth(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    // столешница
    g.beginPath(); g.moveTo(-204, -TOP); g.lineTo(-190, -TOP - 22); g.lineTo(190, -TOP - 22); g.lineTo(204, -TOP); g.closePath(); g.fillStyle = A.linG(g, 0, -TOP - 22, 0, -TOP, [[0, '#fffaf0'], [1, '#f0e4cc']]); g.fill(); g.lineWidth = 3; g.stroke();
    // бирюзовая дорожка с золотой каймой и кисточками
    g.beginPath(); g.moveTo(-56, -TOP - 22); g.lineTo(56, -TOP - 22); g.lineTo(62, -TOP); g.lineTo(62, -TOP + 36); g.lineTo(-62, -TOP + 36); g.lineTo(-62, -TOP); g.closePath(); g.fillStyle = A.linG(g, 0, -TOP, 0, -TOP + 36, [[0, '#2a9aa4'], [1, '#126a74']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.fillStyle = '#f0c452'; g.fillRect(-62, -TOP + 28, 124, 4); for (let k = 0; k < 9; k++) g.fillRect(-58 + k * 14, -TOP + 32, 3, 8);
    // слева: башенка макарунов и фрукты
    const mac = ['#ffb0c8', '#ffe08a', '#a8e4d0', '#d0b8ff', '#ffc4a0'];
    for (let r = 0; r < 4; r++) for (let c = 0; c <= 3 - r; c++) { const x = -168 + c * 18 + r * 9, y = -TOP - 22 - r * 11; g.fillStyle = mac[(r + c) % 5]; g.beginPath(); g.ellipse(x, y - 4, 9, 4.4, 0, 0, TAU); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#fff4e0'; g.fillRect(x - 8, y - 2, 16, 2.6); }
    g.beginPath(); g.ellipse(-168 + 18, -TOP - 12, 38, 6, 0, 0, TAU); g.fillStyle = gold(g, -TOP - 18, -TOP - 6); g.fill(); g.lineWidth = 2; g.stroke();
    for (const [x, c] of [[-128, '#e03a4a'], [-116, '#f08a2a'], [-104, '#e03a4a'], [-122, '#a8c83a']]) { g.beginPath(); g.arc(x, -TOP - 22 - 8 + (x % 3), 7, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - 2, -TOP - 31 + (x % 3), 1.8, 0, TAU); g.fill(); }
    // справа: ведёрко с шампанским, бокалы, ваза с розами, подарок
    g.beginPath(); g.moveTo(112, -TOP - 22); g.lineTo(150, -TOP - 22); g.lineTo(144, -TOP - 52); g.lineTo(118, -TOP - 52); g.closePath(); g.fillStyle = A.linG(g, 112, 0, 150, 0, [[0, '#f0f2f8'], [1, '#9aa2b4']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.moveTo(125, -TOP - 52); g.lineTo(125, -TOP - 78); g.lineTo(137, -TOP - 78); g.lineTo(137, -TOP - 52); g.closePath(); g.fillStyle = '#2f5a3c'; g.fill(); g.lineWidth = 2; g.stroke(); g.fillStyle = '#e8c04a'; g.fillRect(125, -TOP - 80, 12, 5);
    for (const gx of [168, 184]) { g.beginPath(); g.moveTo(gx - 8, -TOP - 54); g.lineTo(gx + 8, -TOP - 54); g.lineTo(gx + 1.4, -TOP - 38); g.lineTo(gx + 1.4, -TOP - 28); g.lineTo(gx + 7, -TOP - 27); g.lineTo(gx - 7, -TOP - 27); g.lineTo(gx - 1.4, -TOP - 28); g.lineTo(gx - 1.4, -TOP - 38); g.closePath(); g.fillStyle = 'rgba(224,242,250,0.85)'; g.fill(); g.lineWidth = 1.6; g.stroke(); g.fillStyle = 'rgba(250,224,120,0.8)'; g.fillRect(gx - 5, -TOP - 51, 10, 8); }
    g.strokeStyle = '#3f7c3c'; g.lineWidth = 3; g.beginPath(); g.moveTo(-86, -TOP - 22); g.lineTo(-86, -TOP - 50); g.stroke();
    A.box(g, -100, -TOP - 52, 28, 30, { fill: A.linG(g, -100, 0, -72, 0, [[0, '#d8e8f0'], [1, '#98acc0']]), lw: 2.4, r: 6 });
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.beginPath(); g.arc(-86 + Math.cos(a) * 11, -TOP - 66 + Math.sin(a) * 6, 6.4, 0, TAU); g.fillStyle = k % 2 ? '#ff6f8a' : '#ff9ab4'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
    g.beginPath(); g.arc(-86, -TOP - 66, 5.4, 0, TAU); g.fillStyle = '#ffc0d0'; g.fill(); g.stroke();
  }
  // Торт без свечей: подставка, два яруса розовой глазури со стёками, жемчуг, ягоды, золотая лента. Начало — середина основания подставки на столе (y = −TOP − 20)
  function cake(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.ellipse(0, -2, 104, 12, 0, 0, TAU); g.fillStyle = A.linG(g, 0, -12, 0, 10, [[0, '#fffaf0'], [1, '#d8c8aa']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = gold(g, -12, 0); g.fillRect(-16, -14, 32, 12); g.strokeRect(-16, -14, 32, 12);
    const tier = (hw, y1, y0, top) => {
      g.beginPath(); g.moveTo(-hw, y1); g.lineTo(-hw, y0); g.ellipse(0, y0, hw, 11, 0, Math.PI, 0, true); g.lineTo(hw, y1); g.ellipse(0, y1, hw, 11, 0, 0, Math.PI); g.closePath();
      g.fillStyle = A.linG(g, -hw, 0, hw, 0, [[0, '#ffd0de'], [0.4, '#ffb0c8'], [1, '#e87aa0']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.save(); g.clip();
      for (let x = -hw + 8; x < hw; x += 17) { g.fillStyle = '#fff6f0'; g.beginPath(); g.ellipse(x, y0 + 4, 5.6, 4 + Math.abs((x * 7) % 9), 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-hw + 6, y0 + 2, 6, y1 - y0);
      g.restore();
      g.beginPath(); g.ellipse(0, y0, hw, 11, 0, 0, TAU); g.fillStyle = A.linG(g, 0, y0 - 11, 0, y0 + 11, [[0, '#fff2f6'], [1, '#ffc8d8']]); g.fill(); g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; for (let a = 0; a < TAU; a += 0.46) { g.beginPath(); g.arc(Math.cos(a) * (hw - 5), y0 + Math.sin(a) * 6, 2.4, 0, TAU); g.fill(); }
    };
    tier(88, -14, -52);
    g.fillStyle = A.linG(g, 0, -34, 0, -22, [[0, '#2a9aa4'], [1, '#126a74']]); g.fillRect(-88, -34, 176, 10); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-88, -34, 176, 10); g.fillStyle = '#f0c452'; g.fillRect(-88, -31, 176, 2.4);
    for (const [x, c] of [[-66, '#e03a4a'], [-34, '#e03a4a'], [-4, '#e03a4a'], [28, '#e03a4a'], [58, '#e03a4a']]) { g.beginPath(); g.moveTo(x - 7, -50); g.quadraticCurveTo(x, -66, x + 7, -50); g.quadraticCurveTo(x, -42, x - 7, -50); g.fillStyle = c; g.fill(); g.lineWidth = 1.6; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 3, -56, 2, 3); }
    tier(62, -52, -88);
    g.fillStyle = '#f0c452'; for (let x = -52; x <= 52; x += 26) { g.beginPath(); g.arc(x, -66, 2.6, 0, TAU); g.fill(); }
  }
  // Позиции свечей на верхнем ярусе: два ряда по ходу эллипса (задний выше). Координаты — от середины основания торта
  const CAKE_TOP = -88, CANDLE_POS = (() => { const out = []; for (let i = 0; i < CANDLES; i++) { const u = (i + 0.5) / CANDLES, a = Math.PI * 0.08 + u * Math.PI * 0.84; out.push({ x: -Math.cos(a) * 54, y: CAKE_TOP + (i % 2 ? -5 : 4), c: ['#ffd0de', '#cfe8ff', '#fff2a8', '#c8f0d8', '#ffd8b0'][i % 5], h: 17 }); } out.sort((p, q) => p.y - q.y); return out; })();
  function roundTable(g) {
    g.lineJoin = 'round';
    A.shadow(g, 2, 3, 30, 0.3);
    // круглый столик с кружевной скатертью
    g.fillStyle = '#3a2a2e'; g.fillRect(-4, -66, 8, 62); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-4, -66, 8, 62);
    g.beginPath(); g.ellipse(0, -4, 20, 5, 0, 0, TAU); g.fillStyle = '#3a2a2e'; g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-40, -70); g.lineTo(40, -70); g.lineTo(34, -34); for (let x = 34; x > -34; x -= 17) g.quadraticCurveTo(x - 8.5, -24, x - 17, -34); g.closePath(); g.fillStyle = A.linG(g, -40, 0, 40, 0, [[0, '#fffaf0'], [1, '#e0d2b8']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.ellipse(0, -70, 40, 8, 0, 0, TAU); g.fillStyle = A.linG(g, 0, -78, 0, -62, [[0, '#fffaf0'], [1, '#f0e4cc']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    A.box(g, -7, -88, 14, 14, { fill: A.linG(g, -7, 0, 7, 0, [[0, '#d8e8f0'], [1, '#98acc0']]), lw: 2, r: 4 });
    g.strokeStyle = '#3f7c3c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -88); g.lineTo(-2, -100); g.moveTo(0, -88); g.lineTo(5, -98); g.stroke();
    for (const [x, y, c] of [[-2, -104, '#ff6f9c'], [6, -101, '#ffcc4a']]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 1.5; g.stroke(); }
  }

  // =================================================================== кадр: свечи, гирлянды, звёзды, портал
  let glowSpr = null;
  function glowSprite() {
    if (glowSpr && glowSpr.width) return glowSpr;
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, 'rgba(255,236,170,0.95)'); gr.addColorStop(0.3, 'rgba(255,214,130,0.4)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    return (glowSpr = c);
  }
  // Пламя горящих свечей одним проходом: наружный язык, внутренний, белая сердцевина; (x, y) — верхушка фитиля
  function flames(ctx, list, t, seed) {
    ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath();
    for (const f of list) { const sw = Math.sin(t * 9 + f.i * 2.3 + seed) * 0.9, hh = 8.4 + Math.sin(t * 13 + f.i * 1.7) * 1.1; ctx.moveTo(f.x, f.y); ctx.bezierCurveTo(f.x - 3.6, f.y - 2, f.x - 2 + sw, f.y - hh * 0.7, f.x + sw, f.y - hh); ctx.bezierCurveTo(f.x + 2 + sw, f.y - hh * 0.7, f.x + 3.6, f.y - 2, f.x, f.y); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,238,150,0.95)'; ctx.beginPath();
    for (const f of list) { const sw = Math.sin(t * 9 + f.i * 2.3 + seed) * 0.6, hh = 5.6; ctx.moveTo(f.x, f.y - 0.4); ctx.bezierCurveTo(f.x - 2, f.y - 2, f.x - 1 + sw, f.y - hh * 0.7, f.x + sw, f.y - hh); ctx.bezierCurveTo(f.x + 1 + sw, f.y - hh * 0.7, f.x + 2, f.y - 2, f.x, f.y - 0.4); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); for (const f of list) { ctx.moveTo(f.x + 1, f.y - 2); ctx.arc(f.x, f.y - 2, 1, 0, TAU); } ctx.fill();
  }
  // Портал: вихрь голубо-фиолетового света на стене. k — раскрытие 0…1; все изменения плавные (без резких вспышек)
  function drawPortal(ctx, X, k, t) {
    if (k <= 0.002) return;
    const cx = X.portal, cy = FY - 112, rx = 56 * k, ry = 122 * k, a = Math.min(1, k * 1.4);
    A.glow(ctx, cx, cy, 200 * k, 'rgba(120,150,255,', 0.4 * a);
    ctx.save(); ctx.translate(cx, FY + 2); ctx.scale(1, 0.16); A.glow(ctx, 0, 0, 120 * k, 'rgba(140,170,255,', 0.5 * a); ctx.restore();             // отсвет на полу
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.clip();
    const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, ry);
    gr.addColorStop(0, 'rgba(245,252,255,' + a + ')'); gr.addColorStop(0.3, 'rgba(150,220,255,' + a + ')'); gr.addColorStop(0.65, 'rgba(110,100,230,' + a + ')'); gr.addColorStop(1, 'rgba(40,24,120,' + a + ')');
    ctx.fillStyle = gr; ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    ctx.lineCap = 'round';
    for (let s = 0; s < 3; s++) {
      ctx.strokeStyle = 'rgba(235,248,255,' + (0.5 * a).toFixed(3) + ')'; ctx.lineWidth = 3.4 * k + 0.8; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const u = i / 40, th = u * 5.2 + t * 0.9 + s * 2.094, r = 0.12 + 0.9 * u; const x = cx + Math.cos(th) * rx * r, y = cy + Math.sin(th) * ry * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy, 8 * k, 14 * k, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5 * k + 1; ctx.strokeStyle = 'rgba(210,230,255,' + (0.85 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0, rx - 2.4), Math.max(0, ry - 2.4), 0, 0, TAU); ctx.stroke();       // при малом k радиус был отрицательным: ellipse бросал исключение, 12 кадров подряд — и игра откатывалась к контрольной точке («телепорт» после диалога с Илюшкинсом)
    // искры по краю: медленно вращаются и гаснут
    ctx.fillStyle = 'rgba(220,240,255,' + (0.9 * a).toFixed(3) + ')'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const u = (t * 0.22 + i / 16) % 1, th = i * 2.399 + t * 0.6, d = 1 + u * 0.22, x = cx + Math.cos(th) * rx * d, y = cy + Math.sin(th) * ry * d, r = (1 - u) * 2.4 * k + 0.4; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fill();
  }

  // =================================================================== сборка
  MA.nightPaint = Object.assign({ win: WIN }, NIGHT);                                          // для проверок: имя картины и где в проёме стоит луна
  MA.roomLayers = guard('roomLayers', function (game, WIDTH, X) {
    const wall = A.layer(WIDTH, 592, (g) => roomWall(g, WIDTH, 592), dens(1.5));
    const floor = roomFloor(WIDTH);
    const night = sprite(410, 290, 0, 0, dens(1.6), (g) => nightView(g, 410, 290));
    glowSprite();
    return { wall, floor, night };
  });
  MA.roomBack = guard('roomBack', function (ctx, cam, game, sc, L) {
    const W = game.viewW, H = game.viewH, t = sc.time;
    ctx.fillStyle = '#1a1020'; ctx.fillRect(0, 0, W, H);
    // ночное море в проёме (под стеной: окно в стене прозрачное)
    if (WIN.x1 + 40 > cam.x && WIN.x0 - 40 < cam.x + W) {
      const np = nightPainted();
      L.night(ctx, WIN.x0 - 30 - cam.x, WIN.top - 20);
      ctx.save(); ctx.translate(-cam.x, 0);
      ctx.fillStyle = 'rgba(255,255,240,0.9)'; ctx.beginPath();
      for (let i = 0; i < 12; i++) { if (Math.sin(t * (1.1 + hash(i) * 1.4) + i * 2.7) < 0.3) continue; const x = WIN.x0 + 20 + hash(i * 3.3) * (WIN.x1 - WIN.x0 - 40), y = WIN.top + 10 + hash(i * 5.1) * 130; ctx.moveTo(x - 3.4, y); ctx.lineTo(x + 3.4, y); ctx.moveTo(x, y - 3.4); ctx.lineTo(x, y + 3.4); }
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,240,0.9)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(210,225,255,0.7)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 9; i++) { if (Math.sin(t * (0.9 + hash(i + 9) * 0.9) + i * 1.9) < 0.1) continue; const y = WIN.top + 188 + hash(i * 2.1) * 56, x = (np ? WIN.x0 - 30 + NIGHT.moonK * 410 : WIN.x0 + 150) + (hash(i * 4.7) - 0.5) * (np ? 70 : 140), len = 4 + (y - WIN.top - 180) * 0.1; ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); }
      ctx.stroke();
      ctx.restore();
    }
    A.blitView(ctx, L.wall, -cam.x, 0, W);
    A.blitView(ctx, L.floor, -cam.x, WALL - 4 - FLOOR_UP, W);
  });
  MA.roomDecor = guard('roomDecor', function (X, sc) {
    const out = [];
    const put = (name, ax, ay, z, hw, w, h, ox, oy, scale, fn, shadow) => { const spr = sprite(w, h, ox, oy, scale, fn); deco(out, sc, name, ax, z, hw, (ctx) => { if (shadow) A.shadow(ctx, ax, ay + 2, shadow[0], shadow[1]); spr(ctx, ax, ay); }); return spr; };
    // ---- баннер «С ДНЁМ РОЖДЕНИЯ, АЛЕСЯ!» над семьёй: рисуется, пока sc.room.banner не false
    { const bn = sprite(900, 260, 450, 190, dens(1.7), (g) => banner(g, 0, 0)); deco(out, sc, 'banner', X.banner, 5, 480, (ctx) => { if (sc.room && sc.room.banner === false) return; bn(ctx, X.banner, 270); }); }
    // ---- шары: золотые «2» и «3» у входа, гроздья по комнате (колышутся на ниточках)
    for (const [bx, seed, foil, z] of [[270, 11, true, 19], [64, 12, false, 17], [475, 13, false, 17]]) {
      const bs = sprite(160, 380, 80, 366, dens(1.7), (g) => balloonCluster(g, seed, foil)), ph = seed * 0.7;
      deco(out, sc, 'balloons', bx, z, 90, (ctx, t) => { ctx.save(); ctx.translate(bx, FY + 6); ctx.rotate(Math.sin(t * 0.7 + ph) * 0.028); bs(ctx, 0, 0); ctx.restore(); });
    }
    // ---- подарки, торшеры
    put('gifts', 342, FY + 6, 19, 60, 120, 90, 60, 80, dens(1.7), (g) => { gift(g, -18, 0, 46, 34, '#ff8aa8', '#fff4d0', -0.04); gift(g, 24, 0, 38, 26, '#6ac8c0', '#ffe08a', 0.05); gift(g, 2, -34, 30, 22, '#ffd060', '#ff6f9c', 0.06); });
    put('gifts2', 1448, FY + 6, 19, 40, 80, 70, 40, 62, dens(1.7), (g) => { gift(g, -6, 0, 36, 30, '#a98cff', '#fff4d0', 0.03); gift(g, 22, 0, 24, 20, '#ff8a6a', '#ffe08a', -0.06); });
    { const lx = 548, ls = sprite(90, 220, 45, 208, dens(1.7), floorLamp); deco(out, sc, 'floorLamp', lx, 12, 90, (ctx, t) => { ls(ctx, lx, FY + 4); A.glow(ctx, lx, FY - 172, 110, 'rgba(255,214,130,', 0.34 + 0.04 * Math.sin(t * 3)); }); }
    // ---- стол с тортом
    const tS = sprite(460, 220, 230, 210, dens(1.8), table), cS = sprite(240, 200, 120, 184, dens(2), cake);
    let wasLit = new Array(CANDLES).fill(false), outAt = new Array(CANDLES).fill(-9);
    out.push({ x: X.table, z: 20, name: 'table', draw: guard('table', (ctx, t) => {
      if (!K.onScreen(sc, X.table, 260)) return;
      tS(ctx, X.table, FY);
      const baseY = FY - TOP - 18, left = sc.room ? Math.max(0, Math.min(CANDLES, sc.room.candles)) : CANDLES, frac = left / CANDLES;
      A.glow(ctx, X.table, baseY - 70, 170, 'rgba(255,210,130,', 0.08 + 0.2 * frac * (0.9 + 0.1 * Math.sin(t * 7)));
      cS(ctx, X.table, baseY);
      // свечи: тела; горят те, у кого место в перестановке меньше числа оставшихся
      const lit = [], smoke = [];
      CANDLE_POS.forEach((cp, k) => {
        const on = RANK[k] < left, x = X.table + cp.x, y = baseY + cp.y;
        ctx.fillStyle = cp.c; ctx.fillRect(x - 1.8, y - cp.h, 3.6, cp.h); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.strokeRect(x - 1.8, y - cp.h, 3.6, cp.h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1.2, y - cp.h, 1, cp.h);
        ctx.fillStyle = '#2a1a20'; ctx.fillRect(x - 0.4, y - cp.h - 2.4, 0.9, 2.6);
        if (on) { lit.push({ x, y: y - cp.h - 2, i: k }); wasLit[k] = true; }
        else if (wasLit[k]) { wasLit[k] = false; outAt[k] = t; }
        if (!on && t - outAt[k] < 2.2 && t - outAt[k] >= 0) smoke.push({ x, y: y - cp.h - 2, u: (t - outAt[k]) / 2.2, k });
      });
      if (lit.length) { flames(ctx, lit, t, 1); const gs = glowSprite(); for (const f of lit) ctx.drawImage(gs, f.x - 11, f.y - 15, 22, 22); }
      if (smoke.length) { ctx.lineCap = 'round'; for (const s of smoke) { ctx.strokeStyle = 'rgba(214,214,224,' + (0.55 * (1 - s.u)).toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.bezierCurveTo(s.x + 6 * Math.sin(s.u * 6 + s.k), s.y - 10 - 10 * s.u, s.x - 7 * Math.sin(s.u * 5 + s.k), s.y - 22 - 26 * s.u, s.x + 4 * Math.sin(s.u * 8 + s.k), s.y - 34 - 46 * s.u); ctx.stroke(); } }
    }) });
    // ---- столик с пультом
    const rtS = sprite(120, 130, 60, 122, dens(1.8), roundTable);
    deco(out, sc, 'remoteTable', X.remoteTable, 20, 70, (ctx, t) => {
      rtS(ctx, X.remoteTable, FY + 2);
      if (sc.room && sc.room.remote) {
        A.glow(ctx, X.remoteTable, FY - 96, 32, 'rgba(160,210,255,', 0.18 + 0.06 * Math.sin(t * 2.4));
        Ale.drawSprite(ctx, 'it_remote', X.remoteTable + 6, FY - 88, { sx: 0.8, sy: 0.8 });
        const v = Math.sin(t * 1.6); if (v > 0.8) { const r = 3 + (v - 0.8) * 24; ctx.strokeStyle = 'rgba(235,248,255,0.9)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X.remoteTable + 20 - r, FY - 112); ctx.lineTo(X.remoteTable + 20 + r, FY - 112); ctx.moveTo(X.remoteTable + 20, FY - 112 - r); ctx.lineTo(X.remoteTable + 20, FY - 112 + r); ctx.stroke(); }
      }
    });
    // ---- пламя свечей в нишах и тёплое свечение лампочек
    NICHES.forEach(([cx], i) => deco(out, sc, 'nicheFlames', cx, 6, 50, (ctx, t) => {
      const list = CANDS[i].map((c, k) => ({ x: cx + c.dx, y: NICHE_BASE - 2 - c.h - 4, i: i * 5 + k }));
      A.glow(ctx, cx, NICHE_BASE - 56, 70, 'rgba(255,196,110,', 0.22 + 0.04 * Math.sin(t * 6 + i));
      flames(ctx, list, t, i * 3.1);
    }));
    deco(out, sc, 'bulbGlow', X.banner, 7, 1000, (ctx, t) => {
      const cam = sc.lastCam ? sc.lastCam.x : 0, W = sc.game.viewW, gs = glowSprite();
      for (const b of BULBS) { if (b.x < cam - 30 || b.x > cam + W + 30) continue; const k = 0.62 + 0.28 * Math.sin(t * 2.2 + b.ph) ; ctx.globalAlpha = k; ctx.drawImage(gs, b.x - 14, b.y + 9 - 14, 28, 28); }
      ctx.globalAlpha = 1;
    });
    // ---- портал на стене (z ниже героев)
    deco(out, sc, 'portal', X.portal, 10, 160, (ctx, t) => drawPortal(ctx, X, sc.room ? sc.room.portal : 0, t));
    return out;
  });
  MA.roomFront = guard('roomFront', function (X, sc) { return []; });
})();
