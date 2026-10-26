// Ядро: холст, масштаб, цикл с фиксированным шагом 60 Гц, состояние, переходы между сценами, сохранение.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const DT = 1 / 60;
  const SAVE_KEY = 'ale-game-save-v1';

  Ale.Save = {
    read() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    write(state) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } },
    clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* режим без хранилища */ } },
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Переходы между сценами (владелец 09.10.2026: «сейчас всё происходит мгновенно, музыка переключается сразу — это звучит и выглядит плохо»): затемнение out, пауза в темноте hold,
  // проявление reveal (revealFirst — при первом входе: начало игры, продолжение, возврат на контрольную точку); управление возвращается через control долей проявления, сценарий сцены
  // начинается через scripts долей (картина уже видна). Раньше было 0,45 + 0,08 + 0,35 с и музыка менялась в миг, когда экран чёрный.
  const TRANS = { out: 0.8, hold: 0.35, reveal: 1.0, revealFirst: 1.2, control: 0.8, scripts: 0.4 };

  // Настройки игрока (не привязаны к сохранению): лёгкий режим даёт больше сердец.
  // Страницы проверок и снимков (?manual=1) настройку не читают и не пишут: прогон не зависит от прошлых прогонов и не оставляет следов в хранилище (12.10.2026: «Лёгкий режим», случайно включённый
  // одним прогоном в пауза-меню, пережил перезапуск и уронил три боевые проверки с hp = 9 вместо 5)
  const MANUAL_PAGE = /[?&]manual\b/.test(location.search);
  Ale.Settings = {
    easy: false,
    load() { if (MANUAL_PAGE) return; try { this.easy = localStorage.getItem('ale-easy') === '1'; } catch (e) { /* без хранилища */ } },
    setEasy(v) { this.easy = !!v; if (MANUAL_PAGE) return; try { localStorage.setItem('ale-easy', v ? '1' : '0'); } catch (e) { /* ок */ } },
    maxHp() { return this.easy ? 9 : 5; },
  };
  Ale.Settings.load();

  const Game = (Ale.Game = {
    DT, TRANS,
    canvas: null, ctx: null,
    cw: 0, ch: 0, dpr: 1,
    viewW: 1280, viewH: 720, k: 1, offX: 0, offY: 0,
    scene: null, state: null, checkpointState: null,
    mode: 'loading',           // loading | title | play
    loadP: 0,
    acc: 0, last: 0, alpha: 1, stepped: false, hitstopFrames: 0,
    timers: [], transitioning: false, pauseWanted: false,
    manual: false, timeScale: 1, slowT: 0,
    // Разрешение кадра: потолок числа пикселей и автоподбор (см. resize, _tuneResolution и src/quality.js). На слабых видеокартах и огромных окнах главный расход — заливка.
    // stats — экран диагностики (?stats=1 или F2): числа, которые владелец может снять скриншотом на телефоне (раздел «Экран диагностики» ниже).
    resScale: 1, maxPixels: 3.2e6, maxPixelsTouch: 3.9e6, quality: null, stats: false, realFades: false,
    // Безопасные поля кадра (юниты вида): вырез и скругления iPhone по бокам, домашняя полоса снизу; игра идёт на весь экран (viewport-fit=cover), а интерфейс стоит внутри этих полей.
    // Считает Touch.layout из resize; у обычного окна всё нули.
    safe: { l: 0, r: 0, t: 0, b: 0 },

    newState() {
      return { v: 1, scene: 'postOffice', entry: 'start', flags: {}, hp: Ale.Settings.maxHp(), maxHp: Ale.Settings.maxHp(), tomatoes: 0, deaths: 0, time: 0, kyivEquipment: '', antinOutcome: 'none', casinoStage: 'chipInBag', casinoWin: 0, casinoBet: 0, casinoSpins: 0 };
    },

    flag(k) { return !!this.state.flags[k]; },
    // Запомнить факт и после смерти (записывается и в контрольную точку): вступления не повторяются.
    remember(k) { this.state.flags[k] = true; if (this.checkpointState) this.checkpointState.flags[k] = true; },
    set(k, v) { this.state.flags[k] = v === undefined ? true : v; },

    // ------------------------------------------------------------ запуск
    boot() {
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      const q = new URLSearchParams(location.search);
      this.manual = q.has('manual');
      this.params = q;
      this.stats = this.statsAtStart(q);
      this.quality = Ale.Quality ? Ale.Quality.create() : null;
      if (this.stats && !this.manual) this._fetchBuild();
      if (q.has('walkgait') && Ale.PLAYER && Ale.PLAYER.setWalkGait) Ale.PLAYER.setWalkGait(q.get('walkgait'));          // ?walkgait=jog|joga|walk — походка для проверки руками (tests/walk_speed.html)
      if (q.has('walkanim') && Ale.PLAYER && Ale.PLAYER.setWalkVariant) Ale.PLAYER.setWalkVariant(q.get('walkanim'));          // ?walkanim=a|b|c|old — темп ходьбы для проверки руками (tests/walk_speed.html)
      this.state = this.newState();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      window.addEventListener('pageshow', () => this.resize());
      if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());       // Safari на iPhone: панель вкладок и адресная строка появляются и пропадают, а обычное resize не приходит
      this.resize();
      this._bindPointer();
      // Ушли из окна — игра сама встаёт на паузу (не в тестах с ручным временем).
      window.addEventListener('blur', () => { if (!this.manual) this.requestPause(); this._riverRelease(); });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this._riverRelease();
          this.last = 0; if (Ale.Audio.suspend) Ale.Audio.suspend(true);
          // на iPhone при сворачивании браузера blur может не прийти — ставим паузу и здесь
          if (!this.manual) this.requestPause();
        } else {
          if (Ale.Audio.suspend) Ale.Audio.suspend(false);
          if (this.quality) this.quality.hold(3);          // браузер после возвращения на вкладку ещё несколько секунд просыпается: это не медленная игра
          this._wake();          // блокировка гашения экрана снимается, когда вкладка скрыта
        }
      });
      this.frameBound = (ts) => this.frame(ts);
      Ale.Assets.load((p) => { this.loadP = p; }).then(() => this.onLoaded()).catch((e) => {
        console.error(e);
        this.loadError = String(e && e.message || e);
        if (Ale.bootGuard && !this.manual) Ale.bootGuard.show(/^Не загрузился файл/.test(this.loadError) ? this.loadError : Ale.bootGuard.message);          // надпись с кнопкой «Обновить страницу» поверх кадра (раньше — одна красная строка в углу холста); чужой текст ошибки игроку не показываем
      });
      if (!this.manual) requestAnimationFrame(this.frameBound);
      else this.render();
    },

    onLoaded() {
      const q = this.params;
      if (Ale.Items) Ale.Items.build();          // предметы и снаряды, нарисованные кодом (заменяют мелкие исходные картинки)
      if (Ale.Stain) Ale.Stain.build();
      if (Ale.Kit && Ale.Kit.build) Ale.Kit.build();       // предметы набора (рогатка, дротик, шар, гантель), нарисованные кодом
      this.mode = 'title';
      if (!this.manual && Ale.Cards) setTimeout(() => Ale.Cards.prefetchAll(), 2500);       // сюжетные картины подгружаются в фоне, пока играет заставка
      if (Ale.Title && (q.has('scene') || q.has('skiptitle'))) { Ale.Title.gateSeen = true; Ale.Title.introSeen = true; }      // проверки и прямые запуски сцен: без «Нажмите…» и без ловушки
      if (q.has('scene')) {
        this.state = this.stateFromParams(q);
        this.checkpointState = clone(this.state);
        this.enterScene(this.state.scene, this.state.entry, { instant: true });
      } else if (Ale.Title && !q.has('skiptitle')) {
        Ale.Title.enter();
      } else {
        this.startNew();
      }
    },

    // Состояние для прямого запуска по ссылке: ?scene=…&entry=…&flags=а,б&tomatoes=N[&kyivEquipment=…&casinoStage=…&casinoWin=…] (быстрый старт — tests/levels.html; проверки открывают места так же)
    stateFromParams(q) {
      const s = this.newState();
      s.scene = q.get('scene'); s.entry = Ale.safeEntry(q.get('entry'));
      for (const f of (q.get('flags') || '').split(',').filter(Boolean)) s.flags[f] = true;
      if (q.has('tomatoes')) s.tomatoes = Math.max(0, Math.floor(+q.get('tomatoes') || 0));          // ?tomatoes=abc не должно давать NaN («× NaN» на счётчике и null в сохранении)
      for (const k of ['kyivEquipment', 'antinOutcome', 'casinoStage']) if (q.has(k)) s[k] = q.get(k);               // поля состояния, без которых место не воспроизвести (набор в бою, стадия казино)
      for (const k of ['casinoWin', 'casinoBet', 'casinoSpins']) if (q.has(k)) s[k] = +q.get(k) || 0;
      return s;
    },

    // ------------------------------------------------------------ размер
    // Размер окна в CSS-пикселях. Когда страница приближена (двойное касание, щипок), Safari на iPhone сообщает в innerWidth / innerHeight размер ВИДИМОЙ части, и игра пересобиралась в крошечный кадр
    // (владелец 15.10.2026: «двойное касание приблизило экран и сломало всё, вернуть можно только перезагрузкой»; пробой на симуляторе: приближение ×1,85 → innerWidth 472 при вёрстке 874). Пока страница
    // приближена, размер берётся у вёрстки (documentElement.clientWidth / clientHeight — приближение их не трогает), а Touch сбрасывает масштаб на ближайшем касании.
    viewSize() {
      const vv = window.visualViewport, de = document.documentElement;
      if (vv && vv.scale > 1.02 && de && de.clientWidth > 0 && de.clientHeight > 0) return { w: de.clientWidth, h: de.clientHeight };
      return { w: Math.max(1, window.innerWidth), h: Math.max(1, window.innerHeight) };
    },

    // Плотность холста. Компьютер: не больше 2. Телефон: вся плотность экрана, до 3 (владелец 15.10.2026, iPhone 16e: «качество текстурок мира и персонажей заметно хуже, чем на компьютере, будто разрешение
    // ниже; кнопки — хорошее»): у экрана iPhone плотность 3, а холст был не плотнее 2, и Safari растягивал его в 1,5 раза — картинка мягкая, тогда как экранные кнопки (DOM, значки-векторы) рисуются в родном 3×.
    // Если телефон не тянет, автоподбор (src/quality.js) снижает масштаб, но не ниже пола. `?dprmax=2` возвращает прежний потолок (для сравнения снимков).
    dprCap(search) {
      const m = /[?&]dprmax=([\d.]+)/.exec(search === undefined ? location.search : search), touch = !!(Ale.Touch && Ale.Touch.active);
      let cap = m && +m[1] >= 1 ? +m[1] : (touch ? 3 : 2);
      // Пока идёт ловушка заставки (камера отъезжает от Алеси, 12,5 с), холст на телефоне не плотнее Title.INTRO_DPR: полный 3× рисовал её «очень лагучей» (владелец 17.10.2026), а автоподбор
      // (src/quality.js) в начале игры ничего не меняет. Меню после ловушки — снова в полную плотность (Title._endIntro зовёт resize).
      const T = Ale.Title;
      if (touch && this.mode === 'title' && T && T.phase === 'intro' && T.INTRO_DPR) cap = Math.min(cap, T.INTRO_DPR);          // только пока игра и правда в заставке: устаревшая фаза ловушки не должна ограничивать холст в игре
      return cap;
    },
    // Потолок числа пикселей холста: у телефона выше (все нынешние iPhone в 3× укладываются: от 2,96 Мпикс у 16e до 3,8 у Pro Max), у больших окон прежний
    pixelCap() { return Ale.Touch && Ale.Touch.active ? this.maxPixelsTouch : this.maxPixels; },

    resize() {
      const vs = this.viewSize(), cssW = vs.w, cssH = vs.h;
      let dpr = Math.min(window.devicePixelRatio || 1, this.dprCap()) * this.resScale;
      const maxPx = this.pixelCap();
      if (cssW * cssH * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (cssW * cssH));      // не больше ~3 Мпикс: браузер сам растянет холст до окна
      const cw = Math.round(cssW * dpr), ch = Math.round(cssH * dpr);
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
      this.cw = cw; this.ch = ch; this.dpr = dpr; this.cssW = cssW; this.cssH = cssH;
      this.viewH = 720;
      this.viewW = Math.round(Ale.clamp(720 * (cssW / cssH), 1000, 1700));
      this.k = Math.min(cw / this.viewW, ch / this.viewH);
      this.offX = Math.round((cw - this.viewW * this.k) / 2);
      this.offY = Math.round((ch - this.viewH * this.k) / 2);
      if (Ale.Touch && Ale.Touch.layout) Ale.Touch.layout(cssW, cssH, this.viewW, this.viewH);          // экранные кнопки — на прямоугольник игры, а не на окно; заодно считает безопасные поля
      this.safe = Ale.Touch && Ale.Touch.safe ? Ale.Touch.safe : this.safe;
      if (this.scene) this._viewScene(this.scene);
      // «Поверните экран» — только для сенсорных устройств; узкое окно на компьютере просто масштабирует игру
      this.portrait = cssH > cssW * 1.1 && !!(Ale.Touch && Ale.Touch.active);
      document.body.classList.toggle('portrait', this.portrait);
      if (this.manual && this.mode !== 'loading') this.render();
    },

    // Вид сцены: размер и безопасные поля кадра для камеры
    _viewScene(sc) { sc.camera.setView(this.viewW, this.viewH); sc.camera.setPad(this.safe.l, this.safe.r); },

    // Размер окна сверяется каждый кадр: Safari на iPhone меняет высоту страницы (вкладки, панель, возврат из переключателя вкладок), не всегда присылая resize; игра оставалась
    // со старым размером, а кнопки (они лежат по настоящему окну) — вне картинки (владелец 12.10.2026: «кнопки выходят за края экрана игры»; на симуляторе: вкладку закрыли, страница
    // выросла с 292 до 338 px, игра осталась в 292)
    _watchSize() { if (Ale.Touch && Ale.Touch.syncZoom) Ale.Touch.syncZoom(); const vs = this.viewSize(); if (vs.w !== this.cssW || vs.h !== this.cssH) this.resize(); },

    // Координаты касания → координаты вида.
    toView(clientX, clientY) {
      return { x: (clientX * this.dpr - this.offX) / this.k, y: (clientY * this.dpr - this.offY) / this.k };
    },

    _bindPointer() {
      this.canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') Ale.Input.lastDevice = 'touch';
        if (Ale.Audio.init) Ale.Audio.init();
        try { this.canvas.setPointerCapture(e.pointerId); } catch (x) { /* ок */ }     // ползунок в меню можно вести и за краем окна
        const p = this.toView(e.clientX, e.clientY);
        this._statsTap(p.x, p.y, e.timeStamp);
        Ale.UI.pointer(p.x, p.y);
        if (Ale.River && Ale.River.busy && !Ale.UI.menu && !Ale.UI.help && (this._riverPid === undefined || !(Ale.River.session && Ale.River.session.pointerOn))) { this._riverPid = e.pointerId; Ale.River.pointerDown(p.x, p.y); }          // заплыв: палец или мышь ведут корягу (один указатель: второй палец не перехватывает управление и не отпускает первый)
        if (Ale.Title && this.mode === 'title') Ale.Title.pointer(p.x, p.y);
      });
      this.canvas.addEventListener('pointermove', (e) => { if (Ale.UI.menu && Ale.UI.menu.drag !== undefined) Ale.UI.pointerMove(this.toView(e.clientX, e.clientY).x); if (Ale.River && Ale.River.busy && e.pointerId === this._riverPid) { const p = this.toView(e.clientX, e.clientY); Ale.River.pointerMove(p.x, p.y); } });
      for (const ev of ['pointerup', 'pointercancel']) this.canvas.addEventListener(ev, (e) => { Ale.UI.pointerUp(); if (Ale.River && (this._riverPid === undefined || e.pointerId === this._riverPid)) { this._riverPid = undefined; Ale.River.pointerUp(); } });
      this.canvas.addEventListener('lostpointercapture', (e) => { if (this._riverPid !== undefined && e.pointerId === this._riverPid) this._riverRelease(); });          // палец, который ведёт корягу, потерян без pointerup (системный жест, сворачивание): бревно не остаётся «в руке» навсегда (18.10.2026)
      for (const ev of ['touchend', 'click']) window.addEventListener(ev, () => { if (Ale.Audio.init) Ale.Audio.init(); this._wake(); }, { passive: true });
      window.addEventListener('keydown', (e) => { if (Ale.Audio.init) Ale.Audio.init(); this._wake(); if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey) this.toggleFullscreen(); });
    },

    // Отпустить указатель, который ведёт корягу в заплыве (потеря фокуса, сворачивание, потеря захвата): иначе при потерянном pointerup все следующие касания игнорировались бы
    _riverRelease() { this._riverPid = undefined; if (Ale.River && Ale.River.pointerUp) Ale.River.pointerUp(); },

    // ------------------------------------------------------------ цикл
    frame(ts) {
      try {
        const now = ts / 1000;
        this._watchSize();
        if (!this.last) this.last = now;
        const raw = now - this.last;
        let dt = Math.min(0.25, raw);
        this.last = now;
        if (!this.manual) { this._ftPush(raw); this._tuneResolution(raw); }
        if (this.slowT > 0) { this.slowT -= dt; dt *= this.timeScale; if (this.slowT <= 0) this.timeScale = 1; }
        this.acc += dt;
        let n = 0;
        while (this.acc >= DT && n < 6) { this.step(); this.acc -= DT; n++; }
        if (n === 6) this.acc = 0;
        this.alpha = this.stepped ? this.acc / DT : 1;
        try { this.render(); } catch (e) { try { const c = this.canvas; c.width = c.width; } catch (x) { /* ок */ } throw e; }          // исключение посреди рисования оставляет незакрытые save(), прозрачность и режим смешивания: переприсвоение размера сбрасывает состояние холста (11.10.2026)
        this.errStreak = 0;
        this._syncTouch();
      } catch (e) {
        // одна сбойная кадровая ошибка не должна навсегда останавливать игру
        this.errors = (this.errors || 0) + 1;
        if (this.errors < 20) console.error(e);
        this.errStreak = (this.errStreak || 0) + 1;
        // если ошибка повторяется каждый кадр, игра не «зависает»: откатываемся к последней контрольной точке
        if (this.errStreak === 12 && this.checkpointState && this.mode === 'play') { this.transitioning = false; try { this.restartFromCheckpoint(false); } catch (x) { console.error(x); } }
        // откат не помог (или игра ещё на заставке и откатывать нечего): ≈ 2,5 с сплошных ошибок — надпись с кнопкой «Обновить страницу» вместо вечного чёрного экрана при работающих звуке и таймерах (18.10.2026)
        if (this.errStreak === 150 && Ale.bootGuard) Ale.bootGuard.show('Что-то пошло не так. Обнови страницу: игра продолжится с последней контрольной точки.');
      }
      requestAnimationFrame(this.frameBound);
    },

    // Автоподбор разрешения (правила и причины — в шапке src/quality.js): устойчивая медленная работа → холст на 15 % меньше, плавная → обратно; разовые подвисания не в счёт.
    // Пока играет заставка, подбор не работает: считается только игра (mode 'play').
    _tuneResolution(raw) {
      const q = this.quality;
      if (!q || this.mode !== 'play') return;
      q.floor = Ale.Touch && Ale.Touch.active ? q.cfg.floorTouch : q.cfg.floorWide;
      const s = q.frame(raw);
      if (s !== null && Math.abs(s - this.resScale) > 1e-6) { this.resScale = s; this.resize(); }
    },

    // Экран не гаснет, пока идёт игра (владелец 14.10.2026: «оптимизировать под iPhone 14 Pro»): на iPhone он по умолчанию гаснет через 30 секунд без касаний, а заплыв, подводки, титры и долгие разговоры
    // идут без касаний — вместе с экраном замолкал бы и звук. Блокировку (Screen Wake Lock) браузер снимает сам, когда вкладка скрыта или телефон заблокирован; берётся заново на первом же жесте и при
    // возвращении на вкладку. Без касания страницы браузер её не даёт — поэтому просим на каждом жесте, пока не получили. На страницах проверок и без поддержки в браузере — ничего не делает.
    _wake() {
      if (this.manual || this._wakeLock || this._wakeBusy || !navigator.wakeLock || document.hidden) return;
      this._wakeBusy = true;
      let req; try { req = navigator.wakeLock.request('screen'); } catch (e) { this._wakeBusy = false; return; }
      Promise.resolve(req).then((l) => {
        this._wakeBusy = false; this._wakeLock = l || null;
        if (l && l.addEventListener) l.addEventListener('release', () => { if (this._wakeLock === l) this._wakeLock = null; });
      }).catch(() => { this._wakeBusy = false; });
    },

    // ------------------------------------------------------------ экран диагностики
    // ?stats=1 (или F2) рисует поверх игры числа: размер окна и холста, плотность, масштаб разрешения и что решал автоподбор, интервалы кадров, состояние звука, память слоёв.
    // Нужен, чтобы на настоящем телефоне увидеть, почему картинка то чёткая, то мягкая: владелец присылает скриншот, и цифры видны. Счётчики кадров ведутся всегда (дёшево).
    _ftPush(raw) {
      if (!(raw > 0)) return;
      const r = this._ft || (this._ft = { buf: new Float32Array(300), n: 0, i: 0, c50: 0, c100: 0, c250: 0, scenes: {} });
      r.buf[r.i] = raw; r.i = (r.i + 1) % r.buf.length; if (r.n < r.buf.length) r.n++;
      const id = this.scene ? this.scene.id : (this.mode === 'title' && Ale.Title ? 'title:' + Ale.Title.phase : '-'), s = r.scenes[id] || (r.scenes[id] = { c50: 0, c100: 0, c250: 0, n: 0, sum: 0 });
      s.n++; s.sum += raw;                                       // кадров и секунд в группе: по ним видно средний fps ловушки заставки, когда она уже кончилась
      if (raw > 0.05) {
        r.c50++; s.c50++;
        if (raw > 0.1) { r.c100++; s.c100++; }
        if (raw > 0.25) { r.c250++; s.c250++; }
      }
    },
    // Включён ли экран диагностики при запуске: ?stats=1 включает, ?stats=0 выключает; без параметра — как запомнил скрытый жест (_statsTap), кроме страниц проверок
    statsAtStart(q) {
      if (q.has('stats')) return q.get('stats') !== '0';
      if (this.manual) return false;
      try { return localStorage.getItem('ale-stats') === '1'; } catch (e) { return false; }
    },
    // Скрытый жест для разбора на телефоне: пять касаний подряд (между первым и последним не дольше трёх секунд) в левом верхнем углу кадра включают и выключают экран диагностики —
    // ярлык «Домой» не нужно пересоздавать с ?stats=1. Выбор запоминается (кроме страниц проверок): цифры остаются на экране и при следующем запуске.
    _statsTap(x, y, t) {
      if (x < -4 || y < -4 || x > 140 || y > 110) { this._stTaps = null; return false; }
      const a = (this._stTaps = (this._stTaps || []).filter((v) => t - v < 3000)); a.push(t);
      if (a.length < 5) return false;
      this._stTaps = null; this.stats = !this.stats;
      if (this.stats && !this.manual) this._fetchBuild();
      if (!this.manual) { try { localStorage.setItem('ale-stats', this.stats ? '1' : '0'); } catch (e) { /* без хранилища */ } }
      return true;
    },
    _fetchBuild() {       // сервер разработки отдаёт /__build (коммит и «грязное» дерево); выкладка (tools/make_site.py) кладёт тот же файл __build рядом с index.html — на хостинге игра лежит в подпапке, поэтому второй адрес относительный; нет ни того, ни другого — подпись пустая
      if (this._buildAsked) return; this._buildAsked = true;
      const ask = (urls) => {
        if (!urls.length) return;
        fetch(urls[0], { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => { if (j && j.commit) this._build = j.commit + (j.dirty ? '+' : ''); else ask(urls.slice(1)); }).catch(() => ask(urls.slice(1)));
      };
      try { ask(['/__build', '__build']); } catch (e) { /* без fetch */ }
    },
    statsLines() {
      const r = this._ft, q = this.quality, A = Ale.Audio, pool = Ale.Art.poolSize();
      const sorted = r ? Array.from(r.buf.subarray(0, r.n)).sort((a, b) => a - b) : [];
      const pick = (p) => sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 1000).toFixed(1) : '-';
      const sc = r && this.scene ? r.scenes[this.scene.id] : null;
      const ios = /OS (\d+)[_.](\d+)/.exec(navigator.userAgent || '');
      const standalone = !!(navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
      const ctx = A && A.ctx, ins = Ale.Touch && Ale.Touch.insets ? Ale.Touch.insets() : { l: 0, r: 0, t: 0, b: 0 }, sf = this.safe || { l: 0, r: 0, t: 0, b: 0 };
      const insets = [ins.l, ins.r, ins.t, ins.b], safe = [sf.l, sf.r, sf.t, sf.b];
      const lines = [
        'ale ' + (this._build || '?') + '  ' + (this.scene ? this.scene.id : this.mode) + '  ' + this.mode + (ios ? '  ios ' + ios[1] + '.' + ios[2] : ''),
        'css ' + this.cssW + 'x' + this.cssH + '  dpr ' + this.dpr.toFixed(2) + '/' + (window.devicePixelRatio || 1) + '  cv ' + this.cw + 'x' + this.ch + '  k ' + this.k.toFixed(3) + '  view ' + this.viewW,
        'res ' + this.resScale.toFixed(2) + (q ? '  floor ' + q.floor + '  ' + (q.locked ? 'LOCKED' : 'auto') + '  slow ' + q.slow + ' fast ' + q.fast + '  win ' + (q.last ? (q.last.median * 1000).toFixed(1) + '/' + (q.last.p90 * 1000).toFixed(1) : '-') : ''),
        'dt p50 ' + pick(0.5) + '  p95 ' + pick(0.95) + '  max ' + pick(1) + '   >50:' + (r ? r.c50 : 0) + ' >100:' + (r ? r.c100 : 0) + ' >250:' + (r ? r.c250 : 0) + (sc ? '  scene ' + sc.c50 + '/' + sc.c100 + '/' + sc.c250 : ''),
        (() => { const ti = r && r.scenes['title:intro']; return ti && ti.n ? 'intro ' + ti.n + ' fr  avg ' + (ti.sum / ti.n * 1000).toFixed(1) + 'ms (' + (ti.n / ti.sum).toFixed(0) + ' fps)  >50:' + ti.c50 + ' >100:' + ti.c100 + ' >250:' + ti.c250 + '  cv ' + (this._introCv || '-') : null; })(),          // ловушка заставки: сколько кадров, средний fps и подвисания — видно и после неё; cv — размер холста в ловушке
        'audio ' + (ctx ? ctx.state : 'none') + '  sess ' + (navigator.audioSession ? navigator.audioSession.type : 'none') + '  silent ' + (A && A.silent ? 1 : 0) + '  vol ' + (A ? A.vol.music + '/' + A.vol.sfx : '-') + '  music ' + (A && A.current || '-'),          // sess — тип звукового сеанса страницы (playback: звук идёт и при беззвучном режиме iPhone)
        'layers ' + pool.layers + '/' + pool.megapixels + 'Mpx  touch ' + (Ale.Touch && Ale.Touch.active ? 1 : 0) + '  standalone ' + (standalone ? 1 : 0) + '  zoom ' + (window.visualViewport ? window.visualViewport.scale.toFixed(2) : '-') + '  secure ' + (window.isSecureContext ? 1 : 0),
        (() => { const pr = Ale.Touch && Ale.Touch.press || { ts: 0, blocked: 0, sel: 0, ctx: 0, drag: 0 }; return 'press ' + pr.ts + '/' + pr.blocked + '  sel ' + pr.sel + ' ctx ' + pr.ctx + ' drag ' + pr.drag; })(),          // касаний / из них отменено; попытки Safari выделить, показать меню, поднять предмет (долгое нажатие)
        'ins ' + insets.map((v) => Math.round(v)).join('/') + 'pt  safe ' + safe.map((v) => Math.round(v)).join('/') + 'u  btn ' + (Ale.Touch ? Ale.Touch.variant : '-'),          // безопасные поля окна (слева/справа/сверху/снизу): что сообщает система и что осталось кадру игры
      ];
      if (q) for (const e of q.log.slice(-3)) lines.push('t=' + e.t.toFixed(0) + 's ' + e.text);
      return lines.filter((l) => l !== null);
    },
    _drawStats(ctx) {
      const lines = this.statsLines(), fs = 14, lh = 18, w = Math.min(this.viewW - 20, 720), h = lines.length * lh + 10;
      const x = Math.round((this.viewW - w) / 2), y = this.viewH - h - 6;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(x, y, w, h);
      ctx.font = fs + 'px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#9cff9c'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((s, i) => ctx.fillText(s, x + 8, y + 6 + i * lh, w - 16));
      ctx.restore();
    },

    // Замедление времени на dur реальных секунд (эффектный финальный удар).
    slow(scale, dur) { this.timeScale = scale; this.slowT = dur; },

    toggleFullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement) d.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); } catch (e) { /* не везде доступно */ }
    },

    // Для автотестов: n шагов симуляции подряд и один кадр отрисовки.
    advance(n, renderAfter) {
      for (let i = 0; i < n; i++) this.step();
      this.alpha = 1;
      if (renderAfter !== false) this.render();
    },

    after(sec, fn) { this.timers.push({ t: sec, fn }); },

    step() {
      Ale.Input.update(this.hitstopFrames > 0 && !Ale.UI.modal);
      for (const t of this.timers) t.t -= DT;
      if (this.timers.some((t) => t.t <= 0)) {
        const due = this.timers.filter((t) => t.t <= 0);
        this.timers = this.timers.filter((t) => t.t > 0);
        for (const t of due) t.fn();
      }
      this.stepped = false;
      if (this.mode === 'loading') return;
      if (this.portrait) { if (Ale.UI && Ale.UI._rvHold) Ale.UI._rvHold(!!(Ale.River && Ale.River.busy)); return; }          // телефон в вертикальном положении: закрыт подсказкой «поверните», игра стоит (и звук заплыва — с ней: музыка шла бы дальше и уехала от долей)
      if (this.mode === 'title') { Ale.Title.update(DT); Ale.UI.update(DT); return; }
      // Пауза — везде в игре (владелец 12.10.2026): и в мире, и поверх разговора, замка, телефона, открытки, шахмат, автомата, рулетки, титров, снимка и заплыва. В мире клавишу никто другой не ждёт —
      // пауза открывается сразу; поверх окон сначала окно берёт «назад» (Esc в замке, на выбранной шахматной фигуре, в ставке автомата — и гасит нажатие), что осталось — пауза. Нажали посреди затемнения
      // между сценами — пауза откроется, когда оно кончится (смена сцены закрыла бы меню под руками). Меню, которое уже было открыто в начале шага (Esc его закрыл), паузу не открывает.
      const uiBusy = !!(Ale.UI.menu || Ale.UI.help);
      let pauseKey = !uiBusy && Ale.Input.pressed('pause');
      if (pauseKey && !Ale.UI.modal) { this.pauseWanted = true; pauseKey = false; }
      Ale.UI.update(DT);
      if (pauseKey && Ale.Input.pressed('pause')) this.pauseWanted = true;
      if (this.pauseWanted && !this.transitioning) { this.pauseWanted = false; if (this._pausable()) this.openPause(); }
      if (Ale.UI.modal || !this.scene) return;
      if (this.hitstopFrames > 0) { this.hitstopFrames--; return; }
      this.state.time += DT;
      this.scene.update(DT);
      this.stepped = true;
    },

    hitstop(frames) { this.hitstopFrames = Math.max(this.hitstopFrames, frames); },

    render() {
      const ctx = this.ctx;
      // Качество 'low' (билинейное): 'high' с десятками слоёв-холстов на кадр стоит в разы дороже (на скачке ~17 мс против 0,5 мс на слабой машине).
      // Спрайты героев рисуются из готовых картинок и включают 'high' сами (см. Ale.drawSprite).
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';          // сбойный слой мог оставить прозрачность и режим смешивания
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0810';
      ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.setTransform(this.k, 0, 0, this.k, this.offX, this.offY);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, this.viewW, this.viewH); ctx.clip();
      if (this.mode === 'loading') {
        if (this.loadError) { ctx.fillStyle = '#1b1420'; ctx.fillRect(0, 0, this.viewW, this.viewH); ctx.fillStyle = '#f88'; ctx.font = '24px sans-serif'; ctx.fillText(this.loadError, 40, 80); }
        else Ale.UI.drawLoading(ctx, this.viewW, this.viewH, this.loadP);
      } else if (this.mode === 'title') {
        Ale.Title.draw(ctx, this.viewW, this.viewH);
        Ale.UI.draw(ctx, this.viewW, this.viewH, null, this.alpha);
      } else if (this.scene) {
        this.scene.draw(ctx, this.alpha);
        Ale.UI.draw(ctx, this.viewW, this.viewH, this.scene, this.alpha);
        if (Ale.DEBUG.fps) this._debugText(ctx);
      }
      if (this.stats) this._drawStats(ctx);
      ctx.restore();
    },

    _debugText(ctx) {
      const p = this.scene.player;
      ctx.font = '16px monospace'; ctx.fillStyle = '#0f0'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const s = p ? 'x=' + p.x.toFixed(1) + ' y=' + p.y.toFixed(1) + ' vx=' + p.vx.toFixed(0) + ' vy=' + p.vy.toFixed(0) + ' st=' + p.state : '';
      ctx.fillText(this.scene.id + ' ' + s, 12, this.viewH - 24);
    },

    // ------------------------------------------------------------ сцены и главы
    startNew() {
      Ale.Save.clear();
      this.state = this.newState();
      this.checkpointState = clone(this.state);
      this.enterScene(this.state.scene, this.state.entry, { instant: false });
    },

    // Сцену собрать не удалось: не остаёмся с чёрным экраном, а возвращаемся в меню.
    _buildFailed() {
      this.scene = null; this.mode = 'title'; this.transitioning = false; this.pauseWanted = false; this.timers.length = 0;
      Ale.UI.fadeA = 0; Ale.UI.fadeTarget = 0; Ale.UI.closeMenu();
      Ale.Title.enter();
      Ale.UI.banner('Сцена не загрузилась. Попробуйте снова.', 3.2);
    },

    // Сохранение может быть от другой версии игры: проверяем, прежде чем ему верить.
    _validSave(s) {
      return !!(s && typeof s === 'object' && Ale.own(Ale.Scenes, s.scene) && typeof Ale.Scenes[s.scene] === 'function' && s.flags && typeof s.flags === 'object' && !Array.isArray(s.flags));          // «constructor» и «toString» — не сцены; массив вместо flags теряет все флаги при первой же записи (JSON.stringify не пишет свойства массива)
    },

    continueGame() {
      const s = Ale.Save.read();
      if (!this._validSave(s)) return this.startNew();
      s.maxHp = Ale.Settings.easy ? 9 : Ale.clamp(+s.maxHp || 5, 5, 7);       // лёгкий режим, включённый на титуле, действует и при продолжении
      s.hp = s.maxHp; s.tomatoes = Math.max(0, Math.floor(+s.tomatoes || 0)); s.deaths = Math.max(0, Math.floor(+s.deaths || 0)); s.time = Math.max(0, +s.time || 0);          // отрицательные и дробные числа из чужого сохранения (надпись при поражении «undefined»)
      s.entry = Ale.safeEntry(s.entry);
      if (!['slingshot', 'darts', 'bowling'].includes(s.kyivEquipment)) s.kyivEquipment = '';          // старые сохранения и поля Киева: безопасные значения по умолчанию
      if (!['none', 'left', 'listened'].includes(s.antinOutcome)) s.antinOutcome = 'none';
      if (!['chipInBag', 'chipInserted', 'jackpot', 'stolen'].includes(s.casinoStage)) s.casinoStage = 'chipInBag';         // поля Монако: безопасные значения для старых сохранений
      s.casinoWin = Math.max(0, +s.casinoWin || 0); s.casinoBet = Math.max(0, +s.casinoBet || 0); s.casinoSpins = Ale.clamp(Math.floor(+s.casinoSpins || 0), 0, 9);
      this.state = s;
      this.checkpointState = clone(s);
      this.enterScene(s.scene, s.entry, { instant: false });
    },

    hasSave() { return !!Ale.Save.read(); },

    // Сохраняемая точка: восстанавливается при смерти и через «Продолжить».
    checkpoint(scene, entry, opts) {
      opts = opts || {};
      this.state.scene = scene; this.state.entry = entry || 'start';
      if (opts.heal !== false) this.state.hp = this.state.maxHp;
      this.checkpointState = clone(this.state);
      Ale.Save.write(this.state);
    },

    // Переход: картина плавно уходит в темноту, музыка приглушается вместе с ней, в темноте короткая пауза, потом строится новая сцена, проявляется и перетекает в свой трек.
    // opts.fade — длина затемнения (дальние переходы просят дольше), opts.hold — пауза в темноте. Времена — Game.TRANS.
    goto(scene, entry, opts) {
      if (this.transitioning) return;
      opts = opts || {};
      this.transitioning = true;
      if (this.scene && this.scene.player) this.scene.player.locked = true;
      const out = opts.fade || TRANS.out, hold = opts.hold === undefined ? TRANS.hold : opts.hold;
      Ale.UI.fadeTo(1, out);
      if (Ale.Audio && Ale.Audio.dip) Ale.Audio.dip(undefined, out + hold * 0.5);
      this.after(out + hold, () => { this.enterScene(scene, entry, { instant: true }); });
    },

    // Всё, что принадлежит сцене, но живёт вне неё (окна на весь экран, подложка заплыва, реплики, подсказки, значок кнопки броска): сбрасывается при смене сцены и при выходе в главное меню.
    // Раньше выход в меню оставлял жить подложку заплыва (берег Днепра рисовался поверх титульного экрана), открытую во время затемнения реплику и значок оружия на кнопке броска (11.10.2026)
    _clearSceneUi() {
      if (Ale.Cards) Ale.Cards.reset();
      if (Ale.Chess && Ale.Chess.reset) Ale.Chess.reset();
      if (Ale.Casino && Ale.Casino.reset) Ale.Casino.reset();
      if (Ale.Credits && Ale.Credits.reset) Ale.Credits.reset();
      if (Ale.Photo && Ale.Photo.reset) Ale.Photo.reset();
      if (Ale.River && Ale.River.reset) Ale.River.reset();
      const U = Ale.UI;
      U.dlg = null; U.lock = null; U.help = null; U.ph = null; U.tipS = null; U.pl = null; U.clearHints(); U.closeMenu(); U.objective = { text: '', t: 0 };
      if (Ale.Touch && Ale.Touch.setThrowIcon) Ale.Touch.setThrowIcon(null);
    },

    enterScene(name, entry, opts) {
      const build = Ale.own(Ale.Scenes, name) && typeof Ale.Scenes[name] === 'function' ? Ale.Scenes[name] : null;          // не унаследованное имя: ?scene=constructor давало чёрный экран навсегда
      this.scene = null;
      Ale.Art.releaseAll();
      if (Ale.Title && Ale.Title.release) Ale.Title.release();      // ~10 Мпикс титульного экрана в игре не нужны (на iPhone память дорога)
      this._clearSceneUi();
      // Сбой при сборке сцены (нехватка памяти на холсты, битое сохранение) не должен оставлять чёрный экран навсегда:
      // одна повторная попытка, затем возврат в главное меню.
      let sc = null;
      for (let attempt = 0; attempt < 2 && !sc && build; attempt++) {
        try { Ale.rng.seed(1234); Ale.fxRng.seed(777); sc = build(this, Ale.safeEntry(entry)); }
        catch (e) { console.error(e); Ale.Art.releaseAll(); }
      }
      if (!sc) return this._buildFailed();
      try {          // исключение в хвосте (место, камера, музыка, затемнение) оставляло переход и чёрный экран навсегда: теперь — как при сбое сборки сцены
        this.scene = sc;
        this.mode = 'play';
        this.hitstopFrames = 0;
        if (this.quality) { this.quality.hold(5); this.quality.cancelProbe(); }          // сборка сцены и первые секунды (картинки и звук расшифровываются по мере показа) в счёт подбора разрешения не идут
        if (sc.place) Ale.UI.place(sc.place[0], sc.place[1], sc.placeY);
        this._viewScene(sc);
        const t = sc.cameraTarget || sc.player;
        if (t) sc.camera.snapTo(t.x, t.y);
        Ale.Input.consumeAll();
        Ale.Audio.music(sc.music);                    // прежний трек уходит, новый вступает плавно (тот же — просто возвращает приглушённую громкость)
        this.transitioning = true;
        Ale.UI.fadeA = 1; Ale.UI.fadeTarget = 1;
        const reveal = opts && opts.instant ? TRANS.reveal : TRANS.revealFirst;
        Ale.UI.fadeTo(0, reveal);
        this.after(reveal * TRANS.control, () => { this.transitioning = false; });
        const plain = this.manual && !this.realFades;          // проверки обычно идут без затемнений; realFades = true — проверка самих переходов (мелькание мира перед открыткой и после неё)
        sc.scriptHold = plain || sc.noScriptHold ? 0 : reveal * TRANS.scripts;          // сценарий начинается, когда картина уже видна: реплики и подсказки не идут по тёмному экрану; noScriptHold — сцена сразу открывается закрывающей мир подложкой и открыткой (приезд в Киев): ждать проявления незачем, а под ним мелькнул бы сам мир
        if (plain) { this.transitioning = false; Ale.UI.fadeA = 0; Ale.UI.fadeTarget = 0; }
      } catch (e) { console.error(e); return this._buildFailed(); }
      if (this.manual) this.render();          // (проверки: исключение рисования должно быть видно им, а не уходить в «сцена не загрузилась»)
    },

    // Смерть героя: возврат к последней сохранённой точке (после повторных поражений — дополнительные сердца).
    onPlayerDead() { this.restartFromCheckpoint(true); },

    restartFromCheckpoint(died) {
      if (this.transitioning) return;
      this.transitioning = true;
      Ale.UI.fadeTo(1, 0.8);
      if (Ale.Audio && Ale.Audio.dip) Ale.Audio.dip(undefined, 0.9);
      if (died) { const q = Ale.T.deathQuips; Ale.UI.banner(q[(this.state.deaths || 0) % q.length], 1.9); }
      this.after(1.1, () => {
        const cp = clone(this.checkpointState);
        cp.deaths = (this.state.deaths || 0) + (died ? 1 : 0);
        if (cp.deaths >= 2 && cp.maxHp < 7) cp.maxHp = 7;       // мягкая помощь после повторных поражений
        cp.hp = cp.maxHp;
        this.state = cp;
        this.checkpointState = clone(cp);
        this.enterScene(cp.scene, cp.entry, { instant: true });
      });
    },

    applyEasy(on) {
      Ale.Settings.setEasy(on);
      const S = this.state, hpMax = Ale.Settings.maxHp();
      S.maxHp = hpMax; S.hp = Math.min(hpMax, Math.max(S.hp, on ? S.hp + 4 : 1));
      if (this.checkpointState) { this.checkpointState.maxHp = hpMax; this.checkpointState.hp = hpMax; }
    },

    // Паузу можно открыть, если ничего не открыто поверх мира — или идёт сам заплыв через Днепр (он модальный, но паузу ставит: часы заплыва и звук встают вместе, см. UI.update)
    // Экранные кнопки (сенсорный режим): полный набор — в игре; где его нет (открытка, шахматы, автомат, выбор ответа, телефон, кат-сцены), остаётся одна «II», чтобы паузу можно было поставить везде
    // (владелец 12.10.2026); в заплыве своя кнопка рисуется на холсте (River.pauseButtonAt)
    _syncTouch() {
      const T = Ale.Touch, U = Ale.UI;
      if (!T || !T.active) return;
      T.setInteract(this.mode === 'play' && this.scene && (this.scene.focus || this.scene.holdInteract) && !U.modal);
      // пока открыто любое меню (пауза с памяткой слева, громкость, «Как играть»), кнопки игры убраны: они закрывали памятку и края окон; меню нажимают пальцем напрямую
      const playing = this.mode === 'play' && !(this.scene && this.scene.hideHud) && !(Ale.Cards && Ale.Cards.busy) && !U.miniBusy && !U.choosing && !U.ph && !U.menu && !U.help;
      T.setPlaying(playing);
      if (T.setPauseOnly) T.setPauseOnly(!playing && this._pausable() && !(Ale.River && Ale.River.busy));
      if (T.setTitleHint) T.setTitleHint(this.mode === 'title' && Ale.Title && Ale.Title.phase === 'menu' && !Ale.Title.saved && !(U.menu && U.menu.hideTouch));          // Title.saved — есть ли сохранение (читается при открытии меню, не каждый кадр)
    },

    _pausable() {
      if (this.mode !== 'play' || !this.scene || this.scene.noPause || this.portrait) return false;
      const U = Ale.UI;
      if (U.menu || U.help) return false;                                 // пауза, громкость, «Как играть» или другое меню уже открыто
      if (Ale.River && Ale.River.busy && !(Ale.River.canPause && Ale.River.canPause())) return false;       // заплыв: нельзя только на выходе (сессия закрывается)
      return true;
    },
    // Запрос паузы (ушли из окна, свернули браузер): сразу, если можно; посреди затемнения между сценами — как только оно кончится (см. step)
    requestPause() {
      if (this.mode !== 'play' || !this.scene) return;
      if (this.transitioning) { this.pauseWanted = true; return; }
      if (this._pausable()) this.openPause();
    },

    openPause(sel) {
      const swim = !!(Ale.River && Ale.River.busy);                          // в заплыве нет пункта «Лёгкий режим»: сердца заплыва считаются отдельно и переключатель их не тронул бы
      const credits = !!(this.scene && this.scene.playCredits && this.flag('birthday_greeted') && !(Ale.Credits && Ale.Credits.busy));          // пока идут сами титры, пункт «Титры» не нужен: он запускал их заново с первой строки
      const iEasy = credits ? 4 : 3;          // строка «Лёгкий режим»: после переключения подсветка остаётся на ней (раньше прыгала на «Продолжить»)
      Ale.UI.openMenu([
        { label: 'Продолжить', action: () => Ale.UI.closeMenu() },
        { label: 'Как играть', action: () => { Ale.UI.closeMenu(); Ale.UI.openHelp(() => this.openPause()); } },
        { label: Ale.T.audio.menu, action: () => Ale.UI.openVolume(() => this.openPause(2), { pause: true }) },
        ...(credits ? [{ label: Ale.T.monaco.menu.credits, action: () => { Ale.UI.closeMenu(); this.scene.playCredits(); } }] : []),          // комната-сюрприз: титры можно посмотреть снова
        ...(swim ? [] : [{ label: Ale.Settings.easy ? 'Лёгкий режим: вкл' : 'Лёгкий режим: выкл', action: () => { this.applyEasy(!Ale.Settings.easy); this.openPause(iEasy); } }]),
        ...(document.documentElement.requestFullscreen ? [{ label: 'Полный экран (F)', action: () => { Ale.UI.closeMenu(); this.toggleFullscreen(); } }] : []),
        { label: 'Заново с последней точки', action: () => { Ale.UI.closeMenu(); this.restartFromCheckpoint(false); } },
        { label: 'В главное меню', action: () => { Ale.UI.closeMenu(); this.toTitle(); } },
      ], { title: 'Пауза', onBack: () => Ale.UI.closeMenu(), legend: true, sel: sel || 0, pause: true });          // pause: меню берёт ввод первым, всё под ним (разговор, шахматы, автомат…) стоит
    },

    toTitle() {
      if (this.transitioning) return;
      this.transitioning = true;
      Ale.UI.fadeTo(1, 0.7);
      if (Ale.Audio && Ale.Audio.dip) Ale.Audio.dip(0.15, 0.8);
      this.after(0.85, () => {
        this.scene = null; this.mode = 'title'; this.transitioning = false; this.pauseWanted = false;
        this._clearSceneUi();
        Ale.Art.releaseAll();                 // холсты покинутой сцены не должны висеть в памяти, пока открыто меню
        Ale.Title.enter();
        Ale.UI.fadeTo(0, 0.9);
      });
    },
  });

  window.__ale = { Ale, Game };
})();
