// Монако, улица у казино (сцена monacoStreet, ширина 2400). Рисуется кодом в манере Парижа и Киева; общие кисти — Ale.MonacoArt.kit (monaco_art.js).
// Слева направо (мировые x): угол с пальмой → кафе под аркадой (x 20…340) → красное купе у балюстрады (330…630) → фонарь у воришки (X.thief) → ЗДАНИЕ КАЗИНО (X.door ± 470: крылья, башни с куполами, портал
// с козырьком, золотая вывеска «CASINO», подсвеченная дверь на X.door) → кованые ворота между столбами (X.gate; sc.gate.open 0…1: 1 — створки убраны) → стоянка: чёрный Mercedes-Maybach с надписью Uber на двери (Ale.CarArt, car_art.js) ЦЕЛИКОМ
// на X.taxi (sc.taxi = { dx, door }: задняя дверь открывается наружу, при отъезде dx растёт, колёса крутятся) → каменный столб справа поверх героев (z = 60: за него вор «убегает за угол»).
// Дали (параллакс): небо с облаками (0,08) → горы, море с яхтами и Скала Монако (0,18) → ярусы пастельных домов на холмах (0,4) → сады: пинии, кипарисы, пальмы (0,65) → земля (мостовая, асфальт у стоянки) и детали.
// z < 54 — позади героев (каждая деталь рисуется только в видимой части), z > 54 — поверх. Вблизи двери (X.door ± 40, выше y = 330) ничего выше z = 12 не стоит: там рисует стрелку сама дверь.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const MA = (Ale.MonacoArt = Ale.MonacoArt || {});
  const K = MA.kit;
  const { WALL, TAU, dens, mix, lighter, rgba, hazed, hash, par, guard, sprite, deco } = K;
  const HAZE = '#f2e3cf';                                  // тёплая дымка расстояния
  const VY = 130, HZ = 372;                                // слой вида: верх на экранной высоте VY; горизонт моря — HZ
  const TOWN_Y = 190;                                      // слой холмов: верх на экранной высоте TOWN_Y (дома и кипарисы на гребне холма поднимаются до y ≈ 200: при прежних 230 их верхушки срезались плоской линией слоя)
  const MID_Y = 290;                                       // слой садов (кипарисы высотой до 300 от основания 596 доходят до y ≈ 296: при прежних 330 верхушки срезались)
  MA.streetViewY = { vista: VY, town: TOWN_Y, mid: MID_Y };   // для проверок: на какой экранной высоте лежит верх каждого слоя

  // =================================================================== дальний план
  // Гряда гор: контур из нескольких синусов; base — линия подножия, amp — размах
  function ridge(g, w, base, amp, seed, col, o) {
    o = o || {};
    const R = A.rng(seed), f1 = R.range(0.0035, 0.006), f2 = R.range(0.011, 0.017), f3 = R.range(0.028, 0.05), p1 = R.range(0, 6), p2 = R.range(0, 6), p3 = R.range(0, 6);
    const prof = (x) => base - amp * (0.5 + 0.3 * Math.sin(x * f1 + p1) + 0.2 * Math.sin(x * f2 + p2) + 0.07 * Math.sin(x * f3 + p3));
    g.beginPath(); g.moveTo(0, base + 30);
    for (let x = 0; x <= w; x += 7) g.lineTo(x, prof(x));
    g.lineTo(w, base + 30); g.closePath();
    g.fillStyle = A.linG(g, 0, base - amp, 0, base, [[0, col[0]], [1, col[1]]]); g.fill();
    if (o.gullies) { g.save(); g.clip(); g.strokeStyle = o.gullies; g.lineWidth = 1.5; g.lineCap = 'round'; for (let x = 4; x < w; x += R.range(9, 20)) { const y = prof(x); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + R.range(-8, 16), y + R.range(26, 90)); g.stroke(); } g.restore(); }
    if (o.rim) { g.strokeStyle = o.rim; g.lineWidth = 1.8; g.beginPath(); for (let x = 0; x <= w; x += 7) { if (x) g.lineTo(x, prof(x)); else g.moveTo(x, prof(x)); } g.stroke(); }
    if (o.strata) {                                                                                                    // светлые склоны: косые полосы по хребту
      g.save(); g.clip(); g.fillStyle = o.strata;
      for (let x = 0; x < w; x += 46) { const y = prof(x); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, prof(x + 26)); g.lineTo(x + 40, prof(x + 26) + 70); g.lineTo(x + 6, y + 80); g.closePath(); g.fill(); }
      g.restore();
    }
  }
  // Яхта: моторная (две-три палубы со стеклом, радарная мачта) или парусная (мачта, свёрнутый парус, штаги). (x, y) — середина ватерлинии; s — масштаб
  function yacht(g, x, y, s, kind, seed, haze) {
    const R = A.rng(seed), line = mix(OUT, haze, 0.5), hz = 0.22;
    g.save(); g.translate(x, y); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    const hull = mix('#fbf8f0', haze, hz), glass = mix('#41586f', haze, 0.18), deck = mix('#f2ede2', haze, hz);
    g.fillStyle = 'rgba(40,90,130,0.25)'; g.beginPath(); g.ellipse(2, 3, kind === 'motor' ? 70 : 48, 3.2, 0, 0, TAU); g.fill();                  // отражение под бортом
    if (kind === 'motor') {
      const L = R.range(62, 82);
      g.beginPath(); g.moveTo(-L, -12); g.lineTo(L * 0.94, -14); g.quadraticCurveTo(L * 1.1, -10, L * 0.98, 0); g.lineTo(-L * 0.9, 0); g.quadraticCurveTo(-L * 1.02, -4, -L, -12); g.closePath();
      g.fillStyle = A.linG(g, 0, -14, 0, 0, [[0, hull], [1, mix('#d8d2c6', haze, hz)]]); g.fill(); g.lineWidth = 1.5; g.strokeStyle = line; g.stroke();
      g.fillStyle = mix('#243a58', haze, 0.2); g.fillRect(-L * 0.93, -6.4, L * 1.84, 2.6);                                                      // тёмная полоса борта
      for (let d = 0; d < 3; d++) {
        const w = L * (1.28 - d * 0.32), x0 = -L * 0.78 + d * L * 0.16, y0 = -14 - d * 8.6;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w + 5, y0); g.lineTo(x0 + w, y0 - 8.4); g.lineTo(x0 + 4, y0 - 8.4); g.closePath(); g.fillStyle = deck; g.fill(); g.stroke();
        g.fillStyle = glass; g.fillRect(x0 + 6, y0 - 7, w - 8, 4.6);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0 + 8, y0 - 6.8, w * 0.35, 1.4);
      }
      g.strokeStyle = line; g.lineWidth = 1.1; g.beginPath(); g.moveTo(L * 0.1, -38); g.lineTo(L * 0.1, -50); g.moveTo(L * 0.02, -47); g.lineTo(L * 0.2, -47); g.stroke();
    } else {
      const L = R.range(40, 54);
      g.beginPath(); g.moveTo(-L, -9); g.quadraticCurveTo(0, -5, L, -10); g.lineTo(L * 0.8, 0); g.lineTo(-L * 0.82, 0); g.closePath(); g.fillStyle = hull; g.fill(); g.lineWidth = 1.5; g.strokeStyle = line; g.stroke();
      g.fillStyle = mix('#2a4a78', haze, 0.2); g.fillRect(-L * 0.8, -6, L * 1.6, 2.4);
      g.strokeStyle = mix('#8a7a6a', haze, 0.2); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(0, -R.range(66, 82)); g.stroke();
      g.fillStyle = mix('#f6f2e8', haze, 0.15); g.beginPath(); g.moveTo(1.5, -12); g.lineTo(1.5, -R.range(54, 66)); g.lineTo(L * 0.72, -11); g.closePath(); g.fill(); g.lineWidth = 1; g.strokeStyle = line; g.stroke();
      g.strokeStyle = 'rgba(80,70,60,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -R.range(60, 76)); g.lineTo(-L * 0.9, -9); g.moveTo(0, -R.range(60, 76)); g.lineTo(L * 0.95, -9); g.stroke();
    }
    g.restore();
  }
  // Высотка вдали (Фонвьей): светлая башня с поясами окон
  function tower(g, x, base, w, h, seed, haze) {
    const R = A.rng(seed), c = R.pick(['#f6f1e8', '#efe6d8', '#f2e0d0']), wall = mix(c, haze, 0.32);
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, wall], [1, mix(wall, '#a9b4c8', 0.35)]]); g.fillRect(x, base - h, w, h);
    g.strokeStyle = 'rgba(96,118,150,0.4)'; g.lineWidth = 1; for (let y = base - h + 6; y < base - 4; y += 6.4) { g.beginPath(); g.moveTo(x + 1.5, y); g.lineTo(x + w - 1.5, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1.5, base - h, 2, h);
    g.lineWidth = 1.2; g.strokeStyle = mix(OUT, haze, 0.55); g.strokeRect(x, base - h, w, h);
    g.fillStyle = mix('#c9bfae', haze, 0.3); g.fillRect(x - 1.5, base - h - 3, w + 3, 3.4);
  }
  // Скала Монако: утёс с дворцом и старым городом на плато; (x0, base) — подножие слева
  function rock(g, x0, base, haze) {
    const R = A.rng(61), line = mix(OUT, haze, 0.45);
    const pts = [[0, 8], [8, -4], [20, -20], [32, -34], [52, -42], [100, -44], [150, -45], [182, -40], [206, -28], [220, -10], [236, 8]];
    g.beginPath(); g.moveTo(x0, base + 10); for (const [dx, dy] of pts) g.lineTo(x0 + dx, base + dy); g.lineTo(x0 + 240, base + 10); g.closePath();
    g.fillStyle = A.linG(g, 0, base - 46, 0, base + 10, [[0, mix('#e3d4bc', haze, 0.3)], [0.5, mix('#bfae96', haze, 0.3)], [1, mix('#8f8274', haze, 0.3)]]); g.fill(); g.lineWidth = 1.6; g.strokeStyle = line; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(80,60,48,0.22)'; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const yy = base - 34 + i * 6; g.beginPath(); g.moveTo(x0, yy + R.range(-2, 2)); g.lineTo(x0 + 240, yy + R.range(-3, 3)); g.stroke(); } g.restore();
    for (let i = 0; i < 6; i++) K.mound(g, x0 + R.range(20, 220), base + 5, R.range(8, 14), R.range(4, 7), hazed(K.OLIVE, 0.3, haze), 70 + i, { lw: 1.4, line: mix(OUT, haze, 0.55) });
    // старый город и дворец на плато: рядами пастельных коробочек
    const top = base - 44;
    for (let x = 40, i = 0; x < 200; x += R.range(11, 20), i++) {
      const w = R.range(10, 18), h = R.range(10, 22), c = mix(R.pick(['#f1d3b0', '#f3e2b8', '#eab99a', '#f6ecd6', '#e8c6a0']), haze, 0.28);
      g.fillStyle = c; g.fillRect(x0 + x, top - h, w, h + 3); g.lineWidth = 1; g.strokeStyle = line; g.strokeRect(x0 + x, top - h, w, h + 3);
      g.fillStyle = mix('#c9603a', haze, 0.3); g.beginPath(); g.moveTo(x0 + x - 1.5, top - h); g.lineTo(x0 + x + w / 2, top - h - 5); g.lineTo(x0 + x + w + 1.5, top - h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(70,90,120,0.5)'; g.fillRect(x0 + x + 2.5, top - h + 4, 2.4, 3.6); g.fillRect(x0 + x + w - 5, top - h + 4, 2.4, 3.6);
    }
    const px = x0 + 96, pc = mix('#efdcb8', haze, 0.25);                                                                     // дворец: широкий корпус и три башенки с зубцами
    g.fillStyle = pc; g.fillRect(px, top - 32, 74, 34); g.lineWidth = 1.2; g.strokeStyle = line; g.strokeRect(px, top - 32, 74, 34);
    for (const [tx, th] of [[px - 4, 46], [px + 30, 40], [px + 66, 50]]) { g.fillStyle = pc; g.fillRect(tx, top - th, 12, th); g.strokeRect(tx, top - th, 12, th); g.fillStyle = mix('#b8553a', haze, 0.25); g.fillRect(tx - 1.5, top - th - 4, 15, 4); for (let k = 0; k < 3; k++) g.fillRect(tx - 1.5 + k * 6, top - th - 7, 3, 4); }
    g.fillStyle = 'rgba(70,90,120,0.5)'; for (let k = 0; k < 6; k++) g.fillRect(px + 8 + k * 11, top - 22, 4, 7);
    const cx = x0 + 180;                                                                                                       // собор: колокольня со шпилем
    g.fillStyle = mix('#f4ead6', haze, 0.25); g.fillRect(cx, top - 38, 11, 40); g.lineWidth = 1.2; g.strokeStyle = line; g.strokeRect(cx, top - 38, 11, 40);
    g.fillStyle = mix('#a99a86', haze, 0.3); g.beginPath(); g.moveTo(cx - 1, top - 38); g.lineTo(cx + 5.5, top - 58); g.lineTo(cx + 12, top - 38); g.closePath(); g.fill(); g.stroke();
  }
  // Вид вдаль: горы, море, Фонвьей, скала с дворцом, мол с маяком, яхты у причала. Слой строится в экранных координатах (верх на высоте VY)
  function vistaLayer(w, h) {
    return A.layer(w, h, (g) => {
      g.translate(0, -VY);
      const R = A.rng(11);
      ridge(g, w, HZ + 4, 190, 21, ['#b2c0e0', '#ece0d4'], { rim: 'rgba(255,238,206,0.5)', strata: 'rgba(255,255,255,0.1)', gullies: 'rgba(96,108,166,0.13)' });
      ridge(g, w, HZ + 6, 112, 22, ['#9fb0d4', '#e6d8ca'], { rim: 'rgba(255,230,190,0.55)', strata: 'rgba(255,240,220,0.1)', gullies: 'rgba(92,104,160,0.14)' });
      // дальний берег: низкая полоса города у горизонта
      for (let x = 0; x < w; x += R.range(9, 18)) { const bw = R.range(8, 16), bh = R.range(5, 14); g.fillStyle = mix(R.pick(['#f1d3b0', '#f3e2b8', '#eab99a', '#f6ecd6']), HAZE, 0.5); g.fillRect(x, HZ + 4 - bh, bw, bh + 2); }
      for (const [x, ww, hh, sd] of [[250, 22, 84, 1], [276, 17, 62, 2], [300, 24, 100, 3], [332, 19, 72, 4], [1480, 22, 80, 5], [1506, 17, 58, 6], [1790, 24, 92, 7], [1818, 18, 66, 8], [140, 20, 70, 9]]) tower(g, x, HZ + 5, ww, hh, sd, HAZE);
      rock(g, 880, HZ - 2, HAZE);
      // море: градиент от светлой дымки у горизонта к синеве, полосы волн, золотая дорожка солнца
      const sea = A.linG(g, 0, HZ, 0, HZ + 190, [[0, '#bdeef0'], [0.05, '#7fd2e0'], [0.25, '#46a8d6'], [0.65, '#2d86c4'], [1, '#2377b4']]);
      g.fillStyle = sea; g.fillRect(0, HZ, w, 190);
      for (let i = 0; i < 340; i++) { const y = HZ + 4 + Math.pow(R.next(), 1.5) * 176, len = 8 + (y - HZ) * R.range(0.2, 0.7); g.fillStyle = 'rgba(255,255,255,' + R.range(0.05, 0.16).toFixed(3) + ')'; g.fillRect(R.range(0, w), y, len, 1 + (y - HZ) * 0.012); }
      // золотая дорожка солнца: построчно, со смягчёнными боками и расширением книзу (раньше — трапеция с прямыми краями: на воде читалась как светлая полоса с резкой границей)
      for (let yy = 0; yy < 190; yy += 2) {
        const k = yy / 190, half = 60 + 150 * k, cx = 560 - 10 * k, a = k < 0.4 ? 0.55 - 0.75 * k : 0.25 - 0.25 * (k - 0.4);
        const row = g.createLinearGradient(cx - half, 0, cx + half, 0); row.addColorStop(0, 'rgba(255,236,176,0)'); row.addColorStop(0.32, 'rgba(255,236,176,' + a.toFixed(3) + ')'); row.addColorStop(0.68, 'rgba(255,236,176,' + a.toFixed(3) + ')'); row.addColorStop(1, 'rgba(255,236,176,0)');
        g.fillStyle = row; g.fillRect(cx - half, HZ + yy, 2 * half, 2);
      }
      // мол с маяком
      g.fillStyle = mix('#8d8a92', HAZE, 0.3); g.fillRect(1560, HZ + 12, 300, 7); g.fillStyle = mix('#b5b1b6', HAZE, 0.3); g.fillRect(1560, HZ + 12, 300, 2.4);
      g.fillStyle = mix('#f6f2ea', HAZE, 0.25); g.fillRect(1850, HZ - 14, 9, 28); g.fillStyle = mix('#c8382f', HAZE, 0.25); g.fillRect(1848, HZ - 20, 13, 7); g.lineWidth = 1; g.strokeStyle = mix(OUT, HAZE, 0.5); g.strokeRect(1850, HZ - 14, 9, 28);
      // яхты: чем ниже, тем ближе и крупнее
      const boats = [[190, 392, 0.62, 'sail'], [262, 410, 0.7, 'motor'], [366, 401, 0.62, 'sail'], [452, 428, 0.9, 'motor'], [598, 392, 0.55, 'motor'], [706, 418, 0.8, 'sail'], [790, 438, 1.05, 'motor'], [980, 404, 0.62, 'sail'], [1060, 424, 0.86, 'motor'],
        [1190, 396, 0.58, 'motor'], [1265, 446, 1.1, 'sail'], [1410, 416, 0.78, 'motor'], [1500, 392, 0.58, 'sail'], [1640, 434, 0.98, 'motor'], [1760, 404, 0.66, 'sail'], [1330, 392, 0.54, 'sail']];
      boats.forEach(([x, y, s, k], i) => yacht(g, x, y, s, k, 30 + i, mix(HAZE, '#9fd0e0', 0.2 + (y - HZ) * 0.004)));
      A.edge(g, 0, HZ - 6, w, 28, 'b', 28, 'rgba(255,240,214,0.35)');
    }, dens(1.5));
  }

  // =================================================================== холмы и дома
  const PINEP = { hi: '#86b868', mid: '#4a8842', lo: '#28603a', edge: 'rgba(10,44,28,0.5)', dark: 'rgba(10,48,28,0.4)', light: 'rgba(196,232,146,0.4)' };
  const PASTEL = ['#f4d6b2', '#f0c3a2', '#f7e4bc', '#ebb892', '#f6ecd6', '#eccbb2', '#f2d3a4', '#dcab8e', '#f8f0e2', '#f1dca8', '#e8c1a4'];
  const ROOF = ['#c9603a', '#b9532f', '#d2764a', '#c26a42'];
  const SHUT = ['#5f8f7a', '#3f6f8f', '#7aa08a', '#f3efe2', '#a85a48', '#4a7fa6'];
  // Дом на склоне: стена, крыша (вальмовая / двускатная / плоская с террасой), окна со ставнями. (x, base) — левый низ; h — высота стены
  function house(g, x, base, w, h, c, seed, hz) {
    const R = A.rng(seed), line = mix(OUT, HAZE, 0.52 + hz * 0.3), wall = mix(c, HAZE, hz), top = base - h;
    const kind = R.next(), roofC = mix(R.pick(ROOF), HAZE, hz + 0.03);
    if (kind < 0.42) { const rh = Math.min(20, w * 0.3); g.beginPath(); g.moveTo(x - 3, top + 1); g.lineTo(x + w * 0.2, top - rh); g.lineTo(x + w * 0.8, top - rh); g.lineTo(x + w + 3, top + 1); g.closePath(); g.fillStyle = A.linG(g, 0, top - rh, 0, top, [[0, lighter(roofC, 0.15)], [1, roofC]]); g.fill(); g.lineWidth = 1.2; g.strokeStyle = line; g.stroke(); g.strokeStyle = 'rgba(120,50,30,0.25)'; g.lineWidth = 0.9; for (let yy = top - rh + 5; yy < top; yy += 5) { g.beginPath(); g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); g.stroke(); } }
    else if (kind < 0.7) { const rh = Math.min(24, w * 0.38); g.beginPath(); g.moveTo(x - 3, top + 1); g.lineTo(x + w / 2, top - rh); g.lineTo(x + w + 3, top + 1); g.closePath(); g.fillStyle = roofC; g.fill(); g.lineWidth = 1.2; g.strokeStyle = line; g.stroke(); }
    else { g.fillStyle = mix('#e6d4b8', HAZE, hz); g.fillRect(x - 2, top - 5, w + 4, 6); g.lineWidth = 1.1; g.strokeStyle = line; g.strokeRect(x - 2, top - 5, w + 4, 6); }
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, lighter(wall, 0.18)], [0.6, wall], [1, mix(wall, '#7a5a64', 0.2)]]); g.fillRect(x, top, w, h + 2); g.lineWidth = 1.2; g.strokeStyle = line; g.strokeRect(x, top, w, h + 2);
    const rows = Math.max(1, Math.floor((h - 8) / 24)), cols = Math.max(1, Math.floor((w - 6) / 17));
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const wx = x + (k + 0.5) * (w / cols), wy = base - 8 - r * 24, ww = 6.4, wh = 11;
      if (R.chance(0.1)) continue;
      const sh = R.chance(0.6) ? R.pick(SHUT) : null;
      if (sh) { g.fillStyle = mix(sh, HAZE, hz); g.fillRect(wx - ww / 2 - 3.4, wy - wh, 3, wh); g.fillRect(wx + ww / 2 + 0.4, wy - wh, 3, wh); }
      g.fillStyle = mix('#3b4e6a', HAZE, hz * 0.6); g.beginPath(); g.moveTo(wx - ww / 2, wy); g.lineTo(wx - ww / 2, wy - wh + 3); g.arc(wx, wy - wh + 3, ww / 2, Math.PI, 0); g.lineTo(wx + ww / 2, wy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(wx - ww / 2 + 0.8, wy - wh + 2, 1.6, wh - 3);
    }
  }
  function townCluster(g, xa, xb, ground, hillH, seed, baseHaze) {
    const R = A.rng(seed);
    const surf = (x) => { const u = (x - xa) / (xb - xa); return ground - hillH * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))), 0.7); };
    // Земля под городом: склон холма с террасами и кустами, на котором стоят дома. Раньше слой рисовал одни дома: они висели прямо над морем, а вода была видна и под ними, и между ними (владелец 14.10.2026:
    // «дома в воде стоят слева и справа от казино»). Склон идёт по тому же профилю, что и дома, и вниз до сада на переднем плане (его кромка не выше 509), поэтому суша сплошная.
    {
      const top = mix('#b3c18c', HAZE, baseHaze), foot = mix('#7f9c62', HAZE, baseHaze * 0.8), wall = mix('#e2d4b2', HAZE, baseHaze), line = mix(OUT, HAZE, 0.5);
      g.save();
      g.beginPath(); g.moveTo(xa, ground + 28);
      for (let x = xa; x <= xb; x += 4) g.lineTo(x, surf(x) + 10);
      g.lineTo(xb, ground + 28); g.closePath();
      g.fillStyle = A.linG(g, 0, ground - hillH, 0, ground + 28, [[0, top], [1, foot]]); g.fill();
      g.clip();
      const RB = A.rng(seed * 13 + 5);
      for (let t = 0; t < 5; t++) {                                        // подпорные стенки террас и кусты вдоль них
        const off = 18 + t * 30;
        g.beginPath(); for (let x = xa; x <= xb; x += 4) { if (x > xa) g.lineTo(x, surf(x) + off + 30); else g.moveTo(x, surf(x) + off + 30); }
        g.lineWidth = 3.4; g.strokeStyle = line; g.stroke(); g.lineWidth = 1.9; g.strokeStyle = wall; g.stroke();
        for (let x = xa + RB.range(4, 30); x < xb - 10; x += RB.range(36, 76)) K.mound(g, x, surf(x) + off + 31, RB.range(9, 17), RB.range(6, 10), hazed(RB.chance(0.5) ? K.OLIVE : K.LEAF, baseHaze + 0.04, HAZE), Math.round(x) + t * 7, { line, lw: 1.4 });
      }
      g.restore();
      g.beginPath(); for (let x = xa; x <= xb; x += 4) { if (x > xa) g.lineTo(x, surf(x) + 10); else g.moveTo(x, surf(x) + 10); }
      g.lineWidth = 1.4; g.strokeStyle = line; g.stroke();                  // контур склона поверх: у крайних домов виден силуэт холма
    }
    for (let row = 0; row < 5; row++) {
      const hz = baseHaze - row * 0.045, off = row * 30;
      for (let x = xa + R.range(0, 10); x < xb - 20; ) {
        const w = R.range(34, 66) * (0.84 + row * 0.07), h = R.range(40, 70) + row * 6, bx = x, by = surf(x + w / 2) + off + 24 + R.range(-4, 4);
        if (by < ground + 4) { house(g, bx, Math.min(by, ground + 40), w, h, R.pick(PASTEL), seed * 100 + Math.round(bx) + row, hz); if (MA.townLog) MA.townLog.push({ x: bx, w, base: Math.min(by, ground + 40) }); }       // townLog — для проверки «под каждым домом земля» (tests/suite_monaco.js)
        x += w + R.range(-4, 10);
        if (R.chance(0.14)) { const px = x + 6; K.cypress(g, px, Math.min(surf(px) + off + 26, ground + 40), R.range(60, 96), 9, Math.round(px), hazed(K.DEEP, hz + 0.1, HAZE), { line: mix(OUT, HAZE, 0.5), lw: 1.6 }); x += 22; }
        else if (R.chance(0.1)) { const px = x + 10; K.pine(g, px, Math.min(surf(px) + off + 26, ground + 40), R.range(40, 62), R.range(22, 32), Math.round(px) + 3, hazed(PINEP, hz + 0.08, HAZE), { line: mix(OUT, HAZE, 0.5), tw: 6 }); x += 40; }
      }
    }
  }
  function townLayer(w, h) {
    return A.layer(w, h, (g) => {
      g.translate(0, -TOWN_Y);
      const base = 540;
      for (const [xa, xb, hh, sd, hz] of [[-40, 560, 270, 5, 0.3], [790, 1190, 214, 6, 0.3], [1480, w + 40, 250, 7, 0.3]]) townCluster(g, xa, xb, base, hh, sd, hz);
      A.edge(g, 0, 420, w, 130, 'b', 130, 'rgba(255,238,210,0.3)');
    }, dens(1.5));
  }

  // =================================================================== сады на склоне (параллакс 0,65)
  function midLayer(w, h) {
    return A.layer(w, h, (g) => {
      g.translate(0, -MID_Y);
      const R = A.rng(41), base = 596;
      const hzP = (P) => hazed(P, 0.1, HAZE), hl = mix(OUT, HAZE, 0.2);
      // сплошная лента сада на склоне: без неё между кластерами домов остался бы просвет до самой земли
      const edge = (x) => 526 + 11 * Math.sin(x * 0.009 + 1) + 6 * Math.sin(x * 0.023 + 2);
      g.beginPath(); g.moveTo(0, 640); for (let x = 0; x <= w; x += 8) g.lineTo(x, edge(x)); g.lineTo(w, 640); g.closePath();
      g.fillStyle = A.linG(g, 0, 500, 0, 610, [[0, mix('#a6cf84', HAZE, 0.1)], [1, mix('#5b8a4c', HAZE, 0.1)]]); g.fill();
      for (let x = 0, i = 0; x < w; x += R.range(40, 80), i++) K.mound(g, x, edge(x) + 14, R.range(24, 44), R.range(14, 24), hzP(i % 3 ? K.LEAF : K.OLIVE), 700 + i, { line: hl, lw: 2.4 });
      for (let x = -30, i = 0; x < w + 60; x += R.range(130, 270), i++) {
        const k = i % 5;
        if (k === 0 || k === 3) K.pine(g, x, base, R.range(150, 200), R.range(66, 88), 200 + i, hzP(PINEP), { line: hl, tw: 14 });
        else if (k === 1) K.cypress(g, x, base, R.range(210, 300), 28, 300 + i, hzP(K.DEEP), { line: hl });
        else if (k === 2) K.mound(g, x, base, R.range(70, 100), R.range(34, 52), hzP(K.OLIVE), 400 + i, { line: hl });
        else K.cypress(g, x, base, R.range(170, 230), 24, 500 + i, hzP(K.DEEP), { line: hl });
      }
      for (let x = 60, i = 0; x < w; x += R.range(240, 420), i++) K.mound(g, x, base, R.range(50, 80), R.range(24, 36), hzP(K.LEAF), 600 + i, { line: hl });
    }, dens(1.5));
  }

  MA.streetLayers = guard('streetLayers', function (game, WIDTH, X) {
    const sky = K.skyLayer(par(WIDTH, 0.08), 360, 5, par(WIDTH, 0.08) * 0.22, 170);
    const vista = vistaLayer(par(WIDTH, 0.18), 420);
    const town = townLayer(par(WIDTH, 0.4), 602 - TOWN_Y);
    const mid = midLayer(par(WIDTH, 0.65), 610 - MID_Y);
    const ground = groundLayer(WIDTH, X);
    return { sky, vista, town, mid, ground };
  });

  // =================================================================== земля
  // Мостовая: плиты рядами (ближе к зрителю — крупнее), косые швы, как в Париже и Киеве
  function groundLayer(WIDTH, X) {
    const SH = 0.36;
    return A.layer(WIDTH, 720 - WALL + 12, (g, w, h) => {
      const R = A.rng(17), y0 = 13, hh = h - y0, tones = ['#efdfc2', '#e8d6b6', '#f3e6cc', '#e0cca8', '#ecdcbd'];
      // ---- плитка (всё полотно), потом асфальт у стоянки
      g.save(); g.beginPath(); g.rect(0, y0, w, hh); g.clip(); g.transform(1, 0, SH, 1, -SH * y0, 0);
      const xa = -SH * h - 30, xb = w + 30;
      g.fillStyle = 'rgba(112,86,60,0.55)'; g.fillRect(xa, y0, xb - xa, hh);
      let rh = 8.5;
      for (let y = y0, row = 0; y < y0 + hh; row++) {
        const rhh = Math.min(rh, y0 + hh - y), sw = 62 + row * 7.5;
        for (let x = xa - (row % 2) * sw / 2 - R.range(0, 12); x < xb; x += sw) {
          g.fillStyle = R.pick(tones); g.fillRect(x + 1.3, y + 1.3, sw - 2.6, rhh - 2.6);
          g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 1.3, y + 1.3, sw - 2.6, Math.min(2.4, rhh * 0.3)); g.fillStyle = 'rgba(120,80,40,0.1)'; g.fillRect(x + 1.3, y + rhh - 4.4, sw - 2.6, 2);
          if (R.chance(0.12)) { g.fillStyle = 'rgba(180,120,80,0.1)'; g.fillRect(x + 1.3, y + 1.3, sw - 2.6, rhh - 2.6); }
        }
        y += rhh; rh += 1.2;
      }
      // дорожка перед казино: тёмно-розовая полоса с золотой каймой и «ёлочкой»
      const bx0 = X.door - 104, bx1 = X.door + 104;
      g.fillStyle = 'rgba(96,56,52,0.8)'; g.fillRect(bx0 - 5, y0, bx1 - bx0 + 10, hh);
      let bh = 7;
      for (let y = y0; y < y0 + hh; ) { const rhh = Math.min(bh, y0 + hh - y); for (let x = bx0 + 2, c = 0; x < bx1 - 2; x += 15, c++) { const sk = (c % 2 ? -1 : 1) * 5; g.fillStyle = R.pick(['#d9a79c', '#e2b2a4', '#cf9c92', '#e7beb0', '#d6a296']); g.beginPath(); g.moveTo(x, y + 0.8); g.lineTo(x + 13, y + 0.8); g.lineTo(x + 13 + sk, y + rhh - 0.8); g.lineTo(x + sk, y + rhh - 0.8); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,240,226,0.2)'; g.fillRect(x + 1, y + 0.8, 11, 1.4); } y += rhh; bh += 1.1; }
      g.strokeStyle = '#d9a83c'; g.lineWidth = 2.6; g.strokeRect(bx0 - 5, y0, bx1 - bx0 + 10, hh); g.strokeStyle = 'rgba(255,240,180,0.6)'; g.lineWidth = 1; g.strokeRect(bx0 - 3, y0, bx1 - bx0 + 6, hh);
      // асфальт стоянки такси справа от ворот
      const ax = X.gate + 70;
      g.fillStyle = A.linG(g, 0, y0, 0, y0 + hh, [[0, '#585a68'], [0.45, '#4b4d5b'], [1, '#41434f']]); g.fillRect(ax, y0, w + 140 - ax, hh);
      for (let i = 0; i < (w - ax) * hh / 70; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.09)'; g.fillRect(R.range(ax, w + 100), R.range(y0, y0 + hh), R.range(1, 3), R.range(1, 2.4)); }
      g.fillStyle = '#e8c23a'; g.fillRect(ax, y0 + 2, w + 140 - ax, 4); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(ax, y0 + 2, w + 140 - ax, 1.4);          // жёлтая линия у бордюра
      g.fillStyle = 'rgba(255,255,255,0.62)'; for (let z = 0; z < 7; z++) g.fillRect(ax + 70 + z * 34, y0 + 30, 17, hh - 46);                                                  // «зебра»
      g.fillStyle = 'rgba(40,30,30,0.3)'; g.fillRect(ax - 3, y0, 3, hh);
      g.restore();
      A.gradV(g, 0, 13, w, h - 13, [[0, 'rgba(60,34,24,0.3)'], [0.22, 'rgba(60,34,24,0)'], [1, 'rgba(255,240,200,0.1)']]);
      // кромка: светлый гранитный бордюр
      A.gradV(g, 0, 0, w, 14, [[0, '#d9d2c4'], [0.3, '#b9b0a2'], [1, '#8d8478']]);
      for (let x = 60; x < w; x += 124) { g.fillStyle = 'rgba(40,30,30,0.5)'; g.fillRect(x, 3, 2, 11); }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, 3, w, 2.4); A.grain(g, 0, 0, w, 14, 0.22, 'overlay', 11, 0.5);
      g.fillStyle = OUT; g.fillRect(0, 0, w, 3); g.fillRect(0, 13, w, 2);
      // пятна солнца и тени пальм на плитке
      for (const [sx, sd] of [[470, 1], [650, 2], [1640, 3], [1990, 4], [2350, 5]]) { const RR = A.rng(sd + 90); for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(70,50,60,' + RR.range(0.05, 0.1).toFixed(3) + ')'; g.save(); g.translate(sx + RR.range(-90, 120), RR.range(24, h - 14)); g.rotate(RR.range(-0.2, 0.2)); g.beginPath(); g.ellipse(0, 0, RR.range(14, 40), RR.range(2.5, 6), 0, 0, TAU); g.fill(); g.restore(); } }
    }, dens(1.5));
  }

  // =================================================================== здание казино
  // Начало координат — середина основания у двери; вверх — отрицательный y. Ширина ±470, башни до −510. Оформление «Монте-Карло»: кремовый камень, купола цвета патины, золотая вывеска.
  const CS = ['#fcf2d8', '#eddab0', '#c8aa78'];
  const CEN_H = 300, ATOP = -CEN_H - 96;                                            // высота центрального корпуса и верх аттика (локальные y, вверх — минус)
  function rust(g, x0, x1, yb, yt, bw, bh, seed) {
    const R = A.rng(seed || 3);
    g.save(); g.beginPath(); g.rect(x0, yt, x1 - x0, yb - yt); g.clip();
    for (let row = 0, y = yb; y > yt; row++, y -= bh) {
      const off = (row % 2) * bw / 2;
      for (let x = x0 - off; x < x1; x += bw) { if (R.chance(0.35)) { g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.14)' : 'rgba(120,80,40,0.1)'; g.fillRect(x + 1, y - bh + 1, bw - 2, bh - 2); } g.fillStyle = 'rgba(100,66,32,0.36)'; g.fillRect(x, y - bh, 1.8, bh); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 1.8, y - bh + 2, 1.2, bh - 4); }
      g.fillStyle = 'rgba(100,66,32,0.4)'; g.fillRect(x0, y - 1.8, x1 - x0, 1.8); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0, y - bh, x1 - x0, 1.6);
    }
    g.restore();
  }
  function dentils(g, x0, x1, y, h) { g.fillStyle = 'rgba(110,76,40,0.5)'; for (let x = x0 + 3; x < x1 - 4; x += 9) g.fillRect(x, y, 5, h); g.fillStyle = 'rgba(255,255,255,0.4)'; for (let x = x0 + 3; x < x1 - 4; x += 9) g.fillRect(x, y, 1.4, h); }
  // Карниз: три слоя, тень под ним; y — линия под карнизом (низ), d — вынос
  function cornice(g, x0, x1, y, d) {
    d = d || 8;
    g.fillStyle = A.linG(g, 0, y - 22, 0, y, [[0, CS[0]], [1, CS[1]]]); g.fillRect(x0 - d, y - 22, x1 - x0 + 2 * d, 22); g.lineWidth = 2.4; g.strokeStyle = OUT; g.strokeRect(x0 - d, y - 22, x1 - x0 + 2 * d, 22);
    dentils(g, x0 - d, x1 + d, y - 9, 7);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x0 - d, y - 22, x1 - x0 + 2 * d, 2.2);
    A.edge(g, x0 - d, y, x1 - x0 + 2 * d, 14, 't', 14, 'rgba(90,50,30,0.34)');
  }
  // Купол башни: колокол цвета патины с золотыми рёбрами, фонарик, шпиль. (0, y) — основание, высота ≈ 130
  function dome(g, y, w) {
    const half = w / 2;
    const prof = [[1.0, 0], [1.06, -10], [0.97, -25], [0.78, -43], [0.5, -58], [0.24, -66], [0.1, -71]], apex = -75;
    const path = () => { g.beginPath(); g.moveTo(-half * prof[0][0], y + prof[0][1]); for (let i = 1; i < prof.length; i++) g.lineTo(-half * prof[i][0], y + prof[i][1]); g.lineTo(0, y + apex); for (let i = prof.length - 1; i >= 1; i--) g.lineTo(half * prof[i][0], y + prof[i][1]); g.lineTo(half * prof[0][0], y + prof[0][1]); g.closePath(); };
    path(); g.fillStyle = A.linG(g, -half, 0, half, 0, [[0, '#a6e8d2'], [0.38, '#58b69e'], [0.75, '#2f827a'], [1, '#1d5a5c']]); g.fill();
    g.save(); path(); g.clip();
    g.strokeStyle = 'rgba(14,60,56,0.25)'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { const yy = y - 6 - k * 8; g.beginPath(); g.moveTo(-half * 1.1, yy); g.lineTo(half * 1.1, yy); g.stroke(); }
    g.strokeStyle = 'rgba(255,230,150,0.9)'; g.lineWidth = 2.2;
    for (const k of [-0.72, -0.36, 0, 0.36, 0.72]) { g.beginPath(); g.moveTo(half * k * 1.02, y - 2); for (let i = 1; i < prof.length; i++) g.lineTo(half * k * prof[i][0], y + prof[i][1]); g.lineTo(0, y + apex); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.26)'; g.beginPath(); g.ellipse(-half * 0.42, y - 32, half * 0.12, 19, -0.25, 0, TAU); g.fill();
    A.grain(g, -half, y - 80, w, 82, 0.14, 'overlay', 17);
    g.restore();
    path(); g.lineWidth = 3; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    A.box(g, -half * 1.08, y - 3, w * 1.08, 6, { fill: '#d8b25a', lw: 2.2, hi: 'rgba(255,255,255,0.5)' });
    // фонарик (открытые арки с тёплым светом), конус и шпиль с шаром
    const ly = y + apex;
    A.box(g, -14, ly - 22, 28, 24, { fill: '#f4e6c4', lw: 2.4 });
    for (const lx of [-8, 0, 8]) { g.fillStyle = '#ffd98a'; g.beginPath(); g.moveTo(lx - 3, ly - 2); g.lineTo(lx - 3, ly - 12); g.arc(lx, ly - 12, 3, Math.PI, 0); g.lineTo(lx + 3, ly - 2); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(-17, ly - 22); g.lineTo(0, ly - 46); g.lineTo(17, ly - 22); g.closePath(); g.fillStyle = A.linG(g, -17, 0, 17, 0, [[0, '#8fe0c6'], [1, '#2b7a74']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(0, ly - 46); g.lineTo(0, ly - 64); g.stroke(); g.strokeStyle = '#d8b25a'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(0, ly - 52, 4.6, 0, TAU); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
  }
  // Башня: ствол с угловыми камнями, окна, часы, лоджия под куполом и сам купол. (cx, 0) — середина основания
  function towerBody(g, cx, seed) {
    const w = 126, x0 = cx - w / 2, x1 = cx + w / 2, top = -310;
    A.plaster(g, x0, top, w, -top, [[0, CS[0]], [0.6, '#f0ddb4'], [1, '#e2c895']], { seed, grain: 0.15 });
    rust(g, x0, x1, 0, -78, 56, 26, seed + 1);
    for (let y = -78, i = 0; y > top + 18; y -= 22, i++) for (const sx of [x0, x1 - 20]) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(110,76,40,0.1)'; g.fillRect(sx, y - 22, 20, 22); g.strokeStyle = 'rgba(100,66,32,0.4)'; g.lineWidth = 1.4; g.strokeRect(sx, y - 22, 20, 22); }       // угловые камни (квоины)
    g.lineWidth = 3.2; g.strokeStyle = OUT; g.strokeRect(x0, top, w, -top);
    K.archWin(g, cx, -22, 40, 54, { glass: 'lit', frame: CS[0] });
    K.archWin(g, cx, -112, 44, 98, { glass: 'day', frame: CS[0], balcony: 24 });
    // часы
    const cy = -272;
    g.beginPath(); g.arc(cx, cy, 24, 0, TAU); g.fillStyle = A.linG(g, cx, cy - 24, cx, cy + 24, [[0, '#fffdf4'], [1, '#e8dcc0']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(cx, cy, 28, 0, TAU); g.strokeStyle = '#d8b25a'; g.lineWidth = 4; g.stroke(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.6; for (let k = 0; k < 12; k++) { const a = k * TAU / 12; g.beginPath(); g.moveTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19); g.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); g.stroke(); }
    g.lineWidth = 2.8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 2, cy - 15); g.moveTo(cx, cy); g.lineTo(cx + 12, cy + 6); g.stroke();
    cornice(g, x0, x1, top, 8);
    // лоджия: три арки, внутри тень, колонки и перила
    const ly = top - 22, lh = 36;
    g.fillStyle = A.linG(g, 0, ly - lh, 0, ly, [[0, '#f3e4bf'], [1, '#e5cd9c']]); g.fillRect(x0 + 4, ly - lh, w - 8, lh); g.lineWidth = 2.6; g.strokeStyle = OUT; g.strokeRect(x0 + 4, ly - lh, w - 8, lh);
    for (let k = 0; k < 3; k++) { const ax = x0 + 14 + k * 33 + 14; g.fillStyle = A.linG(g, 0, ly - lh + 6, 0, ly - 6, [[0, '#46667a'], [1, '#1c2c3c']]); g.beginPath(); g.moveTo(ax - 12, ly - 7); g.lineTo(ax - 12, ly - lh + 17); g.arc(ax, ly - lh + 17, 12, Math.PI, 0); g.lineTo(ax + 12, ly - 7); g.closePath(); g.fill(); g.lineWidth = 1.8; g.stroke(); g.fillStyle = 'rgba(255,200,120,0.4)'; g.fillRect(ax - 2, ly - lh + 21, 4, 16); }
    for (let k = 0; k < 4; k++) { const px = x0 + 11 + k * 33 + 1; g.fillStyle = CS[0]; g.fillRect(px - 3, ly - lh + 8, 6, lh - 14); g.lineWidth = 1.6; g.strokeStyle = OUT; g.strokeRect(px - 3, ly - lh + 8, 6, lh - 14); }
    K.balustrade(g, x0 + 4, x1 - 4, ly - 2, 14, { lw: 1.6, step: 10 });
    g.save(); g.translate(cx, 0); dome(g, ly - lh - 2, w + 10); g.restore();
  }
  // Канопи над порталом: стекло и кованые рёбра, зубчатая кайма цвета патины, кронштейны. (0, y) — середина низа
  function canopy(g, y) {
    const hw = 150, sag = 12, hh = 34;
    const shape = () => { g.beginPath(); g.moveTo(-hw, y); g.lineTo(-hw + 12, y - hh + sag * 0.4); g.quadraticCurveTo(0, y - hh - sag, hw - 12, y - hh + sag * 0.4); g.lineTo(hw, y); g.closePath(); };
    shape(); g.fillStyle = A.linG(g, 0, y - hh - sag, 0, y, [[0, '#d6efee'], [0.55, '#a9d6dc'], [1, '#f4efd6']]); g.fill();
    g.save(); shape(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-hw * 0.7, y); g.lineTo(-hw * 0.35, y - hh - sag); g.lineTo(-hw * 0.2, y - hh - sag); g.lineTo(-hw * 0.55, y); g.fill();
    g.strokeStyle = '#1f2f30'; g.lineWidth = 2.4; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 22, y); g.lineTo(i * 18, y - hh - sag - 2); g.stroke(); }
    g.restore();
    shape(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = '#1f6a62'; g.strokeStyle = OUT; g.lineWidth = 1.8;
    for (let i = -7; i < 7; i++) { const x = i * 21.4 + 10.7; g.beginPath(); g.moveTo(x - 10.7, y); g.lineTo(x - 10.7, y + 3); g.arc(x, y + 3, 10.7, Math.PI, 0, true); g.lineTo(x + 10.7, y); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#e8c04a'; g.fillRect(-hw, y - 3, hw * 2, 4); g.strokeRect(-hw, y - 3, hw * 2, 4);
    for (const s of [-1, 1]) { g.strokeStyle = '#26302f'; g.lineWidth = 3; g.beginPath(); g.moveTo(s * 108, y + 18); g.quadraticCurveTo(s * 118, y + 4, s * 132, y + 2); g.stroke(); }
  }
  // Портал: арка с лучевым окном-веером, двустворчатая дверь с тёплыми стёклами, ступени и красная дорожка. Подсветка света (свечение) — на кадр
  function portal(g) {
    const rx = 78, ry = 40, dh = 205;
    // нишей: тёмный проём и архивольт с замковым камнем
    const arch = (gx, gy) => { g.beginPath(); g.moveTo(-rx - gx, 0); g.lineTo(-rx - gx, -dh); g.ellipse(0, -dh, rx + gx, ry + gy, 0, Math.PI, 0); g.lineTo(rx + gx, 0); g.closePath(); };
    arch(15, 12); g.fillStyle = A.linG(g, -rx, 0, rx, 0, [[0, '#f6e8c6'], [0.5, '#fbf0d6'], [1, '#dcc592']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.save(); arch(15, 12); g.clip(); g.strokeStyle = 'rgba(110,76,40,0.4)'; g.lineWidth = 1.4; for (let k = 0; k <= 12; k++) { const a = Math.PI + k * Math.PI / 12; g.beginPath(); g.moveTo(Math.cos(a) * (rx + 2), -dh + Math.sin(a) * (ry + 1)); g.lineTo(Math.cos(a) * (rx + 15), -dh + Math.sin(a) * (ry + 12)); g.stroke(); } g.restore();
    arch(0, 0); g.fillStyle = '#2a1a22'; g.fill();
    g.save(); arch(0, 0); g.clip();
    // двери: две створки красного дерева, панели, стёкла; веер над ними
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 2 : -rx - 2, wd = rx;
      g.fillStyle = A.linG(g, x0, 0, x0 + wd, 0, [[0, '#7a3434'], [0.5, '#5c2428'], [1, '#43181e']]); g.fillRect(x0, -dh, wd, dh);
      g.fillStyle = A.linG(g, 0, -dh + 8, 0, -dh * 0.45, [[0, '#ffe7ac'], [0.6, '#f6c46a'], [1, '#d68a38']]); g.beginPath(); g.moveTo(x0 + 7, -dh * 0.46); g.lineTo(x0 + 7, -dh + 22); g.quadraticCurveTo(x0 + wd / 2, -dh + 3, x0 + wd - 7, -dh + 22); g.lineTo(x0 + wd - 7, -dh * 0.46); g.closePath(); g.fill(); g.lineWidth = 2.6; g.strokeStyle = '#d8b25a'; g.stroke();
      g.strokeStyle = '#d8b25a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + wd / 2, -dh * 0.46); g.lineTo(x0 + wd / 2, -dh + 8); g.moveTo(x0 + 7, -dh * 0.72); g.lineTo(x0 + wd - 7, -dh * 0.72); g.stroke();
      for (const [py0, py1] of [[-dh * 0.4, -dh * 0.18], [-dh * 0.14, -4]]) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0 + 9, py0, wd - 18, py1 - py0); g.lineWidth = 2; g.strokeStyle = '#d8b25a'; g.strokeRect(x0 + 9, py0, wd - 18, py1 - py0); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 11, py0 + 2, 3, py1 - py0 - 4); }
      g.fillStyle = A.linG(g, 0, -26, 0, 0, [[0, '#f4d36a'], [1, '#b8862a']]); g.fillRect(x0 + 2, -22, wd - 4, 20); g.lineWidth = 1.8; g.strokeStyle = OUT; g.strokeRect(x0 + 2, -22, wd - 4, 20);
      g.fillStyle = '#f4d36a'; g.beginPath(); g.arc(s * 11, -102, 4.6, 0, TAU); g.fill(); g.stroke(); g.fillRect(s * 11 - 1.4, -112, 2.8, 20);
    }
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -dh); g.lineTo(0, 0); g.stroke();
    // веерное окно: лучи от центра, тёплое стекло
    g.save(); g.beginPath(); g.moveTo(-rx, -dh); g.ellipse(0, -dh, rx, ry, 0, Math.PI, 0); g.closePath(); g.clip();
    g.fillStyle = A.linG(g, 0, -dh - ry, 0, -dh, [[0, '#f6c46a'], [1, '#ffe9b0']]); g.fillRect(-rx, -dh - ry, rx * 2, ry + 2);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 2; for (let k = 1; k < 8; k++) { const a = Math.PI + k * Math.PI / 8; g.beginPath(); g.moveTo(0, -dh); g.lineTo(Math.cos(a) * rx * 1.2, -dh + Math.sin(a) * ry * 1.2); g.stroke(); }
    g.beginPath(); g.ellipse(0, -dh, rx * 0.5, ry * 0.5, 0, Math.PI, 0); g.stroke();
    g.restore();
    g.fillStyle = '#d8b25a'; g.fillRect(-rx, -dh - 3, rx * 2, 4); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(-rx, -dh - 3, rx * 2, 4);
    g.restore();
    arch(0, 0); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    // замковый камень с золотым медальоном
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(0, -dh - ry - 7, 9, 0, TAU); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#b8862a'; g.beginPath(); g.arc(0, -dh - ry - 7, 4, 0, TAU); g.fill();
    // ступени (три) и красная дорожка
    for (let i = 0; i < 3; i++) { const sw = 100 + i * 16, sy = i * 6; g.fillStyle = A.linG(g, 0, sy, 0, sy + 6, [[0, '#f4eadb'], [1, '#d6c6a8']]); g.fillRect(-sw, sy - 2, sw * 2, 7); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(-sw, sy - 2, sw * 2, 7); }
    g.beginPath(); g.moveTo(-50, -1); g.lineTo(50, -1); g.lineTo(66, 22); g.lineTo(-66, 22); g.closePath(); g.fillStyle = A.linG(g, 0, 0, 0, 22, [[0, '#b01e2e'], [1, '#7a1220']]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#e8c04a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-44, 0); g.lineTo(-60, 22); g.moveTo(44, 0); g.lineTo(60, 22); g.stroke();
  }
  function casinoFacade(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const WW = 470, WING = 240, CEN = CEN_H, TOWX = 258;
    // ---- крылья
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 190 : -WW, x1 = s > 0 ? WW : -190;
      A.plaster(g, x0, -WING, x1 - x0, WING, [[0, CS[0]], [1, '#e8d2a4']], { seed: 31 + s, grain: 0.15 });
      rust(g, x0, x1, 0, -78, 62, 26, 41 + s);
      g.lineWidth = 3.2; g.strokeStyle = OUT; g.strokeRect(x0, -WING, x1 - x0, WING);
      for (const wx of [s * 346, s * 424]) {
        K.archWin(g, wx, -22, 34, 46, { arch: false, glass: 'lit', frame: CS[0], keystone: false });
        K.archWin(g, wx, -102, 42, 104, { glass: wx * s > 380 ? 'day' : 'lit', frame: CS[0], balcony: 22 });
      }
      cornice(g, x0, x1, -WING + 2, 8);
      K.balustrade(g, x0 + 4, x1 - 4, -WING - 22, 28, { lw: 1.8, posts: s > 0 ? [x0 + 12, (x0 + x1) / 2, x1 - 12] : [x0 + 12, (x0 + x1) / 2, x1 - 12] });
    }
    // ---- центр: стена, цоколь, окна, карниз, аттик с вывеской
    A.plaster(g, -195, -CEN, 390, CEN, [[0, CS[0]], [0.6, '#f0ddb4'], [1, '#e6cf9f']], { seed: 33, grain: 0.15 });
    rust(g, -195, 195, 0, -78, 62, 26, 43);
    g.lineWidth = 3.2; g.strokeStyle = OUT; g.strokeRect(-195, -CEN, 390, CEN);
    for (const s of [-1, 1]) {
      K.archWin(g, s * 152, -100, 50, 124, { glass: 'lit', frame: CS[0], balcony: 22 });
      g.beginPath(); g.arc(s * 152, -262, 15, 0, TAU); g.fillStyle = '#f4e6c4'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); g.beginPath(); g.arc(s * 152, -262, 8, 0, TAU); g.fillStyle = '#e8c04a'; g.fill(); g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = '#d8b25a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(s * 120, -272); g.quadraticCurveTo(s * 96, -250, s * 70, -270); g.stroke();                                                  // гирлянды на фризе
    }
    g.strokeStyle = '#d8b25a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-60, -274); g.quadraticCurveTo(-30, -252, 0, -272); g.quadraticCurveTo(30, -252, 60, -274); g.stroke();
    cornice(g, -195, 195, -CEN + 2, 10);
    // аттик: плита вывески, полуциркульный фронтон
    const aw = 160, atop = ATOP;
    A.plaster(g, -aw, atop + 22, aw * 2, 96, [[0, CS[0]], [1, '#ecd8ae']], { seed: 35, grain: 0.15 });
    g.beginPath(); g.moveTo(-aw, atop + 22); g.lineTo(-aw, atop + 24); g.quadraticCurveTo(-aw, atop - 12, 0, atop - 14); g.quadraticCurveTo(aw, atop - 12, aw, atop + 24); g.lineTo(aw, atop + 22); g.closePath(); g.fillStyle = CS[0]; g.fill();
    g.beginPath(); g.moveTo(-aw, -CEN); g.lineTo(-aw, atop + 22); g.quadraticCurveTo(-aw, atop - 12, 0, atop - 14); g.quadraticCurveTo(aw, atop - 12, aw, atop + 22); g.lineTo(aw, -CEN); g.stroke();
    g.beginPath(); g.moveTo(-aw + 14, atop + 22); g.quadraticCurveTo(-aw + 14, atop + 2, 0, atop); g.quadraticCurveTo(aw - 14, atop + 2, aw - 14, atop + 22); g.lineWidth = 2; g.strokeStyle = 'rgba(110,76,40,0.55)'; g.stroke();
    // плита: «CASINO»
    const px = 130, pyT = -CEN - 78, pyB = pyT + 56;
    g.fillStyle = '#d8b25a'; A.box(g, -px - 6, pyT - 6, px * 2 + 12, 68, { fill: A.linG(g, 0, pyT - 6, 0, pyB + 6, [[0, '#f7de8a'], [0.5, '#e0b440'], [1, '#a8741a']]), lw: 3, r: 6 });
    A.box(g, -px, pyT, px * 2, 56, { fill: A.linG(g, 0, pyT, 0, pyB, [[0, '#2a6e66'], [1, '#164a48']]), lw: 2.6, r: 4 });
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(-px + 4, pyT + 3, px * 2 - 8, 6);
    K.goldText(g, 'CASINO', 0, pyT + 29, 40, { spacing: 8 });
    for (const sx of [-px + 12, px - 12]) { g.fillStyle = '#f4d36a'; g.beginPath(); g.arc(sx, pyT + 28, 3.6, 0, TAU); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(); }
    // верх аттика: цветочные вазы и шесты для флагов
    for (const sx of [-aw + 6, aw - 6]) K.urn(g, sx, atop + 22, 0.9, { plant: 'flowers' });
    for (const sx of [-92, 92]) { g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(sx, atop + 4); g.lineTo(sx, atop - 70); g.stroke(); g.strokeStyle = '#d8d2c6'; g.lineWidth = 2.6; g.stroke(); g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(sx, atop - 72, 3.4, 0, TAU); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(); }
    // ---- портал: колонны по бокам, козырёк
    portal(g);
    for (const s of [-1, 1]) K.column(g, s * 112, -250, 0, 24, { pal: CS, cap: '#d8b25a', veins: 'rgba(120,90,50,0.18)' });
    canopy(g, -250);
    // ---- башни поверх всего
    for (const s of [-1, 1]) towerBody(g, s * TOWX, 51 + s * 7);
    // свет: тёплая подсветка сверху-слева и мягкая тень справа внизу, только по нарисованному
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = A.linG(g, -WW, -420, WW, 80, [[0, 'rgba(255,232,170,0.22)'], [0.45, 'rgba(255,232,170,0)'], [1, 'rgba(120,60,70,0.14)']]); g.fillRect(-WW - 20, -560, WW * 2 + 40, 600);
    A.edge(g, -WW, -40, WW * 2, 40, 'b', 40, 'rgba(110,70,50,0.18)');
    g.restore();
  }

  // =================================================================== кафе под аркадой
  // Двухэтажное здание: аркада с тёплым светом и столиками внутри, вывеска «CAFÉ», верхний этаж со ставнями, мансардная крыша с окнами-люкарнами. Начало — середина основания
  function cafeBuilding(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const hw = 150, CS2 = ['#f8e8cf', '#ecd2ae', '#cfa97c'];
    // мансарда
    const slate = () => { g.beginPath(); g.moveTo(-hw - 8, -222); g.lineTo(-hw + 18, -318); g.lineTo(hw - 18, -318); g.lineTo(hw + 8, -222); g.closePath(); };
    slate(); g.fillStyle = A.linG(g, 0, -318, 0, -222, [[0, '#7f8fa6'], [1, '#56657e']]); g.fill();
    g.save(); slate(); g.clip(); g.strokeStyle = 'rgba(20,30,50,0.3)'; g.lineWidth = 1.2; for (let y = -312; y < -222; y += 9) { g.beginPath(); g.moveTo(-hw - 10, y); g.lineTo(hw + 10, y); g.stroke(); } for (let x = -hw - 10; x < hw + 10; x += 13) { g.beginPath(); g.moveTo(x, -318); g.lineTo(x + 2, -222); g.stroke(); } A.grain(g, -hw, -320, hw * 2, 100, 0.14, 'overlay', 19); g.restore();
    slate(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    for (const dx of [-80, 0, 80]) {                                                                                  // люкарны
      g.fillStyle = CS2[0]; g.fillRect(dx - 20, -300, 40, 46); g.lineWidth = 2.4; g.strokeStyle = OUT; g.strokeRect(dx - 20, -300, 40, 46);
      g.fillStyle = '#56657e'; g.beginPath(); g.moveTo(dx - 26, -300); g.lineTo(dx, -326); g.lineTo(dx + 26, -300); g.closePath(); g.fill(); g.stroke();
      K.archWin(g, dx, -258, 22, 36, { glass: 'day', frame: CS2[0], sill: false, keystone: false });
    }
    for (const dx of [-112, 108]) { A.box(g, dx - 8, -330, 16, 40, { fill: '#c0745a', lw: 2.2 }); A.box(g, dx - 11, -334, 22, 6, { fill: '#d8cdbd', lw: 2 }); }
    // стены верхнего этажа и карнизы
    A.plaster(g, -hw, -222, hw * 2, 112, [[0, CS2[0]], [1, CS2[1]]], { seed: 71, grain: 0.15 });
    g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(-hw, -222, hw * 2, 112);
    for (const dx of [-100, 0, 100]) K.archWin(g, dx, -128, 40, 80, { glass: dx === 0 ? 'lit' : 'day', frame: CS2[0], shutters: dx === 0 ? null : '#5f8f7a', balcony: 20 });
    cornice(g, -hw, hw, -110, 8);
    // вывеска-фриз
    A.plaster(g, -hw, -110, hw * 2, 34, [[0, '#2a5a58'], [1, '#1b4040']], { seed: 72, grain: 0.1 });
    g.lineWidth = 2.6; g.strokeStyle = OUT; g.strokeRect(-hw, -110, hw * 2, 34);
    K.goldText(g, 'CAFÉ', 0, -93, 26, { spacing: 10, font: Ale.FONT });
    g.fillStyle = '#e8c04a'; g.fillRect(-hw, -77, hw * 2, 3);
    // аркада: три арки с тёплым светом, столики и подвесные лампы внутри
    A.plaster(g, -hw, -76, hw * 2, 76, [[0, CS2[0]], [1, CS2[2]]], { seed: 73, grain: 0.15 });
    g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(-hw, -76, hw * 2, 76);
    const px = [-hw, -50, 50, hw];
    for (let k = 0; k < 3; k++) {
      const x0 = px[k] + 10, x1 = px[k + 1] - 10, cx = (x0 + x1) / 2, ah = 66, r = (x1 - x0) / 2;
      const arc = () => { g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, -ah + r); g.arc(cx, -ah + r, r, Math.PI, 0); g.lineTo(x1, 0); g.closePath(); };
      arc(); g.fillStyle = A.linG(g, 0, -ah, 0, 0, [[0, '#ffe3a0'], [0.6, '#f4b560'], [1, '#c87a38']]); g.fill();
      g.save(); arc(); g.clip();
      A.glow(g, cx, -34, 52, 'rgba(255,248,210,', 0.6);
      g.fillStyle = '#6a3a28'; g.fillRect(cx - 19, -26, 38, 3.4); g.fillRect(cx - 2, -22, 4, 22);                                  // столик внутри
      g.fillStyle = '#4a2a20'; for (const cx2 of [cx - 26, cx + 26]) { g.fillRect(cx2 - 7, -26, 14, 3); g.fillRect(cx2 - 6, -24, 2, 24); g.fillRect(cx2 + 4, -24, 2, 24); g.fillRect(cx2 + (cx2 < cx ? -9 : 7), -44, 2.4, 20); }
      g.strokeStyle = '#2a1a20'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, -ah + 4); g.lineTo(cx, -52); g.stroke(); g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(cx, -50, 5, 0, TAU); g.fill(); g.lineWidth = 1.2; g.stroke();
      A.edge(g, x0, -ah, x1 - x0, 14, 't', 14, 'rgba(80,30,10,0.35)');
      g.restore();
      arc(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.moveTo(x0 - 5, 0); g.lineTo(x0 - 5, -ah + r); g.arc(cx, -ah + r, r + 5, Math.PI, 0); g.lineTo(x1 + 5, 0); g.lineWidth = 1.6; g.strokeStyle = 'rgba(110,76,40,0.5)'; g.stroke();
    }
    for (const x of px) { if (x === -hw || x === hw) continue; K.column(g, x, -76, 0, 18, { pal: CS2, cap: '#d8b25a' }); }
    // полосатый тент над входом
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-hw, -3, hw * 2, 3);
  }
  // Столик кафе под зонтом: белый зонт в красную полоску, круглый столик, две плетёные стула; начало — середина столика на земле
  function cafeTable(g, flip) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 6, 5, 56, 0.26);
    for (const [cx, s] of [[-34, 1], [34, -1]]) {                                                                      // стулья
      g.strokeStyle = OUT; g.lineWidth = 5.4; g.beginPath(); g.moveTo(cx - 9 * s, -26); g.lineTo(cx - 9 * s, -2); g.moveTo(cx + 9 * s, -26); g.lineTo(cx + 9 * s, -2); g.stroke();
      g.strokeStyle = '#8a5a3a'; g.lineWidth = 2.6; g.stroke();
      g.fillStyle = '#c8885a'; g.fillRect(cx - 12, -30, 24, 6); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(cx - 12, -30, 24, 6);
      g.beginPath(); g.moveTo(cx - 10 * s, -30); g.quadraticCurveTo(cx - 14 * s, -48, cx - 8 * s, -58); g.lineTo(cx - 3 * s, -58); g.quadraticCurveTo(cx - 8 * s, -48, cx - 4 * s, -30); g.closePath(); g.fillStyle = '#d6996a'; g.fill(); g.stroke();
    }
    g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -52); g.stroke(); g.strokeStyle = '#4a3a3a'; g.lineWidth = 3.4; g.stroke();                       // столик
    g.beginPath(); g.ellipse(0, -2, 15, 4, 0, 0, TAU); g.fillStyle = '#4a3a3a'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.ellipse(0, -54, 34, 7, 0, 0, TAU); g.fillStyle = A.linG(g, -34, 0, 34, 0, [[0, '#fdf6e8'], [1, '#d8c8a8']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-8, -58, 5, 2.2, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();                                      // чашка
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(0, -56); g.lineTo(0, -168); g.stroke(); g.strokeStyle = '#d8d2c6'; g.lineWidth = 2.2; g.stroke();                       // зонт
    const ub = () => { g.beginPath(); g.moveTo(-74, -126); g.quadraticCurveTo(-60, -178, 0, -186); g.quadraticCurveTo(60, -178, 74, -126); for (let i = 0; i < 5; i++) g.quadraticCurveTo(74 - i * 29.6 - 14.8, -118 - (i % 2) * 0, 74 - (i + 1) * 29.6, -126); g.closePath(); };
    ub(); g.fillStyle = '#fdf6e8'; g.fill();
    g.save(); ub(); g.clip();
    for (let i = 0; i < 6; i++) { g.fillStyle = '#d63c40'; g.beginPath(); g.moveTo(-74 + i * 24.7 - 5, -200); g.lineTo(-74 + i * 24.7 + 7, -200); g.lineTo(-74 + i * 24.7 + 2 + (i - 2.5) * 6, -120); g.lineTo(-74 + i * 24.7 - 10 + (i - 2.5) * 6, -120); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(-30, -160, 28, 9, -0.25, 0, TAU); g.fill();
    A.edge(g, -80, -130, 160, 16, 'b', 16, 'rgba(90,30,30,0.3)');
    g.restore(); ub(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(0, -189, 3.4, 0, TAU); g.fill(); g.lineWidth = 1.4; g.stroke();
  }

  // =================================================================== машины
  // Красное спортивное купе (стилизованный силуэт, не копия реальной марки): нос вправо; начало — середина основания
  function coupe(g, col) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    col = col || ['#ff5a4a', '#d6283a', '#8e1426'];
    g.fillStyle = '#17141c'; g.fillRect(-150, -16, 300, 9);
    const body = () => { g.beginPath(); g.moveTo(-160, -14); g.lineTo(-166, -36); g.quadraticCurveTo(-166, -54, -150, -60); g.lineTo(-110, -68); g.lineTo(-62, -92); g.quadraticCurveTo(-30, -104, 4, -102); g.lineTo(30, -98); g.quadraticCurveTo(62, -88, 84, -68); g.lineTo(140, -58); g.quadraticCurveTo(166, -50, 170, -36); g.lineTo(166, -16); g.closePath(); };
    body(); g.fillStyle = A.linG(g, 0, -104, 0, -12, [[0, col[0]], [0.45, col[1]], [1, col[2]]]); g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(-130, -66); g.lineTo(-60, -90); g.lineTo(60, -92); g.lineTo(150, -60); g.lineTo(150, -64); g.lineTo(50, -97); g.lineTo(-60, -95); g.lineTo(-130, -70); g.fill();
    g.strokeStyle = 'rgba(60,8,16,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-26, -92); g.lineTo(-22, -22); g.moveTo(40, -92); g.lineTo(44, -24); g.stroke();                            // швы дверей
    g.fillStyle = 'rgba(40,6,14,0.5)'; g.beginPath(); g.moveTo(-50, -34); g.lineTo(-18, -40); g.lineTo(-18, -30); g.lineTo(-52, -26); g.fill();                                           // боковая воздухозаборка
    A.edge(g, -170, -44, 340, 34, 'b', 34, 'rgba(40,0,10,0.4)'); A.grain(g, -170, -104, 340, 92, 0.1, 'overlay', 21, 0.5);
    for (const cx of [-96, 100]) { g.fillStyle = '#100e14'; g.beginPath(); g.arc(cx, -25, 31, 0, TAU); g.fill(); }
    g.restore();
    g.lineWidth = 4; g.strokeStyle = OUT; body(); g.stroke();
    // стекло
    g.beginPath(); g.moveTo(-98, -68); g.lineTo(-58, -90); g.quadraticCurveTo(-30, -98, 2, -96); g.lineTo(26, -92); g.quadraticCurveTo(54, -84, 74, -68); g.closePath();
    g.fillStyle = A.linG(g, 0, -98, 0, -68, [[0, '#9fc4dc'], [1, '#2f4258']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(-84, -70); g.lineTo(-52, -88); g.lineTo(-38, -88); g.lineTo(-68, -70); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-26, -93); g.lineTo(-24, -69); g.stroke();
    // фара-щель, задний фонарь, ручка, зеркало, бамперы
    g.beginPath(); g.moveTo(138, -52); g.quadraticCurveTo(160, -50, 166, -42); g.lineTo(150, -42); g.closePath(); g.fillStyle = '#fff6d8'; g.fill(); g.lineWidth = 2.2; g.stroke();
    g.fillStyle = '#e8283a'; g.fillRect(-166, -52, 7, 12); g.lineWidth = 2; g.strokeRect(-166, -52, 7, 12);
    A.box(g, 56, -70, 12, 6, { fill: col[2], lw: 2, r: 2 }); A.box(g, -10, -66, 14, 3.4, { fill: '#e8e0d0', lw: 1.6, r: 1.5 });
    A.box(g, 150, -28, 22, 10, { fill: '#2a2630', lw: 2.2, r: 3 }); A.box(g, -172, -28, 20, 10, { fill: '#2a2630', lw: 2.2, r: 3 });
    A.speckle(g, -172, -106, 346, 96, 0.05, 6);
    for (const cx of [-96, 100]) wheel(g, cx, -25, 26, cx * 0.37, '#e8e2d6');
  }
  function wheel(ctx, cx, cy, R, rot, rim) {
    ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#1f2028'; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R - 3, 3.6, 5.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.fillStyle = rim || '#dfe2ee'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.rotate(rot); ctx.strokeStyle = '#7a7e92'; ctx.lineWidth = 2.6;
    for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14); ctx.lineTo(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.18, 0, TAU); ctx.fillStyle = '#9ba1b6'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
  }
  // Машина на стоянке — чёрный Mercedes-Maybach с надписью Uber на задней двери (владелец 03.10.2026: «такси везде в игре — Uber»; в Киеве та же машина): рисунок и анимация (колёса, свет фар, дверь, салон) —
  // в car_art.js. Состояние сцены — sc.taxi = { dx, door }: dx — смещение вправо в юнитах (0 в покое, растёт, когда машина уезжает), door — 0…1, насколько открыта задняя левая дверь.

  // =================================================================== мелкие детали улицы
  // Голубь: серо-сизое тело, радужная шея, оранжевые лапки; pose 0 — стоит, 1 — клюёт. Опора — между лапками
  function pigeon(g, pose) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const k = pose ? 1 : 0;
    g.strokeStyle = '#d6764a'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-2, -7); g.lineTo(-3, 0); g.moveTo(3, -7); g.lineTo(4, 0); g.stroke();
    g.save(); g.translate(0, -12); g.rotate(k * 0.35);
    g.beginPath(); g.moveTo(-13, -1); g.lineTo(-20, 2 + k * 2); g.lineTo(-12, 4); g.closePath(); g.fillStyle = '#4a5468'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.ellipse(0, 0, 13, 8, 0, 0, TAU); g.fillStyle = A.linG(g, 0, -8, 0, 8, [[0, '#b4bccb'], [1, '#7c869a']]); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(-3, -1, 8, 4.4, -0.2, 0, TAU); g.fillStyle = '#6a7388'; g.fill(); g.fillStyle = '#e8ecf4'; g.fillRect(-7, -2.4, 9, 1.6);
    g.restore();
    const hx = 11 + k * 5, hy = -17 + k * 12;
    g.beginPath(); g.moveTo(8, -16); g.quadraticCurveTo(10 + k * 4, -20 + k * 6, hx, hy); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 3.6; g.strokeStyle = '#6a8a7a'; g.stroke();
    g.beginPath(); g.arc(hx, hy, 4.4, 0, TAU); g.fillStyle = '#9aa3b4'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#e8a050'; g.beginPath(); g.moveTo(hx + 3.6, hy - 0.6); g.lineTo(hx + 8.6 + k, hy + 0.8 + k * 2); g.lineTo(hx + 3.6, hy + 2); g.closePath(); g.fill(); g.lineWidth = 1; g.stroke();
    g.fillStyle = '#2b1a20'; g.beginPath(); g.arc(hx + 1.4, hy - 1.2, 0.9, 0, TAU); g.fill();
  }
  // Фонарь: чугунный цоколь, рифлёный столб с золотыми поясками, две подвесные фонарные клетки на завитках и верхний фонарь. Начало — середина основания; высота ≈ 330
  function lamp(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const iron = (x0, x1) => A.linG(g, x0, 0, x1, 0, [[0, '#3f5a58'], [0.35, '#223534'], [1, '#101a1a']]);
    A.box(g, -20, -22, 40, 22, { fill: A.linG(g, -20, 0, 20, 0, [[0, '#f4eadb'], [1, '#c9b998']]), lw: 2.8, hi: 'rgba(255,255,255,0.5)' });
    A.box(g, -14, -34, 28, 12, { fill: iron(-14, 14), lw: 2.6 });
    g.beginPath(); g.moveTo(-8, -34); g.lineTo(-6, -250); g.lineTo(6, -250); g.lineTo(8, -34); g.closePath(); g.fillStyle = iron(-8, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,214,140,0.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3.6, -40); g.lineTo(-2.8, -246); g.stroke();
    for (const y of [-52, -150, -246]) A.box(g, -11, y - 5, 22, 10, { fill: A.linG(g, -11, 0, 11, 0, [[0, '#fff0a8'], [0.5, '#e8c04a'], [1, '#a8741a']]), lw: 2.2, r: 3 });
    // подвесные фонари на завитках
    for (const s of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 6.4; g.beginPath(); g.moveTo(s * 5, -226); g.bezierCurveTo(s * 30, -236, s * 52, -230, s * 56, -204); g.stroke(); g.strokeStyle = '#223534'; g.lineWidth = 3.2; g.stroke();
      g.strokeStyle = '#223534'; g.lineWidth = 2.6; K.scroll(g, s * 30, -218, 12, s, 2.6);
      lantern(g, s * 56, -204, 0.8);
    }
    lantern(g, 0, -250, 1.1, true);
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(0, -320, 5, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
  }
  // Фонарная клетка: стекло с тёплым светом, крыша-колпак, шарик. (cx, cy) — верх клетки (точка подвеса), s — масштаб; up — клетка стоит снизу
  function lantern(g, cx, cy, s, up) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    const top = up ? -60 : 0, bot = up ? 0 : 56;
    g.fillStyle = '#223534'; g.beginPath(); g.moveTo(-16, top + 8); g.lineTo(0, top - 12); g.lineTo(16, top + 8); g.closePath(); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(-14, top + 8); g.lineTo(-11, bot - 6); g.lineTo(11, bot - 6); g.lineTo(14, top + 8); g.closePath(); g.fillStyle = A.linG(g, 0, top + 8, 0, bot, [[0, '#fff6c8'], [0.5, '#ffe38a'], [1, '#f0b84a']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    A.glow(g, 0, (top + bot) / 2 + 2, 30, 'rgba(255,240,170,', 0.35);
    g.strokeStyle = '#223534'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, top + 8); g.lineTo(0, bot - 6); g.moveTo(-14, (top + bot) / 2); g.lineTo(14, (top + bot) / 2); g.stroke();
    g.fillStyle = '#223534'; g.fillRect(-12, bot - 7, 24, 7); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(-12, bot - 7, 24, 7);
    g.restore();
  }
  // Кадка с апельсиновым деревом (версальская): зелёный ящик с золотой отделкой, шарики на углах, ствол и круглая крона с плодами
  function orangeTree(g, seed) {
    g.lineJoin = 'round';
    A.shadow(g, 3, 3, 46, 0.26);
    A.box(g, -26, -42, 52, 42, { fill: A.linG(g, -26, 0, 26, 0, [[0, '#4f8a6c'], [0.5, '#2f6a52'], [1, '#1f4a3a']]), lw: 2.8, hi: 'rgba(255,255,255,0.18)' });
    g.strokeStyle = '#e8c04a'; g.lineWidth = 2; g.strokeRect(-20, -36, 40, 30); g.fillStyle = '#e8c04a'; for (const [x, y] of [[-20, -36], [20, -36], [-20, -6], [20, -6]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
    for (const sx of [-26, 26]) { g.beginPath(); g.arc(sx, -48, 6, 0, TAU); g.fillStyle = A.linG(g, sx - 6, -54, sx + 6, -42, [[0, '#fff0a8'], [1, '#b8862a']]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
    A.box(g, -30, -46, 60, 7, { fill: '#e6d6b0', lw: 2.4 });
    g.fillStyle = '#3a2a22'; g.fillRect(-4, -96, 8, 52); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(-4, -96, 8, 52);
    K.bush(g, 0, -126, 40, 34, K.LEAF, seed, { lw: 2.6 });
    const R = A.rng(seed + 9);
    for (let i = 0; i < 9; i++) { const a = R.range(0, TAU), d = Math.sqrt(R.next()) * 28; g.fillStyle = '#f59a1e'; g.beginPath(); g.arc(Math.cos(a) * d, -126 + Math.sin(a) * d * 0.85, 3.8, 0, TAU); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(100,40,0,0.7)'; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(Math.cos(a) * d - 1, -126 + Math.sin(a) * d * 0.85 - 1.2, 1.1, 0, TAU); g.fill(); }
  }
  // Каменный столб с фонарём-шаром (у ворот): тесаные блоки, колпак, шар
  function gatePier(g, h) {
    const w = 38;
    A.plaster(g, -w / 2, -h, w, h, [[0, CS[0]], [1, '#e4cd9e']], { seed: 81, grain: 0.15 });
    rust(g, -w / 2, w / 2, 0, -h + 24, 38, 22, 82);
    g.lineWidth = 3; g.strokeStyle = OUT; g.lineJoin = 'round'; g.strokeRect(-w / 2, -h, w, h);
    A.box(g, -w / 2 - 4, -h - 8, w + 8, 10, { fill: A.linG(g, 0, -h - 8, 0, -h + 2, [[0, CS[0]], [1, CS[1]]]), lw: 2.6, hi: 'rgba(255,255,255,0.5)' });
    A.box(g, -w / 2 - 5, -14, w + 10, 14, { fill: A.linG(g, 0, -14, 0, 0, [[0, CS[1]], [1, CS[2]]]), lw: 2.6 });
    g.beginPath(); g.moveTo(-14, -h - 8); g.lineTo(-10, -h - 18); g.lineTo(10, -h - 18); g.lineTo(14, -h - 8); g.closePath(); g.fillStyle = CS[1]; g.fill(); g.lineWidth = 2.4; g.stroke();
    g.beginPath(); g.arc(0, -h - 32, 15, 0, TAU); g.fillStyle = A.linG(g, -15, -h - 47, 15, -h - 17, [[0, '#fffbe0'], [1, '#f4e4a8']]); g.fill(); g.lineWidth = 2.6; g.stroke();
    A.glow(g, 0, -h - 32, 34, 'rgba(255,240,170,', 0.32);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-5, -h - 37, 5, 3, -0.6, 0, TAU); g.fill();
  }
  // Створка ворот: от петли (x = 0) вправо на 60; кованые прутья с пиками, перекладины, завитки, медальон у внутреннего края. Основание — y = 0
  function gateLeaf(g) {
    const h = 150, w = 60;
    g.fillStyle = 'rgba(30,50,48,0.14)'; g.fillRect(0, -h, w, h);
    K.ironRail(g, 2, w - 2, 0, h - 14, { step: 10.5, post: false, scrolls: true });
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(1, -h + 16); g.lineTo(w - 1, -h + 16); g.stroke(); g.strokeStyle = '#24302f'; g.lineWidth = 2.6; g.stroke();
    g.beginPath(); g.arc(w - 4, -70, 12, 0, TAU); g.fillStyle = A.linG(g, w - 16, -82, w + 8, -58, [[0, '#fff0a8'], [1, '#b8862a']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#b01e2e'; g.beginPath(); g.moveTo(w - 4, -77); g.lineTo(w + 1, -70); g.lineTo(w - 4, -63); g.lineTo(w - 9, -70); g.closePath(); g.fill();
    for (const y of [-h + 8, -8]) { g.fillStyle = '#24302f'; g.beginPath(); g.arc(3, y, 3.6, 0, TAU); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }                   // петли
  }
  // Высокий каменный столб у края улицы (поверх героев): в него прячется вор; бугенвиллея свисает с фонаря
  function endPier(g) {
    const w = 84, h = 300;
    A.plaster(g, -w / 2, -h, w, h, [[0, CS[0]], [1, '#e2c795']], { seed: 91, grain: 0.15 });
    rust(g, -w / 2, w / 2, 0, -90, 84, 26, 92);
    g.lineWidth = 3.2; g.strokeStyle = OUT; g.lineJoin = 'round'; g.strokeRect(-w / 2, -h, w, h);
    A.box(g, -w / 2 - 6, -h - 10, w + 12, 12, { fill: A.linG(g, 0, -h - 10, 0, -h + 2, [[0, CS[0]], [1, CS[1]]]), lw: 2.8, hi: 'rgba(255,255,255,0.5)' });
    K.archWin(g, 0, -150, 36, 74, { glass: 'lit', frame: CS[0], keystone: true });
    A.box(g, -w / 2 - 6, -16, w + 12, 16, { fill: A.linG(g, 0, -16, 0, 0, [[0, CS[1]], [1, CS[2]]]), lw: 2.8 });
    K.bougainvillea(g, -w / 2 - 6, -h - 4, w + 12, 120, 93);
    K.urn(g, 0, -h - 10, 1.0, { plant: 'flowers' });
  }

  // =================================================================== сборка: фон на кадр и детали
  MA.streetBack = guard('streetBack', function (ctx, cam, game, sc, L) {
    const W = game.viewW, H = game.viewH, t = sc.time;
    K.skyFill(ctx, W, H);
    A.blitView(ctx, L.sky, -cam.x * 0.08, 0, W);
    // чайки в небе: медленно плывут вдоль неба, взмахи крыльев по времени
    { ctx.strokeStyle = 'rgba(43,26,32,0.8)'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const sp = 16 + i * 5, span = W + 300, x = ((i * 330 + t * sp) % span) - 150, y = 120 + i * 42 + Math.sin(t * 0.6 + i * 2) * 14, f = Math.sin(t * (6 + i) + i), sz = 6 + (i % 2) * 2;
        ctx.moveTo(x - sz * 1.6, y + f * 3); ctx.quadraticCurveTo(x - sz * 0.7, y - sz * 0.8 - f * 3, x, y); ctx.quadraticCurveTo(x + sz * 0.7, y - sz * 0.8 - f * 3, x + sz * 1.6, y + f * 3);
      }
      ctx.stroke(); }
    A.blitView(ctx, L.vista, -cam.x * 0.18, VY, W);
    // блики на воде: по контурам, в светлой дорожке солнца и вокруг неё
    { const ox = -cam.x * 0.18;
      ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 34; i++) {
        const u = hash(i * 3.7), v = hash(i * 7.3 + 1.1), ph = t * (0.8 + hash(i) * 0.9) + i * 2.3;
        if (Math.sin(ph) < 0.2) continue;
        const y = HZ + 8 + v * v * 150, x = ox + 330 + u * 480 + (y - HZ) * (u - 0.5) * 1.6;
        if (x < -10 || x > W + 10) continue;
        const len = 6 + (y - HZ) * 0.14; ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
      }
      ctx.stroke(); }
    A.blitView(ctx, L.town, -cam.x * 0.4, TOWN_Y, W);
    A.blitView(ctx, L.mid, -cam.x * 0.65, MID_Y, W);
    A.beam(ctx, W * 0.14, -30, 120, W * 0.14 + 380, 600, 260, 0.055, 'rgba(255,238,190,'); A.beam(ctx, W * 0.44, -30, 90, W * 0.44 + 340, 600, 200, 0.04, 'rgba(255,238,190,');
    A.blitView(ctx, L.ground, -cam.x, WALL - 4, W);
  });

  MA.streetDecor = guard('streetDecor', function (X, sc) {
    const out = [];
    const D = X.door, TOP = WALL + 0;
    // Спрайт в мировой точке (ax, ay) с опорой (ox, oy) внутри; cx — центр для отсечения невидимого, hw — запас по ширине
    const put = (name, ax, ay, z, cx, hw, w, h, ox, oy, scale, fn, opt) => {
      opt = opt || {};
      const spr = sprite(w, h, ox, oy, scale, fn);
      deco(out, sc, name, cx, z, hw, (ctx) => { if (opt.shadow) A.shadow(ctx, ax + (opt.shx || 0), ay + 2, opt.shadow[0], opt.shadow[1]); spr(ctx, ax, ay, opt.flip); });
      return spr;
    };
    // ---- здание казино и кафе
    put('casino', D, WALL, 6, D, 560, 1000, 600, 500, 572, dens(1.5), casinoFacade);
    put('cafe', 180, WALL, 6, 180, 200, 340, 360, 170, 346, dens(1.6), cafeBuilding);
    // ---- флаги Монако на шестах над аттиком (на кадр)
    for (const s of [-1, 1]) { const fx = D + s * 92, fy = WALL + ATOP - 66; deco(out, sc, 'flag', fx, 8, 50, (ctx, t) => K.flag(ctx, fx + 2, fy, 46, 29, t, s * 1.7)); }
    // ---- свет над дверью и тёплое свечение подъезда
    deco(out, sc, 'doorGlow', D, 10, 200, (ctx, t) => {
      const k = 0.5 + 0.06 * Math.sin(t * 2.7);
      A.glow(ctx, D, WALL - 130, 170, 'rgba(255,214,140,', 0.5 * k); A.glow(ctx, D, WALL - 18, 130, 'rgba(255,200,120,', 0.4 * k);
    });
    // ---- балюстрады вдоль улицы: слева у кафе и машины, справа от ворот до столба; вазы с цветами
    const bal = (x0, w, posts) => put('balustrade', x0, WALL, 4, x0 + w / 2, w / 2 + 40, w + 40, 150, 20, 134, dens(1.5), (g) => { K.balustrade(g, 0, w, 0, 56, { posts, lw: 2 }); for (let ux = 70; ux < w - 40; ux += 150) K.urn(g, ux, -56, 0.8, { plant: 'flowers' }); });
    bal(340, 370, [0, 123, 246, 370]); bal(1880, 410, [0, 137, 274, 410]);
    // ---- апельсиновые деревья в кадках и клумбы у основания здания
    const orS = [sprite(110, 190, 55, 180, dens(1.7), (g) => orangeTree(g, 5)), sprite(110, 190, 55, 180, dens(1.7), (g) => orangeTree(g, 8))];
    [-440, -330, 330, 440].forEach((dx, i) => { const x = D + dx; deco(out, sc, 'orange', x, 9, 60, (ctx) => orS[i % 2](ctx, x, WALL + 8)); });
    for (const [dx, w, sd] of [[-398, 56, 11], [-284, 60, 12], [226, 56, 13], [316, 60, 14], [400, 56, 15], [-176, 30, 16], [176, 30, 17]]) { const x = D + dx; const bedS = sprite(w + 20, 40, 10, 34, dens(1.7), (g) => K.flowerBed(g, 0, 0, w, sd, { h: 24 })); deco(out, sc, 'bed', x + w / 2, 9, w / 2 + 20, (ctx) => bedS(ctx, x, WALL + 12)); }
    // ---- фонари
    const lampS = sprite(180, 350, 90, 340, dens(1.7), lamp);
    for (const lx of [X.thief + 46, D - 232, D + 232, 2268]) deco(out, sc, 'lamp', lx, 14, 80, (ctx, t) => {
      A.shadow(ctx, lx, WALL + 4, 30, 0.3); lampS(ctx, lx, WALL + 6, false, 0.85);
      const k = 0.5 + 0.05 * Math.sin(t * 3 + lx); for (const [dx, dy, r] of [[-48, -124, 60], [48, -124, 60], [0, -255, 76]]) A.glow(ctx, lx + dx, WALL + 6 + dy, r, 'rgba(255,224,150,', 0.4 * k);
    });
    // ---- пальмы: на кадр качается только крона
    const palms = [
      [40, 330, 150, 7, -14], [640, 300, 140, 9, 12], [1895, 320, 148, 11, -10],
    ].map(([x, h, R, sd, lean]) => ({ x, p: K.palm({ h, R, seed: sd, lean, scale: 1.5 }) }));
    for (const { x, p } of palms) deco(out, sc, 'palm', x, 15, 190, (ctx, t) => { A.shadow(ctx, x + 10, WALL + 6, 40, 0.28); p.draw(ctx, x, WALL + 8, t); });
    // ---- красное купе у балюстрады
    put('coupe', 480, WALL + 8, 16, 480, 200, 380, 130, 190, 118, dens(1.6), coupe, { shadow: [176, 0.3] });
    // ---- столик кафе на улице
    const tableS = sprite(190, 230, 95, 218, dens(1.7), (g) => cafeTable(g));
    for (const tx of [268, 62]) deco(out, sc, 'cafeTable', tx, 18, 100, (ctx) => tableS(ctx, tx, WALL + 8));
    // ---- голуби на плитке: изредка клюют
    const pg = [sprite(58, 44, 29, 38, 3, (g) => pigeon(g, 0)), sprite(58, 44, 29, 38, 3, (g) => pigeon(g, 1))];
    for (const [x, ph, flip] of [[560, 0.3, false], [1012, 1.4, true], [1560, 2.2, false], [1740, 0.9, true]]) deco(out, sc, 'pigeon', x, 21, 30, (ctx, t) => pg[Math.floor(t * 1.5 + ph * 2) % 4 === 0 ? 1 : 0](ctx, x, WALL + 18, flip));
    // ---- ворота: столбы с шарами, створки (z = 50, как у вора) с плавным раскрытием и прозрачностью, коробочки цветов
    const pierS = sprite(100, 300, 50, 270, dens(1.7), (g) => gatePier(g, 150));
    for (const dx of [-79, 79]) deco(out, sc, 'gatePier', X.gate + dx, 15, 60, (ctx) => { A.shadow(ctx, X.gate + dx, WALL + 6, 40, 0.3); pierS(ctx, X.gate + dx, WALL + 12); });
    const leafS = sprite(130, 200, 34, 180, dens(1.7), gateLeaf);
    deco(out, sc, 'gate', X.gate, 50, 90, (ctx) => {
      const o = sc.gate ? Math.max(0, Math.min(1, sc.gate.open)) : 0;
      if (o >= 1) return;
      const k = 1 - o * 0.92;
      ctx.save(); ctx.globalAlpha = 1 - o * 0.7;
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(X.gate + s * 60, WALL + 14); ctx.scale(s * k, 1); ctx.drawImage(leafS.L.c, -leafS.ox, -leafS.oy, leafS.L.w, leafS.L.h); ctx.restore(); }
      ctx.restore();
    });
    // ---- стоянка: машина; нос вправо, дверь — ближе к корме (столба-указателя нет: владелец 04.10.2026 убрал его)
    const car = Ale.CarArt.sprite(dens(1.9));
    out.push({ x: X.taxi, z: 18, name: 'taxi', draw: guard('taxi', (ctx, t) => { const dx = sc.taxi ? sc.taxi.dx || 0 : 0; if (!K.onScreen(sc, X.taxi + dx, 200)) return; car.draw(ctx, X.taxi, WALL + 8, sc.taxi); }) });
    // ---- каменный столб с цветами у края улицы поверх героев: за ним вор «убегает за угол»
    put('endPier', 2358, WALL + 16, 60, 2358, 80, 150, 420, 75, 404, dens(1.6), endPier);
    return out;
  });
  MA.streetFront = guard('streetFront', function (X, sc) { return []; });
})();
