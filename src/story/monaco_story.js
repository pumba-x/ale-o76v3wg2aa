// Сюжет Монако, берега и комнаты-сюрприза (docs/KYIV_MONACO_SPEC.md, разделы 9–13 и «Правки владельца к Монако»): казино (фишка, автомат с настоящей ставкой, джекпот), кража выигрыша, звонок Илюшкинсу и такси,
// берег (камни, китёныш, пещера), комната-сюрприз (семья, торт со свечами, пульт и Илюшкинс, титры). Весь текст — в Ale.T.monaco (src/text.js).
// Состояние хранится в state: casinoStage ('chipInBag' → 'chipInserted' → 'jackpot' → 'stolen'), casinoWin (сумма, €), casinoBet (ставка = цена фишки, 50 €), casinoSpins (сколько раз сыграла в рулетку: «тест на жадность»); флаги — taxi_paid, whale_seen, whale_greeted, cave_found, birthday_greeted, remote_taken,
// portal_opened, final_kiss_seen, cake_done. Выдача уникального выигрыша записывается сразу (и в контрольную точку): второго джекпота не бывает; кража — вместе с точкой afterTheft (после реплик), поэтому «Заново с последней точки» посреди кражи начинает её заново, а повторной кражи после точки не бывает.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const { env, paris, kyiv, goTo, tween, kiss, cue } = Ale.StoryKit;
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');            // 2 000
  const sign = (a, b) => (b >= a ? 1 : -1);

  // Брызги монет из лотка автомата: золотые кружки с силой тяжести (косметика, Ale.fxRng)
  function coins(sc, x, y, n) {
    const R = Ale.fxRng;
    for (let i = 0; i < n; i++) sc.fx.add({ shape: 'circle', x: x + R.range(-20, 20), y, vx: R.range(-170, 170), vy: -R.range(220, 520), g: 1500, drag: 0.4, size: R.range(4, 7), grow: -1.2, life: R.range(0.7, 1.2), color: R.chance(0.5) ? 'rgba(255,210,70,' : 'rgba(255,236,150,', fade: false });
  }
  const splash = (sc, x, y, n) => {
    const R = Ale.fxRng;
    for (let i = 0; i < n; i++) sc.fx.add({ shape: 'circle', x: x + R.range(-24, 24), y, vx: R.range(-120, 120), vy: -R.range(200, 460), g: 1100, drag: 0.5, size: R.range(3, 7), grow: -2, life: R.range(0.5, 0.9), color: 'rgba(170,215,245,', fade: true });
  };

  Ale.MonacoStory = {
    // =================================================================== улица у казино: приезд, ограда, кража, звонок, такси
    street(sc, entry) {
      const { G, F, UI, T, W, p, bubel } = env(sc);
      const M = T.monaco, X = Ale.MONACO_STREET, thief = sc.thief;
      paris(F); kyiv(F);
      const stage = () => G.state.casinoStage;
      const st = stage();
      const openGate = () => { sc.gate.open = 1; if (sc.gateSolid) { sc.world.remove(sc.gateSolid); sc.gateSolid = null; } };
      if (st === 'jackpot' || st === 'stolen') { openGate(); sc.door.arrow = false; }          // выигрыш получен: жёлтый маркер над дверью казино гаснет (он звал «зайти в казино», а цель уже другая — позвонить, сесть в такси; 18.10.2026)
      sc.kitHud = () => (stage() === 'jackpot' ? { sprite: 'it_cash', text: M.winHud + ': ' + fmt(G.state.casinoWin) + ' €', scale: 0.62 } : null);

      // ---- ограда: до выигрыша дальше казино не пройти; у ограды Бубел подсказывает, что делать (не чаще раза в 6 с)
      let gateCool = 0;
      sc.onTick = (dt) => {
        if (gateCool > 0) gateCool -= dt;
        if (sc.gateSolid && p.x > X.gate - 150 && gateCool <= 0 && !sc.locked && !UI.modal) { UI.hint('bubel', M.gate, 3); gateCool = 6; }
      };

      // ---- дверь казино и такси
      sc.onDoor = () => { G.goto('monacoCasino', 'start'); };
      sc.onTaxi = () => sc.runScript(takeTaxi);

      // ---- звонок Илюшкинсу: действие у Бубела (после кражи, пока перевод не сделан); потом — короткое повторение
      sc.onCall = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        p.pose = 'phone';                                                    // нарисованная поза «говорит по телефону» на время разговора
        yield UI.say(M.call);
        p.pose = null;
        G.remember('taxi_paid');
        UI.toast(T.toast.taxiPaid);
        G.checkpoint('monacoStreet', 'taxiReady', { heal: false });
        UI.setObjective(T.obj.taxi); UI.hint('bubel', M.taxiHint, 4.5);
        sc.taxiDoor.arrow = true;
        sc.callReady = false;                                                // звонок сделан: знак «Позвонить» над героиней гаснет (повторять незачем)
        sc.locked = false;
      });

      // ---- сесть в такси: открывается задняя дверь, они садятся, такси уезжает вправо; дальше короткий переезд вдоль берега
      function* takeTaxi() {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        const doorX = X.taxi - 52;
        yield [goTo(sc, p, doorX - 112, { speed: 190, arrive: 4 }, 8), goTo(sc, bubel, doorX - 150, { speed: 220, arrive: 4 }, 8)];
        p.facing = 1;
        yield tween(sc, 0.5, (k) => { sc.taxi.door = k; });
        yield [goTo(sc, p, doorX, { speed: 150, arrive: 4 }, 4), goTo(sc, bubel, doorX - 30, { speed: 150, arrive: 4 }, 4)];
        p.hidden = true; bubel.hidden = true; Ale.Audio.sfx('gate');
        yield W.time(0.25);
        yield tween(sc, 0.4, (k) => { sc.taxi.door = 1 - k; });
        yield W.time(0.35);
        let v = 0, last = sc.time;
        yield W.until(() => { const dt = Math.max(0, sc.time - last); last = sc.time; v = Math.min(520, v + 420 * dt); sc.taxi.dx += v * dt; return sc.taxi.dx > 640; });
        G.checkpoint('coast', 'start');
        G.goto('transit', 'coast', { fade: 0.9 });
      }

      // ---- кража: один раз, при выходе из казино с выигрышем
      function* theft() {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        p.holdSprite = 'it_cash';
        yield W.time(0.7);
        yield goTo(sc, p, X.door + 190, { speed: 165, arrive: 4 }, 3);       // два-три шага от дверей, камера показывает улицу
        p.facing = 1; p.vx = 0;
        yield W.time(0.25);
        // воришка сближается сзади (на полпути бормочет себе под нос), выхватывает пачку и бежит дальше вправо (оружия нет)
        const x0 = thief.x, target = p.x - 34; let greeted = false;
        thief.autoWalk(target, { speed: 340, arrive: 6 }); const t0 = sc.time;
        // на полпути он вполголоса, облачком (не диалогом) здоровается сам с собой (владелец 03.10.2026)
        yield W.until(() => { if (!greeted && thief.x > x0 + (target - x0) * 0.5) { greeted = true; UI.hint('thief', M.thiefGreet, 2.4); } return !thief.auto || sc.time - t0 > 4; });
        thief.auto = null; thief.x = Math.min(thief.x, p.x - 20);
        G.state.casinoStage = 'stolen';                                     // в этот миг: пачка исчезает у Алеси, появляется у него; в контрольную точку стадия попадёт вместе с точкой afterTheft (ниже): «Заново с последней точки» посреди кражи начинает её заново, а не пропускает вместе с репликами (18.10.2026)
        p.holdSprite = null; thief.carry = 'it_cash'; thief.facing = 1;
        UI.toast(T.toast.lostCash);
        p.startle(1); Ale.Audio.sfx('grab');
        thief.autoWalk(X.thiefOut, { speed: 470, arrive: 6 });
        yield W.time(0.35);
        p.facing = 1; UI.hint('ale', M.stop, 2.2);
        yield goTo(sc, p, p.x + 60, { speed: 200, arrive: 4 }, 1.2);        // один шаг вслед
        const t1 = sc.time;
        yield W.until(() => thief.x > X.thiefOut - 14 || sc.time - t1 > 5);
        thief.hidden = true; thief.dead = true;
        yield W.time(1.0);
        yield UI.say(M.afterTheft);
        G.checkpoint('monacoStreet', 'afterTheft', { heal: false });
        sc.callReady = true; UI.setObjective(T.obj.callIlya);
        sc.locked = false;
      }

      // ---- вход: сцена строится в нужном состоянии
      if (st === 'stolen') {                                               // выигрыш уже украден (загрузка, возвращение из казино): вора нет, сцена свободна
        thief.dead = true; thief.hidden = true; p.holdSprite = null;
        p.x = entry === 'arrival' ? X.start : X.door + (entry === 'afterTheft' || entry === 'taxiReady' ? 250 : 80); bubel.x = p.x - 70;
        if (F.taxi_paid) { UI.setObjective(T.obj.taxi); sc.taxiDoor.arrow = true; G.checkpoint('monacoStreet', 'taxiReady', { heal: false }); }
        else { sc.callReady = true; UI.setObjective(T.obj.callIlya); G.checkpoint('monacoStreet', 'afterTheft', { heal: false }); }
        return;
      }
      if (st === 'jackpot') {                                              // вышла с выигрышем: постановка кражи
        p.x = X.door + 40; bubel.x = p.x - 70; thief.facing = 1;
        sc.runScript(theft);
        return;
      }
      // до выигрыша: приезд или возвращение из казино без выигрыша
      thief.facing = 1;
      if (entry === 'arrival' || entry === 'start') {
        G.checkpoint('monacoStreet', 'arrival');
        UI.setObjective(T.obj.monacoCasino);
        if (!F.monaco_arrived) {
          sc.runScript(function* () {
            sc.locked = true; yield W.time(1.6);
            yield UI.say(M.arrive);
            G.remember('monaco_arrived'); sc.locked = false;
          });
        }
      } else {
        p.x = X.door + 70; bubel.x = p.x - 70; UI.setObjective(T.obj.monacoCasino);
      }
    },

    // =================================================================== казино: автомат с короной (фишка «стоит» 50 €, первый джекпот гарантирован) и рулетка у правого стола — «тест на жадность»
    casino(sc, entry) {
      const { G, F, UI, T, W, p, bubel, remember } = env(sc);
      const M = T.monaco, X = Ale.MONACO_CASINO;
      paris(F); kyiv(F);
      const stage = () => G.state.casinoStage;
      const spins = () => G.state.casinoSpins || 0;
      const ROUNDS = 3;                                                    // столько розыгрышей рулетки подряд выигрываются при любом цвете; четвёртый проигрывается
      const sync = () => { sc.slot.stage = stage() === 'stolen' ? 'jackpot' : stage(); };
      sync();
      if (stage() === 'jackpot' || stage() === 'stolen') sc.slot.pack = 0;
      const objective = () => UI.setObjective(stage() === 'chipInBag' ? T.obj.slotFind : stage() === 'chipInserted' ? T.obj.slotPull : T.obj.casinoExit);
      objective();
      sc.kitHud = () => (stage() === 'jackpot' ? { sprite: 'it_cash', text: M.winHud + ': ' + fmt(G.state.casinoWin) + ' €', scale: 0.62 } : null);
      sc.slotLabel = () => (stage() === 'chipInBag' ? M.insert : stage() === 'chipInserted' ? M.pull : null);
      if (stage() === 'jackpot') p.holdSprite = 'it_cash';                 // выигрыш в руке, пока не украден
      if (entry === 'inserted') { p.x = X.slotCrown - 200; bubel.x = p.x - 70; }             // контрольные точки внутри зала: сразу у нужного места
      if (entry === 'jackpot') { p.x = X.rouletteSpot - 260; bubel.x = p.x - 70; }

      // выход слева всегда доступен; уйти до выигрыша можно только обратно на улицу
      sc.onExit = () => {
        const s = stage();
        if (s === 'jackpot') G.checkpoint('monacoStreet', 'jackpotExit', { heal: false });             // с деньгами вышла на улицу: загрузка идёт на улицу, к краже
        G.goto('monacoStreet', s === 'jackpot' ? 'jackpotExit' : s === 'stolen' ? (F.taxi_paid ? 'taxiReady' : 'afterTheft') : 'fromCasino');
      };

      // Крупье: нарисованная поза на время реплики (croupierFigure берёт её из sc.croupierPose: 'rest' — руки на столе, 'invite', 'regret', 'bow')
      sc.croupierPose = 'rest';
      const croupierDo = (pose, secs) => sc.runScript(function* () { sc.croupierPose = pose; yield W.time(secs); if (sc.croupierPose === pose) sc.croupierPose = 'rest'; });

      // Бубел замечает корону, когда героиня подходит к нужному автомату (один раз)
      let hinted = false, again = false;
      sc.onTick = () => {
        if (!hinted && stage() === 'chipInBag' && Math.abs(p.x - X.slotCrown) < 360 && !sc.locked && !UI.modal) { hinted = true; UI.hint('bubel', M.crownHint, 3.6); }
        // крупье зовёт ещё раз, когда героиня проходит мимо стола, не сыграв (один раз)
        if (!again && sc.time > 8 && stage() === 'jackpot' && spins() === 0 && p.x > X.rouletteSpot - 330 && !sc.locked && !UI.modal && !UI.dlg) { again = true; UI.hint('croupier', M.croupierAgain, 3); croupierDo('invite', 3); }
      };

      sc.onSlot = (id, crown) => {
        if (!crown) { Ale.Audio.sfx('locked'); sc.fx.text(id === 'slotLeft' ? X.slotLeft : X.slotRight, 330, stage() === 'chipInBag' ? M.slotWrong : M.slotNoCrown, { size: 22 }); return; }       // «Эта фишка…» — пока фишка в сумке; потом её там уже нет
        const s = stage();
        if (s === 'jackpot' || s === 'stolen') { Ale.Audio.sfx('locked'); sc.fx.text(X.slotCrown, 330, M.slotPlayed, { size: 22 }); return; }
        sc.runScript(s === 'chipInBag' ? insert : pull);
      };

      function* stand() {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        yield goTo(sc, p, X.slotCrown - 84, { speed: 190, arrive: 4 }, 5);
        p.facing = 1; p.vx = 0;
      }
      // первое действие: фишка уходит из руки в приёмник; состояние сохраняется; потом сами идут рычаг и экран автомата (pull), героиня при этом не отпускается
      function* insert() {
        yield* stand();
        yield W.time(0.2);
        yield tween(sc, 0.45, (k) => { sc.slot.insert = k; });
        remember('casinoStage', 'chipInserted'); sync();
        Ale.Audio.sfx('pickup'); UI.toast(T.toast.chipIn.replace('{n}', fmt(X.stake) + ' €'));
        G.checkpoint('monacoCasino', 'inserted', { heal: false });
        objective();
        yield W.time(0.5);
        yield* pull();                                                     // без второго нажатия: через секунду после вставки фишки рычаг и экран автомата открываются сами (владелец 11.10.2026)
      }
      // второе действие (идёт следом само; отдельное нажатие нужно, только если она «отошла» от автомата, не крутнув: тогда подпись «Потянуть рычаг»): рычаг. Экран автомата — Ale.Casino.slots: ставка одна (фишка стоит 50 €), первый розыгрыш — три короны, «Рискнуть» нет (рисковать можно только у рулетки); результат фиксируется атомарно
      function* pull() {
        yield* stand();
        yield W.time(0.15);
        yield tween(sc, 0.3, (k) => { sc.slot.lever = k; });
        const q = Ale.Casino ? Ale.Casino.slots({ jackpot: true, bet: X.stake, noRisk: true }) : null;
        if (q) yield q;
        const r = q ? q.result : { cancelled: false, bet: X.stake, amount: X.stake * 40, risked: 0, rounds: 1, lost: false };    // без модуля автомата — выигрыш по умолчанию
        if (!r || r.cancelled) {                                              // передумала: рычаг возвращается, фишка остаётся в автомате
          yield tween(sc, 0.3, (k) => { sc.slot.lever = 1 - k; });
          sc.locked = false; return;
        }
        // атомарно: стадия, сумма и точка загрузки (зал казино после выигрыша: крупье зовёт к рулетке) записываются в один миг
        remember('casinoStage', 'jackpot'); remember('casinoWin', r.amount); remember('casinoBet', r.bet); remember('casinoSpins', 0); sync();
        G.checkpoint('monacoCasino', 'jackpot', { heal: false });
        // видимая выдача: лоток, монеты, пачка у героини
        sc.slot.spin = false;
        coins(sc, X.slotCrown, 540, 26); Ale.Audio.sfx('pickup');
        yield tween(sc, 0.5, (k) => { sc.slot.pack = k; sc.slot.glow = k; });
        yield W.time(0.5);
        sc.slot.pack = 0;
        p.holdSprite = 'it_cash'; UI.toast(T.toast.gotCash);
        objective();                                                        // выигрыш получен — цель «Выйти из казино» (не «Потянуть рычаг» над репликами о выигрыше)
        yield tween(sc, 0.3, (k) => { sc.slot.lever = 1 - k; });
        yield W.time(0.4);
        yield UI.say(M.win);
        yield Ale.Cards.show('still_08c_casino_jackpot', { once: true });          // после выигрыша и реплик — открытка (с 13.10.2026 полноэкранная)
        sc.locked = false;
        callToTable();
      }

      // ---- «нас зовут»: крупье окликает героиню облачком над столом, потом Бубел напоминает, что они уже выиграли (облачко, не диалог)
      function callToTable() {
        sc.runScript(function* () {
          yield W.time(0.6);
          if (stage() !== 'jackpot' || spins() > 0) return;
          UI.hint('croupier', M.croupierCall, 3.6); croupierDo('invite', 3.6);
          yield W.time(4.4);
          if (stage() === 'jackpot' && spins() === 0 && !UI.modal) UI.hint('bubel', M.bubelEnough, 3);
        });
      }

      // ---- рулетка (тест на жадность): играть можно только на всё; три розыгрыша подряд — выигрыш при любом цвете, четвёртый — проигрыш и утешительный приз (ставка 50 €)
      sc.rouletteOpen = () => stage() === 'jackpot' && spins() <= ROUNDS;
      if (entry === 'jackpot' && spins() === 0) callToTable();
      sc.onRoulette = () => {
        if (!sc.rouletteOpen()) { Ale.Audio.sfx('locked'); sc.fx.text(X.roulette, 330, M.rouletteClosed, { size: 22 }); return; }
        sc.runScript(playRoulette);
      };
      function* playRoulette() {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        sc.rouletteVisited = true;
        yield goTo(sc, p, X.rouletteSpot, { speed: 190, arrive: 4 }, 6);
        p.facing = 1; p.vx = 0;
        yield W.time(0.2);
        const q = Ale.Casino && Ale.Casino.roulette ? Ale.Casino.roulette({ stake: G.state.casinoWin, played: spins(), winStreak: ROUNDS, consolation: G.state.casinoBet || X.stake }) : null;
        if (q) yield q;
        const r = q ? q.result : null;
        if (!r || r.cancelled || !r.plays) { sc.locked = false; return; }              // отошла от стола, не сыграв: сумма и счётчик прежние
        // атомарно: сумма, счётчик розыгрышей и точка загрузки
        remember('casinoWin', r.amount); remember('casinoSpins', spins() + r.plays);
        G.checkpoint('monacoCasino', 'jackpot', { heal: false });
        yield W.time(0.5);
        if (r.lost) { sc.croupierPose = 'regret'; yield UI.say(M.rouletteLose.map((l) => [l[0], l[1].replace('{n}', fmt(r.amount) + ' €'), l[2]])); sc.croupierPose = 'rest'; }
        else { UI.hint('croupier', M.rouletteBye, 2.6); croupierDo('bow', 2.6); }
        objective();
        sc.locked = false;
      }
    },

    // =================================================================== берег: камни над водой, китёныш, скрытый вход
    coast(sc, entry) {
      const { G, F, UI, T, W, p, bubel, remember } = env(sc);
      const M = T.monaco, X = Ale.COAST, whale = sc.whale;
      paris(F); kyiv(F); F.taxi_paid = true; F.monaco_arrived = true;
      const SK = X.stones;
      p.holdSprite = null;
      const stoneAt = (x) => { for (let i = SK.length - 1; i >= 0; i--) if (x >= SK[i][0] && x <= SK[i][1]) return i; return -1; };
      let lastDry = { x: X.start, y: X.road };
      let dryT = 0, lastLag = 0;

      // ---- падение в воду: возвращение на последний сухой камень, без потери сердца (бросок «упала» без анимации смерти)
      const nearestStone = (x) => { let best = 0, bd = 1e9; for (let i = 0; i < SK.length; i++) { const d = x < SK[i][0] ? SK[i][0] - x : x > SK[i][1] ? x - SK[i][1] : 0; if (d < bd) { bd = d; best = i; } } return best; };
      const rescue = (who, ref, quiet) => {
        const i = stoneAt(ref.x), s = SK[i >= 0 ? i : nearestStone(ref.x)];
        who.x = Ale.clamp(ref.x, s[0] + 36, s[1] - 36); who.y = s[2]; who.vx = 0; who.vy = 0;
        if (!quiet) splash(sc, who.x, X.waterY, 10);
      };
      sc.onTick = (dt) => {
        if (p.onGround && p.ground && p.ground.kind === 'stone' && p.state === 'free') {
          dryT += dt;
          if (dryT > 0.08) { const s = SK[p.ground.i]; if (s && s[1] - s[0] >= 60) lastDry = { x: Ale.clamp(p.x, s[0] + 36, s[1] - 36), y: s[2] }; }       // последний камень, на котором она стояла (даже мимоходом)
        } else dryT = 0;
        if (p.y > X.sink && p.state !== 'dead') {
          splash(sc, p.x, X.waterY, 14); Ale.Audio.sfx('splash');
          rescue(p, lastDry); p.invul = 0.8; p.sq.x = 1.1; p.sq.y = 0.9;
          sc.fx.text(p.x, p.y - 150, M.splash, { size: 24, color: '#bfe3ff' });
          UI.clearHints();
        }
        if (bubel.y > X.waterY - 12) rescue(bubel, { x: p.x - p.facing * 50, y: p.y }, true);          // запасной возврат (Бубел сам прыгает по камням и не падает): тихо, без брызг
        // китёныш держится впереди, но не отрывается: ждёт, если героиня отстала больше чем на 250 юнитов (после знакомства)
        if (F.whale_greeted && !F.cave_found) {
          const want = Ale.clamp(p.x + 230, 1900, X.cave - 70);
          if (whale.x - p.x > 250 && whale.x < X.cave - 100) { whale.hover(); lastLag += dt; if (lastLag > 7 && !sc.locked && !UI.modal) { UI.hint('bubel', M.whaleWait, 2.6); lastLag = 0; } }
          else { lastLag = 0; if (whale.arrived || Math.abs((whale.target === null ? whale.x : whale.target) - want) > 60) whale.swimTo(want, 120); }
        }
      };

      // ---- вход в пещеру: ведёт в комнату; найденный вход остаётся открытым
      sc.onCave = () => { G.goto('birthdayRoom', 'start'); };

      const openCave = () => { sc.coast.caveGlow = 1; sc.cave.arrow = true; };
      if (entry === 'caveFound' || F.cave_found) {                         // загрузка: вход открыт, китёныш у скал
        F.cave_found = true; F.whale_greeted = true; F.whale_seen = true;
        p.x = X.cave - 110; p.y = SK[SK.length - 1][2]; bubel.x = p.x - 60; bubel.y = p.y; lastDry = { x: p.x, y: p.y };       // на камне F у входа (раньше стояла над разрывом и падала в воду)
        whale.x = X.cave - 80; whale.baseY = X.waterY - 22; whale.hover(); whale.facing = 1;
        openCave(); UI.setObjective(T.obj.cave);
        G.checkpoint('coast', 'caveFound', { heal: false });
        return;
      }
      G.checkpoint('coast', 'start');
      UI.setObjective(T.obj.coastDown);

      // ---- китёныш: после того как Бубел его заметил, он подплывает к широкому камню; действие «Погладить» доступно у воды
      const pet = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        whale.canPet = false;
        yield goTo(sc, p, X.petX, { speed: 170, arrive: 4 }, 5);
        p.facing = 1; p.vx = 0;
        whale.swimTo(X.whalePet, 140); yield W.until(() => whale.arrived || false);
        whale.facing = -1;
        p.pose = 'crouch'; yield W.time(0.5);
        whale.nuzzle(); splash(sc, whale.x - 20, X.waterY, 9);                          // брызги только картинкой: фонового «шлепка» нет (владелец 03.10.2026)
        sc.fx.hearts(p.x + 40, p.y - 110, 3);
        yield W.time(1.5);
        p.pose = null;
        G.set('whale_greeted');                                            // тоже не в контрольную точку: после перезапуска знакомство проходит заново вместе с подсказкой Бубела
        yield Ale.Cards.show('still_08d_coast_whale', { once: true });             // после знакомства с китёнышем — открытка (с 13.10.2026 полноэкранная)
        UI.hint('bubel', M.whaleCome, 3.4);
        UI.setObjective(T.obj.whaleFollow);
        whale.swimTo(1960, 120);
        sc.locked = false;
      });
      whale.onPet = pet; whale.label = M.pet;

      sc.runScript(function* () {
        // ---- первая подсказка: у первого разрыва Бубел напоминает, что через воду надо прыгать (один раз)
        yield W.until(() => p.x >= X.stones[3][0] - 230 && !sc.locked && !UI.modal);
        if (!F.coast_hint_seen) { UI.hint('bubel', M.coastHint, 4); G.remember('coast_hint_seen'); }
        // ---- китёныш: он плавал здесь с первого кадра; на широкой площадке Бубел его замечает, теперь к нему можно подойти (глоток баблти на берегу убран: он теперь в парке)
        yield W.until(() => p.x >= X.seeX && p.onGround && p.state === 'free' && !sc.locked && !UI.modal && !F.whale_seen);
        G.set('whale_seen');                                               // не remember: ожидание выше стоит на !F.whale_seen, а перезапуск с контрольной точки берёт флаги из неё — берег оставался без «Погладить» и без пещеры (11.10.2026)
        yield W.time(0.3);
        yield UI.say(M.whaleSeen);
        whale.swimTo(X.whalePet, 110);
        whale.canPet = true; UI.setObjective(T.obj.whale);
        // ---- у скал он приводит к входу: открывается подсветка и действие «Войти»
        yield W.until(() => F.whale_greeted && whale.x > X.cave - 130 && p.x > X.cave - 340 && !sc.locked && !UI.modal);
        sc.locked = true; p.auto = null; p.vx = 0;
        whale.hover(); whale.facing = 1; whale.flick();
        yield tween(sc, 0.8, (k) => { sc.coast.caveGlow = k; });
        yield UI.say(M.cave);
        G.remember('cave_found'); sc.cave.arrow = true;
        G.checkpoint('coast', 'caveFound', { heal: false });
        UI.setObjective(T.obj.cave);
        sc.locked = false;
      });
    },

    // =================================================================== комната-сюрприз: поздравление, свободное пребывание, торт, пульт, Илюшкинс, титры
    room(sc, entry) {
      const { G, F, UI, T, W, p, bubel, remember } = env(sc);
      const M = T.monaco, X = Ale.BIRTHDAY_ROOM, ily = sc.ilya;
      paris(F); kyiv(F); F.taxi_paid = true; F.monaco_arrived = true; F.whale_seen = true; F.whale_greeted = true; F.cave_found = true;
      const family = [sc.marina, sc.mother, sc.father, sc.grandfather];
      // нарисованные позы семьи: на каждой реплике поздравления говорящий делает свой жест, на последней хлопают все; на ответах после поздравления — жест у тех, у кого он подходит
      const CLAP = { mother: 'mom_clap', father: 'dad_clap', grandfather: 'gra_clap', marina: 'mar_clap' };
      const GEST = { mother: 'mom_open', father: 'dad_thumbs', grandfather: 'gra_heart', marina: 'mar_wave' };
      const TALK_GEST = { mother: 'mom_open', father: 'dad_thumbs', grandfather: 'gra_heart' };
      const gesture = (kind) => () => { for (const r of family) r.pose = kind && r.kind === kind ? GEST[kind] : null; };       // жест у говорящего, остальные стоят
      const allClap = () => { for (const r of family) r.pose = CLAP[r.kind]; };
      const cam = { x: X.camera, y: 600, vx: 0 };
      sc.remoteReady = false; sc.cakeReady = false; sc.finishReady = false;
      let freeOn = false;                                                  // свободное пребывание включено (после поздравления)
      // снимок очками доступен один раз и только когда в комнате все, кого он должен показать: пришёл Илюшкинс (портал открыт); повторного снимка нет (владелец 03.10.2026)
      Object.defineProperty(sc, 'photoReady', { get: () => freeOn && !!F.portal_opened && !F.photo_taken, configurable: true });

      // ---- что можно делать после поздравления
      sc.remoteLabel = () => (F.remote_taken ? M.remotePress : M.remoteTake);
      const enableFree = () => {
        for (const r of family) { r.pose = null; r.noTalk = false; r.onTalk = () => sc.runScript(function* () { sc.locked = true; UI.clearHints(); r.pose = TALK_GEST[r.kind] || null; yield UI.say(M.relatives[r.kind]); r.pose = null; sc.locked = false; }); }
        sc.remoteReady = !F.portal_opened; sc.cakeReady = !F.cake_done; sc.finishReady = true; freeOn = true;
        UI.setObjective(T.obj.roomFree);
      };
      // когда сделано всё необязательное (торт, портал, снимок), финальное меню предлагается ещё раз: из свободного пребывания всегда есть выход (владелец 03.10.2026: «застрял»)
      function* afterActivity() {
        if (F.cake_done && F.portal_opened && F.photo_taken && !F.final_menu_again) {
          G.remember('final_menu_again'); UI.setObjective(T.obj.roomDone);
          yield W.time(1.4);
          if (!UI.menu && !UI.modal) finalMenu();
        }
      }
      for (const r of family) r.noTalk = true;

      // ---- Илюшкинс (после портала): выбор «Поцеловать» / «Побыть рядом»; позже можно вернуться к выбору
      function* ilyaChoice(word) {
        const q = UI.say([['ilyushkins', word || M.ilyaWord, { choices: [{ text: M.ilyaKiss }, { text: M.ilyaStay }] }]]); yield q;
        if (q.choice === 0) {
          yield* kiss(sc, p, ily);
          G.remember('final_kiss_seen');
          yield UI.say(M.ilyaAfterKiss);
        } else yield UI.say(M.ilyaAfterStay);
      }
      const ilyaTalk = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        if (F.final_kiss_seen) yield UI.say(M.ilyaAfterKiss); else yield* ilyaChoice(M.ilyaWordAgain);       // «Конечно.» — ответ на «Ты всё-таки добрался.» (первый раз); при повторном разговоре его ни о чём не спрашивали
        sc.locked = false;
      });
      const showIlya = () => { ily.hidden = false; ily.noTalk = false; ily.onTalk = ilyaTalk; ily.mode = 'stay'; };
      if (F.portal_opened) { showIlya(); ily.x = X.ilyaOut - 60; }

      // ---- пульт: первое действие — взять (появляется в руке), второе, отдельное, — нажать кнопку; открывается портал, выходит один Илюшкинс
      sc.onRemote = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        if (!F.remote_taken) {
          sc.room.remote = false; G.remember('remote_taken'); p.holdSprite = 'it_remote'; UI.toast(T.toast.gotRemote);
          yield W.time(0.4); yield UI.say(M.remoteNote);
          sc.locked = false; return;
        }
        sc.remoteReady = false;
        Ale.Audio.sfx('ui2'); yield W.time(0.35);
        yield tween(sc, 1.2, (k) => { sc.room.portal = k; });
        Ale.Audio.sfx('fanfare');
        G.remember('portal_opened'); p.holdSprite = null;
        ily.hidden = false; ily.x = X.portal - 20; ily.facing = -1; ily.mode = 'stay'; ily.keepFacing = true;
        yield goTo(sc, ily, X.ilyaOut - 70, { speed: 130, arrive: 4 }, 4);          // два шага к Алесе
        ily.keepFacing = false;
        showIlya();
        yield tween(sc, 0.9, (k) => { sc.room.portal = 1 - k * 0.65; });
        yield UI.say(cue(M.ilyaGreet, { 0: () => { ily.pose = 'ily_open'; }, 1: () => { ily.pose = null; } }));       // «С днём рождения, магнусик.» — руки раскрыты
        ily.pose = null;
        yield* ilyaChoice();
        yield tween(sc, 1.0, (k) => { sc.room.portal = 0.35 * (1 - k); });
        sc.locked = false;
        yield* afterActivity();
      });

      // ---- снимок очками Ray-Ban Meta (подарок из Киева): один раз и только когда в комнате все (пришёл Илюшкинс); показывается последняя тайная картина «снимок от первого лица» —
      // still_10_glasses_photo (пока её нет — прежний «полароид» из кадра сцены); героиня подходит к месту сама, телепорта нет
      sc.onPhoto = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        yield goTo(sc, p, X.photo, { speed: 170, arrive: 5 }, 5);
        p.facing = 1; p.vx = 0; yield W.time(0.35);
        G.remember('photo_taken');
        p.pose = 'glasses';                                               // очки на лице: нарисованная поза
        if (Ale.Cards && Ale.Cards.has('still_10_glasses_photo')) {
          Ale.Audio.sfx('shutter'); sc.fx.ring(p.x + 24, p.y - 120, 60, 'rgba(255,255,255,'); yield W.time(0.45);
          yield Ale.Cards.show('still_10_glasses_photo', { once: true });
        } else yield Ale.Photo.play(sc, M.photoCaption);                  // вспышку и затвор показывает сам снимок
        p.pose = null;
        yield UI.say(cue(M.photoDone, { 0: () => { sc.marina.pose = 'mar_wave'; }, 1: () => { sc.marina.pose = null; } }));       // «Покажи!» — Марина машет обеими руками
        sc.marina.pose = null;
        sc.locked = false;
        yield* afterActivity();
      });

      // ---- торт: удерживать действие — дуть; свечи гаснут одна за другой (необязательная мини-игра)
      sc.onCake = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0; sc.cakeReady = false;
        yield goTo(sc, p, X.table - 120, { speed: 180, arrive: 5 }, 5);
        p.facing = 1; p.vx = 0; p.pose = 'crouch';
        UI.tip({ title: M.cake, text: Ale.tx(M.cakeHold), kb: [['E']], touch: [['!']] }); sc.holdInteract = true;       // кнопка «!» на сенсорном экране остаётся на всё время дутья
        let lit = sc.room.candles, last = sc.time; const t0 = sc.time;
        yield W.until(() => {
          const dt = Math.max(0, sc.time - last); last = sc.time;
          if (Ale.Input.down('interact')) { lit -= dt * 15; if (Math.floor(lit) !== Math.floor(lit + dt * 15) && Ale.fxRng.chance(0.5)) sc.fx.puff(X.table + Ale.fxRng.range(-30, 30), 450, 1, 0, {}); }
          else lit = Math.min(sc.room.candles + 0, lit + dt * 3);
          sc.room.candles = Math.max(0, Math.ceil(lit));
          if (sc.time - t0 > 28) lit = 0;                                  // не держать в тупике: через полминуты свечи гаснут сами
          return lit <= 0;
        });
        sc.room.candles = 0;
        UI.tipDone(); sc.holdInteract = false;
        p.pose = null;
        sc.fx.confetti(X.table, 520, 60); Ale.Audio.sfx('fanfare');
        G.remember('cake_done');
        yield W.time(0.5);
        yield UI.say(M.cakeDone);
        sc.locked = false;
        yield* afterActivity();
      });

      // ---- финальное меню: «Остаться» / «Титры» / «В главное меню» (титры закрываются, комната остаётся)
      const finalMenu = () => UI.openMenu([
        { label: M.menu.stay, action: () => UI.closeMenu() },
        { label: M.menu.credits, action: () => { UI.closeMenu(); sc.runScript(function* () { yield Ale.Credits.play(); finalMenu(); }); } },
        { label: M.menu.title, action: () => { UI.closeMenu(); G.toTitle(); } },
      ], { title: T.title.dedication, onBack: () => UI.closeMenu() });
      sc.finalMenu = finalMenu;
      sc.playCredits = () => sc.runScript(function* () { yield Ale.Credits.play(); });

      // ---- вход: сцена строится в нужном состоянии
      if (F.birthday_greeted || entry === 'free') {
        F.birthday_greeted = true;
        sc.music = 'finale';
        p.x = X.free; bubel.x = p.x - 70;
        for (const r of family) r.facing = Math.sign(p.x - r.x) || -1;
        sc.room.remote = !F.remote_taken; if (F.cake_done) sc.room.candles = 0;
        enableFree();
        G.checkpoint('birthdayRoom', 'free', { heal: false });
        return;
      }
      sc.runScript(function* () {
        sc.locked = true; p.auto = null; sc.cameraTarget = cam;
        yield W.time(0.9);
        yield goTo(sc, p, X.walkTo, { speed: 150, arrive: 6 }, 5);
        p.facing = 1; yield W.time(0.9);                                    // короткая остановка: группа раскрыта
        Ale.Audio.music('finale');                                          // песня начинается с первой поздравительной реплики и не перезапускается
        yield UI.say(cue(M.greet, { 0: gesture('mother'), 1: gesture(null), 2: gesture('father'), 3: gesture('grandfather'), 4: gesture('marina'), 5: allClap }));
        yield Ale.Cards.show('still_09_birthday', { once: true });
        G.remember('birthday_greeted');
        G.checkpoint('birthdayRoom', 'free', { heal: false });
        enableFree();
        sc.cameraTarget = null; sc.locked = false;
        yield W.time(0.6);
        finalMenu();
      });
    },
  };
})();
