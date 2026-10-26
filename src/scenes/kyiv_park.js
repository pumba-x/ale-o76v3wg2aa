// Киев, парк перед красным корпусом КНУ (по фото владельца: красный корпус с колоннами, красно-коричневый гранитный фонтан с веером струй, фонари с цветочными корзинами,
// брусчатка, зелёные скамейки, кусты). Безопасная сцена без врагов. Илюшкинс ждёт у фонтана с первого кадра; встреча начинается действием рядом с ним, а не при появлении.
// Выход справа ведёт к спортивной площадке; до встречи он закрыт.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const FY = 600, WALL = 584, WIDTH = 2200;

  const X = (Ale.KYIV_PARK = {
    start: 480, ilya: 860, fountain: 1130, exit: 2060,                  // Илюшкинс ждёт у левого края площадки фонтана: чаша на переднем плане (z выше героев) закрыла бы его, если бы он стоял у борта
    chairsL: [690, 770], chairsR: [1500, 1580],        // кресла-лавочки на одного (изогнутые) вокруг фонтана: по двое с каждой стороны, лицом к воде
    sms: 1700,                                          // здесь, после встречи, приходит смс от Мамулькина
    lamps: [520, 1560, 1930], benches: [380, 1760],     // длинные лавки вдоль аллеи
    trees: [90, 700, 1480, 2130], hedges: [[250, 330], [1650, 420]],
  });

  Ale.Scenes.kyivPark = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'kyivPark', width: WIDTH, music: Ale.Audio.pick('kyiv_park', 'paris'), place: entry === 'start' ? Ale.T.place.kyivPark : null });
    const W = sc.world;
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);

    // ---- фон: небо, красный корпус вдали, деревья и кусты, брусчатка (Ale.KyivArt.park*)
    const KA = Ale.KyivArt, layers = KA.parkLayers(game, WIDTH, X);
    sc.back.push((ctx, cam) => KA.parkBack(ctx, cam, game, sc, layers));
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.26));

    // ---- фонтан (со струями, рисуется каждый кадр), фонари, скамейки
    sc.add(new Ale.Decor({ x: X.fountain, y: FY, z: 60, draw: (ctx, d) => KA.fountain(ctx, X.fountain, WALL, sc.time) }));          // чаша на переднем плане (z выше героев): стоит на брусчатке ниже линии ходьбы, герои проходят за ней
    const decor = KA.parkDecor(X);
    for (const d of decor) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));
    sc.add(new Ale.HeartPickup({ x: X.benches[1], y: FY - 52 }));
    W.addOneWay(X.benches[1] - 70, FY - 52, 140, 12, { kind: 'bench' });
    W.addOneWay(X.benches[0] - 70, FY - 52, 140, 12, { kind: 'bench' });

    // ---- герои
    const p = sc.add(new Ale.Player({ x: X.start, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: FY, facing: 1 }));
    sc.ilya = sc.add(new Ale.Person({ kind: 'ilyushkins', x: X.ilya, y: FY, facing: -1, id: 'ilyushkins' }));
    sc.exitDoor = sc.add(new Ale.Door({ x: X.exit, y: FY, id: 'courtExit', range: 90, headH: 280, locked: true, onUse: () => sc.onExit && sc.onExit() }));

    Ale.KyivStory.park(sc, entry);
    return sc;
  };
})();
