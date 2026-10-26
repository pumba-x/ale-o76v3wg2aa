// Монако, зал казино (сценарное ТЗ, раздел 9). Вход слева (exit), три автомата (slotLeft, slotCrown, slotRight): фишка с короной подходит только к среднему — у него золотая корона на табло.
// Состояние оформления автомата: sc.slot = { stage: 'chipInBag' | 'chipInserted' | 'jackpot', lever, spin, glow, pack }.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const FY = 600, WIDTH = 1700;

  const X = (Ale.MONACO_CASINO = {
    width: WIDTH,
    start: 480, exit: 90,
    slotLeft: 760, slotCrown: 1060, slotRight: 1360,
    roulette: 1594,                // стол рулетки у правой стены (оформление — monaco_art_casino.js); за ним стоит крупье
    rouletteSpot: 1448,            // здесь героиня стоит у стола (слева от него): действие «Сыграть»
    croupier: 1640,                // крупье за столом (облачка и реплики идут от него)
    stake: 50,                     // фишка «стоит» 50 € — это и единственная ставка в автомате (владелец 03.10.2026); джекпот ×40 = 2 000 €
  });

  Ale.Scenes.monacoCasino = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'monacoCasino', width: WIDTH, music: Ale.Audio.pick('monaco_casino', 'airport'), place: entry === 'start' ? Ale.T.place.monacoCasino : null });
    const W = sc.world;
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addSolid(X.roulette - 124, -400, 500, 1500);                        // стол рулетки — стена: к нему подходят слева, как к автоматам
    sc.slot = { stage: 'chipInBag', lever: 0, spin: false, glow: 0, pack: 0 };

    const MA = Ale.MonacoArt, layers = MA.casinoLayers(game, WIDTH, X);
    sc.back.push((ctx, cam) => MA.casinoBack(ctx, cam, game, sc, layers));
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.28));
    for (const d of MA.casinoDecor(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));

    const p = sc.add(new Ale.Player({ x: X.start, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: FY, facing: 1 }));
    sc.exitDoor = sc.add(new Ale.Door({ x: X.exit, y: FY, id: 'streetExit', range: 90, headH: 250, label: Ale.T.monaco.street, onUse: () => sc.onExit && sc.onExit() }));
    // три автомата: действие есть у всех (участвуют в одной сюжетной задаче); подпись зависит от стадии и от того, «тот» ли автомат
    const slot = (id, x, crown) => sc.add(new Ale.Door({ x, y: FY, id, range: 80, headH: 262, label: () => (crown ? sc.slotLabel && sc.slotLabel() : null), labelIcon: () => (crown && Ale.Game.state.casinoStage === 'chipInBag' ? 'it_chip' : null), onUse: () => sc.onSlot && sc.onSlot(id, crown) }));        // при подходе у подписи «Вставить фишку» — сама фишка
    sc.slotLeft = slot('slotLeft', X.slotLeft, false); sc.slotCrown = slot('slotCrown', X.slotCrown, true); sc.slotRight = slot('slotRight', X.slotRight, false);
    // рулетка: действие появляется только после выигрыша на автомате, пока стол открыт; крупье — невидимая опора для облачек и реплик (сам нарисован в оформлении)
    sc.rouletteTable = sc.add(new Ale.Door({ x: X.rouletteSpot, y: FY, id: 'rouletteTable', range: 60, headH: 250, label: () => Ale.T.monaco.rouletteLabel, canUse: () => !!(sc.rouletteOpen && sc.rouletteOpen()), onUse: () => sc.onRoulette && sc.onRoulette() }));
    sc.croupier = sc.add(new Ale.Decor({ x: X.croupier, y: FY, z: 1, id: 'croupier', draw: () => {} })); sc.croupier.headH = 200;

    Ale.MonacoStory.casino(sc, entry);
    return sc;
  };
})();
