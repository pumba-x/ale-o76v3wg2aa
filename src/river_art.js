// Оформление заплыва через Днепр (src/river.js): закат над широкой рекой, дальний берег с холмами и золотыми куполами, дорожка солнца на воде, песчаный берег отплытия и зелёный берег
// назначения, большое бревно с корой и обломанными сучками, Бубел на носу, Алеся с веслом, плывущие коряги, бочки, мины и деревья, брызги, кильватер, интерфейс.
// Всё кодом в манере остальных сцен: тёмный тёплый контур, плоские цвета с мягкими градиентами, свет от низкого солнца справа. Неподвижное собрано один раз в слои (A.layer),
// живое (вода, блики, волны, брызги) — в кадре и по времени сессии (S.clock), случайность — только Ale.fxRng / A.rng(seed) внутри слоёв.
// Контракт: layout(S, W, H) — где что стоит (его же читает подсказка реплик: куда показывает облачко), draw(ctx, S, W, H) — весь кадр, prepare() — построить слои заранее
// (River.open() зовёт его, пока на экране открытка: задержки в игре не видно).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const dens = (s) => s * ((Ale.Touch && Ale.Touch.active) ? 0.8 : 1);

  // ---------------------------------------------------------------- краски
  const hex2 = (v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
  const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return '#' + hex2(p[0] + (q[0] - p[0]) * t) + hex2(p[1] + (q[1] - p[1]) * t) + hex2(p[2] + (q[2] - p[2]) * t); };
  const rgba = (c, a) => { const p = rgb(c); return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')'; };
  const HZ = 330;                                                      // линия горизонта (экранная высота)
  const SUN_K = 0.72;                                                  // солнце стоит на 72% ширины вида
  const WOOD = { hi: '#c88a52', mid: '#94603a', lo: '#5a3a28', dark: '#3a2418' };
  const BANK_EDGE = 0.55;                                              // наклон береговой линии: чем ближе к зрителю, тем дальше от центра (x на единицу y)

  // ---------------------------------------------------------------- слои
  let L = null;                                                        // построенные слои: paint (картина) или sky + far (кодом, запасные), bankL, bankR, log, obstacle sprites
  const alive = () => !!(L && L.bankL && L.bankL.c.width > 0);
  // Нарисованные картинки заказов 26 и 27 (sprites.json: наборы swim_log / swim_things / swim_oar и картина view_dnipro_sunset). Нет файла — работает прежнее оформление кодом (слои ниже и OBS).
  const PAINT = { name: 'view_dnipro_sunset', k: 1.12, hz: 369.5, sunX: 1283, par: 0.016 };       // k — увеличение картины (покрывает кадр целиком), hz — строка горизонта картины, sunX — x центра солнца, par — параллакс
  const paintImg = () => { const im = Ale.Assets && Ale.Assets.images && Ale.Assets.images[PAINT.name]; return im && (im.naturalWidth || im.width) ? im : null; };

  // Небо: закатный градиент, солнце над горизонтом, вытянутые розово-оранжевые облака, стая птиц. Слой широкий: солнце стоит в его середине (x = 1300), вид кладётся так, чтобы солнце было на 72% ширины.
  function buildSky() {
    return A.layer(2600, HZ + 14, (g, w, h) => {
      const R = A.rng(41);
      A.gradV(g, 0, 0, w, h, [[0, '#2b2968'], [0.28, '#5d4590'], [0.52, '#c05a92'], [0.74, '#ff8f64'], [0.92, '#ffc886'], [1, '#ffe2a8']]);
      // низкое солнце: большой тёплый ореол и сам диск (нижняя часть спрятана дымкой горизонта)
      A.glow(g, 1300, HZ - 8, 560, 'rgba(255,190,120,', 0.65);
      A.glow(g, 1300, HZ - 8, 210, 'rgba(255,226,160,', 0.8);
      const sg = g.createRadialGradient(1300, HZ - 22, 6, 1300, HZ - 22, 54);
      sg.addColorStop(0, '#fffbe6'); sg.addColorStop(0.7, '#ffe9a6'); sg.addColorStop(1, '#ffc46a');
      g.fillStyle = sg; g.beginPath(); g.arc(1300, HZ - 22, 52, 0, TAU); g.fill();
      // облака: длинные полосы, светлые сверху (отсвет заката), тёмно-сиреневые снизу
      for (let i = 0; i < 17; i++) {
        const cx = R.range(60, w - 60), cy = R.range(34, HZ - 80), cw = R.range(170, 420), ch = cw * R.range(0.07, 0.12), near = 1 - cy / HZ, tone = R.range(0, 1);
        for (let k = 0; k < 7; k++) {
          const px = cx + R.range(-cw * 0.5, cw * 0.5), py = cy + R.range(-ch * 0.5, ch * 0.5), rx = cw * R.range(0.16, 0.3), ry = ch * R.range(0.7, 1.4);
          const gr = g.createLinearGradient(0, py - ry, 0, py + ry);
          gr.addColorStop(0, rgba(mix('#ffd0a8', '#ffb4a0', tone), 0.82 - near * 0.2)); gr.addColorStop(0.55, rgba(mix('#e88aa0', '#c06a98', tone), 0.78)); gr.addColorStop(1, rgba('#6a4a88', 0.55));
          g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rx, ry, R.range(-0.04, 0.04), 0, TAU); g.fill();
        }
      }
      // дымка у горизонта
      A.gradV(g, 0, HZ - 46, w, 60, [[0, 'rgba(255,205,150,0)'], [1, 'rgba(255,214,164,0.78)']]);
      // птицы
      g.strokeStyle = 'rgba(52,32,60,0.8)'; g.lineWidth = 1.7; g.lineCap = 'round';
      for (const [bx, by, bs] of [[820, 110, 1], [842, 122, 0.8], [868, 108, 0.9], [1620, 150, 1], [1648, 140, 0.8], [440, 96, 0.9]]) { g.beginPath(); g.moveTo(bx - 8 * bs, by - 2 * bs); g.quadraticCurveTo(bx - 3 * bs, by - 6 * bs, bx, by); g.quadraticCurveTo(bx + 3 * bs, by - 6 * bs, bx + 8 * bs, by - 2 * bs); g.stroke(); }
    }, dens(1));
  }

  // Дальний берег: цепочка холмов в дымке (сиреневые → зелёные → тёмно-зелёные), остров, мост вдали, золотые купола и колокольня. Нижний край слоя стоит на горизонте.
  function buildFar() {
    const H = 170;
    return A.layer(2600, H, (g, w, h) => {
      const R = A.rng(77), by = h;                                       // by — линия горизонта слоя
      const hills = (base, amp, col, seed, step, edge) => {
        const Q = A.rng(seed); const pts = []; let ph = Q.range(0, 6);
        for (let x = -20; x <= w + 20; x += step) { ph += Q.range(0.3, 0.9); pts.push([x, base - amp * (0.55 + 0.45 * Math.sin(ph)) - Q.range(0, amp * 0.25)]); }
        g.beginPath(); g.moveTo(-20, by + 2); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(w + 20, by + 2); g.closePath();
        g.fillStyle = col; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1.4; g.stroke(); }
        return pts;
      };
      hills(by - 38, 64, '#a47ca0', 3, 90);                              // далёкие холмы в сиреневой дымке
      hills(by - 26, 52, '#7f7c8c', 5, 70);
      // остров с деревьями и дальний мост
      g.fillStyle = '#5d6e6a'; g.beginPath(); g.ellipse(1620, by - 3, 190, 7, 0, 0, TAU); g.fill();
      for (let i = 0; i < 30; i++) { g.fillStyle = R.pick(['#496a58', '#3f5f50', '#587a5c']); g.beginPath(); g.arc(1440 + i * 11.5 + R.range(-3, 3), by - 9 - R.range(0, 9), R.range(5, 11), 0, TAU); g.fill(); }
      g.strokeStyle = '#6a4660'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(520, by - 8); g.lineTo(1240, by - 8); g.stroke();
      g.lineWidth = 1.5; for (let x = 540; x <= 1220; x += 70) { g.beginPath(); g.moveTo(x, by - 8); g.lineTo(x, by); g.stroke(); g.beginPath(); g.arc(x + 35, by - 8, 35, Math.PI, 0); g.stroke(); }
      for (const [bx0, bw] of [[520, 40], [1200, 40]]) { g.fillStyle = '#5a3c56'; g.fillRect(bx0, by - 20, 5, 20); g.fillRect(bx0 + bw - 5, by - 20, 5, 20); }
      hills(by - 14, 40, '#5a7a58', 9, 60, 'rgba(26,52,40,0.35)');       // ближний зелёный склон
      const front = hills(by - 4, 24, '#2f5a42', 13, 34, 'rgba(18,40,30,0.5)');
      // золотые купола и колокольня на склоне левее солнца
      const cx = 960;
      g.fillStyle = '#e9d8c0'; g.fillRect(cx - 62, by - 52, 124, 32);                                   // стены собора
      g.fillStyle = '#b89c8a'; g.fillRect(cx - 62, by - 24, 124, 4);
      for (const [dx, hh, rr] of [[-38, 12, 13], [0, 22, 17], [38, 12, 13]]) {
        g.fillStyle = '#e4cfb2'; g.fillRect(cx + dx - 9, by - 52 - hh, 18, hh + 2);                      // барабан
        const dg = g.createRadialGradient(cx + dx - rr * 0.35, by - 52 - hh - rr * 0.7, 1, cx + dx, by - 52 - hh - rr * 0.4, rr * 1.5);
        dg.addColorStop(0, '#fff2b0'); dg.addColorStop(0.5, '#f1bb3a'); dg.addColorStop(1, '#b8801c');
        g.fillStyle = dg; g.beginPath(); g.ellipse(cx + dx, by - 52 - hh - rr * 0.35, rr * 0.78, rr, 0, Math.PI, 0); g.lineTo(cx + dx + rr * 0.78, by - 52 - hh); g.lineTo(cx + dx - rr * 0.78, by - 52 - hh); g.closePath(); g.fill();
        g.strokeStyle = '#f5d070'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + dx, by - 52 - hh - rr * 1.35); g.lineTo(cx + dx, by - 52 - hh - rr * 1.9); g.moveTo(cx + dx - 3.5, by - 52 - hh - rr * 1.62); g.lineTo(cx + dx + 3.5, by - 52 - hh - rr * 1.62); g.stroke();
      }
      g.fillStyle = '#efe0c8'; g.fillRect(cx + 86, by - 116, 22, 96);                                   // колокольня
      g.fillStyle = '#d6c0a2'; g.fillRect(cx + 86, by - 116, 7, 96);
      g.fillStyle = '#7a5a4a'; for (let k = 0; k < 3; k++) g.fillRect(cx + 92, by - 100 + k * 28, 8, 12);
      const tg = g.createLinearGradient(cx + 86, 0, cx + 108, 0); tg.addColorStop(0, '#f6d56a'); tg.addColorStop(1, '#b8801c');
      g.fillStyle = tg; g.beginPath(); g.moveTo(cx + 84, by - 116); g.lineTo(cx + 97, by - 152); g.lineTo(cx + 110, by - 116); g.closePath(); g.fill();
      g.strokeStyle = '#f5d070'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + 97, by - 152); g.lineTo(cx + 97, by - 164); g.moveTo(cx + 93, by - 159); g.lineTo(cx + 101, by - 159); g.stroke();
      // тёплые дома и деревья вдоль склона
      for (let i = 0; i < 20; i++) { const x = cx - 420 + i * 46 + R.range(-10, 10); if (x > cx - 90 && x < cx + 130) continue; g.fillStyle = R.pick(['#e8c7a0', '#e0a890', '#d8b890']); g.fillRect(x, by - 24 - R.range(0, 10), R.range(14, 24), R.range(10, 18)); }
      for (let i = 0; i < 90; i++) { const p = front[Math.floor(R.range(0, front.length))]; g.fillStyle = R.pick(['#2c553b', '#386847', '#24483a']); g.beginPath(); g.arc(p[0] + R.range(-6, 6), p[1] - R.range(0, 8), R.range(7, 14), 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-atop';                                                          // дымка ложится только на холмы и дома, а не на пустой прозрачный фон слоя (иначе над горизонтом остаётся полоса)
      g.fillStyle = 'rgba(255,214,150,0.18)'; g.fillRect(0, 0, w, h);                                    // золотая дымка поверх
      A.gradV(g, 0, by - 34, w, 36, [[0, 'rgba(255,208,150,0)'], [1, 'rgba(255,210,160,0.55)']]);
      g.globalCompositeOperation = 'source-over';
    }, dens(1));
  }

  // Берег (песок, мокрая кромка, камыши, трава, деревья); side 'L' — отплытие (суша слева), 'R' — назначение (суша справа, зелёный склон). Слой 940×440: верх — экранная высота 280,
  // береговая линия проходит через (EDGE_X, 248) слоя, то есть через воду на полосе №2 (экранная y = 528); слой кладётся так, чтобы эта точка попала на нужный экранный x.
  // Слой берега с запасом сверху (topM): кроны деревьев выше линии 280 раньше обрезались краем слоя (владелец 09.10.2026: «сверху деревья обрезаны»). Левый берег — длинный пляж (extL px суши
  // слева от клина у воды: по нему герои идут слева направо, камера — за ними; владелец 09.10.2026: «слева пустота и непрорисованы текстуры»): слой кончается далеко за левым краем самого
  // широкого вида даже в начале пути (Алеся стоит на 30% ширины, а в 1900 px левее бревна).
  const BANK = { w: 940, h: 440, top: 280, edgeX: 470, edgeY: 248, topM: 120, extL: 2480 };
  const edgeAt = (ly) => BANK.edgeX + (ly - BANK.edgeY) * BANK_EDGE;
  const BANK_EX = 800;                                                // правый берег шире: суша должна доходить до правого края самого широкого вида
  // ---- мелочи на пляже (только левый берег): герои идут по нему больше десяти секунд, и пустой песок с двумя предметами выдавал бы, к чему всё идёт (владелец 09.10.2026)
  const wood = (g, x, y, w, h, c0, c1) => { g.fillStyle = A.linG(g, 0, y, 0, y + h, [[0, c0], [1, c1]]); g.fillRect(x, y, w, h); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(x, y, w, h); };
  const shadowAt = (g, rx) => { g.fillStyle = 'rgba(40,24,30,0.22)'; g.beginPath(); g.ellipse(0, 1, rx, 6, 0, 0, TAU); g.fill(); };
  // ---- листва «мазками» (11.10.2026; владелец: «на фоне красивого пейзажа криво нарисованные текстурки зелёных деревьев, выглядят бездарно»). Раньше деревья берега были плоскими кружками с обводкой,
  // а за ними лежала полоса из четырёх зелёных многоугольников — рядом с нарисованным закатом они выглядели чужими. Теперь крона — клубы листвы: эллипсоид, по которому разбросаны сотни мазков-листьев;
  // мазок красится по освещённости (низкое солнце справа: тёмная середина, тёплая золотая кайма с солнечной стороны и сверху), светлые мазки лежат поверх тёмных, контур не обводится — силуэт
  // получается из самих листьев. Палитры подобраны к закату: деревья стоят против света, поэтому тёмные, с золотым ободком.
  const SUN_DIR = (() => { const x = 0.78, y = -0.62, l = Math.hypot(x, y); return { x: x / l, y: y / l }; })();
  const LEAF = {
    green:  { dark: '#162d1d', mid: '#234c2d', light: '#3c6d36', hi: '#cfae4c', acc: ['#d88a2c', '#8ca83a'] },
    autumn: { dark: '#2c3519', mid: '#56602a', light: '#a87c2a', hi: '#e8c05e', acc: ['#cf5a28', '#78923a'] },
    poplar: { dark: '#1b341f', mid: '#385d29', light: '#78993a', hi: '#ebc95c', acc: ['#c8a232', '#5a8a30'] },
    far:    { dark: '#1c3a30', mid: '#2c5442', light: '#477350', hi: '#cdaa5c', acc: ['#b8903c'] },
    park:   { dark: '#1d4528', mid: '#37753a', light: '#68a548', hi: '#dcd466', acc: ['#e8b848', '#9ac448'] },
    crown:  { dark: '#2a3a1a', mid: '#56702a', light: '#b09030', hi: '#f0c85c', acc: ['#d0602a', '#7aa03a'] },
  };
  function leafShade(pal, l) {
    if (l < 0.36) return mix(pal.dark, pal.mid, l / 0.36);
    if (l < 0.76) return mix(pal.mid, pal.light, (l - 0.36) / 0.40);
    return mix(pal.light, pal.hi, Math.min(1, (l - 0.76) / 0.30));
  }
  // «Клуб» листвы: эллипсоид (cx, cy, rx, ry); o.k — мазков на единицу площади, o.size — размер мазка, o.bias — общий сдвиг света (< 0 — темнее)
  function lobe(g, R, cx, cy, rx, ry, pal, o) {
    o = o || {};
    const n = Math.max(14, Math.round((o.k || 0.1) * rx * ry)), size = o.size || 1, dabs = [];
    g.fillStyle = pal.dark; g.beginPath(); g.ellipse(cx, cy, rx * 0.88, ry * 0.88, 0, 0, TAU); g.fill();            // тёмная основа: просветов между мазками нет
    for (let i = 0; i < n; i++) {
      const a = R.range(0, TAU), q = Math.sqrt(R.range(0.03, 1)), px = cx + Math.cos(a) * rx * q, py = cy + Math.sin(a) * ry * q;
      const nx = (px - cx) / rx, ny = (py - cy) / ry, l = clamp(0.38 + 0.56 * (nx * SUN_DIR.x + ny * SUN_DIR.y) + (o.bias || 0) + R.range(-0.14, 0.14), 0, 1);
      dabs.push({ px, py, l, rw: R.range(2.6, 5.6) * size, rh: R.range(1.7, 3.3) * size, ang: R.range(-1, 1) });
    }
    dabs.sort((a, b) => a.l - b.l);
    for (const d of dabs) { g.fillStyle = pal.acc && d.l > 0.5 && R.chance(0.035) ? R.pick(pal.acc) : leafShade(pal, d.l); g.beginPath(); g.ellipse(d.px, d.py, d.rw, d.rh, d.ang, 0, TAU); g.fill(); }
  }
  const CROWN_LOBES = [[-8, -80, 22, 19], [16, -78, 22, 19], [0, -62, 30, 25], [-22, -46, 24, 21], [22, -48, 26, 22], [0, -50, 30, 22]];       // клубы кроны: от дальних верхних к ближним нижним
  // Дерево: (x, y) — основание ствола на земле, s — масштаб. Ствол светлее со стороны солнца, у корня лапы, тень на земле; крона — клубы
  function paintTree(g, R, x, y, s, pal, lobes) {
    const th = 46 * s, tw = 9 * s;
    g.fillStyle = 'rgba(60,34,26,0.24)'; g.beginPath(); g.ellipse(x + 9 * s, y + 2 * s, 40 * s, 6.5 * s, 0, 0, TAU); g.fill();
    const tg = g.createLinearGradient(x - tw, 0, x + tw, 0); tg.addColorStop(0, '#2a1b15'); tg.addColorStop(0.62, '#58392a'); tg.addColorStop(1, '#8a6240');
    g.fillStyle = tg; g.beginPath(); g.moveTo(x - tw * 0.95, y + 1); g.quadraticCurveTo(x - tw * 0.3, y - th * 0.35, x - tw * 0.42, y - th); g.lineTo(x + tw * 0.42, y - th); g.quadraticCurveTo(x + tw * 0.34, y - th * 0.35, x + tw * 0.98, y + 1); g.closePath(); g.fill();
    g.strokeStyle = '#3a2418'; g.lineCap = 'round'; g.lineWidth = 2.6 * s;
    for (const [bx, by] of [[-16, -64], [15, -60]]) { g.beginPath(); g.moveTo(x, y - th * 0.78); g.quadraticCurveTo(x + bx * 0.4 * s, y - th * 0.95, x + bx * s, y + by * s); g.stroke(); }      // две ветки уходят в крону
    for (const [dx, dy, rx, ry] of (lobes || CROWN_LOBES)) lobe(g, R, x + dx * s, y + dy * s, rx * s, ry * s, pal, { k: 0.1, size: s > 1.15 ? 1.12 : 1 });
  }
  // Тополь (высокие узкие клубы, суживающиеся к острой верхушке) в локальных координатах (0, 0 — основание)
  function paintPoplar(g, R, s, pal) {
    const tg = g.createLinearGradient(-4, 0, 4, 0); tg.addColorStop(0, '#2a1b15'); tg.addColorStop(1, '#7a5638');
    g.fillStyle = tg; g.fillRect(-4 * s, -38 * s, 8 * s, 40 * s);
    for (const [dy, rx, ry] of [[-132, 4.5, 13], [-118, 8, 17], [-102, 12, 21], [-84, 15, 23], [-64, 17.5, 24], [-46, 18, 22]]) lobe(g, R, R.range(-1.6, 1.6) * s, dy * s, rx * s, ry * s, pal, { k: 0.12, size: 0.92 * (s > 1.1 ? 1.1 : 1) });
  }
  // Полоса далёкой зелени вдоль верхней кромки берега: клубы по линии, три ряда (дальний тёмный и сизый, ближний теплее); верх неровный, а не плоский многоугольник. part 'back' — два дальних ряда
  // (рисуются до деревьев), 'front' — ближний ряд, тень на песке и травинки (после деревьев, что стоят за ним: стволы вырастают из зелени, а не висят над ней)
  function paintHedge(g, R, X, x0, x1, land, part) {
    const rows = part === 'front' ? [[72, LEAF.green, 0.02, 0.82]] : [[26, LEAF.far, -0.08, 1.15], [50, LEAF.far, 0, 1]];
    for (const [yy, pal, bias, ryk] of rows) {
      for (let x = x0; x < x1; x += R.range(24, 40)) lobe(g, R, X(x), yy + R.range(-9, 9), R.range(30, 48), R.range(22, 34) * ryk, pal, { k: 0.085, bias, size: 1.05 });
    }
    if (part !== 'front') return;
    g.save(); land(); g.clip();
    const sg = g.createLinearGradient(0, 94, 0, 128); sg.addColorStop(0, 'rgba(46,30,22,0.30)'); sg.addColorStop(1, 'rgba(46,30,22,0)'); g.fillStyle = sg; g.fillRect(0, 94, 6000, 36);      // тень полосы лежит на песке
    g.restore();
    g.lineCap = 'round';
    for (let x = x0; x < x1; x += R.range(5, 9)) {                                          // травинки на границе с песком
      const y = 94 + R.range(-3, 7), hh = R.range(6, 14), lean = R.range(-0.5, 0.5);
      g.strokeStyle = R.pick(['#2f5a32', '#3f7038', '#5a8a3c', '#8ea648']); g.lineWidth = R.range(1.2, 2.2);
      g.beginPath(); g.moveTo(X(x), y); g.quadraticCurveTo(X(x) + lean * hh * 0.5, y - hh * 0.6, X(x) + lean * hh, y - hh); g.stroke();
    }
  }

  const PROPS = {
    bench(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 52);
      for (const dx of [-38, 38]) { g.fillStyle = '#343a46'; g.fillRect(dx - 3, -24, 6, 25); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(dx - 3, -24, 6, 25); g.fillRect(dx - 3, -58, 6, 36); g.strokeRect(dx - 3, -58, 6, 36); }
      wood(g, -46, -62, 92, 9, '#c68a52', '#a06a3a'); wood(g, -46, -50, 92, 9, '#c68a52', '#a06a3a'); wood(g, -46, -28, 92, 9, '#d09a5e', '#a8703e');
      g.restore();
    },
    lamp(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 14);
      g.fillStyle = '#2c3340'; g.fillRect(-3, -122, 6, 122); g.fillRect(-9, -9, 18, 9); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(-3, -122, 6, 122); g.strokeRect(-9, -9, 18, 9);
      g.beginPath(); g.moveTo(-9, -126); g.lineTo(9, -126); g.lineTo(13, -148); g.lineTo(-13, -148); g.closePath(); g.fillStyle = A.linG(g, 0, -148, 0, -126, [[0, '#fff0c0'], [1, '#ffd484']]); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-16, -148); g.lineTo(0, -160); g.lineTo(16, -148); g.closePath(); g.fillStyle = '#2c3340'; g.fill(); g.stroke();
      A.glow(g, 0, -137, 58, 'rgba(255,212,140,', 0.36);
      g.restore();
    },
    kiosk(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 96);
      g.fillStyle = A.linG(g, 0, -100, 0, 0, [[0, '#ecdcb6'], [1, '#c9ae82']]); g.fillRect(-70, -100, 140, 100); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(-70, -100, 140, 100);
      g.fillStyle = '#7d8798'; g.fillRect(-52, -82, 104, 48); g.lineWidth = 2; g.strokeRect(-52, -82, 104, 48);                 // закрытые ставни
      g.strokeStyle = 'rgba(30,36,50,0.55)'; g.lineWidth = 1.4; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(-52, -82 + k * 8); g.lineTo(52, -82 + k * 8); g.stroke(); }
      wood(g, -62, -32, 124, 8, '#a06a3a', '#7a4c2a');
      for (let i = 0; i < 8; i++) { const x0 = -80 + i * 20; g.beginPath(); g.moveTo(x0, -118); g.lineTo(x0 + 20, -118); g.lineTo(x0 + 18, -96); g.quadraticCurveTo(x0 + 10, -90, x0 + 2, -96); g.closePath(); g.fillStyle = i % 2 ? '#f6ecd8' : '#d85a44'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(); }
      g.beginPath(); g.arc(0, -134, 12, 0, TAU); g.fillStyle = '#f6ecd8'; g.fill(); g.stroke();                                 // значок мороженого над козырьком (без надписей)
      g.beginPath(); g.moveTo(-6, -131); g.lineTo(6, -131); g.lineTo(0, -116); g.closePath(); g.fillStyle = '#e8b878'; g.fill(); g.stroke();
      g.beginPath(); g.arc(0, -137, 6.5, 0, TAU); g.fillStyle = '#f2a4b8'; g.fill(); g.stroke();
      g.restore();
    },
    lifebuoy(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 20);
      g.fillStyle = '#d7d3c8'; g.fillRect(-3, -64, 6, 64); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(-3, -64, 6, 64);
      Ale.rr(g, -27, -112, 54, 52, 6); g.fillStyle = '#f4f0e6'; g.fill(); g.lineWidth = 2.2; g.stroke();
      g.lineWidth = 9; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, -86, 17, i * Math.PI / 2, (i + 1) * Math.PI / 2); g.strokeStyle = i % 2 ? '#f6f2e8' : '#d8483c'; g.stroke(); }
      g.lineWidth = 1.8; g.strokeStyle = OUT; g.beginPath(); g.arc(0, -86, 21.5, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, -86, 12.5, 0, TAU); g.stroke();
      g.restore();
    },
    bush(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); const R = A.rng(Math.floor(Math.abs(x)) * 7 + 3), pal = R.chance(0.35) ? LEAF.autumn : LEAF.green;
      g.fillStyle = 'rgba(60,34,26,0.22)'; g.beginPath(); g.ellipse(6, 1, 36, 5.5, 0, 0, TAU); g.fill();
      for (const [dx, dy, rx, ry] of [[0, -22, 20, 16], [-17, -13, 17, 13], [17, -13, 18, 13]]) lobe(g, R, dx, dy, rx, ry, pal, { k: 0.12, size: 0.9 });
      g.restore();
    },
    rocks(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s);
      for (const [dx, rx, ry] of [[-14, 15, 9], [8, 18, 12], [26, 11, 7]]) { g.fillStyle = A.linG(g, 0, -ry * 2, 0, 2, [[0, '#b4aa9c'], [1, '#6e665c']]); g.beginPath(); g.ellipse(dx, -ry, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.8; g.stroke(); }
      g.restore();
    },
    bin(g, x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 14);
      g.fillStyle = A.linG(g, -10, 0, 10, 0, [[0, '#4a6a58'], [1, '#2e4a3a']]); g.fillRect(-10, -34, 20, 34); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(-10, -34, 20, 34);
      g.strokeStyle = 'rgba(20,40,30,0.6)'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(-10, -34 + k * 8); g.lineTo(10, -34 + k * 8); g.stroke(); }
      g.beginPath(); g.ellipse(0, -35, 12, 3.6, 0, 0, TAU); g.fillStyle = '#3a5a48'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.8; g.stroke();
      g.restore();
    },
    sign(g, x, y, s) {                                                     // указатель со стрелкой, без надписей
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 12);
      g.fillStyle = '#6a5a4a'; g.fillRect(-3, -84, 6, 84); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(-3, -84, 6, 84);
      g.beginPath(); g.moveTo(-32, -100); g.lineTo(18, -100); g.lineTo(34, -88); g.lineTo(18, -76); g.lineTo(-32, -76); g.closePath(); g.fillStyle = '#2f5fa0'; g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-22, -91); g.lineTo(14, -91); g.lineTo(14, -96); g.lineTo(26, -88); g.lineTo(14, -80); g.lineTo(14, -85); g.lineTo(-22, -85); g.closePath(); g.fillStyle = '#f6f2e8'; g.fill();
      g.restore();
    },
    barrier(g, x, y, s) {                                                  // дорожный барьер, красно-белая перекладина на опорах: проход закрыт
      g.save(); g.translate(x, y); g.scale(s, s); shadowAt(g, 56);
      for (const dx of [-48, 48]) { g.beginPath(); g.moveTo(dx - 7, 0); g.lineTo(dx, -44); g.lineTo(dx + 7, 0); g.strokeStyle = OUT; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#d7d3c8'; g.lineWidth = 2.4; g.stroke(); }
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6f2e8' : '#d8483c'; g.fillRect(-60 + i * 15, -50, 15, 12); }
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-60, -50, 120, 12);
      g.beginPath(); g.arc(0, -62, 6, 0, TAU); g.fillStyle = '#ff6a4a'; g.fill(); g.stroke(); A.glow(g, 0, -62, 26, 'rgba(255,80,50,', 0.4);                   // сигнальная лампа
      g.restore();
    },
    poplar(g, x, y, s) {
      g.save(); g.translate(x, y); const R = A.rng(Math.floor(Math.abs(x)) * 5 + 11);
      g.fillStyle = 'rgba(60,34,26,0.22)'; g.beginPath(); g.ellipse(8 * s, 1, 24 * s, 5 * s, 0, 0, TAU); g.fill();
      paintPoplar(g, R, s, LEAF.poplar);
      g.restore();
    },
  };
  // Где что стоит на левом берегу (мировой x от центра бревна, y слоя; мельче и выше — дальше): герои идут от −1900 до −420, а вид захватывает ещё столько же с обеих сторон
  const BEACH_PROPS = [
    ['lamp', -2640, 244, 0.95], ['bench', -2540, 268, 0.95], ['bush', -2460, 232, 1.1], ['rocks', -2390, 252, 1], ['sign', -2250, 262, 0.95], ['bin', -2180, 262, 0.95],
    ['lamp', -2090, 246, 0.95], ['bench', -1990, 270, 1], ['poplar', -1900, 196, 1.0], ['bush', -1840, 236, 1.2], ['kiosk', -1730, 250, 1.0], ['bin', -1630, 266, 0.95],
    ['lamp', -1540, 244, 0.95], ['bush', -1460, 230, 1.0], ['barrier', -1330, 262, 1.0], ['sign', -1230, 258, 0.95], ['rocks', -1150, 270, 1.0], ['lamp', -1040, 248, 0.95],
    ['bench', -940, 266, 1.0], ['bush', -850, 238, 1.15], ['poplar', -780, 190, 1.05], ['bin', -700, 264, 0.95], ['lamp', -600, 246, 0.95], ['rocks', -540, 266, 1.0],
    ['bush', -480, 228, 1.0], ['lifebuoy', -330, 262, 1.0], ['bench', -690, 272, 0.95], ['rocks', -250, 270, 0.9],
  ];
  function buildBank(side) {
    const left = side === 'L', EX = left ? BANK.extL : BANK_EX, TM = BANK.topM;
    const edgeAt = (ly) => BANK.edgeX + EX + (ly - BANK.edgeY) * BANK_EDGE;      // глубина суши от края слоя до воды (для правого — зеркально); у левого суша тянется слева на extL px
    return A.layer(BANK.w + EX, BANK.h + TM, (g, w, hh) => {
      g.translate(0, TM); const h = hh - TM;                             // всё ниже нарисовано в прежних координатах слоя; запас сверху — для крон деревьев
      const R = A.rng(left ? 91 : 92);
      // суша: полигон слева (или справа) от наклонной линии
      const land = () => { g.beginPath(); if (left) { g.moveTo(0, 0); g.lineTo(edgeAt(0), 0); g.lineTo(edgeAt(h), h); g.lineTo(0, h); } else { g.moveTo(w, 0); g.lineTo(w - edgeAt(0), 0); g.lineTo(w - edgeAt(h), h); g.lineTo(w, h); } g.closePath(); };
      const X = (x) => (left ? x : w - x);                                // зеркало для правого берега
      // песок
      land(); g.fillStyle = A.linG(g, 0, 0, 0, h, left ? [[0, '#cfa56e'], [0.5, '#e6c590'], [1, '#f0d6a6']] : [[0, '#7c9e68'], [0.35, '#97b968'], [0.7, '#aecb72'], [1, '#c2d884']]); g.fill();
      g.save(); land(); g.clip();
      const kw = w / BANK.w;                                                // длинный слой: пятен, камешков и цветов пропорционально больше
      for (let i = 0; i < Math.round(520 * kw); i++) { const y = R.range(40, h), x = R.range(0, edgeAt(y)); g.fillStyle = R.chance(0.5) ? 'rgba(255,240,200,0.22)' : (left ? 'rgba(140,100,60,0.2)' : 'rgba(40,80,30,0.2)'); g.beginPath(); g.ellipse(X(x), y, R.range(2, 7), R.range(1, 2.6), 0, 0, TAU); g.fill(); }
      if (left) {
        for (let i = 0; i < Math.round(46 * kw); i++) { const y = R.range(150, h - 6), x = R.range(40, edgeAt(y) - 24); g.fillStyle = R.pick(['#8a7258', '#a08a6c', '#6e5c48']); g.beginPath(); g.ellipse(x, y, R.range(3, 7), R.range(2, 4), R.range(-0.4, 0.4), 0, TAU); g.fill(); g.strokeStyle = 'rgba(43,26,32,0.5)'; g.lineWidth = 1; g.stroke(); }
        // широкие полосы светлее и темнее (дюны), тропа вытоптанного песка вдоль пляжа и следы прилива: пляж не должен быть одним гладким градиентом на сотни px
        for (let i = 0; i < Math.round(14 * kw); i++) { const y = R.range(110, h - 20), x = R.range(0, edgeAt(y) - 120), rw = R.range(160, 420), rh = R.range(10, 26); g.fillStyle = R.chance(0.5) ? 'rgba(255,232,186,0.18)' : 'rgba(170,124,78,0.16)'; g.beginPath(); g.ellipse(x, y, rw, rh, R.range(-0.04, 0.04), 0, TAU); g.fill(); }
        g.beginPath(); g.moveTo(0, 276); for (let x = 0; x <= edgeAt(300) - 150; x += 30) g.lineTo(x, 276 + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.031) * 3);
        for (let x = edgeAt(300) - 150; x >= 0; x -= 30) g.lineTo(x, 316 + Math.sin(x * 0.014 + 1) * 6 + Math.sin(x * 0.027) * 3); g.closePath(); g.fillStyle = 'rgba(176,132,86,0.2)'; g.fill();
        for (let i = 0; i < Math.round(34 * kw); i++) { const x = R.range(40, edgeAt(300) - 160), y = R.range(120, 330); g.strokeStyle = 'rgba(150,110,70,0.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + R.range(8, 18), y - R.range(2, 5), x + R.range(24, 44), y + R.range(-2, 2)); g.stroke(); }          // рябь на песке
      }
      if (!left) {                                                                          // зелёный берег: тропинка вглубь парка, кусты и тёплые пятна света
        const pw = (u) => 26 + 74 * u;                                                       // ширина тропы: у зрителя шире
        g.beginPath(); for (let i = 0; i <= 24; i++) { const u = 1 - i / 24, x = 780 + Math.sin(u * 3.1) * 70 + (1 - u) * 190, y = 70 + u * 360; if (i) g.lineTo(x - pw(u) / 2, y); else g.moveTo(x - pw(u) / 2, y); }
        for (let i = 24; i >= 0; i--) { const u = 1 - i / 24, x = 780 + Math.sin(u * 3.1) * 70 + (1 - u) * 190, y = 70 + u * 360; g.lineTo(x + pw(u) / 2, y); }
        g.closePath(); g.fillStyle = A.linG(g, 0, 70, 0, 430, [[0, '#cdb88a'], [1, '#e6d2a0']]); g.fill(); g.strokeStyle = 'rgba(90,70,40,0.35)'; g.lineWidth = 2; g.stroke();
        for (let i = 0; i < 70; i++) { const u = R.range(0, 1), x = 780 + Math.sin(u * 3.1) * 70 + (1 - u) * 190 + R.range(-0.4, 0.4) * pw(u), y = 70 + u * 360; g.fillStyle = R.chance(0.5) ? 'rgba(120,96,60,0.35)' : 'rgba(255,244,214,0.4)'; g.beginPath(); g.ellipse(x, y, R.range(2, 5) * (0.5 + u), R.range(1, 2) * (0.5 + u), 0, 0, TAU); g.fill(); }
        for (const [bx, by, br] of [[640, 380, 36], [1010, 330, 32], [900, 150, 24], [560, 270, 26], [1180, 260, 30], [720, 120, 20], [1320, 180, 24], [1100, 400, 40]]) {           // кусты (клубы листвы, как у деревьев)
          g.fillStyle = 'rgba(40,70,30,0.25)'; g.beginPath(); g.ellipse(bx + br * 0.2, by + br * 0.55, br * 1.5, br * 0.28, 0, 0, TAU); g.fill();
          for (const [dx, dy, rr] of [[-0.45, 0.1, 0.7], [0.45, 0.1, 0.7], [0, -0.3, 0.85]]) lobe(g, R, bx + dx * br, by + dy * br, rr * br * 1.08, rr * br * 0.92, LEAF.park, { k: 0.14, size: 0.85 });
        }
        g.fillStyle = 'rgba(255,236,170,0.1)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(R.range(520, w - 80), R.range(120, h - 40), R.range(60, 150), R.range(14, 30), R.range(-0.2, 0.2), 0, TAU); g.fill(); }
      }
      // тёмная основа под зеленью вдоль верхней кромки (чтобы между клубами не просвечивал нарисованный дальний вид); сама листва — ниже, клубами, поверх земли без обрезки (11.10.2026)
      for (let k = 0; k < 2; k++) { g.fillStyle = ['#1c3a2d', '#21453a'][k]; g.beginPath(); g.moveTo(X(0), 0); for (let x = 0; x <= edgeAt(0) + 60; x += 26) g.lineTo(X(x), 46 + k * 22 + R.range(-6, 6) + Math.sin(x * 0.05 + k) * 6); g.lineTo(X(edgeAt(0) + 90), 0); g.closePath(); g.fill(); }
      g.restore();
      // мокрая кромка у воды и пена
      g.save(); land(); g.clip();
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [off, col, wd] of [[16, 'rgba(120,86,58,0.55)', 12], [7, 'rgba(90,64,44,0.5)', 7]]) {
        g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(X(edgeAt(0) - off), 0); g.lineTo(X(edgeAt(h) - off), h); g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath();
      for (let y = 20; y <= h; y += 12) { const x = edgeAt(y) + Math.sin(y * 0.2) * 3; if (y === 20) g.moveTo(X(x), y); else g.lineTo(X(x), y); } g.stroke();
      g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X(edgeAt(0) + 3), 0); g.lineTo(X(edgeAt(h) + 3), h); g.stroke();
      // камыши и рогоз у воды (кластеры), деревья у верхней кромки
      const reeds = (x, y, n, s) => { for (let i = 0; i < n; i++) { const rx = x + R.range(-12, 12) * s, hh2 = R.range(26, 62) * s, lean = R.range(-0.25, 0.25); g.strokeStyle = R.pick(['#5a7a38', '#6f8c42', '#4a6a30']); g.lineWidth = R.range(1.8, 3) * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(X(rx), y); g.quadraticCurveTo(X(rx + lean * hh2 * 0.4), y - hh2 * 0.6, X(rx + lean * hh2), y - hh2); g.stroke(); if (R.chance(0.33)) { g.fillStyle = '#6a3e28'; g.beginPath(); g.ellipse(X(rx + lean * hh2), y - hh2 - 7 * s, 3 * s, 9 * s, lean, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke(); } } };
      for (let y = 40; y < h; y += 58) reeds(edgeAt(y) - R.range(8, 26), y + 6, 5, 0.75 + y / h * 0.55);
      const tree = (x, y, s) => paintTree(g, R, X(x), y, s, left ? (R.chance(0.3) ? LEAF.autumn : LEAF.green) : LEAF.park);
      paintHedge(g, R, X, 10, edgeAt(0) - 14, land, 'back');                                // далёкая зелень за деревьями
      if (left) {
        // деревья вдоль всей кромки: разной высоты, то круглые, то тополя; первые — дальше от зрителя (выше и мельче), поэтому рисуем по возрастанию y
        const row = []; for (let x = 30; x < edgeAt(0) - 50; x += R.range(84, 150)) row.push([x, R.range(34, 96), R.range(0.95, 1.6), R.chance(0.28)]);
        row.sort((a, b) => a[1] - b[1]);
        const plant = ([x, y, sc, pop]) => { if (pop) { const ps = Math.min(sc, (y + 40 + TM - 12) / 159.5);                        // высота тополя ≈ 159,5 · масштаб над точкой y + 40: у дальних деревьев крона упиралась в верх слоя и срезалась плоской линией
          g.save(); g.translate(x, y + 40); paintPoplar(g, R, ps * 1.1, LEAF.poplar); g.restore(); } else tree(x, y, sc); };
        for (const o of row) if (o[1] < 66) plant(o);                                      // за ближним рядом зелени
        paintHedge(g, R, X, 10, edgeAt(0) - 14, land, 'front');
        for (const o of row) if (o[1] >= 66) plant(o);                                     // перед ним
        // мелочи на пляже: по возрастанию y (дальше — раньше), цветы и палочки между ними
        const wx = (world) => world + 150 + BANK.edgeX + EX;
        for (let i = 0; i < Math.round(60 * kw); i++) { const x = R.range(40, edgeAt(250) - 200), y = R.range(150, 280); g.fillStyle = R.pick(['#fff4c4', '#f6a4b4', '#ffd24a', '#ffffff']); g.beginPath(); g.arc(x, y, R.range(1.6, 2.8), 0, TAU); g.fill(); }
        for (const [kind, wxx, y, sc] of BEACH_PROPS.slice().sort((a, b) => a[2] - b[2])) PROPS[kind](g, wx(wxx), y, sc);
        for (let i = 0; i < 5; i++) { const x = wx(R.range(-2500, -300)), y = R.range(262, 318); g.strokeStyle = OUT; g.lineWidth = 4.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R.range(18, 40), y + R.range(-5, 5)); g.stroke(); g.strokeStyle = '#8a6a48'; g.lineWidth = 2.2; g.stroke(); }          // сухие ветки
      } else { const rowR = []; for (let x = 40; x < edgeAt(0) - 30; x += R.range(100, 160)) rowR.push([x, R.range(36, 92), R.range(1.0, 1.5)]); rowR.sort((a, b) => a[1] - b[1]);
        for (const [x, y, sc] of rowR) if (y < 66) tree(x, y, sc);
        paintHedge(g, R, X, 10, edgeAt(0) - 14, land, 'front');
        for (const [x, y, sc] of rowR) if (y >= 66) tree(x, y, sc); }
      // цветы на траве правого берега
      if (!left) for (let i = 0; i < Math.round(40 * kw * 1.6); i++) { const y = R.range(60, h - 10), x = R.range(10, edgeAt(y) - 30); g.fillStyle = R.pick(['#fff4c4', '#f6a4b4', '#ffd24a', '#ffffff']); g.beginPath(); g.arc(X(x), y, R.range(1.6, 2.8), 0, TAU); g.fill(); }
      g.save(); land(); g.clip(); A.grain(g, 0, 0, w, h, 0.12, 'overlay', 17, 0.6); g.restore();            // зерно — только на суше (иначе по всему прямоугольнику слоя остаётся мутная полоса над водой)
    }, dens(1));
  }

  // ---------------------------------------------------------------- бревно
  // Локальные координаты: начало — середина ватерлинии, x вперёд (нос справа), y вниз; длина ≈ 290. Просто большое бревно (владелец 08.10.2026: «бревно вместо лодки»): толстый ствол с корой, мхом
  // и содранными пятнами светлой древесины, слева — рваный корневой конец с короткими корнями, справа — спил с годовыми кольцами, на спине два обломанных сучка с листьями.
  // Подводная часть — тёмная полоса под ватерлинией (в воде просвечивает).
  const LOGS = { w: 400, h: 130, ox: 215, oy: 92 };                      // габарит слоя и точка начала в нём
  function stroke(g, w, c) { g.lineWidth = w; g.strokeStyle = c || OUT; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function buildLog() {
    return A.layer(LOGS.w, LOGS.h, (g) => {
      g.translate(LOGS.ox, LOGS.oy);
      const R = A.rng(55);
      // подводная часть: ствол уходит под воду округлым днищем
      g.beginPath(); g.moveTo(-148, 3); g.bezierCurveTo(-142, 24, -100, 28, -40, 28); g.lineTo(60, 28); g.bezierCurveTo(112, 28, 140, 20, 144, 3); g.closePath();
      g.fillStyle = 'rgba(52,34,28,0.55)'; g.fill();
      // корни на левом конце: короткие толстые отростки, часть торчит из воды, часть уходит вглубь
      const rootsL = [[-146, -8, -172, -20, -186, -14, 9], [-146, -18, -168, -40, -178, -38, 8], [-148, 0, -170, 10, -184, 6, 8], [-144, -26, -156, -52, -150, -62, 7], [-146, 4, -162, 18, -168, 24, 7]];
      for (const [x0, y0, x1, y1, x2, y2, wd] of rootsL) {
        g.beginPath(); g.moveTo(x0, y0 - wd * 0.5); g.quadraticCurveTo(x1, y1 - wd * 0.6, x2, y2); g.quadraticCurveTo(x1 + 2, y1 + wd * 0.5, x0, y0 + wd * 0.5); g.closePath();
        g.fillStyle = A.linG(g, x0, y0, x2, y2, [[0, '#7a5232'], [1, '#4a3022']]); g.fill(); stroke(g, 2.8);
      }
      // ствол
      const trunk = () => {
        g.beginPath(); g.moveTo(-148, 5);
        g.bezierCurveTo(-154, -8, -152, -22, -146, -30);                                      // корневая лапа, слегка расширяет ствол
        g.lineTo(-141, -37); g.lineTo(-135, -32); g.lineTo(-129, -39); g.lineTo(-122, -35);    // рваный излом
        g.bezierCurveTo(-90, -38, -30, -40, 30, -39); g.bezierCurveTo(80, -38, 118, -37, 134, -35);
        g.bezierCurveTo(143, -33, 147, -26, 147, -18); g.lineTo(145, -4); g.bezierCurveTo(144, 1, 140, 4, 134, 5); g.closePath();
      };
      trunk(); g.fillStyle = A.linG(g, 0, -42, 0, 6, [[0, '#d2a272'], [0.28, '#a8764a'], [0.62, '#7d5232'], [1, '#4a2f20']]); g.fill();
      g.save(); trunk(); g.clip();
      // кора: длинные тёмные трещины вдоль ствола, светлые чешуйки, пятна голой древесины, сучки, мох
      for (let i = 0; i < 95; i++) { const x = R.range(-155, 135), y = R.range(-40, 3), l = R.range(14, 46); g.strokeStyle = R.chance(0.72) ? 'rgba(40,22,14,0.38)' : 'rgba(255,224,170,0.28)'; g.lineWidth = R.range(1, 2.6); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + R.range(-2.5, 2.5), x + l, y + R.range(-1.5, 1.5)); g.stroke(); }
      for (const [px, py, pw, ph] of [[-96, -22, 34, 15], [-8, -30, 42, 12], [74, -20, 30, 13]]) {        // содранная кора: светлая древесина с прожилками
        g.beginPath(); g.ellipse(px, py, pw, ph, 0.04, 0, TAU); g.fillStyle = '#e1c490'; g.fill(); g.strokeStyle = 'rgba(70,40,24,0.55)'; g.lineWidth = 2.2; g.stroke();
        g.strokeStyle = 'rgba(150,100,60,0.5)'; g.lineWidth = 1.2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(px - pw * 0.8, py + k * ph * 0.35); g.quadraticCurveTo(px, py + k * ph * 0.35 + 2, px + pw * 0.8, py + k * ph * 0.35); g.stroke(); }
      }
      for (const [kx, ky] of [[-52, -26], [34, -12], [112, -24], [-122, -18]]) { g.fillStyle = 'rgba(40,22,14,0.6)'; g.beginPath(); g.ellipse(kx, ky, 8, 5.4, 0.1, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,214,160,0.4)'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(kx, ky, 4, 2.6, 0.1, 0, TAU); g.stroke(); }
      for (let i = 0; i < 34; i++) { g.fillStyle = R.pick(['rgba(96,138,62,0.55)', 'rgba(74,114,54,0.5)']); g.beginPath(); g.ellipse(R.range(-140, 132), R.range(-6, 4), R.range(6, 16), R.range(2, 4.4), 0, 0, TAU); g.fill(); }
      A.gradV(g, -160, -44, 320, 16, [[0, 'rgba(255,232,186,0.6)'], [1, 'rgba(255,232,186,0)']]);                // свет сверху
      A.gradV(g, -160, -12, 320, 20, [[0, 'rgba(30,16,14,0)'], [1, 'rgba(30,16,14,0.55)']]);                      // тень у воды
      g.restore();
      trunk(); stroke(g, 3.6);
      // спил на правом конце: эллипс с годовыми кольцами
      g.beginPath(); g.ellipse(143, -18, 9, 21, 0.05, 0, TAU); g.fillStyle = '#e8cc98'; g.fill(); stroke(g, 3);
      g.strokeStyle = 'rgba(150,98,58,0.75)'; g.lineWidth = 1.5; for (const k of [0.68, 0.4, 0.14]) { g.beginPath(); g.ellipse(143, -18, 9 * k, 21 * k, 0.05, 0, TAU); g.stroke(); }
      g.fillStyle = '#7a4c30'; g.beginPath(); g.arc(143, -18, 1.6, 0, TAU); g.fill();
      // два обломанных сучка на спине (с листьями) и короткий пенёк у корня
      const stub = (x, y, dx, dy, wd, leaves) => {
        g.beginPath(); g.moveTo(x - wd * 0.6, y + 3); g.lineTo(x + dx - wd * 0.4, y + dy); g.lineTo(x + dx + wd * 0.5, y + dy + 1); g.lineTo(x + wd * 0.7, y + 3); g.closePath();
        g.fillStyle = A.linG(g, x, y, x + dx, y + dy, [[0, '#8a5a38'], [1, '#6a4228']]); g.fill(); stroke(g, 2.6);
        g.fillStyle = '#e8cc98'; g.beginPath(); g.ellipse(x + dx, y + dy, wd * 0.5, wd * 0.28, Math.atan2(dy, dx) + 1.5, 0, TAU); g.fill(); stroke(g, 1.8);
        for (let i = 0; i < leaves; i++) {
          const a = -1.2 + i * 0.7 + R.range(-0.2, 0.2), lx = x + dx + Math.cos(a) * 9, ly = y + dy + Math.sin(a) * 9 - 4;
          g.save(); g.translate(lx, ly); g.rotate(a + 1.57); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(7, -8, 0, -17); g.quadraticCurveTo(-7, -8, 0, 0); g.closePath();
          g.fillStyle = A.linG(g, 0, -17, 0, 0, [[0, '#a8d062'], [1, '#4c8a40']]); g.fill(); stroke(g, 1.8); g.strokeStyle = 'rgba(30,70,30,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -1); g.lineTo(0, -15); g.stroke(); g.restore();
        }
      };
      stub(-18, -38, -10, -24, 11, 3);
      stub(48, -38, 12, -30, 10, 4);
      stub(-110, -36, -6, -14, 9, 0);
      // чуть мха на самом верху
      g.fillStyle = 'rgba(110,150,70,0.7)'; for (const [x, y, rx] of [[-70, -39, 10], [20, -40, 8], [98, -37, 9]]) { g.beginPath(); g.ellipse(x, y, rx, 3, 0, 0, TAU); g.fill(); }
      g.save(); trunk(); g.clip(); A.grain(g, -190, -70, 360, 110, 0.1, 'overlay', 9, 0.5); g.restore();      // зерно — только на стволе (на прозрачном фоне слоя оно оставляет светлый прямоугольник)
    }, 2);
  }

  // ---------------------------------------------------------------- плывущие вещи
  // Начало каждого спрайта — середина ватерлинии. Все показаны над водой; нижняя часть уходит в воду (рисуется слой воды поверх не нужен: срез по ватерлинии).
  function makeSprite(w, h, ox, oy, fn) {
    const lay = A.layer(w, h, (g) => { g.translate(ox, oy); fn(g); }, 2);
    return { L: lay, ox, oy };
  }
  function barrelArt(g, v) {
    const cols = [['#c88a52', '#94603a', '#5a3a28'], ['#4a78c4', '#2f56a0', '#1c3a72'], ['#d85a44', '#b03a2c', '#74221a']][v % 3];
    g.beginPath(); g.moveTo(-23, 2); g.bezierCurveTo(-30, -14, -30, -34, -22, -48); g.lineTo(22, -48); g.bezierCurveTo(30, -34, 30, -14, 23, 2); g.closePath();
    g.fillStyle = A.linG(g, -28, 0, 28, 0, [[0, cols[1]], [0.35, cols[0]], [1, cols[2]]]); g.fill(); stroke(g, 3.2);
    g.save(); g.clip();
    g.strokeStyle = 'rgba(30,16,12,0.4)'; g.lineWidth = 1.4; for (let x = -18; x <= 18; x += 9) { g.beginPath(); g.moveTo(x, -50); g.quadraticCurveTo(x * 1.28, -22, x, 4); g.stroke(); }
    g.restore();
    for (const y of [-40, -26, -10]) { g.beginPath(); g.moveTo(-27 + Math.abs(y + 24) * 0.05, y); g.quadraticCurveTo(0, y + 5, 27 - Math.abs(y + 24) * 0.05, y); g.lineWidth = 4.2; g.strokeStyle = v === 1 ? '#e8eef8' : '#4c525a'; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke(); }
    g.beginPath(); g.ellipse(0, -48, 22, 7, 0, 0, TAU); g.fillStyle = cols[0]; g.fill(); stroke(g, 2.8);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, -48, 13, 3.6, 0, 0, TAU); g.fill();
  }
  function snagArt(g, v) {
    const R = A.rng(300 + v), len = 74 + v * 4;
    g.beginPath(); g.moveTo(-len, -6); g.bezierCurveTo(-len - 4, -20, -len + 14, -30, -len + 30, -28); g.lineTo(len - 30, -26); g.bezierCurveTo(len - 6, -26, len + 6, -16, len + 2, -4); g.lineTo(len - 8, 4); g.lineTo(-len + 10, 4); g.closePath();
    g.fillStyle = A.linG(g, 0, -30, 0, 6, [[0, '#7a5a42'], [0.5, '#4e3a2c'], [1, '#2e2018']]); g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 40; i++) { const x = R.range(-len, len), y = R.range(-28, 2), l = R.range(8, 26); g.strokeStyle = R.chance(0.7) ? 'rgba(20,12,10,0.5)' : 'rgba(210,180,140,0.3)'; g.lineWidth = R.range(1, 2.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + R.range(-2, 2)); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(100,140,70,0.55)'; g.beginPath(); g.ellipse(R.range(-len + 10, len - 10), R.range(-26, -18), R.range(5, 12), R.range(2, 4), 0, 0, TAU); g.fill(); }
    A.gradV(g, -len - 8, -30, 2 * len + 16, 12, [[0, 'rgba(255,226,180,0.42)'], [1, 'rgba(255,226,180,0)']]);
    g.restore();
    stroke(g, 3.2);
    // сучья и торчащие щепки
    for (const [x, y, dx, dy] of [[-len * 0.35, -26, -8, -22], [len * 0.2, -26, 12, -26], [len * 0.62, -24, 6, -17]]) { g.beginPath(); g.moveTo(x - 4, y + 2); g.lineTo(x + dx - 2, y + dy); g.lineTo(x + dx + 4, y + dy + 2); g.lineTo(x + 5, y + 2); g.closePath(); g.fillStyle = '#4e3a2c'; g.fill(); stroke(g, 2.2); }
    g.fillStyle = '#e3c89a'; g.beginPath(); g.ellipse(-len + 4, -10, 5, 11, 0, 0, TAU); g.fill(); stroke(g, 2.2);
    g.strokeStyle = 'rgba(120,80,50,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(-len + 4, -10, 2.4, 5.5, 0, 0, TAU); g.stroke();
  }
  function rootArt(g, v) {
    const R = A.rng(400 + v);
    // клубок корней: комок земли и торчащие дугами корни
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI * (0.05 + 0.9 * i / 11), x0 = Math.cos(a0) * 18, y0 = -14 + Math.sin(a0) * 10, len = R.range(30, 54), a1 = a0 + R.range(-0.5, 0.5);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a1) * len * 0.5, y0 + Math.sin(a1) * len * 0.6 - 6, x0 + Math.cos(a1 + 0.5) * len, y0 + Math.sin(a1 + 0.5) * len * 0.85 - 4);
      g.lineWidth = R.range(4, 7.5); g.strokeStyle = OUT; g.lineCap = 'round'; g.stroke(); g.lineWidth = g.lineWidth - 3; g.strokeStyle = A.linG(g, -50, -50, 50, 0, [[0, '#8a6448'], [1, '#4e3a2c']]); g.stroke();
    }
    g.beginPath(); g.ellipse(0, -10, 30, 17, 0, Math.PI, 0); g.lineTo(30, 2); g.lineTo(-30, 2); g.closePath();
    g.fillStyle = A.linG(g, 0, -28, 0, 4, [[0, '#6a4e38'], [1, '#2e2018']]); g.fill(); stroke(g, 3.2);
    g.save(); g.clip(); for (let i = 0; i < 18; i++) { g.fillStyle = R.pick(['rgba(20,12,10,0.45)', 'rgba(110,150,74,0.5)', 'rgba(170,130,90,0.35)']); g.beginPath(); g.ellipse(R.range(-28, 28), R.range(-24, 0), R.range(3, 8), R.range(2, 5), 0, 0, TAU); g.fill(); } g.restore();
  }
  function mineArt(g) {
    const R = 26;
    // шипы-рожки
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (i / 8) , x = Math.cos(a) * R, y = -R + Math.sin(a) * R;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.beginPath(); g.moveTo(-5, 2); g.lineTo(0, -15); g.lineTo(5, 2); g.closePath(); g.fillStyle = '#7a7e88'; g.fill(); stroke(g, 2.4); g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(0, -13, 2, 0, TAU); g.fill(); g.restore();
    }
    const gr = g.createRadialGradient(-9, -R - 10, 2, 0, -R, R * 1.15); gr.addColorStop(0, '#8a909c'); gr.addColorStop(0.5, '#454a54'); gr.addColorStop(1, '#1e2128');
    g.beginPath(); g.arc(0, -R, R, Math.PI, 0); g.lineTo(R, 0); g.lineTo(-R, 0); g.closePath(); g.fillStyle = gr; g.fill(); stroke(g, 3.4);
    g.save(); g.beginPath(); g.arc(0, -R, R - 1, Math.PI, 0); g.lineTo(R, 0); g.lineTo(-R, 0); g.closePath(); g.clip();
    g.fillStyle = 'rgba(150,80,40,0.38)'; for (const [x, y, rr] of [[-12, -18, 6], [10, -30, 5], [14, -10, 4], [-4, -38, 4]]) { g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, 0.4, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-R, -R); g.lineTo(R, -R); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(-10, -34, 8, 4, -0.6, 0, TAU); g.fill();
    g.restore();
    g.fillStyle = '#2a2a30'; g.fillRect(-7, -R * 2 - 3, 14, 7); stroke(g, 1.8);
  }
  // Плывущее дерево. Раньше — плоский ствол и зелёные круги с обводкой («старая плохо нарисованная текстура», владелец 11.10.2026). Теперь из нарисованных деталей заказа 26 — корневой ком слева и
  // ствол-коряга, — а справа крона-клуб мазками листвы (осеннее: зелёное с золотом и рыжим, со стороны солнца теплее), тёмные ветки от ствола к кроне и опавшие листья на воде. Деталей нет — прежний вид.
  const TREE_SET = [
    { root: 'swim_root0', trunk: 'swim_snag0', rootX: -100, trunkX: 14, flip: false, crown: [[44, -36, 25, 20], [96, -34, 27, 21], [72, -50, 38, 29]], leaves: [18, 136], seed: 501 },
    { root: 'swim_root1', trunk: 'swim_snag1', rootX: -98, trunkX: 8, flip: true, crown: [[40, -34, 24, 19], [98, -30, 27, 21], [68, -52, 40, 31]], leaves: [10, 136], seed: 502 },
  ];
  function treeArt(g, v) {
    const T = TREE_SET[v % TREE_SET.length], R = A.rng(T.seed);
    if (has(T.root) && has(T.trunk)) {
      Ale.drawSprite(g, T.root, T.rootX, 1);
      Ale.drawSprite(g, T.trunk, T.trunkX, 1, { flip: T.flip });
      g.lineCap = 'round'; g.strokeStyle = '#2f1c14';                                              // ветки от конца ствола в крону
      for (const [x0, y0, x1, y1, w0] of [[50, -26, 66, -52, 3.4], [70, -24, 94, -46, 3], [58, -28, 38, -50, 2.6], [78, -26, 108, -34, 2.4]]) { g.lineWidth = w0; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + R.range(-4, 4), (y0 + y1) / 2 - 6, x1, y1); g.stroke(); }
      for (const [cx, cy, rx, ry] of T.crown) lobe(g, R, cx, cy, rx, ry, LEAF.crown, { k: 0.13, size: 0.95 });
      for (let i = 0; i < 12; i++) {                                                                // опавшие листья на воде вокруг кроны
        const x = R.range(T.leaves[0], T.leaves[1]), y = R.range(-1, 4);
        g.fillStyle = R.pick(['#d49a34', '#c0602a', '#9ab23c', '#e8c05e']); g.beginPath(); g.ellipse(x, y, R.range(2.2, 3.8), R.range(0.9, 1.5), R.range(-0.4, 0.4), 0, TAU); g.fill();
      }
      return;
    }
    // запасной вид без нарисованных деталей
    g.beginPath(); g.moveTo(-100, -2); g.lineTo(-96, -34); g.bezierCurveTo(-40, -42, 40, -40, 104, -34); g.lineTo(108, -6); g.lineTo(-100, 4); g.closePath();
    g.fillStyle = A.linG(g, 0, -40, 0, 6, [[0, '#7a5a42'], [0.5, '#4e3a2c'], [1, '#2e2018']]); g.fill(); stroke(g, 3.4);
    g.save(); g.clip(); for (let i = 0; i < 40; i++) { const x = R.range(-100, 108), y = R.range(-36, 2); g.strokeStyle = 'rgba(20,12,10,0.45)'; g.lineWidth = R.range(1, 2.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R.range(8, 24), y + R.range(-2, 2)); g.stroke(); } g.restore();
    // корневой ком
    for (let i = 0; i < 10; i++) { const a = Math.PI * (0.55 + 0.9 * i / 9), x0 = -96, y0 = -20, len = R.range(26, 52); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * len * 0.6, y0 + Math.sin(a) * len * 0.6 - 14, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len * 0.5 - 30); g.lineWidth = R.range(5, 9); g.strokeStyle = OUT; g.lineCap = 'round'; g.stroke(); g.lineWidth -= 3; g.strokeStyle = '#6a4e38'; g.stroke(); }
    g.beginPath(); g.ellipse(-100, -22, 20, 32, 0, 0, TAU); g.fillStyle = '#5a4030'; g.fill(); stroke(g, 3.2);
    g.fillStyle = 'rgba(30,18,12,0.5)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(-100 + R.range(-12, 12), -22 + R.range(-22, 22), R.range(3, 7), R.range(2, 5), 0, 0, TAU); g.fill(); }
    // крона (над водой, чуть выше ствола): зелёные клубы, ветви
    for (const [dx, dy, r] of [[40, -58, 40], [76, -48, 34], [10, -48, 32], [60, -80, 32], [92, -64, 24], [30, -76, 26]]) {
      g.beginPath(); g.arc(dx, dy, r + 2.6, 0, TAU); g.fillStyle = OUT; g.fill();
    }
    for (const [dx, dy, r] of [[40, -58, 40], [76, -48, 34], [10, -48, 32], [60, -80, 32], [92, -64, 24], [30, -76, 26]]) {
      const gr = g.createRadialGradient(dx - r * 0.3, dy - r * 0.4, 2, dx, dy, r * 1.1); gr.addColorStop(0, '#9ac860'); gr.addColorStop(0.55, '#4f9448'); gr.addColorStop(1, '#2a6038');
      g.fillStyle = gr; g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(18,48,30,0.4)'; g.lineWidth = 1.4; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(dx + R.range(-r * 0.6, r * 0.6), dy + R.range(-r * 0.6, r * 0.6), R.range(3, 6), R.range(0, 3), R.range(3, 6)); g.stroke(); }
    }
  }
  const OBS = { barrel: { w: 90, h: 100, ox: 45, oy: 62, fn: barrelArt, variants: 3 }, snag: { w: 200, h: 80, ox: 100, oy: 44, fn: snagArt, variants: 3 },
    root: { w: 160, h: 110, ox: 80, oy: 62, fn: rootArt, variants: 2 }, mine: { w: 100, h: 110, ox: 50, oy: 70, fn: mineArt, variants: 1 }, tree: { w: 330, h: 200, ox: 178, oy: 130, fn: treeArt, variants: 2 } };

  function prepare() {
    if (alive()) return L;
    const paint = paintImg();                                          // небо и дальний берег — картиной (заказ 27); без неё — слои кодом
    L = { paint, sky: paint ? null : buildSky(), far: paint ? null : buildFar(), bankL: buildBank('L'), bankR: buildBank('R'), log: buildLog(), obs: {} };
    for (const k of Object.keys(OBS)) { const d = OBS[k]; L.obs[k] = []; for (let v = 0; v < d.variants; v++) L.obs[k].push(makeSprite(d.w, d.h, d.ox, d.oy, (g) => d.fn(g, v))); }
    return L;
  }

  // =================================================================== раскладка кадра
  // Положение всего, что есть в кадре, по состоянию сессии S и размеру вида (W × H). Читают и рисование, и реплики (куда показывает облачко над головой героя).
  const SEAT = { x: -58, y: -40 };                                      // стопы Алеси на бревне (локально, в единицах бревна; верх нарисованного ствола — на −45)
  const BOW = { x: 98, y: -40 };                                        // стопы Бубела на переднем конце
  const hash = (n) => { const q = Math.sin(n * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
  const has = (n) => !!(Ale.Assets && Ale.Assets.sprites && Ale.Assets.sprites[n]);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const JUMP_A = [[0.12, 'ale_jump_takeoff'], [0.3, 'ale_jump_rise'], [0.46, 'ale_jump_tuck'], [0.6, 'ale_jump_apex'], [0.8, 'ale_jump_descent'], [0.93, 'ale_jump_reach'], [1.01, 'ale_land']];
  const frameOf = (tab, u) => { for (const [e, n] of tab) if (u < e) return n; return tab[tab.length - 1][1]; };
  const handOf = (name) => (Ale.PLAYER && Ale.PLAYER.HAND && Ale.PLAYER.HAND[name]) || [16, 63];      // кисть переднего кулака на кадре: [вперёд, вверх] в юнитах от опоры
  // Концы весла: g — конец рукояти, t — конец лопасти (центр весла в (cx, cy), ang — направление от рукояти к лопасти на экране)
  const oarEnds = (cx, cy, ang, len, s) => ({ gx: cx - Math.cos(ang) * len / 2, gy: cy - Math.sin(ang) * len / 2, tx: cx + Math.cos(ang) * len / 2, ty: cy + Math.sin(ang) * len / 2, s });
  const mixEnds = (a, b, k) => ({ gx: lerp(a.gx, b.gx, k), gy: lerp(a.gy, b.gy, k), tx: lerp(a.tx, b.tx, k), ty: lerp(a.ty, b.ty, k), s: lerp(a.s, b.s, k) });

  // Где у Бубела пасть (кончик носа; юн. вперёд и вверх от опоры, кадр смотрит вправо): в обычных кадрах — на высоте 29, наклонившись за веслом (bub_jump_land) — на 23: именно там середина
  // лежащего на камне весла, поэтому, подняв голову, Бубел не «телепортирует» его, а лишь поднимает вместе с носом (измерено по кадрам на сетке 10 юн.)
  const MOUTH = { def: [24, 29], bub_jump_land: [25, 23] };
  // ---- берег отплытия: кто где стоит и какими кадрами. Состояние ведёт Ale.RiverStage (src/river_stage.js), здесь оно переводится в экранные положения и имена кадров
  function poseStage(S, P) {
    const st = S.stage, G = Ale.RiverStage.G, A = st.ale, B = st.bub, O = st.oar, cs = P.cs, bs = P.bs, clock = S.clock, out = { ale: null, bub: null, oar: null };
    const ax = P.beach + A.x, ay = P.sandY + A.y, bx = P.beach + B.x, by = P.sandY + B.y, len = G.oarLen * P.s;
    // Алеся
    const breath = Math.sin(clock * 2.6) * 0.011, idle = clock % 3.7 > 3.55 ? 'ale_idle2' : 'ale_idle';
    let aleFrame = null, aleBase = null;                                  // кадр и опора, по кулаку которых ляжет весло-посох
    switch (A.mode) {
      case 'walk': out.ale = { name: 'ale_walk' + (1 + Math.floor(A.dist / (Ale.PLAYER.WALK.shoreStride * cs)) % 24), x: ax, y: ay, sx: cs, sy: cs, rot: 0, flip: false }; break;
      case 'idle': out.ale = { name: idle, x: ax, y: ay, sx: cs * (1 - breath * 0.5), sy: cs * (1 + breath), rot: 0, flip: false }; break;
      case 'crouch': out.ale = { name: 'ale_crouch', x: ax, y: ay, sx: cs, sy: cs, rot: 0, flip: false }; break;
      case 'hop': { const u = clamp(A.t / G.hop, 0, 1); out.ale = { name: frameOf(JUMP_A, u), x: lerp(ax, P.seat.x, ease(u)), y: lerp(ay, P.seat.y, u) - 95 * Math.sin(Math.PI * u), sx: cs, sy: cs, rot: 0, flip: false }; break; }
      case 'log': out.ale = { name: idle, x: P.seat.x, y: P.seat.y, sx: cs * (1 - breath * 0.5), sy: cs * (1 + breath), rot: P.roll, flip: false, onLog: true }; break;
    }
    if (out.ale) { aleFrame = out.ale.name; aleBase = out.ale; }
    // Бубел (собачка: не боится ничего, кроме скуки)
    // поворот не рывком: растяжка по горизонтали fl плавно идёт от +1 к −1 (за 0,2 с), и всё, что привязано к пасти (весло), едет вместе с ней
    const flip = B.face < 0, fl = B.fl === undefined ? B.face : B.fl, bsx = bs * fl, bobY = B.mode === 'trot' ? Math.abs(Math.sin(B.dist / 12)) * -2.5 : 0;
    switch (B.mode) {
      case 'trot': out.bub = { name: 'bub_run' + (1 + Math.floor(B.dist / ((B.cadence || 11) * bs)) % 8), x: bx, y: by, sx: bsx, sy: bs, rot: 0, flip: false }; break;
      case 'sniff': out.bub = { name: B.t % 0.5 < 0.32 ? 'bub_idle2' : 'bub_idle', x: bx, y: by + Math.sin(B.t * 11) * 1.2, sx: bsx, sy: bs, rot: 0, flip: false }; break;
      case 'grab': { const u = B.t < 0.22 ? smooth(B.t / 0.22) : B.t < 0.3 ? 1 : 1 - smooth((B.t - 0.3) / 0.35); out.bub = { name: 'bub_jump_land', x: bx, y: by, sx: bsx, sy: bs, rot: (flip ? -1 : 1) * Ale.RiverStage.G.dip * u, flip: false }; break; }          // нос вниз к веслу, потом голова вверх: поворот вокруг лап
      case 'present': out.bub = { name: clock % 2.4 < 1.9 ? 'bub_idle' : 'bub_idle2', x: bx, y: by + Math.sin(clock * 2.4) * 0.8, sx: bsx, sy: bs, rot: 0, flip: false }; break;
      case 'idle': out.bub = { name: clock % 2.4 < 1.9 ? 'bub_idle' : 'bub_idle2', x: bx, y: by, sx: bsx, sy: bs, rot: 0, flip: false }; break;
    }
    // Весло
    const lying = oarEnds(P.beach + O.x, P.sandY + O.y - (O.h || 0) * P.s, O.ang, len, P.s);          // середина весла на высоте h над песком (пока оно лежит рукоятью на камне — ровно там, где у Бубела пасть)
    const mouthEnds = () => {
      if (!out.bub) return lying;
      const mp = MOUTH[out.bub.name] || MOUTH.def, m = Ale.spritePoint(out.bub.x, out.bub.y + bobY, { sx: out.bub.sx, sy: bs, flip: false, rot: out.bub.rot || 0 }, mp[0], mp[1]);
      // лопасть вперёд по ходу и чуть вверх, на бегу покачивается. Разворот Бубела — это поворот вокруг вертикали (её видно в профиль, кадр растягивается по горизонтали от +1 к −1),
      // и весло, зажатое в зубах, поворачивается вместе с ней: его длина по горизонтали идёт той же растяжкой fl и на миг сжимается почти в точку (оно направлено на зрителя), а не взмахивает над головой на 180°
      const tilt = -0.1 + Math.sin(B.dist / 22) * (flip ? 0.04 : -0.04), vx = Math.cos(tilt) * fl, vy = Math.sin(tilt), vl = Math.hypot(vx, vy) || 1;
      return oarEnds(m.x, m.y, Math.atan2(vy, vx), len * vl, P.s);
    };
    const staffEnds = () => {
      if (!aleBase) return lying;
      const h = handOf(aleFrame), hp = Ale.spritePoint(aleBase.x, aleBase.y, { sx: aleBase.sx, sy: aleBase.sy, rot: aleBase.rot || 0 }, h[0], h[1]);
      return { gx: hp.x, gy: aleBase.y + 3 * P.s - len, tx: hp.x, ty: aleBase.y + 3 * P.s, s: P.s };
    };
    switch (O.at) {
      case 'sand': out.oar = lying; break;
      case 'mouth': out.oar = mouthEnds(); break;
      case 'drop': { const u = clamp(O.t / 0.4, 0, 1), k = 1 - Math.pow(1 - u, 3), e = mixEnds(mouthEnds(), lying, k), lift = Math.sin(Math.PI * Math.min(1, u * 1.4)) * 16 * (1 - u); e.gy -= lift; e.ty -= lift; out.oar = e; break; }
      case 'lift': { const u = smooth(O.t / 0.4), e = mixEnds(lying, staffEnds(), u), arc = Math.sin(Math.PI * u) * 22; e.gy -= arc; e.ty -= arc; out.oar = e; break; }
      case 'staff': out.oar = staffEnds(); break;
    }
    out.oarFront = false;
    return out;
  }

  function layout(S, W, H) {
    const Rv = Ale.River, T = Rv.T, t = S.t, phase = S.phase, st = S.stage;
    const lx = S.lx(W), s = Rv.scaleAt(S.y);
    const bob = Math.sin(S.clock * 2.1) * 2.4 + Math.sin(S.clock * 3.3 + 1) * 1.1;
    const roll = Math.sin(S.clock * 1.6) * 0.012 + S.tilt * 0.04;
    const ly = S.y + (bob + (st ? st.dipNow() : 0)) * s;
    const P = { W, H, lx, ly, s, roll, bob, bankLx: lx - 150 - BANK.edgeX - BANK.extL - S.scroll, edgeR: lx + 130 + (Rv.SCROLL_END - S.scroll), sandY: Rv.LANE_Y[2], beach: lx - S.scroll };
    const loc = (x, y) => ({ x: lx + (x * Math.cos(roll) - y * Math.sin(roll)) * s, y: ly + (x * Math.sin(roll) + y * Math.cos(roll)) * s });   // локальная точка бревна → экран
    P.loc = loc;
    const cs = 1.22 * s, bs = 1.5 * s;                                    // масштаб Алеси и Бубела (у них один и тот же «рост» вдоль всей реки)
    P.cs = cs; P.bs = bs;
    const seat = loc(SEAT.x, SEAT.y), bow = loc(BOW.x, BOW.y);
    P.seat = seat; P.bow = bow;
    // Берег отплытия: герои и весло по состоянию стадии (без стадии — как стояли раньше: на песке у воды)
    let pose;
    if (st) pose = poseStage(S, P);
    else {
      const aW = { x: lx - 232 - S.scroll, y: P.sandY + 46 }, bW = { x: lx - 160 - S.scroll, y: P.sandY + 66 };
      pose = { ale: { name: 'ale_idle', x: aW.x, y: aW.y, sx: cs, sy: cs, rot: 0, flip: false }, bub: { name: S.clock % 2.4 < 1.9 ? 'bub_idle' : 'bub_idle2', x: bW.x, y: bW.y, sx: bs, sy: bs, rot: 0, flip: false }, oar: null, oarFront: false };
    }
    P.ale = pose.ale; P.bub = pose.bub; P.oar = pose.oar; P.oarFront = pose.oarFront; P.aleArm = null; P.aleBlend = null; P.seated = !!(st && st.ale.mode === 'log');
    const barking = S.barks.length && S.barks[S.barks.length - 1].age < 0.55;
    if (phase !== 'shore') {
      // Бубел: от берега трусит к воде и в такт музыки прыгает на нос
      const B = st ? st.bub : null, hx = B ? P.beach + B.x : lx - 160 - S.scroll, hy = B ? P.sandY + B.y : P.sandY + 66, edgeX = P.beach + ((Ale.RiverStage && Ale.RiverStage.G.shore) || -146) - 40;
      const jb = (t - T.bubel) / 0.75;
      if (jb < 0) {
        const k = smooth(t / T.bubel), x = lerp(hx, edgeX, k), moving = k > 0.02 && k < 0.98;
        P.bub = { name: moving ? 'bub_run' + (1 + Math.floor(t * 12) % 8) : 'bub_idle', x, y: hy, sx: bs, sy: bs, rot: 0, flip: false };
      } else if (jb < 1) {
        const k = ease(jb), x = lerp(edgeX, bow.x, k), y = lerp(hy, bow.y, jb) - 105 * Math.sin(Math.PI * jb);
        P.bub = { name: jb < 0.5 ? 'bub_jump_up' : 'bub_jump_fall', x, y, sx: bs, sy: bs, rot: 0, flip: false };
      } else {
        P.bub = { name: t < T.bubel + 0.75 + 0.15 ? 'bub_jump_land' : (barking ? (S.clock % 0.3 < 0.15 ? 'bub_bark' : 'bub_bark2') : (S.clock % 2.6 < 2.0 ? 'bub_idle' : 'bub_idle2')), x: bow.x, y: bow.y + Math.sin(S.clock * 2.4) * 0.8 * s, sx: bs, sy: bs, rot: roll * 0.5, flip: false };
      }
    }
    // Алеся на бревне: стоит с веслом, потом гребёт стоя (кадры гребка — ale_pad / ale_pan; нет кадров — прежний посох и весло по старой кинематике)
    if (P.seated && phase !== 'done') paddle(S, P, T);
    // посадка на берег назначения: сходят на песок
    if (phase !== 'shore' && t >= T.hop) {
      const dj = (t - T.hop) / 0.7, aj = (t - T.hop - 0.45) / 0.8, beachX = lx + 215, y0 = ly + 36 * s;
      if (dj >= 0) {
        if (dj < 1) P.bub = { name: dj < 0.5 ? 'bub_jump_up' : 'bub_jump_fall', x: lerp(bow.x, beachX, ease(dj)), y: lerp(bow.y, y0 + 22, dj) - 85 * Math.sin(Math.PI * dj), sx: bs, sy: bs, rot: 0, flip: false };
        else { const run = (t - T.hop - 0.7) * 150; P.bub = { name: 'bub_run' + (1 + Math.floor((t - T.hop) * 14) % 8), x: beachX + run, y: y0 + 22, sx: bs, sy: bs, rot: 0, flip: false }; }
      }
      if (aj >= 0) {
        P.seated = false; P.oar = null; P.aleArm = null; P.aleBlend = null;
        if (aj < 1) P.ale = { name: frameOf(JUMP_A, aj), x: lerp(seat.x, lx + 175, ease(aj)), y: lerp(seat.y, y0, aj) - 95 * Math.sin(Math.PI * aj), sx: cs, sy: cs, rot: 0, flip: false };
        else P.ale = { name: 'ale_walk' + (1 + Math.floor((t - T.hop - 1.25) * 28) % 24), x: lx + 175 + (t - T.hop - 1.25) * 100, y: y0, sx: cs, sy: cs, rot: 0, flip: false };
      } else if (aj > -2) { P.seated = true; }
    }
    // головы: куда показывает облачко реплики
    const head = (o, h) => (o ? { x: o.x, y: o.y - h * o.sy } : null);
    P.heads = { ale: head(P.ale, 152), bubel: head(P.bub, 54) };
    return P;
  }

  // Гребок: Алеся стоит на бревне и гребёт длинным веслом. Кадры цикла — ale_pad1…24 (основа: ноги, юбка, тело, дальняя рука) и ale_pan1…24 (верх: ближняя рука и кулак дальней), собранные
  // кукольной утилитой из деталей ходьбы (tools/rig/paddle.swift, сборка — build_paddle.sh): корпус наклоняется, руки тянут весло, лопасть входит в воду, идёт назад и выходит. Весло — отрезок по двум
  // точкам хвата кадра (pts.gripU — верхняя кисть, pts.gripD — нижняя), и рисуется между основой и верхом: обе кисти охватывают вал. Фаза ph 0…1 идёт с периодом в две доли музыки так, что в миг
  // гребка (T.push + n · 2 доли: всплеск и звук) лопасть как раз касается воды (ENTRY — фаза кадров в этот миг); до первого гребка весло поднято над водой (READY), за READ_LEAD с до него идёт к входу.
  // Нет кадров — прежняя запасная раскладка: стоит с веслом-посохом, а весло ходит по старой кинематике.
  const PAD_N = 24, READY = 0.72, ENTRY = 2 / 24, READ_LEAD = 0.3, PADDLE_UNITS = 170, GRIP_TOP = 7;       // ENTRY — фаза кадров в миг гребка: Алеся на нарисованном стволе стоит на 5 юн. выше, лопасть касается воды двумя кадрами позже
  function paddle(S, P, T) {
    const Rv = Ale.River, st = S.stage, t = S.t, s = P.s, cs = P.cs, per = 2 * Rv.BEAT, a = P.ale; if (!a) return;
    const wl = P.ly + 12 * s;                                                  // линия воды у бревна
    if (has('ale_pad1') && has('ale_pan1')) {
      const ph = t < T.push - READ_LEAD ? READY + 0.03 * Math.sin(S.clock * 1.7) : t < T.push ? lerp(READY + 0.03 * Math.sin(S.clock * 1.7), ENTRY + 1, smooth((t - (T.push - READ_LEAD)) / READ_LEAD)) % 1 : ((((t - T.push) / per + ENTRY) % 1) + 1) % 1;
      const k = Math.round(ph * PAD_N) % PAD_N + 1, name = 'ale_pad' + k, g = Ale.Assets.sprites[name].pts;
      const pose = { x: a.x, y: a.y, sx: cs, sy: cs, rot: P.roll, flip: false };
      const gU = Ale.spritePoint(a.x, a.y, pose, g.gripU[0], -g.gripU[1]), gD = Ale.spritePoint(a.x, a.y, pose, g.gripD[0], -g.gripD[1]);
      const dx = gD.x - gU.x, dy = gD.y - gU.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const oar = { gx: gU.x - ux * GRIP_TOP * cs, gy: gU.y - uy * GRIP_TOP * cs, tx: gU.x + ux * PADDLE_UNITS * cs, ty: gU.y + uy * PADDLE_UNITS * cs, s, ph, wl };
      oar.inWater = oar.ty > wl - 1; if (oar.inWater && uy > 0.05) oar.wx = gU.x + (wl - gU.y) / uy * ux;     // где вал пересекает воду: там круги
      P.ale = Object.assign({ name }, pose, { onLog: true }); P.aleArm = Object.assign({ name: 'ale_pan' + k }, pose);
      // после прыжка на бревно (на берегу, ждёт Бубела): короткое растворение из кадра приземления в стойку гребца, весло из посоха переходит в «готов к гребку»
      const lt = st && st.ale.mode === 'log' ? st.ale.t : 99;
      if (lt < 0.3 && P.oar) { const u = smooth(lt / 0.3), m = mixEnds(P.oar, oar, u); m.ph = ph; m.wl = wl; m.inWater = false; P.oar = m; P.aleArm.alpha = u; P.ale.alpha = u; P.aleBlend = { name: 'ale_land', x: a.x, y: a.y, sx: cs, sy: cs, rot: P.roll, flip: false, alpha: 1 - u }; }
      else P.oar = oar;
      P.oarFront = true;
      return;
    }
    // запасной вариант: посох и прежняя кинематика весла (рука — кисть стоящей)
    const ph = t < T.push ? 0.92 : (((t - T.push) / per) % 1 + 1) % 1;
    const h = handOf('ale_idle'), lean = t < T.push ? 0 : (ph < 0.42 ? lerp(0.1, -0.05, ease(ph / 0.42)) : ph < 0.55 ? -0.05 : lerp(-0.05, 0.1, smooth((ph - 0.55) / 0.45)));
    a.rot = P.roll + lean * 0.5;
    const hp = Ale.spritePoint(a.x, a.y, { sx: a.sx, sy: a.sy, rot: a.rot }, h[0], h[1]);
    let dx, tipY, inWater = true;
    if (t < T.push) { dx = 96 * s; tipY = wl - 26 * s; inWater = false; }
    else if (ph < 0.42) { dx = lerp(96, -92, ease(ph / 0.42)) * s; tipY = wl + 8 * s; }
    else if (ph < 0.55) { const k = (ph - 0.42) / 0.13; dx = lerp(-92, -98, k) * s; tipY = lerp(wl + 8 * s, wl - 22 * s, k); inWater = k < 0.4; }
    else { const k = smooth((ph - 0.55) / 0.45); dx = lerp(-98, 96, k) * s; tipY = wl - 30 * s * Math.sin(Math.PI * Math.min(1, k)) + (k > 0.9 ? (k - 0.9) * 10 * 30 * s : 0); inWater = k > 0.93; }
    const tip = { x: hp.x + dx, y: tipY }, L0 = Math.hypot(tip.x - hp.x, tip.y - hp.y), ux = (tip.x - hp.x) / L0, uy = (tip.y - hp.y) / L0;
    const target = { gx: hp.x - ux * 40 * s, gy: hp.y - uy * 40 * s, tx: tip.x, ty: tip.y, s, ph, inWater, wl }, staff = P.oar;
    if (staff && t < 1.2) { const m = mixEnds(staff, target, smooth(t / 1.2)); m.ph = ph; m.inWater = false; m.wl = wl; P.oar = m; }       // из посоха весло плавно поднимается в положение «к гребку»
    else P.oar = target;
    P.oarFront = false;
  }

  // ---------------------------------------------------------------- вода и небо
  const heart = (ctx, x, y, s) => {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.38);
    ctx.bezierCurveTo(x - s * 1.15, y - s * 0.25, x - s * 0.55, y - s * 1.0, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.0, x + s * 1.15, y - s * 0.25, x, y + s * 0.38); ctx.closePath();
  };
  // Картина закатного Днепра на весь кадр: вся её высота (горизонт — на HZ) и столько ширины, сколько нужно; солнце картины стоит там же, где солнце заплыва (sunX), и чуть ползёт назад с проплывающим берегом
  const paintRectOf = (im, sunX, pan, W) => { const k = PAINT.k, dw = (im.naturalWidth || im.width) * k, dh = (im.naturalHeight || im.height) * k; return { x: clamp(sunX - PAINT.sunX * k - pan * PAINT.par, W - dw, 0), y: HZ - PAINT.hz * k, w: dw, h: dh }; };
  function drawPaint(ctx, im, sunX, pan, W) { const r = paintRectOf(im, sunX, pan, W); ctx.drawImage(im, r.x, r.y, r.w, r.h); }
  function drawBackdrop(ctx, S, P, W, H) {
    const Rv = Ale.River, sunX = W * SUN_K, beatPh = (((S.t - Rv.BAR0) / Rv.BEAT) % 1 + 1) % 1, pulse = S.phase === 'shore' ? 0 : Math.exp(-beatPh * 5);       // вспышки бликов — на долю музыки (время заплыва = время трека)
    const pan = S.scroll + (S.stage ? S.stage.travel : 0);                  // сколько проехала картинка: пока идут по пляжу — камера, потом — бревно (небо и дальний берег чуть отстают: параллакс)
    const im = L.paint || paintImg();
    if (im) {
      // нарисованный закат (заказ 27): небо, солнце, дальний берег с куполами, мост, остров и вода с дорожкой солнца — одна картина: горизонт на HZ, солнце на 72% ширины вида;
      // блики и волны ниже живые и лежат поверх неё
      ctx.fillStyle = '#1d2260'; ctx.fillRect(0, 0, W, H);
      drawPaint(ctx, im, sunX, pan, W);
    } else {
      if (!L.sky) { L.sky = buildSky(); L.far = buildFar(); }
      ctx.fillStyle = '#2b2968'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(L.sky.c, sunX - 1300 - pan * 0.01, 0, L.sky.w, L.sky.h);
      ctx.drawImage(L.far.c, sunX - 1300 - pan * 0.03, HZ - L.far.h, L.far.w, L.far.h);
      // вода: градиент от розово-золотого у горизонта до глубокого синего у зрителя
      A.gradV(ctx, 0, HZ, W, H - HZ, [[0, '#f2a67a'], [0.07, '#d98f98'], [0.2, '#8e7aa8'], [0.45, '#4b659e'], [0.75, '#2a4a86'], [1, '#18305c']]);
      A.gradV(ctx, 0, HZ, W, 26, [[0, 'rgba(255,224,170,0.55)'], [1, 'rgba(255,224,170,0)']]);
    }
    // дорожка солнца: короткие блики, ниже — шире и реже; на долю музыки вспыхивают
    ctx.save();
    for (let i = 0; i < 72; i++) {
      const u = i / 71, y = HZ + 5 + Math.pow(u, 1.8) * (H - HZ - 14), spread = (10 + u * 190) * (im ? 0.55 : 1), ph = S.clock * (0.7 + hash(i) * 1.1) + i * 2.1;       // у картины дорожка уже: блики не уходят от неё в стороны
      const x = sunX + Math.sin(ph) * spread * 0.45 + (hash(i + 5) - 0.5) * spread, w = 8 + u * 52 * (0.35 + hash(i + 9)), a = (0.22 + 0.5 * Math.max(0, Math.sin(ph * 1.7 + i))) * (1 - u * 0.4) * (1 + pulse * 0.6) * (im ? 0.8 : 1);
      ctx.fillStyle = 'rgba(255,238,184,' + clamp(a, 0, 0.95).toFixed(3) + ')';
      if (im) { ctx.beginPath(); ctx.ellipse(x, y + 0.7 + u * 1.2, w / 2, 0.9 + u * 1.3, 0, 0, TAU); ctx.fill(); }          // на картине блик — мягкий штрих, а не прямоугольник
      else ctx.fillRect(x - w / 2, y, w, 1.4 + u * 2.4);
    }
    ctx.restore();
    // длинные светлые волны, уходящие назад вместе с рекой (ближе — быстрее и крупнее)
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const u = (i + 0.5) / 22, y = HZ + 12 + Math.pow(u, 1.5) * (H - HZ - 14), sp = 0.25 + 0.95 * u, per = 150 + u * 150;
      const off = (S.scroll * sp + S.clock * (7 + 14 * u) + i * 83) % per;
      ctx.strokeStyle = 'rgba(255,248,236,' + (0.05 + 0.12 * u).toFixed(3) + ')'; ctx.lineWidth = 1 + u * 2;
      for (let x = -off - per; x < W + per; x += per) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + per * 0.25, y - 3 * sp, x + per * 0.5, y); ctx.quadraticCurveTo(x + per * 0.75, y + 3 * sp, x + per, y); ctx.stroke(); }
    }
    // берег отплытия и берег назначения
    if (P.bankLx + L.bankL.w > -10 && P.bankLx < W + 10) ctx.drawImage(L.bankL.c, P.bankLx, BANK.top - BANK.topM, L.bankL.w, L.bankL.h);
    const rx = P.edgeR - BANK.edgeX;                                      // линия берега в слое правого берега стоит на x = BANK.edgeX (слой зеркальный: w − глубина суши)
    if (rx < W + 10) ctx.drawImage(L.bankR.c, rx, BANK.top - BANK.topM, L.bankR.w, L.bankR.h);

    return pulse;
  }

  // ---------------------------------------------------------------- бревно, герои, весло
  function drawLog(ctx, S, P, pulse) {
    const Rv = Ale.River;
    // тень и кильватер
    const sp = clamp(S.speed / Rv.V_OBS, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,52,0.26)'; ctx.beginPath(); ctx.ellipse(P.lx, P.ly + 12 * P.s, 156 * P.s, 11 * P.s, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 7; k++) {
      const x = P.lx - (148 + k * 42) * P.s - ((S.clock * 60) % 42), a = (0.5 - k * 0.065) * (0.35 + 0.65 * sp), wd = (50 + k * 6) * P.s;
      ctx.strokeStyle = 'rgba(255,255,255,' + clamp(a, 0, 0.7).toFixed(3) + ')'; ctx.lineWidth = Math.max(1.4, 3.4 * P.s - k * 0.3); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, P.ly + 4 * P.s - k * 3 * P.s); ctx.quadraticCurveTo(x - wd * 0.5, P.ly + 7 * P.s, x - wd, P.ly + 4 * P.s - k * 3 * P.s - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, P.ly + 9 * P.s + k * 3 * P.s); ctx.quadraticCurveTo(x - wd * 0.5, P.ly + 11 * P.s, x - wd, P.ly + 9 * P.s + k * 3 * P.s + 1); ctx.stroke();
    }
    ctx.restore();
    // само бревно (мигает после удара)
    ctx.save();
    ctx.translate(P.lx, P.ly); ctx.rotate(P.roll); ctx.scale(P.s, P.s);
    if (S.invul > 0 && Math.floor(S.clock * 14) % 2 === 0) ctx.globalAlpha = 0.55;
    if (has('swim_log')) {                                               // нарисованное бревно (заказ 26): срез по ватерлинии, подводная часть просвечивает тёмной полосой
      ctx.beginPath(); ctx.moveTo(-124, 2); ctx.bezierCurveTo(-118, 22, -90, 25, -40, 25); ctx.lineTo(62, 25); ctx.bezierCurveTo(112, 25, 144, 18, 150, 2); ctx.closePath();
      ctx.fillStyle = 'rgba(40,30,52,0.5)'; ctx.fill();
      Ale.drawSprite(ctx, 'swim_log', 0, 0);
    } else ctx.drawImage(L.log.c, -LOGS.ox, -LOGS.oy, L.log.w, L.log.h);
    ctx.restore();
    // бурун перед торцом: дуги пены расходятся впереди и тают (чем быстрее ход, тем заметнее)
    if (sp > 0.05) {
      ctx.save(); ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const ph = (S.clock * 1.6 + k / 3) % 1, r = (8 + ph * 34) * P.s;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * sp * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = Math.max(1.4, 2.8 * P.s * (1 - ph * 0.5));
        ctx.beginPath(); ctx.ellipse(P.lx + 150 * P.s, P.ly + 5 * P.s, r * 1.7, r * 0.4, 0, -Math.PI * 0.46, Math.PI * 0.46); ctx.stroke();
      }
      ctx.restore();
    }
    // линия воды поверх бревна: тонкая пена, чтобы оно не «стояло» на воде
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.4 * P.s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P.lx - 136 * P.s, P.ly + 4 * P.s); for (let i = 0; i <= 15; i++) { const x = -136 + i * 19.2; ctx.lineTo(P.lx + x * P.s, P.ly + (4 + Math.sin(S.clock * 3 + i * 1.3) * 1.5) * P.s); } ctx.stroke();
    ctx.restore();
  }

  function drawChar(ctx, o, extra) {
    if (!o || !has(o.name)) return;
    Ale.drawSprite(ctx, o.name, o.x, o.y, Object.assign({ sx: o.sx, sy: o.sy, rot: o.rot || 0, flip: o.flip, alpha: o.alpha }, extra || {}));
  }
  // Весло простой линией от конца рукояти (gx, gy) до конца лопасти (tx, ty): тёмный контур, светлое дерево, блик, широкая лопасть на конце, на рукояти — поперечная перекладина («Т»).
  // s — масштаб глубины. tint — вторая отрисовка того же весла синим для части под водой (рисуется с обрезкой по линии воды: весло там «в воде»)
  // Нарисованное весло (заказ 26, swim_oar): якорь — середина поперечины рукояти, вдоль оси растягивается от g до t (при развороте Бубела сжимается вместе с лопастью), толщина — по глубине s;
  // у весла, направленного влево, кадр переворачивается по вертикали, чтобы свет остался сверху. Часть под водой — «мокрая» копия (синяя дымка поверх рисунка), создаётся один раз.
  const OAR = { name: 'swim_oar', wet: 'swim_oar_wet', thick: 1.15 };
  function oarWet() {
    if (has(OAR.wet)) return true;
    const s0 = Ale.Assets.sprites[OAR.name]; if (!s0) return false;
    const c = document.createElement('canvas'); c.width = s0.w; c.height = s0.h;
    const g = c.getContext('2d'); g.drawImage(s0.img, 0, 0, s0.w, s0.h); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(52,84,152,0.66)'; g.fillRect(0, 0, c.width, c.height);
    Ale.Assets.addCanvas(OAR.wet, c, s0.res || Ale.Assets.os, s0.ax, s0.ay);
    return true;
  }
  function drawOarLine(ctx, gx, gy, tx, ty, s, tint) {
    if (has(OAR.name) && (!tint || oarWet())) {
      const sz = Ale.spriteSize(OAR.name), len = Math.hypot(tx - gx, ty - gy) || 1, ang = Math.atan2(ty - gy, tx - gx);
      Ale.drawSprite(ctx, tint ? OAR.wet : OAR.name, gx, gy, { rot: ang, sx: len / (sz.w - sz.ax), sy: (Math.cos(ang) < 0 ? -1 : 1) * s * OAR.thick });
      return;
    }
    const L0 = Math.hypot(tx - gx, ty - gy) || 1, ux = (tx - gx) / L0, uy = (ty - gy) / L0, nx = -uy, ny = ux;
    const ink = tint ? '#1c2f66' : OUT, wood = tint ? '#5c78b0' : '#d9a86a', bladeC = tint ? '#4b66a0' : '#bd8650';
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 8.5 * s; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = wood; ctx.lineWidth = 5.2 * s; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke();
    if (!tint) { ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(gx - uy * 1.6 * s, gy + ux * 1.6 * s); ctx.lineTo(tx - uy * 1.6 * s, ty + ux * 1.6 * s); ctx.stroke(); }
    // перекладина верхней рукояти
    const hw = 8.5 * s;
    ctx.strokeStyle = ink; ctx.lineWidth = 7.4 * s; ctx.beginPath(); ctx.moveTo(gx + nx * hw, gy + ny * hw); ctx.lineTo(gx - nx * hw, gy - ny * hw); ctx.stroke();
    ctx.strokeStyle = wood; ctx.lineWidth = 3.8 * s; ctx.beginPath(); ctx.moveTo(gx + nx * hw, gy + ny * hw); ctx.lineTo(gx - nx * hw, gy - ny * hw); ctx.stroke();
    // лопасть: широкая деревянная, на конце
    const bl = Math.min(60 * s, L0 * 0.42), bw = 11 * s, bx0 = tx - ux * bl, by0 = ty - uy * bl;      // при развороте Бубела весло сжимается (смотрит на зрителя): лопасть не длиннее его видимой части
    ctx.beginPath(); ctx.moveTo(bx0 + nx * bw * 0.55, by0 + ny * bw * 0.55); ctx.lineTo(tx + nx * bw, ty + ny * bw); ctx.quadraticCurveTo(tx + ux * 9 * s, ty + uy * 9 * s, tx - nx * bw, ty - ny * bw); ctx.lineTo(bx0 - nx * bw * 0.55, by0 - ny * bw * 0.55); ctx.closePath();
    ctx.fillStyle = tint ? bladeC : A.linG(ctx, bx0, by0, tx, ty, [[0, '#d9a86a'], [1, bladeC]]); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
    if (!tint) { ctx.beginPath(); ctx.moveTo(bx0 + ux * 4 * s, by0 + uy * 4 * s); ctx.lineTo(tx - ux * 5 * s, ty - uy * 5 * s); ctx.strokeStyle = 'rgba(110,70,40,0.55)'; ctx.lineWidth = 1.6 * s; ctx.stroke(); }
    ctx.restore();
  }
  function drawOar(ctx, S, P) {
    const o = P.oar; if (!o) return;
    drawOarLine(ctx, o.gx, o.gy, o.tx, o.ty, o.s);
    if (o.inWater) {
      const s = o.s, wl = o.wl === undefined ? P.ly + 12 * s : o.wl;
      // часть весла под водой — в синей дымке (вода поверх него), по линии воды — светлая полоска и круги от вала
      ctx.save(); ctx.beginPath(); ctx.rect(0, wl, P.W, P.H - wl); ctx.clip(); ctx.globalAlpha = 0.5; drawOarLine(ctx, o.gx, o.gy, o.tx, o.ty, s, true); ctx.restore();
      const cx = o.wx === undefined ? o.tx : o.wx, cy = o.wx === undefined ? P.ly + 14 * s : wl + 3 * s;
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(cx, cy, 18 * s, 5 * s, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, 30 * s, 8 * s, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  // Порядок слоёв: Бубел; весло позади героини (кулак перекрывает вал) — или, у гребка, между телом и передней рукой (рука лежит поверх вала)
  function drawCrew(ctx, S, P) {
    const flash = S.invul > 1.15 ? 0.7 : 0;
    drawChar(ctx, P.bub, { flash });
    if (!P.oarFront) drawOar(ctx, S, P);
    drawChar(ctx, P.aleBlend, { flash });
    drawChar(ctx, P.ale, { flash });
    if (P.oarFront) drawOar(ctx, S, P);
    if (P.aleArm) drawChar(ctx, P.aleArm, { flash });
  }

  // ---------------------------------------------------------------- препятствия
  const OBS_SPR = { barrel: ['swim_barrel0', 'swim_barrel1', 'swim_barrel2'], snag: ['swim_snag0', 'swim_snag1', 'swim_snag2'], root: ['swim_root0', 'swim_root1'], mine: ['swim_mine'] };       // спрайты заказа 26 по видам (порядок = номер варианта: дубовая, синяя, красная бочки)
  const MINE_LAMP = 44;                                                // высота горловины нарисованной мины над водой (юн.): там сидит сигнальная лампа, её рисует код
  function drawObstacle(ctx, S, P, o) {
    const Rv = Ale.River, x = P.lx + (o.hit - S.t) * Rv.V_OBS, y = Rv.obsY(o, S.t);
    const K = Rv.KINDS[o.kind], reach = K.rx * 1.5 + 60;
    if (x < -reach || x > P.W + reach) return;
    if (o.spent && (o.kind === 'barrel' || o.kind === 'mine')) return;               // бочка разбита, мина взорвана
    const sp = L.obs[o.kind][o.variant % L.obs[o.kind].length], s = Rv.scaleAt(y), bob = Math.sin(S.clock * 1.9 + o.id * 1.3) * 2.6 * s, rot = Math.sin(S.clock * 1.3 + o.id * 0.9) * (o.kind === 'snag' ? 0.018 : 0.04);
    const names = OBS_SPR[o.kind], nm = names && names[o.variant % names.length], painted = !!(nm && has(nm));          // нарисованные предметы заказа 26 (деревья — кодом: листа S4 нет)
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(rot); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(0, 3, K.rx * 1.05, 5.5, 0, 0, TAU); ctx.fill();      // пена вокруг
    if (painted) Ale.drawSprite(ctx, nm, 0, 0, { flip: (o.kind === 'snag' || o.kind === 'root') && hash(o.id * 1.7 + 3) > 0.5 });
    else ctx.drawImage(sp.L.c, -sp.ox, -sp.oy, sp.L.w, sp.L.h);
    if (o.kind === 'mine') {                                                          // сигнальная лампа мины вспыхивает на долю
      const beat = (((S.t - Rv.BAR0) / Rv.BEAT) % 1 + 1) % 1, on = Math.exp(-beat * 4.5), ly = painted ? -MINE_LAMP : -59;
      ctx.globalCompositeOperation = 'lighter'; A.glow(ctx, 0, ly, 18 + on * 22, 'rgba(255,60,40,', 0.25 + on * 0.6); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = on > 0.35 ? '#ff6a4a' : '#7a2a24'; ctx.beginPath(); ctx.arc(0, ly, 3.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // вода у борта поверх нижнего среза
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - K.rx * s * 1.05, y + bob + 3 * s); ctx.quadraticCurveTo(x, y + bob + 7 * s, x + K.rx * s * 1.05, y + bob + 3 * s); ctx.stroke(); ctx.restore();
  }

  // ---------------------------------------------------------------- частицы
  function drawFx(ctx, S) {
    for (const f of S.fx) {
      const u = f.age / f.life, a = 1 - u;
      if (f.k === 'drop') { ctx.fillStyle = 'rgba(236,248,255,' + (0.85 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.4 * a), 0, TAU); ctx.fill(); }
      else if (f.k === 'ring') { ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * a).toFixed(3) + ')'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r + u * 46, (f.r + u * 46) * 0.3, 0, 0, TAU); ctx.stroke(); }
      else if (f.k === 'chip') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = '#9a6a42'; ctx.fillRect(-f.r, -f.r * 0.35, f.r * 2, f.r * 0.7); ctx.lineWidth = 1.2; ctx.strokeStyle = OUT; ctx.strokeRect(-f.r, -f.r * 0.35, f.r * 2, f.r * 0.7); ctx.restore(); }
      else if (f.k === 'smoke') { ctx.fillStyle = 'rgba(70,64,72,' + (0.5 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + u * 2.4), 0, TAU); ctx.fill(); }
    }
  }

  // ---------------------------------------------------------------- интерфейс заплыва
  const INK = '#3a2431', CREAM = '#fff6e4';
  function textOut(ctx, str, x, y, size, fill, w) {
    ctx.font = 'bold ' + size + 'px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = w || size * 0.22; ctx.strokeStyle = INK; ctx.strokeText(str, x, y); ctx.fillStyle = fill || '#ffe9c4'; ctx.fillText(str, x, y);
  }
  function drawHud(ctx, S, P, W, H) {
    const Rv = Ale.River, T = Rv.T, SF = (Ale.Game && Ale.Game.safe) || { l: 0, r: 0 };          // безопасные поля кадра (вырез iPhone): сердца и полоска пути внутри них
    // сердца — как в игре
    for (let i = 0; i < S.maxHp; i++) {
      const full = i < S.hp, low = S.hp === 1 && i === 0, bump = (i === S.hp && Ale.UI && Ale.UI.hearts.bump > 0) ? 1 + Ale.UI.hearts.bump * 0.5 : 1;
      ctx.save(); ctx.translate(26 + SF.l + i * 42, 40); ctx.scale(bump * (low ? 1 + 0.08 * Math.sin(S.clock * 9) : 1), bump * (low ? 1 + 0.08 * Math.sin(S.clock * 9) : 1)); heart(ctx, 0, 0, 17);
      ctx.fillStyle = full ? '#e8445a' : 'rgba(58,36,49,0.55)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      if (full) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-6, -6, 3.5, 2.5, -0.6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // полоска пути: берег отплытия → берег назначения, по ней плывёт значок бревна
    const bx = Math.max(W / 2 - 190, 26 + SF.l + S.maxHp * 42 + 30), bw = Math.min(380, W - SF.r - bx - 40), by = 34;           // правее сердец (в лёгком режиме их девять)
    ctx.save(); Ale.rr(ctx, bx - 6, by - 10, bw + 12, 20, 10); ctx.fillStyle = 'rgba(30,20,50,0.5)'; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = INK; ctx.stroke();
    Ale.rr(ctx, bx, by - 4, bw, 8, 4); ctx.fillStyle = '#5b86c4'; ctx.fill();
    const pr = S.progress(), px = bx + 12 + (bw - 24) * pr;
    Ale.rr(ctx, bx, by - 4, Math.max(8, (bw - 24) * pr + 12), 8, 4); ctx.fillStyle = '#ffd98a'; ctx.fill();
    ctx.fillStyle = '#e6c590'; ctx.beginPath(); ctx.arc(bx - 2, by, 8, 0, TAU); ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#7ab05a'; ctx.beginPath(); ctx.arc(bx + bw + 2, by, 8, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.translate(px, by - 1); ctx.fillStyle = '#94603a'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8cc98'; ctx.beginPath(); ctx.ellipse(12, 0, 2.4, 4.4, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
    // кнопка паузы (сенсорный экран; на клавиатуре — Esc и P): тот же значок, размер и угол, что у кнопки «II» в игре (Touch.pauseSpot), нажатие ловит River.pointerDown
    if (Ale.Input && Ale.Input.lastDevice === 'touch') {
      const sp = Ale.Touch && Ale.Touch.pauseSpot ? Ale.Touch.pauseSpot() : { fromRight: 42, y: 41, r: 25 };
      Ale.Icons.button(ctx, '@pause', W - sp.fromRight, sp.y, sp.r);
    }
    // подсказка управления: первые секунды после открытия руля
    if (S.t >= T.control && S.t < T.control + 8) {
      const a = clamp(Math.min((S.t - T.control) / 0.4, (T.control + 8 - S.t) / 0.6), 0, 1), Tx = Ale.T.river, touch = Ale.Input && Ale.Input.lastDevice === 'touch', str = touch ? Tx.hint.touch : Tx.hint.kb;
      ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 26px ' + Ale.FONT; const tw = ctx.measureText(str).width + 52, bx2 = W / 2 - tw / 2, by2 = H - 84;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Ale.rr(ctx, bx2, by2 + 5, tw, 50, 25); ctx.fill(); Ale.rr(ctx, bx2, by2, tw, 50, 25); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 4.4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, W / 2, by2 + 26); ctx.restore();
    }
  }
  function drawBarks(ctx, S, P) {
    for (const b of S.barks) {
      const a = clamp(Math.min(b.age / 0.15, (b.life - b.age) / 0.3), 0, 1), x0 = P.heads.bubel.x, y0 = P.heads.bubel.y - 6;
      ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 24px ' + Ale.FONT; const tw = ctx.measureText(b.text).width + 30, bh = 42, bx = clamp(x0 - tw / 2 + 24, 10, P.W - tw - 10), by = y0 - bh - 22 - (1 - a) * 8;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; Ale.rr(ctx, bx, by + 4, tw, bh, 16); ctx.fill();
      const tx = clamp(x0, bx + 22, bx + tw - 22);
      ctx.beginPath(); ctx.moveTo(tx - 12, by + bh - 2); ctx.lineTo(x0, y0 - 2); ctx.lineTo(tx + 12, by + bh - 2); ctx.closePath(); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      Ale.rr(ctx, bx, by, tw, bh, 16); ctx.fillStyle = CREAM; ctx.fill(); ctx.stroke();
      ctx.fillStyle = CREAM; ctx.fillRect(tx - 10, by + bh - 6, 20, 8);
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, bx + tw / 2, by + bh / 2 + 1); ctx.restore();
    }
  }

  // ---------------------------------------------------------------- кадр
  function draw(ctx, S, W, H) {
    if (!alive()) prepare();
    const P = layout(S, W, H), Rv = Ale.River, T = Rv.T;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (S.shake > 0) { const k = S.shake * 16; ctx.translate(Math.sin(S.clock * 71) * k, Math.cos(S.clock * 83) * k * 0.7); }
    const pulse = drawBackdrop(ctx, S, P, W, H);
    // препятствия по глубине: дальше бревна — позади, ближе — перед ним
    const act = S.phase !== 'shore', back = [], front = [];
    if (act) for (const o of S.obs) { const y = Rv.obsY(o, S.t); (y <= S.y ? back : front).push(o); }
    for (const o of back) drawObstacle(ctx, S, P, o);
    drawLog(ctx, S, P, pulse);
    drawCrew(ctx, S, P);
    for (const o of front) drawObstacle(ctx, S, P, o);
    drawFx(ctx, S);
    A.vignette(ctx, W, H, 0.34);
    if (S.flash > 0) { ctx.fillStyle = 'rgba(255,240,210,' + (S.flash * 0.5).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (act) { drawBarks(ctx, S, P); drawHud(ctx, S, P, W, H); if (S.banner) { const b = S.banner, a = clamp(Math.min(b.age / 0.2, (b.life - b.age) / 0.4), 0, 1); ctx.save(); ctx.globalAlpha = a; textOut(ctx, b.text, W / 2, H * 0.28 + (1 - a) * 16, 62); ctx.restore(); } }
    if (act && S.t > T.fade) { ctx.fillStyle = 'rgba(10,6,14,' + smooth((S.t - T.fade) / (T.end - T.fade)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  Ale.RiverArt = { prepare, layout, draw, drawOarLine, BANK, edgeAt, HZ, SUN_K, WOOD, OBS, OBS_SPR, OAR, PAINT, LOGS, SEAT, BOW, TREE_SET, LEAF, lobe, mix, rgba, stroke, paintImg, paintRect: (W, pan) => { const im = paintImg(); return im ? paintRectOf(im, W * SUN_K, pan, W) : null; }, get layers() { return L; }, alive };
})();
