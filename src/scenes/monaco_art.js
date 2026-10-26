// Монако, берег и комната-сюрприз: оформление сцен monacoStreet, monacoCasino, coast, birthdayRoom. Рисуется кодом в манере Парижа и Киева: тёмный тёплый контур, плоские цвета с мягкими градиентами,
// зерно и пятна, свет сверху-слева, дальние планы в дымке; время суток — тёплый послеполуденный свет, золотой час («Тёплый день у моря» на плашке переезда). Картинок из файлов нет: всё кодом и уже существующими спрайтами (it_chip, it_cash, it_remote, it_tea).
// Файлы: monaco_art.js — общие кисти (Ale.MonacoArt.kit: цвет, спрайты, небо, пальмы и кусты, окна, балюстрада, колонны, ограда, флаги, надписи); monaco_art_street.js — улица у казино; monaco_art_casino.js — зал и автоматы;
// monaco_art_coast.js — берег; monaco_art_room.js — комната-сюрприз.
// Контракт со сценами (то же, что Ale.KyivArt): <имя>Layers(game, WIDTH, X) → слои (строятся один раз), <имя>Back(ctx, cam, game, sc, L) — фон на кадр, <имя>Decor(X, sc) → [{ x, z, name, draw(ctx, t) }]
// (рисуется на своей глубине z вместе с героями: z < 54 — позади героев, z > 54 — перед ними), <имя>Front(X, sc) → то же для переднего плана (вода берега, колонны). Живое состояние сцены читается из полей sc:
//   street: sc.taxi = { dx, door }, sc.gate = { open } (ограда перед такси: 1 — убрана), sc.thiefNear — флаг для косметики; casino: sc.slot = { stage, lever, spin, glow, pack, insert, coins };
//   coast: sc.coast = { waterY, caveGlow }; room: sc.room = { candles, portal, remote, banner }.
// Устройство (как в Киеве): неподвижное собрано один раз в слои (A.layer: параллакс дальних планов, земля, спрайты-«детали»), в кадре — только копирование; живое (вода, огни, колёса, флаги, дым, чайки,
// свечи) — малым числом контуров и только в видимой части сцены. Случайность — только Ale.Rng через A.rng(seed) внутри слоёв; живое на кадр считается по времени t (sc.time), без Math.random и часов.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const MA = (Ale.MonacoArt = Ale.MonacoArt || {});
  const FY = 600, WALL = 584, TAU = 6.283185307;
  // На сенсорных экранах спрайты и слои строятся легче: память Safari на iOS ограничена
  const dens = (s) => s * ((Ale.Touch && Ale.Touch.active) ? 0.8 : 1);

  // =================================================================== цвет
  const hex2 = (v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
  const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  // Смешение двух цветов #rrggbb (результат — тоже #rrggbb, поэтому смеси можно смешивать): t = 0 — первый, 1 — второй
  function mix(a, b, t) { const p = rgb(a), q = rgb(b); return '#' + hex2(p[0] + (q[0] - p[0]) * t) + hex2(p[1] + (q[1] - p[1]) * t) + hex2(p[2] + (q[2] - p[2]) * t); }
  const lighter = (c, t) => mix(c, '#fff4d8', t), darker = (c, t) => mix(c, '#2a1424', t);
  const rgba = (c, a) => { const p = rgb(c); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')'; };
  // Тот же набор красок, затянутый дымкой цвета col на долю t
  function hazed(P, t, col) { const o = Object.assign({}, P); for (const k of ['hi', 'mid', 'lo']) if (P[k]) o[k] = mix(P[k], col, t); return o; }
  // Шум по времени без Math.random: детерминированное «мерцание» огоньков и свечей
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // =================================================================== служебное
  // Ширина слоя с параллаксом k: достаточно для любого вида до 1700 юн. (cam.x*k + ширина вида)
  const par = (WIDTH, k) => Math.ceil(WIDTH * k + 1700 * (1 - k)) + 6;
  // Ошибка отрисовки не должна пропасть молча: сохраняется в Ale.MonacoArt.lastError (читается из проверок и отладки), затем летит дальше
  function guard(name, fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { MA.lastError = name + ': ' + (e && e.message || e) + ' @ ' + String(e && e.stack || '').split('\n').slice(0, 4).join(' | '); throw e; } }; }
  // Спрайт сцены: рисуется один раз в слой; (ox, oy) — точка опоры в юнитах слоя. Возвращает функцию (ctx, x, y, flip, scale); у неё же поле L — сам слой
  function sprite(w, h, ox, oy, scale, fn) {
    const L = A.layer(w, h, (g) => { g.translate(ox, oy); fn(g); }, scale);
    const draw = (ctx, x, y, flip, s) => {
      if (!L.c.width) return;
      if (flip || (s && s !== 1)) { ctx.save(); ctx.translate(x, y); ctx.scale((flip ? -1 : 1) * (s || 1), s || 1); ctx.drawImage(L.c, -ox, -oy, L.w, L.h); ctx.restore(); }
      else ctx.drawImage(L.c, x - ox, y - oy, L.w, L.h);
    };
    draw.L = L; draw.ox = ox; draw.oy = oy;
    return draw;
  }
  // Находится ли полоса [x - hw, x + hw] (мировые координаты) в видимой части сцены (с запасом)
  function onScreen(sc, x, hw) {
    const c = sc && sc.lastCam; if (!c) return true;
    const W = (sc.game && sc.game.viewW) || 1700;
    return x + hw > c.x - 60 && x - hw < c.x + W + 60;
  }
  // Добавить деталь в список: рисуется только в видимой части (иначе каждый кадр рисовались бы все детали сцены)
  function deco(out, sc, name, x, z, hw, draw) { out.push({ x, z, name, draw: guard(name, (ctx, t) => { if (onScreen(sc, x, hw)) draw(ctx, t); }) }); }

  // =================================================================== небо
  const SKY = [[0, '#4a9de4'], [0.42, '#86c5ec'], [0.78, '#cde6ef'], [1, '#f9e6c4']];
  function skyFill(ctx, W, H) { A.gradV(ctx, 0, 0, W, H || 460, SKY); }
  // Кучевое облако: плоское основание, пухлая верхушка, тёплая подсветка сверху-слева и холодная тень снизу; без контура
  function cloud(g, x, y, w, R, warm) {
    const pad = 8, ww = Math.ceil(w + pad * 2), hh = Math.ceil(w * 0.34 + pad), by = hh - pad * 0.5;
    const c = document.createElement('canvas'); c.width = ww; c.height = hh;
    const t = c.getContext('2d'), n = 7 + R.int(0, 3), h = w * 0.2;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, r = w * (0.07 + 0.09 * Math.sin(u * Math.PI)) * R.range(0.85, 1.2), bx = ww / 2 + (u - 0.5) * w * 0.88, cy = by - r * 0.62;
      const gr = t.createRadialGradient(bx - r * 0.2, cy - r * 0.35, r * 0.1, bx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.98)'); gr.addColorStop(0.7, 'rgba(255,252,246,0.93)'); gr.addColorStop(1, 'rgba(244,240,238,0.85)');
      t.fillStyle = gr; t.beginPath(); t.arc(bx, cy, r, 0, TAU); t.fill();
    }
    t.globalCompositeOperation = 'destination-out'; t.fillRect(0, by, ww, hh);
    t.globalCompositeOperation = 'source-atop'; t.fillStyle = A.linG(t, 0, by - h, 0, by, [[0, 'rgba(206,176,176,0)'], [1, rgba(warm || '#e9b79a', 0.5)]]); t.fillRect(0, by - h, ww, h + 1);
    g.drawImage(c, x - ww / 2, y - by, ww, hh);
    c.width = 0; c.height = 0;
  }
  // Небесный слой: тёплый солнечный ореол и облака; плывёт медленно (параллакс 0,08)
  function skyLayer(w, h, seed, sunX, sunY) {
    return A.layer(w, h, (g) => {
      const R = A.rng(seed);
      A.glow(g, sunX, sunY === undefined ? 150 : sunY, 460, 'rgba(255,236,190,', 0.75);
      A.glow(g, sunX, sunY === undefined ? 150 : sunY, 150, 'rgba(255,248,220,', 0.7);
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = A.linG(g, 0, h * 0.5, 0, h, [[0, '#000'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';       // ореол растворяется к нижней кромке слоя: раньше он обрывался жёсткой горизонтальной линией поперёк неба (её видно в просветах между деревьями и крышами)
      for (let i = 0; i < 8; i++) cloud(g, R.range(0, w), R.range(60, h - 70), R.range(170, 340), R);
      g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1.8; g.lineCap = 'round';
      for (const [bx, by, bs] of [[0.14, 128, 1], [0.165, 140, 0.8], [0.52, 200, 0.9], [0.78, 104, 1], [0.8, 116, 0.75]]) { const x = bx * w; g.beginPath(); g.moveTo(x - 7 * bs, by - 3 * bs); g.quadraticCurveTo(x - 3 * bs, by - 5 * bs, x, by); g.quadraticCurveTo(x + 3 * bs, by - 5 * bs, x + 7 * bs, by - 3 * bs); g.stroke(); }
    }, 1);
  }

  // =================================================================== листва: кусты, круглые кроны
  // Крона из кругов-«клубов»: общий контур, шаровая заливка каждого клуба (свет сверху-слева), дуги-листья, тень на нижней кромке, зерно.
  // blobs — [x, y, r], порядок сверху вниз; P — краски {hi, mid, lo, edge, dark, light}; o.line — цвет контура, o.lw — толщина
  const LEAF = { hi: '#b4e07a', mid: '#64b04c', lo: '#3a7c3e', edge: 'rgba(20,58,36,0.5)', dark: 'rgba(20,64,38,0.4)', light: 'rgba(222,250,156,0.45)' };
  const DEEP = { hi: '#5e9a5c', mid: '#34724c', lo: '#1f503a', edge: 'rgba(10,36,30,0.55)', dark: 'rgba(10,40,32,0.45)', light: 'rgba(150,206,140,0.32)' };
  const OLIVE = { hi: '#b7c98a', mid: '#8aa66a', lo: '#5c7a52', edge: 'rgba(30,58,40,0.5)', dark: 'rgba(36,62,44,0.4)', light: 'rgba(236,244,196,0.5)' };
  function crown(g, blobs, P, seed, o) {
    o = o || {};
    const R = A.rng(seed);
    let top = 1e9, bot = -1e9, lf = 1e9, rt = -1e9;
    for (const [x, y, r] of blobs) { top = Math.min(top, y - r); bot = Math.max(bot, y + r); lf = Math.min(lf, x - r); rt = Math.max(rt, x + r); }
    const core = o.core || [(lf + rt) / 2, (top + bot) / 2, (rt - lf) * 0.3, (bot - top) * 0.3];
    g.fillStyle = o.line || OUT;
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + (o.lw || 3.2), 0, TAU); g.fill(); }
    const uni = () => { g.beginPath(); for (const [x, y, r] of blobs) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.moveTo(core[0] + core[2], core[1]); g.ellipse(core[0], core[1], core[2], core[3], 0, 0, TAU); };
    uni(); g.fillStyle = A.linG(g, 0, top, 0, bot, [[0, P.hi], [0.5, P.mid], [1, P.lo]]); g.fill();
    for (const [x, y, r] of blobs) {
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
      const gr = g.createRadialGradient(x - r * 0.34, y - r * 0.42, r * 0.04, x, y, r * 1.1);
      gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.mid); gr.addColorStop(1, P.lo);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      const n = Math.round(r / 2.6);
      for (let i = 0; i < n; i++) {
        const lx = x + R.range(-0.8, 0.8) * r, ly = y + R.range(-0.8, 0.8) * r, shade = ly > y + r * 0.1 || lx > x + r * 0.35;
        g.strokeStyle = shade ? P.dark : P.light; g.lineWidth = Math.max(1.1, r * 0.05);
        const a0 = R.range(0, TAU);
        g.beginPath(); g.arc(lx, ly, R.range(2.6, 5.2) * Math.max(0.8, r / 30), a0, a0 + R.range(1.3, 2.1)); g.stroke();
      }
      g.strokeStyle = P.edge; g.lineWidth = Math.max(1.8, r * 0.075); g.beginPath(); g.arc(x, y, r - 1.2, 0.16 * Math.PI, 0.84 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,255,230,0.14)'; g.beginPath(); g.ellipse(x - r * 0.36, y - r * 0.44, r * 0.3, r * 0.17, -0.6, 0, TAU); g.fill();
      g.restore();
    }
    g.save(); uni(); g.clip(); A.grain(g, lf, top, rt - lf, bot - top, 0.12, 'overlay', seed + 1, 0.6); g.restore();
  }
  // Облако клубов в эллипсе (rx, ry): центральный клуб, кольцо ядра и кольцо по краю
  function blobsIn(R, rx, ry, nCore, nEdge) {
    const out = [[R.range(-0.05, 0.05) * rx, R.range(-0.05, 0.05) * ry, rx * 0.4]];
    for (let i = 0; i < nCore; i++) { const a = (i / nCore) * TAU + R.range(-0.3, 0.3), d = R.range(0.38, 0.56); out.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * R.range(0.27, 0.36)]); }
    for (let i = 0; i < nEdge; i++) { const a = (i / nEdge) * TAU + R.range(-0.18, 0.18), d = R.range(0.74, 0.92); out.push([Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * R.range(0.17, 0.27)]); }
    return out.sort((p, q) => p[1] - q[1]);
  }
  // Куст / круглая стриженая крона с центром (cx, cy)
  function bush(g, cx, cy, rx, ry, P, seed, o) {
    const R = A.rng(seed);
    crown(g, blobsIn(R, rx, ry, 7, 11).map(([x, y, r]) => [cx + x, cy + y, r]), P, seed, o);
  }
  // Купол куста, обрезанный по линии земли base (низ плоский)
  function mound(g, x, base, rx, ry, P, seed, o) {
    g.save(); g.beginPath(); g.rect(x - rx * 1.6, base - ry * 2.8, rx * 3.2, ry * 2.8 + 2); g.clip();
    bush(g, x, base - ry * 0.55, rx, ry, P, seed, o);
    g.restore();
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
    path(); g.fillStyle = A.linG(g, x - w * 0.6, 0, x + w * 0.6, 0, [[0, '#8a7058'], [0.35, '#6a5240'], [1, '#3a2c24']]); g.fill();
    g.save(); path(); g.clip();
    for (let i = 0; i < Math.max(3, w / 4); i++) { const bx = x + R.range(-0.45, 0.45) * w; g.strokeStyle = 'rgba(30,20,16,' + R.range(0.2, 0.42).toFixed(2) + ')'; g.lineWidth = R.range(1, 2.4); g.beginPath(); g.moveTo(bx, base); for (let k = 1; k <= 6; k++) { const t = k / 6; g.lineTo(bx + lean * t * t + Math.sin(k * 1.7 + i) * 1.8, base - h * t); } g.stroke(); }
    g.fillStyle = 'rgba(255,224,176,0.16)'; g.fillRect(x - w * 0.5, base - h, w * 0.14, h);
    g.restore();
    path(); g.lineWidth = 3; g.strokeStyle = line || OUT; g.lineJoin = 'round'; g.stroke();
  }

  // Туя / кипарис: тёмный плотный столб из клубов, узкий кончик. h — высота, w — полуширина у основания
  function cypress(g, x, base, h, w, seed, P, o) {
    const R = A.rng(seed);
    g.save(); g.translate(x, base);
    const blobs = [], n = Math.round(h / 18);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), r = w * (0.4 + 0.6 * Math.pow(Math.sin(Math.min(1, t * 1.1 + 0.08) * Math.PI * 0.95), 0.7)) * (1 - t * 0.55) * R.range(0.9, 1.1), cy = -(t * (h - 26) + 20);
      blobs.push([R.range(-2, 2) - r * 0.26, cy, r * 0.62], [R.range(-2, 2) + r * 0.3, cy + R.range(-4, 4), r * 0.62]);
    }
    blobs.push([0, -h + 16, w * 0.2]);
    blobs.sort((p, q) => p[1] - q[1]);
    g.fillStyle = '#3a2a22'; g.fillRect(-3.5, -10, 7, 12);
    crown(g, blobs, P || DEEP, seed, Object.assign({ lw: 2.6 }, o || {}));
    g.restore();
  }

  // Зонтичная сосна (пиния): косой тёмный ствол и плоская «шапка» из клубов — типичный силуэт Лазурного берега. (x, base) — низ ствола
  function pine(g, x, base, h, rx, seed, P, o) {
    o = o || {};
    const R = A.rng(seed), lean = o.lean === undefined ? R.range(-22, 22) : o.lean;
    trunk(g, x, base, h, o.tw || 16, lean, o.line);
    const topx = x + lean, topy = base - h;
    g.lineCap = 'round';
    for (const k of [-1, 0.1, 1]) { g.strokeStyle = o.line || OUT; g.lineWidth = 9; g.beginPath(); g.moveTo(topx, topy + 8); g.quadraticCurveTo(topx + k * rx * 0.3, topy - 8, topx + k * rx * 0.62, topy - 22); g.stroke(); g.strokeStyle = '#5a4636'; g.lineWidth = 4.6; g.stroke(); }
    const blobs = [];
    for (let i = 0; i < 9; i++) { const u = i / 8, bx = topx + (u - 0.5) * rx * 1.7 + R.range(-6, 6), by = topy - 22 - Math.sin(u * Math.PI) * rx * 0.22 + R.range(-4, 6); blobs.push([bx, by, rx * (0.2 + 0.1 * Math.sin(u * Math.PI)) * R.range(0.9, 1.15)]); }
    for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6; blobs.push([topx + (u - 0.5) * rx * 1.3 + R.range(-5, 5), topy - 22 + rx * 0.06 + R.range(-3, 5), rx * R.range(0.15, 0.22)]); }
    blobs.sort((p, q) => p[1] - q[1]);
    crown(g, blobs, P || { hi: '#7fb064', mid: '#46823f', lo: '#265a36', edge: 'rgba(10,44,28,0.55)', dark: 'rgba(10,48,28,0.45)', light: 'rgba(190,230,140,0.4)' }, seed, { line: o.line, lw: 2.8 });
  }

  // Клумба цветов: холмик листвы и шарики цветков (герань, бегония, сальвия); w — ширина, основание на линии base
  function flowerBed(g, x, base, w, seed, o) {
    o = o || {};
    const R = A.rng(seed), cols = o.cols || ['#e63b4a', '#f5708a', '#fff0e0', '#f4a838'], hgt = o.h || 22;
    const n = Math.round(w / 10);
    g.fillStyle = '#3f7a3c'; g.beginPath(); g.moveTo(x, base);
    for (let i = 0; i <= n; i++) g.lineTo(x + i * w / n, base - hgt * 0.45 - Math.sin(i * 1.7 + seed) * 3 - R.range(0, 4));
    g.lineTo(x + w, base); g.closePath(); g.fill();
    for (let i = 0; i < n * 2; i++) {
      const fx = x + R.range(2, w - 2), fy = base - R.range(3, hgt), r = R.range(3.4, 5.6), c = R.pick(cols);
      g.fillStyle = c; g.beginPath(); g.arc(fx, fy, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,20,24,0.55)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(fx - r * 0.3, fy - r * 0.35, r * 0.38, 0, TAU); g.fill();
    }
  }

  // Бугенвиллея: зелёная масса листьев и россыпь пурпурных прицветников (малиновые «бумажные» цветки Лазурного берега); прямоугольник (x, top) — (x + w, base)
  function bougainvillea(g, x, top, w, h, seed, o) {
    o = o || {};
    const R = A.rng(seed), cols = o.cols || ['#d8348c', '#e8559e', '#b82878', '#f27ab4'];
    const n = Math.round(w * h / 90);
    for (let i = 0; i < n; i++) {
      const lx = x + R.range(0, w), ly = top + R.range(0, h) * R.range(0.4, 1);
      g.fillStyle = R.pick(['#3f7a3c', '#4f8f46', '#2f6a38']); g.beginPath(); g.ellipse(lx, ly, R.range(3.4, 6.4), R.range(2, 3.4), R.range(0, 3), 0, TAU); g.fill();
    }
    for (let i = 0; i < n * 0.8; i++) {
      const fx = x + R.range(0, w), fy = top + R.range(0, h) * R.range(0.3, 1), r = R.range(2.6, 4.6);
      g.fillStyle = R.pick(cols); g.beginPath(); g.arc(fx, fy, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(fx - r * 0.3, fy - r * 0.3, r * 0.45, 0, TAU); g.fill();
    }
  }

  // =================================================================== пальмы
  // Пальма — два спрайта: ствол (неподвижный) и крона (качается в такт ветру вокруг вершины ствола). K.palm({ h, R, seed, lean, pal, line }) → { draw(ctx, x, base, t, flip), topX, topY }
  const PALM = { hi: '#b2e06e', mid: '#58a84a', lo: '#2a6a3c', rib: 'rgba(240,250,176,0.55)', edge: 'rgba(14,52,34,0.7)' };
  function palmFrond(g, th, L, bend, wmax, P, R, leaflets) {
    const N = 26, side = Math.cos(th) >= 0 ? -1 : 1, pts = [];
    let x = 0, y = 0;
    pts.push([0, 0]);
    for (let i = 1; i <= N; i++) { const t = i / N, ph = th + side * bend * Math.pow(t, 1.25); x += Math.cos(ph) * L / N; y -= Math.sin(ph) * L / N; pts.push([x, y]); }
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, t = i / N;
      const w = i === N ? 0 : wmax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)), 0.8), jl = i % 2 ? 0.62 : 1, jr = i % 2 ? 1 : 0.62;
      left.push([pts[i][0] + nx * w * jl, pts[i][1] + ny * w * jl]); right.push([pts[i][0] - nx * w * jr, pts[i][1] - ny * w * jr]);
    }
    g.beginPath(); g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= N; i++) g.lineTo(left[i][0], left[i][1]);
    for (let i = N - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    const end = pts[N];
    g.fillStyle = A.linG(g, 0, 0, end[0], end[1], [[0, P.lo], [0.45, P.mid], [1, P.hi]]); g.fill();
    g.lineWidth = 1.7; g.strokeStyle = P.edge; g.lineJoin = 'round'; g.stroke();
    if (leaflets) {                                                                          // жилки перьев: короткие штрихи от стебля к краю
      g.strokeStyle = 'rgba(14,56,34,0.3)'; g.lineWidth = 1; g.beginPath();
      for (let i = 2; i < N; i++) { g.moveTo(pts[i][0], pts[i][1]); g.lineTo(left[i][0] * 0.95 + pts[i][0] * 0.05, left[i][1] * 0.95 + pts[i][1] * 0.05); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(right[i][0] * 0.95 + pts[i][0] * 0.05, right[i][1] * 0.95 + pts[i][1] * 0.05); }
      g.stroke();
    }
    g.strokeStyle = P.rib; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i <= N - 1; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke();
  }
  // Крона: опахала расходятся от центра (0, 0); R — длина самых длинных
  function palmCrown(g, R0, seed, P, leaflets) {
    const R = A.rng(seed), fr = [];
    const n = 17;
    for (let i = 0; i < n; i++) {
      const u = (i + R.range(-0.3, 0.3)) / (n - 1);
      const th = (-0.3 + u * 3.74) + R.range(-0.08, 0.08);                                                  // от −17° (вправо, вниз) через вверх до 197° (влево, вниз)
      const up = Math.sin(th);                                                                                // 1 — прямо вверх
      fr.push({ th, L: R0 * R.range(0.82, 1.06) * (0.78 + 0.22 * Math.min(1, Math.abs(up) + 0.35)), bend: R.range(0.8, 1.35) + (1 - Math.abs(up)) * 0.55, shade: 0.35 + 0.65 * Math.max(0, up) * R.range(0.7, 1) });
    }
    for (let i = 0; i < 4; i++) { const th = R.pick([-1, 1]) > 0 ? R.range(-1.0, -0.55) : R.range(Math.PI + 0.55, Math.PI + 1.0); fr.push({ th, L: R0 * R.range(0.55, 0.72), bend: R.range(0.5, 0.9), shade: 0.08 }); }   // нижние, свисающие
    fr.sort((a, b) => a.shade - b.shade);
    for (const f of fr) {
      g.save(); const c = mix(P.lo, P.hi, f.shade * 0.8);
      palmFrond(g, f.th, f.L, f.bend, R0 * 0.155, { lo: mix(P.lo, '#0e3a28', 0.3), mid: c, hi: mix(c, P.hi, 0.5), rib: P.rib, edge: P.edge }, R, leaflets);
      g.restore();
    }
    for (let i = 0; i < 5; i++) { const th = 1.57 + (i - 2) * 0.16; g.save(); palmFrond(g, th, R0 * R.range(0.34, 0.46), 0.5 * (i - 2) * 0.4 + 0.35, R0 * 0.07, { lo: P.mid, mid: mix(P.mid, P.hi, 0.5), hi: P.hi, rib: P.rib, edge: P.edge }, R, false); g.restore(); }       // молодые стрелы в сердцевине
    // гроздья фиников под кроной
    for (const [dx, dy, s] of [[-9, 8, 1], [8, 10, 0.9], [0, 13, 0.8]]) {
      g.strokeStyle = '#7a5230'; g.lineWidth = 2; g.beginPath(); g.moveTo(dx * 0.4, 2); g.quadraticCurveTo(dx, 4, dx * 1.1, dy); g.stroke();
      for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#e38a2c' : '#c8641e'; g.beginPath(); g.ellipse(dx * 1.1 + Math.sin(k * 2.1) * 4 * s, dy + k * 2.3 * s, 2.5 * s, 3.2 * s, 0, 0, TAU); g.fill(); }
    }
  }
  // Ствол пальмы: слегка изогнутый, кольца листовых рубцов, расширение у корней
  function palmTrunk(g, h, w0, lean, wob, line) {
    const cx = (t) => lean * t + wob * Math.sin(t * Math.PI * 1.25), wd = (t) => w0 * (1 - 0.34 * t) * (1 + 0.38 * Math.exp(-t * 16));
    const path = () => {
      g.beginPath(); g.moveTo(cx(0) - wd(0) / 2, 3);
      for (let i = 0; i <= 14; i++) { const t = i / 14; g.lineTo(cx(t) - wd(t) / 2, -h * t); }
      for (let i = 14; i >= 0; i--) { const t = i / 14; g.lineTo(cx(t) + wd(t) / 2, -h * t); }
      g.lineTo(cx(0) + wd(0) / 2, 3); g.closePath();
    };
    path(); g.fillStyle = A.linG(g, -w0 * 0.6, 0, w0 * 0.6 + lean, 0, [[0, '#b39a7a'], [0.38, '#86694f'], [1, '#4d392c']]); g.fill();
    g.save(); path(); g.clip();
    const nr = Math.max(6, Math.round(h / 11));
    for (let i = 1; i < nr; i++) {
      const t = i / nr, x = cx(t), y = -h * t, hw = wd(t) / 2;
      g.strokeStyle = 'rgba(40,24,16,0.4)'; g.lineWidth = 1.7; g.beginPath(); g.ellipse(x, y, hw, 3.4, 0, 0.05, Math.PI - 0.05); g.stroke();
      g.strokeStyle = 'rgba(255,230,190,0.2)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y - 2.4, hw, 3.4, 0, 0.2, Math.PI - 0.5); g.stroke();
    }
    g.fillStyle = 'rgba(255,226,180,0.16)'; for (let i = 0; i < 14; i++) { const t0 = i / 14, t1 = (i + 1) / 14; g.beginPath(); g.moveTo(cx(t0) - wd(t0) * 0.46, -h * t0); g.lineTo(cx(t1) - wd(t1) * 0.46, -h * t1); g.lineTo(cx(t1) - wd(t1) * 0.28, -h * t1); g.lineTo(cx(t0) - wd(t0) * 0.28, -h * t0); g.closePath(); g.fill(); }
    A.edge(g, -w0, -h, w0 * 2 + lean * 2, h * 0.5, 't', 20, 'rgba(30,18,10,0.2)');
    g.restore();
    path(); g.lineWidth = 3; g.strokeStyle = line || OUT; g.lineJoin = 'round'; g.stroke();
    return [cx(1), -h];
  }
  function palm(o) {
    const h = o.h || 300, R0 = o.R || 150, lean = o.lean === undefined ? 14 : o.lean, w0 = o.w || (22 + h * 0.03), P = o.pal || PALM, wob = o.wob === undefined ? 6 : o.wob;
    const pad = 36, tw = Math.ceil(w0 + Math.abs(lean) * 2 + 2 * pad + 40);
    let top = [0, 0];
    const trunkS = sprite(tw, h + pad + 10, tw / 2, h + pad, dens(o.scale || 1.6), (g) => { top = palmTrunk(g, h, w0, lean, wob, o.line); });
    const crownS = sprite(R0 * 2.5, R0 * 1.8, R0 * 1.25, R0 * 1.05, dens(o.scale || 1.6), (g) => palmCrown(g, R0, o.seed || 3, P, !!o.leaflets));
    const ph = (o.seed || 3) * 1.7, sway = o.sway === undefined ? 1 : o.sway;
    return {
      topX: top[0], topY: top[1], h,
      draw(ctx, x, base, t, flip) {
        const s = flip ? -1 : 1;
        trunkS(ctx, x, base, flip);
        const a = (Math.sin(t * 0.85 + ph) * 0.02 + Math.sin(t * 2.3 + ph * 2) * 0.007) * sway;
        ctx.save(); ctx.translate(x + s * top[0], base + top[1]); ctx.rotate(a * s); crownS(ctx, 0, 0, flip); ctx.restore();
      },
    };
  }

  // =================================================================== архитектура
  // Арочное окно: рама, стекло (glass: 'lit' — тёплый свет внутри, 'day' — отражает небо, 'dark'), переплёт, замковый камень, подоконник, ставни, балкон. (cx, bottom) — середина низа проёма
  function archWin(g, cx, bottom, w, h, o) {
    o = o || {};
    const arch = o.arch !== false, r = w / 2, top = bottom - h, frame = o.frame || '#fff3da', ar = arch ? r : 0;
    const path = (grow) => { g.beginPath(); g.moveTo(cx - r - grow, bottom + grow * 0.4); g.lineTo(cx - r - grow, top + ar); if (arch) g.arc(cx, top + ar, r + grow, Math.PI, 0); else { g.lineTo(cx - r - grow, top - grow); g.lineTo(cx + r + grow, top - grow); } g.lineTo(cx + r + grow, bottom + grow * 0.4); g.closePath(); };
    if (o.shutters) {                                                                                       // открытые ставни по бокам: рейки-жалюзи
      for (const sd of [-1, 1]) {
        const sx = cx + sd * (r + 4.4), sw = r * 0.78;
        g.fillStyle = o.shutters; g.fillRect(sd > 0 ? sx : sx - sw, top - 1, sw, h + 2);
        g.strokeStyle = 'rgba(20,30,40,0.35)'; g.lineWidth = 1.2; for (let y = top + 4; y < bottom; y += 5) { g.beginPath(); g.moveTo(sd > 0 ? sx : sx - sw, y); g.lineTo(sd > 0 ? sx + sw : sx, y); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sd > 0 ? sx : sx - sw, top - 1, 2.4, h + 2);
        g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(sd > 0 ? sx : sx - sw, top - 1, sw, h + 2);
      }
    }
    path(4.6); g.fillStyle = frame; g.fill(); g.lineWidth = 2.2; g.strokeStyle = o.line || OUT; g.stroke();
    const glass = o.glass || 'day';
    const stops = glass === 'lit' ? [[0, '#ffe9b0'], [0.55, '#f6c46c'], [1, '#d68a38']] : glass === 'dark' ? [[0, '#2c3a52'], [1, '#4a5a72']] : [[0, '#9fd0ee'], [0.5, '#5f98c4'], [1, '#3f6e98']];
    path(0); g.fillStyle = A.linG(g, 0, top, 0, bottom, stops); g.fill();
    g.save(); path(0); g.clip();
    if (glass === 'lit') { A.glow(g, cx, bottom - h * 0.35, Math.max(w, h) * 0.8, 'rgba(255,248,200,', 0.55); g.fillStyle = 'rgba(150,60,40,0.55)'; g.fillRect(cx - r, top, r * 0.34, h); g.fillRect(cx + r * 0.66, top, r * 0.34, h); g.fillStyle = 'rgba(120,40,30,0.4)'; g.fillRect(cx - r, top, w, 8 + (arch ? r * 0.2 : 0)); }
    else { g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(cx - r, bottom); g.lineTo(cx - r * 0.1, top); g.lineTo(cx + r * 0.42, top); g.lineTo(cx - r * 0.6, bottom); g.fill(); }
    g.strokeStyle = frame; g.lineWidth = Math.max(1.8, w * 0.04); g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, bottom); g.moveTo(cx - r, top + h * 0.42); g.lineTo(cx + r, top + h * 0.42); g.stroke();
    A.edge(g, cx - r, top, w, h, 't', 9, 'rgba(0,0,0,0.28)');
    g.restore();
    path(0); g.lineWidth = 1.6; g.strokeStyle = 'rgba(30,18,24,0.7)'; g.stroke();
    if (arch && o.keystone !== false) { g.fillStyle = mix(frame, '#caa970', 0.35); g.beginPath(); g.moveTo(cx - 4.6, top - r - 5); g.lineTo(cx + 4.6, top - r - 5); g.lineTo(cx + 3.2, top - r + 3.4); g.lineTo(cx - 3.2, top - r + 3.4); g.closePath(); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
    if (o.sill !== false) { g.fillStyle = mix(frame, '#d6bf90', 0.4); g.fillRect(cx - r - 8, bottom + 3, w + 16, 5.4); g.lineWidth = 1.8; g.strokeStyle = OUT; g.strokeRect(cx - r - 8, bottom + 3, w + 16, 5.4); }
    if (o.balcony) ironRail(g, cx - r - 14, cx + r + 14, bottom + 8, o.balcony === true ? 30 : o.balcony, { post: false, line: OUT });
  }

  // Кованые завитки: пара C-образных волют, смотрящих в стороны (dir ±1)
  function scroll(g, x, y, r, dir, lw) {
    g.beginPath(); g.moveTo(x, y);
    for (let a = 0; a < 4.6; a += 0.3) { const rr = r * (1 - a / 6.2); g.lineTo(x + dir * (r * 0.4 + Math.sin(a + 1.3) * rr), y - Math.cos(a + 1.3) * rr + r * 0.2); }
    g.lineWidth = lw || 2.4; g.stroke();
  }
  // Железная решётка (перила балкона / низкая ограда): пики, две перекладины, завитки, столбики с шариками. (x0, x1) — по горизонтали, base — низ, h — высота
  function ironRail(g, x0, x1, base, h, o) {
    o = o || {};
    const col = o.col || '#24302f', hi = o.hi || 'rgba(255,214,140,0.55)', step = o.step || 11, n = Math.max(2, Math.round((x1 - x0) / step)), dx = (x1 - x0) / n;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const stroke = (lw, fn) => { g.strokeStyle = o.line || OUT; g.lineWidth = lw + 2.4; fn(); g.stroke(); g.strokeStyle = col; g.lineWidth = lw; fn(); g.stroke(); };
    stroke(3.4, () => { g.beginPath(); g.moveTo(x0, base - h); g.lineTo(x1, base - h); });                      // верхняя перекладина
    stroke(3, () => { g.beginPath(); g.moveTo(x0, base - 3); g.lineTo(x1, base - 3); });
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * dx;
      stroke(2.4, () => { g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h - 3); });
      if (o.spears !== false) { g.fillStyle = col; g.beginPath(); g.moveTo(x, base - h - 10); g.lineTo(x + 2.8, base - h - 3); g.lineTo(x, base - h - 1); g.lineTo(x - 2.8, base - h - 3); g.closePath(); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke(); }
    }
    if (o.scrolls !== false && h > 26) for (let i = 0; i < n; i += 2) { const x = x0 + (i + 1) * dx; stroke(2, () => { scroll(g, x - dx * 0.5, base - h * 0.5, h * 0.2, 1, 2); scroll(g, x + dx * 0.5, base - h * 0.5, h * 0.2, -1, 2); g.beginPath(); }); }
    g.strokeStyle = hi; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, base - h - 1.2); g.lineTo(x1, base - h - 1.2); g.stroke();
    if (o.post !== false) for (const px of [x0, x1]) { g.fillStyle = col; g.beginPath(); g.arc(px, base - h - 6, 4.4, 0, TAU); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); g.fillStyle = hi; g.beginPath(); g.arc(px - 1.4, base - h - 7.4, 1.4, 0, TAU); g.fill(); }
  }

  // Каменная балюстрада: цоколь, точёные балясины, поручень, пилястры с вазами-шариками. Основание на линии base, x0…x1; h — полная высота. pal — краски камня
  const STONE = ['#fbf0d8', '#ead7b0', '#c9ac7c'];
  function balustrade(g, x0, x1, base, h, o) {
    o = o || {};
    const S = o.pal || STONE, rail = Math.max(7, h * 0.16), plinth = Math.max(6, h * 0.14), bh = h - rail - plinth, step = o.step || 15, n = Math.max(1, Math.floor((x1 - x0) / step)), dx = (x1 - x0) / n;
    const lw = o.lw || 2.2, line = o.line || OUT;
    g.lineJoin = 'round';
    g.fillStyle = A.linG(g, 0, base - plinth, 0, base, [[0, S[0]], [1, S[1]]]); g.fillRect(x0, base - plinth, x1 - x0, plinth); g.lineWidth = lw; g.strokeStyle = line; g.strokeRect(x0, base - plinth, x1 - x0, plinth);
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * dx, bw = dx * 0.32, yb = base - plinth, yt = base - plinth - bh;
      g.beginPath(); g.moveTo(cx - bw * 0.7, yb); g.lineTo(cx - bw * 0.55, yb - bh * 0.08); g.quadraticCurveTo(cx - bw * 1.5, yb - bh * 0.33, cx - bw * 0.35, yb - bh * 0.52); g.quadraticCurveTo(cx - bw * 0.15, yb - bh * 0.62, cx - bw * 0.55, yb - bh * 0.88); g.lineTo(cx - bw * 0.6, yt);
      g.lineTo(cx + bw * 0.6, yt); g.lineTo(cx + bw * 0.55, yb - bh * 0.88); g.quadraticCurveTo(cx + bw * 0.15, yb - bh * 0.62, cx + bw * 0.35, yb - bh * 0.52); g.quadraticCurveTo(cx + bw * 1.5, yb - bh * 0.33, cx + bw * 0.55, yb - bh * 0.08); g.lineTo(cx + bw * 0.7, yb); g.closePath();
      g.fillStyle = A.linG(g, cx - bw * 1.2, 0, cx + bw * 1.2, 0, [[0, S[0]], [0.45, S[1]], [1, S[2]]]); g.fill(); g.lineWidth = lw * 0.7; g.strokeStyle = line; g.stroke();
    }
    g.fillStyle = A.linG(g, 0, base - h, 0, base - h + rail, [[0, S[0]], [1, S[1]]]); g.fillRect(x0 - 3, base - h, x1 - x0 + 6, rail); g.lineWidth = lw; g.strokeStyle = line; g.strokeRect(x0 - 3, base - h, x1 - x0 + 6, rail);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x0 - 1, base - h + 1.4, x1 - x0 + 2, 1.8);
    if (o.posts) for (const px of o.posts) pillar(g, px, base, h, S, lw, line);
  }
  // Пилястра балюстрады с шаром-навершием
  function pillar(g, cx, base, h, S, lw, line) {
    const w = 18, top = base - h - 12;
    g.fillStyle = A.linG(g, cx - w / 2, 0, cx + w / 2, 0, [[0, S[0]], [0.5, S[1]], [1, S[2]]]); g.fillRect(cx - w / 2, top, w, h + 12); g.lineWidth = lw; g.strokeStyle = line; g.strokeRect(cx - w / 2, top, w, h + 12);
    g.fillRect(cx - w / 2 - 3, top - 4, w + 6, 6); g.strokeRect(cx - w / 2 - 3, top - 4, w + 6, 6);
    g.beginPath(); g.arc(cx, top - 13, 8, 0, TAU); g.fillStyle = A.linG(g, cx - 8, top - 21, cx + 8, top - 5, [[0, S[0]], [1, S[2]]]); g.fill(); g.stroke();
  }
  // Ваза-урна с цветами или шаром листвы (стоит на постаменте); (x, base) — низ, s — масштаб
  function urn(g, x, base, s, o) {
    o = o || {};
    g.save(); g.translate(x, base); g.scale(s, s); g.lineJoin = 'round';
    const S = o.pal || STONE;
    g.fillStyle = A.linG(g, -16, 0, 16, 0, [[0, S[0]], [1, S[2]]]); g.fillRect(-15, -9, 30, 9); g.lineWidth = 2.4; g.strokeStyle = OUT; g.strokeRect(-15, -9, 30, 9);
    g.beginPath(); g.moveTo(-8, -9); g.lineTo(-6, -17); g.lineTo(6, -17); g.lineTo(8, -9); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-7, -17); g.bezierCurveTo(-24, -22, -24, -46, -13, -50); g.lineTo(13, -50); g.bezierCurveTo(24, -46, 24, -22, 7, -17); g.closePath();
    g.fillStyle = A.linG(g, -22, 0, 22, 0, [[0, S[0]], [0.4, S[1]], [1, S[2]]]); g.fill(); g.lineWidth = 2.6; g.stroke();
    g.strokeStyle = 'rgba(120,90,50,0.4)'; g.lineWidth = 1.2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 4, -20); g.quadraticCurveTo(i * 7.4, -34, i * 5.2, -48); g.stroke(); }
    g.fillStyle = S[0]; g.fillRect(-17, -54, 34, 6); g.lineWidth = 2.4; g.strokeStyle = OUT; g.strokeRect(-17, -54, 34, 6);
    if (o.plant === 'flowers') { for (let i = 0; i < 9; i++) { const a = -2.6 + i * 0.5; g.fillStyle = ['#e63b4a', '#f5708a', '#f4a838', '#fff0e0'][i % 4]; g.beginPath(); g.arc(Math.cos(a) * 15, -62 + Math.sin(a) * 9, 5, 0, TAU); g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(60,20,24,0.6)'; g.stroke(); } g.fillStyle = '#3f7a3c'; g.beginPath(); g.ellipse(0, -58, 16, 7, 0, 0, TAU); g.fill(); }
    else if (o.plant !== 'none') bush(g, 0, -66, 17, 15, o.P || LEAF, Math.round(x) + 5, { lw: 2.4 });
    g.restore();
  }

  // Колонна: ствол с каннелюрами и лёгким утолщением, база и капитель (листья аканта дугами). cx — ось; top — верх капители, bottom — низ базы. o.pal — [свет, середина, тень]; o.cap — цвет капители
  function column(g, cx, top, bottom, w, o) {
    o = o || {};
    const S = o.pal || STONE, cap = o.cap || '#d8b25a', x = cx - w / 2, ch = Math.min(26, (bottom - top) * 0.12), bh = Math.min(20, (bottom - top) * 0.08), lw = o.lw || 2.6;
    const y0 = top + ch, y1 = bottom - bh;
    g.beginPath(); g.moveTo(x + 2, y0); g.quadraticCurveTo(x - 1.5, (y0 + y1) / 2, x, y1); g.lineTo(x + w, y1); g.quadraticCurveTo(x + w + 1.5, (y0 + y1) / 2, x + w - 2, y0); g.closePath();
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, S[0]], [0.36, S[1]], [1, S[2]]]); g.fill();
    g.save(); g.clip();
    for (let i = 1; i < 7; i++) { const fx = x + i * (w / 7); g.fillStyle = 'rgba(80,50,20,0.2)'; g.fillRect(fx, y0, 1.6, y1 - y0); g.fillStyle = 'rgba(255,248,224,0.4)'; g.fillRect(fx + 1.6, y0, 1.1, y1 - y0); }
    if (o.veins) { g.strokeStyle = o.veins; g.lineWidth = 1.1; const R = A.rng(Math.round(cx)); for (let i = 0; i < 7; i++) { g.beginPath(); let vx = x + R.range(0, w), vy = y0 + R.range(0, 30); g.moveTo(vx, vy); for (let k = 0; k < 5; k++) { vx += R.range(-8, 8); vy += R.range((y1 - y0) / 7, (y1 - y0) / 4); g.lineTo(vx, vy); } g.stroke(); } }
    A.grain(g, x, y0, w, y1 - y0, 0.14, 'overlay', Math.round(cx) + 3);
    A.edge(g, x, y0, w, 22, 't', 22, 'rgba(60,30,10,0.22)');
    g.restore();
    g.lineWidth = lw; g.strokeStyle = OUT; g.beginPath(); g.moveTo(x + 2, y0); g.quadraticCurveTo(x - 1.5, (y0 + y1) / 2, x, y1); g.moveTo(x + w, y1); g.quadraticCurveTo(x + w + 1.5, (y0 + y1) / 2, x + w - 2, y0); g.stroke();
    // база: два валика и плинт
    A.box(g, x - 5, y1, w + 10, bh * 0.5, { fill: A.linG(g, 0, y1, 0, y1 + bh * 0.5, [[0, S[0]], [1, S[1]]]), lw, r: 3 });
    A.box(g, x - 8, y1 + bh * 0.5, w + 16, bh * 0.5, { fill: A.linG(g, 0, y1 + bh * 0.5, 0, bottom, [[0, S[1]], [1, S[2]]]), lw });
    // капитель: перевёрнутый колокол с двумя ярусами листьев и абак
    g.beginPath(); g.moveTo(x + 1, y0); g.lineTo(x - 5, top + ch * 0.28); g.lineTo(x + w + 5, top + ch * 0.28); g.lineTo(x + w - 1, y0); g.closePath();
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, lighter(cap, 0.5)], [0.5, cap], [1, darker(cap, 0.35)]]); g.fill(); g.lineWidth = lw; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(80,50,10,0.55)'; g.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) { const lx = x + (i + 0.5) * (w / 4); g.beginPath(); g.moveTo(lx - 3.4, y0 - 1); g.quadraticCurveTo(lx - 5, y0 - ch * 0.5, lx - 1, top + ch * 0.4); g.moveTo(lx + 3.4, y0 - 1); g.quadraticCurveTo(lx + 5, y0 - ch * 0.5, lx + 1, top + ch * 0.4); g.stroke(); }
    A.box(g, x - 8, top, w + 16, ch * 0.3, { fill: cap, lw, hi: 'rgba(255,255,255,0.4)' });
  }

  // =================================================================== флаг и надпись
  // Флаг Монако (красный над белым) на ветру; (x, y) — верх у древка. Рисуется на кадр: три контура
  function flag(ctx, x, y, w, h, t, ph) {
    const N = 9, dw = w / N, wave = (i) => Math.sin(t * 3.4 + i * 0.75 + (ph || 0)) * (1.2 + i * 0.55), drop = (i) => i * 0.28;
    for (const [half, col] of [[0, '#d42a36'], [1, '#fdfaf0']]) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const yy = y + wave(i) + drop(i) + h * half / 2; if (i) ctx.lineTo(x + i * dw, yy); else ctx.moveTo(x, yy); }
      for (let i = N; i >= 0; i--) ctx.lineTo(x + i * dw, y + wave(i) + drop(i) + h * (half + 1) / 2);
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    ctx.beginPath(); for (let i = 0; i <= N; i++) { const yy = y + wave(i) + drop(i); if (i) ctx.lineTo(x + i * dw, yy); else ctx.moveTo(x, yy); }
    for (let i = N; i >= 0; i--) ctx.lineTo(x + i * dw, y + wave(i) + drop(i) + h);
    ctx.closePath(); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(43,26,32,0.85)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); for (let i = 0; i <= N; i += 2) ctx.rect(x + i * dw, y + wave(i) + drop(i), dw * 0.9, h * 0.42); ctx.fill();
  }

  // Золотые буквы с тёмной обводкой и тенью; spacing — добавка между буквами (юн.). Кисть шрифта: o.font (по умолчанию засечки)
  const SERIF = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';
  function goldText(g, str, cx, cy, size, o) {
    o = o || {};
    const font = (o.weight || 'bold') + ' ' + size + 'px ' + (o.font || SERIF), sp = o.spacing || 0;
    g.save(); g.font = font; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const ws = Array.from(str).map((ch) => g.measureText(ch).width + sp), total = ws.reduce((a, b) => a + b, 0) - sp;
    let x = cx - total / 2;
    const stops = o.stops || [[0, '#fff4b8'], [0.45, '#f4c542'], [1, '#a8741a']];
    Array.from(str).forEach((ch, i) => {
      g.lineWidth = size * 0.2; g.strokeStyle = OUT; g.strokeText(ch, x + 1.2, cy + 1.6);
      g.lineWidth = size * 0.14; g.strokeText(ch, x, cy);
      g.fillStyle = A.linG(g, 0, cy - size * 0.5, 0, cy + size * 0.5, stops); g.fillText(ch, x, cy);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; g.strokeText(ch, x - 0.4, cy - 0.6);
      x += ws[i];
    });
    g.restore();
  }
  MA.kit = {
    FY, WALL, TAU, dens, rgb, mix, lighter, darker, rgba, hazed, hash, par, guard, sprite, onScreen, deco,
    SKY, skyFill, cloud, skyLayer,
    LEAF, DEEP, OLIVE, PALM, STONE, crown, blobsIn, bush, mound, trunk, cypress, pine, flowerBed, bougainvillea, palm,
    archWin, scroll, ironRail, balustrade, pillar, urn, column, flag, goldText, SERIF,
  };
})();
