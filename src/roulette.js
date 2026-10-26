// Рулетка у правого стола казино Монако («тест на жадность», владелец 03.10.2026). После джекпота на автомате крупье зовёт Алесю к столу: играть можно только на ВСЁ (ставка — вся сумма),
// цвет на выбор — красное, чёрное или зелёное. Исход раундов задаёт сценарий (первые winStreak раундов выигрыш при любом цвете, следующий — проигрыш и утешительный приз), но выглядит это как
// настоящая рулетка: колесо с 37 карманами крутится, шарик бежит навстречу, замедляется, сходит с дорожки и падает в карман нужного цвета.
//   const q = Ale.Casino.roulette({ stake: 2000, consolation: 50 });   yield q;   const r = q.result;
// opts: stake (€, вся сумма на кону, обязательно > 0), played (сколько раундов за этим столом сыграно до открытия экрана, 0), winStreak (сколько раундов подряд выигрышные, 3), rig (true — исход задаёт
// сценарий; false — честная игра: карман 0…36 выбирает Ale.rng), payouts ({ red: 2, black: 2, green: 14 }, можно частично), consolation (что остаётся после проигрыша, 0).
// result (когда экран закрылся; до этого null): { cancelled — экран закрыт, ни разу не сыграв (Esc или «Уйти от стола» на первом выборе; сумма прежняя) либо брошен хозяином (reset, смена сцены),
//   plays — сколько раундов сыграно за этот экран, wins — сколько из них выиграно, lost — последний раунд проигран (стол закончен, amount = consolation), taken — нажато «Забрать»,
//   amount — сумма, которой игрок владеет после закрытия, last — { pick, colour, number, won } последнего раунда или null, rounds — [{ pick, colour, number, won, stake, amount }] по каждому раунду }.
// Раунд k = played + сыграно на экране + 1 выигрышный, если rig && k <= winStreak (в честной игре — если цвет кармана Ale.rng совпал с выбором). Выигрыш: ставка × payouts[цвет]; зелёное — всегда карман 0.
// Решение раунда принимает только сценарий (rig) и никогда не тратит Ale.rng: косметика (какой из карманов нужного цвета, где остановится шарик, монеты) — Ale.fxRng. Время считается только по dt.
// Модуль устроен как остальные окна казино (образец — src/casino.js): регистрируется через Ale.Casino.start(session), мир на время экрана стоит (UI.modal), касания приходят в UI.tapPoint,
// бот сюжета зовёт session.botStep(Bot). Три слоя: logic (чистые функции без DOM: карманы, цвета, выплаты, решение раунда, чистая функция движения шарика и колеса), RouletteSession
// (состояние, фазы, ввод) и рисование (колесо, шарик, стол с карточками цветов — всё контурами Canvas: шрифтовые значки на iOS превращаются в картинки). Все надписи — в T.roulette (src/text.js).
// Фазы: 'pick' (выбор цвета) → 'spin' (колесо и шарик; нажатие после 1,2 с перематывает к концу, результат тот же) → 'win' (сумма считается вверх) → 'offer' («Забрать» / «Всё на кон»)
//   → 'take' (закрытие) | снова 'pick' с новой ставкой; проигрыш: 'spin' → 'lose' → закрытие. Выйти посреди вращения нельзя.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const Casino = Ale.Casino;
  if (!Casino || typeof Casino.start !== 'function') return;                 // без общего окна казино (src/casino.js) рулетка не подключается
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2, HALF = Math.PI / 2;

  // ================================================================== ЛОГИКА
  // Европейское колесо: 37 карманов по часовой стрелке, начиная с зеро (в системе колеса зеро вверху)
  const POCKETS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const NP = POCKETS.length, PW = TAU / NP;
  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const COLOURS = ['red', 'black', 'green'];
  const colourOf = (n) => (n === 0 ? 'green' : RED_NUMBERS.indexOf(n) >= 0 ? 'red' : 'black');
  const INDEX = {}; POCKETS.forEach((n, i) => { INDEX[n] = i; });
  const BY_COLOUR = { red: [], black: [], green: [] };
  for (let n = 0; n < NP; n++) BY_COLOUR[colourOf(n)].push(n);
  const DEFAULT_PAYOUTS = { red: 2, black: 2, green: 14 };
  const DEFAULT_STREAK = 3, MAX_STREAK = 40;

  // Случайный карман нужного цвета (зелёное — всегда 0): одно обращение к генератору rng на любой цвет
  const pickPocket = (colour, rng) => rng.pick(BY_COLOUR[colour] || BY_COLOUR.red);
  // Другой цвет для выбранного: красное → чёрное, чёрное → красное, зелёное → красное или чёрное (по fx)
  const otherColour = (pick, fx) => (pick === 'red' ? 'black' : pick === 'black' ? 'red' : fx.pick(['red', 'black']));
  const multOf = (colour, payouts) => { const m = payouts && payouts[colour]; return m > 0 && isFinite(m) ? m : DEFAULT_PAYOUTS[colour] || 0; };
  const payout = (stake, colour, payouts) => Math.round(stake * multOf(colour, payouts));
  // Решение одного раунда. o: { k — номер раунда с 1, pick — выбранный цвет, rig, winStreak, rng — Ale.rng (только честная игра), fx — Ale.fxRng }
  function roundResult(o) {
    if (o.rig !== false) {
      const won = o.k <= (o.winStreak === undefined ? DEFAULT_STREAK : o.winStreak);
      const colour = won ? o.pick : otherColour(o.pick, o.fx);
      return { won, colour, number: pickPocket(colour, o.fx), scripted: true };
    }
    const number = o.rng.int(0, NP - 1), colour = colourOf(number);
    return { won: colour === o.pick, colour, number, scripted: false };
  }

  // Углы: система колеса — карман i стоит на угле i·PW − 90° (зеро вверху, нумерация по часовой); на экране угол растёт по часовой стрелке (ось y вниз)
  const pocketAngle = (i) => i * PW - HALF;
  const cellOf = (rel) => Math.floor((rel + HALF) / PW + 0.5);                // номер кармана без свёртки по кругу: какой карман сейчас под шариком
  const pocketUnder = (rel) => mod(cellOf(rel), NP);

  // Движение: колесо крутится против часовой стрелки и замедляется до остановки в момент T; шарик бежит по часовой относительно колеса, сначала по внешней дорожке (скорость падает
  // линейно от s0 до s1 за tD секунд), потом сходит на кольцо с карманами и тормозит ровно до нуля к моменту T. Оставшийся путь шарика (отсчитывая от конца) известен в замкнутой форме,
  // поэтому он останавливается ровно на центре нужного кармана, а колесо — под нужным углом; начальный угол колеса совпадает с тем, на котором оно стояло (скачка нет).
  const ANIM = {
    T: 5.0, tD: 3.1, s0: 15, s1: 8, turns: 2.0,                                  // полное время вращения, с; момент схода шарика с дорожки, с; скорость шарика относительно колеса в начале и в момент схода, рад/с; минимум оборотов колеса
    rTrack: 0.83, rTrackEnd: 0.8, rPocket: 0.5675, slideBefore: 0.12, slideAfter: 0.38,    // радиусы (доли радиуса колеса): дорожка в начале и перед сходом, карман; сход длится от tD − 0,12 до tD + 0,38 с
    hops: [[1.5, 1.12, 9], [1.12, 0.84, 6], [0.84, 0.62, 4], [0.62, 0.45, 2.4], [0.45, 0.32, 1.4], [0.32, 0.22, 0.7]],        // прыжки шарика по карманам: [за сколько секунд до конца начало, конец, высота]
    wobLen: 0.7, wobAmp: 0.5, wobCycles: 5,                                      // дрожь шарика в последние 0,7 с (доли кармана), к концу гаснет в ноль
    rest: -HALF, restSpread: 0.55,                                               // где шарик остановится на экране: сверху, ± радиан (косметика)
  };
  const ballSpeed = (pl, t) => (t >= pl.T ? 0 : t >= pl.tD ? pl.s1 * (pl.T - t) / pl.D : pl.s0 + (pl.s1 - pl.s0) * t / pl.tD);
  // Сколько ещё шарику пройти относительно колеса к моменту t (до остановки)
  function remAt(pl, t) {
    if (t >= pl.T) return 0;
    if (t >= pl.tD) { const q = pl.T - t; return pl.s1 * q * q / (2 * pl.D); }
    const d = pl.tD - t;
    return pl.s1 * pl.D / 2 + pl.s0 * d + (pl.s1 - pl.s0) * (pl.tD * pl.tD - t * t) / (2 * pl.tD);
  }
  // План вращения: o = { index | number — в какой карман, rest — угол покоя шарика на экране, wheel0 — угол, на котором стояло колесо }
  function spinPlan(o) {
    const idx = o.index !== undefined ? o.index : INDEX[o.number];
    const rest = o.rest === undefined ? ANIM.rest : o.rest, wheel0 = o.wheel0 || 0;
    const P = pocketAngle(idx), Wend = rest - P;                              // колесо встанет так, что карман idx окажется под шариком
    const base = ANIM.turns * TAU, A = base + mod(wheel0 - Wend - base, TAU);
    return { idx, number: POCKETS[idx], rest, wheel0, P, Wend, A, T: ANIM.T, tD: ANIM.tD, D: ANIM.T - ANIM.tD, s0: ANIM.s0, s1: ANIM.s1 };
  }
  function hopAt(q) {
    for (const h of ANIM.hops) if (q <= h[0] && q > h[1]) return h[2] * Math.sin(Math.PI * (h[0] - q) / (h[0] - h[1]));
    return 0;
  }
  // Состояние в момент t (чистая функция плана и времени): wheel — угол колеса, rel — угол шарика в системе колеса, ball — угол шарика на экране, r — радиус (доля радиуса колеса), z — высота прыжка,
  // speed — скорость шарика на экране (рад/с), landed — шарик встал, dropped — сошёл на кольцо
  function spinAt(pl, t) {
    t = clamp(t, 0, pl.T);
    const u = t / pl.T, q = pl.T - t, wheel = pl.Wend + pl.A * (1 - u) * (1 - u);
    let wob = 0;
    if (q < ANIM.wobLen) { const k = q / ANIM.wobLen; wob = ANIM.wobAmp * PW * k * k * Math.sin(k * ANIM.wobCycles * Math.PI); }
    const rel = pl.P - remAt(pl, t) + wob;
    const a = pl.tD - ANIM.slideBefore, b = pl.tD + ANIM.slideAfter;
    const r = t <= a ? lerp(ANIM.rTrack, ANIM.rTrackEnd, t / a) : t >= b ? ANIM.rPocket : lerp(ANIM.rTrackEnd, ANIM.rPocket, smooth((t - a) / (b - a)));
    const speed = Math.max(0, ballSpeed(pl, t) - 2 * pl.A * (1 - u) / pl.T);
    return { t, wheel, rel, ball: wheel + rel, r, z: hopAt(q), speed, dropped: t >= a, landed: t >= pl.T };
  }

  const logic = {
    POCKETS, NP, PW, COLOURS, RED_NUMBERS, DEFAULT_PAYOUTS, DEFAULT_STREAK, ANIM,
    colourOf, pickPocket, otherColour, multOf, payout, roundResult, pocketAngle, cellOf, pocketUnder, spinPlan, spinAt, remAt, ballSpeed,
  };

  // ================================================================== ВРЕМЯ И СОСТОЯНИЕ
  const sfx = (name, o) => { if (Ale.Audio && Ale.Audio.sfx) Ale.Audio.sfx(name, o); };
  const EASE = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const BACK_PHASES = new Set(['pick', 'offer']);
  const GUARD = 0.28;                       // первые 0,28 с новой фазы нажатия и касания не принимаются (чтобы не пролететь экран случайным нажатием)
  const COUNT_T = 1.5, WIN_T = 2.7, LOSE_T = 3.0, TAKE_T = 0.9, SKIP_AFTER = 0.8;
  const SKIP_SPIN = 1.2, FF = 6;            // перемотка вращения: не раньше 1,2 с, ход времени ×6 до остановки шарика
  const LAND_PAUSE = 0.55, TICK_GAP = 0.09, CLOSE_FADE = 0.4, MAX_COINS = 160;
  const NOCTL = { dir: 0, ok: false, back: false };

  class RouletteSession {
    constructor(opts) {
      opts = opts || {};
      const stake = isFinite(opts.stake) && opts.stake >= 1 ? Math.round(opts.stake) : 1;
      const pay = {}; for (const c of COLOURS) pay[c] = multOf(c, opts.payouts);
      this.opts = {
        stake, played: isFinite(opts.played) && opts.played > 0 ? Math.floor(opts.played) : 0,
        winStreak: opts.winStreak !== null && opts.winStreak !== undefined && isFinite(opts.winStreak) ? clamp(Math.floor(opts.winStreak), 0, MAX_STREAK) : DEFAULT_STREAK,
        rig: opts.rig !== false, payouts: pay, consolation: isFinite(opts.consolation) && opts.consolation > 0 ? Math.round(opts.consolation) : 0,
      };
      this.t = 0; this.phaseT = 0; this.fade = 0; this.closing = false; this.closeT = 0; this.done = false; this.result = null;
      this.phase = 'pick';
      this.sel = 0;                         // выбранный цвет (0 красное, 1 чёрное, 2 зелёное): остаётся прежним и в следующем раунде
      this.choice = 0;                      // в 'offer' — выбранная кнопка (0 «Забрать», 1 «Всё на кон»)
      this.amount = stake;                  // сумма, которой игрок владеет сейчас: до раунда вся ставка, после выигрыша выигрыш, после проигрыша утешительный приз
      this.stake = stake;                   // сколько поставлено в последнем (идущем) раунде
      this.shown = stake; this.count = null;
      this.plays = 0; this.wins = 0; this.lost = false; this.taken = false; this.rounds = []; this.last = null; this.round = null; this.pick = null;
      this.plan = null; this.spinT = 0; this.ff = false; this.rel = 0; this.wheel = 0.4; this.ballA = 0; this.tickCool = 0;
      this.coins = []; this.coinAcc = 0; this.coinRate = 0; this.coinFor = 0; this.coinSnd = 0;
      this.vw = 0; this.vh = 0; this._tp = null; this._ctl = NOCTL;
      this.capKey = ''; this.capT = 0;
      this.sndCount = {}; this.tickTimes = [];       // сколько раз какой звук запрошен и когда стучали карманы (для проверок частоты звуков)
    }

    _snd(name, vol) { this.sndCount[name] = (this.sndCount[name] || 0) + 1; sfx(name, vol === undefined ? undefined : { vol }); }
    _enter(phase) { this.phase = phase; this.phaseT = 0; }
    _lay() { return layout(this.vw || (Ale.Game && Ale.Game.viewW) || 1280, this.vh || (Ale.Game && Ale.Game.viewH) || 720); }
    get roundNo() { return this.opts.played + this.plays + 1; }                  // номер раунда за этим столом (с 1): по нему сценарий решает, выигрышный ли он
    get plaqueValue() { return this.phase === 'pick' ? this.amount : this.stake; }
    colour() { return COLOURS[this.sel] || 'red'; }

    // Кнопки и карточки цветов, видимые сейчас: прямоугольники, подписи и признак выбора (для рисования, касаний и проверок)
    cards(L) {
      L = L || this._lay();
      const T = Ale.T.roulette, o = this.opts, chosen = this.phase === 'pick' ? this.sel : COLOURS.indexOf(this.pick);
      return COLOURS.map((c, i) => ({ id: c, kind: 'colour', i, colour: c, rect: L.cards[i], label: T.colours[c], mult: T.pays.replace('{n}', String(multOf(c, o.payouts))), prize: fmt(payout(this.plaqueValue, c, o.payouts)), sel: chosen === i }));
    }
    buttons(L) {
      L = L || this._lay();
      const T = Ale.T.roulette, B = T.buttons, out = [];
      switch (this.phase) {
        case 'pick':
          for (const c of this.cards(L)) out.push(c);
          out.push({ id: 'back', kind: 'back', rect: L.rowSub, label: this.plays > 0 ? B.take : B.leave, key: 'Esc' }, { id: 'ok', kind: 'ok', rect: L.rowMain, label: B.bet, key: 'E', primary: true });
          break;
        case 'offer':
          out.push({ id: 'take', kind: 'take', rect: L.offer[0], label: B.take, sub: fmt(this.amount), sel: this.choice === 0, primary: true }, { id: 'again', kind: 'again', rect: L.offer[1], label: B.again, sel: this.choice === 1 });
          break;
        case 'lose':
          if (this.phaseT >= SKIP_AFTER) out.push({ id: 'next', kind: 'next', rect: L.rowMain, label: B.next, key: 'E', primary: true });
          break;
        default: break;
      }
      return out;
    }
    // Плашки-сообщения под карточками: { text, tone, disc: { colour, num } }
    notes() {
      const T = Ale.T.roulette, o = this.opts, r = this.round, ph = this.phase, out = [];
      const landed = r && { text: T.landed.replace('{num}', String(r.number)).replace('{colour}', T.coloursLow[r.colour]), tone: ph === 'lose' ? 'bad' : 'info', disc: { colour: r.colour, num: r.number } };
      if (ph === 'pick' || ph === 'spin') out.push({ text: T.pickNote.replace('{win}', fmt(payout(ph === 'pick' ? this.amount : this.stake, ph === 'pick' ? this.colour() : this.pick, o.payouts))), tone: 'info' });
      else if (ph === 'win' || ph === 'offer') out.push(landed, { text: T.winNote.replace('{n}', fmt(this.shown)), tone: 'good' });
      else if (ph === 'lose') { out.push(landed); if (o.consolation > 0) out.push({ text: T.loseNote.replace('{n}', fmt(o.consolation)), tone: 'bad' }); }
      else if (ph === 'take') out.push(landed || null, { text: T.takeNote.replace('{n}', fmt(this.amount)), tone: 'good' });
      return out.filter(Boolean);
    }
    captionKey() {
      if (this.phase === 'win') return this.round && this.round.colour === 'green' ? 'zero' : 'win';
      return this.phase;
    }
    // Состояние для рисования: колесо и шарик в момент spinT (после остановки — неподвижные)
    view() {
      if (this.plan && (this.phase !== 'pick' || this.ballA > 0)) return spinAt(this.plan, this.spinT);
      return { t: 0, wheel: this.wheel, rel: 0, ball: 0, r: ANIM.rPocket, z: 0, speed: 0, dropped: true, landed: true };
    }

    // ---- действия (клавиши, касания, бот и проверки приходят сюда)
    selectColour(i) {
      if (this.phase !== 'pick' || this.closing) return 'ignored';
      i = typeof i === 'string' ? COLOURS.indexOf(i) : Math.floor(i);
      if (!(i >= 0 && i < COLOURS.length)) return 'ignored';
      const was = this.sel; this.sel = i;
      if (was !== i) this._snd('casino_pick', 0.7);
      return 'select';
    }
    // «Поставить всё»: решение раунда принимается здесь (сценарием или Ale.rng), дальше экран только показывает
    bet() {
      if (this.phase !== 'pick' || this.closing) return 'ignored';
      const o = this.opts, pick = this.colour();
      const r = roundResult({ k: this.roundNo, pick, rig: o.rig, winStreak: o.winStreak, rng: Ale.rng, fx: Ale.fxRng });
      this.round = { pick, colour: r.colour, number: r.number, won: r.won };
      this.pick = pick; this.stake = this.amount;
      this.plan = spinPlan({ number: r.number, rest: ANIM.rest + Ale.fxRng.range(-ANIM.restSpread, ANIM.restSpread), wheel0: this.wheel });
      this.spinT = 0; this.ff = false; this.rel = this.plan.P - remAt(this.plan, 0); this.tickCool = 0;
      this._snd('casino_bet'); this._snd('wheel_whirr');
      this._enter('spin');
      return 'bet';
    }
    // Нажатие или касание во время вращения (не раньше 1,2 с): время идёт ×6 до остановки шарика; результат от этого не меняется. В сообщениях — пропуск не раньше 0,8 с
    skip() {
      if (this.closing) return 'ignored';
      if (this.phase === 'spin') {
        if (this.phaseT < SKIP_SPIN || this.ff || this.spinT >= this.plan.T) return 'ignored';
        this.ff = true; return 'skip';
      }
      if (this.phaseT < SKIP_AFTER) return 'ignored';
      if (this.phase === 'win') { this._enterOffer(); return 'skip'; }
      if (this.phase === 'lose' || this.phase === 'take') { this._close(); return 'skip'; }
      return 'ignored';
    }
    take() {
      if (this.closing || !(this.phase === 'offer' || (this.phase === 'pick' && this.plays > 0))) return 'ignored';
      this.taken = true; this._snd('coin'); this._emit(70, 0.4);
      this.result = this._result();
      this._enter('take');
      return 'take';
    }
    // «Всё на кон»: вся выигранная сумма идёт на следующий раунд, снова выбор цвета
    again() {
      if (this.phase !== 'offer' || this.closing) return 'ignored';
      this.shown = this.amount;
      this._enter('pick');
      return 'again';
    }
    // Назад: на первом выборе — отойти от стола (cancelled, сумма прежняя); после выигрыша («выбор» и «предложение») — забрать выигрыш; посреди вращения и в сообщениях выйти нельзя
    back() {
      if (this.closing) return 'ignored';
      if (this.phase === 'pick') {
        if (this.plays > 0) return this.take();
        this._close(this.cancelResult()); return 'cancel';
      }
      if (this.phase === 'offer') return this.take();
      return 'ignored';
    }
    _enterOffer() { this.choice = 0; this._enter('offer'); }
    _countTo(to, dur) { this.count = { from: this.shown, to, t: 0, dur }; }
    _result() {
      const last = this.last;
      return { cancelled: false, plays: this.plays, wins: this.wins, lost: this.lost, taken: this.taken, amount: this.amount, last: last ? Object.assign({}, last) : null, rounds: this.rounds.map((r) => Object.assign({}, r)) };
    }
    // Экран брошен (Esc на первом выборе, reset, смена сцены): игрок держит ту сумму, что была до идущего раунда
    cancelResult() { const r = this._result(); r.cancelled = true; r.taken = false; return r; }
    _close(result) {
      if (this.closing) return;
      if (result) this.result = result;
      if (!this.result) this.result = this._result();
      this.closing = true; this.closeT = 0;
    }
    // Конец вращения: раунд сыгран, сумма пересчитана
    _endSpin() {
      const r = this.round, o = this.opts;
      this.plays++;
      if (r.won) {
        this.wins++; this.lost = false; this.amount = payout(this.stake, r.colour, o.payouts);
        this.shown = this.stake; this._countTo(this.amount, COUNT_T);
      } else { this.lost = true; this.amount = o.consolation; this.shown = this.amount; }
      this.last = { pick: r.pick, colour: r.colour, number: r.number, won: r.won };
      this.rounds.push({ pick: r.pick, colour: r.colour, number: r.number, won: r.won, stake: this.stake, amount: this.amount });
      if (r.won) {
        const green = r.colour === 'green';
        this._snd(green ? 'jackpot' : 'casino_win'); this._emit(green ? 60 : 32, green ? 1.6 : 1.0);
        this._enter('win');
      } else {
        this.result = this._result();
        this._snd('casino_lose'); this._enter('lose');
      }
    }

    // ---- монеты (косметика: Ale.fxRng): фонтан из выигравшего кармана, rate монет в секунду в течение dur секунд
    _emit(rate, dur) { this.coinRate = rate; this.coinFor = dur; this.coinAcc = 0; }
    _coins(n) {
      const R = Ale.fxRng, L = this._lay(), w = L.wheel, st = this.view(), a = st.wheel + pocketAngle(this.round ? INDEX[this.round.number] : 0), rr = w.R * ANIM.rPocket;
      const x0 = w.cx + Math.cos(a) * rr, y0 = w.cy + Math.sin(a) * rr;
      for (let i = 0; i < n; i++) {
        this.coins.push({ x: x0 + R.range(-14, 14), y: y0, vx: R.range(-230, 230), vy: -R.range(420, 780), rot: R.range(0, 6.283), vr: R.range(-10, 10), r: R.range(8, 12), age: 0, life: R.range(1.4, 2.2) });
      }
      if (this.coins.length > MAX_COINS) this.coins.splice(0, this.coins.length - MAX_COINS);
    }

    // ---- ввод
    _readInput() {
      const I = Ale.Input, c = { dir: 0, ok: false, back: false };
      if (I.pressed('left') || I.edge('ArrowLeft') || I.edge('KeyA')) c.dir = -1;
      else if (I.pressed('right') || I.edge('ArrowRight') || I.edge('KeyD')) c.dir = 1;
      c.ok = I.pressed('interact') || I.edge('Enter') || I.edge('Space') || I.edge('KeyE');
      const esc = I.edge('Escape') && BACK_PHASES.has(this.phase) && this.phaseT >= GUARD;          // Esc — «назад» только на выборе цвета и в предложении; во вращении, выигрыше и сообщениях (и P) — пауза (12.10.2026)
      c.back = esc || I.edge('Backspace') || I.edge('KeyN');
      if (esc) I.consume('pause');
      return c;
    }
    _hit(list, p) {
      for (const b of list) { const r = b.rect; if (p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) return b; }
      return null;
    }
    _navigate(c, key, n) {
      if (!c.dir) return;
      const s = clamp(this[key] + c.dir, 0, n - 1);
      if (s !== this[key]) { this[key] = s; this._snd('casino_pick', 0.7); }
    }
    _step(dt) {
      switch (this.phase) {
        case 'pick': this._updPick(); break;
        case 'spin': this._updSpin(dt); break;
        case 'win': this._updWin(); break;
        case 'lose': this._updMsg(LOSE_T, () => this._close()); break;
        case 'offer': this._updOffer(); break;
        case 'take': this._updMsg(TAKE_T, () => this._close()); break;
        default: break;
      }
    }
    _updPick() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      this._navigate(c, 'sel', COLOURS.length);
      if (c.ok) this.bet();
      else if (c.back) this.back();
      else if (tp) {
        const b = this._hit(this.buttons(), tp);
        if (!b) return;
        if (b.kind === 'colour') this.selectColour(b.i); else if (b.kind === 'ok') this.bet(); else if (b.kind === 'back') this.back();
      }
    }
    _updSpin(dt) {
      const pl = this.plan, prevT = this.spinT, prevRel = this.rel;
      if (this.phaseT >= SKIP_SPIN && (this._ctl.ok || this._tp)) this.skip();
      if (this.ff && this.spinT < pl.T) this.spinT = Math.min(pl.T, this.spinT + dt * FF); else this.spinT += dt;
      const st = spinAt(pl, this.spinT);
      this.wheel = st.wheel; this.rel = st.rel;
      // события: сход на кольцо, стук о карманы (не чаще раза в TICK_GAP: ≤ 11 в секунду), остановка
      this.tickCool -= dt;
      if (prevT < pl.tD + 0.05 && this.spinT >= pl.tD + 0.05) this._snd('ball_drop');
      if (this.spinT >= pl.tD && cellOf(st.rel) !== cellOf(prevRel) && this.tickCool <= 0) { this.tickCool = TICK_GAP; this.tickTimes.push(this.t); this._snd('reel_tick', 0.35); }
      if (prevT < pl.T && this.spinT >= pl.T) this._snd('reel_stop', 0.8);
      if (this.spinT >= pl.T + LAND_PAUSE) this._endSpin();
    }
    _updWin() {
      if (this.phaseT >= WIN_T) this._enterOffer();
      else if (this.phaseT >= SKIP_AFTER && (this._ctl.ok || this._tp)) this.skip();
    }
    _updMsg(dur, then) {
      if (this.phaseT >= dur) { then(); return; }
      if (this.phaseT >= SKIP_AFTER && (this._ctl.ok || this._ctl.back || this._tp)) this.skip();
    }
    _updOffer() {
      if (this.phaseT < GUARD) return;
      const c = this._ctl, tp = this._tp;
      this._navigate(c, 'choice', 2);
      if (c.ok) { if (this.choice === 1) this.again(); else this.take(); }
      else if (c.back) this.take();
      else if (tp) {
        const b = this._hit(this.buttons(), tp);
        if (b && b.kind === 'take') this.take(); else if (b && b.kind === 'again') this.again();
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
      const showBall = this.phase !== 'pick';
      this.ballA = clamp(this.ballA + (showBall ? dt : -dt) / 0.18, 0, 1);
      if (this.coinFor > 0) {
        const d = Math.min(dt, this.coinFor); this.coinFor -= dt; this.coinAcc += d * this.coinRate;
        const n = Math.floor(this.coinAcc); this.coinAcc -= n; if (n) this._coins(n);
      }
      for (const p of this.coins) { p.age += dt; p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      this.coins = this.coins.filter((p) => p.age < p.life && p.y < 800);
      const ck = this.captionKey(); if (ck !== this.capKey) { this.capKey = ck; this.capT = this.t; }
    }

    // Экран для хоста: Ale.Casino.draw(ctx, W, H) сначала запоминает вид (vw, vh), потом зовёт это
    draw(ctx, W, H) { drawSession(ctx, this, W, H); }

    // Бот сюжета: как человек — немного ждёт, выбирает цвет Bot.rouletteColour (по умолчанию красное), ставит всё; после выигрыша забирает, когда выигрышей уже Bot.rouletteWins (3), иначе играет дальше
    // (Bot.rouletteWins = 99 — до проигрыша). Нажимает те же действия, что игрок (Bot.press). Возвращает true, пока экран открыт.
    botStep(Bot) {
      const every = (n) => Bot.tick % n === 0, nudge = (key, want) => { if (this[key] !== want) { if (every(6)) Bot.press(want > this[key] ? 'right' : 'left'); return true; } return false; };
      switch (this.phase) {
        case 'pick': {
          if (this.phaseT < 0.6) break;
          const want = Math.max(0, COLOURS.indexOf(Bot.rouletteColour || 'red'));
          if (!nudge('sel', want) && every(12)) Bot.press('interact');
          break;
        }
        case 'offer': {
          const limit = Bot.rouletteWins === undefined ? 3 : Bot.rouletteWins;
          if (!nudge('choice', this.wins >= limit ? 0 : 1) && every(12)) Bot.press('interact');
          break;
        }
        case 'win': case 'lose': case 'take': if (this.phaseT >= SKIP_AFTER + 0.2 && every(12)) Bot.press('interact'); break;
        default: break;                                                                // вращение: ждёт (перемотку бот не нажимает)
      }
      return true;
    }
  }

  // Деньги: «2 000 €» (шаблон — T.roulette.money)
  function fmt(n) {
    const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), T = Ale.T && Ale.T.roulette;
    return (T && T.money ? T.money : '{n} €').replace('{n}', s);
  }
  logic.fmt = fmt;

  // ================================================================== РАСКЛАДКА
  // Кадр 720 по высоте, ширина 1000…1700: колесо слева, стол с карточками цветов справа, подпись сверху, строка управления внизу. Вся группа стоит по центру кадра.
  let LCACHE = null;
  function layout(W, H) {
    H = H || 720;
    if (LCACHE && LCACHE.W === W && LCACHE.H === H) return LCACHE;
    const margin = 28, gap = 30;
    const R = clamp(Math.floor((W - 2 * margin - gap - 400) / 2), 224, 262);
    const panelW = clamp(W - 2 * margin - gap - 2 * R, 400, 520);
    const x0 = Math.round((W - (2 * R + gap + panelW)) / 2);
    const L = { W, H, cx: Math.round(W / 2), legendY: 692 };
    L.caption = { x: L.cx - 280, y: 4, w: 560, h: 60 };
    L.wheel = { cx: x0 + R, cy: 378, R };
    L.history = { x: x0 + R - 150, y: 72, w: 300, h: 34 };
    const PT = 92, PH = 560, px = x0 + 2 * R + gap, ix = px + 20, iw = panelW - 40;
    L.panel = { x: px, y: PT, w: panelW, h: PH };
    L.plaque = { x: ix, y: PT + 18, w: iw, h: 56 };
    const cg = 12, cw = Math.floor((iw - 2 * cg) / 3), cx0 = ix + Math.floor((iw - 3 * cw - 2 * cg) / 2);
    L.cards = [0, 1, 2].map((i) => ({ x: cx0 + i * (cw + cg), y: PT + 90, w: cw, h: 172 }));
    const nx = px + panelW / 2, n1 = PT + 304, n2 = PT + 358;
    L.noteRows = (n) => (n === 1 ? [{ cx: nx, cy: (n1 + n2) / 2, w: iw }] : [{ cx: nx, cy: n1, w: iw }, { cx: nx, cy: n2, w: iw }]);       // одна плашка стоит посередине просвета, две — друг под другом
    const sw = Math.min(iw, 240);
    L.rowSub = { x: px + Math.round((panelW - sw) / 2), y: PT + PH - 18 - 52, w: sw, h: 52 };
    L.rowMain = { x: ix, y: L.rowSub.y - 12 - 64, w: iw, h: 64 };
    const hw = Math.floor((iw - 14) / 2);
    L.offer = [{ x: ix, y: L.rowMain.y, w: hw, h: 64 }, { x: ix + hw + 14, y: L.rowMain.y, w: iw - hw - 14, h: 64 }];
    LCACHE = L;
    return L;
  }

  // ================================================================== РИСОВАНИЕ
  const OUT = '#3a2431', CREAM = '#fff6e4', INK = '#3a2431';
  const GOLD = [[0, '#fff0b0'], [0.5, '#f0c85a'], [1, '#b8862a']];
  const DISC = { red: ['#ff7a68', '#d4382f', '#8f1a1c'], black: ['#6e5f78', '#2b2230', '#120d16'], green: ['#6fdc90', '#22a05a', '#146a38'] };
  const WEDGE = { red: '#c9362c', black: '#241d2b', green: '#1e8f4e' };
  const font = (w, s) => w + ' ' + s + 'px ' + Ale.FONT;
  const fitFont = (ctx, text, weight, size, maxW, minSize) => { let s = size; ctx.font = font(weight, s); while (s > minSize && ctx.measureText(text).width > maxW) { s--; ctx.font = font(weight, s); } return s; };
  function outlined(ctx, text, x, y, fill, w) { ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const s of stops) gr.addColorStop(s[0], s[1]); return gr; };
  const rad = (g, x, y, r0, r1, stops, ox, oy) => { const gr = g.createRadialGradient(x + (ox || 0), y + (oy || 0), r0, x, y, r1); for (const s of stops) gr.addColorStop(s[0], s[1]); return gr; };

  // Приглушённая игра за столом: тёмная тёплая подложка, мягкое пятно света и несколько медленных огоньков зала (как у автомата)
  const BOKEH = [[0.08, 0.2, 46, 0], [0.16, 0.74, 30, 1], [0.27, 0.38, 22, 2], [0.9, 0.18, 40, 3], [0.84, 0.66, 52, 4], [0.7, 0.84, 24, 5], [0.05, 0.52, 58, 6], [0.95, 0.42, 26, 7], [0.32, 0.9, 34, 8], [0.62, 0.1, 20, 9]];
  function drawBackdrop(ctx, S, W, H) {
    const f = S.fade;
    ctx.fillStyle = 'rgba(22,6,20,' + (0.9 * f).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.46, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(255,170,96,' + (0.30 * f).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(196,58,84,' + (0.14 * f).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,30,70,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const b of BOKEH) {
      const a = (0.05 + 0.04 * Math.sin(S.t * 0.8 + b[3] * 1.7)) * f, x = b[0] * W, y = b[1] * H;
      const bg = ctx.createRadialGradient(x, y, 0, x, y, b[2]); bg.addColorStop(0, 'rgba(255,214,140,' + a.toFixed(3) + ')'); bg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = bg; ctx.fillRect(x - b[2], y - b[2], b[2] * 2, b[2] * 2);
    }
    if (S.phase === 'lose') {                                                  // проигрыш: тёплое красное свечение по краям
      const k = clamp(S.phaseT / 0.5, 0, 1) * (0.8 + 0.2 * Math.sin(S.t * 3)), r = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      r.addColorStop(0, 'rgba(170,20,20,0)'); r.addColorStop(1, 'rgba(170,20,20,' + (0.34 * k * f).toFixed(3) + ')');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.max(W, H) * 0.74);
    v.addColorStop(0, 'rgba(8,2,10,0)'); v.addColorStop(1, 'rgba(8,2,10,' + (0.55 * f).toFixed(3) + ')');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, 170);
    top.addColorStop(0, 'rgba(14,5,14,' + (0.98 * f).toFixed(3) + ')'); top.addColorStop(0.75, 'rgba(14,5,14,' + (0.95 * f).toFixed(3) + ')'); top.addColorStop(1, 'rgba(14,5,14,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 170);
  }

  function drawCaption(ctx, S, L, T) {
    const key = S.capKey || S.captionKey(), text = T.caption[key] || '', big = key === 'zero', calm = key === 'lose';
    const size = big ? 56 : key === 'win' ? 46 : 38;
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

  // ---- колесо: чаша с золотым ободом, дорожка шарика с «ромбами», вращающееся кольцо карманов с номерами, конус и ступица с крестом
  function sectorPath(g, r0, r1, a0, a1) {
    g.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1); g.arc(0, 0, r1, a0, a1);
    g.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0); g.arc(0, 0, r0, a1, a0, true); g.closePath();
  }
  function drawWheel(ctx, S, L, st) {
    const w = L.wheel, R = w.R, ph = S.phase;
    ctx.save(); ctx.translate(w.cx, w.cy);
    // тень под колесом
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(8, 16, R, R * 0.98, 0, 0, TAU); ctx.fill();
    // чаша: обод, золотая окантовка, наклонная дорожка шарика
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = rad(ctx, 0, 0, R * 0.7, R, [[0, '#4a2616'], [0.45, '#8a4c2c'], [0.8, '#6a3620'], [1, '#40200f']]); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.935, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,150,0.22)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.905, 0, TAU); ctx.fillStyle = rad(ctx, 0, 0, R * 0.72, R * 0.905, [[0, '#24100a'], [0.35, '#4c2616'], [0.7, '#6e3a22'], [1, '#3a1c10']]); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = lin(ctx, 0, -R, 0, R, GOLD); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.16)'; ctx.stroke();
    // восемь золотых «ромбов» на дорожке
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) * Math.PI / 4, x = Math.cos(a) * R * 0.868, y = Math.sin(a) * R * 0.868, d = R * 0.03;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + HALF);
      ctx.beginPath(); ctx.moveTo(0, -d * 1.5); ctx.lineTo(d, 0); ctx.lineTo(0, d * 1.5); ctx.lineTo(-d, 0); ctx.closePath();
      ctx.fillStyle = lin(ctx, -d, -d, d, d, GOLD); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.restore();
    }
    // вращающаяся часть
    ctx.save(); ctx.rotate(st.wheel);
    const rO = R * 0.745, rC = R * 0.635, rI = R * 0.5;
    ctx.beginPath(); ctx.arc(0, 0, rO + 3, 0, TAU); ctx.fillStyle = '#d7b25c'; ctx.fill();
    for (const c of COLOURS) {                                                 // клинья карманов одного цвета — одним путём
      ctx.beginPath();
      for (let i = 0; i < NP; i++) if (colourOf(POCKETS[i]) === c) sectorPath(ctx, rI, rO, pocketAngle(i) - PW / 2, pocketAngle(i) + PW / 2);
      ctx.fillStyle = WEDGE[c]; ctx.fill();
    }
    ctx.beginPath(); for (let i = 0; i < NP; i++) sectorPath(ctx, rI, rC, pocketAngle(i) - PW / 2, pocketAngle(i) + PW / 2);          // лунки чуть темнее
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, rC, 0, TAU); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,226,150,0.75)'; ctx.stroke();
    ctx.beginPath();                                                           // разделители между карманами
    for (let i = 0; i < NP; i++) { const a = pocketAngle(i) - PW / 2; ctx.moveTo(Math.cos(a) * rI, Math.sin(a) * rI); ctx.lineTo(Math.cos(a) * rO, Math.sin(a) * rO); }
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#f2dc9a'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rO, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = '#f0d27c'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rI, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = '#f0d27c'; ctx.stroke();
    // номера: верх цифры смотрит наружу
    const fs = Math.round(R * 0.058), nr = R * 0.69;
    ctx.font = font('bold', fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < NP; i++) {
      const a = pocketAngle(i);
      ctx.save(); ctx.translate(Math.cos(a) * nr, Math.sin(a) * nr); ctx.rotate(a + HALF);
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,10,20,0.85)'; ctx.strokeText(String(POCKETS[i]), 0, 1);
      ctx.fillStyle = CREAM; ctx.fillText(String(POCKETS[i]), 0, 1);
      ctx.restore();
    }
    // выигравший (или проигравший) карман подсвечен
    if (S.round && st.landed && ph !== 'pick') {
      const i = INDEX[S.round.number], a = clamp((ph === 'spin' && S.plan ? S.spinT - S.plan.T : S.phaseT + LAND_PAUSE) / 0.3, 0, 1), pulse = 0.65 + 0.35 * Math.sin(S.t * 6);
      ctx.beginPath(); sectorPath(ctx, rI, rO, pocketAngle(i) - PW / 2, pocketAngle(i) + PW / 2);
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(58,36,49,' + (0.8 * a).toFixed(3) + ')'; ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = (S.round.won ? 'rgba(255,230,120,' : 'rgba(255,110,90,') + (pulse * a).toFixed(3) + ')'; ctx.stroke();
    }
    // конус и ступица
    ctx.beginPath(); ctx.arc(0, 0, rI, 0, TAU);
    ctx.fillStyle = rad(ctx, 0, 0, R * 0.2, rI, [[0, '#f6e2a0'], [0.55, '#c99a44'], [1, '#7a4a22']]); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(58,36,49,0.45)';
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22); ctx.lineTo(Math.cos(a) * (rI - 4), Math.sin(a) * (rI - 4)); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.35, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(58,36,49,0.5)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.22, 0, TAU); ctx.fillStyle = rad(ctx, 0, 0, 2, R * 0.22, [[0, '#fff3c4'], [0.6, '#e7bd5a'], [1, '#9c6c24']], -R * 0.05, -R * 0.06); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {                                              // крест ступицы: лучше всего показывает вращение
      ctx.save(); ctx.rotate(k * HALF);
      ctx.beginPath(); ctx.moveTo(R * 0.06, 0); ctx.lineTo(R * 0.185, 0); ctx.lineWidth = R * 0.05; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = R * 0.03; ctx.strokeStyle = lin(ctx, 0, -R * 0.03, 0, R * 0.03, GOLD); ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, TAU); ctx.fillStyle = rad(ctx, 0, 0, 1, R * 0.07, [[0, '#ffffff'], [0.5, '#f0d27c'], [1, '#a9731f']], -R * 0.02, -R * 0.02); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.restore();
    // лаковый блик сверху слева
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.clip();
    const sh = ctx.createLinearGradient(-R * 0.7, -R * 0.9, R * 0.3, R * 0.2); sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.03)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
    ctx.restore();
    if (S.ballA > 0) drawBall(ctx, S, L, st);
  }
  function ballXY(w, st) {
    const r = st.r * w.R;
    return { x: w.cx + Math.cos(st.ball) * r, y: w.cy + Math.sin(st.ball) * r };
  }
  function drawBall(ctx, S, L, st) {
    const w = L.wheel, R = w.R, br = Math.max(5, R * 0.034), pop = EASE.outBack(clamp(S.spinT / 0.2, 0, 1));
    ctx.save(); ctx.globalAlpha *= S.ballA;
    // след: прежние положения шарика (чистая функция времени), чем быстрее бежит, тем ярче
    if (S.phase === 'spin' && S.plan) {
      const k = clamp((st.speed - 1.5) / 6, 0, 1);
      for (let i = 6; i >= 1; i--) {
        const t = S.spinT - i * 0.016; if (t < 0) continue;
        const p = ballXY(w, spinAt(S.plan, t));
        ctx.beginPath(); ctx.arc(p.x, p.y, br * (1 - i * 0.07), 0, TAU); ctx.fillStyle = 'rgba(255,248,235,' + (0.34 * k * (1 - i / 7)).toFixed(3) + ')'; ctx.fill();
      }
    }
    const p = ballXY(w, st), hz = st.z * (R / 262), rb = br * pop * (1 + hz / 30);
    ctx.beginPath(); ctx.ellipse(p.x + 2 + hz * 0.7, p.y + 3 + hz * 0.9, rb * 0.95, rb * 0.8, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,' + (0.38 - Math.min(0.2, hz * 0.012)).toFixed(3) + ')'; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, rb, 0, TAU); ctx.fillStyle = rad(ctx, p.x, p.y, 0.5, rb * 1.15, [[0, '#ffffff'], [0.55, '#ece6dc'], [1, '#a9a196']], -rb * 0.3, -rb * 0.35); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(58,36,49,0.8)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(p.x - rb * 0.35, p.y - rb * 0.4, rb * 0.3, rb * 0.2, -0.7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.restore();
  }

  // ---- стол: сукно с золотой окантовкой, плашка ставки, карточки цветов, плашки-сообщения, кнопки
  function drawPanel(ctx, L) {
    const p = L.panel;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; Ale.rr(ctx, p.x + 5, p.y + 12, p.w, p.h, 30); ctx.fill();
    Ale.rr(ctx, p.x, p.y, p.w, p.h, 30); ctx.fillStyle = rad(ctx, p.x + p.w / 2, p.y + p.h * 0.4, 20, p.w * 0.85, [[0, '#2f8b5f'], [1, '#175a3e']]); ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, p.x + 8, p.y + 8, p.w - 16, p.h - 16, 24); ctx.lineWidth = 4; ctx.strokeStyle = lin(ctx, 0, p.y, 0, p.y + p.h, GOLD); ctx.stroke();
    Ale.rr(ctx, p.x + 13, p.y + 13, p.w - 26, p.h - 26, 20); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(58,36,49,0.55)'; ctx.stroke();
  }
  function drawPlaque(ctx, S, L, T) {
    const r = L.plaque, lost = S.phase === 'lose';
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#2a1630'], [1, '#120a18']]); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    Ale.rr(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 10); ctx.lineWidth = 2; ctx.strokeStyle = S.phase === 'pick' ? 'rgba(255,214,102,0.9)' : 'rgba(240,200,90,0.45)'; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = font('bold', 15); ctx.fillStyle = 'rgba(255,224,150,0.85)'; ctx.fillText(T.labels.stake, r.x + 16, r.y + r.h / 2);
    const lw = ctx.measureText(T.labels.stake).width, value = T.labels.all + ' — ' + fmt(S.plaqueValue);
    ctx.textAlign = 'right';
    const size = fitFont(ctx, value, 'bold', 30, r.w - 52 - lw, 14);
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,170,40,0.22)'; ctx.strokeText(value, r.x + r.w - 16, r.y + r.h / 2 + 1);
    ctx.fillStyle = lost ? 'rgba(255,200,180,0.55)' : S.phase === 'pick' ? '#fff0a8' : '#ffc85a'; ctx.fillText(value, r.x + r.w - 16, r.y + r.h / 2 + 1);
    if (lost) {                                                                // проигрыш: сумма зачёркнута
      const tw = ctx.measureText(value).width, x1 = r.x + r.w - 16, y = r.y + r.h / 2 + 1;
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1 - tw - 6, y + size * 0.25); ctx.lineTo(x1 + 4, y - size * 0.25); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = '#ff6a5a'; ctx.stroke();
    }
  }
  // Фишка-диск цвета с множителем
  function drawDisc(ctx, colour, x, y, r, text, fs) {
    const d = DISC[colour];
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rad(ctx, x, y, 1, r * 1.1, [[0, d[0]], [0.6, d[1]], [1, d[2]]], -r * 0.3, -r * 0.35); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.55)'; ctx.setLineDash([r * 0.22, r * 0.2]); ctx.stroke(); ctx.setLineDash([]);
    if (text !== undefined) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font('bold', fs);
      ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y + 1); ctx.fillStyle = CREAM; ctx.fillText(text, x, y + 1);
    }
  }
  function drawCard(ctx, S, b) {
    const r = b.rect, sel = b.sel, pulse = 0.5 + 0.5 * Math.sin(S.t * 6), lift = sel ? -4 : 0, dim = !sel && S.phase !== 'pick' ? 0.55 : 1;
    ctx.save(); ctx.translate(0, lift); ctx.globalAlpha *= dim;
    if (sel) { Ale.rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, 24); ctx.fillStyle = 'rgba(255,214,102,' + (0.35 + 0.25 * pulse).toFixed(3) + ')'; ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, r.x + 2, r.y + 6, r.w, r.h, 18); ctx.fill();
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = sel ? lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#fff0c0'], [1, '#e9cf8c']]) : lin(ctx, 0, r.y, 0, r.y + r.h, [[0, '#f6ecd6'], [1, '#d7c8a4']]); ctx.fill();
    ctx.lineWidth = sel ? 6 : 5; ctx.strokeStyle = sel ? '#b8862a' : OUT; ctx.stroke();
    if (sel) { Ale.rr(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 19); ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.stroke(); }
    const cx = r.x + r.w / 2, dr = Math.min(32, r.w * 0.29);
    drawDisc(ctx, b.colour, cx, r.y + 18 + dr, dr, b.mult, Math.round(dr * 0.8));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, b.label, 'bold', 24, r.w - 16, 12); ctx.fillStyle = INK; ctx.fillText(b.label, cx, r.y + 18 + dr * 2 + 26);
    fitFont(ctx, b.prize, 'bold', 20, r.w - 16, 11); ctx.fillStyle = '#7a4a10'; ctx.fillText(b.prize, cx, r.y + r.h - 28);
    ctx.restore();
  }
  // Кнопка: подписи, клавиша слева (только на клавиатуре), выбор — золотая с обводкой и свечением (как у автомата)
  function drawButton(ctx, S, b) {
    const r = b.rect, touch = Ale.Input.lastDevice === 'touch', pulse = 0.5 + 0.5 * Math.sin(S.t * 6), sel = !!b.sel, two = !!b.sub;
    const lift = sel ? -3 : 0, rad2 = two ? 18 : r.h / 2;
    let fill = CREAM;
    if (sel || b.primary) { const h = sel ? pulse : 0; fill = 'rgb(255,' + Math.round(222 + 12 * h) + ',' + Math.round(140 + 40 * h) + ')'; }
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
      fitFont(ctx, b.label, 'bold', 26, tw, 16); ctx.fillStyle = INK; ctx.fillText(b.label, cx, r.y + r.h * 0.38);
      fitFont(ctx, b.sub, '600', 18, tw, 11); ctx.fillStyle = 'rgba(58,36,49,0.78)'; ctx.fillText(b.sub, cx, r.y + r.h * 0.74);
    } else { fitFont(ctx, b.label, 'bold', r.h >= 60 ? 28 : 22, tw, 16); ctx.fillStyle = INK; ctx.fillText(b.label, cx, r.y + r.h / 2 + 1); }
    ctx.restore();
  }
  // Плашка-сообщение по центру стола; disc — цветная фишка с номером слева
  function drawPill(ctx, cx, y, maxW, n) {
    const bad = n.tone === 'bad', good = n.tone === 'good', dr = n.disc ? 17 : 0;
    const sz = fitFont(ctx, n.text, 'bold', 24, maxW - 44 - (dr ? dr * 2 + 10 : 0), 13), tw = ctx.measureText(n.text).width, h = 44, w = tw + 44 + (dr ? dr * 2 + 10 : 0), x = cx - w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, x + 2, y - h / 2 + 6, w, h, h / 2); ctx.fill();
    Ale.rr(ctx, x, y - h / 2, w, h, h / 2); ctx.fillStyle = bad ? '#ffe3d6' : good ? '#fff3c4' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = bad ? '#a83a26' : good ? '#b8862a' : OUT; ctx.stroke();
    if (dr) drawDisc(ctx, n.disc.colour, x + 22 + dr, y, dr, String(n.disc.num), Math.round(dr * 0.95));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font('bold', sz); ctx.fillStyle = INK; ctx.fillText(n.text, dr ? x + 22 + dr * 2 + 10 + tw / 2 : cx, y + 1);
  }
  // Полоска «ВЫПАЛО» над колесом: последние номера фишками
  function drawHistory(ctx, S, L, T) {
    if (!S.rounds.length) return;
    const h = L.history, list = S.rounds.slice(-8), n = list.length, dr = 15, step = 38;
    ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = font('bold', 15);
    const lw = ctx.measureText(T.labels.pocket).width, tot = lw + 14 + n * step, x0 = L.wheel.cx - tot / 2, y = h.y + h.h / 2;
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(43,26,32,0.85)'; ctx.strokeText(T.labels.pocket, x0, y); ctx.fillStyle = 'rgba(255,224,150,0.92)'; ctx.fillText(T.labels.pocket, x0, y);
    list.forEach((r, i) => { drawDisc(ctx, r.colour, x0 + lw + 14 + i * step + dr, y, dr, String(r.number), 14); });
    ctx.restore();
  }
  function drawCoin(ctx, p) {
    const sx = Math.abs(Math.cos(p.rot)), rx = Math.max(1.6, p.r * sx), fade = clamp((p.life - p.age) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha *= fade;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, p.r, 0, 0, TAU); ctx.fillStyle = sx > 0.35 ? '#f6c945' : '#c8932a'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
    if (sx > 0.45) { ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 0.62, p.r * 0.62, 0, 0, TAU); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(160,110,20,0.8)'; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.3, p.y - p.r * 0.35, rx * 0.2, p.r * 0.16, -0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawControls(ctx, S, L, T) {
    drawPanel(ctx, L);
    drawPlaque(ctx, S, L, T);
    const btns = S.buttons(L), cards = S.cards(L);
    for (const c of cards) drawCard(ctx, S, c);
    const notes = S.notes();
    notes.forEach((n, i) => { const r = L.noteRows(notes.length)[i]; if (r) drawPill(ctx, r.cx, r.cy, r.w, n); });
    for (const b of btns) if (b.kind !== 'colour') drawButton(ctx, S, b);
    // строка управления
    const touch = Ale.Input.lastDevice === 'touch', lg = T.legend[{ pick: 'pick', spin: 'spin', offer: 'offer', win: 'end', lose: 'end', take: 'end' }[S.phase]];
    if (lg) {
      const s = Ale.tx(lg);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.85)';
      fitFont(ctx, s, '600', touch ? 20 : 18, L.W - 40, 12);
      ctx.strokeText(s, L.cx, L.legendY); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fillText(s, L.cx, L.legendY);
    }
  }

  function drawSession(ctx, S, W, H) {
    const L = layout(W, H), T = Ale.T.roulette, st = S.view();
    ctx.save();
    drawBackdrop(ctx, S, W, H);
    const e = EASE.outCubic(S.fade);
    ctx.globalAlpha = S.fade; ctx.translate(0, (1 - e) * 18);
    drawCaption(ctx, S, L, T);
    drawHistory(ctx, S, L, T);
    drawWheel(ctx, S, L, st);
    drawControls(ctx, S, L, T);
    for (const p of S.coins) drawCoin(ctx, p);
    ctx.restore();
  }

  // ================================================================== ОБЩИЙ ОБЪЕКТ
  Casino.rouletteLogic = logic;
  Casino.rouletteLayout = layout;
  Casino.RouletteSession = RouletteSession;
  Casino.ROULETTE_TIMING = { guard: GUARD, countT: COUNT_T, winT: WIN_T, loseT: LOSE_T, takeT: TAKE_T, skipAfter: SKIP_AFTER, skipSpin: SKIP_SPIN, ff: FF, landPause: LAND_PAUSE, tickGap: TICK_GAP, closeFade: CLOSE_FADE };
  // Сценарий: const q = Ale.Casino.roulette({ stake: 2000, consolation: 50 }); yield q; q.result. Возвращает объект с update() (true, когда экран закрылся) и result (null, пока экран не закрыт)
  Casino.roulette = function (opts) { const s = new RouletteSession(opts); s.music = 'roulette'; return Casino.start(s); };       // на время экрана — дорожка «roulette» (если запись есть)
})();
