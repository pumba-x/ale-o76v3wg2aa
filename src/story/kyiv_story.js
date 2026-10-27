// Сюжет Киева (docs/KYIV_MONACO_SPEC.md, разделы 3–8 и «Правки владельца 03.10.2026»): переход с тараканами и длинной историей Антіна, встреча с Илюшкинсом у фонтана (баблти, очки Ray-Ban Meta,
// поцелуй и открытка), смс по дороге через парк, шахматы с Димасиком (мат в два хода), бой с Димасиком на площадке, проводы у такси (колбаса в дорогу, поцелуй).
// Весь текст — в Ale.T.kyiv (src/text.js). Просмотренное (приезд, Антін, встреча, шахматы, вступление Димасика, победа) записывается и в контрольную точку: после поражения не повторяется.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const { KISS, env: baseEnv, paris, goTo, tween, kiss, cue, face } = Ale.StoryKit;       // общие помощники сценариев: src/story/kit.js
  const env = (sc) => Object.assign(baseEnv(sc), { K: Ale.T.kyiv });

  Ale.KyivStory = {
    // =================================================================== переход: тараканы и Антін
    approach(sc, entry) {
      const { G, F, UI, T, K, W, p, remember } = env(sc);
      const antin = sc.antin;
      paris(F);
      if (G.state.tomatoes < 3) G.state.tomatoes = 3;                    // помидоры переносятся из Парижа; для прохождения не обязательны
      G.checkpoint('kyivApproach', entry === 'river' ? 'river' : 'start');                                   // «river» — точка перед заплывом: «Продолжить» не гонит игрока снова через открытку и разговор
      UI.setObjective(T.obj.kyivWalk);
      sc.onExit = () => { G.checkpoint('kyivPark', 'start'); G.goto('kyivPark', 'start'); };

      // Он говорит и тогда, когда Алеся уже отошла: облачком над ним, пока она в пределах слышимости (не диалог, мир не останавливается)
      let mutterBusy = false;                                              // два бормотания подряд; если с ним заговорили снова, а прежние ещё идут, второй поток не запускается
      const mutter = () => { if (mutterBusy) return; mutterBusy = true; sc.runScript(function* () {
        for (let i = 0; i < 2; i++) {
          yield W.until(() => !sc.locked && !UI.modal && Math.abs(p.x - antin.x) > 260 && Math.abs(p.x - antin.x) < 760);
          const lines = G.state.antinOutcome === 'left' ? K.antinMutterLeft : K.antinMutterDone;          // исход мог измениться, пока она была рядом (ушла, потом заговорила снова и дослушала): строка выбирается в момент показа
          UI.hint('antin', lines[i % lines.length], 2.8);
          yield W.time(5);
        }
        mutterBusy = false;
      }); };

      // ---- Антін: необязательный и длинный разговор (три действия, на каждом можно уйти: «Мне пора»); после ухода или полного рассказа он больше не начинается с начала
      let antinNext = 1;                                                   // с какого действия рассказ продолжится, если заговорить снова: ушла на развилке i — со следующего (в пределах сцены)
      antin.onTalk = () => sc.runScript(function* () {
        UI.clearHints(); sc.locked = true; p.auto = null;
        const ACTS = [[K.antinStart, K.antinLeave, K.antinAfterLeave[0]], [K.antinStory1, K.antinLeave1, K.antinAfterLeave[1]], [K.antinStory2, K.antinLeave2, null]];     // [реплики с выбором, уход, слова Бубел после ухода (на третьей развилке они уже внутри ухода)]
        let first = 0;
        if (F.antin_done) {
          if (G.state.antinOutcome !== 'left') { yield UI.say(K.antinAgainDone); sc.locked = false; return; }          // дослушала до конца — только про чай
          yield UI.say(K.antinAgainLeft);                                  // отказалась раньше, а теперь заговорила снова (владелец 03.10.2026): он продолжает с непрослушанного действия (ушла на первой развилке — со второго), уйти можно опять
          first = Math.max(1, antinNext);
        }
        let outcome = 'listened';
        for (let i = first; i < ACTS.length; i++) {
          const [lines, leave, bubelAfter] = ACTS[i];
          const q = UI.say(lines); yield q;
          if (q.choice === 1) {                                            // «Мне пора»: разговор обрывается, он продолжает говорить вслед
            yield UI.say(leave);
            if (bubelAfter) yield UI.say(bubelAfter);
            outcome = 'left'; antinNext = i + 1; break;
          }
        }
        if (outcome === 'listened') yield UI.say(K.antinStory3);           // в конце — про чай и деньги
        remember('antinOutcome', outcome); G.remember('antin_done');
        sc.locked = false;
        mutter();
      });

      // Подводка к заплыву (владелец 09.10.2026, переделана вечером): герои идут слева направо по длинному пляжу (камера за ними) и говорят фоново (облачками, мир идёт); у воды Алеся
      // спрашивает «что же делать?», Бубел говорит «есть идея», берёт в зубы весло, которое там просто валялось, и приносит; Алеся решает — решительно и со смешным драматизмом — импровизировать
      // и встаёт на бревно; Бубел не боится: прыгает следом. Всё действие — Ale.RiverStage (src/river_stage.js), тексты — T.kyiv.river*; музыка заплыва вступит только после этого (River.play).
      // Бревна и весла на экране в начале нет: они лежат дальше по берегу и показываются, когда камера до них доходит
      const hint = (l) => UI.hint(l[0], l[1], l[2]);
      function* riverLead(run) {
        const st = run.stage, walk = run.act('enter');                     // идут слева направо ≈ 12 с; плашка «Киев — Берег Днепра» висит над ними
        yield W.time(1.0); hint(K.riverChat[0]);                           // на ходу два облачка по очереди, не друг на друге (11.10.2026: текст сжат, остальное время они идут молча)
        yield W.time(4.4); hint(K.riverChat[1]);
        yield walk; yield W.time(1.0);                                     // дошли до воды
        UI.clearHints();
        yield UI.phone(K.smsArrive);                                       // он просит не лезть, она отвечает «Не надо. Я сама.»
        hint(K.riverWhat[0]); yield W.time(1.6);                           // «Есть идея.»
        const fetch = run.act('fetch');                                    // Бубел бежит к веслу, наклоняется, берёт за середину и приносит
        yield () => st.bub.mode === 'present' || st.done.fetch;
        hint(K.riverOar[0]);                                               // «Нашла.»
        yield fetch;                                                       // уронила весло у ног Алеси
        yield run.act('pick');                                             // она присела, подняла и встала с веслом
        yield W.time(0.2); hint(K.riverOar[1]); yield W.time(1.8); hint(K.riverOar[2]); yield W.time(2.4);       // «Весло…» — «И бревно. Вон там.»
        UI.clearHints();
        yield UI.say(K.riverDecide);                                       // «Грести умеешь?» — «Придётся импровизировать.» — «Я с тобой.»
        const board = run.act('board');                                    // идёт к воде и встаёт на бревно, Бубел — следом
        yield W.time(1.2); hint(K.riverGo[0]);                             // «Я на нос.» — Бубел не боится
        yield board;
        yield W.time(0.3);
      }

      // Приезд: пока он идёт, подземного перехода на экране быть не должно ни на кадр (владелец 09.10.2026: «по ссылке сначала на долю секунды вижу выход из метро, а потом заставку с видом на Днепр»):
      // подложка заплыва строится сразу при сборке сцены и закрывает мир с первого кадра, а сценарий начинается без паузы проявления (sc.noScriptHold): открытка встаёт на первом же шаге
      const arrival = !F.kyiv_arrival_seen;
      const underpass = Ale.Audio.pick('kyiv_underpass', 'tunnel'), quick = entry === 'river';       // quick — ссылка быстрого старта прямо в заплыв: без открытки, сообщения и подводки
      const run = arrival && Ale.River ? Ale.River.open(sc, { musicAfter: underpass }) : null;      // подложка заплыва: берег Днепра встаёт под открытку и проявляется, когда она закроется
      if (arrival) { sc.locked = true; sc.noScriptHold = true; if (run) sc.hideHud = true; }

      sc.runScript(function* () {
        if (arrival) {                                                     // приезд: открытка с видом на Днепр, берег (подводка), сообщение, заплыв на бревне и выход к переходу
          try {
            if (!quick) yield Ale.Cards.show('still_08_kyiv_arrival', { once: true, instant: true });   // Алеся только что прилетела; плашка места ждёт, пока открытка на экране (UI.update); нет файла — тихо пропускается
            if (run) {
              UI.setObjective(T.obj.kyivRiver);
              if (quick) { run.act('ready'); if (Ale.Audio && Ale.Audio.prefetch) Ale.Audio.prefetch(['river_swim']); yield W.time(0.6); }          // ссылка и «Продолжить» с контрольной точки: музыка заплыва ещё не скачана, пусть расшифровывается, пока Алеся идёт к воде
              else yield* riverLead(run);
              G.checkpoint('kyivApproach', 'river');                       // подводка позади: если выйти посреди заплыва, «Продолжить» начнёт его заново, без разговора
              yield Ale.River.play(run);                                   // заплыв ≈ минута; в конце экран чёрный, музыка уже сменилась на музыку перехода (musicAfter)
              const hits = run.result ? run.result.hits : 0;
              run.close(); sc.hideHud = false;
              UI.setObjective(T.obj.kyivWalk); UI.place(T.place.kyivApproach[0], T.place.kyivApproach[1]);
              Ale.Audio.music(underpass);
              yield UI.fadeTo(0, 0.9);                                     // переход к подземному переходу: проявляется сцена, где ждёт Антін
              yield W.time(0.5);
              yield UI.say(hits === 0 ? K.riverDry : K.riverWet);
            } else {                                                       // модуля заплыва нет (сборка без него): приезд идёт как прежде
              Ale.Audio.music(underpass);
              yield W.time(2.2);
              yield UI.phone(K.smsArrive);
            }
          } finally {                                                      // что бы ни случилось, подложка не должна остаться поверх мира и мир не должен остаться закрытым
            if (run) { run.close(); sc.hideHud = false; if (UI.fadeTarget > 0) UI.fadeTo(0, 0.4); }       // сбой посреди заплыва: затемнение (его ставит конец заплыва) всё равно снимается
          }
          G.remember('kyiv_arrival_seen');
          if (run) G.checkpoint('kyivApproach', 'start', { heal: false });          // переправа позади: в сохранении приезд уже отмечен, заплыв не повторится
          sc.locked = false;
        }
        yield W.until(() => p.x > 380);
        if (!F.kyiv_roach_hint) { UI.hint('bubel', K.roachHint, 5); G.remember('kyiv_roach_hint'); }      // до первой группы, движение не останавливает
        yield W.until(() => Math.abs(p.x - antin.x) < 540);
        if (!F.antin_done && !F.antin_intro_seen) { UI.hint('antin', K.antinHi, 2.6); G.remember('antin_intro_seen'); }       // «Алеся, привет!» — один раз
      });
    },

    // =================================================================== парк: встреча у фонтана, дорога через парк, смс
    park(sc, entry) {
      const { G, F, UI, T, K, W, p, bubel, remember } = env(sc);
      const ily = sc.ilya, X = Ale.KYIV_PARK;
      paris(F); F.kyiv_arrival_seen = true;
      G.checkpoint('kyivPark', 'start');
      sc.exitDoor.lockedText = K.parkLocked;
      sc.onExit = () => { G.checkpoint('kyivCourt', 'start'); G.goto('kyivCourt', 'start'); };

      // после встречи Илюшкинс идёт рядом; до смс выход закрыт (смс приходит по дороге, правее фонтана и кресел), после — открыт
      // Илюшкинс идёт рядом, то есть всё время в упор к героине, поэтому по E он больше не отвечает: знак «!» висел над ним весь парк, а нажатие давало одну и ту же реплику (владелец 27.10.2026)
      const afterMeet = () => {
        ily.mode = 'follow'; ily.noTalk = false; ily.onTalk = null;
        UI.setObjective(T.obj.kyivPark);
        if (F.seaside_invitation) { sc.exitDoor.locked = false; sc.exitDoor.arrow = true; }
      };
      // смс от Мамулькина: телефон, потом реакция; запускается, когда героиня прошла мимо фонтана к отметке X.sms
      sc.runScript(function* () {
        yield W.until(() => F.ilyushkins_met && !F.seaside_invitation && p.x > X.sms && !sc.locked && !UI.modal);
        sc.locked = true; p.auto = null; p.vx = 0; ily.mode = 'stay'; ily.keepFacing = true; face(p, ily);          // он шёл следом, и она читала смс и говорила с ним спиной: теперь оба лицом друг к другу
        yield UI.phone(K.smsInvite);                                       // приглашение к морю: сценарный интерфейс, настоящих сообщений нет
        yield UI.say(K.smsReact);
        G.remember('seaside_invitation');
        sc.exitDoor.locked = false; sc.exitDoor.arrow = true;
        G.checkpoint('kyivPark', 'start', { heal: false });
        ily.keepFacing = false; ily.mode = 'follow';
        sc.locked = false;
      });
      if (F.ilyushkins_met) {                                              // встреча уже была (загрузка, поражение дальше): сцена строится в нужном состоянии
        ily.x = p.x + 130; ily.facing = -1; afterMeet();
        return;
      }
      UI.setObjective(T.obj.kyivIlya);

      ily.onTalk = () => sc.runScript(function* () {
        UI.clearHints(); sc.locked = true; p.auto = null;
        UI.setObjective(T.obj.kyivTalk);                                   // она уже рядом: «Подойти к Илюшкинсу» над двадцатью репликами разговора была бы неправдой
        // Он зовёт её «сочным магнусиком», оба идут навстречу, объятие и поцелуй (на пике — открытка, дальше она сама показывает кадр издали), потом разговор с подарками
        face(p, ily); ily.keepFacing = true; ily.mode = 'stay';           // оба лицом друг к другу — и когда она подошла к нему справа: раньше они стояли спинами и менялись местами (18.10.2026)
        yield UI.say(K.meetHi);
        const mid = (p.x + ily.x) / 2, side = ily.x >= p.x ? 1 : -1;       // side — с какой стороны от неё он стоит
        yield [goTo(sc, ily, mid + side * KISS.dx / 2, { speed: 140, arrive: 3 }, 5), goTo(sc, p, mid - side * KISS.dx / 2, { speed: 150, arrive: 3 }, 5)];
        yield W.time(0.2);
        yield* kiss(sc, p, ily, { card: () => Ale.Cards.show('still_08a_kyiv_fountain', { once: true }) });
        yield UI.say(K.meet);                                              // «Это всё — из-за одной посылки?»
        yield UI.say(K.sender);                                            // «Подожди. Так посылку отправил ты?» — прямо за его вопросом, а не после бабл-ти (раньше Алеся говорила «твоей посылки» и только потом спрашивала, чья она)
        yield UI.say(K.meetThanks);
        // баблти: протягивает стаканчик (нарисованная поза «протягивает» на время реплики и передачи)
        ily.pose = 'ily_offer';
        yield UI.say(K.tea);
        ily.bump = 0.45; G.remember('has_bubble_tea'); UI.toast(T.toast.gotTea, 'it_tea');
        yield W.time(0.5);
        ily.pose = null;
        p.holdSprite = 'it_tea';                                           // стаканчик в руке уже на «Бабл-ти! Спасибо, Илюшкинс.»
        yield UI.say(K.teaAfter);
        yield W.time(0.6);                        // глоток: сначала стаканчик в руке, потом нарисованная поза «пьёт» и облачко над ней (раньше было на берегу в Монако)
        p.holdSprite = null; p.pose = 'sip';
        UI.hint('ale', K.sip, 2.6);
        yield W.time(2.0);
        p.pose = null;
        // подарок на день рождения: очки Ray-Ban Meta; она их примеряет — щелчок камеры
        ily.pose = 'ily_offer';
        yield UI.say(K.gift);
        ily.bump = 0.45; G.remember('has_glasses'); UI.toast(T.toast.gotGlasses, 'it_glasses');
        yield W.time(0.5);
        ily.pose = null;
        yield UI.say(K.giftAfter);
        p.pose = 'glasses';                                                // примерила: нарисованная поза «в очках»
        sc.fx.ring(p.x + 8, p.y - 128, 46, 'rgba(255,255,255,'); Ale.Audio.sfx('shutter');
        yield W.time(0.35);
        yield UI.say(K.giftClick);
        p.pose = null;
        yield UI.say(K.meetEnd);
        G.remember('ilyushkins_met');
        afterMeet();
        G.checkpoint('kyivPark', 'start', { heal: false });                // дальше — через парк, встреча больше не нужна
        sc.locked = false;
      });
      sc.runScript(function* () { yield W.time(2.6); if (!F.ilyushkins_met && !sc.locked && Math.abs(p.x - ily.x) > 320) UI.hint('bubel', K.parkHint, 4.5); });      // «Илюшкинс ждёт у фонтана» — только пока он далеко: рядом с ним и во время разговора подсказка ни к чему
    },

    // =================================================================== площадка: шахматы, Димасик, набор, бой, проводы у такси
    court(sc, entry) {
      const { G, F, S, UI, T, K, W, p, bubel, remember } = Object.assign(env(sc), { S: Ale.Game.state });
      const X = Ale.KYIV_COURT, ily = sc.ilya, dim = sc.dim, D = Ale.DIMASIK;
      paris(F); F.kyiv_arrival_seen = true; F.ilyushkins_met = true; F.seaside_invitation = true;
      // Камера площадки (с вступления Димасика и весь бой): площадка шире самого узкого вида (владелец 09.10.2026 попросил её увеличить), поэтому камера не стоит, а едет за героиней и Димасиком так,
      // чтобы оба были в кадре (и Илюшкинс, если помещается); Димасик сам не отходит дальше чем на 830 юн. (dimasik.js, FIELD.hard: с полями CAM.ale и CAM.dim это 980 — меньше самого узкого вида).
      // Не помещаются с полями (он на замахе, а она отошла; она у стойки, а он у барьера) — поля сужаются поровну, но не меньше CAM.min; не помещаются и так (она ушла с площадки влево, к Илюшкинсу
      // на выбор набора) — в кадре героиня у левого края, а если говорит Димасик — он у правого. camFrame пересчитывает цель каждый такт (onTick), сама камера сглаживает движение.
      // Илюшкинс берётся в кадр, только если за Димасиком остаётся ещё CAM.dodge на его отскок назад (прыжок от шара до 190, перебежка до 210): иначе кадр «впритык» и отскок дёргал бы камеру.
      const cam = { x: X.fence + 300, y: 600, vx: 0 }, CAM = { ale: 80, dim: 70, ily: 40, min: 32, dodge: 140, ease: 2.5 };
      let camGoal = cam.x;                                                 // плавная цель; cam.x — то, что получает камера (с упреждением, см. ниже)
      const camFrom = () => { camGoal = cam.x = sc.camera.x + (G.viewW || sc.camera.viewW) / 2 - (sc.camera.look || 0); };      // камера шла за героиней: цель начинается оттуда, где камера сейчас (без рывка)
      // dt = 0 — цель сразу на месте, без сглаживания (начало попытки: сцена только открылась, камера встанет туда же)
      const camFrame = (dt) => {
        const V = G.viewW || sc.camera.viewW, dOn = dim && !dim.dead && !dim.hidden && (dim.depth || 0) < 0.9;
        let L = p.x - CAM.ale, R = p.x + CAM.ale;
        if (dOn) { L = Math.min(L, dim.x - CAM.dim); R = Math.max(R, dim.x + CAM.dim); }
        if (R - L > V) {
          if (dOn && Math.abs(dim.x - p.x) + 2 * CAM.min <= V) camGoal = (p.x + dim.x) / 2;
          else { const l = UI.dlg && UI.dlg.lines[UI.dlg.i]; camGoal = l && l.who === 'dimasik' && dOn ? R - V / 2 : L + V / 2; }
        } else {
          const lo = R - V / 2, hi = L + V / 2, Li = Math.min(L, ily.x - CAM.ily), Ri = dOn ? Math.max(R, dim.x + CAM.dim + CAM.dodge) : R;
          const goal = Ale.clamp(Ri - Li <= V ? (Li + Ri) / 2 : (L + R) / 2, lo, hi);
          camGoal = Ale.clamp(dt > 0 ? camGoal + (goal - camGoal) * Math.min(1, dt * CAM.ease) : goal, lo, hi);
        }
        cam.x = camGoal;
        // Камера (camera.js) догоняет цель плавно и на ходу отстаёт на десятки юнитов: если после её шага кто-то из двоих оказался бы к краю кадра ближе CAM.min (или ближе половины того, что
        // остаётся от вида, когда они дальше V − 2·CAM.min друг от друга), цель ставится с упреждением — ровно настолько, чтобы после шага оба остались в кадре (look — остаток упреждения по
        // скорости героини, за которой камера шла до этого). Дальше ширины вида друг от друга — упреждения нет: в кадре она (или говорящий Димасик), см. выше
        const c = sc.camera, a = dOn ? Math.min(p.x, dim.x) : p.x, b = dOn ? Math.max(p.x, dim.x) : p.x, m = Math.min(CAM.min, (V - (b - a)) / 2), lo2 = b + m - V / 2, hi2 = a - m + V / 2;
        if (m >= 0 && dt > 0) {
          const k = 1 - Math.exp(-c.speed * dt), lk = (c.look || 0) * Math.exp(-3 * dt), cur = c.x + V / 2, next = cur + (camGoal + lk - cur) * k, fix = Ale.clamp(next, lo2, hi2);
          if (fix !== next) cam.x = cur + (fix - cur) / k - lk;
        }
      };
      let kit = null, attempt = false, fighting = false, lastHp = G.state.hp;
      const SUPPLY = X.supply;

      // ---- набор: у Илюшкинса на стойке; один на попытку (тип можно сменить, пока попытка не началась)
      const setKit = (id) => {
        if (sc.kit) sc.kit.dead = true;
        kit = sc.kit = sc.add(new Ale.Kit({ type: id, fenceX: X.fence, boss: () => (dim && !dim.dead ? dim : null) }));
        remember('kyivEquipment', id);
        kit.reset();
      };
      sc.kitHud = () => (kit && !F.dimasik_defeated ? kit.hud() : null);

      // ---- Илюшкинс в бою стоит слева от стойки с оружием, лицом к бою, не заслоняя её (штанга и диск теперь долетают и до него: он подпрыгивает и пригибается — onTick); Бубел — вплотную справа
      // от него (X.bubel; владелец 09.10.2026: «рядом с Илюшкинсом», раньше она стояла за левым краем кадра и её реплики рисовались из ниоткуда) и подпрыгивает над штангой и низким диском так же; болеет короткими выкриками (не чаще раза в 4,5 с; подсказки приоритетнее)
      const ilyPost = () => { ily.x = SUPPLY; ily.facing = 1; ily.keepFacing = true; ily.mode = 'stay'; ily.vx = 0; };
      const bubelPost = () => { bubel.mode = 'stay'; bubel.stayX = X.bubel; };       // до площадки она идёт за Алесей; в бою — на посту рядом с Илюшкинсом
      let ilyHopCool = 0, bubelHopCool = 0;
      let cheerCool = 0, cheerQ = null, hurtCool = 0, hurtCount = 0, ilyPoseT = 0;
      const cheer = (text, delay) => { cheerQ = { text, t: delay || 0 }; };
      let hitCount = 0;

      // ---- подсказки на первое появление каждой атаки (один раз за игру)
      sc.onDimasikAttack = (kind) => {
        const key = 'dim_hint_' + kind.replace(/High|Low/, '') + (kind === 'discHigh' ? 'H' : kind === 'discLow' ? 'L' : '');
        if (F[key]) return;
        G.remember(key);
        const text = { dumbbell: K.hintDumbbell, barbell: K.hintBarbell, discHigh: K.hintDiscHigh, discLow: K.hintDiscLow }[kind];
        UI.hint('bubel', text, 4.2); cheerQ = null;
      };
      // Попадания: Бубел изредка радуется; сам Димасик в бою говорит ровно две фразы (onDimasikTaunt), а на попадание — только нарисованное «Ай!» (dim_hit), без облачка
      sc.onDimasikHit = (d) => {
        hitCount++;
        if (hitCount % 3 === 1 && d.dmg < d.hpMax && d.dmg < d.phase2At) cheer(K.bubelCheer.hit[Math.floor((hitCount - 1) / 3) % K.bubelCheer.hit.length], 0.7);          // каждое третье попадание — следующий выкрик по кругу («Попала!» → «Так его!» → «Ещё!»; раньше индекс всегда выходил нулевым)
      };
      // Фразы Димасика (владелец 09.10.2026): 0 — в начале боя, 1 — в переходной фазе; облачком над ним, мир не останавливается
      sc.onDimasikTaunt = (i) => { UI.hint('dimasik', K.dimasikTaunt[i], D.TAUNT.life[i]); };
      // Переходная фаза (середина шкалы): Алесе два сердца, Бубел подсказывает, что началось; фразу говорит сам Димасик (onDimasikTaunt)
      sc.onDimasikPhase2 = () => {
        if (G.state.hp < G.state.maxHp) { p.heal(D.HEAL2); sc.fx.hearts(p.x, p.y - 120, 5); sc.fx.text(p.x, p.y - 176, T.fx.heart, { size: 24, color: '#ffb3c6' }); Ale.Audio.sfx('pickup'); }
        cheer(K.bubelCheer.phase2, 1.6);
      };
      sc.onDimasikDown = () => {
        G.remember('dimasik_defeated');                                    // на нуле шкалы сначала фиксируется победа (в тот же кадр), потом идут анимации и разговор
        G.checkpoint('kyivCourt', 'won');
        UI.setObjective(T.obj.kyivTaxi);                                   // бой выигран — цель уже «Идти к такси» (раньше «Проучить Димасика» висела над его сдачей, уходом и разговором)
        fighting = false; cheerQ = null; sc.boss = null; if (kit) kit.live = false; if (ily.pose === 'ily_worry' || ily.pose === 'ily_roll') ily.pose = null;      // боевой HUD выключен в тот же кадр; опасности Димасик уже убрал
        sc.net.disabled = true;                                            // после победы проход справа открыт (управление пока у сценария)
        sc.runScript(win);
      };

      const startAttempt = () => {
        attempt = true; fighting = true;
        kit.reset(); kit.live = true; dim.startFight();
        Ale.Audio.music(Ale.Audio.pick('dimasik', 'boss'), { skipIntro: true });       // уже играет с диалога — не трогается; повторная попытка (диалогов нет) — сразу с главной части, без саспенса
        // (стартового «Я здесь.» над Илюшкинсом больше нет: он только что сказал «Я рядом» и «Кончатся — приходи»)
        cheer(K.bubelCheer.start, 1.0);
        lastHp = G.state.hp;
      };

      sc.onTick = (dt) => {
        if (Ale.Touch) Ale.Touch.setThrowIcon(kit && !F.dimasik_defeated ? kit.cfg.touch : null);
        if (sc.cameraTarget === cam) camFrame(dt);
        if (cheerCool > 0) cheerCool -= dt; if (hurtCool > 0) hurtCool -= dt; if (ilyHopCool > 0) ilyHopCool -= dt; if (bubelHopCool > 0) bubelHopCool -= dt;
        // Илюшкинс в бою: «волнуется», когда её ранили, и присаживается, когда закатывает шар (нарисованные позы на короткое время)
        if (ilyPoseT > 0 && (ilyPoseT -= dt) <= 0 && (ily.pose === 'ily_worry' || ily.pose === 'ily_roll')) ily.pose = null;
        if (fighting && kit && kit.type === 'bowling' && !ily.pose && sc.entities.some((e) => e instanceof Ale.SupplyBall && !e.dead && e.t < 0.12)) { ily.pose = 'ily_roll'; ilyPoseT = 0.55; }
        // Штанга и низкий диск долетают до него (за стойку): подпрыгивает так, чтобы предмет прошёл под ногами (прыжок 0,58 с, ноги выше штанги ≈ 0,37 с); под высоким диском пригибается (присед ily_roll)
        if (fighting) for (const e of sc.entities) {
          if (!e.hazard || e.dead || !(e instanceof Ale.Barbell || e instanceof Ale.Disc)) continue;
          const rel = e.x - ily.x, low = e instanceof Ale.Barbell ? e.mode === 'roll' : !e.high && !e.falling;
          if (low && rel > 60 && rel < (e instanceof Ale.Barbell ? 122 : 150) && ily.onGround && ilyHopCool <= 0) { ily.vy = -700; ily.onGround = false; ilyHopCool = 0.7; }
          else if (e instanceof Ale.Disc && e.high && !e.falling && rel > -50 && rel < 190 && (!ily.pose || ily.pose === 'ily_roll')) { ily.pose = 'ily_roll'; ilyPoseT = Math.max(ilyPoseT, 0.12); }
          // Бубел стоит вплотную к нему и тоже на пути штанги и низкого диска: подпрыгивает над ними (высокий диск проходит над ней)
          const rb = e.x - bubel.x;
          if (low && rb > 60 && rb < (e instanceof Ale.Barbell ? 122 : 150) && bubel.onGround && bubelHopCool <= 0) { bubel.vy = -700; bubel.onGround = false; bubel.jumpCd = 0.6; bubelHopCool = 0.7; }
        }
        if (!attempt && kit && !sc.locked && p.x >= X.fence && !F.dimasik_defeated) startAttempt();
        if (!fighting) { lastHp = G.state.hp; return; }
        if (G.state.hp < lastHp) {
          const alive = G.state.hp > 0;                                    // смертельный удар: Илюшкинс волнуется позой, а «Осторожно!» и «Держись!» над лежащей героиней были бы нонсенсом
          if (hurtCool <= 0) { if (alive) UI.hint('ilyushkinsSupply', K.fightIlya.hurt, 1.5); hurtCool = 5; ily.pose = 'ily_worry'; ilyPoseT = 1.1; }       // не чаще раза в 5 с, мир не останавливается
          if (alive) cheer(K.bubelCheer.hurt[hurtCount++ % K.bubelCheer.hurt.length], 0.7);
        }
        lastHp = G.state.hp;
        if (cheerQ) {
          cheerQ.t -= dt;
          if (cheerQ.t <= 0 && cheerCool <= 0 && !UI.modal && !sc.locked && !UI.hints.some((h) => h.who === 'bubel')) { UI.hint('bubel', cheerQ.text, 2.4); cheerCool = 4.5; cheerQ = null; }
        }
      };

      // ---- Илюшкинс: пополнение; до начала попытки — смена набора; после победы — «я уже всё сказал»
      const supply = () => {
        const r = kit.supply();
        if (r.ok) { UI.hint('ilyushkinsSupply', K.fightIlya.give, 1.4); ily.bump = 0.45; }
        else if (r.text) UI.hint('ilyushkinsSupply', r.text, 2.2);
        else if (kit.type === 'slingshot') UI.hint('ilyushkinsSupply', K.noNeedSling, 2.2);
      };
      // Выбор набора — обязательный диалог из трёх вариантов (владелец 09.10.2026 вечером: «бой не должен начинаться с набором по умолчанию — после того как Илюшкинс заступается за Алесю, сам
      // собой выбирается диалог, где она берёт одно из трёх»): без пропуска, пока не выбрано; пока набор не выбран, попытка не начинается (kit = null). В повторной попытке
      // и по ссылке быстрого старта диалог идёт в начале, прежний выбор стоит под курсором
      function* chooseKit() {
        const keep = Ale.KIT_ORDER.indexOf(S.kyivEquipment);
        let id = null;
        while (!id) {                                                      // реплику могли вытеснить другой (тогда choice = −1): спрашиваем снова, а не берём первое
          const q = UI.say([['ilyushkins', K.pick, { choices: Ale.KIT_ORDER.map((k) => ({ text: K.kit[k].choice })), sel: keep >= 0 ? keep : 0 }]]); yield q;
          if (q.choice >= 0) id = Ale.KIT_ORDER[q.choice];
        }
        setKit(id);
        yield UI.say([['ilyushkins', K.kit[id].give]]);
        return id;
      }
      function* changeKit() {
        sc.locked = true; UI.clearHints();
        const old = kit && kit.type, id = yield* chooseKit();
        if (UI.tipS && !UI.tipS.done) UI.tip(K.kitTip[id]);               // плашка с клавишами ещё на экране: показывает набор, который теперь в руках (раньше оставалась прежней)
        if (id !== old) G.checkpoint('kyivCourt', 'prepare', { heal: false });
        sc.locked = false;
      }
      // у стойки до боя по E — смена набора и пополнение; после победы он идёт рядом и по E не отвечает (noTalk в win() и при загрузке с победой): знак «!» висел над ним до самого такси, а нажатие
      // повторяло одну реплику (владелец 27.10.2026)
      ily.onTalk = () => {
        if (!attempt) return sc.runScript(changeKit);
        supply();
      };

      // ---- проводы у такси: сценка запускается сама, когда они дошли: билет, колбаса в дорогу, поцелуй, она садится, такси уезжает
      function* farewell() {
        sc.locked = true; UI.clearHints(); p.auto = null; p.vx = 0;
        ily.mode = 'stay'; ily.noTalk = true;
        UI.setObjective(T.obj.kyivTaxi);
        const doorX = X.car - 52;
        yield [goTo(sc, p, doorX - 112, { speed: 170, arrive: 4 }, 6), goTo(sc, ily, doorX - 112 - KISS.dx, { speed: 170, arrive: 4 }, 6)];
        face(p, ily); ily.keepFacing = true; yield W.time(0.2);            // оба лицом друг к другу, пока говорят (Илюшкинс слева от неё): раньше она стояла к нему спиной, глядя на такси
        yield UI.say(cue(K.farewell, { 2: () => { ily.pose = 'ily_offer'; } }));         // «И вот ещё. В дорогу.» — протягивает колбасу
        ily.bump = 0.45; G.remember('has_sausage'); UI.toast(T.toast.gotSausage, 'it_sausage');
        yield W.time(0.5);
        ily.pose = null;
        yield UI.say(K.farewellAfter);
        yield* kiss(sc, p, ily);                                           // ещё один поцелуй теми же кадрами (Илюшкинс слева от неё: путь к такси свободен)
        G.remember('kyiv_farewell_done');
        G.checkpoint('kyivCourt', 'won', { heal: false });
        // садится: задняя дверь открывается, героиня и Бубел идут к ней и исчезают внутри, дверь закрывается, Илюшкинс машет, такси уезжает
        p.facing = 1; ily.facing = 1;
        yield tween(sc, 0.5, (k) => { sc.taxi.door = k; });
        yield [goTo(sc, p, doorX, { speed: 150, arrive: 4 }, 4), goTo(sc, bubel, doorX - 30, { speed: 150, arrive: 4 }, 4)];
        p.hidden = true; bubel.hidden = true; Ale.Audio.sfx('gate');
        yield W.time(0.25);
        yield tween(sc, 0.4, (k) => { sc.taxi.door = 1 - k; });
        ily.bump = 0.6; ily.pose = 'ily_wave'; Ale.Audio.sfx('gate');                 // машет вслед (нарисованная поза)
        yield W.time(0.4);
        let v = 0, last = sc.time;                                         // разгон вправо: смещение растёт по времени сцены (не по часам)
        yield Ale.Wait.until(() => { const dt = Math.max(0, sc.time - last); last = sc.time; v = Math.min(520, v + 420 * dt); sc.taxi.dx += v * dt; return sc.taxi.dx > 640; });
        G.checkpoint('kyivCourt', 'won', { heal: false });
        G.goto('transit', 'monaco', { fade: 0.9 });
      }
      // дошла до такси после победы — сценка идёт сама (один раз за загрузку сцены). Флаг kyiv_farewell_done в условие НЕ входит: он пишется в контрольную точку за ~5 с до переезда в Монако,
      // и перезапуск («Заново с последней точки», «Продолжить», вылет страницы) в этом окне оставлял Киев закрытым навсегда (в сохранении флаг уже стоял, другого выхода с площадки нет) — теперь проводы просто повторяются (11.10.2026)
      sc.runScript(function* () {
        yield W.until(() => F.dimasik_defeated && !sc.locked && !UI.modal && p.x > X.car - 230);
        yield* farewell();
      });

      // ---- победа
      function* win() {
        sc.locked = true; UI.clearHints();
        dim.clearHazards();
        for (const e of sc.entities) if (e.kitShot || e.bowl) e.dead = true;
        if (kit) { kit.live = false; }
        Ale.Audio.music(Ale.Audio.pick('kyiv_park', 'paris'));
        p.pose = 'cheer'; yield W.time(0.9); p.pose = null;
        sc.cameraTarget = cam;
        yield UI.say(K.dimasikDefeat);
        // уходит, заметно уставший и прихрамывая: к проёму в изгороди (за дальним краем своего поля), и там растворяется вглубь парка
        dim.state = 'leave';
        yield goTo(sc, dim, X.gap, { speed: 152 }, 18);          // 152 юн./с (было 76: владелец 12.10.2026 — «он может долго идти в арку, ускорь в 2 раза»; кадры ходьбы привязаны к пройденному пути, поэтому шаг учащается вместе со скоростью)
        yield tween(sc, 1.1, (k) => { dim.depth = k; });
        dim.dead = true;
        // после ухода Илюшкинс подходит к Алесе
        ily.keepFacing = false; ily.mode = 'stay'; yield goTo(sc, ily, Math.min(p.x + 120, X.strip1 + 40), { speed: 190, arrive: 12 }, 6);
        yield UI.say(K.afterFight);
        if (kit) { kit.dead = true; sc.kit = null; kit = null; }
        UI.setObjective(T.obj.kyivTaxi); UI.hint('bubel', K.carHint, 5);
        ily.mode = 'follow'; ily.noTalk = true; bubel.mode = 'follow'; sc.cameraTarget = null; sc.locked = false;          // Бубел стояла на посту у стойки с оружием — теперь снова идёт за героиней
        if (Ale.Touch) Ale.Touch.setThrowIcon(null);
      }

      // ---- вход
      if (entry === 'won') F.dimasik_defeated = true;                      // ссылка ?entry=won без flags= тоже должна вести к проводам
      if (entry === 'won' || F.dimasik_defeated) {                         // победа уже была: Димасика нет, опасностей нет
        dim.dead = true; dim.hidden = true; sc.net.disabled = true; sc.cameraTarget = null;
        p.x = X.supply - 20; bubel.x = p.x - 80; bubel.mode = 'follow'; ily.x = X.supply + 70; ily.mode = 'follow'; ily.noTalk = true;
        G.checkpoint('kyivCourt', 'won', { heal: false });
        UI.setObjective(T.obj.kyivTaxi);
        return;
      }
      if (entry === 'prepare' || F.dimasik_intro_seen) {                   // после поражения и по ссылке быстрого старта: вступление не повторяется, старт у Илюшкинса, сердца полные; набор выбирается заново (диалог с тремя вариантами)
        dim.x = X.dimIntro; dim.seated = false; dim.sit = 0;
        p.x = SUPPLY - 70; bubel.x = X.bubel; ilyPost(); bubelPost(); sc.cameraTarget = cam; camFrame(0);
        G.checkpoint('kyivCourt', 'prepare');
        UI.setObjective(T.obj.kyivFight);
        sc.locked = true;                                                  // пока набор не выбран, она стоит у Илюшкинса, Димасик не атакует
        sc.runScript(function* () {
          p.facing = 1; yield W.time(0.3);
          const id = yield* chooseKit();
          G.checkpoint('kyivCourt', 'prepare', { heal: false });             // в точке — выбранный набор: после следующего поражения он станет курсором диалога
          ily.noTalk = false;
          if (!F.kit_tip_seen) { UI.tip(K.kitTip[id]); G.remember('kit_tip_seen'); }
          sc.locked = false;
          yield W.until(() => attempt);
          UI.tipDone();
        });
        return;
      }
      // ---- первый приход: Димасик сидит за шахматным столом перед площадкой; сыграли, он ушёл на площадку, там — вступление, набор, открытка, бой
      p.x = X.start; bubel.x = p.x - 80; ily.x = p.x - 110;
      ily.noTalk = true; ily.mode = 'follow';
      const toCourt = () => {                                              // после шахмат: Димасик уходит к себе на поле, к барьеру (ограждение площадки на время открыто), героиня идёт к площадке
        sc.net.disabled = true; dim.seated = false; dim.angry = true; dim.state = 'script'; dim.facing = 1;
        dim.autoWalk(X.dimIntro, { speed: 200, arrive: 4 });
      };
      if (!F.chess_won) {
        G.checkpoint('kyivCourt', 'start');
        UI.setObjective(T.obj.kyivCourt);
        dim.x = X.seat; dim.facing = -1; dim.seated = true; dim.sit = 1; dim.state = 'script';
        sc.runScript(function* () {
          yield W.until(() => p.x > X.chess - 150);                       // подошла к столу (вход теперь правее левой группы экранных кнопок, в 160 юн. от стола: разговор начинается с первым шагом к нему, а не сам)
          sc.locked = true; p.auto = null; p.vx = 0; ily.mode = 'stay';
          yield goTo(sc, p, Math.max(p.x, X.chess - 180), { speed: 170, arrive: 4 }, 4);
          p.facing = 1; ily.facing = 1; ily.keepFacing = true;
          yield UI.say(K.chessIntro);
          yield Ale.Chess.play({});                                        // доска на весь экран: ускоренная партия и мат в два хода
          G.remember('chess_won');
          G.checkpoint('kyivCourt', 'start', { heal: false });
          // он смотрит на единственного короля (кулаки на столе, взгляд в доску), встаёт и молча уходит вправо — туда же, куда надо им
          dim.pose = 'dim_sit2'; yield W.time(0.9); dim.pose = null;
          toCourt();
          yield W.time(1.2);
          face(p, ily);                                                    // он говорит ей, а не вслед Димасику: оба лицом друг к другу
          yield UI.say(K.chessWin);
          ily.keepFacing = false; ily.noTalk = true; ily.mode = 'follow'; sc.locked = false;
          UI.setObjective(T.obj.kyivTaxi); UI.hint('bubel', K.chessGo, 4.5);
        });
      } else {                                                             // шахматы уже сыграны (загрузка): Димасик у себя на площадке
        dim.x = X.dimIntro; dim.facing = -1; dim.seated = false; dim.sit = 0; dim.state = 'script';
        UI.setObjective(T.obj.kyivTaxi);
      }
      sc.runScript(function* () {
        yield W.until(() => p.x > X.X0 + 20 && !sc.locked && !UI.modal);
        sc.locked = true; p.auto = null; p.vx = 0; ily.mode = 'stay'; camFrom(); sc.cameraTarget = cam; bubelPost();
        yield W.until(() => !dim.auto && dim.x > X.dimIntro - 8 && !dim.seated);       // ждём, пока Димасик дойдёт до барьера
        sc.net.disabled = false; dim.angry = false; dim.facing = -1; dim.x = X.dimIntro; dim.vx = 0;
        // она подходит к стойке: площадка теперь шире самого узкого вида, а так оба в кадре, пока он говорит (камера во время диалога стоит)
        if (p.x < X.X0 + 170) yield goTo(sc, p, X.X0 + 170, { speed: 200, arrive: 4 }, 3);
        p.facing = 1;
        yield W.time(0.3);
        yield UI.say(K.dimasikIntro);
        ily.keepFacing = true; ily.facing = 1;
        yield goTo(sc, ily, SUPPLY, { speed: 230 }, 8);                    // шагает на своё место слева от стойки и поднимает ладонь, останавливая Димасика
        ily.facing = 1; ily.pose = 'ily_stop'; Ale.Audio.sfx('gate');          // нарисованная поза «ладонь вперёд» вместо светового кольца
        { const dm = Ale.Audio.pick('dimasik', null); if (dm) Ale.Audio.music(dm); }       // он вмешивается: начинается музыка боя, первые секунды — растущий саспенс под диалог, потом вступает вся музыка (владелец 08.10.2026)
        yield W.time(0.5);
        yield UI.say(cue(K.dimasikStop, { 1: () => { ily.pose = null; } }));       // ладонь опускается, когда начинает говорить Алеся
        // Алеся подходит к нему (обычной ходьбой, без телепортации), он у стойки: выбор набора
        yield goTo(sc, p, SUPPLY - 70, { speed: 220 }, 8);
        p.facing = 1; ilyPost(); yield W.time(0.3);
        const id = yield* chooseKit();
        G.remember('dimasik_intro_seen');
        G.checkpoint('kyivCourt', 'prepare');
        ily.noTalk = false; ily.mode = 'stay';
        UI.setObjective(T.obj.kyivFight);
        UI.tip(K.kitTip[id]); G.remember('kit_tip_seen');
        sc.locked = false;
        yield W.until(() => attempt);
        UI.tipDone();
      });
    },
  };
})();
