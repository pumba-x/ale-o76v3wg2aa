// Камера: плавно следует за героем, смотрит вперёд по ходу движения, трясётся при ударах.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  class Camera {
    constructor() {
      this.x = 0; this.y = 0; this.px = 0; this.py = 0;
      this.viewW = 1280; this.viewH = 720;
      this.bounds = { x0: 0, y0: 0, x1: 1280, y1: 720 };
      this.look = 0;
      this.shakeMag = 0; this.shakeT = 0; this.shakeDur = 0;
      this.lockX = null;          // если задано — камера смотрит в эту точку мира (кат-сцены)
      this.padL = 0; this.padR = 0;     // безопасные поля кадра (вырез iPhone, юниты вида): край мира встаёт на их границу, а не под вырез — до края мира герой доходит там, где его видно
      this.speed = 6;
    }

    setView(w, h) { this.viewW = w; this.viewH = h; }
    setPad(l, r) { this.padL = l || 0; this.padR = r || 0; }

    // Вид не выходит за мир больше, чем на безопасные поля (padL слева, padR справа): на экране с вырезом мир идёт до самого края, но у его границы кадр упирается не в край экрана, а в вырез
    clampX(x) {
      const { x0, x1 } = this.bounds, lo = x0 - this.padL, hi = x1 - this.viewW + this.padR;
      if (hi <= lo) return (x0 + x1) / 2 - this.viewW / 2;
      return Ale.clamp(x, lo, hi);
    }

    clampY(y) {
      const { y0, y1 } = this.bounds;
      if (y1 - y0 <= this.viewH) return y1 - this.viewH;
      return Ale.clamp(y, y0, y1 - this.viewH);
    }

    snapTo(tx, ty) {
      this.x = this.clampX(tx - this.viewW / 2);
      this.y = this.clampY(ty === undefined ? this.y : ty - this.viewH * 0.66);
      this.px = this.x; this.py = this.y; this.look = 0;
    }

    update(dt, target) {
      this.px = this.x; this.py = this.y;
      let tx, ty;
      if (this.lockX !== null) { tx = this.lockX; ty = target ? target.y : this.y + this.viewH * 0.66; }
      else if (target) {
        const lookTarget = Ale.clamp((target.vx || 0) * 0.28, -120, 120);
        this.look += (lookTarget - this.look) * (1 - Math.exp(-3 * dt));
        tx = target.x + this.look; ty = target.y;
      } else return;
      const k = 1 - Math.exp(-this.speed * dt);
      this.x += (this.clampX(tx - this.viewW / 2) - this.x) * k;
      this.y += (this.clampY(ty - this.viewH * 0.66) - this.y) * k;
      if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    }

    shake(mag, dur) {
      if (mag >= this.shakeMag * (this.shakeT / Math.max(this.shakeDur, 0.001))) { this.shakeMag = mag; this.shakeDur = dur; this.shakeT = dur; }
    }

    // Итоговое смещение вида с интерполяцией и тряской.
    offset(alpha) {
      let ox = this.px + (this.x - this.px) * alpha;
      let oy = this.py + (this.y - this.py) * alpha;
      if (this.shakeT > 0) {
        const f = this.shakeT / this.shakeDur;
        ox += (Ale.fxRng.next() - 0.5) * 2 * this.shakeMag * f;
        oy += (Ale.fxRng.next() - 0.5) * 2 * this.shakeMag * f;
      }
      return { x: ox, y: oy };
    }
  }

  Ale.Camera = Camera;
})();
