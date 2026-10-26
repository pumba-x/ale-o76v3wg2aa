// Комната-сюрприз в пещере (сценарное ТЗ, раздел 12): украшена к празднику, семья стоит на своих местах с первого кадра (Марина, Мамулькин, Папулькин, Дедушка), справа — стол с тортом и 23 свечами,
// в углу на столике пульт, у стены справа заранее предусмотрено место портала (открывается пультом, оттуда выходит Илюшкинс). Состояние оформления: sc.room = { candles (горит, 0…23), portal 0…1, remote (лежит на столике), banner }.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const FY = 600, WIDTH = 1800;

  const X = (Ale.BIRTHDAY_ROOM = {
    width: WIDTH,
    start: 130,                       // вход из пещеры слева (отсюда отсчитывались прежние отметки)
    spawn: 460,                       // где героиня стоит в первый миг: правее левой группы экранных кнопок (≈ до 375 юн.), Бубел — левее на 70 (тоже не под ними)
    walkTo: 470,                      // куда она делает шаг перед поздравлением: группа семьи раскрыта
    free: 470,                        // где стоит после поздравления (и при загрузке «свободно»): тоже правее кнопок, Марина — на 600
    marina: 600, mother: 730, father: 860, grandfather: 990,       // семья смотрит на вход
    table: 1230, remoteTable: 1560, portal: 1700, banner: 880,
    photo: 440,                       // отсюда героиня снимает семью очками (мини-игра «снимок»)
    camera: 800,                      // камера на время поздравления: вся группа в кадре
    ilyaOut: 1620,                    // куда выходит Илюшкинс из портала
  });

  Ale.Scenes.birthdayRoom = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'birthdayRoom', width: WIDTH, music: null, place: entry === 'start' ? Ale.T.place.birthdayRoom : null, placeY: 0.12 });
    const W = sc.world;
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    sc.room = { candles: 23, portal: 0, remote: true, banner: true };

    const MA = Ale.MonacoArt, layers = MA.roomLayers(game, WIDTH, X);
    sc.back.push((ctx, cam) => MA.roomBack(ctx, cam, game, sc, layers));
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.22));
    for (const d of MA.roomDecor(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));
    for (const d of MA.roomFront(X, sc)) sc.add(new Ale.Decor({ x: d.x, y: FY, z: d.z, draw: (ctx) => d.draw(ctx, sc.time) }));

    const p = sc.add(new Ale.Player({ x: X.spawn, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.spawn - 70, y: FY, facing: 1 }));
    // семья стоит с первого кадра, лицом ко входу; разговор по действию включается после поздравления
    const rel = (kind, x) => sc.add(new Ale.Person({ kind, x, y: FY, facing: -1, id: kind, z: 52, range: 110 }));
    sc.marina = rel('marina', X.marina); sc.mother = rel('mother', X.mother); sc.father = rel('father', X.father); sc.grandfather = rel('grandfather', X.grandfather);
    for (const r of [sc.marina, sc.mother, sc.father, sc.grandfather]) r.keepFacing = false;
    // Илюшкинс: ждёт за порталом (скрыт), выходит после нажатия кнопки пульта
    sc.ilya = sc.add(new Ale.Person({ kind: 'ilyushkins', x: X.portal, y: FY, facing: -1, id: 'ilyushkins' }));
    sc.ilya.hidden = true; sc.ilya.noTalk = true;
    sc.remoteSpot = sc.add(new Ale.Spot({ x: X.remoteTable, y: FY, id: 'remote', range: 90, headH: 110, label: () => (sc.remoteLabel ? sc.remoteLabel() : null), canUse: () => !!sc.remoteReady, onUse: () => sc.onRemote && sc.onRemote() }));
    sc.photoSpot = sc.add(new Ale.Spot({ x: X.photo, y: FY, id: 'photo', range: 80, headH: 150, label: Ale.T.monaco.photo, labelIcon: 'it_glasses', canUse: () => !!sc.photoReady, onUse: () => sc.onPhoto && sc.onPhoto() }));
    // выход из пещеры (слева): всегда доступен после поздравления — открывает финальное меню «Остаться / Титры / В главное меню»
    sc.roomExit = sc.add(new Ale.Door({ x: 62, y: FY, id: 'roomExit', range: 70, headH: 210, label: Ale.T.monaco.finish, canUse: () => !!sc.finishReady, onUse: () => sc.finalMenu && sc.finalMenu() }));
    sc.cakeSpot = sc.add(new Ale.Spot({ x: X.table, y: FY, id: 'cake', range: 110, headH: 150, label: Ale.T.monaco.cake, canUse: () => !!sc.cakeReady, onUse: () => sc.onCake && sc.onCake() }));

    Ale.MonacoStory.room(sc, entry);
    return sc;
  };
})();
