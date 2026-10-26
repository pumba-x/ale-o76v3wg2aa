// Снимок очками Ray-Ban Meta (комната-сюрприз): героиня снимает семью от первого лица — белая вспышка, затвор, и поверх игры выезжает карточка-«полароид» с настоящим кадром сцены (без героини:
// она за камерой) и подписью. Закрывается по действию (после первой секунды) или сама через 6 секунд. Модуль устроен как остальные окна на весь экран (busy / update(dt) / draw(ctx, W, H) / reset()); мир на время снимка стоит.
//   yield Ale.Photo.play(sc, 'Подпись');   — сценарий ждёт, пока карточка закроется. Время — только по dt.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const FLASH = 0.28, SLIDE = 0.55, MIN_OPEN = 1.0, AUTO = 6.0;
  const PW = 800, PH = 450;                                           // размер снимка в пикселях (16:9)

  // Снимок текущего вида сцены на отдельный холст: рисует сцену целиком, героиню прячет (она за камерой)
  function snap(sc) {
    const G = Ale.Game, c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const g = c.getContext('2d');
    const s = Math.max(PW / G.viewW, PH / G.viewH), ox = (PW - G.viewW * s) / 2, oy = (PH - G.viewH * s) / 2;
    const p = sc.player, was = p && p.hidden; if (p) p.hidden = true;
    g.fillStyle = '#000'; g.fillRect(0, 0, PW, PH);
    g.save(); g.setTransform(s, 0, 0, s, ox, oy); g.beginPath(); g.rect(0, 0, G.viewW, G.viewH); g.clip();
    try { sc.draw(g, 1); } finally { if (p) p.hidden = !!was; }
    g.restore();
    return c;
  }

  const Photo = (Ale.Photo = {
    busy: false, t: 0, done: true, img: null, caption: '',
    snap,
    play(sc, caption) {
      this.img = snap(sc); this.caption = caption || ''; this.busy = true; this.t = 0; this.done = false;
      Ale.Audio.sfx('shutter');
      Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null;
      const me = this; return { update: () => me.done };
    },
    reset() { this.busy = false; this.done = true; this.img = null; },
    update(dt) {
      if (!this.busy) return;
      this.t += dt;
      const tp = Ale.UI ? Ale.UI.tapPoint : null; if (Ale.UI) Ale.UI.tapPoint = null;
      const I = Ale.Input;
      const adv = I.pressed('interact') || I.pressed('jump') || I.pressed('attack') || I.edge('Enter') || I.edge('Space') || !!tp;          // Esc и P — пауза, не «дальше»
      if ((this.t > MIN_OPEN && adv) || this.t > AUTO) { this.busy = false; this.done = true; this.img = null; Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null; }
    },
    draw(ctx, W, H) {
      if (!this.busy) return;
      const t = this.t, T = Ale.T.monaco;
      const dim = Ale.clamp((t - FLASH * 0.5) / 0.3, 0, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(14,8,20,' + (0.62 * dim).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      // карточка: выезжает снизу и чуть поворачивается
      const k = Ale.ease.outCubic(Ale.clamp((t - FLASH * 0.6) / SLIDE, 0, 1));
      const cw = Math.min(W * 0.62, 640), ch = cw * (PH / PW) + 96, cx = W / 2, cy = H / 2 - 6 + (1 - k) * (H * 0.9);
      ctx.translate(cx, cy); ctx.rotate(-0.045 * k + 0.12 * (1 - k));
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; Ale.rr(ctx, -cw / 2 + 8, -ch / 2 + 14, cw, ch, 10); ctx.fill();
      ctx.fillStyle = '#fbf7ee'; Ale.rr(ctx, -cw / 2, -ch / 2, cw, ch, 10); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2b1a20'; ctx.stroke();
      const iw = cw - 40, ih = iw * (PH / PW), ix = -cw / 2 + 20, iy = -ch / 2 + 20;
      if (this.img) {
        // «проявка»: снимок проступает за секунду
        ctx.save(); Ale.rr(ctx, ix, iy, iw, ih, 4); ctx.clip();
        ctx.fillStyle = '#d8d3c8'; ctx.fillRect(ix, iy, iw, ih);
        ctx.globalAlpha = Ale.clamp((t - FLASH - SLIDE * 0.4) / 1.0, 0, 1); ctx.drawImage(this.img, ix, iy, iw, ih);
        ctx.restore(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(43,26,32,0.85)'; Ale.rr(ctx, ix, iy, iw, ih, 4); ctx.stroke();
      }
      ctx.fillStyle = '#3a2431'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'italic bold ' + Math.round(cw * 0.05) + 'px ' + Ale.FONT;
      ctx.fillText(this.caption, 0, iy + ih + (ch - 20 - ih - 20) / 2 + 8);
      ctx.restore();
      // вспышка: белая заливка, быстро гаснет
      if (t < FLASH) { ctx.fillStyle = 'rgba(255,255,255,' + (0.95 * (1 - t / FLASH)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      // подсказка
      if (t > MIN_OPEN) { ctx.font = '600 20px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(43,26,32,0.85)'; const hint = Ale.tx(T.photoClose); ctx.strokeText(hint, W / 2, H - 22); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fillText(hint, W / 2, H - 22); }
      ctx.restore();
    },
  });
})();
