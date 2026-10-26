// Всадница на Преслюкане: конь и всадница — два отдельных слоя (листы art/retained/animations/v2/horse_tack_gallop_sheet.png и alesya_rider_sheet.png;
// между кадрами галопа достроены промежуточные по оптическому потоку — tools/interp_frames.swift, лист gen/horse_tack_x2.png; нарезка в tools/sprites.json).
//   Конь в сёдлах, без всадницы: hrs_g01…hrs_g16 — цикл галопа (нечётные достроены по потоку), hrs_top — вытянутый полёт, hrs_land — приземление,
//   hrs_stumble — споткнулся. Точка привязки всех кадров — центр седла (в листе оно стоит на одном месте, корпус не «дёргается»). Земля — на
//   GROUND_BELOW юнитов ниже седла; у каждого кадра в манифесте есть el — на сколько его самое низкое копыто выше (минус — ниже) этой линии.
//   Всадница: rdr_g1 / rdr_g2 — посадка в галопе (вторая чуть ниже, волна волос другая), rdr_up / rdr_top / rdr_land — прыжок, rdr_stumble.
//   Бёдра стоят на седле и двигаются по плавной кривой (BOB), а не повторяют мелкие различия кадров коня. Поводья рисуются кодом: от кулака
//   всадницы (точка hand кадра) к удилам коня (точка bit кадра).
// «Не летает над землёй»: в кадрах полёта копыта подняты на 30–40 юн., а корпус в листе стоит на месте. Поэтому кадр опускается так, чтобы копыта
// поднимались не выше CLR_MAX юнитов; кадры, где копыто ушло глубоко под землю, поднимаются. Сдвиг плавно меняется между кадрами и сглажен по циклу.
// Кадры полёта идут быстрее кадров опоры (WARP): в настоящем галопе фаза полёта короткая.
// Прыжок собран из кадров самого галопа: вытянутая поза полёта (top) — вверх и на вершине, при спуске — собранная (g09) и вытянутая к земле (g10);
// корпус наклоняется по вертикальной скорости (носом вверх при взлёте, вниз при спуске). Резких смен «сжатая ↔ растянутая» поза нет.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const frac = (v) => ((v % 1) + 1) % 1;
  const N = 16;
  const GAL = []; for (let i = 1; i <= N; i++) GAL.push('hrs_g' + (i < 10 ? '0' : '') + i);
  const DESC = ['hrs_top', 'hrs_g08', 'hrs_g09', 'hrs_g10'];          // спуск: вытянут → полусобран → собран → тянется к земле

  const Mount = (Ale.Mount = {
    STRIDE: 195,          // юнитов пути на один цикл галопа (при скорости 460 — ≈ 2,4 цикла в секунду)
    MIN_RATE: 150,        // на разгоне цикл идёт не медленнее, чем при этой скорости: конь никогда не «застывает» в одной позе
    GROUND_BELOW: 126,    // от центра седла до линии земли (юнитов)
    SADDLE_DX: -15,       // седло левее центра листа на 15 юнитов: опора сущности — середина коня
    BOB: { horse: 0.6, rider: 3.0 },   // вертикальный «качок» поверх сдвигов кадров (юнитов); два раза за цикл
    RIDER_AT: [2, -3],    // бёдра всадницы относительно центра седла (юнитов)
    FRAMES: N,
    // доли времени кадров цикла: кадры полёта (6–8) короче, соседние чуть короче, остальные — опора
    WARP: [1, 1, 1, 1, 1, 0.9, 0.6, 0.6, 0.6, 0.9, 1, 1, 1, 1, 1, 1],
    CONTACT: [0, 12],     // кадры, в которых копыта стучат по земле (задняя нога — 0, передняя — 12)
    HI: 16, LO: -10,      // копыта выше HI юн. над землёй кадр опускает до HI, ниже LO юн. под землёй — поднимает до LO (землю рисует полоса дороги, пара юнитов не видна)
    CLR_MAX: 20,          // и после сглаживания копыто не выше этой высоты
    // прыжок по вертикальной скорости (юн/с): взлёт −1060, вершина 0, приземление ≈ +1250
    VJ: { riderUp: -650, top1: 420, land: 1050, riderLand: 780 },
    PITCH: 0.24,          // наклон корпуса (рад) на скорости 1100 юн/с: носом вверх при взлёте, вниз при спуске

    // ------------------------------------------------------------ время цикла
    _cum: null,
    _prep() {
      if (this._cum) return;
      const W = this.WARP, tot = W.reduce((a, b) => a + b, 0); let c = 0; this._cum = []; this._len = W.map((w) => w / tot);
      for (const w of this._len) { this._cum.push(c); c += w; }
      this._cum.push(1);
    },
    // Кадр цикла и доля внутри кадра (0…1) по фазе цикла
    frameAt(phase) {
      this._prep();
      const p = frac(phase || 0);
      let i = 0; while (i < N - 1 && p >= this._cum[i + 1]) i++;
      return { i, f: (p - this._cum[i]) / this._len[i] };
    },
    frameIndex(phase) { return this.frameAt(phase).i; },
    // Прирост фазы цикла за dt при скорости v (юн/с)
    advance(phase, v, dt) { return phase + Math.max(v, v > 5 ? this.MIN_RATE : 0) * dt / this.STRIDE; },

    // ------------------------------------------------------------ сдвиг кадров галопа: копыта не висят и не тонут
    _drops: null,
    _prepDrops() {
      const S = Ale.Assets.sprites, els = GAL.map((n) => (S[n] ? S[n].el : 0));
      const raw = els.map((el) => (el > this.HI ? el - this.HI : 0) + (el < this.LO ? el - this.LO : 0));
      // лёгкое сглаживание по кругу (1-2-1): сдвиг меняется не рывком от кадра к кадру; но копыто не выше CLR_MAX даже на пике
      this._drops = raw.map((v, i) => Math.max(0.25 * raw[(i + N - 1) % N] + 0.5 * v + 0.25 * raw[(i + 1) % N], els[i] - this.CLR_MAX));
      this._els = els;
    },
    // Сдвиг вниз (юн.) и высота копыт над землёй после сдвига для фазы цикла
    gallopShift(phase) {
      if (!this._drops) this._prepDrops();
      const { i, f } = this.frameAt(phase), j = (i + 1) % N;
      const drop = this._drops[i] + (this._drops[j] - this._drops[i]) * f, el = this._els[i] + (this._els[j] - this._els[i]) * f;
      return { drop, clr: Math.max(0, el - drop) };
    },

    // Кадры «приземление» и «споткнулся» стоят на земле (конь не в воздухе), но в листе у них копыта подняты на 33 и 21 юн. над линией земли (el кадра): без сдвига конь висел над дорогой
    // и в начале приземления «подпрыгивал» на 0,14 с (владелец 11.10.2026, финальная полировка; во дворе тот же кадр — стойка «в седле на месте»). Сдвиг опускает копыта на REST_CLR юн. над дорогой.
    REST_CLR: 6,
    restShift(name) { const s = Ale.Assets.sprites[name]; return Math.max(0, ((s && s.el) || 0) - this.REST_CLR); },

    // ------------------------------------------------------------ разбор положения (без рисования — его проверяют тесты)
    // o: phase (циклы), air, vy, stumble, landing (0…1), oy, sx, sy, flip. (x, y) — опора (копыта на земле).
    pose(o, x, y) {
      o = o || {};
      const S = Ale.Assets.sprites, F = o.flip ? -1 : 1, kx = o.sx || 1, ky = o.sy || 1, V = this.VJ;
      const ph = frac(o.phase || 0), ga = this.frameAt(ph);
      let horse, rider, over = null, drop = 0, clr = 0, grounded = false, pitch = 0;
      if (o.stumble) { horse = 'hrs_stumble'; rider = 'rdr_stumble'; drop = this.restShift(horse); clr = this.REST_CLR; }
      else if (o.air) {
        const vy = o.vy || 0;
        pitch = this.PITCH * clamp(vy / 1100, -1, 1.15) * F;
        if (vy < V.top1) horse = 'hrs_top';
        else if (vy >= V.land) horse = 'hrs_land';
        else horse = DESC[clamp(Math.round((vy - V.top1) / (V.land - V.top1) * 3), 0, 3)];
        rider = vy < V.riderUp ? 'rdr_up' : vy >= V.riderLand ? 'rdr_land' : 'rdr_top';
      } else if (o.landing > 0) { horse = 'hrs_land'; rider = 'rdr_land'; drop = this.restShift(horse); clr = this.REST_CLR; }         // приземление: кадр «land» на 0,14 с, дальше галоп; копыта опущены на дорогу
      else {
        grounded = true;
        const g = this.gallopShift(ph); drop = g.drop; clr = g.clr;
        horse = GAL[ga.i]; rider = 'rdr_g1';
      }
      const w2 = ph * Math.PI * 4;                                            // два качка за цикл
      const bobH = grounded ? Math.sin(w2) * this.BOB.horse : 0, bobR = grounded ? Math.sin(w2 - 0.7) * this.BOB.rider : 0;
      if (grounded) over = ['rdr_g2', clamp((-Math.sin(w2 - 0.7) - 0.15) / 0.7, 0, 1)];     // на нижней фазе качка проступает вторая посадка
      const hx = x + F * this.SADDLE_DX * kx, hy = y - this.GROUND_BELOW * ky + (o.oy || 0) + bobH + drop * ky;
      // наклон корпуса — вокруг седла: бёдра всадницы и точки поводьев поворачиваются вместе с кадрами
      const c = Math.cos(pitch), s = Math.sin(pitch), rot = (dx, dy) => [dx * c - dy * s, dx * s + dy * c];
      const [rdx, rdy] = rot(F * this.RIDER_AT[0] * kx, this.RIDER_AT[1] * ky + bobR);
      const rx = hx + rdx, ry = hy + rdy;
      const bitP = S[horse] && S[horse].pts && S[horse].pts.bit, handP = !o.stumble && S[rider] && S[rider].pts && S[rider].pts.hand;
      const bit = bitP ? rot(F * bitP[0] * kx, bitP[1] * ky) : null, hand = handP ? rot(F * handP[0] * kx, handP[1] * ky) : null;
      return { horse, rider, over, hx, hy, rx, ry, drop, clr, pitch, bx: bit ? hx + bit[0] : null, by: bit ? hy + bit[1] : null, fx: hand ? rx + hand[0] : null, fy: hand ? ry + hand[1] : null, F };
    },
    frameNames(o) { const p = this.pose(o, 0, 0); return { horse: p.horse, rider: p.rider }; },
    frameName(o) { return this.pose(o, 0, 0).horse; },

    // ------------------------------------------------------------ рисование
    // ctx — в мировых координатах; (x, y) — опора (копыта на земле). o: см. pose + alpha, rot
    draw(ctx, x, y, o) {
      o = o || {};
      const p = this.pose(o, x, y);
      const common = { flip: o.flip, alpha: o.alpha, rot: (o.rot || 0) + p.pitch, sx: o.sx, sy: o.sy };
      Ale.drawSprite(ctx, p.horse, p.hx, p.hy, common);
      // поводья: провисающая дуга от кулака к удилам; на спотыкании всадница бросает их
      if (p.bx !== null && p.fx !== null) {
        ctx.save(); ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha; ctx.lineCap = 'round';
        const sag = 5 + Math.abs(p.bx - p.fx) * 0.08, mx = (p.bx + p.fx) / 2, my = (p.by + p.fy) / 2 + sag;
        ctx.beginPath(); ctx.moveTo(p.fx, p.fy); ctx.quadraticCurveTo(mx, my, p.bx, p.by);
        ctx.strokeStyle = '#2b1a20'; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1.7; ctx.stroke();
        ctx.restore();
      }
      Ale.drawSprite(ctx, p.rider, p.rx, p.ry, common);
      if (p.over && p.over[1] > 0.02 && Ale.Assets.sprites[p.over[0]]) Ale.drawSprite(ctx, p.over[0], p.rx, p.ry + 1.2, Object.assign({}, common, { alpha: (o.alpha === undefined ? 1 : o.alpha) * p.over[1] }));
    },
  });
})();
