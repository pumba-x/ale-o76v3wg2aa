// Оформление скачки по Парижу: по маршруту меняются улица, набережная Сены, мост Александра III, Елисейские поля с аркой и дорога
// к аэропорту. Фон — параллакс из списков спрайтов (дом, лавка, фонарь, дерево…): каждый спрайт создаётся один раз и рисуется на своём месте.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, K = Ale.Paris, SA = Ale.StreetArt, OUT = A.OUT;

  // ---------------------------------------------------------------- «Фон из спрайтов»
  class Backdrop {
    constructor(layers) { this.layers = layers; for (const l of layers) l.items.sort((a, b) => a.x - b.x); }
    draw(ctx, camX, viewW) {
      for (const ly of this.layers) {
        if (ly.before) ly.before(ctx, camX, viewW);          // подложка слоя (например, дымка земли под дальними домами), рисуется до его спрайтов
        const off = camX * ly.f, its = ly.items;
        // бинарный поиск первого видимого
        let lo = 0, hi = its.length;
        const left = off - 700;
        while (lo < hi) { const m = (lo + hi) >> 1; if (its[m].x < left) lo = m + 1; else hi = m; }
        for (let i = lo; i < its.length; i++) {
          const it = its[i], sx = it.x - off;
          if (sx > viewW + 40) break;
          if (sx + it.L.w < -40) continue;
          ctx.drawImage(it.L.c, sx, ly.y - it.L.h + (it.dy || 0), it.L.w, it.L.h);
        }
      }
    }
  }

  // Дымка земли под дальним планом. Основания дальних домов стоят на 520, а мостовая начинается с 596: между ними на всём маршруте, где среднего плана нет (дорога к аэропорту, просветы на авеню), было
  // небо, и дома висели над бледной полосой с резким нижним краем (находка обхода всех сцен, 18.10.2026). Полоса плавно проступает из цвета дымки дальних домов к тёплому камню земли: нижние этажи дальних
  // домов тонут в ней, как в воздухе над дальней улицей. Река и стенка набережной рисуются позже и закрывают её.
  const HAZE_TOP = 466, HAZE_BOTTOM = 598;
  function groundHaze(ctx, camX, viewW) {
    const g = ctx.createLinearGradient(0, HAZE_TOP, 0, HAZE_BOTTOM);
    g.addColorStop(0, 'rgba(244,226,214,0)'); g.addColorStop(0.42, 'rgba(240,222,206,0.93)'); g.addColorStop(1, 'rgb(222,206,184)');
    ctx.fillStyle = g; ctx.fillRect(0, HAZE_TOP, viewW, HAZE_BOTTOM - HAZE_TOP);
  }

  // Причал-парапет и зелёные ящики букинистов.
  function bouquiniste(w) {
    return A.layer(w, 96, (g) => {
      A.box(g, 2, 26, w - 4, 62, { fill: '#2f5a3f', lw: 3.6, hi: 'rgba(255,255,255,0.16)' });
      A.wood(g, 4, 28, w - 8, 58, { base: '#2f5a3f', seed: w, dir: 'v', knots: false, grain: 0.16 });
      A.box(g, -2, 20, w + 4, 12, { fill: '#3f7a54', lw: 3.4, r: 3 });
      // открытая крышка и книги
      g.fillStyle = '#e6d3a8'; g.fillRect(8, 30, w - 16, 26); g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(8, 30, w - 16, 26);
      const c = ['#7a2e3b', '#2f6f73', '#d9a441', '#3d5a80', '#c8593a', '#5a7a4a'], R = A.rng(w);
      let bx = 12; while (bx < w - 16) { const bw = R.range(6, 11), bh = R.range(14, 24); g.fillStyle = c[Math.floor(R.next() * 6)]; g.fillRect(bx, 56 - bh, bw, bh); g.strokeStyle = OUT; g.lineWidth = 1.4; g.strokeRect(bx, 56 - bh, bw, bh); bx += bw + 1; }
      g.fillStyle = '#e8b34a'; g.fillRect(w * 0.6, 66, w * 0.3, 14); g.strokeRect(w * 0.6, 66, w * 0.3, 14);
    }, 1.5);
  }

  // Кованая ограда набережной с каменными столбиками.
  function fence(w) {
    return A.layer(w, 90, (g) => {
      g.strokeStyle = K.IRON; g.lineCap = 'round';
      g.lineWidth = 3; g.beginPath(); g.moveTo(0, 22); g.lineTo(w, 22); g.moveTo(0, 74); g.lineTo(w, 74); g.stroke();
      g.lineWidth = 2; for (let x = 8; x < w; x += 12) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 74); g.stroke(); g.fillStyle = K.IRON; g.beginPath(); g.moveTo(x - 3, 22); g.lineTo(x, 14); g.lineTo(x + 3, 22); g.fill(); }
      for (let x = 20; x < w - 10; x += 36) { g.beginPath(); g.arc(x, 48, 6, 0, 6.3); g.stroke(); }
      for (const px of [4, w - 10]) { A.box(g, px - 4, 10, 16, 80, { fill: '#d9ccb0', lw: 3, hi: 'rgba(255,255,255,0.3)' }); }
    }, 1.5);
  }

  // Мост Александра III: золочёные фонари, арки над рекой (дальний план).
  function bridge(w) {
    return A.layer(w, 150, (g) => {
      // настил и арки
      A.box(g, 0, 40, w, 24, { fill: '#e6d8b4', lw: 3.4, hi: 'rgba(255,255,255,0.35)' });
      for (let x = 30; x < w - 60; x += 110) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 100); g.arc(x + 45, 100, 45, Math.PI, 0); g.lineTo(x + 90, 150); g.closePath(); g.fillStyle = 'rgba(140,170,200,0.8)'; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); }
      A.box(g, 0, 64, w, 24, { fill: '#d6c8a4', lw: 3.4 });
      // золотые фонари
      for (let x = 40; x < w - 30; x += 110) {
        g.strokeStyle = '#c9982f'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 40); g.lineTo(x, -10); g.stroke();
        A.glow(g, x, -10, 30, 'rgba(255,224,150,', 0.6); g.fillStyle = '#ffd56a'; g.beginPath(); g.arc(x, -10, 8, 0, 6.3); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      }
    }, 1);
  }

  // Стеклянный купол Гран-Пале (дальний силуэт).
  function grandPalais(o) {
    o = o || {};
    return A.layer(360, 170, (g) => {
      const c = o.color || '#b6c2d4';
      g.fillStyle = c; g.fillRect(20, 96, 320, 74);
      g.beginPath(); g.moveTo(70, 96); g.quadraticCurveTo(180, -20, 290, 96); g.closePath(); g.fillStyle = A.linG(g, 0, 10, 0, 96, [[0, '#dce8f0'], [1, c]]); g.fill();
      g.strokeStyle = 'rgba(80,100,130,0.6)'; g.lineWidth = 1.6; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(70 + i * 27, 96); g.quadraticCurveTo(180 + (i - 4) * 10, 10, 180 + (i - 4) * 16, 24); g.stroke(); }
      g.fillStyle = 'rgba(90,110,140,0.5)'; for (let x = 30; x < 330; x += 22) g.fillRect(x, 110, 12, 40);
      Ale.Paris.hazeFill(g, 360, 170, o.haze || 0.35, o.hazeColor);
    }, 1);
  }

  // Указатель на шоссе «Аэропорт».
  function highwaySign(w) {
    return A.layer(w, 150, (g) => {
      for (const px of [22, w - 22]) A.box(g, px - 6, 40, 12, 110, { fill: '#8a8f9c', lw: 3 });
      A.box(g, 0, 0, w, 84, { fill: '#2f6f9a', lw: 4, r: 6, hi: 'rgba(255,255,255,0.2)' });
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, 72);
      A.text(g, 'AÉROPORT', w / 2, 32, 27, '#fff'); A.text(g, 'CHARLES DE GAULLE →', w / 2, 62, 16, '#e9f4ff');
      // самолётик
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(w - 44, 26); g.lineTo(w - 18, 30); g.lineTo(w - 44, 34); g.closePath(); g.fill(); g.fillRect(w - 34, 22, 6, 16);
    }, 1.5);
  }

  // Здание аэровокзала: то же, что стоит на площади в аэропорту (Ale.AirportArt.terminalFacade), только с нарисованным входом.
  function terminal(w, h) {
    return A.layer(w, h, (g) => Ale.AirportArt.terminalFacade(g, w, h, { door: true }), 1.5);
  }

  // Каменная балюстрада (мост, набережная), ограждение шоссе.
  function balustrade(w) {
    return A.layer(w, 74, (g) => {
      A.box(g, -2, 6, w + 4, 12, { fill: '#e6d8b8', lw: 3.4, r: 3, hi: 'rgba(255,255,255,0.4)' });
      for (let x = 10; x < w - 10; x += 20) { g.beginPath(); g.moveTo(x - 6, 18); g.quadraticCurveTo(x + 6, 30, x - 4, 44); g.quadraticCurveTo(x + 4, 52, x - 6, 62); g.lineTo(x + 8, 62); g.quadraticCurveTo(x + 14, 52, x + 6, 44); g.quadraticCurveTo(x + 16, 30, x + 8, 18); g.closePath(); g.fillStyle = A.linG(g, x - 6, 0, x + 12, 0, [[0, '#d6c9a8'], [0.5, '#f0e6cc'], [1, '#cdbf9c']]); g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); }
      A.box(g, -2, 60, w + 4, 12, { fill: '#e0d2b0', lw: 3.4, r: 3 });
      for (const px of [4, w - 4]) A.box(g, px - 9, 0, 18, 72, { fill: '#e6d8b8', lw: 3.2, hi: 'rgba(255,255,255,0.3)' });
    }, 1.5);
  }

  function guardrail(w) {
    return A.layer(w, 60, (g) => {
      for (let x = 12; x < w; x += 70) A.box(g, x - 4, 20, 8, 40, { fill: '#7c8492', lw: 3 });
      for (const y of [20, 36]) { g.fillStyle = A.linG(g, 0, y, 0, y + 12, [[0, '#dfe6ee'], [1, '#98a2b2']]); g.fillRect(0, y, w, 12); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(0, y, w, 12); }
    }, 1.5);
  }

  // ---------------------------------------------------------------- набор спрайтов и раскладка вдоль маршрута
  // Возвращает { back, near: Backdrop, sections, river: [[x0, x1]] }. Контент раскладывается последовательно по участкам без наложений.
  function build(LEN) {
    const R = A.rng(77);
    const far = [], mid = [], near = [], lamps = [];                                // lamps — фонари рисуются отдельным проходом поверх всей обочины: в общем списке по x следующая секция балюстрады закрывала основание фонаря
    const houses = [];
    for (let i = 0; i < 9; i++) houses.push(K.building({ w: [230, 260, 300, 340][i % 4], floors: [3, 4, 5, 4][i % 4], seed: 500 + i, haze: 0.16, lit: 0.06, scale: 1.0 }));
    const lowHouses = [];
    for (let i = 0; i < 5; i++) lowHouses.push(K.building({ w: [200, 240, 280][i % 3], floors: [2, 3, 3][i % 3], seed: 600 + i, haze: 0.3, hazeColor: '244,226,214', lit: 0.05, scale: 1.0 }));
    const hazyHouses = [];
    for (let i = 0; i < 5; i++) hazyHouses.push(K.building({ w: [180, 220, 250][i % 3], floors: [2, 3, 4][i % 3], seed: 700 + i, haze: 0.68, hazeColor: '244,226,214', lit: 0, scale: 0.7 }));
    const shops = [
      K.shop({ w: 250, name: 'BOULANGERIE', paint: '#8a4b2a', goods: 'bread', door: 'right', size: 21, seed: 21 }), K.shop({ w: 230, name: 'FLEURS', paint: '#7a3a5a', goods: 'flowers', size: 28, seed: 22 }),
      K.shop({ w: 290, name: 'CAFÉ', paint: '#2f6f73', goods: 'cafe', door: 'right', size: 32, seed: 23 }), K.shop({ w: 250, name: 'LIBRAIRIE', paint: '#3d5a80', goods: 'books', size: 22, seed: 24 }),
      K.shop({ w: 260, name: 'CHAPEAUX', paint: '#7a2e3b', goods: 'hats', size: 25, seed: 25 }), K.shop({ w: 280, name: 'BRASSERIE', paint: '#2b3a3a', goods: 'bottles', door: 'left', size: 27, seed: 26 }),
    ];
    const lamp = K.lamp(330), goldLamp = K.lamp(320, { dark: '#8a6a22', mid: '#c9982f', hi: '#f0d27a' }), techLamp = K.lamp(300, { dark: '#4a505c', mid: '#7c8492', hi: '#b8c0cc' });
    const morris = K.morris(190), trees = [K.tree(0.95, 3), K.tree(0.85, 8), K.tree(1.0, 12)];
    const boxes = [bouquiniste(150), bouquiniste(190), bouquiniste(170)], fences = [fence(220), fence(300)], bal = [balustrade(260), balustrade(340)], rail = [guardrail(280), guardrail(360)];
    const tower = K.tower(560, { haze: 0.26, color: '#8b7fa0', line: '#6e6488', hi: '#a89bc0', hazeColor: '244,226,220' });
    const arcNear = K.arc({ haze: 0.06, scale: 1.0 });
    const nd = K.notreDame({ haze: 0.35, color: '#bfb6c9', dark: '#a097b3' }), palais = grandPalais({ haze: 0.3, hazeColor: '244,226,220' });
    const sign = highwaySign(320), term = terminal(940, 346), cafe = Ale.StreetArt.cafeTable(), bench = Ale.StreetArt.bench();

    // участки маршрута (доли пути)
    const SEC = [['street', 0, 0.2], ['quay', 0.2, 0.42], ['bridge', 0.42, 0.56], ['avenue', 0.56, 0.86], ['highway', 0.86, 1]];
    const MF = 0.45, FF = 0.12;
    // «центр экрана» при положении всадницы xw: у среднего слоя x = (xw - 380) * f + 640
    const midX = (xw) => (xw - 380) * MF + 640, farX = (xw) => (xw - 380) * FF + 640;

    // дальний план: дымчатые крыши повсюду; башня, Нотр-Дам, Гран-Пале и арка — ориентирами
    for (let x = -200; x < farX(LEN) + 1400; x += R.range(180, 260)) far.push({ L: R.pick(hazyHouses), x, dy: R.range(-4, 4) });
    far.push({ L: nd, x: farX(0.34 * LEN), dy: 6 }, { L: palais, x: farX(0.5 * LEN), dy: 8 });      // арка стоит на среднем плане (см. ниже), дальней копии нет
    // Между дальними домами оставались просветы до 80 юнитов (шаг 180…260 при ширине корпуса 180…250): в них видно небо — бледно-голубые «швы» от крыши до земли (18.10.2026). Просветы закрываются
    // такими же дымчатыми домами; генератор отдельный, чтобы последовательность случайных чисел среднего и ближнего планов (а значит, и вся расстановка маршрута) не менялась.
    const RF = A.rng(4242), farHouses = far.filter((it) => hazyHouses.includes(it.L)).sort((p, q) => p.x - q.x);
    for (let i = 0; i + 1 < farHouses.length; i++) {
      const gapA = farHouses[i].x + farHouses[i].L.bodyW, gapB = farHouses[i + 1].x;
      if (gapB - gapA > 3) far.push({ L: hazyHouses[Math.floor(RF.next() * hazyHouses.length)], x: gapA - 24, dy: farHouses[i].dy });
    }
    // башня — на среднем плане, за домами набережной; в домах оставлен просвет, чтобы она была видна целиком (Бубел показывает на неё около 0.28–0.3 пути)
    const towerX = midX(0.3 * LEN) + 30, gapL = towerX + tower.w / 2 - 190, gapR = towerX + tower.w / 2 + 190;
    // арка стоит на своём просвете: дома среднего плана её не закрывают
    const arcX = midX(0.85 * LEN) + 200, arcL = arcX - 50, arcR = arcX + arcNear.w + 50;

    // средний план: последовательно по участкам
    let cur = midX(0) - 700;
    for (const [sec, a, b] of SEC) {
      const end = sec === 'highway' ? midX(LEN) + 1500 : midX(b * LEN);
      if (sec === 'bridge') {
        // мост: за ним видны низкие дома дальнего берега и стеклянный купол
        while (cur < end) { const L = R.pick(lowHouses); mid.push({ L, x: cur, dy: 96 }); cur += L.bodyW + R.range(20, 80); }
        mid.push({ L: palais, x: midX(a * LEN + (b - a) * LEN * 0.55), dy: 20 });
      } else if (sec === 'quay') {
        while (cur < end) { const L = R.pick(lowHouses); if (cur + L.bodyW > gapL && cur < gapR) { cur = gapR; continue; } mid.push({ L, x: cur, dy: 78 }); cur += L.bodyW + R.range(10, 60); }
      } else if (sec === 'highway') {
        while (cur < end) { if (cur + 200 > arcL && cur < arcR) { cur = arcR; continue; } if (R.chance(0.35)) { const L = R.pick(houses); if (cur + L.bodyW > arcL && cur < arcR) { cur = arcR; continue; } mid.push({ L, x: cur }); cur += L.bodyW + R.range(0, 12); } else cur += R.range(240, 420); }
      } else {
        while (cur < end) { if (sec === 'avenue' && R.chance(0.14)) { cur += R.range(160, 260); continue; } const L = R.pick(houses); if (cur + L.bodyW > arcL && cur < arcR) { cur = arcR; continue; } mid.push({ L, x: cur }); cur += L.bodyW + R.range(0, 10); }
      }
    }
    mid.push({ L: arcNear, x: arcX, dy: 40 });
    mid.push({ L: term, x: midX(0.97 * LEN) - 360, dy: 30 });

    // обочина: последовательно по участкам (в мировых координатах)
    let nx = 0;
    for (const [sec, a, b] of SEC) {
      const end = b * LEN, x0 = Math.max(nx, a * LEN);
      let x = x0, si = 0;
      if (sec === 'street') { while (x < end) { near.push({ L: shops[si++ % shops.length], x, dy: 0 }); x += R.range(420, 540); } for (let lx = 300; lx < end; lx += R.range(560, 720)) lamps.push({ L: lamp, x: lx, dy: 10 }); for (let mx = 900; mx < end; mx += R.range(1000, 1400)) near.push({ L: morris, x: mx, dy: 8 }); }
      if (sec === 'quay') { while (x < end) { near.push({ L: R.pick(boxes), x, dy: 0 }); x += R.range(250, 330); } for (let fx = x0 + 140; fx < end; fx += R.range(380, 520)) near.push({ L: R.pick(fences), x: fx, dy: 0 }); for (let lx = x0 + 240; lx < end; lx += R.range(600, 760)) lamps.push({ L: lamp, x: lx, dy: 10 }); }
      if (sec === 'bridge') { while (x < end) { near.push({ L: R.pick(bal), x, dy: 0 }); x += R.range(300, 340); } for (let lx = x0 + 80; lx < end; lx += 360) lamps.push({ L: goldLamp, x: lx, dy: 10 }); }
      if (sec === 'avenue') { while (x < end) { near.push({ L: R.pick(trees), x, dy: 12 }); x += R.range(300, 400); } for (let cx = x0 + 200; cx < end; cx += R.range(700, 900)) { near.push({ L: cafe, x: cx, dy: 6 }); } for (let bx = x0 + 500; bx < end; bx += R.range(900, 1300)) near.push({ L: bench, x: bx, dy: 4 }); for (let lx = x0 + 260; lx < end; lx += R.range(560, 700)) lamps.push({ L: lamp, x: lx, dy: 10 }); }
      if (sec === 'highway') { while (x < end - 400) { near.push({ L: R.pick(rail), x, dy: 0 }); x += R.range(300, 380); } for (let lx = x0 + 100; lx < end - 500; lx += R.range(620, 760)) lamps.push({ L: techLamp, x: lx, dy: 10 }); near.push({ L: sign, x: x0 + 500, dy: 0 }); }
      nx = end;
    }

    return {
      back: new Backdrop([{ f: FF, y: 520, items: far }, { f: MF, y: 596, before: groundHaze, items: [{ L: tower, x: towerX, dy: 0 }] }, { f: MF, y: 590, items: mid }]),
      near: new Backdrop([{ f: 1, y: 598, items: near }, { f: 1, y: 598, items: lamps }]),
      sections: SEC.reduce((o, [n, a, b]) => { o[n] = [a, b]; return o; }, {}),
      river: [[0.2 * LEN, 0.56 * LEN]],
    };
  }

  Ale.RideArt = { Backdrop, build, bouquiniste, fence, bridge, grandPalais, highwaySign, terminal, balustrade, guardrail };
})();
