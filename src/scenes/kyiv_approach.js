// Киев, первая сцена: подземный переход от выхода метро к парку у красного корпуса. Слева — выход из метро и короткий участок самого перехода, справа — лестница
// наверх. Пять тараканов тремя группами 2 / 1 / 2, низкие препятствия 50–90 юнитов (без ям и подвижных платформ), последние 350 юнитов перед Антіном безопасны.
// Антін стоит у выхода с первого кадра; разговор с ним необязателен. Выход справа ведёт в парк независимо от разговора и числа побеждённых тараканов.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const FY = 600, WALL = 584, WIDTH = 2700;

  const X = (Ale.KYIV_APPROACH = {
    start: 460, metro: 0, hallEnd: 620, corridorEnd: 2000, stairs: 2380, antin: 2250, exit: 2560, safeFrom: 1900,
    obstacles: [[560, 96, 64, 'bags'], [1090, 110, 84, 'kiosk'], [1500, 120, 70, 'cart'], [1790, 88, 60, 'bin']],        // [x, ширина, высота, вид] — все ниже 90 юн., их можно перепрыгнуть
    roaches: [[820, 100], [980, 80], [1330, 110], [1640, 80], [1780, 60]],                  // [x, радиус патруля]: группы 2 / 1 / 2; дальше 1850 — безопасный отрезок перед Антіном
    roachMaxX: 1850,
    kiosks: [[760, 'КАВА', '#8a4b2a'], [1210, 'КВІТИ', '#7a3a5a'], [1640, 'ПРЕСА', '#2f6f73']],
  });

  Ale.Scenes.kyivApproach = function (game, entry) {
    // Прилёт (владелец 08.10.2026): пока на экране открытка с видом на Днепр, играет «Над Днепром»; как только она закрыта, музыка меняется на музыку перехода
    // (kyiv_story.js, approach). Открытка уже была (загрузка из контрольной точки) — сразу музыка перехода.
    const underpass = Ale.Audio.pick('kyiv_underpass', 'tunnel'), music = game.state.flags.kyiv_arrival_seen ? underpass : Ale.Audio.pick('over_the_dnipro', underpass);
    const seen = game.state.flags.kyiv_arrival_seen, sc = new Ale.Scene(game, { id: 'kyivApproach', width: WIDTH, music, place: entry === 'start' ? (seen || !Ale.River ? Ale.T.place.kyivApproach : Ale.T.place.kyivRiver) : null });       // при первом приезде сначала берег Днепра (заплыв), «Переход к парку» — после него
    const W = sc.world;

    // ---- геометрия: ровный пол, стены по краям, низкие препятствия
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    for (const [x, w, h, kind] of X.obstacles) W.addSolid(x - w / 2, FY - h, w, h, { kind });

    // ---- фон (рисует Ale.KyivArt; пока файла картинок нет — заготовка)
    const bg = A.layer(WIDTH, 720, (g, w, h) => Ale.KyivArt.underpass(g, w, h, X), 1.4);
    sc.back.push((ctx, cam) => { ctx.fillStyle = '#3a3238'; ctx.fillRect(0, 0, game.viewW, game.viewH); A.blitView(ctx, bg, -cam.x, -cam.y, game.viewW); });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.36));

    // ---- препятствия как сущности (глубина, тень)
    const props = Ale.KyivArt.underpassProps(X);
    for (const [x, w, h, kind] of X.obstacles) {
      const L = props[kind];
      sc.add(new Ale.Decor({ x, y: FY, z: 28, draw: (ctx) => { A.shadow(ctx, x, FY, w * 0.8, 0.3); A.blit(ctx, L, x - L.w / 2, FY - L.h + 4); } }));
    }
    sc.add(new Ale.HeartPickup({ x: 1320, y: FY }));

    // ---- герои, Антін, выход, враги
    const p = sc.add(new Ale.Player({ x: X.start, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: FY, facing: 1 }));
    sc.antin = sc.add(new Ale.Person({ kind: 'antin', x: X.antin, y: FY, facing: -1 }));
    sc.exitDoor = sc.add(new Ale.Door({ x: X.exit, y: FY, id: 'parkExit', range: 90, headH: 300, arrow: true, onUse: () => sc.onExit && sc.onExit() }));
    sc.roaches = X.roaches.map(([x, range], i) => sc.add(new Ale.Cockroach({ x, y: FY, range, facing: i % 2 ? 1 : -1, maxX: X.roachMaxX })));
    sc.rats = sc.roaches;                                       // для общих проверок «враги в сцене»

    Ale.KyivStory.approach(sc, entry);
    return sc;
  };
})();
