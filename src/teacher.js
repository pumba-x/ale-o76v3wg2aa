// Преподавательница ASSAS — босс Парижа.
// Восемь попаданий помидором = восемь стадий пятен (после восьмого сдаётся). Между попаданиями она бросает мел (прыжок/присед) и
// бумажные комки (видна тень падения; с четвёртой стадии иногда парой), а вблизи бьёт. «Туп лапой» отбрасывает её — это ответ на сближение.
// Она наблюдает за игроком: присел — бьёт мелом по ногам, прыгнул — целится в место приземления, стоит на месте — накрывает
// комком, а от летящего помидора при свободных руках ловко отступает (но не во время замаха и отдыха после броска).
// Две фазы. Первая — как выше. Когда здоровья остаётся половина (после четвёртого попадания), она бросает реплику и на ~6 секунд устраивает
// «волну мела»: раз в 1,5 с по очереди верхний и нижний мел (BARRAGE) — стоит на месте, не отступает и не сбивается попаданием, игрок вынужден
// уворачиваться. После волны меняется одно: она лучше уворачивается от помидоров (EVADE_P2_*).
// Умнее (владелец 09.10.2026: «пусть дерётся лучше»; числа — TC.SMART): против обстрела издалека бросается на героиню («бросок» с предупреждением: поза ярости, значок над головой, звук) и бьёт вблизи;
// вторая пощёчина, если героиня осталась рядом; в момент броска «переигрывает» мел против упреждающего уклонения (пригнулась заранее — нижний, прыгнула заранее — верхний); уворачивается
// от помидоров тем лучше, чем чаще в неё целятся, и сразу отвечает броском, когда он разрешён (не чаще раза в 1,5 с — это правило прежнее); держится дальше от «Туп лапой» и подходит ближе по мере
// злости; в шагах — «рваный» ритм. Всё, что новое, мягче в лёгком режиме и злее во второй фазе.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const TC = (Ale.TEACHER = {
    W: 64, H: 164, HP: 8,
    WALK: 124, BACK: 172, STRIDE: 27,
    // числа по стадиям пятен 0..7: чем больше пятен, тем она злее и быстрее
    WINDUP: [0.72, 0.67, 0.62, 0.58, 0.54, 0.51, 0.48, 0.46],
    SHOT_CD: [[1.4, 2.3], [1.35, 2.2], [1.3, 2.1], [1.2, 2.0], [1.15, 1.9], [1.1, 1.8], [1.05, 1.7], [1.03, 1.65]],   // «перезарядка» снаряда (мел, комок): вместе с замахом выходит не чаще раза в 1,5 с — на каждый можно спокойно отреагировать
    THROW_T: 0.3, RECOVER: [0.95, 0.85, 0.76, 0.68, 0.61, 0.56, 0.52, 0.5],
    CHALK_SPEED: [430, 450, 475, 500, 520, 540, 555, 565],
    CHALK_AIM: -0.64,                           // поворот спрайта мела относительно направления полёта (ось палочки в спрайте — +0,77 рад, см. items.js): в итоге мел летит почти плашмя
    HURT_T: [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.7, 0.7], STAGGER_T: 0.5,
    SLAP_RANGE: 205, SLAP_WINDUP: [0.36, 0.35, 0.34, 0.33, 0.32, 0.31, 0.3, 0.29], SLAP_T: 0.3,
    EVADE: [0.66, 0.64, 0.62, 0.6, 0.58, 0.56, 0.54, 0.52],       // шанс увернуться от помидора по стадиям
    EVADE_SPEED: 520, EVADE_T: 0.32, EVADE_CD: 1.3, EVADE_SEE: 380,   // видит помидор за 380 юн., после попытки «перезарядка» 1,3 с
    DOUBLE_PAPER: [0, 0, 0, 0.3, 0.38, 0.45, 0.5, 0.52],           // шанс, что комок летит парой: два круга на полу
    // вторая фаза: наступает, когда осталась половина здоровья (после PHASE2_AT-го попадания)
    PHASE2_AT: 4,
    BARRAGE: { shots: 4, first: 1.0, gap: 1.5, windup: 0.5, after: 0.3, recover: 0.8, speed: 0.8 },   // реплика, затем мел раз в 1,5 с: верхний, нижний, верхний, нижний (≈ 6 с всего)
    EVADE_P2_K: 1.4, EVADE_SEE_P2: 520, EVADE_CD_P2: 0.85,   // после волны мела: шанс увернуться ×1,4, видит помидор за 520 юн., пауза между попытками 0,85 с
    // «Умнее» (09.10.2026). Массивы — по стадиям пятен 0..7.
    SMART: {
      rushFar: 430, rushAfter: 2.3, rushSpam: 3.0, rushRoom: 380,                  // «бросок»: героиня дольше 2,3 с дальше 430 юн. (или в неё столько помидоров за последние секунды) — училка бросается к ней
      rushP: [0, 0, 0.22, 0.3, 0.36, 0.42, 0.46, 0.5],               // шанс броска при каждом решении, когда условие выполнено
      rushWind: 0.4, rushSpeed: 480, rushMax: 1.05, rushStop: 135, rushCd: 8.5, rushCdP2: 5.5, rushSlapWind: 0.34, rushFirst: 4,        // rushFirst — сколько секунд после начала боя первого броска не будет
      comboSlap: [0, 0.1, 0.16, 0.22, 0.26, 0.3, 0.34, 0.38], comboWind: 0.26, comboRange: 150, comboMax: 2,      // вторая пощёчина: героиня ближе 150 юн. после первой
      read: [0, 0, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],                // шанс «переиграть» мел в миг броска против упреждающего приседания/прыжка
      spamBonus: 0.07, spamMax: 4, spamTau: 6,                     // к шансу увернуться: +4,5% за каждый помидор, летевший в неё за последние ~6 с (не больше четырёх)
      counter: [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],        // после удачного уклонения — контрбросок, если бросать уже можно
      retreatAt: [250, 252, 255, 258, 262, 266, 270, 275], approachAt: [700, 695, 690, 680, 670, 660, 650, 640],        // чуть дальше от «Туп лапой» и чуть ближе к бою по мере злости (сильнее нельзя: героиню прижимает к краю арены)
      stutter: 0.22,                                                // «рваный» ритм ходьбы к героине: скорость ±22% по синусоиде
      p2: { pause: 1.25, rushK: 1.3, comboK: 1.3, readK: 1.2 },     // вторая фаза: решает на 25% быстрее, бросается и бьёт чаще, лучше читает
      easyK: 0.5,                                                   // в лёгком режиме новые приёмы вдвое реже
    },
  });
  const last = () => TC.HP - 1;                              // индекс последней стадии в таблицах

  class Teacher extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: TC.W, h: TC.H, id: 'teacher', z: 53, facing: -1 }, o));
      this.headH = 196;
      this.team = 'enemy'; this.vulnerable = false; this.aimable = true;
      this.stain = 0;
      this.state = 'dormant'; this.st = 0;
      this.arena = o.arena || { x0: 120, x1: 1800 };
      this.queue = [];
      this.atk = null;
      this.flash = 0;
      this.markers = [];                                  // красные круги: куда упадёт летящий комок; гаснут сами (life) — попадание, оглушение или бросок к героине их не стирают: комок в воздухе всё равно упадёт, и круг должен быть на месте (иначе подсказка «красный круг — куда упадёт комок» врала)
      this.slapHit = false;
      this.lastShots = [];
      this.fleeTo = null;
      this.pause = 0;
      this.phase = 0;
      this.evadeCd = 0;
      this.shotCd = 0;                      // «перезарядка»: до следующего снаряда
      this.phase2 = false; this.phase2Pending = false;     // вторая фаза (волна мела и лучшее уклонение)
      this.bshot = 0; this.bFireAt = -9; this.bWind = false;
      // наблюдение за игроком: копится и «забывается» за несколько секунд
      this.obs = { duck: 0, air: 0, still: 0, close: 0, far: 0, spam: 0 };
      this.seenTomatoes = new WeakSet();    // помидоры героини, которые уже посчитаны как «обстрел»
      this.rushCd = 0;                      // пауза между бросками к героине
      this.stats = { rush: 0, combo: 0, read: 0, counter: 0, evade: 0, slap: 0 };         // сколько раз сработали новые приёмы (проверки и подбор чисел)
      this.counterUntil = 0;                // удачно увернулась — до этого момента (время сцены) ответить броском, как только можно
    }
    // Новые приёмы мягче в лёгком режиме (Ale.Settings.easy) и злее во второй фазе
    _k(kind) {
      const SM = TC.SMART, easy = Ale.Settings && Ale.Settings.easy ? SM.easyK : 1;
      return easy * (this.phase2 ? SM.p2[kind] : 1);
    }

    hurtbox() { return { x: this.x - TC.W / 2, y: this.y - TC.H, w: TC.W, h: TC.H }; }

    _stage() { return Math.min(this.stain, last()); }
    _hurtT() { return TC.HURT_T[Math.max(0, Math.min(this.stain - 1, TC.HURT_T.length - 1))]; }

    startFight() {
      this.vulnerable = true;
      this.state = 'idle'; this.st = 0; this.pause = 0.9; this.rushCd = TC.SMART.rushFirst;
      this.scene.boss = { name: 'Преподавательница ASSAS', max: TC.HP, value: () => this.stain };
    }

    // ---------------------------------------------------------------- наблюдение
    _observe(p, dt) {
      const o = this.obs, k = Math.max(0, 1 - dt / 3.5);
      o.duck *= k; o.air *= k; o.still *= k; o.close *= k; o.spam *= Math.max(0, 1 - dt / TC.SMART.spamTau);
      // новые помидоры героини в полёте — обстрел (считаем каждый один раз)
      for (const e of this.scene.entities) if (e instanceof Ale.Projectile && e.team === 'player' && e.kind === 'tomato' && !e.dead && !this.seenTomatoes.has(e)) { this.seenTomatoes.add(e); o.spam += 1; }
      if (!p || p.down) return;
      // «обстрел издалека»: героиня держится дальше rushFar — копится; ближе — быстро забывается
      o.far = Math.max(0, o.far + (Math.abs(p.x - this.x) > TC.SMART.rushFar ? dt : -dt * 1.6));
      if (p.crouch) o.duck += dt * 1.6;
      if (!p.onGround) o.air += dt * 1.6;
      if (p.onGround && Math.abs(p.vx) < 30 && !p.crouch) o.still += dt * 1.2;
      if (Math.abs(p.x - this.x) < 300) o.close += dt * 1.2;
    }

    // ---------------------------------------------------------------- ИИ
    update(dt) {
      super.update(dt);
      const sc = this.scene, w = sc.world, p = sc.player;
      this.st += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.evadeCd > 0) this.evadeCd -= dt;
      if (this.shotCd > 0) this.shotCd -= dt;
      if (this.rushCd > 0) this.rushCd -= dt;
      for (const m of this.markers) m.life -= dt;
      this.markers = this.markers.filter((m) => m.life > 0);
      const alive = p && !p.down;
      const dx = alive ? p.x - this.x : 0, dist = Math.abs(dx);
      if (this.vulnerable) this._observe(p, dt);
      let walk = 0;

      switch (this.state) {
        case 'dormant': break;

        case 'idle':
          if (alive) this.facing = dx >= 0 ? 1 : -1;
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          this.pause -= dt * (this.phase2 ? TC.SMART.p2.pause : 1);
          if (this._evadeTomato()) break;
          if (this.pause <= 0 && alive) this._decide(dx, dist);
          break;

        case 'approach':
          this.facing = dx >= 0 ? 1 : -1;
          walk = this.facing * (TC.WALK + this.stain * 11) * (1 + TC.SMART.stutter * Math.sin(this.st * 7));          // рваный ритм: то ускоряется, то замедляется — стоять и ждать, пока подойдёт, не выйдет
          if (this._evadeTomato()) break;
          if (dist < 470 || this.st > 2.2) { this.state = 'idle'; this.pause = 0.12; }
          break;

        case 'retreat':
          this.facing = dx >= 0 ? 1 : -1;
          walk = -this.facing * TC.BACK;
          if (this._evadeTomato()) break;
          if (dist > 380 || this.st > 1.3 || this._atEdge(-this.facing)) { this.state = 'idle'; this.pause = 0.22; }
          break;

        case 'evade': {
          // ловкий шаг назад (по ходу полёта помидора): быстро и видно
          this.vx = Ale.approach(this.vx, this.evadeDir * TC.EVADE_SPEED, 6000 * dt);
          this.phase += Math.abs(this.vx) * dt / TC.STRIDE;
          if (this.st >= TC.EVADE_T || this._atEdge(this.evadeDir)) { this.state = 'idle'; this.pause = this.counterUntil > this.scene.time ? 0.06 : 0.22; }
          break;
        }

        case 'rushWind': {
          // предупреждение о броске: поза ярости, значок над головой, звук; стоит на месте и смотрит на героиню (помидор в это время попадёт: она не уворачивается)
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          if (alive) this.facing = dx >= 0 ? 1 : -1;
          if (this.st >= TC.SMART.rushWind) { this.state = 'rush'; this.st = 0; }
          break;
        }

        case 'rush': {
          // бежит на героиню, не уворачиваясь (кроме как попав под помидор: он собьёт); добежала — пощёчина вплотную с короткой подготовкой
          const SM = TC.SMART;
          if (alive) this.facing = dx >= 0 ? 1 : -1;
          walk = this.facing * SM.rushSpeed;
          if (Math.floor(this.t * 14) !== Math.floor((this.t - dt) * 14)) sc.fx.dust(this.x - this.facing * 20, this.y, 1, -this.facing, 0.6);
          if (!alive) { this.state = 'idle'; this.pause = 0.3; }
          else if (dist < SM.rushStop) this._startAttack({ slap: true, windup: SM.rushSlapWind, rush: true });
          else if (this.st >= SM.rushMax || this._atEdge(this.facing)) { this.state = 'idle'; this.pause = 0.35; }
          break;
        }

        case 'windup': {
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          if (alive) this.facing = dx >= 0 ? 1 : -1;
          if (this.st >= this.atk.windup + (this.atk.delay || 0)) this._fire();
          break;
        }

        case 'throw':
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          if (this.atk.slap && this.st >= 0.05 && this.st <= 0.2) this._slapHit(p);
          if (this.st >= TC.THROW_T) this._afterShot();
          break;

        case 'recover':
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          // первая часть отдыха после броска — окно для помидора; во второй она уже приходит в себя и может отскочить (чуть реже)
          if (this.st > this.recoverT * 0.5 && this._evadeTomato(0.75)) break;
          if (this.st >= this.recoverT) { this.state = 'idle'; this.pause = 0.1; }
          break;

        case 'hurt':
          this.vx = Ale.approach(this.vx, 0, 700 * dt);
          if (this.st >= this._hurtT()) { if (this.phase2Pending) this._startBarrage(); else { this.state = 'idle'; this.pause = 0.2; } }
          break;

        case 'barrage': {
          // волна мела: стоит на месте, лицом к героине; выстрелы по расписанию (верхний, нижний, ...)
          const B = TC.BARRAGE;
          this.vx = Ale.approach(this.vx, 0, 1600 * dt);
          if (alive) this.facing = dx >= 0 ? 1 : -1;
          if (this.bshot < B.shots) {
            const fireAt = B.first + this.bshot * B.gap;
            if (this.st >= fireAt) { this._fireChalk(this.bshot % 2 === 0 ? 'chalkHigh' : 'chalkLow'); this.bFireAt = this.st; this.bWind = false; this.bshot++; }
            else if (!this.bWind && this.st >= fireAt - B.windup) { this.bWind = true; Ale.Audio.sfx('teacher_windup'); }
          } else if (this.st >= this.bFireAt + TC.THROW_T + B.after) { this.state = 'recover'; this.st = 0; this.recoverT = B.recover; this.shotCd = 0.9; }
          break;
        }

        case 'stagger':
          this.vx = Ale.approach(this.vx, 0, 900 * dt);
          if (this.st >= TC.STAGGER_T) { this.state = 'idle'; this.pause = 0.2; }
          break;

        case 'surrender':
          this.vx = Ale.approach(this.vx, 0, 900 * dt);
          break;

        case 'flee': {
          const dir = Math.sign(this.fleeTo - this.x) || 1;
          this.facing = dir;
          walk = dir * 430;
          if (Math.abs(this.fleeTo - this.x) < 20) { this.dead = true; if (this.onFled) this.onFled(); }
          if (Math.floor(this.t * 12) !== Math.floor((this.t - dt) * 12)) sc.fx.dust(this.x - dir * 20, this.y, 1, -dir, 0.7);
          break;
        }
      }

      if (walk) {
        this.vx = Ale.approach(this.vx, walk, 2600 * dt);
        this.phase += Math.abs(this.vx) * dt / TC.STRIDE;
      } else if (this.state !== 'flee' && this.state !== 'evade') this.phase = 0;
      if (this.state === 'flee') { this.x += this.vx * dt; return; }   // убегает сквозь границу арены
      // не выходить за арену
      if ((this.x < this.arena.x0 && this.vx < 0) || (this.x > this.arena.x1 && this.vx > 0)) this.vx = 0;
      this.vy = Math.min(this.vy + 2600 * dt, 1200);
      w.move(this, dt);
    }

    _atEdge(dir) { return (dir < 0 && this.x < this.arena.x0 + 40) || (dir > 0 && this.x > this.arena.x1 - 40); }

    // Увидела летящий в неё помидор: если руки свободны — отступает по ходу его полёта, и он падает в пустоту.
    _evadeTomato(k) {
      if (this.evadeCd > 0 || !this.vulnerable) return false;
      const P2 = this.phase2, see = P2 ? TC.EVADE_SEE_P2 : TC.EVADE_SEE;
      for (const e of this.scene.entities) {
        if (e.dead || !(e instanceof Ale.Projectile) || e.team !== 'player' || e.kind !== 'tomato') continue;
        const rel = this.x - e.x;
        if (Math.sign(rel) !== Math.sign(e.vx) || Math.abs(rel) > see || Math.abs(rel) < 100) continue;
        this.evadeCd = P2 ? TC.EVADE_CD_P2 : TC.EVADE_CD;
        // чем чаще в неё целятся, тем лучше она уворачивается (спам помидорами не работает), — но не больше чем на spamBonus × spamMax
        const SM = TC.SMART, bonus = SM.spamBonus * Math.min(SM.spamMax, this.obs.spam) * this._k('rushK');
        if (!Ale.rng.chance(Math.min(0.95, TC.EVADE[this._stage()] * (k || 1) * (P2 ? TC.EVADE_P2_K : 1) + bonus))) return false;
        const dir = Math.sign(e.vx);
        if (this._atEdge(dir)) return false;
        this.evadeDir = dir; this.facing = -dir;
        this.state = 'evade'; this.st = 0; this.queue.length = 0;
        this.counterUntil = Ale.rng.chance(SM.counter[this._stage()] * this._k('rushK')) ? this.scene.time + 1.4 : 0; this.stats.evade++;          // увернулась — с таким-то шансом ответит сразу, если бросать уже можно
        // отскок беззвучный: прежний звук «хлопок / выстрел» владелец велел убрать совсем (02.10.2026); пыль под ногами остаётся
        this.scene.fx.dust(this.x, this.y, 3, -dir, 0.8);
        return true;
      }
      return false;
    }

    // Выбор следующего действия: по расстоянию и по тому, что делает игрок.
    _decide(dx, dist) {
      const R = Ale.rng, s = this._stage(), p = this.scene.player, o = this.obs, SM = TC.SMART;
      const slapP = Math.min(0.95, 0.6 + Math.min(0.28, o.close * 0.06) + s * 0.03);
      if (dist < TC.SLAP_RANGE && R.chance(slapP)) { this.counterUntil = 0; return this._startAttack({ slap: true }); }
      if (dist < SM.retreatAt[s] && !this._atEdge(-Math.sign(dx))) { this.counterUntil = 0; this.state = 'retreat'; this.st = 0; return; }
      // обстрел издалека: бросается на героиню (с предупреждением; помидор в этот миг попадёт, «Туп лапой» в конце броска собьёт)
      // (позади героини должно быть место отступить: прижатую к краю арены бросок не берёт — там и без него хватает давления)
      const room = p ? (dx > 0 ? this.arena.x1 - p.x : p.x - this.arena.x0) : 0;          // место позади героини — со стороны, противоположной училке
      if (this.rushCd <= 0 && dist > 300 && room > SM.rushRoom && (o.far > SM.rushAfter || o.spam > SM.rushSpam) && R.chance(Math.min(0.95, SM.rushP[s] * this._k('rushK')))) return this._startRush();
      if (dist > SM.approachAt[s]) { this.state = 'approach'; this.st = 0; return; }

      // снаряд ещё «перезаряжается»: держит дистанцию, поглядывает на игрока, но не бросает
      if (this.shotCd > 0) {
        if (dist > 540) { this.state = 'approach'; this.st = 0; }
        else if (dist < 380 && !this._atEdge(-Math.sign(dx))) { this.state = 'retreat'; this.st = 0; }
        else this.pause = Math.min(0.3, this.shotCd);
        return;
      }
      const H = 'chalkHigh', L = 'chalkLow', P = 'paper';
      let kind;
      const airborne = p && !p.onGround, ducking = p && p.crouch;
      if (airborne && R.chance(0.7)) kind = P;                                   // прыгает — накрыть место приземления
      else if (ducking && R.chance(0.7)) kind = L;                               // присел — бьёт по ногам
      else if (o.still > 1.6 && R.chance(0.65)) kind = P;                        // стоит на месте — комок точно в неё
      else if (o.air > 2.2 && R.chance(0.55)) kind = H;                          // любит прыгать — мел в голову
      else if (o.duck > 2.2 && R.chance(0.55)) kind = L;                         // любит приседать — мел в ноги
      else kind = [H, L, P, H, L, P][R.int(0, 5)];
      // не повторять подряд одну и ту же высоту мела
      const last = this.lastShots[this.lastShots.length - 1];
      if (kind === last && kind !== P) kind = last === H ? L : H;
      this.queue = [kind];
      const quick = this.counterUntil > this.scene.time; this.counterUntil = 0; if (quick) this.stats.counter++;
      this._nextShot(!quick);                                                           // контрбросок после уклонения: подготовка короче (как у второго снаряда в залпе)
    }

    // Бросок к героиней: поза ярости, значок и звук, затем бег (см. 'rushWind' / 'rush'); пауза до следующего — rushCd
    _startRush() {
      this.state = 'rushWind'; this.st = 0; this.queue.length = 0;
      this.rushCd = this.phase2 ? TC.SMART.rushCdP2 : TC.SMART.rushCd; this.obs.far = 0; this.obs.spam = 0; this.stats.rush++;
      Ale.Audio.sfx('teacher_windup');
      if (this.scene.onTeacherRush) this.scene.onTeacherRush(this);
    }

    _startAttack(a) {
      if (this.scene.onTeacherSlap) this.scene.onTeacherSlap();
      if (a.slap) this.stats.slap++;
      this.atk = Object.assign({ windup: TC.SLAP_WINDUP[this._stage()] }, a);
      this.state = 'windup'; this.st = 0;
      Ale.Audio.sfx('teacher_windup');
    }

    _nextShot(first) {
      const kind = this.queue.shift();
      const s = this._stage(), base = TC.WINDUP[s];
      // с третьей стадии иногда медлит с броском («обманка»): реагировать слишком рано нельзя
      const delay = s >= 2 && first && Ale.rng.chance(0.3) ? Ale.rng.range(0.12, 0.26) : 0;
      this.atk = { kind, windup: first ? base : base * 0.62, delay };
      this.state = 'windup'; this.st = 0;
      Ale.Audio.sfx('teacher_windup');
    }

    _fire() {
      const a = this.atk, sc = this.scene, p = sc.player;
      this.state = 'throw'; this.st = 0; this.slapHit = false;
      if (a.slap) { Ale.Audio.sfx('slap'); return; }
      const s = this._stage();
      // в миг броска смотрит, что героиня делает на самом деле: пригнулась заранее — идёт нижний мел, прыгнула заранее — верхний (кто уворачивается до броска, а не от летящего мела, попадает)
      if (p && !p.down && (a.kind === 'chalkHigh' || a.kind === 'chalkLow') && Ale.rng.chance(Math.min(0.95, TC.SMART.read[s] * this._k('readK')))) {
        if (a.kind === 'chalkHigh' && p.crouch && p.onGround) { a.kind = 'chalkLow'; this.stats.read++; }
        else if (a.kind === 'chalkLow' && !p.onGround) { a.kind = 'chalkHigh'; this.stats.read++; }
      }
      const f = this.facing;
      const ox = this.x + f * 84, oy = this.y - 122;
      Ale.Audio.sfx(a.kind === 'paper' ? 'throw_paper' : 'throw_chalk');
      this.shotCd = Ale.rng.range(TC.SHOT_CD[s][0], TC.SHOT_CD[s][1]);
      this.lastShots.push(a.kind); if (this.lastShots.length > 3) this.lastShots.shift();
      if (sc.onTeacherShot) sc.onTeacherShot(a.kind);
      if (a.kind === 'paper') {
        // навесом: падает туда, где Алеся будет (упреждение по бегу; для прыгающей — в точку приземления)
        const T = 1.1, g = 1000, ty = this.y - 48;
        let tx = p ? p.x : this.x + f * 400;
        if (p && !p.down) {
          const tLand = p.onGround ? 0 : (-p.vy + Math.sqrt(p.vy * p.vy + 2 * 2800 * Math.max(0, this.y - p.y))) / 2800;
          tx = p.x + p.vx * Math.min(T, Math.max(T * 0.7, tLand));
        }
        tx = Ale.clamp(tx, this.arena.x0 + 20, this.arena.x1 - 20);
        const vx = (tx - ox) / T, vy = (ty - oy - 0.5 * g * T * T) / T;
        sc.add(new Ale.Projectile({ x: ox, y: oy, team: 'enemy', kind: 'paper', sprite: 'pr_paper', vx, vy, g, r: 17, spin: 8 * f, life: 2.4, scale: 1.0 }));
        this.markers.push({ x: tx, life: T + 0.05, t0: T });
        // на поздних стадиях комок иногда летит парой: второй ложится дальше по ходу бега героини (оба круга видны сразу, между ними есть просвет)
        if (Ale.rng.chance(TC.DOUBLE_PAPER[s])) {
          let dir = p && !p.down && Math.abs(p.vx) > 40 ? Math.sign(p.vx) : f;
          let tx2 = tx + dir * 230;
          if (tx2 < this.arena.x0 + 20 || tx2 > this.arena.x1 - 20) { dir = -dir; tx2 = tx + dir * 230; }
          tx2 = Ale.clamp(tx2, this.arena.x0 + 20, this.arena.x1 - 20);
          const T2 = 1.35, vx2 = (tx2 - ox) / T2, vy2 = (ty - oy - 0.5 * g * T2 * T2) / T2;
          sc.add(new Ale.Projectile({ x: ox, y: oy, team: 'enemy', kind: 'paper', sprite: 'pr_paper', vx: vx2, vy: vy2, g, r: 17, spin: -8 * f, life: 2.8, scale: 1.0 }));
          this.markers.push({ x: tx2, life: T2 + 0.05, t0: T2 });
        }
      } else this._chalk(a.kind === 'chalkHigh', s);
    }

    // Мел: верхний летит на уровне головы (присесть), нижний — по ногам (прыгнуть или разбить «Туп лапой»)
    _chalk(high, s, k) {
      const sc = this.scene, f = this.facing, ox = this.x + f * 84, oy = this.y - 122, y = this.y - (high ? 112 : 24);
      sc.add(new Ale.Projectile({ x: ox, y: high ? oy : this.y - 46, team: 'enemy', kind: 'chalk', sprite: 'pr_chalk', vx: f * TC.CHALK_SPEED[s] * (k || 1), vy: 0, g: 0, r: 13, aim: true, aimOffset: TC.CHALK_AIM, life: 2.6, ty: y, tyRate: 420, scale: 1.05 }));
    }

    // Выстрел волны мела (бросок без обычной паузы между снарядами)
    _fireChalk(kind) {
      const sc = this.scene, s = this._stage();
      Ale.Audio.sfx('throw_chalk');
      this.shotCd = 1.0;
      this.lastShots.push(kind); if (this.lastShots.length > 3) this.lastShots.shift();
      if (sc.onTeacherShot) sc.onTeacherShot(kind);
      this._chalk(kind === 'chalkHigh', s, TC.BARRAGE.speed);           // в волне мел чуть медленнее обычного: успеть отреагировать на каждый
    }

    _startBarrage() {
      this.phase2 = true; this.phase2Pending = false;
      this.state = 'barrage'; this.st = 0; this.bshot = 0; this.bFireAt = -9; this.bWind = false;
      this.queue.length = 0; this.evadeCd = 0;
      Ale.Audio.sfx('teacher_windup');
      if (this.scene.onTeacherPhase2) this.scene.onTeacherPhase2(this);
    }

    // Поза в волне мела: вспышка ярости (реплика), замах перед выстрелом, бросок сразу после, между ними — злая стойка
    _barragePose() {
      const B = TC.BARRAGE;
      if (this.st - this.bFireAt < TC.THROW_T) return 'throw';
      if (this.bshot < B.shots && this.st >= B.first + this.bshot * B.gap - B.windup) return 'windup';
      if (this.bshot === 0) return 'rage';          // реплика второй фазы и первые полсекунды: вспышка ярости
      return 'idle';
    }

    _afterShot() {
      if (this.queue.length) return this._nextShot(false);
      // вторая пощёчина: героиня осталась рядом (не отошла, не прыгнула назад) — она бьёт ещё раз, без паузы
      const a = this.atk, p = this.scene.player, SM = TC.SMART;
      if (a && a.slap && (a.n || 1) < SM.comboMax && p && !p.down && Math.abs(p.x - this.x) < SM.comboRange && Ale.rng.chance(Math.min(0.9, SM.comboSlap[this._stage()] * this._k('comboK')))) {
        this.atk = { slap: true, windup: SM.comboWind, n: (a.n || 1) + 1 }; this.stats.combo++;
        this.state = 'windup'; this.st = 0; this.facing = p.x >= this.x ? 1 : -1;
        Ale.Audio.sfx('teacher_windup');
        return;
      }
      this.state = 'recover'; this.st = 0;
      this.recoverT = TC.RECOVER[this._stage()] * (this.atk && this.atk.slap ? 0.8 : 1);
    }

    _slapHit(p) {
      if (this.slapHit || !p || p.down) return;
      const r = { x: this.facing > 0 ? this.x + 10 : this.x - 10 - 130, y: this.y - 150, w: 130, h: 120 };
      this.slapRect = r;
      if (Ale.overlap(r, p.hurtbox())) {
        if (p.takeHit({ kind: 'slap', dir: this.facing, dmg: 1, x: this.x, y: this.y - 80, src: this })) this.slapHit = true;
      }
    }

    // ---------------------------------------------------------------- урон
    takeHit(info) {
      if (!this.vulnerable) return false;
      const sc = this.scene;
      if (info.kind === 'tomato') {
        if (this.state === 'hurt' || this.state === 'surrender' || this.state === 'flee') { sc.fx.splat(info.x, info.y, 5, info.dir); return true; }
        this.stain++;
        this.flash = 0.22;
        if (this.stain === TC.PHASE2_AT && !this.phase2) this.phase2Pending = true;      // половина здоровья: после паузы «реакции» — реплика и волна мела
        const armored = this.state === 'barrage' || ((this.state === 'rush' || this.state === 'rushWind') && !this.phase2Pending);     // в волне мела и в броске к героине попадание считается, но стойку не сбивает (кроме того, что открывает вторую фазу)
        if (!armored) { this.state = 'hurt'; this.st = 0; this.queue.length = 0; this.vx = (info.dir || 1) * 190; }
        Ale.Game.hitstop(armored ? 6 : 9);
        sc.camera.shake(armored ? 8 : 11, armored ? 0.25 : 0.35);
        sc.fx.ring(this.x, this.y - 100, 90, 'rgba(255,255,255,');
        Ale.Audio.sfx('teacher_hit');
        if (this.stain >= TC.HP) { this.state = 'surrender'; this.st = 0; this.vulnerable = false; this.vx = 0; Ale.Game.slow(0.3, 0.9); sc.fx.confetti(this.x, this.y - 120, 24); }
        if (sc.onTeacherHit) sc.onTeacherHit(this);
        return true;
      }
      if (info.kind === 'stomp') {
        if (this.state === 'hurt' || this.state === 'surrender' || this.state === 'flee' || this.state === 'barrage') return false;
        this.state = 'stagger'; this.st = 0; this.queue.length = 0;
        this.vx = (info.dir || 1) * 300; this.flash = 0.12;
        sc.fx.sparks(this.x - info.dir * 20, this.y - 40, 8);
        Ale.Audio.sfx('stomp_hit');
        return true;
      }
      return false;
    }

    surrenderNow() { this.state = 'surrender'; this.st = 0; this.vulnerable = false; this.vx = 0; }
    flee(toX, cb) { this.state = 'flee'; this.st = 0; this.fleeTo = toX; this.onFled = cb; this.vulnerable = false; }

    // ---------------------------------------------------------------- вид
    idlePose() { return this.stain === 0 ? 'tch_idle' : 'tch_hit' + Math.min(this.stain, 7); }

    // Новые чистые позы (лист teacher_extra_sheet.png) получают пятна нужной стадии кодом (Ale.Stain.frame); ходьба и «попадание» — со своими пятнами
    frame() {
      const s = Math.min(this.stain, 7), St = Ale.Stain, a = this.atk;
      switch (this.state) {
        case 'windup': return St.frame(a && a.kind && a.kind !== 'paper' ? 'tch_chalk0' : 'tch_slap0', s);            // мел — палочка в поднятой руке; пощёчина и комок — рука отведена назад
        case 'throw': return St.frame(a.slap ? (this.st < 0.12 ? 'tch_slap1' : 'tch_slap2') : a.kind === 'paper' ? 'tch_paper' : 'tch_chalk1', s);
        case 'barrage': { const bp = this._barragePose(); return bp === 'windup' ? St.frame('tch_chalk0', s) : bp === 'throw' ? St.frame('tch_chalk1', s) : bp === 'rage' ? St.frame('tch_rage', s) : this.idlePose(); }
        case 'hurt': return 'tch_hit' + Math.max(1, s);
        case 'stagger': return St.frame(this.st < 0.22 ? 'tch_stag1' : 'tch_stag2', s);
        case 'evade': return St.frame(this.st < TC.EVADE_T - 0.1 ? 'tch_hop' : 'tch_hopland', s);                     // прыжок назад, в конце — приземление
        case 'rushWind': return St.frame('tch_rage', s);                                                                   // бросок: перед бегом — вспышка ярости (кадр второй фазы)
        case 'surrender': return 'tch_surrender';
        case 'flee': return 'tch_flee';
        case 'approach': case 'retreat': case 'rush': {
          const i = (Math.floor(this.phase) % 6) + 1;
          return this.stain > 0 ? 'tch_walk' + i + '_s' + Math.min(this.stain, 7) : 'tch_walk' + i;
        }
        default: return this.idlePose();
      }
    }

    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      this.drawShadow(ctx, x, y, 44, 0.36);
      // тень падения бумажных комков
      for (const m of this.markers) {
        const k = 1 - Ale.clamp(m.life / m.t0, 0, 1);
        const sy = this.scene.world.supportY(m.x, this.y - 30, 0, 40) || this.y;
        ctx.save(); ctx.translate(m.x, sy); ctx.scale(1, 0.28);
        ctx.strokeStyle = 'rgba(214,52,33,' + (0.35 + 0.4 * k).toFixed(2) + ')'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(0, 0, 54 - 14 * k, 0, 6.283); ctx.stroke();          // в момент падения круг = настоящая зона попадания (комок 17 + ширина героини 23)
        ctx.fillStyle = 'rgba(214,52,33,' + (0.12 + 0.25 * k).toFixed(2) + ')'; ctx.fill();
        ctx.restore();
      }
      let ox = 0, sy = 1, sx = 1;
      if (this.state === 'hurt') ox = Math.sin(this.st * 90) * 4 * (1 - this.st / this._hurtT());
      if (this.state === 'stagger') ox = Math.sin(this.st * 80) * 3 * (1 - this.st / TC.STAGGER_T);
      if (this.state === 'windup') { const f = Ale.clamp(this.st / this.atk.windup, 0, 1); sy = 1 - 0.015 * f; ox = -this.facing * 5 * f; }
      if (this.state === 'barrage' || this.state === 'rushWind') { ox = Math.sin(this.st * 55) * 1.6; sy = 1 + Math.sin(this.st * 9) * 0.01; }         // трясётся от злости
      if (this.state === 'idle' || this.state === 'dormant') { const b = Math.sin(this.t * 2.1); sy = 1 + b * 0.008; }
      if (this.state === 'surrender') { sy = 1 + Math.sin(this.t * 14) * 0.012; ox = Math.sin(this.t * 20) * 1.5; }
      let rot = 0, oy = 0;
      if (this.state === 'approach' || this.state === 'retreat' || this.state === 'flee' || this.state === 'rush') {
        const b = Math.abs(Math.sin(this.phase * Math.PI));
        oy = -b * (this.state === 'flee' || this.state === 'rush' ? 6 : 2.2);
        if (this.state === 'flee') rot = this.facing * 0.06;
      }
      if (this.state === 'evade') {                       // в кадре прыжка ноги оторваны от земли на el юнитов (берётся из манифеста); приземление — на землю
        const f = this.frame(), sp = Ale.Assets.sprites[f];
        oy = this.st < TC.EVADE_T - 0.1 && sp ? -sp.el * Ale.clamp(this.st / 0.06, 0, 1) : 0;
      }
      // при быстром шаге назад — бледный след
      if (this.state === 'evade') for (let i = 1; i <= 2; i++) Ale.drawSprite(ctx, this.frame(), x - this.evadeDir * i * 16, y, { flip: this.facing < 0, ox, oy, alpha: 0.14 / i });
      Ale.drawSprite(ctx, this.frame(), x, y, { flip: this.facing < 0, ox, oy, sx, sy, rot, flash: this.flash > 0 ? Math.min(1, this.flash / 0.15) * 0.6 : 0 });
      if (this.state === 'windup' || this.state === 'rushWind' || (this.state === 'barrage' && this._barragePose() === 'windup')) {
        const s = 0.75 + 0.25 * Math.sin(this.st * 26);
        Ale.drawSprite(ctx, 'fx_warn', x, y - 208 - 4 * Math.sin(this.st * 18), { sx: s, sy: s });
      }
    }

    debugDraw(ctx) {
      super.debugDraw(ctx);
      if (this.state === 'throw' && this.atk && this.atk.slap && this.slapRect) { const r = this.slapRect; ctx.strokeStyle = 'rgba(255,200,0,0.95)'; ctx.strokeRect(r.x, r.y, r.w, r.h); }
    }
  }

  Ale.Teacher = Teacher;
})();
