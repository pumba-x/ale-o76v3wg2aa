// Киев: парк у красного корпуса КНУ (сцена kyivPark) и площадка у шахматных столов (сцена kyivCourt). Рисуется кодом в манере Парижа:
// тёмный тёплый контур, плоские цвета с мягкими градиентами, зерно и пятна, свет сверху-слева; дальние планы — в дымке.
// Контракт с kyiv_park.js: KA.parkLayers(game, WIDTH, X) → слои, KA.parkBack(ctx, cam, game, sc, layers) — фон на кадр, KA.fountain(ctx, x, wall, t), KA.parkDecor(X) → [{ x, z, draw(ctx, t) }].
// Парк: низкий круглый фонтан из тёмного гранита без ярусов (одна высокая струя и круг низких дуг от борта) стоит на переднем плане, на брусчатке ниже линии ходьбы (основание на 100 юн. ниже неё), кольца
// брусчатки вокруг него лежат в слое земли, герои проходят за чашей (z сцены выше героев); кресла-лавочки на одного (X.chairsL / X.chairsR) смотрят на воду; длинные лавки (X.benches) — вдоль аллеи.
// Контракт с kyiv_court.js: KA.courtLayers / KA.courtBack — то же; KA.courtDecor(X, sc) → [{ x, z, draw }]: стойка с наборами, ограждение, спортивная стойка, шахматный стол со скамьями
// (один спрайт на переднем плане, z = 58: герои проходят за ним, передняя грань правой скамьи закрывает ноги сидящего Димасика), машина Uber / Maybach (car_art.js; по состоянию сцены sc.taxi = { dx, door }),
// дорожка парка слева; сетки нет (убрана по просьбе владельца 03.10.2026: барьер полосы Алеси остаётся невидимой стеной в сцене); KA.courtFront(X) — пусто: ничто не закрывает героев, проём в изгороди и машину. Площадка 2600 юн.: живая изгородь с проёмом (X.gap) — слой в мировых координатах, деревья среднего плана — спрайты с параллаксом.
// Устройство: неподвижное собрано один раз в слои (A.layer), в кадре — только копирование; живое (вода фонтана, колёса и дверь машины) — малым числом контуров.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const FY = 600, WALL = 584;

  const KA = (Ale.KyivArt = Ale.KyivArt || {});
  KA.redBuilding = (g, cx, base, o) => redBuilding(g, cx, base, o);      // для проверок (рисунок корпуса на отдельном холсте)
  // На сенсорных экранах (телефоны, планшеты) спрайты и слои строятся легче: память Safari на iOS ограничена; на настольных — как заказано
  const dens = (s) => s * ((Ale.Touch && Ale.Touch.active) ? 0.8 : 1);

  // =================================================================== общие кисти
  const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  // Смешение двух цветов #rrggbb: t = 0 — первый, 1 — второй (дымка расстояния, оттенки)
  function mix(a, b, t) { const p = rgb(a), q = rgb(b); return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',') + ')'; }
  // Тот же набор красок листвы, затянутый дымкой цвета col на долю t
  function hazed(P, t, col) { const o = Object.assign({}, P); for (const k of ['hi', 'mid', 'lo']) o[k] = mix(P[k], col, t); return o; }

  // Небо: градиент рисуется каждый кадр (дёшево), облака и солнечный ореол — в отдельном слое
  const SKY = [[0, '#66acea'], [0.4, '#a0d1f1'], [0.78, '#d8ecf3'], [1, '#f2f5e9']];
  function skyFill(ctx, W, H) { A.gradV(ctx, 0, 0, W, H, SKY); }

  // Кучевое облако: плоское основание, пухлая верхушка, холодная тень снизу; без контура, как облака Парижа.
  // Рисуется во временный холст (тень основания ложится только на само облако, а не на ореол и соседей) и копируется в слой.
  function cloud(g, x, y, w, R) {
    const pad = 8, ww = Math.ceil(w + pad * 2), hh = Math.ceil(w * 0.34 + pad), by = hh - pad * 0.5;
    const c = document.createElement('canvas'); c.width = ww; c.height = hh;
    const t = c.getContext('2d'), n = 7 + R.int(0, 3), h = w * 0.2;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, r = w * (0.07 + 0.09 * Math.sin(u * Math.PI)) * R.range(0.85, 1.2), bx = ww / 2 + (u - 0.5) * w * 0.88, cy = by - r * 0.62;
      const gr = t.createRadialGradient(bx - r * 0.2, cy - r * 0.35, r * 0.1, bx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.98)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.93)'); gr.addColorStop(1, 'rgba(236,246,252,0.85)');
      t.fillStyle = gr; t.beginPath(); t.arc(bx, cy, r, 0, 6.283); t.fill();
    }
    t.globalCompositeOperation = 'destination-out'; t.fillRect(0, by, ww, hh);            // плоское основание
    t.globalCompositeOperation = 'source-atop'; t.fillStyle = A.linG(t, 0, by - h, 0, by, [[0, 'rgba(160,196,226,0)'], [1, 'rgba(150,186,220,0.42)']]); t.fillRect(0, by - h, ww, h + 1);
    g.drawImage(c, x - ww / 2, y - by, ww, hh);
    c.width = 0; c.height = 0;
  }
  // Небесный слой: солнечный ореол и облака; плывёт медленно (параллакс 0,1)
  function skyLayer(w, h, seed, sunX) {
    return A.layer(w, h, (g) => {
      const R = A.rng(seed);
      A.glow(g, sunX, 150, 420, 'rgba(255,246,214,', 0.7);
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = A.linG(g, 0, h * 0.5, 0, h, [[0, '#000'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';       // ореол растворяется к нижней кромке слоя: раньше он обрывался жёсткой горизонтальной линией поперёк неба (её видно в просветах между деревьями и крышами)
      for (let i = 0; i < 7; i++) cloud(g, R.range(0, w), R.range(70, h - 40), R.range(170, 330), R);
      g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 1.8; g.lineCap = 'round';                 // птицы вдали: несколько галочек
      for (const [bx, by, bs] of [[0.18, 118, 1], [0.205, 132, 0.8], [0.47, 190, 0.9], [0.74, 96, 1], [0.765, 108, 0.75], [0.9, 210, 0.85]]) { const x = bx * w; g.beginPath(); g.moveTo(x - 7 * bs, by - 3 * bs); g.quadraticCurveTo(x - 3 * bs, by - 5 * bs, x, by); g.quadraticCurveTo(x + 3 * bs, by - 5 * bs, x + 7 * bs, by - 3 * bs); g.stroke(); }
    }, 1);
  }

  // =================================================================== растительность
  const LEAF = { hi: '#a8de76', mid: '#62ae4c', lo: '#3a7c3e', edge: 'rgba(20,58,36,0.5)', dark: 'rgba(20,64,38,0.4)', light: 'rgba(218,248,152,0.45)' };
  const LIME = { hi: '#c2e682', mid: '#78ba50', lo: '#4a8e3e', edge: 'rgba(24,62,36,0.5)', dark: 'rgba(22,66,38,0.38)', light: 'rgba(230,250,160,0.45)' };
  const DEEP = { hi: '#58925a', mid: '#34704a', lo: '#20503a', edge: 'rgba(10,36,30,0.55)', dark: 'rgba(10,40,32,0.45)', light: 'rgba(150,206,140,0.32)' };
  const HEDGE = { hi: '#7fc058', mid: '#468f40', lo: '#2c6a38', edge: 'rgba(16,50,32,0.5)', dark: 'rgba(16,56,34,0.42)', light: 'rgba(208,244,150,0.4)' };

  // Крона из кругов-«клубов»: общий контур, шаровая заливка каждого клуба (свет сверху-слева), дуги-листья, тень на нижней кромке, зерно.
  // blobs — [x, y, r], порядок сверху вниз (нижние перекрывают верхние); P — краски; o.line — цвет контура.
  function crown(g, blobs, P, seed, o) {
    o = o || {};
    const R = A.rng(seed);
    let top = 1e9, bot = -1e9, lf = 1e9, rt = -1e9;
    for (const [x, y, r] of blobs) { top = Math.min(top, y - r); bot = Math.max(bot, y + r); lf = Math.min(lf, x - r); rt = Math.max(rt, x + r); }
    // подложка-ядро: закрывает просветы между клубами (кроны без «дыр»)
    const core = o.core || [(lf + rt) / 2, (top + bot) / 2, (rt - lf) * 0.3, (bot - top) * 0.3];
    g.fillStyle = o.line || OUT;
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + (o.lw || 3.2), 0, 6.283); g.fill(); }
    const uni = () => { g.beginPath(); for (const [x, y, r] of blobs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.283); } g.moveTo(core[0] + core[2], core[1]); g.ellipse(core[0], core[1], core[2], core[3], 0, 0, 6.283); };
    uni(); g.fillStyle = A.linG(g, 0, top, 0, bot, [[0, P.hi], [0.5, P.mid], [1, P.lo]]); g.fill();
    for (const [x, y, r] of blobs) {
      g.save(); g.beginPath(); g.arc(x, y, r, 0, 6.283); g.clip();
      const gr = g.createRadialGradient(x - r * 0.34, y - r * 0.42, r * 0.04, x, y, r * 1.1);
      gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.mid); gr.addColorStop(1, P.lo);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      const n = Math.round(r / 2.6);
      for (let i = 0; i < n; i++) {
        const lx = x + R.range(-0.8, 0.8) * r, ly = y + R.range(-0.8, 0.8) * r, shade = ly > y + r * 0.1 || lx > x + r * 0.35;
        g.strokeStyle = shade ? P.dark : P.light; g.lineWidth = Math.max(1.1, r * 0.05);
        const a0 = R.range(0, 6.283);
        g.beginPath(); g.arc(lx, ly, R.range(2.6, 5.2) * Math.max(0.8, r / 30), a0, a0 + R.range(1.3, 2.1)); g.stroke();
      }
      g.strokeStyle = P.edge; g.lineWidth = Math.max(1.8, r * 0.075); g.beginPath(); g.arc(x, y, r - 1.2, 0.16 * Math.PI, 0.84 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,255,230,0.14)'; g.beginPath(); g.ellipse(x - r * 0.36, y - r * 0.44, r * 0.3, r * 0.17, -0.6, 0, 6.283); g.fill();
      g.restore();
    }
    g.save(); uni(); g.clip(); A.grain(g, lf, top, rt - lf, bot - top, 0.12, 'overlay', seed + 1, 0.6); g.restore();
  }

  // Облако клубов в эллипсе (rx, ry): центральный клуб, кольцо ядра и кольцо по краю — просветов нет, край «кучерявый», а не круглый
  function blobsIn(R, rx, ry, nCore, nEdge) {
    const out = [[R.range(-0.05, 0.05) * rx, R.range(-0.05, 0.05) * ry, rx * 0.4]];
    for (let i = 0; i < nCore; i++) { const a = (i / nCore) * 6.283 + R.range(-0.3, 0.3), d = R.range(0.38, 0.56); out.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * R.range(0.27, 0.36)]); }
    for (let i = 0; i < nEdge; i++) { const a = (i / nEdge) * 6.283 + R.range(-0.18, 0.18), d = R.range(0.74, 0.92); out.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * R.range(0.17, 0.27)]); }
    return out.sort((p, q) => p[1] - q[1]);
  }

  // Ствол: тёмный, чуть наклонный, с расширением у корней; кора — вертикальные штрихи; свет слева. lean — смещение верха.
  function trunk(g, x, base, h, w, lean, line) {
    const R = A.rng(Math.round(x * 7 + h));
    const edge = (side, t) => x + side * w * (0.5 - 0.16 * t) * (t < 0.1 ? 1 + (0.1 - t) * 4 : 1) + lean * t * t;
    const path = () => {
      g.beginPath(); g.moveTo(edge(-1, 0) - 6, base + 2);
      for (let i = 0; i <= 8; i++) { const t = i / 8; g.lineTo(edge(-1, t), base - h * t); }
      for (let i = 8; i >= 0; i--) { const t = i / 8; g.lineTo(edge(1, t), base - h * t); }
      g.lineTo(edge(1, 0) + 6, base + 2); g.closePath();
    };
    path(); g.fillStyle = A.linG(g, x - w * 0.6, 0, x + w * 0.6, 0, [[0, '#7a6048'], [0.35, '#5a4434'], [1, '#33261f']]); g.fill();
    g.save(); path(); g.clip();
    for (let i = 0; i < Math.max(3, w / 4); i++) { const bx = x + R.range(-0.45, 0.45) * w; g.strokeStyle = 'rgba(30,20,16,' + R.range(0.2, 0.42).toFixed(2) + ')'; g.lineWidth = R.range(1, 2.4); g.beginPath(); g.moveTo(bx, base); for (let k = 1; k <= 6; k++) { const t = k / 6; g.lineTo(bx + lean * t * t + Math.sin(k * 1.7 + i) * 1.8, base - h * t); } g.stroke(); }
    g.fillStyle = 'rgba(255,220,170,0.16)'; g.fillRect(x - w * 0.5, base - h, w * 0.14, h);
    g.restore();
    path(); g.lineWidth = 3; g.strokeStyle = line || OUT; g.lineJoin = 'round'; g.stroke();
  }

  // Лиственное дерево (каштан, клён, липа): ствол с наклоном, ветви уходят в крону, крона — облако клубов. base — низ ствола.
  // o: pal, line, trunk (высота ствола), rx, ry (полуоси кроны), lean, haze.
  function broadleaf(g, x, base, s, seed, o) {
    o = o || {};
    const R = A.rng(seed), th = o.trunk || 140, rx = o.rx || 118, ry = o.ry || 104, lean = o.lean === undefined ? R.range(-18, 18) : o.lean;
    g.save(); g.translate(x, base); g.scale(s, s);
    const cy = -(th + ry * 0.78);
    trunk(g, 0, 0, th + ry * 0.55, o.tw || 26, lean, o.line);
    g.lineCap = 'round';
    for (const k of [-1, 0.2, 1]) { g.strokeStyle = o.line || OUT; g.lineWidth = 12; g.beginPath(); g.moveTo(lean * 0.9, -th * 0.86); g.quadraticCurveTo(k * rx * 0.3, cy + ry * 0.55, k * rx * 0.62, cy + ry * 0.12); g.stroke(); g.strokeStyle = '#4a3a2e'; g.lineWidth = 6.4; g.stroke(); }
    const blobs = blobsIn(R, rx, ry, 9, 14).map(([bx, by, br]) => [bx + lean * 0.5, cy + by, br]);
    crown(g, blobs, o.pal || LEAF, seed, o);
    g.restore();
  }

  // Туя: тёмный плотный столб из клубов, узкий кончик. h — высота, w — полуширина у основания.
  function thuja(g, x, base, s, seed, o) {
    o = o || {};
    const R = A.rng(seed), h = o.h || 250, w = o.w || 46;
    g.save(); g.translate(x, base); g.scale(s, s);
    const blobs = [], n = Math.round(h / 20);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), r = w * (0.34 + 0.66 * Math.pow(1 - t, 0.8)) * R.range(0.9, 1.1), cy = -(t * (h - 26) + 24);
      blobs.push([R.range(-3, 3) - r * 0.28, cy, r * 0.62], [R.range(-3, 3) + r * 0.3, cy + R.range(-4, 4), r * 0.62]);
    }
    blobs.push([0, -h + 18, w * 0.2]);
    blobs.sort((p, q) => p[1] - q[1]);
    g.fillStyle = '#3a2a22'; g.fillRect(-4, -12, 8, 14);
    crown(g, blobs, o.pal || DEEP, seed, Object.assign({ lw: 2.8 }, o));
    g.restore();
  }

  // Подстриженная живая изгородь: прямой «ящик» с лёгкой выпуклостью сверху, клубочки листвы по всей поверхности
  function hedge(g, x, base, w, h, seed, o) {
    o = o || {};
    const R = A.rng(seed), P = o.pal || HEDGE, top = base - h;
    const path = () => { A.rrPath(g, x, top, w, h, Math.min(14, h * 0.4)); };
    path(); g.save(); g.lineWidth = 5; g.strokeStyle = o.line || OUT; g.stroke(); g.restore();
    path(); g.fillStyle = A.linG(g, 0, top, 0, base, [[0, P.hi], [0.45, P.mid], [1, P.lo]]); g.fill();
    g.save(); path(); g.clip();
    const cell = 13;
    for (let yy = top + 5, row = 0; yy < base; yy += cell * 0.78, row++) for (let xx = x + (row % 2) * cell / 2; xx < x + w; xx += cell) {
      const rr = cell * R.range(0.42, 0.62), shade = (yy - top) / h;
      g.fillStyle = shade > 0.55 ? P.dark : (R.chance(0.4) ? P.light : 'rgba(255,255,255,0.05)');
      g.beginPath(); g.arc(xx + R.range(-2, 2), yy + R.range(-2, 2), rr, 0, 6.283); g.fill();
      g.strokeStyle = P.dark; g.lineWidth = 1; g.beginPath(); g.arc(xx, yy, rr, 0.2, 2.9); g.stroke();
    }
    A.edge(g, x, top, w, h * 0.6, 't', h * 0.5, 'rgba(255,255,200,0.16)'); A.edge(g, x, base - h * 0.4, w, h * 0.4, 'b', h * 0.4, 'rgba(10,40,30,0.4)');
    A.grain(g, x, top, w, h, 0.14, 'overlay', seed, 0.6);
    g.restore();
    path(); g.lineWidth = 3.2; g.strokeStyle = o.line || OUT; g.lineJoin = 'round'; g.stroke();
  }

  // Цветы клумбы: красная сальвия (колоски из мелких цветков), бархатцы и ромашки (венчик из лепестков); w — ширина. Основание — на линии base.
  function flowers(g, x, base, w, seed, o) {
    o = o || {};
    const R = A.rng(seed), n = Math.round(w / 9);
    for (let i = 0; i < n; i++) {
      const fx = x + (i + R.range(0.1, 0.9)) * (w / n), fy = base - R.range(3, 15), s = R.range(0.85, 1.25), kind = R.next();
      g.strokeStyle = 'rgba(30,70,36,0.9)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(fx, base); g.lineTo(fx, fy + 4); g.stroke();
      g.fillStyle = R.pick(['#3f8a40', '#4f9c48', '#357a3c']); g.beginPath(); g.ellipse(fx - 5 * s, fy + 8, 6 * s, 3.4 * s, -0.5, 0, 6.283); g.ellipse(fx + 5 * s, fy + 9, 6 * s, 3.4 * s, 0.5, 0, 6.283); g.fill();
      if (kind < 0.4) {                                                    // сальвия: колосок из цветков, к вершине мельче
        for (let k = 0; k < 4; k++) { const ky = fy + 2 - k * 4.4 * s, kr = (3.4 - k * 0.5) * s; g.fillStyle = k % 2 ? '#f0404a' : '#d62c3a'; g.beginPath(); g.ellipse(fx + (k % 2 ? 1.2 : -1.2), ky, kr * 1.2, kr, 0, 0, 6.283); g.fill(); g.lineWidth = 1.3; g.strokeStyle = OUT; g.stroke(); }
      } else {                                                             // бархатцы / ромашки: круглый венчик
        const c = kind < 0.7 ? ['#f1b32e', '#f58a2e'] : kind < 0.88 ? ['#fff6e0', '#f1c232'] : ['#e4363f', '#b82030'];
        g.fillStyle = c[0]; for (let k = 0; k < 7; k++) { const a = k * 0.8976; g.beginPath(); g.ellipse(fx + Math.cos(a) * 4.2 * s, fy + Math.sin(a) * 4.2 * s, 2.6 * s, 1.7 * s, a, 0, 6.283); g.fill(); }
        g.beginPath(); g.arc(fx, fy, 5.4 * s, 0, 6.283); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
        g.fillStyle = c[1]; g.beginPath(); g.arc(fx, fy, 2.7 * s, 0, 6.283); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(fx - 1.4, fy - 1.6, 1.3 * s, 0, 6.283); g.fill();
      }
    }
  }

  // =================================================================== красный корпус
  // Арочное окно: белая рама, тёмное стекло с бликом, переплёт, замковый камень, подоконник. (x, bottom) — середина низа проёма.
  function archWin(g, x, bottom, w, h, o) {
    o = o || {};
    const r = w / 2, top = bottom - h, frame = o.frame || '#f3e9d6';
    const path = (grow) => { g.beginPath(); g.moveTo(x - r - grow, bottom + grow * 0.4); g.lineTo(x - r - grow, top + r); g.arc(x, top + r, r + grow, Math.PI, 0); g.lineTo(x + r + grow, bottom + grow * 0.4); g.closePath(); };
    path(4.4); g.fillStyle = frame; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    path(0); g.fillStyle = A.linG(g, 0, top, 0, bottom, o.glass || [[0, '#2f4259'], [0.5, '#4a6180'], [1, '#6a809a']]); g.fill();
    g.save(); path(0); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.moveTo(x - r, bottom); g.lineTo(x - r * 0.05, top); g.lineTo(x + r * 0.42, top); g.lineTo(x - r * 0.62, bottom); g.fill();
    if (o.curtain) { g.fillStyle = 'rgba(244,232,214,0.55)'; g.fillRect(x - r, top + r * 0.7, r * 0.6, h); }
    g.strokeStyle = frame; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.moveTo(x - r, top + h * 0.42); g.lineTo(x + r, top + h * 0.42); g.stroke();
    A.edge(g, x - r, top, w, h, 't', 9, 'rgba(0,0,0,0.3)');
    g.restore();
    path(0); g.lineWidth = 1.8; g.strokeStyle = 'rgba(30,18,24,0.7)'; g.stroke();
    g.fillStyle = frame; g.beginPath(); g.moveTo(x - 4.4, top - r - 5); g.lineTo(x + 4.4, top - r - 5); g.lineTo(x + 3, top - r + 3); g.lineTo(x - 3, top - r + 3); g.closePath(); g.fill(); g.lineWidth = 1.8; g.stroke();
    g.fillStyle = o.sill || '#e6d8bf'; g.fillRect(x - r - 8, bottom + 3, w + 16, 5); g.strokeRect(x - r - 8, bottom + 3, w + 16, 5);
  }

  // Колонна портика: красный ствол с каннелюрами и светом слева, тёмная капитель с волютами, база. cx — ось, top/bottom — верх капители и низ базы.
  function column(g, cx, top, bottom, o) {
    o = o || {};
    const w = 36, x = cx - w / 2, red = o.red || ['#e66c52', '#cf4a34', '#a23a2c'], cap = o.cap || '#3f3b44';
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, red[0]], [0.34, red[1]], [1, red[2]]]); g.fillRect(x, top + 16, w, bottom - top - 24);
    g.save(); g.beginPath(); g.rect(x, top + 16, w, bottom - top - 24); g.clip();
    for (let i = 1; i < 7; i++) { const fx = x + i * (w / 7); g.fillStyle = 'rgba(80,16,10,0.22)'; g.fillRect(fx, top + 18, 1.8, bottom - top - 28); g.fillStyle = 'rgba(255,200,170,0.2)'; g.fillRect(fx + 1.8, top + 18, 1.2, bottom - top - 28); }
    A.grain(g, x, top + 16, w, bottom - top - 24, 0.14, 'overlay', Math.round(cx) + 5);
    A.edge(g, x, top + 16, w, 26, 't', 26, 'rgba(50,8,6,0.3)');
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, top + 16, w, bottom - top - 24);
    // капитель: абак, подушка с волютами
    A.box(g, x - 7, top, w + 14, 8, { fill: cap, lw: 2.6, hi: 'rgba(255,255,255,0.22)' });
    g.fillStyle = cap; g.beginPath(); g.moveTo(x - 3, top + 8); g.lineTo(x + w + 3, top + 8); g.lineTo(x + w - 2, top + 17); g.lineTo(x + 2, top + 17); g.closePath(); g.fill(); g.lineWidth = 2.4; g.stroke();
    for (const vx of [x - 1, x + w + 1]) { g.beginPath(); g.arc(vx, top + 12, 6, 0, 6.283); g.fillStyle = cap; g.fill(); g.lineWidth = 2.2; g.stroke(); g.beginPath(); g.arc(vx, top + 12, 2.4, 0, 6.283); g.stroke(); }
    // база
    A.box(g, x - 6, bottom - 8, w + 12, 8, { fill: cap, lw: 2.6, hi: 'rgba(255,255,255,0.18)' });
    g.fillStyle = cap; g.fillRect(x - 2, bottom - 12, w + 4, 5); g.strokeRect(x - 2, bottom - 12, w + 4, 5);
  }

  // Красный корпус целиком. Начало координат — середина основания (cx, base); ширина ≈ 1560, высота до конька ≈ 380 (при scale 1).
  // o: scale, frame (цвет оконных рам — на площадке приглушён), glass (краски стекла: светлее — тише контраст), wallA/wallB (краски стены).
  function redBuilding(g, cx, base, o) {
    o = o || {};
    const s = o.scale || 1, frame = o.frame || '#f3e9d6', wallA = o.wallA || '#d4503a', wallB = o.wallB || '#bc3c2d', glass = o.glass || null;
    g.save(); g.translate(cx, base); g.scale(s, s);
    const R = A.rng(41);
    const WING = 250, CEN = 292, HALF = 780;
    // ---- крыша: тёмно-серо-зелёная, швы-«фальцы», трубы
    const slate = (x0, x1, y0, y1, inset) => {
      g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0 + inset, y0); g.lineTo(x1 - inset, y0); g.lineTo(x1, y1); g.closePath();
      g.fillStyle = A.linG(g, 0, y0, 0, y1, [[0, '#5b6e64'], [1, '#3e4d46']]); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(15,30,25,0.34)'; g.lineWidth = 1.3;
      for (let x = x0; x < x1; x += 11) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x - (y1 - y0) * 0.3, y1); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.1)'; for (let y = y0 + 8; y < y1; y += 9) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      A.grain(g, x0, y0, x1 - x0, y1 - y0, 0.16, 'overlay', 12);
      g.restore(); g.lineWidth = 3; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    };
    slate(-HALF - 8, HALF + 8, -WING - 62, -WING - 14, 54);
    slate(-300, 300, -CEN - 78, -CEN - 16, 70);
    for (const hx of [-640, -470, 470, 640]) { A.wood(g, hx - 10, -WING - 78, 20, 40, { base: '#a8553d', seed: Math.abs(hx), dir: 'h', lineGap: 6, knots: false, grain: 0.2 }); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(hx - 10, -WING - 78, 20, 40); A.box(g, hx - 13, -WING - 82, 26, 6, { fill: '#d8ccbc', lw: 2.2 }); }
    // ---- стены: крылья и средний корпус одной краской, пятна и зерно
    A.plaster(g, -HALF, -WING, HALF * 2, WING, [[0, wallA], [1, wallB]], { seed: 21, grain: 0.15 });
    A.plaster(g, -CEN, -CEN, CEN * 2, CEN - WING + 2, [[0, wallA], [1, wallA]], { seed: 22, grain: 0.15 });
    g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-HALF, 0); g.lineTo(-HALF, -WING); g.lineTo(-CEN, -WING); g.lineTo(-CEN, -CEN); g.lineTo(CEN, -CEN); g.lineTo(CEN, -WING); g.lineTo(HALF, -WING); g.lineTo(HALF, 0); g.stroke();
    // рустовка первого этажа (тонкие швы) и угловые «кирпичи» на концах крыльев
    g.save(); g.beginPath(); g.rect(-HALF, -140, HALF * 2, 106); g.clip();
    for (let y = -140 + 17.7; y < -34; y += 17.7) { g.fillStyle = 'rgba(70,14,10,0.14)'; g.fillRect(-HALF, y, HALF * 2, 1.8); g.fillStyle = 'rgba(255,200,170,0.1)'; g.fillRect(-HALF, y + 1.8, HALF * 2, 1.4); }
    g.restore();
    for (const sd of [-1, 1]) for (let y = -WING + 22, i = 0; y < -40; y += 26, i++) { const qx = sd < 0 ? -HALF : HALF - 22; g.fillStyle = i % 2 ? 'rgba(255,200,170,0.16)' : 'rgba(70,14,10,0.1)'; g.fillRect(qx, y, 22, 26); g.strokeStyle = 'rgba(43,26,32,0.32)'; g.lineWidth = 1.2; g.strokeRect(qx, y, 22, 26); }
    // потёки и копоть под подоконниками, неровности окраски
    for (let i = 0; i < 40; i++) { const sx = R.range(-HALF + 20, HALF - 20); g.fillStyle = 'rgba(70,16,10,' + R.range(0.03, 0.07).toFixed(3) + ')'; g.fillRect(sx, -WING + R.range(30, 160), R.range(3, 7), R.range(30, 90)); }
    // ---- цоколь: тёмный камень, рустовка, подвальные окошки
    A.gradV(g, -HALF, -34, HALF * 2, 34, [[0, '#8c6f62'], [1, '#6a5248']]);
    g.strokeStyle = 'rgba(40,24,20,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-HALF, -17); g.lineTo(HALF, -17); g.stroke();
    for (let x = -HALF + 30; x < HALF; x += 58) { g.beginPath(); g.moveTo(x, -34); g.lineTo(x, -17); g.moveTo(x + 29, -17); g.lineTo(x + 29, 0); g.stroke(); }
    A.grain(g, -HALF, -34, HALF * 2, 34, 0.2, 'overlay', 6);
    g.fillStyle = 'rgba(255,230,210,0.28)'; g.fillRect(-HALF, -34, HALF * 2, 3);
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(-HALF, -34, HALF * 2, 34);
    // ---- междуэтажный пояс и карниз
    const belt = (y, h, x0, x1) => { A.box(g, x0, y, x1 - x0, h, { fill: '#a43a2c', lw: 2.6, hi: 'rgba(255,200,170,0.3)', lo: 'rgba(40,6,4,0.35)' }); };
    belt(-150, 12, -HALF - 4, HALF + 4);
    // ---- окна крыльев: два этажа с арками; бок-пилястры на концах
    const bays = [];
    for (let k = 0; k < 7; k++) { bays.push(335 + k * 62); }
    for (const side of [-1, 1]) for (const bx of bays) {
      const wx = side * bx;
      archWin(g, wx, -50, 30, 74, { frame, glass, curtain: R.chance(0.3) });
      archWin(g, wx, -170, 30, 64, { frame, glass, curtain: R.chance(0.3) });
    }
    for (const side of [-1, 1]) {                                         // боковые ризалиты: лёгкие пилястры, светлее стены
      for (const px of [side * 704, side * 768]) { g.fillStyle = A.linG(g, px - 8, 0, px + 8, 0, [[0, 'rgba(255,210,180,0.22)'], [1, 'rgba(60,10,6,0.18)']]); g.fillRect(px - 8, -WING + 14, 16, WING - 48); g.strokeStyle = 'rgba(43,26,32,0.5)'; g.lineWidth = 1.6; g.strokeRect(px - 8, -WING + 14, 16, WING - 48); }
    }
    // ---- средний корпус: окна по бокам портика и чердачные
    for (const side of [-1, 1]) { archWin(g, side * 262, -50, 30, 74, { frame, glass }); archWin(g, side * 262, -170, 30, 64, { frame, glass }); }
    // ---- карнизы с зубчиками (тёмный красно-серый)
    const cornice = (x0, x1, y, h) => {
      A.box(g, x0, y - h, x1 - x0, h, { fill: '#7a3a30', lw: 2.8, hi: 'rgba(255,190,160,0.26)', lo: 'rgba(30,6,6,0.3)' });
      g.fillStyle = 'rgba(30,10,10,0.45)'; for (let x = x0 + 5; x < x1 - 4; x += 10) g.fillRect(x, y, 5.5, 6);
      g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(x0 + 1, y, x1 - x0 - 2, 6);
      { const e0 = Math.max(x0, -HALF), e1 = Math.min(x1, HALF); A.edge(g, e0, y + 6, e1 - e0, 26, 't', 26, 'rgba(50,8,6,0.3)'); }                    // тень под карнизом — только на стене: карниз выступает на 10 юн. за торец, и тень висела там в воздухе
    };
    cornice(-HALF - 10, -CEN + 4, -WING, 22); cornice(CEN - 4, HALF + 10, -WING, 22); cornice(-CEN - 6, CEN + 6, -CEN, 22);
    // ---- портик: тёмная ниша, дверь, боковые двери, площадка и ступени
    const PX = 214;                                                       // полуширина портика (по антаблементу ±226)
    A.plaster(g, -PX + 6, -CEN + 22, (PX - 6) * 2, CEN - 22 - 34, [[0, '#8e2c22'], [1, '#6e2019']], { seed: 5, grain: 0.12 });
    A.edge(g, -PX + 6, -CEN + 22, (PX - 6) * 2, 60, 't', 60, 'rgba(20,2,2,0.5)');
    for (const side of [-1, 1]) { archWin(g, side * 128, -50, 30, 74, { frame: '#e8d9c0', glass }); archWin(g, side * 128, -170, 30, 64, { frame: '#e8d9c0', glass }); }
    // главная дверь: двустворчатая, дерево, фрамуга
    A.box(g, -34, -140, 68, 106, { fill: '#e8d9c0', lw: 3 });
    A.wood(g, -29, -135, 58, 101, { base: '#5a3a28', seed: 33, dir: 'v', knots: false, grain: 0.16, lineGap: 9 });
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, -135); g.lineTo(0, -34); g.moveTo(-29, -108); g.lineTo(29, -108); g.stroke();
    g.fillStyle = 'rgba(170,200,226,0.55)'; g.fillRect(-27, -133, 25, 23); g.fillRect(2, -133, 25, 23); g.strokeRect(-27, -133, 25, 23); g.strokeRect(2, -133, 25, 23);
    g.fillStyle = '#d9b45a'; for (const dx of [-7, 7]) { g.beginPath(); g.arc(dx, -74, 2.6, 0, 6.283); g.fill(); }
    // антаблемент: архитрав, фриз со строкой букв, карниз
    A.box(g, -PX - 12, -CEN + 4, (PX + 12) * 2, 20, { fill: '#8a352b', lw: 2.8, hi: 'rgba(255,190,160,0.22)' });
    A.box(g, -PX - 12, -CEN - 18, (PX + 12) * 2, 22, { fill: '#c0432f', lw: 2.8 });
    A.grain(g, -PX - 10, -CEN - 16, (PX + 10) * 2, 18, 0.14, 'overlay', 3);
    g.fillStyle = 'rgba(244,224,184,0.78)';                               // строка надписи: ровный ряд коротких штрихов, как мелкая гравировка
    for (let x = -PX + 16; x < PX - 16; x += 8) { if (((x + 400) / 8 | 0) % 6 === 5) continue; g.fillRect(x, -CEN - 13, 3.2, R.chance(0.5) ? 9 : 7); }
    A.box(g, -PX - 18, -CEN - 30, (PX + 18) * 2, 14, { fill: '#7a3a30', lw: 2.8, hi: 'rgba(255,190,160,0.24)' });
    // колонны
    for (const cxx of [-190, -114, -38, 38, 114, 190]) column(g, cxx, -CEN + 4, -34, { cap: '#403c46' });
    // площадка и ступени (серо-розовый гранит)
    const steps = [[246, 34, 8], [258, 26, 9], [270, 17, 9], [282, 8, 8]];
    for (const [hw, y, h] of steps) { A.box(g, -hw, -y, hw * 2, h, { fill: '#b7a59d', lw: 2.6, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(60,30,30,0.25)' }); }
    A.grain(g, -282, -34, 564, 34, 0.18, 'overlay', 9);
    // фронтон: красный, простой, с тонким обрамлением; конёк с акротерием
    g.beginPath(); g.moveTo(-PX - 22, -CEN - 30); g.lineTo(0, -CEN - 96); g.lineTo(PX + 22, -CEN - 30); g.closePath();
    g.fillStyle = A.linG(g, 0, -CEN - 96, 0, -CEN - 30, [[0, '#b83e2e'], [1, '#a23528']]); g.fill(); g.lineWidth = 3.4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(-PX - 4, -CEN - 34); g.lineTo(0, -CEN - 86); g.lineTo(PX + 4, -CEN - 34); g.strokeStyle = 'rgba(255,200,170,0.28)'; g.lineWidth = 2; g.stroke();
    g.save(); g.beginPath(); g.moveTo(-PX - 22, -CEN - 30); g.lineTo(0, -CEN - 96); g.lineTo(PX + 22, -CEN - 30); g.closePath(); g.clip(); A.grain(g, -PX - 22, -CEN - 96, (PX + 22) * 2, 70, 0.16, 'overlay', 14); A.edge(g, -PX - 22, -CEN - 96, 60, 70, 'l', 60, 'rgba(255,200,170,0.1)'); g.restore();
    // общий свет: левее светлее, правее темнее; тень у земли
    g.save(); g.globalCompositeOperation = 'source-atop';                                              // только по нарисованному: небо над крыльями не тонируется
    g.fillStyle = A.linG(g, -HALF, 0, HALF, 0, [[0, 'rgba(255,214,176,0.12)'], [0.5, 'rgba(255,214,176,0)'], [1, 'rgba(50,8,6,0.16)']]); g.fillRect(-HALF, -CEN - 10, HALF * 2, CEN + 10);
    A.edge(g, -HALF, -70, HALF * 2, 70, 'b', 70, 'rgba(30,8,6,0.22)');
    g.restore();
    g.restore();
  }

  // Памятник на красном граните в кольце подстриженной зелени: малый силуэт «мужчина в пальто», без лица. base — линия земли у подножия.
  function monument(g, x, base, s) {
    g.save(); g.translate(x, base); g.scale(s, s);
    // холм и кольцо живой изгороди (задняя половина)
    g.fillStyle = '#6fb050'; g.beginPath(); g.ellipse(0, -4, 78, 14, 0, 0, 6.283); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = A.linG(g, 0, -18, 0, 4, [[0, '#4a9a46'], [1, '#2f7a3c']]); g.beginPath(); g.ellipse(0, -8, 66, 10, 0, 0, 6.283); g.fill();
    // постамент: ступени, дадо, карниз
    const red = ['#9c4036', '#7a2e28'];
    A.box(g, -34, -14, 68, 8, { fill: '#a89690', lw: 2.4, hi: 'rgba(255,255,255,0.4)' }); A.box(g, -28, -22, 56, 8, { fill: '#b6a49e', lw: 2.4, hi: 'rgba(255,255,255,0.4)' });
    g.fillStyle = A.linG(g, -20, 0, 20, 0, [[0, '#b8504a'], [0.4, red[0]], [1, red[1]]]); g.fillRect(-20, -86, 40, 64); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(-20, -86, 40, 64);
    g.fillStyle = 'rgba(255,230,210,0.28)'; g.fillRect(-17, -82, 4, 56); g.fillStyle = '#e2d4a8'; g.fillRect(-9, -66, 18, 10); g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 1.4; g.strokeRect(-9, -66, 18, 10);
    A.box(g, -25, -94, 50, 9, { fill: '#a8463c', lw: 2.4, hi: 'rgba(255,220,200,0.34)' });
    // фигура: длинное пальто, чуть склонённая голова
    const br = '#35524a', br2 = '#587a6c';
    g.beginPath(); g.moveTo(-14, -94); g.quadraticCurveTo(-16, -114, -11, -134); g.lineTo(-8, -142); g.quadraticCurveTo(0, -148, 8, -142); g.lineTo(11, -134); g.quadraticCurveTo(16, -114, 14, -94); g.closePath();
    g.fillStyle = A.linG(g, -16, 0, 16, 0, [[0, br2], [0.4, br], [1, '#243a34']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
    g.beginPath(); g.arc(1, -152, 7.4, 0, 6.283); g.fillStyle = br; g.fill(); g.stroke();
    g.fillStyle = 'rgba(180,220,200,0.35)'; g.fillRect(-11, -132, 2.6, 34);
    g.beginPath(); g.moveTo(8, -134); g.quadraticCurveTo(14, -122, 6, -112); g.strokeStyle = 'rgba(20,34,30,0.8)'; g.lineWidth = 2; g.stroke();     // рука на отвороте
    // передняя половина кольца изгороди
    g.save(); g.beginPath(); g.rect(-90, -4, 180, 30); g.clip();
    g.lineWidth = 12; g.strokeStyle = OUT; g.beginPath(); g.ellipse(0, -4, 70, 13, 0, 0, Math.PI); g.stroke();
    g.lineWidth = 7; g.strokeStyle = '#3f8a40'; g.beginPath(); g.ellipse(0, -5, 70, 13, 0, 0, Math.PI); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(190,240,140,0.5)'; g.beginPath(); g.ellipse(0, -8, 70, 13, 0, 0.1, Math.PI - 0.1); g.stroke();
    g.restore();
    g.restore();
  }

  // Крошечные фигурки гуляющих вдали: рост ≈ h, силуэт с тёмным контуром
  function walker(g, x, base, h, body, seed) {
    const R = A.rng(seed), w = h * 0.3;
    g.lineWidth = Math.max(1.2, h * 0.06); g.strokeStyle = OUT; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - w * 0.22, base - h * 0.42); g.lineTo(x - w * 0.3, base); g.moveTo(x + w * 0.22, base - h * 0.42); g.lineTo(x + w * 0.3, base); g.stroke();
    g.beginPath(); g.moveTo(x - w * 0.5, base - h * 0.42); g.quadraticCurveTo(x - w * 0.58, base - h * 0.78, x - w * 0.34, base - h * 0.84); g.lineTo(x + w * 0.34, base - h * 0.84); g.quadraticCurveTo(x + w * 0.58, base - h * 0.78, x + w * 0.5, base - h * 0.42); g.closePath();
    g.fillStyle = body; g.fill(); g.stroke();
    g.beginPath(); g.arc(x, base - h * 0.93, h * 0.1, 0, 6.283); g.fillStyle = R.pick(['#e8c4a0', '#d8a888', '#f0d0b0']); g.fill(); g.stroke();
  }

  // Крошечная машина вдали (вид сбоку, смотрит вправо): кузов, окна, колёса. L — длина.
  function farCar(g, x, base, L, body) {
    const s = L / 100;
    g.save(); g.translate(x, base); g.scale(s, s); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-50, -4); g.lineTo(-50, -16); g.quadraticCurveTo(-44, -20, -34, -22); g.lineTo(-22, -34); g.quadraticCurveTo(-18, -37, -10, -37); g.lineTo(14, -37); g.quadraticCurveTo(22, -36, 28, -26); g.lineTo(36, -22); g.quadraticCurveTo(50, -20, 50, -12); g.lineTo(50, -4); g.closePath();
    g.fillStyle = body; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(170,200,222,0.85)'; g.beginPath(); g.moveTo(-18, -24); g.lineTo(-12, -33); g.lineTo(12, -33); g.lineTo(24, -24); g.closePath(); g.fill(); g.lineWidth = 2; g.stroke();
    for (const wx of [-30, 30]) { g.fillStyle = OUT; g.beginPath(); g.arc(wx, -4, 9, 0, 6.283); g.fill(); g.fillStyle = '#b8bac6'; g.beginPath(); g.arc(wx, -4, 3.6, 0, 6.283); g.fill(); }
    g.restore();
  }

  // Мощение: плиты рядами (выше к зрителю), швы скошены — читается как пол, а не как стена; красно-розовые вставки «ёлочкой» через равные промежутки.
  function paving(g, x0, y0, w, h, o) {
    o = o || {};
    const R = A.rng(o.seed || 7), SH = 0.36, tones = ['#d6cdbe', '#cec4b3', '#dcd4c6', '#c8bead', '#d2c8b7'];
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    g.transform(1, 0, SH, 1, -SH * y0, 0);
    const xa = x0 - SH * h - 24, xb = x0 + w + 24;
    g.fillStyle = 'rgba(86,66,56,0.55)'; g.fillRect(xa, y0, xb - xa, h);
    let rh = o.row0 || 8.5;
    for (let y = y0, row = 0; y < y0 + h; row++) {
      const hh = Math.min(rh, y0 + h - y), sw = 50 + row * 6.5;
      for (let x = xa - (row % 2) * sw / 2 - R.range(0, 10); x < xb; x += sw) {
        const bx = x + 1.3, bw = sw - 2.6;
        g.fillStyle = R.pick(tones); g.fillRect(bx, y + 1.3, bw, hh - 2.6);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(bx, y + 1.3, bw, Math.min(2.4, hh * 0.3)); g.fillStyle = 'rgba(70,50,40,0.1)'; g.fillRect(bx, y + hh - 4.4, bw, 2);
        if (R.chance(0.14)) { g.fillStyle = 'rgba(120,90,70,0.12)'; g.fillRect(bx, y + 1.3, bw, hh - 2.6); }
        if (R.chance(0.05)) { g.strokeStyle = 'rgba(70,50,40,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx + bw * R.range(0.2, 0.8), y + 2); g.lineTo(bx + bw * R.range(0.2, 0.8), y + hh - 2); g.stroke(); }
      }
      y += hh; rh += o.grow === undefined ? 1.15 : o.grow;
    }
    // вставки «ёлочкой»: красно-розовый кирпич, рамка из тёмного гранита
    for (const bx of (o.band || [])) {
      const bw = 104;
      g.fillStyle = 'rgba(54,22,18,0.7)'; g.fillRect(bx - 4, y0, bw + 8, h);
      let bh = 7.5;
      for (let y = y0; y < y0 + h; ) {
        const hh = Math.min(bh, y0 + h - y);
        for (let x = bx + 2, c = 0; x < bx + bw - 2; x += 13, c++) {
          const sk = (c % 2 ? -1 : 1) * 4.6, w2 = Math.min(12, bx + bw - 2 - x);
          g.fillStyle = R.pick(['#c0806e', '#b4705e', '#cb907c', '#a96453', '#d49c88']);
          g.beginPath(); g.moveTo(x, y + 0.8); g.lineTo(x + w2, y + 0.8); g.lineTo(x + w2 + sk, y + hh - 0.8); g.lineTo(x + sk, y + hh - 0.8); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,240,230,0.2)'; g.fillRect(x + 1, y + 0.8, w2 - 1, 1.5);
        }
        y += hh; bh += 1.05;
      }
      g.strokeStyle = 'rgba(40,14,10,0.8)'; g.lineWidth = 2.2; g.strokeRect(bx - 4, y0, bw + 8, h);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(bx - 2, y0, 1.6, h);
    }
    // травинки в швах
    g.lineWidth = 1.4; g.lineCap = 'round';
    for (let i = 0; i < w / 60; i++) { const gx = x0 + R.range(0, w), gy = y0 + R.range(6, h - 4); g.strokeStyle = 'rgba(86,140,70,0.8)'; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - 2, gy - R.range(3, 6)); g.moveTo(gx, gy); g.lineTo(gx + 2, gy - R.range(4, 7)); g.stroke(); }
    g.restore();
    A.grain(g, x0, y0, w, h, 0.18, 'overlay', o.seed || 7, 0.55);
  }

  // =================================================================== парк
  // Раскладка слоёв: дальний (корпус, памятник, туи, гуляющие; параллакс 0,3) и средний (деревья, изгороди, клумбы, дальние фонари; параллакс 0,6) — только полосы высотой 500–520 юн.,
  // чтобы не растить память; небо — слой облаков (параллакс 0,1); земля — мощение в мировых координатах.
  const FAR_Y = 100, FAR_H = 500, MID_Y = 80, MID_H = 520;

  KA.parkLayers = function (game, WIDTH, X) {
    const farW = (WIDTH - 1280) * 0.3 + 1700, midW = (WIDTH - 1280) * 0.6 + 1700, skyW = (WIDTH - 1280) * 0.1 + 1700;
    const sky = skyLayer(skyW, 340, 5, skyW * 0.3);
    // ---- дальний слой
    const far = A.layer(farW, FAR_H, (g, w) => {
      g.translate(0, -FAR_Y);
      const base = 524, cx = 790;
      // площадь перед корпусом: светлое мощение, тёмная кромка газона
      A.gradV(g, 0, base - 6, w, 600 - base + 6, [[0, '#d8cdbd'], [1, '#c8bba8']]);
      g.strokeStyle = 'rgba(80,60,50,0.2)'; g.lineWidth = 1.4; for (let y = base + 10; y < 600; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = A.linG(g, 0, base, 0, base + 76, [[0, 'rgba(176,96,82,0.32)'], [1, 'rgba(176,96,82,0.1)']]); g.beginPath(); g.moveTo(cx - 70, base); g.lineTo(cx + 70, base); g.lineTo(cx + 150, base + 76); g.lineTo(cx - 150, base + 76); g.closePath(); g.fill();
      redBuilding(g, cx, base, {});
      // тени дальних деревьев на фасаде: мягкие тёмные пятна только по нарисованному
      g.save(); g.globalCompositeOperation = 'source-atop';
      for (const [sx, sy, rx, ry] of [[250, 400, 150, 130], [520, 410, 130, 120], [1100, 405, 140, 120], [1290, 400, 150, 130], [1640, 405, 140, 125]]) { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rx); gr.addColorStop(0, 'rgba(70,24,20,0.2)'); gr.addColorStop(1, 'rgba(70,24,20,0)'); g.save(); g.translate(sx, sy); g.scale(1, ry / rx); g.translate(-sx, -sy); g.fillStyle = gr; g.fillRect(sx - rx, sy - rx, rx * 2, rx * 2); g.restore(); }
      g.restore();
      // дымка на всё, что нарисовано (корпус, площадь)
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(226,238,242,0.16)'; g.fillRect(0, FAR_Y, w, FAR_H); g.globalCompositeOperation = 'source-over';
      monument(g, cx, base + 26, 1.0);
      // дальние деревья: туи и лиственные в дымке, по краям корпуса
      const hz = (P) => hazed(P, 0.34, '#cfe2e6'), hl = mix(OUT, '#aebfc6', 0.4);
      for (const [x, h, sd] of [[70, 280, 3], [150, 230, 4], [330, 260, 5], [1330, 250, 6], [1420, 290, 7], [1500, 230, 8], [1690, 270, 9], [1790, 240, 10], [1900, 280, 11]]) thuja(g, x, base + 22, 0.8, sd, { h, w: 40, pal: hz(DEEP), line: hl });
      for (const [x, s, sd, p] of [[250, 0.78, 12, LEAF], [520, 0.7, 13, LIME], [1100, 0.72, 14, LEAF], [1260, 0.8, 15, LIME], [1620, 0.8, 16, LEAF], [1880, 0.74, 17, LIME]]) broadleaf(g, x, base + 28, s, sd, { pal: hz(p), line: hl, trunk: 110 });
      // машины у корпуса и гуляющие
      farCar(g, 1190, base + 56, 46, '#e8e4dc'); farCar(g, 1245, base + 52, 42, '#3f5f86'); farCar(g, 505, base + 58, 44, '#a64a42');
      for (const [x, h, c, sd] of [[620, 25, '#5a7aa8', 1], [668, 22, '#d6aa56', 2], [905, 26, '#b86a7a', 3], [958, 23, '#4f7a5a', 4], [1010, 25, '#8a6aa0', 5]]) walker(g, x, base + 36 + (sd % 2) * 8, h, c, sd);
      A.edge(g, 0, 460, w, 140, 'b', 140, 'rgba(236,244,236,0.5)');                  // воздух у горизонта
    }, dens(1.7));
    // ---- средний слой
    const mid = A.layer(midW, MID_H, (g, w) => {
      g.translate(0, -MID_Y);
      const base = 594;
      for (const [x, s, sd, kind] of [[130, 1.05, 21, 0], [470, 0.95, 22, 1], [1290, 1.1, 23, 0], [1640, 1.0, 24, 1], [1960, 1.08, 25, 0], [2260, 1.0, 26, 1]]) { A.shadow(g, x, base + 2, 120 * s, 0.24); broadleaf(g, x, base, s, sd, { pal: kind ? LIME : LEAF, trunk: 120, rx: 124, ry: 112 }); }
      for (const [x, h, sd] of [[320, 260, 31], [650, 235, 32], [1150, 270, 33], [1480, 245, 34], [1790, 255, 35]]) thuja(g, x, base - 2, 1.0, sd, { h, w: 46 });
      for (let x = -40, i = 0; x < w; x += 250 + (i % 3) * 40, i++) { hedge(g, x, base, 210 + (i % 2) * 40, 40 + (i % 3) * 8, 40 + i); }
      for (let x = 60, i = 0; x < w; x += 330 + (i % 2) * 90, i++) flowers(g, x, base + 2, 130, 70 + i);
      for (const lx of [80, 2080]) lamp(g, lx, base - 4, 0.62);               // дальние фонари — только на краях: в середине они бы выглядывали из-за фонтана «плавающими шарами»
    }, dens(1.6));
    // ---- земля: мощение, красная гранитная кромка у газона
    const ground = A.layer(WIDTH, 720 - WALL + 12, (g, w, h) => {
      paving(g, 0, 13, w, h - 13, { seed: 7, band: [300, 1580] });                  // красные вставки «ёлочкой» — вдали от круглой площадки фонтана
      plazaRings(g, X.fountain, WALL + 10 + FN.DY - FN_RY - (WALL - 4));          // кольца брусчатки вокруг чаши: лежат на земле под ней (чаша на переднем плане), видны ниже кромки
      A.gradV(g, 0, 13, w, h - 13, [[0, 'rgba(40,24,20,0.28)'], [0.25, 'rgba(40,24,20,0)'], [1, 'rgba(255,240,210,0.08)']]);
      // тени крон на мощении: мягкие листовые пятна под деревьями переднего плана, солнечные просветы между ними
      for (const tx of [X.trees[0], X.trees[2]]) {
        const R = A.rng(Math.round(tx));
        for (let i = 0; i < 30; i++) { const a = R.range(0, 6.283), d = Math.sqrt(R.next()); g.fillStyle = 'rgba(28,54,44,' + R.range(0.07, 0.14).toFixed(3) + ')'; g.beginPath(); g.ellipse(tx + 20 + Math.cos(a) * 160 * d, 34 + Math.sin(a) * 28 * d, R.range(10, 28), R.range(3, 8), 0, 0, 6.283); g.fill(); }
      }
      const RL = A.rng(15);                                                  // опавшие листья и лепестки на плитах
      for (let i = 0; i < 46; i++) { const lx = RL.next() < 0.6 ? X.trees[RL.pick([0, 2])] + RL.range(-170, 190) : RL.range(0, w); g.save(); g.translate(lx, RL.range(24, h - 12)); g.rotate(RL.range(0, 6.283)); g.fillStyle = RL.pick(['rgba(138,170,70,0.85)', 'rgba(196,176,60,0.85)', 'rgba(232,150,170,0.8)']); g.beginPath(); g.ellipse(0, 0, RL.range(2.6, 4.6), RL.range(1.3, 2.2), 0, 0, 6.283); g.fill(); g.restore(); }
      // кромка: красный гранит
      A.gradV(g, 0, 0, w, 14, [[0, '#a85246'], [0.3, '#8a4036'], [1, '#6a3028']]);
      for (let x = 70; x < w; x += 110) { g.fillStyle = 'rgba(30,10,8,0.5)'; g.fillRect(x, 3, 2, 11); }
      g.fillStyle = 'rgba(255,210,190,0.35)'; g.fillRect(0, 3, w, 2.4); A.grain(g, 0, 0, w, 14, 0.22, 'overlay', 11, 0.5);
      g.fillStyle = OUT; g.fillRect(0, 0, w, 3); g.fillRect(0, 13, w, 2);
    }, dens(1.5));
    FT = buildFountain();                                          // спрайты фонтана — вместе с остальными слоями сцены (освобождаются при уходе)
    return { far, mid, ground, sky };
  };

  KA.parkBack = function (ctx, cam, game, sc, L) { backdrop(ctx, cam, game, L); };

  // =================================================================== фонтан
  // Низкая широкая круглая чаша из тёмного полированного гранита, без ярусов и без колонны (по фото владельца: парк перед красным корпусом КНУ). Борт — широкий обод из плит с розово-красными
  // швами, внутри невысокая вода; из центра бьёт одна тонкая высокая струя, а от борта внутрь идёт круг невысоких дуг, как в «душе». Вокруг чаши — круглая площадка из брусчатки колец разного тона,
  // она лежит в плоскости земли (рисуется в слое земли, см. plazaRings). Неподвижное (чаша, вода) собрано в один спрайт; живое — струя, дуги, круги по воде, капли — рисуется каждый кадр.
  // Начало координат фонтана — (x, wall + 10 + FN.DY) = (x, 694): ближняя к зрителю точка основания чаши НА БРУСЧАТКЕ. Чаша на переднем плане (владелец 03.10.2026: «фонтан стоит на бордюре и парит — пусть наши
  // герои ходят ЗА ним»): дальний край основания (694 − 2·41 = 611) лежит ниже линии ходьбы героев (600), красная кромка газона (y 580–594) проходит позади чаши, у её борта; сцена рисует фонтан с z выше героев
  // (kyiv_park.js), поэтому проходящий за чашей виден по пояс, а Бубел — только вне её ширины. Кольца площадки (plazaRings) лежат под основанием.
  const FN = { RX: 230, Q: 0.18, H: 60, COP: 30, LIP: 13, DROP: 11, JETS: 8, JET_H: 205, DY: 100 };
  const FN_RY = FN.RX * FN.Q, FN_CB = -FN_RY, FN_CT = FN_CB - FN.H, FN_RI = FN.RX - FN.COP, FN_WY = FN_CT + FN.DROP;       // центры нижнего и верхнего эллипсов, внутренний радиус обода, уровень воды
  const FT_W = 520, FT_H = 168, FT_OX = 260, FT_OY = 150;
  let FT = null;

  // Площадка вокруг чаши: кольца брусчатки разных тонов в плоскости земли (у подножия — тот же наклон эллипса, что у чаши, дальше кольца чуть «раздуваются» к зрителю, чтобы полосы
  // читались), у чаши — узкая каёмка из красного гранита. Чаша стоит НА этой площадке (владелец 03.10.2026: «фонтан стоит на бордюре и парит»): основание чаши лежит на 100 юн. ниже линии героев,
  // а внешнее кольцо (r = 334) не заходит под кромку газона нигде, кроме мест позади самой чаши, — дуги колец не обрываются о бордюр. Рисуется в слое земли (ниже кромки, y ≥ 594).
  function plazaRings(g, cx, cy) {
    const R = A.rng(77), Q = FN.Q, TAU = 6.283185, ry = (r) => r * Q + 0.12 * Math.max(0, r - 246), pt = (r, a) => [cx + r * Math.cos(a), cy + ry(r) * Math.sin(a)];
    const rings = [
      { r0: 226, r1: 246, tones: ['#9a4f4e', '#8c4545', '#a65a5a'], cw: 24 },
      { r0: 246, r1: 288, tones: ['#6b5f72', '#615568', '#75697c', '#5b5063'], cw: 17 },
      { r0: 288, r1: 322, tones: ['#b8aaa8', '#ada09f', '#c3b7b3', '#a89a9a'], cw: 19 },
      { r0: 322, r1: 334, tones: ['#8a5a58', '#7e504f', '#97665f'], cw: 22 },
    ];
    const loop = (r, a0, a1, m, first) => { for (let k = 0; k <= m; k++) { const [x, y] = pt(r, a0 + (a1 - a0) * k / m); if (first && !k) g.moveTo(x, y); else g.lineTo(x, y); } };
    g.fillStyle = 'rgba(58,38,46,0.92)'; g.beginPath(); loop(336, 0, TAU, 72, true); g.closePath(); g.fill();                 // раствор между камнями
    rings.forEach((rg, ri) => {
      const n = Math.round(TAU * (rg.r0 + rg.r1) / 2 / rg.cw);
      for (let i = 0; i < n; i++) {
        const a0 = i * TAU / n + 0.004, a1 = (i + 1) * TAU / n - 0.004;
        g.beginPath(); loop(rg.r1 - 0.9, a0, a1, 3, true); loop(rg.r0 + 0.9, a1, a0, 3, false); g.closePath();
        g.fillStyle = R.pick(rg.tones); g.fill();
        if (ri === 1 || ri === 2) { g.fillStyle = 'rgba(255,255,255,0.13)'; g.beginPath(); loop(rg.r1 - 0.9, a0, a1, 3, true); loop(rg.r1 - 5, a1, a0, 3, false); g.closePath(); g.fill(); }
      }
    });
    for (const [r, c] of [[246, 'rgba(40,18,22,0.5)'], [335, 'rgba(40,24,28,0.55)']]) { g.strokeStyle = c; g.lineWidth = 1.8; g.beginPath(); loop(r, 0, TAU, 96, true); g.closePath(); g.stroke(); }        // края каёмки и площадки
  }

  // Один шаг по кольцу плит: сектор между радиусами r0 и r1 на эллипсах обода (центр (0, cy), вертикальный масштаб Q)
  function ringSector(g, cy, Q, r0, r1, a0, a1) {
    g.beginPath(); g.ellipse(0, cy, r1, r1 * Q, 0, a0, a1); g.lineTo(r0 * Math.cos(a1), cy + r0 * Q * Math.sin(a1)); g.ellipse(0, cy, r0, r0 * Q, 0, a1, a0, true); g.closePath();
  }

  function drawBowl(g) {
    const RX = FN.RX, Q = FN.Q, RY = FN_RY, CB = FN_CB, CT = FN_CT, RI = FN_RI, RIY = RI * Q, WY = FN_WY, NS = 28, LIP = FN.LIP, R = A.rng(31);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // мягкая тень на земле, чуть вправо (свет сверху-слева)
    for (const [k, a] of [[1, 0.1], [0.88, 0.12], [0.76, 0.15]]) { g.fillStyle = 'rgba(30,14,22,' + a + ')'; g.beginPath(); g.ellipse(10, CB + 3, (RX + 16) * k, (RY + 3) * k, 0, 0, 6.283); g.fill(); }          // мягкая тень: ниже пола (y = 600) не уходит
    // ---- боковина: тёмный красно-коричневый гранит, свет слева, зерно полировки
    const wall = () => { g.beginPath(); g.moveTo(-RX, CT); g.lineTo(-RX, CB); g.ellipse(0, CB, RX, RY, 0, Math.PI, 0, true); g.lineTo(RX, CT); g.ellipse(0, CT, RX, RY, 0, 0, Math.PI); g.closePath(); };
    wall(); g.fillStyle = A.linG(g, -RX, 0, RX, 0, [[0, '#2e1619'], [0.1, '#4a2527'], [0.3, '#744039'], [0.44, '#5e312d'], [0.72, '#3b1e1f'], [1, '#231115']]); g.fill();
    g.save(); wall(); g.clip();
    for (let i = 0; i < 420; i++) { const px = R.range(-RX, RX), py = R.range(CT, CB + RY); g.fillStyle = R.chance(0.55) ? 'rgba(255,208,196,' + R.range(0.16, 0.42).toFixed(2) + ')' : 'rgba(8,0,4,' + R.range(0.2, 0.4).toFixed(2) + ')'; g.fillRect(px, py, R.range(0.8, 2.2), R.range(0.7, 1.6)); }
    for (let i = 0; i < 26; i++) { const px = R.range(-RX, RX), py = R.range(CT + LIP, CB + RY - 4); g.fillStyle = 'rgba(214,140,130,' + R.range(0.2, 0.4).toFixed(2) + ')'; g.fillRect(px, py, R.range(2, 4.2), R.range(1.2, 2.4)); }
    g.fillStyle = 'rgba(255,226,214,0.17)'; g.fillRect(-RX * 0.6, CT, 9, H_ALL()); g.fillRect(-RX * 0.47, CT, 3, H_ALL());                  // блик полировки
    A.gradV(g, -RX, CT, RX * 2, H_ALL(), [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(8,0,4,0.36)']]);
    A.edge(g, -RX, CT + LIP, RX * 2, 12, 't', 12, 'rgba(10,2,6,0.42)');                                                                  // тень под ободом
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(-RX, CT); g.lineTo(-RX, CB); g.ellipse(0, CB, RX, RY, 0, Math.PI, 0, true); g.lineTo(RX, CT); g.stroke();
    // ---- обод, передняя грань: почти чёрный камень, между плитами розово-красные швы
    const lip = () => { g.beginPath(); g.moveTo(RX, CT); g.ellipse(0, CT, RX, RY, 0, 0, Math.PI); g.lineTo(-RX, CT + LIP); g.ellipse(0, CT + LIP, RX, RY, 0, Math.PI, 0, true); g.closePath(); };
    lip(); g.fillStyle = A.linG(g, -RX, 0, RX, 0, [[0, '#2a1a22'], [0.28, '#4a3844'], [0.52, '#38282f'], [0.82, '#231720'], [1, '#1b1117']]); g.fill();
    g.save(); lip(); g.clip();
    for (let j = 1; j < NS / 2; j++) {
      const th = j * 2 * Math.PI / NS, sx = RX * Math.cos(th), sy = CT + RY * Math.sin(th), w = 7.5 * Math.sin(th);
      g.fillStyle = A.linG(g, sx - w / 2, 0, sx + w / 2, 0, [[0, '#c0747a'], [0.5, '#a4585f'], [1, '#783a42']]); g.fillRect(sx - w / 2, sy - 1, w, LIP + 3);
      g.fillStyle = 'rgba(255,224,214,0.4)'; g.fillRect(sx - w / 2, sy - 1, Math.max(0.8, w * 0.22), LIP + 3);
    }
    g.fillStyle = 'rgba(255,240,236,0.1)'; g.fillRect(-RX * 0.7, CT, RX * 0.5, LIP + RY);
    g.restore();
    g.strokeStyle = 'rgba(14,4,8,0.9)'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, CT + LIP, RX, RY, 0, 0, Math.PI); g.stroke();
    // ---- обод, верхняя плоскость: плиты по кольцу, дальняя половина светлее (отражает небо)
    g.beginPath(); g.ellipse(0, CT, RX, RY, 0, 0, 6.283); g.moveTo(RI, CT); g.ellipse(0, CT, RI, RIY, 0, 0, 6.283, true);
    g.fillStyle = A.linG(g, 0, CT - RY, 0, CT + RY, [[0, '#9a7d7a'], [0.45, '#725759'], [1, '#4d363c']]); g.fill();
    for (let j = 0; j < NS; j++) {
      const a0 = j * 2 * Math.PI / NS, a1 = (j + 1) * 2 * Math.PI / NS, v = R.next();
      ringSector(g, CT, Q, RI, RX, a0, a1); g.fillStyle = v < 0.5 ? 'rgba(255,232,224,' + (0.02 + v * 0.14).toFixed(3) + ')' : 'rgba(10,2,6,' + (0.02 + (v - 0.5) * 0.2).toFixed(3) + ')'; g.fill();
    }
    for (let j = 0; j < NS; j++) {
      const a = j * 2 * Math.PI / NS, c = Math.cos(a), s = Math.sin(a);
      g.strokeStyle = 'rgba(24,10,14,0.72)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(RI * c, CT + RIY * s); g.lineTo(RX * c, CT + RY * s); g.stroke();
      g.strokeStyle = 'rgba(236,196,188,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(RI * c + 1.2, CT + RIY * s); g.lineTo(RX * c + 1.2, CT + RY * s); g.stroke();
    }
    g.strokeStyle = 'rgba(255,238,232,0.42)'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, CT + 0.6, RX - 6, RY - 1.6, 0, 3.55, 5.5); g.stroke();                // блик на дальней кромке
    g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.ellipse(0, CT, RX, RY, 0, 0, 6.283); g.stroke();
    // ---- внутри: стенка над водой и вода (на RIY выше — отражение неба и крон, у ближнего борта темнее)
    g.beginPath(); g.ellipse(0, CT, RI, RIY, 0, 0, 6.283); g.fillStyle = A.linG(g, 0, CT - RIY, 0, CT + RIY, [[0, '#84605c'], [0.3, '#4d3033'], [1, '#2a1a1e']]); g.fill();
    g.save(); g.clip();
    const wy = RIY + 1;
    g.beginPath(); g.ellipse(0, WY, RI + 1, wy, 0, 0, 6.283); g.fillStyle = A.linG(g, 0, WY - wy, 0, WY + wy, [[0, '#bcded8'], [0.22, '#82b9b6'], [0.55, '#4f8e92'], [1, '#2d6270']]); g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(44,92,70,0.34)'; for (const [dx, dy, rx, ry] of [[-120, -10, 62, 6], [-30, -14, 44, 5], [70, -12, 70, 6], [130, -6, 40, 4]]) { g.beginPath(); g.ellipse(dx, WY + dy, rx, ry, 0, 0, 6.283); g.fill(); }     // отражения крон
    g.fillStyle = 'rgba(240,250,252,0.34)'; g.beginPath(); g.ellipse(-40, WY - 4, 100, 5.5, 0, 0, 6.283); g.fill();
    A.gradV(g, -RI, WY + wy * 0.25, RI * 2, wy * 0.8, [[0, 'rgba(20,12,22,0)'], [1, 'rgba(20,12,22,0.42)']]);                           // тень ближнего борта
    g.restore();
    g.strokeStyle = 'rgba(28,14,16,0.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, WY, RI + 1, wy, 0, 3.4, 6.03); g.stroke();                 // кромка воды у дальней стенки
    g.strokeStyle = 'rgba(236,250,252,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, WY + 1.4, RI - 1, wy - 1, 0, 3.55, 5.9); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(20,6,10,0.92)'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, CT, RI, RIY, 0, 0, 6.283); g.stroke();
  }
  function H_ALL() { return FN.H + FN_RY; }

  function buildFountain() { return A.layer(FT_W, FT_H, (g) => { g.translate(FT_OX, FT_OY); drawBowl(g); }, dens(1.8)); }

  // Дуги: восемь невысоких струек от борта внутрь, падают в воду на 46–60 % радиуса. Парабола — это квадратичная кривая Безье, поэтому дуга рисуется одним вызовом
  const ARCS = [];
  for (let k = 0; k < FN.JETS; k++) {
    const phi = (k + 0.5) * 2 * Math.PI / FN.JETS + 0.2, rl = (0.46 + 0.07 * ((k * 5) % 3)) * FN_RI, r0 = FN_RI + 5, h = 30 + 7 * ((k * 3) % 4);
    const x0 = r0 * Math.cos(phi), y0 = FN_CT + r0 * FN.Q * Math.sin(phi) - 1.5, x1 = rl * Math.cos(phi), y1 = FN_WY + rl * FN.Q * Math.sin(phi);
    ARCS.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - 2 * h, ph: k * 0.37, far: Math.sin(phi) < 0 });
  }
  const ARC_FAR = ARCS.filter((a) => a.far), ARC_NEAR = ARCS.filter((a) => !a.far);

  function fountainArcs(ctx, t, list) {
    const k = 0.62 + 0.26 * Math.sin(t * 4.6 + list[0].ph * 9);
    ctx.beginPath(); for (const a of list) { ctx.moveTo(a.x0, a.y0); ctx.quadraticCurveTo(a.cx, a.cy, a.x1, a.y1); }
    ctx.strokeStyle = 'rgba(206,234,248,' + (k * 0.3).toFixed(3) + ')'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + k.toFixed(3) + ')'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath();                                          // по струйкам бегут капли
    for (const a of list) for (let m = 0; m < 3; m++) { const u = (t * 0.9 + a.ph + m / 3) % 1, v = 1 - u, x = v * v * a.x0 + 2 * u * v * a.cx + u * u * a.x1, y = v * v * a.y0 + 2 * u * v * a.cy + u * u * a.y1; ctx.moveTo(x + 1.5, y); ctx.arc(x, y, 1.5, 0, 6.283); }
    ctx.fill();
  }

  function fountainJet(ctx, t) {
    const WY = FN_WY, H = FN.JET_H, top = WY - H, sw = (u) => Math.sin(t * 2.3 + u * 2) * 1.3 * u + Math.sin(t * 7.1 + u * 11) * 0.5 * u;
    const body = (grow) => { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const u = i / 8; ctx.lineTo(sw(u) - (4.3 - 2.7 * u + grow), WY - H * u); } for (let i = 8; i >= 0; i--) { const u = i / 8; ctx.lineTo(sw(u) + (4.3 - 2.7 * u + grow), WY - H * u); } ctx.closePath(); };
    body(2.6); ctx.fillStyle = 'rgba(206,234,250,0.2)'; ctx.fill();
    body(0); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.1; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const u = i / 8; if (i) ctx.lineTo(sw(u), WY - H * u); else ctx.moveTo(sw(u), WY - H * u); } ctx.stroke();
    // вверху струя распадается на капли; у основания — пена и брызги
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const p = (t * 0.75 + i / 14) % 1, dir = i % 2 ? 1 : -1, sp = 5 + ((i * 7) % 5) * 3.4, x = sw(1) + dir * sp * p, y = top + 78 * p * p - 17 * p, r = 1.9 - p * 0.9;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.283);
    }
    for (let i = 0; i < 7; i++) { const p = (t * 1.1 + i * 0.31) % 1, dir = i % 2 ? 1 : -1, x = dir * (4 + (i % 4) * 4.5) * p * 1.5, y = WY - 22 * Math.sin(p * Math.PI) * (0.6 + (i % 3) * 0.25); ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, 6.283); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.2 * Math.sin(t * 6)).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(0, WY, 15 + 2 * Math.sin(t * 5), 3.6, 0, 0, 6.283); ctx.fill();
  }

  // Размеры чаши для проверок и расстановки сцены (юниты мира): ближний и дальний край основания на земле, верх дальнего борта (rimY), полуширина борта, внешний радиус колец площадки и полуширина, на которой внешнее кольцо
  // пересекает кромку газона (y = 594): она должна быть меньше полуширины борта, тогда дуги колец уходят под кромку только позади самой чаши
  KA.fountainGeom = function () {
    const nearY = WALL + 10 + FN.DY, cy = nearY - FN_RY, R = 334, ry = R * FN.Q + 0.12 * Math.max(0, R - 246), k = (cy - (WALL + 10)) / ry;
    return { nearY, farY: nearY - 2 * FN_RY, rimY: nearY - 2 * FN_RY - FN.H, rx: FN.RX, plazaR: R, curbX: Math.abs(k) < 1 ? R * Math.sqrt(1 - k * k) : 0 };
  };

  KA.fountain = function (ctx, x, wall, t) {
    if (!FT || !FT.c.width) FT = buildFountain();
    ctx.save(); ctx.translate(x, wall + 10 + FN.DY);
    ctx.drawImage(FT.c, -FT_OX, -FT_OY, FT.w, FT.h);
    ctx.lineCap = 'round';
    // круги и блёстки по воде: радиусы и места подобраны так, чтобы не выходить за воду и не заходить на ближний борт (клиппинг на каждый кадр был бы дороже всей струи)
    for (let k = 0; k < 3; k++) { const u = (t * 0.26 + k / 3) % 1, rr = 12 + u * (FN_RI * 0.62 - 12); ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 * (1 - u)).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, FN_WY, rr, rr * FN.Q, 0, 0, 6.283); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (const a of ARCS) { const u = (t * 0.9 + a.ph) % 1, rx = 2.5 + u * 11; ctx.moveTo(a.x1 + rx, a.y1); ctx.ellipse(a.x1, a.y1, rx, rx * 0.26, 0, 0, 6.283); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      if (Math.sin(t * 2.7 + i * 2.3) < 0.82) continue;
      const a = i * 2.399, d = 30 + ((i * 37) % 100), sx = Math.cos(a) * d, sy = FN_WY + Math.sin(a) * d * FN.Q * 0.8;
      ctx.moveTo(sx - 4.5, sy); ctx.lineTo(sx + 4.5, sy); ctx.moveTo(sx, sy - 3.4); ctx.lineTo(sx, sy + 3.4);
    }
    ctx.stroke();
    fountainArcs(ctx, t, ARC_FAR);
    fountainJet(ctx, t);
    fountainArcs(ctx, t, ARC_NEAR);
    ctx.restore();
  };

  // =================================================================== уличная мебель и зелень переднего плана
  // Спрайт сцены: рисуется один раз в слой; (ox, oy) — точка опоры в юнитах слоя. Возвращает функцию (ctx, x, y, flip).
  function sprite(w, h, ox, oy, scale, fn) {
    const L = A.layer(w, h, (g) => { g.translate(ox, oy); fn(g); }, scale);
    return (ctx, x, y, flip) => {
      if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(L.c, -ox, -oy, L.w, L.h); ctx.restore(); }
      else ctx.drawImage(L.c, x - ox, y - oy, L.w, L.h);
    };
  }

  // Классический фонарь: чёрный чугун, ножка-ваза, кольца, две консоли с висячими корзинами петуний, пять белых шаров. (x, base) — основание, s — масштаб.
  function lamp(g, x, base, s) {
    g.save(); g.translate(x, base); g.scale(s, s); g.lineJoin = 'round'; g.lineCap = 'round';
    const iron = (x0, x1) => A.linG(g, x0, 0, x1, 0, [[0, '#55556a'], [0.3, '#2c2c36'], [1, '#17171d']]);
    // цоколь и ножка
    A.box(g, -21, -16, 42, 16, { fill: iron(-21, 21), lw: 3, hi: 'rgba(255,255,255,0.18)' }); A.box(g, -16, -30, 32, 14, { fill: iron(-16, 16), lw: 3, hi: 'rgba(255,255,255,0.18)' });
    g.beginPath(); g.moveTo(-12, -30); g.bezierCurveTo(-20, -44, -18, -58, -9, -66); g.lineTo(-7, -84); g.lineTo(7, -84); g.lineTo(9, -66); g.bezierCurveTo(18, -58, 20, -44, 12, -30); g.closePath();
    g.fillStyle = iron(-18, 18); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-10, -60, 2.4, 22);
    // ствол с кольцами
    g.fillStyle = iron(-6, 6); g.fillRect(-6, -254, 12, 172); g.strokeRect(-6, -254, 12, 172);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(-4, -252, 2.2, 168);
    for (const y of [-118, -176, -238]) A.box(g, -9.5, y, 19, 7, { fill: iron(-9, 9), lw: 2.6, hi: 'rgba(255,255,255,0.25)' });
    // консоли и висячие корзины
    for (const k of [-1, 1]) {
      g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(k * 5, -224); g.bezierCurveTo(k * 24, -224, k * 38, -230, k * 46, -246); g.stroke();
      g.strokeStyle = '#2c2c36'; g.lineWidth = 3.6; g.stroke();
      g.beginPath(); g.arc(k * 46, -241, 5, 0, 6.283); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      const bx = k * 46, by = -214;
      g.strokeStyle = '#3a3a46'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(bx, -236); g.lineTo(bx - 19, by - 6); g.moveTo(bx, -236); g.lineTo(bx + 19, by - 6); g.stroke();
      g.beginPath(); g.moveTo(bx - 21, by - 6); g.bezierCurveTo(bx - 20, by + 14, bx - 8, by + 22, bx, by + 22); g.bezierCurveTo(bx + 8, by + 22, bx + 20, by + 14, bx + 21, by - 6); g.closePath();
      g.fillStyle = '#2c2c36'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      const R = A.rng(Math.round(k * 7 + 11));
      for (let i = 0; i < 12; i++) { const fx = bx + R.range(-18, 18), fy = by - 8 - R.range(0, 16) * (1 - Math.abs(fx - bx) / 26); g.fillStyle = R.pick(['#3f8a40', '#4f9c48', '#357a3c']); g.beginPath(); g.arc(fx, fy + 5, R.range(5, 8), 0, 6.283); g.fill(); }
      for (let i = 0; i < 14; i++) { const fx = bx + R.range(-20, 20), fy = by - 9 - R.range(0, 17) * (1 - Math.abs(fx - bx) / 26), r = R.range(4.2, 6.4); g.fillStyle = R.pick(['#f06b8c', '#e03a52', '#ffa6bd', '#fff0f4', '#f06b8c']); g.beginPath(); g.arc(fx, fy, r, 0, 6.283); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(fx - 1.4, fy - 1.6, r * 0.32, 0, 6.283); g.fill(); }
      for (let i = 0; i < 5; i++) { const fx = bx + R.range(-17, 17), fy = by + 8 + R.range(0, 10); g.fillStyle = R.pick(['#f06b8c', '#e03a52']); g.beginPath(); g.arc(fx, fy, 3.8, 0, 6.283); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(); }
    }
    // чаша и шары: корона из пяти плафонов на изогнутых рожках
    g.beginPath(); g.moveTo(-15, -270); g.lineTo(15, -270); g.lineTo(8, -254); g.lineTo(-8, -254); g.closePath(); g.fillStyle = iron(-15, 15); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    const globes = [[0, -322, 15], [-27, -306, 14], [27, -306, 14], [-50, -280, 13], [50, -280, 13]];
    for (const [gx, gy, r] of globes) {
      g.strokeStyle = OUT; g.lineWidth = 6.4; g.beginPath(); g.moveTo(gx * 0.12, -266); g.quadraticCurveTo(gx * 0.9, -270, gx, gy + r * 0.8); g.stroke();
      g.strokeStyle = '#2c2c36'; g.lineWidth = 3.2; g.stroke();
    }
    for (const [gx, gy, r] of globes) {
      A.glow(g, gx, gy, r * 2.2, 'rgba(255,248,224,', 0.2);
      g.fillStyle = iron(gx - 6, gx + 6); g.beginPath(); g.moveTo(gx - 6, gy + r * 0.78); g.lineTo(gx + 6, gy + r * 0.78); g.lineTo(gx + 4, gy + r + 4); g.lineTo(gx - 4, gy + r + 4); g.closePath(); g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
      const gr = g.createRadialGradient(gx - r * 0.3, gy - r * 0.35, r * 0.1, gx, gy, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#f1f4f6'); gr.addColorStop(1, '#cdd8e2');
      g.beginPath(); g.arc(gx, gy, r, 0, 6.283); g.fillStyle = gr; g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.arc(gx, gy, r - 4.4, 3.5, 4.5); g.stroke();
    }
    g.beginPath(); g.arc(0, -340, 3.6, 0, 6.283); g.fillStyle = '#2c2c36'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
    A.speckle(g, -70, -350, 140, 354, 0.1, 5);
    g.restore();
  }

  // Скамья: тёмно-зелёные рейки (спинка из трёх, сиденье — широкая доска с верхней гранью), чугунные боковины с завитками. Сиденье — на WALL − 52 (поверхность для прыжка).
  function bench(g, s) {
    g.save(); g.scale(s || 1, s || 1); g.lineJoin = 'round'; g.lineCap = 'round';
    const slat = (x, y, w, h, seed) => {
      A.box(g, x, y, w, h, { fill: '#2f5f43', lw: 3, r: 3, hi: 'rgba(190,255,200,0.22)', lo: 'rgba(0,0,0,0.3)' });
      A.wood(g, x + 1.5, y + 1.5, w - 3, h - 3, { base: '#2f5f43', seed, knots: false, grain: 0.14, lineGap: 5 });
      g.fillStyle = 'rgba(200,255,210,0.2)'; g.fillRect(x + 4, y + 2.4, w - 8, 1.8);
    };
    // чугунные боковины: тумба-стойка с завитком, подлокотник
    for (const k of [-1, 1]) {
      const x = k * 62;
      g.strokeStyle = OUT; g.lineWidth = 11; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -100); g.stroke();
      g.strokeStyle = '#2a2a34'; g.lineWidth = 6; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 2, -4); g.lineTo(x - 2, -96); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(x, -48); g.bezierCurveTo(x - k * 8, -36, x - k * 20, -34, x - k * 22, -24); g.stroke();
      g.strokeStyle = '#2a2a34'; g.lineWidth = 4; g.stroke();
      g.beginPath(); g.arc(x - k * 20, -20, 5, 0, 6.283); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.arc(x, -104, 5.4, 0, 6.283); g.fillStyle = '#2a2a34'; g.fill(); g.lineWidth = 2.6; g.stroke();
      A.box(g, x - 9, -4, 18, 4, { fill: '#2a2a34', lw: 2.4 });
    }
    slat(-70, -98, 140, 9, 1); slat(-70, -84, 140, 9, 2); slat(-70, -70, 140, 9, 3);
    slat(-72, -52, 144, 10, 4);
    g.fillStyle = 'rgba(190,255,200,0.3)'; g.fillRect(-66, -56, 132, 4);                       // верхняя грань сиденья
    A.box(g, -72, -56, 144, 4, { fill: '#3f7a58', lw: 2.4, r: 2 });
    g.restore();
  }

  // Кресло-лавочка на одного (по фото владельца): изогнутая спинка-дуга с «крылом» и дугой-подлокотником, сиденье, тёмные ножки; малиново-розовое, без кислоты.
  // Смотрит вправо, начало координат — на земле под сиденьем; размер ≈ 48 × 60 (сиденье на 24 над землёй). Для кресел справа рисуется зеркально.
  function chair(g) {
    g.save(); g.scale(0.9, 0.9); g.lineJoin = 'round'; g.lineCap = 'round';
    const leg = (x0, y0, x1, y1, far) => { g.strokeStyle = OUT; g.lineWidth = far ? 5.6 : 6.8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = far ? '#25222e' : '#3e3b4c'; g.lineWidth = far ? 2.8 : 3.6; g.stroke(); };
    leg(-9, -19, -12, -4, true); leg(17, -19, 20, -4, true);                                          // дальние ножки (чуть выше и темнее)
    // дальнее крыло спинки: тёмная дуга за сиденьем
    g.beginPath(); g.moveTo(-14, -26); g.bezierCurveTo(-22, -38, -22, -54, -11, -66); g.quadraticCurveTo(-7, -69, -4, -64); g.bezierCurveTo(-12, -54, -12, -42, -5, -30); g.closePath();
    g.fillStyle = A.linG(g, 0, -68, 0, -26, [[0, '#b13c68'], [1, '#8a2a52']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    // сиденье: верхняя грань (светлая) и передняя (малиновая), закруглённый передний край
    g.beginPath(); g.moveTo(-17, -24); g.lineTo(-12, -30); g.lineTo(21, -30); g.quadraticCurveTo(28, -30, 26, -24.5); g.closePath();
    g.fillStyle = A.linG(g, 0, -30, 0, -24, [[0, '#f9bfd3'], [1, '#f08bac']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(-17, -24); g.lineTo(26, -24.5); g.quadraticCurveTo(27, -17, 20, -17); g.lineTo(-13, -17); g.quadraticCurveTo(-17, -17, -17, -24); g.closePath();
    g.fillStyle = A.linG(g, -17, 0, 26, 0, [[0, '#e86a93'], [0.5, '#d4507c'], [1, '#b13c68']]); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-12, -23, 28, 1.6);
    // ближние ножки: лёгкий изгиб наружу
    leg(-12, -17, -17, 0, false); leg(19, -17, 24, 0, false);
    g.fillStyle = '#25222e'; for (const fx of [-17, 24]) { g.beginPath(); g.ellipse(fx, 0.2, 5.4, 1.8, 0, 0, 6.283); g.fill(); }
    // спинка: изогнутая дуга (сверху загибается вперёд), светлая кромка и внутренний край
    g.beginPath(); g.moveTo(-19, -20); g.bezierCurveTo(-29, -30, -31, -52, -18, -65); g.quadraticCurveTo(-13, -69, -9, -64); g.bezierCurveTo(-20, -52, -19, -38, -9, -26); g.lineTo(-9, -20); g.closePath();
    g.fillStyle = A.linG(g, -30, 0, -8, 0, [[0, '#f29ab9'], [0.35, '#e0628c'], [1, '#b73f6c']]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,230,238,0.65)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-26, -34); g.bezierCurveTo(-28, -46, -25, -56, -17, -63); g.stroke();
    g.strokeStyle = 'rgba(122,28,68,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-12, -31); g.bezierCurveTo(-18, -40, -18, -52, -11, -62); g.stroke();
    // подлокотник: дуга от спинки вперёд и вниз к сиденью
    g.strokeStyle = OUT; g.lineWidth = 8; g.beginPath(); g.moveTo(-14, -48); g.bezierCurveTo(-2, -50, 8, -46, 10, -32); g.stroke();
    g.strokeStyle = '#d4507c'; g.lineWidth = 4.6; g.stroke();
    g.strokeStyle = 'rgba(255,226,236,0.7)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-12, -50); g.bezierCurveTo(-2, -52, 6, -49, 9, -39); g.stroke();
    A.speckle(g, -34, -72, 66, 74, 0.1, 6);
    g.restore();
  }

  // Урна: чёрная с зелёным пояском
  function bin(g) {
    g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-15, 0); g.lineTo(-18, -50); g.lineTo(18, -50); g.lineTo(15, 0); g.closePath();
    g.fillStyle = A.linG(g, -18, 0, 18, 0, [[0, '#4a4a58'], [0.4, '#2c2c36'], [1, '#1a1a20']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#2f7a50'; g.fillRect(-17, -34, 34, 8); g.strokeRect(-17, -34, 34, 8);
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(dx, -22); g.lineTo(dx, -6); g.stroke(); }
    A.box(g, -20, -56, 40, 8, { fill: '#2c2c36', lw: 3, r: 3, hi: 'rgba(255,255,255,0.2)' });
  }

  // Голубь: серый, с радужным отливом на шее; pose 0 — стоит, 1 — клюёт. Начало — между лапками на земле, смотрит вправо.
  function pigeon(g, pose) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const hx = pose ? 13 : 9.5, hy = pose ? -8 : -19.5;
    g.strokeStyle = '#d07a86'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-2, -7); g.lineTo(-3, -1); g.lineTo(-6, 0); g.moveTo(-3, -1); g.lineTo(0, 0); g.moveTo(3, -7); g.lineTo(4, -1); g.lineTo(1, 0); g.moveTo(4, -1); g.lineTo(7, 0); g.stroke();
    g.beginPath(); g.moveTo(-9, -14); g.lineTo(-19, pose ? -15 : -9); g.lineTo(-17, pose ? -9 : -5); g.lineTo(-7, -9); g.closePath(); g.fillStyle = '#5c6070'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.ellipse(0, -13, 11.6, 7.6, pose ? 0.3 : -0.12, 0, 6.283); g.fillStyle = A.linG(g, 0, -21, 0, -5, [[0, '#b1b6c4'], [1, '#7a8090']]); g.fill(); g.lineWidth = 2.2; g.stroke();
    g.beginPath(); g.ellipse(-2.6, -13.6, 7.4, 4.2, pose ? 0.2 : -0.14, 0, 6.283); g.fillStyle = '#656b7c'; g.fill(); g.lineWidth = 1.2; g.stroke();
    g.beginPath(); g.moveTo(5, -17); g.quadraticCurveTo(hx, hy + 4, hx, hy); g.lineWidth = 6.8; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 3.8; g.strokeStyle = '#5c9a90'; g.stroke();
    g.beginPath(); g.arc(hx, hy, 4.4, 0, 6.283); g.fillStyle = '#747a8e'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(hx + 3.6, hy - 0.6); g.lineTo(hx + 8.6, hy + (pose ? 2.6 : 1)); g.lineTo(hx + 3.4, hy + 2); g.closePath(); g.fillStyle = '#ecd0b8'; g.fill(); g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#f08a34'; g.beginPath(); g.arc(hx + 1.2, hy - 1, 1.2, 0, 6.283); g.fill();
  }

  // Клумба: край из красного гранита, внутри — листва и цветы (красные, жёлтые). w — ширина.
  function bed(g, w, seed) {
    const R = A.rng(seed);
    g.beginPath(); g.rect(0, -34, w, 24); g.fillStyle = '#4d7a38'; g.fill();
    for (let i = 0; i < w / 6; i++) { g.fillStyle = R.pick(['#3f8a40', '#2f7a3c', '#4f9c48', '#5aa84e']); g.beginPath(); g.arc(R.range(2, w - 2), -R.range(14, 36), R.range(6, 10), 0, 6.283); g.fill(); }
    flowers(g, 4, -26, w - 8, seed + 3);
    flowers(g, 8, -16, w - 16, seed + 5);
    A.box(g, -3, -16, w + 6, 16, { fill: A.linG(g, 0, -16, 0, 0, [[0, '#b5594c'], [1, '#86382f']]), lw: 3, r: 3, hi: 'rgba(255,214,196,0.4)' });
    g.strokeStyle = 'rgba(30,8,6,0.5)'; g.lineWidth = 1.6; for (let x = 34; x < w - 10; x += 46) { g.beginPath(); g.moveTo(x, -14); g.lineTo(x, -2); g.stroke(); }
    A.grain(g, -3, -16, w + 6, 16, 0.2, 'overlay', seed, 0.5);
  }

  // Ворота парка: два красных гранитных столба с шарами, кованая арка с вывеской, створки распахнуты; за ними — светлая дорожка к площадке.
  function gate(g) {
    // вид за воротами: дорожка в солнце, дальние деревья, красное покрытие площадки
    g.save(); g.beginPath(); g.rect(-50, -176, 100, 176); g.clip();
    A.gradV(g, -50, -176, 100, 176, [[0, '#9fd0ea'], [0.55, '#d4ecf2'], [1, '#e8eedd']]);
    g.fillStyle = 'rgba(86,140,90,0.75)'; for (const [dx, dy, r] of [[-30, -58, 32], [8, -70, 40], [38, -52, 30], [-6, -40, 26]]) { g.beginPath(); g.arc(dx, dy, r, 0, 6.283); g.fill(); }
    g.fillStyle = A.linG(g, 0, -36, 0, 0, [[0, '#b95a48'], [1, '#8f3f33']]); g.fillRect(-50, -36, 100, 36);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-50, -22, 100, 2.4);
    A.gradV(g, -50, -176, 100, 176, [[0, 'rgba(255,248,214,0.15)'], [1, 'rgba(255,248,214,0)']]);
    g.restore();
    // столбы
    for (const k of [-1, 1]) {
      const x = k * 64;
      g.fillStyle = A.linG(g, x - 16, 0, x + 16, 0, [[0, '#b8504a'], [0.4, '#9c4036'], [1, '#6c2a26']]); g.fillRect(x - 16, -150, 32, 150);
      g.save(); g.beginPath(); g.rect(x - 16, -150, 32, 150); g.clip(); A.grain(g, x - 16, -150, 32, 150, 0.22, 'overlay', 61 + k, 0.5);
      g.strokeStyle = 'rgba(30,8,6,0.4)'; g.lineWidth = 1.6; for (let y = -126; y < 0; y += 24) { g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x + 16, y); g.stroke(); }
      g.fillStyle = 'rgba(255,226,210,0.24)'; g.fillRect(x - 13, -148, 4, 146); g.restore();
      g.strokeStyle = OUT; g.lineWidth = 3.2; g.strokeRect(x - 16, -150, 32, 150);
      A.box(g, x - 21, -160, 42, 12, { fill: '#a8463c', lw: 3, hi: 'rgba(255,220,200,0.34)' });
      A.box(g, x - 22, -10, 44, 10, { fill: '#8a3a32', lw: 3, hi: 'rgba(255,220,200,0.3)' });
      g.beginPath(); g.arc(x, -174, 12, 0, 6.283); g.fillStyle = A.linG(g, x - 12, -186, x + 12, -162, [[0, '#d98a7a'], [0.5, '#a8463c'], [1, '#6c2a26']]); g.fill(); g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - 4, -179, 4, 2.4, -0.6, 0, 6.283); g.fill();
    }
    // кованая арка и вывеска
    g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = 9; g.beginPath(); g.moveTo(-48, -166); g.quadraticCurveTo(0, -222, 48, -166); g.stroke();
    g.strokeStyle = '#2c2c36'; g.lineWidth = 5; g.stroke();
    g.lineWidth = 2.4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(i * 12.5, -172 - (1 - Math.abs(i) / 4) * 20, 4.4, 0, 6.283); g.stroke(); }
    A.box(g, -52, -212, 104, 24, { fill: '#2f6a4c', lw: 3.4, r: 4, hi: 'rgba(255,255,255,0.2)' });
    A.text(g, 'Шахи і спорт', 0, -199.5, 13, '#fff1d0', { stroke: 'rgba(20,10,14,0.55)', lw: 3 });
    g.strokeStyle = '#2c2c36'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-30, -188); g.lineTo(-30, -176); g.moveTo(30, -188); g.lineTo(30, -176); g.stroke();
    // створки: распахнуты внутрь, виден только торец — тонкие решётчатые панели у столбов
    for (const k of [-1, 1]) {
      g.beginPath(); g.moveTo(k * 48, -4); g.lineTo(k * 36, -10); g.lineTo(k * 36, -112); g.lineTo(k * 48, -118); g.closePath();
      g.fillStyle = 'rgba(40,40,52,0.35)'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = '#2c2c36'; g.stroke();
      g.lineWidth = 1.6; for (let i = 1; i < 4; i++) { const t = i / 4; g.beginPath(); g.moveTo(k * (48 - 12 * t), -4 - 6 * t); g.lineTo(k * (48 - 12 * t), -118 + 6 * t); g.stroke(); }
    }
  }

  // Бабочка: крылья машут по времени (flap); (x, y) — туловище
  function wing(ctx, x, y, col, flap) {
    const w = 6.4 * (0.25 + 0.75 * Math.abs(Math.sin(flap)));
    ctx.fillStyle = col; ctx.lineWidth = 1.4; ctx.strokeStyle = OUT;
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + k * w * 0.62, y - 1.6, w, 3.8, k * 0.5, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x + k * w * 0.5, y + 2.6, w * 0.7, 2.8, -k * 0.4, 0, 6.283); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = OUT; ctx.fillRect(x - 0.8, y - 3.4, 1.6, 8.4);
  }
  // Лист планирует вниз у дерева tx и гаснет у земли: k — номер листа (по три на дерево), t — время сцены
  function fallingLeaf(ctx, t, tx, k) {
    const per = 9 + k * 2.3, ph = k * 3.1 + tx * 0.01, u = ((t + ph) % per) / per, y = WALL - 330 + u * 318, x = tx + (k - 1) * 70 + 46 * Math.sin(u * 7 + k) + 20 * Math.sin(u * 17), a = u > 0.85 ? (1 - u) / 0.15 : Math.min(1, u * 8);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(Math.sin(u * 9 + k) * 1.1); ctx.fillStyle = k === 1 ? '#c4b43c' : '#7cae48'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 5.2, 2.6, 0, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  KA.parkDecor = function (X) {
    const out = [];
    // ---- деревья переднего плана (X.trees): крупные, тёмные наклонные стволы, густая крона; по краям кадра и вокруг фонтана
    const bigA = sprite(360, 520, 180, 508, dens(1.7), (g) => broadleaf(g, 0, 0, 1.12, 61, { trunk: 150, rx: 134, ry: 120, lean: -12, tw: 30 }));
    const bigB = sprite(360, 520, 180, 508, dens(1.7), (g) => broadleaf(g, 0, 0, 1.12, 62, { trunk: 160, rx: 126, ry: 126, lean: 14, tw: 28, pal: LIME }));
    const thujaS = sprite(150, 330, 75, 322, 1.6, (g) => thuja(g, 0, 0, 1.12, 63, { h: 270, w: 48 }));
    for (const [x, spr, flip] of [[X.trees[0], bigA, false], [X.trees[2], bigB, true]]) out.push({ x, z: 16, draw: (ctx) => { A.shadow(ctx, x, WALL + 3, 130, 0.24); spr(ctx, x, WALL + 4, flip); } });
    out.push({ x: X.exit + 100, z: 11, draw: (ctx) => { A.shadow(ctx, X.exit + 100, WALL + 3, 56, 0.24); thujaS(ctx, X.exit + 100, WALL + 4, true); } });          // справа от ворот, за столбом
    // ---- низкие живые изгороди вдоль дорожек (X.hedges) с клумбами красных и жёлтых цветов
    for (const [hx, hw0] of X.hedges) {
      const hw = Math.min(hw0, X.exit - 88 - hx);                  // изгородь не заходит на столб ворот
      const spr = sprite(hw + 40, 84, 20, 76, 1.5, (g) => hedge(g, 0, 0, hw, 54, hx));
      out.push({ x: hx + hw / 2, z: 15, draw: (ctx) => spr(ctx, hx, WALL + 1) });
    }
    for (const [bx, bw, sd] of [[560, 230, 81], [1470, 150, 82], [1830, 170, 83]]) {          // клумбы лежат на земле и стоят в стороне от чаши (площадка — от 800 до 1460), кресла — перед ними
      const spr = sprite(bw + 30, 60, 15, 50, 1.6, (g) => bed(g, bw, sd));
      out.push({ x: bx + bw / 2, z: 17, draw: (ctx) => spr(ctx, bx, WALL + 2) });
    }
    // ---- кресла-лавочки на одного вокруг фонтана: по два с каждой стороны, лицом к воде (слева смотрят вправо, справа — влево)
    const chairS = sprite(70, 84, 35, 76, dens(2.4), (g) => chair(g));
    for (const x of (X.chairsL || [])) out.push({ x, z: 22, draw: (ctx) => { A.shadow(ctx, x + 5, WALL + 12, 32, 0.28); chairS(ctx, x, WALL + 10, false); } });
    for (const x of (X.chairsR || [])) out.push({ x, z: 22, draw: (ctx) => { A.shadow(ctx, x - 5, WALL + 12, 32, 0.28); chairS(ctx, x, WALL + 10, true); } });
    // ---- фонари и скамейки
    const lampS = sprite(170, 360, 85, 352, dens(1.7), (g) => lamp(g, 0, 0, 1));
    // фонарь, попавший между двумя креслами, ставится ровно посередине между ними (иначе столб загораживал бы кресло)
    const lampX = (x) => { for (const grp of [X.chairsL, X.chairsR]) if (grp && grp.length === 2 && Math.abs(x - (grp[0] + grp[1]) / 2) < 60) return (grp[0] + grp[1]) / 2; return x; };
    for (const x0 of X.lamps) { const x = lampX(x0); out.push({ x, z: 21, draw: (ctx) => { A.shadow(ctx, x, WALL + 4, 32, 0.3); lampS(ctx, x, WALL + 4); } }); }
    const benchS = sprite(170, 124, 85, 116, 2, (g) => bench(g, 1));
    for (const x of X.benches) out.push({ x, z: 22, draw: (ctx) => { A.shadow(ctx, x, WALL + 2, 88, 0.28); benchS(ctx, x, WALL); } });
    const binS = sprite(60, 70, 30, 62, 2, (g) => bin(g));
    for (const x of [X.benches[0] + 96, X.benches[1] - 100]) out.push({ x, z: 21, draw: (ctx) => { A.shadow(ctx, x, WALL + 2, 22, 0.26); binS(ctx, x, WALL); } });
    // ---- бабочки над клумбами: плавные петли по времени сцены, крылья машут
    for (const [bx, ph, col] of [[686, 0.4, '#ffe45c'], [1444, 2.1, '#ff9a2e'], [1914, 4.0, '#9fd2ff'], [540, 5.2, '#f58aa6']]) {
      out.push({ x: bx, z: 40, draw: (ctx, t) => wing(ctx, bx + 46 * Math.sin(t * 0.55 + ph) + 14 * Math.sin(t * 1.7 + ph), WALL - 92 + 22 * Math.sin(t * 0.9 + ph * 1.3) + 5 * Math.sin(t * 3.1), col, t * 17 + ph) });
    }
    // ---- листья: по три у каждого большого дерева медленно планируют вниз и гаснут у земли (по времени сцены)
    for (const tx of [X.trees[0], X.trees[2]]) for (let k = 0; k < 3; k++) out.push({ x: tx, z: 44, draw: (ctx, t) => fallingLeaf(ctx, t, tx, k) });
    // ---- голуби на дорожке
    const pg = [sprite(50, 40, 25, 34, 3, (g) => pigeon(g, 0)), sprite(50, 40, 25, 34, 3, (g) => pigeon(g, 1))];
    for (const [x, ph, flip] of [[600, 0.3, false], [1408, 1.4, true], [1688, 2.2, true], [472, 0.9, false]]) out.push({ x, z: 21, draw: (ctx, t) => pg[Math.floor(t * 1.5 + ph * 2) % 4 === 0 ? 1 : 0](ctx, x, WALL + 12, flip) });          // голуби изредка клюют
    // ---- выход к площадке: ворота парка на месте двери (X.exit)
    const gateS = sprite(240, 260, 120, 252, 1.8, (g) => gate(g));
    out.push({ x: X.exit, z: 12, draw: (ctx) => { A.shadow(ctx, X.exit, WALL + 2, 120, 0.22); gateS(ctx, X.exit, WALL); } });
    return out;
  };

  // =================================================================== площадка у шахматных столов
  // Сцена 2600 юн. (владелец 03.10.2026). Слева — дорожка парка с шахматным столом (Димасик сидит за ним, там же скамья, лампы, клумба), правее — стойка «Игры в парке» (там пополнение,
  // слева от неё стоят Илюшкинс и Бубел), с x = X.fence — тёмно-красное резиновое покрытие площадки, в конце полосы (белая торцевая линия) Димасик у спортивной стойки; дальше проём в живой изгороди (X.gap), плиточный
  // проход к нему и асфальт у бордюра, где стоит машина Uber. Размеры рассчитаны на память: см. courtLayers.
  // Правило боя: позади полосы (X.fence … X.net) фон тихий — светлые мягкие кусты и дымчатый корпус, без тёмных масс и мелкой контрастной детали;
  // снаряды (тёмные блины, гантель, гриф по полу) и герои должны читаться. Богатство — по краям, у проёма и в дальних слоях.

  // Мягкий куст: низкий купол из светлых клубов (для спокойного фона), обрезан по линии земли
  function shrub(g, x, base, rx, ry, seed, P, o) {
    o = o || {};
    const R = A.rng(seed);
    g.save(); g.beginPath(); g.rect(x - rx * 1.5, base - ry * 2.6, rx * 3, ry * 2.6 + 2); g.clip();
    g.translate(x, base - ry * 0.55);
    crown(g, blobsIn(R, rx, ry, 8, 12), P, seed, { line: o.line || OUT, lw: o.lw || 3 });
    g.restore();
  }

  // Рабочий вид тёмно-красной «резины»: тон средний (не чёрный), крошка, швы полотен; разметка белая, чуть потёртая. Рисуется в скошенных координатах мощения.
  function rubber(g, xa, xb, y0, h, o) {
    const R = A.rng(o.seed || 19);
    g.fillStyle = A.linG(g, 0, y0, 0, y0 + h, [[0, '#b04d3d'], [0.5, '#a24536'], [1, '#8d3b30']]); g.fillRect(xa, y0, xb - xa, h);
    for (let i = 0; i < (xb - xa) * h / 70; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(255,214,196,0.07)' : 'rgba(40,10,8,0.09)'; g.fillRect(R.range(xa, xb), R.range(y0, y0 + h), R.range(1, 2.6), R.range(1, 2.2)); }
    g.strokeStyle = 'rgba(50,14,10,0.2)'; g.lineWidth = 1.4; for (let x = xa + 60; x < xb; x += 150) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke(); }
    for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(255,226,206,0.07)'; g.lineWidth = R.range(5, 12); g.beginPath(); const sx = R.range(xa, xb), sy = R.range(y0 + 10, y0 + h - 10); g.moveTo(sx, sy); g.lineTo(sx + R.range(60, 180), sy + R.range(-3, 3)); g.stroke(); }
    A.grain(g, xa, y0, xb - xa, h, 0.16, 'overlay', 29, 0.5);
    // разметка: дальняя боковая линия, две торцевые и центральная (на барьере между половинами Алеси и Димасика), центральный круг, полукруги зон у торцов
    g.strokeStyle = 'rgba(255,248,236,0.66)'; g.lineWidth = 3.4; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(o.l0, y0 + 14); g.lineTo(o.l1, y0 + 14); g.stroke();
    for (const lx of [o.l0, o.l1, o.mid]) { g.beginPath(); g.moveTo(lx, y0 + 14); g.lineTo(lx, y0 + h); g.stroke(); }
    g.beginPath(); g.ellipse(o.mid, y0 + 78, 78, 30, 0, 0, 6.283); g.stroke();
    g.beginPath(); g.ellipse(o.l1, y0 + 78, 78, 34, 0, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.ellipse(o.l0, y0 + 78, 78, 34, 0, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
    g.fillStyle = 'rgba(150,56,44,0.34)'; for (let i = 0, n = Math.round((o.l1 - o.l0) / 2.1); i < n; i++) g.fillRect(R.range(o.l0, o.l1), y0 + R.range(12, h), R.range(1.5, 6), R.range(1.5, 3.2));   // потёртости линий
  }

  // Общий фон на кадр: небо, облака, дальний, средний слой, земля
  function backdrop(ctx, cam, game, L) {
    const W = game.viewW, H = game.viewH;
    skyFill(ctx, W, H);
    A.blitView(ctx, L.sky, -cam.x * 0.1, 0, W);
    A.blitView(ctx, L.far, -cam.x * 0.3, FAR_Y, W);
    A.blitView(ctx, L.mid, -cam.x * 0.6, MID_Y, W);
    A.beam(ctx, W * 0.2, -30, 120, W * 0.2 + 360, 600, 260, 0.06, 'rgba(255,246,214,'); A.beam(ctx, W * 0.46, -30, 90, W * 0.46 + 330, 600, 200, 0.045, 'rgba(255,246,214,');      // лёгкие лучи сквозь листву
    A.blitView(ctx, L.ground, -cam.x, WALL - 4, W);          // через blitView, как остальные слои: полоса за краем мира на экране с вырезом продолжается зеркально (раньше здесь была голая заливка неба — владелец 27.10.2026)
  }

  // ---- слои площадки. Сцена растянута до 2600 юн. (владелец 03.10.2026), поэтому память экономится: дальний план — в дымке и с меньшей плотностью, деревья среднего плана — несколько
  // спрайтов, расставленных с параллаксом 0,6 (а не один широкий слой, на 3/4 пустой), живая изгородь с проёмом — отдельный слой в мировых координатах (проём привязан к X.gap).
  const CT_BASE = 594, HEDGE_Y = 516, HEDGE_H = 84, SKEW = 0.36;

  // Спрайт с доступом к холсту (для рисования с произвольным масштабом и отражением); ox, oy — точка опоры в юнитах спрайта
  function spriteObj(w, h, ox, oy, scale, fn) { return { L: A.layer(w, h, (g) => { g.translate(ox, oy); fn(g); }, scale), ox, oy }; }
  function putObj(ctx, o, x, y, flip, s) { s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s); ctx.drawImage(o.L.c, -o.ox, -o.oy, o.L.w, o.L.h); ctx.restore(); }

  // Плитка в косой системе пола (вызывать внутри transform со сдвигом SKEW): ряды растут к зрителю, швы со смещением, лёгкая разница тонов
  function tilePatch(g, x0, x1, y0, h, o) {
    const R = A.rng(o.seed || 3), cw = o.cw || 44;
    g.fillStyle = A.linG(g, 0, y0, 0, y0 + h, [[0, o.top], [1, o.bot]]); g.fillRect(x0, y0, x1 - x0, h);
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, h); g.clip();
    let y = y0, rh = o.row0 || 9;
    for (let row = 0; y < y0 + h; row++) {
      const hh = Math.min(rh, y0 + h - y), off = (row % 2) * cw / 2, sw = cw + row * 1.4;
      for (let x = x0 - off - R.range(0, 8); x < x1; x += sw) { if (R.chance(0.35)) { g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.12)' : 'rgba(60,44,40,0.09)'; g.fillRect(x + 1, y + 1, sw - 2, hh - 2); } g.fillStyle = o.seam || 'rgba(70,54,50,0.3)'; g.fillRect(x, y, 1.3, hh); }
      g.fillStyle = o.seam || 'rgba(70,54,50,0.3)'; g.fillRect(x0, y, x1 - x0, 1.3);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, y + 1.3, x1 - x0, 1.2);
      y += hh; rh += 1.1;
    }
    g.restore();
    A.grain(g, x0, y0, x1 - x0, h, 0.14, 'overlay', o.seed || 3, 0.55);
  }

  // Асфальт у бордюра (там стоит машина): холодный тёмно-серый, крошка, заплаты, трещины и люк (в косой системе пола)
  function asphalt(g, xa, xb, y0, h) {
    const R = A.rng(23);
    g.fillStyle = A.linG(g, 0, y0, 0, y0 + h, [[0, '#505260'], [0.45, '#474956'], [1, '#3d3f4b']]); g.fillRect(xa, y0, xb - xa, h);
    for (let i = 0; i < (xb - xa) * h / 80; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.09)'; g.fillRect(R.range(xa, xb), R.range(y0, y0 + h), R.range(1, 3), R.range(1, 2.4)); }
    for (let i = 0; i < 6; i++) { const px = R.range(xa + 30, xb - 120), py = R.range(y0 + 12, y0 + h - 40); g.fillStyle = 'rgba(28,28,38,0.11)'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + R.range(60, 130), py + R.range(-3, 3)); g.lineTo(px + R.range(70, 140), py + R.range(18, 34)); g.lineTo(px + R.range(-6, 6), py + R.range(16, 30)); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(18,18,26,0.5)'; g.lineWidth = 1.3; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { let px = R.range(xa + 40, xb - 100), py = R.range(y0 + 10, y0 + h - 20); g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 6; k++) { px += R.range(8, 22); py += R.range(-6, 6); g.lineTo(px, py); } g.stroke(); }
    const mx = xa + (xb - xa) * 0.55, my = y0 + h * 0.62;                                                   // люк
    g.fillStyle = '#34353f'; g.beginPath(); g.ellipse(mx, my, 24, 8, 0, 0, 6.283); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(14,14,20,0.8)'; g.stroke();
    g.strokeStyle = 'rgba(160,162,176,0.3)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(mx - 16, my + k * 2.4); g.lineTo(mx + 16, my + k * 2.4); g.stroke(); }
    A.grain(g, xa, y0, xb - xa, h, 0.16, 'overlay', 23, 0.5);
  }

  // Далёкое здание (светло-жёлтый корпус в дымке) — для разнообразия справа от красного корпуса
  function farManor(g, x, base, w, h) {
    g.fillStyle = A.linG(g, 0, base - h, 0, base, [[0, '#ead49a'], [1, '#d8b86a']]); g.fillRect(x, base - h, w, h);
    g.strokeStyle = 'rgba(110,84,60,0.55)'; g.lineWidth = 2.4; g.strokeRect(x, base - h, w, h);
    g.fillStyle = '#f2e8d2'; g.fillRect(x - 6, base - h - 8, w + 12, 10); g.fillRect(x - 3, base - 12, w + 6, 12);
    for (let r = 0; r < 2; r++) for (let c = 0; c < Math.floor(w / 36); c++) { const wx = x + 14 + c * 36, wy = base - h + 22 + r * 52; g.fillStyle = '#f2e8d2'; g.fillRect(wx - 3, wy - 3, 24, 38); g.fillStyle = '#7f98b2'; g.fillRect(wx, wy, 18, 32); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(wx + 2, wy + 2, 5, 28); }
    g.fillStyle = '#f2e8d2'; for (let c = 0; c <= Math.floor(w / 108); c++) g.fillRect(x + c * 108 - 3, base - h + 10, 7, h - 12);
  }

  KA.courtLayers = function (game, WIDTH, X) {
    const farW = (WIDTH - 1280) * 0.3 + 1700, skyW = (WIDTH - 1280) * 0.1 + 1700;
    const sky = skyLayer(skyW, 340, 9, skyW * 0.62);
    // ---- дальний: красный корпус слева (портик у края — виден в любом виде), правое крыло уходит в дымку; правее — жёлтый корпус и далёкие деревья
    const far = A.layer(farW, FAR_H, (g, w) => {
      g.translate(0, -FAR_Y);
      const base = 524, cx = 330;
      A.gradV(g, 0, base - 6, w, 600 - base + 6, [[0, '#d8cdbd'], [1, '#c8bba8']]);
      redBuilding(g, cx, base, { frame: '#eac6b8', glass: [[0, '#6a7e98'], [0.5, '#8196ae'], [1, '#9db0c4']] });
      farManor(g, 1640, base + 6, 330, 150);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(230,240,242,0.34)'; g.fillRect(0, FAR_Y, w, FAR_H); g.globalCompositeOperation = 'source-over';
      const hz = (P) => hazed(P, 0.4, '#d2e4e6'), hl = mix(OUT, '#b4c4ca', 0.45);
      for (const [x, h, sd] of [[1130, 250, 3], [1210, 290, 4], [1450, 260, 5], [1560, 240, 6], [2010, 285, 7], [2070, 250, 8]]) thuja(g, x, base + 22, 0.8, sd, { h, w: 40, pal: hz(DEEP), line: hl });
      for (const [x, s, sd, p] of [[1010, 0.8, 12, LIME], [1330, 0.78, 13, LEAF], [1560, 0.74, 14, LIME], [1960, 0.84, 15, LEAF]]) broadleaf(g, x, base + 28, s, sd, { pal: hz(p), line: hl, trunk: 110 });
      A.edge(g, 0, 460, w, 140, 'b', 140, 'rgba(236,244,236,0.5)');
    }, dens(1.6));
    // ---- средний план (параллакс 0,6): деревья слева и справа; в середине — только светлые мягкие кусты (за полосой боя фон тихий, без тёмных масс)
    const tree = (pal, sd, lean) => spriteObj(330, 384, 165, 372, dens(1.7), (g) => { A.shadow(g, 0, 2, 126, 0.24); broadleaf(g, 0, 0, 1.05, sd, { pal, trunk: 120, rx: 124, ry: 112, lean }); });
    const tA = tree(LEAF, 41, -10), tB = tree(LIME, 42, 12), tC = tree(LEAF, 47, 8);
    const th = spriteObj(120, 280, 60, 272, dens(1.6), (g) => thuja(g, 0, 0, 1.0, 31, { h: 255, w: 46 }));
    const soft = hazed(LIME, 0.28, '#d6e8d0'), softL = mix(OUT, '#b4c6b4', 0.58);
    const strip = spriteObj(1060, 172, 530, 160, dens(1.5), (g) => { for (let x = -430, i = 0; x <= 430; x += 107, i++) { const sd = 50 + (i * 5) % 7; shrub(g, x, -6, 82 + (sd % 3) * 8, 66 + (sd % 4) * 5, sd, soft, { line: softL }); } });
    const midW = (WIDTH - 1280) * 0.6 + 1700, R0 = midW - 2492;                  // для ширины 2600 расстановка ниже подобрана; правая группа держится за правый край слоя
    const mid = [[70, tA, 0, 1.08], [330, tB, 0, 0.98], [215, th, 0, 1], [940, strip, 0, 1], [1800 + R0, strip, 1, 1], [1800 + R0, tA, 1, 1.05], [2060 + R0, tB, 0, 1.0], [2330 + R0, tC, 1, 1.08], [2210 + R0, th, 0, 0.95]]
      .map(([x, o, flip, s]) => ({ x, o, flip, s, hw: (o === strip ? 530 : 170) * s }));
    // ---- живая изгородь вдоль всей площадки: контурами в мировых координатах; в проёме (X.gap ± 118) стоят высокие шапки ворот — они рисуются отдельно (см. gateway)
    const hedgeL = A.layer(WIDTH, HEDGE_H, (g, w) => {
      const base = CT_BASE - HEDGE_Y, g0 = X.gap - 118, g1 = X.gap + 118;
      const run = (x0, x1, seed0) => {
        const n = Math.max(1, Math.round((x1 - x0) / 250)), wd = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          const xc = x0 + (i + 0.5) * wd, hz = Math.min(1, Math.max(0, (xc - 700) / 400)) * Math.min(1, Math.max(0, (X.gap - 60 - xc) / 300)) * 0.2;
          hedge(g, x0 + i * wd, base, wd + (i < n - 1 ? 6 : 0), 44 + ((seed0 + i * 7) % 5) * 3, 140 + seed0 + i, hz > 0.01 ? { pal: hazed(HEDGE, hz, '#d6e8d0'), line: mix(OUT, '#b4c6b4', hz * 2.6) } : null);
        }
      };
      run(-30, g0, 0); run(g1, w + 30, 11);
    }, dens(1.5));
    const gate = spriteObj(270, 188, 135, 178, dens(1.8), (g) => gateway(g));
    // ---- земля: дорожка парка слева (то же мощение), площадка у стола, красная «резина» справа от ограждения, плиточный проход к проёму, асфальт у машины; кромка
    const ground = A.layer(WIDTH, 720 - WALL + 12, (g, w, h) => {
      const xe = X.fence, xr = X.gap - 60, xa = X.gap + 60, y0 = 13, hh = h - 13;
      paving(g, 0, y0, xe + SKEW * h + 12, hh, { seed: 9, band: [130, 930] });
      g.save(); g.beginPath(); g.rect(0, y0, w, hh); g.clip(); g.transform(1, 0, SKEW, 1, -SKEW * y0, 0);
      tilePatch(g, X.chess - 188, X.chess + 196, y0, 62, { seed: 5, top: '#c4c0ba', bot: '#d3cfc8', cw: 46 });                  // бетонная площадка под столом и скамьями
      g.strokeStyle = 'rgba(52,42,42,0.45)'; g.lineWidth = 2.2; g.strokeRect(X.chess - 188, y0, 384, 62);
      rubber(g, xe, xr, y0, hh, { seed: 19, l0: X.lineL, l1: X.lineR, mid: X.net });
      g.fillStyle = 'rgba(40,12,10,0.4)'; g.fillRect(xe - 4, y0, 4, h); g.fillStyle = 'rgba(255,214,196,0.3)'; g.fillRect(xe, y0, 2, h);                // стык: бортик между дорожкой и площадкой
      tilePatch(g, xr, xa, y0, hh, { seed: 13, top: '#e6dac0', bot: '#dccfb2', cw: 30 });                                          // проход к проёму в изгороди
      g.fillStyle = 'rgba(60,40,36,0.5)'; g.fillRect(xr - 2.5, y0, 2.5, h); g.fillRect(xa, y0, 2.5, h);
      asphalt(g, xa + 3, w + 140, y0, hh);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(xa + 3, y0, 3, h);
      g.restore();
      A.gradV(g, 0, 13, w, h - 13, [[0, 'rgba(40,24,20,0.28)'], [0.25, 'rgba(40,24,20,0)'], [1, 'rgba(255,240,210,0.06)']]);
      { const R = A.rng(60); for (const [tx, n] of [[96, 24], [WIDTH - 70, 22]]) for (let i = 0; i < n; i++) { const a = R.range(0, 6.283), d = Math.sqrt(R.next()); g.fillStyle = 'rgba(28,54,44,' + R.range(0.07, 0.14).toFixed(3) + ')'; g.beginPath(); g.ellipse(tx + Math.cos(a) * 150 * d, 34 + Math.sin(a) * 26 * d, R.range(10, 26), R.range(3, 7), 0, 0, 6.283); g.fill(); } }
      { const R = A.rng(61); for (let i = 0; i < 30; i++) { g.save(); g.translate(R.range(0, 700), R.range(24, h - 12)); g.rotate(R.range(0, 6.283)); g.fillStyle = R.pick(['rgba(138,170,70,0.8)', 'rgba(196,176,60,0.8)', 'rgba(232,150,170,0.75)']); g.beginPath(); g.ellipse(0, 0, R.range(2.6, 4.4), R.range(1.3, 2.2), 0, 0, 6.283); g.fill(); g.restore(); } }   // листья и лепестки на плитке слева
      // кромка: красный гранит у парка, серый бетон у площадки и асфальта; на месте прохода — пандус из плитки
      A.gradV(g, 0, 0, w, 14, [[0, '#a85246'], [0.3, '#8a4036'], [1, '#6a3028']]);
      A.gradV(g, X.fence + 7, 0, w, 14, [[0, '#9a9aa4'], [0.3, '#7e7e8a'], [1, '#5c5c68']]);
      for (let x = 70; x < w; x += 110) { g.fillStyle = 'rgba(30,10,8,0.5)'; g.fillRect(x, 3, 2, 11); }
      g.fillStyle = 'rgba(255,230,220,0.32)'; g.fillRect(0, 3, w, 2.4); A.grain(g, 0, 0, w, 14, 0.22, 'overlay', 11, 0.5);
      g.fillStyle = OUT; g.fillRect(0, 0, w, 3); g.fillRect(0, 13, w, 2);
      g.fillStyle = A.linG(g, 0, 0, 0, 16, [[0, '#d9ccae'], [1, '#e8dcc0']]); g.fillRect(xr, 1, xa - xr, 14.5);
      g.fillStyle = 'rgba(70,50,44,0.45)'; g.fillRect(xr - 2, 0, 3, 16); g.fillRect(xa - 1, 0, 3, 16);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(xr + 2, 4, xa - xr - 4, 2);
    }, dens(1.5));
    return { far, mid, hedge: hedgeL, gate, gateX: X.gap, ground, sky };
  };

  // Фон площадки на кадр: небо и облака, дальний план, средний (деревья с параллаксом), лучи света, изгородь с воротами (мировые координаты), земля
  KA.courtBack = function (ctx, cam, game, sc, L) {
    const W = game.viewW, H = game.viewH;
    skyFill(ctx, W, H);
    A.blitView(ctx, L.sky, -cam.x * 0.1, 0, W);
    A.blitView(ctx, L.far, -cam.x * 0.3, FAR_Y, W);
    for (const m of L.mid) { const sx = m.x - cam.x * 0.6; if (sx + m.hw < -10 || sx - m.hw > W + 10) continue; putObj(ctx, m.o, sx, CT_BASE, m.flip, m.s); }
    A.beam(ctx, W * 0.2, -30, 120, W * 0.2 + 360, 600, 260, 0.06, 'rgba(255,246,214,'); A.beam(ctx, W * 0.46, -30, 90, W * 0.46 + 330, 600, 200, 0.045, 'rgba(255,246,214,');
    A.blitView(ctx, L.hedge, -cam.x, HEDGE_Y, W);
    const gx = L.gateX - cam.x; if (gx > -170 && gx < W + 170) putObj(ctx, L.gate, gx, CT_BASE, false, 1);
    A.blitView(ctx, L.ground, -cam.x, WALL - 4, W);
  };

  // Стойка «Игры в парке»: деревянный прилавок, полка с четырьмя шарами, рогатка на крючке, мишень с дротиками, стакан запасных дротиков, полосатый навес и вывеска.
  // Герои стоят перед левой половиной, поэтому всё напоказ — на верхней полке и правее середины. Начало — середина основания.
  function stall(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const woodL = '#c8905a';
    // задняя стенка и верхняя полка
    A.wood(g, -80, -214, 160, 124, { base: '#8a5a38', seed: 71, dir: 'v', lineGap: 10, knots: false, grain: 0.18 });
    A.edge(g, -80, -214, 160, 46, 't', 46, 'rgba(20,8,4,0.5)');
    g.strokeStyle = OUT; g.lineWidth = 3.4; g.strokeRect(-80, -214, 160, 124);
    A.box(g, -78, -164, 156, 7, { fill: woodL, lw: 3, hi: 'rgba(255,240,210,0.4)' });
    for (let i = 0; i < 4; i++) { const bx = -54 + i * 36; g.fillStyle = '#6a4228'; g.beginPath(); g.ellipse(bx, -164, 13, 3.4, 0, 0, 6.283); g.fill(); Ale.drawSprite(g, 'kit_bowl', bx, -164 - 11, { sx: 0.6, sy: 0.6 }); }
    // рогатка на крючке, мишень с дротиками
    g.strokeStyle = '#d9b45a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-58, -156); g.lineTo(-58, -148); g.stroke(); g.beginPath(); g.arc(-58, -158, 3, 0, 6.283); g.fillStyle = '#d9b45a'; g.fill();
    Ale.drawSprite(g, 'kit_sling', -58, -124, { sx: 1.25, sy: 1.25 });
    const bx = 24, by = -124;
    g.beginPath(); g.arc(bx, by, 21, 0, 6.283); g.fillStyle = '#2b2430'; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    for (const [r, c] of [[17, '#f3e8cf'], [12.5, '#d84a5c'], [8, '#f3e8cf'], [4, '#d84a5c']]) { g.beginPath(); g.arc(bx, by, r, 0, 6.283); g.fillStyle = c; g.fill(); }
    g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx - 17, by); g.lineTo(bx + 17, by); g.moveTo(bx, by - 17); g.lineTo(bx, by + 17); g.stroke();
    Ale.drawSprite(g, 'kit_dart', bx - 12, by - 9, { rot: -2.7, sx: 0.8, sy: 0.8 }); Ale.drawSprite(g, 'kit_dart', bx + 11, by + 5, { rot: -3.3, sx: 0.8, sy: 0.8 });
    // прилавок: дощатая лицевая часть с красной полосой, столешница
    A.wood(g, -84, -78, 168, 78, { base: '#a8703f', seed: 72, dir: 'v', lineGap: 12, knots: false, grain: 0.16 });
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.strokeRect(-84, -78, 168, 78);
    g.fillStyle = '#d84a5c'; g.fillRect(-82, -70, 164, 14); g.strokeStyle = 'rgba(43,26,32,0.7)'; g.lineWidth = 2.2; g.strokeRect(-82, -70, 164, 14);
    g.fillStyle = '#fff3de'; for (let x = -74; x < 80; x += 16) { g.beginPath(); g.arc(x, -63, 3.4, 0, 6.283); g.fill(); }
    A.edge(g, -84, -22, 168, 22, 'b', 22, 'rgba(30,14,6,0.4)');
    A.box(g, -90, -90, 180, 12, { fill: woodL, lw: 3.6, hi: 'rgba(255,240,210,0.45)', lo: 'rgba(60,30,10,0.3)' });
    // на столешнице: поднос с мягкими шариками слева, стакан с дротиками справа
    A.box(g, -66, -98, 40, 8, { fill: '#8a5a38', lw: 2.6, r: 2 });
    for (let i = 0; i < 3; i++) Ale.drawSprite(g, 'kit_ball', -58 + i * 14, -108, { sx: 1.1, sy: 1.1 });
    g.beginPath(); g.moveTo(50, -90); g.lineTo(46, -114); g.lineTo(74, -114); g.lineTo(70, -90); g.closePath(); g.fillStyle = '#7a4a2a'; g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(50, -112, 4, 20);
    for (const [dx, rot] of [[-9, 1.15], [-3, 1.4], [4, 1.62], [10, 1.85], [16, 2.1]]) Ale.drawSprite(g, 'kit_dart', 60 + dx, -126, { rot, sx: 0.78, sy: 0.78 });
    g.beginPath(); g.moveTo(50, -90); g.lineTo(46, -114); g.lineTo(74, -114); g.lineTo(70, -90); g.closePath(); g.fillStyle = '#7a4a2a'; g.fill(); g.stroke();
    // стойки, полосатый навес, вывеска, флажки
    for (const k of [-1, 1]) { A.box(g, k * 87 - 5, -240, 10, 242, { fill: '#6a4228', lw: 3.4 }); A.wood(g, k * 87 - 3.5, -238, 7, 238, { base: '#6a4228', seed: 73 + k, dir: 'v', knots: false, grain: 0.14 }); g.beginPath(); g.arc(k * 87, -244, 6.6, 0, 6.283); g.fillStyle = '#d9b45a'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(); }
    Ale.StreetArt.awningPath(g, -100, -240, 200, 24, 8, '#d84a5c', '#fff3de');
    A.box(g, -94, -282, 188, 34, { fill: '#2f6a5c', lw: 3.8, r: 4, hi: 'rgba(255,255,255,0.18)' });
    g.strokeStyle = '#d9b45a'; g.lineWidth = 2; g.strokeRect(-89, -277, 178, 24);
    A.text(g, 'ІГРИ В ПАРКУ', 0, -265, 19.5, '#fff1d0', { stroke: 'rgba(20,10,14,0.6)', lw: 3.4 });
    g.strokeStyle = 'rgba(43,26,32,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-98, -214); g.quadraticCurveTo(0, -204, 98, -214); g.stroke();
    const pc = ['#e8506a', '#f4b942', '#4aa8d8', '#6cc070'];
    for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, fx = -98 + t * 196, fy = -214 + Math.sin(t * Math.PI) * 9.6; g.beginPath(); g.moveTo(fx - 5.4, fy - 1); g.lineTo(fx + 5.4, fy - 1); g.lineTo(fx, fy + 10); g.closePath(); g.fillStyle = pc[i % 4]; g.fill(); g.lineWidth = 1.7; g.strokeStyle = OUT; g.stroke(); }
  }

  // Ограждение: белые стойки с шарами; справа — короткая секция из штакетника и распахнутая створка, слева ограждение — сама стойка. Начало — середина проёма (x = X.fence).
  function fenceGate(g) {
    g.lineJoin = 'round';
    const white = (x0, x1) => A.linG(g, x0, 0, x1, 0, [[0, '#fffdf4'], [0.55, '#f1ead8'], [1, '#d4cab4']]);
    const post = (x) => {
      A.box(g, x - 7, -88, 14, 88, { fill: white(x - 7, x + 7), lw: 3, hi: 'rgba(255,255,255,0.4)' });
      A.box(g, x - 9.5, -94, 19, 8, { fill: '#f4ecda', lw: 2.8 });
      g.beginPath(); g.arc(x, -103, 7.4, 0, 6.283); g.fillStyle = white(x - 7, x + 7); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(x - 2.4, -106, 2.6, 1.8, -0.6, 0, 6.283); g.fill();
    };
    // секция справа (штакетник между перекладинами)
    const x0 = 34, x1 = 106;
    for (let x = x0 + 5; x < x1; x += 10) { g.beginPath(); g.moveTo(x - 3.4, 0); g.lineTo(x - 3.4, -56); g.lineTo(x, -63); g.lineTo(x + 3.4, -56); g.lineTo(x + 3.4, 0); g.closePath(); g.fillStyle = white(x - 3.4, x + 3.4); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); }
    A.box(g, x0, -50, x1 - x0, 6, { fill: '#f1ead8', lw: 2.6 }); A.box(g, x0, -18, x1 - x0, 6, { fill: '#f1ead8', lw: 2.6 });
    post(x1 + 3);
    // створка распахнута: торцом к зрителю, узкая скошенная панель у правой стойки
    g.beginPath(); g.moveTo(27, -6); g.lineTo(44, -13); g.lineTo(44, -72); g.lineTo(27, -65); g.closePath(); g.fillStyle = '#e4dcc6'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1.8; for (const t of [0.34, 0.67]) { g.beginPath(); g.moveTo(27 + 17 * t, -6 - 7 * t); g.lineTo(27 + 17 * t, -65 - 7 * t); g.stroke(); }
    post(27); post(-27);
    g.fillStyle = '#9a9aa4'; g.fillRect(20, -34, 4, 6); g.fillRect(20, -62, 4, 6);                      // петли
    A.shadow(g, 70, 3, 52, 0.2);
  }

  // Спортивная стойка: стальной каркас в два яруса, ряды гантелей (шестигранные блины торцом, от лёгких к тяжёлым), слева — стопка блинов.
  function weightRack(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const steel = (x0, x1) => A.linG(g, x0, 0, x1, 0, [[0, '#6a6e7e'], [0.35, '#3d404c'], [1, '#262833']]);
    // стопка и стоящий блин слева
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-92, -7 - i * 10, 25, 7.4, 0, 0, 6.283); g.fillStyle = A.linG(g, -118, 0, -66, 0, [[0, '#5a5e6c'], [0.5, '#3a3e4c'], [1, '#262833']]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(-114, -9 - i * 10, 22, 2); }
    g.beginPath(); g.ellipse(-92, -37, 11, 3.2, 0, 0, 6.283); g.fillStyle = '#1d1f28'; g.fill();
    // каркас: две стойки, три полки
    for (const x of [-64, 0, 64]) { A.box(g, x - 4, -90, 8, 90, { fill: steel(x - 4, x + 4), lw: 2.8, hi: 'rgba(255,255,255,0.25)' }); }
    for (const y of [-80, -44, -8]) A.box(g, -70, y, 140, 7, { fill: steel(-70, 70), lw: 2.8, hi: 'rgba(255,255,255,0.25)' });
    // гантели торцом: ряд шестигранников растущего размера
    const hex = (cx, cy, r) => {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
      g.fillStyle = A.linG(g, cx - r, cy - r, cx + r, cy + r, [[0, '#6e7384'], [0.5, '#3d404e'], [1, '#22242e']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.34, 0, 6.283); g.fillStyle = '#c4c6d4'; g.fill(); g.lineWidth = 1.6; g.stroke();
    };
    for (let i = 0; i < 6; i++) hex(-52 + i * 21, -80 - 9 - i * 0.6, 7.4 + i * 0.9);
    for (let i = 0; i < 5; i++) hex(-50 + i * 25, -44 - 11.5 - i * 0.5, 9.4 + i * 1.1);
    A.shadow(g, 0, 3, 108, 0.28);
  }

  // Ворота в живой изгороди (проём, X.gap): высокая шапка из подстриженной зелени с арочным просветом шириной 120, два шара-топиария; в просвете — светлая брусчатка аллеи, уходящая вглубь парка,
  // по сторонам деревья, свет в конце. Читается издалека: яркий светлый просвет в тёмно-зелёной шапке. Сюда уходит побеждённый Димасик (он идёт вглубь, уменьшается и тает).
  // Начало координат — середина проёма на линии кромки (y = 594); тело сцены рисует кромку и плиточный проход поверх нижнего края (слой земли).
  function gateway(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const OW = 60, OH0 = 80, OHC = 40, HW = 124, HH = 148, VP = -58;
    hedge(g, -HW, 0, HW * 2, HH, 99, null);
    for (const sx of [-1, 1]) crown(g, [[sx * 98, -HH - 5, 18]], HEDGE, 70 + sx, { lw: 3 });
    const opening = () => { g.beginPath(); g.moveTo(-OW, 6); g.lineTo(-OW, -OH0); g.ellipse(0, -OH0, OW, OHC, 0, Math.PI, 0); g.lineTo(OW, 6); g.closePath(); };
    g.save(); opening(); g.clip();
    A.gradV(g, -OW, -OH0 - OHC - 2, OW * 2, OH0 + OHC + 8, [[0, '#8fcaee'], [0.55, '#d6edf0'], [1, '#fdf4d6']]);
    A.glow(g, 0, VP - 2, 74, 'rgba(255,248,214,', 0.95);
    for (const [bx, by, br, c] of [[-40, -66, 22, '#79a984'], [-18, -76, 17, '#8db994'], [-54, -90, 24, '#6c9c7a'], [30, -68, 20, '#80ac8a'], [48, -86, 23, '#6a9a78'], [14, -82, 14, '#95c09b'], [-6, -70, 12, '#a3c8a6']]) { g.fillStyle = c; g.beginPath(); g.arc(bx, by, br, 0, 6.283); g.fill(); }
    // трава по сторонам дорожки
    for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 62, 8); g.lineTo(k * 56, 8); g.lineTo(k * 5, VP); g.lineTo(k * 62, VP - 4); g.closePath(); g.fillStyle = A.linG(g, 0, VP, 0, 8, [[0, '#a6d878'], [1, '#68ae4c']]); g.fill(); }
    // дорожка: светлая брусчатка, ряды ближе друг к другу к горизонту, лёгкая колея света
    g.beginPath(); g.moveTo(-56, 8); g.lineTo(56, 8); g.lineTo(5, VP); g.lineTo(-5, VP); g.closePath(); g.fillStyle = A.linG(g, 0, VP, 0, 8, [[0, '#fffadf'], [1, '#e9ddbb']]); g.fill();
    g.strokeStyle = 'rgba(150,118,84,0.3)'; g.lineWidth = 1.1;
    for (let k = 0; k < 12; k++) { const y = VP + 66 * Math.pow(0.78, k), hw = 5 + 51 * (y - VP) / 66; g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke(); }
    for (const sx of [-0.62, -0.2, 0.2, 0.62]) { g.beginPath(); g.moveTo(sx * 56, 8); g.lineTo(sx * 5, VP); g.stroke(); }
    g.strokeStyle = 'rgba(120,92,64,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-56, 8); g.lineTo(-5, VP); g.moveTo(56, 8); g.lineTo(5, VP); g.stroke();
    // фонарь и скамья в конце аллеи
    g.strokeStyle = '#2c2c36'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(13, VP + 1); g.lineTo(13, VP - 24); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(13, VP - 26, 3.6, 0, 6.283); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(43,26,32,0.7)'; g.stroke();
    g.fillStyle = '#3f7a58'; g.fillRect(-20, VP - 3, 11, 3.4); g.fillRect(-20, VP - 7, 11, 1.6);
    // стволы и кроны ближних деревьев по краям проёма (дальше от зрителя — тоньше и ниже)
    for (const k of [-1, 1]) {
      for (const [tx, tw, ty0, ty1, c0] of [[k * 47, 11, 10, -OH0 - OHC, '#4a3a30'], [k * 21, 5.4, VP + 6, -108, '#6a5648']]) {
        g.beginPath(); g.moveTo(tx - tw / 2, ty0); g.lineTo(tx - tw / 2 + k * 2, ty1); g.lineTo(tx + tw / 2 + k * 2, ty1); g.lineTo(tx + tw / 2, ty0); g.closePath();
        g.fillStyle = A.linG(g, tx - tw, 0, tx + tw, 0, [[0, c0], [1, '#2c211c']]); g.fill();
      }
      for (const [cx, cy, cr, c] of [[k * 52, -110, 30, '#5b9b4a'], [k * 30, -122, 28, '#6cae52'], [k * 58, -86, 22, '#4f8f44'], [k * 14, -118, 22, '#79bb5a'], [k * 34, -99, 14, '#6aac55']]) {
        g.fillStyle = c; g.beginPath(); g.arc(cx, cy, cr, 0, 6.283); g.fill(); g.fillStyle = 'rgba(214,246,150,0.35)'; g.beginPath(); g.ellipse(cx - cr * 0.3, cy - cr * 0.4, cr * 0.5, cr * 0.28, -0.5, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(20,58,36,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, cr - 1, 0.2, 2.8); g.stroke();
      }
    }
    g.restore();
    g.save(); opening(); g.clip(); g.lineWidth = 17; g.strokeStyle = 'rgba(24,72,40,0.6)'; opening(); g.stroke(); g.restore();             // толщина изгороди: тёмная кайма внутри арки
    g.save(); opening(); g.clip(); A.edge(g, -OW, -OH0 - OHC, OW * 2, 30, 't', 30, 'rgba(10,40,24,0.4)'); g.restore();
    opening(); g.lineWidth = 3.6; g.strokeStyle = OUT; g.stroke();
  }

  // =================================================================== шахматный стол со скамьями (владелец 03.10.2026)
  // Каменный стол с инкрустированной доской и фигурами; по бокам — встроенные бетонные скамьи без спинок, верх сиденья на 50 юн. над землёй. Основания скамей стоят на 40 юн. НИЖЕ линии героев (y = 640):
  // они ближе к зрителю, чем ноги идущих (y = 600), поэтому весь стол со скамьями — на переднем плане, одним спрайтом с z = 58 (выше героев, 54–55): герои проходят ЗА ним, нижнюю часть тела закрывает
  // передняя грань скамьи. Раньше он рисовался позади героев (z = 40) и они «ходили сквозь текстуры» (владелец 03.10.2026). Димасик (z = 53) сидит на правой скамье лицом влево: его стоячий кадр (158 юн.)
  // код опускает на 34 юн., нижнюю половину тела закрывает передняя грань правой скамьи — она часть того же спрайта, так что одинаково работает и пока он сидит, и когда он встал и ушёл.
  // Начало координат — на земле под столом (y = 600, линия героев).
  const SEAT_Y = -50, BENCH_FOOT = 40, BENCH_HW = 60;
  const stoneG = (g, x0, x1) => A.linG(g, x0, 0, x1, 0, [[0, '#c3c7d2'], [0.42, '#a0a4b2'], [1, '#6d7182']]);

  // Верхняя плоскость сиденья: узкий скошенный параллелограмм (тот же вид сверху-сбоку, что у столешницы); cx — середина скамьи
  function benchTop(g, cx) {
    const x0 = cx - BENCH_HW - 3, x1 = cx + BENCH_HW + 3;
    g.lineJoin = 'round'; g.beginPath(); g.moveTo(x0, SEAT_Y); g.lineTo(x1, SEAT_Y); g.lineTo(x1 - 6, SEAT_Y - 8); g.lineTo(x0 - 6, SEAT_Y - 8); g.closePath();
    g.fillStyle = A.linG(g, 0, SEAT_Y - 8, 0, SEAT_Y, [[0, '#e2e5ec'], [1, '#cbcfdb']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  }
  // Передняя грань скамьи: плита сиденья с фаской, балка под ней, две бетонные ножки и тёмный просвет между ними (под сиденьем тень, там же скрыты ноги сидящего);
  // от 50 юн. над землёй до 40 юн. ниже линии героев (подошвы опущенного кадра Димасика)
  function benchFront(g, cx) {
    g.lineJoin = 'round';
    const x0 = cx - BENCH_HW, x1 = cx + BENCH_HW, cap = 11, apr = 13, y1 = SEAT_Y + cap + apr, yb = BENCH_FOOT, LW = 25;
    // просвет: тень под сиденьем, внизу — земля в тени; дальние ножки чуть темнее фона
    g.fillStyle = A.linG(g, 0, y1, 0, yb, [[0, '#262838'], [0.45, '#3d4052'], [1, '#797886']]); g.fillRect(x0 + LW - 1, y1, x1 - x0 - 2 * LW + 2, yb - y1);
    g.fillStyle = 'rgba(30,32,48,0.55)'; g.fillRect(x0 + LW + 6, y1 + 2, 15, yb - y1 - 6); g.fillRect(x1 - LW - 21, y1 + 2, 15, yb - y1 - 6);
    A.edge(g, x0 + LW, y1, x1 - x0 - 2 * LW, 14, 't', 14, 'rgba(8,8,18,0.5)');
    g.strokeStyle = 'rgba(14,14,26,0.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + LW, y1); g.lineTo(x0 + LW, yb); g.moveTo(x1 - LW, y1); g.lineTo(x1 - LW, yb); g.stroke();
    // ножки: бетонные блоки с цоколем
    for (const lx of [x0, x1 - LW]) {
      g.fillStyle = stoneG(g, lx, lx + LW); g.fillRect(lx, y1 - 1, LW, yb - y1 - 6);
      g.save(); g.beginPath(); g.rect(lx, y1 - 1, LW, yb - y1 - 6); g.clip(); A.grain(g, lx, y1, LW, yb - y1, 0.2, 'overlay', Math.round(lx) + 73, 0.55);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(lx + 3, y1, 2.6, yb - y1); A.edge(g, lx, yb - 30, LW, 24, 'b', 24, 'rgba(20,22,40,0.28)'); g.restore();
      g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(lx, y1 - 1, LW, yb - y1 - 6);
      A.box(g, lx - 2.5, yb - 7, LW + 5, 7, { fill: '#5d6172', lw: 2.6, hi: 'rgba(255,255,255,0.14)' });
    }
    // балка под плитой и сама плита сиденья (светлая, с фаской и бликом)
    g.fillStyle = stoneG(g, x0, x1); g.fillRect(x0, SEAT_Y + cap - 1, x1 - x0, apr + 1);
    g.save(); g.beginPath(); g.rect(x0, SEAT_Y + cap - 1, x1 - x0, apr + 1); g.clip(); A.grain(g, x0, SEAT_Y + cap, x1 - x0, apr, 0.2, 'overlay', 74, 0.55); A.edge(g, x0, SEAT_Y + cap, x1 - x0, 9, 't', 9, 'rgba(20,22,40,0.34)'); g.restore();
    g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(x0, SEAT_Y + cap - 1, x1 - x0, apr + 1);
    A.box(g, x0 - 3.5, SEAT_Y, x1 - x0 + 7, cap, { fill: A.linG(g, 0, SEAT_Y, 0, SEAT_Y + cap, [[0, '#eceef4'], [1, '#bdc1ce']]), lw: 3, r: 3 });
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x0 + 2, SEAT_Y + 2, x1 - x0 - 4, 1.8);
    const R = A.rng(Math.round(cx) + 5); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(70,88,60,' + R.range(0.08, 0.15).toFixed(3) + ')'; g.beginPath(); g.ellipse(R.range(x0 + 8, x1 - 8), SEAT_Y + cap + R.range(3, 9), R.range(5, 12), R.range(1.4, 2.6), 0, 0, 6.283); g.fill(); }
  }

  // Шахматные фигуры: крошечные силуэты с контуром; (x, y) — центр основания; col — 'w' светлая, 'b' тёмная
  function piece(g, kind, x, y, col) {
    const w = col === 'w', fill = w ? '#f6eed8' : '#2e2832';
    g.lineWidth = 1.2; g.strokeStyle = OUT; g.fillStyle = fill; g.lineJoin = 'round';
    g.beginPath(); g.ellipse(x, y, 4.6, 1.8, 0, 0, 6.283); g.fill(); g.stroke();
    const body = (tw, bw, h) => { g.beginPath(); g.moveTo(x - bw, y); g.lineTo(x - tw, y - h); g.lineTo(x + tw, y - h); g.lineTo(x + bw, y); g.closePath(); g.fill(); g.stroke(); };
    if (kind === 'p') { body(1.4, 2.8, 5); g.beginPath(); g.arc(x, y - 6.8, 2.4, 0, 6.283); g.fill(); g.stroke(); }
    else if (kind === 'r') { body(2.5, 3.3, 8); g.beginPath(); g.rect(x - 3.8, y - 11.6, 7.6, 3.8); g.fill(); g.stroke(); g.fillStyle = w ? '#2b1a20' : '#8c8296'; for (const dx of [-2.5, 0.2, 2.9]) g.fillRect(x + dx - 0.5, y - 13.4, 1.1, 1.9); }
    else if (kind === 'n') { body(2.4, 3.3, 5.5); g.beginPath(); g.moveTo(x - 3, y - 5.5); g.lineTo(x - 3.6, y - 10.5); g.lineTo(x - 0.6, y - 13.4); g.lineTo(x + 3.4, y - 11.6); g.lineTo(x + 5, y - 9); g.lineTo(x + 3, y - 8.2); g.lineTo(x + 1.6, y - 9); g.lineTo(x + 2.6, y - 5.5); g.closePath(); g.fill(); g.stroke(); }
    else if (kind === 'b') { body(1.7, 3.1, 8); g.beginPath(); g.ellipse(x, y - 10.8, 2.6, 3.6, 0, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.arc(x, y - 14.8, 1.1, 0, 6.283); g.fill(); g.stroke(); }
    else if (kind === 'q') { body(2, 3.5, 9.5); g.beginPath(); g.moveTo(x - 3.8, y - 9.5); g.lineTo(x - 4.4, y - 14.4); g.lineTo(x - 2, y - 11.6); g.lineTo(x, y - 15.4); g.lineTo(x + 2, y - 11.6); g.lineTo(x + 4.4, y - 14.4); g.lineTo(x + 3.8, y - 9.5); g.closePath(); g.fill(); g.stroke(); }
    else { body(2, 3.5, 10); g.fillRect(x - 0.9, y - 16.4, 1.8, 6.4); g.fillRect(x - 2.4, y - 14.4, 4.8, 1.8); g.strokeRect(x - 0.9, y - 16.4, 1.8, 6.4); g.strokeRect(x - 2.4, y - 14.4, 4.8, 1.8); }
    g.fillStyle = w ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'; g.fillRect(x - 1.5, y - 6, 0.9, 3.4);
  }

  // Стол: тумба, плита (передняя грань и скошенная верхняя плоскость), доска 8×8 с фигурами. Начало — середина основания тумбы на линии героев.
  function chessTable(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 8, 5, 100, 0.3);
    // тумба на цоколе
    g.beginPath(); g.moveTo(-21, 3); g.lineTo(-15, -62); g.lineTo(15, -62); g.lineTo(21, 3); g.closePath(); g.fillStyle = stoneG(g, -21, 21); g.fill(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(-12, -58, 4, 54); g.fillStyle = 'rgba(30,32,48,0.28)'; g.fillRect(6, -58, 7, 56);
    A.box(g, -26, -9, 52, 12, { fill: stoneG(g, -26, 26), lw: 3, hi: 'rgba(255,255,255,0.3)' });
    // плита: передняя грань
    A.box(g, -66, -72, 132, 11, { fill: A.linG(g, 0, -72, 0, -61, [[0, '#d5d8e2'], [1, '#9b9fae']]), lw: 3.4, hi: 'rgba(255,255,255,0.4)' });
    A.edge(g, -66, -61, 132, 8, 't', 8, 'rgba(20,22,40,0.2)');
    // верхняя плоскость: параллелограмм (дальний край сдвинут влево), в нём доска
    const fx0 = -66, fx1 = 66, yf = -72, depth = 25, sh = -17;
    const bp = (u, v) => [fx0 + (fx1 - fx0) * u + sh * v, yf - depth * v];
    g.beginPath(); g.moveTo(...bp(0, 0)); g.lineTo(...bp(1, 0)); g.lineTo(...bp(1, 1)); g.lineTo(...bp(0, 1)); g.closePath(); g.fillStyle = A.linG(g, 0, yf - depth, 0, yf, [[0, '#c2c6d2'], [1, '#a9adbb']]); g.fill(); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
    const U0 = 0.1, U1 = 0.9, V0 = 0.09, V1 = 0.91;
    const quad = (u0, v0, u1, v1) => { g.beginPath(); g.moveTo(...bp(u0, v0)); g.lineTo(...bp(u1, v0)); g.lineTo(...bp(u1, v1)); g.lineTo(...bp(u0, v1)); g.closePath(); };
    quad(U0 - 0.025, V0 - 0.05, U1 + 0.025, V1 + 0.05); g.fillStyle = '#7a5a40'; g.fill();
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { quad(U0 + (U1 - U0) * c / 8, V0 + (V1 - V0) * r / 8, U0 + (U1 - U0) * (c + 1) / 8, V0 + (V1 - V0) * (r + 1) / 8); g.fillStyle = (r + c) % 2 ? '#4a4048' : '#efe6cf'; g.fill(); }
    quad(U0 - 0.025, V0 - 0.05, U1 + 0.025, V1 + 0.05); g.lineWidth = 1.6; g.strokeStyle = 'rgba(43,26,32,0.8)'; g.stroke();
    // фигуры: сначала дальние
    const PCS = [['k', 7, 4, 'b'], ['q', 5, 2, 'b'], ['r', 6, 6, 'b'], ['b', 4, 0, 'b'], ['p', 6, 3, 'b'], ['p', 4, 4, 'b'], ['k', 0, 3, 'w'], ['q', 3, 5, 'w'], ['r', 1, 7, 'w'], ['n', 2, 1, 'w'], ['p', 1, 4, 'w'], ['p', 2, 5, 'w']];
    PCS.map(([k, c, r, col]) => ({ k, col, p: bp(U0 + (U1 - U0) * (c + 0.5) / 8, V0 + (V1 - V0) * (r + 0.5) / 8) })).sort((a, b) => a.p[1] - b.p[1]).forEach((o) => piece(g, o.k, o.p[0], o.p[1], o.col));
    // блики на камне плиты
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(...bp(0.02, 0.03)); g.lineTo(...bp(0.98, 0.03)); g.stroke();
  }

  // =================================================================== машина
  // Чёрный Mercedes-Maybach с надписью Uber на задней двери (владелец 03.10.2026: «такси везде в игре — Uber»): рисунок и анимация (колёса, свет фар, дверь, салон) — в car_art.js, общий с Монако.
  // Состояние сцены — sc.taxi = { dx, door }: dx — смещение вправо в юнитах (0 в покое, растёт, когда машина уезжает), door — 0…1, насколько открыта задняя левая дверь.

  // Спортивная сумка Димасика у правой скамьи: тёмная, с красной полосой и лямками (лежит на земле)
  function sportBag(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    A.shadow(g, 2, 3, 30, 0.3);
    g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(-9, -17); g.quadraticCurveTo(-4, -30, 6, -17); g.stroke(); g.strokeStyle = '#3a3640'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.moveTo(-23, 0); g.quadraticCurveTo(-27, -10, -21, -19); g.lineTo(21, -19); g.quadraticCurveTo(27, -10, 23, 0); g.closePath();
    g.fillStyle = A.linG(g, 0, -19, 0, 0, [[0, '#4a4656'], [1, '#2c2934']]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#c8333f'; g.fillRect(-23, -12, 46, 5); g.strokeStyle = 'rgba(43,26,32,0.7)'; g.lineWidth = 1.6; g.strokeRect(-23, -12, 46, 5);
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-17, -17); g.lineTo(10, -17); g.stroke();
    g.fillStyle = '#cfd2de'; g.fillRect(13, -9, 4, 3);
  }

  // Оформление площадки: детали-спрайты в мировых координатах. Слева (дорожка парка) — большое дерево, фонарь, скамья, урна, клумба; шахматный стол со скамьями; стойка «Игры в парке»;
  // ограждение с калиткой, спортивная стойка; машина Uber на асфальте справа (рисуется целиком, без кустов; состояние — sc.taxi = { dx, door }).
  // Слева от стойки (X0 + 20 … X0 + 110) ничего нет: там стоят Илюшкинс и Бубел.
  KA.courtDecor = function (X, sc) {
    const out = [];
    const put = (x, z, w, h, ox, oy, scale, fn, shadow) => { const spr = sprite(w, h, ox, oy, scale, fn); out.push({ x, z, draw: (ctx) => { if (shadow) A.shadow(ctx, x, WALL + 2, shadow[0], shadow[1]); spr(ctx, x, WALL); } }); };
    put(X.stand, 26, 210, 300, 105, 294, 1.7, stall, [118, 0.3]);
    put(X.fence, 30, 190, 130, 95, 124, 2, fenceGate, null);
    put(X.rack, 20, 190, 120, 105, 112, 2, weightRack, null);
    // ---- шахматный стол и обе скамьи — один спрайт на переднем плане (z = 58, выше героев и Димасика): основания скамей ниже линии ходьбы, герои проходят за ними
    const dl = X.seatLeft - X.chess, dr = X.seat - X.chess;
    const setB = sprite(340, 186, 170, 118, 1.9, (g) => { chessTable(g); A.shadow(g, dl + 3, BENCH_FOOT + 3, 84, 0.3); A.shadow(g, dr + 3, BENCH_FOOT + 3, 84, 0.3); benchTop(g, dl); benchFront(g, dl); benchTop(g, dr); benchFront(g, dr); });          // скамьи ближе к зрителю, чем стол: рисуются поверх цоколя тумбы
    out.push({ x: X.chess, z: 58, draw: (ctx) => setB(ctx, X.chess, FY) });
    const bagS = sprite(70, 50, 35, 40, 2, (g) => sportBag(g));
    out.push({ x: X.seat + 104, z: 58, draw: (ctx) => bagS(ctx, X.seat + 104, FY + 22) });          // сумка лежит ближе линии ходьбы (y = 622): герои проходят за ней
    // ---- машина Uber (Maybach): целиком, без кустов; колёса, дверь и фары — по sc.taxi
    const car = Ale.CarArt.sprite(dens(2));
    out.push({ x: X.car, z: 26, draw: (ctx) => car.draw(ctx, X.car, WALL + 8, sc && sc.taxi) });
    // ---- слева — дорожка парка: большое дерево, фонарь, скамья, урна, клумба (первое, что видно при входе)
    const tA = sprite(360, 520, 180, 508, dens(1.7), (g) => broadleaf(g, 0, 0, 1.12, 61, { trunk: 150, rx: 134, ry: 120, lean: -12, tw: 30 }));
    out.push({ x: 60, z: 16, draw: (ctx) => { A.shadow(ctx, 60, WALL + 3, 130, 0.24); tA(ctx, 60, WALL + 4, false); } });
    const trX = (X.width || 2600) - 70;
    out.push({ x: trX, z: 12, draw: (ctx) => { A.shadow(ctx, trX, WALL + 3, 130, 0.24); tA(ctx, trX, WALL + 4, true); } });                   // справа — то же дерево позади машины (стоит за её носом)
    const lampS = sprite(170, 360, 85, 352, dens(1.7), (g) => lamp(g, 0, 0, 1));
    for (const lx of [232, X.chess + 262]) out.push({ x: lx, z: 24, draw: (ctx) => { A.shadow(ctx, lx, WALL + 4, 32, 0.3); lampS(ctx, lx, WALL + 4); } });
    const benchS = sprite(170, 124, 85, 116, 2, (g) => bench(g, 1));
    out.push({ x: 130, z: 22, draw: (ctx) => { A.shadow(ctx, 130, WALL + 2, 88, 0.28); benchS(ctx, 130, WALL); } });
    const binS = sprite(60, 70, 30, 62, 2, (g) => bin(g));
    out.push({ x: 276, z: 21, draw: (ctx) => { A.shadow(ctx, 276, WALL + 2, 22, 0.26); binS(ctx, 276, WALL); } });
    const bedS = sprite(190, 60, 15, 50, 1.6, (g) => bed(g, 160, 91));
    out.push({ x: 380, z: 17, draw: (ctx) => bedS(ctx, 304, WALL + 2) });
    // ---- голуби на плитке
    const pg = [sprite(50, 40, 25, 34, 3, (g) => pigeon(g, 0)), sprite(50, 40, 25, 34, 3, (g) => pigeon(g, 1))];
    for (const [x, ph, flip] of [[476, 0.3, false], [900, 1.4, true], [X.gap + 96, 2.2, true]]) out.push({ x, z: 21, draw: (ctx, t) => pg[Math.floor(t * 1.5 + ph * 2) % 4 === 0 ? 1 : 0](ctx, x, WALL + 12, flip) });
    // ---- живинка: бабочки над клумбой и у ворот, по три листа у больших деревьев
    for (const [bx, ph, col] of [[400, 1.3, '#ffe45c'], [X.gap - 80, 3.4, '#f58aa6']]) out.push({ x: bx, z: 40, draw: (ctx, t) => wing(ctx, bx + 46 * Math.sin(t * 0.55 + ph) + 14 * Math.sin(t * 1.7 + ph), WALL - 92 + 22 * Math.sin(t * 0.9 + ph * 1.3) + 5 * Math.sin(t * 3.1), col, t * 17 + ph) });
    for (const tx of [60, trX]) for (let k = 0; k < 3; k++) out.push({ x: tx, z: 44, draw: (ctx, t) => fallingLeaf(ctx, t, tx, k) });
    return out;
  };
  // Передний план поверх героев: ничего, что закрывает героев, проём или машину (владелец 03.10.2026: «такси за кустом, видна лишь часть»)
  KA.courtFront = function (X) { return []; };
})();
