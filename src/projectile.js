// Снаряды: помидор Алеси, мел и бумажные комки врагов.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const KINDS = {
    tomato: { impact: ['fx_tomato1', 'fx_tomato2', 'fx_tomato3'], small: ['fx_tomato1', 'fx_tomato2'], sfx: 'splat' },
    chalk: { impact: ['fx_chalk'], small: ['fx_chalk'], sfx: 'chalk' },
    paper: { impact: ['fx_paper'], small: ['fx_paper'], sfx: 'paper' },
  };

  class Projectile extends Ale.Entity {
    // x, y — ЦЕНТР снаряда (а не опора).
    constructor(o) {
      super({ x: o.x, y: o.y, w: (o.r || 12) * 2, h: (o.r || 12) * 2, z: 62 });
      this.team = o.team; this.kind = o.kind; this.sprite = o.sprite;
      this.vx = o.vx; this.vy = o.vy; this.g = o.g || 0; this.r = o.r || 12;
      this.spin = o.spin || 0; this.rot = o.rot || 0;
      this.aim = !!o.aim; this.aimOffset = o.aimOffset || 0;
      this.life = o.life || 3; this.dmg = o.dmg || 1;
      this.scale = o.scale || 1;
      this.owner = o.owner || null;
      this.ty = o.ty; this.tyRate = o.tyRate || 400;   // плавно выйти на заданную высоту (мел «идёт» низом или верхом)
    }

    hurtbox() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }
    debugDraw(ctx) { ctx.strokeStyle = 'rgba(255,0,255,0.9)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 6.283); ctx.stroke(); }

    update(dt) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) return this._impact(null, true);
      this.vy += this.g * dt;
      if (this.ty !== undefined) this.y = Ale.approach(this.y, this.ty, this.tyRate * dt);
      const dist = Math.hypot(this.vx, this.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / 10));
      for (let i = 0; i < steps; i++) {
        this.x += this.vx * dt / steps; this.y += this.vy * dt / steps;
        if (this._collide()) return;
      }
      if (this.aim) this.rot = Math.atan2(this.vy, this.vx) + this.aimOffset;
      else this.rot += this.spin * dt;
    }

    _collide() {
      const sc = this.scene, b = this.hurtbox();
      for (const s of sc.world.solids) {
        if (s.disabled || s.passProjectile) continue;
        if (Ale.overlap(b, s)) return this._impact(null, false);
      }
      if (this.team === 'player') {
        for (const e of sc.entities) {
          if (e.dead || !e.vulnerable || e === this) continue;
          if (Ale.overlap(b, e.hurtbox())) {
            const ok = e.takeHit({ kind: this.kind, dir: Math.sign(this.vx) || 1, dmg: this.dmg, x: this.x, y: this.y, src: this });
            if (ok) return this._impact(e, false);
          }
        }
      } else {
        const p = sc.player;
        if (p && !p.down && Ale.overlap(b, p.hurtbox())) {
          if (p.takeHit({ kind: this.kind, dir: Math.sign(this.vx) || 1, dmg: this.dmg, x: this.x, y: this.y, src: this })) return this._impact(p, false);
        }
      }
      return false;
    }

    _impact(target, fizzle) {
      if (this.dead) return true;
      this.dead = true;
      const K = KINDS[this.kind] || KINDS.chalk;
      const sc = this.scene;
      if (!fizzle) {
        sc.fx.anim(target ? K.impact : K.small, this.x, this.y, { dt: 0.055, sx: target ? 1 : 0.7, sy: target ? 1 : 0.7 });
        if (this.kind === 'tomato') sc.fx.splat(this.x, this.y, target ? 12 : 7, Math.sign(this.vx));
        else if (this.kind === 'paper') sc.fx.chips(this.x, this.y, 6, 'rgba(240,228,200,');
        else sc.fx.chips(this.x, this.y, 6, 'rgba(240,240,232,');
        Ale.Audio.sfx(K.sfx);
      }
      return true;
    }

    draw(ctx, alpha) {
      Ale.drawSprite(ctx, this.sprite, this.rx(alpha), this.ry(alpha), { rot: this.rot, sx: this.scale, sy: this.scale });
    }
  }

  Ale.Projectile = Projectile;
})();
