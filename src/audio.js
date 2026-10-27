// Звук. Эффекты синтезируются на лету (WebAudio). Музыка — записанные треки (assets/audio, подготовлены tools/prep_audio.js, список и точки
// петель — assets/audio/tracks.js); если файла нет или он не загрузился, играет прежний синтез (TRACKS ниже).
// AudioContext создаётся заранее (prepare) в состоянии «suspended», чтобы успеть скачать и расшифровать песню заставки; браузер разрешает звук
// только после первого касания/нажатия (правило браузеров, особенно iOS) — тогда init() запускает контекст, и песня начинается сразу.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const freqOf = (n) => {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    if (!m) return 0;
    return 440 * Math.pow(2, (12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]] - 69) / 12);
  };

  // Записанные треки: имя → { f: файл, dur, loop: [начало, конец] в секундах | null, vol }. Петля включается через loopStart/loopEnd источника:
  // сшивка (кроссфейд) уже запечена в файле, поэтому переход конец → начало неслышен.
  const AU = window.ALE_AUDIO || { base: 'assets/audio/', tracks: {} };
  const FILES = AU.tracks;
  // Записанные эффекты (ElevenLabs Sound Effects; assets/audio/sfx, подготовлены tools/prep_sfx.js, список — assets/audio/sfx/sfx.js): имя → { f: файлы-варианты,
  // dur, loop, gain }. У эффекта есть запись — играет она, а не одноимённый синтез; синтез остаётся запасным (файл не скачался или не расшифровался).
  const SX = window.ALE_SFX || { base: 'assets/audio/sfx/', sounds: {} };
  // Что скачать заранее, пока играет текущий трек (в памяти держатся не более трёх расшифрованных треков). Записей Киева пока нет: prefetch пропускает отсутствующие имена,
  // играют запасные треки Парижа (Audio.pick), а их цепочка (tunnel → paris → boss → paris) уже в таблице
  const NEXT = { title: ['paris'], paris: ['boss'], boss: ['paris'], tunnel: ['paris'], ride: ['airport'], airport: ['takeoff'],
    takeoff: ['over_the_dnipro', 'kyiv_underpass'], over_the_dnipro: ['river_swim', 'kyiv_underpass'], river_swim: ['kyiv_underpass'], kyiv_underpass: ['kyiv_park'], kyiv_park: ['chess', 'dimasik'], chess: ['kyiv_park'], dimasik: ['kyiv_park', 'monaco_street'],
    monaco_street: ['monaco_casino', 'coast'], monaco_casino: ['roulette', 'monaco_street'], roulette: ['monaco_casino'], coast: ['finale'] };
  const KEEP = 3;
  // Переходы между треками (владелец 09.10.2026: «они резко обрываются, и следующие резко начинаются»): прежний трек уходит за out секунд, новый вступает за in, и они идут одновременно.
  // Кривая — «равная мощность» с плавной ступенькой в аргументе: уход cos(π/2·ss(u)), вход sin(π/2·ss(u)), ss(u) = u²(3 − 2u); сумма квадратов равна единице, поэтому посреди перехода двух разных
  // треков громкость не проваливается и не вспухает, а наклон на обоих концах нулевой — ни излома в начале, ни «ступеньки» в конце. dip — до какой доли громкости музыка приглушается на время смены
  // сцены (Game.goto), чтобы смена трека происходила уже в тишине затемнения; undip — за сколько возвращается, если сцена оставила тот же трек.
  const XFADE = { out: 2.0, in: 2.0, dip: 0.3, dipTime: 0.8, undip: 1.4 };
  const ss = (u) => u * u * (3 - 2 * u);
  const shapeOf = (from, to, u) => (to <= 0.0002 ? from * Math.cos(Math.PI / 2 * ss(u)) : from <= 0.0002 ? to * Math.sin(Math.PI / 2 * ss(u)) : from + (to - from) * ss(u));
  // Громкость: ползунки 0…1 в меню «Громкость». Во сколько раз звук громче прежнего уровня шин (FILE_GAIN, musBus 0,42, sfxBus 2,6) = положение × K.
  // По просьбе владельца (30.09.2026) музыка стала на 10% громче прежней, а эффекты на 15% тише: 0,70 × K = 1,10 и 0,60 × K = 0,85. Потом (09.10.2026: «музыка слишком громкая
  // в среднем везде, сделай тише на 25%») музыка ещё на четверть тише: 1,10 × 0,75 = 0,825. Меняется множитель, а не положение ползунка по умолчанию: сохранённые положения у игроков
  // остаются теми же, а музыка у всех стала тише.
  // 15.10.2026 (владелец: «игра по умолчанию громковатая: музыку на 30, эффекты на 20»): положения ползунков по умолчанию — 0,30 и 0,20 (были 0,70 и 0,60). Множители выше относятся к ОПОРНЫМ положениям
  // VOL_REF (0,70 и 0,60), в которых они подбирались, поэтому шкала ползунков не изменилась: на любом положении звук такой же, как был, и у тех, кто уже двигал ползунки, он прежний; тише только то, с чего игра начинается.
  const VOL_DEFAULT = { music: 0.3, sfx: 0.2 }, VOL_REF = { music: 0.7, sfx: 0.6 }, VOL_MULT = { music: 0.825, sfx: 0.85 };
  const VOL_K = { music: VOL_MULT.music / VOL_REF.music, sfx: VOL_MULT.sfx / VOL_REF.sfx };
  const BUS = { music: 0.42, sfx: 2.6 };            // прежние уровни синтезной музыки и эффектов (записанная музыка — FILE_GAIN)
  // Синтезированные эффекты (таблица SFX ниже: шаги, прыжок, смерть крысы, подбор предметов и ключей, открывание, интерфейс, реплики Бубела и прочее; записанные ElevenLabs — SX.sounds — сюда
  // не относятся) играют на 40% тише прежнего: амплитуда × 0,6 (владелец 02.10.2026, ночью: «общие мультяшные спецэффекты резкие и отвлекают»). Множитель стоит в sfx() перед вызовом
  // синтеза, поэтому записи, музыка и ползунок «Эффекты» его не видят. На выходе игры это ≈ −4 дБ(A) (×0,6 — это −4,4 дБ): компрессор-ограничитель шин сжимает самые громкие звуки, поэтому
  // у самых громких (hatch_break) есть добавка внутри таблицы. Шаги героини — тоже синтез: прежняя просьба «шаги тише на 40%» выполняется этим же множителем (WALK.stepVol 0,5 × 0,6 = 0,3).
  const SYNTH_K = 0.6;
  // Подрезка отдельных звуков (владелец 13.10.2026: «тише звуки спецэффектов: подсказки, прыжок, ходьба, бросок помидора — на 20–25 %»): множитель по имени звука, один для синтеза (поверх SYNTH_K) и для
  // записи (поверх её усиления из списка). 0,775 — на 22,5 % по амплитуде (≈ −2,2 дБ). Шаги героини (`step`, прежние 0,5 × 0,6 → 0,23), прыжок и приземление (`jump`, `land`), бросок помидора (`throw`,
  // запись) и «подсказки» — «Получено» и галочка обучающей плашки (`pickup`); тявканье Бубела, когда она говорит подсказку (`Bubel.talk`), зовёт `sfx('bark', { vol: TRIM.hint })`. Ползунок «Эффекты» и музыка
  // подрезки не видят; чтобы звук стал ещё тише или громче — число здесь (одно место).
  const TRIM = { step: 0.775, jump: 0.775, land: 0.775, pickup: 0.775, throw: 0.775, hint: 0.775 };
  // Прогоны разработчика (тесты, снимки, бот: страницы с ?manual=1 или ?silent=1) молчат: звук считается и запускается, как у игрока, но на динамики не выходит.
  // На макбуке нельзя заглушить один браузер, а на слух разработка звук всё равно не проверяет. ?sound=1 возвращает звук (осознанно послушать).
  const SILENT = (() => { try { const q = new URLSearchParams(location.search); return !q.has('sound') && (q.has('silent') || q.has('manual')); } catch (e) { return false; } })();

  const A = (Ale.Audio = {
    ctx: null, master: null, sfxBus: null, musBus: null, fileBus: null, noiseBuf: null,
    file: null, _files: {}, _use: 0, FILE_GAIN: 0.55,
    _rec: {}, _loops: {}, _loopTimer: 0,     // записанные эффекты (имя → { bufs, gain, loop, last }) и играющие петли («пока жив источник», см. hold)
    // Громкость музыки и эффектов (0…1, сохраняется в localStorage 'ale-vol'). Из неё выводятся muted (обе на нуле), musicOff (музыка на нуле)
    // и mode: 2 — музыка и эффекты, 1 — только эффекты, 0 — тишина.
    vol: { music: VOL_DEFAULT.music, sfx: VOL_DEFAULT.sfx }, VOL_DEFAULT, VOL_REF, VOL_MULT, SYNTH_K, TRIM, XFADE, _last: {}, _dipped: false,
    mode: 2, muted: false, musicOff: false,
    silent: SILENT, out: null,          // silent: прогон разработчика, выход звука заглушён узлом out (настройки громкости и расчёты не затронуты)
    pending: null, current: null, seq: null, suspended: false,

    // Контекст создаётся заранее: он «suspended» до первого касания, но песню заставки уже можно скачать, расшифровать и поставить в очередь.
    prepare() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this._session();
      let ctx; try { ctx = new AC(); } catch (e) { this._j('AudioContext не создан: ' + (e && e.name || e)); return; }
      this._adopt(ctx);
      this._j('контекст создан: ' + ctx.state + ', ' + ctx.sampleRate + ' Гц' + (document.hidden ? ', страница скрыта' : ''));
      this._listen();
      this.loadSfx();
      this.preload('title');
    },

    // Вызывается на первом касании/нажатии: запускает звук (и песню, если она уже стоит в очереди).
    init() {
      if (!this.ctx) this.prepare();
      if (!this.ctx) return;
      this.unlock('init');
      if (this.pending) { const p = this.pending, po = this.pendingOpts; this.pending = null; this.pendingOpts = null; this.music(p, po); }
    },

    // ------------------------------------------------------------ разблокировка и самопроверка звука (27.10.2026)
    // Владелец (iPhone 16e, игра со значка «Домой»): «звука нет совсем» — 14.10, 15.10 и 27.10; во вкладке Safari звук был. Устройства у нас нет, поэтому разблокировка сделана с запасом на все известные
    // причины, а всё, что происходит со звуком, видно на экране диагностики (?stats=1 или пять касаний в левом верхнем углу кадра):
    //   · жест: попытка запустить звук — на любом «отпускании» и клавише (touchend, pointerup, click, keydown, mouseup), в фазе ПЕРЕХВАТА у окна: чужой stopPropagation на кнопке её не съест;
    //   · сеанс: navigator.audioSession.type = 'playback' (iOS 17+) — заново на каждом жесте, пока звук не пошёл; на iOS ещё и «тихий канал» (_channel): зацикленный беззвучный <audio>, запущенный
    //     из жеста, переводит сеанс страницы в «воспроизведение» и там, где audioSession нет или не слушается (у значка «Домой»), — тогда звук не глушит переключатель «Без звука» (WebKit 237322);
    //     пока страница скрыта или без фокуса, канал выключен и источник снят — иначе на экране блокировки висел бы плеер;
    //   · «пауза страницы»: iOS у значка «Домой» не всегда присылает visibilitychange при возвращении (так пишут и в unmute.js) — видимая страница с жестом пауза больше не держит;
    //   · завис или сломан контекст: iOS 26 у значка «Домой» — звук только при первом запуске, resume() не возвращается (WebKit 291892). Если после жеста контекст за 1,5 с не пошёл
    //     или «идёт», а его часы стоят, на следующем жесте он пересоздаётся (не больше REBUILD_MAX раз за запуск); расшифрованные записи переходят в новый, играющий трек начинается заново;
    //   · самопроверка: на мастер-шине стоит AnalyserNode (без выхода: только смотрит) — «sig» на экране диагностики показывает, идёт ли из игры сигнал. «running», часы идут, сигнал есть, а звука не слышно —
    //     значит, его глушит телефон (переключатель «Без звука», громкость, наушники/Bluetooth), а не игра.
    REBUILD_MAX: 3,
    _jn: [], _clock: 0, _gest: 0, _rebuilds: 0,
    _j(text) { this._jn.push({ t: this._clock, text }); if (this._jn.length > 16) this._jn.shift(); },
    _ios() { const n = navigator, ua = n.userAgent || ''; return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (n.maxTouchPoints || 0) > 1); },
    _session() {
      try { const s = navigator.audioSession; if (s && s.type !== 'playback') { s.type = 'playback'; if (this._sessNoted !== s.type) { this._sessNoted = s.type; this._j('сеанс: ' + s.type); } } } catch (e) { /* не везде */ }
    },
    // Новый контекст: шины, тихий выход проверок, анализатор и слежение за состоянием
    _adopt(ctx) {
      this.ctx = ctx; this._kicked = false; this._broken = ''; this._ct = null;
      this._build(ctx);
      // тихий прогон: между master и динамиками стоит узел с нулевым усилением (master трогают ползунки и проверки, поэтому глушим отдельным узлом; офлайн-контексты проверок сюда не попадают)
      if (this.silent) { this.out = ctx.createGain(); this.out.gain.value = 0; this.master.disconnect(); this.master.connect(this.out); this.out.connect(ctx.destination); }
      try { this.tap = ctx.createAnalyser(); this.tap.fftSize = 512; this.master.connect(this.tap); this._tapBuf = new Float32Array(512); } catch (e) { this.tap = null; }
      const onState = () => {
        if (this.ctx !== ctx) return;
        this._j('состояние: ' + ctx.state);
        // прерывание кончилось (звонок, Siri, другой плеер) — iOS разрешает возобновить без касания, если звук уже запускался; не вышло — подождём жеста
        if (ctx.state !== 'running' && ctx.state !== 'closed' && !this.suspended && !document.hidden && (this._everRan || this._gest > 0)) { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ок */ } }
        if (ctx.state === 'running') { this._everRan = true; this._resumeOk(); }
      };
      if (typeof ctx.startRendering === 'function') return;          // офлайн-контекст проверок: следить не за чем
      try { ctx.addEventListener('statechange', onState); } catch (e) { ctx.onstatechange = onState; }
    },
    _listen() {
      if (this._listening) return; this._listening = true;
      const opt = { capture: true, passive: true };
      for (const ev of ['touchend', 'pointerup', 'click', 'keydown', 'mouseup']) window.addEventListener(ev, (e) => this.unlock(ev, e), opt);
      // вернулись (значок «Домой», переключатель приложений): часы и пауза страницы проверяются заново; без касания — только то, что iOS разрешает
      const back = (why) => { if (document.hidden) { this._channelOff(why); return; } this._j(why); this._unstick(); if (this.ctx && this.ctx.state !== 'running' && !this.suspended && this._everRan) { try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ок */ } } };
      document.addEventListener('visibilitychange', () => back(document.hidden ? 'страница скрыта' : 'страница видна'));
      window.addEventListener('pageshow', () => back('pageshow'));
      window.addEventListener('pagehide', () => this._channelOff('pagehide'));
      window.addEventListener('focus', () => back('фокус'));
      window.addEventListener('blur', () => this._channelOff('без фокуса'));
    },
    // Пауза «страница скрыта» стоит, а страница видна (событие возвращения не пришло) — снимаем
    _unstick() {
      if (this._pausePage && !document.hidden) { this._j('пауза страницы снята: страница видна'); this._pausePage = false; this._applySuspend(); }
    },
    // Жест игрока: всё, что нужно, чтобы звук пошёл (и пошёл снова после прерывания). kind — тип события; trusted — настоящее «отпускание» или клавиша (по нему судят, что resume() завис)
    unlock(kind, e) {
      if (!this.ctx) this.prepare();
      if (!this.ctx || document.hidden) return;
      this._gest++;
      this._unstick();
      this._session();
      if (kind !== 'init') this._channel();
      if ((this.ctx.state === 'closed' || this._broken) && kind !== 'init') this._rebuild(this._broken || 'контекст закрыт');
      const c = this.ctx;
      if (c.state !== 'running' && !this.suspended) this._resume(kind, !!e && e.isTrusted !== false && (kind === 'touchend' || kind === 'click' || kind === 'keydown'));          // сторож — только для настоящих жестов (события проверок и вызовы из кода не в счёт)
      // старые iOS запускают вывод только после звука, начатого прямо в жесте: один беззвучный отсчёт (у каждого контекста — один раз)
      if (!this._kicked && kind !== 'init') { this._kicked = true; try { const b = c.createBuffer(1, 1, c.sampleRate), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (x) { /* ок */ } }
    },
    _resume(kind, trusted) {
      const c = this.ctx, was = c.state;
      let p; try { p = c.resume(); } catch (x) { this._j('resume бросил: ' + (x && x.name || x)); return; }
      if (this._lastResumeKind !== kind + was) { this._lastResumeKind = kind + was; this._j('resume (' + kind + ', ' + was + ')'); }
      if (p && p.then) p.then(() => { if (this.ctx === c && c.state === 'running') this._resumeOk(); }, (x) => this._j('resume отклонён: ' + (x && x.name || x)));
      // сторож: настоящий жест, а контекст за 1,5 с так и не пошёл — на следующем жесте пересоздаём (iOS 26 у значка «Домой»: resume() не возвращается)
      if (trusted && !this._wd) {
        this._wd = setTimeout(() => {
          this._wd = 0;
          if (this.ctx === c && c.state !== 'running' && !this.suspended && !document.hidden) { this._broken = 'resume не сработал за 1,5 с (' + c.state + ')'; this._j(this._broken); }
        }, 1500);
      }
    },
    _resumeOk() { if (!this._ranNoted) { this._ranNoted = true; this._j('звук пошёл'); } this._everRan = true; },
    // Пересоздать контекст (только из жеста: новый тоже нужно запустить). Расшифрованные записи переносятся (AudioBuffer не привязан к контексту), играющий трек начинается заново.
    _rebuild(why) {
      if (this._rebuilds >= this.REBUILD_MAX) { this._broken = ''; return; }
      const AC = window.AudioContext || window.webkitAudioContext, old = this.ctx;
      let ctx; try { ctx = new AC(); } catch (e) { this._j('новый контекст не создан: ' + (e && e.name || e)); this._broken = ''; return; }
      this._rebuilds++; this._j('пересоздан (' + why + ')');
      const cur = this.current;
      // заплыв идёт по долям этого трека (River._slewToMusic): начатый с нуля, он тянул бы часы заплыва назад на десятки секунд — продолжаем с того места, где заплыв сейчас
      const sw = Ale.River && Ale.River.session, at = sw && !sw.done && sw.synced && sw.syncName === cur && sw.t > 0 ? sw.t : 0;
      try { if (this.seq) clearInterval(this.seq.timer); } catch (e) { /* ок */ }
      for (const n of Object.keys(this._loops)) { try { this._loops[n].src.stop(); } catch (e) { /* ок */ } delete this._loops[n]; }
      this.seq = null; this.file = null; this._dipped = false;
      try { const pc = old.close(); if (pc && pc.catch) pc.catch(() => {}); } catch (e) { /* ок */ }          // close() асинхронный: отказ (контекст уже закрыт) не должен падать в консоль необработанным
      this._adopt(ctx);
      this._ranNoted = false;
      if (this.muted) this.master.gain.value = 0;
      this.current = null;
      if (cur) this.music(cur, at ? { at, in: 0.3 } : undefined);
    },
    // Тихий канал iOS (см. шапку раздела): беззвучный зацикленный <audio>; источник — сгенерированный WAV (blob:, разрешён политикой выкладки media-src). Запускается только из жеста.
    _channel() {
      if (this.silent || !this._ios() || document.hidden) return;
      const ch = this._ch || (this._ch = { el: null, url: null, state: 'none' });
      if (ch.el && !ch.el.paused) return;
      try {
        if (!ch.url) ch.url = URL.createObjectURL(new Blob([this._silenceWav(this.ctx ? this.ctx.sampleRate : 48000)], { type: 'audio/wav' }));
        if (!ch.el) { const a = ch.el = document.createElement('audio'); a.setAttribute('x-webkit-airplay', 'deny'); a.setAttribute('playsinline', ''); a.preload = 'auto'; a.loop = true; a.controls = false; try { a.disableRemotePlayback = true; } catch (e) { /* ок */ } }
        const a = ch.el;
        a.src = ch.url;                  // источник — заново перед каждым запуском (iOS 26 у значка «Домой»: элемент после повторного открытия «застревает», WebKit 295518)
        const p = a.play();
        ch.state = 'play';
        if (p && p.then) p.then(() => { if (ch.noted !== 'ok') { ch.noted = 'ok'; this._j('тихий канал играет'); } }, (x) => { ch.state = 'err'; this._j('тихий канал: ' + (x && x.name || x)); try { a.removeAttribute('src'); a.load(); } catch (y) { /* ок */ } });
      } catch (e) { ch.state = 'err'; this._j('тихий канал: ' + (e && e.message || e)); }
    },
    _channelOff(why) {
      const ch = this._ch; if (!ch || !ch.el || ch.state === 'off') return;
      try { ch.el.pause(); ch.el.removeAttribute('src'); ch.el.load(); } catch (e) { /* ок */ }       // без источника плеер исчезает и с экрана блокировки
      ch.state = 'off'; ch.noted = ''; this._j('тихий канал выключен: ' + why);
    },
    // WAV 0,25 с, 16 бит, стерео, частота контекста (iOS сводит Web Audio к частоте и формату играющего <audio>: моно 8 кГц испортило бы звук); отсчёты ±1 (−90 дБ), а не нули — «пустой» файл iOS может не играть
    _silenceWav(rate) {
      rate = Math.round(rate || 48000);
      const n = Math.round(rate * 0.25), ch = 2, bytes = n * ch * 2, buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
      v.setUint32(24, rate, true); v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, bytes, true);
      for (let i = 0; i < n * ch; i++) v.setInt16(44 + i * 2, (i >> 1) % 2 ? 1 : -1, true);
      return buf;
    },
    // Каждый кадр (Game.frame, не в проверках с ручным временем): идут ли часы звука и есть ли сигнал на мастер-шине
    tick(dt) {
      this._clock += dt;
      const c = this.ctx; if (!c) return;
      if (c.state === 'running' && !document.hidden && !this.suspended) {
        const ct = this._ct;
        if (!ct) this._ct = { t0: c.currentTime, w: 0 };          // отсчёт — с этого кадра: его dt уже прошёл до t0
        else if ((ct.w += dt) >= 1.5) {
          const adv = c.currentTime - ct.t0;
          this._rate = adv / ct.w;
          if (adv < 0.05 && !this._broken) { this._broken = 'часы звука стоят'; this._j(this._broken + ' (running)'); }
          this._ct = null;
        }
      } else this._ct = null;
      if (this.tap && (this._tapT = (this._tapT || 0) + dt) >= 0.25) {
        this._tapT = 0;
        try { this.tap.getFloatTimeDomainData(this._tapBuf); let pk = 0; for (let i = 0; i < this._tapBuf.length; i++) { const a = Math.abs(this._tapBuf[i]); if (a > pk) pk = a; } this._peak = Math.max(pk, (this._peak || 0) * 0.6); if (pk > 3e-4) { this._sigAt = this._clock; this._heard = (this._heard || 0) + 0.25; } } catch (e) { /* ок */ }
      }
    },
    // Звук мог бы играть, но браузер его ещё не разрешил: нужна подсказка «Коснись экрана, чтобы включить звук» (UI). Не в проверках и не когда звук выключен ползунками
    needsTap() {
      const c = this.ctx;
      if (!c || this.silent || this.muted || this.suspended || document.hidden || this._clock < 1) return false;
      return c.state !== 'running' || !!this._broken;
    },
    // Строки для экрана диагностики (Game.statsLines)
    statsLines() {
      const c = this.ctx, ch = this._ch, db = (v) => (v > 1e-6 ? (20 * Math.log10(v)).toFixed(0) : '-inf');
      const sess = navigator.audioSession ? navigator.audioSession.type : 'none';
      const out = [
        'audio ' + (c ? c.state : 'none') + '  sess ' + sess + '  ch ' + (ch ? ch.state : (this._ios() ? 'none' : 'n/a')) + '  t ' + (c ? c.currentTime.toFixed(1) : '-') + ' rate ' + (this._rate !== undefined ? this._rate.toFixed(2) : '-') +
          '  sig ' + db(this._peak || 0) + 'dB heard ' + (this._heard || 0).toFixed(1) + 's  silent ' + (this.silent ? 1 : 0) + '  vol ' + this.vol.music + '/' + this.vol.sfx + '  music ' + (this.current || '-') + (this.file ? '' : this.current ? '(нет)' : ''),
        'aud gest ' + this._gest + ' rebuild ' + this._rebuilds + (this._broken ? ' BROKEN' : '') + (this.suspended ? ' PAUSED' : '') + '  ' + this._jn.slice(-3).map((e) => e.t.toFixed(0) + 's ' + e.text).join(' | '),
      ];
      return out;
    },

    // Шины и шум для любого контекста (в том числе OfflineAudioContext — так проверяем синтез в тестах).
    _build(ctx) {
      const comp = ctx.createDynamicsCompressor();
      // компрессор здесь работает как ограничитель пиков: тихие звуки не трогает, сумму не даёт зашкалить
      comp.threshold.value = -8; comp.knee.value = 4; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = BUS.sfx * this.gainOf('sfx');      // эффекты заметно громче музыки: удары должны «читаться»
      this.musBus = ctx.createGain(); this.musBus.gain.value = BUS.music * this.gainOf('music');
      // музыку слегка «смягчаем» фильтром, чтобы прямоугольные волны не резали слух
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.6;
      this.musBus.connect(lp); lp.connect(comp); this.sfxBus.connect(comp); comp.connect(this.master);
      // записанная музыка идёт мимо фильтра (он смягчает синтез), но через тот же компрессор-ограничитель, что и эффекты: сумма не зашкалит
      this.fileBus = ctx.createGain(); this.fileBus.gain.value = this.FILE_GAIN * this.gainOf('music'); this.fileBus.connect(comp);
      this.master.connect(ctx.destination);
      // лёгкая «комната»: свёртка с затухающим шумом, отправка небольшая
      try {
        const len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let z = 7 + ch * 13; for (let i = 0; i < len; i++) { z = (z * 16807) % 2147483647; d[i] = ((z / 2147483647) * 2 - 1) * Math.pow(1 - i / len, 2.6); } }
        const conv = ctx.createConvolver(); conv.buffer = ir;
        const wet = ctx.createGain(); wet.gain.value = 0.55;
        const sSend = ctx.createGain(); sSend.gain.value = 0.16; const mSend = ctx.createGain(); mSend.gain.value = 0.26;
        this.sfxBus.connect(sSend); sSend.connect(conv); this.musBus.connect(mSend); mSend.connect(conv); conv.connect(wet); wet.connect(comp);
      } catch (e) { /* без реверберации — тоже нормально */ }
      const len = ctx.sampleRate * 1.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let s = 1; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noiseBuf = buf;
    },

    // Звук стоит, пока страница скрыта (suspend) и пока поверх заплыва открыто меню паузы (holdForPause): заплыв идёт по часам шага, а музыка — по часам звука, и остановить надо оба вместе,
    // иначе после паузы удары и ряды препятствий уедут от долей (владелец 11.10.2026: «во время заплыва игру невозможно поставить на паузу»)
    suspend(flag) { this._pausePage = !!flag; this._applySuspend(); },
    holdForPause(flag) { this._pauseMenu = !!flag; this._applySuspend(); },
    _applySuspend() {
      const want = !!(this._pausePage || this._pauseMenu), was = !!this.suspended;
      this.suspended = want;
      if (!this.ctx) return;
      // в Safari после сворачивания состояние может быть «interrupted», а не «suspended» — возобновляем в любом не «running»
      try {
        if (want) { if (!was) this._wasRunning = this.ctx.state === 'running'; this.ctx.suspend(); }
        else { if (was) this._resumeWait = 0; if (this.ctx.state !== 'running') this.ctx.resume(); }
      } catch (e) { /* ок */ }
    },
    // После снятия паузы звук возвращается не мгновенно: пока контекст не побежал снова (но не дольше 0,6 с), часы заплыва стоят — иначе удары уехали бы от музыки на десятки миллисекунд.
    // Если звука не было (тесты, ссылка без первого касания), ждать нечего. Ожидание считается кадрами (dt), а не часами: в логике часов нет (проверка «Детерминизм»)
    resumePending(dt) {
      if (!this._wasRunning || this.suspended || !this.ctx) return false;
      this._resumeWait = (this._resumeWait || 0) + (dt || 0);
      if (this.ctx.state === 'running' || this._resumeWait > 0.6) { this._wasRunning = false; this._resumeWait = 0; return false; }
      return true;
    },

    loadPrefs() {
      try {
        const raw = localStorage.getItem('ale-vol'); let ok = false;
        if (raw) { const o = JSON.parse(raw); if (o && isFinite(o.m) && isFinite(o.s)) { this.vol.music = Math.max(0, Math.min(1, +o.m)); this.vol.sfx = Math.max(0, Math.min(1, +o.s)); ok = true; } }
        if (!ok) {         // прежний переключатель «Звук» (0 — выкл, 1 — только эффекты, 2 — всё): переносим в ползунки
          const m = localStorage.getItem('ale-audio');
          if (m !== null && [0, 1, 2].includes(+m)) { if (+m < 2) this.vol.music = 0; if (+m < 1) this.vol.sfx = 0; }
        }
      } catch (e) { /* без хранилища */ }
      this._flags();
    },
    _flags() { const v = this.vol; this.muted = v.music <= 0 && v.sfx <= 0; this.musicOff = v.music <= 0; this.mode = this.muted ? 0 : this.musicOff ? 1 : 2; },
    // Браузер разрешил звук? До первого касания AudioContext нет или он «suspended»: заставка показывает «Нажмите, чтобы начать».
    unlocked() { return !!this.ctx && this.ctx.state === 'running'; },

    // Во сколько раз музыка ('music') или эффекты ('sfx') громче прежнего уровня при текущем положении ползунка
    gainOf(kind) { return this.vol[kind] * VOL_K[kind]; },
    // Положение ползунка (0…1): применяется сразу, запоминается; переход через ноль останавливает или возвращает музыку
    setVolume(kind, v) {
      if (kind !== 'music' && kind !== 'sfx') return;
      v = Math.round(Math.max(0, Math.min(1, +v || 0)) * 100) / 100;
      const wasOff = this.musicOff || this.muted;
      this.vol[kind] = v; this._flags();
      try { localStorage.setItem('ale-vol', JSON.stringify({ m: this.vol.music, s: this.vol.sfx })); } catch (e) { /* ок */ }
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.05);
      if (kind === 'sfx') this.sfxBus.gain.setTargetAtTime(BUS.sfx * this.gainOf('sfx'), t, 0.03);
      else { this.musBus.gain.setTargetAtTime(BUS.music * this.gainOf('music'), t, 0.03); this.fileBus.gain.setTargetAtTime(this.FILE_GAIN * this.gainOf('music'), t, 0.03); }
      if (this.muted || this.musicOff) { this._stopSeq(); this._stopFile(0.3); }
      else if (wasOff && this.current) { const c = this.current; this.current = null; this.music(c); }
    },
    // Быстро выключить/включить одну из громкостей (пункт меню: E/Enter или касание по названию); включается на прежнее положение
    toggleMute(kind) {
      if (this.vol[kind] > 0) { this._last[kind] = this.vol[kind]; this.setVolume(kind, 0); }
      else this.setVolume(kind, this._last[kind] || VOL_DEFAULT[kind]);
    },

    // ------------------------------------------------------------ примитивы
    tone(f, dur, type, vol, o) {
      const c = this.ctx; if (!c || this.muted) return;
      o = o || {};
      const t0 = c.currentTime + (o.when || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(f, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.025; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
      const a = o.attack === undefined ? 0.004 : o.attack;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(o.dest || this.sfxBus);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },

    noise(dur, vol, o) {
      const c = this.ctx; if (!c || this.muted) return;
      o = o || {};
      const t0 = c.currentTime + (o.when || 0);
      // узкая полоса пропускает малую долю мощности шума — компенсируем, чтобы «вжух» не терялся
      if ((o.type || 'bandpass') === 'bandpass') vol *= Math.min(10, Math.sqrt(22050 * (o.q || 1) / (o.freq || 1000)) * 1.6);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const flt = c.createBiquadFilter(); flt.type = o.type || 'bandpass'; flt.frequency.setValueAtTime(o.freq || 1000, t0); flt.Q.value = o.q || 1;
      if (o.to) flt.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
      const g = c.createGain();
      const at = o.attack === undefined ? 0.004 : o.attack;      // мягкое нарастание — «вжух», а не хлопок
      g.gain.value = 0.0001;                                     // до первого события усиление по умолчанию равно 1: у отложенных вспышек (when > 0) несколько отсчётов шума проскакивали на полной громкости (в WebKit при офлайн-рендере — пик до 1,1)
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(o.dest || this.sfxBus);
      src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.03);
    },


    // ------------------------------------------------------------ голоса музыки
    // Аккордеон (муссет): три язычка, слегка расстроенные друг относительно друга (±8 центов) — отсюда характерные «биения»; нижний язычок едва слышен;
    // «меха»: короткий нажим в начале ноты и лёгкое дрожание на долгих; формантный фильтр делает тембр «носовым».
    accordion(f, dur, vol, when, dest, o) {
      const c = this.ctx; if (!c || this.muted) return;
      o = o || {};
      const t0 = c.currentTime + (when || 0), rel = o.staccato ? 0.03 : 0.05, t1 = t0 + Math.max(0.05, dur), stop = t1 + rel + 0.03;
      const env = c.createGain(), form = c.createBiquadFilter(), lp = c.createBiquadFilter();
      form.type = 'peaking'; form.frequency.value = 1500; form.Q.value = 0.9; form.gain.value = 5;
      lp.type = 'lowpass'; lp.frequency.value = Math.min(4400, f * 5 + 1100); lp.Q.value = 0.6;
      const a = o.staccato ? 0.008 : 0.024;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(vol * (o.staccato ? 1.0 : 1.18), t0 + a);
      if (o.staccato) env.gain.exponentialRampToValueAtTime(vol * 0.35, t0 + Math.min(0.12, dur));
      else env.gain.linearRampToValueAtTime(vol, t0 + a + 0.06);
      env.gain.setValueAtTime(Math.max(0.0002, o.staccato ? vol * 0.3 : vol), Math.max(t0 + a + 0.07, t1 - rel));
      env.gain.exponentialRampToValueAtTime(0.0001, t1 + rel);
      const cents = o.chord ? [-6, 6] : [-8, 0, 8];
      for (const dc of cents) {
        const osc = c.createOscillator(), g = c.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = f; osc.detune.value = dc; g.gain.value = 1 / cents.length;
        osc.connect(g); g.connect(env); osc.start(t0); osc.stop(stop);
      }
      if (!o.chord && f > 160) {           // нижний язычок: «густота» звука
        const osc = c.createOscillator(), g = c.createGain(); osc.type = 'triangle'; osc.frequency.value = f / 2; g.gain.value = 0.14;
        osc.connect(g); g.connect(env); osc.start(t0); osc.stop(stop);
      }
      if (dur > 0.32 && !o.chord && !o.staccato) {      // дрожание мехов на долгой ноте
        const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.8; lg.gain.value = vol * 0.08;
        l.connect(lg); lg.connect(env.gain); l.start(t0 + 0.12); l.stop(stop);
      }
      env.connect(form); form.connect(lp); lp.connect(dest || this.sfxBus);
    },

    // Скрипка: два смычковых голоса, вибрато нарастает не сразу, у начала — лёгкий шорох смычка
    violin(f, dur, vol, when, dest) {
      const c = this.ctx; if (!c || this.muted) return;
      const t0 = c.currentTime + (when || 0), t1 = t0 + Math.max(0.08, dur), stop = t1 + 0.14;
      const env = c.createGain(), lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = Math.min(3600, f * 4 + 800); lp.Q.value = 0.5;
      env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(vol, t0 + 0.07);
      env.gain.setValueAtTime(vol, Math.max(t0 + 0.08, t1 - 0.08)); env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.1);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.3; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.009, t0 + 0.28);
      l.connect(lg); l.start(t0); l.stop(stop);
      for (const dc of [-2.5, 2.5]) { const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f; osc.detune.value = dc; lg.connect(osc.frequency); osc.connect(env); osc.start(t0); osc.stop(stop); }
      env.connect(lp); lp.connect(dest || this.sfxBus);
      this.noise(0.05, vol * 0.5, { type: 'highpass', freq: 4500, when: when || 0, dest });
    },

    // Кларнет: прямоугольная волна (нечётные гармоники), мягкий фильтр, вибрато к концу ноты
    clarinet(f, dur, vol, when, dest) {
      const c = this.ctx; if (!c || this.muted) return;
      const t0 = c.currentTime + (when || 0), t1 = t0 + Math.max(0.06, dur), stop = t1 + 0.1;
      const env = c.createGain(), lp = c.createBiquadFilter(), osc = c.createOscillator();
      osc.type = 'square'; osc.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 3.2 + 500); lp.Q.value = 0.7;
      env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(vol, t0 + 0.035);
      env.gain.setValueAtTime(vol * 0.9, Math.max(t0 + 0.05, t1 - 0.06)); env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.07);
      const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 4.8; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.006, t0 + Math.max(0.2, dur * 0.7));
      l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(stop);
      osc.connect(env); env.connect(lp); lp.connect(dest || this.sfxBus); osc.start(t0); osc.stop(stop);
    },

    // Контрабас пиццикато и левая рука аккордеона (округлый бас)
    pizz(f, dur, vol, when, dest) {
      const c = this.ctx; if (!c || this.muted) return;
      const t0 = c.currentTime + (when || 0), d = Math.min(Math.max(dur, 0.12), 0.34);
      this.tone(f, d, 'triangle', vol, { when: when || 0, dest, attack: 0.006 });
      this.tone(f * 2, d * 0.6, 'sine', vol * 0.35, { when: when || 0, dest, attack: 0.004 });
    },

    // «Помпа» цыганского свинга: короткий аккорд гитары (ноты чуть вразнобой)
    strum(freqs, vol, when, dest) {
      const c = this.ctx; if (!c || this.muted) return;
      freqs.forEach((f, i) => {
        const t0 = c.currentTime + (when || 0) + i * 0.007, osc = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
        osc.type = 'sawtooth'; osc.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
        osc.connect(g); g.connect(lp); lp.connect(dest || this.sfxBus); osc.start(t0); osc.stop(t0 + 0.16);
      });
    },

    // ------------------------------------------------------------ эффекты
    // Контекст ещё не запущен (первого касания не было: ссылка быстрого старта) или прерван (звонок на iPhone): всё, что планируется сейчас, ляжет в очередь на замороженных часах и грянет разом при запуске (11.10.2026)
    _idle() { return !this.silent && this.ctx.state !== 'running'; },
    sfx(name, o) {
      if (!this.ctx || this.muted || this.vol.sfx <= 0 || this._idle()) return;
      const k = (this.TRIM || TRIM)[name];                              // подрезка отдельных звуков (см. TRIM): и у записи, и у синтеза
      if (k && k !== 1) o = Object.assign({}, o, { vol: ((o && o.vol) || 1) * k });
      if (this._playRec(name, o)) return;
      const f = SFX[name];
      if (f) f(this, ((o && o.vol) || 1) * SYNTH_K);
    },

    // ---- записанные эффекты
    // Скачивает и расшифровывает все записи (они короткие, всего ≈ 0,7 МБ). Ошибка не роняет игру: у эффекта останется синтез.
    loadSfx() {
      const c = this.ctx; if (!c) return;
      for (const name of Object.keys(SX.sounds)) {
        const S = SX.sounds[name], R = this._rec[name] || (this._rec[name] = { bufs: [], gain: S.gain || [], loop: !!S.loop, last: -1 });
        S.f.forEach((file, i) => {
          if (R.bufs[i] || R['p' + i]) return;
          const url = /^(data:|blob:|https?:)/.test(file) ? file : (SX.base || 'assets/audio/sfx/') + file;
          R['p' + i] = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
            .then((ab) => new Promise((res, rej) => { c.decodeAudioData(ab, res, rej); }))
            .then((buf) => { R.bufs[i] = buf; })
            .catch((e) => { R['p' + i] = null; if (window.console) console.warn('эффект ' + name + ': ' + (e && e.message || e)); });
        });
      }
    },
    // Записанный эффект есть и расшифрован → играет (true); иначе false, и сработает синтез. Варианты чередуются (подряд один и тот же — только если другого нет);
    // у единственной записи высота слегка гуляет (±3%), чтобы повтор не звучал механически. Случайность звука (не игры): Math.random, как в остальном audio.js.
    _playRec(name, o) {
      const R = this._rec[name]; if (!R || R.loop) return false;
      const ok = []; for (let i = 0; i < R.bufs.length; i++) if (R.bufs[i]) ok.push(i);
      if (!ok.length) return false;
      let i = ok[Math.floor(Math.random() * ok.length)];
      if (ok.length > 1 && i === R.last) i = ok[(ok.indexOf(i) + 1) % ok.length];
      R.last = i;
      const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
      src.buffer = R.bufs[i];
      if (ok.length === 1) src.playbackRate.value = 0.97 + Math.random() * 0.06;
      g.gain.value = (R.gain[i] === undefined ? 1 : R.gain[i]) * ((o && o.vol) || 1);
      src.connect(g); g.connect(this.sfxBus);
      src.start(c.currentTime + ((o && o.when) || 0));
      return true;
    },
    // Зацикленный эффект «пока жив источник» (катящаяся бочка): источник зовёт hold(имя, громкость 0…1) каждый кадр. Звук идёт одной петлёй (несколько бочек
    // не накладываются друг на друга), громкость — по самому громкому из вызовов за кадр; нет вызова 0,35 с по часам звука (пауза, конец боя, смена сцены) — петля затихает сама.
    hold(name, vol) {
      const c = this.ctx; if (!c || this.muted || this.vol.sfx <= 0 || this._idle()) return;
      const R = this._rec[name]; if (!R || !R.loop) return;
      let i = -1; for (let k = 0; k < R.bufs.length; k++) if (R.bufs[k]) { i = k; break; }
      if (i < 0) return;
      const now = this._now(); let L = this._loops[name];
      if (!L) {
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = R.bufs[i]; src.loop = true; g.gain.value = 0.0001;
        src.connect(g); g.connect(this.sfxBus); src.start();
        L = this._loops[name] = { src, g, base: R.gain[i] === undefined ? 1 : R.gain[i], want: 0, last: now };
        if (!this._loopTimer) this._loopTimer = setInterval(() => this._loopTick(), 100);
        g.gain.setTargetAtTime(Math.max(0.0001, L.base * (vol === undefined ? 1 : vol)), c.currentTime, 0.05);
      }
      L.last = now; L.want = Math.max(L.want, vol === undefined ? 1 : vol);
    },
    _now() { return this.ctx ? this.ctx.currentTime : 0; },       // время звукового контекста (с): им меряется «жив ли источник»; в проверках подменяется
    _loopTick() {
      const now = this._now(), c = this.ctx;
      for (const n of Object.keys(this._loops)) {
        const L = this._loops[n];
        if (!c || now - L.last > 0.35 || this.muted || this.vol.sfx <= 0) {
          delete this._loops[n];
          try { L.g.gain.cancelScheduledValues(c.currentTime); L.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05); } catch (e) { /* ок */ }
          setTimeout(() => { try { L.src.stop(); L.src.disconnect(); L.g.disconnect(); } catch (e) { /* ок */ } }, 400);
        } else if (L.want > 0) { L.g.gain.setTargetAtTime(Math.max(0.0001, L.base * L.want), c.currentTime, 0.08); L.want = 0; }
      }
      if (!Object.keys(this._loops).length) { clearInterval(this._loopTimer); this._loopTimer = 0; }
    },

    // Блип диалога: высота зависит от говорящего.
    blip(who) {
      if (!this.ctx || this.muted || this.vol.sfx <= 0 || this._idle()) return;
      const base = { ale: 560, bubel: 820, clerk: 330, teacher: 270, danechka: 500, preslyukan: 200, agent: 350, ilyushkins: 310, antin: 400, dimasik: 230 }[who] || 440;
      const f = base * (0.92 + Math.random() * 0.16);
      this.tone(f, 0.05, who === 'bubel' ? 'square' : 'triangle', 0.05);
    },

    // ------------------------------------------------------------ музыка
    // Имя трека, если запись есть, иначе запасное: Киев ждёт своих записей (docs/MUSIC.md, раздел «Киев»), пока играют треки Парижа. Как только файлы появятся в tracks.js, сцены подхватят их сами.
    pick(name, fallback) { return FILES[name] ? name : fallback; },
    // Музыка полноэкранного экрана (шахматы, рулетка): пока он открыт, играет свой трек (если запись есть), потом возвращается прежний.
    // Возвращает функцию «вернуть»; без записи — пустую. Прежний трек запоминается по имени, поэтому при выключенной музыке всё тоже работает
    screenMusic(name) {
      const prev = this.current, own = this.pick(name, null);
      if (!own) return () => {};
      this.music(own, { out: 1.4, in: 1.4 });
      return () => { if (this.current === own) this.music(prev, { out: 1.4, in: 1.8 }); };
    },

    // Сменить трек плавно: прежний уходит за o.out секунд (по умолчанию XFADE.out), новый вступает за o.in (по умолчанию fade трека из tracks.js, иначе XFADE.in), и они идут одновременно.
    // Новый трек, который ещё не расшифрован, ждёт: пока он грузится, прежний продолжает играть (а не обрывается тишиной). Тот же трек, что уже играет, не перезапускается —
    // только возвращается громкость, если сцена успела приглушить музыку (dip).
    // o.skipIntro — начать сразу с главной части (rise в tracks.js), минуя вступление (повторная попытка боя: саспенс перед диалогами второй раз не нужен)
    music(name, o) {
      if (!this.ctx) { this.pending = name; this.pendingOpts = o; return; }
      if (name === this.current) { this.undip(); return; }
      this.current = name; this._dipped = false;
      const out = o && o.out !== undefined ? o.out : XFADE.out;
      if (!name || this.muted || this.musicOff) { this._stopSeq(out); this._stopFile(out); return; }
      if (FILES[name]) {
        const swap = (buf) => { if (this.current !== name || this.muted || this.musicOff) return; this._stopSeq(out); this._stopFile(out); this._startBuffer(name, buf, o); };
        const rec = this._files[name];
        if (rec && rec.buf) swap(rec.buf);
        else this.preload(name).then((buf) => { if (this.current !== name || this.muted || this.musicOff) return; if (buf) swap(buf); else { this._stopFile(out); this._playSynth(name, o); } });
        this._prefetchSoon(NEXT[name], 2.5);
        return;
      }
      this._stopFile(out); this._playSynth(name, o);
    },

    // Приглушить музыку на время перехода между сценами (затемнение): до доли level (по умолчанию XFADE.dip) за dur секунд. Если следующая сцена играет тот же трек, music()
    // вернёт громкость сама; если другой — прежний уходит из приглушённого уровня, новый вступает с нуля.
    dip(level, dur) {
      if (!this.ctx || this.muted || this.musicOff) return;
      const k = level === undefined ? XFADE.dip : level, d = dur === undefined ? XFADE.dipTime : dur;
      this._dipped = true;
      if (this.file) this._fade(this.file, this.file.vol * k, d);
      if (this.seq) this._fadeSeq(this.seq, k, d);
    },
    undip(dur) {
      if (!this._dipped || !this.ctx) return;
      this._dipped = false;
      const d = dur === undefined ? XFADE.undip : dur;
      if (this.file) this._fade(this.file, this.file.vol, d);
      if (this.seq) this._fadeSeq(this.seq, 1, d);
    },

    // ---- записанные треки
    // Скачивает и расшифровывает трек (один раз). Ошибка не роняет игру: вернёт null, и заиграет синтез.
    preload(name) {
      const F = FILES[name]; if (!F || !this.ctx) return Promise.resolve(null);
      const rec = this._files[name] || (this._files[name] = { buf: null, p: null, used: 0 });
      rec.used = ++this._use;                       // порядок обращений (для вытеснения самого давнего), не часы
      if (rec.buf) return Promise.resolve(rec.buf);
      if (rec.p) return rec.p;
      const url = /^(data:|blob:|https?:)/.test(F.f) ? F.f : (AU.base || 'assets/audio/') + F.f;
      let dc = null;          // контекст, которым расшифровывали: если его за это время пересоздали (_rebuild закрывает старый, и расшифровка в нём обрывается), пробуем ещё раз новым, а не уходим в синтез
      rec.p = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then((ab) => new Promise((res, rej) => { dc = this.ctx; dc.decodeAudioData(ab, res, rej); }))
        .then((buf) => { rec.buf = buf; this._evict(name); return buf; })
        .catch((e) => { rec.p = null; if (dc && dc !== this.ctx && !rec.retried) { rec.retried = true; return this.preload(name); } rec.failed = true; if (window.console) console.warn('музыка ' + name + ': ' + (e && e.message || e)); return null; });
      return rec.p;
    },
    prefetch(names) { for (const n of names || []) if (FILES[n] && !this.muted && !this.musicOff) this.preload(n); },
    // Следующие по маршруту треки подгружаются через delay с, но не посреди ловушки заставки (отъезд камеры, 12,5 с): расшифровка длинного трека — десятки мегабайт, а анимация и без того тяжёлая на телефоне (18.10.2026)
    _prefetchSoon(names, delay) {
      setTimeout(() => {
        if (Ale.Title && Ale.Title.phase === 'intro') { this._prefetchSoon(names, 1); return; }
        this.prefetch(names);
      }, delay * 1000);
    },
    // В памяти — не больше KEEP расшифрованных треков (по 30–70 МБ каждый): самый давний из лишних выбрасывается, играющий — никогда
    _evict(keep) {
      const have = Object.keys(this._files).filter((n) => this._files[n].buf);
      while (have.length > KEEP) {
        const old = have.filter((n) => n !== keep && n !== this.current).sort((a, b) => this._files[a].used - this._files[b].used)[0];
        if (!old) break;
        this._files[old].buf = null; this._files[old].p = null; have.splice(have.indexOf(old), 1);
      }
    },
    _startBuffer(name, buf, o) {
      const c = this.ctx, F = FILES[name], src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf;
      if (F.loop) { src.loop = true; src.loopStart = F.loop[0]; src.loopEnd = F.loop[1]; }
      g.gain.value = 0.0001;
      src.connect(g); g.connect(this.fileBus);
      const off = o && o.at > 0 ? o.at : o && o.skipIntro ? (F.rise || (F.loop && F.loop[0]) || 0) : 0;
      // at — с какого места файла (секунды от начала, петли считаются: так меряет musicTime) продолжить: пересозданный контекст в заплыве продолжает трек с того же места, а не с начала
      let pos = off;
      if (o && o.at > 0 && F.loop) { const a = F.loop[0], b = F.loop[1] > a ? F.loop[1] : buf.duration; if (b > a && pos >= b) pos = a + (pos - a) % (b - a); }          // петля [0, 0] — весь файл
      src.start(0, buf.duration > 0 ? Math.min(pos, buf.duration - 0.01) : pos);       // skipIntro: сразу с места, где вступает главная часть (rise), иначе с начала петли
      const f = this.file = { name, src, g, vol: F.vol || 1, t0: c.currentTime, off, env: { t0: c.currentTime, dur: 0, from: 0.0001, to: 0.0001 } };          // t0 и off — когда и с какого места файл пошёл: по ним заплыв сверяет свои часы с музыкой (musicTime)
      // вход: заданный в o.in, иначе fade трека; начатый с главной части вступает быстрее (иначе плавный вход съел бы её начало)
      this._fade(f, f.vol, o && o.in !== undefined ? o.in : (F.fade !== undefined ? F.fade : (o && o.skipIntro ? 0.5 : XFADE.in)));
      if (this._files[name]) this._files[name].used = ++this._use;
    },
    // Сколько секунд играет запись name с начала файла (петли не сбрасывают счёт: у заплыва сетка долей идёт мимо них); null — её сейчас нет, контекст не идёт (пауза, фон) или это не тот трек
    musicTime(name) {
      const f = this.file, c = this.ctx;
      if (!f || !c || f.name !== name || c.state !== 'running' || f.t0 === undefined) return null;
      return c.currentTime - f.t0 + (f.off || 0);
    },
    // Плавное изменение громкости записи f (f.g — её усилитель) от текущего уровня к level за dur секунд по кривой shapeOf. Текущий уровень считается по записанной огибающей f.env,
    // а не читается из узла: так не зависит от того, что браузер отдаёт посреди рампы.
    _fade(f, level, dur) {
      const c = this.ctx, now = c.currentTime, p = f.g.gain, from = Math.max(0.0001, this._level(f, now)), to = Math.max(0.0001, level), d = Math.max(0, dur || 0);
      try {
        p.cancelScheduledValues(now); p.setValueAtTime(from, now);
        const N = d > 0 ? Math.max(2, Math.min(60, Math.round(d * 16))) : 1;
        for (let i = 1; i <= N; i++) p.linearRampToValueAtTime(shapeOf(from, to, i / N), now + d * i / N + (d > 0 ? 0 : 0.005));
      } catch (e) { /* ок */ }
      f.env = { t0: now, dur: d, from, to };
    },
    _level(f, now) {
      const e = f.env; if (!e) return f.vol;
      return shapeOf(e.from, e.to, e.dur > 0 ? Math.max(0, Math.min(1, (now - e.t0) / e.dur)) : 1);
    },
    _stopFile(fade) {
      const f = this.file; if (!f) return;
      this.file = null;
      const d = fade === undefined ? XFADE.out : fade;
      this._fade(f, 0.0001, d);
      setTimeout(() => { try { f.src.stop(); f.src.disconnect(); f.g.disconnect(); } catch (e) { /* ок */ } }, (d + 0.3) * 1000);
    },

    // ---- синтезированный трек (запасной вариант, если записи нет)
    _playSynth(name, o) {
      if (!name || !TRACKS[name] || this.muted || this.musicOff) return;
      const c = this.ctx, T = TRACKS[name];
      if (this.seq) this._stopSeq(o && o.out !== undefined ? o.out : XFADE.out);          // прежний синтезный трек уходит плавно, а не остаётся с живым таймером (два запасных трека подряд: утечка таймера и обрыв, 18.10.2026)
      const seq = (this.seq = { name, T, step: 0, next: c.currentTime + 0.12, timer: null, bus: c.createGain(), k: 1 });
      seq.bus.gain.value = 0.0001; seq.bus.gain.linearRampToValueAtTime(1, c.currentTime + (o && o.in !== undefined ? o.in : XFADE.in));
      seq.bus.connect(this.musBus);
      const eighth = 60 / T.bpm / 2;
      const tick = () => {
        if (this.seq !== seq) return;
        while (seq.next < c.currentTime + 0.3) {
          this._playStep(seq, seq.step % T.steps, seq.next, eighth);
          seq.next += eighth * (T.swing && seq.step % 2 === 0 ? 1 + T.swing : (T.swing ? 1 - T.swing : 1));
          seq.step++;
        }
      };
      seq.timer = setInterval(tick, 60);
      tick();
    },

    stopMusic() { this.current = null; this._stopSeq(0.5); this._stopFile(0.5); },

    // Синтезный трек уходит и меняет громкость так же плавно, как записанный: последовательность нот останавливается сразу (уже запланированное на 0,3 с вперёд доиграет), шина затухает
    _stopSeq(fade) {
      const s = this.seq; if (!s) return;
      clearInterval(s.timer);
      const d = fade === undefined ? 0.5 : fade, now = this.ctx.currentTime;
      try { s.bus.gain.cancelScheduledValues(now); s.bus.gain.setValueAtTime(Math.max(0.0001, s.bus.gain.value), now); s.bus.gain.setTargetAtTime(0.0001, now, Math.max(0.05, d / 4)); } catch (e) { /* ок */ }
      const bus = s.bus; setTimeout(() => { try { bus.disconnect(); } catch (e) { /* ок */ } }, (d + 0.5) * 1000);
      this.seq = null;
    },
    _fadeSeq(s, k, d) {
      const now = this.ctx.currentTime;
      try { s.bus.gain.cancelScheduledValues(now); s.bus.gain.setValueAtTime(Math.max(0.0001, s.bus.gain.value), now); s.bus.gain.setTargetAtTime(Math.max(0.0001, k), now, Math.max(0.05, d / 4)); } catch (e) { /* ок */ }
      s.k = k;
    },

    // Один шаг сетки (восьмая): мелодия, бас, аккорды, ударные. Ячейка мелодии: 'нота' | ['нота', длина в восьмых] | { run: [ноты] } — несколько быстрых нот в одну восьмую (трель, пассаж).
    _playStep(seq, i, t, eighth) {
      const c = this.ctx, T = seq.T, bus = seq.bus, d = t - c.currentTime, w0 = Math.max(0, d);
      const each = (arr, fn) => {
        if (!arr) return;
        const n = arr[i % arr.length];
        if (!n || n === '-') return;
        if (n.run) { const k = n.run.length; n.run.forEach((nm, j) => { if (nm && nm !== '-') fn(nm, eighth * 0.94 / k, Math.max(0, d + eighth * j / k)); }); return; }
        const [nm, len] = Array.isArray(n) ? n : [n, 1];
        fn(nm, len * eighth, w0);
      };
      const LV = T.leadVoice || 'square', lv = T.leadVol || 0.10;
      each(T.lead, (nm, dur, w) => {
        const f = freqOf(nm);
        if (LV === 'accordion') this.accordion(f, dur * 0.97, lv, w, bus, { staccato: !!T.leadStaccato });
        else if (LV === 'violin') this.violin(f, dur, lv, w, bus);
        else if (LV === 'clarinet') this.clarinet(f, dur, lv, w, bus);
        else { this.tone(f, dur * 0.95, T.leadType || 'square', lv, { when: w, dest: bus, vib: 5.5, attack: 0.01 }); this.tone(f * 1.006, dur * 0.95, 'sawtooth', lv * 0.5, { when: w, dest: bus, attack: 0.01 }); }
      });
      each(T.bass, (nm, dur, w) => {
        const f = freqOf(nm);
        if (T.bassVoice === 'pizz') this.pizz(f, dur, 0.2, w, bus);
        else { this.tone(f, Math.min(dur, eighth * 1.6), 'triangle', 0.17, { when: w, dest: bus, attack: 0.006 }); this.tone(f * 2, Math.min(dur, eighth * 1.0), 'sine', 0.045, { when: w, dest: bus, attack: 0.004 }); }
      });
      if (T.chord) {
        const ch = T.chord[i % T.chord.length];
        if (ch) {
          if (T.chordVoice === 'strum') this.strum(ch.map(freqOf), T.chordVol || 0.05, w0, bus);
          else for (const nm of ch) this.accordion(freqOf(nm), eighth * 0.62, T.chordVol || 0.035, w0, bus, { chord: true, staccato: true });
        }
      }
      if (T.perc) {
        const p = T.perc[i % T.perc.length];
        if (p === 'k') { this.tone(120, 0.14, 'sine', 0.30, { when: w0, dest: bus, to: 45 }); }
        else if (p === 's') this.noise(0.11, 0.16, { when: w0, dest: bus, type: 'bandpass', freq: 1900, q: 0.7 });
        else if (p === 'h') this.noise(0.04, 0.06, { when: w0, dest: bus, type: 'highpass', freq: 7000 });
        else if (p === 'b') this.noise(0.09, 0.07, { when: w0, dest: bus, type: 'bandpass', freq: 3200, q: 0.5 });       // щётки по малому барабану
      }
    },
  });

  // ------------------------------------------------------------ эффекты (имя → функция)
  const SFX = {
    step: (a, v) => { a.noise(0.05, 0.05 * v, { type: 'bandpass', freq: 900, q: 1.2 }); a.tone(110, 0.06, 'sine', 0.06 * v, { to: 70 }); },
    jump: (a, v) => a.tone(280, 0.13, 'square', 0.10 * v, { to: 620 }),
    land: (a, v) => { a.tone(150, 0.1, 'sine', 0.2 * v, { to: 60 }); a.noise(0.08, 0.08 * v, { type: 'lowpass', freq: 700 }); a.noise(0.03, 0.1 * v, { type: 'bandpass', freq: 1500, q: 0.9 }); },
    // Удар ногой о землю: щелчок-«удар» (1,8 кГц), «тело» звука (260→90 Гц — слышно и на ноутбучных динамиках), низкий гул и шорох пыли.
    // Всё начинается в один и тот же миг — иначе слух отделяет звук от касания.
    stomp: (a, v) => { a.noise(0.045, 0.34 * v, { type: 'bandpass', freq: 1800, q: 0.9 }); a.tone(280, 0.11, 'triangle', 0.28 * v, { to: 95 }); a.tone(150, 0.2, 'sine', 0.25 * v, { to: 48 }); a.noise(0.1, 0.13 * v, { type: 'highpass', freq: 2800, when: 0.02 }); },
    throw: (a, v) => { a.noise(0.34, 0.12 * v, { type: 'bandpass', freq: 380, to: 1500, q: 0.7, attack: 0.09 }); a.noise(0.3, 0.06 * v, { type: 'highpass', freq: 2400, attack: 0.09, when: 0.03 }); },
    throw2: (a, v) => a.noise(0.16, 0.2 * v, { type: 'bandpass', freq: 500, to: 1900, q: 1.5 }),
    snort: (a, v) => { a.noise(0.17, 0.2 * v, { type: 'lowpass', freq: 1500, to: 480, q: 0.6, attack: 0.03 }); a.noise(0.22, 0.17 * v, { type: 'lowpass', freq: 1300, to: 420, q: 0.6, attack: 0.03, when: 0.22 }); a.tone(105, 0.32, 'sine', 0.07 * v, { to: 78, attack: 0.05 }); },
    beep: (a, v) => { a.tone(1180, 0.32, 'square', 0.1 * v); a.tone(1180, 0.32, 'square', 0.1 * v, { when: 0.4 }); },
    chime: (a, v) => { a.tone(freqOf('E5'), 0.5, 'sine', 0.16 * v); a.tone(freqOf('C5'), 0.7, 'sine', 0.16 * v, { when: 0.28 }); a.tone(freqOf('G5'), 0.5, 'sine', 0.06 * v, { when: 0.0 }); },
    hoof: (a, v) => { a.tone(140, 0.05, 'triangle', 0.14 * v, { to: 85 }); a.noise(0.04, 0.09 * v, { type: 'bandpass', freq: 1700, q: 1.2 }); },
    boing: (a, v) => { a.tone(240, 0.16, 'sine', 0.3 * v, { to: 720 }); a.tone(480, 0.1, 'triangle', 0.12 * v, { to: 900, when: 0.03 }); a.noise(0.05, 0.1 * v, { type: 'bandpass', freq: 1400 }); },
    empty: (a, v) => a.tone(95, 0.05, 'square', 0.08 * v),
    hurt: (a, v) => { a.tone(360, 0.28, 'sawtooth', 0.16 * v, { to: 90 }); a.noise(0.14, 0.14 * v, { type: 'lowpass', freq: 1500 }); },
    splat: (a, v) => { a.noise(0.2, 0.22 * v, { type: 'lowpass', freq: 1200, to: 200, q: 0.7 }); a.tone(220, 0.14, 'sine', 0.2 * v, { to: 70 }); },
    chalk: (a, v) => { a.noise(0.05, 0.14 * v, { type: 'highpass', freq: 3200 }); a.noise(0.05, 0.1 * v, { type: 'highpass', freq: 4200, when: 0.05 }); },
    paper: (a, v) => a.noise(0.13, 0.13 * v, { type: 'bandpass', freq: 1600, q: 0.9 }),
    // сюжетная открытка появляется: шорох страницы и мягкий двойной колокольчик
    card: (a, v) => { a.noise(0.26, 0.09 * v, { type: 'bandpass', freq: 1300, to: 3400, q: 0.8, attack: 0.06 }); a.tone(freqOf('E6'), 0.7, 'sine', 0.05 * v, { when: 0.14 }); a.tone(freqOf('B6'), 0.8, 'sine', 0.035 * v, { when: 0.24 }); },
    squeak: (a, v) => { a.tone(1400, 0.07, 'triangle', 0.10 * v, { to: 1900 }); a.tone(1500, 0.07, 'triangle', 0.10 * v, { to: 2000, when: 0.09 }); },
    rat_leap: (a, v) => a.tone(520, 0.11, 'triangle', 0.13 * v, { to: 950 }),
    rat_die: (a, v) => { a.tone(820, 0.16, 'square', 0.12 * v, { to: 200 }); a.noise(0.1, 0.1 * v, { type: 'lowpass', freq: 900 }); },
    teacher_windup: (a, v) => a.tone(230, 0.34, 'sine', 0.07 * v, { to: 340, vib: 8 }),
    slap: (a, v) => { a.noise(0.09, 0.2 * v, { type: 'bandpass', freq: 1300, q: 0.8 }); a.tone(320, 0.1, 'sine', 0.16 * v, { to: 120 }); },
    teacher_hit: (a, v) => { a.tone(260, 0.3, 'sawtooth', 0.14 * v, { to: 130, vib: 9 }); a.noise(0.22, 0.2 * v, { type: 'lowpass', freq: 1100, to: 200 }); a.tone(180, 0.16, 'sine', 0.22 * v, { to: 60 }); },
    stomp_hit: (a, v) => { a.tone(160, 0.14, 'sine', 0.3 * v, { to: 60 }); a.noise(0.08, 0.16 * v, { type: 'bandpass', freq: 900 }); },
    teacher_flee: (a, v) => a.tone(900, 0.7, 'triangle', 0.10 * v, { to: 210, vib: 10 }),
    key_drop: (a, v) => { a.tone(1900, 0.12, 'sine', 0.12 * v); a.tone(2500, 0.1, 'sine', 0.08 * v, { when: 0.05 }); },
    key_get: (a, v) => { ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => a.tone(freqOf(n), 0.16, 'triangle', 0.16 * v, { when: i * 0.07 })); },
    key_grab: (a, v) => { a.noise(0.08, 0.14 * v, { type: 'highpass', freq: 2500 }); a.tone(1800, 0.09, 'sine', 0.1 * v, { when: 0.05 }); },
    key_use: (a, v) => { a.tone(1500, 0.05, 'square', 0.08 * v); a.tone(2200, 0.09, 'sine', 0.1 * v, { when: 0.06 }); },
    locked: (a, v) => { a.tone(92, 0.06, 'square', 0.12 * v); a.tone(84, 0.08, 'square', 0.12 * v, { when: 0.09 }); },
    pickup: (a, v) => { a.tone(freqOf('E5'), 0.09, 'triangle', 0.16 * v); a.tone(freqOf('A5'), 0.16, 'triangle', 0.16 * v, { when: 0.08 }); },
    ui: (a, v) => a.tone(700, 0.05, 'square', 0.12 * v),
    ui2: (a, v) => a.tone(900, 0.08, 'square', 0.08 * v, { to: 1300 }),
    hatch_crack: (a, v) => { a.noise(0.18, 0.28 * v, { type: 'lowpass', freq: 2200, to: 300 }); a.tone(140, 0.2, 'sine', 0.3 * v, { to: 50 }); a.noise(0.05, 0.16 * v, { type: 'highpass', freq: 3500, when: 0.05 }); },
    // самый громкий из синтезированных: ограничитель шин сжимал его, и общий множитель SYNTH_K снижал его лишь на 2 дБ(A) вместо 4,4 — добавка ×0,73 доводит до ≈ −4 дБ(A)
    hatch_break: (a, v) => { v *= 0.73; a.noise(0.5, 0.36 * v, { type: 'lowpass', freq: 2600, to: 180 }); a.tone(110, 0.4, 'sine', 0.42 * v, { to: 35 }); a.tone(300, 0.2, 'square', 0.08 * v, { to: 90, when: 0.03 }); },
    hatch_open: (a, v) => a.tone(120, 0.45, 'sawtooth', 0.08 * v, { to: 210, vib: 9 }),
    hatch_slam: (a, v) => { a.tone(90, 0.2, 'sine', 0.4 * v, { to: 38 }); a.noise(0.14, 0.2 * v, { type: 'lowpass', freq: 900 }); },
    barrel_break: (a, v) => { a.noise(0.2, 0.24 * v, { type: 'bandpass', freq: 700, q: 0.7 }); a.tone(300, 0.1, 'sine', 0.22 * v, { to: 100 }); a.tone(240, 0.1, 'sine', 0.18 * v, { to: 90, when: 0.06 }); },
    giggle: (a, v) => { [900, 1150, 1000, 1300].forEach((f, i) => a.tone(f, 0.06, 'triangle', 0.09 * v, { when: i * 0.075, vib: 20 })); },
    bark: (a, v) => { a.tone(430, 0.1, 'square', 0.13 * v, { to: 300 }); a.noise(0.08, 0.08 * v, { type: 'bandpass', freq: 1300 }); a.tone(390, 0.1, 'square', 0.12 * v, { to: 260, when: 0.14 }); },
    cabinet_open: (a, v) => { a.tone(150, 0.5, 'sawtooth', 0.06 * v, { to: 230, vib: 7 }); a.tone(1400, 0.05, 'square', 0.08 * v, { when: 0.02 }); },
    parcel_open: (a, v) => { a.noise(0.3, 0.16 * v, { type: 'bandpass', freq: 1800, q: 0.7 }); a.tone(500, 0.12, 'sine', 0.2 * v, { to: 900, when: 0.25 }); },
    fanfare: (a, v) => { ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => { a.tone(freqOf(n), i > 3 ? 0.5 : 0.18, 'square', 0.1 * v, { when: i * 0.13, vib: 6 }); a.tone(freqOf(n) / 2, i > 3 ? 0.5 : 0.18, 'triangle', 0.16 * v, { when: i * 0.13 }); }); },
    firework: (a, v) => { a.noise(0.5, 0.16 * v, { type: 'lowpass', freq: 500, to: 80 }); a.noise(0.3, 0.1 * v, { type: 'highpass', freq: 4000, when: 0.15 }); },
    dial: (a, v) => { a.tone(1300, 0.02, 'square', 0.07 * v); a.tone(900, 0.03, 'square', 0.05 * v, { when: 0.02 }); },
    unlock: (a, v) => { a.tone(1200, 0.04, 'square', 0.1 * v); a.tone(freqOf('G5'), 0.1, 'triangle', 0.16 * v, { when: 0.06 }); a.tone(freqOf('C6'), 0.2, 'triangle', 0.16 * v, { when: 0.14 }); },
    wrong: (a, v) => a.tone(210, 0.28, 'sawtooth', 0.12 * v, { to: 120 }),
    // ---- Киев: мягкие эффекты (резких хлопков и «выстрелов» нет — владелец 02.10.2026; весь синтез играет ×0,6, см. SYNTH_K)
    phone: (a, v) => { a.tone(freqOf('E5'), 0.12, 'sine', 0.16 * v); a.tone(freqOf('B5'), 0.2, 'sine', 0.14 * v, { when: 0.11 }); },
    msg: (a, v) => { a.tone(880, 0.05, 'triangle', 0.1 * v, { to: 1180 }); a.tone(1320, 0.09, 'sine', 0.09 * v, { when: 0.05 }); },
    roach_die: (a, v) => { a.noise(0.06, 0.16 * v, { type: 'bandpass', freq: 1200, q: 1.5 }); a.tone(180, 0.08, 'sine', 0.12 * v, { to: 90 }); },
    sling: (a, v) => { a.tone(420, 0.09, 'sine', 0.1 * v, { to: 240 }); a.noise(0.07, 0.05 * v, { type: 'highpass', freq: 3000, when: 0.02 }); },
    dart: (a, v) => a.noise(0.12, 0.09 * v, { type: 'bandpass', freq: 1800, to: 700, q: 1.1 }),
    dart_tink: (a, v) => { a.tone(2100, 0.05, 'triangle', 0.08 * v, { to: 1500 }); a.noise(0.03, 0.05 * v, { type: 'highpass', freq: 3500 }); },
    sling_pull: (a, v) => a.noise(0.18, 0.05 * v, { type: 'bandpass', freq: 700, to: 1500, q: 2.2, attack: 0.06 }),
    sling_lock: (a, v) => a.tone(freqOf('E5'), 0.07, 'sine', 0.09 * v, { to: freqOf('G5') }),
    sling_full: (a, v) => { a.tone(freqOf('G5'), 0.06, 'sine', 0.1 * v); a.tone(freqOf('C6'), 0.1, 'sine', 0.09 * v, { when: 0.05 }); },
    ball_lob: (a, v) => { a.noise(0.35, 0.12 * v, { type: 'lowpass', freq: 500, to: 900, q: 0.7, attack: 0.08 }); a.tone(120, 0.3, 'sine', 0.12 * v, { to: 80 }); },
    shutter: (a, v) => { a.noise(0.03, 0.085 * v, { type: 'highpass', freq: 2600 }); a.tone(1700, 0.025, 'square', 0.04 * v, { to: 900, when: 0.03 }); a.noise(0.025, 0.065 * v, { type: 'highpass', freq: 3200, when: 0.07 }); },       // пики до 1,04 в проверке «без перегруза» были не громкостью, а начальным усилением узла в noise() (исправлено там)
    ball_push: (a, v) => a.noise(0.14, 0.16 * v, { type: 'lowpass', freq: 1100, q: 0.7, attack: 0.03 }),
    soft_hit: (a, v) => { a.tone(210, 0.07, 'sine', 0.2 * v, { to: 120 }); a.noise(0.04, 0.07 * v, { type: 'lowpass', freq: 900 }); },
    ball_hit: (a, v) => { a.tone(150, 0.14, 'sine', 0.3 * v, { to: 70 }); a.noise(0.05, 0.1 * v, { type: 'lowpass', freq: 700 }); },
    dumb_land: (a, v) => { a.tone(110, 0.2, 'sine', 0.3 * v, { to: 52 }); a.noise(0.09, 0.12 * v, { type: 'lowpass', freq: 600 }); },
    dim_wind: (a, v) => a.noise(0.3, 0.07 * v, { type: 'lowpass', freq: 500, to: 900, q: 0.7, attack: 0.12 }),
    disc_fly: (a, v) => a.noise(0.25, 0.06 * v, { type: 'bandpass', freq: 1500, to: 2400, q: 1.8, attack: 0.05 }),
    kiss: (a, v) => { a.tone(620, 0.05, 'sine', 0.12 * v, { to: 920 }); a.noise(0.04, 0.05 * v, { type: 'bandpass', freq: 2400, q: 1.4, when: 0.05 }); },
    // Монако: плеск воды (упала с камня, китёныш), рывок (воришка выхватил пачку), дуновение на свечи — мягкие, без резких щелчков
    // заплыв через Днепр (src/river.js): гребок, удар о корягу, мина (синтез ×0,6, как у остальных; записи — очередь в docs/SFX.md)
    oar: (a, v) => { a.noise(0.34, 0.1 * v, { type: 'bandpass', freq: 720, to: 280, q: 0.7, attack: 0.05 }); a.tone(135, 0.14, 'sine', 0.14 * v, { to: 80 }); a.noise(0.05, 0.05 * v, { type: 'highpass', freq: 2600, when: 0.02 }); },
    log_hit: (a, v) => { a.tone(125, 0.18, 'triangle', 0.3 * v, { to: 58 }); a.noise(0.13, 0.15 * v, { type: 'lowpass', freq: 900 }); a.noise(0.05, 0.06 * v, { type: 'bandpass', freq: 1800, q: 1.2 }); },
    mine_boom: (a, v) => { a.tone(86, 0.55, 'sine', 0.42 * v, { to: 30 }); a.noise(0.6, 0.3 * v, { type: 'lowpass', freq: 1800, to: 120 }); a.noise(0.22, 0.14 * v, { type: 'bandpass', freq: 900, q: 0.6, when: 0.05 }); a.noise(0.3, 0.12 * v, { type: 'bandpass', freq: 1500, to: 500, q: 0.8, attack: 0.012, when: 0.1 }); },
    splash: (a, v) => { a.noise(0.3, 0.13 * v, { type: 'bandpass', freq: 1500, to: 520, q: 0.8, attack: 0.012 }); a.tone(300, 0.12, 'sine', 0.08 * v, { to: 130 }); },
    grab: (a, v) => a.noise(0.18, 0.11 * v, { type: 'bandpass', freq: 900, to: 2400, q: 0.9, attack: 0.025 }),
    blow: (a, v) => a.noise(0.26, 0.07 * v, { type: 'bandpass', freq: 1800, to: 900, q: 0.6, attack: 0.06 }),
    gate: (a, v) => a.tone(300, 0.08, 'triangle', 0.1 * v, { to: 200 }),
    // ---- Шахматы (src/chess.js): мягкое дерево, без хлопков. Ход — глухой «тук» фигуры о доску, взятие — ниже и плотнее, выбор — тихий щелчок, неудача — два мягких нисходящих тона,
    // мат — тёплый аккорд, скольжение оставшихся фигур — шорох. В ускоренной партии модуль сам просит их реже и тише (каждый ход, потом каждый второй, потом каждый четвёртый).
    chess_move: (a, v) => { a.tone(210, 0.08, 'sine', 0.22 * v, { to: 130 }); a.noise(0.04, 0.07 * v, { type: 'lowpass', freq: 1400 }); },
    chess_take: (a, v) => { a.tone(165, 0.1, 'sine', 0.26 * v, { to: 95 }); a.noise(0.06, 0.09 * v, { type: 'lowpass', freq: 1000 }); a.tone(250, 0.05, 'triangle', 0.07 * v, { to: 160, when: 0.045 }); },
    chess_pick: (a, v) => a.tone(820, 0.06, 'triangle', 0.12 * v, { to: 640 }),
    chess_no: (a, v) => { a.tone(freqOf('A3'), 0.16, 'sine', 0.12 * v, { to: freqOf('F3') }); a.tone(freqOf('E3'), 0.22, 'sine', 0.1 * v, { to: freqOf('C3'), when: 0.12 }); },
    chess_mate: (a, v) => { ['C4', 'E4', 'G4', 'C5'].forEach((n, i) => a.tone(freqOf(n), 1.1 - i * 0.08, 'triangle', 0.08 * v, { when: i * 0.06, attack: 0.04 })); a.tone(freqOf('E5'), 0.9, 'sine', 0.045 * v, { when: 0.24, attack: 0.05 }); },
    chess_whoosh: (a, v) => a.noise(0.7, 0.05 * v, { type: 'bandpass', freq: 500, to: 2200, q: 0.7, attack: 0.18 }),
    // ---- Автомат с короной (src/casino.js, казино в Монако): мягкие и тихие, без хлопков (весь синтез играет ×0,6, см. SYNTH_K). Стук барабанов и остановка — деревянный «тук», рычаг — трещотка
    // и глухой упор, монета — тонкий звон, джекпот — короткая восходящая фанфара, карта — шорох бумаги, проигрыш — два мягких нисходящих тона.
    reel_tick: (a, v) => { a.tone(1500, 0.02, 'triangle', 0.07 * v, { to: 950 }); a.noise(0.02, 0.04 * v, { type: 'highpass', freq: 3200 }); },
    reel_stop: (a, v) => { a.tone(185, 0.1, 'sine', 0.2 * v, { to: 95 }); a.noise(0.05, 0.07 * v, { type: 'lowpass', freq: 1300 }); a.tone(1100, 0.03, 'triangle', 0.05 * v, { when: 0.005 }); },
    lever: (a, v) => { for (let i = 0; i < 4; i++) a.tone(900 - i * 60, 0.025, 'triangle', 0.07 * v, { when: i * 0.05 }); a.noise(0.24, 0.04 * v, { type: 'bandpass', freq: 700, to: 320, q: 0.9, attack: 0.04 }); a.tone(125, 0.13, 'sine', 0.14 * v, { when: 0.2, to: 60 }); },
    coin: (a, v) => { a.tone(2093, 0.12, 'sine', 0.07 * v, { attack: 0.003 }); a.tone(3136, 0.09, 'sine', 0.04 * v, { when: 0.03, attack: 0.003 }); },
    jackpot: (a, v) => { ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => a.tone(freqOf(n), 0.24, 'triangle', 0.1 * v, { when: i * 0.1, attack: 0.01 })); ['C5', 'E5', 'G5', 'C6'].forEach((n) => a.tone(freqOf(n), 0.8, 'sine', 0.05 * v, { when: 0.42, attack: 0.03 })); a.tone(freqOf('E6'), 0.7, 'sine', 0.035 * v, { when: 0.46, attack: 0.03 }); },
    casino_win: (a, v) => { a.tone(freqOf('E5'), 0.14, 'triangle', 0.1 * v, { attack: 0.008 }); a.tone(freqOf('A5'), 0.3, 'triangle', 0.1 * v, { when: 0.1, attack: 0.008 }); a.tone(freqOf('E6'), 0.4, 'sine', 0.035 * v, { when: 0.16 }); },
    card_flip: (a, v) => { a.noise(0.14, 0.07 * v, { type: 'bandpass', freq: 1800, to: 3600, q: 0.8, attack: 0.03 }); a.tone(480, 0.05, 'triangle', 0.05 * v, { when: 0.1, to: 360 }); },
    casino_lose: (a, v) => { a.tone(freqOf('A3'), 0.18, 'sine', 0.12 * v, { to: freqOf('F3') }); a.tone(freqOf('E3'), 0.26, 'sine', 0.1 * v, { to: freqOf('C3'), when: 0.14 }); },
    casino_pick: (a, v) => a.tone(720, 0.05, 'triangle', 0.1 * v, { to: 560 }),
    casino_bet: (a, v) => { a.tone(1250, 0.05, 'triangle', 0.1 * v, { to: 900 }); a.tone(1800, 0.04, 'sine', 0.05 * v, { when: 0.035 }); a.noise(0.03, 0.04 * v, { type: 'highpass', freq: 3000 }); },
    // Рулетка (src/roulette.js): колесо раскручивается — мягкий нарастающий шорох с низким гулом; шарик сходит на кольцо — три убывающих деревянных «тук» (без хлопков)
    wheel_whirr: (a, v) => { a.noise(1.0, 0.011 * v, { type: 'bandpass', freq: 380, to: 1000, q: 0.7, attack: 0.35 }); a.tone(96, 0.9, 'sine', 0.045 * v, { to: 150, attack: 0.3 }); },
    ball_drop: (a, v) => { [[520, 0.14, 0], [470, 0.09, 0.1], [430, 0.05, 0.17]].forEach((n) => a.tone(n[0], 0.07, 'sine', n[1] * v, { when: n[2], to: n[0] * 0.62, attack: 0.005 })); a.noise(0.05, 0.04 * v, { type: 'lowpass', freq: 1500 }); },
  };

  // Запасные синтезные варианты для записанных эффектов (docs/SFX.md): играют, только если файл не загрузился. Катящейся бочке (barrel_roll) запасного звука нет — она тихая.
  SFX.throw_chalk = SFX.throw_paper = SFX.throw2;
  SFX.barrel_kick = SFX.barrel_smash = SFX.barrel_break;
  SFX.horse_munch = (a, v) => { for (let i = 0; i < 3; i++) a.noise(0.09, 0.12 * v, { type: 'bandpass', freq: 1100, q: 1.1, when: i * 0.28 }); };

  // ------------------------------------------------------------ музыка
  // Каждый трек: bpm (четверть), steps — длина цикла в восьмых; lead/bass/chord/perc — по восьмым (длина массивов равна steps).
  // Голоса: leadVoice — accordion | violin | clarinet; bassVoice — pizz | (по умолчанию бас-пуговица); chordVoice — strum | (по умолчанию аккордеон).
  // Стиль — французский: вальс-мюзетт (аккордеон, бас «ум-па-па»), галоп в духе канкана, цыганский свинг; мелодии написаны для игры, на слух пока не проверялись.
  const R = '-';
  const n = (nm, len) => { len = len || 1; const a = [[nm, len]]; for (let i = 1; i < len; i++) a.push(R); return a; };      // нота длиной len восьмых
  const rest = (len) => Array((len || 1)).fill(R);
  const sub = (...notes) => [{ run: notes }];                                                                        // быстрый пассаж/трель в одну восьмую
  const line = (...parts) => parts.reduce((acc, p) => acc.concat(p), []);

  // ---- вальс (3/4: шесть восьмых на такт): левая рука — бас на «раз», аккорд на «два» и «три»
  const LH = {
    Am: ['A2', 'E3', ['E4', 'A4', 'C5']], Dm: ['D3', 'A2', ['F4', 'A4', 'D5']], E7: ['E3', 'B2', ['E4', 'G#4', 'B4', 'D5']],
    C: ['C3', 'G2', ['E4', 'G4', 'C5']], G7: ['G2', 'D3', ['F4', 'B4', 'D5']], F: ['F2', 'C3', ['F4', 'A4', 'C5']],
  };
  const waltzLeft = (prog) => {
    const bass = [], chord = [];
    for (const [nm, k] of prog) { const c = LH[nm]; bass.push(c[k], R, R, R, R, R); chord.push(null, null, c[2], null, c[2], null); }
    return { bass, chord };
  };
  const progA = [['Am', 0], ['Am', 1], ['Dm', 0], ['Dm', 1], ['E7', 0], ['E7', 1], ['Am', 0], ['Am', 0]];
  const progB = [['C', 0], ['G7', 0], ['C', 0], ['Am', 0], ['Dm', 0], ['G7', 0], ['C', 0], ['E7', 0]];

  // Тема А (ля минор): арпеджио и плавные ходы, вторая половина — через E7 к тонике
  const themeA = line(
    n('E6', 2), n('C6'), n('A5'), n('E5', 2),                    // Am
    n('A5', 2), n('B5'), n('C6'), n('D6', 2),                    // Am
    n('D6', 3), n('C6'), n('A5', 2),                             // Dm
    n('F5', 2), n('A5'), n('D6'), n('C6', 2),                    // Dm
    n('B5', 2), n('G#5'), n('B5'), n('D6', 2),                   // E7
    n('C6'), n('B5'), n('A5', 2), n('G#5', 2),                   // E7: чувствительная G# просится в тонику
    n('A5', 4), n('E5', 2),                                      // Am
    n('A4', 4), rest(2)                                          // Am: покой
  );
  // Тема А, второй проход: то же с украшениями — трели и «каскады» (быстрые ноты), выше по регистру
  const themeA2 = line(
    n('E6', 2), n('C6'), n('A5'), n('E5', 2),
    n('A5', 2), sub('B5', 'C6', 'B5', 'C6'), n('C6'), n('D6', 2),
    n('F6', 3), n('E6'), n('D6', 2),
    n('C6', 2), n('D6'), n('F6'), n('A6', 2),
    n('B5', 2), sub('G#5', 'B5', 'D6', 'B5'), n('D6'), n('E6', 2),
    n('D6'), n('C6'), sub('B5', 'A5', 'G#5', 'A5'), n('B5'), n('G#5', 2),
    n('A5', 4), sub('B5', 'A5', 'G#5', 'A5'), n('E5'),
    n('A4', 4), rest(2)
  );
  // Тема Б (до мажор): распетая, светлая; последний такт ведёт через E7 обратно в ля минор
  const themeB = line(
    n('E5'), n('G5'), n('C6', 2), n('E6', 2),                    // C
    n('D6', 2), n('B5'), n('G5'), n('B5', 2),                    // G7
    n('C6', 2), n('E6'), n('D6'), n('C6', 2),                    // C
    n('A5', 2), n('C6'), n('B5'), n('A5', 2),                    // Am
    n('D6', 2), n('F6'), n('E6'), n('D6', 2),                    // Dm
    n('B5'), n('D6'), n('G6', 2), n('F6', 2),                    // G7
    n('E6', 4), n('C6', 2),                                      // C
    n('B5'), n('G#5'), n('B5'), n('D6'), n('E6', 2)              // E7
  );
  const LA = waltzLeft(progA), LB = waltzLeft(progB);
  const cat = (...a) => a.reduce((acc, x) => acc.concat(x), []);

  // ---- галоп (2/4, ре мажор): «ум-па» — бас на сильную долю, аккорд на слабую
  const GL = {
    D: ['D3', 'A2', ['F#4', 'A4', 'D5']], A7: ['A2', 'E3', ['E4', 'G4', 'C#5']], G: ['G2', 'D3', ['G4', 'B4', 'D5']], E7: ['E3', 'B2', ['E4', 'G#4', 'B4', 'D5']],
  };
  const galopLeft = (prog) => { const bass = [], chord = []; for (const nm of prog) { const c = GL[nm]; bass.push(c[0], R, c[1], R); chord.push(null, c[2], null, c[2]); } return { bass, chord }; };
  const galopA = line(
    n('F#5'), n('A5'), n('F#5'), n('A5'),  n('D6', 2), n('A5', 2),
    n('E6'), n('C#6'), n('E6'), n('C#6'),  n('A5', 2), n('C#6', 2),
    n('F#5'), n('A5'), n('F#5'), n('A5'),  n('D6', 2), n('F#6', 2),
    n('E6'), n('D6'), n('C#6'), n('B5'),   n('A5'), n('A5'), n('D6', 2)
  );
  const galopB = line(
    n('B5'), n('D6'), n('B5'), n('D6'),    n('G6', 2), n('D6', 2),
    n('A5'), n('D6'), n('F#6'), n('D6'),   n('A5', 2), n('F#5', 2),
    n('B5'), n('G#5'), n('B5'), n('D6'),   n('E6', 2), n('D6', 2),
    n('E6'), n('E6'), n('C#6'), n('A5'),   n('A5', 2), rest(2)
  );
  const GA = galopLeft(['D', 'D', 'A7', 'A7', 'D', 'D', 'A7', 'D']), GB = galopLeft(['G', 'G', 'D', 'D', 'E7', 'E7', 'A7', 'A7']);

  // ---- аэропорт: цыганский свинг в ля миноре (4/4, восьмых восемь на такт), «помпа» гитары на 2 и 4, бас ходит четвертями
  const SW = { Am: ['A2', 'C3', 'E3', 'C3'], Dm: ['D3', 'F3', 'A3', 'F3'], E7: ['E3', 'G#3', 'B3', 'G#3'] };
  const SWC = { Am: ['E3', 'A3', 'C4', 'E4'], Dm: ['F3', 'A3', 'D4', 'F4'], E7: ['E3', 'G#3', 'D4', 'B3'] };
  const swingProg = ['Am', 'Am', 'Dm', 'Dm', 'E7', 'E7', 'Am', 'Am', 'Dm', 'Dm', 'Am', 'Am', 'E7', 'E7', 'Am', 'E7'];
  const swBass = [], swChord = [];
  for (const nm of swingProg) { const b = SW[nm]; swBass.push(b[0], R, b[1], R, b[2], R, b[3], R); swChord.push(null, null, SWC[nm], null, null, null, SWC[nm], null); }
  const swingLead = line(
    n('E5', 2), n('A5'), n('C6'), n('E6', 2), n('D6'), n('C6'),          // Am
    n('B5', 2), n('A5'), n('G5'), n('A5', 4),
    n('F5', 2), n('A5'), n('D6'), n('F6', 2), n('E6'), n('D6'),          // Dm
    n('C6', 2), n('A5'), n('F5'), n('D6', 4),
    n('B5', 2), n('G#5'), n('B5'), n('D6', 2), n('C6'), n('B5'),         // E7
    n('G#5', 2), n('A5'), n('B5'), n('G#5', 4),
    n('A5', 3), n('E5'), n('C6', 2), n('B5'), n('A5'),                   // Am
    n('A5', 4), rest(4),
    n('D6', 2), n('C6'), n('D6'), n('F6', 2), n('E6'), n('D6'),          // Dm
    n('C6', 2), n('A5'), n('F5'), n('A5', 4),
    n('E6', 2), n('D6'), n('C6'), n('B5', 2), n('A5'), n('C6'),          // Am
    n('E6', 4), n('C6', 2), n('A5', 2),
    n('D6', 2), n('B5'), n('D6'), n('G#5', 2), n('B5'), n('D6'),         // E7
    n('E6', 2), n('D6'), n('B5'), n('G#5', 4),
    n('A5'), n('C6'), n('E6'), n('C6'), n('A5', 2), n('E5', 2),          // Am
    n('B5'), n('G#5'), n('B5'), n('D6'), n('E6', 4)                       // E7 → в начало
  );
  const swingPerc = []; for (let i = 0; i < 16; i++) swingPerc.push('h', R, 'b', 'h', 'h', R, 'b', 'h');

  // ---- Босс: 4/4, ля минор, бас-остинато и арпеджио (аккордеон стаккато)
  const bars = (list) => list.reduce((acc, b) => acc.concat(b), []);
  const bossBass = bars([
    ['A2', 'A2', 'A3', 'A2', 'A2', 'A3', 'A2', 'C3'], ['A2', 'A2', 'A3', 'A2', 'A2', 'A3', 'C3', 'E3'],
    ['F2', 'F2', 'F3', 'F2', 'F2', 'F3', 'F2', 'A2'], ['G2', 'G2', 'G3', 'G2', 'G2', 'G3', 'B2', 'D3'],
  ]);
  const bossLead = bars([
    ['A4', R, 'C5', R, 'E5', R, 'C5', R], ['A4', R, 'C5', R, 'E5', R, 'A5', R],
    ['A4', R, 'C5', R, 'F5', R, 'C5', R], ['B4', R, 'D5', R, 'G5', R, 'D5', R],
    ['A4', R, 'C5', R, 'E5', R, 'C5', R], ['E5', R, 'A5', R, 'G5', R, 'E5', R],
    ['F5', R, 'A5', R, 'C6', R, 'A5', R], ['G5', 'F5', 'E5', 'D5', 'E5', R, R, R],
  ]);
  const bossPerc = bars([['k', 'h', 's', 'h', 'k', 'h', 's', 'h'], ['k', 'h', 's', 'h', 'k', 'k', 's', 'h']]);

  // ---- Туннель: крадущийся, ре минор (кларнет и пиццикато)
  const tunBass = bars([['D3', R, R, 'D3', R, 'A2', R, R], ['D3', R, R, 'D3', R, 'F3', R, 'E3'], ['A#2', R, R, 'A#2', R, 'F2', R, R], ['A2', R, R, 'A2', R, 'C#3', R, 'E3']]);
  const tunLead = bars([[R, R, 'A4', R, R, R, 'F4', R], [R, R, 'D5', R, R, 'C5', R, R], [R, R, 'D5', R, R, R, 'A4', R], [R, R, 'E5', R, 'C#5', R, R, R]]);
  const tunPerc = bars([['k', R, 'h', R, 's', R, 'h', 'h']]);

  const TRACKS = {
    // вальс-мюзетт: тема А, А с украшениями, тема Б, А — 32 такта (≈ 42 с)
    paris: { bpm: 138, steps: 192, lead: cat(themeA, themeA2, themeB, themeA), bass: cat(LA.bass, LA.bass, LB.bass, LA.bass), chord: cat(LA.chord, LA.chord, LB.chord, LA.chord), leadVoice: 'accordion', leadVol: 0.12, chordVol: 0.032 },
    // заставка: тот же вальс, медленнее и мягче — скрипка ведёт тему
    title: { bpm: 96, steps: 96, lead: cat(themeA, themeA2), bass: cat(LA.bass, LA.bass), chord: cat(LA.chord, LA.chord), leadVoice: 'violin', leadVol: 0.11, chordVol: 0.026 },
    boss: { bpm: 158, steps: 64, lead: bossLead, bass: bossBass, perc: bossPerc, leadVoice: 'accordion', leadStaccato: true, leadVol: 0.10 },
    tunnel: { bpm: 108, steps: 32, lead: tunLead, bass: tunBass, perc: tunPerc, leadVoice: 'clarinet', bassVoice: 'pizz', leadVol: 0.10 },
    ending: { bpm: 126, steps: 96, lead: cat(themeB, themeA), bass: cat(LB.bass, LA.bass), chord: cat(LB.chord, LA.chord), perc: cat(Array(48).fill(null).map((_, i) => (i % 6 === 2 || i % 6 === 4) ? 'b' : null), Array(48).fill(null).map((_, i) => (i % 6 === 2 || i % 6 === 4) ? 'b' : null)), leadVoice: 'accordion', leadVol: 0.12, chordVol: 0.034 },
    airport: { bpm: 116, steps: 128, swing: 0.15, lead: swingLead, bass: swBass, chord: swChord, perc: swingPerc, leadVoice: 'clarinet', bassVoice: 'pizz', chordVoice: 'strum', leadVol: 0.11, chordVol: 0.05 },
    takeoff: { bpm: 100, steps: 48, lead: themeB, bass: LB.bass, chord: LB.chord, leadVoice: 'violin', leadVol: 0.12, chordVol: 0.03 },
    // скачка: галоп в духе канкана (2/4): аккордеон стаккато, «ум-па» и барабан
    ride: { bpm: 152, steps: 128, lead: cat(galopA, galopB, galopA, galopB), bass: cat(GA.bass, GB.bass, GA.bass, GB.bass), chord: cat(GA.chord, GB.chord, GA.chord, GB.chord), perc: Array(128).fill(null).map((_, i) => (i % 4 === 0 || i % 4 === 2) ? 'k' : 's'), leadVoice: 'accordion', leadStaccato: true, leadVol: 0.115, chordVol: 0.04 },
  };
  A.SFX = SFX; A.TRACKS = TRACKS;
  A.loadPrefs();
  if (window.ALE_AUDIO) A.prepare();      // контекст и песня заставки — заранее
})();
