// Даня: хулиганит, крадёт ключ и убегает; в конце туннеля — «шуточный бой»
// (бегает по арене, перепрыгивает через Алесю, швыряется бумажными комками; шесть попаданий — и ключ возвращён).
// Ходьба (6 кадров), бег (8 кадров с фазой полёта) и прыжок (присед, верхняя точка, падение, приземление) — настоящие рисованные кадры (лист danechka_run_sheet.png);
// боль (2), сдача, пинок (2) и хихиканье (2) — лист danya_extra_sheet.png.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const D = (Ale.DANECHKA = {
    W: 46, H: 152,
    WALK: 130, RUN: 360, GRAV: 2600,
    // Юнитов пути на один кадр цикла. Опорная стопа в кадрах смещается назад ≈ на 21 юнит за кадр (ходьба, 6 кадров) и ≈ на 46 (бег, 8 кадров:
    // измерено по пикселям кадров), при таком шаге стопа стоит на земле. Для бега взято 42: цикл идёт ≈ 8,6 кадра/с при скорости 360, скольжение ≈ 10%.
    STRIDE_WALK: 21, STRIDE_RUN: 42,
    CROUCH_T: 0.14, LAND_T: 0.11, WINDUP: 0.55,
    HURT_T: 0.9,
    HP: 6,                          // сколько попаданий выдерживает в «шуточном бое» (было 4, потом 6: бой стал длиннее)
  });

  // Кисть передней руки (юниты от опоры, кадр смотрит вправо): в неё вкладывается ключ
  // (бег — измерено по листу: центр переднего кулака относительно опоры)
  const HAND = {
    dan_idle: [-6, 84], dan_side: [14, 68], dan_walk1: [25.4, 75.3], dan_walk2: [28.5, 75.3], dan_walk3: [10.2, 73.3], dan_walk4: [16.3, 77.3], dan_walk5: [23.4, 75.3], dan_walk6: [24.4, 75.3],          // ходьба — кадры подогнаны по голове (×1,0177, 12.10.2026), кисти пересчитаны
    dan_run1: [40, 90], dan_run2: [38, 92], dan_run3: [48, 84], dan_run4: [38, 63], dan_run5: [37, 93], dan_run6: [35, 92], dan_run7: [42, 99], dan_run8: [37, 78],
    dan_jump_up: [19, 78], dan_jump_apex: [33, 58], dan_jump_fall: [37, 134], dan_jump_land: [36, 59], dan_grab: [43, 96],
    dan_yield: [38, 93], dan_hurt1: [24, 102], dan_hurt2: [32, 99], dan_kick1: [20, 84], dan_kick2: [22, 102], dan_giggle1: [7, 50], dan_giggle2: [8, 48],      // центры кистей по цвету кожи (тот же способ, что у прежних кадров)
  };

  class Danechka extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: D.W, h: D.H, z: 53, id: 'danechka' }, o));
      this.headH = 176;
      this.pose = null;             // 'idle' | 'grab' | 'kick1' | 'kick2' — принудительная поза сценария (пинок бочки: замах kick1, удар kick2)
      this.auto = null;             // { x, speed, arrive }: идти/бежать к x
      this.phase = 0;
      this.giggleT = 0;
      this.hasKey = false;
      // script | idle | windup | throw | recover | run | crouch | air | land | hurt | yield
      this.state = 'script';
      this.st = 0; this.hp = D.HP; this.team = 'enemy'; this.vulnerable = false; this.aimable = true;
      this.arena = o.arena || { x0: 0, x1: 1000 };
      this.pause = 0; this.flash = 0; this.markers = []; this.invul = 0;
      this.plan = null;             // запланированный прыжок { vx, vy, after }
      this.runTo = null;            // цель перебежки в бою
      this.after = null;            // что делать после приземления: 'idle' | 'script'
      this.lastFoot = -1;
      this.dodgeCd = 0;             // пауза между уворотами от помидоров
    }

    hurtbox() { return { x: this.x - D.W / 2, y: this.y - D.H, w: D.W, h: D.H }; }

    // Занят прыжком: сценарий ждёт, пока он не приземлится.
    get busy() { return this.state === 'crouch' || this.state === 'air' || this.state === 'land'; }

    autoWalk(x, opts) { this.auto = { x, speed: (opts && opts.speed) || D.WALK, arrive: (opts && opts.arrive) || 8 }; }

    giggle(dur) {
      const again = this.giggleT > 0.3;              // уже хихикает: не дублируем надпись
      this.giggleT = dur || 0.9;
      if (again) return;
      Ale.Audio.sfx('giggle');
      this.scene.fx.text(this.x + 20, this.y - 176, Ale.T.fx.giggle, { size: 24, life: 0.9 });
    }

    // Прыжок в точку (tx, ty) — координаты опоры стоп. Присед 0.14 с, дуга с запасом clearance над целью, приземление.
    // opts.pose — поза в воздухе (например 'grab'), opts.clear — запас высоты над целью.
    leapTo(tx, ty, opts) {
      opts = opts || {};
      const g = D.GRAV, dy = ty - this.y, dx = tx - this.x, clear = opts.clear === undefined ? 34 : opts.clear;
      const vy = -Math.sqrt(2 * g * (Math.max(0, -dy) + clear));
      const t = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * dy))) / g;         // время до попадания в цель по нисходящей ветви (max: при clear = 0 подкоренное округлялось в −ε и давало NaN)
      this.facing = dx >= 0 ? 1 : -1;
      this.plan = { vx: dx / t, vy };
      this.airPose = opts.pose || null;
      this.after = opts.after || 'script';
      this.state = 'crouch'; this.st = 0; this.vx = 0;
    }

    // Нырок в люк: разбег → прыжок → вниз ногами в лаз. hx — центр лаза, rimY — экранная линия передней кромки (ниже неё его не видно).
    dive(hx, rimY) {
      const T = 0.42;                                     // за это время он окажется над центром лаза
      this.state = 'dive'; this.st = 0; this.diveX = hx; this.clipY = rimY; this.vulnerable = false; this.auto = null;
      this.facing = hx >= this.x ? 1 : -1;
      this.vx = (hx - this.x) / T; this.vy = -380; this.onGround = false;
      this.scene.fx.dust(this.x, this.y, 4, 0, 0.9);       // прыжки Дани не озвучиваются (владелец 02.10.2026: «странные резкие звуки типа выстрелов»): только пыль
    }

    startFight() {
      this.state = 'idle'; this.st = 0; this.pause = 0.8; this.vulnerable = true; this.pose = null; this.auto = null;
      this.scene.boss = { name: Ale.Speakers.danechka.name, max: D.HP, value: () => D.HP - this.hp };
    }

    // ---------------------------------------------------------------- обновление
    update(dt) {
      super.update(dt);
      const sc = this.scene, w = sc.world, p = sc.player;
      this.st += dt;
      if (this.giggleT > 0) this.giggleT -= dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.invul > 0) this.invul -= dt;
      if (this.dodgeCd > 0) this.dodgeCd -= dt;
      for (const m of this.markers) m.life -= dt;
      this.markers = this.markers.filter((m) => m.life > 0);
      if (this.ghost) { this.vy += 1500 * dt; this.y += this.vy * dt; return; }   // проваливается в люк: без столкновений
      if (this.state === 'dive') {                                                // нырок: по дуге, без столкновений
        this.vy += 2000 * dt; this.y += this.vy * dt;
        const nx = this.x + this.vx * dt;
        if ((this.vx >= 0 && nx >= this.diveX) || (this.vx < 0 && nx <= this.diveX)) { this.x = this.diveX; this.vx = 0; } else this.x = nx;
        if (this.y > 800) this.dead = true;
        return;
      }
      let move = 0, sp = D.WALK;
      const dx = p ? p.x - this.x : 0, dist = Math.abs(dx);

      switch (this.state) {
        case 'script':
          if (this.auto) {
            const d = this.auto.x - this.x;
            if (Math.abs(d) <= this.auto.arrive) this.auto = null;
            else { move = Math.sign(d); sp = this.auto.speed; this.facing = move; }
          }
          if (!move) this.vx = Ale.approach(this.vx, 0, 2600 * dt);
          break;

        case 'idle':
          if (p) this.facing = dx >= 0 ? 1 : -1;
          this.vx = Ale.approach(this.vx, 0, 2200 * dt);
          this.pause -= dt;
          if (this._dodgeTomato()) break;
          if (this.pause <= 0 && p && !p.down) this._decide(dx, dist);
          break;

        case 'windup':
          if (p) this.facing = dx >= 0 ? 1 : -1;
          this.vx = Ale.approach(this.vx, 0, 2200 * dt);
          if (this.st >= D.WINDUP) this._throw();
          break;

        case 'throw':
          if (this.st >= 0.3) { this.state = 'recover'; this.st = 0; }
          break;

        case 'recover':
          if (p) this.facing = dx >= 0 ? 1 : -1;
          this.vx = Ale.approach(this.vx, 0, 2200 * dt);
          if (this.st >= 0.55) { this.state = 'idle'; this.pause = Ale.rng.range(0.2, 0.5); }
          break;

        case 'run': {
          // перебежка по арене: видно, как он бежит, а не «переносится»
          if (this._dodgeTomato()) break;
          const d = this.runTo - this.x;
          if (Math.abs(d) < 14 || this.st > 1.6 || this._atEdge(Math.sign(d))) { this.state = 'idle'; this.pause = Ale.rng.range(0.25, 0.5); break; }
          move = Math.sign(d); sp = D.RUN; this.facing = move;
          break;
        }

        case 'crouch':
          this.vx = Ale.approach(this.vx, 0, 2600 * dt);
          if (this.st >= D.CROUCH_T) {
            this.vx = this.plan.vx; this.vy = this.plan.vy; this.onGround = false;
            this.state = 'air'; this.st = 0;
            sc.fx.dust(this.x, this.y, 4, 0, 0.9);
          }
          break;

        case 'air':
          if (this.onGround && this.st > 0.08) {
            this.state = 'land'; this.st = 0; this.vx = 0; this.airPose = null;
            sc.fx.dust(this.x, this.y, 5, 0, 0.9);
          }
          break;

        case 'land':
          this.vx = Ale.approach(this.vx, 0, 2600 * dt);
          if (this.st >= D.LAND_T) {
            if (this.after === 'idle') { this.state = 'idle'; this.pause = 0.35; if (this.giggleT <= 0) this.giggle(0.7); }
            else this.state = 'script';
          }
          break;

        case 'hurt':
          this.vx = Ale.approach(this.vx, 0, 900 * dt);
          if (this.st >= D.HURT_T) { this.state = 'idle'; this.pause = 0.3; }
          break;

        case 'yield':
          this.vx = Ale.approach(this.vx, 0, 900 * dt);
          break;
      }

      if (move) {
        this.vx = Ale.approach(this.vx, move * sp, 3200 * dt);
        this.phase += Math.abs(this.vx) * dt / (Math.abs(this.vx) > 230 ? D.STRIDE_RUN : D.STRIDE_WALK);
      } else if (Math.abs(this.vx) < 15) this.phase = 0;
      else if (this.onGround) this.phase += Math.abs(this.vx) * dt / D.STRIDE_RUN;
      this.vy = Math.min(this.vy + D.GRAV * dt, 1200);
      w.move(this, dt);

      // топот: пыль из-под ног при каждом «толчке» бега
      if (this.onGround && Math.abs(this.vx) > 230) {
        const idx = Math.floor(this.phase) % 8;
        if ((idx === 0 || idx === 4) && idx !== this.lastFoot) { this.lastFoot = idx; sc.fx.dust(this.x - this.facing * 16, this.y, 1, -this.facing, 0.7); if (idx === 0) Ale.Audio.sfx('step', { vol: 0.35 }); }
        else if (idx !== 0 && idx !== 4) this.lastFoot = -1;
      }
    }

    _atEdge(dir) { return (dir < 0 && this.x < this.arena.x0 + 30) || (dir > 0 && this.x > this.arena.x1 - 30); }

    // Ловкий: увидев летящий помидор, отскакивает по ходу полёта (прыжок 0.14 с приседа + дуга), и помидор падает в пустоту.
    // Помидор, брошенный в тот момент, когда он замахивается или отдыхает после броска, увернуть уже не получится.
    _dodgeTomato() {
      if (this.dodgeCd > 0 || !this.vulnerable || this.invul > 0) return false;
      const sc = this.scene;
      for (const e of sc.entities) {
        if (e.dead || !(e instanceof Ale.Projectile) || e.team !== 'player' || e.kind !== 'tomato') continue;
        const rel = this.x - e.x;
        if (Math.sign(rel) !== Math.sign(e.vx) || Math.abs(rel) > 340 || Math.abs(rel) < 90) continue;
        this.dodgeCd = 1.7;
        if (!Ale.rng.chance(0.62)) return false;
        const dir = Math.sign(e.vx), room = dir > 0 ? this.arena.x1 - this.x : this.x - this.arena.x0;
        if (room < 200) return false;
        this.facing = -dir;
        this.leapTo(this.x + dir * Math.min(300, room - 30), this.y, { after: 'idle', clear: 60 });
        return true;
      }
      return false;
    }

    // Выбор действия в бою по расстоянию до Алеси и месту на арене: почти всегда в движении.
    _decide(dx, dist) {
      const R = Ale.rng, away = dx >= 0 ? -1 : 1;
      const room = away > 0 ? this.arena.x1 - this.x : this.x - this.arena.x0;
      if (dist < 260) {
        if (room > 380 && R.chance(0.65)) return this._runAway(away);
        return this._hop(dx);
      }
      const roll = R.next();
      if (roll < 0.45) { this.state = 'windup'; this.st = 0; Ale.Audio.sfx('teacher_windup'); this.giggle(0.5); }
      else if (roll < 0.85) {
        // перебежка на новое место: подальше от Алеси, но не в угол
        const to = Ale.clamp(this.x + (R.chance(0.5) ? -1 : 1) * R.range(300, 620), this.arena.x0 + 80, this.arena.x1 - 80);
        if (Math.abs(to - this.x) < 120) { this.pause = 0.4; return; }
        this.runTo = to; this.state = 'run'; this.st = 0;
      } else { this.pause = 0.45; this.giggle(0.8); }
    }

    _runAway(dir) {
      const R = Ale.rng;
      this.runTo = Ale.clamp(this.x + dir * R.range(300, 520), this.arena.x0 + 60, this.arena.x1 - 60);
      this.state = 'run'; this.st = 0;
    }

    // Перепрыгнуть через Алесю (или прочь от неё, если рядом стена): с приседом и настоящей дугой.
    _hop(dx) {
      let dir = dx >= 0 ? -1 : 1;
      if ((dir < 0 && this.x < this.arena.x0 + 220) || (dir > 0 && this.x > this.arena.x1 - 220)) dir = -dir;      // упёрся — прыгнуть НАД ней
      const tx = Ale.clamp(this.x + dir * 330, this.arena.x0 + 40, this.arena.x1 - 40);
      this.leapTo(tx, this.y, { after: 'idle', clear: 96 });
    }

    _throw() {
      const sc = this.scene, p = sc.player;
      this.state = 'throw'; this.st = 0;
      const f = this.facing, ox = this.x + f * 60, oy = this.y - 118;
      const tx = p ? p.x : this.x + f * 400, T = 0.9, g = 1000, ty = this.y - 48;
      const vx = (tx - ox) / T, vy = (ty - oy - 0.5 * g * T * T) / T;
      sc.add(new Ale.Projectile({ x: ox, y: oy, team: 'enemy', kind: 'paper', sprite: 'pr_paper', vx, vy, g, r: 20, spin: 9 * f, life: 2.2 }));
      this.markers.push({ x: tx, life: T + 0.05, t0: T });
      Ale.Audio.sfx('throw_paper');
      this.giggle(0.6);
    }

    takeHit(info) {
      if (!this.vulnerable || this.invul > 0) return false;
      if (info.kind !== 'tomato' && info.kind !== 'stomp') return false;
      const sc = this.scene;
      this.hp--;
      this.invul = D.HURT_T + 0.1;
      this.flash = 0.22;
      this.markers.length = 0;
      this.runTo = null; this.plan = null; this.airPose = null;
      this.vx = (info.dir || 1) * 240;
      Ale.Game.hitstop(7);
      sc.camera.shake(8, 0.3);
      sc.fx.sparks(this.x, this.y - 100, 8);
      Ale.Audio.sfx('teacher_hit');
      if (this.hp <= 0) { this.state = 'yield'; this.st = 0; this.vulnerable = false; Ale.Game.slow(0.3, 0.8); }
      else { this.state = 'hurt'; this.st = 0; }
      if (sc.onDanechkaHit) sc.onDanechkaHit(this);
      return true;
    }

    // ---------------------------------------------------------------- вид
    // Что рисовать: спрайт и наклон/растяжение. Наклон вперёд задаётся со знаком по facing.
    look() {
      const F = this.facing, k = (a) => a * F;
      const speed = Math.abs(this.vx);
      const S = Ale.Assets.sprites;
      if (this.state === 'dive') {
        // нырок в люк: над лазом — собранный прыжок, потом вниз ногами с поднятыми руками
        const v = this.vy;
        if (v < 160) return { f: 'dan_jump_apex', rot: 0, sx: 1, sy: 1, oy: 0 };
        return { f: 'dan_jump_fall', rot: 0, sx: 1, sy: 1, oy: 0 };
      }
      if (this.state === 'air' && this.airPose) return { f: 'dan_' + this.airPose, rot: k(this.vy < -260 ? -0.1 : this.vy > 260 ? 0.14 : 0.02), sx: 1, sy: 1, oy: 0 };
      if (this.pose) return { f: 'dan_' + this.pose, rot: 0, sx: 1, sy: 1, oy: 0 };
      switch (this.state) {
        case 'windup': { const c = Ale.clamp(this.st / D.WINDUP, 0, 1); return { f: 'dan_idle', rot: k(-0.09 * c), sx: 1 + 0.03 * c, sy: 1 - 0.05 * c, oy: 0, ox: -F * 5 * c }; }
        case 'throw': return { f: 'dan_grab', rot: k(0.03), sx: 1, sy: 1, oy: 0 };
        case 'recover': return this.giggleT > 0 ? this._giggleLook() : { f: 'dan_idle', rot: 0, sx: 1, sy: 1, oy: 0 };
        case 'hurt': return this.st < 0.3 ? { f: 'dan_hurt1', rot: 0, sx: 1, sy: 1, oy: 0, ox: Math.sin(this.st * 80) * 3 * (1 - this.st / 0.3) } : { f: 'dan_hurt2', rot: 0, sx: 1, sy: 1, oy: 0 };    // удар: отшатнулся (глаза зажмурены), потом пятится
        case 'yield': return { f: 'dan_yield', rot: 0, sx: 1, sy: 1, oy: 0 };                      // сдался: протянутая ладонь (в неё ложится ключ)
        case 'crouch': return { f: 'dan_jump_up', rot: 0, sx: 1, sy: 1, oy: 0 };                  // присед перед прыжком: руки назад
        case 'land': return { f: 'dan_jump_land', rot: 0, sx: 1, sy: 1, oy: 0 };                  // приземление: присед, руки вперёд
        case 'air': return { f: this.vy > 300 ? 'dan_jump_fall' : 'dan_jump_apex', rot: 0, sx: 1, sy: 1, oy: 0 };
      }
      if (!this.onGround) return { f: 'dan_jump_apex', rot: 0, sx: 1, sy: 1, oy: 0 };
      if (speed > 15) {
        // бег — 8 кадров с фазой полёта (в кадрах полёта корпус приподнят на el), ходьба — 6 кадров
        if (speed > 230) { const f = 'dan_run' + ((Math.floor(this.phase) % 8) + 1); return { f, rot: 0, sx: 1, sy: 1, oy: S[f] ? -S[f].el : 0 }; }
        return { f: 'dan_walk' + ((Math.floor(this.phase) % 6) + 1), rot: 0, sx: 1, sy: 1, oy: 0 };
      }
      // на месте: дышит; хихикая — смеётся (два кадра по очереди)
      if (this.giggleT > 0) return this._giggleLook();
      const b = Math.sin(this.t * 2.4);
      return { f: 'dan_idle', rot: 0, sx: 1, sy: 1 + b * 0.01, oy: 0 };
    }

    _giggleLook() { return { f: Math.floor(this.t * 8) % 2 ? 'dan_giggle2' : 'dan_giggle1', rot: 0, sx: 1, sy: 1, oy: 0 }; }

    draw(ctx, alpha) {
      if (this.hidden) return;
      const x = this.rx(alpha), y = this.ry(alpha);
      if (this.clipY === undefined) this.drawShadow(ctx, x, y, 34, 0.34);
      const L = this.look();
      const flash = this.flash > 0 ? Math.min(1, this.flash / 0.15) * 0.6 : 0;
      for (const m of this.markers) {
        const k = 1 - Ale.clamp(m.life / m.t0, 0, 1);
        const sy2 = this.scene.world.supportY(m.x, this.y - 30, 0, 40) || this.y;
        ctx.save(); ctx.translate(m.x, sy2); ctx.scale(1, 0.28);
        ctx.strokeStyle = 'rgba(214,52,33,' + (0.35 + 0.4 * k).toFixed(2) + ')'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(0, 0, 36 - 14 * k, 0, 6.283); ctx.stroke(); ctx.restore();
      }
      if (this.clipY !== undefined) { ctx.save(); ctx.beginPath(); ctx.rect(x - 300, y - 600, 600, this.clipY - (y - 600)); ctx.clip(); }      // в люке: ниже кромки не видно
      // след при быстром беге и в прыжке: два бледных «следа» позади
      const sp = Math.abs(this.vx);
      if ((sp > 300 && this.onGround) || this.state === 'air') {
        for (let i = 2; i >= 1; i--) Ale.drawSprite(ctx, L.f, x - Math.sign(this.vx || this.facing) * i * (sp > 300 ? 15 : 10), y, { flip: this.facing < 0, ox: L.ox || 0, oy: L.oy, rot: L.rot, sx: L.sx, sy: L.sy, alpha: 0.13 / i });
      }
      const so = { flip: this.facing < 0, ox: L.ox || 0, oy: L.oy, rot: L.rot, sx: L.sx, sy: L.sy, flash };
      Ale.drawSprite(ctx, L.f, x, y, so);
      if (this.hasKey) {
        // ключ — в кулаке: точка кисти по кадру проходит через тот же наклон и сжатие, что и спрайт
        const h = HAND[L.f] || HAND.dan_idle, palm = L.f === 'dan_yield', pt = Ale.spritePoint(x, y, so, h[0] + (palm ? 2 : 3), h[1] + (palm ? 6 : 3)), face = this.facing < 0 ? -1 : 1;
        Ale.drawSprite(ctx, 'it_key', pt.x, pt.y, { flip: face < 0, sx: 0.7 * (L.sx || 1), sy: 0.7 * (L.sy || 1), rot: (L.rot || 0) + (palm ? -1.13 : -1.83) * face });
      }
      if (this.clipY !== undefined) ctx.restore();
      if (this.state === 'windup') {
        const s = 0.7 + 0.25 * Math.sin(this.st * 26);
        Ale.drawSprite(ctx, 'fx_warn', x, y - 196, { sx: s, sy: s });
      }
    }
  }

  D.HAND = HAND;
  Ale.Danechka = Danechka;
})();
