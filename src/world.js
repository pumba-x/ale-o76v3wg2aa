// Геометрия уровня и столкновения.
// Актёр — объект с полями x (центр), y (НИЗ, точка опоры), w, h, vx, vy.
// Твёрдые прямоугольники блокируют со всех сторон; «односторонние» — только сверху.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const box = (a) => ({ x: a.x - a.w / 2, y: a.y - a.h, w: a.w, h: a.h });
  Ale.boxOf = box;

  class World {
    constructor() {
      this.solids = [];
      this.oneways = [];
    }

    addSolid(x, y, w, h, data) {
      const r = Object.assign({ x, y, w, h, solid: true }, data);
      this.solids.push(r);
      return r;
    }

    addOneWay(x, y, w, h, data) {
      const r = Object.assign({ x, y, w, h, oneway: true }, data);
      this.oneways.push(r);
      return r;
    }

    remove(r) {
      let i = this.solids.indexOf(r); if (i >= 0) this.solids.splice(i, 1);
      i = this.oneways.indexOf(r); if (i >= 0) this.oneways.splice(i, 1);
    }

    // Двигает актёра по X, потом по Y. Заполняет onGround, hitX (−1/0/1), hitCeil, ground (на чём стоит).
    move(a, dt) {
      a.hitX = 0; a.hitCeil = false;
      this._moveX(a, a.vx * dt);
      this._moveY(a, a.vy * dt);
      // ленточный конвейер (багажная карусель) несёт всех, кто на нём стоит
      if (a.onGround && a.ground && a.ground.conveyor) { const keep = a.vx; this._moveX(a, a.ground.conveyor * dt); a.vx = keep; }
    }

    _moveX(a, dx) {
      const STEP = 8;
      if (!isFinite(dx)) { a.vx = 0; return; }                    // NaN/Infinity: иначе цикл ниже не кончится и вкладка зависнет (11.10.2026, страховка: источника NaN в коде нет)
      if (dx > 4000) dx = 4000; else if (dx < -4000) dx = -4000;
      while (dx !== 0) {
        const d = Math.abs(dx) > STEP ? Math.sign(dx) * STEP : dx;
        a.x += d; dx -= d;
        const b = box(a);
        for (const s of this.solids) {
          if (s.disabled) continue;
          if (Ale.overlap(b, s)) {
            a.x = d > 0 ? s.x - a.w / 2 - 0.001 : s.x + s.w + a.w / 2 + 0.001;
            a.vx = 0; a.hitX = Math.sign(d); dx = 0;
            break;
          }
        }
      }
    }

    _moveY(a, dy) {
      const STEP = 8;
      a.onGround = false; a.ground = null;
      if (!isFinite(dy)) { a.vy = 0; dy = 0; }
      if (dy > 4000) dy = 4000; else if (dy < -4000) dy = -4000;
      if (dy === 0) dy = 0.0001;   // чтобы стоящий актёр всё равно проверял опору
      while (dy !== 0) {
        const d = Math.abs(dy) > STEP ? Math.sign(dy) * STEP : dy;
        const prevBottom = a.y;
        a.y += d; dy -= d;
        const b = box(a);
        let hit = null;
        for (const s of this.solids) { if (!s.disabled && Ale.overlap(b, s)) { hit = s; break; } }
        if (!hit && d > 0 && !(a.dropThrough > 0)) {
          for (const s of this.oneways) {
            if (!s.disabled && Ale.overlap(b, s) && prevBottom <= s.y + 0.01) { hit = s; break; }
          }
        }
        if (hit) {
          if (d > 0) { a.y = hit.y; a.onGround = true; a.ground = hit; if (a.vy > 0) a.vy = 0; }
          else { a.y = hit.y + hit.h + a.h; if (a.vy < 0) a.vy = 0; a.hitCeil = true; }
          break;
        }
      }
    }

    // Верхняя поверхность, на которую можно встать в вертикальной полосе [x-half, x+half], не выше уровня y.
    // (y — текущий низ актёра; поверхность может быть чуть выше на tol.)
    supportY(x, y, half, tol) {
      half = half || 0; tol = tol === undefined ? 6 : tol;
      let best = null;
      const test = (s) => {
        if (s.disabled) return;
        if (x + half <= s.x || x - half >= s.x + s.w) return;
        if (s.y < y - tol) return;
        if (best === null || s.y < best) best = s.y;
      };
      for (const s of this.solids) test(s);
      for (const s of this.oneways) test(s);
      return best;
    }

    // Есть ли под точкой (x, y) опора не глубже depth — для «не шагать с обрыва».
    hasSupport(x, y, depth) {
      const s = this.supportY(x, y, 0, 6);
      return s !== null && s - y <= depth;
    }

    // Твёрдая преграда прямо перед актёром (для разворота ИИ).
    blockedAhead(a, dir, dist) {
      const b = { x: dir > 0 ? a.x + a.w / 2 : a.x - a.w / 2 - dist, y: a.y - a.h + 4, w: dist, h: a.h - 8 };
      for (const s of this.solids) if (!s.disabled && Ale.overlap(b, s)) return true;
      return false;
    }
  }

  Ale.World = World;
})();
