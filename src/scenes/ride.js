// Скачка на Преслюкане по Парижу к аэропорту: конь скачет с постоянной скоростью, игрок только прыгает (пробел / ⬆) через яркие препятствия.
// Прыжок всегда полный (нет «обрезки» при коротком нажатии), окно для прыжка широкое, столкновение считается по сжатым прямоугольникам.
// Удар отнимает сердце (последнее остаётся), конь спотыкается и скачет дальше: пройти нельзя только сдавшись.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, RA = Ale.RideArt, Input = Ale.Input;
  const FY = 650, LEN = 26000, END = LEN - 700;
  // Прыжок: вершина ≈ 267 юн., в воздухе ≈ 0,93 с — при скорости 460 это ≈ 430 юн. пути. Над препятствием высотой 64 всадница находится ≈ 0,83 с,
  // а нужно ≈ 0,33 с (ширина препятствия + ширина коня, делённые на скорость): окно для нажатия ≈ 0,45 с у одиночных (тест «Скачка: окно для прыжка…»
  // требует не меньше 0,4 с у одиночных и 0,3 с у тесных пар). Препятствия: не выше 80 и не шире 134 (одиночные), пара — не шире 150.
  const RIDE = Ale.RIDE = { FY, LEN, END, BASE: 460, MIN: 460, MAX: 460, JUMP: 1060, G_UP: 2100, G_DOWN: 2900 };

  // ---------------------------------------------------------------- препятствие
  class Hazard extends Ale.Entity {
    constructor(o) {
      const d = Ale.RideHazards.DEFS[o.kind];
      super({ x: o.x, y: FY, w: d.w, h: d.h, z: 50, id: null });
      this.kind = o.kind; this.L = o.L; this.M = o.M; this.def = d; this.done = false;
      this.hitW = Math.round(d.w * 0.8); this.hitH = Math.round(d.h * 0.8);
    }
    hurtbox() { return { x: this.x - this.hitW / 2, y: this.y - this.hitH, w: this.hitW, h: this.hitH }; }
    smash() {
      if (this.done) return; this.done = true; this.dead = true;
      const sc = this.scene;
      sc.fx.chips(this.x, this.y - this.def.h / 2, 14, this.kind === 'cones' ? 'rgba(255,138,42,' : this.kind === 'barrel' ? 'rgba(200,60,44,' : 'rgba(200,140,80,', 1);
      sc.fx.dust(this.x, this.y, 6, 1, 1.1);
      Ale.Audio.sfx('barrel_smash');
    }
    draw(ctx) {
      const sc = this.scene, r = sc.player, L = this.L;
      A.shadow(ctx, this.x, this.y, this.def.w * 0.62, 0.36);
      ctx.drawImage(L.c, this.x - L.w / 2, this.y - L.h + 5, L.w, L.h);
      if (this.kind === 'barrier' && Math.floor(sc.time * 2.4) % 2 === 0) A.glow(ctx, this.x, this.y - this.def.h - 6, 34, 'rgba(255,210,74,', 0.7);
      // знак «!» над препятствием: заметен за секунду до него и гаснет, когда всадница рядом
      const d = this.x - (r ? r.x : 0);
      if (r && !this.done && d > 40 && d < 1150 && this.M) {
        const a = Ale.clamp((1150 - d) / 260, 0, 1) * Ale.clamp((d - 40) / 160, 0, 1);
        ctx.save(); ctx.globalAlpha = a;
        ctx.drawImage(this.M.c, this.x - this.M.w / 2, this.y - this.def.h - this.M.h - 18 + Math.sin(sc.time * 6 + this.x * 0.01) * 4, this.M.w, this.M.h);
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- всадница
  class Rider extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 110, h: 100, z: 55, id: 'ale', facing: 1 }, o));
      this.headH = 250; this.state = 'run'; this.st = 0; this.invul = 0; this.locked = false;
      this.buf = 0; this.coyote = 0; this.gallopT = 0; this.landT = 0; this.lastFrame = 0;
      this.holdSprite = null; this.deadT = 0;
    }
    get S() { return Ale.Game.state; }
    get down() { return this.state === 'dead'; }
    canInteract() { return false; }
    // Задевают только ноги и брюхо коня (не вся длина в 250 юн.): голова, хвост и всадница над препятствиями не считаются
    hurtbox() { return { x: this.x - 30, y: this.y - 92, w: 100, h: 86 }; }
    controlsOn() { return !this.locked && !this.scene.locked && this.state !== 'dead' && !Ale.Game.transitioning; }
    startle() {}
    heal(n) { const S = this.S; S.hp = Math.min(S.maxHp, S.hp + n); Ale.UI.hearts.bump = 1; }

    update(dt) {
      super.update(dt);
      const sc = this.scene, on = this.controlsOn();
      if (this.invul > 0) this.invul -= dt;
      this.st += dt;
      // прыжок: короткий буфер нажатия и «время койота» после схода с земли — нажатие чуть раньше или позже тоже засчитывается
      if (on && Input.pressed('jump')) this.buf = 0.18;
      else if (!on) this.buf = 0;
      if (this.buf > 0) this.buf -= dt;
      // скорость постоянная; при спотыкании конь почти останавливается и разгоняется заново
      let target = RIDE.BASE;
      if (this.state === 'stumble') { target = 210; if (this.st > 0.5) this.state = 'run'; }
      if (this.state === 'dead') target = 0;
      if (this.forced !== undefined) target = this.forced;
      this.vx = Ale.approach(this.vx, target, (this.state === 'stumble' ? 2200 : 520) * dt);
      if (this.onGround) this.coyote = 0.12; else this.coyote -= dt;
      if (on && this.state !== 'stumble' && this.buf > 0 && this.coyote > 0) {
        this.vy = -RIDE.JUMP; this.buf = 0; this.coyote = 0; this.onGround = false;
        sc.fx.dust(this.x - 90, this.y, 5, -1, 1.1);
        Ale.Audio.sfx('jump');
      }
      const wasGround = this.onGround, vy0 = this.vy;
      this.vy = Math.min(this.vy + (this.vy < 0 ? RIDE.G_UP : RIDE.G_DOWN) * dt, 1500);
      sc.world.move(this, dt);
      if (this.onGround && !wasGround) {
        this.landT = 0.14; sc.fx.dust(this.x - 60, this.y, 6, -1, 1.2); Ale.Audio.sfx('land', { vol: 0.5 });
      }
      if (this.landT > 0) this.landT -= dt;
      // галоп: цикл идёт по пройденному пути, копыта стучат дважды за цикл — в кадрах касания земли (задняя нога — первый кадр цикла, передняя — тринадцатый)
      this.gallopT = Ale.Mount.advance(this.gallopT, this.vx, dt);
      const fi = Ale.Mount.frameIndex(this.gallopT);
      if (fi !== this.lastFrame) {
        this.lastFrame = fi;
        const hind = fi === Ale.Mount.CONTACT[0];
        if ((hind || fi === Ale.Mount.CONTACT[1]) && this.onGround && this.vx > 150) { Ale.Audio.sfx('hoof', { vol: 0.55 + Math.min(0.4, this.vx / 1200) }); sc.fx.dust(this.x - (hind ? 96 : -70), this.y, 1, -1, 0.7); }
      }
      if (this.state === 'dead') { this.deadT += dt; if (this.deadT > 1.0 && !this.reported) { this.reported = true; Ale.Game.onPlayerDead(); } }
      if (sc.camT) sc.camT.x = this.x + 260;
      // столкновения с препятствиями
      if (this.state !== 'dead' && this.invul <= 0) {
        const b = this.hurtbox();
        for (const e of sc.entities) if (e instanceof Hazard && !e.done && Ale.overlap(b, e.hurtbox())) { this.takeHit({ src: e }); e.smash(); break; }
      }
    }

    takeHit(info) {
      if (this.state === 'dead' || this.invul > 0 || this.scene.locked) return false;
      const S = this.S;
      S.hp = Math.max(1, S.hp - 1);          // скачка — не бой: последнее сердце остаётся, конь просто спотыкается
      Ale.UI.hearts.bump = 1;
      this.invul = 1.6; this.state = 'stumble'; this.st = 0; this.deadT = 0;
      this.vy = -320; this.onGround = false;
      Ale.Game.hitstop(5);
      this.scene.camera.shake(8, 0.3);
      Ale.UI.flash('rgba(214,52,33,ALPHA)', 0.3);
      Ale.Audio.sfx('hurt');
      if (this.scene.onRiderHit) this.scene.onRiderHit();
      return true;
    }

    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      const h = Math.max(0, FY - y);
      let a = 1; if (this.invul > 0 && this.state !== 'dead') a = (Math.floor(this.t * 18) % 2) ? 0.55 : 1;
      const air = !this.onGround;
      const po = {
        phase: this.gallopT, air, vy: this.vy, stumble: this.state === 'stumble' || this.state === 'dead', landing: Math.max(0, this.landT / 0.14),
        alpha: a,
      };
      // тень: в воздухе (прыжок) и в фазе полёта галопа — короче и светлее
      const clr = air ? 0 : Ale.Mount.pose(po, x, y).clr;
      A.shadow(ctx, x, FY, 128 * (1 - Math.min(h / 300, 0.5)) * (1 - Math.min(clr / 150, 0.22)), 0.38 * (1 - Math.min(h / 300, 0.6)) * (1 - Math.min(clr / 90, 0.35)));
      // линии скорости — только у земли и сзади, не поверх коня
      if (this.vx > 400 && this.state !== 'dead') {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.26)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const ly = y - 40 - i * 30 + Math.sin(this.t * 9 + i * 2) * 3, lx = x - 120 - ((this.t * 900 + i * 173) % 90), ln = 40 + (i % 3) * 26; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - ln, ly); ctx.stroke(); }
        ctx.restore();
      }
      Ale.Mount.draw(ctx, x, y, po);
    }
  }

  // Бубел на скачке: бежит рядом, прыгает вместе с Алесей.
  class RideBubel extends Ale.Entity {
    constructor(o) { super(Object.assign({ w: 36, h: 44, z: 54, id: 'bubel' }, o)); this.headH = 70; this.phase = 0; this.lift = 0; }
    update(dt) {
      super.update(dt);
      const r = this.scene.player;
      const want = r.x - 190;
      this.x = Ale.lerp(this.x, want, Math.min(1, 6 * dt));
      this.y = FY + 34;
      this.phase += Math.max(0, r.vx) * dt / 16;
      this.up = r.vy < 0;
      this.lift = Ale.lerp(this.lift, r.onGround ? 0 : Math.min(150, (FY - r.y) * 0.85), Math.min(1, 12 * dt));
    }
    talk() {}
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    draw(ctx, alpha) {
      const x = this.rx(alpha), y = this.ry(alpha);
      A.shadow(ctx, x, y, 22, 0.3);
      const f = this.lift > 6 ? (this.up ? 'bub_jump_up' : 'bub_jump_fall') : 'bub_run' + ((Math.floor(this.phase) % 8) + 1);
      Ale.drawSprite(ctx, f, x, y, { oy: -this.lift, sx: 1.1, sy: 1.1 });
    }
  }

  // ---------------------------------------------------------------- раскладка препятствий
  // Группы: одиночные, дорожный барьер, тесные пары ящик/бочка (одним прыжком). Расстояние между группами сокращается от 1050 к 760 юнитам.
  function layout(sc, S) {
    const R = new Ale.Rng(4242), D = Ale.RideHazards.DEFS;
    const put = (kind, cx) => sc.add(new Hazard({ kind, x: cx, L: S[kind], M: S.marker }));
    const singles = ['crate', 'barrel', 'cones'], small = ['crate', 'barrel'];
    let x = 2200, n = 0;
    while (x < END - 1800) {
      const prog = x / LEN, r = R.next();
      let group;
      if (prog < 0.12) group = [R.pick(small)];
      else if (r < 0.5) group = [R.pick(singles)];
      else if (r < 0.72) group = ['barrier'];
      else if (prog > 0.2 && r < 0.9) group = [R.pick(small), R.pick(small)];
      else group = [R.pick(singles)];
      const GAP = 26;
      let span = GAP * (group.length - 1); for (const k of group) span += D[k].w;
      let cx = x + D[group[0]].w / 2;
      const xs = [];
      for (let i = 0; i < group.length; i++) { put(group[i], cx); xs.push(cx); if (i + 1 < group.length) cx += D[group[i]].w / 2 + GAP + D[group[i + 1]].w / 2; }
      // награда над каждой пятой группой: сердце на высоте прыжка. Зона подбора — 270…370 юн. над землёй, выше брюха стоящего коня (92 юн.):
      // без прыжка не достать, а прыжок с верхней точкой 267 юн., точный над препятствием, проходит сквозь неё
      if (n % 5 === 3) sc.add(new Ale.HeartPickup({ x: (xs[0] + xs[xs.length - 1]) / 2, y: FY - 270 }));
      x += span + Ale.lerp(1050, 760, prog) * R.range(0.92, 1.12);
      n++;
    }
    return n;
  }

  Ale.Scenes.ride = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'ride', width: LEN + 2400, music: 'ride', place: entry === 'start' ? Ale.T.place.ride : null });
    const W = sc.world;
    const bd = RA.build(LEN);
    W.addSolid(-400, FY, LEN + 3600, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);

    // ---- небо и фон
    const skyL = A.layer(1800, 720, (g, w, h) => Ale.StreetArt.sky(g, w, h, { stops: [[0, '#6fb0dc'], [0.5, '#bfe0e8'], [0.82, '#fbe3b0'], [1, '#f9d590']], sunX: 0.72 }), 1);
    const cloudL = A.layer(1800, 360, (g, w, h) => Ale.StreetArt.clouds(g, w, h), 1);
    // дорога: тротуар вдоль домов (y 598–640) и мостовая с разметкой
    const roadTile = A.layer(512, 720, (g) => {
      A.gradV(g, 0, 596, 512, 30, [[0, '#d8cdb8'], [1, '#c9bda4']]); A.grain(g, 0, 596, 512, 30, 0.14, 'overlay', 4);
      g.strokeStyle = 'rgba(43,26,32,0.32)'; g.lineWidth = 1.6; for (let x = 0; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 596); g.lineTo(x + 14, 626); g.stroke(); }
      A.box(g, -4, 624, 520, 12, { fill: '#a89e8a', lw: 3, hi: 'rgba(255,255,255,0.35)' });
      A.cobbles(g, 0, 636, 512, 84, { base: ['#8a8590', '#6a6474'], seed: 5, tile: true });                       // tile: плитка в 512 стыкуется сама с собой (раньше на стыке каждые 512 юн. обрезанные булыжники давали вертикальный шов)
      // осевая разметка
      g.fillStyle = 'rgba(255,240,200,0.55)'; for (let x = 20; x < 512; x += 128) g.fillRect(x, 690, 64, 5);
      g.fillStyle = A.OUT; g.fillRect(0, 594, 512, 3);
    }, 1);
    // набережная дальнего берега: каменная стенка с карнизом по верхнему краю воды (плитка в 512, стыкуется) и быки по краям реки. Раньше вода закрывала низ домов и башни голым прямоугольником:
    // башня стояла ногами в реке, под дальними домами висела светлая полоса неба, а у края реки — вертикальный срез
    const QY = 514, QH = 34, PIER_W = 30;
    const quayTile = A.layer(512, QH, (g) => {
      A.box(g, -4, 0, 520, 9, { fill: A.linG(g, 0, 0, 0, 9, [[0, '#f3e9d0'], [1, '#d8cbad']]), lw: 2.6, hi: 'rgba(255,255,255,0.45)' });
      A.gradV(g, 0, 9, 512, QH - 9, [[0, '#d2c5a6'], [0.65, '#b3a587'], [1, '#867f73']]);
      g.strokeStyle = 'rgba(60,44,34,0.42)'; g.lineWidth = 1.6;
      for (let row = 0, y = 9; y < QH; row++, y += 8.5) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); for (let x = (row % 2) * 32; x < 512; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(QH, y + 8.5)); g.stroke(); } }
      g.fillStyle = 'rgba(30,60,80,0.35)'; g.fillRect(0, QH - 4, 512, 4);                                                                  // мокрый след у воды
    }, 1.5);
    const pier = A.layer(PIER_W, 66, (g) => {
      A.box(g, 1, 12, PIER_W - 2, 54, { fill: A.linG(g, 0, 0, PIER_W, 0, [[0, '#e0d4b8'], [1, '#b9ac90']]), lw: 3, hi: 'rgba(255,255,255,0.3)' });
      g.strokeStyle = 'rgba(60,44,34,0.4)'; g.lineWidth = 1.5; for (let y = 24; y < 64; y += 12) { g.beginPath(); g.moveTo(2, y); g.lineTo(PIER_W - 2, y); g.stroke(); }
      A.box(g, -2, 2, PIER_W + 4, 12, { fill: A.linG(g, 0, 2, 0, 14, [[0, '#f6ecd4'], [1, '#d6c9ab']]), lw: 3, r: 2, hi: 'rgba(255,255,255,0.5)' });
    }, 1.5);
    sc.back.push((ctx, cam) => {
      const W_ = game.viewW, H_ = game.viewH;
      ctx.drawImage(skyL.c, 0, 0, W_, H_);
      const co = (sc.time * 8) % 1800;
      ctx.drawImage(cloudL.c, -co - cam.x * 0.03, 20, 1800, 360); ctx.drawImage(cloudL.c, 1800 - co - cam.x * 0.03, 20, 1800, 360);
      bd.back.draw(ctx, cam.x, W_);
      // река на набережной: полоса воды между дальним и ближним берегом
      const rv = bd.river[0], rx0 = rv[0], rx1 = rv[1];
      if (cam.x + W_ > rx0 - 200 && cam.x < rx1 + 200) {
        const a = Math.max(rx0 - cam.x, -100), b = Math.min(rx1 - cam.x, W_ + 100);
        const y0 = 540, y1 = 596;
        ctx.save(); ctx.beginPath(); ctx.rect(a, y0, b - a, y1 - y0); ctx.clip();
        ctx.fillStyle = A.linG(ctx, 0, y0, 0, y1, [[0, '#7fb4d4'], [1, '#4f88ac']]); ctx.fillRect(a, y0, b - a, y1 - y0);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; for (let i = 0; i < 26; i++) { const wx = ((i * 97 + sc.time * 26 + cam.x * 0.7) % (b - a + 200)) + a - 100, wy = y0 + 6 + (i * 13) % 44; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 22, wy); ctx.stroke(); }
        ctx.restore();
        // стенка дальнего берега над водой и быки у краёв реки (быки — только там, где край реки в кадре)
        ctx.save(); ctx.beginPath(); ctx.rect(a, QY - 6, b - a, QH + 12); ctx.clip();
        const q0 = -(((cam.x % 512) + 512) % 512); for (let x = q0; x < W_; x += 512) ctx.drawImage(quayTile.c, x, QY, 512, QH);
        ctx.restore();
        for (const px of [rx0 - cam.x - 8, rx1 - cam.x - PIER_W + 8]) if (px > -PIER_W - 4 && px < W_ + 4) ctx.drawImage(pier.c, px, QY - 28, PIER_W, 66);
      }
      // дорога
      const tw = 512, sx0 = -((cam.x % tw + tw) % tw);
      for (let x = sx0; x < W_; x += tw) ctx.drawImage(roadTile.c, x, 0, tw, 720);
      bd.near.draw(ctx, cam.x, W_);
    });
    sc.front.push((ctx) => { A.vignette(ctx, game.viewW, game.viewH, 0.3); drawProgress(ctx, game, sc); });

    // ---- герои
    const rider = sc.add(new Ale.Rider({ x: entry === 'mid' ? LEN * 0.5 : 300, y: FY }));
    rider.vx = RIDE.BASE * 0.55;
    sc.player = rider;
    const bubel = sc.add(new Ale.RideBubel({ x: rider.x - 150, y: FY + 34 }));
    sc.bubel = bubel;
    sc.hazardSprites = Ale.RideHazards.makeSprites();
    layout(sc, sc.hazardSprites);
    // при старте с контрольной точки убираем препятствия позади
    for (const e of sc.entities) if (e instanceof Hazard && e.x < rider.x + 500) e.dead = true;

    // камера: чуть впереди всадницы; без запаздывания
    const camT = { x: rider.x + 250, y: 600, vx: 0 };
    sc.cameraTarget = camT; sc.camT = camT; sc.camera.speed = 12;
    sc.camera.snapTo(camT.x, 600);

    Ale.RideStory.setup(sc, entry);
    return sc;
  };

  // Полоса прогресса пути: Париж → аэропорт с башней и аркой по дороге.
  function drawProgress(ctx, game, sc) {
    const r = sc.player; if (!r || sc.hideProgress) return;
    const W = game.viewW, w = Math.min(460, W - 520), x = W / 2 - w / 2, y = 30, k = Ale.clamp(r.x / LEN, 0, 1);
    ctx.save();
    Ale.rr(ctx, x - 12, y - 14, w + 24, 32, 16); ctx.fillStyle = 'rgba(40,24,38,0.7)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,220,170,0.5)'; ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,246,228,0.25)'; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + w, y + 2); ctx.stroke();
    ctx.strokeStyle = '#ffb45a'; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + w * k, y + 2); ctx.stroke();
    // вехи
    ctx.font = '600 18px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6e4';
    for (const [p, ch] of [[0.28, '🗼'], [0.86, '🏛'], [1, '✈']]) { ctx.fillText(ch, x + w * p, y + 2); }
    // конь
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3a2431'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + w * k, y + 2, 7, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  Ale.Rider = Rider; Ale.RideBubel = RideBubel; Ale.RideHazard = Hazard;
})();
