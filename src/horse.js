// Преслюкан — конь: стоит во дворе, ест яблоко, принимает Алесю в седло и уносит её вдаль (в кат-сцене двора); в аэропорту рысью уходит со двора.
// Кадры — лист horse_sheet.png: стоит (дышит масштабом, кадр hor_idle2 не рисуется), шаг (6), ест (3); верхом — кадры галопа из mount.js.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  // Морда коня относительно точки опоры (юниты, лицом вправо, y вверх): когда стоит с поднятой головой и когда опустил её к руке
  const MOUTH = { up: { x: 97, y: 168 }, down: { x: 104, y: 68 } };

  class Preslyukan extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 110, h: 150, z: 50, id: 'horse', facing: -1 }, o));
      this.interactable = true; this.interactRange = 170; this.headH = 250;
      this.state = 'idle';          // idle | eat | trot | ride
      this.mounted = false;         // в седле — Алеся: рисуется общий спрайт «всадница»
      this.hop = 0; this.eatT = 0; this.gallopT = 0; this.swallow = 0;
      this.cur = 'hor_idle'; this.prev = null; this.fadeT = 0;      // плавный переход между позами «стоит / тянется / жуёт»
      this.onInteract = o.onInteract;
    }
    canInteract() { return this.state === 'idle' && !this.mounted; }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    interact(p) { if (this.onInteract) this.onInteract(p); }

    // Какой кадр показывать (без верховой езды)
    pickFrame() {
      if (this.state === 'eat') return this.eatT < 0.45 ? 'hor_feed1' : 'hor_feed2';   // тянется к яблоку, потом жуёт
      if (this.swallow > 0) return 'hor_feed3';
      if (this.state === 'trot') return 'hor_walk' + ((Math.floor(this.trotPhase || 0) % 6) + 1);
      return 'hor_idle';
    }

    // Мировая точка морды: kind 'up' — голова поднята, 'down' — опущена к руке
    mouth(kind) { const m = MOUTH[kind || 'up']; return { x: this.x + m.x * (this.facing < 0 ? -1 : 1), y: this.y - m.y }; }

    update(dt) {
      super.update(dt);
      if (this.hop > 0) this.hop -= dt;
      if (this.swallow > 0) this.swallow -= dt;
      if (this.fadeT > 0) this.fadeT -= dt;
      if (this.state === 'eat') this.eatT += dt;
      if (this.state === 'trot') {
        this.vx = Ale.approach(this.vx, this.trotSpeed || -300, 500 * dt);
        this.x += this.vx * dt; this.facing = this.vx < 0 ? -1 : 1;
        this.trotPhase = (this.trotPhase || 0) + Math.abs(this.vx) * dt / 48;      // копыто в кадрах смещается назад ≈ на 60 юн. за кадр; при 48 юн. пути на кадр скольжение ≈ 20%
      }
      // смена позы стоя/ест — короткое перетекание, а не «щелчок» головой (шаги и галоп не перетекают)
      const f = this.pickFrame(), soft = (n) => /^hor_(idle|feed)/.test(n);
      if (f !== this.cur) { this.prev = soft(f) && soft(this.cur) ? this.cur : null; this.cur = f; this.fadeT = this.prev ? 0.14 : 0; }
      if (this.state === 'ride') {
        this.vx = Ale.approach(this.vx, this.rideSpeed || 460, 260 * dt);
        this.x += this.vx * dt;
        const before = this.gallopT;
        this.gallopT = Ale.Mount.advance(this.gallopT, this.vx, dt);
        const M = Ale.Mount, fi = (t) => M.frameIndex(t);
        if (fi(this.gallopT) !== fi(before) && M.CONTACT.includes(fi(this.gallopT))) this.scene.fx.dust(this.x - 90, this.y, 2, -1, 0.9);
      }
    }

    draw(ctx) {
      const A = Ale.Art;
      A.shadow(ctx, this.x, this.y, this.mounted ? 120 : 96, 0.34);
      if (this.mounted) {
        // в седле: на месте — «собрался» (кадр приземления), при подскоке встаёт на дыбы (кадр взлёта), в движении — цикл галопа
        let sx = 1, sy = 1, oy = 0;
        if (this.hop > 0) { const k = Math.sin(this.hop / 0.3 * Math.PI); sy *= 1 - k * 0.05; sx *= 1 + k * 0.03; oy -= k * 8; }
        const pose = this.state === 'ride' ? { phase: this.gallopT } : this.hop > 0 ? { air: true, vy: -800 } : { landing: 1 };
        Ale.Mount.draw(ctx, this.x, this.y, Object.assign(pose, { flip: this.facing < 0, sx, sy, oy }));
        return;
      }
      const f = this.cur;
      let oy = 0, rot = 0, sy = 1, sx = 1;
      if (this.state === 'eat' && f === 'hor_feed2') { rot = Math.sin(this.eatT * 15) * 0.012; oy = Math.abs(Math.sin(this.eatT * 15)) * 1.2; }     // жуёт: лёгкое покачивание
      if (this.hop > 0) { const k = Math.sin(this.hop / 0.3 * Math.PI); sy *= 1 - k * 0.07; sx *= 1 + k * 0.05; oy -= k * 8; }
      // стоит и дышит: чуть вытягивается вокруг копыт и снова оседает. Раньше поверх этого кадра растворялся второй, hor_idle2, — два разных рисунка (голова и шея выше, хвост и задние ноги сдвинуты на 5–8 px, шерсть ярче)
      // давали двойной контур у головы, гривы, хвоста и ног, а в конце растворения из-под него торчали края первого (18.10.2026)
      if (f === 'hor_idle' && this.state === 'idle') { const b = 0.5 - 0.5 * Math.cos(this.t * 1.3); sy *= 1 + 0.009 * b; sx *= 1 - 0.003 * b; }
      const o = { flip: this.facing < 0, sx, sy, rot, oy };
      if (this.fadeT > 0 && this.prev) {
        Ale.drawSprite(ctx, this.prev, this.x, this.y, o);
        Ale.drawSprite(ctx, f, this.x, this.y, Object.assign({ alpha: 1 - this.fadeT / 0.14 }, o));
      } else Ale.drawSprite(ctx, f, this.x, this.y, o);
    }
  }

  Preslyukan.MOUTH = MOUTH;
  Ale.Preslyukan = Preslyukan;
})();
