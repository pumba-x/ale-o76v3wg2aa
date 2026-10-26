// Китёныш (берег, сцена coast): плывёт у берега с первого кадра, подплывает к героине, ждёт, ведёт вдоль скал. Не говорит и не умеет ничего, кроме плавания.
// Кадры — шесть поз плавания (wh_swim1…6, смотрят вправо), спокойный цикл; нижнюю часть силуэта закрывает полоса воды переднего плана сцены (она рисуется поверх всех сущностей).
// Управление — из сценария: swimTo(x) — плыть к точке (arrived — доплыл), patrol(x0, x1) — прогуливаться вдоль берега, hover — покачиваться на месте, nuzzle() — коснуться ладони,
// flick() — поднять хвост и пустить капли. Время — по dt.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const FR = [1, 2, 3, 4, 5, 6].map((i) => 'wh_swim' + i);

  class WhaleCalf extends Ale.Entity {
    // x, y — центр тела (y — линия воды минус немного: нижняя часть спрятана водой); o.waterY — линия воды
    constructor(o) {
      super(Object.assign({ w: 160, h: 90, z: 30, id: 'whaleCalf', facing: -1 }, o));
      this.waterY = o.waterY || this.y;
      this.baseY = this.y;
      this.mode = 'hover';
      this.target = null; this.arrived = true;
      this.speed = o.speed || 150;
      this.p0 = this.x - 160; this.p1 = this.x + 160;
      this.phase = 0; this.bob = 0;
      this.petT = 0; this.flickT = 0; this.dive = 0;
      this.interactable = true; this.interactRange = 150; this.interactDY = 260;
      this.headH = 112; this.promptY = 100;
      this.canPet = false; this.onPet = null; this.label = null;
    }

    canInteract() { return !!this.canPet && !this.dead; }
    interact(p) { if (this.onPet) this.onPet(p); }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}

    swimTo(x, speed) { this.mode = 'goto'; this.target = x; this.arrived = false; if (speed) this.speed = speed; }
    patrol(x0, x1) { this.mode = 'patrol'; this.p0 = x0; this.p1 = x1; this.target = this.facing > 0 ? x1 : x0; this.arrived = false; this.speed = 70; }
    hover() { this.mode = 'hover'; this.target = null; this.arrived = true; }
    nuzzle() { this.petT = 1.5; }                                         // «коснулся ладони»: всплыл, наклонил голову, вернулся
    flick() { this.flickT = 0.9; this.splash(5); }                        // хвост вверх и капли (у входа в пещеру)

    splash(n) {
      const sc = this.scene; if (!sc) return;
      for (let i = 0; i < n; i++) {
        const R = Ale.fxRng;
        sc.fx.add({ shape: 'circle', x: this.x + this.facing * R.range(-10, 60), y: this.waterY - 8, vx: R.range(-60, 60), vy: -R.range(140, 300), g: 900, drag: 0.5, size: R.range(2.5, 5), grow: -2, life: R.range(0.5, 0.9), color: 'rgba(170,215,245,', fade: true });
      }
    }

    update(dt) {
      super.update(dt);
      const sp = this.mode === 'patrol' ? this.speed : this.speed;
      let moving = false;
      if (this.target !== null && this.mode !== 'hover') {
        const dx = this.target - this.x;
        if (Math.abs(dx) > 6) { const k = Ale.clamp(Math.abs(dx) / 80, 0.25, 1); this.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * k * dt); this.facing = Math.sign(dx); moving = true; }
        else {
          this.arrived = true;
          if (this.mode === 'patrol') { this.target = this.target >= this.p1 - 1 ? this.p0 : this.p1; this.arrived = false; }
          else this.target = null;
        }
      }
      this.phase += dt * (moving ? 7 : 3.2);
      this.bob = Math.sin(this.t * (moving ? 2.4 : 1.7)) * (moving ? 5 : 4);
      if (this.petT > 0) this.petT -= dt;
      if (this.flickT > 0) this.flickT -= dt;
      // касание ладони: всплывает на ≈ 14 юнитов и наклоняется носом вниз-вперёд
      const lift = this.petT > 0 ? Math.sin(Ale.clamp(this.petT / 1.5, 0, 1) * Math.PI) : 0;
      this.y = this.baseY + this.bob - lift * 14;
      this.lift = lift;
    }

    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      const fi = Math.floor(this.phase) % FR.length;
      const lift = this.lift || 0, fl = this.flickT > 0 ? Math.sin(Ale.clamp(this.flickT / 0.9, 0, 1) * Math.PI) : 0;
      Ale.drawSprite(ctx, FR[(fi + FR.length) % FR.length], x, y, { flip: this.facing > 0 ? false : true, rot: (-lift * 0.12 + fl * -0.1) * this.facing, sx: 1, sy: 1 });
    }
  }
  Ale.WhaleCalf = WhaleCalf;
})();
