// Таракан — обычный противник Киева (переход к парку): бежит по земле, заметив героиню, привстаёт («!» и дрожь — не меньше 0,4 с), коротко кидается и кусает.
// Поведение — крысиное (Ale.Rat: патруль, погоня, замах, бросок, отдых), числа и кадры свои. Один прыжок сверху, «Туп лапой» или помидор — и он лопается;
// касание или укус отнимают одно сердце (общая неуязвимость героини 1,5 с). Кадры: шесть шагов, «привстал» (ck_rear), расплющенный и два кадра растворения.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const C = Ale.COCKROACH = {
    W: 66, H: 26, WALK: 104, CHASE: 215, SIGHT: 430, LEAP_RANGE: 118,
    WINDUP: 0.5, LEAP_VX: 430, LEAP_VY: 230, RECOVER: 0.65, GRAV: 2600, STRIDE: 9, LEVEL: 50, HOP: 780,      // HOP — прыжок через препятствие на бегу: с запасом выше самого высокого (84 юн.)
    SFX_WIND: null, SFX_LEAP: null, SFX_DIE: 'roach_die',        // замах и прыжок беззвучные (владелец 11.10.2026: звук атаки «такой резкий» — убран); гибель — со звуком
  };

  class Cockroach extends Ale.Rat {
    constructor(o) {
      super(Object.assign({ cfg: C }, o));
      this.headH = 46;
      this.maxX = o.maxX;                // дальше этой точки он не идёт (последний отрезок перед Антіном безопасен)
    }

    update(dt) {
      super.update(dt);
      if (this.maxX !== undefined && this.x > this.maxX && this.state !== 'dead') { this.x = this.maxX; if (this.vx > 0) this.vx = 0; }
    }

    hurtbox() { return { x: this.x - 33, y: this.y - 24, w: 66, h: 24 }; }

    frame() {
      if (this.state === 'dead') {
        if (this.st < 0.3) return 'ck_flat';
        return this.st < 0.42 ? 'ck_vanish1' : 'ck_vanish2';
      }
      if (this.state === 'windup') return 'ck_rear';
      if (this.state === 'leap') return 'ck_walk2';
      if (this.state === 'recover' && this.st < 0.3) return 'ck_walk4';
      if (Math.abs(this.vx) > 10) return 'ck_walk' + ((Math.floor(this.phase) % 6) + 1);
      return Math.floor(this.t * 2.6) % 2 ? 'ck_walk1' : 'ck_walk6';            // стоит: усики и лапки подёргиваются
    }

    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      if (this.state !== 'dead') this.drawShadow(ctx, x, y, 30, 0.28);
      let sx = 1, sy = 1, ox = 0, oy = 0;
      if (this.state === 'windup') { const f = this.st / C.WINDUP; ox = Math.sin(this.st * 80) * 2.4 * f; }
      else if (this.state === 'leap') { sx = 1.12; sy = 0.92; }
      else if (this.state === 'chase' || this.state === 'patrol') oy = -Math.abs(Math.sin(this.phase * 2.4)) * 1.6;      // бежит «мелкой рысью»
      Ale.drawSprite(ctx, this.frame(), x, y, { flip: this.facing < 0, sx, sy, ox, oy });
      if (this.state === 'windup') {
        const s = 0.5 + 0.2 * Math.sin(this.st * 30);
        Ale.drawSprite(ctx, 'fx_warn', x, y - 70 - 5 * Math.sin(this.st * 20), { sx: s, sy: s });
      }
    }
  }

  Ale.Cockroach = Cockroach;
})();
