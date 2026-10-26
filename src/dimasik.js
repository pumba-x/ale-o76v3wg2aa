// Димасик — босс Киева (площадка у шахматных столов): злится, что Алеся не отвечает на сообщения и не хочет играть в шахматы, и швыряется спортивными предметами.
// Комическая драка, без крови: шкала 16 единиц (в лёгком режиме 14), подписана «Димасик». Алеся бьёт выбранным набором (см. kit.js) и «Туп лапой» (1 единица); прыжок на голову не бьёт, касание не ранит.
// Единицы за попадание: рогатка 1, дротик 1, шар 2 (восемь шаров — победа; было 4, владелец 09.10.2026 вечером: «шар должен сносить только 2 хп»), «Туп лапой» 1. Устройство боя целиком (геометрия, числа, результаты ботов, что крутить) — docs/DIMASIK_FIGHT.md.
//
// Переделка боя (владелец 09.10.2026: «сделать сложнее… увеличить площадку… не так просто заспамить атаками — поднять ему интеллект, чтобы уворачивался лучше и перемещался по полю активнее…
// снаряды чуть дальше долетали… два раза фразочки… переходная фаза ниже половины: вторая фразочка, активнее двигается и быстрее метает»):
//   · поле. У него своя половина площадки (arena.field0 … field1, 510 юн.), он ходит по ней весь бой (_think): держит расстояние до героини в коридоре TAC.gap (не ближе FIELD.stompGap — под
//     «Туп лапой» не подставляется; не дальше FIELD.hard = 830 — камера держит обоих в кадре), отступает, когда она подходит, идёт следом, когда отходит, а сам меняет место после атаки (moveP),
//     после попадания (hitMoveP) и если долго стоял (idleMove). Пока шар в руках героини или в воздухе, сам не сходит с места (пунктир не обманывает) — только уклоняется;
//   · три атаки — каждая со своим замахом, который можно прочесть, и своим способом уйти (сценарное ТЗ, раздел 7): гантель — парабола в отмеченную точку (уйти из круга), штанга — катится по полу
//     (перепрыгнуть), диск — плоский полёт (высокий — присесть, низкий — прыгнуть). Предметы теперь долетают за стойку с оружием: штанга катится и диск летит до arena.reach (на 160…260 юн. за стойкой,
//     там диск падает и катится, штанга встаёт), гантель падает туда, где стояла героиня, хоть у самого Илюшкинса; в зоне пополнения он тоже атакует. Скорости полёта во всех фазах одни и те же;
//   · окна. Уязвим он всегда, но по-разному: на замахе и броске (≈ 1 с на атаку) он не уклоняется — это главное окно; сразу после броска, пока свой предмет летит к героине, держит «руки у груди»
//     (guard, recover): шарики и дротики от рук отскакивают (вспышка и стук), шар — нет; в остальное время он настороже и уклоняется (_watch): присед и прыжок (hop), перебежка (dash) — от шара,
//     или просто замирает на ходу (stand), если снаряд пущен с упреждением. Шанс — по виду снаряда и фазе, растёт, если героиня стреляет подряд с одного места («привыкает к ритму», read),
//     между уклонениями пауза cooldown, подряд не больше maxStreak (потом снаряд пройдёт). Поэтому спам с одной точки упирается в блоки и уклонения, а выстрел в замах или после смены места проходит;
//   · фразы — ровно две за попытку, облачком над ним (sc.onDimasikTaunt → T.kyiv.dimasikTaunt): первая в начале (первое попадание с любой стороны, первое уклонение или блок, или 6 с боя — что раньше),
//     вторая — в переходной фазе;
//   · переходная фаза: на 8-й единице урона (середина шкалы; в лёгком режиме — на 7-й) он бросает начатый замах и 1,3 с злится на месте (кадр «кричит», дрожь, пар, по нему не попасть), Алесе два сердца; дальше вторая фаза —
//     короче замахи и паузы (TAC[2]), чаще и быстрее ходит, чаще уклоняется;
//   · лёгкий режим (Ale.Settings.easy) — таблица EASY, как прежний бой: снаряды останавливаются у ограждения, в зоне пополнения не атакует, блока нет, уклоняется по-прежнему редко.
// Кадры заказов 20–24 (04.10.2026, набор dimasik_x, D.FR): сидит за столом (dim_sit1; «злится после шахмат» — dim_sit2 через dim.pose), встаёт (dim_rise), диск нарисован в руке на замахе
// (dim_plate_hi / dim_plate_lo) и вылетает из пустой руки (dim_plate_rel), уклонение (присед dim_dodge1, прыжок dim_dodge2), попадание (dim_hit), злая речь и переходная фаза (dim_shout),
// побеждён (dim_down); летящие предметы — картинки prop_dumbbell / prop_barbell / prop_disc. Каждое место работает и без новых кадров (прежний вид), если их нет в сборке.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const OUT = '#2b1a20';

  // Тактика по фазам (TAC[1] — шкала 14…8, TAC[2] — после переходной фазы) и лёгкий режим (EASY: прежний бой — паузы 0,68 / 0,5, шансы уклонения 0,7 / 0,3 / 0,18, раз в 2,5 с, подряд не больше двух,
  // без блока и без «привыкания»). Числа подобраны ботами (tests/bot.js, __dimTrials), результаты — docs/DIMASIK_FIGHT.md. Поля:
  //   windup — замах до выпуска, с (кадры внутри — в look()); release — кадр «бросок»; guard — сколько после броска он держит «руки у груди» и отбивает шарики и дротики (0 — блока нет, «руки у
  //   груди» — прежние RECOVER = 0,35 с); pause — от того, как его предмет миновал героиню (упал, проехал мимо, остановился), до следующего замаха;
  //   walk / backpedal — шаг по полю и отступление, юн./с; gap — коридор расстояний до героини, где он сам выбирает место; moveP / hitMoveP — шанс сменить место после атаки / после попадания по нему;
  //   idleMove — сколько секунд стоит на одном месте, прежде чем пойти сам; minMove — короче этого он место не меняет (перемещение должно быть видно);
  //   dodge.chance — шанс уклониться от шара / дротика / шарика рогатки (если манёвр выходит и он свободен; на замахе и броске он не уклоняется вовсе), read — прибавка к шансу за каждый выстрел подряд
  //   с одного места (не дальше READ.dx от прошлого и не позже READ.dt после него; не больше readMax выстрелов), cooldown — от начала одного уклонения до начала следующего, maxStreak — подряд без попаданий
  //   (потом следующий снаряд пройдёт), dashP — как часто от шара он не прыгает, а перебегает (если перебежка проходит чисто). readBall — «привыкание» для шара (по умолчанию как read; у шара 0: его не спамят,
  //   а бросок занимает ≈ 3,5 с, и «привыкание» только затягивало бы бой). Шар (владелец 12.10.2026: «Димасик часто уворачивается от шара, это затягивает бой»): шанс 0,5 / 0,55 и НИКОГДА не два подряд
  //   (maxStreak.ball = 1: после уклонения следующий шар попадает), в среднем ≈ 1,5 броска на попадание вместо ≈ 3,2.
  const TAC = {
    1: { windup: { dumbbell: 0.8, barbell: 0.85, discHigh: 0.8, discLow: 0.8 }, release: 0.2, guard: 1.4, pause: 0.68,
      walk: 165, backpedal: 250, gap: [330, 680], moveP: 0.55, hitMoveP: 0.5, idleMove: 2.4, minMove: 120,
      dodge: { chance: { ball: 0.5, dart: 0.58, pellet: 0.78 }, read: 0.12, readBall: 0, readMax: 3, cooldown: 0.75, maxStreak: { ball: 1, dart: 5, pellet: 5 }, dashP: 0.5, walk: true } },
    // вторая фаза (владелец: «начинает активнее двигаться по боевому полю и быстрее метает снаряды — в плане атак спида, а не скорости полёта»): замахи ×0,75, пауза 0,35 вместо 0,68, ходит быстрее и чаще
    2: { windup: { dumbbell: 0.6, barbell: 0.64, discHigh: 0.6, discLow: 0.6 }, release: 0.15, guard: 1.2, pause: 0.35,
      walk: 225, backpedal: 300, gap: [300, 620], moveP: 0.85, hitMoveP: 0.75, idleMove: 1.5, minMove: 140,
      dodge: { chance: { ball: 0.55, dart: 0.65, pellet: 0.8 }, read: 0.12, readBall: 0, readMax: 3, cooldown: 0.7, maxStreak: { ball: 1, dart: 5, pellet: 5 }, dashP: 0.6, walk: true } },
  };
  const EASY_DODGE = { chance: { ball: 0.35, dart: 0.3, pellet: 0.18 }, read: 0, readMax: 0, cooldown: 2.5, maxStreak: { ball: 1, dart: 2, pellet: 2 }, dashP: 0, walk: false };
  const EASY = {
    1: { windup: { dumbbell: 0.8, barbell: 0.85, discHigh: 0.8, discLow: 0.8 }, release: 0.2, guard: 0, pause: 0.68, walk: 130, backpedal: 220, gap: [330, 700], moveP: 0.3, hitMoveP: 0.2, idleMove: 4, minMove: 100, dodge: EASY_DODGE },
    2: { windup: { dumbbell: 0.8, barbell: 0.85, discHigh: 0.8, discLow: 0.8 }, release: 0.2, guard: 0, pause: 0.5, walk: 150, backpedal: 240, gap: [330, 700], moveP: 0.4, hitMoveP: 0.3, idleMove: 3.2, minMove: 100, dodge: EASY_DODGE },
  };

  const D = (Ale.DIMASIK = {
    // Шкала: 16 единиц (было 14; владелец 09.10.2026: «сделать сложнее» — рогатке и дротикам нужно на два попадания больше; шару — восемь: 8 × 2 = 16, с 09.10.2026 вечером он снимает 2, а не 4), переходная фаза — с середины (PHASE2_AT).
    // В лёгком режиме — прежние 14 (HP_EASY): бой не тяжелее прежнего. Шкала попытки фиксируется в startFight (hpMax), середина — phase2At
    W: 50, H: 158, HP: 16, HP_EASY: 14, INVUL: 0.35, STEP_SPEED: 100, STRIDE: 28,
    FIRST_DELAY: 1.2, PHASE2_AT: 8, HEAL2: 2,
    TAC, EASY,
    // Поле. hard — дальше этого от героини он сам не стоит (830 + поля камеры 80 и 70 = 980 ≤ самого узкого вида 1000: оба в кадре; на замахе и «руках у груди» он не идёт следом, тогда камера
    // сужает поля — kyiv_story.js, camFrame), stompGap — ближе этого не подходит (зона «Туп лапой» 217 юн. от её опоры + полширины + запас),
    // predict — на сколько секунд вперёд он прикидывает, где будет героиня (она бежит 340 юн./с: подбегающую он встречает отступлением заранее), urgent — допуск, после которого он идёт на место сразу
    FIELD: { hard: 830, stompGap: 280, predict: 0.3, urgent: 8, accel: 1600 },
    READ: { dx: 110, dt: 3.2 },                        // «привыкание к ритму»: выстрелы подряд с одного места (не дальше dx юн. от прошлого и не позже dt с после него)
    RECOVER: 0.35,                                     // «руки у груди» после броска хотя бы столько (и в лёгком режиме, где блока нет)
    // Переходная фаза (середина шкалы): t — сколько он злится на месте (dim_shout, дрожь, пар; по нему не попасть), after — пауза после неё до первого замаха второй фазы, puff — пар из ушей, раз в puff с
    ENRAGE: { t: 1.3, after: 0.3, puff: 0.22, shake: 2.4 },
    // Фразы: first — к этой секунде боя первая фраза звучит, даже если ничего не случилось; delay — пауза после события, которое её вызвало; life — сколько висит облачко (первая, вторая); shout — сколько
    // держится кадр «кричит», если он в это время стоит
    TAUNT: { first: 6, delay: 0.35, life: [2.6, 2.8], shout: 1.1 },
    // Побои: пороги шкалы (урон), с которых кофта и лицо выглядят всё хуже — кадры стоя dmg1…dmg3 и накладка кодом на остальные кадры (ходьба, замахи); уходит он в самой последней стадии
    WEAR: [5, 8, 12],
    // Уклонение. tell — присед перед прыжком (читается: он сжимается); peak — высота прыжка (ступни выше полёта дротика на высоте груди: 92 + радиус 9 = 101, с запасом), g — тяжесть прыжка (подъём
    // до верха 0,21 с, в воздухе 0,43 с: прыжок быстрый, потому что дротик и шарик долетают за 0,3–0,7 с); land — приземление; minLead — меньше этого времени до попадания он не реагирует
    // (присед 0,12 + подъём выше снаряда 0,12 + запас); afterPause — после приземления не сразу замах. Шансы, пауза и серия — в TAC[фаза].dodge.
    // back — на сколько юнитов он отпрыгивает назад (от героини; отрицательные — вперёд): шар падает на него сверху-спереди под крутым углом и одним прыжком вверх его не обойти, поэтому для шара
    // отход 100…190; дротик и шарик идут на высоте груди, им хватает прыжка на месте. dash — перебежка (от шара; от дальнего выстрела, который не долетит): присед tell, бег speed юн./с на len юн.
    // (положительные — назад), остановка stop. Пробуется по порядку, берётся первое, при котором снаряд проходит ЧИСТО (расчёт по всей траектории, _clears), иначе он не пытается.
    DODGE: { tell: 0.12, peak: 128, g: 5600, land: 0.1, minLead: 0.26, afterPause: 0.2,
      back: { ball: [0, 100, 130, 160, 190, -60, -100, -130], shot: [0, 50, 100] },
      dash: { tell: 0.1, speed: 620, len: [170, 210, 140, -140, -180], stop: 0.1, lead: 0.25 } },
    SEQ1: ['dumbbell', 'barbell', 'discHigh', 'dumbbell', 'barbell', 'discLow'],
    SEQ2: ['barbell', 'dumbbell', 'discLow', 'dumbbell', 'discHigh'],
    // гантель: время полёта до пола 1,05 с, тяжесть 1150; центр у кистей (кадр «бросок»: ≈ 100–115 юн. над землёй), зона столкновения 30×24
    DUMB: { flight: 1.05, g: 1150, hand: [72, 116], w: 30, h: 24, ring: 90 },
    // штанга: скорость 390 юн./с, опасная зона 80×64 с нижней гранью на полу; докатившись до arena.reach (за стойкой; в лёгком режиме — до ограждения), останавливается и теряет опасность.
    // Её толкают, а не бросают: за 0,4 с она разгоняется до 390 (accel), замах читается 0,85 с (во второй фазе 0,64), а ближе 280 юн. он к героине не подходит
    // view — масштаб картинки prop_barbell (вписывает её в зону 80 × 64); wobbleLen — путь (юн.) на одну «фазу» качения, bob — подскок (юн.) и tilt — крен (рад.) картинки по пройденному пути: только вид
    BAR: { speed: 390, accel: 975, w: 80, h: 64, hand: [58, 64], view: 0.78, wobbleLen: 22, bob: 2.4, tilt: 0.04 },
    // диск: gravity 0, vy 0, скорость 500; центр высокого — 112 юн. над полом, низкого — 48; зона 42×20; tilt (рад.) и breath (доля высоты) — покачивание картинки prop_disc, только вид.
    // Долетев до arena.reach, теряет опасность и падает: fall — тяжесть, drag — торможение по горизонтали, юн./с² (катится и ложится, не долетая до поста Бубела)
    DISC: { speed: 500, w: 42, h: 20, high: 112, low: 48, hand: 62, tilt: 0.09, breath: 0.05, fall: 1600, drag: 1300 },
    WALK: [1, 2, 3, 4, 5, 6].map((i) => 'dim_walk' + i),
    SIT: 34,                                           // запасной вид (нет нарисованных сидячих кадров): стоячий кадр рисуется на столько ниже, нижнюю часть закрывает скамья (оформление, z выше его)
    // Нарисованные кадры (заказы 20–24, набор dimasik_x): все смотрят вправо, нижний пиксель — на линии земли (у прыжка dim_dodge2 — нижняя стопа), якорь — центр стойки
    FR: { sit: 'dim_sit1', glare: 'dim_sit2', rise: 'dim_rise', plateHi: 'dim_plate_hi', plateLo: 'dim_plate_lo', plateRel: 'dim_plate_rel', crouch: 'dim_dodge1', jump: 'dim_dodge2', hit: 'dim_hit', shout: 'dim_shout', down: 'dim_down' },
    // Сидячий кадр стоит подошвами на земле, а скамья (верх сиденья на 50 юн., верхняя плоскость до 58) закрывает всё ниже груди; кадр ниже земли на 8 юн.: макушка сидящего остаётся на прежней высоте (≈ 126 юн. над землёй,
    // как у стоячего кадра, опущенного на SIT), а не на 134 — стол с доской (72…97 юн.) и скамья не меняют отношение к его голове. При вставании смещение сходит на нет вместе с sit.
    SIT_DROP: 8,
    FLINCH: 0.3, HIT_T: 0.28,                          // вздрагивание после попадания, с; кадр dim_hit показывается первые HIT_T секунд из них (на последних 0,02 с — обычный вид)
    SAFE: 24,                                          // лёгкий режим: опасные предметы встают так, чтобы их кромка была не ближе fence + 24 (героиня в зоне пополнения — ей ничего не грозит, как в прежнем бою)
    // Что нарисовано в кадре «в руках» (предмет — часть картинки): по этой таблице тесты проверяют, что в каждом состоянии предмет виден ровно один раз (в кадре ИЛИ накладкой, не оба и не остаток прошлой атаки).
    // dim_guard нарисован вместе с гантелью, брошенной позади (отдельное пятно) — в игре вместо него dim_guard_c без этого пятна. Блин на замахе диска нарисован в руке (dim_plate_hi / dim_plate_lo, заказ 21):
    // кодовый диск поверх кадра рисуется только тогда, когда этих кадров в сборке нет.
    BAKED: { dim_db_ready: 'dumbbell', dim_db_wind: 'dumbbell', dim_bb_ready: 'barbell', dim_bb_wind: 'barbell', dim_bb_swing: 'barbell', dim_bb_recover: 'barbell', dim_guard: 'dumbbell', dim_plate_hi: 'disc', dim_plate_lo: 'disc' },
    // Где кулак держит диск на замахе (запасной вид без кадров dim_plate_*; юниты от опоры, кадр смотрит вправо): центр передней кисти по пикселям кадра
    GRIP: { dim_guard_c: [41.9, 103.7], dim_idle: [27.4, 62.8], dim_dmg1: [28.1, 61.8], dim_dmg2: [26.8, 62], dim_dmg3: [23.8, 60.2] },
  });
  { const G = D.DODGE; G.v0 = Math.sqrt(2 * G.g * G.peak); G.climb = G.v0 / G.g; G.tellT = Math.ceil(G.tell * 60 - 1e-6) / 60; G.dash.tellT = Math.ceil(G.dash.tell * 60 - 1e-6) / 60; }       // скорость отрыва, время подъёма до верхней точки и присед, округлённый до тактов (0,1333 с)
  const easy = () => !!(Ale.Settings && Ale.Settings.easy);

  // =================================================================== рисунки: чистый «guard», диск, побои
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const has = (name) => !!(Ale.Assets && Ale.Assets.sprites[name]);                  // есть ли кадр в сборке (старая сборка assets без новых кадров работает по-прежнему)

  // Кадр «guard» (руки у груди) нарисован вместе с гантелью, брошенной позади него: это отдельное пятно рядом с телом. Он стоял в замахе диска и в «руки у груди» после каждого броска, и гантель
  // «прилипала» к нему (владелец 03.10.2026: «к нему прилепливаются иногда текстуры гантели и диска»). Предмет у Димасика должен быть один и в руке, поэтому здесь копия кадра без всех пятен,
  // не связанных с телом (связные области непрозрачных пикселей: остаётся самая большая).
  function stripDetached(srcName, dstName) {
    const A = Ale.Assets, s = A.sprites[srcName];
    if (!s) return null;
    if (A.sprites[dstName]) return A.sprites[dstName];
    try {
      const W = s.img.width, H = s.img.height, c = cv(W, H), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(s.img, 0, 0);
      const id = g.getImageData(0, 0, W, H), px = id.data, lab = new Int32Array(W * H), sizes = [0], stack = [];
      let n = 0;
      for (let p0 = 0; p0 < W * H; p0++) {
        if (lab[p0] || px[p0 * 4 + 3] <= 8) continue;
        n++; lab[p0] = n; stack.push(p0); let cnt = 0;
        while (stack.length) {
          const q = stack.pop(), qx = q % W, qy = (q / W) | 0; cnt++;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const nx = qx + ox, ny = qy + oy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const np = ny * W + nx;
            if (!lab[np] && px[np * 4 + 3] > 8) { lab[np] = n; stack.push(np); }
          }
        }
        sizes.push(cnt);
      }
      let big = 1; for (let i = 2; i <= n; i++) if (sizes[i] > sizes[big]) big = i;
      let removed = 0;
      for (let p = 0; p < W * H; p++) if (lab[p] && lab[p] !== big) { px[p * 4 + 3] = 0; removed++; }
      g.putImageData(id, 0, 0);
      const out = A.sprites[dstName] = { name: dstName, img: c, w: s.w, h: s.h, ax: s.ax, ay: s.ay, hs: s.hs, el: s.el || 0, pts: s.pts || null, white: null };
      out.stripped = removed; out.components = n;
      return out;
    } catch (e) { return null; }                       // холст недоступен для чтения (закрытый источник): остаётся прежний кадр
  }
  // Кадр «guard» без чужой гантели; если подготовить не удалось — прежний
  const guardFrame = () => { const A = Ale.Assets; return A.sprites.dim_guard_c ? 'dim_guard_c' : (stripDetached('dim_guard', 'dim_guard_c') ? 'dim_guard_c' : 'dim_guard'); };

  // Диск (блин от штанги) сверху-сбоку: тёмный эллипс с отверстием, по ободу бегут блики (spin). Один рисунок и для диска в руке на замахе, и для летящего.
  function paintDisc(ctx, spin) {
    ctx.beginPath(); ctx.ellipse(0, 0, 23, 10.5, 0, 0, 6.283); ctx.fillStyle = Ale.Art.linG(ctx, 0, -10, 0, 10, [[0, '#6c7284'], [0.5, '#3a3e4c'], [1, '#1f212b']]); ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 6.8, 0, 0, 6.283); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.6;
    for (let i = 0; i < 2; i++) { const a = spin + i * Math.PI; ctx.beginPath(); ctx.ellipse(0, 0, 20.5, 8.8, 0, a, a + 0.9); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, 6.4, 2.8, 0, 0, 6.283); ctx.fillStyle = '#0d0e14'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = '#8b8fa3'; ctx.stroke();
  }

  // Побои. Кадры стоя (dim_idle, dim_dmg1…3) нарисованы со стадиями; на всех остальных кадрах (ходьба, замахи, прыжок) стадии накладываются кодом: производный кадр «имя_w1…w3» строится при первом
  // обращении и запоминается (как пятна училки, Ale.Stain.frame). Положение лица и кофты берётся из самих пикселей кадра, а не из чисел: ближний глаз — самый большой белок в верхней трети кадра,
  // кофта — красные пиксели; всё считается в юнитах от глаза и от рамки кофты, поэтому не зависит от масштаба и позы. Накладка рисуется ТОЛЬКО по коже (синяки, пластырь) и ТОЛЬКО по кофте
  // (грязь, царапины, прореха): контуры, глаз и фон не затрагиваются.
  // Стадии: 1 — синяк на скуле (как в dmg1); 2 — плюс синяк над глазом и грязь на кофте (dmg2); 3 — «фонарь» вокруг глаза, пластырь, потёртости и прореха на кофте (dmg3; так он уходит после боя).
  const Wear = {
    SKIP: /^dim_(idle|dmg[123])$/, info: {}, failed: {},
    // Кадры, где белка глаза нет (dim_hit: «Ай!», глаза зажмурены) — положение ближнего глаза (центр зажмуренной щели), снятое с картинки: юниты от опоры, x вперёд, y вверх
    EYE: { dim_hit: [27.5, 119.2] },
    eligible(name) { return !!Ale.Assets.sprites[name] && !this.SKIP.test(name) && !/_w\d$/.test(name); },
    // Классификация пикселей кадра: кожа / красная кофта / белок глаза (маски по размеру кадра)
    classify(s) {
      const W = s.img.width, H = s.img.height, c = cv(W, H), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(s.img, 0, 0);
      const px = g.getImageData(0, 0, W, H).data, skin = new Uint8Array(W * H), red = new Uint8Array(W * H), white = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) {
        const r = px[p * 4], gg = px[p * 4 + 1], b = px[p * 4 + 2], a = px[p * 4 + 3];
        if (a < 200) continue;
        if (r > 180 && r - b > 45 && gg > 100 && gg < 215 && r >= gg && gg >= b) skin[p] = 1;
        else if (r > 90 && r > gg * 2 && r > b * 2) red[p] = 1;
        else if (Math.min(r, gg, b) > 200 && Math.max(r, gg, b) - Math.min(r, gg, b) < 40) white[p] = 1;
      }
      return { W, H, skin, red, white };
    },
    // Разбор кадра: ближний глаз и рамка кофты в юнитах от опоры (x вперёд, y вверх); null, если глаз не найден.
    // Ближний глаз — самое большое белое пятно в верхней трети кадра. Но у кричащего и скалящегося Димасика зубы (кадры dim_plate_hi / dim_plate_lo, там зубы стиснуты) крупнее белка глаза: если заметно ВЫШЕ
    // (на 4+ юн.) есть другое пятно не меньше 30% самого большого — глаз это оно (дальний глаз на той же высоте, у нескольких кадров вторым пятном, выбор не меняет).
    analyse(name) {
      if (name in this.info) return this.info[name];
      const A = Ale.Assets, s = A.sprites[name], os = A.os, M = this.classify(s), W = M.W, H = M.H, top = Math.floor(H * 0.3);
      const seen = new Uint8Array(W * H), blobs = [];
      for (let p0 = 0; p0 < W * top; p0++) {
        if (seen[p0] || !M.white[p0]) continue;
        const st = [p0]; seen[p0] = 1; let cnt = 0, sx = 0, sy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
        while (st.length) {
          const q = st.pop(), qx = q % W, qy = (q / W) | 0; cnt++; sx += qx; sy += qy; x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = qx + ox, ny = qy + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= top) continue; const np = ny * W + nx; if (!seen[np] && M.white[np]) { seen[np] = 1; st.push(np); } }
        }
        if (cnt >= 10) blobs.push({ cnt, cx: sx / cnt, cy: sy / cnt, w: (x1 - x0 + 1) / os, h: (y1 - y0 + 1) / os });
      }
      let best = null;
      for (const b of blobs) if (!best || b.cnt > best.cnt) best = b;
      if (best) { let up = null; for (const b of blobs) if (b !== best && b.cnt >= best.cnt * 0.3 && best.cy - b.cy > 4 * os && (!up || b.cnt > up.cnt)) up = b; if (up) best = up; }
      let rx0 = W, rx1 = -1, ry0 = H, ry1 = -1;
      for (let p = 0; p < W * H; p++) if (M.red[p]) { const x = p % W, y = (p / W) | 0; if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y; }
      const U = (px, py) => [(px - s.ax) / os, (s.ay - py) / os];
      let info = null;
      const fixed = this.EYE[name];
      if ((best || fixed) && rx1 > rx0) {
        const [ex, ey] = fixed || U(best.cx, best.cy), [bx0, by1] = U(rx0, ry0), [bx1, by0] = U(rx1 + 1, ry1 + 1);
        info = { eye: { x: ex, y: ey, w: fixed ? 4 : best.w, h: fixed ? 1.5 : best.h }, red: { x0: bx0, x1: bx1, y0: by0, y1: by1 } };
      }
      return (this.info[name] = info);
    },
    // Все кадры с побоями заготавливаются заранее, по одному за такт (первый Димасик на странице, пока идут шахматы и вступление): кадр строится 3…11 мс, и посреди боя стадия не должна «подвисать»
    queue: null,
    prepare() {
      if (this.queue) return;
      // боевые кадры заказов 20–24 тоже заготавливаются заранее (диск в руке, бросок диска, оба кадра уклонения, «Ай!»); «побеждён» всегда в последней стадии. Сидячие кадры и «кричит» показываются до боя
      // и строятся при первом обращении (стадия там нулевая)
      const fr = D.FR, names = D.WALK.concat(['dim_guard_c', 'dim_db_throw', 'dim_db_ready', 'dim_db_wind', 'dim_bb_ready', 'dim_bb_wind'], [fr.plateHi, fr.plateLo, fr.plateRel, fr.crouch, fr.jump, fr.hit].filter(has));
      this.queue = [];
      for (const lv of [1, 2, 3]) for (const n of names) this.queue.push([n, lv]);
      if (has(fr.down)) this.queue.push([fr.down, 3]);
    },
    pump() { if (this.queue && this.queue.length) { const [n, lv] = this.queue.shift(); this.frame(n, lv); } },
    mask(arr, W, H) {
      const c = cv(W, H), g = c.getContext('2d'), id = g.createImageData(W, H);
      for (let p = 0; p < W * H; p++) if (arr[p]) id.data[p * 4 + 3] = 255;
      g.putImageData(id, 0, 0);
      return c;
    },
    // Имя кадра с побоями нужной стадии (0 или кадр без накладки — исходное имя)
    frame(name, level) {
      if (!level) return name;
      const A = Ale.Assets, key = name + '_w' + Math.min(3, level);
      if (A.sprites[key]) return key;
      if (this.failed[key] || !this.eligible(name)) return name;
      try {
        const info = this.analyse(name);
        if (!info) throw new Error('глаз не найден');
        this.build(A.sprites[name], info, Math.min(3, level), key);
      } catch (e) { this.failed[key] = true; return name; }                          // не вышло (холст закрыт для чтения, глаз не найден): кадр остаётся без накладки, повторно не пробуем
      return key;
    },
    build(s, info, level, key) {
      const A = Ale.Assets, os = A.os, M = this.classify(s), W = M.W, H = M.H;
      const out = cv(W, H), g = out.getContext('2d');
      g.drawImage(s.img, 0, 0);
      const face = cv(W, H), fg = face.getContext('2d'), cloth = cv(W, H), cg = cloth.getContext('2d');
      for (const l of [fg, cg]) { l.setTransform(os, 0, 0, -os, s.ax, s.ay); l.lineJoin = 'round'; l.lineCap = 'round'; }          // единицы от опоры: x вперёд, y вверх
      const blob = (l, x, y, rx, ry, rot, stops) => {
        l.save(); l.translate(x, y); l.rotate(rot); l.scale(rx, ry);
        const gr = l.createRadialGradient(0, 0, 0, 0, 0, 1); for (const [t, c] of stops) gr.addColorStop(t, c);
        l.fillStyle = gr; l.beginPath(); l.arc(0, 0, 1, 0, 6.283); l.fill(); l.restore();
      };
      const BRUISE = [[0, 'rgba(58,24,82,0.95)'], [0.5, 'rgba(96,40,112,0.78)'], [0.8, 'rgba(150,92,96,0.38)'], [1, 'rgba(150,92,96,0)']];
      const DIRT = [[0, 'rgba(46,24,22,0.5)'], [0.6, 'rgba(60,32,28,0.34)'], [1, 'rgba(60,32,28,0)']];
      const e = info.eye, R = info.red, rw = R.x1 - R.x0, rh = R.y1 - R.y0;
      // ближайший к точке рамки кофты красный пиксель (доли от левого/нижнего края рамки) → юниты: пятна ложатся на ткань, а не на воздух между руками и телом
      const redAt = (fx, fy) => {
        const cx = s.ax + (R.x0 + rw * fx) * os, cy = s.ay - (R.y0 + rh * fy) * os;
        for (let r = 0; r < 70; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = Math.round(cx + dx), y = Math.round(cy + dy);
          if (x >= 0 && y >= 0 && x < W && y < H && M.red[y * W + x]) return [(x - s.ax) / os, (s.ay - y) / os];
        }
        return [R.x0 + rw * fx, R.y0 + rh * fy];
      };
      // лицо
      if (level < 3) blob(fg, e.x - 1.5, e.y - 9.5, 3.9, 2.9, 0.3, BRUISE);                                   // синяк на скуле
      if (level >= 2) blob(fg, e.x - 3.4, e.y + 6, 3.5, 2.5, -0.3, BRUISE);                                     // у виска над глазом
      if (level >= 3) {
        blob(fg, e.x + 0.4, e.y - 1.2, 8.4, 6.4, 0.1, BRUISE);                                                 // «фонарь» вокруг глаза
        blob(fg, e.x - 5.5, e.y - 8.2, 2.6, 2, 0.3, BRUISE);                                                   // и синяк на скуле у уха
        fg.save(); fg.translate(e.x - 3.1, e.y - 8.9);                                                          // пластырь крест-накрест на щеке под синяком
        fg.strokeStyle = 'rgba(70,40,30,0.8)'; fg.lineWidth = 0.55;
        for (const a of [0.62, -0.62]) {
          fg.save(); fg.rotate(a);
          fg.fillStyle = '#ecd2a8'; fg.beginPath(); fg.rect(-4.6, -1.25, 9.2, 2.5); fg.fill(); fg.stroke();
          fg.fillStyle = 'rgba(205,160,118,0.9)'; fg.fillRect(-1.3, -1.25, 2.6, 2.5);
          fg.restore();
        }
        fg.restore();
      }
      // кофта
      if (level >= 2) {
        const a = redAt(0.34, 0.3), b = redAt(0.7, 0.55);
        blob(cg, a[0], a[1], 7, 3.6, 0.2, DIRT);
        blob(cg, b[0], b[1], 4.6, 3, -0.4, DIRT);
      }
      if (level >= 3) {
        const h = redAt(0.5, 0.1), t = redAt(0.62, 0.17);
        blob(cg, h[0], h[1], 9, 3.4, 0, DIRT);
        cg.strokeStyle = 'rgba(255,176,150,0.75)'; cg.lineWidth = 0.7;
        for (const [fx, fy, a, len] of [[0.46, 0.6, 0.6, 5.5], [0.52, 0.56, 0.6, 4], [0.4, 0.45, 0.5, 4.5]]) { const q = redAt(fx, fy); cg.beginPath(); cg.moveTo(q[0], q[1]); cg.lineTo(q[0] + Math.cos(a) * len, q[1] + Math.sin(a) * len); cg.stroke(); }
        cg.save(); cg.translate(t[0], t[1]);                                                                    // прореха у подола: рваная заплатка из ткани
        cg.fillStyle = '#c9a07a'; cg.strokeStyle = 'rgba(56,26,24,0.9)'; cg.lineWidth = 0.6;
        cg.beginPath(); cg.moveTo(-3.6, -1.2); cg.lineTo(-1.6, 1.8); cg.lineTo(0.2, -0.4); cg.lineTo(1.8, 2); cg.lineTo(3.6, -1.4); cg.lineTo(0.8, -2.6); cg.closePath(); cg.fill(); cg.stroke();
        cg.restore();
      }
      // обрезка по коже и по кофте: накладка не выходит за контуры
      fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalCompositeOperation = 'destination-in'; fg.drawImage(this.mask(M.skin, W, H), 0, 0);
      cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(this.mask(M.red, W, H), 0, 0);
      g.drawImage(face, 0, 0); g.drawImage(cloth, 0, 0);
      const sp = A.sprites[key] = { name: key, img: out, w: s.w, h: s.h, ax: s.ax, ay: s.ay, hs: s.hs, el: s.el || 0, pts: s.pts || null, white: null };
      return sp;
    },
  };
  Ale.DimasikWear = Wear;

  // =================================================================== снаряды-опасности
  class Hazard extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 40, h: 40, z: 60 }, o));
      this.team = 'enemy'; this.hazard = true; this.hit = false; this.finished = false; this.boss = o.boss;
    }
    hurtbox() { return { x: this.x - 20, y: this.y - 20, w: 40, h: 40 }; }       // сама опасность — hitbox() ниже; hurtbox нужен интерфейсу подсказок
    hitbox() { return this.hurtbox(); }
    debugDraw(ctx) { const b = this.hitbox(); ctx.strokeStyle = 'rgba(255,0,255,0.9)'; ctx.strokeRect(b.x, b.y, b.w, b.h); }
    // Попадание по героине: ровно одно сердце на предмет (вторично не засчитывается)
    _tryHit(kind) {
      const p = this.scene.player;
      if (this.hit || this.finished || !p || p.down) return false;
      if (!Ale.overlap(this.hitbox(), p.hurtbox())) return false;
      if (p.takeHit({ kind, dir: p.x >= this.x ? 1 : -1, dmg: 1, x: this.x, y: this.y, src: this })) { this.hit = true; if (this.boss && this.boss.hitHer) this.boss.hitHer(this); return true; }
      return false;
    }
    // Предмет больше не грозит героине (приземлился / остановился / пролетел мимо неё / улетел): боссу можно готовить следующий замах
    _finish() { if (this.finished) return; this.finished = true; if (this.boss && this.boss.hazardGone) this.boss.hazardGone(this); }
    // Катящийся или летящий влево предмет миновал героиню: он целиком левее её (с запасом 6 юн.). Догнать его она не может (бежит 340 юн./с, штанга 390, диск 500), поэтому дальше он не опасен,
    // а Димасик уже может начинать отсчёт до следующей атаки — предметы долетают далеко за стойку, и ждать, пока предмет докатится, было бы долго
    _passed() { const p = this.scene && this.scene.player; if (!p || p.down) return false; const b = this.hitbox(), h = p.hurtbox(); return this.dir < 0 ? b.x + b.w < h.x - 6 : b.x > h.x + h.w + 6; }
    kill() { this.dead = true; this.finished = true; }
  }

  // ---- гантель: парабола к точке, отмеченной в начале замаха
  class Dumbbell extends Hazard {
    constructor(o) {
      super(o);
      const C = D.DUMB, gy = o.groundY;
      this.targetX = o.targetX; this.gy = gy; this.g = C.g; this.rot = 0; this.landed = false; this.landT = 0; this.wind = o.wind || 0.8;      // wind — его замах (метка разгорается за замах и полёт)
      this.vx = (o.targetX - o.x) / C.flight;
      this.vy = (gy - 12 - o.y - 0.5 * C.g * C.flight * C.flight) / C.flight;      // в координатах Canvas положительный vy — вниз
    }
    hurtbox() { return { x: this.x - 15, y: this.y - 12, w: 30, h: 24 }; }
    update(dt) {
      this.t += dt;
      if (this.pre) return;                                // замах: гантель ещё у него в руках (нарисована в кадре), на земле — только метка
      if (this.landed) { this.landT += dt; if (this.landT > 0.45) this.dead = true; return; }
      this.vy += this.g * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += 4.2 * dt * (this.vx < 0 ? -1 : 1);
      this._tryHit('dumbbell');
      if (this.y + 12 >= this.gy && this.vy > 0) this._land();
    }
    _land() {
      this.landed = true; this.y = this.gy - 12; this.vx = this.vy = 0; this.finished || this._finish();
      const sc = this.scene;
      sc.fx.dust(this.x, this.gy, 5, 0, 0.9); sc.camera.shake(4, 0.18); Ale.Audio.sfx('dumb_land');           // касание пола — только эффект, второго опасного отскока нет
    }
    // Метка падения: круг на земле (90 юн. шириной), не гонится за героиней; исчезает с касанием
    drawMarker(ctx) {
      if (this.landed) return;
      const k = Ale.clamp(this.t / (D.DUMB.flight + this.wind), 0, 1), r = D.DUMB.ring / 2;
      ctx.save(); ctx.translate(this.targetX, this.gy + 5); ctx.scale(1, 0.28);
      ctx.fillStyle = 'rgba(214,52,33,' + (0.14 + 0.16 * k).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(214,52,33,' + (0.55 + 0.35 * Math.sin(this.t * 12) * 0.5 + 0.2).toFixed(2) + ')'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      this.drawMarker(ctx);
      if (this.pre) return;
      if (!this.landed) { const sh = Ale.clamp(1 - (this.gy - y) / 340, 0, 1); Ale.Art.shadow(ctx, x, this.gy + 2, 22 * (0.4 + 0.6 * sh), 0.28 * sh); }
      // картинка prop_dumbbell (66 × 30 юн., заказ 21) вращается как прежняя; нет её в сборке — прежняя кодовая гантель kit_dumbbell (64 × 34)
      Ale.drawSprite(ctx, has('prop_dumbbell') ? 'prop_dumbbell' : 'kit_dumbbell', x, y, { rot: this.rot, alpha: this.landed ? Ale.clamp(1 - this.landT / 0.45, 0, 1) : 1 });
    }
  }

  // ---- штанга: катится по полу справа налево
  class Barbell extends Hazard {
    // x — где она выпала из рук; stopX — докуда она катится (левый край предмета): arena.reach за стойкой, в лёгком режиме — ограждение + SAFE (fenceX — прежнее имя того же числа)
    constructor(o) {
      super(o);
      this.gy = o.groundY; this.stopX = o.stopX !== undefined ? o.stopX : o.fenceX + D.SAFE; this.mode = 'drop'; this.rot = 0; this.fade = 1; this.dir = o.dir || -1; this.dist = 0;
    }
    hurtbox() { return { x: this.x - 40, y: this.gy - 64, w: 80, h: 64 }; }
    hitbox() { return this.hurtbox(); }
    get dangerous() { return this.mode === 'roll'; }
    update(dt) {
      this.t += dt;
      if (this.mode === 'drop') {                         // выпала из рук и мгновенно встала на пол (1/8 с): её толкнули, а не бросили сверху
        this.vy += 3600 * dt; this.y += this.vy * dt;
        if (this.y >= this.gy - 32) { this.y = this.gy - 32; this.mode = 'roll'; this.vx = 0; this.rollT = 0; this.scene.fx.dust(this.x, this.gy, 3, -this.dir, 0.7); Ale.Audio.sfx('barrel_kick'); }
        return;
      }
      if (this.mode === 'roll') {
        this.rollT += dt; this.vx = this.dir * Math.min(D.BAR.speed, D.BAR.accel * this.rollT);
        this.x += this.vx * dt; this.rot += this.vx * dt / 32; this.dist += Math.abs(this.vx) * dt;
        if (Math.floor(this.t * 10) !== Math.floor((this.t - dt) * 10)) this.scene.fx.dust(this.x - this.dir * 36, this.gy, 1, -this.dir, 0.4);
        Ale.Audio.hold('barrel_roll', 0.9);
        this._tryHit('barbell');
        if (!this.finished && this._passed()) this._finish();                 // проехала мимо героини: дальше катится, но уже не опасна, Димасик готовит следующую атаку
        if (this.x - 40 <= this.stopX) this._stop();                          // докатилась до reach (за стойкой) или, в лёгком режиме, до ограждения
      } else {                                            // остановилась: опасности нет, остаток вскоре убирается
        this.stopT += dt; this.fade = Ale.clamp(1 - (this.stopT - 0.6) / 0.5, 0, 1); if (this.stopT > 1.1) this.dead = true;
      }
    }
    _stop() {
      this.mode = 'stopped'; this.stopT = 0; this.vx = 0; this._finish();
      this.scene.fx.dust(this.x, this.gy, 4, 0, 0.8); this.scene.camera.shake(3, 0.15); Ale.Audio.sfx('dumb_land');
    }
    _plate(ctx, cx, cy, r, rot, shade) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fillStyle = Ale.Art.linG(ctx, cx - r, cy - r, cx + r, cy + r, shade ? [[0, '#4a4e5c'], [1, '#262833']] : [[0, '#6c7284'], [0.5, '#3a3e4c'], [1, '#202230']]); ctx.fill();
      ctx.lineWidth = 3.4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, 6.283); ctx.stroke();
      if (shade) return;
      // вращение читается по меткам: «20», три светлые дуги и отверстие ступицы
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.fillStyle = 'rgba(240,240,250,0.8)'; ctx.font = 'bold 15px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('20', 0, -r * 0.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2.6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * 0.86, i * 2.09 + 0.5, i * 2.09 + 0.95); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, 6.283); ctx.fillStyle = '#c7c9d6'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.08, 0, 6.283); ctx.fillStyle = '#16161c'; ctx.fill();
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha), r = 32, o = 14;
      ctx.save(); ctx.globalAlpha = this.fade;
      if (this.mode === 'roll') this.drawShadow(ctx, x, this.gy, 48, 0.3); else if (this.mode === 'stopped') Ale.Art.shadow(ctx, x, this.gy, 46, 0.28);
      if (has('prop_barbell')) {
        // картинка prop_barbell (106 × 82 юн., заказ 21: катящаяся штанга в три четверти, ближний блин лицом, гриф уходит вверх к дальнему блину) нарисована для качения ВЛЕВО («toward the lower left» в заказе) —
        // так она и катится в игре (dir = −1); вправо — зеркально. Масштаб 0,78 вписывает её в зону столкновения (80 × 64, низ на полу): центр картинки — прежняя ось (y = пол − 32).
        // Картинка одна, поэтому «качение» — подскок и лёгкий крен по пройденному пути
        const k = D.BAR.view, sw = this.mode === 'roll' ? Math.sin(this.dist / D.BAR.wobbleLen) : 0;
        Ale.drawSprite(ctx, 'prop_barbell', x, y - Math.abs(sw) * D.BAR.bob, { flip: this.dir > 0, sx: k, sy: k, rot: sw * D.BAR.tilt });
      } else {
        // гриф идёт «к зрителю»: дальний диск смещён вверх-влево и притемнён, между дисками — хромированный гриф
        this._plate(ctx, x - o, y - o * 0.5, r, 0, true);
        ctx.beginPath(); ctx.moveTo(x - o, y - o * 0.5); ctx.lineTo(x, y); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#c9cbd8'; ctx.stroke();
        this._plate(ctx, x, y, r, this.rot, false);
      }
      ctx.restore();
    }
  }

  // ---- диск от штанги: летит горизонтально, как фрисби
  class Disc extends Hazard {
    // stopX — докуда диск летит (левый край): arena.reach за стойкой, в лёгком режиме — ограждение + SAFE (fenceX — прежнее имя)
    constructor(o) {
      super(o);
      this.gy = o.groundY; this.stopX = o.stopX !== undefined ? o.stopX : o.fenceX + D.SAFE; this.vx = (o.dir || -1) * D.DISC.speed; this.vy = 0; this.spin = 0; this.high = !!o.high; this.dir = o.dir || -1;
      this.falling = false; this.fade = 1; this.restT = 0;
    }
    hurtbox() { return { x: this.x - 21, y: this.y - 10, w: 42, h: 20 }; }
    hitbox() { return this.hurtbox(); }
    get dangerous() { return !this.falling && !this.finished; }
    update(dt) {
      this.t += dt; this.spin += dt * 16;
      if (this.falling) {                                  // долетел до reach: не опасен, падает, звякает о землю и катится, ложится и тает
        const C = D.DISC;
        this.vy += C.fall * dt; this.vx = Ale.approach(this.vx, 0, C.drag * dt);
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.y >= this.gy - 6) { this.y = this.gy - 6; if (this.vy > 160) { this.vy = -this.vy * 0.28; this.scene.fx.dust(this.x, this.gy, 2, 0, 0.5); Ale.Audio.sfx('soft_hit'); } else this.vy = 0; }
        if (this.vy === 0 && Math.abs(this.vx) < 1) { this.restT += dt; this.fade = Ale.clamp(1 - (this.restT - 0.3) / 0.4, 0, 1); if (this.restT > 0.7) this.dead = true; }
        return;
      }
      this.x += this.vx * dt;                              // в полёте y не меняется никогда: ни тяжести, ни вращения «в высоту»
      if (Math.floor(this.t * 20) !== Math.floor((this.t - dt) * 20)) this.scene.fx.dust(this.x - this.dir * 24, this.y + 4, 1, -this.dir, 0.2);
      this._tryHit('disc');
      if (!this.finished && this._passed()) this._finish();                 // пролетел мимо героини: дальше летит, но уже не опасен
      if (this.dir < 0 ? this.x - 21 <= this.stopX : this.x > this.scene.width + 40) {      // долетел до reach (за стойкой) или, в лёгком режиме, до ограждения
        this.falling = true; this._finish(); this.vx *= 0.35; this.vy = -60;
        this.scene.fx.ring(this.x, this.y, 22, 'rgba(255,255,255,'); this.scene.fx.sparks(this.x, this.y, 3, 'rgba(230,230,255,'); Ale.Audio.sfx('soft_hit');
      }
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      Ale.Art.shadow(ctx, x, this.gy + 2, 22, 0.2 * this.fade);
      const rest = this.falling ? Ale.clamp((y - (this.gy - 60)) / 54, 0, 1) : 0;          // падая, ложится плашмя
      if (has('prop_disc')) {
        // картинка prop_disc (49 × 26 юн., заказ 21: блин под углом, летит плашмя; свет, как у всех предметов, сверху слева) покачивается: чуть кренится и «дышит» по высоте (центр и зона столкновения 42 × 20 не меняются,
        // высота полёта постоянна). Летит влево (dir = −1), как в игре; вправо — зеркально
        Ale.drawSprite(ctx, 'prop_disc', x, y, { flip: this.dir > 0, rot: D.DISC.tilt * Math.sin(this.t * 9) * (1 - rest), sy: (1 + D.DISC.breath * Math.sin(this.t * 14)) * (1 - 0.45 * rest), alpha: this.fade });
        return;
      }
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= this.fade; if (rest) ctx.scale(1, 1 - 0.45 * rest);
      paintDisc(ctx, this.spin);                          // запасной вид: диск сверху-сбоку — тёмный эллипс с отверстием, по ободу бегут блики (вращение), вертикальный размер не меняется
      ctx.restore();
    }
  }

  // =================================================================== сам Димасик
  class Dimasik extends Ale.Entity {
    // o.arena: { fence, reach, strip1, field0, field1 } — ограждение (левый край половины Алеси), докуда долетают его предметы (за стойкой), правый предел её половины, его поле (где может стоять его центр)
    constructor(o) {
      super(Object.assign({ w: D.W, h: D.H, z: 53, id: 'dimasik', facing: -1 }, o));
      this.headH = 188; this.hurtW = 48;
      this.team = 'enemy'; this.vulnerable = false; this.aimable = true;
      this.arena = o.arena;
      this.dmg = 0; this.invul = 0; this.flinch = 0; this.flash = 0; this.hpMax = D.HP; this.phase2At = D.PHASE2_AT;
      this.state = 'script'; this.st = 0; this.pause = 0;
      this.seq = 0; this.phase = 1; this.phase2Pending = false; this.phase2Seen = false;
      this.attacksDone = 0; this.stepTo = null; this.stepSpeed = D.STEP_SPEED; this.stepUrgent = false; this.atk = null; this.cur = null;
      this.pose = null; this.walkPhase = 0; this.limp = false; this.auto = null; this.shoutCool = 0;
      this.seen = {};
      this.angry = false; this.depth = 0;                              // angry — уходит от шахмат злым шагом; depth 0…1 — растворяется вглубь парка в проёме изгороди
      this.seated = !!o.seated; this.sit = this.seated ? 1 : 0;      // сидит за шахматами (владелец 03.10.2026): sit 0…1 плавно, встаёт, когда seated = false
      this.hopY = 0; this.hopV = 0; this.dg = null; this.plan = null;  // уклонение: высота ступней над землёй и её скорость, ход манёвра { type, phase, t }, решение уклониться { e, man, startAt }
      this.dodgeCool = 0; this.dodgeStreak = 0; this.dodgeCount = 0; this.dodgeWhy = {};   // ожидание после уклонения, подряд без попаданий, всего за попытку, причины отказов
      // ходьба по полю: moveCool — сколько ещё нельзя менять место по своей воле; moveWant — решил сменить место (после атаки или попадания); stillT — сколько стоит на месте;
      // anchored — проверки (tests) замораживают его на месте целиком; moves / path — сколько раз и сколько юнитов он прошёл за попытку (для проверок и подбора чисел)
      this.moveCool = 0; this.moveWant = false; this.stillT = 0; this.anchored = false; this.moves = 0; this.path = 0;
      this.read = 0; this.lastShot = null;                             // «привыкание к ритму»: сколько её выстрелов подряд с одного места и где был прошлый
      this.blocks = 0; this.blockT = 0;                                // сколько выстрелов отбил «руками у груди» (и в переходной фазе) и вспышка блока
      this.taunted = [false, false]; this.tauntQ = null; this.taunts = []; this.shoutT = 0; this.fightT = 0;     // фразы: какие сказаны, отложенная, журнал { i, t } (для проверок), кадр «кричит», время боя
      if (Ale.Assets && Ale.Assets.sprites.dim_guard) { guardFrame(); Wear.prepare(); }    // чистый кадр «guard» готов заранее (на первом замахе диска не будет паузы), кадры с побоями — по одному за такт
    }

    // Зона попадания поднимается вместе с ним: в прыжке снаряд на высоте груди проходит под ногами
    hurtbox() { return { x: this.x - this.hurtW / 2, y: this.y - D.H - this.hopY, w: this.hurtW, h: D.H }; }
    get down() { return this.state === 'down' || this.state === 'leave'; }
    autoWalk(x, opts) { this.auto = { x, speed: (opts && opts.speed) || D.STEP_SPEED, arrive: (opts && opts.arrive) || 6 }; }
    // Тактика текущей фазы (лёгкий режим — EASY: прежний бой)
    tac() { return (easy() ? EASY : TAC)[this.phase === 2 ? 2 : 1]; }

    // ---- ход боя ---------------------------------------------------------------------------------------------------
    // Попытка началась (Алеся вышла на площадку): через 1,2 с — первый замах
    startFight() {
      this.state = 'wait'; this.st = 0; this.pause = D.FIRST_DELAY; this.vulnerable = true; this.pose = null; this.auto = null;
      this.hopY = 0; this.hopV = 0; this.dg = null; this.plan = null; this.dodgeCool = 0; this.dodgeStreak = 0; this.dodgeCount = 0;
      this.moveCool = 0.6; this.moveWant = false; this.stillT = 0; this.stepTo = null; this.read = 0; this.lastShot = null; this.fightT = 0;
      this.hpMax = easy() ? D.HP_EASY : D.HP; this.phase2At = Math.ceil(this.hpMax / 2);
      this.scene.boss = { name: Ale.Speakers.dimasik.name, max: this.hpMax, value: () => this.dmg };
    }

    // Где кончается зона, в которой он бросает (её левее — не бросает: ушла с площадки совсем), и докуда долетают его предметы: обычный бой — reach за стойкой, лёгкий — ограждение, как раньше
    _activeX() { return easy() ? this.arena.fence : this.arena.reach; }
    _stopX() { return easy() ? this.arena.fence + D.SAFE : this.arena.reach; }
    fieldActive() { const p = this.scene.player; return !!p && !p.down && p.x >= this._activeX(); }
    _ballRolling() { const k = this.scene.kit; return !!(k && k.ballActive); }
    // Виден ли он в кадре: бросать из-за края экрана он не начинает (ТЗ: «опасность не выпускается за пределами вида»; камера и так держит обоих, пока героиня на площадке)
    _inView() { const c = this.scene.camera; if (!c || !c.viewW) return true; return this.x + 22 >= c.x && this.x - 22 <= c.x + c.viewW; }
    // Шар у неё в руках (замах) или в воздухе: стоит на месте (шаг прерывается), пунктир не обманывает
    holdStep() { if (this.state === 'step' && !this.stepUrgent) { this.state = 'wait'; this.vx = 0; this.stepTo = null; } this.moveWant = false; }

    // Его предмет больше не грозит героине (упал, проехал мимо неё, остановился): отсчёт паузы до следующей атаки; иногда сразу сменит место
    hazardGone(h) {
      if (h && this.cur && h !== this.cur) return;
      this.cur = null; this.attacksDone++;
      const T = this.tac();
      this.pause = T.pause;
      if (Ale.rng.chance(T.moveP)) this.moveWant = true;
      if (this.state === 'idleWait') { this.state = 'wait'; this.st = 0; }
    }

    clearHazards() { for (const e of this.scene.entities) if (e.hazard && !e.dead) e.kill(); this.cur = null; this.atk = null; }

    _pickAttack() {
      const list = this.phase === 2 ? D.SEQ2 : D.SEQ1;
      return list[this.seq++ % list.length];
    }

    _startAttack() {
      const sc = this.scene, p = sc.player, kind = this._pickAttack(), T = this.tac();
      this.atk = { kind, t: 0, windup: T.windup[kind] }; this.state = 'windup'; this.st = 0; this.vx = 0; this.facing = -1; this.stepTo = null;
      if (kind === 'dumbbell') {
        // в начале замаха фиксируется точка падения — положение Алеси (и у стойки, и у Илюшкинса: предметы долетают туда); метка уже на земле и больше не гонится за героиней
        const A = this.arena, tx = Ale.clamp(p.x, this._stopX() + 45, A.strip1);
        const sx = this.x + this.facing * D.DUMB.hand[0], sy = this.y - D.DUMB.hand[1];
        this.atk.target = tx;
        this.cur = sc.add(new Dumbbell({ x: sx, y: sy, targetX: tx, groundY: this.y, boss: this, wind: this.atk.windup, id: null }));
        this.cur.vx = 0; this.cur.vy = 0; this.cur.pre = true;                // пока замах — только метка; полёт включается на выпуске
      }
      Ale.Audio.sfx('dim_wind');
      if (sc.onDimasikAttack) sc.onDimasikAttack(kind, this);
    }

    _release() {
      const sc = this.scene, kind = this.atk.kind, f = this.facing, stopX = this._stopX();
      this.state = 'release'; this.st = 0; this.relT = sc.time;
      if (kind === 'dumbbell') {
        const h = this.cur, C = D.DUMB;
        h.x = this.x + f * C.hand[0]; h.y = this.y - C.hand[1]; h.pre = false;
        h.vx = (h.targetX - h.x) / C.flight; h.vy = (h.gy - 12 - h.y - 0.5 * C.g * C.flight * C.flight) / C.flight;
      } else if (kind === 'barbell') {
        this.cur = sc.add(new Barbell({ x: this.x + f * D.BAR.hand[0], y: this.y - D.BAR.hand[1], groundY: this.y, stopX, boss: this, dir: -1, id: null }));
        this.cur.vy = 0;
      } else {
        const high = kind === 'discHigh';
        this.cur = sc.add(new Disc({ x: this.x + f * D.DISC.hand, y: this.y - (high ? D.DISC.high : D.DISC.low), groundY: this.y, stopX, high, boss: this, dir: -1, id: null }));
        Ale.Audio.sfx('disc_fly');
      }
    }

    // ---- поле: где он стоит ----------------------------------------------------------------------------------------
    // Где ему можно стоять сейчас. Жёсткие пределы (выйдет за них — идёт на место сразу): lo — не ближе stompGap к героине (под «Туп лапой» не подставляется) и не левее своего поля, hi — не дальше
    // hard от неё (оба в кадре) и не правее поля; героиню он «видит» с упреждением predict: подбегающую встречает отступлением заранее, уходящую — идёт следом заранее. Ушла далеко влево (к Илюшкинсу) —
    // пределы сжимаются к левому краю его поля: идёт следом до барьера. Внутри — коридор sLo … sHi (TAC.gap), где он сам выбирает место, когда меняет его по своей воле.
    _band() {
      const A = this.arena, p = this.scene.player, T = this.tac(), F = D.FIELD;
      const v = Ale.clamp(p.vx || 0, -340, 340) * F.predict, px = p.x + v;
      const lo = Ale.clamp(p.x + Math.max(0, v) + F.stompGap, A.field0, A.field1);
      const hi = Math.max(lo, Math.min(A.field1, p.x + Math.min(0, v) + F.hard));
      const sLo = Ale.clamp(px + T.gap[0], lo, hi), sHi = Ale.clamp(px + T.gap[1], sLo, hi);
      return { lo, hi, sLo, sHi };
    }

    _goTo(x, speed, urgent) {
      x = Ale.clamp(x, this.arena.field0, this.arena.field1);
      if (Math.abs(x - this.x) < 4) return false;
      this.state = 'step'; this.st = 0; this.stepTo = x; this.stepSpeed = speed; this.stepUrgent = !!urgent; this.moves++; this.stillT = 0;
      return true;
    }

    // Новое место в коридоре (не ближе minMove от нынешнего, если коридор позволяет); null — переходить некуда
    _pickSpot(band, T) {
      const lo = band.sLo, hi = band.sHi;
      if (hi - lo < 8) return Math.abs(lo - this.x) >= T.minMove ? lo : null;
      for (let k = 0; k < 4; k++) { const t = Ale.rng.range(lo, hi); if (Math.abs(t - this.x) >= T.minMove) return t; }
      const far = Math.abs(lo - this.x) > Math.abs(hi - this.x) ? lo : hi;
      return Math.abs(far - this.x) >= T.minMove * 0.6 ? far : null;
    }

    // Каждый такт, пока он стоит между атаками: вышел за пределы — идёт на место сразу (подходит или отступает); иначе сам меняет место, когда решил (после атаки / попадания) или застоялся.
    // Пока шар в руках героини или в воздухе — не сходит с места (кроме случая, когда она подбежала под «Туп лапой»).
    _think(dt) {
      if (this.anchored) return false;
      const T = this.tac(), F = D.FIELD, band = this._band(), p = this.scene.player, ball = this._ballRolling();
      if (this.moveCool > 0) this.moveCool -= dt;
      const near = this.x < band.lo - F.urgent, far = this.x > band.hi + F.urgent;
      if ((near || far) && (!ball || this.x - p.x < F.stompGap)) {
        const tgt = near ? Ale.clamp(band.sLo + Ale.rng.range(0, 60), band.lo, band.hi) : Ale.clamp(band.sHi - Ale.rng.range(0, 60), band.lo, band.hi);
        return this._goTo(tgt, near ? T.backpedal : T.walk, true);
      }
      if (ball) return false;
      this.stillT += dt;
      if (this.moveCool <= 0 && (this.moveWant || this.stillT >= T.idleMove)) {
        this.moveWant = false; this.stillT = 0;
        const tgt = this._pickSpot(band, T);
        if (tgt !== null) return this._goTo(tgt, T.walk, false);
      }
      return false;
    }

    // На ходу увидел летящий в него снаряд и решил уклониться: остановился (дальше — прыжок, перебежка или просто стоит: снаряд с упреждением пролетит перед ним); потом пойдёт дальше
    _halt() { if (this.state === 'step') { this.state = 'wait'; this.st = 0; this.stepTo = null; this.vx = 0; this.moveWant = true; } }

    // ---- фразы и переходная фаза ------------------------------------------------------------------------------------
    // Ровно две фразы за попытку (владелец 09.10.2026): первая — в начале боя (на первом попадании с любой стороны, первом уклонении или блоке или к TAUNT.first секунде боя — что раньше), вторая — в
    // переходной фазе. Текст и облачко — в сценарии (sc.onDimasikTaunt → T.kyiv.dimasikTaunt[i]); здесь — когда и кадр «кричит».
    _taunt(i) {
      if (this.taunted[i] || !this.vulnerable) return;
      this.taunted[i] = true;
      if (i === 0) this.tauntQ = { i, t: D.TAUNT.delay }; else this._say(i);
    }
    _say(i) {
      this.shoutT = D.TAUNT.shout; this.taunts.push({ i, t: this.scene.time });
      if (this.scene.onDimasikTaunt) this.scene.onDimasikTaunt(i, this);
    }
    // Середина шкалы: можно ли начать переходную фазу прямо сейчас (в прыжке — после приземления, на броске — когда предмет ушёл; замах бросается)
    _canEnrage() { return ['wait', 'idleWait', 'step', 'recover', 'windup'].includes(this.state); }
    _startEnrage() {
      const sc = this.scene;
      if (this.state === 'windup') { if (this.cur && this.cur.pre) { this.cur.kill(); this.cur = null; } this.atk = null; }        // начатый замах брошен: метка гантели исчезает, предмет не вылетает
      this.phase2Pending = false; this.phase = 2; this.seq = 0;
      this.state = 'enrage'; this.st = 0; this.vx = 0; this.plan = null; this.stepTo = null; this.moveWant = false; this.flinch = 0;
      sc.camera.shake(5, 0.35); sc.fx.dust(this.x, this.y, 6, 0, 1.1); Ale.Audio.sfx('dumb_land');          // топнул: пыль у ног, толчок камеры, глухой удар
      if (sc.onDimasikPhase2) sc.onDimasikPhase2(this);
      this._taunt(1);
    }
    _enrage(dt) {
      const E = D.ENRAGE, sc = this.scene;
      this.vx = 0;
      if (Math.floor(this.st / E.puff) !== Math.floor((this.st - dt) / E.puff)) for (const s of [-1, 1]) sc.fx.puff(this.x + s * 12, this.y - 150, 1, s, { size: 14, vx: 30, rise: 70, life: 0.55 });   // пар из ушей
      if (this.st >= E.t) { this.state = this.cur ? 'idleWait' : 'wait'; this.st = 0; this.pause = Math.max(this.pause, E.after); this.moveWant = true; this.stillT = 0; this.moveCool = 0; }
    }

    // ---- уклонение ------------------------------------------------------------------------------------------------
    // Какой снаряд героини это: 'ball' — шар (летит по дуге ≈ 2 с), 'dart' — дротик, 'pellet' — шарик рогатки с уроном (слабый выстрел безвреден: на него он не реагирует); иначе null
    _threatKind(e) {
      if (e.dead) return null;
      if (e.lob) return e.flying ? 'ball' : null;
      if (e.kitShot && !e.spent && e.dmg > 0) return e.type === 'dart' ? 'dart' : 'pellet';
      return null;
    }
    _stand() { return { x: this.x - this.hurtW / 2, y: this.y - D.H, w: this.hurtW, h: D.H }; }       // бокс стоящего на земле

    // Полёт снаряда до пола или ухода (тот же шаг, что в KitShot.update и LobBall.update, 1/120 с): точки { t, x, y } и tHit — когда он коснётся бокса Димасика (null — не попадёт: перелёт, пол, дальность).
    // Если он идёт по полю, бокс в расчёте идёт вместе с ним (до точки, куда он идёт): снаряд, пущенный с упреждением, попадает в идущего, а не в место, где он стоял.
    _flight(e) {
      const sc = this.scene, dt = 1 / 120, fl = sc.floorY, b = this._stand(), r = e.r || 9, pts = [];
      const walking = this.state === 'step' && this.stepTo !== null, v = walking ? Math.sign(this.stepTo - this.x) * Math.max(Math.abs(this.vx), this.stepSpeed * 0.5) : 0;
      let x = e.x, y = e.y, vx = e.vx, vy = e.vy, travel = e.travel || 0, tHit = null, tStand = null;
      const inBox = (bx) => x + r > bx && x - r < bx + b.w && y + r > b.y && y - r < b.y + b.h;
      for (let i = 0; i < 480; i++) {
        const t = (i + 1) * dt;
        vy += e.g * dt; x += vx * dt; y += vy * dt; travel += Math.hypot(vx, vy) * dt;
        pts.push({ t, x, y });
        const bx = walking ? (v > 0 ? Math.min(this.stepTo, this.x + v * t) : Math.max(this.stepTo, this.x + v * t)) - this.hurtW / 2 : b.x;
        if (tHit === null && inBox(bx)) tHit = t;
        if (tStand === null && inBox(b.x)) tStand = t;                                    // если остановится сейчас — когда снаряд дойдёт до него (по этому времени и считается манёвр)
        if (e.lob ? (y >= fl - r && vy > 0) : (y > fl - 4 || travel > e.range || x < -50 || x > sc.width + 50)) break;
      }
      return { pts, tHit, tStand, r };
    }

    // Когда снаряд (траектория F, посчитанная off секунд назад) дойдёт до него, если он стоит там, где стоит сейчас; null — пролетит мимо
    _standHit(F, off) {
      const b = this._stand(), r = F.r;
      for (const q of F.pts) if (q.t >= off && q.x + r > b.x && q.x - r < b.x + b.w && q.y + r > b.y && q.y - r < b.y + b.h) return q.t;
      return null;
    }

    // Пройдёт ли снаряд мимо, если он остановится сейчас и начнёт манёвр man через `to` секунд (от сейчас; off — сколько прошло с расчёта полёта): stand — просто стоит; hop — прыжок с отходом back
    // (пока он в прыжке, бокс поднят и сдвинут); dash — перебежка на back (бокс едет, не поднимаясь). Проверяется по всей траектории с запасом 5 юн.: снаряд не должен ни задеть бокс, ни пройти
    // «сквозь» него (тогда прыжок только выглядел бы как уклонение, а шар катился бы сквозь героя).
    _clears(F, off, to, man) {
      const DG = D.DODGE, air = 2 * DG.climb, b = this._stand(), dir = -this.facing, m = 5, type = man.type, back = man.back || 0, dashT = Math.abs(back) / DG.dash.speed;
      for (const slip of [0, 1 / 60]) {                                                    // начало манёвра может запоздать на такт (присед считается тактами): чисто должно быть и так, и так
        for (const q of F.pts) {
          const tau = q.t - off - to - slip;
          let hop = 0, shift = 0;
          if (type === 'hop') { hop = tau > 0 && tau < air ? DG.v0 * tau - 0.5 * DG.g * tau * tau : 0; shift = tau <= 0 ? 0 : back * Math.min(1, tau / air); }
          else if (type === 'dash') shift = tau <= 0 ? 0 : back * Ale.smooth(Math.min(1, tau / dashT));
          const bx = b.x + dir * shift;
          if (q.x + F.r + m > bx && q.x - F.r - m < bx + b.w && q.y + F.r + m > b.y - hop && q.y - F.r - m < b.y + b.h - hop) return false;
        }
      }
      return true;
    }

    // Выбор манёвра (null — чисто не выходит, тогда он и не пытается). На ходу сначала пробует просто остановиться (снаряд с упреждением пролетит перед ним). От шара — перебежка (с шансом dashP;
    // так видно, что он убегает из-под дуги) или прыжок: взлёт так, чтобы вершина пришлась на прилёт (у шара можно и раньше — к прилёту он успевает отойти дальше), отход — первый из списка, при котором
    // снаряд проходит чисто и хватает места: назад — до конца поля, вперёд — не ближе stompGap к героине. От дротика и шарика — прыжок на месте или с небольшим отходом; перебежка от них проходит,
    // только если снаряд не долетает (дальний выстрел).
    _maneuver(m, now) {
      const DG = D.DODGE, T = this.tac(), off = now - m.t0, A = this.arena, p = this.scene.player;
      const tS = this._standHit(m.F, off), remain = (tS !== null ? m.t0 + tS : m.tHit) - now;          // манёвр начинается с остановки: время — до встречи с ним, стоящим здесь
      const room = Math.min(A.field1, p.x + D.FIELD.hard) - this.x, front = this.x - Math.max(A.field0, p.x + D.FIELD.stompGap - 40);      // назад — не дальше конца поля и не дальше hard от неё (в кадре)
      const fits = (back) => back === 0 || (back > 0 ? back <= room : -back <= front);
      if (this.state === 'step' && this._clears(m.F, off, 0, { type: 'stand' })) return { type: 'stand', back: 0, startAt: now };      // на ходу: остановиться (дуга, рассчитанная на идущего, пройдёт мимо)
      const hops = () => {
        for (const back of DG.back[m.kind === 'ball' ? 'ball' : 'shot']) {
          if (!fits(back)) continue;
          for (const early of (m.kind === 'ball' ? [0, 0.08, 0.16, 0.24] : [0])) {
            const to = Math.max(DG.tellT, remain - DG.climb - early);
            if (this._clears(m.F, off, to, { type: 'hop', back })) return { type: 'hop', back, startAt: now + to - DG.tellT };
          }
        }
        return null;
      };
      const dashes = () => {
        for (const back of DG.dash.len) {
          if (!fits(back)) continue;
          const dashT = Math.abs(back) / DG.dash.speed, to = Math.max(DG.dash.tellT, remain - dashT - DG.dash.lead);
          if (this._clears(m.F, off, to, { type: 'dash', back })) return { type: 'dash', back, startAt: now + to - DG.dash.tellT };
        }
        return null;
      };
      if (m.kind === 'ball' && T.dodge.dashP > 0 && Ale.rng.chance(T.dodge.dashP)) return dashes() || hops();
      return hops() || (T.dodge.dashP > 0 ? dashes() : null);
    }

    // Свободен ли он для манёвра: стоит, ждёт или идёт по полю; не оглушён попаданием, не в сцене. На замахе, броске и в переходной фазе — нет; «руки у груди» после броска отбивают шарики и дротики,
    // а от шара он и тогда уклоняется (в лёгком режиме, как прежде, — нет)
    _canDodge(kind) {
      if (!this.vulnerable || this.dodgeCool > 0 || this.flinch > 0 || this.seated) return false;
      const s = this.state, T = this.tac();
      return s === 'wait' || s === 'idleWait' || (s === 'step' && T.dodge.walk) || (s === 'recover' && kind === 'ball' && T.guard > 0);       // на ходу — только в обычном режиме (в лёгком, как раньше, нет)
    }
    // Шанс уклониться: по виду снаряда и фазе, плюс «привыкание»: за каждый её выстрел подряд с одного места (read) — прибавка, не больше 0,95
    _dodgeChance(kind) { const G = this.tac().dodge, c = G.chance[kind], rd = kind === 'ball' && G.readBall !== undefined ? G.readBall : G.read; return Math.min(Math.max(c, 0.95), c + rd * Math.min(this.read, G.readMax)); }
    // Сколько уклонений подряд без попадания (потом следующий снаряд пройдёт): число или по виду снаряда (от шара — одно: после уклонения следующий шар попадает; попаданий шаром нужно восемь)
    _maxStreak(kind) { const s = this.tac().dodge.maxStreak; return typeof s === 'number' ? s : s[kind]; }

    // Новый её выстрел (снаряд, который может ранить): подряд ли с того же места — «привыкание к ритму»; ушла на READ.dx или помолчала READ.dt — счёт сначала
    _noteShot() {
      const p = this.scene.player, now = this.scene.time, L = this.lastShot, R = D.READ;
      this.read = L && Math.abs(p.x - L.x) <= R.dx && now - L.t <= R.dt ? this.read + 1 : 0;
      this.lastShot = { x: p.x, t: now };
    }

    // Каждый такт: у каждого летящего снаряда один раз считается полёт; пока Димасик свободен и снаряд ещё успевает, выбирается манёвр и на него ОДИН раз бросается кубик (Ale.rng — игровой
    // генератор: бой повторяем). Выпало — решение (plan): новую атаку он не начинает, а манёвр начинается ровно тогда, когда нужно (вершина прыжка — на прилёт снаряда, у быстрого дротика — сразу).
    // Снаряд не успевает (меньше minLead), манёвра, после которого он проходит чисто, нет, он занят замахом / броском или серия кончилась — не уклоняется вовсе.
    _watch() {
      const sc = this.scene, DG = D.DODGE, T = this.tac(), now = sc.time;
      if (this.plan && (this.plan.e.dead || !this._threatKind(this.plan.e))) this.plan = null;       // снаряд пропал (попал, упал): передумал
      for (const e of sc.entities) {
        const kind = this._threatKind(e);
        if (!kind) continue;
        let m = e.dimWatch;
        if (!m) { const F = this._flight(e); m = e.dimWatch = F.tHit === null ? { done: true } : { kind, F, t0: now, tHit: now + F.tHit, done: false, rolled: false }; }
        if (m.done) continue;
        const remain = m.tHit - now;
        if (remain < DG.minLead) { if (!m.rolled) this._why(kind, this.dodgeCool > 0 && this.state !== 'windup' ? 'cool' : this.state); m.done = true; if (this.plan && this.plan.e === e) this.plan = null; continue; }      // уже не успеть
        if (!m.rolled) {
          if (this.plan || !this._canDodge(kind)) continue;                              // занят (замах, бросок, оглушён) или уже решил про другой снаряд: подождёт, пока успевает
          m.rolled = true;
          const man = this._maneuver(m, now);
          if (!man) { this._why(kind, 'none'); m.done = true; continue; }
          if (this.dodgeStreak >= this._maxStreak(kind)) { this._why(kind, 'streak'); m.done = true; continue; }
          if (!Ale.rng.chance(this._dodgeChance(kind))) { this._why(kind, 'roll'); m.done = true; continue; }
          if (man.type === 'stand') { this._halt(); m.done = true; this._startDodge(e, man); continue; }       // просто остановился: снаряд пролетит перед ним
          this._halt();
          this.plan = { e, man, startAt: man.startAt };
        }
        if (this.plan && this.plan.e === e && now >= this.plan.startAt - 1e-6 && this._canDodge(kind)) { const pl = this.plan; this.plan = null; m.done = true; this._startDodge(e, pl.man); return; }
      }
    }

    _why(kind, why) { const k = kind + ':' + why; this.dodgeWhy[k] = (this.dodgeWhy[k] || 0) + 1; }          // счётчик причин, по которым он не уклонился (для отладки и проверок баланса)

    // man: { type: 'hop' | 'dash' | 'stand', back } (число — прыжок с отходом back, как раньше)
    _startDodge(e, man) {
      if (typeof man === 'number' || !man) man = { type: 'hop', back: man || 0 };
      const T = this.tac();
      this.dodgeStreak++; this.dodgeCount++; this.dodgeCool = T.dodge.cooldown;            // от начала одного уклонения до начала следующего не меньше cooldown
      if (e) e.dimDodged = true;                                                           // этим снарядом он уже неуязвим: снаряд проходит мимо и больше не задевает его (takeHit, KitShot, LobBall)
      this._taunt(0);
      if (man.type === 'stand') return;                                                    // остановка на ходу (снаряд с упреждением пролетит перед ним): состояние уже «ждёт» (_halt)
      this.dg = { phase: 'tell', t: 0, src: e, x0: this.x, back: man.back || 0, dir: -this.facing, type: man.type };
      this.state = 'dodge'; this.st = 0; this.vx = 0; this.facing = -1; this.stepTo = null;
    }

    // Манёвр. Прыжок: присед (tell) → прыжок вверх и назад (air; ступни выше полёта снаряда, бокс сдвигается) → приземление (land). Перебежка: присед (tell) → бег (run, speed юн./с) → остановка (land).
    // Отсчёт до следующей атаки идёт; по окончании — снова ждёт (место потом поправит _think).
    _dodge(dt) {
      const g = this.dg, DG = D.DODGE, sc = this.scene, air = 2 * DG.climb;
      g.t += dt; this.vx = 0;
      if (this.fieldActive()) this.pause -= dt;
      if (g.type === 'dash') {
        const S = DG.dash, dashT = Math.abs(g.back) / S.speed;
        if (g.phase === 'tell' && g.t >= S.tell) { g.phase = 'run'; g.t = 0; sc.fx.dust(this.x, this.y, 3, -g.dir, 0.7); }
        if (g.phase === 'run') {
          const was = this.x;
          this.x = g.x0 + g.dir * g.back * Ale.smooth(Math.min(1, g.t / dashT));
          this.dashV = (this.x - was) / Math.max(dt, 1e-6);
          this.walkPhase += (this.dashV * this.facing >= 0 ? 1 : -1) * Math.abs(this.x - was) / D.STRIDE;
          if (Math.floor(g.t * 12) !== Math.floor((g.t - dt) * 12)) sc.fx.dust(this.x, this.y, 1, -Math.sign(this.dashV || 1), 0.5);
          if (g.t >= dashT) { this.x = g.x0 + g.dir * g.back; g.phase = 'land'; g.t = 0; this.dashV = 0; sc.fx.dust(this.x, this.y, 3, g.dir, 0.7); }
        } else if (g.phase === 'land' && g.t >= S.stop) { this.state = this.cur ? 'idleWait' : 'wait'; this.st = 0; this.dg = null; this.pause = Math.max(this.pause, DG.afterPause); }
        return;
      }
      if (g.phase === 'tell' && g.t >= DG.tell) { g.phase = 'air'; g.t = 0; this.hopV = DG.v0; sc.fx.dust(this.x, this.y, 3, 0, 0.7); }
      if (g.phase === 'air') {                                                              // высота — точная парабола по времени в воздухе (так её считает и _clears)
        this.hopV = DG.v0 - DG.g * g.t; this.hopY = Math.max(0, DG.v0 * g.t - 0.5 * DG.g * g.t * g.t);
        this.x = g.x0 + g.dir * g.back * Ale.clamp(g.t / air, 0, 1);
        if (g.t >= air) { this.hopY = 0; this.hopV = 0; this.x = g.x0 + g.dir * g.back; g.phase = 'land'; g.t = 0; sc.fx.dust(this.x, this.y, 4, g.dir, 0.8); }
      } else if (g.phase === 'land' && g.t >= DG.land) {
        this.state = this.cur ? 'idleWait' : 'wait'; this.st = 0; this.dg = null;
        this.pause = Math.max(this.pause, DG.afterPause);                                 // после приземления не сразу замах
      }
    }

    // ---- обновление -----------------------------------------------------------------------------------------------
    update(dt) {
      super.update(dt);
      const sc = this.scene, w = sc.world, x0 = this.x;
      this.st += dt;
      if (this.invul > 0) this.invul -= dt;
      if (this.flinch > 0) this.flinch -= dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.shoutCool > 0) this.shoutCool -= dt;
      if (this.dodgeCool > 0) this.dodgeCool -= dt;
      if (this.blockT > 0) this.blockT -= dt;
      if (this.shoutT > 0) this.shoutT -= dt;
      Wear.pump();
      this.sit = Ale.approach(this.sit, this.seated ? 1 : 0, dt * 3.4);
      let move = 0, sp = D.STEP_SPEED, acc = 900;
      const fight = this.vulnerable && !this.down && this.state !== 'script';
      if (fight) {
        this.fightT += dt;
        for (const e of sc.entities) if (!e.dimSeen && this._threatKind(e)) { e.dimSeen = true; this._noteShot(); }       // каждый её выстрел — для «привыкания к ритму»
        if (!this.taunted[0] && this.fightT >= D.TAUNT.first) this._taunt(0);
        if (this.tauntQ && (this.tauntQ.t -= dt) <= 0) { const q = this.tauntQ; this.tauntQ = null; this._say(q.i); }
        if (this.phase2Pending && this._canEnrage()) this._startEnrage();
      }
      if (this.state === 'wait' || this.state === 'idleWait' || this.state === 'step' || this.state === 'recover') this._watch();

      switch (this.state) {
        case 'dodge': this._dodge(dt); break;
        case 'enrage': this._enrage(dt); break;
        case 'script':
          if (this.auto) {
            const d = this.auto.x - this.x;
            if (Math.abs(d) <= this.auto.arrive) this.auto = null; else { move = Math.sign(d); sp = this.auto.speed; }
          }
          break;
        case 'wait': {
          this.facing = -1;
          if (this.fieldActive()) this.pause -= dt;                           // героиня совсем ушла с площадки (левее reach; в лёгком режиме — за ограждение) — отсчёт стоит, замах не начинается
          if (!this.plan && this._think(dt)) break;                           // пошёл на новое место (или на место по правилам поля)
          if (this.pause <= 0 && this.fieldActive() && !this.cur && !this.plan && !this.phase2Pending && this._inView()) this._startAttack();
          break;
        }
        case 'step': {                                                        // идёт по своему полю (лицом к героине: назад — пятясь); пауза до атаки при этом идёт
          const d = this.stepTo - this.x;
          if (this.fieldActive()) this.pause -= dt;
          if ((!this.stepUrgent && this._ballRolling()) || Math.abs(d) <= 3) { this.state = 'wait'; this.st = 0; this.stepTo = null; this.stepUrgent = false; break; }
          move = Math.sign(d); sp = Math.min(this.stepSpeed, 40 + Math.abs(d) * 6); acc = D.FIELD.accel;          // к концу шага притормаживает: встаёт точно, без проскальзывания
          break;
        }
        case 'windup':
          this.vx = 0;
          if (this.st >= this.atk.windup) this._release();
          break;
        case 'release':
          this.vx = 0;
          if (this.st >= this.tac().release) { this.state = 'recover'; this.st = 0; }
          break;
        case 'recover':                                                       // «руки у груди», пока свой предмет летит к героине: шарики и дротики отскакивают (guard), потом — снова настороже
          this.vx = 0;
          if (this.st >= D.RECOVER && (!this.cur || this.st >= this.tac().guard)) { this.state = this.cur ? 'idleWait' : 'wait'; this.st = 0; }      // предмет миновал её (или guard кончился) — руки опускаются
          break;
        case 'idleWait': this.vx = 0; if (!this.plan) this._think(dt); break;    // предмет ещё опасен для героини: пауза пойдёт, когда он её минует; место поменять уже можно
        case 'down': this.vx = 0; break;
        case 'leave':
          if (this.auto) {
            const d = this.auto.x - this.x;
            if (Math.abs(d) <= this.auto.arrive) this.auto = null; else { move = Math.sign(d); sp = this.auto.speed; }
          }
          break;
      }

      if (this.sit > 0.01 && !this.seated) move = 0;                          // встаёт из-за стола (кадр «привстаёт», ≈ 0,3 с): сначала поднимается, потом идёт
      if (move) { this.vx = Ale.approach(this.vx, move * sp, acc * dt); if (this.state === 'script' || this.state === 'leave') this.facing = move; }
      else if (this.state !== 'dodge') this.vx = Ale.approach(this.vx, 0, (fight ? D.FIELD.accel : 1400) * dt);
      this.vy = Math.min(this.vy + 2400 * dt, 1200);
      w.move(this, dt);
      if (fight && this.state === 'step') this.x = Ale.clamp(this.x, this.arena.field0, this.arena.field1);
      if (Math.abs(this.vx) > 5) this.walkPhase += (this.vx * this.facing >= 0 ? 1 : -1) * Math.abs(this.vx) * dt / D.STRIDE;
      else if (!(this.state === 'dodge' && this.dg && this.dg.type === 'dash')) this.walkPhase = 0;
      if (fight) this.path += Math.abs(this.x - x0);
    }

    // ---- попадания --------------------------------------------------------------------------------------------------
    // kind: 'stomp' (1 единица), 'ball' (1; слабый выстрел рогатки — без урона, до сюда не доходит), 'dart' (1), 'bowl' (2: восемь шаров — победа). Краткая защита 0,35 с: попавший в неё снаряд отскакивает без снятия шкалы (шар ждёт снятия — см. BowlBall).
    // «Руки у груди» после броска (guard) отбивают шарики и дротики, в переходной фазе он неуязвим совсем — снаряд отскакивает со вспышкой (_block). В прыжке по нему тем снарядом, от которого он уклонился,
    // не попасть (зона попадания и так поднята над полётом; это страховка от случайного касания краем).
    takeHit(info) {
      if (!this.vulnerable || this.state === 'down' || this.state === 'leave') return false;
      const k = info.kind;
      const n = k === 'stomp' ? 1 : (k === 'ball' || k === 'dart' || k === 'bowl') ? (info.dmg || 1) : 0;
      if (!n) return false;
      if (this.state === 'enrage' || ((k === 'ball' || k === 'dart') && this._guarding(info.src))) { this._block(info); return false; }
      if (this.invul > 0) return false;
      if (this.hopY > 24 && info.src && info.src.dimDodged) return false;
      this._damage(n, info);
      return true;
    }
    // Блок: «руки у груди» после броска (recover) — пока его предмет летит к героине. Выстрел, пущенный ДО его броска (в замах), долетает как раз сюда и попадает: это и есть окно для точной игры;
    // отбиваются только выстрелы, пущенные после того, как он бросил (src.t — сколько летит снаряд, relT — когда он бросил)
    _guarding(src) { return this.state === 'recover' && this.tac().guard > 0 && !(src && src.t !== undefined && this.relT !== undefined && this.scene.time - src.t < this.relT - 1e-6); }
    // Отбил: вспышка у предплечий (рисуется в draw), белое кольцо; стук — у самого снаряда (KitShot: dart_tink / soft_hit); первый блок — повод для первой фразы
    _block(info) {
      this.blockT = 0.25; this.blocks++;
      this.scene.fx.ring(this.x + this.facing * 22, this.y - 104, 24, 'rgba(255,255,255,');
      this._taunt(0);
    }
    // Его предмет попал в героиню (Hazard._tryHit): повод для первой фразы
    hitHer() { this._taunt(0); }

    _damage(n, info) {
      const sc = this.scene;
      this.dmg = Math.min(this.hpMax, this.dmg + n);
      this.dodgeStreak = 0;                                            // попали — серия уклонений прервана («привыкание к ритму» остаётся: оно зависит только от того, откуда и как часто она стреляет)
      this.invul = D.INVUL; this.flinch = D.FLINCH; this.flash = 0.18;
      sc.fx.sparks(this.x, this.y - 100, 6, 'rgba(255,225,140,');
      sc.camera.shake(3, 0.12);
      Ale.Audio.sfx(info.kind === 'stomp' ? 'soft_hit' : 'ball_hit');
      if (this.dmg >= this.phase2At && !this.phase2Seen) { this.phase2Seen = true; this.phase2Pending = true; }          // переходная фаза начнётся в update, как только можно (_canEnrage)
      if (this.dmg >= this.hpMax) {
        // победа: сначала фиксируется шкала, все опасности и метки удаляются сразу
        this.state = 'down'; this.vulnerable = false; this.vx = 0; this.st = 0; this.stepTo = null; this.phase2Pending = false;
        this.hopY = 0; this.hopV = 0; this.dg = null; this.plan = null; this.tauntQ = null;      // победа посреди прыжка: он сразу на земле (там, где приземлился)
        this.clearHazards();
        if (sc.onDimasikDown) sc.onDimasikDown(this);
      } else {
        this._taunt(0);
        if (Ale.rng.chance(this.tac().hitMoveP)) this.moveWant = true;          // после попадания часто меняет место
      }
      if (sc.onDimasikHit) sc.onDimasikHit(this, info);
    }

    // ---- вид ---------------------------------------------------------------------------------------------------------
    // Рисунки: стоит (по состоянию шкалы: чистая кофта → потёртая → «почти сдался»), ходьба, замахи гантели, штанги и диска, руки у груди после броска, бросок, уклонение, «Ай!», крик, сидит за столом, побеждён.
    // Предмет в руках — ровно один и только на своём замахе: гантель, штанга и диск нарисованы в кадрах замаха (D.BAKED: dim_plate_hi / dim_plate_lo — блин в руке, заказ 21); кодовый диск (накладка позади кулака)
    // рисуется только в запасном виде, если этих кадров в сборке нет. В «броске» и «руки у груди» рук пусты (предмет в это время — отдельная сущность сцены). L.held сообщает, что сейчас у него в руках
    // (проверка «каждый предмет — один раз»).
    _idleFrame() { return this.dmg >= D.WEAR[2] ? 'dim_dmg3' : this.dmg >= D.WEAR[1] ? 'dim_dmg2' : this.dmg >= D.WEAR[0] ? 'dim_dmg1' : 'dim_idle'; }
    // Стадия побоев 0…3 по шкале (кадры стоя уже со стадиями, остальным накладывается Wear): уходит и лежит он в последней
    wear() { return this.state === 'leave' || this.state === 'down' ? 3 : this.dmg >= D.WEAR[2] ? 3 : this.dmg >= D.WEAR[1] ? 2 : this.dmg >= D.WEAR[0] ? 1 : 0; }

    look() {
      const L = this._look(), lv = this.wear();
      if (lv && !this.pose) L.f = Wear.frame(L.f, lv);
      return L;
    }

    // Говорит ли он сейчас ЗЛО: на экране его реплика (диалог, не облачко) с настроением sneer или furious (в src/text.js у реплик Димасика уже стоят mood). Кадр «кричит» держится всю реплику, пока она на экране
    // (не только пока печатается): по Ale.isSpeaking поза возвращалась бы к спокойной, пока игрок читает текст
    _angrySpeech() {
      const d = Ale.UI && Ale.UI.dlg, l = d && d.lines[d.i];
      return !!(l && l.who === 'dimasik' && (l.mood === 'sneer' || l.mood === 'furious'));
    }

    // Стоит (ждёт, идёт «на месте», между шагами, «руки у груди»): попадание → «Ай!» первые HIT_T секунд вздрагивания; злая речь или фраза облачком → «кричит и тычет пальцем»; иначе кадр уже выбран (по шкале)
    _standing(L) {
      if (this.flinch > D.FLINCH - D.HIT_T && has(D.FR.hit)) { L.f = D.FR.hit; L.sy = 1; L.sx = 1; L.rot = 0; L.ox = 0; L.oy = 0; }
      else if (Math.abs(this.vx) <= 8 && (this._angrySpeech() || (this.shoutT > 0 && this.state !== 'recover')) && has(D.FR.shout)) L.f = D.FR.shout;       // стоит и орёт (идущий — прежние кадры ходьбы)
      return L;
    }

    _look() {
      const t = this.st, FR = D.FR, L = { f: this._idleFrame(), rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, held: null, disc: null };
      if (this.pose) { L.f = this.pose; if (/^dim_sit/.test(this.pose)) L.oy = D.SIT_DROP * this.sit; return L; }       // поза от сценария (после шахмат — dim_sit2: кулаки на столе); сидячая стоит так же, как dim_sit1
      if (this.sit > 0.01) {                                                                    // за шахматным столом: сидячий кадр подошвами на земле (скамья закрывает всё ниже груди); встаёт — «привстаёт»
        if (has(FR.sit)) { L.f = this.seated ? FR.sit : has(FR.rise) ? FR.rise : this._idleFrame(); L.oy = D.SIT_DROP * this.sit; }
        else L.oy = D.SIT * this.sit;                                                           // запасной вид: стоячий кадр ниже на SIT
        return L;
      }
      switch (this.state) {
        case 'enrage': {                                               // переходная фаза: кричит (dim_shout), дрожит всем телом; запасной вид — стоячий кадр, тоже дрожит
          const E = D.ENRAGE, k = Ale.clamp(Math.min(t / 0.15, (E.t - t) / 0.2), 0, 1);
          if (has(FR.shout)) L.f = FR.shout;
          L.ox = Math.sin(t * 62) * E.shake * k; L.sy = 1 + 0.015 * Math.sin(t * 9) * k;
          return L;
        }
        case 'windup': {
          const k = Ale.clamp(t / this.atk.windup, 0, 1), kind = this.atk.kind;
          if (kind === 'dumbbell') { L.f = t < 0.25 ? 'dim_db_ready' : 'dim_db_wind'; L.held = 'dumbbell'; L.rot = -0.04 * k; L.ox = Math.sin(t * 60) * 1.2 * k; }
          else if (kind === 'barbell') { L.f = t < 0.45 ? 'dim_bb_ready' : 'dim_bb_wind'; L.held = 'barbell'; L.oy = t < 0.45 ? Math.sin(t * 14) * 1.5 : 0; L.ox = Math.sin(t * 50) * 1.2 * k; }
          else {
            const high = kind === 'discHigh', plate = high ? FR.plateHi : FR.plateLo;
            L.held = 'disc';
            if (has(plate)) { L.f = plate; L.ox = Math.sin(t * 50) * 1.2 * k; }                  // блин нарисован в руке (высокий — у плеча, низкий — у бедра), код ничего не добавляет
            else {                                                                              // запасной вид: диск высокий держит у груди (руки у подбородка), низкий — у бедра; сам диск рисует draw()
              L.f = high ? guardFrame() : this._idleFrame(); L.disc = { high, k };
              L.rot = high ? -0.07 * k : 0.1 * k; L.sy = high ? 1 + 0.02 * k : 1 - 0.05 * k;
            }
          }
          return L;
        }
        case 'release': {                                                // бросок: у диска рука пуста и выброшена вперёд (dim_plate_rel), у гантели и штанги — прежний кадр
          const k = this.atk && this.atk.kind;
          L.f = (k === 'discHigh' || k === 'discLow') && has(FR.plateRel) ? FR.plateRel : 'dim_db_throw';
          return L;
        }
        case 'recover': L.f = guardFrame(); return this._standing(L);
        case 'dodge': {                                                // присед (dim_dodge1) → прыжок назад (dim_dodge2; подошвы идут по hopY) → приземление (снова dim_dodge1); перебежка: присед → бег (кадры ходьбы, наклон) → присел
          const g = this.dg, DG = D.DODGE, art = has(FR.crouch) && has(FR.jump);
          if (g.type === 'dash') {
            if (g.phase === 'run') { L.f = D.WALK[((Math.floor(this.walkPhase) % 6) + 6) % 6]; L.rot = 0.08 * Math.sign(this.dashV || 0) * this.facing; }
            else if (has(FR.crouch)) L.f = FR.crouch;
            else { L.sy = 0.88; L.sx = 1.05; }
            return L;
          }
          if (g.phase === 'tell') { if (art) L.f = FR.crouch; else { const k = Ale.smooth(g.t / DG.tell); L.sy = 1 - 0.2 * k; L.sx = 1 + 0.08 * k; L.rot = -0.06 * k; } }
          else if (g.phase === 'air') {
            const v = Ale.clamp(this.hopV / DG.v0, -1, 1);
            if (art) { L.f = FR.jump; L.rot = -0.05 * v; }                                           // лёгкий наклон по вертикальной скорости: на подъёме откидывается, на спуске выпрямляется
            else { L.f = guardFrame(); L.rot = -0.13 * v; L.sy = 1 + 0.05 * Math.max(0, v); }
          }
          else if (art) L.f = FR.crouch;
          else { const k = 1 - Ale.smooth(g.t / DG.land); L.sy = 1 - 0.16 * k; L.sx = 1 + 0.06 * k; }
          return L;
        }
        case 'step': case 'script': case 'leave':
          if (Math.abs(this.vx) > 8) {
            L.f = D.WALK[((Math.floor(this.walkPhase) % 6) + 6) % 6];
            if (this.state === 'leave') { L.rot = 0.07; L.sy = 0.97; L.oy = 1.8 * (0.5 + 0.5 * Math.cos(this.walkPhase * Math.PI)); }      // уходит, прихрамывая: кренится, ниже ростом, на каждом втором шаге оседает
            else if (this.angry) L.rot = -0.07;                                                   // злой — наклонён вперёд
          }
          return this.state === 'leave' ? L : this._standing(L);
        case 'down':                                                   // побеждён: согнулся, руки на коленях (dim_down); запасной вид — стоячий кадр чуть ниже ростом
          if (has(FR.down)) L.f = FR.down; else { L.f = 'dim_dmg3'; L.sy = 0.97; }
          return L;
      }
      if (this.state === 'wait' || this.state === 'idleWait') { const b = Math.sin(this.t * 2.6); L.sy = 1 + b * 0.01; }
      return this._standing(L);
    }

    // Диск в руке на замахе: рисуется ПОЗАДИ кадра, ближний край диска у кулака — кулак закрывает его, и диск «в хвате», а не наклеен на лицо или бедро. Положение — от кисти кадра (D.GRIP).
    // Высокий поднимается к концу замаха, низкий отводится назад; один раз за кадр и только на замахе диска.
    _drawHeldDisc(ctx, x, y, so, L) {
      const base = L.f.replace(/_w\d$/, ''), gr = D.GRIP[base] || D.GRIP.dim_idle, d = L.disc, k = Ale.smooth(d.k);
      const hx = gr[0] + 19 + (d.high ? 2 * k : -5 * k), hy = gr[1] + 3 + (d.high ? 9 * k : -2 * k);
      const hp = Ale.spritePoint(x, y, so, hx, hy);
      ctx.save(); ctx.translate(hp.x, hp.y); ctx.globalAlpha *= so.alpha; paintDisc(ctx, 0); ctx.restore();
    }

    draw(ctx, alpha) {
      if (this.hidden) return;
      const x = this.rx(alpha), y = this.ry(alpha), L = this.look();
      this.drawShadow(ctx, x, y - this.hopY, 38, 0.34);                    // тень остаётся на земле и слабеет с высотой
      let ox = L.ox, shake = 0;
      if (this.flinch > 0) shake = Math.sin(this.flinch * 90) * 3 * (this.flinch / D.FLINCH);          // вздрогнул (атака при этом не прерывается)
      const flash = this.flash > 0 ? Math.min(1, this.flash / 0.12) * 0.6 : 0;
      const dp = this.depth || 0;                                          // уходит вглубь: меньше, выше и прозрачнее
      const rage = this.state === 'enrage' ? Ale.clamp(Math.min(this.st / 0.15, (D.ENRAGE.t - this.st) / 0.25), 0, 1) : 0;
      const so = { flip: this.facing < 0, ox: ox + shake, oy: L.oy - this.hopY - dp * 26, rot: L.rot * (this.facing < 0 ? -1 : 1), sx: L.sx * (1 - 0.3 * dp), sy: L.sy * (1 - 0.3 * dp), flash: Math.max(flash, rage * (0.18 + 0.14 * Math.sin(this.st * 18))), alpha: 1 - dp };
      if (rage) {                                                          // переходная фаза: красное зарево за спиной — видно, что он вне себя
        ctx.save(); ctx.globalAlpha = 0.55 * rage;
        const gr = ctx.createRadialGradient(x, y - 84, 10, x, y - 84, 120); gr.addColorStop(0, 'rgba(255,70,40,0.75)'); gr.addColorStop(0.55, 'rgba(230,40,30,0.3)'); gr.addColorStop(1, 'rgba(200,30,30,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y - 84, 96, 120, 0, 0, 6.283); ctx.fill(); ctx.restore();
      }
      if (L.disc) this._drawHeldDisc(ctx, x, y, so, L);
      Ale.drawSprite(ctx, L.f, x, y, so);
      if (this.blockT > 0) {                                               // блок: белая вспышка у предплечий («руки у груди» отбили снаряд)
        const a = Ale.clamp(this.blockT / 0.25, 0, 1), cx = x + this.facing * 26, cy = y - 104 - this.hopY;
        ctx.save(); ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5 * a + 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(cx, cy, 14 + 10 * (1 - a), 30 + 8 * (1 - a), 0, this.facing < 0 ? Math.PI * 0.6 : -Math.PI * 0.4, this.facing < 0 ? Math.PI * 1.4 : Math.PI * 0.4); ctx.stroke();
        ctx.restore();
      }
      if (this.state === 'windup') {
        const s = 0.7 + 0.25 * Math.sin(this.st * 26);
        Ale.drawSprite(ctx, 'fx_warn', x, y - 196, { sx: s, sy: s });
      }
    }
  }

  Ale.Dimasik = Dimasik; Ale.Dumbbell = Dumbbell; Ale.Barbell = Barbell; Ale.Disc = Disc;
})();
