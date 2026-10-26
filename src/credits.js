// Титры (комната-сюрприз, финал): наложение поверх игры — затемнение, название и строки идут снизу вверх, поверх плывут сердечки. Закрываются сами в конце или по действию (E / Enter / Пробел / касание)
// после первой секунды; комната остаётся, песня `finale` продолжает играть. Модуль устроен как остальные окна на весь экран (busy / update(dt) / draw(ctx, W, H) / reset()); мир на время титров стоит.
//   yield Ale.Credits.play();   — сценарий ждёт, пока титры закроются. Все надписи — в Ale.T.credits (src/text.js). Время — только по dt, косметика — Ale.fxRng.
// Название — тот же нарисованный логотип, что на заставке (assets/images/logo_ale_game.png), на тёплом свечении: мерцают искры, один раз по буквам пробегает блик, под ним линия с сердечком. Нет картины — прежняя надпись шрифтом.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const SPEED = 54, HOLD_END = 2.4, MIN_OPEN = 1.0, ROW = 74;
  const TITLE_Y = 20, LINES_Y = 190;              // смещения от нижней кромки кадра (в начале титров): центр названия и первая строка стиха
  const LOGO_W = 640;                             // ширина логотипа в юнитах (картина 1400×525, буквы занимают ≈ 90 % ширины)
  // блики на логотипе — те же места, что на заставке (пиксели картинки): две звёздочки и сердечко
  const LOGO_GLINTS = [[112, 164, 1.0], [1304, 193, 0.9], [642, 143, 0.8]];
  // искры вокруг букв: смещение от центра названия, размер, фаза мерцания
  const SPARKS = [[-352, -58, 11, 0.0], [350, -74, 9, 1.7], [-262, 84, 8, 3.1], [272, 88, 10, 4.4], [-118, -106, 7, 5.5], [136, -104, 8, 0.9]];

  function heart(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.38);
    ctx.bezierCurveTo(x - s * 1.15, y - s * 0.25, x - s * 0.55, y - s * 1.0, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.0, x + s * 1.15, y - s * 0.25, x, y + s * 0.38); ctx.closePath();
  }
  // четырёхконечная звёздочка с вогнутыми сторонами
  function star(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.12, y - s * 0.12, x + s, y); ctx.quadraticCurveTo(x + s * 0.12, y + s * 0.12, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.12, y + s * 0.12, x - s, y); ctx.quadraticCurveTo(x - s * 0.12, y - s * 0.12, x, y - s); ctx.closePath();
  }

  const Credits = (Ale.Credits = {
    busy: false, t: 0, done: false, hearts: [], endT: 0,

    play() {
      if (this.busy && this._wait) return this._wait;          // уже идут: повторный вызов (пункт «Титры» из паузы поверх них) не начинает их заново с первой строки (18.10.2026)
      this.busy = true; this.t = 0; this.done = false; this.endT = 0; this.hearts = [];
      const me = this;
      Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null;
      return (this._wait = { update: () => me.done });
    },

    reset() { this.busy = false; this.done = true; this.hearts = []; this._wait = null; this._release(); },

    // копии логотипа в холстах (рисовать из них дешевле, чем из файла) нужны только пока идут титры
    _release() { this._lc = this._ls = this._sc = null; },

    // высота всего списка строк в юнитах (для конца прокрутки)
    _height() { const L = Ale.T.credits.lines; return LINES_Y + 10 + L.length * ROW; },

    update(dt) {
      if (!this.busy) return;
      this.t += dt;
      const R = Ale.fxRng;
      if (R.chance(dt * 7)) this.hearts.push({ x: R.range(0.08, 0.92), y: 1.05, v: R.range(0.05, 0.12), s: R.range(7, 15), a: R.range(0.25, 0.6), ph: R.range(0, 6.3) });
      for (const h of this.hearts) h.y -= h.v * dt;
      this.hearts = this.hearts.filter((h) => h.y > -0.1);
      const tp = Ale.UI ? Ale.UI.tapPoint : null; if (Ale.UI) Ale.UI.tapPoint = null;
      const I = Ale.Input;
      const adv = I.pressed('interact') || I.pressed('jump') || I.pressed('attack') || I.edge('Enter') || I.edge('Space') || !!tp;          // Esc и P — пауза, не «закрыть»
      if (this.t > MIN_OPEN && adv) { this._close(); return; }
      const total = this._height() + 720 * 0.9;
      if (this.t * SPEED > total) { this.endT += dt; if (this.endT > HOLD_END) this._close(); }
    },

    _close() { this.busy = false; this.done = true; this._release(); Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null; },

    _logo(im) {
      if (this._lc && this._ls === im) return this._lc;
      const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height; c.getContext('2d').drawImage(im, 0, 0);
      this._ls = im; return (this._lc = c);
    },

    // Название с центром букв в высоте ty: свечение → логотип (с бликом, когда проплывает середину кадра) → искры → линия с сердечком.
    _title(ctx, W, H, ty) {
      if (ty < -220 || ty > H + 220) return;
      const T = Ale.T.credits, im = Ale.Assets && Ale.Assets.images ? Ale.Assets.images['logo_ale_game'] : null;
      const t = this.t, a = Ale.clamp((H - ty) / 150, 0, 1), dy = ty + 112;               // название выплывает из-под нижнего края
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a;
      if (im) {
        const lw = LOGO_W, lh = lw * im.height / im.width, left = W / 2 - lw / 2, top = ty - lh * 0.495;
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
        ctx.save(); ctx.translate(W / 2, ty); ctx.scale(1, 0.34);                         // свечение: вытянутый тёплый овал за буквами
        const gl = ctx.createRadialGradient(0, 0, 20, 0, 0, 440);
        gl.addColorStop(0, 'rgba(255,198,126,' + (0.42 + 0.08 * pulse).toFixed(3) + ')'); gl.addColorStop(0.5, 'rgba(255,150,128,0.2)'); gl.addColorStop(1, 'rgba(255,150,128,0)');
        ctx.fillStyle = gl; ctx.fillRect(-440, -440, 880, 880); ctx.restore();
        const sh = (H * 0.58 - ty) / 60;                                                  // блик по буквам: на ≈ 1,1 с, когда название у середины кадра
        if (sh > 0 && sh < 1) {
          const ow = Math.round(lw * 2), oh = Math.round(lh * 2);
          if (!this._sc || this._sc.width !== ow || this._sc.height !== oh) { this._sc = document.createElement('canvas'); this._sc.width = ow; this._sc.height = oh; }
          const g = this._sc.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, ow, oh);
          g.imageSmoothingQuality = 'medium'; g.drawImage(this._logo(im), 0, 0, ow, oh);
          const bx = (-0.2 + 1.4 * sh) * ow, gr = g.createLinearGradient(bx - ow * 0.1, 0, bx + ow * 0.1, oh * 0.35);
          gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, ow, oh);
          ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(this._sc, left, top, lw, lh);
        } else { ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(this._logo(im), left, top, lw, lh); }
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff3c4';
        LOGO_GLINTS.forEach(([gx, gy, amp], i) => {                                       // вспышки на звёздочках и сердечке букв
          const k = Math.pow(Math.max(0, Math.sin(t * 2.6 + i * 2.3)), 8) * amp; if (k < 0.05) return;
          ctx.globalAlpha = a * 0.9 * k; star(ctx, left + gx / im.width * lw, top + gy / im.height * lh, 10 + 15 * k); ctx.fill();
        });
        SPARKS.forEach(([sx, sy, s, ph]) => {                                             // искры вокруг: мерцают по очереди
          const k = 0.5 + 0.5 * Math.sin(t * 2.2 + ph);
          ctx.globalAlpha = a * (0.2 + 0.7 * k); star(ctx, W / 2 + sx, ty + sy, s * (0.45 + 0.55 * k)); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      } else {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.font = 'bold 92px ' + Ale.FONT; ctx.lineWidth = 16; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(T.title, W / 2, ty);
        const g = ctx.createLinearGradient(0, ty - 46, 0, ty + 46); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffb45a'); ctx.fillStyle = g; ctx.fillText(T.title, W / 2, ty);
      }
      for (const s of [-1, 1]) {                                                          // тонкая линия, гаснущая к краям, и сердечко посередине
        const x0 = W / 2 + s * 24, x1 = W / 2 + s * 176, lg = ctx.createLinearGradient(x0, 0, x1, 0);
        lg.addColorStop(0, 'rgba(255,217,138,0.9)'); lg.addColorStop(1, 'rgba(255,217,138,0)');
        ctx.fillStyle = lg; ctx.fillRect(Math.min(x0, x1), dy - 1, Math.abs(x1 - x0), 2);
      }
      ctx.fillStyle = '#ff9db4'; heart(ctx, W / 2, dy, 9 + 1.2 * Math.sin(t * 3)); ctx.fill();
      ctx.restore();
    },

    draw(ctx, W, H) {
      if (!this.busy) return;
      const T = Ale.T.credits, k = Ale.clamp(this.t / 0.6, 0, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(16,9,24,' + (0.78 * k).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      // сердечки плывут вверх
      for (const h of this.hearts) { ctx.globalAlpha = h.a * k; ctx.fillStyle = '#ff9db4'; heart(ctx, h.x * W + Math.sin(this.t * 1.4 + h.ph) * 12, h.y * H, h.s); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const scroll = this.t * SPEED, base = H + 40;
      this._title(ctx, W, H, base + TITLE_Y - scroll);
      T.lines.forEach((l, i) => {
        const y = base + LINES_Y + i * ROW - scroll;
        if (y < -60 || y > H + 60) return;
        const fade = Ale.clamp(Math.min(y / 120, (H - y) / 90), 0, 1);
        ctx.globalAlpha = fade;
        if (l[1]) {
          ctx.font = 'bold 32px ' + Ale.FONT; ctx.lineWidth = 7; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(l[0], W / 2, y - 12); ctx.fillStyle = '#fff6e4'; ctx.fillText(l[0], W / 2, y - 12);
          ctx.font = '600 22px ' + Ale.FONT; ctx.lineWidth = 5; ctx.strokeText(l[1], W / 2, y + 20); ctx.fillStyle = '#ffd0de'; ctx.fillText(l[1], W / 2, y + 20);
        } else if (l[0]) {
          ctx.font = 'bold 36px ' + Ale.FONT; ctx.lineWidth = 8; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(l[0], W / 2, y); ctx.fillStyle = '#ffd98a'; ctx.fillText(l[0], W / 2, y);
        }
      });
      ctx.globalAlpha = 1;
      ctx.font = '600 20px ' + Ale.FONT; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(43,26,32,0.85)'; const hint = Ale.tx(T.skip); ctx.strokeText(hint, W / 2, H - 22); ctx.fillStyle = 'rgba(255,246,228,0.9)'; ctx.fillText(hint, W / 2, H - 22);
      ctx.restore();
    },
  });
})();
