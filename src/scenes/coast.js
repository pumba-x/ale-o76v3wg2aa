// Побережье (сценарное ТЗ, раздел 11). Слева дорога и остановка такси (road, stop), две ступени вниз, дальше камни через воду: подъёмы ≤ 90 юн., разрывы ≤ 130, врагов нет. Широкий камень C — для знакомства
// с китёнышем; камень F перед скрытым входом в пещеру (cave). Упала в воду — возвращается на последний сухой камень без потери сердца (ничего не убивает). Китёныш плавает с первого кадра в воде у камней;
// линия воды переднего плана закрывает его нижнюю часть. Состояние оформления: sc.coast = { waterY, caveGlow }.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const WIDTH = 2600;

  // Камни: [левый край, правый край, верх]. Первый — дорога у остановки, дальше две ступени, потом камни с разрывами 110–120.
  const STONES = [
    [0, 560, 560],         // дорога и остановка
    [560, 640, 584], [640, 740, 606],                      // ступени вниз
    [850, 1010, 598],      // A (разрыв 110)
    [1120, 1240, 560],     // B (разрыв 110, подъём 38)
    [1360, 1720, 606],     // C: широкая площадка — знакомство с китёнышем
    [1830, 1950, 566],     // D (разрыв 110, подъём 40)
    [2070, 2190, 530],     // E (разрыв 120, подъём 36)
    [2300, 2600, 530],     // F: у пещеры (разрыв 110)
  ];
  const X = (Ale.COAST = {
    width: WIDTH, stones: STONES, road: 560, waterY: 652, seabed: 780,
    stop: 150, start: 480,
    seeX: 1480,                 // здесь, ступив на широкий камень, Бубел замечает китёныша (глотка баблти на берегу больше нет: он в парке)
    petX: 1690,                 // здесь она гладит китёныша (у правого края камня C)
    whaleHome: 1420,            // где он плавает до знакомства
    whalePet: 1790,             // где он касается ладони (между камнями C и D)
    cave: 2480,                 // вход в пещеру
    sink: 690,                  // ниже этой линии ноги — упала в воду
  });

  Ale.Scenes.coast = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'coast', width: WIDTH, music: Ale.Audio.pick('coast', 'ending'), place: entry === 'start' ? Ale.T.place.coast : null });
    const W = sc.world;
    sc.stoneSolids = STONES.map((s, i) => W.addSolid(s[0], s[2], s[1] - s[0], 400, { kind: 'stone', i }));      // камень уходит вниз под воду
    W.addSolid(-400, X.seabed, WIDTH + 800, 400, { kind: 'seabed' });                                       // дно: упавшая героиня не уходит за кадр
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    sc.coast = { waterY: X.waterY, caveGlow: 0 };

    const MA = Ale.MonacoArt, layers = MA.coastLayers(game, WIDTH, X);
    sc.back.push((ctx, cam) => MA.coastBack(ctx, cam, game, sc, layers));
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.18));
    for (const d of MA.coastDecor(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: X.road, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));

    // ---- китёныш: плавает у камней с первого кадра; вода переднего плана рисуется поверх него
    sc.whale = sc.add(new Ale.WhaleCalf({ x: X.whaleHome, y: X.waterY - 22, waterY: X.waterY, facing: -1 }));
    sc.whale.patrol(X.whaleHome - 150, X.whaleHome + 150);
    for (const d of MA.coastFront(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: X.road, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));

    const p = sc.add(new Ale.Player({ x: X.start, y: X.road, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: X.road, facing: 1 }));
    sc.bubel.hopGaps = true;                                  // Бубел сам перепрыгивает разрывы между камнями
    sc.cave = sc.add(new Ale.Door({ x: X.cave, y: STONES[STONES.length - 1][2], id: 'caveEntrance', range: 100, headH: 130, arrow: true, label: Ale.T.monaco.enter, canUse: () => !!Ale.Game.state.flags.cave_found, onUse: () => sc.onCave && sc.onCave() }));

    Ale.MonacoStory.coast(sc, entry);
    return sc;
  };
})();
