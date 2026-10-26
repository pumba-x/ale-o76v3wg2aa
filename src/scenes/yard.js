// Задний двор почты: Преслюкан ждёт с седлом. Тихая сцена: знакомство, яблоко, седло и отъезд к дороге в аэропорт.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, YA = Ale.YardArt;
  const FY = 600, WALL = 584, WIDTH = 2180;                          // мир на 80 юн. шире: арка ворот (внешний контур 2040 ± 114) целиком в кадре, а не обрезана краем (14.10.2026)

  const X = Ale.YARD = { door: 150, horse: 1240, shed: 1560, trough: 1500, gate: 2040, hay: 1772 };      // ворота на 30 правее, сено на 12: тюки не налезают ни на столб навеса (1704–1720), ни на левую обводку арки (1926)

  Ale.Scenes.yard = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'yard', width: WIDTH, music: 'paris', place: Ale.T.place.yard });
    const W = sc.world;
    const bg = A.layer(WIDTH, 720, (g, w, h) => YA.drawYard(g, w, h, X), 1.4);

    // ---- геометрия
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addSolid(X.hay - 48, FY - 64, 96, 64, { kind: 'hay' });                        // тюк сена
    W.addSolid(X.hay + 48, FY - 64, 96, 64, { kind: 'hay' });                        // второй рядом
    W.addSolid(X.hay + 48, FY - 128, 96, 64, { kind: 'hay' });                       // и третий сверху (лесенка)
    W.addSolid(760 - 32, FY - 84, 64, 84, { kind: 'barrel' });                       // бочка

    sc.back.push((ctx, cam) => {
      ctx.fillStyle = '#f2d9a8'; ctx.fillRect(0, 0, game.viewW, game.viewH);
      A.blitView(ctx, bg, -cam.x, -cam.y, game.viewW);
    });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.34));
    // пылинки в закатном луче
    sc.front.push((ctx, cam) => {
      const t = sc.time;
      for (let i = 0; i < 14; i++) {
        const ph = i * 2.3, px = 220 + ((i * 53 + Math.sin(t * 0.35 + ph) * 30 + t * 6) % 380), py = 330 + ((i * 71 + Math.cos(t * 0.28 + ph) * 26 + t * 8) % 300);
        const sx = px - cam.x, sy = py - cam.y;
        if (sx < -10 || sx > game.viewW + 10) continue;
        ctx.fillStyle = 'rgba(255,240,200,' + (0.25 + 0.2 * Math.sin(t * 1.5 + ph)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(sx, sy, 1.7, 0, 6.283); ctx.fill();
      }
    });

    // ---- декор
    const shed = YA.shed(340, 220), trough = YA.trough(120), bale = YA.hayBale(), barrel = YA.barrel(64, 84);
    sc.add(new Ale.Decor({ x: X.shed, y: WALL, z: 12, draw: (ctx) => A.blit(ctx, shed, X.shed - 170 - 20, WALL - 220 - 20 + 4) }));
    sc.add(new Ale.Decor({ x: X.trough, y: WALL, z: 22, draw: (ctx) => { A.shadow(ctx, X.trough, WALL + 4, 70, 0.3); A.blit(ctx, trough, X.trough - 65, WALL - 46); } }));
    for (const [bx, by] of [[X.hay, FY], [X.hay + 96, FY], [X.hay + 96, FY - 64]]) sc.add(new Ale.Decor({ x: bx, y: by, z: 24, draw: (ctx) => { A.shadow(ctx, bx, by, 60, 0.28); A.blit(ctx, bale, bx - 48, by - 64); } }));
    sc.add(new Ale.Decor({ x: 760, y: FY, z: 24, draw: (ctx) => { A.shadow(ctx, 760, FY, 46, 0.3); A.blit(ctx, barrel, 760 - 36, FY - 88); } }));
    sc.add(new Ale.HeartPickup({ x: X.hay + 96, y: FY - 128 }));

    // ---- дверь на почту, конь, герои
    sc.add(new Ale.Door({ x: X.door, y: FY, id: 'yardDoor', range: 60, headH: 260, onUse: () => { Ale.Game.checkpoint('postOffice', 'exit'); Ale.Game.goto('postOffice', 'exit'); } }));
    const horse = sc.add(new Ale.Preslyukan({ x: X.horse, y: FY, facing: -1 }));
    sc.horse = horse; sc.actors.preslyukan = horse;                   // реплики коня идут от 'preslyukan': без привязки облачко «Фыр.» рисовалось плашкой внизу экрана (11.10.2026)
    const p = sc.add(new Ale.Player({ x: 480, y: FY, facing: 1 }));  // старт: правее левой группы экранных кнопок (≈ до 375 юн.): раньше героиня и Бубел в первые секунды стояли под ними (13.10.2026));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: 400, y: FY, facing: 1 }));

    Ale.YardStory.setup(sc, entry);
    return sc;
  };
})();
