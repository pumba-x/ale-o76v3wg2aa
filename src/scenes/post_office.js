// Почта. Одна комната, пять моментов истории (entry): start, return, hatch (после кражи), parcel (шкаф), exit (посылка открыта).
// Всё в комнате стоит на своих местах с самого начала: шкаф с посылкой за стеклом, люк в полу, служебный выход. Сюжет меняет только состояния.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, PA = Ale.PostArt, P = PA.P, OUT = A.OUT;
  const FY = 600, WALL = 584, WIDTH = 3000;   // FY — «дорожка» героев, WALL — где мебель у стены касается пола

  const X = {
    door: 190, bench: 400, window1: 640, bags: 900, poster: 1000, poster2: 1130, clock: 1235,
    counter: 1330, counterW: 520, clerk: 1590, crate: 1385,
    start: 480,        // где герои стоят в начале (вход и возвращение с ключом): правее левой группы экранных кнопок (≈ до 375 юн.), иначе Бубел и ноги героини в первые секунды под ними (13.10.2026)
    mail: 1908, mouse: 2050, window2: 2300, cabinet: 2526, hatch: 2730, backDoor: 2915,      // доска ячеек и шкаф — по 26 юн. от окна 2: раньше доска налезала на его левую штору, а шкаф стоял вплотную к правой (14.10.2026)
  };
  Ale.POST = X;

  // ---------------------------------------------------------------- отдельные предметы
  function makeBags() {
    return A.layer(128, 112, (g) => {
      const sack = (cx, cy, w, h, rot, col) => {
        g.save(); g.translate(cx, cy); g.rotate(rot);
        g.beginPath(); g.moveTo(-w / 2, h / 2); g.quadraticCurveTo(-w * 0.62, 0, -w * 0.36, -h / 2 + 10);
        g.lineTo(-w * 0.12, -h / 2); g.lineTo(w * 0.12, -h / 2); g.lineTo(w * 0.36, -h / 2 + 10); g.quadraticCurveTo(w * 0.62, 0, w / 2, h / 2); g.closePath();
        g.fillStyle = col; g.fill(); g.lineWidth = 3.5; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
        g.save(); g.clip(); A.grain(g, -w, -h, w * 2, h * 2, 0.32, 'overlay', 23, 0.7); g.restore();
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(-w * 0.18, -h * 0.05, w * 0.12, h * 0.3, 0.2, 0, 6.3); g.fill();
        g.strokeStyle = 'rgba(43,26,32,0.5)'; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(-w * 0.3, -h / 2 + 18); g.lineTo(w * 0.3, -h / 2 + 18); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#7a2e3b'; g.fillRect(-w * 0.14, -h / 2 + 1, w * 0.28, 8); g.lineWidth = 2.5; g.strokeRect(-w * 0.14, -h / 2 + 1, w * 0.28, 8);
        g.fillStyle = '#fff6e4'; g.font = 'bold 12px ' + Ale.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('POSTE', 0, h * 0.18);
        g.restore();
      };
      sack(64, 76, 116, 68, 0, '#c9a06a');
      sack(46, 32, 88, 52, -0.06, '#b98b58');
      sack(86, 30, 78, 48, 0.08, '#d1aa74');
    });
  }

  function makeBench() {
    return A.layer(206, 120, (g) => {
      // спинка
      for (let i = 0; i < 3; i++) { A.box(g, 6, 8 + i * 22, 194, 18, { fill: '#a06a44', lw: 3, r: 3, hi: 'rgba(255,255,255,0.22)', lo: 'rgba(0,0,0,0.18)' }); A.wood(g, 8, 10 + i * 22, 190, 14, { base: '#a06a44', seed: 60 + i, knots: false, grain: 0.14 }); }
      A.box(g, 6, 4, 10, 74, { fill: '#7a4e33', lw: 3 }); A.box(g, 190, 4, 10, 74, { fill: '#7a4e33', lw: 3 });
      // сиденье и ножки
      A.box(g, 0, 78, 206, 16, { fill: '#b47a4f', lw: 3.5, r: 3, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.2)' });
      A.wood(g, 2, 80, 202, 12, { base: '#b47a4f', seed: 66, knots: false, grain: 0.14 });
      A.box(g, 16, 94, 14, 26, { fill: '#5f3b28', lw: 3 }); A.box(g, 176, 94, 14, 26, { fill: '#5f3b28', lw: 3 });
    });
  }

  function makeCounter() {
    return A.layer(560, 100, (g, w, h) => {
      // стойка: плита сверху выступает, ниже — панели
      g.save(); g.translate(10, 12); PA.counterFront(g, 540, h - 12); g.restore();
      A.box(g, 0, 0, 560, 14, { fill: '#c8925c', lw: 3.5, r: 3, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.18)' });
      A.wood(g, 2, 2, 556, 10, { base: '#c8925c', seed: 71, knots: false, grain: 0.12 });
      // медная окантовка снизу
      g.fillStyle = P.brass; g.fillRect(10, h - 8, 540, 5); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(10, h - 8, 540, 5);
    });
  }

  // окошко кассы: рама вокруг бюста, латунная решётка, табличка
  function drawWindow(ctx, cx, top) {
    const w = 210, x = cx - w / 2, h = 112;
    // «нависающая» часть над окошком
    A.box(ctx, x - 14, top - 46, w + 28, 38, { fill: '#6a422c', lw: 4, r: 5, hi: 'rgba(255,255,255,0.18)' });
    A.box(ctx, x + 4, top - 40, w - 8, 26, { fill: P.brass, lw: 3, r: 4, hi: 'rgba(255,255,255,0.4)' });
    A.text(ctx, 'GUICHET 1 · COLIS', cx, top - 26, 17, '#4a2f14');
    // стойки рамы
    A.box(ctx, x - 14, top - 8, 20, h + 8, { fill: '#6a422c', lw: 4 });
    A.box(ctx, x + w - 6, top - 8, 20, h + 8, { fill: '#6a422c', lw: 4 });
    // латунная решётка
    ctx.strokeStyle = P.brass; ctx.lineWidth = 3.4;
    for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * ((w - 12) / 9), top - 4); ctx.lineTo(x + 6 + i * ((w - 12) / 9), top + h - 6); ctx.stroke(); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * ((w - 12) / 9) + 2, top - 4); ctx.lineTo(x + 6 + i * ((w - 12) / 9) + 2, top + h - 6); ctx.stroke(); }
    // подоконник окошка (полка)
    A.box(ctx, x - 18, top + h - 8, w + 36, 10, { fill: '#c8925c', lw: 3, hi: 'rgba(255,255,255,0.35)' });
  }

  // ---------------------------------------------------------------- сцена
  Ale.Scenes.postOffice = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'postOffice', width: WIDTH, music: 'paris', place: entry === 'start' ? Ale.T.place.post : null });
    const W = sc.world;
    const room = A.layer(WIDTH, 720, (g, w, h) => PA.drawRoom(g, w, h, X), 1.5);

    // ---- геометрия
    W.addSolid(-400, FY, 400 + X.hatch - 66, 400, { kind: 'floor' });                // до люка (люк — отдельный блок)
    W.addSolid(X.hatch + 66, FY, WIDTH + 400 - (X.hatch + 66), 400, { kind: 'floor' });   // за люком
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addSolid(X.bags - 60, FY - 100, 120, 100, { kind: 'bags' });
    W.addOneWay(X.bench - 100, WALL - 42, 200, 14, { kind: 'bench' });                        // верх платформы — на сиденье скамьи (мир y 542): раньше на 10 юн. выше, и героиня «висела» на фоне спинки

    sc.back.push((ctx, cam) => {
      ctx.fillStyle = '#e6cd9f'; ctx.fillRect(0, 0, game.viewW, game.viewH);
      A.blitView(ctx, room, -cam.x, -cam.y, game.viewW);
    });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.38));
    // пылинки в лучах окон: медленно кружат (косметика)
    sc.front.push((ctx, cam) => {
      const t = sc.time;
      for (const wx of [X.window1, X.window2]) {
        for (let i = 0; i < 9; i++) {
          const ph = i * 1.9 + wx;
          const px = wx + 20 + ((i * 47 + Math.sin(t * 0.3 + ph) * 26 + t * 4) % 140), py = 240 + ((i * 61 + Math.cos(t * 0.25 + ph) * 22 + t * 6) % 300);
          const sx = px - cam.x, sy = py - cam.y;
          if (sx < -10 || sx > game.viewW + 10) continue;
          ctx.fillStyle = 'rgba(255,244,210,' + (0.22 + 0.2 * Math.sin(t * 1.4 + ph)).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, 6.283); ctx.fill();
        }
      }
    });

    // ---- декор с глубиной
    const bags = makeBags(), bench = makeBench(), counter = makeCounter();
    sc.add(new Ale.Decor({ x: X.bench, y: WALL, z: 22, draw: (ctx) => { A.shadow(ctx, X.bench, WALL, 112, 0.28); A.blit(ctx, bench, X.bench - 103, WALL - 120); } }));
    sc.add(new Ale.Decor({ x: X.bags, y: FY, z: 28, draw: (ctx) => { A.shadow(ctx, X.bags, FY, 76, 0.3); A.blit(ctx, bags, X.bags - 64, FY - 112); } }));
    sc.add(new Ale.Decor({ x: X.counter, y: WALL, z: 30, draw: (ctx) => { A.shadow(ctx, X.counter + X.counterW / 2, WALL, 320, 0.3); A.blit(ctx, counter, X.counter - 10, WALL - 100); } }));
    sc.add(new Ale.Decor({ x: X.clerk, y: WALL, z: 32, draw: (ctx) => drawWindow(ctx, X.clerk, WALL - 100 - 112 + 4) }));

    // ---- персонажи и предметы
    const clerk = sc.add(new Ale.Clerk({ x: X.clerk, y: FY, counterTop: WALL - 100, facing: -1 }));
    const basket = sc.add(new Ale.TomatoBox({ x: X.crate, y: WALL - 100, z: 31, onTake: () => { Ale.Game.set('tomatoes_taken'); sc.onBasket && sc.onBasket(); } }));
    const door = sc.add(new Ale.Door({ x: X.door, y: FY, id: 'door', range: 56, onUse: () => sc.onDoor && sc.onDoor() }));
    const hatch = sc.add(new Ale.Hatch({ x: X.hatch, y: FY, onCrack: () => sc.onCrack && sc.onCrack(), onOpen: () => sc.onHatchOpen && sc.onHatchOpen() }));
    // headH 308: жёлтый маркер двери (и знак «E») стоят над вывеской «SORTIE DE SERVICE» (она занимает ряды 290…322), а не на её буквах: при 250 маркер закрывал середину надписи (18.10.2026)
    const backDoor = sc.add(new Ale.Door({ x: X.backDoor, y: FY, id: 'backDoor', range: 60, headH: 308, locked: true, onUse: () => sc.onBackDoor && sc.onBackDoor() }));
    // шкаф с посылкой стоит с самого начала: корпус, посылка за стеклом, стеклянные дверцы поверх
    const cabinet = sc.add(new Ale.Cabinet({ x: X.cabinet, y: WALL }));
    const parcel = sc.add(new Ale.Parcel({ x: X.cabinet, y: WALL - 175 }));
    sc.add(new Ale.Decor({ x: X.cabinet, y: WALL, z: 26, draw: (ctx) => cabinet.drawFront(ctx) }));
    if (entry !== 'start') door.interactable = false;     // дверь на улицу нужна только в начале
    sc.hatch = hatch; sc.clerk = clerk; sc.basket = basket; sc.door = door; sc.backDoor = backDoor; sc.cabinet = cabinet; sc.parcel = parcel;

    const spawnX = entry === 'parcel' ? X.hatch - 170 : entry === 'hatch' ? X.hatch - 320 : entry === 'exit' ? X.cabinet - 160 : X.start;
    const p = sc.add(new Ale.Player({ x: spawnX, y: FY, facing: 1 }));
    sc.player = p;
    const bubel = sc.add(new Ale.Bubel({ x: spawnX - 80, y: FY, facing: 1 }));
    sc.bubel = bubel;

    Ale.PostStory.setup(sc, entry);
    return sc;
  };
})();
