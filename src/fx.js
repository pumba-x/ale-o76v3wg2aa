// Эффекты: частицы, анимации из кадров, всплывающий текст.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const R = () => Ale.fxRng;

  // Спрайт, открытый слева направо на долю k (мягкая кромка): для «выдвигающегося» облака пыли.
  let scratch = null;
  function maskedSprite(name, k) {
    const s = Ale.Assets.sprites[name];
    if (!s) return name;
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== s.img.width || scratch.height !== s.img.height) { scratch.width = s.img.width; scratch.height = s.img.height; }
    const g = scratch.getContext('2d'), w = scratch.width, h = scratch.height, feather = w * 0.14, edge = w * k;
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, h);
    g.drawImage(s.img, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; g.fillRect(0, 0, Math.max(0, edge - feather), h);
    const gr = g.createLinearGradient(edge - feather, 0, edge, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; const x0 = Math.max(0, edge - feather); g.fillRect(x0, 0, Math.min(w, edge) - x0, h);
    g.globalCompositeOperation = 'source-over';
    Ale.Assets.sprites.__mask = { name: '__mask', img: scratch, w: s.w, h: s.h, ax: s.ax, ay: s.ay, hs: s.hs, white: null };
    return '__mask';
  }

  class FX {
    constructor() { this.parts = []; this.anims = []; this.texts = []; this.rings = []; this.delayed = []; }

    clear() { this.parts.length = 0; this.anims.length = 0; this.texts.length = 0; this.rings.length = 0; this.delayed.length = 0; }

    add(p) {
      if (this.parts.length > 600) this.parts.shift();
      p.age = 0; p.life = p.life || 0.5;
      this.parts.push(p);
      return p;
    }

    // Пыль из-под ног. dir — куда летит (−1/0/1).
    dust(x, y, n, dir, power) {
      power = power || 1;
      for (let i = 0; i < n; i++) {
        this.add({
          shape: 'sprite', sprite: 'fx_puff', flip: R().chance(0.5), x: x + R().range(-10, 10), y: y - R().range(0, 4),
          vx: (dir || R().sign()) * R().range(20, 110) * power + R().range(-30, 30), vy: -R().range(15, 70) * power,
          g: 60, drag: 2.2, size: R().range(4, 9) * power / 36, grow: 7 / 36, life: R().range(0.28, 0.5),
          color: 'rgba(226,209,182,', fade: true,
        });
      }
    }

    // Мягкий клуб пыли: крупнее и медленнее обычной пыли, поднимается вверх (волна от удара ногой).
    // opts: size, vx (разлёт по направлению dir), rise (подъём, юнитов/с), life.
    puff(x, y, n, dir, opts) {
      opts = opts || {};
      for (let i = 0; i < n; i++) {
        this.add({
          shape: 'sprite', sprite: 'fx_puff', x: x + R().range(-8, 8), y: y - R().range(0, 4), flip: R().chance(0.5),
          vx: (dir || 0) * (opts.vx || 40) * R().range(0.6, 1.2) + R().range(-14, 14), vy: -(opts.rise || 50) * R().range(0.6, 1.2),
          g: -8, drag: 2.4, size: (opts.size || 10) / 40 * R().range(0.75, 1.2), grow: (opts.size || 10) / 40 * 0.9, life: (opts.life || 0.5) * R().range(0.85, 1.15),
          color: 'rgba(233,218,192,', fade: true,
        });
      }
    }

    // Выполнить через sec секунд (в такте симуляции: замирает вместе с hitstop).
    later(sec, fn) { this.delayed.push({ t: sec, fn }); }

    // Брызги помидора.
    splat(x, y, n, dirX) {
      for (let i = 0; i < n; i++) {
        const a = R().range(0, Math.PI * 2), sp = R().range(80, 320);
        this.add({
          shape: 'circle', x, y, vx: Math.cos(a) * sp + (dirX || 0) * 90, vy: Math.sin(a) * sp - 120,
          g: 1300, drag: 0.6, size: R().range(3, 8), grow: -3, life: R().range(0.35, 0.7),
          color: R().chance(0.75) ? 'rgba(214,52,33,' : 'rgba(255,120,60,', fade: false,
        });
      }
    }

    // Искры / звёздочки удара.
    sparks(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = R().range(0, Math.PI * 2), sp = R().range(140, 420);
        this.add({
          shape: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, drag: 3,
          size: R().range(5, 10), grow: -8, life: R().range(0.25, 0.5), rot: R().range(0, 6), vr: R().range(-9, 9),
          color: color || 'rgba(255,230,120,', fade: true,
        });
      }
    }

    // Обломки (щепки, бумага, мел).
    chips(x, y, n, color, dirX) {
      for (let i = 0; i < n; i++) {
        this.add({
          shape: 'rect', x: x + R().range(-14, 14), y: y - R().range(0, 10),
          vx: R().range(-160, 160) + (dirX || 0) * 60, vy: -R().range(120, 380), g: 1500, drag: 0.4,
          size: R().range(4, 9), grow: 0, life: R().range(0.5, 0.9), rot: R().range(0, 6), vr: R().range(-12, 12),
          color: color || 'rgba(139,90,60,', fade: true,
        });
      }
    }

    confetti(x, y, n) {
      const cols = ['rgba(232,84,84,', 'rgba(244,196,68,', 'rgba(92,186,140,', 'rgba(96,150,232,', 'rgba(220,128,212,'];
      for (let i = 0; i < n; i++) {
        this.add({
          shape: 'rect', x: x + R().range(-40, 40), y: y + R().range(-20, 10),
          vx: R().range(-260, 260), vy: -R().range(240, 640), g: 700, drag: 1.1,
          size: R().range(5, 10), grow: 0, life: R().range(1.6, 2.6), rot: R().range(0, 6), vr: R().range(-10, 10),
          color: R().pick(cols), fade: true, flutter: true,
        });
      }
    }

    hearts(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.add({
          shape: 'heart', x: x + R().range(-30, 30), y, vx: R().range(-30, 30), vy: -R().range(60, 130), g: -20, drag: 0.5,
          size: R().range(9, 15), grow: 0, life: R().range(1.2, 1.9), color: 'rgba(238,86,120,', fade: true,
        });
      }
    }

    ring(x, y, r, color) { this.rings.push({ x, y, r0: 6, r1: r, age: 0, life: 0.28, color: color || 'rgba(255,255,255,' }); }

    // Покадровая анимация из спрайтов: frames — имена, dt — секунд на кадр.
    anim(frames, x, y, o) {
      o = o || {};
      // dts — длительности кадров по отдельности; wipe — за сколько секунд облако «выдвигается» вперёд от точки привязки;
      // rise — подъём (юнитов/с); growY — с какой доли высоты облако разрастается до полной.
      const dts = o.dts || frames.map(() => o.dt || 0.06);
      this.anims.push({ frames, x, y, dts, total: dts.reduce((a, b) => a + b, 0), t: 0, flip: !!o.flip, sx: o.sx || 1, sy: o.sy || 1, rot: o.rot || 0, alpha: o.alpha === undefined ? 1 : o.alpha, follow: o.follow, wipe: o.wipe || 0, rise: o.rise || 0, growY: o.growY || 1 });
    }

    text(x, y, str, o) {
      o = o || {};
      this.texts.push({ x, y, str, age: 0, life: o.life || 0.9, vy: o.vy === undefined ? -46 : o.vy, size: o.size || 26, color: o.color || '#fff', stroke: o.stroke || '#3a1f2a' });
    }

    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.age += dt;
        if (p.age >= p.life) { this.parts.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        const d = Math.max(0, 1 - (p.drag || 0) * dt);
        p.vx *= d; p.vy *= d;
        if (p.flutter) p.x += Math.sin(p.age * 9 + p.rot) * 30 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.grow) p.size = Math.max(p.shape === 'sprite' ? 0.05 : 0.5, p.size + p.grow * dt);
        if (p.vr) p.rot += p.vr * dt;
      }
      for (let i = this.anims.length - 1; i >= 0; i--) {
        const a = this.anims[i];
        a.t += dt;
        if (a.t >= a.total) this.anims.splice(i, 1);
      }
      if (this.delayed.length) {
        const due = [];
        for (const d of this.delayed) { d.t -= dt; if (d.t <= 0) due.push(d); }
        if (due.length) { this.delayed = this.delayed.filter((d) => d.t > 0); for (const d of due) d.fn(); }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.age += dt; t.y += t.vy * dt;
        if (t.age >= t.life) this.texts.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.age += dt;
        if (r.age >= r.life) this.rings.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const r of this.rings) {
        const t = r.age / r.life;
        ctx.strokeStyle = r.color + (1 - t).toFixed(2) + ')';
        ctx.lineWidth = 5 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, Ale.lerp(r.r0, r.r1, Ale.ease.outCubic(t)), 0, Math.PI * 2); ctx.stroke();
      }
      for (const a of this.anims) {
        let i = 0, acc = 0;
        for (; i < a.frames.length - 1; i++) { acc += a.dts[i]; if (a.t < acc) break; }
        const name = a.frames[i];
        if (!a.wipe && !a.rise && a.growY === 1) { Ale.drawSprite(ctx, name, a.x, a.y, { flip: a.flip, sx: a.sx, sy: a.sy, rot: a.rot, alpha: a.alpha }); continue; }
        // облако выдвигается вперёд, поднимается и растёт по высоте; к концу тает
        const sz = Ale.spriteSize(name); if (!sz) continue;
        const k = a.wipe ? Ale.clamp(a.t / a.wipe, 0, 1) : 1, kk = 1 - Math.pow(1 - k, 2);
        const dir = a.flip ? -1 : 1, w = sz.w * a.sx;
        const life = a.t / a.total, fade = life < 0.55 ? 1 : 1 - (life - 0.55) / 0.45;
        const gy = a.growY + (1 - a.growY) * Ale.clamp(a.t / 0.18, 0, 1);
        const ms = a.wipe && k < 1 ? maskedSprite(name, kk) : name;       // край «выдвигающегося» облака мягкий, без резкой линии
        Ale.drawSprite(ctx, ms, a.x, a.y - a.rise * a.t, { flip: a.flip, sx: a.sx, sy: a.sy * gy, rot: a.rot, alpha: a.alpha * fade });
      }
      for (const p of this.parts) {
        const t = p.age / p.life;
        const alpha = p.fade ? 1 - t : Math.min(1, (1 - t) * 3);
        ctx.fillStyle = p.color + alpha.toFixed(2) + ')';
        if (p.shape === 'sprite') {
          Ale.drawSprite(ctx, p.sprite, p.x, p.y, { flip: p.flip, sx: p.size, sy: p.size * 0.9, alpha: alpha * 0.9 });
        } else if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === 'rect') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); ctx.restore();
        } else if (p.shape === 'star') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath();
          const s = p.size;
          ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3); ctx.closePath(); ctx.fill(); ctx.restore();
        } else if (p.shape === 'heart') {
          const s = p.size;
          ctx.save(); ctx.translate(p.x, p.y); ctx.beginPath();
          ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s * 1.1, -s * 0.3, -s * 0.5, -s * 1.0, 0, -s * 0.4);
          ctx.bezierCurveTo(s * 0.5, -s * 1.0, s * 1.1, -s * 0.3, 0, s * 0.35); ctx.fill(); ctx.restore();
        }
      }
      if (this.texts.length) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const t of this.texts) {
          const f = t.age / t.life;
          ctx.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
          ctx.font = 'bold ' + t.size + 'px ' + Ale.FONT;
          ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = t.stroke; ctx.strokeText(t.str, t.x, t.y);
          ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  Ale.FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
  Ale.FX = FX;
})();
