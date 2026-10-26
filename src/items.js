// Предметы и снаряды, нарисованные кодом в высоком разрешении (4 пикселя на юнит), вместо крошечных исходных картинок 40–64 px,
// которые при увеличении на экране мылились и «не сглаживались»: ключ, яблоко, чашка, ягода, билет, фишка, мел, бумажный комок.
// Регистрируются в Ale.Assets.sprites под теми же именами, что и раньше (it_key, it_apple, …) — остальной код ничего не замечает.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const OUT = '#2b1a20', RES = 4;

  function paint(name, w, h, fn) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * RES); c.height = Math.round(h * RES);
    const g = c.getContext('2d');
    g.scale(RES, RES); g.translate(w / 2, h / 2);
    g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g);
    Ale.Assets.addCanvas(name, c, RES);
  }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
  const rad = (g, x, y, r0, r1, stops, fx, fy) => { const gr = g.createRadialGradient(fx === undefined ? x : fx, fy === undefined ? y : fy, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
  // Контур наружу: толстая тёмная обводка, поверх — заливка
  const outlined = (g, path, fill, lw) => { path(); g.lineWidth = (lw || 1.8) * 2; g.strokeStyle = OUT; g.stroke(); path(); g.fillStyle = fill; g.fill(); };

  // ---------------------------------------------------------------- ключ (по диагонали: кольцо слева вверху, борода справа внизу)
  function key(g) {
    g.translate(2, 2);                 // зрительный центр ключа лежит между кольцом и бородой
    g.rotate(Math.PI / 4);
    const brass = (y0, y1) => lin(g, 0, y0, 0, y1, [[0, '#fff0b0'], [0.35, '#f0c85a'], [0.7, '#c9982f'], [1, '#8a6626']]);
    // стержень
    outlined(g, () => { g.beginPath(); g.moveTo(-8, -2.6); g.lineTo(17, -2.6); g.lineTo(17, 2.6); g.lineTo(-8, 2.6); g.closePath(); }, brass(-2.6, 2.6), 1.7);
    // борода: два зубца
    outlined(g, () => { g.beginPath(); g.moveTo(8.5, 2); g.lineTo(8.5, 9); g.lineTo(12, 9); g.lineTo(12, 6); g.lineTo(13.6, 6); g.lineTo(13.6, 9); g.lineTo(17, 9); g.lineTo(17, 2); g.closePath(); }, brass(2, 9), 1.7);
    // два пояска на стержне
    for (const [x0, x1, hh] of [[-5.6, -2.6, 4.6], [1.4, 3.8, 3.8]]) outlined(g, () => { g.beginPath(); g.rect(x0, -hh, x1 - x0, hh * 2); }, brass(-hh, hh), 1.4);
    // головка: три лепестка вокруг кольца
    const bow = () => { g.beginPath(); g.arc(-15, 0, 8.6, 0, 6.3); for (const a of [-1.57, 1.57, 3.14]) { g.moveTo(-15 + Math.cos(a) * 8.6 + 5.4, -0 + Math.sin(a) * 8.6); g.arc(-15 + Math.cos(a) * 8.6, Math.sin(a) * 8.6, 5.4, 0, 6.3); } };
    outlined(g, bow, lin(g, -24, -14, -6, 14, [[0, '#fff0b0'], [0.4, '#f0c85a'], [1, '#a8762a']]), 1.8);
    // отверстие
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(-15, 0, 3.9, 0, 6.3); g.fill(); g.globalCompositeOperation = 'source-over';
    g.beginPath(); g.arc(-15, 0, 3.9, 0, 6.3); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
    // блики
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-4, -1.6); g.lineTo(15.4, -1.6); g.stroke();
    g.beginPath(); g.arc(-15, 0, 6.6, 3.6, 4.7); g.stroke();
  }

  // ---------------------------------------------------------------- яблоко
  function apple(g) {
    const body = () => { g.beginPath(); g.moveTo(0, -13); g.bezierCurveTo(-8, -22, -27, -16, -25, 2); g.bezierCurveTo(-24, 20, -11, 28, 0, 24); g.bezierCurveTo(11, 28, 24, 20, 25, 2); g.bezierCurveTo(27, -16, 8, -22, 0, -13); g.closePath(); };
    outlined(g, body, rad(g, 0, 4, 2, 30, [[0, '#ff7a64'], [0.5, '#e0362a'], [1, '#9a1a1a']], -8, -6), 2);
    g.save(); body(); g.clip();
    g.fillStyle = 'rgba(90,10,20,0.28)'; g.beginPath(); g.ellipse(12, 16, 22, 15, 0.4, 0, 6.3); g.fill();                         // тень снизу справа
    g.fillStyle = 'rgba(255,214,170,0.10)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(-4 + i * 4, 6 + (i % 2) * 6, 1.1, 4, 0.2, 0, 6.3); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.62)'; g.beginPath(); g.ellipse(-12, -6, 4.6, 8, 0.5, 0, 6.3); g.fill();                          // блик
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(-6, 8, 1.7, 0, 6.3); g.fill();
    // черешок
    g.strokeStyle = OUT; g.lineWidth = 5.2; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(1, -20, 5, -26); g.stroke();
    g.strokeStyle = '#7a4a26'; g.lineWidth = 2.8; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(1, -20, 5, -26); g.stroke();
    // листик
    const leaf = () => { g.beginPath(); g.moveTo(3, -20); g.bezierCurveTo(8, -32, 20, -30, 24, -25); g.bezierCurveTo(18, -16, 9, -15, 3, -20); g.closePath(); };
    outlined(g, leaf, lin(g, 3, -32, 24, -16, [[0, '#8fdc5c'], [1, '#3d8a35']]), 1.5);
    g.strokeStyle = 'rgba(30,70,30,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, -20); g.quadraticCurveTo(13, -26, 22, -25); g.stroke();
  }

  // ---------------------------------------------------------------- чашка кофе на блюдце
  function cup(g) {
    // блюдце
    outlined(g, () => { g.beginPath(); g.ellipse(0, 15, 29, 7.2, 0, 0, 6.3); }, lin(g, 0, 8, 0, 22, [[0, '#ffffff'], [1, '#c9d2e0']]), 1.7);
    g.fillStyle = 'rgba(80,110,170,0.5)'; g.beginPath(); g.ellipse(0, 15, 24, 4.6, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(0, 14.4, 18.5, 3.2, 0, 0, 6.3); g.fill();
    // ручка
    g.strokeStyle = OUT; g.lineWidth = 6.6; g.beginPath(); g.arc(18.5, 0, 6.6, -1.7, 1.7); g.stroke();
    g.strokeStyle = '#eef2f8'; g.lineWidth = 3.4; g.beginPath(); g.arc(18.5, 0, 6.6, -1.7, 1.7); g.stroke();
    // корпус: чуть сужается книзу
    const body = () => { g.beginPath(); g.moveTo(-19, -11); g.lineTo(19, -11); g.bezierCurveTo(19, 6, 13, 16, 0, 16); g.bezierCurveTo(-13, 16, -19, 6, -19, -11); g.closePath(); };
    outlined(g, body, lin(g, -19, 0, 19, 0, [[0, '#f0f3f8'], [0.35, '#ffffff'], [0.75, '#dfe6ee'], [1, '#b8c4d6']]), 1.9);
    g.save(); body(); g.clip(); g.fillStyle = 'rgba(70,100,170,0.55)'; g.fillRect(-20, -1, 40, 3.4); g.fillStyle = 'rgba(70,100,170,0.3)'; g.fillRect(-20, 4, 40, 1.6); g.restore();     // синяя полоска
    // кофе и обод
    outlined(g, () => { g.beginPath(); g.ellipse(0, -11, 19, 5.4, 0, 0, 6.3); }, '#f6f8fc', 1.6);
    g.fillStyle = rad(g, 0, -11, 1, 14, [[0, '#7a4a26'], [1, '#3d2210']]); g.beginPath(); g.ellipse(0, -10.6, 15.6, 4, 0, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,220,170,0.5)'; g.beginPath(); g.ellipse(-4, -11.4, 5, 1.1, 0, 0, 6.3); g.fill();
    // пар
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2.2;
    for (const x0 of [-5, 5]) { g.beginPath(); g.moveTo(x0, -17); g.bezierCurveTo(x0 - 4, -21, x0 + 4, -24, x0, -28); g.stroke(); }
  }

  // ---------------------------------------------------------------- ягода (черника)
  function berry(g) {
    const body = () => { g.beginPath(); g.arc(0, 1, 16, 0, 6.3); };
    outlined(g, body, rad(g, 0, 1, 1, 18, [[0, '#7b93f0'], [0.55, '#3b52bb'], [1, '#1b2466']], -5, -5), 2);
    g.save(); body(); g.clip();
    g.fillStyle = 'rgba(190,205,255,0.24)'; g.beginPath(); g.ellipse(-3, -4, 13, 10, -0.5, 0, 6.3); g.fill();                        // сизый налёт
    g.restore();
    // «корона» сверху
    g.fillStyle = '#141a4a'; g.beginPath(); g.arc(0, -7.5, 4.4, 0, 6.3); g.fill();
    g.strokeStyle = '#141a4a'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; g.beginPath(); g.moveTo(0, -7.5); g.lineTo(Math.cos(a) * 7.2, -7.5 + Math.sin(a) * 4.8); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.72)'; g.beginPath(); g.ellipse(-7, -3, 2.6, 4.3, 0.5, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-3, 9, 1.4, 0, 6.3); g.fill();
  }

  // ---------------------------------------------------------------- билет на самолёт
  function ticket(g) {
    const W = 68, H = 27, x0 = -W, x1 = W;
    const paper = () => {
      g.beginPath(); g.moveTo(x0 + 4, -H); g.lineTo(-40, -H); g.arc(-40, -H, 3.6, Math.PI, 0, true); g.lineTo(x1 - 4, -H);
      g.quadraticCurveTo(x1, -H, x1, -H + 4); g.lineTo(x1, H - 4); g.quadraticCurveTo(x1, H, x1 - 4, H); g.lineTo(-40 + 3.6, H); g.arc(-40, H, 3.6, 0, Math.PI, true); g.lineTo(x0 + 4, H);
      g.quadraticCurveTo(x0, H, x0, H - 4); g.lineTo(x0, -H + 4); g.quadraticCurveTo(x0, -H, x0 + 4, -H); g.closePath();
    };
    outlined(g, paper, lin(g, 0, -H, 0, H, [[0, '#fffaf0'], [1, '#efe2c4']]), 1.8);
    g.save(); paper(); g.clip();
    // синяя шапка и корешок
    g.fillStyle = '#2b4b8f'; g.fillRect(x0, -H, W * 2, 11);
    g.fillStyle = '#e4b73a'; g.fillRect(x0, -H + 11, W * 2, 1.8);
    g.fillStyle = 'rgba(43,75,143,0.12)'; g.fillRect(x0, -H + 13, -40 - x0, H * 2);
    g.restore();
    // перфорация
    g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1.1; g.setLineDash([2.2, 2.2]); g.beginPath(); g.moveTo(-40, -H + 4); g.lineTo(-40, H - 4); g.stroke(); g.setLineDash([]);
    // надписи
    g.fillStyle = '#fff6e4'; g.font = 'bold 8.6px ' + Ale.FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText('AIR ALE', -35, -H + 5.6); g.textAlign = 'right'; g.fillText('BOARDING PASS', x1 - 6, -H + 5.6);
    g.fillStyle = OUT; g.textAlign = 'left'; g.font = 'bold 15px ' + Ale.FONT;
    const w1 = g.measureText('PARIS').width, w2 = g.measureText('KYIV').width;
    g.fillText('PARIS', -35, -6);
    g.fillText('KYIV', -35 + w1 + 22, -6);
    // самолётик между городами
    g.save(); g.translate(-35 + w1 + 11, -6); g.fillStyle = '#2b4b8f'; g.beginPath(); g.moveTo(-6.5, 0); g.lineTo(2, -1.1); g.lineTo(5, -4.8); g.lineTo(7, -4.8); g.lineTo(5.8, -0.6); g.lineTo(8.6, 0); g.lineTo(5.8, 0.6); g.lineTo(7, 4.8); g.lineTo(5, 4.8); g.lineTo(2, 1.1); g.closePath(); g.fill(); g.restore();
    g.fillStyle = 'rgba(43,26,32,0.8)'; g.font = '600 6.6px ' + Ale.FONT;
    g.fillText('GATE A7', -35, 5); g.fillText('SEAT 12A', -5, 5); g.fillText('18:40', 30, 5);
    // корешок: место крупно
    g.save(); g.translate(-54, 4); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = 'rgba(43,75,143,0.85)'; g.font = 'bold 12px ' + Ale.FONT; g.fillText('SEAT 12A', 0, 0); g.restore();
    // штрихкод во всю ширину основной части
    let bx = -35; for (let i = 0; i < 60; i++) { const bw = 0.7 + ((i * 7 + (i >> 2)) % 3) * 0.55; g.fillStyle = OUT; g.fillRect(bx, 10.5, bw, 13); bx += bw + 0.85; if (bx > x1 - 6) break; }
  }

  // ---------------------------------------------------------------- фишка казино «Монако»
  function chip(g) {
    const R = 26;
    outlined(g, () => { g.beginPath(); g.arc(0, 0, R, 0, 6.3); }, rad(g, 0, 0, 2, R, [[0, '#e04a3c'], [0.7, '#c8322a'], [1, '#8f1d18']], -7, -8), 2);
    // белые метки по ободу
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, 6.3); g.clip();
    for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.fillStyle = '#fff6e4'; g.fillRect(-4.2, -R - 1, 8.4, 9); g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1; g.strokeRect(-4.2, -R - 1, 8.4, 9); g.restore(); }
    g.restore();
    // внутреннее кольцо и золотая корона
    g.strokeStyle = '#fff6e4'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 16.4, 0, 6.3); g.stroke();
    g.fillStyle = 'rgba(80,10,10,0.35)'; g.beginPath(); g.arc(0, 0, 15.6, 0, 6.3); g.fill();
    const crown = () => { g.beginPath(); g.moveTo(-9.5, 5.6); g.lineTo(-10.5, -5); g.lineTo(-5, 0); g.lineTo(0, -8); g.lineTo(5, 0); g.lineTo(10.5, -5); g.lineTo(9.5, 5.6); g.closePath(); };
    outlined(g, crown, lin(g, 0, -8, 0, 6, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']]), 1.2);
    g.fillStyle = '#e4b73a'; g.fillRect(-9.5, 5.6, 19, 2.6); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(-9.5, 5.6, 19, 2.6);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, R - 3, 3.4, 4.5); g.stroke();
  }

  // ---------------------------------------------------------------- конфеты Стрелы (красная овальная коробка; пасхалка в посылке, не предмет игры)
  function candy(g) {
    g.translate(0, -3);
    const rx = 28, ry = 15, dh = 12;
    // стенка коробки: нижняя половина овала между двумя боковыми линиями
    const wall = () => { g.beginPath(); g.moveTo(-rx, 0); g.lineTo(-rx, dh); g.ellipse(0, dh, rx, ry, 0, Math.PI, 0, true); g.lineTo(rx, 0); g.closePath(); };
    outlined(g, wall, lin(g, 0, 0, 0, dh + ry, [[0, '#b01f2c'], [1, '#6e1019']]), 1.9);
    // крышка и кремовый ободок
    outlined(g, () => { g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 6.3); }, rad(g, 0, 0, 2, rx, [[0, '#ec4a52'], [0.65, '#cc2a35'], [1, '#9a1a24']], -8, -6), 1.9);
    g.strokeStyle = '#fff0d8'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, 0, rx - 3.6, ry - 2.4, 0, 0, 6.3); g.stroke();
    // золотая стрела на крышке (рисуется в плоскости крышки, поэтому сплющена по вертикали)
    g.save(); g.rotate(-0.1); g.scale(1, 0.58);
    const arrow = () => { g.beginPath(); g.moveTo(-19, -2.4); g.lineTo(7, -2.4); g.lineTo(7, -8.5); g.lineTo(23, 0); g.lineTo(7, 8.5); g.lineTo(7, 2.4); g.lineTo(-19, 2.4); g.closePath(); };
    outlined(g, arrow, lin(g, 0, -8, 0, 8, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']]), 1.3);
    for (const x of [-19, -13]) outlined(g, () => { g.beginPath(); g.moveTo(x, -2.4); g.lineTo(x - 6, -8); g.lineTo(x - 2.4, -8); g.lineTo(x + 3.6, -2.4); g.closePath(); }, '#f0c85a', 1);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, rx - 1.6, ry - 1.2, 0, 3.55, 4.55); g.stroke();       // блик
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-rx + 3, 2); g.lineTo(-rx + 3, dh - 1); g.stroke();
  }

  // ---------------------------------------------------------------- мел (снаряд)
  // Ось палочки наклонена на +0,77 рад: снаряд рисуется с поворотом «по полёту» + aimOffset −0,64 (teacher.js), и в итоге мел летит почти горизонтально (наклон ≈ 0,13 рад).
  function chalk(g) {
    g.rotate(0.77);
    const stick = () => { g.beginPath(); g.moveTo(-17, -4.6); g.lineTo(14, -4.6); g.quadraticCurveTo(18.5, -4.6, 18.5, 0); g.quadraticCurveTo(18.5, 4.6, 14, 4.6); g.lineTo(-15, 4.6); g.lineTo(-17.6, 2.6); g.lineTo(-16.2, 0.4); g.lineTo(-18, -1.8); g.closePath(); };
    outlined(g, stick, lin(g, 0, -4.6, 0, 4.6, [[0, '#ffffff'], [0.6, '#eef0f2'], [1, '#c4c9d0']]), 1.7);
    g.fillStyle = 'rgba(160,168,180,0.55)'; for (const [x, y, r] of [[-8, 1.2, 0.8], [-1, -1.6, 0.6], [6, 1.6, 0.7], [11, -0.8, 0.5], [-12, -1.4, 0.55]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-13, -2.6); g.lineTo(13, -2.6); g.stroke();
    // меловая пыль вокруг сломанного конца
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (const [x, y, r] of [[-21, -3, 1.3], [-23, 1, 1], [-20, 4, 0.9], [-24, -1, 0.7]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
  }

  // ---------------------------------------------------------------- бумажный комок (снаряд)
  function paper(g) {
    const pts = []; const n = 13; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n; i++) { const a = i / n * 6.283, r = 15 + rnd() * 5.5; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.94]); }
    const ball = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    outlined(g, ball, rad(g, 0, 0, 2, 22, [[0, '#fffdf4'], [0.7, '#f0e6cc'], [1, '#c9bc9c']], -6, -6), 1.8);
    g.save(); ball(); g.clip();
    // грани смятой бумаги
    const facets = [[[-14, -4], [-2, -12], [2, -2]], [[2, -2], [12, -10], [15, 2]], [[-8, 8], [2, -2], [10, 12]], [[-14, -4], [-8, 8], [2, -2]]];
    facets.forEach((f, i) => { g.fillStyle = i % 2 ? 'rgba(120,100,60,0.16)' : 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(f[0][0], f[0][1]); g.lineTo(f[1][0], f[1][1]); g.lineTo(f[2][0], f[2][1]); g.closePath(); g.fill(); });
    g.strokeStyle = 'rgba(80,66,40,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-14, -4); g.lineTo(2, -2); g.lineTo(15, 2); g.moveTo(-2, -12); g.lineTo(2, -2); g.lineTo(-8, 8); g.moveTo(2, -2); g.lineTo(10, 12); g.stroke();
    g.strokeStyle = 'rgba(70,70,120,0.4)'; g.lineWidth = 0.9; for (const y of [-8, -1, 6]) { g.beginPath(); g.moveTo(-9, y); g.lineTo(2, y + 1.4); g.stroke(); }             // строчки текста
    g.restore();
  }

  // ---------------------------------------------------------------- баблти (Киев): стаканчик с широкой трубочкой, молочно-манговый чай и шарики тапиоки на дне
  function bubbleTea(g) {
    g.translate(0, 1);
    const cup = () => { g.beginPath(); g.moveTo(-15, -13); g.lineTo(15, -13); g.lineTo(11.5, 22); g.quadraticCurveTo(0, 25, -11.5, 22); g.closePath(); };
    // трубочка (широкая, под тапиоку), чуть наклонена
    g.save(); g.rotate(0.16);
    outlined(g, () => { g.beginPath(); g.moveTo(-3.2, -30); g.lineTo(3.4, -30); g.lineTo(3.4, 10); g.lineTo(-3.2, 10); g.closePath(); }, lin(g, -3, 0, 4, 0, [[0, '#ff9ec0'], [0.5, '#ff6aa2'], [1, '#d83c80']]), 1.5);
    g.restore();
    outlined(g, cup, lin(g, 0, -13, 0, 24, [[0, '#fff3d0'], [0.3, '#ffd77a'], [1, '#f0a23a']]), 1.9);
    g.save(); cup(); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-20, -13, 40, 7);                                 // молочная пенка
    g.fillStyle = '#4a2a1c'; for (const [x, y] of [[-7, 17], [-2, 18.5], [3.5, 17], [8, 18.5], [-4.5, 13.2], [1, 14], [6, 13.4], [-8.5, 12.6], [-0.5, 9.8], [4, 9.2]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; for (const [x, y] of [[-7.6, 16.2], [-5.2, 12.4], [0.2, 8.9]]) { g.beginPath(); g.arc(x, y, 0.8, 0, 6.3); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(-10, -6); g.lineTo(-8, 15); g.stroke();                 // блик на стенке
    // крышка и куполок
    outlined(g, () => { g.beginPath(); g.ellipse(0, -14, 17.4, 4.4, 0, 0, 6.3); }, lin(g, 0, -18, 0, -10, [[0, '#fffaf0'], [1, '#d9cdb4']]), 1.8);
    outlined(g, () => { g.beginPath(); g.ellipse(0, -14, 8, 2.2, 0, 0, 6.3); }, '#b8a98e', 1.1);
  }

  // ---------------------------------------------------------------- очки Ray-Ban Meta (подарок): тёмная оправа «вайфарер», тёмные линзы, у переносицы камера, без логотипов
  function glasses(g) {
    g.translate(0, 1);
    const lens = (cx) => { g.beginPath(); g.moveTo(cx - 16, -9); g.quadraticCurveTo(cx, -12.5, cx + 17, -9); g.quadraticCurveTo(cx + 18, 4, cx + 9, 11); g.quadraticCurveTo(cx - 3, 13, cx - 14, 8); g.quadraticCurveTo(cx - 19, -1, cx - 16, -9); g.closePath(); };
    // дужки назад (в 3/4 — уходят вверх-влево и вправо)
    g.lineWidth = 6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-33, -8); g.lineTo(-44, -13); g.moveTo(33, -8); g.lineTo(44, -13); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#2f2833'; g.beginPath(); g.moveTo(-33, -8); g.lineTo(-44, -13); g.moveTo(33, -8); g.lineTo(44, -13); g.stroke();
    // мостик
    g.lineWidth = 6; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(0, -12, 14, -6); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#2f2833'; g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(0, -12, 14, -6); g.stroke();
    for (const cx of [-18, 18]) {
      outlined(g, () => lens(cx), lin(g, cx - 12, -10, cx + 12, 12, [[0, '#5b6a84'], [0.45, '#243046'], [1, '#12161f']]), 2.4);
      g.save(); lens(cx); g.clip();
      g.fillStyle = 'rgba(190,225,255,0.22)'; g.beginPath(); g.ellipse(cx - 6, -4, 9, 3.4, -0.5, 0, 6.3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx + 3, -8); g.lineTo(cx + 9, 2); g.stroke();
      g.restore();
      g.lineWidth = 2; g.strokeStyle = '#3d3445'; lens(cx); g.stroke();
    }
    // камера и индикатор у переносицы (в оправе справа)
    g.beginPath(); g.arc(29.2, -7, 2.6, 0, 6.3); g.fillStyle = '#0c0d12'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#8b92a8'; g.stroke();
    g.beginPath(); g.arc(29.2, -7, 1, 0, 6.3); g.fillStyle = '#6fb4ff'; g.fill();
    g.beginPath(); g.arc(-28.6, -7.6, 1.5, 0, 6.3); g.fillStyle = '#ffd24a'; g.fill();
  }

  // ---------------------------------------------------------------- палка колбасы (в дорогу): тёмно-розовая варёная колбаса в сетке, перевязана шпагатом, на концах клипсы
  function sausage(g) {
    g.rotate(-0.42);
    const body = () => { g.beginPath(); g.moveTo(-26, -7.5); g.quadraticCurveTo(0, -10.6, 26, -7.5); g.quadraticCurveTo(31, 0, 26, 7.5); g.quadraticCurveTo(0, 10.6, -26, 7.5); g.quadraticCurveTo(-31, 0, -26, -7.5); g.closePath(); };
    outlined(g, body, lin(g, 0, -10, 0, 10, [[0, '#d88a6e'], [0.35, '#b85a44'], [0.75, '#8e3a2e'], [1, '#6a281f']]), 2);
    g.save(); body(); g.clip();
    // жир и перец — крупинки
    g.fillStyle = 'rgba(255,230,210,0.55)'; for (const [x, y, r] of [[-18, -2, 1.5], [-9, 3, 1.2], [-1, -3.4, 1.4], [8, 2, 1.6], [16, -2.4, 1.2], [21, 3, 1.1], [-14, 4.6, 1.1], [3, 5, 1], [12, -5, 1]]) { g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    g.fillStyle = 'rgba(40,16,14,0.55)'; for (const [x, y] of [[-21, 1], [-5, -1.4], [5, 1.2], [14, 4], [-11, -5.4], [19, -1]]) { g.beginPath(); g.arc(x, y, 0.8, 0, 6.3); g.fill(); }
    // сетка по диагонали
    g.strokeStyle = 'rgba(50,20,14,0.32)'; g.lineWidth = 0.9;
    for (let x = -34; x < 34; x += 6) { g.beginPath(); g.moveTo(x, -11); g.lineTo(x + 9, 11); g.moveTo(x + 9, -11); g.lineTo(x, 11); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(255,240,225,0.7)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-23, -5.2); g.quadraticCurveTo(0, -8.4, 22, -5.4); g.stroke();             // блик
    // шпагат петлёй и бантиком у правого конца
    g.strokeStyle = OUT; g.lineWidth = 4.4; g.beginPath(); g.moveTo(14, -9.6); g.quadraticCurveTo(15.6, 0, 14, 9.6); g.stroke();
    g.strokeStyle = '#e8cf9a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(14, -9.6); g.quadraticCurveTo(15.6, 0, 14, 9.6); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 3.6; g.beginPath(); g.moveTo(14.4, -9.4); g.quadraticCurveTo(10, -16, 6.4, -13); g.moveTo(14.4, -9.4); g.quadraticCurveTo(19, -16.4, 22.6, -12.4); g.stroke();
    g.strokeStyle = '#e8cf9a'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(14.4, -9.4); g.quadraticCurveTo(10, -16, 6.4, -13); g.moveTo(14.4, -9.4); g.quadraticCurveTo(19, -16.4, 22.6, -12.4); g.stroke();
    // клипсы на концах
    for (const x of [-29.5, 29.5]) outlined(g, () => { g.beginPath(); g.rect(x - 2.6, -5, 5.2, 10); }, lin(g, x, -5, x, 5, [[0, '#e8e9f0'], [1, '#9a9cb0']]), 1.4);
  }


  // ---------------------------------------------------------------- пачка выигрыша (Монако): перетянутая бумажной лентой стопка банкнот, сверху две лежат веером
  function cash(g) {
    g.rotate(-0.12);
    const note = (x, y, r, tint) => {
      g.save(); g.translate(x, y); g.rotate(r);
      outlined(g, () => { g.beginPath(); g.rect(-24, -11, 48, 22); }, lin(g, 0, -11, 0, 11, [[0, tint[0]], [1, tint[1]]]), 1.7);
      g.strokeStyle = 'rgba(30,80,50,0.55)'; g.lineWidth = 1; g.strokeRect(-20, -7.6, 40, 15.2);
      g.beginPath(); g.arc(0, 0, 5.4, 0, 6.3); g.stroke();
      g.fillStyle = 'rgba(30,80,50,0.6)'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', 0, 0.6);
      g.restore();
    };
    for (const k of [3, 2, 1]) outlined(g, () => { g.beginPath(); g.rect(-24, -5 + k * 3.4, 48, 22); }, lin(g, 0, 0, 0, 24, [[0, '#9ccf9a'], [1, '#6fa77a']]), 1.6);
    note(-4, -6, -0.16, ['#d7efc4', '#a5d490']); note(5, -9, 0.1, ['#e4f4d0', '#b5dc9e']);
    // бумажная лента-обвязка
    outlined(g, () => { g.beginPath(); g.rect(-8, -16, 16, 40); }, lin(g, -8, 0, 8, 0, [[0, '#f3d27a'], [1, '#d4a640']]), 1.5);
    g.fillStyle = 'rgba(120,70,20,0.7)'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('€', 0, 4);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-20, -2); g.lineTo(-11, -2.4); g.stroke();
  }

  // ---------------------------------------------------------------- пульт (в комнате-сюрпризе): чёрный пластик, красная кнопка, три маленьких и ряд точек
  function remote(g) {
    g.rotate(-0.55);
    const body = () => { g.beginPath(); g.moveTo(-9, -26); g.lineTo(9, -26); g.quadraticCurveTo(12, -26, 12, -22); g.lineTo(12, 22); g.quadraticCurveTo(12, 26, 8, 26); g.lineTo(-8, 26); g.quadraticCurveTo(-12, 26, -12, 22); g.lineTo(-12, -22); g.quadraticCurveTo(-12, -26, -9, -26); g.closePath(); };
    outlined(g, body, lin(g, -12, 0, 12, 0, [[0, '#4a4658'], [0.5, '#2c2935'], [1, '#1c1a24']]), 2);
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-9.6, -22); g.lineTo(-9.6, 18); g.stroke();
    outlined(g, () => { g.beginPath(); g.arc(0, -14, 5.2, 0, 6.3); }, rad(g, 0, -14, 0.5, 6, [[0, '#ff8a7a'], [1, '#c0281e']], -1.5, -15.5), 1.4);
    for (const [x, y] of [[-5.4, -2], [0, -2], [5.4, -2]]) outlined(g, () => { g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); }, '#9aa3c4', 1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { g.fillStyle = '#6c6f8a'; g.beginPath(); g.arc(-5 + c * 5, 7 + r * 5.6, 1.6, 0, 6.3); g.fill(); }
  }


  // ---------------------------------------------------------------- телефон Алеси (в руке во время звонка): тёмный корпус, светлый экран с зелёной трубкой, камера
  function phone(g) {
    g.rotate(-0.25);
    const body = () => { g.beginPath(); g.moveTo(-11, -22); g.lineTo(11, -22); g.quadraticCurveTo(15, -22, 15, -18); g.lineTo(15, 18); g.quadraticCurveTo(15, 22, 11, 22); g.lineTo(-11, 22); g.quadraticCurveTo(-15, 22, -15, 18); g.lineTo(-15, -18); g.quadraticCurveTo(-15, -22, -11, -22); g.closePath(); };
    outlined(g, body, lin(g, -15, 0, 15, 0, [[0, '#4a4658'], [0.5, '#2c2935'], [1, '#1c1a24']]), 2);
    outlined(g, () => { g.beginPath(); g.moveTo(-10, -17); g.lineTo(10, -17); g.lineTo(10, 15); g.lineTo(-10, 15); g.closePath(); }, lin(g, 0, -17, 0, 15, [[0, '#d6ecff'], [1, '#9fc8ee']]), 1.2);
    g.fillStyle = '#3aa86a'; g.beginPath(); g.arc(0, -2, 6.4, 0, 6.3); g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-3, -1); g.quadraticCurveTo(-1.5, 3, 2.5, -4.5); g.stroke();
    g.fillStyle = '#0c0d12'; g.beginPath(); g.arc(0, -19.4, 1.2, 0, 6.3); g.fill();
  }

  Ale.Items = {
    RES,
    build() {
      paint('it_key', 58, 58, key);
      paint('it_apple', 62, 66, apple);
      paint('it_cup', 74, 62, cup);
      paint('it_berry', 42, 42, berry);
      paint('it_ticket', 148, 62, ticket);
      paint('it_chip', 62, 62, chip);
      paint('it_candy', 64, 54, candy);
      paint('it_tea', 52, 66, bubbleTea);
      paint('it_glasses', 100, 40, glasses);
      paint('it_sausage', 84, 48, sausage);
      // холсты пачки денег, пульта и телефона были тесны (рисунок упирался в край и обрезался: у пачки низ срезан плоско, у пульта и телефона — бока): 11.10.2026 увеличены, центр рисунка и размер содержимого прежние
      paint('it_cash', 68, 66, cash);
      paint('it_remote', 56, 64, remote);
      paint('it_phone', 46, 58, phone);
      paint('pr_chalk', 52, 44, chalk);
      paint('pr_paper', 46, 46, paper);
    },
  };
})();
