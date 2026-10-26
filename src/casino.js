// Игровой автомат в казино Монако («автомат с короной»). Сюжет вставляет в него подаренную фишку и тянет рычаг; в этот миг сцена вызывает модуль, и на весь кадр открывается автомат.
// Это небольшой настоящий гемблинг (владелец, 03.10.2026): игрок сам выбирает ставку и тянет рычаг, первый розыгрыш в сюжете — всегда джекпот (иначе нечего красть), дальше есть выбор и риск.
//   const q = Ale.Casino.slots({ jackpot: true });   yield q;   const r = q.result;      // { cancelled, bet, amount, risked, rounds, lost }
// opts: jackpot (true — первый розыгрыш гарантированно три короны, по умолчанию true), bets ([10, 20, 50] €), multiplier (выплата джекпота = ставка × multiplier, 40), maxRisk (сколько раз
// подряд можно рискнуть, 3), noRisk (убрать «Рискнуть»). result: cancelled — вышли из «ставки» без игры (фишка остаётся в автомате, дальше решает сцена), bet — ставка, amount — сколько игрок
// получил (при проигрыше в риске остаётся «утешительный приз» = ставка, у проигранного без джекпота розыгрыша — 0), risked — сколько раз рискнули (0…maxRisk), rounds — сколько розыгрышей
// сыграно (барабаны + каждая карта = 1 + risked), lost — проиграл ли игрок розыгрыш или риск. Пока экран закрыт не полностью, result может быть null; после q.update() === true он есть всегда.
// Модуль устроен как модальное окно (образец — src/chess.js): busy, update(dt), draw(ctx, W, H), reset(); мир на время экрана стоит (UI.modal), касания приходят в UI.tapPoint.
// Внутри — три слоя: logic (чистые функции без DOM: символы и ленты, исход розыгрыша, выплаты, остановка барабана, риск «цвет карты»), Session (состояние, фазы, ввод) и рисование
// (автомат, барабаны, рычаг, карта — всё контурами Canvas: шрифтовые символы не годятся, на iOS они превращаются в картинки).
// Время считается только по dt (в игровом коде нет часов), косметика (монеты, масть карты) — Ale.fxRng, игровое решение — Ale.rng: исход розыгрыша без джекпота и цвет карты в риске.
// Первый розыгрыш при jackpot: три короны при любых нажатиях и любом seed, Ale.rng не расходуется. Все надписи — в T.casino (src/text.js). Звуки — Ale.Audio.sfx (таблица SFX в src/audio.js).
// Бот и проверки ходят теми же путями, что игрок: клавиши (Input), касания (UI.tapPoint) и методы Session (selectBet, placeBet, pull, stop, take, risk, pick, back, skip); бот сюжета —
// Ale.Casino.botStep(Bot), его зовут каждый шаг, пока Ale.Casino.busy.
// Фазы сессии (Session.phase): 'bet' → 'pull' → 'spin' → 'win' → 'offer' → ('take' → закрытие) | ('risk' → 'flip' → 'hit' → 'offer' … | 'miss' → закрытие); 'lose' (розыгрыш без выигрыша) → закрытие.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;

  // ================================================================== ЛОГИКА
  const SYMBOLS = ['cherry', 'lemon', 'bell', 'star', 'seven', 'crown'];
  // Ленты барабанов: по 12 позиций, индекс растёт вверх по экрану (барабан крутится вниз: символы едут сверху вниз). На каждой ленте есть все шесть символов, корона — один раз.
  const STRIPS = [
    ['cherry', 'lemon', 'bell', 'seven', 'star', 'cherry', 'crown', 'lemon', 'bell', 'star', 'seven', 'lemon'],
    ['lemon', 'star', 'cherry', 'bell', 'crown', 'seven', 'lemon', 'cherry', 'star', 'bell', 'seven', 'cherry'],
    ['bell', 'cherry', 'star', 'lemon', 'seven', 'cherry', 'bell', 'crown', 'lemon', 'star', 'seven', 'cherry'],
  ];
  const NSTRIP = 12;
  const DEFAULT_BETS = [10, 20, 50];
  const DEFAULT_MULT = 40, DEFAULT_RISK = 3;
  // Розыгрыш без джекпота: вес исхода в процентах (сумма 100) и множитель выплаты. Три короны — multiplier из опций (40), тройка другого символа — ×10, пара — ×2, иначе проигрыш.
  const WEIGHTS = [['crown3', 1], ['triple', 3], ['pair', 12], ['none', 84]];
  const MULT = { triple: 10, pair: 2, none: 0 };

  // Что выпало: по трём символам на линии выплат
  function classify(symbols) {
    const a = symbols[0], b = symbols[1], c = symbols[2];
    if (a === b && b === c) return a === 'crown' ? 'crown3' : 'triple';
    if (a === b || b === c || a === c) return 'pair';
    return 'none';
  }
  const multOf = (kind, jackpotMult) => (kind === 'crown3' ? (jackpotMult > 0 ? jackpotMult : DEFAULT_MULT) : MULT[kind] || 0);
  const payout = (kind, bet, jackpotMult) => Math.round(bet * multOf(kind, jackpotMult));
  const idxOf = (strip, sym, rng) => { const all = []; strip.forEach((s, i) => { if (s === sym) all.push(i); }); return rng && all.length > 1 ? rng.pick(all) : all[0]; };
  const makeOutcome = (symbols, rng, jackpotMult) => ({ kind: classify(symbols), symbols, stops: symbols.map((s, i) => idxOf(STRIPS[i], s, rng)), mult: multOf(classify(symbols), jackpotMult) });
  // Гарантированный джекпот: три короны, никакой случайности (Ale.rng не трогаем)
  const jackpotOutcome = (jackpotMult) => makeOutcome(['crown', 'crown', 'crown'], null, jackpotMult);
  // Взвешенный исход по Ale.rng: на каждый вызов — фиксированное число обращений к генератору для данного исхода (повторяемо при том же seed)
  function rollOutcome(rng, jackpotMult) {
    const x = rng.next() * 100;
    let acc = 0, kind = 'none';
    for (const w of WEIGHTS) { acc += w[1]; if (x < acc) { kind = w[0]; break; } }
    let syms;
    if (kind === 'crown3') syms = ['crown', 'crown', 'crown'];
    else if (kind === 'triple') { const s = rng.pick(SYMBOLS.filter((c) => c !== 'crown')); syms = [s, s, s]; }
    else if (kind === 'pair') { const s = rng.pick(SYMBOLS), o = rng.pick(SYMBOLS.filter((c) => c !== s)), odd = rng.int(0, 2); syms = [s, s, s]; syms[odd] = o; }
    else { const pool = SYMBOLS.slice(); syms = []; for (let i = 0; i < 3; i++) { const s = rng.pick(pool); pool.splice(pool.indexOf(s), 1); syms.push(s); } }
    return makeOutcome(syms, rng, jackpotMult);
  }

  // Риск «цвет карты»: честные 50 на 50 по Ale.rng. Угадал — выигрыш ×2, не угадал — остаётся ставка (утешительный приз), так что красть сюжету всегда есть что
  const riskPick = (rng) => (rng.chance(0.5) ? 'red' : 'black');
  const riskSettle = (guess, actual, amount, bet) => { const win = guess === actual; return { win, amount: win ? amount * 2 : bet, lost: !win }; };

  // Барабан как чистая функция времени: разгон RAMP секунд по сглаженной кривой до SPIN_V клеток в секунду, потом ровное вращение; остановка — равномерное торможение за STOP_T секунд
  // на целое число клеток (3…4: скорость в начале торможения отличается от скорости вращения не больше, чем на 15%, на размытом барабане это незаметно), три клетки окна (внизу, по центру,
  // вверху) подставляются из исхода, поэтому результат не зависит от того, когда игрок нажал «стоп».
  const SPIN_V = 12, RAMP = 0.3, STOP_T = 0.58;
  const STOP_AT = [1.92, 2.47, 3.02];      // начало торможения барабанов, с от начала вращения: приземляются ровно через STOP_T — 2,5 / 3,05 / 3,6 с (пауза 0,55 с)
  const STOP_MIN = 0.8, STOP_GAP = 0.2;    // досрочная остановка: не раньше 0,8 с от начала и не чаще раза в 0,2 с
  function spinPos(p0, t) {
    if (t <= 0) return p0;
    if (t >= RAMP) return p0 + SPIN_V * (t - RAMP / 2);
    const u = t / RAMP;
    return p0 + SPIN_V * RAMP * (u * u * u - u * u * u * u / 2);
  }
  function spinSpeed(t) {
    if (t <= 0) return 0;
    if (t >= RAMP) return SPIN_V;
    const u = t / RAMP;
    return SPIN_V * u * u * (3 - 2 * u);
  }
  function planStop(p0) { const p1 = Math.ceil(p0 + 3), d = p1 - p0; return { p0, p1, d, T: STOP_T }; }
  const stopPos = (pl, s) => { const u = clamp(s / pl.T, 0, 1); return pl.p0 + pl.d * (1 - (1 - u) * (1 - u)); };
  const stopSpeed = (pl, s) => { const u = clamp(s / pl.T, 0, 1); return u >= 1 ? 0 : (2 * pl.d / pl.T) * (1 - u); };
  const bounceOff = (s) => (s > 0 && s < 0.45 ? 0.09 * Math.exp(-s * 10) * Math.sin(s * 28) : 0);

  // Деньги: «2 000 €» (шаблон — T.casino.money)
  const fmt = (n) => {
    const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), T = Ale.T && Ale.T.casino;
    return (T && T.money ? T.money : '{n} €').replace('{n}', s);
  };

  const logic = {
    SYMBOLS, STRIPS, NSTRIP, WEIGHTS, MULT, DEFAULT_BETS, DEFAULT_MULT, DEFAULT_RISK,
    classify, multOf, payout, jackpotOutcome, rollOutcome, riskPick, riskSettle, spinPos, spinSpeed, planStop, stopPos, stopSpeed, fmt,
    SPIN_V, RAMP, STOP_T, STOP_AT, STOP_MIN, STOP_GAP,
  };

  // ================================================================== ВРЕМЯ И СОСТОЯНИЕ
  const sfx = (name, o) => { if (Ale.Audio && Ale.Audio.sfx) Ale.Audio.sfx(name, o); };
  const EASE = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inQuad: (t) => t * t,
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const BACK_PHASES = new Set(['bet', 'pull', 'offer', 'risk']);
  const GUARD = 0.28;                   // первые 0,28 с новой фазы нажатия и касания не принимаются (чтобы не пролететь экран случайным нажатием)
  const COUNT_T = 1.5;                  // сумма выигрыша «считается вверх»
  const WIN_T = 2.4, WIN_SMALL_T = 1.5; // «ДЖЕКПОТ!» стоит не короче 2,2 с до следующего шага
  const LOSE_T = 1.7, HIT_T = 1.7, MISS_T = 2.0, TAKE_T = 0.9, FLIP_T = 0.8, SKIP_AFTER = 0.8;
  const CLOSE_FADE = 0.4, TABLE_T = 0.3, SPIN_GUARD = 0.3, LAND_PAUSE = 0.45;
  const NOCTL = { dir: 0, ok: false, back: false };
  const MAX_COINS = 160;

  class Session {
    constructor(opts) {
      opts = opts || {};
      let bets = Array.isArray(opts.bets) ? opts.bets.filter((n) => isFinite(n) && n > 0).map((n) => Math.round(n)).filter((n) => n > 0).slice(0, 4) : [];
      if (!bets.length) bets = DEFAULT_BETS.slice();
      const fixed = isFinite(opts.bet) && opts.bet > 0 ? Math.round(opts.bet) : 0;      // фишка «стоит» столько: одна ставка, экран выбора ставки пропускается (владелец 03.10.2026)
      if (fixed) bets = [fixed];
      this.opts = {
        jackpot: opts.jackpot !== false, bets, fixedBet: fixed, multiplier: opts.multiplier > 0 ? +opts.multiplier : DEFAULT_MULT,
        maxRisk: isFinite(opts.maxRisk) ? Math.max(0, Math.floor(opts.maxRisk)) : DEFAULT_RISK, noRisk: !!opts.noRisk,
      };
      this.t = 0; this.phaseT = 0; this.fade = 0; this.closing = false; this.closeT = 0; this.done = false; this.result = null;
      this.phase = fixed ? 'pull' : 'bet';
      this.sel = fixed ? 0 : Math.min(1, bets.length - 1);              // выбранная ставка (по умолчанию средняя); в 'offer' и 'risk' — выбранная кнопка (0 — «Забрать» / красная)
      this.bet = fixed; this.amount = 0; this.shown = 0; this.count = null;
      this.risked = 0; this.lost = false; this.outcome = null; this.winMask = [false, false, false];
      this.spinT = 0; this.stopAt = STOP_AT.slice(); this.spins = 0;
      const start = [0, 3, 2];
      this.reels = start.map((p) => ({ pos: p, p0: p, v: 0, mode: 'idle', plan: null, final: null, t0: 0, landT: -1, early: false, cell: Math.floor(p) }));
      this.lever = { t: -1 };
      this.table = 0; this.rays = 0; this.card = null; this.riskInfo = null;
      this.coins = []; this.coinAcc = 0; this.coinRate = 0; this.coinFor = 0; this.coinSnd = 0; this.tickAcc = 0;
      this.vw = 0; this.vh = 0; this._tp = null; this._ctl = NOCTL;
      this.capKey = ''; this.capT = 0;
      this.sndCount = {};                                   // сколько раз какой звук запрошен (для проверок частоты звуков)
    }

    _snd(name, vol) { this.sndCount[name] = (this.sndCount[name] || 0) + 1; sfx(name, vol === undefined ? undefined : { vol }); }
    _enter(phase) { this.phase = phase; this.phaseT = 0; }
    _lay() { return layout(this.vw || (Ale.Game && Ale.Game.viewW) || 1280, this.vh || (Ale.Game && Ale.Game.viewH) || 720, this.opts.bets.length); }
    get canRisk() { return !this.opts.noRisk && this.risked < this.opts.maxRisk && this.amount > 0; }
    get takeIndex() { return 0; }
    // Символ на ленте i в позиции k (целое): после начала торможения три клетки окна приходят из исхода
    symAt(i, k) {
      const r = this.reels[i];
      if (r.plan && r.final && k >= r.plan.p1 - 1 && k <= r.plan.p1 + 1) return r.final[k - (r.plan.p1 - 1)];
      return STRIPS[i][mod(k, NSTRIP)];
    }
    // Кнопки, видимые сейчас: прямоугольники, подписи и признак выбора (для рисования, касаний и проверок)
    buttons(L) {
      L = L || this._lay();
      const T = Ale.T.casino, B = T.buttons, out = [], h = L.btnH;
      const row = (widths, gap, y) => centeredRow(L.cx, y === undefined ? L.rowB : y, h, widths, gap);
      switch (this.phase) {
        case 'bet': {
          L.betRects.forEach((r, i) => out.push({ id: 'bet' + i, kind: 'bet', i, rect: r, label: fmt(this.opts.bets[i]), sub: T.upTo.replace('{n}', fmt(payout('crown3', this.opts.bets[i], this.opts.multiplier))), sel: this.sel === i }));
          const r = row([190, 250], 18);
          out.push({ id: 'back', kind: 'back', rect: r[0], label: B.back, key: 'Esc' }, { id: 'ok', kind: 'ok', rect: r[1], label: B.bet, key: 'E', primary: true });
          break;
        }
        case 'pull': {
          const r = row([250, 250], 18);
          out.push({ id: 'back', kind: 'back', rect: r[0], label: this.opts.fixedBet ? B.leave : B.rebet, key: 'Esc' }, { id: 'pull', kind: 'pull', rect: r[1], label: B.pull, key: 'E', primary: true });
          break;
        }
        case 'offer': {
          if (this.canRisk) {
            const r = row([320, 280], 20);
            out.push({ id: 'take', kind: 'take', rect: r[0], label: B.take, sub: fmt(this.amount), sel: this.sel === 0, primary: true }, { id: 'risk', kind: 'risk', rect: r[1], label: B.risk, sel: this.sel === 1 });
          } else {
            const r = row([360], 0);
            out.push({ id: 'take', kind: 'take', rect: r[0], label: B.take, sub: fmt(this.amount), sel: true, primary: true });
          }
          break;
        }
        case 'risk': {
          const r = row([170, 240, 240], 16);
          out.push({ id: 'back', kind: 'back', rect: r[0], label: B.back, key: 'Esc' }, { id: 'red', kind: 'colour', colour: 'red', rect: r[1], label: B.red, sel: this.sel === 0 }, { id: 'black', kind: 'colour', colour: 'black', rect: r[2], label: B.black, sel: this.sel === 1 });
          break;
        }
        default: break;
      }
      return out;
    }

    // ---- действия (клавиши, касания, бот и проверки приходят сюда)
    selectBet(i) {
      if (this.phase !== 'bet' || this.closing || !(i >= 0 && i < this.opts.bets.length)) return 'ignored';
      const was = this.sel; this.sel = i | 0;
      if (was !== this.sel) this._snd('casino_pick', 0.7);
      return 'select';
    }
    placeBet() {
      if (this.phase !== 'bet' || this.closing) return 'ignored';
      this.bet = this.opts.bets[this.sel]; this._snd('casino_bet'); this._enter('pull');
      return 'bet';
    }
    pull() {
      if (this.phase !== 'pull' || this.closing) return 'ignored';
      this.lever.t = 0; this._snd('lever');
      this.spins++;
      const o = this.opts;
      this.outcome = o.jackpot && this.spins === 1 ? jackpotOutcome(o.multiplier) : rollOutcome(Ale.rng, o.multiplier);
      this.winMask = this.outcome.kind === 'crown3' || this.outcome.kind === 'triple' ? [true, true, true] : this.outcome.kind === 'pair' ? pairMask(this.outcome.symbols) : [false, false, false];
      this.spinT = 0; this.stopAt = STOP_AT.slice(); this.tickAcc = 0;
      this.reels.forEach((r, i) => {
        const idx = this.outcome.stops[i], s = STRIPS[i];
        r.mode = 'spin'; r.p0 = r.pos; r.v = 0; r.plan = null; r.t0 = 0; r.landT = -1; r.early = false; r.cell = Math.floor(r.pos);
        r.final = [s[mod(idx - 1, NSTRIP)], s[idx], s[mod(idx + 1, NSTRIP)]];
      });
      this._enter('spin');
      return 'pull';
    }
    // Нажатие во время вращения: ближайший барабан, который ещё крутится сам, остановится раньше (по очереди слева направо; результат от этого не меняется)
    stop() {
      if (this.phase !== 'spin' || this.closing) return 'ignored';
      const j = this.reels.findIndex((r) => r.mode === 'spin' && !r.early);
      if (j < 0) return 'ignored';
      this.reels[j].early = true;
      const prev = j ? this.stopAt[j - 1] : 0;
      this.stopAt[j] = Math.min(this.stopAt[j], Math.max(this.spinT, STOP_MIN, prev + STOP_GAP));
      for (let k = j + 1; k < 3; k++) this.stopAt[k] = Math.max(this.stopAt[k], this.stopAt[k - 1] + STOP_GAP);
      return 'stop';
    }
    take() {
      if (this.phase !== 'offer' || this.closing) return 'ignored';
      this._snd('coin'); this._emit(70, 0.4);
      this.result = this._result();
      this._enter('take');
      return 'take';
    }
    risk() {
      if (this.phase !== 'offer' || this.closing || !this.canRisk) return 'ignored';
      this.sel = 0; this.card = null; this.riskInfo = null;
      this._enter('risk');
      return 'risk';
    }
    // Цвет карты решает Ale.rng в момент выбора (честные 50 на 50); масть и достоинство — косметика (Ale.fxRng)
    pick(colour) {
      if (this.phase !== 'risk' || this.closing || (colour !== 'red' && colour !== 'black')) return 'ignored';
      const actual = riskPick(Ale.rng), R = Ale.fxRng;
      this.riskInfo = { guess: colour, actual };
      this.card = { colour: actual, suit: actual === 'red' ? R.pick(['heart', 'diamond']) : R.pick(['spade', 'club']), rank: R.pick(['A', 'K', 'Q', 'J', '10', '9', '8', '7']) };
      this._snd('card_flip');
      this._enter('flip');
      return 'flip';
    }
    // Назад: в 'bet' — выйти из автомата (фишка остаётся), в 'pull' — к выбору ставки, в 'risk' — к «Забрать / Рискнуть»; в 'offer' — забрать выигрыш (безопасный выбор)
    back() {
      if (this.closing) return 'ignored';
      if (this.phase === 'bet') { this._close(this.cancelResult()); return 'cancel'; }
      if (this.phase === 'pull') {
        if (this.opts.fixedBet) { this._close(this.cancelResult()); return 'cancel'; }                   // единственная ставка: «назад» — отойти от автомата (фишка остаётся)
        this._enter('bet'); return 'bet';
      }
      if (this.phase === 'risk') { this._enterOffer(); return 'offer'; }
      if (this.phase === 'offer') return this.take();
      return 'ignored';
    }
    // Пропуск сообщения (после проигрыша, неудачного риска, сбора выигрыша) — не раньше, чем через 0,8 с
    skip() {
      if (this.closing || this.phaseT < SKIP_AFTER) return 'ignored';
      if (this.phase === 'lose' || this.phase === 'miss') { this._close(this._result()); return 'skip'; }
      if (this.phase === 'take') { this._close(); return 'skip'; }
      if (this.phase === 'hit') { this._enterOffer(); return 'skip'; }
      return 'ignored';
    }
    cancelResult() { return { cancelled: true, bet: 0, amount: 0, risked: 0, rounds: 0, lost: false }; }
    _result() { return { cancelled: false, bet: this.bet, amount: this.amount, risked: this.risked, rounds: this.spins ? 1 + this.risked : 0, lost: this.lost }; }
    _close(result) {
      if (this.closing) return;
      if (result) this.result = result;
      if (!this.result) this.result = this._result();
      this.closing = true; this.closeT = 0;
    }
    _enterOffer() { this.sel = 0; this._enter('offer'); }
    _countTo(to, dur) { this.count = { from: this.shown, to, t: 0, dur }; }

    // ---- монеты (косметика: Ale.fxRng): фонтан из лотка, rate монет в секунду в течение dur секунд
    _emit(rate, dur) { this.coinRate = rate; this.coinFor = dur; this.coinAcc = 0; }
    _coins(n) {
      const R = Ale.fxRng, L = this._lay();
      for (let i = 0; i < n; i++) {
        this.coins.push({ x: L.tray.cx + R.range(-70, 70), y: L.tray.y + 6, vx: R.range(-250, 250), vy: -R.range(480, 860), rot: R.range(0, 6.283), vr: R.range(-10, 10), r: R.range(9, 14), age: 0, life: R.range(1.5, 2.4) });
      }
      if (this.coins.length > MAX_COINS) this.coins.splice(0, this.coins.length - MAX_COINS);
    }

    // ---- ввод
    _readInput() {
      const I = Ale.Input, c = { dir: 0, ok: false, back: false };
      if (I.pressed('left') || I.edge('ArrowLeft') || I.edge('KeyA')) c.dir = -1;
      else if (I.pressed('right') || I.edge('ArrowRight') || I.edge('KeyD')) c.dir = 1;
      c.ok = I.pressed('interact') || I.edge('Enter') || I.edge('Space') || I.edge('KeyE');
      // Esc — «назад» только там, где у него есть смысл (ставка, рычаг, предложение, риск) и ввод уже принимается; в остальное время (вращение, выигрыш, сообщения) и P — это пауза (владелец 12.10.2026)
      const esc = I.edge('Escape') && BACK_PHASES.has(this.phase) && this.phaseT >= GUARD;
      c.back = esc || I.edge('Backspace') || I.edge('KeyN');
      if (esc) I.consume('pause');
      return c;
    }
    _hit(list, p) {
      for (const b of list) { const r = b.rect; if (p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) return b; }
      return null;
    }
    _step(dt) {
      switch (this.phase) {
        case 'bet': this._updBet(); break;
        case 'pull': this._updPull(); break;
        case 'spin': this._updSpin(dt); break;
        case 'win': this._updWin(); break;
        case 'lose': this._updMsg(LOSE_T, () => this._close(this._result())); break;
        case 'offer': this._updOffer(); break;
        case 'risk': this._updRisk(); break;
        case 'flip': this._updFlip(); break;
        case 'hit': this._updMsg(HIT_T, () => this._enterOffer()); break;
        case 'miss': this._updMsg(MISS_T, () => this._close(this._result())); break;
        case 'take': this._updMsg(TAKE_T, () => this._close()); break;
        default: break;
      }
    }
    _navigate(c, n) {
      if (!c.dir) return;
      const s = clamp(this.sel + c.dir, 0, n - 1);
      if (s !== this.sel) { this.sel = s; this._snd('casino_pick', 0.7); }
    }
    _updBet() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      this._navigate(c, this.opts.bets.length);
      if (c.ok) this.placeBet();
      else if (c.back) this.back();
      else if (tp) {
        const b = this._hit(this.buttons(), tp);
        if (!b) return;
        if (b.kind === 'bet') this.selectBet(b.i); else if (b.kind === 'ok') this.placeBet(); else if (b.kind === 'back') this.back();
      }
    }
    _updPull() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      if (c.ok) this.pull();
      else if (c.back) this.back();
      else if (tp) {
        const L = this._lay(), z = L.leverZone;
        if (tp.x >= z.x && tp.x <= z.x + z.w && tp.y >= z.y && tp.y <= z.y + z.h) { this.pull(); return; }
        const b = this._hit(this.buttons(L), tp);
        if (b && b.kind === 'pull') this.pull(); else if (b && b.kind === 'back') this.back();
      }
    }
    _updSpin(dt) {
      this.spinT += dt;
      const t = this.spinT, c = this._ctl;
      if (this.phaseT >= SPIN_GUARD && (c.ok || this._tp)) this.stop();
      let moving = false, lastLand = 0, landed = 0;
      for (let i = 0; i < 3; i++) {
        const r = this.reels[i];
        if (r.mode === 'spin') {
          if (t >= this.stopAt[i] && (i === 0 || this.reels[i - 1].plan)) { r.t0 = this.stopAt[i]; r.plan = planStop(spinPos(r.p0, r.t0)); r.mode = 'stop'; }
          else { r.pos = spinPos(r.p0, t); r.v = spinSpeed(t); moving = true; }
        }
        if (r.mode === 'stop') {
          const s = t - r.t0, pl = r.plan;
          if (s >= pl.T) { r.mode = 'done'; r.pos = pl.p1; r.v = 0; r.landT = r.t0 + pl.T; this._snd('reel_stop'); }
          else { r.pos = stopPos(pl, s); r.v = stopSpeed(pl, s); moving = true; if (Math.floor(r.pos) !== r.cell) { r.cell = Math.floor(r.pos); this._snd('reel_tick', 0.5); } }
        }
        if (r.mode === 'done') { landed++; lastLand = Math.max(lastLand, r.landT); }
      }
      // стук на вращении: не чаще 9 раз в секунду на все барабаны вместе
      if (moving) { this.tickAcc += dt; if (this.tickAcc >= 0.11) { this.tickAcc = 0; this._snd('reel_tick', 0.35); } }
      if (landed === 3 && t >= lastLand + LAND_PAUSE) this._endSpin();
    }
    _endSpin() {
      const o = this.outcome;
      this.lost = false;
      if (o.kind === 'none') {
        this.amount = 0; this.lost = true; this.shown = 0;
        this._snd('casino_lose'); this._enter('lose');
        return;
      }
      this.amount = payout(o.kind, this.bet, this.opts.multiplier);
      this.shown = 0; this._countTo(this.amount, COUNT_T);
      this._enter('win');
      const big = o.kind === 'crown3';
      this._snd(big ? 'jackpot' : 'casino_win');
      this._emit(big ? 55 : 16, big ? 1.6 : 0.7);
    }
    _updWin() {
      if (this.phaseT >= (this.outcome && this.outcome.kind === 'crown3' ? WIN_T : WIN_SMALL_T)) this._enterOffer();
    }
    _updMsg(dur, then) {
      if (this.phaseT >= dur) { then(); return; }
      if (this.phaseT >= SKIP_AFTER && (this._ctl.ok || this._ctl.back || this._tp)) this.skip();
    }
    _updOffer() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      if (this.canRisk) this._navigate(c, 2);
      if (c.ok) { if (this.sel === 1 && this.canRisk) this.risk(); else this.take(); }
      else if (c.back) this.take();
      else if (tp) {
        const b = this._hit(this.buttons(), tp);
        if (b && b.kind === 'take') this.take(); else if (b && b.kind === 'risk') this.risk();
      }
    }
    _updRisk() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      this._navigate(c, 2);
      if (c.ok) this.pick(this.sel === 0 ? 'red' : 'black');
      else if (c.back) this.back();
      else if (tp) {
        const b = this._hit(this.buttons(), tp);
        if (b && b.kind === 'colour') { this.sel = b.colour === 'red' ? 0 : 1; this.pick(b.colour); } else if (b && b.kind === 'back') this.back();
      }
    }
    _updFlip() {
      if (this.phaseT < FLIP_T) return;
      const r = riskSettle(this.riskInfo.guess, this.riskInfo.actual, this.amount, this.bet);
      this.risked++;
      this.riskInfo.win = r.win;
      if (r.win) {
        this.amount = r.amount; this._countTo(this.amount, COUNT_T * 0.8);
        this._enter('hit'); this._snd('casino_win'); this._emit(45, 0.6);
      } else {
        this.lost = true; this.amount = r.amount; this._countTo(this.amount, 1.0);
        this._enter('miss'); this._snd('casino_lose');
      }
    }

    // ---- каждый кадр
    update(dt) {
      this.t += dt; this.phaseT += dt;
      const UI = Ale.UI, tp = UI.tapPoint; UI.tapPoint = null; this._tp = tp;
      if (this.closing) { this.closeT += dt; this.fade = 1 - clamp(this.closeT / CLOSE_FADE, 0, 1); if (this.closeT >= CLOSE_FADE) this.done = true; }
      else this.fade = clamp(this.t / 0.4, 0, 1);
      this._ctl = this.closing ? NOCTL : this._readInput();
      if (!this.closing) this._step(dt);
      // анимации, которые идут всегда
      if (this.count) {
        const c = this.count; c.t += dt;
        const u = clamp(c.t / c.dur, 0, 1);
        this.shown = Math.round(lerp(c.from, c.to, EASE.outCubic(u)));
        this.coinSnd -= dt;
        if (u < 1 && this.coinSnd <= 0 && c.to > c.from) { this.coinSnd = 0.13; this._snd('coin', 0.45); }
        if (u >= 1) { this.shown = c.to; this.count = null; }
      }
      if (this.lever.t >= 0) { this.lever.t += dt; if (this.lever.t > 1.0) this.lever.t = -1; }
      const showTable = this.phase === 'risk' || this.phase === 'flip' || this.phase === 'hit' || this.phase === 'miss';
      this.table = clamp(this.table + (showTable ? dt : -dt) / TABLE_T, 0, 1);
      this.rays = clamp(this.rays + (this.lightMode() === 'party' ? dt : -dt) / 0.5, 0, 1);               // лучи за автоматом только в «ДЖЕКПОТЕ»
      if (this.coinFor > 0) {
        const d = Math.min(dt, this.coinFor); this.coinFor -= dt; this.coinAcc += d * this.coinRate;
        const n = Math.floor(this.coinAcc); this.coinAcc -= n; if (n) this._coins(n);
      }
      for (const p of this.coins) { p.age += dt; p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      this.coins = this.coins.filter((p) => p.age < p.life && p.y < 800);
      const ck = this.captionKey(); if (ck !== this.capKey) { this.capKey = ck; this.capT = this.t; }
    }

    // Крупная подпись над автоматом по фазе
    captionKey() {
      switch (this.phase) {
        case 'win': return this.outcome && this.outcome.kind === 'crown3' ? 'jackpot' : 'win';
        case 'offer': return this.canRisk ? 'offer' : 'offerMax';
        default: return this.phase;
      }
    }
    leverK() {
      const t = this.lever.t;
      if (t < 0) return 0;
      if (t < 0.22) return EASE.inQuad(t / 0.22);
      if (t < 0.34) return 1;
      if (t < 0.9) return Math.max(0, 1 - EASE.outCubic((t - 0.34) / 0.56));
      return 0;
    }
    // Свет по краю автомата: вращение — бегущие огни, джекпот — частая «бегущая» смена (отдельные лампочки, без вспышек на весь экран), остальное — медленно
    lightMode() {
      if (this.phase === 'win' && this.outcome && this.outcome.kind === 'crown3') return 'party';
      if (this.phase === 'spin' || this.phase === 'win' || this.phase === 'hit' || this.phase === 'take') return 'chase';
      return 'idle';
    }
  }
  function pairMask(symbols) {
    const m = [false, false, false];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (symbols[i] === symbols[j]) { m[i] = true; m[j] = true; }
    return m;
  }
  function centeredRow(cx, y, h, widths, gap) {
    const tot = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let x = Math.round(cx - tot / 2);
    return widths.map((w) => { const r = { x, y, w, h }; x += w + gap; return r; });
  }

  // ================================================================== РАСКЛАДКА
  // Кадр 720 по высоте, ширина 1000…1700: автомат по центру (корпус 600…680 шириной, 436 высотой), рычаг справа от корпуса, ниже — ряд ставок или сообщение, ряд кнопок и строка подсказки.
  let LCACHE = null;
  function perimeterPoints(x, y, w, h, r, n) {
    const top = w - 2 * r, side = h - 2 * r, arc = Math.PI * r / 2, P = 2 * top + 2 * side + 4 * arc, out = [];
    for (let i = 0; i < n; i++) {
      let s = i * P / n, px, py;
      if (s < top) { px = x + r + s; py = y; }
      else if ((s -= top) < arc) { const a = -Math.PI / 2 + s / r; px = x + w - r + Math.cos(a) * r; py = y + r + Math.sin(a) * r; }
      else if ((s -= arc) < side) { px = x + w; py = y + r + s; }
      else if ((s -= side) < arc) { const a = s / r; px = x + w - r + Math.cos(a) * r; py = y + h - r + Math.sin(a) * r; }
      else if ((s -= arc) < top) { px = x + w - r - s; py = y + h; }
      else if ((s -= top) < arc) { const a = Math.PI / 2 + s / r; px = x + r + Math.cos(a) * r; py = y + h - r + Math.sin(a) * r; }
      else if ((s -= arc) < side) { px = x; py = y + h - r - s; }
      else { s -= side; const a = Math.PI + s / r; px = x + r + Math.cos(a) * r; py = y + r + Math.sin(a) * r; }
      out.push({ x: px, y: py });
    }
    return out;
  }
  function layout(W, H, nBets) {
    nBets = clamp(nBets || 3, 1, 4);
    if (LCACHE && LCACHE.W === W && LCACHE.H === H && LCACHE.n === nBets) return LCACHE;
    const cx = Math.round(W / 2);
    const cabW = clamp(W - 340, 600, 680), cabX = Math.round(cx - cabW / 2), cabY = 72, cabH = 436;
    const L = { W, H, n: nBets, cx, btnH: 60 };
    L.cab = { x: cabX, y: cabY, w: cabW, h: cabH };
    const inX = cabX + 36, inW = cabW - 72;
    L.inner = { x: inX, y: cabY + 32, w: inW, h: cabH - 64 };
    L.header = { x: inX + 70, y: cabY + 32, w: inW - 140, h: 44 };
    const dw = Math.floor((inW - 14) / 2);
    L.dispBet = { x: inX, y: cabY + 84, w: dw, h: 52 };
    L.dispWin = { x: inX + inW - dw, y: cabY + 84, w: dw, h: 52 };
    L.window = { x: inX, y: cabY + 144, w: inW, h: 192 };
    const pad = 14, gap = 12, rw = Math.min(176, Math.floor((inW - 2 * pad - 2 * gap) / 3)), rh = L.window.h - 2 * pad, groupW = 3 * rw + 2 * gap;
    L.reels = [0, 1, 2].map((i) => ({ x: Math.round(cx - groupW / 2 + i * (rw + gap)), y: L.window.y + pad, w: rw, h: rh }));
    L.cell = 88;
    L.deck = { x: inX, y: cabY + 344, w: inW, h: 56 };
    L.slot = { cx: inX + 38, cy: L.deck.y + 28, r: 27 };
    L.tray = { x: inX + 84, y: L.deck.y + 6, w: inW - 84 - 10, h: 44, cx: Math.round(inX + 84 + (inW - 94) / 2) };
    L.bulbs = perimeterPoints(cabX + 17, cabY + 17, cabW - 34, cabH - 34, 26, Math.round((2 * (cabW - 94) + 2 * (cabH - 94) + 2 * Math.PI * 26) / 27));
    // рычаг: ось справа от корпуса, шар на конце стержня (в покое вверху, при рывке уходит вниз)
    L.lever = { px: cabX + cabW + 30, py: cabY + 250, len: 128 };
    L.leverZone = { x: cabX + cabW, y: L.lever.py - L.lever.len - 30, w: 74, h: L.lever.len + 30 + 70 };
    // нижняя часть: ряд A (ставки или сообщение), ряд B (кнопки), строка подсказки
    L.rowA = 526; L.rowB = 604; L.legendY = 692; L.caption = { x: cx - 280, y: 4, w: 560, h: 60 };
    L.betRects = (() => {
      const bw = Math.min(156, Math.floor((W - 160 - (nBets - 1) * 16) / nBets)), tot = nBets * bw + (nBets - 1) * 16, x0 = Math.round(cx - tot / 2);
      return Array.from({ length: nBets }, (_, i) => ({ x: x0 + i * (bw + 16), y: 524, w: bw, h: 66 }));
    })();
    LCACHE = L;
    return L;
  }

  // ================================================================== РИСОВАНИЕ
  const OUT = '#3a2431', CREAM = '#fff6e4', INK = '#3a2431';
  const font = (w, s) => w + ' ' + s + 'px ' + Ale.FONT;
  const fitFont = (ctx, text, weight, size, maxW, minSize) => { let s = size; ctx.font = font(weight, s); while (s > minSize && ctx.measureText(text).width > maxW) { s--; ctx.font = font(weight, s); } return s; };
  function outlined(ctx, text, x, y, fill, w) { ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const s of stops) gr.addColorStop(s[0], s[1]); return gr; };
  const rad = (g, x, y, r0, r1, stops, ox, oy) => { const gr = g.createRadialGradient(x + (ox || 0), y + (oy || 0), r0, x, y, r1); for (const s of stops) gr.addColorStop(s[0], s[1]); return gr; };
  const inkFill = (g, fill, w) => { g.fillStyle = fill; g.fill(); g.lineWidth = w; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  const TAU = Math.PI * 2;

  // ---- символы и карточные масти: рисуются в «шаблоне» 100×100 (начало в центре, y вниз), один раз в картинку на символ
  const PAINT = {
    cherry(g) {
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-14, 8); g.quadraticCurveTo(-14, -24, 10, -36); g.moveTo(20, 14); g.quadraticCurveTo(20, -14, 10, -36);
      g.lineWidth = 10; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 4.4; g.strokeStyle = '#6cbf4e'; g.stroke();
      g.beginPath(); g.moveTo(10, -36); g.bezierCurveTo(16, -50, 34, -50, 40, -40); g.bezierCurveTo(32, -30, 18, -28, 10, -36); g.closePath();
      inkFill(g, lin(g, 10, -50, 40, -28, [[0, '#a8e070'], [1, '#4f9e3c']]), 4);
      g.beginPath(); g.moveTo(14, -37); g.quadraticCurveTo(24, -42, 34, -40); g.lineWidth = 2; g.strokeStyle = 'rgba(40,90,40,0.7)'; g.stroke();
      for (const c of [[-15, 22, 19], [22, 28, 18]]) {
        g.beginPath(); g.arc(c[0], c[1], c[2], 0, TAU);
        inkFill(g, rad(g, c[0], c[1], 2, c[2] * 1.25, [[0, '#ff7a6a'], [0.55, '#dc2f3a'], [1, '#a31528']], -6, -7), 4.6);
        g.beginPath(); g.ellipse(c[0] - 7, c[1] - 8, 5.5, 3.4, -0.7, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
      }
    },
    lemon(g) {
      g.rotate(-0.32);
      for (const x of [-38, 38]) { g.beginPath(); g.arc(x, 0, 5.5, 0, TAU); inkFill(g, '#f0c52c', 4); }
      g.beginPath(); g.moveTo(-38, 0); g.bezierCurveTo(-30, -31, 30, -31, 38, 0); g.bezierCurveTo(30, 31, -30, 31, -38, 0); g.closePath();
      inkFill(g, lin(g, 0, -26, 0, 26, [[0, '#fff6a8'], [0.5, '#f8da3e'], [1, '#d9a51c']]), 5);
      g.beginPath(); g.ellipse(-12, -11, 11, 4.2, -0.15, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
      g.fillStyle = 'rgba(160,110,10,0.35)';
      for (const p of [[8, 6], [18, -4], [-6, 10], [2, -2], [22, 8]]) { g.beginPath(); g.arc(p[0], p[1], 1.4, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(6, -21); g.bezierCurveTo(8, -40, 26, -44, 34, -38); g.bezierCurveTo(30, -28, 16, -22, 6, -21); g.closePath();
      inkFill(g, lin(g, 6, -44, 34, -22, [[0, '#a8e070'], [1, '#4f9e3c']]), 4);
    },
    bell(g) {
      g.beginPath(); g.arc(0, 34, 7.5, 0, TAU); inkFill(g, lin(g, 0, 28, 0, 42, [[0, '#f4c84a'], [1, '#a9731f']]), 4);
      g.beginPath(); g.moveTo(-25, 24); g.bezierCurveTo(-25, 0, -30, -30, 0, -31); g.bezierCurveTo(30, -30, 25, 0, 25, 24); g.bezierCurveTo(25, 27, 36, 27, 36, 32); g.lineTo(-36, 32); g.bezierCurveTo(-36, 27, -25, 27, -25, 24); g.closePath();
      inkFill(g, lin(g, -36, 0, 36, 0, [[0, '#fff0b0'], [0.35, '#f4c84a'], [1, '#a9731f']]), 5);
      g.beginPath(); g.arc(0, -36, 5.5, 0, TAU); inkFill(g, '#f4c84a', 4);
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-16, -14); g.quadraticCurveTo(-19, 4, -17, 16); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
      g.beginPath(); g.moveTo(-26, 25); g.quadraticCurveTo(0, 30, 26, 25); g.lineWidth = 2.4; g.strokeStyle = 'rgba(120,70,10,0.55)'; g.stroke();
    },
    star(g) {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18.5 : 42, x = Math.cos(a) * r, y = 3 + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath();
      inkFill(g, lin(g, 0, -40, 0, 44, [[0, '#fff4a6'], [0.5, '#ffc93a'], [1, '#ec8a1c']]), 5);
      g.beginPath(); g.moveTo(-5, -26); g.lineTo(-13, -4); g.lineWidth = 3.2; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
    },
    seven(g) {
      const path = () => { g.beginPath(); g.moveTo(-28, -34); g.lineTo(30, -34); g.lineTo(30, -20); g.lineTo(4, 38); g.lineTo(-15, 38); g.lineTo(9, -18); g.lineTo(-28, -18); g.closePath(); };
      g.save(); g.translate(3.5, 4.5); path(); inkFill(g, '#7c1822', 5); g.restore();
      path(); inkFill(g, lin(g, 0, -34, 0, 38, [[0, '#ff8068'], [0.5, '#e23c30'], [1, '#b02420']]), 5);
      g.beginPath(); g.moveTo(-23, -28); g.lineTo(24, -28); g.lineWidth = 3.4; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke();
    },
    crown(g) {
      g.beginPath(); g.moveTo(-36, 22); g.lineTo(-42, -16); g.lineTo(-20, 2); g.lineTo(0, -32); g.lineTo(20, 2); g.lineTo(42, -16); g.lineTo(36, 22); g.closePath();
      inkFill(g, lin(g, 0, -32, 0, 24, [[0, '#fff3b8'], [0.5, '#f4c84a'], [1, '#c48a2a']]), 5);
      for (const p of [[-42, -17, 6], [0, -33, 6.6], [42, -17, 6]]) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); inkFill(g, '#f8d65a', 3.6); }
      Ale.rr(g, -37, 14, 74, 17, 5); inkFill(g, lin(g, 0, 14, 0, 31, [[0, '#f4c84a'], [1, '#a9731f']]), 4.4);
      for (const p of [[-20, 22.5, 4.6, '#e8473c'], [0, 22.5, 5.6, '#3c8fe8'], [20, 22.5, 4.6, '#e8473c']]) {
        g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); inkFill(g, p[3], 2.6);
        g.beginPath(); g.arc(p[0] - 1.4, p[1] - 1.6, p[2] * 0.3, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
      }
      g.beginPath(); g.moveTo(-28, 10); g.lineTo(-31, -6); g.lineWidth = 3.4; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
    },
  };
  // Фишка казино «Монако» (та же, что предмет в Париже): красная, с белыми метками по ободу и золотой короной
  function paintChip(g) {
    const R = 26;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); inkFill(g, rad(g, 0, 0, 2, R, [[0, '#e04a3c'], [0.7, '#c8322a'], [1, '#8f1d18']], -7, -8), 2);
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.fillStyle = '#fff6e4'; g.fillRect(-4.2, -R - 1, 8.4, 9); g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1; g.strokeRect(-4.2, -R - 1, 8.4, 9); g.restore(); }
    g.restore();
    g.strokeStyle = '#fff6e4'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 16.4, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(80,10,10,0.35)'; g.beginPath(); g.arc(0, 0, 15.6, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-9.5, 5.6); g.lineTo(-10.5, -5); g.lineTo(-5, 0); g.lineTo(0, -8); g.lineTo(5, 0); g.lineTo(10.5, -5); g.lineTo(9.5, 5.6); g.closePath();
    inkFill(g, lin(g, 0, -8, 0, 6, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']]), 1.2);
    g.fillStyle = '#e4b73a'; g.fillRect(-9.5, 5.6, 19, 2.6); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(-9.5, 5.6, 19, 2.6);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, R - 3, 3.4, 4.5); g.stroke();
  }
  // Масти: общий контур у объединения форм (сначала толстая обводка всех частей, потом заливка — без линий внутри)
  const SUITS = {
    heart: { paths: [(g) => { g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-46, 2, -32, -36, 0, -13); g.bezierCurveTo(32, -36, 46, 2, 0, 30); g.closePath(); }], color: '#d9342b' },
    diamond: { paths: [(g) => { g.beginPath(); g.moveTo(0, -36); g.lineTo(25, 0); g.lineTo(0, 36); g.lineTo(-25, 0); g.closePath(); }], color: '#d9342b' },
    spade: { paths: [(g) => { g.beginPath(); g.moveTo(0, -36); g.bezierCurveTo(-48, 0, -30, 30, 0, 12); g.bezierCurveTo(30, 30, 48, 0, 0, -36); g.closePath(); }, (g) => { g.beginPath(); g.moveTo(-11, 38); g.lineTo(0, 8); g.lineTo(11, 38); g.closePath(); }], color: '#2b1f33' },
    club: { paths: [(g) => { g.beginPath(); g.arc(0, -14, 15, 0, TAU); }, (g) => { g.beginPath(); g.arc(-17, 11, 15, 0, TAU); }, (g) => { g.beginPath(); g.arc(17, 11, 15, 0, TAU); }, (g) => { g.beginPath(); g.moveTo(-10, 38); g.lineTo(0, 4); g.lineTo(10, 38); g.closePath(); }], color: '#2b1f33' },
  };
  function paintSuit(g, name) {
    const s = SUITS[name];
    g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = OUT;
    for (const p of s.paths) { p(g); g.stroke(); }
    g.fillStyle = s.color;
    for (const p of s.paths) { p(g); g.fill(); }
    g.beginPath(); g.ellipse(-10, -4, 4, 8, 0.5, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill();
  }

  const SPR = {};
  function sprite(name) {
    if (SPR[name]) return SPR[name];
    const S = 224, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d'); g.translate(S / 2, S / 2); g.scale(S / 112, S / 112);
    PAINT[name](g);
    return (SPR[name] = cv);
  }
  // Символ в центре (x, y) размером size; sy — растяжение по вертикали (размытие движения), alpha — прозрачность
  function drawSym(ctx, name, x, y, size, alpha, sy) {
    const s = sprite(name), h = size * (sy || 1);
    ctx.save(); if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s, x - size / 2, y - h / 2, size, h);
    ctx.restore();
  }
  // Любой символ напрямую контурами (для значков, не для барабанов): масштаб size / 100
  function drawVector(ctx, paint, x, y, size) { ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100); paint(ctx); ctx.restore(); }

  // Приглушённая игра за автоматом: тёмная тёплая подложка, мягкое пятно света и несколько медленных огоньков зала
  const BOKEH = [[0.08, 0.2, 46, 0], [0.16, 0.74, 30, 1], [0.27, 0.38, 22, 2], [0.9, 0.18, 40, 3], [0.84, 0.66, 52, 4], [0.7, 0.84, 24, 5], [0.05, 0.52, 58, 6], [0.95, 0.42, 26, 7], [0.32, 0.9, 34, 8], [0.62, 0.1, 20, 9]];
  function drawBackdrop(ctx, S, W, H) {
    const f = S.fade;
    ctx.fillStyle = 'rgba(22,6,20,' + (0.88 * f).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(255,170,96,' + (0.34 * f).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(196,58,84,' + (0.14 * f).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,30,70,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const b of BOKEH) {
      const a = (0.05 + 0.04 * Math.sin(S.t * 0.8 + b[3] * 1.7)) * f, x = b[0] * W, y = b[1] * H;
      const bg = ctx.createRadialGradient(x, y, 0, x, y, b[2]); bg.addColorStop(0, 'rgba(255,214,140,' + a.toFixed(3) + ')'); bg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = bg; ctx.fillRect(x - b[2], y - b[2], b[2] * 2, b[2] * 2);
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.max(W, H) * 0.74);
    v.addColorStop(0, 'rgba(8,2,10,0)'); v.addColorStop(1, 'rgba(8,2,10,' + (0.55 * f).toFixed(3) + ')');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // полоса сверху чуть темнее: полоска сердец и счётчики игры не должны просвечивать сквозь подпись
    const top = ctx.createLinearGradient(0, 0, 0, 170);
    top.addColorStop(0, 'rgba(14,5,14,' + (0.98 * f).toFixed(3) + ')'); top.addColorStop(0.75, 'rgba(14,5,14,' + (0.95 * f).toFixed(3) + ')'); top.addColorStop(1, 'rgba(14,5,14,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 170);
  }

  function drawCaption(ctx, S, L, T) {
    const key = S.capKey || S.captionKey(), text = T.caption[key] || '', big = key === 'jackpot', calm = key === 'lose' || key === 'miss';
    const size = big ? 56 : key === 'win' || key === 'hit' ? 44 : 38;
    const k = EASE.outBack(clamp((S.t - S.capT) / 0.35, 0, 1)), sc = (big ? 0.5 : 0.88) + (big ? 0.5 : 0.12) * k;
    ctx.save(); ctx.translate(L.cx, big ? 40 : 35); ctx.scale(sc, sc);
    if (big) ctx.rotate(Math.sin(S.t * 3) * 0.018);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, text, 'bold', size, L.W - 60, 22);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    if (calm) { g.addColorStop(0, '#fff3e0'); g.addColorStop(1, '#ffb8a0'); } else { g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffc35e'); }
    outlined(ctx, text, 0, 2, g, big ? 12 : 9);
    ctx.restore();
  }

  // Расходящиеся лучи за автоматом (только пока горит «ДЖЕКПОТ!»): медленно вращаются, без вспышек
  function drawRays(ctx, S, L) {
    if (S.rays <= 0) return;
    const cx = L.cx, cy = L.window.y + L.window.h / 2, R = Math.max(L.W, 720) * 0.9, n = 16, a0 = S.t * 0.22;
    ctx.save(); ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(0, 0, 40, 0, 0, R);
    g.addColorStop(0, 'rgba(255,214,120,' + (0.13 * S.rays).toFixed(3) + ')'); g.addColorStop(0.75, 'rgba(255,214,120,' + (0.04 * S.rays).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n, w = TAU / n * 0.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * R, Math.sin(a - w) * R); ctx.lineTo(Math.cos(a + w) * R, Math.sin(a + w) * R); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function drawCabinet(ctx, S, L) {
    const c = L.cab;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; Ale.rr(ctx, c.x + 6, c.y + 14, c.w, c.h, 42); ctx.fill();
    // кронштейн рычага
    const lv = L.lever;
    Ale.rr(ctx, c.x + c.w - 14, lv.py - 24, lv.px - (c.x + c.w) + 28, 48, 14); ctx.fillStyle = lin(ctx, 0, lv.py - 24, 0, lv.py + 24, [[0, '#d9d2dc'], [1, '#7a7083']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    // корпус
    const g = ctx.createLinearGradient(c.x, 0, c.x + c.w, 0);
    g.addColorStop(0, '#8c1d2c'); g.addColorStop(0.16, '#c63f3d'); g.addColorStop(0.5, '#e0574c'); g.addColorStop(0.84, '#c63f3d'); g.addColorStop(1, '#8c1d2c');
    Ale.rr(ctx, c.x, c.y, c.w, c.h, 42); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
    // золотая окантовка и дорожка для лампочек
    Ale.rr(ctx, c.x + 8, c.y + 8, c.w - 16, c.h - 16, 36); ctx.lineWidth = 5; ctx.strokeStyle = lin(ctx, 0, c.y, 0, c.y + c.h, [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']]); ctx.stroke();
    Ale.rr(ctx, c.x + 12, c.y + 12, c.w - 24, c.h - 24, 32); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(58,36,49,0.8)'; ctx.stroke();
    // блик слева сверху
    ctx.save(); Ale.rr(ctx, c.x + 3, c.y + 3, c.w - 6, c.h - 6, 40); ctx.clip();
    const sh = ctx.createLinearGradient(0, c.y, 0, c.y + 110); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(c.x, c.y, c.w, 110); ctx.restore();
  }

  function drawBulbs(ctx, S, L) {
    const mode = S.lightMode(), rate = mode === 'party' ? 9 : mode === 'chase' ? 5 : 2.2, step = Math.floor(S.t * rate), n = L.bulbs.length;
    ctx.lineWidth = 1.6; ctx.strokeStyle = OUT;
    for (let i = 0; i < n; i++) {
      const b = L.bulbs[i], lit = mode === 'party' ? (i + step) % 3 === 0 : mode === 'chase' ? (i + step) % 4 < 2 : (i + step) % 6 === 0;
      if (lit) { ctx.fillStyle = 'rgba(255,214,102,0.30)'; ctx.beginPath(); ctx.arc(b.x, b.y, 11, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(b.x, b.y, 5.2, 0, TAU); ctx.fillStyle = lit ? '#fff4b8' : '#a06a3a'; ctx.fill(); ctx.stroke();
      if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(b.x - 1.4, b.y - 1.5, 1.6, 0, TAU); ctx.fill(); }
    }
  }

  function drawHeader(ctx, S, L, T) {
    const h = L.header;
    Ale.rr(ctx, h.x, h.y, h.w, h.h, 14); ctx.fillStyle = lin(ctx, 0, h.y, 0, h.y + h.h, [[0, '#fff0b0'], [0.5, '#f4c84a'], [1, '#c48a2a']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, h.x + 5, h.y + 5, h.w - 10, h.h - 10, 10); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(58,36,49,0.45)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, T.name, 'bold', 28, h.w - 150, 16);
    const tw = ctx.measureText(T.name).width, cx = h.x + h.w / 2;
    ctx.fillStyle = INK; ctx.fillText(T.name, cx, h.y + h.h / 2 + 2);
    drawVector(ctx, PAINT.crown, cx - tw / 2 - 34, h.y + h.h / 2 - 2, 46);
    drawVector(ctx, PAINT.crown, cx + tw / 2 + 34, h.y + h.h / 2 - 2, 46);
  }

  function drawDisplay(ctx, S, r, label, value, hot) {
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#2a1630'], [1, '#120a18']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 10); ctx.lineWidth = 2; ctx.strokeStyle = hot ? 'rgba(255,214,102,0.9)' : 'rgba(240,200,90,0.45)'; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = font('bold', 15); ctx.fillStyle = 'rgba(255,224,150,0.85)'; ctx.fillText(label, r.x + 16, r.y + r.h / 2);
    ctx.textAlign = 'right';
    const lw = ctx.measureText(label).width;
    fitFont(ctx, value, 'bold', 32, r.w - 40 - lw, 16);
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,170,40,0.22)'; ctx.strokeText(value, r.x + r.w - 16, r.y + r.h / 2 + 1);
    ctx.fillStyle = hot ? '#fff0a8' : '#ffc85a'; ctx.fillText(value, r.x + r.w - 16, r.y + r.h / 2 + 1);
  }
  function drawDisplays(ctx, S, L, T) {
    const betShown = S.phase === 'bet' ? S.opts.bets[S.sel] : S.bet;
    drawDisplay(ctx, S, L.dispBet, T.labels.bet, betShown ? fmt(betShown) : fmt(0), S.phase === 'bet');
    drawDisplay(ctx, S, L.dispWin, T.labels.win, fmt(S.shown), S.phase === 'win' || S.phase === 'hit');
  }

  // Окно с тремя барабанами
  function drawReel(ctx, S, L, i) {
    const r = L.reels[i], R = S.reels[i], cell = L.cell, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save();
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#cdbb98'], [0.5, '#fff8e8'], [1, '#cdbb98']]); ctx.fillRect(r.x, r.y, r.w, r.h);
    const landedFor = R.mode === 'done' && R.landT >= 0 ? S.spinT - R.landT : -1, pos = R.pos + (landedFor >= 0 ? bounceOff(landedFor) : 0);
    const v = Math.abs(R.v), b = clamp((v - 3.5) / 8, 0, 1), size = cell * 0.9;
    const winNow = (S.phase === 'win' || S.phase === 'offer' || S.phase === 'take') && S.winMask[i];
    if (winNow) {
      const a = 0.38 + 0.22 * Math.sin(S.t * 7), g = ctx.createRadialGradient(cx, cy, 6, cx, cy, cell * 0.78);
      g.addColorStop(0, 'rgba(255,226,120,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,226,120,0)'); ctx.fillStyle = g; ctx.fillRect(r.x, cy - cell, r.w, cell * 2);
    }
    const k0 = Math.floor(pos - 1.7), k1 = Math.ceil(pos + 1.7);
    for (let k = k0; k <= k1; k++) {
      const y = cy + (pos - k) * cell, name = S.symAt(i, k);
      if (b > 0.05) { drawSym(ctx, name, cx, y - cell * 0.2 * b, size, 0.3 * b, 1.1); drawSym(ctx, name, cx, y + cell * 0.2 * b, size, 0.3 * b, 1.1); }
      const pulse = winNow && k === Math.round(pos) ? 1 + 0.07 * Math.sin(S.t * 8) : 1;
      drawSym(ctx, name, cx, y, size * pulse, 1 - 0.3 * b, 1 + 0.4 * b);
    }
    // цилиндр: тени у верхнего и нижнего края
    const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    sh.addColorStop(0, 'rgba(40,14,30,0.62)'); sh.addColorStop(0.3, 'rgba(40,14,30,0)'); sh.addColorStop(0.7, 'rgba(40,14,30,0)'); sh.addColorStop(1, 'rgba(40,14,30,0.62)');
    ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(r.x + 8, r.y, 6, r.h);
    ctx.restore();
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  }
  function drawWindowFrame(ctx, S, L) {
    const w = L.window;
    Ale.rr(ctx, w.x, w.y, w.w, w.h, 18); ctx.fillStyle = lin(ctx, 0, w.y, 0, w.y + w.h, [[0, '#3a1a2c'], [1, '#1c0c18']]); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, w.x + 4, w.y + 4, w.w - 8, w.h - 8, 14); ctx.lineWidth = 2.5; ctx.strokeStyle = lin(ctx, 0, w.y, 0, w.y + w.h, [[0, '#fff0b0'], [1, '#b8862a']]); ctx.stroke();
  }
  function drawPayline(ctx, S, L) {
    const w = L.window, y = w.y + w.h / 2, win = (S.phase === 'win' || S.phase === 'offer') && S.outcome && S.outcome.kind !== 'none';
    const a = win ? 0.75 + 0.25 * Math.sin(S.t * 8) : 0.7;
    ctx.save(); ctx.lineCap = 'round';
    ctx.lineWidth = win ? 9 : 7; ctx.strokeStyle = 'rgba(58,36,49,0.55)'; ctx.beginPath(); ctx.moveTo(w.x + 20, y); ctx.lineTo(w.x + w.w - 20, y); ctx.stroke();
    ctx.lineWidth = win ? 4.5 : 3; ctx.strokeStyle = win ? 'rgba(255,226,120,' + a.toFixed(3) + ')' : 'rgba(235,70,60,' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(w.x + 20, y); ctx.lineTo(w.x + w.w - 20, y); ctx.stroke();
    for (const s of [-1, 1]) {
      const x = s < 0 ? w.x + 6 : w.x + w.w - 6;
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x - s * 12, y); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fillStyle = win ? '#ffe27a' : '#eb463c'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    }
    ctx.restore();
  }

  // Карта риска: рубашка с короной и лицо с мастью; поворот вокруг вертикальной оси
  function drawCard(ctx, S, cx, cy, cw, ch, face, angle) {
    const sx = Math.abs(Math.cos(angle)), showFace = face && angle > Math.PI / 2;
    ctx.save(); ctx.translate(cx, cy - Math.sin(angle) * 12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, ch / 2 + 12 + Math.sin(angle) * 10, cw / 2 * sx * 0.9, 9, 0, 0, TAU); ctx.fill();
    ctx.scale(Math.max(0.02, sx), 1);
    Ale.rr(ctx, -cw / 2, -ch / 2, cw, ch, 12);
    if (showFace) {
      ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      const col = SUITS[face.suit].color;
      drawVector(ctx, (g) => paintSuit(g, face.suit), 0, 4, cw * 0.62);
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font('bold', 24);
      ctx.fillText(face.rank, -cw / 2 + 20, -ch / 2 + 24); ctx.fillText(face.rank, cw / 2 - 20, ch / 2 - 22);
    } else {
      ctx.fillStyle = lin(ctx, 0, -ch / 2, 0, ch / 2, [[0, '#b53a46'], [1, '#7a1d30']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.save(); Ale.rr(ctx, -cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 8); ctx.clip();
      ctx.strokeStyle = 'rgba(255,224,150,0.38)'; ctx.lineWidth = 2;
      for (let d = -ch; d < cw + ch; d += 18) { ctx.beginPath(); ctx.moveTo(-cw / 2 + d, -ch / 2); ctx.lineTo(-cw / 2 + d - ch, ch / 2); ctx.moveTo(-cw / 2 + d - ch, -ch / 2); ctx.lineTo(-cw / 2 + d, ch / 2); ctx.stroke(); }
      ctx.restore();
      Ale.rr(ctx, -cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 8); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,224,150,0.8)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fillStyle = '#7a1d30'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,150,0.85)'; ctx.stroke();
      drawVector(ctx, PAINT.crown, 0, 0, 42);
    }
    ctx.restore();
  }
  function drawTable(ctx, S, L, T, k) {
    const w = L.window, cx = w.x + w.w / 2, cy = w.y + w.h / 2;
    ctx.save(); ctx.globalAlpha *= k;
    Ale.rr(ctx, w.x + 10, w.y + 10, w.w - 20, w.h - 20, 14); ctx.fillStyle = rad(ctx, cx, cy, 10, w.w * 0.5, [[0, '#3a9a6c'], [1, '#1c5a40']]); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, w.x + 18, w.y + 18, w.w - 36, w.h - 36, 10); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.5)'; ctx.stroke();
    // значки цветов по бокам: красный ромб и чёрная пика (выбранный подсвечен)
    const sel = S.phase === 'risk' ? (S.sel === 0 ? 'red' : 'black') : S.riskInfo ? S.riskInfo.guess : '';
    for (const c of [['red', w.x + 80, 'diamond'], ['black', w.x + w.w - 80, 'spade']]) {
      const on = sel === c[0];
      ctx.beginPath(); ctx.arc(c[1], cy, 40, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.16)'; ctx.fill();
      if (on) { ctx.beginPath(); ctx.arc(c[1], cy, 44 + 3 * Math.sin(S.t * 6), 0, TAU); ctx.fillStyle = 'rgba(255,224,150,0.3)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd45e'; ctx.stroke(); }
      drawVector(ctx, (g) => paintSuit(g, c[2]), c[1], cy, on ? 52 : 44);
    }
    // карта
    const ci = S.card, cw = 100, ch = 140;
    let angle = 0;
    if (S.phase === 'flip') angle = Math.PI * EASE.inOutQuad(clamp(S.phaseT / FLIP_T, 0, 1));
    else if (S.phase === 'hit' || S.phase === 'miss') angle = Math.PI;
    const bob = S.phase === 'risk' ? Math.sin(S.t * 2.4) * 3 : 0;
    drawCard(ctx, S, cx, cy + bob, cw, ch, ci, angle);
    ctx.restore();
  }
  function drawWindow(ctx, S, L, T) {
    drawWindowFrame(ctx, S, L);
    const k = S.table;
    if (k < 1) { ctx.save(); ctx.globalAlpha *= 1 - k; for (let i = 0; i < 3; i++) drawReel(ctx, S, L, i); drawPayline(ctx, S, L); ctx.restore(); }
    if (k > 0) drawTable(ctx, S, L, T, k);
  }

  function drawDeck(ctx, S, L) {
    const c = L.deck, s = L.slot, t = L.tray;
    Ale.rr(ctx, c.x, c.y, c.w, c.h, 16); ctx.fillStyle = lin(ctx, 0, c.y, 0, c.y + c.h, [[0, '#5a2a3a'], [1, '#2c1520']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    // приёмник: колодец с фишкой
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r + 4, 0, TAU); ctx.fillStyle = lin(ctx, 0, s.cy - s.r, 0, s.cy + s.r, [[0, '#fff0b0'], [1, '#b8862a']]); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, 0, TAU); ctx.fillStyle = rad(ctx, s.cx, s.cy, 4, s.r, [[0, '#2a1420'], [1, '#0e0610']]); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(s.cx, s.cy + 1); ctx.rotate(-0.22); const k = (s.r - 3) / 26; ctx.scale(k, k); paintChip(ctx); ctx.restore();
    // лоток для монет
    Ale.rr(ctx, t.x, t.y, t.w, t.h, 12); ctx.fillStyle = lin(ctx, 0, t.y, 0, t.y + t.h, [[0, '#1c0c18'], [1, '#3a1c2c']]); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    // горка монет в лотке: пока играем — один ряд, после выигрыша — пирамидка
    const full = S.amount > 0 && S.phase !== 'bet' && S.phase !== 'pull' && S.phase !== 'spin', rows = full ? [7, 5, 3] : [5];
    ctx.fillStyle = '#f4c542'; ctx.lineWidth = 2; ctx.strokeStyle = OUT;
    rows.forEach((n, r) => { for (let i = 0; i < n; i++) { const x = t.cx + (i - (n - 1) / 2) * 17 + (r % 2) * 2, y = t.y + t.h - 11 - r * 7; ctx.beginPath(); ctx.ellipse(x, y, 10, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); } });
  }

  function drawLever(ctx, S, L) {
    const lv = L.lever, k = S.leverK(), th = k * Math.PI * 0.62, px = lv.px, py = lv.py;
    const bx = px + 14 * Math.sin(th), by = py - lv.len * Math.cos(th), br = 21 * (1 + 0.2 * Math.sin(th));
    // стержень
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.lineWidth = 17; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = '#c9c1d0'; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.moveTo(px - 2, py - 2); ctx.lineTo(bx - 2, by - 2); ctx.stroke();
    // ось
    ctx.beginPath(); ctx.arc(px, py, 15, 0, TAU); ctx.fillStyle = lin(ctx, 0, py - 15, 0, py + 15, [[0, '#e6e0ea'], [1, '#6e657c']]); ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke();
    // подсказка: пульсирующее кольцо вокруг шара и стрелка вниз, пока ждём рычаг
    if (S.phase === 'pull') {
      const p = 0.5 + 0.5 * Math.sin(S.t * 6);
      ctx.beginPath(); ctx.arc(bx, by, br + 8 + 5 * p, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,224,120,' + (0.55 + 0.4 * p).toFixed(3) + ')'; ctx.stroke();
      const ay = by - br - 30 + 6 * Math.sin(S.t * 6);
      ctx.beginPath(); ctx.moveTo(bx - 13, ay - 9); ctx.lineTo(bx + 13, ay - 9); ctx.lineTo(bx, ay + 9); ctx.closePath(); ctx.fillStyle = '#ffe27a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
    }
    // шар
    ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fillStyle = rad(ctx, bx, by, 2, br * 1.2, [[0, '#ff8a78'], [0.55, '#e0342e'], [1, '#8f1a1c']], -br * 0.35, -br * 0.4); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(bx - br * 0.36, by - br * 0.4, br * 0.28, br * 0.17, -0.7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }

  function drawCoin(ctx, p) {
    const sx = Math.abs(Math.cos(p.rot)), rx = Math.max(1.6, p.r * sx), fade = clamp((p.life - p.age) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha *= fade;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, p.r, 0, 0, TAU); ctx.fillStyle = sx > 0.35 ? '#f6c945' : '#c8932a'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
    if (sx > 0.45) { ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 0.62, p.r * 0.62, 0, 0, TAU); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(160,110,20,0.8)'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.3, p.y - p.r * 0.35, rx * 0.2, p.r * 0.16, -0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // Кнопка: подписи, клавиша слева (только на клавиатуре), выбор — золотая с обводкой и свечением
  function drawButton(ctx, S, b) {
    const r = b.rect, touch = Ale.Input.lastDevice === 'touch', pulse = 0.5 + 0.5 * Math.sin(S.t * 6), sel = !!b.sel, two = !!b.sub;
    const lift = sel ? -3 : 0, rad2 = two || b.kind === 'bet' ? 18 : r.h / 2;
    let fill = CREAM, textCol = INK;
    if (b.kind === 'colour') { fill = b.colour === 'red' ? lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#f26a5c'], [1, '#c4352e']]) : lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#5a4660'], [1, '#2b1f33']]); textCol = CREAM; }
    else if (sel || b.primary) { const h = sel ? pulse : 0; fill = 'rgb(255,' + Math.round(222 + 12 * h) + ',' + Math.round(140 + 40 * h) + ')'; }
    ctx.save(); ctx.translate(0, lift);
    if (sel) { Ale.rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, rad2 + 5); ctx.fillStyle = 'rgba(255,214,102,' + (0.35 + 0.25 * pulse).toFixed(3) + ')'; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, r.x + 2, r.y + 6, r.w, r.h, rad2); ctx.fill();
    Ale.rr(ctx, r.x, r.y, r.w, r.h, rad2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = sel ? 6 : 5; ctx.strokeStyle = sel ? '#b8862a' : OUT; ctx.stroke();
    if (sel) { Ale.rr(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, rad2 + 1); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
    let x0 = r.x + 14;
    if (b.key && !touch) {
      ctx.font = font('bold', 18); const kw = Math.max(36, ctx.measureText(b.key).width + 16);
      Ale.rr(ctx, x0, r.y + r.h / 2 - 16, kw, 32, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.key, x0 + kw / 2, r.y + r.h / 2 + 1); x0 += kw + 8;
    }
    const tw = r.x + r.w - 14 - x0, cx = x0 + tw / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (b.sub) {
      fitFont(ctx, b.label, 'bold', b.kind === 'bet' ? 30 : 24, tw, 16); ctx.fillStyle = textCol; ctx.fillText(b.label, cx, r.y + r.h * 0.38);
      fitFont(ctx, b.sub, '600', 16, tw, 11); ctx.fillStyle = 'rgba(58,36,49,0.78)'; ctx.fillText(b.sub, cx, r.y + r.h * 0.74);
    } else {
      fitFont(ctx, b.label, 'bold', 26, tw, 16);
      if (b.kind === 'colour') { ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.strokeText(b.label, cx, r.y + r.h / 2 + 1); }
      ctx.fillStyle = textCol; ctx.fillText(b.label, cx, r.y + r.h / 2 + 1);
    }
    ctx.restore();
  }
  function pill(ctx, L, text, y, tone) {
    fitFont(ctx, text, 'bold', 26, L.W - 120, 16);
    const tw = ctx.measureText(text).width, w = tw + 60, h = 46, x = L.cx - w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, x + 2, y - h / 2 + 6, w, h, h / 2); ctx.fill();
    Ale.rr(ctx, x, y - h / 2, w, h, h / 2); ctx.fillStyle = tone === 'bad' ? '#ffe3d6' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = tone === 'bad' ? '#a83a26' : OUT; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, L.cx, y + 1);
  }
  function drawControls(ctx, S, L, T) {
    const touch = Ale.Input.lastDevice === 'touch', ph = S.phase;
    // ряд A: сообщение
    const y = L.rowA + 32;
    let note = '', tone = 'info';
    const stake = () => T.stakeNote.replace('{win}', fmt(S.amount * 2)).replace('{bet}', fmt(S.bet));
    if (ph === 'pull') note = T.pullNote.replace('{n}', fmt(payout('crown3', S.bet, S.opts.multiplier)));
    else if (ph === 'offer') note = S.canRisk ? stake() : (S.risked >= S.opts.maxRisk && !S.opts.noRisk ? T.maxed : '');
    else if (ph === 'risk' || ph === 'flip') note = stake();
    else if (ph === 'miss') { note = T.missNote.replace('{n}', fmt(S.amount)); tone = 'bad'; }
    else if (ph === 'lose') { note = T.loseNote; tone = 'bad'; }
    else if (ph === 'take') note = T.takeNote.replace('{n}', fmt(S.amount));
    if (note) pill(ctx, L, note, y, tone);
    for (const b of S.buttons(L)) drawButton(ctx, S, b);
    // стрелки выбора ставки (клавиатура)
    if (ph === 'bet' && !touch) {
      const r0 = L.betRects[0], r1 = L.betRects[L.betRects.length - 1], p = 0.5 + 0.5 * Math.sin(S.t * 5);
      ctx.fillStyle = '#ffe27a'; ctx.lineWidth = 3.5; ctx.strokeStyle = OUT;
      ctx.beginPath(); ctx.moveTo(r0.x - 14 - 3 * p, r0.y + r0.h / 2); ctx.lineTo(r0.x - 14 - 3 * p + 14, r0.y + r0.h / 2 - 12); ctx.lineTo(r0.x - 14 - 3 * p + 14, r0.y + r0.h / 2 + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r1.x + r1.w + 14 + 3 * p, r1.y + r1.h / 2); ctx.lineTo(r1.x + r1.w + 14 + 3 * p - 14, r1.y + r1.h / 2 - 12); ctx.lineTo(r1.x + r1.w + 14 + 3 * p - 14, r1.y + r1.h / 2 + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // строка управления
    const lg = T.legend[ph === 'offer' && !S.canRisk ? 'offerMax' : ph === 'pull' && S.opts.fixedBet && T.legend.pullFixed ? 'pullFixed' : ph];
    if (lg) {
      const s = Ale.tx(lg);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.85)';
      fitFont(ctx, s, '600', touch ? 20 : 18, L.W - 40, 12);
      ctx.strokeText(s, L.cx, L.legendY); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fillText(s, L.cx, L.legendY);
    }
  }

  function drawSession(ctx, S, W, H) {
    const L = layout(W, H, S.opts.bets.length), T = Ale.T.casino;
    ctx.save();
    drawBackdrop(ctx, S, W, H);
    const e = EASE.outCubic(S.fade);
    ctx.globalAlpha = S.fade; ctx.translate(0, (1 - e) * 18);
    drawCaption(ctx, S, L, T);
    drawRays(ctx, S, L);
    drawCabinet(ctx, S, L);
    drawBulbs(ctx, S, L);
    drawHeader(ctx, S, L, T);
    drawDisplays(ctx, S, L, T);
    drawWindow(ctx, S, L, T);
    drawDeck(ctx, S, L);
    drawLever(ctx, S, L);
    for (const p of S.coins) drawCoin(ctx, p);
    drawControls(ctx, S, L, T);
    ctx.restore();
  }

  // ================================================================== ОБЩИЙ ОБЪЕКТ
  const Casino = (Ale.Casino = {
    busy: false,           // экран открыт: UI.modal останавливает мир, касания уходят в UI.tapPoint, сенсорные кнопки скрыты
    session: null,
    logic, layout, fmt, drawVector, PAINT, paintChip, SUITS,
    TIMING: { guard: GUARD, countT: COUNT_T, winT: WIN_T, winSmallT: WIN_SMALL_T, loseT: LOSE_T, hitT: HIT_T, missT: MISS_T, takeT: TAKE_T, flipT: FLIP_T, skipAfter: SKIP_AFTER, closeFade: CLOSE_FADE, spinGuard: SPIN_GUARD, landPause: LAND_PAUSE },

    // Сценарий: const q = Ale.Casino.slots({ jackpot: true }); yield q; q.result. Возвращает объект с update() (true, когда экран закрылся) и result (null, пока экран не закрыт)
    slots(opts) { return this.start(new Session(opts)); },
    // Общий вход для всех экранов казино (автомат, рулетка): любая сессия с update(dt), draw(ctx, W, H), done, result и по желанию botStep(Bot), cancelResult()
    start(s) {
      if (this.session) this._abandon(this.session);
      this.session = s; this.busy = true;
      if (s.music && !this._musicBack && Ale.Audio && Ale.Audio.screenMusic) this._musicBack = Ale.Audio.screenMusic(s.music);       // у рулетки своя дорожка на время экрана
      Ale.Input.consumeAll(); Ale.UI.tapPoint = null;
      return { update: () => s.done, get result() { return s.result; }, session: s };
    },
    _abandon(s) { s.done = true; if (!s.result) s.result = typeof s.cancelResult === 'function' ? s.cancelResult() : { cancelled: true }; },
    _musicRestore() { const b = this._musicBack; this._musicBack = null; if (b) b(); },
    update(dt) {
      const s = this.session;
      if (!s) { this.busy = false; this._musicRestore(); return; }
      s.update(dt);
      if (s.done) { this.session = null; this.busy = false; this._musicRestore(); Ale.Input.consumeAll(); Ale.UI.tapPoint = null; }
    },
    draw(ctx, W, H) {
      const s = this.session;
      if (!s) return;
      s.vw = W; s.vh = H;
      if (typeof s.draw === 'function') s.draw(ctx, W, H); else drawSession(ctx, s, W, H);
    },
    reset() {
      const s = this.session; this.session = null; this.busy = false;
      if (s) this._abandon(s);
      this._musicRestore();
    },

    // Бот сюжета зовёт это каждый шаг, пока busy: как человек — немного ждёт, берёт самую большую ставку, ставит, тянет рычаг, дожидается джекпота и жмёт «Забрать» (не рискуя).
    // Нажимает те же действия, что игрок (Bot.press): левый / правый и «взаимодействие». Возвращает true, пока экран открыт.
    botStep(Bot) {
      const s = this.session;
      if (!s || !this.busy) return false;
      if (typeof s.botStep === 'function') return s.botStep(Bot);                     // у рулетки свой бот
      const every = (n) => Bot.tick % n === 0;
      switch (s.phase) {
        case 'bet':
          if (s.phaseT < 0.6) break;
          if (s.sel !== s.opts.bets.length - 1) { if (every(6)) Bot.press('right'); } else if (every(12)) Bot.press('interact');
          break;
        case 'pull': if (every(12)) Bot.press('interact'); break;
        case 'offer':
          if (s.sel !== s.takeIndex) { if (every(6)) Bot.press('left'); } else if (every(12)) Bot.press('interact');
          break;
        case 'risk': if (every(12)) { if (Bot.back) Bot.back(); else Bot.press('pause'); } break;                      // оказались в риске — вернуться к «Забрать»
        case 'lose': case 'miss': case 'take': if (every(12)) Bot.press('interact'); break;
        default: break;                                                                // вращение, джекпот, переворот карты: ждёт
      }
      return true;
    },
  });
  Casino.Session = Session;
})();
