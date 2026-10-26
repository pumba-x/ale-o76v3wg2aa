// Монако, улица у казино (сценарное ТЗ, разделы 9–10). Слева направо: приезд (start) → будущий воришка стоит у фонаря как прохожий (thief) → вход в казино (door) → ограда (gate), пока фишка не потрачена →
// такси на правом краю (taxi, дверь taxiDoor). Здание казино видно с первого кадра; всё, что по сюжету есть на улице (вор, такси, ограда), стоит с первого кадра, сюжет меняет только состояния.
// Состояние оформления: sc.taxi = { dx, door } (отъезд и задняя дверь), sc.gate = { open } (ограда убирается после выигрыша).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const FY = 600, WIDTH = 2400;

  const X = (Ale.MONACO_STREET = {
    width: WIDTH,
    start: 480,                  // приезд (правее левой группы экранных кнопок)
    thief: 700,                  // будущий воришка: стоит у фонаря левее двери и смотрит на улицу, как прохожий
    door: 1180,                  // дверь казино
    afterDoor: 1260,             // где героиня встаёт, выйдя из казино
    gate: 1760,                  // ограда: до выигрыша дальше не пройти
    taxi: 2138, taxiDoor: 2048,  // такси (чёрный Maybach с «Uber» на двери) и его дверь, к которой подходят (машина 312 юн. длиной: нос не упирается в каменный столб справа)
    thiefOut: 2330,              // здесь вор скрывается за машиной
  });

  Ale.Scenes.monacoStreet = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'monacoStreet', width: WIDTH, music: Ale.Audio.pick('monaco_street', 'paris'), place: entry === 'arrival' ? Ale.T.place.monacoStreet : null });
    const W = sc.world;
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    sc.gateSolid = W.addSolid(X.gate - 24, -400, 48, 1000, { kind: 'gate' });                    // невидимая преграда за оградой (её снимает сюжет)
    sc.gate = { open: 0 };
    sc.taxi = { dx: 0, door: 0 };

    const MA = Ale.MonacoArt, layers = MA.streetLayers(game, WIDTH, X);
    sc.back.push((ctx, cam) => MA.streetBack(ctx, cam, game, sc, layers));
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.2));
    for (const d of MA.streetDecor(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));
    for (const d of MA.streetFront(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));

    // ---- герои, воришка (обычный прохожий: ничем не выделен), двери
    const p = sc.add(new Ale.Player({ x: X.start, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: FY, facing: 1 }));
    sc.thief = sc.add(new Ale.Person({ kind: 'thief', x: X.thief, y: FY, facing: 1, id: 'thief', z: 50 }));
    sc.door = sc.add(new Ale.Door({ x: X.door, y: FY, id: 'casinoDoor', range: 90, headH: 270, arrow: true, label: Ale.T.monaco.door, onUse: () => sc.onDoor && sc.onDoor() }));
    sc.taxiDoor = sc.add(new Ale.Door({ x: X.taxiDoor, y: FY, id: 'taxi', range: 90, headH: 150, label: Ale.T.monaco.taxiLabel, canUse: () => !!Ale.Game.state.flags.taxi_paid, onUse: () => sc.onTaxi && sc.onTaxi() }));
    // звонок Илюшкинсу после кражи (владелец 04.10.2026: «просто нажав E, и чтобы кнопка не была привязана к Бубелу»): действие в любом месте улицы — точка идёт за героиней, знак «E» с подписью над ней;
    // у двери казино или такси главнее их собственное действие (Scene.updateFocus берёт «в любом месте» только когда рядом больше ничего нет)
    sc.callSpot = sc.add(new Ale.Spot({ x: X.start, y: FY, id: 'phoneCall', anywhere: true, headH: 150, label: Ale.T.monaco.callLabel, labelIcon: 'it_phone', follow: p, canUse: () => !!sc.callReady && !Ale.Game.state.flags.taxi_paid, onUse: () => sc.onCall && sc.onCall() }));

    Ale.MonacoStory.street(sc, entry);
    return sc;
  };
})();
