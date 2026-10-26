// Улица от почты до университета ASSAS: платформы, крысы, лавки, вывески.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, SA = Ale.StreetArt, K = Ale.Paris;
  const FY = 600, WALL = 584, WIDTH = 3480;                   // портал ASSAS (X.portal 3240) шире ±190: при ширине мира 3400 его правый край и четвёртая колонна упирались в край кадра

  const X = Ale.STREET = {
    portal: 3240, planter: 805, table: 960, awn1: 1010, awn1W: 270, awn2: 1315, awn2W: 190, awnY: 478, wall: 1800, stand: 2155, bench: 2490,
  };

  // Лавки вдоль улицы: [x, ширина, параметры]
  const SHOPS = [
    [10, 330, { name: 'POSTE', paint: '#2b4b8f', goods: 'poste', door: 'right', size: 30, seed: 11 }],
    [380, 250, { name: 'BOULANGERIE', paint: '#8a4b2a', goods: 'bread', door: 'right', size: 21, seed: 12 }],
    [690, 230, { name: 'FLEURS', paint: '#7a3a5a', goods: 'flowers', size: 28, seed: 13 }],
    [1000, 290, { name: 'CAFÉ', paint: '#2f6f73', goods: 'cafe', door: 'right', size: 32, seed: 14 }],
    [1310, 190, { name: 'LIBRAIRIE', paint: '#3d5a80', goods: 'books', size: 22, seed: 15 }],
    [1700, 330, { name: 'FROMAGERIE', paint: '#a8762a', goods: 'cheese', door: 'left', size: 26, seed: 16 }],
    [2360, 250, { name: 'CHAPEAUX', paint: '#7a2e3b', goods: 'hats', size: 25, seed: 17 }],
    [2690, 290, { name: 'BRASSERIE', paint: '#2b3a3a', goods: 'bottles', door: 'right', size: 27, seed: 18 }],
  ];

  function drawNear(g, W) {
    SA.groundStrip(g, W);
    for (const [x, w, o] of SHOPS) {
      const L = K.shop(Object.assign({ w }, o));
      g.drawImage(L.c, x - 8, WALL - 250, L.w, L.h);
      L.c.width = 0; L.c.height = 0;
    }
    SA.portal(g, X.portal, WALL + 4);
  }

  Ale.Scenes.street = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'street', width: WIDTH, music: 'paris', place: entry === 'start' ? Ale.T.place.street : null });
    const W = sc.world, F = game.state.flags;

    // ---- геометрия
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addSolid(X.planter - 45, FY - 64, 90, 64, { kind: 'planter' });
    W.addOneWay(X.table - 36, FY - 96, 72, 10, { kind: 'table' });
    W.addOneWay(X.awn1, X.awnY, X.awn1W, 14, { kind: 'awning' });
    W.addOneWay(X.awn2, X.awnY, X.awn2W, 14, { kind: 'awning' });
    W.addSolid(X.wall - 60, FY - 112, 120, 112, { kind: 'wall' });
    W.addSolid(X.stand - 75, FY - 114, 150, 114, { kind: 'stand' });
    W.addOneWay(X.bench - 70, FY - 52, 140, 12, { kind: 'bench' });

    // ---- слои фона
    const skyL = A.layer(1800, 720, (g, w, h) => SA.sky(g, w, h), 1);
    const cloudL = A.layer(1800, 360, (g, w, h) => SA.clouds(g, w, h), 1);
    const farW = (WIDTH - 1280) * 0.2 + 1700, midW = (WIDTH - 1280) * 0.5 + 1700;
    const farL = A.layer(farW, 720, (g, w, h) => SA.skyline(g, w, h, 1300), 1);
    const midL = A.layer(midW, 720, (g, w, h) => SA.facades(g, w, h), 1.25);
    const nearL = A.layer(WIDTH, 720, drawNear, 1.5);
    sc.back.push((ctx, cam) => {
      ctx.drawImage(skyL.c, 0, 0, game.viewW, game.viewH);
      const co = (sc.time * 7) % 1800;
      ctx.drawImage(cloudL.c, -co - cam.x * 0.04, 20, 1800, 360); ctx.drawImage(cloudL.c, 1800 - co - cam.x * 0.04, 20, 1800, 360);
      A.blitView(ctx, farL, -cam.x * 0.2, 0, game.viewW);
      A.blitView(ctx, midL, -cam.x * 0.5, 40, game.viewW);
      A.blitView(ctx, nearL, -cam.x, 0, game.viewW);
    });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.28));

    // ---- платформы и мебель как сущности (глубина, тень)
    const deco = (x, y, L, z, sh) => sc.add(new Ale.Decor({ x, y: FY, z: z || 22, draw: (ctx) => { if (sh) A.shadow(ctx, x, FY, sh, 0.3); A.blit(ctx, L, x - L.w / 2, y - L.h); } }));
    const awnL = SA.awning(null, X.awn1W, 34, '#c7562f', '#fff6e4');
    const awnL2 = SA.awning(null, X.awn2W, 34, '#3d5a80', '#fff6e4');
    sc.add(new Ale.Decor({ x: X.awn1, y: FY, z: 40, draw: (ctx) => { A.blit(ctx, awnL, X.awn1 - 8, X.awnY - 4); } }));
    sc.add(new Ale.Decor({ x: X.awn2, y: FY, z: 40, draw: (ctx) => { A.blit(ctx, awnL2, X.awn2 - 8, X.awnY - 4); } }));
    deco(X.table, FY, SA.cafeTable(), 21, 92);
    deco(X.planter, FY, SA.planter(), 28, 62);
    deco(X.wall, FY, SA.stoneWall(), 28, 84);
    deco(X.stand, FY, SA.kiosk(), 28, 92);
    deco(X.bench, FY, SA.bench(), 22, 84);
    // фонари, деревья, афишные тумбы
    const lampL = K.lamp(330), morrisL = K.morris(190), treeL = K.tree(0.9, 3), treeL2 = K.tree(0.85, 8);
    for (const x of [655, 1300, 2045, 2650, 3010]) sc.add(new Ale.Decor({ x, y: FY, z: 18, draw: (ctx) => A.blit(ctx, lampL, x - lampL.w / 2, WALL + 8 - lampL.h) }));
    for (const [x, L] of [[1600, treeL], [2290, treeL2]]) sc.add(new Ale.Decor({ x, y: FY, z: 19, draw: (ctx) => { A.shadow(ctx, x, WALL + 8, 60, 0.25); A.blit(ctx, L, x - L.w / 2, WALL + 10 - L.h); } }));
    for (const x of [1548, 2965]) sc.add(new Ale.Decor({ x, y: FY, z: 20, draw: (ctx) => { A.shadow(ctx, x, WALL + 6, 40, 0.28); A.blit(ctx, morrisL, x - morrisL.w / 2, WALL + 6 - morrisL.h); } }));

    // ---- ящик помидоров на киоске, дверь в ASSAS
    sc.add(new Ale.TomatoBox({ x: X.stand - 20, y: FY - 114, id: 'basket', onTake: () => { if (!F.tut_refill) { Ale.Game.set('tut_refill'); } } }));
    sc.add(new Ale.Door({ x: X.portal, y: FY, id: 'assas_door', range: 90, headH: 270, arrow: true, onUse: () => { Ale.Game.checkpoint('assas', 'start'); Ale.Game.goto('assas', 'start'); } }));
    sc.add(new Ale.HeartPickup({ x: X.awn1 + 135, y: X.awnY })); sc.add(new Ale.HeartPickup({ x: X.wall, y: FY - 112 }));

    // ---- герои и крысы
    const spawnX = 480;                                      // правее левой группы экранных кнопок (≈ до 375 юн.): раньше героиня и Бубел в первые секунды стояли под ними (13.10.2026)
    const p = sc.add(new Ale.Player({ x: spawnX, y: FY, facing: 1 }));
    sc.player = p;
    const bubel = sc.add(new Ale.Bubel({ x: spawnX - 80, y: FY, facing: 1 }));
    sc.bubel = bubel;
    sc.rats = [
      // Все — на открытом полу с чистым подходом слева (кадка, стена и киоск помидору не мешают; крыс «в загонах» между ними нет)
      sc.add(new Ale.Rat({ x: 1130, y: FY, range: 110, facing: -1 })),
      sc.add(new Ale.Rat({ x: 1560, y: FY, range: 120 })),
      sc.add(new Ale.Rat({ x: 2570, y: FY, range: 110, facing: -1 })),
      sc.add(new Ale.Rat({ x: 2860, y: FY, range: 120 })),
      sc.add(new Ale.Rat({ x: 3080, y: FY, range: 80, facing: -1 })),
    ];
    // голуби на тротуаре: клюют и взлетают, когда подходишь (косметика)
    if (Ale.Pigeon) for (const x of [560, 1150, 1980, 2560, 3100]) sc.add(new Ale.Pigeon({ x, y: FY + 10 }));

    Ale.StreetStory.setup(sc, entry);
    return sc;
  };
})();
