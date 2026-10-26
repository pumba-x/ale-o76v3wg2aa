// Базовые сущности. Координаты: x — центр, y — точка опоры (низ стоп).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  class Entity {
    constructor(o) {
      o = o || {};
      this.x = o.x || 0; this.y = o.y || 0;
      this.px = this.x; this.py = this.y;
      this.vx = 0; this.vy = 0;
      this.w = o.w || 40; this.h = o.h || 80;
      this.facing = o.facing || 1;
      this.z = o.z === undefined ? 50 : o.z;
      this.id = o.id || null;
      this.dead = false;
      this.t = 0;              // время жизни
      this.scene = null;
      this.onGround = false;
    }

    // Интерполированная позиция для отрисовки между шагами симуляции.
    rx(alpha) { return this.px + (this.x - this.px) * alpha; }
    ry(alpha) { return this.py + (this.y - this.py) * alpha; }

    hurtbox() { return Ale.boxOf(this); }
    update(dt) { this.t += dt; }
    draw() {}
    debugDraw(ctx) {
      const b = this.hurtbox();
      ctx.strokeStyle = 'rgba(0,255,120,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,0,0,0.95)'; ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    }

    // Мягкая контактная тень на поверхности под ногами.
    drawShadow(ctx, x, y, r, strength) {
      const sc = this.scene;
      if (!sc) return;
      const sy = sc.world.supportY(x, y, 0, 8);
      if (sy === null) return;
      const h = Math.max(0, sy - y);
      const k = 1 - Math.min(h / 260, 1);
      if (k <= 0.02) return;
      const rr = r * (0.55 + 0.45 * k);
      ctx.save();
      ctx.translate(x, sy);
      ctx.scale(1, 0.26);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      const a = (strength === undefined ? 0.34 : strength) * k;
      g.addColorStop(0, 'rgba(30,14,22,' + a.toFixed(3) + ')');
      g.addColorStop(0.65, 'rgba(30,14,22,' + (a * 0.55).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(30,14,22,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  Ale.Entity = Entity;
})();
