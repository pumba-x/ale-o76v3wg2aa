// Люди сюжета: Илюшкинс, Антін (дальше — семья и воришка). Стоят и дышат, говорят по нажатию E, ходят по сценарию (autoWalk),
// идут рядом с героиней (mode 'follow'). Кадры — нарисованные позы и шесть кадров ходьбы (один цикл на два шага).
// Жесты: сценарий ставит позу (`person.pose = 'ily_stop'`), а у тех, кто в таблице gestures (Антін), кадр сам выбирается по настроению реплики, пока он говорит.
// Поцелуй героини и Илюшкинса — отдельная сущность Ale.CoupleKiss: один рисунок на двоих (набор couple), см. её описание ниже.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const walk = (p) => [1, 2, 3, 4, 5, 6].map((i) => p + '_walk' + i);
  // headH — высота над землёй, откуда тянется облачко реплики; stride — путь в юнитах на один кадр ходьбы (шаг ≈ 84 юн.: два шага на шесть кадров); speed — шаг по сценарию;
  // gestures — жесты говорящего по настроению реплики (mood в T.*: ['antin', 'текст', { mood: 'gusto' }]), hintGesture — жест, пока над ним висит облачко UI.hint (бормотание вслед,
  // приветствие); кадров в сборке нет или настроение не в таблице — обычная стойка
  const PEOPLE = (Ale.PEOPLE = {
    ilyushkins: { idle: 'ily_idle', walk: walk('ily'), stride: 28, speed: 150, headH: 192 },
    antin: {
      idle: 'ant_idle', walk: walk('ant'), stride: 27, speed: 140, headH: 188,
      gestures: { gusto: 'ant_wide', sly: 'ant_lean', deadpan: 'ant_shrug', astonished: 'ant_finger', affronted: 'ant_point', sheepish: 'ant_wave', smug: 'ant_point' },
      hintGesture: 'ant_wave',
    },
    // семья и воришка (Монако): те же шесть кадров ходьбы и поза стоя, масштаб — по росту каждого (tools/sprites.json: mother … thief)
    mother: { idle: 'mom_idle', walk: walk('mom'), stride: 25, speed: 130, headH: 172 },
    father: { idle: 'dad_idle', walk: walk('dad'), stride: 28, speed: 140, headH: 192 },
    grandfather: { idle: 'gra_idle', walk: walk('gra'), stride: 24, speed: 100, headH: 180 },
    marina: { idle: 'mar_idle', walk: walk('mar'), stride: 26, speed: 140, headH: 180 },
    // idle — thf_walk5 (фаза «проходит мимо», ноги вместе): у thf_idle рваный контур прежнего поколения, и при первом шаге вора стиль кадра менялся (11.10.2026). carryAt — где у кадра кулак с пачкой
    // (юниты от опоры: x вперёд, y вверх): раньше пачка висела на одном месте (26, 82) и на трёх кадрах ходьбы мимо кулака на 16…28 юн.
    thief: { idle: 'thf_walk5', walk: walk('thf'), stride: 30, speed: 420, headH: 190,
      carryAt: { thf_walk5: [23.8, 71.5], thf_idle: [25, 72], thf_walk1: [27.5, 72], thf_walk2: [21.8, 70], thf_walk3: [-2, 70], thf_walk4: [9.7, 73], thf_walk6: [5.2, 73] } },
  });

  const KISS_POSE = /_kiss\d*$/;       // запасные кадры поцелуя по одному (ily_kiss1, ily_kiss2), когда рисунка пары нет

  class Person extends Ale.Entity {
    // o.kind — ключ PEOPLE; o.id — id сущности (по умолчанию тот же ключ); o.onTalk — разговор по E (без него предмет не интерактивен)
    constructor(o) {
      const K = PEOPLE[o.kind];
      super(Object.assign({ w: 44, h: 150, z: 54, id: o.kind }, o));
      this.K = K; this.kind = o.kind;
      this.headH = K.headH; this.promptY = K.headH + 6;
      this.mode = 'stay';            // stay | follow
      this.followDx = 118;
      this.auto = null;
      this.pose = null;              // имя кадра поверх всего (жест из сценария: 'ily_stop', 'mom_open'…; старые кадры поцелуя ily_kiss1/2 — запасные, без тени)
      this.phase = 0;
      this.onTalk = o.onTalk || null;
      this.interactRange = o.range || 120;
      this.hidden = false;
      this.alpha = 1;                // прозрачность (уходит за угол, растворяется)
      this.carry = null;             // предмет в руке (воришка с пачкой): имя спрайта
      this.sq = { x: 1, y: 1 };
      this.bump = 0;                 // короткий «подался вперёд» (передача предмета)
    }

    get interactable() { return !!this.onTalk && !this.noTalk; }
    set interactable(v) { /* зависит от onTalk */ }

    canInteract() { return !!this.onTalk && !this.noTalk && !this.hidden; }
    interact(p) { if (this.onTalk) this.onTalk(p); }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}

    autoWalk(x, opts) { this.auto = { x, speed: (opts && opts.speed) || this.K.speed, arrive: (opts && opts.arrive) || 8 }; }
    face(dir) { this.facing = dir >= 0 ? 1 : -1; }

    update(dt) {
      super.update(dt);
      if (this.bump > 0) this.bump -= dt;
      const sc = this.scene, w = sc.world, p = sc.player;
      let target = null, maxSp = this.K.speed, arrive = 8;
      if (this.auto) { target = this.auto.x; maxSp = this.auto.speed; arrive = this.auto.arrive; }
      else if (this.mode === 'follow' && p) {
        // Идёт рядом, а не «по следу»: пока героиня в пределах followDx + 70, он стоит на своём месте (подошла — он не отступает), отстал — догоняет с той же стороны
        // (издалека — сзади по ходу героини), прижался вплотную — отходит на followDx. Так до него всегда можно дойти и нажать E.
        const dx = this.x - p.x, side = dx >= 0 ? 1 : -1, dist = Math.abs(dx);
        maxSp = 330;
        if (dist > this.followDx + 70) { target = p.x + (dist > 420 ? -p.facing : side) * this.followDx; arrive = 26; }
        else if (dist < 36) { target = p.x + side * this.followDx; arrive = 20; }
      }
      let move = 0;
      if (target !== null) {
        const dx = target - this.x;
        if (Math.abs(dx) > arrive) { move = Math.sign(dx); const sp = Ale.clamp(Math.abs(dx) * 3.2, 60, maxSp); this.vx = Ale.approach(this.vx, move * sp, 2400 * dt); this.facing = move; }
        else { this.vx = Ale.approach(this.vx, 0, 2600 * dt); if (this.auto) this.auto = null; }
      } else this.vx = Ale.approach(this.vx, 0, 2600 * dt);
      if (!move && Math.abs(this.vx) < 15 && p && !this.keepFacing && !this.pose) this.facing = p.x >= this.x ? 1 : -1;      // стоит и смотрит на героиню
      this.vy = Math.min(this.vy + 2400 * dt, 1100);
      w.move(this, dt);
      if (this.onGround && Math.abs(this.vx) > 20) this.phase += Math.abs(this.vx) * dt / this.K.stride;
      else if (Math.abs(this.vx) < 20) this.phase = 0;
    }

    // Жест говорящего. Пока реплика этого человека в окне диалога (печатается или ждёт нажатия) — кадр из таблицы K.gestures по настроению реплики (mood);
    // пока над ним облачко без диалога (UI.hint: бормотание вслед, приветствие) — K.hintGesture. Нет таблицы, настроения или кадра в сборке — null (обычная стойка).
    speakFrame() {
      const K = this.K, UI = Ale.UI;
      if (!UI || (!K.gestures && !K.hintGesture)) return null;
      const S = Ale.Assets.sprites, mine = (who) => who === this.kind || who === this.id;
      const d = UI.dlg;
      if (d) {
        const l = d.lines[d.i], f = l && mine(l.who) && l.mood && K.gestures ? K.gestures[l.mood] : null;
        return f && S[f] ? f : null;
      }
      return K.hintGesture && S[K.hintGesture] && UI.hints.some((h) => mine(h.who)) ? K.hintGesture : null;
    }

    frame() {
      if (this.pose) return this.pose;
      if (this.onGround && Math.abs(this.vx) > 20) return this.K.walk[Math.floor(this.phase) % this.K.walk.length];
      return this.speakFrame() || this.K.idle;
    }

    draw(ctx, alpha) {
      if (this.hidden) return;
      const x = this.rx(alpha), y = this.ry(alpha), f = this.frame();
      if (!(this.pose && KISS_POSE.test(this.pose))) this.drawShadow(ctx, x, y, 30, 0.32);       // тень у любой позы на земле; нет её только у запасных кадров поцелуя (ily_kiss1/2)
      let sy = 1, sx = 1;
      if (f === this.K.idle) { const b = Math.sin(this.t * 2.3 + this.x * 0.01); sy = 1 + b * 0.008; sx = 1 - b * 0.004; }
      const talk = Ale.isSpeaking(this.kind) || Ale.isSpeaking(this.id);
      const lean = this.bump > 0 ? Math.sin(Ale.clamp(this.bump / 0.45, 0, 1) * Math.PI) : 0;
      Ale.drawSprite(ctx, f, x + lean * 9 * this.facing, y + (talk ? -Math.abs(Math.sin(this.t * 11)) * 1.6 : 0), { flip: this.facing < 0, sx, sy, rot: lean * 0.05 * this.facing, alpha: this.alpha });
      if (this.carry) {
        const at = this.K.carryAt && this.K.carryAt[f];                                   // кулак кадра (есть таблица) или прежняя точка с лёгким покачиванием
        Ale.drawSprite(ctx, this.carry, x + this.facing * (at ? at[0] : 26), y - (at ? at[1] : 82 - Math.sin(this.phase * 1.05) * 3), { sx: 0.5, sy: 0.5, rot: -0.2 * this.facing, alpha: this.alpha });
      }
    }
  }

  // Пара в поцелуе. Один рисунок на двоих (набор couple): слева Алеся лицом вправо, справа Илюшкинс лицом влево; кадры cpl_lean (сближение) → cpl_kiss (поцелуй) → cpl_after (лоб ко лбу).
  // На время поцелуя сценарий (Ale.StoryKit.kiss) прячет героиню и Илюшкинса (hidden: их положения не меняются и после поцелуя они стоят там же), ставит эту сущность в сцену (sc.couple)
  // и в конце убирает. У каждого кадра в манифесте есть точки стоп (юниты от якоря, как остальные pts): footA — опорная стопа Алеси, footI — середина стоп Илюшкинса; якорь кадра — середина
  // между ними. Пара рисуется так, чтобы середина стоп пришлась на середину между героями: расстояния между стопами на кадрах 34–36 юн., а KISS.dx = 35 (среднее), поэтому каждый стоит на месте
  // с точностью до юнита, скачка при смене кадров нет. side = 1 — Илюшкинс справа от героини (рисунок как есть), −1 — слева (зеркально).
  class CoupleKiss extends Ale.Entity {
    // o.a — героиня, o.b — Илюшкинс (их x и y — опора), o.side — с какой стороны от неё он стоит, o.frame — начальный кадр
    constructor(o) {
      super(Object.assign({ w: 10, h: 10, z: 55, id: 'couple' }, o));
      this.a = o.a; this.b = o.b;
      this.side = o.side < 0 ? -1 : 1;
      this.frameName = o.frame || CoupleKiss.FRAMES[0];
    }
    // Есть ли в сборке рисунок пары (все три кадра с точками стоп); иначе поцелуй идёт прежними кадрами по одному
    static available() {
      const S = Ale.Assets && Ale.Assets.sprites;
      return !!S && CoupleKiss.FRAMES.every((n) => S[n] && S[n].pts && S[n].pts.footA && S[n].pts.footI);
    }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    // Где рисовать кадр: якорь (x, y), зеркало и мировые x стоп так, как они выйдут на экране (alpha — доля шага, как у остальных сущностей)
    place(alpha) {
      const s = Ale.Assets.sprites[this.frameName], P = s && s.pts;
      const xa = this.a.rx(alpha), xi = this.b.rx(alpha), y = this.a.ry(alpha);
      const off = P ? (P.footA[0] + P.footI[0]) / 2 : 0;
      const x = (xa + xi) / 2 - this.side * off;
      return { x, y, flip: this.side < 0, xa, xi, footA: P ? x + this.side * P.footA[0] : xa, footI: P ? x + this.side * P.footI[0] : xi };
    }
    draw(ctx, alpha) {
      const q = this.place(alpha);
      this.drawShadow(ctx, q.xa, q.y, 30, 0.32); this.drawShadow(ctx, q.xi, this.b.ry(alpha), 30, 0.32);
      Ale.drawSprite(ctx, this.frameName, q.x, q.y, { flip: q.flip });
    }
  }
  CoupleKiss.FRAMES = ['cpl_lean', 'cpl_kiss', 'cpl_after'];

  Ale.Person = Person;
  Ale.CoupleKiss = CoupleKiss;
})();
