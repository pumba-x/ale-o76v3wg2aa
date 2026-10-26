// Сенсорное управление: две круглые кнопки «влево» / «вправо» и «присесть» слева, большой прыжок и два действия справа, «!» над прыжком, «II» в углу. Показывается при первом касании.
// Значки — src/icons.js (те же рисунки, что у клавиш в обучающих плашках); весь слой кнопок стоит на прямоугольнике игры (layout), а не на окне браузера.
//
// С 14.10.2026 (вечером) положение кнопок считается здесь, а не в CSS: `LAYOUTS` — раскладки (в долях кнопки b), `planFor` — прямоугольники кнопок в пикселях слоя для любого окна
// и любых безопасных полей. Причины: (1) игра идёт на весь экран (viewport-fit=cover): у iPhone с вырезом по бокам по 59 pt безопасной зоны (вырез Dynamic Island и скругления), а снизу 21 pt
// домашней полосы — кнопки стоят внутри них, а картина идёт до самого края; (2) владелец просит несколько вариантов расположения кнопок на выбор («легко мискликнуть между вправо и присесть,
// стрелки и прыжок крупнее, прыжок отодвинуть от „Туп лапой“ и броска»): раскладка выбирается параметром `?btn=…` (a, b, c, d; без параметра — прежняя `now`), чтобы можно было попробовать
// каждую вживую на телефоне; (3) невидимые зоны нажатия шире самих кнопок и стыкуются в щелях между соседями (`slop`): между кнопками нет «мёртвого» места и нет наложений.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const I = Ale.Input;

  // ------------------------------------------------------------------ раскладки
  // Кнопка — ['L' | 'R', x, y, s]: сторона (слева или справа от безопасного края кадра), отступ от этого края и от нижнего поля вверх, размер кнопки — всё в долях b.
  // pad — пара «влево» / «вправо» (слева; s — размер каждой, gap — щель между ними). down — «присесть» (нет — присесть жестом: провести пальцем вниз по стрелкам), jump, stomp («Туп лапой»),
  // throw (бросок: помидор, а в бою с Димасиком — выбранный предмет: значок меняет setThrowIcon), int («!» — только рядом с предметом).
  const LAYOUT_EPOCH = '2026-10-15';
  const MIN_BTN = 40;                                       // самая мелкая кнопка (px): меньше палец не берёт
  const LAYOUTS = {
    // Как было до 14.10.2026 вечером: все три кнопки справа в ряд вплотную, «присесть» сразу за «вправо».
    now: {
      name: 'Сейчас', crouch: 'right',
      pad: { x: 0, y: 0, s: 1, gap: 0.12 },
      down: ['L', 2.32, 0.05, 0.9],
      jump: ['R', 0, 0, 1.12], throw: ['R', 1.32, 0, 1], stomp: ['R', 2.52, 0, 1], int: ['R', 0.06, 1.32, 1],
    },
    // A. Ряд с разрывом: стрелки крупнее, прыжок крупнее и отодвинут от остальных на полкнопки; «присесть» — над левой стрелкой (далеко от «вправо»), на левом пальце: ↓ + прыжок вместе
    a: {
      name: 'Ряд с разрывом', crouch: 'above',
      pad: { x: 0, y: 0, s: 1.2, gap: 0.1 },
      down: ['L', 0.05, 1.48, 0.8],
      jump: ['R', 0, 0, 1.35], throw: ['R', 1.85, 0, 1], stomp: ['R', 3.1, 0, 1], int: ['R', 0.225, 1.55, 0.9],
    },
    // B. То же, но без кнопки «присесть»: присесть — провести пальцем вниз по стрелкам (кнопок меньше, пока нет рядом соседей, мисклика с «вправо» нет совсем)
    b: {
      name: 'Ряд с разрывом, присесть жестом', crouch: 'swipe',
      pad: { x: 0, y: 0, s: 1.2, gap: 0.1 },
      swipe: true,
      jump: ['R', 0, 0, 1.35], throw: ['R', 1.85, 0, 1], stomp: ['R', 3.1, 0, 1], int: ['R', 0.225, 1.55, 0.9],
    },
    // C. «Горка» — ВЫБРАНА ВЛАДЕЛЬЦЕМ 15.10.2026 («вариант C, но кнопка присесть не слева над стрелкой „влево“, а по центру над кнопками „влево“ и „вправо“»): прыжок большой в углу, бросок приподнят над щелью
    // между ним и «Туп лапой» (под пальцем — дуга, а не прямая), присесть — посередине над парой стрелок (0,85 b от края = (2,5 b ширина пары − 0,8 b кнопка) / 2)
    c: {
      name: 'Горка', crouch: 'center',
      pad: { x: 0, y: 0, s: 1.2, gap: 0.1 },
      down: ['L', 0.85, 1.48, 0.8],
      jump: ['R', 0, 0, 1.35], throw: ['R', 1.85, 0.45, 1], stomp: ['R', 3.15, 0, 1], int: ['R', 0.225, 1.55, 0.9],
    },
    // D. «Горка» без кнопки «присесть» (жестом)
    d: {
      name: 'Горка, присесть жестом', crouch: 'swipe',
      pad: { x: 0, y: 0, s: 1.2, gap: 0.1 },
      swipe: true,
      jump: ['R', 0, 0, 1.35], throw: ['R', 1.85, 0.45, 1], stomp: ['R', 3.15, 0, 1], int: ['R', 0.225, 1.55, 0.9],
    },
  };
  // Раскладка по имени из ссылки или памяти телефона: «constructor» и «toString» не раскладки (18.10.2026: ?btn=constructor ронял запуск); null — такой нет
  const lay = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(LAYOUTS, v) ? LAYOUTS[v] : null);
  const SLOP_MAX = 0.15;          // насколько зона нажатия может выходить за кнопку, в долях b (дальше — только до середины щели до соседа)

  const rectGap = (a, b) => Math.hypot(Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w))), Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h))));

  const Touch = (Ale.Touch = {
    root: null, active: false, releasers: [],
    // Где слой кнопок стоит в окне (CSS-пиксели), размер кнопки b и сколько места в правом верхнем углу кадра занимает «II» (в юнитах вида: плашка цели сдвигается влево на столько)
    box: null, b: 64, reserve: 0, rects: [],
    // Безопасные поля, которые кадр игры должен обойти (юниты вида; кадр, упирающийся в вырез или домашнюю полосу, — иначе нули) и те же в CSS-пикселях. Ставит layout; читают UI, камера и заплыв (Game.safe).
    safe: { l: 0, r: 0, t: 0, b: 0 }, ex: { l: 0, r: 0, t: 0, b: 0 },
    insetOverride: null,        // {l, r, t, b} в CSS-пикселях: `?inset=59,59,0,21` (слева, справа, сверху, снизу) — проверки и снимки на компьютере; без него поля берутся у системы (env(safe-area-inset-*))
    variant: 'c', LAYOUTS, plan: null, persist: false,          // раскладка по умолчанию — выбранная владельцем «Горка» (c)
    installHint: false,

    // Отпустить все экранные кнопки разом (окно потеряло фокус, страница ушла в фон). Если системе не удалось доставить pointerup / pointercancel (звонок, жест на iPhone),
    // у кнопки оставался устаревший номер касания: `Input.clear()` обнуляет состояние, но после следующего нажатия кнопка уже не отпускалась — героиня бежала до перезагрузки (11.10.2026)
    releaseAll() { for (const f of this.releasers) f(); },

    // Прямоугольник игры в окне и всё, что от него зависит. Чистая функция: проверки подставляют любые размеры окна.
    // Кнопка b — от высоты кадра (15 %, не меньше 46 и не больше 84 px: палец на телефоне и на планшете; на iPhone в одной вкладке 51 px, прыжок 57), поля — 0,18 b, «II» — 0,9 b, но не меньше 44 px.
    // Кнопки стоят одним рядом по низу кадра, на полосе пола (герои идут по линии на 83 % высоты кадра, пол — нижние 17 %): выше линии ничего не закрыто.
    geometry(cssW, cssH, viewW, viewH) {
      const k = Math.min(cssW / viewW, cssH / viewH), w = viewW * k, h = viewH * k;
      const b = Math.round(Ale.clamp(h * 0.15, 46, 84)), m = b * 0.18, p = Math.max(44, Math.round(b * 0.9));
      return { left: (cssW - w) / 2, top: (cssH - h) / 2, w, h, k, b, m, p, reserve: Math.ceil((p + m * 0.8 + b * 0.12) / k) };
    },

    // Безопасные поля окна в CSS-пикселях {l, r, t, b}: вырез и скругления по бокам iPhone в альбомной ориентации (59 pt у Dynamic Island), домашняя полоса снизу (21 pt).
    // Нужен viewport-fit=cover (index.html), иначе система сама ставит страницу внутрь полей и сообщает нули.
    insets() {
      const o = this.insetOverride;
      if (o) return { l: o.l || 0, r: o.r || 0, t: o.t || 0, b: o.b || 0 };
      let p = this._probe;
      if (!p) { p = this._probe = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(p); }
      const cs = getComputedStyle(p), f = (v) => parseFloat(v) || 0;
      return { l: f(cs.paddingLeft), r: f(cs.paddingRight), t: f(cs.paddingTop), b: f(cs.paddingBottom) };
    },
    // Сколько дополнительного отступа нужно у края окна: полоса системы шириной inset, а кадр игры уже отстоит от края на gap (поля «чёрных полос» вокруг кадра уже внутри неё)
    edgeExtra(inset, gap) { return Math.max(0, (inset || 0) - Math.max(0, gap || 0)); },
    _inset(side) { const i = this.insets(); return side === 'top' ? i.t : side === 'bottom' ? i.b : side === 'left' ? i.l : i.r; },

    // Ставит слой кнопок и подсказку на прямоугольник игры (зовётся из Game.resize), считает безопасные поля кадра и положение кнопок выбранной раскладки
    layout(cssW, cssH, viewW, viewH) {
      const g = this.geometry(cssW, cssH, viewW, viewH);
      const ins = this.insets();
      const ex = { l: this.edgeExtra(ins.l, g.left), r: this.edgeExtra(ins.r, cssW - g.left - g.w), t: this.edgeExtra(ins.t, g.top), b: this.edgeExtra(ins.b, cssH - g.top - g.h) };
      this.box = g; this.b = g.b; this.reserve = g.reserve; this.ex = ex;
      this.safe = { l: ex.l / g.k, r: ex.r / g.k, t: ex.t / g.k, b: ex.b / g.k };
      for (const id of ['touch', 'a2hs']) {
        const el = document.getElementById(id); if (!el) continue;
        const s = el.style; s.left = g.left + 'px'; s.top = g.top + 'px'; s.width = g.w + 'px'; s.height = g.h + 'px';
      }
      const plan = this.plan = this.planFor(this.variant, { b: g.b, m: g.m, w: g.w, h: g.h, sl: ex.l, sr: ex.r, st: ex.t, sb: ex.b }, g.k);
      this.rects = plan.rects;
      if (this.root) this._apply(plan, g);
    },

    // Прямоугольники кнопок раскладки в пикселях слоя кнопок (начало — левый верхний угол кадра игры) и те же рамки в юнитах вида с запасом в 4 юнита — их обходят облачка-подсказки
    // (UI._hintReserved). c: { b, m, w, h, sl, sr, st, sb } — размер кнопки, поле, кадр и безопасные поля в пикселях. Порядок rects прежний: пара стрелок, присесть, прыжок, «Туп лапой», бросок, «!», «II».
    planFor(variant, c, k) {
      const spec = lay(variant) || LAYOUTS.now, B = c.b, M = c.m;
      const xl = c.sl + M, xr = c.w - c.sr - M, yb = c.h - c.sb - M;
      // кнопка не мельче MIN_BTN px (в самых маленьких окнах 0,8 b — это меньше пальца); центр остаётся на месте
      const at = (a) => {
        const s0 = a[3] * B, s = Math.max(s0, MIN_BTN), cx = a[0] === 'L' ? xl + a[1] * B + s0 / 2 : xr - a[1] * B - s0 / 2, cy = yb - a[2] * B - s0 / 2;
        return { x: cx - s / 2, y: cy - s / 2, w: s, h: s };
      };
      const P = spec.pad, pa = P.s * B, pg = P.gap * B;
      const left = { x: xl + P.x * B, y: yb - P.y * B - pa, w: pa, h: pa };
      const items = { left, right: { x: left.x + pa + pg, y: left.y, w: pa, h: pa }, jump: at(spec.jump), stomp: at(spec.stomp), throw: at(spec.throw), int: at(spec.int) };
      if (spec.down) items.down = at(spec.down);
      const pz = Math.max(44, Math.round(0.9 * B));
      items.pause = { x: c.w - c.sr - 0.8 * M - pz, y: c.st + 0.8 * M, w: pz, h: pz };
      const pair = { x: left.x, y: left.y, w: items.right.x + pa - left.x, h: pa };
      // зона нажатия шире кнопки: до середины щели до ближайшего соседа, но не больше SLOP_MAX·b (рядом с краем кадра соседа нет — и зона просто SLOP_MAX)
      const solid = { pair, down: items.down, jump: items.jump, stomp: items.stomp, throw: items.throw, int: items.int, pause: items.pause };
      const slop = {};
      for (const id of Object.keys(solid)) {
        const r = solid[id]; if (!r) continue;
        let d = 1e9; for (const o of Object.keys(solid)) if (o !== id && solid[o]) d = Math.min(d, rectGap(r, solid[o]));
        slop[id] = Ale.clamp(d / 2 - 0.5, 0, SLOP_MAX * B);
      }
      const kk = k || 1, pad4 = 4;
      const u = (r) => r ? { x: r.x / kk - pad4, y: r.y / kk - pad4, w: r.w / kk + 2 * pad4, h: r.h / kk + 2 * pad4 } : { x: -1e4, y: -1e4, w: 0, h: 0 };
      const rects = [u(pair), u(items.down), u(items.jump), u(items.stomp), u(items.throw), u(items.int), u(items.pause)];
      return { variant, name: spec.name, items, pair, slop, swipe: !!spec.swipe, b: B, rects };
    },

    _apply(plan, g) {
      const el = (id) => document.getElementById(id), put = (id, r, extra) => {
        const e = el(id); if (!e) return null;
        if (!r) { e.style.display = 'none'; return e; }
        if (e.style.display === 'none') e.style.display = '';
        const s = e.style; s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px'; s.right = 'auto'; s.bottom = 'auto';
        if (extra !== undefined) s.setProperty('--slop', extra + 'px');
        return e;
      };
      this.root.style.setProperty('--b', g.b + 'px');
      const it = plan.items, sp = plan.slop;
      // пара стрелок: общая зона нажатия шире кружков сверху, слева и справа (снизу — поле и домашняя полоса)
      const pd = el('dpad'), s0 = sp.pair || 0;
      if (pd) {
        const a = it.left, bR = it.right, r = { x: a.x - s0, y: a.y - s0, w: bR.x + bR.w - a.x + 2 * s0, h: a.h + s0 };
        put('dpad', r);
        const dps = pd.querySelectorAll('.dp');
        const pos = (d, q) => { if (!d) return; const s = d.style; s.left = (q.x - r.x) + 'px'; s.top = (q.y - r.y) + 'px'; s.width = q.w + 'px'; s.height = q.h + 'px'; };
        pos(dps[0], a); pos(dps[1], bR);
        pd.dataset.split = String((a.x + a.w + (bR.x - a.x - a.w) / 2 - r.x) / r.w);           // граница «влево» / «вправо» — середина щели между кружками
        pd.dataset.swipe = plan.swipe ? '1' : '';
        pd.dataset.b = String(g.b);
      }
      put('b-down', it.down, sp.down || 0); put('b-jump', it.jump, sp.jump || 0); put('b-stomp', it.stomp, sp.stomp || 0); put('b-throw', it.throw, sp.throw || 0); put('b-int', it.int, sp.int || 0);
      const bi = el('b-int'); if (bi && !bi.classList.contains('show')) bi.style.display = '';          // «!» скрывает класс, а не стиль (см. index.html)
      put('b-pause', it.pause, sp.pause || 0);
    },

    // Выбрать раскладку кнопок (a, b, c, d или now) и перестроить слой
    setVariant(v) {
      if (!lay(v)) return false;
      this.variant = v;
      if (Ale.Game && Ale.Game.resize && Ale.Game.canvas) Ale.Game.resize();
      return true;
    },

    // Какую раскладку взять при запуске: из ссылки (`?btn=a`), иначе запомненную на телефоне (`stored`; на тестовых страницах `manual` — нет); неизвестное имя игнорируется. Чистая функция.
    variantFor(search, manual, stored) {
      const m = /[?&]btn=(\w+)/.exec(search || '');
      if (m && lay(m[1])) return m[1];
      return !manual && lay(stored) ? stored : null;
    },

    // Как приседают в выбранной раскладке: 'right' — кнопка правее стрелок, 'above' — над левой стрелкой, 'center' — над стрелками посередине, 'swipe' — провести пальцем вниз по стрелкам (тексты справки зависят от этого)
    crouchKind() { return (lay(this.variant) || LAYOUTS.now).crouch || 'right'; },

    // Выбор раскладки вживую (владелец 14.10.2026 выбирает расположение кнопок): `?btnpick=1` ставит вверху по центру полоску «Сейчас · A · B · C · D»; выбранная запоминается на этом телефоне
    _initPicker(force) {
      if ((!force && !/[?&]btnpick\b/.test(location.search)) || document.getElementById('btnpick') || !document.body) return;
      const bar = document.createElement('div'); bar.id = 'btnpick'; bar.setAttribute('role', 'group');
      for (const v of Object.keys(LAYOUTS)) {
        const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = v === 'now' ? 'Сейчас' : v.toUpperCase();
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (Ale.Audio && Ale.Audio.init) Ale.Audio.init(); this.pick(v); });
        bar.appendChild(b);
      }
      document.body.appendChild(bar); this._markPicker();
    },
    // Раскладку выбрал владелец (15.10.2026: «вариант C»): всё, что до этого запомнено на телефоне полоской ?btnpick=1, сбрасывается один раз — иначе прежний выбор побеждал бы умолчание.
    // store — localStorage (проверки подставляют свой); возвращает запомненную раскладку или null
    migrateStored(store) {
      if (store.getItem('ale-btn-epoch') !== LAYOUT_EPOCH) { store.removeItem('ale-btn'); store.setItem('ale-btn-epoch', LAYOUT_EPOCH); return null; }
      return store.getItem('ale-btn');
    },
    pick(v) {
      if (!this.setVariant(v)) return false;
      this._saveVariant(v); this._markPicker();
      if (lay(v) && lay(v).swipe && Ale.UI && Ale.UI.toast) Ale.UI.toast(Ale.T.touchPick.swipe);
      return true;
    },
    _markPicker() { const bar = document.getElementById('btnpick'); if (bar) for (const b of bar.children) b.classList.toggle('on', b.dataset.v === this.variant); },
    _saveVariant(v) { if (!this.persist) return; try { localStorage.setItem('ale-btn', v); } catch (e) { /* без хранилища */ } },

    // ------------------------------------------------------------------ защита от приближения страницы
    // Владелец 15.10.2026 (iPhone, игра во вкладке Safari): «двойной клик по месту слева приближает экран, и всё ломается; вернуть назад никак, только перезагружать». Что показал настоящий Safari
    // (симулятор iOS 27, tests/zoomprobe.html и сама игра с `?nogesture=1`): (1) приближенная страница сжимает innerWidth / innerHeight до видимой части, а окно вёрстки остаётся в
    // documentElement.clientWidth / clientHeight (см. Game.viewSize); (2) программно масштаб НЕ возвращается — ни метатег с minimum-scale = maximum-scale = 1, ни новый метатег, ни другая ширина, ни
    // перезагрузка страницы (Safari помнит масштаб пользователя), ни из касания, ни из таймера; (3) вернуть его может только сам игрок — щипком или двойным касанием.
    // Поэтому: пока страница НЕ приближена, щипок, листание и второе касание подряд (его Safari принимает за двойное касание и приближает) гасятся, как и прежде; а когда страница приближена (visualViewport.scale
    // выше 1,02), ВСЕ эти блокировки снимаются (и touch-action: none из CSS заменяется на manipulation: html.zoomed), чтобы игрок мог вернуть масштаб жестом, и сверху показывается подсказка с кнопкой
    // «Перезагрузить» (открывает ту же страницу с новым параметром: так масштаб сбрасывается; игра продолжится с последней точки).
    // Щипок двумя пальцами не приближает страницу (отмена gesturestart и touchmove); `?nogesture=1` снимает отмену — только чтобы в симуляторе получить приближенную страницу и проверить подсказку.
    blocksGestures(search) { return !/[?&]nogesture=1(&|$)/.test(search || ''); },
    _vv() { return window.visualViewport || null; },
    zoomed() { const vv = this._vv(); return !!vv && vv.scale > 1.02; },
    // Читает масштаб и, если он поменялся, переключает блокировки (класс html.zoomed) и подсказку; возвращает «приближена ли страница». Дёшево: зовётся из каждого обработчика касаний и раз в кадр.
    syncZoom() {
      const z = this.zoomed();
      if (z !== !!this._zoomOn) { this._zoomOn = z; document.documentElement.classList.toggle('zoomed', z); this._zoomHint(z); }
      else if (z) this._placeZoomHint();
      return z;
    },
    _zoomHint(on) {
      let el = document.getElementById('zoomhint');
      if (!on) { if (el) el.style.display = 'none'; return; }
      if (!el) {
        const T = Ale.T.zoom;
        el = document.createElement('div'); el.id = 'zoomhint';
        el.innerHTML = '<span></span><button type="button"></button>';
        el.firstChild.textContent = T.hint; el.lastChild.textContent = T.restart;
        el.lastChild.addEventListener('click', (e) => this.restartPage(e.timeStamp));
        document.body.appendChild(el);
      }
      el.style.display = 'flex'; this._placeZoomHint();
    },
    // Подсказка стоит в левом верхнем углу ВИДИМОЙ части и не увеличивается вместе со страницей: ширина — видимая, масштаб — обратный
    _placeZoomHint() {
      const el = document.getElementById('zoomhint'), vv = this._vv(); if (!el || !vv || el.style.display === 'none') return;
      const sc = vv.scale || 1;
      el.style.width = Math.round(vv.width * sc) + 'px'; el.style.left = vv.offsetLeft + 'px'; el.style.top = vv.offsetTop + 'px'; el.style.transform = 'scale(' + (1 / sc) + ')';
    },
    // Та же страница с новым параметром: новая загрузка сбрасывает масштаб (обычная перезагрузка его помнит)
    // Адрес для перезагрузки: тот же путь и параметры плюс zr=<метка> (прежний zr заменяется, хэш сохраняется); метку берут из времени события, а не из часов (в src/ часы запрещены проверкой «Детерминизм»)
    restartUrl(path, search, hash, stamp) {
      const q = (search || '').replace(/([?&])zr=\d*(&|$)/, (m, a, b) => (b ? a : '')).replace(/[?&]$/, '');
      return path + q + (q ? '&' : '?') + 'zr=' + Math.floor(stamp || 0) + (hash || '');
    },
    restartPage(stamp) { this._navigate(this.restartUrl(location.pathname, location.search, location.hash, stamp)); },
    _navigate(url) { location.replace(url); },
    _guardZoom() {
      let lastEnd = -1e9;
      document.addEventListener('touchend', (e) => {
        const dt = e.timeStamp - lastEnd; lastEnd = e.timeStamp;
        if (e.target && e.target.closest && e.target.closest('#install, #zoomhint, #bootfail')) return;       // гайд установки и подсказка о приближении: там нет двойного касания-приближения (touch-action), а быстрые нажатия «Дальше» не должны глотаться
        if (!this.syncZoom() && dt >= 0 && dt < 350 && e.cancelable) e.preventDefault();       // второе касание подряд: Safari не приблизит страницу двойным касанием (а у приближенной — пусть вернёт)
      }, { passive: false });
      if (this.blocksGestures(location.search)) {
        document.addEventListener('touchmove', (e) => {
          if (e.target && e.target.closest && e.target.closest('#install, #zoomhint, #bootfail')) return;          // у кнопок гайда, подсказки о приближении и экрана сбоя запуска нужен click: на iPhone палец чуть сдвигается при нажатии, и отменённый touchmove мог его отменить (18.10.2026)
          if (!this.syncZoom()) e.preventDefault();
        }, { passive: false });          // страница не листается и не приближается щипком
        for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => { if (!this.syncZoom()) e.preventDefault(); });
      } else { document.documentElement.style.touchAction = 'manipulation'; document.body.style.touchAction = 'manipulation'; }
      for (const ev of ['touchstart', 'pointerdown']) document.addEventListener(ev, () => this.syncZoom(), { passive: true, capture: true });
      const vv = this._vv(); if (vv) { vv.addEventListener('resize', () => this.syncZoom()); vv.addEventListener('scroll', () => this.syncZoom()); }
    },

    // ------------------------------------------------------------------ защита от долгого нажатия: экранная лупа и выделение
    // Владелец 15.10.2026 (iPhone): «если зажать пальцем в какое-то место, может включиться экранная лупа, которая пропадает, если отпустить палец; если её можно отключить хотя бы в приложении — стоит».
    // Это лупа выделения текста iOS: долгое нажатие на странице, где выделение не запрещено, начинает выделять «ближайший текст» (на холсте с игрой его нет, но Safari выделяет весь документ и показывает
    // лупу). Воспроизведено в симуляторе iOS 27 (настоящий Safari, tests/loupeprobe.html): на чистой странице с одним холстом лупа появляется через ≈ 1 с после касания и в журнале selectionchange
    // приходит «Range»; её гасят и `user-select: none` с `-webkit-touch-callout: none` (index.html: теперь на каждом элементе, а не только на html и body), и отмена `touchstart` — при отмене указатели
    // (pointerdown / pointerup) и touchend приходят как обычно, не приходят только mousedown и click, а игре они не нужны. Здесь — вторая защита (и события выделения, перетаскивания и контекстного меню):
    // даже там, где Safari какой-нибудь версии CSS не послушает, долгое нажатие не запустит жест. Не отменяется то, чему нужны click и выделение: кнопки и ссылки, гайд установки, подсказка о приближении,
    // выбор раскладки. У приближенной страницы касания не отменяются (вернуть масштаб может только игрок), как и с `?nogesture=1`.
    pressKeeps(el) { return !!(el && el.closest && el.closest('#install, #zoomhint, #bootfail, #btnpick, a, button, input, textarea, select, label, [contenteditable]')); },
    pressBlocked(el, search) { return this.blocksGestures(search) && !this.zoomed() && !this.pressKeeps(el); },
    // Счётчики для экрана диагностики (`?stats=1`, строка «press»): сколько было касаний и сколько из них отменено, сколько раз Safari пытался начать выделение, показать меню или поднять предмет
    press: { ts: 0, blocked: 0, sel: 0, ctx: 0, drag: 0 },
    _guardPress() {
      const stop = (kind) => (e) => { this.press[kind]++; if (e.cancelable && !this.pressKeeps(e.target)) e.preventDefault(); };
      for (const [t, kind] of [['selectstart', 'sel'], ['dragstart', 'drag'], ['contextmenu', 'ctx']]) document.addEventListener(t, stop(kind));
      document.addEventListener('touchstart', (e) => { this.press.ts++; if (e.cancelable && this.pressBlocked(e.target, location.search)) { e.preventDefault(); this.press.blocked++; } }, { passive: false });          // passive: false — Safari считает слушатели касаний на document пассивными, и отмена не сработала бы
    },

    // Где «II» стоит в кадре, в юнитах вида: центр на fromRight от правого края и y от верхнего, радиус r (заплыв рисует и ловит свою кнопку по этим числам: она совпадает с кнопкой в игре)
    pauseSpot() {
      const g = this.box, pl = this.plan; if (!g || !pl) return { fromRight: 42, y: 41, r: 25 };
      const p = pl.items.pause, r = p.w / 2 / g.k;
      return { fromRight: (g.w - (p.x + p.w / 2)) / g.k, y: (p.y + p.h / 2) / g.k, r };
    },

    init() {
      // раскладка кнопок: `?btn=…` в ссылке, иначе та, что выбрана на этом телефоне в прошлый раз (`ale-btn`); на тестовых страницах `?manual=1` ничего не запоминается и не читается
      const manual = /[?&]manual=1/.test(location.search); this.persist = !manual;
      let stored = null; if (!manual) { try { stored = this.migrateStored(localStorage); } catch (e) { /* без хранилища */ } }
      const v = this.variantFor(location.search, manual, stored);
      if (v) { this.variant = v; if (/[?&]btn=/.test(location.search)) this._saveVariant(v); }
      const ins = /[?&]inset=([-\d.,]+)/.exec(location.search);
      if (ins) { const [l, r, t, b] = ins[1].split(',').map(parseFloat); this.insetOverride = { l: l || 0, r: r || 0, t: t || 0, b: b || 0 }; }
      this._initPicker();
      this._guardZoom();
      this._guardPress();
      const root = (this.root = document.getElementById('touch'));
      if (!root) return;
      for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = Ale.Icons.svg(el.dataset.icon);
      this._initInstallHint();
      const hold = (el, act) => {
        const ids = new Set();
        const set = (on) => { I.touch[act] = on; el.classList.toggle('on', on); };
        this.releasers.push(() => { ids.clear(); el.classList.remove('on'); });
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); ids.add(e.pointerId); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ок */ } if (!I.touch[act]) I.tapped[act] = true; set(true); I.lastDevice = 'touch'; if (Ale.Audio.init) Ale.Audio.init(); });
        const up = (e) => { ids.delete(e.pointerId); if (!ids.size) set(false); };
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
      };
      for (const el of root.querySelectorAll('[data-act]')) hold(el, el.dataset.act);

      // две кнопки движения: палец можно вести между «влево» и «вправо» (слушает общая рамка, у кнопок событий нет); в раскладках без кнопки «присесть» палец, проведённый вниз, приседает
      const pad = document.getElementById('dpad');
      if (pad) {
        const SWIPE_ON = 0.6, SWIPE_OFF = 0.3;          // сколько провести вниз от места, куда лёг палец, чтобы присесть, и вернуть вверх, чтобы встать (в долях b; гистерезис)
        const apply = (e) => {
          const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, split = parseFloat(pad.dataset.split) || 0.5;
          I.touch.left = x < split - 0.02; I.touch.right = x > split + 0.02;          // между кружками щель — две сотых ширины рамки в обе стороны не нажато
          pad.classList.toggle('l', I.touch.left); pad.classList.toggle('r', I.touch.right);
          if (pad.dataset.swipe) {
            const dy = (e.clientY - (parseFloat(pad.dataset.y0) || e.clientY)) / (parseFloat(pad.dataset.b) || 60);
            const down = dy > SWIPE_ON || (I.touch.down && dy > SWIPE_OFF);
            if (down !== !!I.touch.down) { I.touch.down = down; if (down) I.tapped.down = true; }
          }
        };
        pad.addEventListener('pointerdown', (e) => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (x) { /* ок */ } pad.dataset.pid = e.pointerId; pad.dataset.y0 = e.clientY; I.lastDevice = 'touch'; if (Ale.Audio.init) Ale.Audio.init(); apply(e); });
        pad.addEventListener('pointermove', (e) => { if (String(e.pointerId) === pad.dataset.pid) apply(e); });
        const end = (e) => { if (String(e.pointerId) === pad.dataset.pid) { I.touch.left = I.touch.right = false; if (pad.dataset.swipe) I.touch.down = false; pad.classList.remove('l', 'r'); pad.dataset.pid = ''; } };
        this.releasers.push(() => { pad.classList.remove('l', 'r'); pad.dataset.pid = ''; if (pad.dataset.swipe) I.touch.down = false; });
        pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
      }
      window.addEventListener('touchstart', () => this.show(), { passive: true });
      if (this.wantsTouchUi(location.search, !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches))) this.show();
    },

    // Экранные кнопки включаются сами на экране с касаниями ((pointer: coarse)) и после первого касания; `?touch=1` включает их сразу и на компьютере: так можно посмотреть и понажимать
    // мышью новое управление в любом окне браузера (владелец 13.10.2026: в панели симулятора iPhone нельзя кликать по экрану, работают только боковые кнопки)
    wantsTouchUi(search, coarse) { return !!coarse || /[?&]touch(=1|=true|&|$)/.test(search || ''); },

    show() {
      if (this.active) return;
      this.active = true;
      I.lastDevice = 'touch';
      document.body.classList.add('touch-ui');
      if (Ale.Game && Ale.Game.resize && Ale.Game.canvas) Ale.Game.resize();     // ориентация могла быть вертикальной ещё до первого касания
    },

    // Кнопки на экране видны только в игре (не на титульном экране и не в финале).
    setPlaying(on) { if (this.playing !== on) { this.playing = on; document.body.classList.toggle('in-play', on); } },

    // Где полного набора кнопок нет (открытка, шахматы, автомат, рулетка, выбор ответа, телефон, кат-сцены), остаётся одна «II»: паузу можно поставить везде (владелец 12.10.2026)
    setPauseOnly(on) { if (this.pauseOnly !== on) { this.pauseOnly = on; document.body.classList.toggle('pause-only', on); } },

    // Знак на кнопке броска: в бою с Димасиком — выбранный предмет («@sling» рогатка, «@darts» дротики, «@bowl» шар), иначе помидор
    setThrowIcon(icon) {
      const b = document.getElementById('b-throw');
      if (!b || this.icon === icon) return;
      this.icon = icon;
      const n = Ale.Icons.nameOf(icon) || 'throw';
      if (b.dataset.icon !== n) { b.dataset.icon = n; b.innerHTML = Ale.Icons.svg(n); }
    },

    // Кнопка «!» видна только когда рядом есть с чем взаимодействовать.
    setInteract(on) {
      const b = document.getElementById('b-int');
      if (b) b.classList.toggle('show', !!on);
    },

    // Подсказка на титульном меню: как играть на весь экран. Safari на iPhone не даёт странице спрятать свои панели — убирает их только значок на экране «Домой».
    // Показывается там, где она к месту: iPhone, Safari в обычной вкладке (не значок «Домой», не браузер внутри другого приложения, не Chrome и Firefox: у них другое меню),
    // и нет сохранения (у значка «Домой» своё хранилище, сохранение из вкладки туда не переедет). ?a2hs=1 включает её для проверок.
    wantsInstallHint(ua, standalone) {
      ua = ua || '';
      return /iPhone|iPod/.test(ua) && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Telegram|Line\/|MicroMessenger/i.test(ua) && !standalone;
    },
    // Текст подсказки (владелец 14.10.2026: «надпись снизу написана по-дебильному — два вида кавычек и так далее»): раньше «Чтобы играть на весь экран: нажми [значок] и выбери «На экран „Домой“»» —
    // двоеточие после придаточного цели, вложенные кавычки двух видов. Теперь запятая и ровно одна пара кавычек вокруг названия экрана, как в справке Apple («добавить на экран «Домой»»);
    // пункт меню не цитируется дословно, поэтому надпись верна и при другом языке телефона.
    installHintHtml() { return 'Чтобы играть на весь экран, нажми ' + Ale.Icons.svg('share', '#fff6e4') + ' и добавь игру на экран «Домой»'; },
    _initInstallHint() {
      let standalone = navigator.standalone === true;
      try { if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) standalone = true; } catch (e) { /* ок */ }
      this.installHint = /[?&]a2hs\b/.test(location.search) || this.wantsInstallHint(navigator.userAgent, standalone);
      const t = document.getElementById('a2hs-t');
      if (t) t.innerHTML = Ale.Touch.installHintHtml();
    },
    setTitleHint(on) {
      on = !!on && this.installHint;
      if (this.hintShown !== on) { this.hintShown = on; document.body.classList.toggle('a2hs-show', on); }
    },
  });
})();
