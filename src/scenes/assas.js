// Главный зал ASSAS: арена боя с преподавательницей. Ровный пол без столов, на которые можно случайно запрыгнуть, и без крыс:
// бой один на один, помидоры — в ящиках у обеих стен.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, AA = Ale.AssasArt;
  const FY = 600, WALL = 584, WIDTH = 1900;

  const X = Ale.ASSAS = { door: 62, crateL: 290, crateR: 1690, teacher: 1560, arena0: 140, arena1: 1780 };

  Ale.Scenes.assas = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'assas', width: WIDTH, music: 'paris' });
    const W = sc.world;
    if (game.state.tomatoes < Ale.PLAYER.MAX_TOMATOES) game.state.tomatoes = Ale.PLAYER.MAX_TOMATOES;

    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);

    const hall = A.layer(WIDTH, 720, AA.drawHall);
    sc.back.push((ctx, cam) => { ctx.fillStyle = '#cfc2a8'; ctx.fillRect(0, 0, game.viewW, game.viewH); A.blitView(ctx, hall, -cam.x, -cam.y, game.viewW); });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.42));

    sc.add(new Ale.TomatoBox({ x: X.crateL, y: FY, id: 'basket' }));
    sc.add(new Ale.TomatoBox({ x: X.crateR, y: FY, id: 'basket2' }));

    const door = sc.add(new Ale.Door({ x: X.door, y: FY, id: 'exit', range: 70, headH: 320, locked: true, lockedText: Ale.T.hint.assasLocked, onUse: () => Ale.Game.goto('postOffice', 'return') }));
    sc.exitDoor = door;

    const p = sc.add(new Ale.Player({ x: 480, y: FY, facing: 1 }));  // старт: правее левой группы экранных кнопок (≈ до 375 юн.): раньше героиня и Бубел в первые секунды стояли под ними (13.10.2026));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: 400, y: FY, facing: 1 }));
    sc.teacher = sc.add(new Ale.Teacher({ x: X.teacher, y: FY, facing: -1, arena: { x0: X.arena0, x1: X.arena1 } }));

    Ale.AssasStory.setup(sc, entry);
    return sc;
  };
})();
