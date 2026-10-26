// Взлёт: вечерняя полоса на фоне Парижа, самолёт разгоняется, отрывается от земли (шасси убираются) и уходит в небо; потом — салон:
// Алеся и Бубел смотрят в иллюминатор. Взлёт идёт под музыку, без звуковых эффектов. Заканчивается репликой, дальше — Киев (kyivApproach).
// Самолёт, облака, панорама города и салон — нарисованные картинки (plane_down/plane_up, cloud_a…d, view_paris_dusk, cabin_window).
// Время подогнано под трек takeoff: главная тема вступает на 8-й секунде (assets/audio/tracks.js, rise), поэтому нос поднимается в 7,6 с, а разгон долгий.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, AA = Ale.AirportArt;

  Ale.Scenes.takeoff = function (game) {
    const sc = new Ale.Scene(game, { id: 'takeoff', width: 1000, music: 'takeoff' });
    sc.hideHud = true; sc.noPause = false;
    const R = new Ale.Rng(31), S = Ale.Assets.sprites, IM = Ale.Assets.images, clamp = Ale.clamp;
    const CL = ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_d'];

    // ---- панорама вечернего Парижа (2048×512 → 1900×475 юнитов): верхняя кромка растворяется в небе; цвет неба над ней — её верхний цвет
    const dusk = IM['view_paris_dusk'];
    let topCol = '236,124,64';
    try {
      const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d');
      g.drawImage(dusk, 0, 0, dusk.width, 8, 0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data; topCol = d[0] + ',' + d[1] + ',' + d[2];
    } catch (e) { /* цвет по умолчанию */ }
    const PW = 1900, PH = Math.round(PW * dusk.height / dusk.width);
    const pan = A.layer(PW, PH, (g) => {
      g.imageSmoothingQuality = 'high'; g.drawImage(dusk, 0, 0, PW, PH);
      g.globalCompositeOperation = 'destination-in';
      const m = g.createLinearGradient(0, 0, 0, PH); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.22, 'rgba(0,0,0,1)');
      g.fillStyle = m; g.fillRect(0, 0, PW, PH);
    }, 1);
    const stars = []; for (let i = 0; i < 70; i++) stars.push([R.range(0, 1700), R.range(0, 300), R.range(0.6, 1.6), R.range(0.3, 0.9)]);
    // терминал — то же здание, что на скачке и на площади (Ale.AirportArt.terminalFacade), в вечерних тонах: холодный тон и тёплый свет из окон
    const term = A.layer(564, 208, (g, w, h) => {
      g.save(); g.scale(w / 940, h / 346); AA.terminalFacade(g, 940, 346, { door: true }); g.restore();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(64,42,96,0.52)'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, h * 0.28, 0, h * 0.86); gr.addColorStop(0, 'rgba(255,196,120,0.55)'); gr.addColorStop(1, 'rgba(255,170,90,0.12)');
      g.fillStyle = gr; g.fillRect(w * 0.03, h * 0.28, w * 0.94, h * 0.58);
      g.globalCompositeOperation = 'source-over';
    }, 1.5);

    // вид из иллюминатора: закатное небо, облака проплывают навстречу
    function skyView(ctx, W, H, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3b2f7d'); g.addColorStop(0.42, '#c8567a'); g.addColorStop(0.74, '#f59a68'); g.addColorStop(1, '#ffd08a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 7; i++) {
        const cx = W + 240 - ((t * (60 + i * 22) + i * 250) % (W + 640)), cy = 110 + (i % 4) * 105;
        Ale.drawSprite(ctx, CL[i % 4], cx, cy, { sx: 0.9, sy: 0.9 });
      }
    }

    sc.back.push((ctx) => {
      const W = game.viewW, H = game.viewH, t = sc.time;
      const R0 = 7.6;                                                       // отрыв от земли
      const rot = clamp((t - R0) / 3, 0, 1);
      const climb = Ale.ease.inOutQuad(clamp((t - R0) / 5.5, 0, 1));        // 0 — на полосе, 1 — в небе
      const gy = climb * 420;                                               // земля уезжает вниз
      const horizon = 566 + gy * 0.9, pTop = horizon - PH;                  // нижний край панорамы (за полосой) и верхний
      // небо: над панорамой — вечерний индиго, к верхней кромке панорамы переходит в её цвет
      const sk = ctx.createLinearGradient(0, pTop - 430, 0, pTop + 30);
      sk.addColorStop(0, '#16194f'); sk.addColorStop(0.55, '#5a3a86'); sk.addColorStop(1, 'rgb(' + topCol + ')');
      ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
      for (const [x, y, r, a] of stars) { if (y > pTop - 60) continue; ctx.fillStyle = 'rgba(255,255,235,' + (a * (0.35 + 0.65 * climb)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x % W, y, r, 0, 6.3); ctx.fill(); }
      ctx.drawImage(pan.c, (W - PW) / 2, pTop, PW, PH);
      // выше — небо темнеет
      { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(14,16,50,' + (climb * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(14,16,50,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(term.c, -20 - t * 6, 560 + gy - 208 + 26, 564, 208);
      // полоса и огни
      const y0 = 560 + gy;
      ctx.fillStyle = '#3d3d4e'; ctx.fillRect(0, y0, W, 200); ctx.fillStyle = '#50506a'; ctx.fillRect(0, y0, W, 5);
      ctx.fillStyle = '#26222f'; ctx.fillRect(0, y0 + 200, W, H);            // ниже полосы — тёмная земля
      ctx.fillStyle = '#26222f'; ctx.fillRect(0, 470 + gy + 150, W, 20);
      const off = (t < 1 ? 0 : (0.5 * clamp(t - 1, 0, 6.6) * clamp(t - 1, 0, 6.6) * 79 + Math.max(0, t - R0) * 520));
      ctx.fillStyle = 'rgba(255,240,200,0.8)'; for (let x = -((off) % 220) - 220; x < W; x += 220) ctx.fillRect(x, y0 + 84, 110, 8);
      for (let x = -((off * 1.4) % 130) - 130; x < W; x += 130) { ctx.fillStyle = '#ffd56a'; ctx.beginPath(); ctx.arc(x, y0 + 26, 5, 0, 6.3); ctx.fill(); A.glow(ctx, x, y0 + 26, 22, 'rgba(255,213,106,', 0.5); }
      // самолёт: разгон → отрыв (шасси убираются) → набор высоты. Точка привязки спрайта — середина фюзеляжа
      const run = Ale.ease.inQuad(clamp((t - 1) / 6.6, 0, 1));
      const cx = 70 + run * (W * 0.56) + climb * (W * 0.5), cy = y0 - 21 - climb * 300 - Math.max(0, rot) * 40;
      const tilt = -rot * 0.22 * (1 - climb * 0.45);
      if (climb < 0.4) { ctx.save(); ctx.globalAlpha = 0.3 * (1 - climb * 2.4); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx - 10, y0 + 40, 200 - climb * 100, 9, 0, 0, 6.3); ctx.fill(); ctx.restore(); }        // тень лежит на земле прямо под шасси (колёса на y0 + 30): раньше она была на 80 юн. ниже самолёта и висела отдельно на полосе
      Ale.drawSprite(ctx, t < R0 + 1.0 ? 'plane_down' : 'plane_up', cx, cy, { rot: tilt });
      // облака в верхней фазе
      if (climb > 0.35) for (let i = 0; i < 6; i++) {
        const nx = W - ((t * (90 + i * 40) + i * 330) % (W + 600)) + 100;
        ctx.globalAlpha = clamp((climb - 0.35) * 2, 0, 0.95); Ale.drawSprite(ctx, CL[(i + 1) % 4], nx, 150 + (i % 3) * 120 + climb * 40, { sx: 0.8, sy: 0.8 }); ctx.globalAlpha = 1;
      }
      // салон: Алеся и Бубел у иллюминатора; в окне — закатное небо
      const ca = clamp((t - (R0 + 1.4)) / 1.0, 0, 1);
      if (ca > 0) {
        ctx.save(); ctx.globalAlpha = ca;
        skyView(ctx, W, H, t);
        const cs = Math.max(W / 800, H / 600), cw = 800 * cs, ch = 600 * cs;
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(S.cabin_window.img, (W - cw) / 2, -ch * 0.01, cw, ch);
        A.vignette(ctx, W, H, 0.3);
        ctx.restore();
      }
      // подпись маршрута
      const ta = clamp((t - (R0 + 4.0)) / 1.0, 0, 1), tb = clamp((R0 + 8.2 - t) / 0.8, 0, 1);
      if (ta > 0) {
        ctx.save(); ctx.globalAlpha = Math.min(ta, tb); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.font = 'bold 46px ' + Ale.FONT;
        const tw = ctx.measureText('Париж → Киев').width + 64;
        Ale.rr(ctx, W / 2 - tw / 2, 8, tw, 62, 31); ctx.fillStyle = 'rgba(43,26,32,0.62)'; ctx.fill();            // над головой героини и над окном: они начинаются ниже
        ctx.lineWidth = 9; ctx.strokeStyle = '#2b1a20'; ctx.strokeText('Париж → Киев', W / 2, 40);
        const g = ctx.createLinearGradient(0, 22, 0, 58); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffb45a'); ctx.fillStyle = g; ctx.fillText('Париж → Киев', W / 2, 40);
        ctx.restore();
      }
    });
    // взлёт идёт под музыку, без звуковых эффектов: только картинка и реплика в конце
    sc.runScript(function* () {
      yield Ale.Wait.time(12.6);
      Ale.UI.say(Ale.T.takeoff);
      yield () => !Ale.UI.dlg;
      Ale.Game.checkpoint('kyivApproach', 'start');                     // из салона — в Киев: плашка «Киев», сообщение Илюшкинса, дорога к парку
      Ale.Game.goto('kyivApproach', 'start', { fade: 1.0 });
    });
    return sc;
  };
})();
