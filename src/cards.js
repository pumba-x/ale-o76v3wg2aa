// Сюжетные открытки: полноэкранные картины в ключевые моменты истории (assets/stills) и альбом, где они собираются.
//   yield Ale.Cards.show('still_01_post_office', { once: true });   — сценарий ждёт, пока игрок не смахнёт открытку
//   Ale.Cards.show(имя, { once: true, quiet: true });   — «тихая»: без остановки игры, картина просто попадает в альбом (новая — с короткой надписью); с 13.10.2026 так не показывается ни одна открытка
//   (владелец: «пусть карточки не выезжают, а полноценно открываются на экран»): все 14 — полноэкранные, с `yield`. Карточку в углу экрана (она выезжала сутки, 13.10.2026) убрали: `git show cf125db:src/cards.js`.
// Картинок может быть меньше, чем задумано (они приходят по одной): нет файла — show() тихо возвращается сразу, а как только файл
// появится и пересоберутся assets, открытка сама начнёт показываться. Подписи — в T.cards (src/text.js). Открытые открытки помнятся
// в localStorage (ключ ale-album) и остаются в альбоме между прохождениями.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const OUT = '#3a2431', CREAM = '#fff6e4', INK = '#3a2431';
  const KEY = 'ale-album';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const Cards = (Ale.Cards = {
    cur: null,             // показываемая открытка: { id, img, t, wait, closing, out, done, ... }
    album: null,           // открытый альбом: { sel, view, t, boxes, onClose }
    seen: null,            // открытые открытки: id → true
    MIN_SHOW: 1.6,         // раньше этого срока открытку не пропустить: чтобы не смахнуть её случайным нажатием
    LOAD_WAIT: 3,          // столько секунд ждём загрузку картинки, потом идём дальше без неё
    _pre: null,            // очередь фоновой загрузки

    get busy() { return !!(this.cur || this.album); },

    // ------------------------------------------------------------ что есть и что открыто
    has(id) { return !!(Ale.Assets && Ale.Assets.stills && Ale.Assets.stills[id]); },
    ids() { return Object.keys((Ale.Assets && Ale.Assets.stills) || {}).sort(); },
    caption(id) { return (Ale.T.cards && Ale.T.cards[id]) || ''; },
    _load() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); this.seen = {}; for (const id of a) this.seen[id] = true; } catch (e) { this.seen = {}; } },
    unlocked(id) { if (!this.seen) this._load(); return !!this.seen[id]; },
    count() { return this.ids().filter((id) => this.unlocked(id)).length; },
    unlock(id) {
      if (!this.seen) this._load();
      if (this.seen[id]) return;
      this.seen[id] = true;
      try { localStorage.setItem(KEY, JSON.stringify(Object.keys(this.seen))); } catch (e) { /* без хранилища */ }
    },

    // ------------------------------------------------------------ загрузка заранее
    // Картинки большие, поэтому не грузятся при запуске: по одной, в фоне, когда игра уже началась.
    prefetchAll() {
      if (this._pre) return;
      const queue = this.ids().filter((id) => !Ale.Assets.stills[id].img);
      this._pre = true;
      // Первая картина (открытка почты) грузится сразу: она нужна в начале игры. Остальные ждут конца ловушки заставки (12,5 с): подгрузка и расшифровка десятка больших картин шла прямо во время анимации
      // с отъездом камеры, которая «очень лагучая» на телефоне (владелец 17.10.2026); эти открытки понадобятся не раньше чем через минуты.
      const next = () => { const id = queue.shift(); if (!id) return; Ale.Assets.loadStill(id).then(() => setTimeout(wait, 250)); };
      const wait = () => { if (queue.length && Ale.Title && Ale.Title.phase === 'intro') setTimeout(wait, 400); else next(); };
      next();
    },

    // ------------------------------------------------------------ показ открытки
    // Покажет ли show() эту открытку (есть ли картина и не показывали ли её уже в этом прохождении): сцена, которая НАЧИНАЕТСЯ с открытки, по этому ответу решает, стартовать ли сценарий без паузы проявления
    willShow(id, opts) {
      opts = opts || {};
      const S = Ale.Assets && Ale.Assets.stills && Ale.Assets.stills[id], G = Ale.Game;
      if (!S || opts.quiet) return false;
      return !(opts.once && G && G.state && G.state.flags['card_' + id]);
    },

    // Какую часть кадра закрывает открытка сейчас (0…1): так же рисует _drawCard; по этому числу проверки смотрят, не мелькает ли под открыткой мир
    coverage(c) {
      c = c || this.cur; if (!c) return 0;
      if (!c.img) return c.opts.instant ? 1 : 0.92 * clamp(c.wait / 0.4, 0, 1);
      if (c.closing && c.opts.toBlack) return 1;                 // закрывается в чёрное: мир под ней так и не показывается
      return (c.opts.instant ? 1 : clamp(c.t / 0.7, 0, 1)) * (c.closing ? 1 - clamp(c.out / 0.5, 0, 1) : 1);
    },

    // opts: once — не повторять в этом прохождении (после смерти и возврата к контрольной точке); album: false — не заносить в альбом; instant — картина сразу на весь экран, без плавного
    // появления (открытка приезда в Киев: под ней не должна мелькнуть сцена, пока затемнение перехода ещё сходит);
    // quiet — «тихая» открытка: игру не останавливает, просто попадает в альбом (новая — с короткой надписью `T.toast.card`); сейчас её никто не использует: все открытки полноэкранные (владелец 13.10.2026).
    // toBlack — при закрытии картина тает в чёрное, а не в мир (открытка в самом конце сцены: скачка — ровно перед переходом к аэропорту; мир между открыткой и затемнением не должен мелькнуть); экран остаётся чёрным, пока сцена не сменится.
    // Открытка, которая открывает САМУ СЦЕНУ (первая секунда после входа), — всегда instant, а сценарий сцены начинается без паузы проявления (`sc.noScriptHold = Cards.willShow(...)`): иначе первые полсекунды виден мир (владелец 15.10.2026: «на долю секунды появляется Алеся на почте, и только потом иллюстрация»); это держит проверка «Открытки: мир не мелькает…».
    show(id, opts) {
      opts = opts || {};
      const S = Ale.Assets && Ale.Assets.stills && Ale.Assets.stills[id], G = Ale.Game;
      if (!S) return { update: () => true };
      if (opts.once && G.state && G.state.flags['card_' + id]) return { update: () => true };
      if (opts.once) G.remember('card_' + id);
      if (opts.quiet) {
        const isNew = !this.unlocked(id);
        if (opts.album !== false) this.unlock(id);
        if (isNew && opts.album !== false && Ale.UI && Ale.T.toast && Ale.T.toast.card) Ale.UI.toast(Ale.T.toast.card);
        return { update: () => true };
      }
      if (this.cur) this._finish(this.cur);
      const c = { id, S, img: S.img || null, t: 0, wait: 0, closing: false, out: 0, done: false, opts };
      if (!c.img) Ale.Assets.loadStill(id).then((im) => { c.img = im; if (!im) c.failed = true; });
      this.cur = c;
      if (opts.album !== false) this.unlock(id);
      Ale.Input.consumeAll();
      Ale.UI.tapPoint = null;
      if (Ale.Audio) Ale.Audio.sfx('card');
      return { update: () => c.done };
    },

    _finish(c) {
      c.done = true; if (this.cur === c) this.cur = null; Ale.Input.consumeAll();
      if (c.opts && c.opts.toBlack && c.closing && Ale.UI) { Ale.UI.fadeA = 1; Ale.UI.fadeTarget = 1; }          // закрылась в чёрное: экран остаётся чёрным, пока сцена не сменится (иначе на кадр показался бы мир)
    },
    reset() { if (this.cur) this._finish(this.cur); this.album = null; },

    // Пропуск: касание, действие, прыжок, удар, Enter, Пробел (Esc и P открывают паузу поверх открытки: владелец 12.10.2026 — пауза везде)
    _skipPressed() {
      const I = Ale.Input, tp = Ale.UI.tapPoint;
      Ale.UI.tapPoint = null;
      return !!tp || I.pressed('interact') || I.pressed('jump') || I.pressed('attack') || I.edge('Enter') || I.edge('Space') || I.edge('KeyE');
    },

    update(dt) {
      if (this.cur) return this._updateCard(dt);
      if (this.album) this._updateAlbum(dt);
    },

    _updateCard(dt) {
      const c = this.cur;
      if (c.closing) { c.out += dt; if (c.out >= 0.5) this._finish(c); Ale.UI.tapPoint = null; return; }
      if (!c.img) {                         // картинка ещё грузится (или не загрузилась): ждём немного и идём дальше без неё
        c.wait += dt; Ale.UI.tapPoint = null;
        if (c.failed || c.wait > this.LOAD_WAIT) this._finish(c);
        return;
      }
      c.t += dt;
      if (c.t >= this.MIN_SHOW && this._skipPressed()) { c.closing = true; if (Ale.Audio) Ale.Audio.sfx('ui'); }
      else if (c.t < this.MIN_SHOW) { Ale.UI.tapPoint = null; }
    },

    // ------------------------------------------------------------ альбом
    openAlbum(onClose) {
      if (Ale.UI.menu) Ale.UI.closeMenu();
      const ids = this.ids();
      this.album = { ids, sel: Math.max(0, ids.findIndex((id) => this.unlocked(id))), view: null, t: 0, boxes: [], onClose: onClose || null };
      Ale.Input.consumeAll(); Ale.Input.edgeNow = new Set(); Ale.Input.edgeQueue = new Set();
      Ale.UI.tapPoint = null;
      for (const id of ids) if (this.unlocked(id)) Ale.Assets.loadStill(id, true);
    },
    _closeAlbum() {
      const a = this.album; this.album = null;
      Ale.Input.consumeAll(); Ale.UI.tapPoint = null;
      if (a && a.onClose) a.onClose();
    },
    _cols(W, n) { return W >= 900 && n > 6 ? 4 : n <= 3 ? Math.max(1, n) : 3; },       // 4 столбца и на самом узком виде (1000 юн.: iPad 4:3, квадратное окно): при 3 столбцах 14 открыток шли в 5 рядов по 120 px и подпись нижнего ряда налезала на подсказку клавиш (11.10.2026)

    _updateAlbum(dt) {
      const a = this.album, I = Ale.Input, n = a.ids.length;
      a.t += dt;
      const tp = Ale.UI.tapPoint; Ale.UI.tapPoint = null;
      const back = I.edge('Escape') || I.pressed('pause');
      if (a.view) {                        // одна картина на весь экран
        a.view.t += dt;
        if (a.t > 0.15 && a.view.t > 0.25 && (tp || back || I.edge('Enter') || I.edge('Space') || I.edge('KeyE') || I.pressed('interact') || I.pressed('jump'))) { a.view = null; if (Ale.Audio) Ale.Audio.sfx('ui'); }
        return;
      }
      if (a.t < 0.12) return;
      const cols = a.cols || 3;
      const move = (d) => { if (n) { a.sel = (a.sel + d + n) % n; if (Ale.Audio) Ale.Audio.sfx('ui'); } };
      if (I.edge('ArrowLeft') || I.edge('KeyA')) move(-1);
      if (I.edge('ArrowRight') || I.edge('KeyD')) move(1);
      if (I.edge('ArrowUp') || I.edge('KeyW')) move(-cols);
      if (I.edge('ArrowDown') || I.edge('KeyS')) move(cols);
      const open = (i) => { const id = a.ids[i]; if (id && this.unlocked(id)) { a.sel = i; a.view = { id, img: Ale.Assets.stills[id].img || null, t: 0 }; if (!a.view.img) Ale.Assets.loadStill(id).then((im) => { if (a.view && a.view.id === id) a.view.img = im; }); if (Ale.Audio) Ale.Audio.sfx('ui2'); } else if (Ale.Audio) Ale.Audio.sfx('locked'); };
      if (I.edge('Enter') || I.edge('Space') || I.edge('KeyE') || I.pressed('interact')) open(a.sel);
      if (back) { this._closeAlbum(); return; }
      if (tp) {
        if (a.closeBox && tp.x >= a.closeBox.x && tp.x <= a.closeBox.x + a.closeBox.w && tp.y >= a.closeBox.y && tp.y <= a.closeBox.y + a.closeBox.h) { this._closeAlbum(); return; }
        for (let i = 0; i < a.boxes.length; i++) { const b = a.boxes[i]; if (tp.x >= b.x && tp.x <= b.x + b.w && tp.y >= b.y && tp.y <= b.y + b.h) { open(i); break; } }
      }
    },

    // ------------------------------------------------------------ рисование
    draw(ctx, W, H) {
      if (this.cur) this._drawCard(ctx, W, H, this.cur);
      else if (this.album) this._drawAlbum(ctx, W, H);
    },

    // Картина «на весь кадр» с медленным наездом; подпись и подсказка — внизу, в зоне, где по заказу нет важного
    _picture(ctx, W, H, img, t, alpha) {
      const s = Math.max(W / img.width, H / img.height), k = clamp(t / 16, 0, 1), z = 1 + 0.06 * k;
      const w = img.width * s * z, h = img.height * s * z, mx = (w - W) / 2, my = (h - H) / 2;      // запас за краями кадра: сдвиг не открывает пустоты
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingQuality = 'high';
      // Вертикальный сдвиг («проезд камеры» снизу вверх) не должен выводить из кадра безопасную зону картины, y 15…74 % (правило заказов: лица, руки и ключевые предметы — внутри неё; снизу ещё и подпись).
      // На широком окне (iPhone во вкладке Safari, 2,4…2,5) срез картины доходил до 16–18 % сверху: у учительницы на открытке ASSAS первые секунды были обрезаны глаза (находка проверки картин, 18.10.2026).
      // Верх не срезается больше чем на 15 % высоты, низ — больше чем на 26 %; если окно настолько узкое, что вместе это невозможно, картина просто по центру.
      let cutTop = my - (k - 0.5) * my * 0.6;
      const maxTop = 0.15 * h, minTop = Math.max(0, 2 * my - 0.26 * h);
      cutTop = maxTop >= minTop ? clamp(cutTop, minTop, maxTop) : my;
      ctx.drawImage(img, -mx + (0.5 - k) * mx * 0.8, -cutTop, w, h);
      const g = ctx.createLinearGradient(0, H * 0.72, 0, H); g.addColorStop(0, 'rgba(10,6,14,0)'); g.addColorStop(1, 'rgba(10,6,14,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.72, W, H * 0.28);
      ctx.restore();
    },

    _caption(ctx, W, H, text, a, y) {
      if (!text || a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let font = 34;
      ctx.font = 'bold ' + font + 'px ' + Ale.FONT;
      let tw = ctx.measureText(text).width;
      while (tw > W - 120 && font > 18) {
        font -= 2; ctx.font = 'bold ' + font + 'px ' + Ale.FONT; tw = ctx.measureText(text).width;
      }
      const pw = Math.min(W - 40, tw + 70), py = y === undefined ? H - 74 : y;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; Ale.rr(ctx, W / 2 - pw / 2, py - 32 + 6, pw, 64, 32); ctx.fill();
      Ale.rr(ctx, W / 2 - pw / 2, py - 32, pw, 64, 32); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(text, W / 2, py + 2);
      ctx.restore();
    },

    _drawCard(ctx, W, H, c) {
      if (!c.img) { ctx.fillStyle = 'rgba(10,6,14,' + this.coverage(c).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); return; }       // картина ещё грузится: мир стоит, экран темнеет
      const a = (c.opts.instant ? 1 : clamp(c.t / 0.7, 0, 1)) * (c.closing ? 1 - clamp(c.out / 0.5, 0, 1) : 1);
      if (c.closing && c.opts.toBlack) { ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H); }          // закрывается в чёрное: картина тает на непрозрачном чёрном, а не на мире
      this._picture(ctx, W, H, c.img, c.t, a);
      this._caption(ctx, W, H, Ale.T.cards && Ale.T.cards[c.id], clamp((c.t - 0.9) / 0.6, 0, 1) * (c.closing ? 1 - clamp(c.out / 0.35, 0, 1) : 1));
      if (c.t > this.MIN_SHOW && !c.closing) {
        const pulse = 0.55 + 0.45 * Math.sin(c.t * 4);
        ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * pulse; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '600 22px ' + Ale.FONT; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.9)';
        const s = Ale.tx(Ale.T.card.next);
        const SR = (Ale.Game && Ale.Game.safe ? Ale.Game.safe.r : 0);          // справа вырез iPhone: «Дальше» стоит внутри безопасных полей
        ctx.strokeText(s, W - 30 - SR, H - 26); ctx.fillStyle = '#fff6e4'; ctx.fillText(s, W - 30 - SR, H - 26);
        ctx.restore();
      }
    },

    _drawAlbum(ctx, W, H) {
      const a = this.album, T = Ale.T.card;
      if (a.view) {
        const v = a.view, al = clamp(v.t / 0.3, 0, 1);
        if (v.img) { this._picture(ctx, W, H, v.img, v.t, al); this._caption(ctx, W, H, Ale.T.cards[v.id], al); }
        else { ctx.fillStyle = '#0b0810'; ctx.fillRect(0, 0, W, H); }
        return;
      }
      const n = a.ids.length;
      ctx.fillStyle = 'rgba(14,8,20,' + (0.965 * clamp(a.t / 0.2, 0, 1)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.font = 'bold 50px ' + Ale.FONT; ctx.lineWidth = 10; ctx.strokeStyle = OUT; ctx.strokeText(T.album, W / 2, 52);
      const gt = ctx.createLinearGradient(0, 26, 0, 78); gt.addColorStop(0, '#fff3c4'); gt.addColorStop(1, '#ffc35e'); ctx.fillStyle = gt; ctx.fillText(T.album, W / 2, 52);
      ctx.font = '600 22px ' + Ale.FONT; ctx.fillStyle = 'rgba(255,233,196,0.85)'; ctx.fillText(T.count.replace('{n}', this.count()).replace('{m}', n), W / 2, 96);
      // сетка
      const cols = this._cols(W, n); a.cols = cols;
      const rows = Math.max(1, Math.ceil(n / cols)), gap = 22, top = 126, availH = H - top - 26;
      let iw = Math.min(300, (W - 80 - (cols - 1) * gap) / cols);
      while (iw > 120 && rows * (iw * 9 / 16 + 48) + (rows - 1) * 6 > availH) iw -= 4;
      const ih = iw * 9 / 16, gw = cols * iw + (cols - 1) * gap, x0 = (W - gw) / 2;
      a.boxes = [];
      for (let i = 0; i < n; i++) {
        const id = a.ids[i], col = i % cols, row = Math.floor(i / cols);
        const x = x0 + col * (iw + gap), y = top + row * (ih + 54), sel = i === a.sel, open = this.unlocked(id), S = Ale.Assets.stills[id];
        a.boxes.push({ x, y, w: iw, h: ih });
        ctx.save();
        if (sel) { ctx.translate(x + iw / 2, y + ih / 2); const sc = 1.04 + Math.sin(a.t * 6) * 0.008; ctx.scale(sc, sc); ctx.translate(-(x + iw / 2), -(y + ih / 2)); }
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; Ale.rr(ctx, x + 3, y + 7, iw, ih, 14); ctx.fill();
        Ale.rr(ctx, x, y, iw, ih, 14);
        if (open) {
          const th = S.thumb || null;
          ctx.save(); ctx.clip();
          if (th) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(th, x, y, iw, ih); } else { ctx.fillStyle = '#5b3d4a'; ctx.fillRect(x, y, iw, ih); }
          ctx.restore();
        } else { ctx.fillStyle = '#2b1f33'; ctx.fill(); }
        Ale.rr(ctx, x, y, iw, ih, 14); ctx.lineWidth = sel ? 6 : 4; ctx.strokeStyle = sel ? '#ffd98a' : OUT; ctx.stroke();
        if (!open) { ctx.fillStyle = 'rgba(255,233,196,0.45)'; ctx.font = 'bold ' + Math.round(ih * 0.5) + 'px ' + Ale.FONT; ctx.fillText('?', x + iw / 2, y + ih / 2 + 4); }
        ctx.font = '600 17px ' + Ale.FONT; ctx.fillStyle = open ? '#fff6e4' : 'rgba(255,233,196,0.45)';
        const cap = open ? (Ale.T.cards[id] || '') : T.locked, lines = [], words = cap.split(' ');       // подпись в две строки
        let cur = '';
        for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > iw + 16 && cur) { lines.push(cur); cur = w; } else cur = t2; }
        lines.push(cur);
        if (lines.length > 2) { let l2 = lines[1]; while (l2.length > 1 && ctx.measureText(l2 + '…').width > iw + 16) l2 = l2.slice(0, -1).trimEnd(); lines[1] = l2 + '…'; }      // подпись длиннее двух строк: обрезка с многоточием, а не посреди фразы (полная — под открытой картиной)
        lines.slice(0, 2).forEach((ln, li) => ctx.fillText(ln, x + iw / 2, y + ih + 19 + li * 20));
        ctx.restore();
      }
      // закрыть
      const touch = Ale.Input.lastDevice === 'touch';
      const SR = (Ale.Game && Ale.Game.safe ? Ale.Game.safe.r : 0);
      a.closeBox = { x: W - 96 - SR, y: 14, w: 80, h: 64 };
      ctx.font = 'bold 44px ' + Ale.FONT; ctx.fillStyle = 'rgba(255,233,196,0.8)'; ctx.fillText('×', W - 56 - SR, 46);
      if (!touch) { ctx.font = '600 18px ' + Ale.FONT; ctx.fillStyle = 'rgba(255,233,196,0.6)'; ctx.fillText(T.help, W / 2, H - 14); }
    },
  });
})();
