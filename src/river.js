// Заплыв через Днепр (Киев, глава 2; владелец 08.10.2026): Алеся и Бубел находят большое бревно, Бубел садится спереди, Алеся гребёт веслом. Мини-игра на весь экран, чуть больше минуты (71,7 с).
// «Викинги» — это саундтрек и темп (трек river_swim, 96 ударов в минуту, 4/4: такт 2,5 с), а не лодка (владелец: «бревно вместо лодки»): гребки и препятствия идут строго на доли музыки.
// Нужно вести бревно вверх и вниз между плывущими корягами, бочками и минами; удар не убивает (последнее сердце остаётся).
//   const run = Ale.River.open(sc);        — «подложка»: берег Днепра, герои у бревна; рисуется поверх сцены под диалогами (сценарий ведёт подводку обычными UI.say)
//   yield Ale.River.play(run);             — сам заплыв (модальное окно, мир стоит): посадка, ≈ 70 секунд пути, высадка; в конце экран чёрный, run.result — итог
//   run.close();                           — убрать подложку (после заплыва сценарий сам проявляет сцену: UI.fadeTo(0, …))
// Время — только по dt (в игровом коде нет часов), косметика (брызги, щепки) — Ale.fxRng, трасса строится отдельным генератором с постоянным зерном: она одна и та же на каждом
// прохождении и в тестах. Рисует Ale.RiverArt (src/river_art.js); здесь — правила, трасса, управление, бот и общий объект Ale.River (busy / update / draw / reset, как у Ale.Chess).
// Время заплыва t = 0 — начало файла музыки (Audio.music('river_swim') стартует в play()); сетка долей: доля k стоит в BAR0 + k·BEAT, где BAR0 — начало такта 0 в обработанном файле
// (исходник 0,034 с минус обрезанные при подготовке 0,333 с; проверка «Заплыв: музыка…» сверяет эту сетку с настоящим файлом).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // =================================================================== время и музыка
  const BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4, BAR0 = -0.299;
  const tb = (bar, beat) => BAR0 + BAR * bar + BEAT * (beat || 0);
  const T = {
    bubel: 0.55,                // Бубел трусит к воде и прыгает на передний конец бревна (Алеся уже стоит на нём с веслом: приход, поиски весла и посадка — подводка на берегу, Ale.RiverStage)
    pan: 2.0,                   // вид сдвигается с берега подводки (бревно правее) на место заплыва (28% ширины): к первому гребку всё стоит на месте
    push: tb(1, 0),             // первый гребок от берега — на доле (2,2 с)
    control: tb(1, 2),          // управление открывается (3,45 с), препятствия начнутся через 3,7 с (такт 3)
    drop: tb(12, 0),            // музыка «падает» всем составом (29,7 с); от неё считается плотность трассы, но на экране ничего не происходит: ни вспышки, ни надписи, ни крика, темп гребков не меняется
    land: tb(27, 0),            // берег виден, управление закрыто, бревно выходит на середину (67,2 с; было 57,2: дистанцию удлинили на 10 с = 4 такта в самом конце, такты 23–26)
  };
  T.touch = T.land + 2.2;       // бревно уткнулось в песок (69,4 с)
  T.hop = T.touch + 0.25;       // герои сходят на берег
  T.fade = T.touch + 1.5;       // начало затемнения (и ухода музыки заплыва: на 70,9 с)
  T.end = T.touch + 2.3;        // конец (71,7 с). Файл трека кончается на 62,5 с, поэтому дальше 62,09 с идёт его петля (42,10 → 62,09 с = ровно 8 тактов): сетка долей остаётся той же

  // =================================================================== геометрия
  const LANES = 5, LANE0 = 400, LANE_D = 64;
  const LANE_Y = [0, 1, 2, 3, 4].map((i) => LANE0 + i * LANE_D);        // линия воды у бревна в каждой полосе (чем ближе к зрителю, тем ниже и крупнее)
  const Y_MIN = LANE_Y[0] - 14, Y_MAX = LANE_Y[4] + 14;
  const LOG = { rx: 124, ry: 17 };                                      // ватерлиния бревна: полудлина и полутолщина (концы с корнями и спилом над водой, в счёт не идут)
  const V_OBS = 360;                                                    // скорость плывущих навстречу вещей относительно бревна (юн./с)
  const STEER = { vmax: 300, accel: 2600, drag: 3200, knock: 210, lock: 0.26 };
  const INVUL = 1.4;
  const MUSIC_WAIT = 3, SYNC_SLACK = 0.03, SYNC_RATE = 0.15;              // привязка часов к музыке: сколько ждать первый звук (с), какое расхождение не трогать (с), какую долю шага за кадр можно подтягивать
  const FORGIVE = { x: 6, y: 3 };                                        // поблажка: касание краем не считается
  const KINDS = {
    barrel: { rx: 24, ry: 19 },       // бочка
    snag:   { rx: 72, ry: 17 },       // длинная коряга
    root:   { rx: 58, ry: 28 },       // коряга с корнями
    mine:   { rx: 28, ry: 22 },       // мина
    tree:   { rx: 118, ry: 96 },      // плывущее дерево: перекрывает три полосы (по краю — две)
  };
  const VARIANTS = { barrel: 3, snag: 3, root: 2, mine: 1, tree: 2 };       // сколько нарисовано разных видов каждого (RiverArt.OBS; проверка «Заплыв: трасса» следит за совпадением)
  const scaleAt = (y) => 0.8 + 0.38 * (y - LANE0) / (4 * LANE_D);       // масштаб по глубине: дальняя полоса мельче

  // Скорость прокрутки берега и воды: стоит у берега, разгоняется после первого гребка, у берега назначения тормозит. scrollEnd — путь до касания (по нему ставится берег-цель).
  const speedAt = (t) => (t < T.push ? 0 : V_OBS * smooth((t - T.push) / 1.6) * (1 - smooth((t - (T.land + 0.2)) / (T.touch - T.land - 0.2))));
  const SCROLL_END = (() => { let s = 0; for (let t = 0; t < T.touch; t += 1 / 60) s += speedAt(t) / 60; return s; })();

  // =================================================================== трасса
  // Строится «от пути»: сначала путь (полоса, в которой можно проплыть ряд), потом вокруг него препятствия — так трасса проходима по построению. Ряды стоят на долях (доля — 0,625 с),
  // между соседними рядами путь смещается не больше чем на полосу (при расстоянии в две доли и больше — на две). Препятствия не занимают полосы пути в этом и соседних рядах,
  // поэтому и переход между рядами свободен. Плотность и состав растут вместе с музыкой: тихая вода (такты 3–5), нарастание (6–11: вступают ударные), полный состав после «падения»
  // (12–19), заключительный отрезок и последний такт перед берегом (23) — чистый. Зерно постоянное, поэтому трасса одна и та же.
  const COURSE_SEED_DEFAULT = 184, TAIL_SEED_DEFAULT = 60;               // зерно удлинённого конца (такты 23–26) подобрано отдельно перебором (1…60: идеальный бот 0 ударов, «хороший» ≈ 0, «средний» ≈ 0,8, «неумелый» ≈ 2 в хвосте, без руля 6)
  // Ряды отрезка: такты from…to. Раскладка по тактам: 3–5 по ряду на такт (учимся рулить); 6–11 каждые две доли; после «падения» чётные такты плотные (каждая доля), нечётные — передышка;
  // с 20-го такта снова каждые две доли (удлинённый конец, 23–26, идёт так же)
  function rowTimes(from, to) {
    const rows = [];
    for (let bar = from; bar <= to; bar++) {
      const beats = bar < 6 ? [0] : bar < 12 ? [0, 2] : bar < 20 ? (bar % 2 === 0 ? [0, 1, 2, 3] : [0, 2]) : [0, 2];
      for (const b of beats) rows.push({ bar, beat: b, hit: tb(bar, b) });
    }
    return rows;
  }
  // Один отрезок трассы: путь, препятствия вокруг него и «выходные» (плывущие деревья). prevRow — последний ряд предыдущего отрезка (его полоса пути продолжается), null — начало трассы.
  // Поток случайности R расходуется в одном и том же порядке (путь всех рядов → препятствия → выходные), поэтому основной отрезок с зерном 184 остался прежним до единого препятствия.
  function courseSection(R, rows, prevRow, setPieces, treeFrom) {
    let p = prevRow ? prevRow.path : R.pick([1, 3]);                    // первый ряд трассы: путь не по средней полосе, где бревно стоит с начала (урок: на ней стоит бочка)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], before = i ? rows[i - 1] : prevRow, gap = before ? r.hit - before.hit : 9, maxStep = gap >= BEAT * 1.9 ? 2 : 1;
      if (before) {
        let step = R.pick(maxStep === 2 ? [-2, -1, -1, 0, 1, 1, 2] : [-1, -1, 0, 1, 1]);
        if (p + step < 0 || p + step > 4) step = -step;
        p = clamp(p + step, 0, 4);
      }
      r.path = p;
    }
    // препятствия вокруг пути; в дальнем конце плотнее
    const out = [];
    let treeDone = treeFrom || 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], prev = i ? rows[i - 1] : prevRow, next = rows[i + 1], early = r.bar < 10;
      // В начале (такты 3–9) в ряду занята и та полоса, где бревно стояло в прошлом ряду, — иначе можно было бы никуда не плыть; дальше хватает того, что свободных полос мало
      const prevLane = prev ? prev.path : 2, keep = new Set([r.path]); if (next && prev) keep.add(next.path); if (!early && prev) keep.add(prev.path);       // первый ряд: полоса старта (2) занята всегда
      const free = [0, 1, 2, 3, 4].filter((l) => !keep.has(l));
      const want = r.bar < 6 ? 1 : r.bar < 9 ? 2 : r.bar < 12 ? 2 : r.bar < 20 ? (r.beat % 2 === 0 ? 3 : 2) : 3;
      const lanes = early && free.includes(prevLane) ? [prevLane] : [];
      while (lanes.length < Math.min(want, free.length)) { const l = R.pick(free); if (!lanes.includes(l)) lanes.push(l); }
      lanes.sort((a, b) => a - b);
      for (const lane of lanes) {
        const kind = R.pick(r.bar < 7 ? ['barrel', 'snag'] : r.bar < 12 ? ['barrel', 'barrel', 'snag', 'snag', 'root', 'mine'] : ['barrel', 'barrel', 'snag', 'root', 'root', 'mine']);       // мины — реже, с седьмого такта
        const drift = (kind === 'snag' || kind === 'root') && R.chance(0.45) ? R.pick([-26, -16, 16, 26]) : 0;
        out.push({ hit: r.hit, bar: r.bar, beat: r.beat, lane, kind, drift, variant: R.int(0, 2) % VARIANTS[kind] });
      }
    }
    // выходные: плывущее дерево у края (вместо обычных препятствий в этих полосах; путь по построению свободен)
    const setPiece = (bar, beat, lane) => {
      const hit = tb(bar, beat), cover = lane === 0 ? [0, 1] : lane === 4 ? [3, 4] : [1, 2, 3];
      const row = rows.find((r) => Math.abs(r.hit - hit) < 1e-6);
      if (!row || cover.includes(row.path)) return false;
      for (const r of rows) if (Math.abs(r.hit - hit) < BEAT * 1.6 && cover.includes(r.path)) return false;
      for (let k = out.length - 1; k >= 0; k--) if (Math.abs(out[k].hit - hit) < BEAT * 1.6 && cover.includes(out[k].lane)) out.splice(k, 1);
      out.push({ hit, bar, beat, lane, kind: 'tree', drift: 0, variant: treeDone++ % 2 });
      return true;
    };
    for (const [bar, beat] of setPieces) for (const lane of R.chance(0.5) ? [0, 4] : [4, 0]) if (setPiece(bar, beat, lane)) break;
    return { out, rows, trees: treeDone };
  }
  // Трасса: основной отрезок (такты 3–22, зерно 184 подобрано под него) и удлинённый конец (такты 23–26, свой поток случайности, путь продолжается с последнего ряда основного отрезка)
  function buildCourse(seed) {
    const sd = seed === undefined ? COURSE_SEED_DEFAULT : seed;
    const main = courseSection(new Ale.Rng(sd), rowTimes(3, 22), null, [[10, 0], [14, 0], [17, 0], [21, 0]], 0);
    const tail = courseSection(new Ale.Rng(River.COURSE_TAIL_SEED !== undefined ? River.COURSE_TAIL_SEED : TAIL_SEED_DEFAULT), rowTimes(23, 26), main.rows[main.rows.length - 1], [[24, 0]], main.trees);
    const out = main.out.concat(tail.out);
    out.sort((a, b) => a.hit - b.hit || a.lane - b.lane);
    out.forEach((o, i) => { o.id = i; });
    return out;
  }
  const obsY = (o, t) => LANE_Y[0] + o.lane * LANE_D + o.drift * (t - o.hit);

  // =================================================================== подготовка бота: «где безопасно через ближайшие секунды»
  // Динамическое программирование по сетке (время × высота): ищется путь без столкновений с наименьшим числом поворотов. Человеческий бот (задержка, ошибки) реже обновляет решение.
  const GRID = 8, DT_PLAN = 0.1, LOOK = 2;
  function plan(S, o) {
    o = o || {};
    const hor = o.horizon || 2.4, t0 = S.t, steps = Math.round(hor / DT_PLAN), ny = Math.round((Y_MAX - Y_MIN) / GRID) + 1, margin = o.margin === undefined ? 5 : o.margin;
    const near = S.obs.filter((e) => !e.spent && e.hit > t0 - 1.2 && e.hit < t0 + hor + 1.2);
    // 2 — столкновение, 1 — «мягкая зона» вокруг препятствия (шире и дольше): путь, который теснится у препятствий, дороже, поэтому бот уходит заранее, а не в последний миг
    const cellRisk = (t, y) => {
      let r = 0;
      for (const e of near) {
        const K = KINDS[e.kind], dx = Math.abs(e.hit - t) * V_OBS, dy = Math.abs(obsY(e, t) - y);
        if (dx < K.rx + LOG.rx - FORGIVE.x + 4 && dy < K.ry + LOG.ry - FORGIVE.y + margin) return 2;
        if (dx < K.rx + LOG.rx + 150 && dy < K.ry + LOG.ry + 20) r = 1;
      }
      return r;
    };
    const INF = 1e9, MV = 2;                                           // за шаг — не больше двух клеток (16 юн. за 0,1 с): с запасом к настоящей скорости бревна
    let cost = new Array(ny).fill(INF), first = new Array(ny).fill(0);
    const j0 = clamp(Math.round((S.y - Y_MIN) / GRID), 0, ny - 1);
    cost[j0] = 0; first[j0] = j0;
    for (let k = 1; k <= steps; k++) {
      const t = t0 + k * DT_PLAN, nc = new Array(ny).fill(INF), nf = new Array(ny).fill(0), risk = [];
      for (let j = 0; j < ny; j++) risk[j] = cellRisk(t, Y_MIN + j * GRID);
      for (let j = 0; j < ny; j++) {
        if (cost[j] >= INF) continue;
        for (let d = -MV; d <= MV; d++) {
          const jj = j + d; if (jj < 0 || jj >= ny) continue;
          const c = cost[j] + (risk[jj] === 2 ? 1000 : risk[jj] === 1 ? 4 : 0) + (d ? 0.25 : 0) + Math.abs(Y_MIN + jj * GRID - LANE_Y[2]) * 0.0008;
          if (c < nc[jj]) { nc[jj] = c; nf[jj] = k === LOOK ? jj : first[j]; }
        }
      }
      cost = nc; first = nf;
    }
    let best = 0; for (let j = 1; j < ny; j++) if (cost[j] < cost[best]) best = j;
    return { y: Y_MIN + first[best] * GRID, cost: cost[best] };
  }

  // =================================================================== сессия
  class Session {
    constructor(sc, opts) {
      const G = Ale.Game;
      this.sc = sc || null; this.opts = opts || {};
      this.phase = 'shore';                    // shore (подложка под диалогами) → launch (посадка и отход) → swim → landing → done
      this.clock = 0;                          // время анимации воды: идёт и на берегу
      this.t = 0;                              // время заплыва: от начала музыки
      this.vw = (G && G.viewW) || 1280; this.vh = 720;
      this.y = LANE_Y[2]; this.vy = 0; this.lock = 0; this.tilt = 0;
      this.maxHp = (G && G.state && G.state.maxHp) || 5; this.hp = this.maxHp; this.hits = 0; this.invul = 0; this.shake = 0; this.flash = 0;
      this.scroll = 0; this.speed = 0;
      this.obs = buildCourse(River.COURSE_SEED).map((o) => Object.assign({ spent: false, hitAt: -1 }, o));
      this.fx = []; this.barks = []; this.banner = null; this.stroke = -1; this.barkCool = 0; this.woofs = 0;
      this.done = false; this.result = null; this.closed = false; this.broken = false; this.hitLog = [];
      this.syncName = null; this.synced = false; this.musicWait = 0;          // привязка часов к музыке (play() включает её, когда заплыв идёт по-настоящему, а не в проверках)
      this.cmd = null; this.target = null; this.pointerOn = false;
      this.stage = Ale.RiverStage ? Ale.RiverStage.create(this) : null;       // берег отплытия: приход героев, весло, посадка (src/river_stage.js)
      this.ev = this._events();
    }

    // Что происходит по часам музыки (звук, надписи, реплики Бубела)
    _events() {
      const Tx = (Ale.T && Ale.T.river) || {}, say = (s, key) => () => { const L = Tx.barks && Tx.barks[key]; if (L) s._bark(L); };
      return [
        { t: T.bubel + 0.72, fn: () => { if (Ale.Audio) Ale.Audio.sfx('soft_hit'); } },                  // Бубел спрыгнула на бревно
        { t: T.control, fn: (s) => { s.banner = { text: Tx.go, age: 0, life: 1.6 }; say(s, 'start')(); } },
        { t: tb(3, 0) - 0.7, fn: say(this, 'barrel') },
        { t: T.land, fn: say(this, 'land') },
        { t: T.touch, fn: (s) => { if (Ale.Audio) Ale.Audio.sfx('land'); s.banner = { text: Tx.shore, age: 0, life: 1.6 }; s.shake = 0.3; s._splashAt(s.lx() + 150, s.y + 6, 14, 1.2); } },
        { t: T.fade, fn: (s) => { if (Ale.Audio && s.opts.musicAfter) Ale.Audio.music(s.opts.musicAfter, { out: 1.0, in: 2.4 }); } },       // экран темнеет — музыка заплыва уходит, музыка перехода вступает под затемнением
      ].sort((a, b) => a.t - b.t);
    }
    // Экранная точка бревна по горизонтали: пока идёт подводка, оно стоит правее (слева — место для прихода героев и поисков весла), в первые секунды заплыва вид плавно сдвигается на 28% ширины
    lx(W) { const w = W || this.vw, a = this.stage ? this.stage.camLx(w) : Math.round(w * 0.52), b = Ale.RiverStage ? Ale.RiverStage.lxSwim(w) : Math.round(w * 0.28); return Math.round(lerp(a, b, smooth(this.t / T.pan))); }
    // Действие подводки (приход, поиски весла, посадка): возвращает объект ожидания для сценария, update() — true, когда оно закончено
    act(name) { return this.stage ? this.stage.act(name) : { update: () => true }; }
    scale() { return scaleAt(this.y); }
    // Фраза Бубела над головой (одна за раз, не чаще раза в 1,4 с — иначе они наезжают друг на друга)
    _bark(text, life) {
      if (!text) return;
      const last = this.barks[this.barks.length - 1];
      if (last && last.age < 1.4) return;
      this.barks.push({ text, age: 0, life: life || 2.0 });
      if (Ale.Audio) Ale.Audio.sfx('bark');
    }
    _splashAt(x, y, n, power) {
      const R = Ale.fxRng;
      for (let i = 0; i < n; i++) this.fx.push({ k: 'drop', x: x + R.range(-10, 10), y, vx: R.range(-90, 120) * power, vy: R.range(-300, -120) * power, age: 0, life: R.range(0.5, 0.9), r: R.range(2, 4.6) });
      this.fx.push({ k: 'ring', x, y, age: 0, life: 0.7, r: 10 * power });
    }
    _chips(x, y, n, kind) {
      const R = Ale.fxRng;
      for (let i = 0; i < n; i++) this.fx.push({ k: kind || 'chip', x: x + R.range(-18, 18), y: y + R.range(-14, 4), vx: R.range(-170, 190), vy: R.range(-340, -110), rot: R.range(0, 6.28), vr: R.range(-9, 9), age: 0, life: R.range(0.7, 1.2), r: R.range(4, 9) });
    }

    // ---- ввод: клавиши (↑↓ / W S / стик / крестовина), палец или мышь (ведёт бревно за собой)
    _input() {
      const I = Ale.Input; if (!I) return { dir: 0, target: null };
      let dir = 0;
      if (I.keys.has('ArrowUp') || I.keys.has('KeyW') || (I.pad && I.pad.up)) dir -= 1;
      if (I.keys.has('ArrowDown') || I.keys.has('KeyS') || I.cur.down) dir += 1;
      return { dir, target: this.pointerOn ? this.target : null };
    }
    _canSteer() { return this.phase === 'swim' || (this.phase === 'launch' && this.t >= T.control); }

    _steer(dt) {
      let aim = null, dir = 0;
      if (this.phase === 'landing') aim = LANE_Y[2];                           // у берега бревно само выходит на середину
      else if (this._canSteer() && this.lock <= 0) {
        const c = this.cmd, inp = this._input();
        if (c) { dir = c.dir || 0; aim = c.y === undefined ? null : c.y; }
        else { dir = inp.dir; aim = dir ? null : inp.target; }
      }
      let want = 0;
      if (aim !== null && aim !== undefined) want = clamp((aim - this.y) * 7, -STEER.vmax, STEER.vmax);
      else want = dir * STEER.vmax;
      const a = (want === 0 ? STEER.drag : STEER.accel) * dt;
      this.vy = Ale.approach(this.vy, want, a);
      this.y += this.vy * dt;
      if (this.y < Y_MIN) { this.y = Y_MIN; if (this.vy < 0) this.vy = 0; }
      if (this.y > Y_MAX) { this.y = Y_MAX; if (this.vy > 0) this.vy = 0; }
      this.tilt = Ale.approach(this.tilt, clamp(this.vy / STEER.vmax, -1, 1), 5 * dt);
      this.cmd = null;
    }

    // ---- «Гав!»: любое кнопочное действие (E, J, K и т. п.) — Бубел гавкает, пока идёт заплыв; на ход не влияет (маленькая радость, не механика)
    _woof(dt) {
      this.barkCool = Math.max(0, this.barkCool - dt);
      const I = Ale.Input, W = Ale.T && Ale.T.river && Ale.T.river.woof;
      if (this.phase !== 'swim' || this.barkCool > 0 || !I || !W || !(I.pressed('interact') || I.pressed('attack') || I.pressed('throw'))) return;
      this.barkCool = 0.8;
      this.barks.push({ text: W[this.woofs++ % W.length], age: 0, life: 0.9 });
      if (Ale.Audio) Ale.Audio.sfx('bark');
    }

    // ---- гребки: на каждой второй доле, после «падения» — на каждой; в момент гребка — всплеск и звук
    strokeIndex(t) { const per = 2 * BEAT, base = T.push; return t < base ? -1 : Math.floor((t - base) / per + 1e-9); }
    _strokes() {
      const n = this.strokeIndex(this.t);
      if (n > this.stroke) {
        this.stroke = n;
        if (this.phase !== 'done' && this.t < T.touch) { if (Ale.Audio) Ale.Audio.sfx('oar', { vol: this.t < T.control ? 0.4 : 0.3 }); this._splashAt(this.lx() + 35 * this.scale(), this.y + 6, 3, 0.45); }          // всплеск там, где лопасть входит в воду: впереди Алеси (кадры гребка: tools/rig/paddle.swift)
      }
    }

    // ---- столкновения: в плоскости воды (время ↔ расстояние: V_OBS); поблажка по краям
    _collide() {
      if (this.phase !== 'swim') return;
      for (const e of this.obs) {
        if (e.spent) continue;
        const K = KINDS[e.kind], dx = Math.abs(e.hit - this.t) * V_OBS;
        if (dx > K.rx + LOG.rx + 40) continue;
        const dy = this.y - obsY(e, this.t);
        if (dx < K.rx + LOG.rx - FORGIVE.x && Math.abs(dy) < K.ry + LOG.ry - FORGIVE.y) {
          if (this.invul > 0) continue;
          this._hit(e, dy);
        }
      }
    }
    _hit(e, dy) {
      e.spent = true; e.hitAt = this.t;
      this.hitLog.push({ t: Math.round(this.t * 1000) / 1000, id: e.id, kind: e.kind, lane: e.lane, bar: e.bar, beat: e.beat, y: Math.round(this.y), dy: Math.round(dy) });
      this.hits++; this.hp = Math.max(1, this.hp - 1);                          // последнее сердце остаётся
      this.invul = INVUL; this.shake = 0.35; this.lock = STEER.lock;
      this.vy = (dy >= 0 ? 1 : -1) * STEER.knock;
      const x = this.lx() + (e.hit - this.t) * V_OBS, y = obsY(e, this.t), A = Ale.Audio, Tx = (Ale.T && Ale.T.river) || {};
      if (e.kind === 'barrel') { this._chips(x, y - 8, 9); this._splashAt(x, y, 8, 1); if (A) A.sfx('barrel_break'); }
      else if (e.kind === 'mine') { this._splashAt(x, y, 18, 1.6); this._chips(x, y - 12, 6, 'smoke'); this.flash = 0.45; this.shake = 0.5; if (A) A.sfx('mine_boom'); }
      else { this._chips(x, y - 8, 6); this._splashAt(x, y, 5, 0.8); if (A) A.sfx('log_hit'); }
      this._bark(Tx.barks && Tx.barks.hit && Tx.barks.hit[this.hits % Tx.barks.hit.length], 1.4);
      if (Ale.UI && Ale.UI.hearts) Ale.UI.hearts.bump = 1;
    }

    update(dt) {
      this.clock += dt;
      if (this.stage) this.stage.update(dt);                                  // подводка на берегу идёт по своим часам (приход, весло, посадка), и пока открыт диалог
      if (this.phase !== 'shore' && Ale.UI) Ale.UI.tapPoint = null;           // заплыв сам читает палец через pointerDown; на берегу касание нужно сообщению и диалогу — его не трогаем
      for (const f of this.fx) { f.age += dt; if (f.k === 'drop' || f.k === 'chip' || f.k === 'smoke') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.k === 'smoke' ? -60 : 900) * dt; if (f.rot !== undefined) f.rot += f.vr * dt; } }
      this.fx = this.fx.filter((f) => f.age < f.life);
      for (const b of this.barks) b.age += dt; this.barks = this.barks.filter((b) => b.age < b.life);
      if (this.banner) { this.banner.age += dt; if (this.banner.age > this.banner.life) this.banner = null; }
      if (this.phase === 'shore' || this.phase === 'done') return;
      if (this.syncName && this._syncMusic(dt)) return;                       // ждём первый звук музыки: от него идут все доли (гребки, ряды, «падение»)
      this.t += dt;
      if (this.synced) this._slewToMusic(dt);
      while (this.ev.length && this.ev[0].t <= this.t) this.ev.shift().fn(this);
      if (this.phase === 'launch' && this.t >= T.control) this.phase = 'swim';
      if (this.phase === 'swim' && this.t >= T.land) this.phase = 'landing';
      this.speed = speedAt(this.t); this.scroll += this.speed * dt;
      this.invul = Math.max(0, this.invul - dt); this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt * 1.5); this.lock = Math.max(0, this.lock - dt);
      this._steer(dt);
      this._strokes();
      this._collide();
      this._woof(dt);
      if (this.t >= T.end) this._finish();
    }

    // Часы заплыва шли по шагам игры, а музыка — по часам звука, и связи между ними не было (18.10.2026, проверка мини-игр): если трек начинался позже (после «Продолжить» с контрольной точки он ещё не
    // скачан: до 1–3 с на телефоне, а доля — 0,625 с), если игра подвисала (кадр дольше 0,1 с отдаёт игре не всё время) или экран на секунды ложился в вертикаль, гребки, ряды и «падение» уезжали от долей
    // на весь остаток заплыва. Теперь: пока музыки нет, часы стоят (не дольше MUSIC_WAIT с; нет звука вовсе — плывём по своим часам, как раньше), а когда она пошла, часы ставятся по ней и дальше
    // подтягиваются к ней мягко (не больше SYNC_RATE шага за кадр, чтобы препятствия не прыгали). Пауза и сворачивание останавливают и звук, и часы вместе (UI.update, Audio.suspend).
    _syncMusic(dt) {
      if (this.synced) return false;
      const A = Ale.Audio, ta = A && A.musicTime ? A.musicTime(this.syncName) : null;
      if (ta === null) {
        if (!A || A.muted || A.musicOff) { this.syncName = null; return false; }          // музыки не будет совсем
        if ((this.musicWait += dt) < MUSIC_WAIT) return true;
        this.syncName = null; return false;                                               // не дождались (не загрузилась, контекст не запущен): по своим часам
      }
      this.synced = true; this.t = Math.max(0, ta);
      return false;
    }
    _slewToMusic(dt) {
      const ta = Ale.Audio.musicTime(this.syncName);
      if (ta === null) return;
      const d = ta - this.t;
      if (Math.abs(d) > SYNC_SLACK) this.t += Math.max(-SYNC_RATE * dt, Math.min(SYNC_RATE * dt, d));
    }

    _finish() {
      if (this.done) return;
      this.done = true; this.phase = 'done';
      this.result = { hits: this.hits, hp: this.hp, maxHp: this.maxHp, time: Math.round(this.t * 100) / 100, broken: this.broken };
      const UI = Ale.UI;
      if (UI) { UI.fadeA = 1; UI.fadeTarget = 1; UI.fadeSpeed = 0; }          // экран остаётся чёрным до сценария: он проявит сцену сам
      if (Ale.Audio && this.opts.musicAfter) Ale.Audio.music(this.opts.musicAfter);
      if (River.session === this || River.busy) River.busy = false;
      if (Ale.Input) Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null;                  // нажатия во время заплыва не должны «протечь» в следующий диалог
    }
    close() { this.closed = true; if (River.session === this) { River.session = null; River.busy = false; } }

    // Прогресс заплыва (0…1) для полоски наверху
    progress() { return clamp(this.t / T.touch, 0, 1); }
  }

  // =================================================================== общий объект
  const River = (Ale.River = {
    busy: false,
    session: null,
    BPM, BEAT, BAR, BAR0, tb, T, LANES, LANE_Y, LANE_D, Y_MIN, Y_MAX, LOG, KINDS, V_OBS, STEER, INVUL, FORGIVE, MUSIC_WAIT, SYNC_SLACK, SYNC_RATE, GRID, COURSE_SEED: COURSE_SEED_DEFAULT, SCROLL_END,
    scaleAt, speedAt, buildCourse, obsY, plan, Session,

    // Подложка: берег Днепра, герои у бревна. Сценарий ведёт подводку обычными репликами.
    open(sc, opts) {
      if (this.session) this.session.closed = true;
      if (Ale.RiverArt && Ale.RiverArt.prepare) { try { Ale.RiverArt.prepare(); } catch (e) { this.lastError = 'prepare: ' + (e && e.message || e); if (window.console) console.error(e); } }     // слои строятся сразу (пока на экране открытка), а не на первом кадре
      const s = new Session(sc, opts);
      this.session = s; this.busy = false;
      return s;
    },
    // Сам заплыв: модальное окно. Возвращает объект ожидания сценария (update() — true, когда заплыв закончен и экран чёрный).
    play(s, opts) {
      s = s || this.session;
      if (!s) s = this.open(null, opts);
      if (opts) Object.assign(s.opts, opts);
      this.session = s; this.busy = true;
      if (s.stage && !(s.stage.ale.mode === 'log' && s.stage.bub.mode === 'idle')) s.stage.ready();          // подводку пропустили (быстрый старт, сбой): конечное состояние сразу
      s.phase = 'launch'; s.t = 0; s.ev = s._events(); s.stroke = -1;
      // Музыка заплыва вступает сразу и коротко (за 0,4 с: сетка долей начинается с первого звука файла, поэтому всё остальное — гребки, ряды, «падение» — стоит на ней),
      // а музыка подводки уходит под ней плавно
      if (Ale.Audio) {
        const own = Ale.Audio.pick ? Ale.Audio.pick('river_swim', null) : null;
        if (own) { Ale.Audio.music(own, { in: 0.4, out: 1.6 }); if (!(Ale.Game && Ale.Game.manual) && Ale.Audio.musicTime) { s.syncName = own; s.synced = false; s.musicWait = 0; } }          // в проверках (ручное время) звука нет — часы идут сами, как и шла вся сетка
      }
      if (Ale.Input) Ale.Input.consumeAll(); if (Ale.UI) Ale.UI.tapPoint = null;
      return { update: () => s.done, session: s, get result() { return s.result; } };
    },
    // Шаг: зовёт UI.update каждый шаг, пока есть сессия (на берегу идёт только анимация воды)
    update(dt) {
      const s = this.session; if (!s) { this.busy = false; return; }
      if (s.vw !== (Ale.Game && Ale.Game.viewW)) s.vw = (Ale.Game && Ale.Game.viewW) || s.vw;
      try { s.update(dt); }
      catch (e) { River.lastError = 'update: ' + (e && e.message || e); s.broken = true; if (window.console) console.error(e); s._finish(); }
    },
    draw(ctx, W, H) {
      const s = this.session; if (!s || !Ale.RiverArt) return;
      s.vw = W; s.vh = H;
      try { Ale.RiverArt.draw(ctx, s, W, H); }
      catch (e) { River.lastError = 'draw: ' + (e && e.message || e); s.broken = true; if (window.console) console.error(e); if (s.phase !== 'shore') s._finish(); }
    },
    // Подложка под диалогами рисуется до интерфейса, заплыв — поверх всего (UI.draw)
    get passive() { return !!(this.session && !this.busy && !this.session.done && this.session.phase === 'shore'); },
    reset() { const s = this.session; this.session = null; this.busy = false; if (s) { s.done = true; s.closed = true; } },
    // Куда указывает облачко реплики героя на подложке (голова); нет подложки — null, и работает обычная привязка к герою сцены
    anchorOf(who) {
      const s = this.session; if (!s || s.phase !== 'shore' || s.closed || !Ale.RiverArt) return null;
      const P = Ale.RiverArt.layout(s, s.vw, s.vh), h = P.heads[who];
      return h ? { x: h.x, y: h.y } : null;
    },
    // Тела героев подводки (рамки в координатах экрана; who — чьё тело): облачко над Бубелом поднимается над Алесей, как в обычной сцене (UI._drawHints), а не накрывает её,
    // когда они идут рядом или Бубел несёт весло (владелец: облачко «До следующего моста…» закрывало Алесю целиком)
    hintBlockers() {
      const s = this.session; if (!s || s.phase !== 'shore' || s.closed || !Ale.RiverArt) return null;
      const P = Ale.RiverArt.layout(s, s.vw, s.vh), out = [];
      for (const [who, o, half] of [['ale', P.ale, 40], ['bubel', P.bub, 34]]) { const h = P.heads[who]; if (o && h) out.push({ who, x: o.x - half * o.sx, y: h.y, w: 2 * half * o.sx, h: o.y - h.y }); }
      return out;
    },

    // Можно ли сейчас открыть паузу: в самом заплыве (посадка, ход, выход на берег) — да (владелец 11.10.2026); на берегу подводки обычная пауза и так работает (UI.update замораживает подложку, пока открыто меню)
    canPause() { const s = this.session, U = Ale.UI; return !!(s && this.busy && !s.done && s.phase !== 'shore' && !(U && (U.menu || U.help || U.dlg || U.lock))); },
    // Кнопка паузы в правом верхнем углу (рисуется только на сенсорном экране: Esc и P на клавиатуре); нажатие на неё не ведёт бревно
    pauseButtonAt(x, y) { const s = this.session; if (!s || !Ale.Input || Ale.Input.lastDevice !== 'touch') return false; const W = s.vw || 1280, sp = Ale.Touch && Ale.Touch.pauseSpot ? Ale.Touch.pauseSpot() : { fromRight: 42, y: 41, r: 25 }; return Math.hypot(x - (W - sp.fromRight), y - sp.y) <= sp.r * 1.4; },        // там же и тем же размером, что кнопка «II» в игре (Touch.pauseSpot)

    // ---- касание и мышь: палец ведёт бревно за собой
    pointerDown(x, y) { const s = this.session; if (!s || !this.busy) return; if (this.pauseButtonAt(x, y)) { if (Ale.Game && this.canPause()) Ale.Game.openPause(); return; } s.pointerOn = true; s.target = y - 24; },        // бревно идёт чуть выше пальца: палец не закрывает его
    pointerMove(x, y) { const s = this.session; if (!s || !this.busy || !s.pointerOn) return; s.target = y - 24; },
    pointerUp() { const s = this.session; if (s) { s.pointerOn = false; s.target = null; } },

    // ---- бот: зовётся каждый шаг, пока busy. o: delay — раз в сколько секунд пересматривает решение (человек ≈ 0,25–0,4), miss — вероятность пропустить пересмотр,
    // horizon — как далеко видит (с), margin — запас по высоте (юн.), rng — источник случайности (по умолчанию детерминированный). Возвращает true, пока заплыв идёт.
    botStep(o) {
      const s = this.session; if (!s || !this.busy) return false;
      o = o || {};
      if (o.noSteer) { s.cmd = { dir: 0 }; return true; }                                  // «плыть, не рулить»: проверки без управления
      if (!this._bot || this._bot.s !== s) this._bot = { s, next: 0, y: s.y, rng: o.rng || new Ale.Rng(4242) };
      const b = this._bot;
      if (s._canSteer() && s.phase === 'swim') {
        if (s.t >= b.next) {
          b.next = s.t + (o.delay || 0);
          if (!(o.miss && b.rng.chance(o.miss))) b.y = plan(s, { horizon: o.horizon, margin: o.margin }).y;
        }
        const d = b.y - s.y;
        s.cmd = { y: b.y, dir: Math.abs(d) < 4 ? 0 : Math.sign(d) };
      }
      return true;
    },
    // Прогон «вхолостую» для проверок и подбора трассы: бот (или его отсутствие) ведёт бревно до конца, звук и интерфейс не трогаются. Возвращает итог.
    simulate(o) {
      o = o || {};
      const prevSession = this.session, prevBusy = this.busy, A = Ale.Audio, U = Ale.UI, sfx = A && A.sfx, music = A && A.music;
      if (A) { A.sfx = () => {}; A.music = () => {}; }
      const s = new Session(null, {}); s.phase = 'launch'; s.vw = o.vw || 1280; s.ev = s._events(); this.session = s; this.busy = true;
      const saved = U && { a: U.fadeA, t: U.fadeTarget, s: U.fadeSpeed };
      try {
        let n = 0;
        while (!s.done && n++ < 60 * 90) { if (!o.none) this.botStep(o); s.update(1 / 60); }
        const out = Object.assign({ steps: n }, s.result);
        if (o.trace) out.s = s;
        return out;
      } finally {
        if (A) { A.sfx = sfx; A.music = music; }
        if (U && saved) { U.fadeA = saved.a; U.fadeTarget = saved.t; U.fadeSpeed = saved.s; }
        this.session = prevSession; this.busy = prevBusy; this._bot = null;
      }
    },
  });
})();
