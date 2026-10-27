// Бубел (спутник Алеси) и служащий почты.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  // Говорит ли сейчас (печатает реплику) персонаж с этим id.
  Ale.isSpeaking = (id) => {
    const d = Ale.UI.dlg;
    if (!d) return false;
    const l = d.lines[d.i];
    return l.who === id && d.shown < l.text.length;
  };

  // ------------------------------------------------------------------ Бубел
  class Bubel extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 36, h: 44, z: 54, id: 'bubel' }, o));
      this.headH = 66;
      this.mode = 'follow';       // follow | stay
      this.stayX = this.x;
      this.followDist = 96;
      this.phase = 0;
      this.auto = null;
      this.jumpCd = 0;
      this.barkT = 0;
      this.lookDir = 1;
      this.sq = { x: 1, y: 1 };
      this.landT = 0;             // после прыжка короткое время показывается кадр приземления
    }

    autoWalk(x, opts) { this.auto = { x, speed: (opts && opts.speed) || 240, arrive: (opts && opts.arrive) || 10 }; }

    // Берег (hopGaps): Бубел знает камни (Ale.COAST.stones). Он ищет цель только на камне героини, а если она на другом камне — идёт к краю своего камня в её сторону
    // и перепрыгивает на соседний с расчётом дальности (владелец 03.10.2026: «Бубел падает в воду, если встать на краю — он должен идеально перемещаться между островками»).
    _stoneTarget(p, target) {
      const S = Ale.COAST.stones;
      const at = (x) => { let best = -1, bd = 1e9; for (let i = 0; i < S.length; i++) { const d = x < S[i][0] ? S[i][0] - x : x > S[i][1] ? x - S[i][1] : 0; if (d < bd) { bd = d; best = i; } } return best; };
      if (p.onGround && p.ground && p.ground.kind === 'stone') this._pStone = p.ground.i;          // в прыжке героиня «стоит» на камне, с которого прыгнула
      const pi = this._pStone === undefined ? at(p.x) : this._pStone;
      const bi = this.onGround && this.ground && this.ground.kind === 'stone' ? this.ground.i : -1;
      if (bi < 0) return this.x;                                                                      // в воздухе цель не важна
      const s = S[bi];
      if (bi === pi) return Ale.clamp(target, s[0] + 26, s[1] - 26);
      const over = this.w / 2 + 26;                                                                   // цель за краем дальше допуска «пришёл» (18) и полуширины тела: он доходит до обрыва, у разрыва срабатывает прыжок, у ступеньки без разрыва — сходит вниз
      return pi > bi ? s[1] + over : s[0] - over;
    }
    // Прыжок на соседний камень: вертикальная скорость прежняя, горизонтальная — ровно столько, чтобы приземлиться на ближней части того камня
    _coastHop(dir) {
      const S = Ale.COAST.stones, bi = this.ground && this.ground.kind === 'stone' ? this.ground.i : -1, a = S[bi], b = S[bi + dir];
      if (!a || !b) return false;
      const land = dir > 0 ? b[0] + 46 : b[1] - 46, dy = b[2] - a[2], vy = -820, g = 2400;
      const t = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * dy))) / g;
      // Камень выше и он вплотную: стенка гасит боковую скорость, и он прыгал бы на месте. Пока ноги ниже верха камня, вбок не двигаемся (время подъёма вычитаем из полёта).
      const near = dir > 0 ? b[0] - (this.x + this.w / 2) : this.x - this.w / 2 - b[1];
      const wait = dy < 0 && near < 8 ? (-vy - Math.sqrt(Math.max(0, vy * vy + 2 * g * dy))) / g : 0;
      this.hopWallTop = wait > 0 ? b[2] : null;
      this.hopVx = dir * Ale.clamp(Math.abs(land - this.x) / Math.max(0.2, t - wait), 80, 520);
      this.vy = vy; this.vx = this.hopWallTop !== null && this.y > this.hopWallTop ? 0 : this.hopVx; this.hopLock = true; this.jumpCd = 0.5; this.lookDir = dir;
      this.sq.x = 0.94; this.sq.y = 1.08;
      return true;
    }

    // Поставить рядом с героиней (аварийный телепорт и возвращение после падения). Место «за её спиной» у края мира лежит внутри толстой стены, и Бубел оказывалась за краем пола и падала вечно
    // (ASSAS, героиня у правого края лицом влево, 18.10.2026) — пробуем за спиной, потом перед ней, потом на ней, каждое в пределах мира и вне твёрдых; нигде нельзя — остаётся на месте и дойдёт сама.
    _beside(p) {
      const sc = this.scene, w = sc.world, bw = this.w || 40, bh = this.h || 50, free = (tx) => !w.solids.some((r) => tx - bw / 2 < r.x + r.w && tx + bw / 2 > r.x && p.y - bh < r.y + r.h && p.y > r.y);
      const f = p.facing || 1; let spot = null;
      for (const c of [p.x - f * 140, p.x + f * 140, p.x]) { const tx = Ale.clamp(c, 40, sc.width - 40); if (free(tx)) { spot = tx; break; } }
      if (spot === null) return false;
      this.x = spot; this.y = p.y; this.vy = 0; this.hopLock = false; sc.fx.sparks(this.x, this.y - 20, 6);
      return true;
    }
    // Отпрыгнуть в сторону (под ней разбили крышку люка): прыжок с постоянной боковой скоростью, как через воду на берегу (hopLock); приземляется уже за краем проёма.
    scoot(dir) {
      this.hopLock = true; this.hopVx = dir * 340; this.hopWallTop = null;
      this.vy = -760; this.vx = this.hopVx; this.onGround = false; this.jumpCd = 0.5; this.lookDir = dir;
      this.sq.x = 0.94; this.sq.y = 1.08;
    }

    // Если игрок долго стоит на месте, Бубел подаёт голос (редко, без диалога).
    _quip(dt, p) {
      if (this.mode === 'stay') return;                         // в сторонке (бой) он болеет выкриками из сценария, а не скучает вслух
      const still = p && p.onGround && Math.abs(p.vx) < 5 && p.state === 'free' && !this.scene.locked && !Ale.UI.modal && Ale.UI.hints.length === 0;
      this.stillT = still ? (this.stillT || 0) + dt : 0;
      this.quipCool = Math.max(0, (this.quipCool === undefined ? 14 : this.quipCool) - dt);
      if (this.stillT > 11 && this.quipCool <= 0) {
        const q = Ale.T.idleQuips;
        this.qi = ((this.qi === undefined ? -1 : this.qi) + 1 + Math.floor(Ale.fxRng.next() * 2)) % q.length;
        Ale.UI.hint('bubel', q[this.qi], 4); this.bark(0.5);
        this.quipCool = 32; this.stillT = 0;
      }
    }
    bark(dur) { this.barkT = dur || 0.5; Ale.Audio.sfx('bark'); }
    // Говорит подсказку: шевелит пастью, изредка тявкает (без подпрыгивания).
    talk(dur) { this.talkT = Math.max(this.talkT || 0, dur); if (!this.talkCool || this.talkCool <= 0) { Ale.Audio.sfx('bark', { vol: Ale.Audio.TRIM.hint }); this.talkCool = 3.5; } }

    update(dt) {
      super.update(dt);
      const sc = this.scene, w = sc.world, p = sc.player;
      if (this.jumpCd > 0) this.jumpCd -= dt;
      if (this.barkT > 0) this.barkT -= dt;
      if (this.talkT > 0) this.talkT -= dt;
      if (this.talkCool > 0) this.talkCool -= dt;
      this._quip(dt, p);
      let target = null, maxSp = 340;
      if (this.auto) { target = this.auto.x; maxSp = this.auto.speed; }
      else if (this.mode === 'stay') target = this.stayX;
      else if (p) {
        target = p.x - p.facing * this.followDist;
        // не толкаться прямо под ногами: если игрок стоит — держаться сбоку
        if (Math.abs(p.vx) < 30 && Math.abs(this.x - p.x) < 60) target = this.x;
        if (this.hopGaps) target = this._stoneTarget(p, target);                                   // берег: цель только на камнях, не над водой
        if (Math.abs(p.x - this.x) > 950) this._beside(p);                                         // аварийный телепорт к героине
      }
      // у края пропасти без дна (люк на почте — единственная в игре) Бубел останавливается: раньше он шагал в неё и падал вечно, а облачка его реплик уходили за кадр (11.10.2026)
      if (target !== null && target !== this.x && this.onGround && !this.hopGaps && !w.hasSupport(this.x + Math.sign(target - this.x) * 30, this.y, 3000)) target = this.x;
      let move = 0;
      if (this.hopLock && !this.onGround) {                                                               // в прыжке через воду скорость не меняется
        move = Math.sign(this.hopVx);
        this.vx = this.hopWallTop !== null && this.y > this.hopWallTop ? 0 : this.hopVx;
      }
      else if (target !== null) {
        const dx = target - this.x;
        const arrive = this.auto ? this.auto.arrive : 18;
        if (Math.abs(dx) > arrive) {
          move = Math.sign(dx);
          const sp = Ale.clamp(Math.abs(dx) * 3.4, 70, maxSp);
          this.vx = Ale.approach(this.vx, move * sp, 2600 * dt);
          this.lookDir = move;
        } else {
          this.vx = Ale.approach(this.vx, 0, 2600 * dt);
          if (this.auto) this.auto = null;
        }
      } else this.vx = Ale.approach(this.vx, 0, 2600 * dt);
      if (Math.abs(this.vx) < 15 && p && !this.auto) this.lookDir = p.x >= this.x ? 1 : -1;
      this.facing = this.lookDir;

      // перепрыгивать препятствия и подскакивать к игроку на возвышении
      if (this.onGround && this.jumpCd <= 0) {
        const blocked = move !== 0 && w.blockedAhead(this, move, 6);
        const above = p && p.onGround && p.y < this.y - 60 && Math.abs(p.x - this.x) < 170;
        const gap = this.hopGaps && move !== 0 && !w.hasSupport(this.x + move * 26, this.y, 36);      // берег: у обрыва между камнями — перепрыгнуть (hopGaps включает сцена)
        if (gap && this._coastHop(move)) { /* прыжок на соседний камень с расчётом дальности */ }
        else if (blocked || above || gap) { this.vy = -820; this.jumpCd = 0.55; this.sq.x = 0.94; this.sq.y = 1.08; }
      }
      this.vy = Math.min(this.vy + 2400 * dt, 1100);
      const wasGround = this.onGround;
      w.move(this, dt);
      // провалилась за нижний край мира (пол под ней пропал, а дна нет: люк на почте, 18.10.2026): вернуть к героине, а не оставлять падать вечно; если героиня сама ниже края — не трогаем (сцена вот-вот сменится)
      if (this.y > sc.height + 300 && p && p.y < sc.height) this._beside(p);
      if (this.onGround && !wasGround) { this.sq.x = 1.06; this.sq.y = 0.94; this.landT = 0.1; this.hopLock = false; }
      if (this.landT > 0) this.landT -= dt;
      const k = Math.min(1, 14 * dt);
      this.sq.x += (1 - this.sq.x) * k; this.sq.y += (1 - this.sq.y) * k;
      if (this.onGround && Math.abs(this.vx) > 20) this.phase += Math.abs(this.vx) * dt / 16;
      else if (Math.abs(this.vx) < 20) this.phase = 0;
    }

    // Кадры: бег из 8 кадров, прыжок (вверх / падение / приземление), лай из двух кадров, стойка (раз в несколько секунд — «ухо дёрнулось»)
    frame() {
      if (!this.onGround) return this.vy < 0 ? 'bub_jump_up' : 'bub_jump_fall';
      if (this.landT > 0) return 'bub_jump_land';
      if (Math.abs(this.vx) > 20) return 'bub_run' + ((Math.floor(this.phase) % 8) + 1);
      if (this.barkT > 0 || this.talkT > 0 || Ale.isSpeaking(this.id)) return (Math.floor(this.t * 9) % 2) ? 'bub_bark' : 'bub_bark2';
      return this.t % 4.3 > 4.05 ? 'bub_idle2' : 'bub_idle';
    }

    draw(ctx, alpha) {
      if (this.hidden) return;                 // кат-сцены: Бубел «ушёл» (например, поднялся по трапу)
      const x = this.rx(alpha), y = this.ry(alpha);
      this.drawShadow(ctx, x, y, 24, 0.32);
      let sx = this.sq.x, sy = this.sq.y, oy = 0;
      const f = this.frame();
      if (f === 'bub_idle' || f === 'bub_idle2') { const b = Math.sin(this.t * 3.4); sy *= 1 + b * 0.02; sx *= 1 - b * 0.01; }
      if (this.barkT > 0) oy = -Math.abs(Math.sin(this.barkT * 18)) * 8;
      Ale.drawSprite(ctx, f, x, y, { flip: this.facing < 0, sx, sy, oy });
    }
  }

  // ------------------------------------------------------------------ Служащий почты
  class Clerk extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 60, h: 120, z: 26, id: 'clerk' }, o));
      this.counterTop = o.counterTop;
      this.bust = o.bust || 'clerk_bust';               // картинка бюста: служащий почты или дежурная в аэропорту (att_bust)
      this.hide = o.hide === undefined ? 16 : o.hide;   // сколько низа бюста спрятано за стойкой (юн.): у бюста поменьше — меньше, иначе подбородок уходит под стойку
      const sz = Ale.spriteSize(this.bust);
      this.headH = this.y - (this.counterTop + this.hide - (sz ? sz.h : 66));   // макушка бюста над стойкой
      this.promptY = this.headH + 12;
      this.interactable = true; this.interactRange = 150;
      this.onTalk = o.onTalk;
      this.nod = 0;
    }

    canInteract() { return !!this.onTalk; }
    interact(p) { if (this.onTalk) this.onTalk(p); }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}

    update(dt) { super.update(dt); if (this.nod > 0) this.nod -= dt; }

    draw(ctx, alpha) {
      const talk = Ale.isSpeaking(this.id);
      const bob = Math.sin(this.t * 2.2) * 1.2 + (talk ? Math.abs(Math.sin(this.t * 13)) * -3 : 0) + (this.nod > 0 ? Math.sin(this.nod * 20) * 3 : 0);
      Ale.drawSprite(ctx, this.bust, this.x, this.counterTop + this.hide + bob, { flip: this.facing < 0 });
    }
  }

  Ale.Bubel = Bubel;
  Ale.Clerk = Clerk;
})();
