// Короткий переезд между городами (3–5 секунд, не уровень): затемнение, чёрный Mercedes-Maybach «Uber» (та же машина, что в Киеве и в Монако) на дороге вдоль моря и плашка с названием города.
// Два маршрута: «monaco» (из Киева в Монако) и «coast» (из Монако на побережье, такси). Свет у каждого свой и совпадает с соседними сценами (13.10.2026, проверка реплик: раньше оба шли ночью и с бирюзовым
// хэтчбеком: из дневного Киева — в звёздную ночь — на дневную улицу Монако, а берег после второго переезда — закат): «monaco» — день (улица Монако дневная), «coast» — закат (берег на закате).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;

  const ROUTES = {
    monaco: { title: () => Ale.T.transit.monaco, next: ['monacoStreet', 'arrival'], length: 3.8, look: 'day' },
    coast: { title: () => Ale.T.transit.coast, next: ['coast', 'start'], length: 4.6, look: 'sunset' },
  };
  // Краски по свету: небо, горы (огоньки в окнах — только когда темнеет), море и блики, дорога, фонарные столбы
  const LOOK = {
    day: { sky: [[0, '#4a9de4'], [0.6, '#8fcaf0'], [1, '#f9e6c4']], hills: '#5b79a3', lit: false, sea: [[0, '#cfe9f3'], [0.18, '#48a0dc'], [1, '#1f66ae']], glint: 'rgba(255,255,255,',
           road: '#4b4958', edge: '#6c6a7a', dash: 'rgba(255,255,255,0.85)', pole: '#2b2833', glow: 0, beam: 0.12 },
    sunset: { sky: [[0, '#5a4a9a'], [0.5, '#d9708a'], [1, '#ffbb6e']], hills: '#4a3560', lit: true, sea: [[0, '#ffb27a'], [0.18, '#7a6fb0'], [1, '#2b3f86']], glint: 'rgba(255,214,150,',
              road: '#38303f', edge: '#524a5c', dash: 'rgba(255,236,170,0.8)', pole: '#18141d', glow: 0.5, beam: 0.3 },
  };

  Ale.Scenes.transit = function (game, entry) {
    const R = ROUTES[entry] || ROUTES.monaco, K = LOOK[R.look];
    const sc = new Ale.Scene(game, { id: 'transit', width: 1000, music: 'airport' });
    sc.hideHud = true;
    const rng = new Ale.Rng(55);
    const hills = A.layer(1700, 300, (g, w, h) => {                    // силуэт гор (повторяется по ширине); на закате в склонах зажигаются огоньки
      // частоты — целое число периодов на ширину слоя: профиль замыкается в кольцо (при прежних 0,006 / 0,017 / 0,04 правый край не совпадал с левым, и горы «прыгали» на стыке каждые 1700 юн.)
      const f = (k) => 2 * Math.PI * k / w, prof = (x) => 120 + 60 * Math.sin(x * f(2)) + 40 * Math.sin(x * f(5) + 1.3) + 20 * Math.sin(x * f(11));
      g.fillStyle = K.hills; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, prof(x));
      g.lineTo(w, h); g.closePath(); g.fill();
      // огоньки — только на склоне, под гребнем (раньше часть светилась в небе над горами)
      if (K.lit) for (let i = 0; i < 90; i++) { const lx = rng.range(0, w), top = prof(lx) + 8, a = rng.range(0.4, 0.95), ly = rng.range(Math.max(150, top), 285), sw = rng.range(1.5, 3), sh = rng.range(1.5, 3); if (top > 280) continue; g.fillStyle = 'rgba(255,214,140,' + a.toFixed(2) + ')'; g.fillRect(lx, ly, sw, sh); }
    }, 1);
    const car = Ale.CarArt ? Ale.CarArt.sprite(Ale.Touch && Ale.Touch.active ? 1.2 : 1.6) : null;

    sc.back.push((ctx) => {
      const W = game.viewW, H = game.viewH, t = sc.time;
      const sky = ctx.createLinearGradient(0, 0, 0, 430); for (const [o, c] of K.sky) sky.addColorStop(o, c);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // горы медленно уезжают назад
      const off = (t * 26) % 1700;
      ctx.drawImage(hills.c, -off, 190, 1700, 300); ctx.drawImage(hills.c, 1700 - off, 190, 1700, 300);
      // море: полоса с бликами
      const sea = ctx.createLinearGradient(0, 430, 0, 560); for (const [o, c] of K.sea) sea.addColorStop(o, c);
      ctx.fillStyle = sea; ctx.fillRect(0, 430, W, 140);
      for (let i = 0; i < 26; i++) { const sx = ((i * 83 - t * 70) % (W + 80) + W + 80) % (W + 80) - 40, sy = 440 + (i * 37) % 120; ctx.fillStyle = K.glint + (0.15 + 0.2 * Math.sin(t * 3 + i)).toFixed(2) + ')'; ctx.fillRect(sx, sy, 22 + (i % 4) * 10, 2); }
      // дорога
      ctx.fillStyle = K.road; ctx.fillRect(0, 568, W, H - 568);
      ctx.fillStyle = K.edge; ctx.fillRect(0, 568, W, 6);
      ctx.fillStyle = K.dash; const dash = (t * 460) % 150; for (let x = -150 + dash; x < W; x += 150) ctx.fillRect(x, 652, 80, 7);
      // фонари вдоль дороги пролетают; ряд замкнут по ширине кадра с запасом за обоими краями (был по 1280: на виде шире 1420 юнитов фонарь рождался посреди кадра, а правее 1140 их не было вовсе — 27.10.2026)
      const span = Math.ceil((W + 280) / 320) * 320;
      for (let i = 0; i < span / 320; i++) {
        const lx = ((i * 320 - t * 340) % span + span) % span - 140;
        ctx.fillStyle = K.pole; ctx.fillRect(lx - 3, 410, 6, 160); ctx.fillRect(lx - 3, 410, 38, 6);
        if (K.glow) A.glow(ctx, lx + 34, 420, 70, 'rgba(255,214,140,', K.glow);
      }
      // машина — та же чёрная «Uber», что в Киеве и в Монако: покачивается на ходу, колёса крутятся, фары светят (спрайт стоит на месте — едет всё вокруг)
      const cx = W * 0.5 + Math.sin(t * 0.9) * 8, cy = 676 + Math.sin(t * 11) * 1.2;
      if (car) {
        const C = Ale.CarArt.C;
        car.draw(ctx, cx, cy, { dx: 0, door: 0 });
        for (const wx of [-C.WB, C.WB]) Ale.CarArt.drawWheel(ctx, cx + wx, cy + C.WY, t * 340 / C.R);          // колёса — по пройденному миром пути (дорога бежит 340 юн./с)
        A.glow(ctx, cx + 150, cy - 66, 24, 'rgba(255,250,222,', 0.9);
        A.beam(ctx, cx + 152, cy - 62, 14, cx + 600, cy - 30, 150, K.beam + 0.1, 'rgba(255,246,206,');
      }
      // название города: появляется на второй секунде и уходит перед концом
      const T = R.title(), ta = Ale.clamp((t - 1.2) / 0.7, 0, 1), tb = Ale.clamp((R.length - 0.6 - t) / 0.6, 0, 1), a = Math.min(ta, tb);
      if (a > 0) {
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.font = 'bold 84px ' + Ale.FONT; ctx.lineWidth = 14; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(T[0], W / 2, 190);
        const g = ctx.createLinearGradient(0, 150, 0, 230); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffb45a'); ctx.fillStyle = g; ctx.fillText(T[0], W / 2, 190);
        ctx.font = 'bold 30px ' + Ale.FONT; ctx.lineWidth = 8; ctx.strokeText(T[1], W / 2, 252); ctx.fillStyle = '#fff6e4'; ctx.fillText(T[1], W / 2, 252);
        ctx.restore();
      }
    });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.4));

    sc.runScript(function* () {
      yield Ale.Wait.time(R.length);
      Ale.Game.goto(R.next[0], R.next[1], { fade: 0.8 });
    });
    return sc;
  };
})();
