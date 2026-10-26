// Туннель под почтой: препятствия, крысы, бочки и «шуточный бой» с Даней.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, TA = Ale.TunnelArt;
  const FY = 600, WALL = 590, WIDTH = 3900;

  const X = Ale.TUNNEL = { shaft: 480, arena0: 2720, arena1: 3720, basket: 2775, ladder: 3830, plankA: 1270, plankAW: 340 };

  Ale.Scenes.tunnel = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'tunnel', width: WIDTH, music: 'tunnel' });
    const W = sc.world;
    if (game.state.tomatoes < 3) game.state.tomatoes = Ale.PLAYER.MAX_TOMATOES;

    // ---- геометрия
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addSolid(980 - 48, FY - 96, 96, 96, { kind: 'crate' });
    W.addOneWay(X.plankA, 468, X.plankAW, 14, { kind: 'plank' });
    W.addSolid(1790 - 46, FY - 90, 92, 90, { kind: 'crate' });
    W.addSolid(1882 - 46, FY - 180, 92, 180, { kind: 'crate' });
    W.addSolid(X.basket - 48, FY - 92, 96, 92, { kind: 'crate' });
    W.addOneWay(3020, 468, 220, 14, { kind: 'plank' });
    W.addOneWay(3360, 468, 220, 14, { kind: 'plank' });

    // ---- фон
    const tun = A.layer(WIDTH, 720, TA.drawTunnel, 1.5);
    sc.back.push((ctx, cam) => { ctx.fillStyle = '#241a20'; ctx.fillRect(0, 0, game.viewW, game.viewH); A.blitView(ctx, tun, -cam.x, -cam.y, game.viewW); });
    // луч света из открытого люка над местом падения
    sc.back.push((ctx, cam) => {
      const x = X.shaft - cam.x;
      if (x < -300 || x > game.viewW + 300) return;
      A.beam(ctx, x, 0, 150, x - 30, 590, 250, 0.28, 'rgba(255,240,200,');
    });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.55));

    // ---- ящики, доски, лестница
    const crate96 = TA.crate(96, 96, 2), crate90 = TA.crate(92, 90, 5), crate180 = TA.crate(92, 180, 7), crateB = TA.crate(96, 92, 9);
    const deco = (x, y, layer, w, h, z) => sc.add(new Ale.Decor({ x, y: FY, z: z || 26, draw: (ctx) => { A.shadow(ctx, x, FY, w * 0.75, 0.32); A.blit(ctx, layer, x - w / 2 - 4, y - h - 4); } }));
    deco(980, FY, crate96, 96, 96); deco(1790, FY, crate90, 92, 90); deco(1882, FY, crate180, 92, 180); deco(X.basket, FY, crateB, 96, 92);
    // помост из досок на стойках
    sc.add(new Ale.Decor({ x: X.plankA, y: FY, z: 20, draw: (ctx) => {
      for (const px of [X.plankA + 30, X.plankA + X.plankAW - 30]) { ctx.fillStyle = '#5f3b28'; ctx.fillRect(px - 7, 468, 14, 132); ctx.strokeStyle = A.OUT; ctx.lineWidth = 3; ctx.strokeRect(px - 7, 468, 14, 132); }
      A.box(ctx, X.plankA, 468, X.plankAW, 14, { fill: '#a8703f', lw: 3.5, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
      ctx.strokeStyle = 'rgba(43,26,32,0.5)'; ctx.lineWidth = 2; for (let x = X.plankA + 60; x < X.plankA + X.plankAW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 469); ctx.lineTo(x, 481); ctx.stroke(); }
    } }));
    for (const px of [3020, 3360]) sc.add(new Ale.Decor({ x: px, y: FY, z: 20, draw: (ctx) => {
      for (const dx of [26, 194]) { ctx.fillStyle = '#5f3b28'; ctx.fillRect(px + dx - 7, 468, 14, 132); ctx.strokeStyle = A.OUT; ctx.lineWidth = 3; ctx.strokeRect(px + dx - 7, 468, 14, 132); }
      A.box(ctx, px, 468, 220, 14, { fill: '#a8703f', lw: 3.5, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
    } }));
    const barrelSt = TA.barrel(64, 82);
    for (const bx of [640, 2240, 2560]) sc.add(new Ale.Decor({ x: bx, y: FY, z: 24, draw: (ctx) => { A.shadow(ctx, bx, FY, 48, 0.3); A.blit(ctx, barrelSt, bx - 36, FY - 86); } }));

    sc.add(new Ale.HeartPickup({ x: X.plankA + X.plankAW / 2, y: 468 })); sc.add(new Ale.HeartPickup({ x: 3130, y: 468 }));

    // ---- корзина, лестница
    sc.add(new Ale.Basket({ x: X.basket, y: FY - 92, id: 'basket' }));
    const ladder = TA.ladder(FY);                                  // лестница уходит за верх кадра, к люку на почту, и луч света идёт сверху (раньше лестница кончалась в кирпичной стене на y = 240, а луч начинался жёстким краем на y = 130)
    sc.add(new Ale.Decor({ x: X.ladder, y: FY, z: 15, draw: (ctx) => {
      A.beam(ctx, X.ladder, 0, 120, X.ladder, 590, 240, 0.22, 'rgba(255,240,200,');
      A.blit(ctx, ladder, X.ladder - 42, 0);
    } }));
    sc.exitDoor = sc.add(new Ale.Door({ x: X.ladder, y: FY, id: 'ladder', range: 80, headH: 380, locked: true, lockedText: Ale.T.hint.tunnelLocked, onUse: () => { Ale.Game.checkpoint('postOffice', 'parcel'); Ale.Game.goto('postOffice', 'parcel'); } }));

    // ---- герои, враги
    const startX = entry === 'arena' ? X.arena0 - 60 : X.shaft;      // слева от ящика с корзиной (2727–2823), не внутри него
    const p = sc.add(new Ale.Player({ x: startX, y: entry === 'arena' ? FY : 90, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: startX - 70, y: entry === 'arena' ? FY : 100, facing: 1 }));
    sc.dan = sc.add(new Ale.Danechka({ x: 3560, y: FY, facing: -1, arena: { x0: X.arena0, x1: X.arena1 } }));
    sc.dan.dead = true; sc.dan.hidden = true;   // до нужного момента его нет на сцене
    if (entry !== 'arena') {
      sc.rats = [
        sc.add(new Ale.Rat({ x: 820, y: FY, range: 120 })),
        sc.add(new Ale.Rat({ x: 1330, y: FY, range: 100, facing: -1 })),
        sc.add(new Ale.Rat({ x: 1560, y: FY, range: 90 })),
        sc.add(new Ale.Rat({ x: 2380, y: FY, range: 130, facing: -1 })),
      ];
    } else sc.rats = [];
    sc.wheelImg = TA.wheel(33);

    Ale.TunnelStory.setup(sc, entry);
    return sc;
  };
})();
