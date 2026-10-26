// Титульный экран: нарисованная картина (Париж на закате: Алеся с Бубелом слева, Даня, учительница и Преслюкан справа), название и меню.
// Три фазы. gate — «Нажмите, чтобы начать»: браузер разрешает звук только после первого касания, касание включает песню заставки.
// intro — ловушка: после касания ~12 с играет песня и идёт анимация (камера отъезжает от Алеси, на картине зажигаются фонари, появляется название);
// меню в это время нет, начать игру нельзя. menu — обычное меню. Ловушка сработает один раз за запуск игры: при возврате в меню из игры меню сразу.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art;
  const IW = 2560, IH = 1440;                     // размер картины в файле
  // фонари на мосту и набережной (доли ширины и высоты картины) — на них в ловушке зажигаются огоньки
  const LAMPS = [[0.2575, 0.48], [0.3085, 0.493], [0.3775, 0.487], [0.444, 0.483], [0.495, 0.49], [0.59, 0.487], [0.629, 0.498], [0.6775, 0.484]];
  // блики на логотипе: две звёздочки и сердечко (пиксели картинки assets/images/logo_ale_game.png, 1400×525)
  const LOGO_GLINTS = [[112, 164, 1.0], [1304, 193, 0.9], [642, 143, 0.8]];
  const SPARK_COLORS = ['#ffe08a', '#ffc4d8', '#fff3c4', '#ffb45a'], LEAF_COLORS = ['#e08a2e', '#c96a1d', '#f0b040', '#b5541a'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const back = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  const Title = (Ale.Title = {
    t: 0, phase: 'menu', introT: 0, introSeen: false, gateSeen: false, INTRO_LEN: 12.5, INTRO_DPR: 2, leaves: null, sparks: [], confetti: [], sparkT: 0,

    build() {},
    release() { if (this.phase === 'intro') this.phase = 'menu'; this._artC = this._artSrc = this._logoC = this._logoSrc = this._lc = this._ic = this._amb = null; },          // в игре заготовки заставки (≈ 20 МБ холстов) не нужны; вернёмся в меню — Title.enter() построит их заново

    enter() {
      this.t = 0;
      if (!this.leaves) { const R = Ale.fxRng; this.leaves = []; for (let i = 0; i < 16; i++) this.leaves.push({ x: R.range(0, 1700), y: R.range(-80, 720), v: R.range(24, 52), sw: R.range(0.6, 1.6), ph: R.range(0, 6.3), s: R.range(5, 9), c: R.pick(LEAF_COLORS) }); }
      Ale.Game.mode = 'title';
      this.sub = this._subtitle();
      this._warm();                                    // копия картины и логотипа, значки лампочек, искр и листьев — заранее, а не посреди анимации
      Ale.Audio.music('title');
      this.sparks = []; this.confetti = [];
      // «Нажмите, чтобы начать» — только при первом входе за запуск: дальше касание в игре уже было, и звук разрешён
      if (!this.gateSeen && Ale.Audio.unlocked && !Ale.Audio.unlocked()) { this.gateSeen = true; this.phase = 'gate'; }
      else if (this._wantIntro()) this._beginIntro();
      else { this.phase = 'menu'; this.menu(); }
    },

    // Подзаголовок — глава, на которой остановился игрок (по сохранению); без сохранения — первая. Раньше всегда стояло «Глава 1 · Париж», хотя глав три (13.10.2026: «убедись, что бреда нигде нет»).
    // Название последней главы без сохранения не показывается: оно подсказало бы, куда идёт сюжет.
    _subtitle() {
      const T = Ale.T.title, s = Ale.Save && Ale.Save.read(), sc = (s && typeof s.scene === 'string') ? s.scene : '';
      return /^kyiv/.test(sc) ? T.subKyiv : /^(monaco|coast|birthday)/.test(sc) ? T.subMonaco : T.sub;
    },

    // Ловушка нужна, чтобы игрок дослушал заставку до конца вступления; если музыки нет (звук выключен) или она уже звучала в этом запуске — незачем.
    _wantIntro() { return !this.introSeen && Ale.Audio.mode >= 2; },
    _beginIntro() { this.phase = 'intro'; this.introT = 0; this.introSeen = true; this.sparks = []; this.confetti = []; this.sparkT = 0; this._warm(); this._reflow(); if (Ale.Game) Ale.Game._introCv = Ale.Game.cw + 'x' + Ale.Game.ch; },
    _endIntro() { this.phase = 'menu'; this._reflow(); this.menu(); if (Ale.Audio.sfx) Ale.Audio.sfx('ui'); },

    // Ловушка с отъездом камеры шла «очень лагучей» на телефоне (владелец 17.10.2026: «когда игру впервые открываешь, недолгая анимация с отдалением очень лагучая, низкий fps»). Что было в каждом кадре: картина
    // 2560×1440 прямо из файла с масштабом 1,5 → 1,0 и «высоким» сглаживанием, градиенты восьми лампочек, контуры искр, градиент виньетки — всё на холсте в 3× (с 15.10.2026 телефон рисует холст в полную плотность экрана,
    // а автоподбор разрешения в первые секунды в дела не вмешивается), да ещё картина и логотип расшифровывались прямо посреди анимации. Теперь: (1) пока идёт ловушка, холст на телефоне не плотнее INTRO_DPR (2×, как было
    // до 15.10.2026; меню потом — снова в полную плотность: оно почти неподвижно); (2) копия картины и логотипа в холстах, лампочки, искры и листья — готовые значки, всё это строится заранее, на «Нажмите, чтобы начать»;
    // (3) сглаживание в анимации «low» (у «high» при непростом масштабе дорогая передискретизация), в меню «medium»; (4) фоновая подгрузка открыток ждёт конца ловушки (Cards.prefetchAll).
    _reflow() { const G = Ale.Game; if (G && G.canvas && G.resize) G.resize(); },
    _warm() {
      const im = Ale.Assets.images['key_art_title'], lg = Ale.Assets.images['logo_ale_game'];
      if (im) this._artCopy(im);
      if (lg) { this._logoCopy(lg); const ow = 1240, oh = Math.round(ow * lg.height / lg.width); if (!this._lc || this._lc.width !== ow || this._lc.height !== oh) { this._lc = document.createElement('canvas'); this._lc.width = ow; this._lc.height = oh; } }
      this._icons();
    },
    _copyOf(im, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h); return c; },
    _artCopy(im) { if (this._artC && this._artSrc === im) return this._artC; this._artSrc = im; return (this._artC = this._copyOf(im, IW, IH)); },
    _logoCopy(im) { if (this._logoC && this._logoSrc === im) return this._logoC; this._logoSrc = im; return (this._logoC = this._copyOf(im, im.naturalWidth || im.width, im.naturalHeight || im.height)); },
    // Готовые значки: свечение лампочки, четырёхлучевая звёздочка каждого цвета искр, листик каждого цвета (их рисовали градиентом и контуром, по нескольку десятков раз за кадр)
    _icons() {
      if (this._ic) return this._ic;
      const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
      const ic = { glow: mk(96, 96, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,120,1)'); gr.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 6.283); g.fill(); }), star: {}, leaf: {} };
      for (const c of SPARK_COLORS) ic.star[c] = mk(28, 28, (g) => { g.translate(14, 14); g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 12 * 0.35 : 12; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); });
      for (const c of LEAF_COLORS) ic.leaf[c] = mk(24, 16, (g) => { g.fillStyle = c; g.beginPath(); g.ellipse(12, 8, 10, 5, 0, 0, 6.283); g.fill(); });
      return (this._ic = ic);
    },

    dismissGate() {
      if (this.phase !== 'gate') return;
      if (Ale.Audio.init) Ale.Audio.init();
      Ale.Audio.music('title');
      if (this._wantIntro()) this._beginIntro();
      else { this.phase = 'menu'; if (Ale.Audio.sfx) Ale.Audio.sfx('ui'); this.menu(); }
    },

    menu(sel) {
      const G = Ale.Game, T = Ale.T.title;
      const has = (this.saved = G.hasSave()), C = Ale.Cards, TC = Ale.T.card;
      const items = [
        { label: T.new, action: () => { if (has) this.confirmNew(); else { Ale.UI.closeMenu(); this.start(false); } } },          // с сохранённым прогрессом — сначала вопрос: меню срабатывает при нажатии, и промах мимо «Продолжить» стирал всё одним касанием (18.10.2026)
        { label: T.cont, disabled: !has, action: () => { Ale.UI.closeMenu(); this.start(true); } },
      ];
      // «Альбом» появляется, когда в нём есть хотя бы одна открытая картина
      if (C && C.count() > 0) items.push({ label: TC.menu.replace('{n}', C.count()).replace('{m}', C.ids().length), action: () => { Ale.UI.closeMenu(); C.openAlbum(() => this.menu()); } });
      const iVol = items.length;
      items.push({ label: Ale.T.audio.menu, action: () => Ale.UI.openVolume(() => this.menu(iVol), { y: 400 }) });       // y: окно громкости ниже подписи и плашки «С днём рождения!» (оно рисовалось поверх них)
      items.push({ label: Ale.Settings.easy ? 'Лёгкий режим: вкл' : 'Лёгкий режим: выкл', action: () => { Ale.Settings.setEasy(!Ale.Settings.easy); this.menu(items.length - 1); } });
      const logo = !!Ale.Assets.images['logo_ale_game'], big = items.length > 4;
      Ale.UI.openMenu(items, { dim: false, y: logo ? (big ? 314 : 326) : 330, sel: has ? 1 : 0, itemH: big ? 56 : 62, gap: big ? 11 : 14 });
      const m = Ale.UI.menu; if (m) m.sel = sel !== undefined ? sel : (has ? 1 : 0);
    },

    // «Начать заново?»: «Отмена» первой и выбранной (Enter и случайное касание ничего не стирают), Esc возвращает в меню; окно ниже названия игры (логотип и надпись «С днём рождения!» вверху)
    confirmNew() {
      const T = Ale.T.title;
      Ale.UI.openMenu([
        { label: T.confirmNo, action: () => this.menu() },
        { label: T.confirmYes, action: () => { Ale.UI.closeMenu(); this.start(false); } },
      ], { dim: false, title: T.confirmNew, y: 410, sel: 0, onBack: () => this.menu() });
    },

    start(cont) {
      const G = Ale.Game;
      Ale.UI.fadeTo(1, 0.8);
      if (Ale.Audio && Ale.Audio.dip) Ale.Audio.dip(0.2, 0.9);                 // песня заставки затихает вместе с картиной и перетекает в музыку первой сцены
      G.after(0.95, () => { cont ? G.continueGame() : G.startNew(); });
    },

    update(dt) {
      this.t += dt;
      for (const l of this.leaves || []) { l.y += l.v * dt; l.x -= 8 * dt; if (l.y > 760) { l.y = -20; l.x = Ale.fxRng.range(0, 1700); } }
      if (this.phase === 'gate') { const I = Ale.Input; if (I.pressed('jump') || I.pressed('interact') || I.pressed('attack') || I.edge('Enter') || I.edge('Space')) this.dismissGate(); }
      if (this.phase === 'intro') {
        const u = (this.introT += dt), R = Ale.fxRng;
        // искры вокруг Алеси
        if (u > 1.2 && u < 7.5) {
          this.sparkT -= dt;
          while (this.sparkT <= 0) { this.sparkT += 0.13; this.sparks.push({ u: 0.165 + R.range(-0.05, 0.05), v: 0.5 + R.range(-0.2, 0.16), age: 0, life: R.range(1.5, 2.4), s: R.range(3, 7), c: R.pick(SPARK_COLORS) }); }
        }
        for (const s of this.sparks) { s.age += dt; s.v -= 0.02 * dt; }
        this.sparks = this.sparks.filter((s) => s.age < s.life);
        if (u > 9.0 && !this._confettiDone) { this._confettiDone = true; for (let i = 0; i < 70; i++) this.confetti.push({ x: 0.5, y: 0.34, vx: R.range(-0.55, 0.55), vy: R.range(-0.7, -0.15), r: R.range(0, 6.3), vr: R.range(-6, 6), w: R.range(6, 11), c: R.pick(['#ffd0de', '#ffe08a', '#b9e6ff', '#ffb45a', '#ffffff', '#c9f0b0']), age: 0 }); }
        for (const c of this.confetti) { c.age += dt; c.x += c.vx * dt * 0.6; c.y += c.vy * dt; c.vy += 0.9 * dt; c.r += c.vr * dt; }
        this.confetti = this.confetti.filter((c) => c.age < 3.2);
        if (u >= this.INTRO_LEN) { this._confettiDone = false; this._endIntro(); }
      }
    },

    pointer() { if (this.phase === 'gate') this.dismissGate(); },     // в ловушке касания ничего не делают

    // Где картина стоит на экране: в широких окнах — по ширине, лишнее сверху срезается (низ с героями всегда виден); в узких — целиком.
    _rect(W, H) {
      const aspect = W / H;
      if (aspect >= 1.6) { const s = Math.max(W / IW, H / IH); return { s, x: (W - IW * s) / 2, y: aspect >= 16 / 9 ? H - IH * s : 0, fit: 'cover' }; }
      const s = W / IW; return { s, x: 0, y: (H - IH * s) / 2, fit: 'contain' };
    },

    _art(ctx, W, H) {
      const im = Ale.Assets.images['key_art_title'], r = this._rect(W, H);
      if (!im) { ctx.fillStyle = '#e08a4a'; ctx.fillRect(0, 0, W, H); return; }
      ctx.imageSmoothingQuality = this.phase === 'intro' ? 'low' : 'medium';
      const art = this._artCopy(im);                                              // картина из готовой копии в холсте: не расшифровывается и не пересчитывается заново на каждый кадр
      if (r.fit === 'cover') { ctx.drawImage(art, r.x, r.y, IW * r.s, IH * r.s); return; }
      // узкое окно (планшет и т. п.): картина целиком, а поля сверху и снизу — её же размытое зеркальное продолжение; кромки растворяются в нём
      const key = Math.round(W) + 'x' + Math.round(H);
      if (!this._amb || this._amb.key !== key) this._amb = this._ambient(im, W, H, r, key);
      const h = IH * r.s, F = 34, N = 12, c = this._amb.c, ky = c.height / H;
      ctx.drawImage(art, 0, r.y, IW * r.s, h);
      ctx.imageSmoothingEnabled = true;
      const slice = (y0, y1, a) => { if (y1 > y0) { ctx.globalAlpha = a; ctx.drawImage(c, 0, y0 * ky, c.width, (y1 - y0) * ky, 0, y0, W, y1 - y0); } };
      slice(0, r.y, 1); slice(r.y + h, H, 1);                                    // поля целиком — размытие
      for (let i = 0; i < N; i++) {                                              // и мягкий переход внутрь картины на F юнитов
        const a = 1 - (i + 0.5) / N, d0 = F * i / N, d1 = F * (i + 1) / N;
        slice(r.y + d0, r.y + d1 + 0.6, a); slice(r.y + h - d1 - 0.6, r.y + h - d0, a);
      }
      ctx.globalAlpha = 1;
    },

    // Размытая картина на весь вид в маленьком холсте: посередине сама картина, выше и ниже неё — её зеркальные отражения (кромка с кромкой без шва).
    // Уменьшение идёт вдвое, шаг за шагом: при сильном сжатии за один раз браузер пропускает пиксели и картинка зернит.
    _ambient(im, W, H, r, key) {
      const K = 10, w = Math.max(8, Math.ceil(W / K)), h = Math.max(8, Math.ceil(H / K)), kx = w / W, ky = h / H;
      let src = im;
      while (src.width > w * 4) {
        const t = document.createElement('canvas'); t.width = Math.ceil(src.width / 2); t.height = Math.ceil(src.height / 2);
        const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, t.width, t.height); src = t;
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
      const y0 = r.y * ky, iw = IW * r.s * kx, ih = IH * r.s * ky;
      g.drawImage(src, 0, y0, iw, ih);
      g.save(); g.translate(0, 2 * y0); g.scale(1, -1); g.drawImage(src, 0, y0, iw, ih); g.restore();                     // отражение выше картины
      g.save(); g.translate(0, 2 * (y0 + ih)); g.scale(1, -1); g.drawImage(src, 0, y0, iw, ih); g.restore();              // и ниже
      return { key, c };
    },

    _star(ctx, x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? s * 0.35 : s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    },

    // Название буквами: каждая «падает» на место по очереди (k — доля появления 0…1 для каждой буквы считается от u)
    _drawName(ctx, W, ty, u0, u) {
      const str = Ale.T.title.name;
      ctx.font = 'bold 116px ' + Ale.FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const total = ctx.measureText(str).width; let x = W / 2 - total / 2;
      const g = ctx.createLinearGradient(0, ty - 50, 0, ty + 50); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffb45a');
      for (let i = 0; i < str.length; i++) {
        const ch = str[i], cw = ctx.measureText(ch).width, p = clamp((u - u0 - i * 0.11) / 0.55, 0, 1);
        if (p > 0 && ch !== ' ') {
          const e = back(p), dy = (1 - e) * -70, sc = 0.7 + 0.3 * e;
          ctx.save(); ctx.globalAlpha = clamp(p * 2, 0, 1); ctx.translate(x + cw / 2, ty + dy); ctx.scale(sc, sc);
          ctx.lineWidth = 22; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(ch, -cw / 2, 6); ctx.fillStyle = g; ctx.fillText(ch, -cw / 2, 0); ctx.restore();
        }
        x += cw;
      }
      ctx.textAlign = 'center';
    },

    // Нарисованный логотип. В ловушке «вылетает» с пружиной, по буквам пробегает блик; у звёздочек и сердечка изредка вспыхивают искры.
    // Центр букв (а не всей картинки с полями) кладётся в высоту cy.
    _drawLogo(ctx, W, cy, u, im) {
      const lw = 620, lh = lw * im.height / im.width, top = cy - lh * 0.495, left = W / 2 - lw / 2;
      const p = clamp((u - 6.4) / 0.9, 0, 1);
      if (p <= 0) return;
      const e = back(p), sc = 0.55 + 0.45 * e, dy = (1 - e) * -70, t = this.t;
      ctx.save();
      ctx.globalAlpha *= clamp(p * 2.2, 0, 1);
      ctx.translate(W / 2, cy + dy); ctx.scale(sc, sc); ctx.translate(-W / 2, -cy);
      const sh = (u - 7.6) / 1.1;
      if (sh > 0 && sh < 1) {                       // блик: светлая полоса только по буквам (через холст, вырезанный по картинке)
        const ow = Math.round(lw * 2), oh = Math.round(lh * 2), lcopy = this._logoCopy(im);
        if (!this._lc || this._lc.width !== ow || this._lc.height !== oh) { this._lc = document.createElement('canvas'); this._lc.width = ow; this._lc.height = oh; }
        const g = this._lc.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, ow, oh);
        g.imageSmoothingQuality = 'medium'; g.drawImage(lcopy, 0, 0, ow, oh);
        const bx = (-0.2 + 1.4 * sh) * ow, gr = g.createLinearGradient(bx - ow * 0.1, 0, bx + ow * 0.1, oh * 0.35);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, ow, oh);
        ctx.drawImage(this._lc, left, top, lw, lh);
      } else { ctx.imageSmoothingQuality = 'medium'; ctx.drawImage(this._logoCopy(im), left, top, lw, lh); }
      // искры на звёздочках и сердечке
      ctx.globalCompositeOperation = 'lighter';
      LOGO_GLINTS.forEach(([gx, gy, amp], i) => {
        const k = Math.pow(Math.max(0, Math.sin(t * 2.6 + i * 2.3)), 8) * amp * (u > 8.2 ? 1 : 0.4);
        if (k < 0.05) return;
        const x = left + gx / im.width * lw, y = top + gy / im.height * lh, s = 11 + 16 * k;
        ctx.globalAlpha = 0.9 * k; ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s * 0.3, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s * 0.3, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s * 0.8, y); ctx.quadraticCurveTo(x, y, x, y - s * 0.3); ctx.quadraticCurveTo(x, y, x + s * 0.8, y); ctx.quadraticCurveTo(x, y, x, y + s * 0.3); ctx.quadraticCurveTo(x, y, x - s * 0.8, y); ctx.fill();
      });
      ctx.restore();
    },

    draw(ctx, W, H) {
      const t = this.t, intro = this.phase === 'intro', u = intro ? this.introT : 1e9, r = this._rect(W, H);
      // ---- картина; в ловушке камера отъезжает от Алеси и Бубела к общему плану
      ctx.save();
      if (intro) {
        const e = eio(clamp((u - 0.4) / 8.4, 0, 1)), cx = 0.185 * W + (0.5 - 0.185) * W * e, cy = 0.6 * H + (0.62 - 0.6) * H * e, z = 1.5 - 0.5 * e;
        ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy);
      } else {
        const z = 1 + 0.014 * (0.5 - 0.5 * Math.cos(t * 0.22));       // едва заметное медленное приближение
        ctx.translate(W / 2, H * 0.62); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.62);
      }
      this._art(ctx, W, H);
      if (intro) {
        // фонари зажигаются по очереди слева направо и мерцают; искры вокруг Алеси (готовые значки: в кадре ни одного градиента и контура)
        const ic = this._icons(), gR = 34 * r.s * 1.6;
        LAMPS.forEach(([fx, fy], i) => {
          const on = clamp((u - 2.0 - i * 0.45) / 0.7, 0, 1); if (on <= 0) return;
          const px = r.x + fx * IW * r.s, py = r.y + fy * IH * r.s, fl = 0.78 + 0.22 * Math.sin(t * 5 + i * 1.7);
          ctx.globalAlpha = 0.55 * on * fl; ctx.drawImage(ic.glow, px - gR, py - gR, 2 * gR, 2 * gR);
        });
        for (const s of this.sparks) {
          const k = s.age / s.life, al = Math.sin(Math.PI * k), px = r.x + s.u * IW * r.s, py = r.y + s.v * IH * r.s, sp = ic.star[s.c];
          ctx.globalAlpha = al * 0.95;
          if (sp) { const q = s.s * (0.6 + 0.6 * al) / 12; ctx.save(); ctx.translate(px, py); ctx.rotate(t * 2 + s.u * 30); ctx.drawImage(sp, -14 * q, -14 * q, 28 * q, 28 * q); ctx.restore(); }
          else { ctx.fillStyle = s.c; this._star(ctx, px, py, s.s * (0.6 + 0.6 * al), t * 2 + s.u * 30); }
        }
        ctx.globalAlpha = 1;
      }
      // падающие листья (в ловушке — гуще)
      const nLeaves = intro ? this.leaves.length : Math.min(this.leaves.length, 12);
      for (let i = 0; i < nLeaves; i++) {
        const l = this.leaves[i], x = l.x + Math.sin(t * l.sw + l.ph) * 26, rr = t * l.sw * 1.4 + l.ph;
        const lp = this._icons().leaf[l.c];
        ctx.save(); ctx.translate(x % (W + 40), l.y); ctx.rotate(rr); ctx.globalAlpha = 0.85;
        if (lp) { const q = l.s / 10; ctx.drawImage(lp, -12 * q, -8 * q, 24 * q, 16 * q); }
        else { ctx.fillStyle = l.c; ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.5, 0, 0, 6.283); ctx.fill(); }
        ctx.restore();
      }
      ctx.restore();
      A.vignette(ctx, W, H, 0.26);
      // ---- название, подзаголовок, посвящение
      const logo = Ale.Assets.images['logo_ale_game'], ty = (logo ? 100 : 108) + (intro ? 0 : Math.sin(t * 1.6) * 3);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      if (logo) this._drawLogo(ctx, W, ty, u, logo);
      else if (intro) this._drawName(ctx, W, ty, 6.4, u);
      else {
        ctx.font = 'bold 116px ' + Ale.FONT;
        ctx.lineWidth = 22; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(Ale.T.title.name, W / 2, ty + 6);
        const g = ctx.createLinearGradient(0, ty - 50, 0, ty + 50); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffb45a');
        ctx.fillStyle = g; ctx.fillText(Ale.T.title.name, W / 2, ty);
      }
      const subA = intro ? clamp((u - 7.9) / 0.8, 0, 1) : 1;
      if (subA > 0) {
        ctx.globalAlpha = subA; ctx.font = 'bold 34px ' + Ale.FONT;
        ctx.lineWidth = 8; ctx.strokeStyle = '#2b1a20'; ctx.strokeText(this.sub || Ale.T.title.sub, W / 2, ty + (logo ? 90 : 78));
        ctx.fillStyle = '#ffe9c4'; ctx.fillText(this.sub || Ale.T.title.sub, W / 2, ty + (logo ? 90 : 78)); ctx.globalAlpha = 1;
      }
      if (Ale.T.title.dedication) {
        const dp = intro ? clamp((u - 8.8) / 0.7, 0, 1) : 1;
        if (dp > 0) {
          ctx.font = 'bold 30px ' + Ale.FONT;
          const dw = ctx.measureText(Ale.T.title.dedication).width + 56, dy = ty + (logo ? 146 : 138), sc = intro ? 0.5 + 0.5 * back(dp) : 1;
          ctx.save(); ctx.globalAlpha = clamp(dp * 2, 0, 1); ctx.translate(W / 2, dy); ctx.scale(sc, sc);
          Ale.rr(ctx, -dw / 2, -24, dw, 48, 24); ctx.fillStyle = 'rgba(43,26,32,0.78)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,208,222,0.6)'; ctx.stroke();
          ctx.fillStyle = '#ffd0de'; ctx.fillText(Ale.T.title.dedication, 0, 1); ctx.restore();
        }
      }
      // конфетти из-под посвящения
      for (const c of this.confetti) { ctx.save(); ctx.translate(c.x * W, c.y * H); ctx.rotate(c.r); ctx.globalAlpha = clamp(3.2 - c.age, 0, 1); ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -2.5, c.w, 5); ctx.restore(); }
      // ---- «Нажмите, чтобы начать»: пока звук ещё не разрешён браузером
      if (this.phase === 'gate') {
        const a = 0.6 + 0.4 * Math.sin(t * 3.2);
        ctx.font = 'bold 40px ' + Ale.FONT;
        const pw = ctx.measureText(Ale.T.title.press).width + 80, py = H * 0.62;
        ctx.globalAlpha = 0.55 + 0.45 * a;
        Ale.rr(ctx, W / 2 - pw / 2, py - 36, pw, 72, 36); ctx.fillStyle = 'rgba(43,26,32,0.72)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,233,196,0.75)'; ctx.stroke();
        ctx.fillStyle = '#fff6e4'; ctx.fillText(Ale.T.title.press, W / 2, py + 2);
        ctx.globalAlpha = 1;
      }
      // ---- подсказка по управлению (после ловушки) и затемнение в самом начале ловушки
      if (!intro && Ale.Input.lastDevice !== 'touch') {
        ctx.font = '600 20px ' + Ale.FONT; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(43,26,32,0.85)';
        const s2 = 'A/D — ходьба · Пробел — прыжок · J — «Туп лапой» · K — помидор · E — действие';
        ctx.strokeText(s2, W / 2, H - 34); ctx.fillStyle = '#fff6e4'; ctx.fillText(s2, W / 2, H - 34);
      }
      if (intro && u < 1.4) { ctx.fillStyle = 'rgba(10,6,14,' + (1 - clamp(u / 1.4, 0, 1)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    },
  });
})();
