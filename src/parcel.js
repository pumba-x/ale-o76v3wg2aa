// Шкаф с посылками (стоит на почте с самого начала, за стеклом видна посылка), посылка с кодовым замком и сюжет финала почты:
// ключ → шкаф → записка над замком → код 314 → билет, фишка и яблоко.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;
  const WALL = 584;

  // ---------------------------------------------------------------- шкаф
  // Корпус и полки рисует сам шкаф (z 24), посылка стоит внутри (z 25), стеклянные дверцы поверх (Decor z 26).
  class Cabinet extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 180, h: 270, z: 24, id: 'cabinet' }, o));
      this.interactable = true; this.interactRange = 120; this.headH = 300;
      this.state = 'locked';        // locked | opening | open
      this.openT = 0;
      this.onInteract = o.onInteract;
      this.fall = 0;
      this.body = A.layer(this.w + 40, this.h + 30, (g) => this._paintBody(g), 2);
    }
    canInteract() { return this.state === 'locked'; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact(p) { if (this.onInteract) this.onInteract(p); }
    open() { this.state = 'opening'; this.openT = 0; Ale.Audio.sfx('cabinet_open'); }
    update(dt) {
      super.update(dt);
      if (this.state === 'opening') { this.openT += dt / 0.9; if (this.openT >= 1) { this.openT = 1; this.state = 'open'; } }
      if (this.state !== 'locked') this.fall += dt;
    }
    // геометрия внутренности: общая для корпуса и дверец
    geo() {
      const x0 = this.x - this.w / 2, y0 = WALL - this.h;
      return { x0, y0, ix: x0 + 12, iy: y0 + 14, iw: this.w - 24, ih: this.h - 40 };
    }
    // Корпус рисуем один раз в слой (координаты слоя: сдвиг на 20 по x и 20 по y от левого верха с полями)
    _paintBody(g) {
      const w = this.w, h = this.h, ox = 20, oy = 20;
      g.save(); g.translate(ox, oy);
      A.wood(g, 0, 0, w, h, { base: '#7a4e33', seed: 41, dir: 'v', lineGap: 9, knots: false, grain: 0.16 });
      g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(2, 2, w - 4, 4);
      A.box(g, -8, -12, w + 16, 16, { fill: '#a06a44', lw: 4, hi: 'rgba(255,255,255,0.3)' });          // карниз
      A.box(g, -4, h - 14, w + 8, 14, { fill: '#5f3b28', lw: 4 });                                        // цоколь
      const ix = 12, iy = 14, iw = w - 24, ih = h - 40;
      A.gradV(g, ix, iy, iw, ih, [[0, '#231620'], [1, '#3a2a2e']]);
      A.edge(g, ix, iy, iw, ih, 't', 26, 'rgba(0,0,0,0.5)');
      g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(ix, iy, iw, ih);
      const shelfY = [iy + ih * 0.36, iy + ih * 0.68];
      for (const sy of shelfY) A.box(g, ix, sy, iw, 9, { fill: '#8b5a3c', lw: 3, hi: 'rgba(255,255,255,0.2)' });
      // остальные посылки и свёртки на полках (нужная — на верхней полке в центре)
      for (const [dx, sy, ww, hh, c] of [[14, shelfY[0], 34, 24, '#b48a5c'], [iw - 50, shelfY[0], 34, 20, '#a8845a'], [16, shelfY[1], 42, 28, '#b48a5c'], [58, shelfY[1], 30, 36, '#c9a06a'], [iw - 62, shelfY[1], 44, 34, '#b48a5c'], [12, iy + ih, 44, 40, '#a8845a'], [iw - 58, iy + ih, 46, 38, '#c9a06a']]) {
        g.fillStyle = c; g.fillRect(ix + dx, sy - hh, ww, hh); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(ix + dx, sy - hh, ww, hh);
        g.strokeStyle = 'rgba(122,90,58,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ix + dx + ww / 2, sy - hh); g.lineTo(ix + dx + ww / 2, sy); g.stroke();
      }
      g.restore();
    }
    draw(ctx) {
      A.shadow(ctx, this.x, WALL, 110, 0.34);
      A.blit(ctx, this.body, this.x - this.w / 2 - 20, WALL - this.h - 20);
      // тёплый свет изнутри при открытии
      if (this.openT > 0) { const G = this.geo(); ctx.save(); ctx.globalAlpha = 0.28 * this.openT; A.glow(ctx, this.x, G.iy + G.ih * 0.5, 140, 'rgba(255,214,140,', 0.7); ctx.restore(); }
    }
    // Стеклянные дверцы и замок: рисуются поверх содержимого. Неподвижные состояния (заперт; открыт и замок упал) рисуются один раз в слой,
    // анимация открытия и падения замка — каждый кадр.
    drawFront(ctx) {
      const still = this.state === 'locked' || (this.state === 'open' && this.fall >= 0.6);
      if (!still) return this._drawFront(ctx);
      this._front = this._front || {};
      let L = this._front[this.state];
      const ox = this.x - this.w / 2 - 20, oy = WALL - this.h - 20;
      if (!L) L = this._front[this.state] = A.layer(this.w + 40, this.h + 40, (g) => { g.translate(-ox, -oy); this._drawFront(g); }, 2);
      A.blit(ctx, L, ox, oy);
    }
    _drawFront(ctx) {
      const G = this.geo();
      const k = Ale.ease.inOutQuad(this.openT), dw = (G.iw / 2) * (1 - k * 0.92);
      for (const side of [-1, 1]) {
        const dx = side < 0 ? G.ix : G.ix + G.iw - dw;
        // рама створки: дерево «с окном» (кольцо между внешним прямоугольником и стеклом), сквозь стекло видно посылку
        const hasGlass = dw > 26, gx = dx + 8, gy = G.iy + 9, gw = dw - 16, gh = G.ih - 18;
        ctx.save(); ctx.beginPath(); ctx.rect(dx, G.iy, dw, G.ih);
        if (hasGlass) ctx.rect(gx, gy, gw, gh);
        ctx.clip('evenodd');
        A.wood(ctx, dx, G.iy, dw, G.ih, { base: k > 0.5 ? '#6a422c' : '#8b5a3c', seed: side < 0 ? 44 : 45, dir: 'v', knots: false, grain: 0.14 });
        ctx.restore();
        if (hasGlass) {
          ctx.fillStyle = 'rgba(150,196,214,0.16)'; ctx.fillRect(gx, gy, gw, gh);
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(gx + 6, gy + gh); ctx.lineTo(gx + 6 + gw * 0.45, gy); ctx.lineTo(gx + 6 + gw * 0.62, gy); ctx.lineTo(gx + 6 + gw * 0.17, gy + gh); ctx.fill();
          ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(gx, gy, gw, gh);
          ctx.strokeStyle = 'rgba(43,26,32,0.75)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(gx + gw / 2, gy); ctx.lineTo(gx + gw / 2, gy + gh); ctx.moveTo(gx, gy + gh * 0.5); ctx.lineTo(gx + gw, gy + gh * 0.5); ctx.stroke();
        }
        ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.strokeRect(dx, G.iy, dw, G.ih);
        if (dw > 22) { ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(side < 0 ? dx + dw - 9 : dx + 9, G.iy + G.ih * 0.5, 4.2, 0, 6.3); ctx.fill(); ctx.stroke(); }
      }
      // замок: висит на дверцах, после открытия падает
      if (this.state === 'locked' || this.fall < 0.6) {
        const fy = this.state === 'locked' ? 0 : this.fall * this.fall * 900;
        const a = this.state === 'locked' ? 1 : Math.max(0, 1 - this.fall / 0.6);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(this.x, G.iy + G.ih * 0.5 + 18 + fy); ctx.rotate(this.state === 'locked' ? 0 : this.fall * 5);
        ctx.strokeStyle = '#b8bcc8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -10, 10, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.stroke();
        A.box(ctx, -14, -6, 28, 24, { fill: '#d9a441', lw: 3, r: 4, hi: 'rgba(255,255,255,0.4)' });
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, 5, 3, 0, 6.3); ctx.fill(); ctx.fillRect(-1.2, 5, 2.4, 7);
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- посылка (на верхней полке, за стеклом)
  class Parcel extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 90, h: 64, z: 25, id: 'parcel' }, o));
      this.interactable = true; this.interactRange = 120; this.interactDY = 220; this.headH = 80; this.promptY = 92;
      this.onInteract = o.onInteract;
      this.enabled = false;         // пока шкаф заперт, до посылки не дотянуться
      this.opened = 0; this.taken = false;
    }
    canInteract() { return this.enabled && !this.opening && !this.taken; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact(p) { if (this.onInteract) this.onInteract(p); }
    update(dt) { super.update(dt); if (this.opening) this.opened = Math.min(1, this.opened + dt / 0.6); }
    draw(ctx) {
      if (this.taken) return;
      // до открытия посылка неподвижна: рисуется один раз в слой; во время открытия (створки крышки) — каждый кадр
      if (this.opened === 0) {
        if (!this._closed) this._closed = A.layer(120, 96, (g) => { g.translate(60, 80); this._paint(g); }, 2);
        A.blit(ctx, this._closed, this.x - 60, this.y - 80);
        return;
      }
      ctx.save(); ctx.translate(this.x, this.y); this._paint(ctx); ctx.restore();
    }
    // Посылка в локальных координатах (опора — низ по центру)
    _paint(ctx) {
      const bw = 92, bh = 62;
      // коробка из крафт-бумаги
      A.box(ctx, -bw / 2, -bh, bw, bh, { fill: '#c9a06a', lw: 4, hi: 'rgba(255,255,255,0.22)', lo: 'rgba(0,0,0,0.18)' });
      A.grain(ctx, -bw / 2, -bh, bw, bh, 0.2, 'overlay', 14);
      // крышка: створки поднимаются при открытии
      const lift = Ale.ease.outCubic(this.opened);
      if (lift > 0) {
        for (const side of [-1, 1]) {
          ctx.save(); ctx.translate(side * bw / 2, -bh); ctx.rotate(side * lift * 1.9);
          ctx.fillStyle = '#d6ae76'; ctx.fillRect(side < 0 ? 0 : -bw / 2, -6, bw / 2, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(side < 0 ? 0 : -bw / 2, -6, bw / 2, 8); ctx.restore();
        }
      }
      // бечёвка крест-накрест
      ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -bh); ctx.lineTo(0, 0); ctx.moveTo(-bw / 2, -bh * 0.5); ctx.lineTo(bw / 2, -bh * 0.5); ctx.stroke();
      ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
      // ярлык и штамп
      ctx.fillStyle = '#fff6e4'; ctx.fillRect(-bw / 2 + 8, -bh + 10, 34, 22); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(-bw / 2 + 8, -bh + 10, 34, 22);
      ctx.fillStyle = 'rgba(43,26,32,0.5)'; for (let i = 0; i < 3; i++) ctx.fillRect(-bw / 2 + 12, -bh + 15 + i * 6, 26 - i * 5, 2.2);
      ctx.save(); ctx.translate(bw / 2 - 26, -bh + 22); ctx.rotate(-0.25); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.2; ctx.strokeRect(-17, -9, 34, 18); ctx.fillStyle = '#c0392b'; ctx.font = 'bold 9px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PARIS', 0, 0); ctx.restore();
      // кодовый замок с тремя колёсиками
      A.box(ctx, -26, -22, 52, 20, { fill: '#d9a441', lw: 3, r: 4, hi: 'rgba(255,255,255,0.4)' });
      for (let i = -1; i <= 1; i++) { ctx.fillStyle = '#fff6e4'; ctx.fillRect(i * 15 - 6, -19, 12, 14); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.strokeRect(i * 15 - 6, -19, 12, 14); ctx.fillStyle = OUT; ctx.font = 'bold 10px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.opened > 0.3 ? String([3, 1, 4][i + 1]) : '?', i * 15, -12); }
    }
  }

  // ---------------------------------------------------------------- сюжет
  Ale.PostParcel = {
    // Общее для всех входов: шкаф и посылка уже стоят в комнате (создаёт сцена). Здесь — что происходит после возврата ключа.
    setup(sc, e, entry) {
      const { G, F, UI, T, W, p, bubel, X, tx } = e;
      const cab = sc.cabinet, parcel = sc.parcel;
      const frame = { get x() { return (p.x + X.cabinet) / 2; }, y: 600, vx: 0 };   // в кадре и Алеся, и шкаф

      function* openCabinet() {
        sc.locked = true; UI.clearHints();
        sc.cameraTarget = frame;
        p.facing = X.cabinet >= p.x ? 1 : -1;
        yield W.time(0.35);
        p.holdSprite = null; Ale.Audio.sfx('key_use');       // Алеся сама вставляет ключ и открывает шкаф
        cab.open();
        yield W.time(1.1);
        parcel.enabled = true;
        sc.fx.sparks(parcel.x, parcel.y - 30, 10);
        sc.cameraTarget = null;
        sc.locked = false;
        UI.hint('bubel', tx(T.hint.parcelShelf), 6);
      }

      function* openParcel() {
        sc.locked = true; UI.clearHints();
        const lock = UI.codeLock({
          answer: [3, 1, 4],
          note: { lines: T.parcelNote.lines, picture: [{ sprite: 'it_cup', n: 3, scale: 0.95 }, { sprite: 'it_apple', n: 1, scale: 1.15 }, { sprite: 'it_berry', n: 4, scale: 0.9, cols: 2 }] },
          wrong: T.parcelWrong, wrongHint: T.parcelWrongHint,
        });
        yield lock;
        if (lock.read && !F.note_seen) G.set('note_seen');
        if (!lock.ok) { sc.locked = false; if (lock.fails >= 3) UI.hint('bubel', T.hint.parcelCount, 4.5); return; }
        // посылка открывается: билет, фишка и яблоко
        sc.locked = true;
        Ale.Audio.sfx('parcel_open');
        parcel.opening = true;
        sc.camera.shake(4, 0.3);
        yield W.time(0.5);
        sc.fx.confetti(parcel.x, parcel.y - 50, 60);
        Ale.Audio.sfx('fanfare');
        const items = sc.add(new Ale.Decor({ x: parcel.x, y: parcel.y, z: 70, draw: (ctx, d) => {
          const k = Ale.clamp(d.t / 1.1, 0, 1), up = Ale.ease.outCubic(k) * 86;
          Ale.drawSprite(ctx, 'it_ticket', parcel.x - 74 * k, parcel.y - 40 - up, { rot: -0.12 * k, sx: 0.9, sy: 0.9 });
          Ale.drawSprite(ctx, 'it_chip', parcel.x + 74 * k, parcel.y - 40 - up * 0.9, { rot: d.t * 3, sx: 0.85, sy: 0.85 });
          Ale.drawSprite(ctx, 'it_apple', parcel.x, parcel.y - 46 - up * 1.15, { rot: Math.sin(d.t * 3) * 0.15, sx: 1, sy: 1 });
          Ale.drawSprite(ctx, 'it_candy', parcel.x + 4, parcel.y - 34 - up * 0.36, { rot: -0.06 * k, sx: 0.85, sy: 0.85 });         // пасхалка: конфеты Стрелы (не предмет игры, остаются в посылке)
        } }));
        yield W.time(1.5);
        items.dead = true; parcel.taken = true;
        UI.toast(T.toast.parcel, 'it_apple');
        UI.clearHints();
        UI.setObjective(T.obj.yard);                                       // посылка открыта — цель уже «выйти»: прежняя «Открыть посылку» не висит весь разговор
        yield UI.say(T.parcelOpen);
        p.holdSprite = 'it_apple';
        G.set('parcel_opened'); G.set('has_apple');
        sc.backDoor.locked = false; sc.backDoor.arrow = true;
        G.checkpoint('postOffice', 'exit');
        sc.locked = false;
        UI.hint('bubel', T.hint.backGo, 6);
      }

      cab.onInteract = () => sc.runScript(openCabinet);
      parcel.onInteract = () => sc.runScript(openParcel);
      if (entry === 'parcel') {
        G.checkpoint('postOffice', 'parcel');
        p.x = X.hatch - 170; bubel.x = p.x - 90;
        p.holdSprite = 'it_key';
        UI.setObjective(T.obj.parcel);
      }
    },
  };

  Ale.Cabinet = Cabinet; Ale.Parcel = Parcel;
})();
