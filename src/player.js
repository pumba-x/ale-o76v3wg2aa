// Алеся: бег, прыжок (в том числе по головам крыс), «Туп лапой», бросок помидора с автоприцелом, урон.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const Input = Ale.Input;

  // Все числа боя и движения — здесь. Единицы: юниты мира (720 по высоте кадра), секунды.
  const C = Ale.PLAYER = {
    W: 46, H: 134, H_CROUCH: 84,
    RUN: 306, ACCEL: 3200, FRICTION: 3800, AIR_ACCEL: 2300, AIR_FRICTION: 700,
    JUMP: 870, GRAV_UP: 2400, GRAV_DOWN: 3200, MAX_FALL: 1200,               // прыжок всегда на полную высоту: короткое нажатие его не обрезает
    COYOTE: 0.10, BUFFER: 0.13,
    // Падение без прыжка (владелец 13.10.2026: «когда Алеся падает с чего-либо без прыжка — проигрывается анимация падения как на спуске после прыжка; с очень низкой преграды она доли секунды дёргано расставляет
    // руки»). Раньше кадр в воздухе зависел только от вертикальной скорости: сошла с уступа — верхняя точка прыжка (руки в стороны), «начало спуска», «тянется к земле» и ещё присед приземления, и всё за 0,15 с на
    // уступе в 40 юн. Теперь, пока она в воздухе без прыжка (`air.launched` ложно: вверх не летела, см. `update`): `hold` секунд (0,30 ≈ 144 юн. падения) показывается кадр, с которого сошла (бегущая — ноги
    // продолжают бежать, стоящая — стойка), потом за `fade` (0,08 с: кадры стоят на разной высоте, долгое растворение даёт «двойную голову») растворяется поза «тянется к земле» (без верхней точки и промежуточных кадров); присед приземления — только если падение длилось не меньше
    // `softLand` (0,38 с ≈ 230 юн.), иначе «ступила»: короткое сжатие без позы, пыли и громкого звука. Прыжок и отскок от крысы идут по-старому.
    FALL: { hold: 0.30, fade: 0.08, softLand: 0.38 },
    // Ходьба: цикл из 24 кадров на два шага, собранный «куклой» (`tools/rig`, 02.10.2026): руки и ноги вырезаны из ключевых кадров заказа 14 (они же — единственное, что
    // нарисовано), изгибаются вокруг суставов, а позы считает модель шага, а не картинка: опорная стопа идёт назад ровно со скоростью земли (не скользит), махровая плавно
    // поднимается и выносится вперёд, таз качается на 4% роста, руки качаются в противофазе ногам по плавной кривой (раньше «пила»: кулак перескакивал на треть роста за
    // кадр). Кадр 1 — касание передней стопой, кадр 13 — касание другой стопой: шаг-звук на них. `stride` — путь за кадр (темп ходьбы): кадры нарисованы под шаг 60 юн. (опорная стопа проходит 5,0 юн. за кадр из 24
    // на цикл), стоит 5,4 — стопа скользит на 8%. История: 4,284 при шаге 51 юн. давало в игре (бег 340 юн./с) 6,6 шага в секунду, владелец 02.10.2026: «в игре из-за скорости чуть хуже, чем на гифке,
    // замедли немного» → 5,0 при шаге 58 юн. (5,7 шага/с; git-тег `walk-step58`), потом «ещё чуть-чуть» → 5,4 при шаге 60 юн. (5,25 шага/с). Чем больше stride, тем медленнее ноги; сильно больше 5,6 не ставить —
    // стопа поедет по земле (тест держит ≤ 12%). Откат на прежний темп: `git checkout walk-step58 -- art/retained/animations/v6/walk assets/sprites assets/manifest.js src/player.js`. Тело, голова и волосы — один кадр (волосы не качаются); цвета и размеры те же, что у стоящей (набор `alesya_walk`). История: первая реализация (старые
    // кадры) — `art/retained/animations/walk/alesya`, шесть перерисованных кадров заказа 14 (три на шаг, ходьба «дёргалась»: нога уходила на треть роста за кадр, руки менялись местами
    // за кадр) — `git show 62632ec:src/player.js`; цикл из 8 кадров листа A1 — `git show 1ec78f7`, профильный шаг — `git show 4597f23`.
    WALK: { gait: 'jog', slow: 0.3, shoreStride: 5.4, get G() { return C.WALK_GAITS[this.gait]; }, get frames() { return this.G.frames; }, get steps() { return this.G.steps; }, get startAt() { return this.G.startAt; }, get passing() { return this.G.passing; }, get stride() { return this.G.tempo ? 4.86 / (1 - this.slow) : C.RUN / 60; }, maxRate: 60, stepVol: 0.5, settleHold: 0.06 },      // stepVol — громкость шага-звука (множитель к синтезу `step`; синтез целиком играет ×0,6 — Audio.SYNTH_K): владелец 02.10.2026: «звуки шагов тише на 40%» = 0,5 × 0,6 = 0,3 на выходе
    // Темп ходьбы 13.10.2026 (владелец: «анимация ходьбы слишком быстрая; перемещение в пространстве замедлить на 10 %, а скорость анимации — три варианта: медленнее на 10, 20 и 30 %»): бег RUN 340 → 306 юн./с (−10 %),
    // а `stride` теперь считается: 4,86 / (1 − slow), где 4,86 = 5,4 (прежний шаг) × 0,9 (бег медленнее на 10 %) — на полной скорости кадры идут на `slow` реже, чем шли раньше при 340 юн./с (63 кадра/с):
    // slow 0,1 → stride 5,4 (56,7 кадра/с, 4,7 шага/с; стопа скользит на 8 %, как и было), 0,2 → 6,08 (50,4 кадра/с, 4,2 шага/с; скольжение ≈ 21 %), 0,3 → 6,94 (44,1 кадра/с, 3,7 шага/с; ≈ 39 %). Ноги нарисованы под
    // шаг 60 юн. (stride 5,0), поэтому чем медленнее анимация, тем сильнее стопа «едет» по земле. Пока выбор за владельцем: по умолчанию slow 0,1; проверить руками — `tests/walk_speed.html`
    // (игра с переключением вариантов клавишами 1 / 2 / 3, «0» — как было) или `?walkanim=a|b|c|old` у любой ссылки игры; `C.setWalkVariant` ниже.
    // Кадры не пропускаются (владелец 13.10.2026: «такое чувство, будто часть кадров не включена в анимацию»): на 340 юн./с при шаге 5,4 фаза уходила на 1,049 кадра за шаг симуляции, и каждые ≈ 19 шагов
    // (≈ раз в 0,3 с) один кадр цикла перескакивался — в том числе кадры маха (замер по `Player.frame()` тик за тиком: 6 пропусков на 110 шагов); теперь бег медленнее (306 юн./с даёт 0,945 кадра за шаг при slow 0,1),
    // а `maxRate` 60 кадров/с (кадр за шаг) закрывает и любую другую большую скорость (плюс `autoWalk` в сценариях).
    // Старт и остановка (владелец 12.10.2026: «когда движение только начинается — первое, на что меняется кадр стойка, — ходьба 1?»: да, и это широкое касание: кадр щёлкал со «стоит» на «разножку», а при остановке
    // из середины шага — обратно на стойку). Теперь: из стойки шаг начинается с кадра прохода `startAt` (индекс 19 — кадр 20: ноги почти вместе, разнос стоп 3,5 юн. при 60+ у касания, ближе всех к стойке) и первое
    // касание (кадр 1, шаг-звук) приходит через ≈ 5 кадров; при остановке она дошагивает до ближайшего кадра прохода (`passing`: индексы 7 и 19 — кадры 8 и 20, их разделяет ровно полцикла), держится на нём `settleHold`
    // секунд и встаёт. Дальше полшага вперёд не идёт: тогда сразу на кадр прохода позади (короткий шаг-«тычок» не превращается в разножку). Если пошла снова, не встав, шаг продолжается с того же кадра.
    // «Туп лапой» (по просьбе владельца 01.10.2026: «поднимает согнутую ногу в колене до пояса и бьёт по земле; удар создаёт глухой звук и впереди поднимается пыль. Не нужно двойное
    // облако пыли — просто удар, звук, пыль в радиусе урона»). Кадры — позы первой реализации (владелец говорил, что «было значительно лучше»), перерисованные в пропорциях
    // стоящей (заказ 14, см. ходьбу): 1 — замах (присед), 2 — нога вынесена вперёд и вверх, 3 — нога на земле (пыли в кадре нет: её рисует код), 4 — возврат.
    // Между ними четыре промежуточных кадра, собранных кодом из тех же поз (`tools/rig/build_stomp.sh`; владелец 02.10.2026: «ещё несколько кадров туда добавить надо», удар казался резким):
    // lift (замах → нога вверх), strike1 и strike2 (нога вверх → нога на земле, два кадра: бросок вниз), recover (нога на земле → возврат); всего восемь кадров, до касания 0,18 с (было 0,153:
    // кадров вдвое больше при чуть более долгом замахе), после — те же 0,15 с с ногой на земле и 0,12 с на возврат.
    // В касание земли (land: чуть позже начала кадра 3, чтобы кадр с ногой на земле уже стоял) в один миг — облако пыли и сам удар (a0…a1), а звук — на soundDelay = 30 мс позже (владелец 02.10.2026:
    // «воспроизводиться должен на несколько миллисекунд позже, прямо в момент касания ноги земли»: картинка на экране появляется после тика, и звук, поданный в тот же тик, слышался раньше касания); пыль одна — мягкие клубы вдоль земли в зоне поражения, от dust0 до dust1 юнитов
    // впереди опоры (не под носком и не дальше reach). Дальность reach 211 считается от x+6, то есть до x+217. По высоте — от бедра (up) до 110 юнитов НИЖЕ стоп (down): с лавки
    // достаёт врага на полу.
    STOMP: { t: [0.05, 0.03, 0.04, 0.03, 0.03, 0.15, 0.05, 0.07], frames: ['ale_stomp1', 'ale_stomp_lift', 'ale_stomp2', 'ale_stomp_strike1', 'ale_stomp_strike2', 'ale_stomp3', 'ale_stomp_recover', 'ale_stomp4'], lunge0: 0.08, land: 0.183, sound: 0.183, soundDelay: 0.03, a0: 0.183, a1: 0.263, reach: 211, dust0: 72, dust1: 202, dustDrop: 14, dustLife: 0.65, up: 72, down: 110, lunge: 200 },
    THROW: { t: [0.05, 0.08, 0.07, 0.13], release: 0.13, speed: 700, lift: 215, gravity: 1150, slow: 0.35 },
    // Автоприцел: враг перед героиней в пределах range — помидор летит по дуге прямо в него (с упреждением по ходу цели).
    AIM: { range: 820, back: 20, maxVy: 980, maxLead: 0.9 },
    // Прыжок на голову крысы: отскок всегда одинаковый (от удержания кнопки не зависит).
    BOUNCE: 800,
    HURT: { stun: 0.4, invul: 1.5, kx: 300, ky: 340 },
    MAX_TOMATOES: 6,
    // Положение кисти передней руки в каждом кадре: [x вперёд, y вверх] в юнитах от точки опоры (кадры смотрят вправо). Найдено по цвету кожи на самих кадрах.
    // ale_throw0/1 — кулак, в котором до вылета сидит помидор (в новых кадрах рука пустая, помидор рисуется кодом).
    HAND: {
      ale_idle: [16, 63], ale_idle2: [17, 63], ale_hold: [42, 104], ale_land: [34, 39.6],
      ale_walk1: [-17.7, 56.0], ale_walk2: [-17.3, 56.4], ale_walk3: [-16.1, 57.7], ale_walk4: [-14.2, 59.4], ale_walk5: [-11.7, 61.1], ale_walk6: [-8.8, 62.4], ale_walk7: [-5.6, 63.9], ale_walk8: [-2.3, 65.5],
      ale_walk9: [0.5, 65.6], ale_walk10: [2.7, 64.4], ale_walk11: [4.4, 62.9], ale_walk12: [5.4, 61.5], ale_walk13: [5.7, 60.8], ale_walk14: [5.3, 61.3], ale_walk15: [4.2, 62.5], ale_walk16: [2.5, 64.0],
      ale_walk17: [0.2, 65.3], ale_walk18: [-2.6, 65.5], ale_walk19: [-5.9, 64.3], ale_walk20: [-9.1, 63.1], ale_walk21: [-11.9, 62.0], ale_walk22: [-14.4, 60.4], ale_walk23: [-16.2, 58.5], ale_walk24: [-17.3, 56.7],      // ходьба «куклой»: ближняя кисть качается от -17.7 до 5.7 юн. вперёд (по 24 кадрам цикла: центр тяжести кожи на кадрах, сглажен по кругу цикла)
      ale_jump_takeoff: [39, 127], ale_jump_takeoff_rise: [37.5, 115.8], ale_jump_rise: [31, 86], ale_jump_rise_tuck: [31.5, 80.7], ale_jump_tuck: [31, 65], ale_jump_tuck_apex: [44, 83.1], ale_jump_apex: [53, 82], ale_jump_apex_descent: [50, 94.2], ale_jump_descent: [49, 97], ale_jump_reach: [46, 70],      // шесть поз прыжка (заказ 13) и четыре промежуточных между ними (`tools/rig/build_jump.sh`; кисть измерена по цвету кожи на кадрах)
      ale_crouch: [22.1, 36.1], ale_stomp1: [26, 75], ale_stomp_lift: [51.4, 84.7], ale_stomp2: [49, 87], ale_stomp_strike1: [50.4, 83], ale_stomp_strike2: [26.6, 72.5], ale_stomp3: [28, 70], ale_stomp_recover: [20.4, 66], ale_stomp4: [21, 71],      // присед: рука у колена (кадры ale_crouch и ale_land уменьшены в наборе: `scale` 0,82 и 0,92 — голова была на 11–15 % крупнее стоящей, присед 124 юн. при хитбоксе 84, и мел летел сквозь голову; кисти пересчитаны); «Туп лапой»: видимая кисть в каждом кадре (у четырёх промежуточных — по цвету кожи)
      ale_throw0: [-22, 121], ale_throw1: [-46, 109],
    },
    // Предмет в руке: s — масштаб; palm — на раскрытой ладони (поза «держит»), fist — в кулаке при ходьбе и прыжке; sip — у рта на кадре ale_sip, phone — у уха на кадре ale_phone (заказ 20);
    // (dx, dy) — смещение центра предмета от кисти кадра (у кадров быта кисть — точка hand в манифесте), rot — поворот (для взгляда влево зеркалится)
    // FRAME_ITEM — предмет, который кадр быта «держит» сам: на ale_sip рука у рта пуста, на ale_phone — у уха; рисуется, даже если holdSprite не задан (поза sip / phone в сценарии)
    FRAME_ITEM: { ale_sip: 'it_tea', ale_phone: 'it_phone' },
    HOLD: {
      it_key: { s: 0.7, palm: { dx: 2, dy: 6, rot: -1.13 }, fist: { dx: 3, dy: 3, rot: -1.83 } },
      it_apple: { s: 0.44, palm: { dx: 1, dy: 11, rot: 0 }, fist: { dx: 3, dy: 9, rot: 0 } },
      pr_tomato: { s: 0.9, palm: { dx: 1, dy: 12, rot: 0 }, fist: { dx: 3, dy: 9, rot: 0 } },                // помидор на ладони: «другой формат сдачи» в начале боя с училкой (реплика училки «Это помидор?!» должна быть о том, что видно)
      it_ticket: { s: 0.34, palm: { dx: 2, dy: 6, rot: -0.12 }, fist: { dx: 6, dy: 4, rot: -0.6 } },
      it_tea: { s: 0.5, palm: { dx: 2, dy: 12, rot: 0 }, fist: { dx: 4, dy: 8, rot: 0.1 }, sip: { dx: -2.7, dy: -9, rot: -0.5 } },                  // баблти (Киев): глоток — стаканчик у рта, соломинка к губам
      it_cash: { s: 0.5, palm: { dx: 2, dy: 8, rot: -0.1 }, fist: { dx: 4, dy: 6, rot: -0.3 } },              // пачка выигрыша (Монако): в руке до кражи
      it_phone: { s: 0.5, palm: { dx: 2, dy: 12, rot: -0.2 }, fist: { dx: 4, dy: 9, rot: -0.3 }, phone: { dx: 3, dy: 1, rot: 0.1 } },              // телефон (звонок Илюшкинсу): у уха
      it_remote: { s: 0.42, palm: { dx: 2, dy: 10, rot: -0.5 }, fist: { dx: 4, dy: 8, rot: -0.7 } },        // пульт (комната-сюрприз)
    },
  };
  // Варианты темпа ходьбы для проверки руками (владелец 13.10.2026; пояснение — у WALK): `a` / `b` / `c` — бег 306 юн./с и анимация медленнее прежней на 10 / 20 / 30 %, `old` — как было до правки (340 юн./с, шаг 5,4).
  // Принимает 'a' | 'b' | 'c' | 'old', 1 | 2 | 3 | 0, 0.1 | 0.2 | 0.3 или '10' | '20' | '30'; возвращает ключ выбранного варианта, а непонятное значение не трогает и возвращает null.
  C.WALK_VARIANTS = { old: { run: 340, slow: 0.1, name: 'как было: бег 340, анимация 100 %' }, a: { run: 306, slow: 0.1, name: 'A: бег 306 (−10 %), анимация −10 %' }, b: { run: 306, slow: 0.2, name: 'B: бег 306, анимация −20 %' }, c: { run: 306, slow: 0.3, name: 'C: бег 306, анимация −30 %' } };
  C.setWalkVariant = function (v) {
    const t = String(v === undefined || v === null ? '' : v).trim().toLowerCase().replace(',', '.');
    const names = { old: 'old', was: 'old', '0': 'old', a: 'a', '1': 'a', '0.1': 'a', '.1': 'a', '10': 'a', b: 'b', '2': 'b', '0.2': 'b', '.2': 'b', '20': 'b', c: 'c', '3': 'c', '0.3': 'c', '.3': 'c', '30': 'c' };
    const key = Object.prototype.hasOwnProperty.call(names, t) ? names[t] : null;          // «constructor» из ссылки — не вариант (иначе падал запуск)
    if (!key) return null;
    const V = C.WALK_VARIANTS[key]; C.RUN = V.run; C.WALK.slow = V.slow;
    return key;
  };
  // Какой вариант сейчас стоит ('a' по умолчанию; null, если числа не совпали ни с одним)
  C.walkVariant = function () { return Object.keys(C.WALK_VARIANTS).find((k) => C.WALK_VARIANTS[k].run === C.RUN && C.WALK_VARIANTS[k].slow === C.WALK.slow) || null; };

  // Походки (владелец 13.10.2026: «что не так с самой анимацией» → «трусца выглядит хорошо, лучше всех — внедри и сохрани» → «отточить по анатомии» → **«выбираю сейчас первую версию: она не выглядит как бег, но вполне нормально
  // двигаются ноги; осталось — юбка спереди слишком задирается»**): **`jog` — основная** (33 кадра `ale_walkj`, по кадру на тик: цикл 168 юн., опора 40 %, между опорами короткий полёт, нога в махе поверх опорной,
  // дальняя чуть темнее, подол ложится на бедро — но передняя кромка поднимается на 30 % высоты подола, а не на 45: `RIG_SKIRTRIDE` 0,30; стопы ставятся ровно со скоростью земли — без скольжения; `stride` не зависит
  // от `slow`: RUN / 60; сборка — `python3 tools/rig/build_jog.py`), `joga` — анатомическая версия (`ale_walkja`, 33 кадра: сверена с коридорами беговой биомеханики на 19 из 19, `python3 tools/rig/build_jog.py
  // --anatomical`; выглядит «как бег» — стопа ставится ближе к телу, корпус наклонён; запасная для сравнения в `tests/walk_speed.html`), `walk` — прежние 24 кадра (`ale_walk`: ими же идёт героиня в подводке к
  // заплыву; шаг кадра там — `WALK.shoreStride`, а не `stride`). Выбор у ссылки — `?walkgait=jog|joga|walk`, на лету — `tests/walk_speed.html`. `steps` и `passing` — в кадрах цикла (могут быть дробными);
  // `passing[0]` — целый кадр, на котором стопы ближе всего (кадр показывается как floor), второй — через полцикла; `startAt` — кадр прохода, с которого шаг начинается из стойки.
  const seq = (prefix, n) => Array.from({ length: n }, (_, i) => prefix + (i + 1));
  C.WALK_GAITS = {
    walk: { name: 'прежняя: 24 кадра', frames: seq('ale_walk', 24), steps: [0, 12], startAt: 19, passing: [7, 19], tempo: true, cycleU: 120 },
    jog: { name: 'трусца: 33 кадра, кадр на тик, без скольжения', frames: seq('ale_walkj', 33), steps: [0, 16.5], startAt: 23, passing: [7, 23.5], tempo: false, cycleU: 168.2 },
    joga: { name: 'трусца, анатомическая: 33 кадра', frames: seq('ale_walkja', 33), steps: [0, 16.5], startAt: 22, passing: [6, 22.5], tempo: false, cycleU: 168.2 },
  };
  C.setWalkGait = function (v) {
    const k = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
    const names = { walk: 'walk', old: 'walk', v11: 'walk', jog: 'jog', run: 'jog', j: 'jog', '33': 'jog', jog1: 'jog', j1: 'jog', first: 'jog', joga: 'joga', anat: 'joga', a: 'joga' };
    const key = Object.prototype.hasOwnProperty.call(names, k) ? names[k] : null;          // jog1 — прежнее имя первой версии (она теперь просто jog); «constructor» из ссылки — не походка
    if (!key) return null;
    C.WALK.gait = key; return key;
  };
  C.walkGait = function () { return C.WALK.gait; };
  Object.assign(C.HAND, { ale_walkj1: [-17.8, 55.3], ale_walkj2: [-17.6, 55.6], ale_walkj3: [-16.9, 56.7], ale_walkj4: [-15.9, 57.9], ale_walkj5: [-14.4, 59.3], ale_walkj6: [-12.7, 60.7], ale_walkj7: [-10.7, 61.8], ale_walkj8: [-8.5, 62.7], ale_walkj9: [-6.1, 64.1], ale_walkj10: [-3.6, 65.8], ale_walkj11: [-1.3, 66.3], ale_walkj12: [0.6, 65.7], ale_walkj13: [2.3, 64.9], ale_walkj14: [3.6, 63.6], ale_walkj15: [4.7, 62.2], ale_walkj16: [5.4, 61.0], ale_walkj17: [5.7, 60.2], ale_walkj18: [5.7, 60.2], ale_walkj19: [5.3, 61.0], ale_walkj20: [4.5, 62.1], ale_walkj21: [3.4, 63.3], ale_walkj22: [2.0, 64.5], ale_walkj23: [0.3, 65.5], ale_walkj24: [-1.6, 66.2], ale_walkj25: [-3.9, 65.9], ale_walkj26: [-6.4, 64.4], ale_walkj27: [-8.9, 63.4], ale_walkj28: [-11.0, 62.6], ale_walkj29: [-12.9, 61.5], ale_walkj30: [-14.6, 60.0], ale_walkj31: [-16.0, 58.5], ale_walkj32: [-17.0, 57.0], ale_walkj33: [-17.6, 55.8] });                    // трусца (jog): точки кисти по кадрам куклы (tools/rig/build_jog.py → compose.json)
  Object.assign(C.HAND, { ale_walkja1: [-17.8, 59.8], ale_walkja2: [-17.6, 59.3], ale_walkja3: [-16.9, 59.1], ale_walkja4: [-15.8, 59.0], ale_walkja5: [-14.4, 58.8], ale_walkja6: [-12.7, 58.6], ale_walkja7: [-10.7, 58.4], ale_walkja8: [-8.5, 58.3], ale_walkja9: [-6.1, 59.1], ale_walkja10: [-3.6, 61.0], ale_walkja11: [-1.3, 62.6], ale_walkja12: [0.6, 63.7], ale_walkja13: [2.2, 65.0], ale_walkja14: [3.6, 66.1], ale_walkja15: [4.7, 66.7], ale_walkja16: [5.4, 66.2], ale_walkja17: [5.7, 65.1], ale_walkja18: [5.7, 64.3], ale_walkja19: [5.3, 64.0], ale_walkja20: [4.5, 63.8], ale_walkja21: [3.4, 63.5], ale_walkja22: [2.0, 63.2], ale_walkja23: [0.3, 62.7], ale_walkja24: [-1.6, 62.3], ale_walkja25: [-3.9, 61.2], ale_walkja26: [-6.4, 59.5], ale_walkja27: [-8.9, 59.0], ale_walkja28: [-11.0, 59.5], ale_walkja29: [-12.9, 60.3], ale_walkja30: [-14.6, 61.4], ale_walkja31: [-16.0, 62.2], ale_walkja32: [-17.0, 62.0], ale_walkja33: [-17.6, 60.9] });                    // трусца анатомическая (joga): то же

  // Кисть передней руки на кадре f (юниты от опоры, x вперёд, y вверх): таблица HAND, а для кадров быта (ale_sip, ale_phone — рука у рта и у уха, заказ 20) точка hand из манифеста; иначе кисть стоящей
  function handOf(f) {
    if (C.HAND[f]) return C.HAND[f];
    const s = Ale.Assets.sprites[f], q = s && s.pts && s.pts.hand;
    return q ? [q[0], -q[1]] : C.HAND.ale_idle;
  }

  class Player extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: C.W, h: C.H, id: 'ale', z: 55 }, o));
      this.headH = 158;
      this.state = 'free'; this.st = 0;
      this.coyote = 0;
      this.buf = { jump: 0, attack: 0, throw: 0 };
      this.invul = 0;
      this.walkPhase = 0; this.settle = null; this.landT = 0; this.sq = { x: 1, y: 1 };
      this.air = null; this._gf = 'ale_idle';          // воздух: { t, launched, running, gf } (см. C.FALL); _gf — кадр на земле в прошлом шаге
      this.crouch = false; this.locked = false; this.auto = null;
      this.hitSet = new Set();
      this.released = false; this.impacted = false; this.landed = false;
      this.dustT = 0; this.deadT = 0; this.dropThrough = 0;
      this.holdSprite = null;        // например 'it_key' — предмет над головой при находке
      this.idleT = 0; this.glance = 0;   // долгое стояние: Алеся оглядывается (только вид, без влияния на игру)
      this.pose = null;              // поза сценария на земле: 'cheer' — победа
      this.startled = false;         // испуг без урона (startle): вместо «ударена» — кадр «удивлена»
      this.aimTarget = null;         // враг, в которого полетит помидор (подсвечивается прицелом)
      this.hidden = false;           // кат-сцены: героиня «ушла» (например, села на коня)
      this.kitAnim = null;           // анимация броска предмета набора (бой с Димасиком), см. kit.js
    }

    get S() { return Ale.Game.state; }
    // Entity.dead — флаг удаления сущности, у героини он не ставится; «сражена» — это состояние.
    get down() { return this.state === 'dead'; }

    controlsOn() {
      return !this.locked && !this.scene.locked && this.state !== 'dead' && !Ale.Game.transitioning;
    }
    canInteract() { return this.state === 'free' && this.onGround && this.controlsOn(); }

    autoWalk(x, opts) { this.auto = { x, speed: (opts && opts.speed) || C.RUN * 0.62, arrive: (opts && opts.arrive) || 8 }; }

    hurtbox() {
      const h = this.crouch ? C.H_CROUCH : C.H;
      return { x: this.x - C.W / 2 + 2, y: this.y - h, w: C.W - 4, h };
    }

    stompRect() {
      const S = C.STOMP;
      return { x: this.facing > 0 ? this.x + 6 : this.x - 6 - S.reach, y: this.y - S.up, w: S.reach, h: S.up + S.down };
    }

    // ---------------------------------------------------------------- обновление
    update(dt) {
      super.update(dt);
      const sc = this.scene, world = sc.world;
      const on = this.controlsOn();
      if (this.invul > 0) this.invul = Math.max(0, this.invul - dt);
      if (this.dropThrough > 0) this.dropThrough -= dt;

      // намерения
      let move = 0, jumpHeld = false, down = false;
      if (on) {
        move = Input.axis(); jumpHeld = Input.down('jump'); down = Input.down('down');
        const B = C.BUFFER;
        if (Input.pressed('jump')) this.buf.jump = B;
        if (Input.pressed('attack')) this.buf.attack = B;
        if (Input.pressed('throw')) this.buf.throw = B;
      } else {
        this.buf.jump = this.buf.attack = this.buf.throw = 0;
        if (this.auto) {
          const dx = this.auto.x - this.x;
          if (Math.abs(dx) <= this.auto.arrive) this.auto = null; else move = Math.sign(dx);
        }
      }
      for (const k in this.buf) if (this.buf[k] > 0) this.buf[k] -= dt;
      const maxSpeed = (!on && this.auto) ? this.auto.speed : C.RUN;
      this.jumpHeld = jumpHeld;

      // оглядывается, если долго стоит без дела
      const idle = on && this.state === 'free' && this.onGround && Math.abs(this.vx) < 5 && move === 0 && !this.holdSprite && !this.crouch;
      if (idle) { this.idleT += dt; if (this.idleT > 6 && this.glance <= 0) { this.glance = 1.3; this.idleT = -2; } } else { this.idleT = 0; this.glance = 0; }
      if (this.glance > 0) this.glance -= dt;
      switch (this.state) {
        case 'free': this._free(dt, on, move, maxSpeed, jumpHeld, down); break;
        case 'stomp': this._stomp(dt, on, move); break;
        case 'throw': this._throw(dt, on, move); break;
        case 'hurt': this._hurt(dt); break;
        case 'dead': this._dead(dt); break;
      }

      // физика
      this.vyStart = this.vy;            // скорость в начале шага: по ней крыса понимает, что героиня упала на неё сверху
      const wasGround = this.onGround, vyBefore = this.vy;
      this.vy = Math.min(this.vy + (this.vy < 0 ? C.GRAV_UP : C.GRAV_DOWN) * dt, C.MAX_FALL);
      world.move(this, dt);
      if (this.onGround && !wasGround) this._landed(vyBefore);
      // воздух: сошла с уступа (вверх не летела) или прыгнула / отскочила / отлетела от удара (вертикальная скорость вверх): от этого зависят кадры падения и приземления (C.FALL)
      if (this.onGround) { this.air = null; this._gf = this._groundFrame(); }
      else if (!this.air) this.air = { t: 0, launched: this.vy < -150, running: Math.abs(this.vx) > 20, gf: this._gf };
      else { this.air.t += dt; if (this.vy < -150) this.air.launched = true; }
      // пружина «сплющивания»
      const k = Math.min(1, 16 * dt);
      this.sq.x += (1 - this.sq.x) * k; this.sq.y += (1 - this.sq.y) * k;
      if (this.landT > 0) this.landT -= dt;
      if (this.state !== 'free') { this.walkPhase = 0; this.settle = null; }          // удар, бросок, ранение: после них шаг начинается с кадра прохода, а не с середины старого цикла

      // прицел: кто окажется под помидором, если бросить прямо сейчас
      const kit = sc.kit;
      this.aimTarget = kit ? ((on && kit.live && (this.state === 'free' || this.state === 'throw')) ? kit.target(this) : null)
        : (on && this.S.tomatoes > 0 && (this.state === 'free' || this.state === 'throw')) ? this._pickTarget() : null;

      // взаимодействие
      if (on && this.state === 'free' && Input.pressed('interact') && sc.focus && this.onGround) {
        Input.consume('interact');
        sc.focus.interact(this);
      }
    }

    // Остановка шага (см. WALK): из любой точки цикла — на ближайший кадр прохода. Если до следующего впереди не больше двух третей полцикла (8 кадров у прежней походки, 11 у трусцы) — доходит до него кадрами подряд (не медленнее кадра за тик, не дольше
    // ≈ 5 тиков: ноги плавно сходятся, а не щёлкают), иначе сразу на кадр прохода позади (он ближе чем на 4 кадра: так шаг-«тычок» остаётся тычком); держится на нём settleHold секунд, потом фаза сбрасывается и frame() возвращает стойку.
    _settleWalk(dt) {
      const W = C.WALK, n = W.frames.length;
      let s = this.settle;
      if (!s) {
        const p = this.walkPhase, q = p - Math.floor(p / n) * n;
        const half = n / 2, m = (((q - W.passing[0]) % half) + half) % half, fwd = (half - m) % half;           // m — сколько прошло после ближайшего кадра прохода, fwd — сколько осталось до следующего (проходы стоят через полцикла)
        s = fwd <= half * 2 / 3 ? { ph: p, target: p + fwd, rate: Math.max(1, fwd / 5), hold: W.settleHold } : { ph: p - m, target: p - m, rate: 1, hold: W.settleHold };          // вперёд — до двух третей полцикла (8 кадров у 24-кадровой, 11 у трусцы), иначе назад (≤ 4 и ≤ 5,5 кадров)
      }
      if (s.ph < s.target) s.ph = Math.min(s.target, s.ph + s.rate);
      else { s.hold -= dt; if (s.hold <= 0) { this.settle = null; this.walkPhase = 0; return; } }
      this.settle = s;
    }

    _free(dt, on, move, maxSpeed, jumpHeld, down) {
      const g = this.onGround;
      this.crouch = on && down && g;
      if (g) this.coyote = C.COYOTE; else this.coyote -= dt;
      const target = this.crouch ? 0 : move * maxSpeed;
      if (move !== 0 && !this.crouch) {
        this.facing = move;
        // разворот на бегу — облачко пыли
        if (g && Math.sign(this.vx) === -move && Math.abs(this.vx) > 180 && this.dustT <= 0) { sc_dust(this, 3, move); this.dustT = 0.12; }
        this.vx = Ale.approach(this.vx, target, (g ? C.ACCEL : C.AIR_ACCEL) * dt);
      } else this.vx = Ale.approach(this.vx, 0, (g ? C.FRICTION : C.AIR_FRICTION) * dt);
      if (this.dustT > 0) this.dustT -= dt;

      // анимация ходьбы привязана к пути, а не ко времени
      if (g && Math.abs(this.vx) > 20 && !this.crouch) {
        const W = C.WALK, n = W.frames.length;
        // из стойки шаг начинается с кадра прохода (ноги почти вместе), а не с широкого касания; пошла снова, не встав, — с того кадра, где остановилась (см. WALK)
        if (this.settle) { this.walkPhase = this.settle.ph; this.settle = null; } else if (this.walkPhase === 0) this.walkPhase = W.startAt;
        const before = this.walkPhase;
        this.walkPhase += Math.min(Math.abs(this.vx) * dt / W.stride, W.maxRate * dt);          // не больше кадра за шаг симуляции: быстрее кадры пропускались (при 340 юн./с и шаге 5,4 — по кадру на каждые ≈ 19 шагов, в том числе кадры маха: «будто часть кадров не включена в анимацию»)
        // шаг-звук и пыль — когда фаза проходит кадр касания (кадров 24, на бегу фаза уходит больше чем на кадр за тик: ловим пересечение, а не попадание на номер); из стойки первый звук — на первом касании, а не на первом тике
        const touched = W.steps.some((s) => Math.floor((this.walkPhase - s) / n) !== Math.floor((before - s) / n));
        if (touched) {
          Ale.Audio.sfx('step', { vol: W.stepVol });
          if (Math.abs(this.vx) > 260) this.scene.fx.dust(this.x - this.facing * 12, this.y, 1, -this.facing, 0.6);
        }
      } else if (!g && Math.abs(this.vx) > 20 && this.air && !this.air.launched && this.air.t < C.FALL.hold) {
        const W = C.WALK; this.walkPhase += Math.min(Math.abs(this.vx) * dt / W.stride, W.maxRate * dt);          // сошла с уступа на бегу: ноги бегут в воздухе, пока падение короткое
      } else if (Math.abs(this.vx) < 20) {
        if (g && !this.crouch && (this.settle || this.walkPhase > 0)) this._settleWalk(dt);          // остановка: дошагать до кадра прохода и встать
        else { this.walkPhase = 0; this.settle = null; }
      }

      // прыжок
      if (this.buf.jump > 0 && this.coyote > 0) {
        if (this.crouch && this.ground && this.ground.oneway) {
          this.dropThrough = 0.25; this.vy = 80; this.buf.jump = 0; this.coyote = 0;
        } else {
          this.vy = -C.JUMP; this.buf.jump = 0; this.coyote = 0; this.onGround = false;
          this.sq.x = 0.86; this.sq.y = 1.16;
          this.scene.fx.dust(this.x, this.y, 4, 0, 0.8);
          Ale.Audio.sfx('jump');
        }
      }

      // действия
      if (on) {
        if (this.buf.attack > 0) this._enterStomp();
        else if (this.buf.throw > 0) {
          if (this.scene.kit || this.S.tomatoes > 0) this._wantThrow();
          else { this.buf.throw = 0; Ale.Audio.sfx('empty'); this.scene.fx.text(this.x, this.y - 170, Ale.T.fx.noTomatoes, { size: 22 }); }
        }
      }
    }

    // ---------------------------------------------------------------- удар «Туп лапой»
    _enterStomp() {
      this.state = 'stomp'; this.st = 0; this.buf.attack = 0; this.hitSet.clear(); this.impacted = false; this.landed = false;
      this.crouch = false;
    }

    _stomp(dt, on, move) {
      const T = C.STOMP;
      this.st += dt;
      const t = this.st;
      this.vx = Ale.approach(this.vx, 0, 900 * dt);     // выпад скользит чуть дольше обычного торможения
      // 1) колено поднимается, героиня шагает вперёд: ни звука, ни пыли — нога ещё в воздухе
      if (!this.impacted && t >= T.lunge0) {
        this.impacted = true;
        if (this.onGround) this.vx = this.facing * T.lunge;
      }
      // 2) нога касается земли: в один и тот же миг звук, облако пыли и сам удар (он достаёт врагов с этого момента)
      if (!this.landed && t >= T.land) { this.landed = true; Ale.Audio.sfx('stomp', { when: C.STOMP.soundDelay }); this._stompDust(); this.scene.camera.shake(2.5, 0.12); }
      if (t >= T.a0 && t <= T.a1) this._stompHit();
      // после активных кадров удар можно оборвать прыжком: отзывчивее, чем ждать конца анимации
      if (on && t > T.a1 && this.buf.jump > 0 && this.onGround) { this.state = 'free'; this.buf.jump = Math.max(this.buf.jump, 0.06); return; }   // нажатие не должно истечь на переходе в «свободное» состояние
      const total = Ale.sum(T.t);
      if (t >= total) {
        this.state = 'free';
        if (on && this.buf.attack > 0) this._enterStomp();
        else if (on && this.buf.throw > 0 && (this.scene.kit || this.S.tomatoes > 0)) this._wantThrow();
      }
    }

    // Пыль удара: одно облако в зоне поражения; клубы рождаются на dustDrop юнитов НИЖЕ линии земли (владелец 02.10.2026: «опусти ниже, чтобы поднималась именно с земли»: основание
    // клуба — внизу спрайта, и при рождении на самой линии облако висело над землёй). Мягкие клубы стоят вдоль земли от dust0 до dust1 юнитов впереди опоры и поднимаются вверх; ничего под носком,
    // никакой «волны» поверх (раньше было два слоя, и они накладывались друг на друга). Правка того же дня, ночью: «облачко должно появляться чуточку дальше от ноги вперёд, чуть ниже и
    // оставаться чуточку дольше» — dust0 56 → 72 (носок в кадре 3 кончается в 48 юн. от опоры, а клуб шириной ≈ 28 теперь начинается за ним, а не на нём), dust1 196 → 202 (дальний край
    // остаётся у границы зоны удара: центры клубов не дальше reach + 6), dustDrop 8 → 14, жизнь клубов dustLife 0,5 → 0,65 с (тают линейно: исчезают к 0,55–0,75 с после касания, было 0,43–0,58).
    _stompDust() {
      const fx = this.scene.fx, d = this.facing, S = C.STOMP;
      if (!this.onGround) return;
      for (let i = 0; i < 6; i++) fx.puff(this.x + d * Ale.lerp(S.dust0, S.dust1, i / 5), this.y + S.dustDrop, 1, d, { size: 24 + (i % 3) * 3, vx: 12, rise: 58 + i * 4, life: S.dustLife });
    }

    _stompHit() {
      const r = this.stompRect();
      // «Туп лапой» разбивает летящие у земли снаряды (мел по ногам, упавший комок)
      for (const e of this.scene.entities) {
        if (e.dead || !(e instanceof Ale.Projectile) || e.team !== 'enemy' || this.hitSet.has(e)) continue;
        if (Ale.overlap(r, e.hurtbox())) {
          this.hitSet.add(e); e._impact(null, false);
          Ale.Game.hitstop(3); this.scene.camera.shake(3, 0.12);
          this.scene.fx.sparks(e.x, e.y, 6); this.scene.fx.text(e.x, e.y - 40, Ale.T.fx.parried, { size: 22, color: '#ffe9a0' });
        }
      }
      for (const e of this.scene.entities) {
        if (e.dead || !e.vulnerable || this.hitSet.has(e)) continue;
        if (!Ale.overlap(r, e.hurtbox())) continue;
        const ok = e.takeHit({ kind: 'stomp', dir: this.facing, dmg: 1, x: this.x, y: this.y - 40, src: this });
        if (ok) {
          this.hitSet.add(e);
          Ale.Game.hitstop(5);
          this.scene.camera.shake(6, 0.2);
        }
      }
    }

    // ---------------------------------------------------------------- бросок помидора (и предмета набора в бою с Димасиком)
    _enterThrow() {
      this.state = 'throw'; this.st = 0; this.buf.throw = 0; this.released = false; this.crouch = false; this.kitAnim = null;
    }

    // Нажатие «бросок»: в бою с Димасиком (scene.kit) решает набор — рогатка, дротики или шар, помидоры не тратятся; иначе — помидор
    _wantThrow() {
      const k = this.scene.kit;
      this.buf.throw = 0;
      if (k) { const a = k.press(this); if (a) { this.state = 'throw'; this.st = 0; this.released = false; this.crouch = false; this.kitAnim = a; this.drawT = 0; this.drawCharge = 0; } return; }
      this._enterThrow();
    }

    // Тяга рогатки (0…1), пока тетиву держат натянутой; вне натяжения всегда 0 (кольцо прицела и кадры берут её отсюда)
    get drawCharge() { return (this.state === 'throw' && this.kitAnim && this.kitAnim.charge && !this.released) ? (this._dc || 0) : 0; }
    set drawCharge(v) { this._dc = v; }

    // Натягивание тетивы: пока зажата кнопка броска, тяга растёт (0…1 за Kit.charge.full секунд), отпустил — выстрел с этой тягой; прыжок или удар по героине отменяют (ничего не потрачено)
    _draw(dt, on, move, A) {
      const K = this.scene.kit; if (!K) { this.state = 'free'; this.kitAnim = null; return; }          // набор убрали посреди натягивания (сценарий обнулил sc.kit): без него Player.update бросал исключение каждый шаг
      const Ch = K.cfg.charge, I = Ale.Input;
      const wasLock = this.drawCharge >= Ch.lock, wasFull = this.drawCharge >= 0.999;
      this.drawT = (this.drawT || 0) + dt;
      this.drawCharge = Ale.clamp(this.drawT / Ch.full, 0, 1);
      const tv = (on ? move : 0) * C.RUN * A.slow;
      this.vx = Ale.approach(this.vx, tv, C.ACCEL * dt);
      if (this.drawT <= dt + 1e-6) Ale.Audio.sfx('sling_pull');
      if (!wasLock && this.drawCharge >= Ch.lock) Ale.Audio.sfx('sling_lock');
      if (!wasFull && this.drawCharge >= 0.999) Ale.Audio.sfx('sling_full');
      if (!on || (this.buf.jump > 0 && this.onGround)) { this.state = 'free'; this.kitAnim = null; K.cancel(this); return; }      // отпустили управление или прыгнули: натяжение сброшено
      if (this.drawT >= Ch.minHold && !I.down('throw')) { const c = this.drawCharge; this.released = true; this.st = A.release; K.release(this, A, c); }
    }

    _throw(dt, on, move) {
      const A = this.kitAnim, T = A || C.THROW;
      if (A && A.charge && !this.released) return this._draw(dt, on, move, A);
      this.st += dt;
      const tv = (on ? move : 0) * C.RUN * T.slow;
      this.vx = Ale.approach(this.vx, tv, C.ACCEL * dt);
      if (!this.released && this.st >= T.release && A) { this.released = true; if (this.scene.kit) this.scene.kit.release(this, A); }
      else if (!this.released && this.st >= T.release) {
        this.released = true;
        this.S.tomatoes = Math.max(0, this.S.tomatoes - 1);
        const ox = this.x + this.facing * 46, oy = this.y - 104;
        let vx = this.facing * T.speed + this.vx * 0.3, vy = -T.lift;
        const tgt = this._pickTarget();
        const a = tgt && this._aimVelocity(tgt, ox, oy);
        if (a) { vx = a.vx; vy = a.vy; }
        const p = new Ale.Projectile({
          x: ox, y: oy, team: 'player', kind: 'tomato', sprite: 'pr_tomato',
          vx, vy, g: T.gravity, r: 15, spin: 9 * this.facing, life: 2.4,
        });
        this.scene.add(p);
        Ale.Audio.sfx('throw');
      }
      if (on && this.released && this.st > T.release + 0.04 && this.buf.jump > 0 && this.onGround) { this.state = 'free'; this.kitAnim = null; return; }     // бросок можно оборвать прыжком
      const total = Ale.sum(T.t);
      if (this.st >= total) {
        this.state = 'free'; this.kitAnim = null;
        if (on && this.buf.attack > 0) this._enterStomp();
        else if (on && this.buf.throw > 0 && (this.scene.kit || this.S.tomatoes > 0)) this._wantThrow();
      }
    }

    // Ближайший враг перед героиней, в которого можно попасть помидором.
    _pickTarget() {
      const f = this.facing, ox = this.x + f * 46, oy = this.y - 104, A = C.AIM;
      let best = null, bs = 1e9;
      for (const e of this.scene.entities) {
        if (e.dead || !e.aimable || !e.vulnerable || e.state === 'dead') continue;
        const b = e.hurtbox(), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const dx = (cx - ox) * f;
        if (dx < -(b.w / 2 + A.back) || dx > A.range) continue;     // цель вплотную (в том числе «под носом») — тоже цель
        const dy = cy - oy;
        if (Math.abs(dy) > 420) continue;
        const score = Math.max(0, dx) + Math.abs(dy) * 0.3;
        if (score < bs) { bs = score; best = e; }
      }
      return best;
    }

    // Скорость помидора, чтобы дуга прошла через центр цели (с упреждением по её движению).
    _aimVelocity(e, ox, oy) {
      const T = C.THROW, A = C.AIM, b = e.hurtbox();
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, g = T.gravity;
      let t = Math.abs(cx - ox) / T.speed, px = cx, py = cy;
      for (let i = 0; i < 3; i++) {
        t = Ale.clamp(t, 0.14, 1.0);
        px = cx + (e.vx || 0) * t * A.maxLead;
        py = e.onGround === false ? Math.min(cy + (e.vy || 0) * t + 1300 * t * t, e.y - b.h / 2) : cy;
        t = Math.abs(px - ox) / T.speed;
      }
      t = Ale.clamp(t, 0.14, 1.0);
      // цель почти под руками (или чуть позади точки броска): помидор падает на неё сверху почти отвесно
      if ((px - ox) * this.facing < 24) { t = 0.16; return { vx: this.facing * 40, vy: (py - oy - 0.5 * g * t * t) / t }; }
      const vx = (px - ox) / t, vy = (py - oy - 0.5 * g * t * t) / t;
      if (Math.abs(vy) > A.maxVy || Math.sign(vx) !== this.facing) return null;
      return { vx, vy };
    }

    // ---------------------------------------------------------------- прыжок на голову
    // Крыса раздавлена сверху: героиня отскакивает.
    bounceOff() {
      this.vy = -C.BOUNCE;
      this.onGround = false; this.coyote = 0;
      this.sq.x = 0.9; this.sq.y = 1.14;
      Ale.Game.hitstop(3);
    }

    // ---------------------------------------------------------------- урон
    takeHit(info) {
      if (this.state === 'dead' || this.invul > 0 || this.scene.locked || this.locked || (Ale.Game && Ale.Game.transitioning)) return false;   // в кат-сценах и между сценами (управление выключено, увернуться нельзя) героиню не бьют: раньше крыса у двери отнимала сердце за время затемнения (18.10.2026)
      const S = this.S;
      S.hp = Math.max(0, S.hp - (info.dmg || 1));
      Ale.UI.hearts.bump = 1;
      const dir = info.dir !== undefined ? info.dir : (this.x >= info.x ? 1 : -1);
      this.vx = dir * C.HURT.kx; this.vy = -C.HURT.ky; this.onGround = false;
      this.facing = -dir; this.crouch = false;
      this.invul = C.HURT.invul;
      if (this.kitAnim && !this.released && this.scene.kit) this.scene.kit.cancel(this);       // бросок сорван до выпуска: предмет остаётся в руках, запас цел
      this.kitAnim = null;
      this.state = S.hp <= 0 ? 'dead' : 'hurt'; this.st = 0; this.deadT = 0; this.startled = false;
      Ale.Game.hitstop(7);
      this.scene.camera.shake(10, 0.3);
      this.scene.fx.sparks(this.x, this.y - 90, 8);
      Ale.UI.flash('rgba(214,52,33,ALPHA)', 0.35);
      Ale.Audio.sfx('hurt');
      return true;
    }

    _hurt(dt) {
      this.st += dt;
      this.vx = Ale.approach(this.vx, 0, 900 * dt);
      if (this.st >= C.HURT.stun) { this.state = 'free'; this.startled = false; }
    }

    _dead(dt) {
      // Победа успела раньше конца падения (последний помидор ещё летел, когда героиню добил мел): сцену уже ведёт сценарий —
      // героиня поднимается с одним сердцем, выигранный бой не отменяется откатом к контрольной точке.
      if (this.scene.locked && !this.reported) {
        this.S.hp = Math.max(1, this.S.hp); this.state = 'free'; this.st = 0; this.invul = 2; this.deadT = 0; this.vx = 0;
        return;
      }
      this.deadT += dt;
      this.vx = Ale.approach(this.vx, 0, 900 * dt);
      if (this.deadT > 1.0 && !this.reported) { this.reported = true; Ale.Game.onPlayerDead(); }
    }

    // Испуг без урона (кат-сцены): короткая реакция «отпрыгнула».
    startle(dir) { if (this.state === 'dead') return; this.state = 'hurt'; this.startled = true; this.st = 0.1; this.vx = -(dir === undefined ? this.facing : dir) * 140; this.crouch = false; }

    heal(n) { const S = this.S; S.hp = Math.min(S.maxHp, S.hp + n); Ale.UI.hearts.bump = 1; }

    _landed(vy) {
      const a = this.air, step = !!(a && !a.launched && a.t < C.FALL.softLand);            // ступила с уступа: без приседа и пыли
      if (vy > 260) {
        const f = Ale.clamp((vy - 260) / 900, 0, 1);
        if (step) {
          this.sq.x = 1 + 0.05 + 0.04 * f; this.sq.y = 1 - 0.05 - 0.05 * f;
          Ale.Audio.sfx('land', { vol: 0.25 + f * 0.3 });
          return;
        }
        this.sq.x = 1 + 0.2 * f + 0.06; this.sq.y = 1 - 0.2 * f - 0.05;
        this.landT = 0.08;
        this.scene.fx.dust(this.x, this.y, 3 + Math.round(f * 4), 0, 0.7 + f * 0.6);
        Ale.Audio.sfx('land', { vol: 0.5 + f * 0.5 });
      }
    }

    // Кадр на земле (без поз «ale_land» и присед не по делу): им держится падение с низкого уступа
    _groundFrame() {
      const f = this.frame();
      return f === 'ale_land' ? 'ale_idle' : f;
    }

    // Кадр в воздухе без прыжка (см. C.FALL): пока падение короткое — кадр бега или стойки (бегущая — ноги идут дальше), потом «тянется к земле»
    _holdFrame(a) {
      if (a.running) { const W = C.WALK; return W.frames[Math.floor(this.walkPhase) % W.frames.length]; }
      return a.gf;
    }
    _fallFrame(a) { return a.t < C.FALL.hold ? this._holdFrame(a) : 'ale_jump_reach'; }

    // ---------------------------------------------------------------- кадр анимации
    frame() {
      const s = this.state;
      if (s === 'stomp') return C.STOMP.frames[Ale.frameAt(C.STOMP.t, this.st)];
      // бросок предмета набора: пока тянут тетиву рогатки — кадр по тяге (прицел → тетива наполовину → полная тяга), иначе кадры анимации по времени (kit.js)
      if (s === 'throw') return this.kitAnim ? ((this.kitAnim.charge && !this.released) ? Ale.Kit.chargeFrame(this.kitAnim, this.drawCharge, this.drawT) : this.kitAnim.frames[Ale.frameAt(this.kitAnim.t, this.st)]) : 'ale_throw' + Ale.frameAt(C.THROW.t, this.st);
      if (s === 'hurt') return this.startled ? 'ale_wow' : this.st < 0.2 ? 'ale_hit' : 'ale_stagger';
      if (s === 'dead') return this.onGround ? 'ale_lie' : 'ale_fall';               // отброшена, потом лежит до возврата к контрольной точке
      if (this.pose && this.onGround && Ale.Assets.sprites['ale_' + this.pose]) return 'ale_' + this.pose;          // нет кадра позы в сборке (sip, phone, glasses — заказ 20) — обычная стойка, а не пропавшая героиня
      if (this.holdSprite && this.onGround && Math.abs(this.vx) < 20 && !this.crouch) return 'ale_hold';
      if (!this.onGround) {
        const air = this.air;
        if (air && !air.launched) return this._fallFrame(air);                          // сошла с уступа: кадр бега/стойки, потом «тянется к земле» (C.FALL)
        // Шесть поз прыжка, нарисованных заново одним листом (заказ 13, 02.10.2026; ChatGPT по одной стоящей картинке), плюс четыре промежуточных между первыми пятью (собраны кодом из тех же
        // поз: `tools/rig/build_jump.sh`; владелец 02.10.2026: «актуальный прыжок красивый, нужно ещё кадров, буквально 4») выбираются по вертикальной скорости. Промежуточный кадр стоит на границе
        // двух поз (там раньше был рывок). На полном прыжке (JUMP 870, подъём 2400, спуск 3200) они держатся: отрыв ≈ 0,05 с (три тика), отрыв→подъём ≈ 0,05, подъём ≈ 0,07, подъём→группировка ≈ 0,05,
        // группировка ≈ 0,05, группировка→верхняя точка ≈ 0,05, верхняя точка ≈ 0,08 (с обеих сторон вершины), верхняя точка→начало спуска ≈ 0,05, начало спуска ≈ 0,05, «тянется к земле» — до приземления
        // ≈ 0,18 с; те же пороги при падении с уступа (там начинается с верхней точки) и при отскоке от крысы (BOUNCE 800).
        if (this.vy < -740) return 'ale_jump_takeoff';
        if (this.vy < -610) return 'ale_jump_takeoff_rise';
        if (this.vy < -450) return 'ale_jump_rise';
        if (this.vy < -330) return 'ale_jump_rise_tuck';
        if (this.vy < -210) return 'ale_jump_tuck';
        if (this.vy < -90) return 'ale_jump_tuck_apex';
        if (this.vy < 140) return 'ale_jump_apex';
        if (this.vy < 290) return 'ale_jump_apex_descent';
        if (this.vy < 440) return 'ale_jump_descent';
        return 'ale_jump_reach';
      }
      if (this.landT > 0) return 'ale_land';
      if (this.crouch) return 'ale_crouch';
      if (Math.abs(this.vx) > 20) return C.WALK.frames[Math.floor(this.walkPhase) % C.WALK.frames.length];
      if (this.settle) return C.WALK.frames[Math.floor(this.settle.ph) % C.WALK.frames.length];          // остановка: кадр прохода (см. WALK, _settleWalk)
      if (this.glance > 0) return 'ale_glance';                                        // оглянулась через плечо (на Бубела)
      return this.t % 3.7 > 3.55 ? 'ale_idle2' : 'ale_idle';                           // изредка — «моргнула»
    }

    draw(ctx, alpha) {
      if (this.hidden) return;
      const x = this.rx(alpha), y = this.ry(alpha);
      this.drawShadow(ctx, x, y, 34, 0.36);
      let sx = this.sq.x, sy = this.sq.y, rot = 0;
      const f = this.frame();
      if (f === 'ale_idle' || f === 'ale_idle2') { const b = Math.sin(this.t * 2.6); sy *= 1 + b * 0.011; sx *= 1 - b * 0.006; }
      if (this.state === 'free' && this.onGround && Math.abs(this.vx) > 20) rot = Ale.clamp(this.vx / C.RUN, -1, 1) * 0.04;
      let a = 1, flash = 0;
      if (this.invul > 0) {
        a = (Math.floor(this.t * 18) % 2) ? 0.5 : 1;
        if (this.invul > C.HURT.invul - 0.12) flash = 0.85;
      }
      const look = this.facing;
      const so = { flip: look < 0, sx, sy, rot, alpha: a, flash };
      if (this.clipY !== undefined) { ctx.save(); ctx.beginPath(); ctx.rect(x - 300, y - 500, 600, this.clipY - (y - 500)); ctx.clip(); }      // проваливается в люк: ниже кромки не видно
      const air = this.air, fk = air && !air.launched && !this.onGround && this.state === 'free' && air.t >= C.FALL.hold ? Ale.clamp((air.t - C.FALL.hold) / C.FALL.fade, 0, 1) : 1;
      if (fk < 1) {                                                                      // сошла с уступа и падает дольше C.FALL.hold: кадр бега/стойки растворяется в позу «тянется к земле»
        Ale.drawSprite(ctx, this._holdFrame(air), x, y, Object.assign({}, so, { alpha: a * (1 - fk) }));
        Ale.drawSprite(ctx, f, x, y, Object.assign({}, so, { alpha: a * fk }));
      } else Ale.drawSprite(ctx, f, x, y, so);
      // при броске помидора (руки заняты) и в реакции на удар (руки у лица) предмет из рук не рисуется: на 0,3–0,4 с он просто убирается
      // помидор в кулаке до вылета: в кадрах замаха рука нарисована пустой
      if (this.state === 'throw' && !this.released && !this.kitAnim && C.HAND[f] && (f === 'ale_throw0' || f === 'ale_throw1')) {
        const hp = Ale.spritePoint(x, y, so, C.HAND[f][0], C.HAND[f][1]);
        Ale.drawSprite(ctx, 'pr_tomato', hp.x, hp.y, { flip: look < 0, sx, sy, alpha: a });
      }
      if (this.state === 'throw' && this.kitAnim) Ale.Kit.drawHand(ctx, this, f, x, y, so, look);       // рогатка с резинкой, дротик в кулаке, шар у колен
      const held = this.holdSprite || C.FRAME_ITEM[f];             // на кадрах «пьёт» и «говорит по телефону» предмет рисуется сам (рука на кадре пустая), даже если сценарий его в руки не давал
      if (held && this.state !== 'throw' && this.state !== 'hurt' && this.state !== 'dead') {
        // предмет — в кисти: точка кисти берётся из таблицы кадров и проходит через тот же поворот/сжатие, что и сам спрайт
        const hand = handOf(f), cfg = C.HOLD[held] || { s: 0.7, palm: { dx: 0, dy: 8, rot: 0 }, fist: { dx: 0, dy: 6, rot: 0 } };
        const pose = (f === 'ale_hold' ? cfg.palm : f === 'ale_sip' ? cfg.sip : f === 'ale_phone' ? cfg.phone : null) || cfg.fist, face = look < 0 ? -1 : 1;
        const pt = Ale.spritePoint(x, y, so, hand[0] + pose.dx, hand[1] + pose.dy);
        Ale.drawSprite(ctx, held, pt.x, pt.y, { flip: face < 0, sx: cfg.s * sx, sy: cfg.s * sy, rot: rot + pose.rot * face, alpha: a });
      }
      if (this.clipY !== undefined) ctx.restore();
      if (this.aimTarget && !this.aimTarget.dead) this._drawReticle(ctx, this.aimTarget);
    }

    // Прицел на цели: кольцо с засечками, слегка пульсирует.
    _drawReticle(ctx, e) {
      const b = e.hurtbox(), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const r = 27 + Math.sin(this.t * 8) * 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.t * 1.4);
      ctx.lineCap = 'round';
      for (const [w, c] of [[6, 'rgba(58,36,49,0.65)'], [3, 'rgba(255,96,72,0.95)']]) {
        ctx.lineWidth = w; ctx.strokeStyle = c;
        ctx.beginPath(); ctx.arc(0, 0, r, 0.15, Math.PI / 2 - 0.15); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2 + 0.15, Math.PI - 0.15); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI + 0.15, Math.PI * 1.5 - 0.15); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.5 + 0.15, Math.PI * 2 - 0.15); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(255,96,72,0.95)'; ctx.strokeStyle = 'rgba(58,36,49,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    debugDraw(ctx) {
      super.debugDraw(ctx);
      if (this.state === 'stomp' && this.st >= C.STOMP.a0 && this.st <= C.STOMP.a1) {
        const r = this.stompRect(); ctx.strokeStyle = 'rgba(255,200,0,0.95)'; ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
    }
  }

  function sc_dust(p, n, dir) { p.scene.fx.dust(p.x, p.y, n, dir, 0.9); }

  Ale.Player = Player; Player.handOf = handOf;
})();
