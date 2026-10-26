// Оформление аэропорта: площадь перед вокзалом, зал с окнами на лётное поле, стойки регистрации, табло, рамка металлодетектора,
// багажная карусель, выход на посадку. Всё рисуется кодом (самолёт и виды из окон — нарисованные картинки).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, K = Ale.Paris, OUT = A.OUT;

  // ---------------------------------------------------------------- фасад аэровокзала
  // Одно здание на всю главу: его видно вдалеке в конце скачки и вблизи на площади в аэропорту (то же самое, а не два разных рисунка).
  // Координаты локальные: (0, 0) — левый верхний угол, низ (y = h) — линия земли. o.door — рисовать ли вход (на площади вход рисует сама сцена).
  function terminalFacade(g, w, h, o) {
    o = o || {};
    const capH = 24, signY = capH - 4, signH = 58, gy = capH + signH, plinth = 34, gh = h - gy - plinth, gx = 26, gw = w - 52;
    // бетонное тело здания
    A.plaster(g, 0, capH, w, h - capH, [[0, '#e3e9f0'], [1, '#c2ccd9']], { seed: 5, grain: 0.1 });
    g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(0, capH, w, h - capH);
    // стеклянная стена: отражение неба, внутри — потолочные лампы и стойки регистрации в глубине
    g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
    A.gradV(g, gx, gy, gw, gh, [[0, '#6d9cc6'], [0.5, '#a3c6df'], [1, '#d3e4ef']]);
    g.fillStyle = 'rgba(28,46,80,0.30)'; g.fillRect(gx, gy + gh * 0.5, gw, gh * 0.5);                       // тёмная глубина зала
    for (let x = gx + 40; x < gx + gw - 30; x += 96) { g.fillStyle = 'rgba(255,238,190,0.85)'; A.rrPath(g, x, gy + gh * 0.44, 46, 6, 3); g.fill(); A.glow(g, x + 23, gy + gh * 0.47, 46, 'rgba(255,238,190,', 0.25); }
    for (let x = gx + 22; x < gx + gw - 70; x += 150) { A.box(g, x, gy + gh - 58, 88, 26, { fill: 'rgba(52,86,150,0.55)', lw: 2, stroke: 'rgba(30,40,70,0.55)' }); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 4, gy + gh - 56, 80, 3); }
    // блики на стекле
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.beginPath(); g.moveTo(gx + 40, gy + gh); g.lineTo(gx + 190, gy); g.lineTo(gx + 262, gy); g.lineTo(gx + 112, gy + gh); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.11)'; g.beginPath(); g.moveTo(gx + 330, gy + gh); g.lineTo(gx + 440, gy); g.lineTo(gx + 480, gy); g.lineTo(gx + 370, gy + gh); g.closePath(); g.fill();
    g.restore();
    // переплёты: стойки и ригели с тёмной гранью и светлой кромкой
    g.strokeStyle = 'rgba(30,46,78,0.85)'; g.lineWidth = 3.4;
    for (let x = gx; x <= gx + gw + 1; x += 58) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + gh); g.stroke(); }
    for (const k of [0.34, 0.68]) { g.beginPath(); g.moveTo(gx, gy + gh * k); g.lineTo(gx + gw, gy + gh * k); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4;
    for (let x = gx + 2; x <= gx + gw; x += 58) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + gh); g.stroke(); }
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.strokeRect(gx, gy, gw, gh);
    // вход: козырёк, тёмное стекло створок, ручки
    if (o.door) {
      const dx = w - 150 - 70, dw = 148;
      A.box(g, dx - 8, gy + gh * 0.16, dw + 16, 18, { fill: '#2b3a55', lw: 3.4, hi: 'rgba(255,255,255,0.2)' });
      A.text(g, 'DÉPARTS', dx + dw / 2, gy + gh * 0.16 + 9, 12, '#fff6e4');
      for (const ox of [0, dw / 2 + 2]) {
        g.fillStyle = 'rgba(24,42,74,0.70)'; g.fillRect(dx + ox, gy + gh * 0.16 + 22, dw / 2 - 2, gh * 0.84 - 22);
        g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(dx + ox, gy + gh * 0.16 + 22, dw / 2 - 2, gh * 0.84 - 22);
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(dx + ox + 6, gy + gh * 0.16 + 28, 10, gh * 0.84 - 34);
      }
      g.fillStyle = '#d9a441'; for (const hx of [dx + dw / 2 - 8, dx + dw / 2 + 8]) { g.fillRect(hx - 1.5, gy + gh * 0.56, 3, 26); }
    }
    // цоколь
    A.box(g, -8, h - plinth, w + 16, plinth, { fill: '#a3adbc', lw: 4, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(30,40,60,0.25)' });
    A.grain(g, -8, h - plinth, w + 16, plinth, 0.16, 'overlay', 6);
    // козырёк-карниз и вывеска
    A.box(g, -12, 0, w + 24, capH + 4, { fill: '#b3bdcb', lw: 4, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(30,40,60,0.25)' });
    g.fillStyle = 'rgba(30,40,60,0.18)'; g.fillRect(0, capH + 4, w, 8);                                       // тень карниза на стене
    A.box(g, 14, signY + 6, w - 28, signH - 10, { fill: '#2b3a55', lw: 4, hi: 'rgba(255,255,255,0.2)' });
    A.text(g, 'PARIS · CHARLES DE GAULLE', w / 2, signY + signH / 2 + 2, Math.min(32, w * 0.034), '#fff6e4');
    for (const px of [58, w - 58]) {           // значки-самолётики по краям вывески
      g.save(); g.translate(px, signY + signH / 2 + 2); g.fillStyle = '#f2c94c';
      g.beginPath(); g.moveTo(-15, 2); g.lineTo(-3, -2); g.lineTo(-9, -12); g.lineTo(-4, -12); g.lineTo(6, -2); g.lineTo(16, -2); g.lineTo(16, 2); g.lineTo(6, 2); g.lineTo(-4, 12); g.lineTo(-9, 12); g.lineTo(-3, 2); g.closePath(); g.fill(); g.restore();
    }
  }

  // ---------------------------------------------------------------- зал и площадь
  function hallBackground(g, W, H, X) {
    // ===== площадь перед вокзалом (x < doors): небо, дальний город, фасад
    const px1 = X.hallStart;
    A.gradV(g, 0, 0, px1, 600, [[0, '#82bde4'], [0.6, '#cfe4e6'], [1, '#f8e3b4']]);
    A.glow(g, 180, 300, 360, 'rgba(255,214,140,', 0.6);
    Ale.StreetArt.buildingStrip(g, px1, 588, 88, { haze: 0.5, hazeColor: '244,226,214', lit: 0, widths: [220, 260], floors: [2, 3], scale: 0.8, gaps: 0.2 });          // дальние дома стоят на бордюре площади (y 584): при основании 520 между ними и бордюром висела светлая полоса неба
    // фасад аэровокзала — тот же, что виден в конце скачки; входом служит рамка раздвижных дверей на границе зала (рисует сцена)
    const FW = 940, FH = 346;
    g.save(); g.translate(px1 - FW, 590 - FH); terminalFacade(g, FW, FH, { door: false }); g.restore();
    // асфальт площади и разметка
    A.gradV(g, 0, 590, px1, 130, [[0, '#8b8f9a'], [1, '#666b78']]); A.grain(g, 0, 590, px1, 130, 0.16, 'overlay', 7);
    g.fillStyle = 'rgba(255,240,200,0.7)'; for (let x = 20; x < px1; x += 130) g.fillRect(x, 690, 70, 6);
    g.fillStyle = OUT; g.fillRect(0, 588, px1, 3.4);
    A.box(g, -4, 584, px1 + 8, 12, { fill: '#c9c4b8', lw: 3, hi: 'rgba(255,255,255,0.35)' });      // бордюр

    // ===== зал (x >= hallStart)
    const x0 = px1, w = W - x0;
    // задняя стена: светлые панели; над ними полоса окон на лётное поле
    A.plaster(g, x0, 60, w, 520, [[0, '#f2f4f8'], [1, '#dfe4ec']], { seed: 91, grain: 0.1, dark: 'rgba(60,70,90,', light: 'rgba(255,255,255,' });
    // ферма потолка и светильники
    A.gradV(g, x0, 0, w, 64, [[0, '#4b5568'], [1, '#6b7488']]);
    g.strokeStyle = '#9aa4b6'; g.lineWidth = 4; for (let x = x0; x < W; x += 110) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 55, 56); g.lineTo(x + 110, 6); g.stroke(); }
    A.grain(g, x0, 0, w, 64, 0.2, 'overlay', 3);
    g.fillStyle = OUT; g.fillRect(x0, 62, w, 3.4);
    for (let x = x0 + 120; x < W; x += 340) { g.fillStyle = '#fffbe8'; A.rrPath(g, x, 66, 140, 10, 5); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); A.glow(g, x + 70, 90, 120, 'rgba(255,248,220,', 0.35); }
    // окна во всю стену (вид на лётное поле): x1..x2
    const VIEW_AT = [0.2, 0.42, 0.64, 0.86];
    X.windows.forEach(([wx, ww], wi) => {
      const wy = 110, wh = 250;
      // вид из окна — нарисованная панорама лётного поля (каждое окно смотрит на свой участок)
      if (!A.image(g, 'view_airfield', wx, wy, ww, wh, { at: VIEW_AT[wi % VIEW_AT.length], zoom: 1.3, top: 0.62 })) { g.fillStyle = '#9fc6e6'; g.fillRect(wx, wy, ww, wh); }
      g.strokeStyle = '#9ba4b4'; g.lineWidth = 6; for (let x = wx; x <= wx + ww; x += 80) { g.beginPath(); g.moveTo(x, wy); g.lineTo(x, wy + wh); g.stroke(); } g.beginPath(); g.moveTo(wx, wy + wh * 0.5); g.lineTo(wx + ww, wy + wh * 0.5); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 3.4; g.strokeRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.moveTo(wx + 30, wy + wh); g.lineTo(wx + 120, wy); g.lineTo(wx + 160, wy); g.lineTo(wx + 70, wy + wh); g.fill();
      A.box(g, wx - 6, wy + wh, ww + 12, 14, { fill: '#c9d0da', lw: 3 });
    });
    // цоколь стены
    A.gradV(g, x0, 420, w, 160, [[0, '#8e97a8'], [1, '#6c7488']]);
    for (let x = x0; x < W; x += 120) { A.box(g, x + 10, 440, 100, 122, { fill: 'rgba(255,255,255,0.08)', lw: 2, stroke: 'rgba(30,40,60,0.6)' }); }
    A.grain(g, x0, 420, w, 160, 0.16, 'overlay', 4);
    g.fillStyle = OUT; g.fillRect(x0, 418, w, 3);
    // пол: светлая плитка с бликом
    A.checker(g, x0, 580, w, 140, 90, '#e4e6ea', '#d2d6dd');
    A.gradV(g, x0, 580, w, 140, [[0, 'rgba(255,255,255,0.28)'], [1, 'rgba(30,40,60,0.36)']]);
    A.grain(g, x0, 580, w, 140, 0.1, 'overlay', 5);
    g.fillStyle = OUT; g.fillRect(x0, 578, w, 3.4);
    A.edge(g, x0, 580, w, 20, 't', 20, 'rgba(30,40,60,0.3)');
    // разметочные полосы на полу (жёлтые)
    g.fillStyle = 'rgba(242,201,76,0.85)'; g.fillRect(x0 + 40, 640, w - 80, 5); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(x0 + 40, 640, w - 80, 5);
    // стена в проёме входа: рама автоматических дверей
    A.box(g, x0 - 14, -4, 28, 584, { fill: '#cfd6e0', lw: 3.4, hi: 'rgba(255,255,255,0.4)' });                 // угловая стойка здания во всю высоту: раньше рама входа начиналась на y = 150, а выше небо площади упиралось прямо в потолок зала жёсткой вертикалью
    A.box(g, x0 - 80, 116, 180, 44, { fill: '#2b4b8f', lw: 4, r: 6, hi: 'rgba(255,255,255,0.2)' }); A.text(g, 'DÉPARTS', x0 + 10, 138, 22, '#fff6e4');
  }

  // Стойка регистрации: стол, монитор, табло с номером, весы.
  function checkinDesk(label) {
    return A.layer(190, 128, (g) => {
      A.box(g, 6, 60, 178, 66, { fill: '#e4e9f1', lw: 3.6, hi: 'rgba(255,255,255,0.5)' });
      A.plaster(g, 8, 62, 174, 62, [[0, '#eef2f8'], [1, '#cdd6e4']], { seed: 12, grain: 0.1 });
      A.box(g, 0, 50, 190, 14, { fill: '#2b4b8f', lw: 3.4, r: 3, hi: 'rgba(255,255,255,0.3)' });
      A.box(g, 20, 74, 150, 8, { fill: '#2b4b8f', lw: 2.6 });
      // монитор
      A.box(g, 70, 8, 56, 40, { fill: '#2b3140', lw: 3.4, r: 4 }); g.fillStyle = '#7cc6ee'; g.fillRect(75, 13, 46, 28);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(78, 17, 30, 3); g.fillRect(78, 24, 22, 3); g.fillRect(78, 31, 36, 3);
      g.fillStyle = '#2b3140'; g.fillRect(94, 48, 8, 4);
      // табличка «CHECK-IN»
      A.box(g, 134, 20, 44, 28, { fill: '#2b4b8f', lw: 3, r: 3 }); A.text(g, label || 'A12', 156, 35, 14, '#fff6e4');
      // багаж на весах
      A.box(g, 14, 44, 38, 8, { fill: '#8a90a0', lw: 2.6 });
    }, 1.5);
  }

  function cart() {
    return A.layer(96, 84, (g) => {
      g.strokeStyle = '#7c8492'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(10, 24); g.lineTo(84, 24); g.moveTo(84, 24); g.lineTo(90, 6); g.moveTo(10, 24); g.lineTo(10, 60); g.moveTo(84, 24); g.lineTo(84, 60); g.stroke();
      g.lineWidth = 2.4; for (let x = 20; x < 80; x += 12) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 60); g.stroke(); }
      g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(10, 24, 74, 36);
      A.box(g, 6, 58, 82, 8, { fill: '#5c6472', lw: 3 });
      for (const wx of [20, 76]) { g.beginPath(); g.arc(wx, 74, 8, 0, 6.3); g.fillStyle = '#23262e'; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(); }
      // чемодан
      A.box(g, 22, 4, 40, 26, { fill: '#c8593a', lw: 3, r: 4 }); g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(34, 4); g.lineTo(34, -4); g.lineTo(50, -4); g.lineTo(50, 4); g.stroke();
    }, 1.5);
  }

  function suitcase(c1, c2) {
    return A.layer(58, 46, (g) => {
      A.box(g, 4, 10, 50, 34, { fill: c1, lw: 3.2, r: 5, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.2)' });
      g.strokeStyle = 'rgba(43,26,32,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 12); g.lineTo(18, 42); g.moveTo(40, 12); g.lineTo(40, 42); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 10); g.lineTo(22, 3); g.lineTo(36, 3); g.lineTo(36, 10); g.stroke();
      g.fillStyle = c2; g.fillRect(4, 24, 50, 5);
    }, 1.5);
  }

  function palm() {
    return A.layer(150, 190, (g) => {
      A.box(g, 44, 130, 62, 58, { fill: '#c9d0da', lw: 3.4, r: 6, hi: 'rgba(255,255,255,0.4)' });
      g.strokeStyle = '#7a5a3a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(75, 132); g.quadraticCurveTo(70, 90, 78, 56); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.42; g.save(); g.translate(78, 56); g.rotate(a); g.fillStyle = i % 2 ? '#4f8a4b' : '#3f7a43'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -34, 0, -78); g.quadraticCurveTo(14, -34, 0, 0); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); g.restore(); }
    }, 1.5);
  }

  function kioskAirport() {
    return A.layer(210, 190, (g) => {
      A.box(g, 6, 40, 198, 148, { fill: '#e9edf3', lw: 4, hi: 'rgba(255,255,255,0.4)' });
      A.box(g, 0, 26, 210, 22, { fill: '#c7562f', lw: 4, r: 4 }); A.text(g, 'CAFÉ · CROISSANTS', 105, 37.5, 15, '#fff6e4');
      A.box(g, 22, 64, 166, 74, { fill: '#a6c9d8', lw: 3.4 }); g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(30, 138); g.lineTo(76, 64); g.lineTo(96, 64); g.lineTo(50, 138); g.fill();
      for (let i = 0; i < 5; i++) { g.fillStyle = '#e8b56a'; g.beginPath(); g.ellipse(48 + i * 32, 124, 13, 8, 0.25, 0, 6.3); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
      A.box(g, 6, 138, 198, 50, { fill: '#2b4b8f', lw: 3.4 });
      A.box(g, 26, 148, 40, 30, { fill: 'rgba(0,0,0,0.18)', lw: 2.2 }); A.box(g, 84, 148, 40, 30, { fill: 'rgba(0,0,0,0.18)', lw: 2.2 }); A.box(g, 142, 148, 40, 30, { fill: 'rgba(0,0,0,0.18)', lw: 2.2 });
    }, 1.5);
  }

  // Рамка металлодетектора: серый портал со светодиодами.
  function secArch() {
    return A.layer(150, 260, (g) => {
      A.box(g, 6, 40, 30, 216, { fill: '#c9d0da', lw: 4, hi: 'rgba(255,255,255,0.4)' }); A.box(g, 114, 40, 30, 216, { fill: '#c9d0da', lw: 4, hi: 'rgba(255,255,255,0.4)' });
      A.box(g, 0, 10, 150, 46, { fill: '#b6bfcc', lw: 4, r: 8, hi: 'rgba(255,255,255,0.4)' });
      for (let i = 0; i < 5; i++) { g.fillStyle = '#4dd06a'; g.beginPath(); g.arc(26 + i * 24, 34, 4.4, 0, 6.3); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke(); }
      for (const px of [21, 129]) { g.fillStyle = 'rgba(80,100,130,0.4)'; g.fillRect(px - 8, 70, 16, 150); }
      A.box(g, 0, 246, 150, 12, { fill: '#8a90a0', lw: 3 });
    }, 1.5);
  }

  // Выход на посадку: стойка, рамка трапа, светящееся «BOARDING».
  function gateDesk() {
    return A.layer(230, 130, (g) => {
      A.box(g, 8, 50, 214, 78, { fill: '#e4e9f1', lw: 3.8, hi: 'rgba(255,255,255,0.5)' });
      A.plaster(g, 10, 52, 210, 74, [[0, '#f0f3f9'], [1, '#c9d2e0']], { seed: 33, grain: 0.1 });
      A.box(g, 0, 40, 230, 14, { fill: '#2b4b8f', lw: 3.4, r: 3, hi: 'rgba(255,255,255,0.3)' });
      A.box(g, 88, 62, 54, 44, { fill: '#2b3140', lw: 3.4, r: 4 }); g.fillStyle = '#7cc6ee'; g.fillRect(93, 67, 44, 30);
      A.box(g, 150, 60, 62, 34, { fill: '#2b4b8f', lw: 3, r: 3 }); A.text(g, 'GATE A7', 181, 77, 14, '#fff6e4');
    }, 1.5);
  }

  function jetDoor() {
    return A.layer(150, 320, (g) => {
      A.box(g, 0, 0, 150, 320, { fill: '#c9d0da', lw: 4.4 });
      A.box(g, 16, 30, 118, 290, { fill: '#39445a', lw: 4 });
      g.fillStyle = A.linG(g, 0, 30, 0, 320, [[0, '#7fa6c8'], [1, '#dfe9f2']]); g.fillRect(24, 38, 102, 274);
      g.strokeStyle = 'rgba(40,60,90,0.6)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(75, 38); g.lineTo(75, 312); g.stroke();
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#26221f' : '#e4b73a'; g.fillRect(0, i * 4 + 0, 0, 0); }
      g.save(); g.beginPath(); g.rect(0, 6, 150, 18); g.clip(); for (let i = -2; i < 12; i++) { g.fillStyle = i % 2 ? '#26221f' : '#e4b73a'; g.beginPath(); g.moveTo(i * 20, 24); g.lineTo(i * 20 + 12, 6); g.lineTo(i * 20 + 32, 6); g.lineTo(i * 20 + 20, 24); g.fill(); } g.restore();
      g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(0, 6, 150, 18);
    }, 1.5);
  }

  Ale.AirportArt = { terminalFacade, hallBackground, checkinDesk, cart, suitcase, palm, kioskAirport, secArch, gateDesk, jetDoor };
})();
