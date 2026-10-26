// Крыса — обычный противник Парижа: бродит, замечает, приседает («!»), прыгает, после прыжка беззащитна.
// Убивается лапой, помидором и прыжком сверху. Учебная крыса (training) не кусается: подходит и ждёт, пока её «пройдут».
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const R = Ale.RAT = {
    W: 64, H: 38, WALK: 88, CHASE: 190, SIGHT: 480, LEAP_RANGE: 150,
    WINDUP: 0.5, LEAP_VX: 400, LEAP_VY: 440, RECOVER: 0.7, GRAV: 2600, STRIDE: 14, LEVEL: 50,       // LEVEL: на такой высоте разницы крыса замечает героиню и нападает
  };

  class Rat extends Ale.Entity {
    // o.cfg — свои числа (таракан в Киеве: быстрее, ниже, короче бросок); по умолчанию — крысиные R
    constructor(o) {
      const cfg = (o && o.cfg) || R;
      super(Object.assign({ w: cfg.W, h: cfg.H, z: 52 }, o));
      this.R = cfg;
      this.team = 'enemy'; this.vulnerable = true; this.aimable = true;
      this.training = !!o.training;
      this.headH = 58;
      this.x0 = this.x - (o.range === undefined ? 130 : o.range); this.x1 = this.x + (o.range === undefined ? 130 : o.range);
      this.state = 'patrol'; this.st = 0;
      this.dir = o.facing || 1; this.facing = this.dir;
      this.phase = 0; this.cool = 0;
      this.stagger = 0; this.hopCd = 0;
      if (o.aggro) { this.state = 'chase'; this.aggro = true; }
      if (this.training) { this.state = 'train'; this.stopAt = o.stopAt || 300; }
    }

    hurtbox() { return { x: this.x - 30, y: this.y - 36, w: 60, h: 36 }; }

    update(dt) {
      super.update(dt);
      const sc = this.scene, w = sc.world, p = sc.player;
      this.st += dt;
      if (this.cool > 0) this.cool -= dt;

      switch (this.state) {
        case 'train': {
          // учебная крыса: тихо идёт к игроку и останавливается на расстоянии, не кусается
          if (!p) break;
          const dx = p.x - this.x;
          this.dir = dx >= 0 ? 1 : -1; this.facing = this.dir;
          this.vx = Math.abs(dx) > this.stopAt ? this.dir * this.R.WALK * 1.7 : 0;
          break;
        }
        case 'patrol': {
          this.vx = this.dir * this.R.WALK;
          if (this.x > this.x1) this.dir = -1; else if (this.x < this.x0) this.dir = 1;
          if (!w.hasSupport(this.x + this.dir * 40, this.y, 22) || w.blockedAhead(this, this.dir, 10)) this.dir = -this.dir;
          this.facing = this.dir;
          if (this._sees(p)) { this.state = 'chase'; this.st = 0; }
          break;
        }
        case 'chase': {
          if (!p || p.down) { this.state = 'patrol'; break; }
          const dx = p.x - this.x;
          this.dir = dx >= 0 ? 1 : -1; this.facing = this.dir;
          const edge = !w.hasSupport(this.x + this.dir * 40, this.y, 22);
          // низкие препятствия (ящик, кадка) крыса перепрыгивает на ходу — не «застревает» перед ними и не сидит на месте
          if (this.hopCd > 0) this.hopCd -= dt;
          const blocked = w.blockedAhead(this, this.dir, 10);
          if (blocked && this.onGround && this.hopCd <= 0) { this.vy = -(this.R.HOP || 560); this.hopCd = 0.7; }
          this.vx = edge ? 0 : this.dir * this.R.CHASE;
          const level = Math.abs(p.y - this.y) < this.R.LEVEL;                   // героиня на одном уровне (не на прилавке и не на ящике над головой)
          if (Math.abs(dx) < this.R.LEAP_RANGE && this.cool <= 0 && this.onGround && level) {
            this.state = 'windup'; this.st = 0; this.vx = 0;
            this._cue('SFX_WIND', 'squeak');
            if (sc.onRatWindup) sc.onRatWindup(this);
          } else if (!this.aggro && (Math.abs(dx) > this.R.SIGHT * 1.6 || Math.abs(p.y - this.y) > 110)) this.state = 'patrol';
          break;
        }
        case 'windup':
          this.vx = 0;
          if (this.st >= this.R.WINDUP) {
            this.state = 'leap'; this.st = 0;
            this.vx = this.dir * this.R.LEAP_VX; this.vy = -this.R.LEAP_VY; this.onGround = false;
            this._cue('SFX_LEAP', 'rat_leap');
          }
          break;
        case 'leap':
          if (this.onGround && this.st > 0.08) { this.state = 'recover'; this.st = 0; this.vx = 0; this.cool = 0.9; sc.fx.dust(this.x, this.y, 3, 0, 0.6); }
          break;
        case 'recover':
          this.vx = Ale.approach(this.vx, 0, 1800 * dt);
          if (this.st >= this.R.RECOVER) { this.state = 'chase'; this.st = 0; }
          break;
        case 'dead':
          this.vx = Ale.approach(this.vx, 0, 900 * dt);
          if (this.st > 0.78) this.dead = true;          // до конца «пуфа» (пять кадров дыма после лепёшки)
          break;
      }
      this.vy = Math.min(this.vy + this.R.GRAV * dt, 1200);
      w.move(this, dt);
      if (this.vx === 0 && this.hitX) this.dir = -this.dir;

      // касание = урон; но если героиня падает сверху — раздавлена крыса, а не героиня
      if (p && !p.down && this.state !== 'dead' && Ale.overlap(this.hurtbox(), p.hurtbox())) {
        const fromAbove = (p.vyStart || 0) > 40 && p.py <= this.y - 18;
        if (fromAbove) { this.takeHit({ kind: 'jump', dir: p.x >= this.x ? 1 : -1, x: p.x, y: p.y }); p.bounceOff(); }
        else if (!this.training && (this.state === 'chase' || this.state === 'leap' || this.state === 'patrol')) {
          p.takeHit({ kind: 'rat', dir: this.x < p.x ? 1 : -1, dmg: 1, x: this.x, y: this.y, src: this });
        }
      }
      if (Math.abs(this.vx) > 10 && this.onGround) this.phase += Math.abs(this.vx) * dt / this.R.STRIDE;
    }

    // Звук замаха и прыжка: у крысы свой (`squeak`, `rat_leap`), у других хозяев — из их настроек; `null` в настройках — звука нет (у таракана нападение беззвучное)
    _cue(key, fallback) { const n = this.R[key] === undefined ? fallback : this.R[key]; if (n) Ale.Audio.sfx(n); }

    // Замечает героиню: на одном уровне, в поле зрения впереди — или совсем рядом (слышит) в любую сторону
    _sees(p) {
      if (!p || p.down) return false;
      const dx = p.x - this.x;
      return Math.abs(dx) < this.R.SIGHT && Math.abs(p.y - this.y) < this.R.LEVEL + 20 && ((dx >= 0 ? this.dir > 0 : this.dir < 0) || Math.abs(dx) < 300);
    }
    takeHit(info) {
      if (this.state === 'dead') return false;
      this.state = 'dead'; this.st = 0; this.vulnerable = false; this.kind = info.kind;
      this.vx = (info.dir || 1) * 60; this.vy = 0;
      const sc = this.scene;
      sc.fx.sparks(this.x, this.y - 22, 6);
      if (info.kind === 'tomato') sc.fx.splat(this.x, this.y - 20, 6, info.dir);
      if (info.kind === 'jump') { sc.fx.ring(this.x, this.y - 12, 54, 'rgba(255,255,255,'); sc.fx.dust(this.x, this.y, 5, 0, 0.9); Ale.Audio.sfx('boing'); }
      Ale.Audio.sfx(this.R.SFX_DIE || 'rat_die');
      sc.onEnemyDefeated && sc.onEnemyDefeated(this);
      return true;
    }

    // Кадры: бег (6), присела перед прыжком, прыжок, укус при приземлении, сидит столбиком и принюхивается (2);
    // конец: лепёшка (2 кадра; от помидора — «помидор в морду» и кувырок), затем дым из пяти кадров
    frame() {
      if (this.state === 'dead') {
        const tom = this.kind === 'tomato', t0 = tom ? 0.36 : 0.34;
        if (this.st >= t0) return 'rat_poof' + (Math.min(4, Math.floor((this.st - t0) / 0.085)) + 1);
        if (tom) return this.st < 0.16 ? 'rat_tom1' : 'rat_tom2';
        return this.st < 0.2 ? 'rat_flat' : 'rat_flat2';
      }
      if (this.state === 'leap') return 'rat_leap';
      if (this.state === 'windup') return 'rat_crouch';
      if (this.state === 'recover' && this.st < 0.3) return 'rat_bite';
      if (Math.abs(this.vx) > 10) return 'rat_walk' + ((Math.floor(this.phase) % 6) + 1);
      return Math.floor(this.t * 2.2) % 2 ? 'rat_sit2' : 'rat_sit1';
    }

    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      if (this.state !== 'dead') this.drawShadow(ctx, x, y, 34, 0.3);
      let sx = 1, sy = 1, ox = 0;
      if (this.state === 'windup') {
        const f = this.st / this.R.WINDUP;
        sy = 1 - 0.08 * f; sx = 1 + 0.05 * f; ox = Math.sin(this.st * 70) * 2.2 * f;
      }
      if (this.state === 'recover') { sy = 0.96; sx = 1.03; }
      Ale.drawSprite(ctx, this.frame(), x, y, { flip: this.facing < 0, sx, sy, ox });
      if (this.state === 'windup') {
        const s = 0.55 + 0.25 * Math.sin(this.st * 30);
        Ale.drawSprite(ctx, 'fx_warn', x, y - 74 - 6 * Math.sin(this.st * 20), { sx: s, sy: s });
      }
    }
  }

  Ale.Rat = Rat;
})();
