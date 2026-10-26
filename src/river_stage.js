// Берег отплытия (подводка к заплыву через Днепр; владелец 09.10.2026, переделана вечером того же дня): после открытки герои идут слева направо по длинному пляжу, камера — за ними,
// и фоново говорят о перекрытых мостах; у воды Бубел говорит «есть идея», берёт в зубы весло, которое там просто валялось, и приносит; Алеся берёт его и встаёт на бревно; Бубел не боится
// и прыгает следом — только потом вступает музыка и начинается заплыв. Бревна и весла на экране в начале нет: они лежат дальше по берегу и показываются, когда камера до них доходит
// (владелец: «сейчас на экране только два предмета, поэтому очевидно, что мы будем плыть на коряге»).
// Всё это — «сцена» под обычными репликами сценария (src/story/kyiv_story.js): сценарий ведёт диалоги и фоновые облачка (UI.hint), а когда нужно, запускает действие
//   yield run.act('enter')       — оба идут слева направо по пляжу до воды (камера держит Алесю на 30% ширины вида)
//   yield run.act('fetch')       — Бубел бежит к веслу, берёт его в зубы и приносит; роняет у ног Алеси
//   yield run.act('pick')        — Алеся присела, подняла весло и встала с ним, как с посохом
//   yield run.act('board')       — она идёт к кромке воды и прыгает на бревно (бревно проседает и качается), Бубел идёт следом
//   run.act('ready')             — сразу конечное состояние (ссылка быстрого старта прямо в заплыв)
// Внутри каждое действие — маленький генератор (как сценарии сцен: yield число = подождать, функция = ждать, пока вернёт true). Положения — экранные px при масштабе 1:
// по x от центра бревна (вправо — к воде; пляж тянется влево на ≈ 2000 px), по y от линии воды у бревна (вниз — к зрителю). Время — только по dt (Session.update), случайности нет совсем.
// Рисует Ale.RiverArt.layout (читает pose() отсюда), весло рисует он же (RiverArt.drawOarLine).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const G = {
    walkFrom: -1900,                         // откуда Алеся идёт по пляжу (от центра бревна, влево)
    aleRest: -420, bubRest: -320, bubNear: -266,        // где остановятся: Алеся у берега, Бубел впереди неё; после доставки весла Бубел стоит у Алеси, у посадки — чуть позади неё
    aleY: 46, bubY: 66,                      // ряд песка: стоят на 46 и 66 px ниже линии воды у бревна
    // весло лежит у кромки воды на песке (середина на высоте h = 5 px над ним, лопасть уже в воде). Бубел подходит так, что его пасть, когда он наклонился к земле (кадр прыжка, повёрнутый носом вниз
    // на dip радиан), оказывается точно над серединой весла; взяв его, он поднимает голову, и весло поднимается вместе с носом — никакого «телепорта» (владелец 09.10.2026). Длина весла — одна
    // на все положения (на песке, в зубах, посохом, в гребке)
    oar: { x: -110, y: 92, h: 5, ang: 0.03 }, oarLen: 207, dip: 0.64,
    shore: -146,                             // с этого места Алеся прыгает на бревно
    walkA: 124, fetchB: 205, carryB: 150, walkShore: 120,        // скорости (px/с): Алеся идёт по пляжу, Бубел бежит за веслом, несёт его, Алеся идёт к воде
    mouthDx: 50,                             // на сколько px впереди опоры у Бубела пасть, когда он наклонился к земле (нос кадра (25; 23) юн., масштаб 1,485, поворот на dip: ≈ (50; 5) px)
    lock: 0.30,                              // доля ширины вида, на которой камера держит Алесю
    hop: 0.75, crouch: 0.55,                 // прыжок на бревно (с); приседание за веслом
  };
  const SEAT_X = -58;                        // где она стоит на бревне (Ale.RiverArt.SEAT.x)
  // Где стоит центр бревна на экране: камера держит Алесю на lock·W, поэтому бревно показывается справа, когда она к нему подходит
  const lxSwim = (W) => Math.round(W * 0.28);

  class Stage {
    constructor(S) {
      this.S = S;
      this.cam = G.walkFrom; this.camStart = G.walkFrom; this.hold = false;
      this.ale = { mode: 'off', x: G.walkFrom, y: G.aleY, dist: 0, t: 0, goal: 0, speed: 0, face: 1 };
      this.bub = { mode: 'off', x: G.walkFrom + 200, y: G.bubY, dist: 0, t: 0, goal: 0, goalY: null, speed: 0, face: 1, carry: false, cadence: 11 };
      this.oar = { at: 'sand', x: G.oar.x, y: G.oar.y, h: G.oar.h, ang: G.oar.ang, t: 0 };        // at: sand (лежит) | pickup (его берут) | mouth (в зубах у Бубела) | drop (падает) | lift (поднимается) | staff (у Алеси в руке)
      this.dip = { t: 99, a: 0 };               // осадка бревна при прыжке: затухающее покачивание
      this.runs = []; this.done = {};
    }

    // ------------------------------------------------------------ камера
    // Экранная точка бревна по горизонтали: камера держит Алесю (пока она идёт, стоит или садится на бревно) на lock · ширины вида
    camLx(W) { return Math.round((W || this.S.vw) * G.lock - this.cam); }
    camTarget() { const m = this.ale.mode; return m === 'hop' || m === 'log' ? SEAT_X : this.ale.x; }
    // Сколько проехала камера (для медленного сдвига неба и дальнего берега: параллакс)
    get travel() { return this.cam - this.camStart; }

    // ------------------------------------------------------------ действия
    act(name) {
      if (name === 'ready') { this.ready(); return { update: () => true }; }
      const gen = this['_' + name];
      if (!gen) return { update: () => true };
      this.done[name] = false;
      this.runs.push({ name, g: gen.call(this), wait: null });
      return { update: () => !!this.done[name] };
    }
    busy() { return this.runs.length > 0; }

    // оба идут слева направо по пляжу и останавливаются у воды; Бубел идёт впереди Алеси (облачко над его головой не должно закрывать её), к концу чуть отстаёт и приходит одновременно с ней
    *_enter() {
      const A = this.ale, B = this.bub, dur = (G.aleRest - G.walkFrom) / G.walkA;
      A.x = G.walkFrom; A.mode = 'walk'; A.goal = G.aleRest; A.speed = G.walkA; A.face = 1; A.dist = 0; A.stepIdx = 0; A.t = 0;
      B.x = G.walkFrom + 200; B.y = G.bubY; B.goalY = null; B.mode = 'trot'; B.goal = G.bubRest; B.speed = (G.bubRest - B.x) / dur; B.face = 1; B.dist = 0; B.cadence = 11; B.carry = false;
      this.cam = A.x; this.camStart = A.x;
      yield () => A.mode === 'idle' && B.mode === 'idle';
    }
    // Бубел бежит к веслу, обнюхивает его, берёт в зубы за середину и приносит; роняет перед Алесей
    *_fetch() {
      const B = this.bub, A = this.ale, O = this.oar;
      B.mode = 'trot'; B.goal = O.x - G.mouthDx; B.goalY = O.y; B.speed = G.fetchB; B.face = 1; B.cadence = 16; yield () => B.mode === 'idle' && B.goalY === null;       // встала так, что пасть над серединой весла
      B.mode = 'sniff'; B.t = 0; yield 0.85;
      B.mode = 'grab'; B.t = 0; yield 0.22; O.at = 'mouth'; B.carry = true; yield 0.5;       // наклонилась (нос вниз за 0,22 с), взяла за середину и подняла голову: весло поднимается вместе с носом
      B.mode = 'trot'; B.goal = A.x + 118; B.goalY = G.bubY; B.speed = G.carryB; B.face = -1; B.cadence = 14; yield () => B.mode === 'idle';
      B.face = -1; B.mode = 'present'; B.t = 0; yield 0.55;
      O.at = 'drop'; O.t = 0; O.x = B.x - G.mouthDx; O.y = B.y + 4; O.h = 0; O.ang = Math.PI + 0.05; B.carry = false; B.mode = 'idle'; B.t = 0; yield 0.5; O.at = 'sand';      // роняет перед Алесей
    }
    // Алеся присела, подняла весло и встала с ним
    *_pick() {
      const A = this.ale, O = this.oar;
      A.mode = 'crouch'; A.t = 0; yield 0.22; O.at = 'lift'; O.t = 0; yield 0.4; O.at = 'staff'; yield 0.15; A.mode = 'idle'; A.t = 0;
    }
    // идёт к кромке воды и прыгает на бревно; Бубел идёт следом и остаётся на берегу, у посадки
    *_board() {
      const A = this.ale, B = this.bub;
      A.mode = 'walk'; A.goal = G.shore; A.speed = G.walkShore; A.face = 1; A.dist = 0; A.stepIdx = 0;
      B.face = 1; B.mode = 'trot'; B.goal = G.bubNear; B.speed = G.walkShore; B.cadence = 11;
      yield () => A.mode === 'idle';
      yield 0.25;
      A.mode = 'hop'; A.t = 0; yield () => A.mode === 'log'; yield 0.35;
    }
    // конечное состояние сразу (быстрый старт, сбой подводки): Алеся на бревне с веслом, Бубел у воды
    ready() {
      const A = this.ale, B = this.bub, O = this.oar;
      this.runs.length = 0;
      A.mode = 'log'; A.x = G.shore; A.t = 99; B.mode = 'idle'; B.x = G.bubNear; B.y = G.bubY; B.goalY = null; B.face = 1; B.carry = false; O.at = 'staff'; this.dip.t = 99;
      this.cam = SEAT_X; this.camStart = this.cam;
      this.done.enter = this.done.fetch = this.done.pick = this.done.board = this.done.ready = true;
    }

    // ------------------------------------------------------------ шаг
    update(dt) {
      for (const r of this.runs.slice()) {
        let guard = 0, left = dt;          // своя копия шага на каждое действие: раньше «dt = 0» при завершении ожидания обнуляло шаг и для героев, и для остальных действий — кадр рывком стоял на каждой границе (18.10.2026)
        while (guard++ < 32) {
          if (r.wait !== null) {
            if (typeof r.wait === 'number') { r.wait -= left; if (r.wait > 0) break; r.wait = null; left = 0; }
            else { if (!r.wait()) break; r.wait = null; left = 0; }
          }
          const n = r.g.next();
          if (n.done) { this.done[r.name] = true; this.runs.splice(this.runs.indexOf(r), 1); break; }
          r.wait = n.value === undefined ? 0 : n.value;
        }
      }
      const A = this.ale, B = this.bub, O = this.oar, mv = this.hold ? 0 : dt;           // пока открыто сообщение на телефоне, они стоят
      A.t += dt; B.t += dt; O.t += dt; this.dip.t += dt;
      B.fl = (B.fl === undefined ? B.face : B.fl) + clamp(B.face - (B.fl === undefined ? B.face : B.fl), -dt * 10, dt * 10);          // разворот (растяжка кадра по горизонтали от +1 до −1) занимает 0,2 с; весло в зубах поворачивается той же растяжкой (river_art.js, mouthEnds)
      // ходьба и рысь: к цели с постоянной скоростью; Бубел заодно подходит к своему ряду песка (goalY)
      for (const X of [A, B]) {
        if (X.mode !== 'walk' && X.mode !== 'trot') continue;
        const d = X.goal - X.x, st = Math.min(Math.abs(d), X.speed * mv);
        X.x += Math.sign(d) * st; X.dist += st;
        if (X === A) {                                   // шаги Алеси по песку: на каждые 12 кадров ходьбы (пол-цикла: 12 × shoreStride юн. × масштаб 1,22 = 79 px при shoreStride 5,4: кадры `ale_walk` в подводке идут своим шагом, не шагом трусцы), тихо, как в игре
          const si = Math.floor(A.dist / (12 * Ale.PLAYER.WALK.shoreStride * 1.22));
          if (si > (A.stepIdx || 0)) { A.stepIdx = si; if (Ale.Audio && Ale.PLAYER) Ale.Audio.sfx('step', { vol: Ale.PLAYER.WALK.stepVol }); }
        }
        if (Math.abs(X.goal - X.x) < 0.5) { X.x = X.goal; X.mode = 'idle'; X.t = 0; }
      }
      if (B.goalY !== null && B.goalY !== undefined) { B.y = Ale.approach ? Ale.approach(B.y, B.goalY, 72 * mv) : B.goalY; if (Math.abs(B.y - B.goalY) < 0.5) { B.y = B.goalY; B.goalY = null; } }
      // прыжок Алеси на бревно: по окончании она стоит на нём, бревно проседает
      if (A.mode === 'hop' && A.t >= G.hop) {
        A.mode = 'log'; A.t = 0; this.dip = { t: 0, a: 9 };
        const S = this.S; if (S._splashAt) S._splashAt(S.lx() - 40, S.y + 8, 6, 0.8);
        if (Ale.Audio) Ale.Audio.sfx('land');
      }
      // камера плавно идёт за Алесей (по x; в прыжке и на бревне — за посадочным местом)
      this.cam += (this.camTarget() - this.cam) * (1 - Math.exp(-4.5 * dt));
    }

    // Осадка бревна (px вниз): затухающее покачивание после прыжка
    dipNow() { const d = this.dip; return d.t > 4 ? 0 : d.a * Math.exp(-2.6 * d.t) * Math.cos(11 * d.t); }
  }

  Ale.RiverStage = { create: (S) => new Stage(S), G, lxSwim, Stage, SEAT_X };
})();
