// Лаборатория: пустая сцена для проверки движения, боя и масштаба (?scene=lab).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.Scenes.lab = function (game) {
    const sc = new Ale.Scene(game, { id: 'lab', width: 2600 });
    const W = sc.world;
    W.addSolid(-400, 600, 3400, 400, { kind: 'floor' });
    W.addSolid(-400, -200, 400, 1200);
    W.addSolid(2600, -200, 400, 1200);
    W.addOneWay(520, 480, 240, 18, { kind: 'plank' });
    W.addOneWay(900, 380, 240, 18, { kind: 'plank' });
    W.addSolid(1400, 500, 130, 100, { kind: 'crate' });

    sc.back.push((ctx, cam) => {
      const H = game.viewH, Wd = game.viewW;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f6e7c9'); g.addColorStop(1, '#e3b98f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, H);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      // линейка: вертикальные риски через 100
      ctx.strokeStyle = 'rgba(80,50,60,0.25)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(80,50,60,0.5)'; ctx.font = '12px monospace';
      for (let x = Math.floor(cam.x / 100) * 100; x < cam.x + Wd; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); ctx.fillText(String(x), x + 3, 14); }
      for (let y = 600; y > 0; y -= 50) { ctx.beginPath(); ctx.moveTo(cam.x, y); ctx.lineTo(cam.x + Wd, y); ctx.stroke(); ctx.fillText(String(600 - y), cam.x + 4, y - 3); }
      ctx.fillStyle = '#8a5d44'; for (const s of sc.world.solids) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#b98a5e'; for (const s of sc.world.oneways) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#5b3a2a'; ctx.fillRect(cam.x, 600, Wd, 4);
      ctx.restore();
    });

    sc.player = sc.add(new Ale.Player({ x: 200, y: 600 }));
    sc.add(new Ale.Rat({ x: 1100, y: 600, range: 160 }));
    sc.add(new Ale.Rat({ x: 1700, y: 600, range: 200, facing: -1 }));
    game.state.tomatoes = 6;
    return sc;
  };
})();

// Тренировочный бой с преподавательницей (?scene=bosslab).
(function () {
  'use strict';
  const Ale = window.Ale;
  Ale.Scenes.bosslab = function (game) {
    const sc = new Ale.Scene(game, { id: 'bosslab', width: 1900 });
    const W = sc.world;
    W.addSolid(-400, 600, 2700, 400, { kind: 'floor' });
    W.addSolid(-400, -200, 400, 1200);
    W.addSolid(1900, -200, 400, 1200);
    W.addOneWay(560, 490, 240, 18, { kind: 'plank' });
    W.addOneWay(1100, 490, 240, 18, { kind: 'plank' });
    sc.back.push((ctx, cam) => {
      const H = game.viewH, Wd = game.viewW;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2e4c9'); g.addColorStop(1, '#dcb388');
      ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, H);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      ctx.fillStyle = '#8a5d44'; for (const s of sc.world.solids) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#b98a5e'; for (const s of sc.world.oneways) ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.restore();
    });
    sc.player = sc.add(new Ale.Player({ x: 300, y: 600 }));
    const t = sc.add(new Ale.Teacher({ x: 1500, y: 600, arena: { x0: 140, x1: 1760 } }));
    t.startFight();
    game.state.tomatoes = 99;
    return sc;
  };
})();
