// Снаряжение для боя с Димасиком (Киев, площадка): рогатка (натянуть и отпустить), дротики для дартса, тяжёлый шар для боулинга (бросок по высокой медленной дуге).
// Действует только в этом бою: кнопка броска стреляет выбранным предметом и не тратит помидоры. Всё считается по времени симуляции (dt), без часов.
//   · рогатка — тетиву натягивают, пока зажата кнопка броска, отпустили — выстрел (владелец 03.10.2026: «слишком имбалансная: автоаим и очень быстрый fire rate»). Тяга 0…1 за 0,9 с:
//     сильная (от 0,62) — полёт почти по прямой с сильным автоприцелом (кольцо на Димасике показывает, что прицел взят), слабая — по короткой дуге вниз, без прицела; бьёт (1 единица шкалы)
//     только выстрел с тягой от 0,5, слабый просто отскакивает; после выстрела 0,28 с перезарядки. Запас неограничен;
//   · дротики — бросок раз в 1,0 с, 1 единица (было 2: владелец 03.10.2026 — «дротики слишком сильные»), ровно 8 в руках (было 6: владелец 09.10.2026 вечером «наборы по 8 штук») (настоящие дротики со стальным жалом, не игрушечные; в кофту не втыкаются —
//     отскакивают и падают), у Илюшкинса пополнение «до восьми» за 0,45 с (запас уменьшается в момент выпуска, сорванный бросок его не тратит);
//   · шар — тяжёлый, его МЕТАЮТ: с земли, подготовка 0,34 с, высокая медленная дуга (полёт ≈ 2,2 с), попасть трудно — стоять нужно на расстоянии 400…550 юн. от Димасика (пунктирная дуга и кольцо
//     на нём показывают, что бросок попадёт; пока шар в воздухе, Димасик не сходит с места, но может от него подпрыгнуть — см. dimasik.js), зато одно попадание снимает 2 единицы из 16 (в лёгком режиме из 14): восемь шаров — победа (владелец 09.10.2026 вечером: «шар должен сносить только 2 хп»).
//     Следующий шар Илюшкинс подкатывает сам через 0,9 с после броска; дойдя до Алеси, шар оказывается у неё в руках.
// Сам Kit — невидимая сущность сцены (чтобы получать update(dt) вместе с миром): scene.kit. Игрок спрашивает его через Player._wantThrow().
// Вид (с 04.10.2026, заказ 20): Алеся бросает нарисованными кадрами с пустыми руками (ale_sl0…3, ale_dart0/1, ale_ball0…2), предметы — картины prop_sling / prop_dart / prop_bowl / prop_pellet, которые игра
// рисует в точках кадра (pts в манифесте: хват и задняя кисть у рогатки, щепоть у дротика, ладони у шара); правка вида — только tools/sprites.json (ax, pts) и пересборка, числа игры не затронуты.
// Нет картин в сборке — работает прежний вид: кадры броска помидора и предметы, нарисованные кодом (kit_*).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const OUT = '#2b1a20';

  // Числа ТЗ (docs/KYIV_MONACO_SPEC.md, раздел 6; правки владельца 03.10.2026) — стартовые, проверяются ботом и игрой руками
  const KITS = (Ale.KITS = {
    slingshot: { id: 'slingshot', cooldown: 0.28, range: 760, speed: 950, g: 240, dmg: 1, ammo: Infinity, hudIcon: 'kit_sling', touch: '@sling',
      charge: { full: 0.9, lock: 0.62, min: 0.5, minHold: 0.06 } },
    darts: { id: 'darts', cooldown: 1.0, range: 850, speed: 1050, g: 110, dmg: 1, ammo: 8, hudIcon: 'kit_dart', touch: '@darts' },
    // шар: дуга задана скоростями (юн./с) и тяжестью; точка вылета — от опоры Алеси (вперёд, вверх); supplyDelay — через сколько после броска Илюшкинс катит следующий; rollSpeed — скорость подката
    // (шкала Димасика 16 единиц, в лёгком режиме 14; шар снимает 2 (владелец 09.10.2026 вечером: «шар должен сносить только 2 хп»; было 4): восемь попаданий (в лёгком режиме семь) — победа; от шара он часто уходит прыжком или перебежкой, поэтому бросков нужно заметно больше)
    bowling: { id: 'bowling', cooldown: 0, dmg: 2, ammo: 1, hudIcon: 'kit_bowl', touch: '@bowl', lob: { vx: 220, vy: -560, g: 520, r: 18, from: [52, 100] }, supplyDelay: 0.9, rollSpeed: 330 },
  });
  Ale.KIT_ORDER = ['slingshot', 'darts', 'bowling'];
  const TRANSFER = 0.45;           // передача дротиков у Илюшкинса, с

  // ---------------------------------------------------------------- картины заказа 20 (04.10.2026): кадры Алеси с пустыми руками и картинки предметов
  // Кадры (набор alesya_kit): рогатка ale_sl0…3, дротик ale_dart0/1, шар ale_ball0…2; предметы (набор fight_props): prop_sling, prop_dart, prop_bowl, prop_pellet. Нет картинок
  // (старая сборка assets) — работает прежнее: кадры ale_throw*/ale_crouch и предметы, нарисованные кодом ниже (kit_*).
  const spr = (art, old) => (Ale.Assets.sprites[art] ? art : old);
  // Именованная точка кадра или предмета из манифеста: в юнитах от опоры, x вперёд (кадры смотрят вправо), y ВВЕРХ (в манифесте ось y вниз — здесь переворачивается); null, если точки нет
  function ptOf(name, key) { const s = Ale.Assets.sprites[name], q = s && s.pts && s.pts[key]; return q ? [q[0], -q[1]] : null; }
  // Рисует картину name так, чтобы её точка local (юниты от центра картины, y вверх) оказалась в мировой точке at; o — параметры drawSprite (flip, sx, sy, rot, alpha…)
  function drawAt(ctx, name, local, at, o) {
    const d = Ale.spritePoint(0, 0, o, local[0], local[1]);
    Ale.drawSprite(ctx, name, at.x - d.x, at.y - d.y, o);
  }
  // Какие картины нужны для нарисованной анимации каждого набора
  const ART_NEED = {
    slingshot: ['ale_sl0', 'ale_sl1', 'ale_sl2', 'ale_sl3', 'prop_sling'],
    darts: ['ale_dart0', 'ale_dart1', 'prop_dart'],
    bowling: ['ale_ball0', 'ale_ball1', 'ale_ball2', 'prop_bowl'],
  };
  // Вилка в кулаке стоит прямо: хват (grip, на картине prop_sling — верх обмотки под вилкой) сидит в кулаке, кончики вилки (tipL — задний, tipR — передний) — места, куда крепится резинка.
  // Запасные числа на случай, если в манифесте у картины нет точек (юниты от центра картины, y вверх).
  const SLING_DEF = { grip: [0, -3], tipL: [-11.4, 19], tipR: [11.5, 19] };
  const FIST_R = 6.5;                // радиус круга вокруг кулака, внутри которого кадр героини рисуется поверх рукояти (рукоять торчит из кулака сверху и снизу)
  // Дротик: картина нарисована с наклоном (главная ось +11,7° — остриё чуть вверх, как на листе): при рисовании её поворачивают на DART_TILT назад, чтобы ось легла вдоль полёта;
  // ось проходит на DART_AXIS выше центра картины; в полёте картину сдвигают назад на DART_BACK, чтобы остриё касалось цели там, где засчитывается попадание (круг r = 9 вокруг точки полёта).
  const DART_TILT = 0.204, DART_AXIS = 3.1, DART_BACK = 10, DART_AIM = -0.12;           // DART_AIM — как держит в руке на замахе: остриём вперёд и чуть вверх (рад)
  // Шар в руках: центр шара относительно точки cup (середина сомкнутых ладоней) на кадре, юниты (вперёд, вверх)
  const BOWL_AT = { ale_ball0: [3, 9], ale_ball1: [3, 11] };
  // Мощность выстрела рогатки по тяге c (0…1): скорость, тяжесть, дальность и подъём ствола (рад). Слабая тяга — короткий прыжок шарика вниз, сильная — почти прямая.
  const slingParams = (c) => ({ speed: 160 + 790 * Math.pow(c, 0.9), g: 1050 - 810 * c, range: 250 + 510 * c, ang: 0.8 - 0.68 * c });
  // Анимация броска. release — секунда от начала, когда предмет вылетает; t — длительности кадров frames (общая длина каждого броска прежняя: 0,33 / 0,33 / 0,62 с).
  //   · рогатка — пока тянут тетиву, кадр берётся по тяге (chargeFrames, пороги chargeAt: прицел → тетива наполовину → полная тяга), после выстрела 0,2 с держится ale_sl3 (задняя рука раскрыта);
  //   · дротик — ale_dart0 (замах: дротик за ухом) до выпуска, потом ale_dart1 (рука вытянута);
  //   · шар — ale_ball0 (присед, шар в ладонях у колен) → ale_ball1 (разгибается, шар перед собой) → ale_ball2 (на носках, руки вскинуты: шар улетел).
  const ANIM = {
    slingshot: { type: 'slingshot', art: true, charge: true, t: [0.13, 0.2], release: 0.13, frames: ['ale_sl2', 'ale_sl3'], chargeFrames: ['ale_sl0', 'ale_sl1', 'ale_sl2'], chargeAt: [0, 0.35, 0.75], slow: 0.3 },
    darts: { type: 'darts', art: true, t: [0.13, 0.2], release: 0.13, frames: ['ale_dart0', 'ale_dart1'], slow: 0.35 },
    bowling: { type: 'bowling', art: true, t: [0.2, 0.14, 0.28], release: 0.34, frames: ['ale_ball0', 'ale_ball1', 'ale_ball2'], slow: 0.1 },
  };
  // Прежние анимации на кадрах броска помидора (запасные, если картин заказа 20 в сборке нет): у рогатки кадр 1 держится, пока тянут тетиву, у шара — присед и бросок снизу-вперёд.
  const ANIM_OLD = {
    slingshot: { type: 'slingshot', charge: true, t: [0.05, 0.08, 0.07, 0.13], release: 0.13, frames: ['ale_throw0', 'ale_throw1', 'ale_throw2', 'ale_throw3'], slow: 0.3 },
    darts: { type: 'darts', t: [0.05, 0.08, 0.07, 0.13], release: 0.13, frames: ['ale_throw0', 'ale_throw1', 'ale_throw2', 'ale_throw3'], slow: 0.35 },
    bowling: { type: 'bowling', t: [0.34, 0.1, 0.18], release: 0.34, frames: ['ale_crouch', 'ale_throw2', 'ale_throw3'], slow: 0.1 },
  };
  // Какая анимация у набора сейчас: нарисованная, если все её картины есть в сборке, иначе прежняя
  function animFor(type) { const S = Ale.Assets.sprites, need = ART_NEED[type]; return need && need.every((n) => S[n]) ? ANIM[type] : ANIM_OLD[type]; }
  // Кадр героини, пока тянут тетиву рогатки (тяга c, 0…1; t — сколько держат): нарисованные кадры — по порогам тяги, прежние — первые 0,1 с замах, дальше натяжение
  function chargeFrame(A, c, t) {
    if (A.chargeFrames) { let i = 0; for (let k = 0; k < A.chargeAt.length; k++) if (c >= A.chargeAt[k]) i = k; return A.chargeFrames[i]; }
    return A.frames[(t || 0) < 0.1 ? 0 : 1];
  }
  // Кисти Алеси по кадрам (юниты от опоры, кадр смотрит вправо): задняя — натягивает резинку / держит дротик, передняя — держит рогатку
  const BACK = { ale_throw0: [-21.5, 122.7], ale_throw1: [-45.5, 110.3], ale_throw2: [-10, 98], ale_throw3: [-10, 90] };
  const FRONT = { ale_throw0: [41.3, 81.3], ale_throw1: [47, 72.8], ale_throw2: [48.4, 101.7], ale_throw3: [47.9, 83.6] };
  const BOWL_HAND = [15, 38];      // шар в руках у колен (кадр ale_crouch: кисти на (4, 47) и (24, 47))
  const SLING_RISE = 36;           // середина рогов рогатки над передней кистью, юн.: задняя кисть в позе натяжения выше передней на 37,5 (throw1) и 41,4 (throw0), поэтому резинка идёт почти горизонтально (≤ 5°)

  // ---------------------------------------------------------------- рисунки предметов (кодом, 4 пикселя на юнит)
  function paint(name, w, h, fn) {
    const RES = 4, c = document.createElement('canvas');
    c.width = Math.round(w * RES); c.height = Math.round(h * RES);
    const g = c.getContext('2d');
    g.scale(RES, RES); g.translate(w / 2, h / 2); g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g);
    Ale.Assets.addCanvas(name, c, RES);
  }
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
  const rad = (g, x, y, r0, r1, stops, fx, fy) => { const gr = g.createRadialGradient(fx === undefined ? x : fx, fy === undefined ? y : fy, r0, x, y, r1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };

  function build() {
    // мягкий шарик рогатки: яркая губка, диаметр 15
    paint('kit_ball', 20, 20, (g) => {
      g.beginPath(); g.arc(0, 0, 7.5, 0, 6.283); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = rad(g, 0, 0, 1, 8, [[0, '#ffe9a0'], [0.55, '#ffb43a'], [1, '#e07a1e']], -2.5, -2.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(-2.6, -3, 2, 1.2, -0.6, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(120,50,10,0.25)'; for (const [x, y] of [[2, 1], [-1, 3], [3, -2]]) { g.beginPath(); g.arc(x, y, 0.8, 0, 6.283); g.fill(); }      // поры губки
    });
    // дротик для дартса, летит вправо (настоящий, не игрушечный): стальное жало справа, гранёный латунно-серебристый баррель с насечкой, тёмное древко, два пера слева (≈ 46 длиной)
    paint('kit_dart', 52, 24, (g) => {
      g.translate(-1, 0);
      // оперение «стандарт»: два пера (нижнее темнее), у каждого белая полоска у внешнего края
      const wing = (dy, c1, c2) => {
        g.beginPath(); g.moveTo(-9, dy * 1.2); g.lineTo(-13.5, dy * 9); g.lineTo(-24, dy * 9); g.lineTo(-20, dy * 1.2); g.closePath();
        g.fillStyle = lin(g, -24, 0, -9, 0, [[0, c1], [1, c2]]); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
        g.strokeStyle = 'rgba(255,246,228,0.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-14.6, dy * 7.2); g.lineTo(-22.8, dy * 7.2); g.stroke();
      };
      wing(1, '#8f1f2c', '#b02a38'); wing(-1, '#c4343f', '#e0505a');
      // древко
      g.beginPath(); g.moveTo(-11, -1.5); g.lineTo(-2.5, -1.7); g.lineTo(-2.5, 1.7); g.lineTo(-11, 1.5); g.closePath();
      g.fillStyle = lin(g, 0, -1.7, 0, 1.7, [[0, '#4a4658'], [1, '#1f1d28']]); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
      // баррель: веретено с насечкой
      g.beginPath(); g.moveTo(-3, -2.6); g.lineTo(5, -3.6); g.lineTo(11.5, -2.2); g.lineTo(11.5, 2.2); g.lineTo(5, 3.6); g.lineTo(-3, 2.6); g.closePath();
      g.fillStyle = lin(g, 0, -3.6, 0, 3.6, [[0, '#f2f1f6'], [0.35, '#bfc0cf'], [0.7, '#8d8fa4'], [1, '#5a5c70']]); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(40,40,60,0.55)'; g.lineWidth = 0.9; for (let x = -1; x <= 9.5; x += 2.1) { g.beginPath(); g.moveTo(x, -3); g.lineTo(x + 0.8, 3); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-1, -2.3); g.lineTo(9.5, -2.1); g.stroke();
      // стальное жало
      g.beginPath(); g.moveTo(11.2, -1.3); g.lineTo(23, -0.25); g.lineTo(23.6, 0); g.lineTo(23, 0.25); g.lineTo(11.2, 1.3); g.closePath();
      g.fillStyle = lin(g, 0, -1.3, 0, 1.3, [[0, '#ffffff'], [0.5, '#c9cbd8'], [1, '#8b8ea3']]); g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke();
    });
    // шар для боулинга: тёмно-синий «мрамор» с тремя отверстиями, диаметр 36
    paint('kit_bowl', 42, 42, (g) => {
      g.beginPath(); g.arc(0, 0, 18, 0, 6.283); g.lineWidth = 3.2; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = rad(g, 0, 0, 2, 19, [[0, '#6f8fe0'], [0.5, '#2f4fb0'], [1, '#162460']], -6, -7); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 18, 0, 6.283); g.clip();
      g.strokeStyle = 'rgba(210,225,255,0.22)'; g.lineWidth = 1.6;
      for (const [x0, y0, x1, y1] of [[-18, -4, 6, -18], [-14, 10, 18, -10], [-4, 18, 18, 6]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2 - 3, x1, y1); g.stroke(); }
      g.restore();
      g.fillStyle = '#0a0d24'; for (const [x, y, r] of [[3.5, -8.5, 2.6], [9.5, -4, 2.6], [3.5, -0.5, 2.1]]) { g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-8, -9, 4.4, 2.4, -0.7, 0, 6.283); g.fill();
    });
    // значок рогатки (для счётчика): вилка и резинка
    paint('kit_sling', 40, 40, (g) => {
      g.lineWidth = 7.5; g.strokeStyle = OUT; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, 2); g.moveTo(0, 2); g.lineTo(-10, -13); g.moveTo(0, 2); g.lineTo(10, -13); g.stroke();
      g.lineWidth = 4.2; g.strokeStyle = '#b9814f'; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, 2); g.moveTo(0, 2); g.lineTo(-10, -13); g.moveTo(0, 2); g.lineTo(10, -13); g.stroke();
      g.lineWidth = 2.4; g.strokeStyle = '#d6405a'; g.beginPath(); g.moveTo(-10, -13); g.lineTo(0, -5); g.lineTo(10, -13); g.stroke();
      g.beginPath(); g.arc(0, -7, 4.6, 0, 6.283); g.fillStyle = '#ffb43a'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
    });
    // гантель (снаряд Димасика), длина ≈ 56: две шестигранные «блины» и хромированная ручка
    paint('kit_dumbbell', 64, 34, (g) => {
      const wt = (cx) => {
        g.beginPath(); g.moveTo(cx - 7, -13); g.lineTo(cx + 7, -13); g.lineTo(cx + 10, 0); g.lineTo(cx + 7, 13); g.lineTo(cx - 7, 13); g.lineTo(cx - 10, 0); g.closePath();
        g.fillStyle = lin(g, cx - 9, -13, cx + 9, 13, [[0, '#6a6f80'], [0.45, '#3a3d4a'], [1, '#22242e']]); g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 5, -10); g.lineTo(cx - 7.5, 0); g.stroke();
      };
      g.beginPath(); g.rect(-22, -2.8, 44, 5.6); g.fillStyle = lin(g, 0, -3, 0, 3, [[0, '#f0f0f6'], [0.5, '#a9aab8'], [1, '#70728a']]); g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.stroke();
      wt(-22); wt(22);
    });
  }

  // ---------------------------------------------------------------- снаряды Алеси: шарик и дротик
  class KitShot extends Ale.Entity {
    // x, y — ЦЕНТР; type 'ball' | 'dart'; range — сколько юнитов пути можно пролететь; dmg 0 — слабый выстрел рогатки (отскакивает без урона)
    constructor(o) {
      super({ x: o.x, y: o.y, w: 20, h: 20, z: 63 });
      this.type = o.type; this.vx = o.vx; this.vy = o.vy; this.g = o.g; this.dmg = o.dmg; this.range = o.range; this.travel = 0;
      this.team = 'player'; this.r = o.type === 'dart' ? 9 : 8; this.rot = Math.atan2(o.vy, o.vx); this.kitShot = true;
      this.spent = false; this.spentT = 0; this.spin = 0;
    }
    hurtbox() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }
    debugDraw(ctx) { ctx.strokeStyle = 'rgba(255,0,255,0.9)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 6.283); ctx.stroke(); }

    update(dt) {
      this.t += dt;
      const sc = this.scene, boss = sc.dim;
      if (this.spent) {                                                          // попал или отскочил: отлетает назад и падает, больше ничего не задевает
        this.spentT += dt; this.vy += 1500 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.spin * dt;
        if (this.y > sc.floorY - 6 && this.vy > 0) { this.y = sc.floorY - 6; this.vy *= -0.28; this.vx *= 0.5; this.spin *= 0.4; }
        if (this.spentT > 0.75) this.dead = true;
        return;
      }
      this.vy += this.g * dt;
      const dist = Math.hypot(this.vx, this.vy) * dt, steps = Math.max(1, Math.ceil(dist / 10));
      for (let i = 0; i < steps; i++) {
        this.x += this.vx * dt / steps; this.y += this.vy * dt / steps; this.travel += dist / steps;
        if (boss && !boss.dead && boss.vulnerable && !this.dimDodged && Ale.overlap(this.hurtbox(), boss.hurtbox())) return this._hit(boss);          // dimDodged — Димасик от него уклонился: снаряд проходит мимо и его больше не задевает
        if (this.y > sc.floorY - 4 || this.travel > this.range || this.x < -50 || this.x > sc.width + 50) return this._miss();
      }
      if (this.type === 'ball') this.rot += 9 * dt; else this.rot = Math.atan2(this.vy, this.vx);
    }
    // Попадание: ни присоски, ни «втыкания» — снаряд отскакивает от кофты и падает. Слабый выстрел (dmg 0) шкалу не снимает.
    _hit(boss) {
      const sc = this.scene, dir = Math.sign(this.vx) || 1;
      let ok = false;
      if (this.dmg > 0) ok = boss.takeHit({ kind: this.type, dmg: this.dmg, dir, x: this.x, y: this.y, src: this });
      if (ok) sc.fx.sparks(this.x, this.y, 5, 'rgba(255,230,160,');
      else if (this.dmg > 0) { if (this.type === 'dart') sc.fx.sparks(this.x, this.y, 3, 'rgba(255,255,255,'); else sc.fx.ring(this.x, this.y, 22, 'rgba(255,200,120,'); }      // краткая защита: отскок без снятия шкалы
      else sc.fx.dust(this.x, this.y, 2, -dir, 0.4);                                                   // слабый выстрел: тукнул и упал
      Ale.Audio.sfx(this.type === 'dart' ? 'dart_tink' : 'soft_hit');
      this.spent = true; this.spentT = 0; this.vx = -dir * 150; this.vy = -230; this.spin = 10 * -dir;
    }
    _miss() { this.dead = true; this.scene.fx.dust(this.x, Math.min(this.y, this.scene.floorY), 2, 0, 0.5); }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha), a = this.spent ? Ale.clamp(1 - (this.spentT - 0.35) / 0.4, 0, 1) : 1;
      if (this.type === 'dart' && Ale.Assets.sprites.prop_dart) drawDart(ctx, x, y, this.rot, a);
      else Ale.drawSprite(ctx, this.type === 'dart' ? 'kit_dart' : spr('prop_pellet', 'kit_ball'), x, y, { rot: this.rot, alpha: a });
    }
  }
  // Летящий дротик (картина prop_dart): ось вдоль направления dir, остриём вперёд; картина повёрнута на DART_TILT, сдвинута назад на DART_BACK и в сторону «вниз» на DART_AXIS (в системе дротика)
  function drawDart(ctx, x, y, dir, alpha) {
    const c = Math.cos(dir), sn = Math.sin(dir);
    Ale.drawSprite(ctx, 'prop_dart', x - c * DART_BACK - sn * DART_AXIS, y - sn * DART_BACK + c * DART_AXIS, { rot: dir + DART_TILT, alpha });
  }

  // ---------------------------------------------------------------- шар: летит по высокой медленной дуге
  class LobBall extends Ale.Entity {
    // x, y — ЦЕНТР в момент вылета; dir — куда летит (к Димасику). Дуга — KITS.bowling.lob
    constructor(o) {
      const L = KITS.bowling.lob;
      super({ x: o.x, y: o.y, w: 36, h: 36, z: 64 });
      this.dir = o.dir; this.vx = o.dir * L.vx; this.vy = L.vy; this.g = L.g; this.r = L.r;
      this.rot = 0; this.state = 'fly'; this.bounces = 0; this.fade = 1; this.stateT = 0; this.bowl = true; this.lob = true; this.team = 'player';
    }
    get flying() { return this.state === 'fly' && !this.dead; }
    hurtbox() { return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }; }
    update(dt) {
      this.t += dt;
      const sc = this.scene, boss = sc.dim;
      if (this.state === 'fly') {
        if (!boss || boss.dead || boss.down) { this.state = 'spent'; this.stateT = 0; this.vx *= 0.3; return; }      // бой окончен: шар падает и исчезает без зачёта
        this.vy += this.g * dt;
        const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / 12));
        for (let i = 0; i < steps; i++) {
          this.x += this.vx * dt / steps; this.y += this.vy * dt / steps;
          if (boss.vulnerable && !this.dimDodged && Ale.overlap(this.hurtbox(), boss.hurtbox())) { this._hit(boss); return; }          // dimDodged — он отпрыгнул: шар падает мимо
          if (this.y >= sc.floorY - this.r && this.vy > 0) { this._bounce(); break; }
        }
        this.rot += this.dir * 2.6 * dt;                                                   // вращается медленно: видно, какой он тяжёлый
        return;
      }
      // отскочил / катится: останавливается и тает (опасности нет, Димасика не задевает)
      this.stateT += dt;
      this.vy += 1500 * dt; this.y += this.vy * dt;
      if (this.y > sc.floorY - this.r) { this.y = sc.floorY - this.r; this.vy = this.vy > 120 ? -this.vy * 0.25 : 0; }
      this.x += this.vx * dt; this.vx = Ale.approach(this.vx, 0, 190 * dt); this.rot += this.vx * dt / this.r;
      if (this.state === 'spent') this.fade = Ale.clamp(1 - (this.stateT - 0.5) / 0.4, 0, 1); else this.fade = Ale.clamp(1 - (this.stateT - 0.9) / 0.5, 0, 1);
      if (this.stateT > (this.state === 'spent' ? 1 : 1.5)) this.dead = true;
    }
    // Попадание: Димасик вздрагивает, шар отлетает назад. Краткая защита (0,35 с) шар не засчитывает — он отскакивает, как о стену.
    _hit(boss) {
      const sc = this.scene;
      const ok = boss.invul <= 0 && boss.takeHit({ kind: 'bowl', dmg: KITS.bowling.dmg, dir: this.dir, x: this.x, y: this.y, src: this });
      this.state = 'spent'; this.stateT = 0; this.vx = -this.dir * 190; this.vy = -330;
      Ale.Audio.sfx('ball_hit');
      sc.fx.sparks(this.x, this.y, ok ? 8 : 3, 'rgba(160,190,255,'); sc.fx.dust(this.x, this.y + 14, 3, -this.dir, 0.6); if (ok) sc.camera.shake(5, 0.2);
    }
    // Первое касание пола — тяжёлый низкий отскок (пыль, толчок камеры, глухой стук), второе — катится и останавливается
    _bounce() {
      const sc = this.scene;
      this.y = sc.floorY - this.r; this.bounces++;
      Ale.Audio.sfx('dumb_land'); sc.fx.dust(this.x, sc.floorY, 4, 0, 0.9); sc.camera.shake(3, 0.14);
      if (this.bounces >= 2 || Math.abs(this.vy) < 140) { this.state = 'roll'; this.stateT = 0; this.vy = 0; this.vx *= 0.5; }
      else { this.vy = -Math.abs(this.vy) * 0.3; this.vx *= 0.6; }
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      const h = Ale.clamp(1 - (this.scene.floorY - y) / 360, 0, 1); Ale.Art.shadow(ctx, x, this.scene.floorY + 2, 24 * (0.45 + 0.55 * h), 0.3 * h * this.fade);
      Ale.drawSprite(ctx, spr('prop_bowl', 'kit_bowl'), x, y, { rot: this.rot, alpha: this.fade });
    }
  }

  // Подкатанный Илюшкинсом шар: катится по полу к Алесе и, дойдя до неё, оказывается у неё в руках (запас = 1)
  class SupplyBall extends Ale.Entity {
    constructor(o) {
      super({ x: o.x, y: o.y, w: 36, h: 36, z: 52 });
      this.kit = o.kit; this.rot = 0; this.bowl = true; this.supply = true; this.dir = 1; this.fade = 0;
    }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    update(dt) {
      this.t += dt;
      const sc = this.scene, p = sc.player, K = KITS.bowling;
      if (!p || !this.kit.live || this.kit.type !== 'bowling') { this.dead = true; return; }
      this.fade = Math.min(1, this.fade + dt * 6);
      const dx = p.x - this.x; this.dir = Math.sign(dx) || 1;
      this.x += this.dir * K.rollSpeed * dt; this.rot += this.dir * K.rollSpeed * dt / 18;
      if (Math.floor(this.t * 12) !== Math.floor((this.t - dt) * 12)) sc.fx.dust(this.x - this.dir * 16, this.y, 1, -this.dir, 0.3);
      Ale.Audio.hold('barrel_roll', 0.22);
      if (Math.abs(p.x - this.x) < 30) {                                                  // докатился: шар в руках
        this.kit.ammo = 1; this.kit.supplying = false; this.dead = true;
        Ale.Audio.sfx('pickup'); sc.fx.sparks(p.x, p.y - 40, 4, 'rgba(160,190,255,');
      }
    }
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      Ale.Art.shadow(ctx, x, y, 22, 0.3 * this.fade);
      Ale.drawSprite(ctx, spr('prop_bowl', 'kit_bowl'), x, y - 18, { rot: this.rot, alpha: this.fade });
    }
  }

  // ---------------------------------------------------------------- сам набор
  const smooth = (t) => { t = Ale.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  class Kit extends Ale.Entity {
    // o: type, fenceX (левая граница площадки), boss: () => Dimasik | null
    constructor(o) {
      super({ x: 0, y: 0, w: 1, h: 1, z: 48, id: 'kit' });
      this.type = o.type; this.cfg = KITS[o.type]; this.fenceX = o.fenceX; this.boss = o.boss;
      this.msgCool = 0; this.live = false; this.reset();
    }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    get anim() { return animFor(this.type); }                                        // нарисованная анимация (заказ 20) или прежняя на кадрах помидора

    // Новая попытка: полный начальный запас, ничего не летит и не катится
    reset() { this.ammo = this.cfg.ammo; this.cool = 0; this.transfer = null; this.rollTimer = 0; this.supplying = false; }
    // Шар в воздухе — и с начала замаха: Димасик стоит на месте (шаг отложен), поэтому пунктир, показанный перед броском, не обманывает
    get ballActive() {
      const sc = this.scene; if (!sc) return false;
      const p = sc.player, prep = this.type === 'bowling' && p && p.state === 'throw' && p.kitAnim && p.kitAnim.type === 'bowling' && !p.released;
      return prep || sc.entities.some((e) => e instanceof LobBall && e.flying && !e.dimDodged);          // шар, от которого он уже отпрыгнул, пунктир больше не обманывает: Димасик может возвращаться на место
    }
    get maxAmmo() { return this.cfg.ammo; }
    inField(p) { return p.x >= this.fenceX; }

    update(dt) {
      this.t += dt;
      if (this.cool > 0) this.cool = Math.max(0, this.cool - dt);
      if (this.msgCool > 0) this.msgCool = Math.max(0, this.msgCool - dt);
      if (this.transfer) {
        this.transfer.t += dt;
        if (this.transfer.t >= TRANSFER) { this.ammo = this.transfer.to; this.transfer = null; Ale.Audio.sfx('pickup'); }
      }
      if (this.rollTimer > 0) { this.rollTimer -= dt; if (this.rollTimer <= 0) this._rollNext(); }
    }

    // Илюшкинс подкатывает следующий шар (в пути не больше одного, и только если шара в руках нет)
    _rollNext() {
      const sc = this.scene, ily = sc.ilya;
      if (!this.live || this.type !== 'bowling' || this.ammo >= 1 || sc.entities.some((e) => e instanceof SupplyBall && !e.dead)) return;
      sc.add(new SupplyBall({ x: ily ? ily.x + 34 : sc.player.x - 120, y: sc.floorY, kit: this }));
      if (ily) ily.bump = 0.45;
      Ale.Audio.sfx('ball_push'); this.supplying = true;
    }

    // Подсказка при отказе: не чаще раза в 8 секунд (ТЗ, раздел 2), ничего не тратится
    _nope(text) {
      if (text && this.msgCool <= 0) { Ale.UI.hint('bubel', text, 3.2); this.msgCool = 8; }
      return null;
    }

    // Нажатие «бросок». Возвращает описание анимации броска или null (ничего не потрачено).
    press(p) {
      const T = Ale.T.kyiv, boss = this.boss && this.boss();
      if (!this.live || !boss || boss.dead || boss.down) return null;                // боя нет (до начала, после победы): молча
      if (this.cool > 0 || this.transfer) return null;                               // перезарядка / идёт передача
      if (!this.inField(p)) return this._nope(T.outField);                           // из зоны пополнения атаковать нельзя
      if (this.type === 'darts' && this.ammo <= 0) return this._nope(T.noDarts);
      if (this.type === 'bowling') {
        if (this.ammo <= 0) return this._nope(this.supplying ? T.ballComing : T.noBall);
        if (!p.onGround) return this._nope(T.ballGround);
        p.facing = boss.x >= p.x ? 1 : -1;                                            // шар всегда летит к Димасику, куда бы ни смотрела героиня: разворот до замаха
      }
      if (this.type !== 'slingshot') this.cool = this.cfg.cooldown;                  // у рогатки перезарядка считается после выстрела
      return this.anim;
    }

    // Бросок сорван до выпуска (героиню задели): запас не потрачен, перезарядки нет
    cancel() { this.cool = 0; }

    // Параметры шара, если бросить его сейчас из положения p: точки дуги, попадёт ли в Димасика и где упадёт
    lobPath(p) {
      const boss = this.boss && this.boss(), sc = this.scene, L = KITS.bowling.lob;
      if (!boss || boss.dead) return null;
      const dir = boss.x >= p.x ? 1 : -1, dt = 1 / 60, bb = boss.hurtbox();
      let x = p.x + dir * L.from[0], y = p.y - L.from[1], vx = dir * L.vx, vy = L.vy, hit = false;
      const pts = [];
      for (let i = 0; i < 420; i++) {
        vy += L.g * dt; x += vx * dt; y += vy * dt; pts.push({ x, y });
        if (boss.vulnerable && x + L.r > bb.x && x - L.r < bb.x + bb.w && y + L.r > bb.y && y - L.r < bb.y + bb.h) { hit = true; break; }
        if (y >= sc.floorY - L.r && vy > 0) break;
      }
      return { pts, hit, landX: x, dir };
    }

    // Момент выпуска (кисть вышла вперёд): предмет вылетает. Если боя уже нет — ничего не вылетает и ничего не тратится. power — тяга рогатки 0…1.
    release(p, A, power) {
      const boss = this.boss && this.boss(), sc = this.scene;
      if (!this.live || !boss || boss.dead || boss.down) { this.cool = 0; return; }
      const C = this.cfg, f = p.facing;
      if (this.type === 'bowling') {
        if (this.ammo <= 0 || !p.onGround) { this.cool = 0; return; }
        const L = C.lob, dir = boss.x >= p.x ? 1 : -1;
        this.ammo = 0;
        sc.add(new LobBall({ x: p.x + dir * L.from[0], y: p.y - L.from[1], dir }));
        boss.holdStep();                                                             // пока шар в воздухе, Димасик не сходит с места: пунктир не обманывает
        this.rollTimer = C.supplyDelay; this.supplying = true;
        Ale.Audio.sfx('ball_lob');
        return;
      }
      // рогатка и дротики: из кисти вперёд; рогатка — по тяге, дротики — автоприцел как раньше
      const ox = p.x + f * 48, oy = p.y - 102;
      if (this.type === 'slingshot') {
        const Ch = C.charge, c = Ale.clamp(power == null ? 0 : power, 0, 1), P = slingParams(c);
        this.cool = C.cooldown;
        let vx = f * P.speed * Math.cos(P.ang), vy = -P.speed * Math.sin(P.ang);
        if (c >= Ch.lock) {                                                         // сильная тяга: прицел берёт Димасика (чем сильнее, тем точнее)
          const tx = boss.x, ty = boss.y - 92;
          if ((tx - ox) * f > 0 && Math.hypot(tx - ox, ty - oy) <= P.range) {
            let T0 = Math.hypot(tx - ox, ty - oy) / P.speed;
            const px = tx + boss.vx * T0;
            T0 = Math.max(0.05, Math.hypot(px - ox, ty - oy) / P.speed);
            const hx = (px - ox) / T0, hy = (ty - oy - 0.5 * P.g * T0 * T0) / T0, a = smooth((c - Ch.lock) / (1 - Ch.lock));
            vx += (hx - vx) * a; vy += (hy - vy) * a;
          }
        }
        sc.add(new KitShot({ x: ox, y: oy, vx, vy, g: P.g, type: 'ball', dmg: c >= Ch.min ? C.dmg : 0, range: P.range }));
        Ale.Audio.sfx('sling', { vol: 0.5 + 0.5 * c });
        return;
      }
      let vx = f * C.speed, vy = -30;
      const tx = boss.x, ty = boss.y - 92, dx = (tx - ox) * f;
      if (dx > 0 && Math.hypot(tx - ox, ty - oy) <= C.range) {
        // упреждение по ходу цели (шаги Димасика — 100 юн./с), траектория почти прямая, с небольшой тяжестью
        let T0 = Math.hypot(tx - ox, ty - oy) / C.speed;
        const px = tx + boss.vx * T0;
        T0 = Math.max(0.05, Math.hypot(px - ox, ty - oy) / C.speed);
        vx = (px - ox) / T0; vy = (ty - oy - 0.5 * C.g * T0 * T0) / T0;
      }
      this.ammo = Math.max(0, this.ammo - 1);                                        // запас уменьшается только в момент фактического выпуска
      sc.add(new KitShot({ x: ox, y: oy, vx, vy, g: C.g, type: 'dart', dmg: C.dmg, range: C.range }));
      Ale.Audio.sfx('dart');
    }

    // Действие у Илюшкинса: пополнение (дротики — до восьми; шар — он подкатит сам, но можно и попросить). Возвращает true, если передача началась; иначе — почему нет
    supply() {
      const T = Ale.T.kyiv;
      if (this.transfer) return { ok: false };
      if (this.type === 'slingshot') return { ok: false };
      if (this.type === 'darts') {
        if (this.ammo >= this.cfg.ammo) return { ok: false, text: T.haveDarts };
        this.transfer = { t: 0, to: this.cfg.ammo }; return { ok: true };
      }
      if (this.ammo >= 1) return { ok: false, text: T.haveBall };
      if (this.supplying) return { ok: false, text: T.ballComing };
      this._rollNext(); return { ok: this.supplying };
    }

    // Кто сейчас под прицелом (подсветка кольцом): рогатка — когда тяга достаточна для автоприцела и Димасик в дальности; дротики — Димасик впереди в пределах дальности;
    // шар — когда брошенный сейчас он попадёт
    target(p) {
      const boss = this.boss && this.boss();
      if (!this.live || !boss || boss.dead || boss.down || !boss.vulnerable || !this.inField(p)) return null;
      if (this.type === 'bowling') { if (this.ammo <= 0 || !p.onGround) return null; const path = this.lobPath(p); return path && path.hit ? boss : null; }
      if (this.type === 'slingshot') {
        const c = p.drawCharge || 0, Ch = this.cfg.charge;
        return c >= Ch.lock && (boss.x - p.x) * p.facing > 0 && Math.hypot(boss.x - p.x, boss.y - 92 - (p.y - 102)) <= slingParams(c).range ? boss : null;
      }
      if (this.type === 'darts' && this.ammo <= 0) return null;
      const dx = (boss.x - p.x) * p.facing;
      return dx > 0 && Math.hypot(boss.x - p.x, boss.y - 92 - (p.y - 102)) <= this.cfg.range ? boss : null;
    }

    // Что показывать в углу вместо счётчика помидоров
    hud() {
      const T = Ale.T.kyiv.hud, C = this.cfg;
      // значки — картины заказа 20 (prop_*), если они есть в сборке, иначе нарисованные кодом (kit_*)
      const art = (n) => !!Ale.Assets.sprites[n], bowl = art('prop_bowl') ? 'prop_bowl' : C.hudIcon;
      if (this.type === 'slingshot') return art('prop_sling') ? { sprite: 'prop_sling', scale: 0.9, text: T.sling } : { sprite: C.hudIcon, scale: 1, text: T.sling };
      if (this.type === 'darts') return { sprite: art('prop_dart') ? 'prop_dart' : C.hudIcon, scale: art('prop_dart') ? 0.8 : 0.9, rot: -0.6, text: T.darts + (this.transfer ? this.transfer.to : this.ammo), warn: this.ammo <= 0 && !this.transfer };
      if (this.ammo > 0) return { sprite: bowl, scale: 0.85, text: T.bowl + this.ammo };
      return { sprite: bowl, scale: 0.85, text: this.supplying ? T.bowlComing : T.bowlEmpty, warn: !this.supplying };
    }

    // Пунктирная дуга броска шара (пока шар в руках и бросок возможен) с посадочным кольцом на земле; золотая, если шар попадёт в Димасика
    draw(ctx) {
      const sc = this.scene, p = sc.player;
      if (!this.live || this.type !== 'bowling' || this.ammo <= 0 || !p || p.down || !p.onGround || !this.inField(p) || (p.state === 'throw' && p.released)) return;
      const path = this.lobPath(p); if (!path) return;
      const n = path.pts.length, col = path.hit ? '#ffe28a' : '#fff6e4';
      ctx.save();
      for (let i = 3; i < n; i += 4) {
        const q = path.pts[i], k = i / n;
        ctx.globalAlpha = 0.18 + 0.42 * Math.sin(Math.min(1, k * 1.15) * 1.57);
        ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, 6.283); ctx.stroke(); ctx.fill();
      }
      const last = path.pts[n - 1], pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
      ctx.globalAlpha = path.hit ? 0.9 : 0.55; ctx.translate(last.x, sc.floorY + 3); ctx.scale(1, 0.3);
      ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 28 + (path.hit ? pulse * 4 : 0), 0, 6.283); ctx.stroke();
      ctx.restore();
    }
  }

  // Предмет в руках Алеси на кадрах броска: рогатка — вилка в передней руке и резинка к задней (тянется с тягой), дротик — в заднем кулаке, шар — у колен.
  // Точки кистей проходят через тот же поворот и сжатие, что и сам спрайт героини.
  function drawHand(ctx, p, f, x, y, so, look) {
    const A = p.kitAnim; if (!A) return;
    if (A.art) drawHandArt(ctx, p, f, x, y, so, look); else drawHandOld(ctx, p, f, x, y, so, look);
  }

  // Геометрия рогатки на нарисованном кадре f (героиня в точке x, y; so — параметры её рисования, look — куда смотрит): мировые точки кулака с хватом (grip), опоры картины вилки, кончиков вилки
  // (tipA — передний, tipB — задний), покоя резинки и кармашка (back — задняя кисть кадра, null на кадре без неё). Вилка стоит прямо — поворот только тот, что у самой героини.
  function slingGeom(f, x, y, so, look) {
    const grip = ptOf(f, 'grip'); if (!grip) return null;
    const back = ptOf(f, 'back'), sp = (h) => Ale.spritePoint(x, y, so, h[0], h[1]);
    const po = { flip: look < 0, sx: so.sx, sy: so.sy, rot: so.rot };
    const gl = ptOf('prop_sling', 'grip') || SLING_DEF.grip, tl = ptOf('prop_sling', 'tipL') || SLING_DEF.tipL, tr = ptOf('prop_sling', 'tipR') || SLING_DEF.tipR;
    const fist = sp(grip), d = Ale.spritePoint(0, 0, po, gl[0], gl[1]), at = { x: fist.x - d.x, y: fist.y - d.y };
    const tip = (t) => Ale.spritePoint(at.x, at.y, po, t[0], t[1]), tipA = tip(tr), tipB = tip(tl);
    return { fist, at, po, tipA, tipB, rest: { x: (tipA.x + tipB.x) / 2, y: (tipA.y + tipB.y) / 2 + 3 }, pouch: back ? sp(back) : null };
  }

  // Нарисованная анимация (заказ 20): руки на кадрах пустые, предмет рисует игра в точках кадра (pts в манифесте).
  //   · рогатка — картина prop_sling стоит прямо, хват в передней кисти (grip), резинка тянется от кончиков вилки к задней кисти кадра (back) — кадр сам решает, насколько она натянута, кармашек с шариком
  //     prop_pellet сидит в задней кисти; кулак перерисован поверх рукояти, чтобы она торчала из него сверху и снизу;
  //   · дротик — prop_dart в щепоти поднятой руки (hold) на кадре замаха, остриём вперёд и чуть вверх;
  //   · шар — prop_bowl лежит в сомкнутых ладонях (cup) на кадрах приседа и подъёма, до выпуска.
  function drawHandArt(ctx, p, f, x, y, so, look) {
    const A = p.kitAnim, face = look < 0 ? -1 : 1, pt = (h) => Ale.spritePoint(x, y, so, h[0], h[1]);
    if (A.type === 'bowling') {
      const cup = ptOf(f, 'cup'), off = BOWL_AT[f];
      if (!p.released && cup && off) { const b = pt([cup[0] + off[0], cup[1] + off[1]]); Ale.drawSprite(ctx, 'prop_bowl', b.x, b.y, { sx: so.sx, sy: so.sy, alpha: so.alpha, rot: p.st * 3 * face }); }
      return;
    }
    if (A.type === 'darts') {
      const hold = ptOf(f, 'hold');
      if (!p.released && hold) drawAt(ctx, 'prop_dart', ptOf('prop_dart', 'hold') || [4, 4], pt(hold), { flip: face < 0, sx: so.sx, sy: so.sy, alpha: so.alpha, rot: (so.rot || 0) + (DART_AIM + DART_TILT) * face });
      return;
    }
    const g = slingGeom(f, x, y, so, look); if (!g) return;
    const charge = p.released ? 0 : Ale.clamp(p.drawCharge || 0, 0, 1), Ch = KITS.slingshot.charge, mid = (!p.released && g.pouch) ? g.pouch : g.rest;
    Ale.drawSprite(ctx, 'prop_sling', g.at.x, g.at.y, Object.assign({ alpha: so.alpha }, g.po));
    ctx.save(); ctx.globalAlpha *= so.alpha === undefined ? 1 : so.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.6 - charge * 0.8; ctx.beginPath(); ctx.moveTo(g.tipA.x, g.tipA.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(g.tipB.x, g.tipB.y); ctx.stroke();
    ctx.strokeStyle = charge >= Ch.lock ? '#ffb43a' : '#d6405a'; ctx.lineWidth = 2.6 - charge * 0.8; ctx.beginPath(); ctx.moveTo(g.tipA.x, g.tipA.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(g.tipB.x, g.tipB.y); ctx.stroke();
    ctx.restore();
    // кулак поверх рукояти: она торчит из кулака сверху и снизу, а не наклеена на него (кадр героини перерисовывается только внутри круга вокруг передней кисти)
    ctx.save(); ctx.beginPath(); ctx.arc(g.fist.x, g.fist.y, FIST_R, 0, 6.283); ctx.clip(); Ale.drawSprite(ctx, f, x, y, so); ctx.restore();
    if (!p.released) {
      Ale.drawSprite(ctx, 'prop_pellet', mid.x, mid.y, { alpha: so.alpha });
      drawRing(ctx, p, mid, charge);
    }
  }

  // Кольцо тяги вокруг кармашка: белое, с «замком прицела» золотое, на полной тяге — вспышка
  function drawRing(ctx, p, mid, charge) {
    const Ch = KITS.slingshot.charge;
    if (charge <= 0.04) return;
    ctx.save(); ctx.translate(mid.x, mid.y); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(43,26,32,0.55)'; ctx.lineWidth = 5.6; ctx.beginPath(); ctx.arc(0, 0, 13, -1.571, -1.571 + 6.283 * charge); ctx.stroke();
    ctx.strokeStyle = charge >= Ch.lock ? '#ffd45a' : '#fff6e4'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, 13, -1.571, -1.571 + 6.283 * charge); ctx.stroke();
    if (charge >= 0.999) { ctx.strokeStyle = 'rgba(255,240,170,' + (0.5 + 0.4 * Math.sin((p.drawT || 0) * 24)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 6.283); ctx.stroke(); }
    ctx.restore();
  }

  // Прежняя отрисовка на кадрах броска помидора (запасная, если картин заказа 20 нет): вилка и резинка нарисованы кодом
  function drawHandOld(ctx, p, f, x, y, so, look) {
    const A = p.kitAnim; if (!A) return;
    const face = look < 0 ? -1 : 1, pt = (h) => Ale.spritePoint(x, y, so, h[0], h[1]);
    if (A.type === 'bowling') {
      if (!p.released) { const b = pt(BOWL_HAND); Ale.drawSprite(ctx, 'kit_bowl', b.x, b.y, { sx: so.sx, sy: so.sy, alpha: so.alpha, rot: p.st * 3 * face }); }
      return;
    }
    const back = BACK[f], front = FRONT[f];
    if (!back || !front) return;
    if (A.type === 'darts') {
      if (!p.released && (f === 'ale_throw0' || f === 'ale_throw1')) { const b = pt(back); Ale.drawSprite(ctx, 'kit_dart', b.x, b.y, { flip: face < 0, sx: so.sx, sy: so.sy, alpha: so.alpha, rot: (f === 'ale_throw0' ? -0.2 : 0.1) * face }); }
      return;
    }
    // рогатка: вилка в передней руке, резинка тянется к заднему кулаку на глубину тяги, шарик — в кармашке, пока не выпущен.
    // Вилка поднята над кулаком так, что концы рогов оказываются на высоте задней кисти (SLING_RISE над передней): резинка идёт ровно вдоль выстрела, а не вниз под углом
    // (владелец 03.10.2026: «рогатка нарисована под углом вниз, пока Алеся тянет — выровнять»; в позе натяжения задняя кисть на 108…123 юн., передняя на 73…81, раньше рога были всего на 15 над кулаком).
    // Рукоять торчит из кулака вверх, как у настоящей рогатки; все точки считаются в системе кадра (вперёд / вверх от передней кисти) и проходят через тот же поворот и сжатие, что сам спрайт героини.
    const P = (dx, dy) => pt([front[0] + dx, front[1] + dy]);
    const tipA = P(6.5, SLING_RISE + 1.5), tipB = P(-4.5, SLING_RISE), base = P(0, SLING_RISE - 19), butt = P(0, -6), bk = pt(back);
    const charge = p.released ? 0 : Ale.clamp(p.drawCharge || 0, 0, 1), Ch = KITS.slingshot.charge;
    ctx.save(); ctx.globalAlpha *= so.alpha === undefined ? 1 : so.alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 8.2; ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(base.x, base.y); ctx.moveTo(base.x, base.y); ctx.lineTo(tipA.x, tipA.y); ctx.moveTo(base.x, base.y); ctx.lineTo(tipB.x, tipB.y); ctx.stroke();
    ctx.strokeStyle = '#b9814f'; ctx.lineWidth = 4.4; ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(base.x, base.y); ctx.moveTo(base.x, base.y); ctx.lineTo(tipA.x, tipA.y); ctx.moveTo(base.x, base.y); ctx.lineTo(tipB.x, tipB.y); ctx.stroke();
    const rest = { x: (tipA.x + tipB.x) / 2, y: (tipA.y + tipB.y) / 2 + 3 };
    const mid = p.released ? rest : { x: rest.x + (bk.x - rest.x) * charge, y: rest.y + (bk.y - rest.y) * charge };
    ctx.strokeStyle = charge >= Ch.lock ? '#ffb43a' : '#d6405a'; ctx.lineWidth = 2.6 - charge * 0.8; ctx.beginPath(); ctx.moveTo(tipA.x, tipA.y); ctx.lineTo(mid.x, mid.y); ctx.lineTo(tipB.x, tipB.y); ctx.stroke();
    ctx.restore();
    // кулак поверх рукояти: рукоять торчит из кулака сверху и снизу, а не наклеена на него (кадр героини перерисовывается только внутри маленького круга вокруг передней кисти)
    const fist = pt(front);
    ctx.save(); ctx.beginPath(); ctx.arc(fist.x, fist.y, 5.2, 0, 6.283); ctx.clip(); Ale.drawSprite(ctx, f, x, y, so); ctx.restore();
    if (!p.released) {
      Ale.drawSprite(ctx, 'kit_ball', mid.x, mid.y, { alpha: so.alpha });
      drawRing(ctx, p, mid, charge);
    }
  }

  Ale.Kit = Kit; Ale.Kit.build = build; Ale.Kit.drawHand = drawHand; Ale.Kit.slingGeom = slingGeom; Ale.Kit.chargeFrame = chargeFrame; Ale.Kit.animFor = animFor; Ale.Kit.ANIM = ANIM; Ale.Kit.ANIM_OLD = ANIM_OLD; Ale.Kit.ptOf = ptOf; Ale.KitShot = KitShot; Ale.LobBall = LobBall; Ale.SupplyBall = SupplyBall; Ale.Kit.TRANSFER = TRANSFER; Ale.Kit.slingParams = slingParams;
})();
