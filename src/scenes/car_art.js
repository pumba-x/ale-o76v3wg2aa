// Машина «Uber»: чёрный Mercedes-Maybach S-класса, вид сбоку, нос вправо. Одна на всю игру: стоит на асфальте площадки в Киеве (X.car) и на улице Монако (X.taxi).
// Владелец 03.10.2026: «такси везде в игре становится Uber: на двери белыми буквами Uber; машина — Мерседес-Майбах и в Киеве, и в Монако». Больше никаких надписей на ней нет (ни фонаря на крыше, ни шашечек).
// Контракт со сценами (прежний, от такси): состояние sc.taxi = { dx, door } — dx: смещение вправо в юнитах (0 в покое, растёт, когда машина уезжает; колёса крутятся по пройденному пути, фары светят),
// door: 0…1, насколько открыта задняя левая дверь (она ближе к зрителю, петли у переднего края, распахивается наружу, к героям; в проёме виден салон).
// Использование: const car = Ale.CarArt.sprite(dens(2)); … car.draw(ctx, X, y, sc.taxi) — каждый кадр (тень, свет фар, кузов-спрайт, колёса, салон и дверь); y — линия земли под колёсами.
// Начало координат кузова — середина основания на земле; задняя дверь занимает x ∈ [C.DX0, C.HX] (героиня и Бубел идут к x = −52 и исчезают в проёме).
// Всё нарисовано кодом: тёмный тёплый контур, глянцевая чёрная краска с холодным бликом по плечу, хром (окантовка стёкол, ручки, пороги, радиаторная решётка с вертикальными рёбрами, колёса), «звезда» Mercedes
// на капоте, значок Maybach (двойная M) на стойке, тонированные стёкла. Надпись «Uber» — векторные штрихи (не шрифт: на любом устройстве одинаковая); весь код без случайности и без часов.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const TAU = 6.283185307;

  // Геометрия (юниты): длина 312, колёсная база 200 (колёса на ±100), радиус колеса 25 и арки 31; задняя дверь [−70, 2] длиннее передней [6, 66]
  const C = { LEN: 312, WB: 100, R: 25, ARCH: 31, HX: 2, DX0: -70, TOP: -107, BOT: -17, FX0: 6, FX1: 66, WY: -25 };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------ краски
  // Глянцевая чёрная краска: холодный блик неба по плечу (y ≈ −76), тёмный бок, чёрный низ. Градиент задан в абсолютных y кузова — и у двери, и у крыла он продолжается без шва
  const paint = (g) => A.linG(g, 0, -118, 0, -12, [[0, '#6f7b98'], [0.1, '#3f4862'], [0.3, '#2b3246'], [0.37, '#4a5574'], [0.41, '#5f6c90'], [0.47, '#2a3044'], [0.6, '#171a26'], [0.8, '#0d0e15'], [1, '#06060a']]);
  const glassFront = (g, y0, y1) => A.linG(g, 0, y0, 0, y1, [[0, '#7d97b2'], [0.5, '#3a4d66'], [1, '#1d2736']]);
  const glassRear = (g, y0, y1) => A.linG(g, 0, y0, 0, y1, [[0, '#566c88'], [0.5, '#222e41'], [1, '#0e141e']]);
  const chromeG = (g, y0, y1) => A.linG(g, 0, y0, 0, y1, [[0, '#ffffff'], [0.45, '#b9c0cf'], [0.55, '#8b93a7'], [1, '#dde1ea']]);

  // ------------------------------------------------------------------ контур кузова
  function bodyPath(g) {
    g.beginPath(); g.moveTo(-148, -14);
    g.lineTo(-156, -28); g.lineTo(-157, -50); g.quadraticCurveTo(-157, -67, -143, -71);                    // корма
    g.lineTo(-126, -78); g.bezierCurveTo(-108, -83, -99, -103, -74, -108);                                    // крышка багажника, пологое заднее стекло
    g.quadraticCurveTo(-24, -115, 24, -109); g.bezierCurveTo(44, -103, 58, -88, 74, -78);                       // крыша, лобовое
    g.quadraticCurveTo(114, -75, 147, -66); g.quadraticCurveTo(157, -63, 158, -50);                             // длинный капот, нос
    g.lineTo(159, -32); g.lineTo(153, -18); g.lineTo(148, -14); g.closePath();
  }

  // Хромированная окантовка вдоль готового пути (контур, серебро, блик)
  function chromeStroke(g, w, pathFn) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    pathFn(); g.lineWidth = w + 2.4; g.strokeStyle = OUT; g.stroke();
    pathFn(); g.lineWidth = w; g.strokeStyle = chromeG(g, -112, -78); g.stroke();
    pathFn(); g.lineWidth = Math.max(0.8, w * 0.28); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
  }

  // Три луча звезды Mercedes в круге: (cx, cy) — центр, r — радиус кольца, rot — поворот
  function star(g, cx, cy, r, rot, ring) {
    g.save(); g.translate(cx, cy); g.rotate(rot || 0); g.lineCap = 'round'; g.lineJoin = 'round';
    if (ring !== false) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.lineWidth = Math.max(1.6, r * 0.26 + 1.6); g.strokeStyle = OUT; g.stroke(); g.lineWidth = Math.max(1, r * 0.26); g.strokeStyle = '#e9edf5'; g.stroke(); }
    const rr = ring === false ? r : r * 0.86;
    g.beginPath(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; g.moveTo(0, 0); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.lineWidth = Math.max(1.8, r * 0.3) + 1.6; g.strokeStyle = OUT; g.stroke(); g.lineWidth = Math.max(1.1, r * 0.3); g.strokeStyle = '#f3f5fa'; g.stroke();
    g.restore();
  }

  // Надпись «Uber» штрихами: чистый геометрический гротеск с круглыми концами (прописная U высотой 21, строчные 15,6, штрих 4,2). (x, y) — левый край и базовая линия, h — высота «U» в юнитах, col — цвет;
  // под белым штрихом лежит тонкая тёмная кайма — буквы читаются и на блике краски
  function uberWord(g, x, y, h, col) {
    const k = h / 21, w = 4.2, xh = 15.6, cap = 21;
    g.save(); g.translate(x, y); g.scale(k, k); g.lineCap = 'round'; g.lineJoin = 'round';
    const glyphs = () => {
      let ox = 0;
      g.moveTo(ox + w / 2, -(cap - w / 2)); g.lineTo(ox + w / 2, -5.6); g.arc(ox + 7.5, -5.6, 5.4, Math.PI, 0, true); g.lineTo(ox + 12.9, -(cap - w / 2)); ox += 15 + 2.4;                                    // U
      g.moveTo(ox + w / 2, -(cap - w / 2)); g.lineTo(ox + w / 2, -w / 2); g.moveTo(ox + w / 2 + 11.4, -xh / 2); g.arc(ox + w / 2 + 5.7, -xh / 2, 5.7, 0, TAU); ox += 15.6 + 1.4;                             // b: стойка и круглая чаша
      g.moveTo(ox + w / 2, -xh / 2); g.lineTo(ox + w / 2 + 11.4, -xh / 2); g.arc(ox + w / 2 + 5.7, -xh / 2, 5.7, 0, -(TAU - 0.8), true); ox += 15.6 + 1.4;                                              // e: круг с перекладиной, раскрытый справа снизу
      g.moveTo(ox + w / 2, -w / 2); g.lineTo(ox + w / 2, -(xh - w / 2)); g.moveTo(ox + w / 2, -xh * 0.52); g.quadraticCurveTo(ox + w / 2 + 0.6, -(xh - w / 2), ox + w / 2 + 8.4, -(xh - w / 2 + 0.2));       // r: стойка и короткая дуга
    };
    g.beginPath(); glyphs(); g.lineWidth = w + 1.8; g.strokeStyle = 'rgba(8,8,14,0.5)'; g.stroke();
    g.beginPath(); glyphs(); g.lineWidth = w; g.strokeStyle = col; g.stroke();
    g.restore();
  }
  const UBER_W = 15 + 2.4 + 15.6 + 1.4 + 15.6 + 1.4 + 11.4;              // ширина слова при h = 21

  // ------------------------------------------------------------------ задняя левая дверь (в закрытом положении; открытая рисуется этим же кодом под аффинным преобразованием)
  function doorPath(g) { g.beginPath(); g.rect(C.DX0, C.TOP, C.HX - C.DX0, C.BOT - C.TOP); }
  function rearDoor(g) {
    const x0 = C.DX0, x1 = C.HX, t = C.TOP, b = C.BOT;
    g.save(); doorPath(g); g.clip();
    g.fillStyle = paint(g); g.fillRect(x0, t, x1 - x0, b - t);
    // плечо: холодная полоса блика (продолжает блик кузова)
    g.fillStyle = 'rgba(190,206,236,0.2)'; g.fillRect(x0, -80, x1 - x0, 2.4);
    A.edge(g, x0, -40, x1 - x0, 24, 'b', 24, 'rgba(0,0,0,0.35)');
    g.restore();
    // окно: тонированное, с хромированной окантовкой
    const win = () => { g.beginPath(); g.moveTo(x1 - 3, -83); g.lineTo(x1 - 3, -103); g.lineTo(x0 + 10, -103); g.quadraticCurveTo(x0 + 3, -102, x0 + 2, -95); g.lineTo(x0 + 2, -83); g.closePath(); };
    win(); g.fillStyle = glassRear(g, -103, -83); g.fill();
    g.save(); win(); g.clip();
    g.fillStyle = 'rgba(200,226,255,0.22)'; g.beginPath(); g.moveTo(x1 - 16, -83); g.lineTo(x1 - 6, -103); g.lineTo(x1 - 1, -103); g.lineTo(x1 - 11, -83); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x1 - 30, -83); g.lineTo(x1 - 22, -103); g.lineTo(x1 - 19, -103); g.lineTo(x1 - 27, -83); g.closePath(); g.fill();
    A.edge(g, x0, -103, x1 - x0, 10, 't', 10, 'rgba(0,0,0,0.4)');
    g.restore();
    chromeStroke(g, 2.6, win);
    // нижняя хромированная кромка стекла (молдинг по плечу)
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 2, -81.5); g.lineTo(x1 - 3, -81.5); g.stroke(); g.strokeStyle = '#cfd5e2'; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x0 + 3, -82.4); g.lineTo(x1 - 4, -82.4); g.stroke();
    // ручка (хром)
    A.box(g, x1 - 24, -72, 16, 4.6, { fill: chromeG(g, -72, -67), lw: 1.8, r: 2.3 });
    // «Uber»: белые буквы на двери, по центру нижней панели
    const h = 18.5, wd = UBER_W * h / 21;
    uberWord(g, (x0 + x1) / 2 - wd / 2 + 1, -39, h, '#ffffff');
    // швы двери
    g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineJoin = 'round'; g.strokeRect(x0, t, x1 - x0, b - t);
  }

  // Салон в проёме задней двери (виден, когда дверь открыта): тёмный проём, свет из окон другой стороны, диван (светлая кожа с простёжкой), подушка сиденья, холодная подсветка порога
  function interior(g) {
    const x0 = C.DX0, x1 = C.HX, t = C.TOP, b = C.BOT;
    g.beginPath(); g.rect(x0 - 0.5, t - 1, x1 - x0 + 1, b - t + 2); g.fillStyle = A.linG(g, 0, t, 0, b, [[0, '#2c3a4a'], [0.45, '#1a2230'], [1, '#0a0d14']]); g.fill();
    g.save(); g.beginPath(); g.rect(x0, t, x1 - x0, b - t); g.clip();
    // окно другой стороны: светлее, сквозь тонировку
    g.fillStyle = A.linG(g, 0, -103, 0, -83, [[0, '#7da0bd'], [1, '#456079']]); g.beginPath(); g.moveTo(x0 + 4, -100); g.lineTo(x1 - 6, -103); g.lineTo(x1 - 6, -84); g.lineTo(x0 + 4, -84); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0 + 14, -101, 8, 17);
    // спинка дивана с подголовником
    g.beginPath(); g.moveTo(x0 + 2, -84); g.quadraticCurveTo(x0 + 3, -92, x0 + 12, -92); g.lineTo(x0 + 24, -88); g.lineTo(x0 + 28, -46); g.lineTo(x0 + 2, -42); g.closePath();
    g.fillStyle = A.linG(g, x0, 0, x0 + 30, 0, [[0, '#c9ad88'], [1, '#e7d2ae']]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.ellipse(x0 + 15, -96, 9, 6.6, -0.15, 0, TAU); g.fillStyle = '#e3cba4'; g.fill(); g.lineWidth = 1.8; g.stroke();                                        // подголовник-подушка
    g.strokeStyle = 'rgba(110,80,50,0.5)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x0 + 4, -82); g.lineTo(x0 + 26, -66); g.moveTo(x0 + 4, -68); g.lineTo(x0 + 27, -52); g.moveTo(x0 + 4, -56); g.lineTo(x0 + 22, -62); g.stroke();   // простёжка
    // подушка сиденья
    g.beginPath(); g.moveTo(x0 + 2, -42); g.lineTo(x1 - 10, -44); g.lineTo(x1 - 6, -34); g.lineTo(x1 - 8, -26); g.lineTo(x0 + 2, -26); g.closePath(); g.fillStyle = A.linG(g, 0, -44, 0, -26, [[0, '#ecd8b6'], [1, '#bfa27c']]); g.fill(); g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x0 + 6, -43, x1 - x0 - 20, 1.8);
    // подсветка порога (холодная полоска)
    g.strokeStyle = 'rgba(120,214,255,0.85)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + 6, -21.5); g.lineTo(x1 - 4, -21.5); g.stroke();
    A.edge(g, x0, t, x1 - x0, 14, 't', 14, 'rgba(0,0,0,0.38)');
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(x0 - 0.5, t - 1, x1 - x0 + 1, b - t + 2);
  }

  // ------------------------------------------------------------------ кузов-спрайт
  function body(g) {
    g.lineJoin = 'round'; g.lineCap = 'round';
    const W = C.WB, AR = C.ARCH, WY = C.WY;
    g.fillStyle = '#0b0a10'; g.fillRect(-134, -15, 270, 8);                                         // тёмный низ между колёсами: кузов не парит
    bodyPath(g); g.fillStyle = paint(g); g.fill();
    g.save(); bodyPath(g); g.clip();
    // блики: длинная светлая линия по плечу от кормы к капоту, мягкая полоса на капоте и крышке багажника
    g.fillStyle = 'rgba(176,196,236,0.27)'; g.beginPath(); g.moveTo(-157, -66); g.lineTo(-126, -77); g.lineTo(74, -77); g.lineTo(158, -64); g.lineTo(158, -60); g.lineTo(74, -73); g.lineTo(-126, -73); g.lineTo(-157, -61); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(232,240,255,0.65)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-154, -64); g.lineTo(-126, -75); g.lineTo(74, -75.4); g.quadraticCurveTo(116, -73, 156, -62); g.stroke();
    A.edge(g, -160, -44, 322, 30, 'b', 30, 'rgba(0,0,0,0.4)'); A.grain(g, -160, -118, 322, 106, 0.08, 'overlay', 78, 0.5);
    for (const cx of [-W, W]) { g.fillStyle = '#05050a'; g.beginPath(); g.arc(cx, WY, AR, 0, TAU); g.fill(); }      // арки колёс
    g.restore();
    g.lineWidth = 4; g.strokeStyle = OUT; bodyPath(g); g.stroke();
    g.save(); bodyPath(g); g.clip(); g.lineWidth = 2.6; g.strokeStyle = OUT; for (const cx of [-W, W]) { g.beginPath(); g.arc(cx, WY, AR, 0, TAU); g.stroke(); } g.restore();

    // ---- остекление: заднее стекло-«бочок» у стойки, окно передней двери, стойки между ними чёрные
    const quarter = () => { g.beginPath(); g.moveTo(-76, -83); g.lineTo(-76, -101); g.bezierCurveTo(-90, -100, -101, -95, -111, -84); g.lineTo(-111, -83); g.closePath(); };
    quarter(); g.fillStyle = glassRear(g, -101, -83); g.fill(); g.save(); quarter(); g.clip(); g.fillStyle = 'rgba(200,226,255,0.2)'; g.beginPath(); g.moveTo(-92, -83); g.lineTo(-84, -101); g.lineTo(-80, -101); g.lineTo(-88, -83); g.closePath(); g.fill(); g.restore();
    chromeStroke(g, 2.4, quarter);
    const front = () => { g.beginPath(); g.moveTo(C.FX0 + 2, -83); g.lineTo(C.FX0 + 2, -103); g.lineTo(26, -104); g.bezierCurveTo(40, -97, 52, -90, 63, -83); g.closePath(); };
    front(); g.fillStyle = glassFront(g, -104, -83); g.fill();
    g.save(); front(); g.clip(); g.fillStyle = 'rgba(224,240,255,0.28)'; g.beginPath(); g.moveTo(14, -83); g.lineTo(26, -104); g.lineTo(33, -104); g.lineTo(21, -83); g.closePath(); g.fill(); g.beginPath(); g.moveTo(34, -83); g.lineTo(42, -97); g.lineTo(46, -94); g.lineTo(40, -83); g.closePath(); g.fill(); A.edge(g, 0, -104, 70, 10, 't', 10, 'rgba(0,0,0,0.3)'); g.restore();
    chromeStroke(g, 2.6, front);
    // молдинг по плечу под передним стеклом и стойка B
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(C.FX0 + 2, -81.5); g.lineTo(64, -81.5); g.stroke(); g.strokeStyle = '#cfd5e2'; g.lineWidth = 2.6; g.stroke();
    g.fillStyle = 'rgba(8,8,12,0.9)'; g.fillRect(C.HX + 0.5, -104, 3, 22);

    // ---- двери: задняя (с белой надписью), передняя; ручка, шов, стык с кузовом
    rearDoor(g);
    g.strokeStyle = OUT; g.lineWidth = 2.2; g.beginPath(); g.moveTo(C.FX0, -107); g.lineTo(C.FX0, -17); g.moveTo(C.FX1 + 0.5, -80); g.lineTo(C.FX1 - 1, -25); g.stroke();
    A.box(g, 34, -72, 16, 4.6, { fill: chromeG(g, -72, -67), lw: 1.8, r: 2.3 });
    // хромированный порог и накладка по низу бока
    g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 6; g.beginPath(); g.moveTo(-66, -20.5); g.lineTo(66, -20.5); g.stroke(); g.strokeStyle = chromeG(g, -24, -17); g.lineWidth = 3.4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-64, -21.8); g.lineTo(64, -21.8); g.stroke();
    // зеркало
    g.beginPath(); g.moveTo(64, -85); g.quadraticCurveTo(70, -92, 78, -88); g.quadraticCurveTo(80, -84, 74, -81); g.lineTo(65, -81); g.closePath(); g.fillStyle = A.linG(g, 0, -92, 0, -81, [[0, '#4d587a'], [1, '#14161f']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    // значок Maybach (двойная M) на стойке за задним стеклом
    g.beginPath(); g.ellipse(-120, -76, 6.4, 5.6, 0, 0, TAU); g.fillStyle = chromeG(g, -82, -70); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.moveTo(-124, -73); g.lineTo(-124, -79); g.lineTo(-121.6, -75.5); g.lineTo(-119.2, -79); g.lineTo(-119.2, -73); g.moveTo(-121.4, -73); g.lineTo(-121.4, -79); g.lineTo(-119, -75.5); g.lineTo(-116.6, -79); g.lineTo(-116.6, -73);
    g.lineWidth = 1.05; g.strokeStyle = '#1b1a24'; g.stroke();

    // ---- нос: вертикально-рёберная хромированная решётка, узкие светодиодные фары, нижняя воздухозаборка, «звезда» на капоте
    const grille = () => { g.beginPath(); g.moveTo(143, -62); g.lineTo(156, -61.5); g.quadraticCurveTo(160, -60, 160, -55); g.lineTo(161, -34); g.quadraticCurveTo(161, -29, 156, -29); g.lineTo(145, -29); g.closePath(); };
    grille(); g.fillStyle = '#16171f'; g.fill();
    g.save(); grille(); g.clip();
    for (let i = 0; i < 9; i++) { const gx = 146 + i * 1.75; g.fillStyle = chromeG(g, -62, -29); g.fillRect(gx, -62, 1.15, 33); }
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(143, -62, 18, 4);
    A.edge(g, 143, -62, 18, 33, 'b', 12, 'rgba(0,0,0,0.5)');
    g.restore();
    g.lineWidth = 2.6; g.strokeStyle = OUT; grille(); g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(144, -61.5); g.lineTo(156, -60.8); g.stroke();
    // фара
    g.beginPath(); g.moveTo(130, -70); g.quadraticCurveTo(146, -71, 157, -66.5); g.lineTo(156, -62.2); g.quadraticCurveTo(144, -63.4, 129, -64.5); g.closePath(); g.fillStyle = A.linG(g, 0, -70, 0, -63, [[0, '#f4f9ff'], [1, '#aac4de']]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#4e86c8'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(133, -66.4); g.quadraticCurveTo(146, -67.4, 153, -64.6); g.stroke();
    // нижняя воздухозаборка и хромовая кромка бампера
    g.fillStyle = '#0a0a10'; g.beginPath(); g.moveTo(120, -26); g.lineTo(156, -26); g.lineTo(152, -17.5); g.lineTo(124, -17.5); g.closePath(); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = chromeG(g, -26, -17); g.lineWidth = 1.5; g.beginPath(); g.moveTo(125, -23); g.lineTo(154, -23); g.moveTo(126, -20); g.lineTo(152, -20); g.stroke();
    // «звезда» Mercedes: стоит на капоте у решётки (лицом к зрителю), на тонкой ножке
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(147, -69.5); g.lineTo(147, -74); g.stroke(); g.strokeStyle = '#cfd5e2'; g.lineWidth = 1.5; g.stroke();
    star(g, 147, -79.5, 5.4, 0, true);

    // ---- корма: красный светодиодный фонарь, хром багажника, выхлопная накладка
    g.beginPath(); g.moveTo(-157, -68); g.lineTo(-146, -71); g.lineTo(-146, -60); g.lineTo(-157, -57); g.closePath(); g.fillStyle = A.linG(g, 0, -70, 0, -58, [[0, '#ff6a6a'], [0.5, '#d41c2e'], [1, '#8e0f22']]); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,214,214,0.8)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-155, -64); g.lineTo(-148, -66); g.stroke();
    g.strokeStyle = chromeG(g, -50, -42); g.lineWidth = 2.2; g.beginPath(); g.moveTo(-156, -46); g.lineTo(-150, -46); g.stroke();
    g.fillStyle = chromeG(g, -22, -15); g.fillRect(-147, -22, 8, 3.4); g.lineWidth = 1.4; g.strokeStyle = OUT; g.strokeRect(-147, -22, 8, 3.4);
    A.speckle(g, -160, -118, 322, 106, 0.04, 8);
  }

  // ------------------------------------------------------------------ колёса и фары (на кадр)
  // Колесо: шина, хромированный литой диск с 10 спицами (крутится), ступица с маленькой звездой
  function wheel(ctx, cx, cy, rot) {
    ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, C.R, 0, TAU); ctx.fillStyle = '#15161d'; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, C.R - 3, 3.6, 5.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 17.6, 0, TAU); ctx.fillStyle = '#22242e'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 17.6, 0, TAU); ctx.arc(0, 0, 15.2, 0, TAU, true); ctx.fillStyle = chromeRing(ctx); ctx.fill('evenodd');
    ctx.save(); ctx.rotate(rot);
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 4.5, Math.sin(a) * 4.5); ctx.lineTo(Math.cos(a) * 15.4, Math.sin(a) * 15.4); ctx.lineWidth = 3.6; ctx.strokeStyle = 'rgba(14,14,20,0.9)'; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#d3d8e4'; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.fillStyle = '#b7bdcc'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6); } ctx.lineWidth = 1.1; ctx.strokeStyle = '#2a2c38'; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  function chromeRing(ctx) { const g = ctx.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#9aa2b5'); g.addColorStop(1, '#e6e9f0'); return g; }

  // ------------------------------------------------------------------ сборка
  // Спрайт кузова: меняется только при смене масштаба; возвращает { draw(ctx, x, y, state), L }
  function sprite(scale) {
    const W = 344, H = 160, ox = 172, oy = 150;
    const L = A.layer(W, H, (g) => { g.translate(ox, oy); body(g); }, scale);
    const spr = { L, ox, oy };
    // Машина на кадр: тень, свет фар (когда едет), кузов, колёса (крутятся по пройденному пути), салон и открытая задняя дверь. x — место стоянки, y — линия земли под колёсами, T = sc.taxi
    spr.draw = (ctx, x, y, T) => {
      if (!L.c.width) return;
      const dx = (T && T.dx) || 0, door = clamp((T && T.door) || 0, 0, 1), px = x + dx;
      A.shadow(ctx, px + 4, y + 2, 178, 0.36);
      if (dx > 1) {                                                                                       // едет: фары светят вперёд
        const a = Math.min(1, dx / 40), gr = ctx.createLinearGradient(px + 150, 0, px + 370, 0);
        gr.addColorStop(0, 'rgba(255,246,206,' + (0.42 * a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,246,206,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(px + 152, y - 66); ctx.lineTo(px + 152, y - 53); ctx.lineTo(px + 370, y + 2); ctx.lineTo(px + 370, y - 116); ctx.closePath(); ctx.fill();
      }
      ctx.drawImage(L.c, px - ox, y - oy, L.w, L.h);
      if (dx > 1) A.glow(ctx, px + 150, y - 66, 24, 'rgba(255,250,222,', 0.9 * Math.min(1, dx / 40));
      for (const cx of [-C.WB, C.WB]) wheel(ctx, px + cx, y + C.WY, dx / C.R);
      if (door > 0.01) {
        const th = door * 1.12, c = Math.cos(th), s = Math.sin(th), hx = C.HX, w = hx - C.DX0, sink = 7 * s;
        ctx.save(); ctx.translate(px, y);
        interior(ctx);
        A.glow(ctx, C.DX0 + 30, -64, 46, 'rgba(255,236,190,', 0.18 * door);                           // тёплый свет салона
        ctx.transform(c, -sink / w, 0, 1, hx * (1 - c), sink * hx / w);
        doorPath(ctx); ctx.clip();
        rearDoor(ctx);
        ctx.fillStyle = 'rgba(6,8,16,' + (0.2 * s).toFixed(3) + ')'; ctx.fillRect(C.DX0, C.TOP, w, C.BOT - C.TOP);
        ctx.restore();
      }
    };
    return spr;
  }

  Ale.CarArt = { C, sprite, drawBody: body, drawWheel: wheel, drawInterior: interior, uberWord, UBER_W };
})();
