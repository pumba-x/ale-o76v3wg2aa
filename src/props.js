// Предметы сцены: ящик помидоров, ключ, дверь, люк, произвольный «декор».
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const OUT = '#2b1a20';

  // Просто нарисовать что-то в мире на нужной глубине.
  class Decor extends Ale.Entity {
    constructor(o) { super(Object.assign({ z: 10 }, o)); this.fn = o.draw; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    draw(ctx, alpha) { this.fn(ctx, this, alpha); }
  }

  // ---------------------------------------------------------------- ящик с помидорами
  // Деревянный ящик с горкой помидоров. Пополняет запас до максимума (нарисован кодом, стоит ровно на поверхности).
  // y — поверхность, на которой стоит ящик.
  const CRATE_W = 104, CRATE_H = 46;
  const HEAP = [[-34, 8, 0.3], [0, 10, -0.2], [34, 8, 0.15], [-17, -10, 0.5], [17, -9, -0.4], [0, -27, 0.1]];   // x, y от верха ящика, поворот
  function crateLayer() {
    const A = Ale.Art;
    return A.layer(CRATE_W + 8, CRATE_H + 10, (g) => {
      A.box(g, 4, 6, CRATE_W, CRATE_H, { fill: '#b98357', lw: 4, hi: 'rgba(255,255,255,0.24)', lo: 'rgba(0,0,0,0.22)' });
      g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 2.6;
      for (const yy of [6 + CRATE_H / 3, 6 + CRATE_H * 2 / 3]) { g.beginPath(); g.moveTo(6, yy); g.lineTo(CRATE_W + 2, yy); g.stroke(); }
      A.box(g, 4, 6, 12, CRATE_H, { fill: '#8b5a3c', lw: 3 }); A.box(g, CRATE_W - 8, 6, 12, CRATE_H, { fill: '#8b5a3c', lw: 3 });
      g.fillStyle = '#d9d9e0'; for (const [nx, ny] of [[10, 14], [10, CRATE_H - 2], [CRATE_W - 2, 14], [CRATE_W - 2, CRATE_H - 2]]) { g.beginPath(); g.arc(nx, ny, 2, 0, 6.3); g.fill(); }
      // ярлык
      A.box(g, CRATE_W / 2 - 24, 18, 52, 20, { fill: '#fff6e4', lw: 2.5, r: 3 });
      A.text(g, 'TOMATES', CRATE_W / 2 + 2, 28.5, 10.5, '#b3261e');
    });
  }

  class TomatoBox extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: CRATE_W, h: 90, z: 27, id: 'basket' }, o));
      this.interactable = true; this.interactRange = 120;
      this.headH = 118; this.max = Ale.PLAYER.MAX_TOMATOES;
      this.onTake = o.onTake; this.pop = 0;
      this.layer = crateLayer();
    }
    canInteract() { return true; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact() {
      const S = Ale.Game.state;
      if (S.tomatoes >= this.max) { this.scene.fx.text(this.x, this.y - 120, Ale.T.fx.fullHands, { size: 22 }); return; }
      S.tomatoes = this.max; this.pop = 0.3;
      Ale.UI.toast(Ale.T.toast.tomatoes + this.max, 'pr_tomato');
      this.scene.fx.splat(this.x, this.y - 60, 4, 0);
      Ale.Audio.sfx('pickup');
      if (this.onTake) this.onTake();
    }
    update(dt) { super.update(dt); if (this.pop > 0) this.pop -= dt; }
    draw(ctx) {
      const S = Ale.Game.state, A = Ale.Art;
      const need = S.tomatoes < this.max;
      const k = this.pop > 0 ? Math.sin(this.pop / 0.3 * Math.PI) : 0;
      A.shadow(ctx, this.x, this.y, 62, 0.34);
      if (need && this.scene.focus === this) {
        ctx.save(); ctx.globalAlpha = 0.32 + 0.14 * Math.sin(this.t * 6);
        ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(this.x, this.y - 44, 78, 56, 0, 0, 6.283); ctx.fill(); ctx.restore();
      }
      const top = this.y - CRATE_H - 4;
      // горка помидоров: подпрыгивает при взятии
      for (let i = 0; i < HEAP.length; i++) {
        const [hx, hy, r] = HEAP[i];
        Ale.drawSprite(ctx, 'pr_tomato', this.x + hx, top + hy - k * (8 + i * 3), { sx: 1.18, sy: 1.18, rot: r });
      }
      A.blit(ctx, this.layer, this.x - CRATE_W / 2 - 4, this.y - CRATE_H - 6);
    }
  }
  Ale.TomatoBox = TomatoBox;

  // ---------------------------------------------------------------- ключ
  class KeyItem extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 40, h: 40, z: 60, id: 'key' }, o));
      this.onPick = o.onPick;
      this.vx = o.vx || 0; this.vy = o.vy || 0;
      this.settled = !o.vx && !o.vy;
      this.bob = 0;
      this.interactRange = 70;
    }
    hurtbox() { return { x: this.x - 34, y: this.y - 80, w: 68, h: 90 }; }
    update(dt) {
      super.update(dt);
      const sc = this.scene;
      if (!this.settled) {
        this.vy += 1800 * dt;
        this.x = Ale.clamp(this.x + this.vx * dt, 70, sc.width - 70); this.y += this.vy * dt;
        const sy = sc.world.supportY(this.x, this.y - 6, 0, 30);
        if (sy !== null && this.y >= sy && this.vy > 0) {
          this.y = sy;
          if (Math.abs(this.vy) > 260) { this.vy = -this.vy * 0.38; this.vx *= 0.5; Ale.Audio.sfx('key_drop'); }
          else { this.settled = true; this.vx = this.vy = 0; }
        }
      }
      if (this.settled && Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) {
        sc.fx.add({ shape: 'star', x: this.x + Ale.fxRng.range(-22, 22), y: this.y - Ale.fxRng.range(20, 60), vx: 0, vy: -20, g: 0, size: 5, grow: -4, life: 0.6, rot: 0, vr: 3, color: 'rgba(255,230,140,', fade: true });
      }
      const p = sc.player;
      if (this.settled && p && !p.down && Ale.overlap(this.hurtbox(), p.hurtbox()) && !sc.locked) this.pick();
    }
    pick() {
      if (this.dead) return;
      this.dead = true;
      Ale.UI.toast(Ale.T.toast.key, 'it_key');
      this.scene.fx.sparks(this.x, this.y - 30, 12);
      Ale.Audio.sfx('key_get');
      if (this.onPick) this.onPick();
    }
    draw(ctx, alpha) {
      const bob = this.settled ? Math.sin(this.t * 3.2) * 5 : 0;
      const yy = this.ry(alpha);
      if (this.settled) {
        this.drawShadow(ctx, this.x, yy, 20, 0.3);
        ctx.save(); ctx.globalAlpha = 0.28 + 0.12 * Math.sin(this.t * 5);
        const g = ctx.createRadialGradient(this.x, yy - 30 + bob, 2, this.x, yy - 30 + bob, 50);
        g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(1, 'rgba(255,230,140,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, yy - 30 + bob, 50, 0, 6.283); ctx.fill(); ctx.restore();
      }
      Ale.drawSprite(ctx, 'it_key', this.rx(alpha), yy - 26 + bob, { rot: this.settled ? Math.sin(this.t * 2) * 0.15 : this.t * 8 });
    }
  }

  // ---------------------------------------------------------------- дверь / проход
  class Door extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 110, h: 220, z: 12, id: o.id }, o));
      this.interactable = true; this.interactRange = o.range || 80;
      this.headH = o.headH || 236;
      this.onUse = o.onUse; this.locked = !!o.locked; this.lockedText = o.lockedText || null;
      this.arrow = !!o.arrow;   // подсвеченная стрелка: «идти сюда»
      this.canUse = o.canUse || null; this.label = o.label || null; this.labelIcon = o.labelIcon || null;      // canUse() — действие доступно (иначе знак «E» не показывается); label — подпись действия у знака, labelIcon — значок слева от неё
    }
    canInteract() { return this.canUse ? !!this.canUse() : true; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact(p) {
      if (this.locked) {
        Ale.Audio.sfx('locked');
        if (this.lockedText) Ale.UI.hint('bubel', this.lockedText, 3);
        return;
      }
      if (this.onUse) this.onUse(p);
    }
    draw(ctx) {
      if (this.arrow && !this.locked && this.canInteract()) {
        const y = this.y - this.headH - 46 + Math.sin(this.t * 4) * 6;
        ctx.save(); ctx.translate(this.x, y);
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.lineTo(0, 26); ctx.closePath();
        ctx.fillStyle = '#ffd98a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- люк в полу
  // Обычный круглый чугунный люк в каменном ободе. Стоит в комнате с самого начала. Два отдельных удара «Туп лапой»: первый покрывает крышку
  // трещинами, второй разбивает — обломки проваливаются, остаётся тёмный круглый лаз (виден только он: никакой «шахты сквозь пол»).
  // В кат-сцене крышку сдвигают в сторону (open) и возвращают на место (close).
  class Hatch extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 144, h: 24, z: 8, id: 'hatch' }, o));
      this.team = 'enemy'; this.vulnerable = false;
      this.gap = 66;                                   // полуширина проёма в полу (пол там разорван, пока люк не разбит — закрыт блоком)
      this.stage = 0; this.shake = 0; this.slide = 0; this.slideTo = 0;
      this.onCrack = o.onCrack; this.onOpen = o.onOpen;
      this.headH = 40;
    }
    // Экранная линия передней кромки лаза: всё, что провалилось ниже неё, скрыто краем пола (см. clipY у героев).
    get rimY() { return this.y + 4 + 19; }
    // Сдвинуть крышку в сторону / вернуть на место (для кат-сцены)
    open() { this.slideTo = 1; Ale.Audio.sfx('hatch_open'); }
    close() { this.slideTo = 0; }
    // Забить досками (после истории): пол снова цел.
    board() { if (this.stage >= 2 && this.scene.world.solids.indexOf(this.solid) < 0) { this.solid = this.scene.world.addSolid(this.x - this.gap, this.y, this.gap * 2, 60, { kind: 'hatch' }); } this.stage = 3; this.vulnerable = false; }
    onAdd() { this.solid = this.scene.world.addSolid(this.x - this.gap, this.y, this.gap * 2, 60, { kind: 'hatch' }); }
    arm() { this.vulnerable = true; }
    hurtbox() { return { x: this.x - 72, y: this.y - 50, w: 144, h: 56 }; }
    takeHit(info) {
      if (info.kind !== 'stomp' || this.stage >= 2 || this.shake > 0.05 || this.slide > 0.01) return false;
      const sc = this.scene;
      this.stage++;
      this.shake = 0.35;
      sc.camera.shake(this.stage === 2 ? 12 : 7, 0.35);
      sc.fx.dust(this.x, this.y + 6, 8, 0, 1.2);
      sc.fx.chips(this.x, this.y - 2, this.stage === 2 ? 18 : 8, 'rgba(96,100,112,');
      if (this.stage === 1) { Ale.Audio.sfx('hatch_crack'); if (this.onCrack) this.onCrack(); }
      else {
        Ale.Audio.sfx('hatch_break');
        sc.world.remove(this.solid);
        this.vulnerable = false;
        // Бубел, стоящая на крышке, проваливалась вместе с ней и падала вечно (18.10.2026): отпрыгивает за край проёма — в сторону героини, а если та тоже на крышке, к ближнему краю
        const b = sc.actors.bubel, p = sc.player;
        if (b && b.scoot && !b.dead && b.y <= this.y + 4 && Math.abs(b.x - this.x) < this.gap + (b.w || 36) / 2) b.scoot(p && Math.abs(p.x - this.x) > this.gap ? Math.sign(p.x - this.x) : (b.x >= this.x ? 1 : -1));
        if (this.onOpen) this.onOpen();
      }
      return true;
    }
    update(dt) {
      super.update(dt);
      if (this.shake > 0) this.shake -= dt;
      const was = this.slide;
      this.slide = Ale.approach(this.slide, this.slideTo, dt / 0.32);
      if (was > 0 && this.slide === 0) { Ale.Audio.sfx('hatch_slam'); this.scene.fx.dust(this.x, this.y + 8, 6, 0, 1); this.scene.camera.shake(4, 0.2); }
      // пока лаз открыт (разбит), героиня, ушедшая ниже уровня пола, скрывается за передней кромкой
      const p = this.scene.player;
      if (p && this.stage === 2) { const inside = Math.abs(p.x - this.x) < this.gap + 20 && p.y > this.y + 6; p.clipY = inside ? this.rimY : undefined; }
      else if (p && p.clipY !== undefined && this.stage !== 2) p.clipY = undefined;
    }

    // ---- слои (рисуются один раз): обод с лазом и крышка (целая / в трещинах). Круг рисуется в плане, затем сплющивается по вертикали.
    _ringLayer() {
      if (this._ring) return this._ring;
      const A = Ale.Art, W = 176, H = 64, cx = W / 2, cy = 30, K = 0.278;
      return (this._ring = A.layer(W, H, (g) => {
        // каменный обод люка
        g.save(); g.translate(cx, cy); g.scale(1, K);
        g.beginPath(); g.arc(0, 0, 82, 0, 6.283); g.fillStyle = A.linG(g, -82, -82, 82, 82, [[0, '#6b7180'], [0.5, '#474c58'], [1, '#2a2d36']]); g.fill();
        g.save(); g.clip(); A.grain(g, -82, -82, 164, 164, 0.3, 'overlay', 12); g.restore();
        g.restore();
        g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();                                   // путь остался в экранных координатах: обводка одинаковой толщины
        g.beginPath(); g.ellipse(cx, cy, 76, 76 * K, 0, 0, 6.283); g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
        // лаз: тёмный круг; задняя стенка шахты чуть светлее, дальше — темнота
        g.save(); g.translate(cx, cy); g.scale(1, K);
        g.beginPath(); g.arc(0, 0, 68, 0, 6.283); g.clip();
        g.fillStyle = A.linG(g, 0, -68, 0, 68, [[0, '#4a4038'], [0.3, '#211b18'], [0.6, '#07080b'], [1, '#020304']]); g.fillRect(-70, -70, 140, 140);
        g.restore();
        // две скобы-ступеньки на задней стенке
        g.fillStyle = '#7d8290'; for (const dx of [-13, 13]) { g.fillRect(cx + dx - 7, cy - 15, 14, 2.6); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx + dx - 7, cy - 15, 14, 0.9); g.fillStyle = '#7d8290'; }
        g.save(); g.translate(cx, cy); g.scale(1, K); g.beginPath(); g.arc(0, 0, 68, 0, 6.283); g.restore();
        g.lineWidth = 2.4; g.strokeStyle = '#000'; g.stroke();
      }, 3));
    }
    _lidLayer(cracked) {
      this._lid = this._lid || {};
      const key = cracked ? 1 : 0;
      if (this._lid[key]) return this._lid[key];
      const A = Ale.Art, W = 176, H = 64, cx = W / 2, cy = 30, K = 0.278, R = 75;
      return (this._lid[key] = A.layer(W, H, (g) => {
        // боковая кромка (толщина крышки)
        g.fillStyle = '#1b1e25'; g.beginPath(); g.ellipse(cx, cy + 3.4, R, R * K, 0, 0, 6.283); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
        g.save(); g.translate(cx, cy); g.scale(1, K);
        const top = () => { g.beginPath(); g.arc(0, 0, R, 0, 6.283); };
        top(); g.fillStyle = rgL(g); g.fill();
        g.save(); top(); g.clip();
        // рифлёный ромбовидный узор чугуна
        g.lineCap = 'butt';
        g.strokeStyle = 'rgba(12,14,20,0.55)'; g.lineWidth = 3.4;
        for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(i * 12 - 90, -90); g.lineTo(i * 12 + 90, 90); g.moveTo(i * 12 + 90, -90); g.lineTo(i * 12 - 90, 90); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.6;
        for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(i * 12 - 88, -90); g.lineTo(i * 12 + 92, 90); g.stroke(); }
        // гладкий ободок и центральная плита
        g.lineWidth = 9; g.strokeStyle = '#3a3e49'; g.beginPath(); g.arc(0, 0, 66, 0, 6.283); g.stroke();
        g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,0.20)'; g.beginPath(); g.arc(0, 0, 70.5, 0, 6.283); g.stroke();
        g.fillStyle = '#3e424d'; g.beginPath(); g.arc(0, 0, 21, 0, 6.283); g.fill(); g.lineWidth = 2.6; g.strokeStyle = 'rgba(8,9,14,0.8)'; g.stroke();
        g.fillStyle = 'rgba(5,6,9,0.85)'; for (const dx of [-11, 11]) { g.beginPath(); g.ellipse(dx, 0, 4.6, 9, 0, 0, 6.283); g.fill(); }      // отверстия под крюк
        A.grain(g, -R, -R, R * 2, R * 2, 0.34, 'overlay', 14);
        if (cracked) {
          const cr = [[[0, 0], [-14, -12], [-30, -9], [-46, -24], [-70, -20]], [[0, 0], [15, 13], [26, 30], [50, 38], [66, 46]], [[0, 0], [22, -16], [34, -9], [54, -30]], [[-30, -9], [-38, 8], [-58, 14]], [[26, 30], [10, 44], [14, 60]]];
          g.lineJoin = 'miter';
          for (const [w, c] of [[6.4, '#000'], [3.2, '#0b0d12']]) { g.lineWidth = w; g.strokeStyle = c; for (const line of cr) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } }
          g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,255,255,0.28)'; for (const line of cr) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x + 1.6, y - 1.6) : g.moveTo(x + 1.6, y - 1.6))); g.stroke(); }
        }
        g.restore();
        g.restore();
        g.beginPath(); g.ellipse(cx, cy, R, R * K, 0, 0, 6.283); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(cx, cy, R - 3, (R - 3) * K, 0, 3.55, 4.6); g.stroke();      // блик по верхнему краю
      }, 3));
      function rgL(gg) { const gr = gg.createRadialGradient(-22, -30, 4, 0, 0, R); gr.addColorStop(0, '#767c8b'); gr.addColorStop(0.55, '#4b505d'); gr.addColorStop(1, '#2c2f39'); return gr; }
    }
    // Забитый досками люк: доски лежат поперёк и закрывают лаз целиком (тёмный овал ободка ± 19 юн. от центра): четыре доски вплотную,
    // сверху две поперечные рейки. Слой рисуется один раз.
    _boardsLayer() {
      if (this._bl) return this._bl;
      const w = this.gap * 2 + 16, pad = 30, n = 4, ph = 11.5, y0 = 10;
      const L = Ale.Art.layer(w + pad * 2, 54, (g) => {
        for (let i = 0; i < n; i++) {
          g.save(); g.translate(pad + w / 2, y0 + i * (ph - 1.2)); g.rotate((i - 1.5) * 0.008);
          Ale.Art.wood(g, -w / 2 - 10, -ph / 2, w + 20, ph, { base: i % 2 ? '#9a6a44' : '#a8744a', seed: 50 + i, knots: false });
          g.strokeStyle = OUT; g.lineWidth = 2.2; g.strokeRect(-w / 2 - 10, -ph / 2, w + 20, ph);
          g.restore();
        }
        // две поперечные рейки с гвоздями поверх досок
        for (const dx of [-42, 42]) {
          const top = y0 - ph / 2 - 3, bot = y0 + (n - 1) * (ph - 1.2) + ph / 2 + 3;
          Ale.Art.wood(g, pad + w / 2 + dx - 6, top, 12, bot - top, { base: '#8a5a38', seed: 70 + dx, knots: false });
          g.strokeStyle = OUT; g.lineWidth = 2.2; g.strokeRect(pad + w / 2 + dx - 6, top, 12, bot - top);
          g.fillStyle = '#d9d9e0'; for (const yy of [top + 6, bot - 6]) { g.beginPath(); g.arc(pad + w / 2 + dx, yy, 1.9, 0, 6.283); g.fill(); }
        }
      }, 2);
      L.pad = pad; return (this._bl = L);
    }
    draw(ctx) {
      const A = Ale.Art, cy = this.y + 4;
      if (this.stage === 3) {
        const R = this._ringLayer(), B = this._boardsLayer();
        ctx.drawImage(R.c, this.x - R.w / 2, cy - 30, R.w, R.h);
        ctx.drawImage(B.c, this.x - B.w / 2, this.y - 20.25, B.w, B.h);       // верх первой доски — на 16 юн. выше центра, низ последней — ниже кромки лаза
        return;
      }
      const R = this._ringLayer();
      ctx.drawImage(R.c, this.x - R.w / 2, cy - 30, R.w, R.h);            // обод и лаз (лаз накрыт крышкой, пока она на месте)
      if (this.stage < 2) {
        const L = this._lidLayer(this.stage >= 1), sh = this.shake > 0 ? Math.sin(this.shake * 90) * 2.2 * (this.shake / 0.35) : 0;
        const off = Ale.ease.inOutQuad(this.slide) * (this.gap * 2 + 26);
        A.shadow(ctx, this.x + off, cy + 4, 62, 0.22 * this.slide);
        ctx.save(); ctx.translate(this.x + off + sh, cy); ctx.rotate(this.slide * 0.07); ctx.drawImage(L.c, -L.w / 2, -30, L.w, L.h); ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- катящаяся бочка (пакость Дани)
  class RollingBarrel extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 60, h: 62, z: 51, id: null }, o));
      this.dir = o.dir || -1; this.speed = o.speed || 250;
      this.vx = this.dir * this.speed;
      this.team = 'enemy'; this.vulnerable = true;
      this.rot = 0; this.r = 33;
      this.img = o.img;
    }
    hurtbox() { return { x: this.x - 30, y: this.y - 64, w: 60, h: 64 }; }
    takeHit(info) {
      if (info.kind !== 'stomp') return false;
      this.smash();
      return true;
    }
    smash() {
      if (this.dead) return;
      this.dead = true;
      const sc = this.scene;
      sc.fx.chips(this.x, this.y - 30, 14, 'rgba(160,110,70,', -this.dir);
      sc.fx.dust(this.x, this.y, 6, 0, 1);
      sc.camera.shake(5, 0.2);
      Ale.Audio.sfx('barrel_smash');
    }
    update(dt) {
      super.update(dt);
      const sc = this.scene, p = sc.player;
      this.x += this.vx * dt;
      if (p) Ale.Audio.hold('barrel_roll', Ale.clamp(1.15 - Math.abs(p.x - this.x) / 1000, 0.35, 1));        // катится — гремит (одна петля на все бочки; затихает, когда бочки нет или игра на паузе)
      this.rot += this.vx * dt / this.r;
      for (const s of sc.world.solids) {
        if (s.disabled || s.kind === 'floor') continue;
        if (Ale.overlap(this.hurtbox(), s)) { this.smash(); return; }
      }
      if (p && !p.down && Ale.overlap(this.hurtbox(), p.hurtbox())) {
        if (p.takeHit({ kind: 'barrel', dir: this.dir, dmg: 1, x: this.x, y: this.y, src: this })) this.smash();
      }
      if (this.x < -100 || this.x > sc.width + 100) this.dead = true;
      if (Math.floor(this.t * 9) !== Math.floor((this.t - dt) * 9)) sc.fx.dust(this.x - this.dir * 24, this.y, 1, -this.dir, 0.5);
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      this.drawShadow(ctx, x, y, 38, 0.32);
      ctx.save(); ctx.translate(x, y - this.r); ctx.rotate(this.rot);
      ctx.drawImage(this.img.c, -this.img.w / 2, -this.img.h / 2, this.img.w, this.img.h);
      ctx.restore();
    }
  }

  Ale.RollingBarrel = RollingBarrel;

  // ---------------------------------------------------------------- необязательная реплика по нажатию E
  class Talk extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 10, h: 10, z: 5, id: null }, o));
      this.interactable = true; this.interactRange = o.range || 90; this.interactDY = 190;
      this.variants = o.variants; this.i = 0;
      this.headH = o.headH || 190; this.promptY = this.headH;
    }
    canInteract() { return true; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact() {
      const lines = this.variants[this.i % this.variants.length];
      this.i++;
      const sc = this.scene;
      sc.runScript(function* () { yield Ale.UI.say(lines); });
    }
  }
  Ale.Talk = Talk;

  // ---------------------------------------------------------------- голубь (декор: клюёт, взлетает, когда подходят)
  class Pigeon extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 24, h: 22, z: 24, id: null }, o));
      this.dir = Ale.fxRng.chance(0.5) ? 1 : -1;
      this.mode = 'peck'; this.st = Ale.fxRng.range(0, 1.5); this.fly = 0; this.step = 0;
      this.hue = Ale.fxRng.chance(0.5);
    }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    update(dt) {
      super.update(dt);
      const p = this.scene.player;
      if (this.mode !== 'fly' && p && Math.abs(p.x - this.x) < 160 && Math.abs(p.y - this.y) < 200) {
        this.mode = 'fly'; this.fly = 0; this.dir = this.x >= p.x ? 1 : -1; this.vx = this.dir * (170 + Ale.fxRng.range(0, 90));
      }
      if (this.mode === 'fly') {
        this.fly += dt; this.x += this.vx * dt; this.hy = (this.hy || 0) + (150 + this.fly * 260) * dt;
        if (this.fly > 1.8) this.dead = true;
        return;
      }
      this.st -= dt;
      if (this.st <= 0) { this.mode = this.mode === 'peck' ? 'walk' : 'peck'; this.st = this.mode === 'peck' ? Ale.fxRng.range(0.8, 2.2) : Ale.fxRng.range(0.4, 0.9); if (this.mode === 'walk' && Ale.fxRng.chance(0.4)) this.dir = -this.dir; }
      if (this.mode === 'walk') { this.x += this.dir * 26 * dt; this.step += dt * 9; }
    }
    draw(ctx) {
      const A = Ale.Art, t = this.t, fly = this.mode === 'fly';
      const y = this.y - (this.hy || 0);
      if (!fly) A.shadow(ctx, this.x, this.y, 12, 0.26);
      ctx.save(); ctx.translate(this.x, y); ctx.scale(this.dir, 1);
      if (fly) ctx.rotate(-0.35);
      const OUTC = '#2b1a20', body = this.hue ? '#8d93a6' : '#a8a196', dark = this.hue ? '#646b80' : '#7d766c';
      // хвост и тело
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(-19, -5); ctx.lineTo(-18, -12); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUTC; ctx.stroke();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -11, 12, 8, 0, 0, 6.3); ctx.fill(); ctx.stroke();
      // голова: клюёт, наклоняясь
      const pk = this.mode === 'peck' ? Math.max(0, Math.sin(t * 9)) : 0, hx = 10 + pk * 3, hy = -18 + pk * 8;
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(hx, hy, 5.4, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.hue ? '#4f9a8c' : '#8a5aa0'; ctx.beginPath(); ctx.ellipse(hx - 2, hy + 4, 5, 3.4, 0.5, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8a04a'; ctx.beginPath(); ctx.moveTo(hx + 4, hy - 1); ctx.lineTo(hx + 10, hy + 1); ctx.lineTo(hx + 4, hy + 2.4); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 1.6, hy - 1.4, 1.5, 0, 6.3); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + 2, hy - 1.4, 0.8, 0, 6.3); ctx.fill();
      // крыло (машет в полёте)
      const wr = fly ? Math.sin(t * 30) * 0.9 - 0.5 : -0.18;
      ctx.save(); ctx.translate(-3, -13); ctx.rotate(wr); ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(fly ? -4 : 0, fly ? -8 : 0, fly ? 6 : 8, fly ? 12 : 5, fly ? 0.3 : 0, 0, 6.3); ctx.fill(); ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      // лапки
      if (!fly) { ctx.strokeStyle = '#d98a8a'; ctx.lineWidth = 2; const s = this.mode === 'walk' ? Math.sin(this.step) * 3 : 0; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-2 + s, 0); ctx.moveTo(3, -4); ctx.lineTo(3 - s, 0); ctx.stroke(); }
      ctx.restore();
    }
  }
  Ale.Pigeon = Pigeon;

  // ---------------------------------------------------------------- сердечко-аптечка
  class HeartPickup extends Ale.Entity {
    // y — поверхность, на которой лежит (сердце парит над ней)
    constructor(o) { super(Object.assign({ w: 40, h: 40, z: 58, id: null }, o)); this.taken = false; this.respawn = 0; }
    hurtbox() { return { x: this.x - 30, y: this.y - 100, w: 60, h: 100 }; }
    debugDraw(ctx) { const b = this.hurtbox(); ctx.strokeStyle = 'rgba(255,90,140,0.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h); }
    update(dt) {
      super.update(dt);
      const p = this.scene.player, S = Ale.Game.state;
      if (this.taken) { this.respawn -= dt; if (this.respawn <= 0) this.taken = false; return; }
      if (p && !p.down && S.hp < S.maxHp && Ale.overlap(this.hurtbox(), p.hurtbox())) {
        this.taken = true; this.respawn = 60;
        p.heal(1);
        this.scene.fx.hearts(this.x, this.y - 60, 6); this.scene.fx.text(this.x, this.y - 100, Ale.T.fx.heart, { size: 24, color: '#ffb3c6' });
        Ale.Audio.sfx('pickup');
      }
    }
    draw(ctx, alpha) {
      if (this.taken) return;
      const bob = Math.sin(this.t * 3.4) * 6, y = this.y - 52 + bob;
      A_shadow(ctx, this.x, this.y, 20, 0.28);
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 5);
      const g = ctx.createRadialGradient(this.x, y, 2, this.x, y, 46); g.addColorStop(0, 'rgba(255,150,180,1)'); g.addColorStop(1, 'rgba(255,150,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, y, 46, 0, 6.283); ctx.fill(); ctx.restore();
      const sc = 1 + Math.sin(this.t * 6) * 0.05;
      ctx.save(); ctx.translate(this.x, y); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-26, -6, -13, -24, 0, -10); ctx.bezierCurveTo(13, -24, 26, -6, 0, 12); ctx.closePath();
      ctx.fillStyle = '#e8445a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-8, -8, 4, 2.6, -0.6, 0, 6.3); ctx.fill();
      ctx.restore();
    }
  }
  function A_shadow(ctx, x, y, r, a) { Ale.Art.shadow(ctx, x, y, r, a); }
  Ale.HeartPickup = HeartPickup;

  Ale.Decor = Decor; Ale.Basket = TomatoBox; Ale.KeyItem = KeyItem; Ale.Door = Door; Ale.Hatch = Hatch;
})();
