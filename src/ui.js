// Интерфейс: диалоговые облачка, подсказки, HUD, затемнение, меню.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const Input = Ale.Input;
  const OUT = '#3a2431', CREAM = '#fff6e4', INK = '#3a2431';
  const HAND = '"Bradley Hand", "Segoe Print", "Marker Felt", "Comic Sans MS", cursive, sans-serif';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  Ale.rr = rr;

  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  // Тосты («Получено: …») лежат на полосе пола под подошвами героев (они стоят на y = 600 из 720), а не на уровне корпусов: на высоте H − 200 тост закрывал ноги и корпуса тех, кто стоит в центре (13.10.2026, проверка реплик)
  const TOAST_Y = 112;
  // Половина ширины тела (юн.) у героев без боевой рамки: по имени класса (раскладка облачков не ставит облачко на тела; Бубел и конь — разные по росту, рост берётся из headH)
  const HINT_BODY_HW = { Bubel: 34, Person: 40, Clerk: 64, Preslyukan: 100, WhaleCalf: 70, Teacher: 60, Danechka: 40, Dimasik: 46, Rat: 34, Cockroach: 34 };

  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.38);
    ctx.bezierCurveTo(x - s * 1.15, y - s * 0.25, x - s * 0.55, y - s * 1.0, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.0, x + s * 1.15, y - s * 0.25, x, y + s * 0.38);
    ctx.closePath();
  }

  const UI = (Ale.UI = {
    fadeA: 0, fadeTarget: 0, fadeSpeed: 0,
    dlg: null, hints: [], toasts: [], objective: { text: '', t: 0 },
    // Безопасные поля кадра в юнитах вида (вырез iPhone по бокам, домашняя полоса снизу; у обычного окна нули): всё, что стоит у края кадра, отступает от него на них (Game.safe)
    _S() { return (Ale.Game && Ale.Game.safe) || { l: 0, r: 0, t: 0, b: 0 }; },
    menu: null, tap: false, time: 0, hudVisible: true, hearts: { last: 5, bump: 0 },
    tipS: null, help: null, pl: null, ph: null,

    get dialogueActive() { return !!this.dlg; },
    // Модально всё, что останавливает мир. Меню финала (nonBlocking) мир не останавливает: салют и появление надписей идут.
    // Мини-игры на весь экран (шахматы Киева, автомат казино): модули с busy / update(dt) / draw(ctx, W, H) / reset(); пока открыта одна из них, мир стоит
    get miniBusy() { return !!((Ale.Chess && Ale.Chess.busy) || (Ale.Casino && Ale.Casino.busy) || (Ale.Credits && Ale.Credits.busy) || (Ale.Photo && Ale.Photo.busy) || (Ale.River && Ale.River.busy)); },
    get modal() { return !!(this.dlg || (this.menu && !this.menu.nonBlocking) || this.lock || this.help || this.ph || (Ale.Cards && Ale.Cards.busy) || this.miniBusy); },

    // ------------------------------------------------------------ затемнение
    fadeTo(a, dur) {
      this.fadeTarget = a;
      this.fadeSpeed = dur > 0 ? Math.abs(a - this.fadeA) / dur : 1e9;
      return { update: () => this.fadeA === this.fadeTarget };
    },

    // ------------------------------------------------------------ диалог
    say(lines, opts) {
      opts = opts || {};
      const norm = lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1], opt: l[2] } : l)).map((l) => Object.assign({}, l.opt, l));
      const d = { lines: norm, i: 0, shown: 0, autoT: 0, done: false, layout: null, blipT: 0, opts };
      if (this.dlg) this.dlg.done = true;        // диалог вытеснен новым: ждущий его сценарий не должен зависнуть
      this.dlg = d;
      this.hints.length = 0;
      this._startLine(d);
      return { update: () => d.done, get choice() { return d.choice === undefined ? -1 : d.choice; } };      // choice — номер выбранного ответа у реплики с choices (иначе −1)
    },

    _startLine(d) {
      const l = d.lines[d.i];
      d.shown = 0; d.autoT = 0; d.layout = null;
      if (l.do) l.do();
    },

    _updateDialogue(dt) {
      const d = this.dlg;
      const l = d.lines[d.i];
      const total = l.text.length;
      if (d.shown < total) {
        const before = Math.floor(d.shown);
        d.shown = Math.min(total, d.shown + (l.speed || 48) * dt);
        const after = Math.floor(d.shown);
        if (after > before) {
          d.blipT += after - before;
          if (d.blipT >= 2 && /\S/.test(l.text.charAt(after - 1))) { d.blipT = 0; if (Ale.Audio) Ale.Audio.blip(l.who); }
        }
      }
      if (l.choices && d.shown >= total) return this._updateChoice(dt);          // вопрос с вариантами ответа: реплика допечатана — дальше выбирает игрок
      const adv = Input.pressed('interact') || Input.pressed('jump') || Input.pressed('attack') || this.tap;
      this.tap = false;
      if (adv) {
        Input.consume('interact'); Input.consume('jump'); Input.consume('attack');
        if (d.shown < total) d.shown = total;
        else this._nextLine();
        return;
      }
      if (l.auto !== undefined && d.shown >= total) {
        d.autoT += dt;
        if (d.autoT >= l.auto) this._nextLine();
      }
    },

    // Варианты ответа под вопросом (реплика с choices: [{ text, … }]). ↑↓/W,S — выбрать, E/Enter/пробел — ответить, цифры — ответить сразу,
    // касание — по строке. Первые 0,35 с подтверждение не принимается: быстрое «пролистывание» вопроса не должно случайно ответить за игрока.
    _updateChoice(dt) {
      const d = this.dlg, l = d.lines[d.i], n = l.choices.length;
      if (d.chT === undefined) { d.chT = 0; d.sel = l.sel || 0; this.tapPoint = null; Input.consumeAll(); }          // sel — какой ответ стоит под курсором сначала (по умолчанию первый)
      d.chT += dt; this.tap = false;
      const tp = this.tapPoint; this.tapPoint = null;
      const step = (k) => { d.sel = (d.sel + k + n) % n; if (Ale.Audio) Ale.Audio.sfx('ui'); };
      if (Input.edge('ArrowUp') || Input.edge('KeyW')) step(-1);
      if (Input.edge('ArrowDown') || Input.edge('KeyS')) step(1);
      let pick = -1;
      for (let i = 0; i < Math.min(n, 9); i++) if (Input.edge('Digit' + (i + 1)) || Input.edge('Numpad' + (i + 1))) pick = i;
      if (d.chT >= 0.35) {
        if (Input.edge('Enter') || Input.edge('KeyE') || Input.edge('Space') || Input.pressed('interact')) pick = d.sel;
        if (tp && d.boxes) for (let i = 0; i < d.boxes.length; i++) { const b = d.boxes[i]; if (tp.x >= b.x && tp.x <= b.x + b.w && tp.y >= b.y && tp.y <= b.y + b.h) { pick = i; break; } }
      }
      if (pick >= 0 && pick < n) {
        d.sel = pick; d.choice = pick;
        if (Ale.Audio) Ale.Audio.sfx('ui2');
        Input.consumeAll();
        this._nextLine();
      }
    },
    // Сейчас на экране варианты ответа (нужно сенсорному управлению: кнопки на время выбора убираются, чтобы не перекрывать ответы)
    get choosing() {
      const d = this.dlg, l = d && d.lines[d.i];
      return !!(l && l.choices && d.shown >= l.text.length);
    },

    _nextLine() {
      const d = this.dlg;
      d.i++;
      if (d.i >= d.lines.length) {
        this.dlg = null; d.done = true;
        Input.consumeAll();
      } else this._startLine(d);
    },

    // ------------------------------------------------------------ кодовый замок: три барабана и записка над ними
    // opts: answer [3,1,4]; note { lines: [...], picture: [{ sprite, n, scale, cols }] }; wrong — надпись при ошибке.
    // Рисунков у барабанов нет: подсказка — только в записке (нажать на неё), без пояснений что к чему.
    codeLock(opts) {
      const L = { digits: [0, 0, 0], sel: 0, shake: 0, msg: '', msgT: 0, ok: false, done: false, opts, t: 0, boxes: {}, noteOpen: false, noteT: 0, read: false, fails: 0 };
      this.lock = L;
      Input.consumeAll();
      return { update: () => L.done, get ok() { return L.ok; }, get fails() { return L.fails; }, get read() { return L.read; } };
    },

    _openNote() {
      const L = this.lock;
      L.noteOpen = true; L.noteT = 0; L.read = true;
      if (Ale.Audio) Ale.Audio.sfx('paper');
    },

    _updateLock(dt) {
      const L = this.lock;
      L.t += dt;
      if (L.shake > 0) L.shake -= dt;
      if (L.msgT > 0) L.msgT -= dt;
      const tp = this.tapPoint; this.tapPoint = null;
      const hit = (b) => b && tp && tp.x >= b.x && tp.x <= b.x + b.w && tp.y >= b.y && tp.y <= b.y + b.h;
      if (L.noteOpen) {
        // записка закрывается любым касанием или клавишей
        L.noteT += dt;
        if (L.noteT > 0.2 && (tp || Input.edge('Escape') || Input.edge('Enter') || Input.edge('KeyE') || Input.edge('Space') || Input.edge('KeyN') || Input.edge('Tab'))) { L.noteOpen = false; Input.consume('pause'); if (Ale.Audio) Ale.Audio.sfx('ui'); }          // Esc закрывает записку и гасит нажатие; P и «II» — пауза (владелец 12.10.2026: пауза везде)
        return;
      }
      const step = (i, d) => { L.digits[i] = (L.digits[i] + d + 10) % 10; if (Ale.Audio) Ale.Audio.sfx('dial'); };
      if (Input.edge('ArrowLeft') || Input.edge('KeyA')) L.sel = (L.sel + 2) % 3;
      if (Input.edge('ArrowRight') || Input.edge('KeyD')) L.sel = (L.sel + 1) % 3;
      if (Input.edge('ArrowUp') || Input.edge('KeyW')) step(L.sel, 1);
      if (Input.edge('ArrowDown') || Input.edge('KeyS')) step(L.sel, -1);
      if (Input.edge('KeyN') || Input.edge('Tab')) this._openNote();
      if (Input.edge('Enter') || Input.edge('KeyE') || Input.edge('Space')) this._lockSubmit();
      if (Input.edge('Escape')) { L.done = true; this.lock = null; Input.consumeAll(); return; }          // Esc отходит от замка; P и «II» открывают паузу поверх него
      if (tp) {
        if (hit(L.boxes.note)) return this._openNote();
        for (let i = 0; i < 3; i++) {
          const up = L.boxes['up' + i], down = L.boxes['down' + i];
          if (!up || !down) continue;                                                                    // касание в тот же шаг, когда замок открылся: барабаны ещё не нарисованы (рамок нет)
          if (tp.x >= up.x && tp.x <= up.x + up.w && tp.y >= up.y && tp.y <= up.y + up.h) { L.sel = i; step(i, 1); }
          else if (tp.x >= down.x && tp.x <= down.x + down.w && tp.y >= down.y && tp.y <= down.y + down.h) { L.sel = i; step(i, -1); }
        }
        if (hit(L.boxes.submit)) this._lockSubmit();
        if (hit(L.boxes.close)) { L.done = true; this.lock = null; Input.consumeAll(); }
      }
    },

    _lockSubmit() {
      const L = this.lock; if (!L) return;
      const ok = L.digits.every((d, i) => d === L.opts.answer[i]);
      if (ok) { L.ok = true; L.done = true; this.lock = null; Input.consumeAll(); if (Ale.Audio) Ale.Audio.sfx('unlock'); }
      else { L.fails++; L.shake = 0.4; L.msg = (L.fails >= 3 && L.opts.wrongHint) || L.opts.wrong || 'Не подходит'; L.msgT = 1.9; if (Ale.Audio) Ale.Audio.sfx('wrong'); }
    },

    _drawLock(ctx, W, H) {
      const L = this.lock;
      ctx.fillStyle = 'rgba(14,8,20,0.7)'; ctx.fillRect(0, 0, W, H);
      const pw = 780, ph = 530, px = (W - pw) / 2 + (L.shake > 0 ? Math.sin(L.t * 90) * 10 * (L.shake / 0.4) : 0), py = (H - ph) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, px, py + 8, pw, ph, 30); ctx.fill();
      rr(ctx, px, py, pw, ph, 30); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.font = 'bold 34px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
      ctx.fillText('Замок посылки', px + pw / 2, py + 42);
      L.boxes = {};
      // записка над барабанами: маленький листок, по нажатию — читать
      const nb = { x: px + pw / 2 - 190, y: py + 78, w: 380, h: 84 };
      L.boxes.note = nb;
      const pulse = L.read ? 0 : 0.5 + 0.5 * Math.sin(L.t * 4);
      ctx.save(); ctx.translate(nb.x + nb.w / 2, nb.y + nb.h / 2); ctx.rotate(-0.018);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, -nb.w / 2 + 4, -nb.h / 2 + 6, nb.w, nb.h, 8); ctx.fill();
      rr(ctx, -nb.w / 2, -nb.h / 2, nb.w, nb.h, 8); ctx.fillStyle = '#fff0b8'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = L.read ? OUT : 'rgba(217,116,58,' + (0.65 + 0.35 * pulse).toFixed(2) + ')'; ctx.stroke();
      ctx.fillStyle = 'rgba(217,116,58,0.5)'; ctx.fillRect(-46, -nb.h / 2 - 10, 92, 22);           // клейкая лента
      ctx.font = 'italic bold 30px ' + HAND; ctx.fillStyle = INK; ctx.fillText('Записка', 0, -8);
      ctx.font = '600 17px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.65)';
      ctx.fillText(Input.lastDevice === 'touch' ? 'нажми, чтобы прочитать' : 'нажми или N — прочитать', 0, 22);
      ctx.restore();
      // барабаны
      const cy0 = py + 330, gap = 150, x0 = px + pw / 2 - gap;
      for (let i = 0; i < 3; i++) {
        const dx = x0 + i * gap, sel = i === L.sel;
        const up = { x: dx - 38, y: cy0 - 70, w: 76, h: 30 }, down = { x: dx - 38, y: cy0 + 58, w: 76, h: 30 };
        // зоны касания крупнее рисунка (на телефоне 1 юнит ≈ 0,5 пикселя): верхняя половина барабана — «вверх», нижняя — «вниз»
        L.boxes['up' + i] = { x: dx - 50, y: cy0 - 104, w: 100, h: 104 };
        L.boxes['down' + i] = { x: dx - 50, y: cy0 + 2, w: 100, h: 92 };
        for (const [b, dir] of [[up, -1], [down, 1]]) {
          rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fillStyle = sel ? '#ffd98a' : '#efe0c0'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx - 11, b.y + b.h / 2 - dir * 4); ctx.lineTo(dx + 11, b.y + b.h / 2 - dir * 4); ctx.lineTo(dx, b.y + b.h / 2 + dir * 6); ctx.closePath();
          ctx.fillStyle = INK; ctx.fill();
        }
        rr(ctx, dx - 38, cy0 - 38, 76, 96, 14); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = sel ? 6 : 4; ctx.strokeStyle = sel ? '#d9743a' : OUT; ctx.stroke();
        ctx.font = 'bold 64px ' + Ale.FONT; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(String(L.digits[i]), dx, cy0 + 12);
      }
      // кнопка
      const sb = { x: px + pw / 2 - 120, y: py + ph - 104, w: 240, h: 54 };
      L.boxes.submit = sb;
      rr(ctx, sb.x, sb.y, sb.w, sb.h, 27); ctx.fillStyle = '#ffd98a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.font = 'bold 28px ' + Ale.FONT; ctx.fillStyle = INK; ctx.fillText('Открыть', sb.x + sb.w / 2, sb.y + sb.h / 2 + 2);
      L.boxes.close = { x: px + pw - 84, y: py, w: 84, h: 84 };
      ctx.font = 'bold 34px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.6)'; ctx.fillText('×', px + pw - 37, py + 34);
      if (L.msgT > 0) {
        ctx.font = 'bold 26px ' + Ale.FONT; ctx.fillStyle = '#c0392b'; ctx.globalAlpha = Math.min(1, L.msgT * 2);
        ctx.fillText(L.msg, px + pw / 2, py + ph - 124); ctx.globalAlpha = 1;
      }
      if (Input.lastDevice !== 'touch' && !L.noteOpen) { ctx.font = '600 18px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.6)'; ctx.fillText('← → барабан · ↑ ↓ цифра · N — записка · Enter — открыть · Esc — закрыть', px + pw / 2, py + ph - 28); }
      if (L.noteOpen) this._drawNote(ctx, W, H);
    },

    // Записка целиком: рукописный текст и рисунок предметов (без подписей: считать предстоит самой Алесе).
    _drawNote(ctx, W, H) {
      const L = this.lock, N = L.opts.note; if (!N) return;
      const k = Ale.ease.outBack(Ale.clamp(L.noteT / 0.3, 0, 1));
      ctx.fillStyle = 'rgba(10,6,16,0.6)'; ctx.fillRect(0, 0, W, H);
      const w = 640, h = 470;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.014 * k); ctx.scale(0.86 + 0.14 * k, 0.86 + 0.14 * k); ctx.globalAlpha = Ale.clamp(L.noteT / 0.15, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -w / 2 + 6, -h / 2 + 12, w, h, 10); ctx.fill();
      rr(ctx, -w / 2, -h / 2, w, h, 10); ctx.fillStyle = '#fff4cf'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      // клетчатый листок из блокнота: тонкие линии
      ctx.strokeStyle = 'rgba(120,150,190,0.28)'; ctx.lineWidth = 1.4;
      for (let y = -h / 2 + 96; y < h / 2 - 20; y += 40) { ctx.beginPath(); ctx.moveTo(-w / 2 + 14, y); ctx.lineTo(w / 2 - 14, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(214,80,80,0.35)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 60, -h / 2 + 10); ctx.lineTo(-w / 2 + 60, h / 2 - 10); ctx.stroke();
      ctx.fillStyle = 'rgba(217,116,58,0.55)'; ctx.fillRect(-w / 2 - 6, -h / 2 + 4, 90, 24); ctx.fillRect(w / 2 - 84, -h / 2 + 4, 90, 24);
      // текст
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2b3a5c';
      ctx.font = 'italic bold 33px ' + HAND;
      let y = -h / 2 + 76;
      for (const line of N.lines) { ctx.fillText(line, -w / 2 + 80, y); y += 40; }
      // рисунок: три группы предметов через тонкие разделители
      const groups = N.picture.map((g) => {
        const sz = Ale.spriteSize(g.sprite) || { w: 60, h: 60 };
        const cw = sz.w * g.scale + 12, ch = sz.h * g.scale + 8, cols = g.cols || g.n, rows = Math.ceil(g.n / cols);
        return { g, cw, ch, cols, rows, w: cols * cw, h: rows * ch };
      });
      const sp = 54, total = groups.reduce((a, q) => a + q.w, 0) + sp * (groups.length - 1);
      let gx = -total / 2; const gy = h / 2 - 104;
      groups.forEach((q, gi) => {
        for (let i = 0; i < q.g.n; i++) {
          const c = i % q.cols, r = Math.floor(i / q.cols);
          Ale.drawSprite(ctx, q.g.sprite, gx + c * q.cw + q.cw / 2, gy + (r - (q.rows - 1) / 2) * q.ch, { sx: q.g.scale, sy: q.g.scale, rot: ((i * 37) % 7 - 3) * 0.02 });
        }
        gx += q.w + sp;
      });
      ctx.font = 'italic 600 19px ' + HAND; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(43,58,92,0.55)';
      ctx.fillText(Input.lastDevice === 'touch' ? 'нажми, чтобы закрыть' : 'любая клавиша — закрыть', 0, h / 2 - 24);
      ctx.restore();
    },


    // ------------------------------------------------------------ телефон Алеси: переписка (сценарный интерфейс, настоящих сообщений нет)
    // spec: { name, who (ключ портрета), msgs: [{ from: 'ale' | другой, text }], card?: { title, sub } }. Сообщения появляются по одному (сначала «печатает…»),
    // E / касание — следующее; после последнего (и карточки места, если есть) окно закрывается. Мир на время окна стоит.
    phone(spec) {
      const P = { spec, items: spec.msgs.map((m) => ({ type: 'msg', m })).concat(spec.card ? [{ type: 'card', card: spec.card }] : []), shown: 0, t: 0, itemT: 0, done: false };
      if (spec.card) P.items[P.items.length - 1].m = { from: spec.who };
      this.ph = P; Input.consumeAll(); this.tapPoint = null;
      if (Ale.Audio) Ale.Audio.sfx('phone');
      return { update: () => P.done };
    },

    _updatePhone(dt) {
      const P = this.ph; P.t += dt; P.itemT += dt;
      const tp = this.tapPoint; this.tapPoint = null;
      const typing = P.shown < P.items.length && P.itemT < 0.55;           // «печатает…»: следующее сообщение ещё не пришло
      if (P.shown < P.items.length && !typing && P.itemT >= 0.55) { P.shown++; P.itemT = 0; P.revealT = P.t; if (Ale.Audio) Ale.Audio.sfx('msg'); return; }
      const adv = (Input.pressed('interact') || Input.pressed('jump') || Input.pressed('attack') || tp) && P.t > 0.4;
      if (!adv) return;
      Input.consumeAll();
      if (P.shown < P.items.length) { P.shown++; P.itemT = 0; P.revealT = P.t; if (Ale.Audio) Ale.Audio.sfx('msg'); }       // не дожидаясь «печатает…»
      else { this.ph = null; P.done = true; if (Ale.Audio) Ale.Audio.sfx('ui'); }
    },

    _drawPhone(ctx, W, H) {
      const P = this.ph, sp = P.spec, T = Ale.T.kyiv;
      ctx.fillStyle = 'rgba(14,8,20,0.66)'; ctx.fillRect(0, 0, W, H);
      const k = Ale.ease.outCubic(Ale.clamp(P.t / 0.3, 0, 1));
      const pw = 380, ph = 580, px = (W - pw) / 2, py = (H - ph) / 2 + 6 + (1 - k) * 70;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, px + 6, py + 12, pw, ph, 46); ctx.fill();
      rr(ctx, px, py, pw, ph, 46); ctx.fillStyle = '#2b2330'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
      const sx = px + 16, sy = py + 20, sw = pw - 32, sh = ph - 40;
      rr(ctx, sx, sy, sw, sh, 32); ctx.fillStyle = '#f6efe3'; ctx.fill();
      ctx.save(); rr(ctx, sx, sy, sw, sh, 32); ctx.clip();
      // шапка: аватар и имя
      ctx.fillStyle = '#e9dcc6'; ctx.fillRect(sx, sy, sw, 92);
      ctx.fillStyle = 'rgba(58,36,49,0.18)'; ctx.fillRect(sx, sy + 92, sw, 2);
      const ax = sx + 56, ay = sy + 52, ar = 30, port = Ale.Assets.portraits[sp.who];
      ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 6.283); ctx.clip();
      if (port) ctx.drawImage(port, ax - ar, ay - ar, ar * 2, ar * 2);
      else { ctx.fillStyle = '#d9a89a'; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2); ctx.fillStyle = INK; ctx.font = 'bold 30px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.name.charAt(0), ax, ay + 2); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(ax, ay, ar, 0, 6.283); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 26px ' + Ale.FONT; ctx.fillText(sp.name, ax + ar + 16, ay - 8);
      ctx.font = '600 17px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.55)'; ctx.fillText('в сети', ax + ar + 16, ay + 18);
      // сообщения
      const mw = sw - 70;
      let y = sy + 116;
      const bubble = (text, mine, h0, alpha) => {
        ctx.font = 'bold 22px ' + Ale.FONT;
        const lines = wrap(ctx, text, mw - 34), tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), bw = tw + 34, bh = lines.length * 29 + 24;
        const bx = mine ? sx + sw - bw - 20 : sx + 20;
        ctx.save(); ctx.globalAlpha *= alpha;
        rr(ctx, bx, y, bw, bh, 22); ctx.fillStyle = mine ? '#ffd3de' : '#ffffff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        lines.forEach((l, i) => ctx.fillText(l, bx + 17, y + 12 + 14.5 + i * 29));
        ctx.restore();
        y += bh + 14;
      };
      const dots = (mine) => {
        const bw = 78, bh = 44, bx = mine ? sx + sw - bw - 20 : sx + 20;
        rr(ctx, bx, y, bw, bh, 22); ctx.fillStyle = mine ? '#ffd3de' : '#fff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(58,36,49,' + (0.35 + 0.5 * Math.max(0, Math.sin(P.t * 9 - i * 0.9))).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(bx + 22 + i * 17, y + bh / 2, 5, 0, 6.283); ctx.fill(); }
        y += bh + 14;
      };
      for (let i = 0; i < Math.min(P.shown, P.items.length); i++) {
        const it = P.items[i], mine = it.m && it.m.from === 'ale', age = i === P.shown - 1 ? Ale.clamp((P.t - P.revealT) / 0.18, 0, 1) : 1;
        if (it.type === 'msg') bubble(it.m.text, mine, 0, age);
        else {
          // карточка места: булавка, название, подпись
          const cw = sw - 44, chh = 104, cx = sx + 22;
          ctx.save(); ctx.globalAlpha *= age;
          rr(ctx, cx, y, cw, chh, 20); ctx.fillStyle = '#e8f1e2'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
          ctx.save(); rr(ctx, cx, y, cw, chh, 20); ctx.clip();
          ctx.strokeStyle = 'rgba(120,170,200,0.55)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx - 10, y + chh * 0.78); ctx.bezierCurveTo(cx + cw * 0.3, y + chh * 0.4, cx + cw * 0.6, y + chh * 1.0, cx + cw + 10, y + chh * 0.3); ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#e8445a'; ctx.beginPath(); ctx.arc(cx + 46, y + 40, 16, 0, 6.283); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 36, y + 49); ctx.lineTo(cx + 46, y + 70); ctx.lineTo(cx + 56, y + 49); ctx.closePath(); ctx.fillStyle = '#e8445a'; ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + 46, y + 40, 6, 0, 6.283); ctx.fill();
          ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 21px ' + Ale.FONT; ctx.fillText(it.card.title, cx + 78, y + 36);
          ctx.font = '600 16px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.7)'; ctx.fillText(it.card.sub, cx + 78, y + 62);       // 16, а не 17 px: «побережье рядом с Монако» (слова из ТЗ) при 17 упиралось в край карточки на 2,6 px
          ctx.restore();
          y += chh + 14;
        }
      }
      if (P.shown < P.items.length && P.itemT < 0.55) { const nx = P.items[P.shown]; dots(nx.m && nx.m.from === 'ale'); }
      ctx.restore();                                       // клип экрана
      ctx.font = '600 18px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,246,228,0.9)';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.85)';
      const hint = Ale.tx(T.phoneNext); ctx.strokeText(hint, W / 2, py + ph + 24); ctx.fillText(hint, W / 2, py + ph + 24);
      ctx.restore();
    },

    // Вспышка цветом по краям экрана (получила удар).
    flash(color, dur) { this.fl = { color, age: 0, life: dur || 0.3 }; },

    // Короткая надпись по центру экрана (после поражения и т. п.).
    banner(text, dur) { this.bn = { text, age: 0, life: dur || 1.6 }; },

    // ------------------------------------------------------------ подсказки, тосты, цель
    hint(who, text, dur) {
      this.hints = this.hints.filter((h) => h.who !== who);
      // облачко живёт не меньше, чем нужно, чтобы его прочитать: 0,9 с — заметить и 16 знаков в секунду (короткие «Бегу изо всех лап!» на 1,2 с исчезали раньше, чем их успевали прочесть)
      this.hints.push({ who, text, life: Math.max(dur || 4, 0.9 + String(text).length / 16), age: 0 });
      const sc = Ale.Game.scene, a = sc && sc.actors[who];
      if (a && a.talk) a.talk(Math.min(2.4, 0.5 + text.length * 0.05));
    },
    clearHints() { this.hints.length = 0; },
    toast(text, sprite) { this.toasts.push({ text, sprite, age: 0, life: 2.6 }); if (Ale.Audio) Ale.Audio.sfx('pickup'); },
    setObjective(text) { if (this.objective && this.objective.text === text && text) return; this.objective = { text, t: 0 }; },       // тот же текст — плашка остаётся (раньше она выезжала заново, когда сценарий подтверждал цель, уже стоящую на экране)

    // ------------------------------------------------------------ обучающая подсказка с клавишами
    // spec: { title, text, kb: [['A','D'], ['←','→']], touch: [['◀','▶']] } — группы клавиш-альтернатив («или»).
    // Висит, пока сценарий не вызовет tipDone() (тогда — галочка и уход) или clearTip().
    tip(spec) { this.tipS = { spec, age: 0, done: false, doneT: 0 }; },
    tipDone() { const t = this.tipS; if (t && !t.done) { t.done = true; t.doneT = 0; if (Ale.Audio) Ale.Audio.sfx('pickup'); } },
    clearTip() { this.tipS = null; },
    // Панель подсказки ждёт, пока название места на экране (или ещё не показано): оба стоят вверху кадра и на старте сцены шли друг по другу («Париж / Почта» поверх «Ходьба», настоящий iPhone 14.10.2026);
    // возраст панели в это время стоит, поэтому выезжает она целиком, когда название ушло. Под меню паузы, «Как играть» и громкостью панели нет вовсе (раньше просвечивала сквозь заголовок «Пауза»).
    _tipBlocked() { const p = this.pl; return !!(p && p.age < p.life); },

    // ------------------------------------------------------------ название места при входе в сцену
    place(title, sub, y) { this.pl = { title, sub, age: -0.55, life: 3.4, y: y || 0.3 }; },

    // ------------------------------------------------------------ окно «Как играть»
    openHelp(onClose) {
      this.help = { t: 0, onClose: onClose || null };
      Input.consumeAll(); Input.edgeNow = new Set(); Input.edgeQueue = new Set();
    },
    _updateHelp(dt) {
      const h = this.help; h.t += dt;
      const tp = this.tapPoint; this.tapPoint = null;
      if (h.t > 0.15 && (tp || Input.edge('Escape') || Input.pressed('pause') || Input.edge('Enter') || Input.edge('Space') || Input.edge('KeyE'))) {
        this.help = null; this.tap = false; Input.consumeAll();
        if (Ale.Audio) Ale.Audio.sfx('ui');
        if (h.onClose) h.onClose();
      }
    },

    // ------------------------------------------------------------ меню
    openMenu(items, opts) {
      this.menu = Object.assign({ items, sel: 0, boxes: [], title: '', t: 0 }, opts);
      this.tap = false;
      Input.consumeAll();
      Input.edgeNow = new Set(); Input.edgeQueue = new Set();      // то же нажатие (Esc), что открыло меню, не должно его сразу закрыть
    },
    closeMenu() { this.menu = null; this.tap = false; },

    _updateMenu(dt) {
      const m = this.menu;
      m.t += dt;
      if (Input.edge('ArrowUp') || Input.edge('KeyW')) { m.sel = (m.sel + m.items.length - 1) % m.items.length; if (Ale.Audio) Ale.Audio.sfx('ui'); }
      if (Input.edge('ArrowDown') || Input.edge('KeyS')) { m.sel = (m.sel + 1) % m.items.length; if (Ale.Audio) Ale.Audio.sfx('ui'); }
      // ползунок под выбранной строкой: ←→ / A D двигают на шаг, при удержании — повторяют
      const cur = m.items[m.sel];
      if (cur && cur.slider) {
        const dir = (Input.edge('ArrowRight') || Input.edge('KeyD') ? 1 : 0) - (Input.edge('ArrowLeft') || Input.edge('KeyA') ? 1 : 0);
        if (dir) { m.rep = 0; m.repT = 0; this._sliderStep(cur, dir); }
        else {
          const held = (Input.down('right') ? 1 : 0) - (Input.down('left') ? 1 : 0);
          if (held) { m.rep = (m.rep || 0) + dt; if (m.rep > 0.4) { m.repT = (m.repT || 0) + dt; while (m.repT >= 0.07) { m.repT -= 0.07; this._sliderStep(cur, held); } } } else { m.rep = 0; m.repT = 0; }
        }
      }
      if (Input.edge('Enter') || Input.edge('Space') || Input.edge('KeyE') || Input.pressed('interact')) this._pick(m.sel);
      if ((Input.edge('Escape') || Input.pressed('pause')) && m.onBack) m.onBack();          // P и кнопка «II» на экране тоже закрывают паузу
      if (this.tapPoint) {
        const p = this.tapPoint; this.tapPoint = null;
        for (let i = 0; i < m.boxes.length; i++) {
          const b = m.boxes[i];
          if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
            m.sel = i;
            // строка с ползунком: касание по полоске задаёт положение (и начинает перетаскивание), по названию или числу — выключает/включает
            if (m.items[i].slider && b.track) { if (p.x >= b.track.x0 - 26 && p.x <= b.track.x1 + 26) { m.drag = i; this._sliderAt(i, p.x); } else this._pick(i); }
            else this._pick(i);
            break;
          }
        }
      }
    },

    _pick(i) {
      const m = this.menu; if (!m) return;                       // меню уже закрыто другим нажатием в этом же шаге (клавиша и касание на гибридном устройстве)
      const it = m.items[i];
      if (!it || it.disabled) return;
      if (Ale.Audio) Ale.Audio.sfx('ui2');
      Input.consumeAll();
      if (it.slider) { if (it.slider.toggle) it.slider.toggle(); return; }       // ползунок: E / Enter выключает и включает звук
      it.action();
    },

    // ---- ползунки в меню: положение 0…1 (item.slider = { get, set, step, toggle, preview })
    _sliderSet(it, v, quiet) {
      const S = it.slider; v = Math.max(0, Math.min(1, v));
      if (Math.abs(v - S.get()) < 1e-9) return;
      S.set(v);
      // эффекты: короткий образец, чтобы услышать новый уровень (не чаще раза в 0,12 с)
      if (S.preview && !quiet && Ale.Audio && this.time - (this._prevAt || -9) > 0.12) { this._prevAt = this.time; Ale.Audio.sfx('pickup'); }
    },
    _sliderStep(it, dir) {
      const S = it.slider, k = S.get() / S.step;
      this._sliderSet(it, (dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * S.step);
    },
    _sliderAt(i, x) {
      const m = this.menu, b = m.boxes[i]; if (!b || !b.track) return;
      this._sliderSet(m.items[i], Math.round((x - b.track.x0) / (b.track.x1 - b.track.x0) * 100) / 100);
    },

    // Перетаскивание ползунка: палец или мышь ведут по полоске, отпускание заканчивает (для эффектов — образец звука)
    pointerMove(x) {
      const m = this.menu;
      if (m && m.drag !== undefined) this._sliderAt(m.drag, x);
    },
    pointerUp() {
      const m = this.menu;
      if (!m || m.drag === undefined) return;
      const it = m.items[m.drag]; m.drag = undefined;
      if (it && it.slider && it.slider.preview && Ale.Audio) Ale.Audio.sfx('pickup');
    },

    // Касание/клик в координатах вида.
    pointer(x, y) {
      if (this.menu || this.lock || this.help || this.ph || (Ale.Cards && Ale.Cards.busy) || this.miniBusy || this.choosing) this.tapPoint = { x, y };     // старое касание не должно «протекать» в следующее меню
      if (this.dlg && !this.menu && !this.help) this.tap = true;          // касание по меню паузы или «Как играть» поверх реплики репликой не засчитывается: иначе после «Продолжить» строка сама пролистывалась (18.10.2026)
    },

    // Звук заплыва стоит вместе с его часами: под меню паузы и справкой (update) и пока телефон в вертикальном положении (Game.step: игра в это время стоит, а музыка шла бы дальше и в заплыве уехала бы от долей)
    _rvHold(on) { on = !!on; if (on !== !!this._rvAudio) { this._rvAudio = on; if (Ale.Audio && Ale.Audio.holdForPause) Ale.Audio.holdForPause(on); } },

    // ------------------------------------------------------------ обновление
    update(dt) {
      this.time += dt;
      if (this.fadeA !== this.fadeTarget) {
        this.fadeA = Ale.approach(this.fadeA, this.fadeTarget, this.fadeSpeed * dt);
      }
      for (const h of this.hints) if (!h.hold) h.age += dt;                // hold — облачко стоит под названием места и ждёт, пока оно погаснет (_drawHints)
      this.hints = this.hints.filter((h) => h.age < h.life);
      for (const t of this.toasts) t.age += dt;
      this.toasts = this.toasts.filter((t) => t.age < t.life);
      this.objective.t += dt;
      if (this.bn) { this.bn.age += dt; if (this.bn.age >= this.bn.life) this.bn = null; }
      if (this.fl) { this.fl.age += dt; if (this.fl.age >= this.fl.life) this.fl = null; }
      if (this.hearts.bump > 0) this.hearts.bump = Math.max(0, this.hearts.bump - dt * 3);
      if (this.tipS) { const t = this.tipS; if (!this._tipBlocked()) t.age += dt; if (t.done) { t.doneT += dt; if (t.doneT > 1.0) this.tipS = null; } }
      if (this.pl && !(Ale.Cards && Ale.Cards.busy) && !this.miniBusy && !this.menu && !this.help && !this.dlg) { this.pl.age += dt; if (this.pl.age >= this.pl.life) this.pl = null; }       // название места ждёт, пока открытка на экране
      // заплыв через Днепр: подложка под диалогами и сам заплыв идут по своим часам; блокирует остальное только пока busy (miniBusy). Пока поверх открыто меню паузы или памятка, часы заплыва стоят
      // (подложка с героями — тоже), а в самом заплыве вместе с ними стоит и звук: иначе после паузы удары и ряды препятствий уехали бы от музыки (владелец 11.10.2026: «во время заплыва нельзя поставить паузу»)
      const rvFrozen = !!(this.menu || this.help), rvAudio = rvFrozen && !!(Ale.River && Ale.River.busy);
      this._rvHold(rvAudio);
      if (Ale.River && Ale.River.session && !rvFrozen && !(Ale.Audio && Ale.Audio.resumePending && Ale.Audio.resumePending(dt))) Ale.River.update(dt);
      // Меню паузы (и громкость, открытая из него) и «Как играть» берут ввод первыми, а всё под ними стоит: разговор, замок, телефон, открытка, шахматы, автомат, рулетка, титры, снимок (владелец 12.10.2026: пауза везде)
      if (this.menu && this.menu.pause) this._updateMenu(dt);
      else if (this.help) this._updateHelp(dt);
      else if (Ale.Chess && Ale.Chess.busy) Ale.Chess.update(dt);              // окна на весь экран и модальные окна: работает ровно одно (одна цепочка)
      else if (Ale.Casino && Ale.Casino.busy) Ale.Casino.update(dt);
      else if (Ale.Credits && Ale.Credits.busy) Ale.Credits.update(dt);
      else if (Ale.Photo && Ale.Photo.busy) Ale.Photo.update(dt);
      else if (Ale.Cards && Ale.Cards.busy) Ale.Cards.update(dt);
      else if (Ale.River && Ale.River.busy && !this.menu && !this.help) { /* заплыв уже обновлён выше; под меню паузы и «Как играть» ветка не нужна: иначе они рисуются, но ввод до них не доходит (владелец 11.10.2026: «после Esc ничего нельзя нажать») */ }
      else if (this.lock) this._updateLock(dt);
      else if (this.ph) this._updatePhone(dt);
      else if (this.menu) this._updateMenu(dt);
      else if (this.dlg) this._updateDialogue(dt);
    },

    // ------------------------------------------------------------ рисование
    draw(ctx, W, H, scene, alpha) {
      if (Ale.River && Ale.River.passive) Ale.River.draw(ctx, W, H);        // подложка заплыва (берег Днепра): под интерфейсом и диалогами, поверх мира
      if (this.fl) {
        const f = this.fl, k = 1 - f.age / f.life;
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, Math.max(W, H) * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, f.color.replace('ALPHA', (0.55 * k).toFixed(3)));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (scene && this.hudVisible && scene.player && !scene.hideHud) this._drawHud(ctx, W, H, scene);
      if (scene) this._drawObjective(ctx, W, H);
      if (scene) this._drawTip(ctx, W, H);
      if (scene) this._drawPrompt(ctx, scene);
      if (scene) this._drawHints(ctx, W, H, scene);
      this._drawToasts(ctx, W, H);
      if (this.dlg && scene) this._drawDialogue(ctx, W, H, scene);
      if (Ale.Chess && Ale.Chess.busy) Ale.Chess.draw(ctx, W, H);         // шахматная доска (Киев): поверх игры, под затемнением переходов
      if (Ale.Casino && Ale.Casino.busy) Ale.Casino.draw(ctx, W, H);       // игровой автомат (Монако)
      if (Ale.Credits && Ale.Credits.busy) Ale.Credits.draw(ctx, W, H);    // титры (комната-сюрприз)
      if (Ale.Photo && Ale.Photo.busy) Ale.Photo.draw(ctx, W, H);          // снимок очками (комната-сюрприз)
      if (Ale.River && Ale.River.busy) Ale.River.draw(ctx, W, H);          // заплыв через Днепр (Киев): модальное окно на весь экран
      if (Ale.Cards && Ale.Cards.busy) Ale.Cards.draw(ctx, W, H);        // открытка и альбом — поверх всего игрового, но под затемнением переходов
      if (this.fadeA > 0) { ctx.fillStyle = 'rgba(10,6,14,' + this.fadeA.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      if (this.bn) {
        const b = this.bn, a = Ale.clamp(Math.min(b.age / 0.25, (b.life - b.age) / 0.35), 0, 1);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 46px ' + Ale.FONT;
        const bw = ctx.measureText(b.text).width, bmax = W - 70 - this._S().l - this._S().r;
        if (bw > bmax) ctx.font = 'bold ' + Math.max(24, Math.floor(46 * bmax / bw)) + 'px ' + Ale.FONT;          // длинная надпись (реплика при поражении) сжимается, чтобы не уходить за края кадра на узком виде
        ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.strokeText(b.text, W / 2, H / 2 - 8 + (1 - a) * 14);
        ctx.fillStyle = '#ffe9c4'; ctx.fillText(b.text, W / 2, H / 2 - 8 + (1 - a) * 14); ctx.restore();
      }
      if (scene) this._drawPlace(ctx, W, H);
      if (this.lock) this._drawLock(ctx, W, H);
      if (this.ph) this._drawPhone(ctx, W, H);
      if (this.help) this._drawHelp(ctx, W, H);
      if (this.menu) this._drawMenu(ctx, W, H);
      this._drawSoundHint(ctx, W, H);
    },

    // Плашка «Коснись экрана, чтобы включить звук» (27.10.2026): звук включён ползунками, но браузер его ещё не разрешил (первого касания не было — ссылка быстрого старта, возвращение со значка «Домой»,
    // звонок прервал звук) или контекст сломался и ждёт касания, чтобы пересоздаться (Audio.needsTap). Появляется не сразу (0,6 с: звук обычно идёт с первого касания), на заставке с «Нажмите, чтобы начать» не нужна.
    _drawSoundHint(ctx, W, H) {
      const A = Ale.Audio, gate = Ale.Game && Ale.Game.mode === 'title' && Ale.Title && Ale.Title.phase === 'gate';
      const want = !!(A && A.needsTap && A.needsTap()) && !gate && !(Ale.Game && Ale.Game.mode === 'loading');
      this._sndT = want ? (this._sndT || 0) + 1 / 60 : 0;
      if (this._sndT < 0.6) { this._sndBox = null; return; }
      const T = Ale.T.audio.unlock, s = Ale.Touch && Ale.Touch.active ? T.touch : T.kb, a = Ale.clamp((this._sndT - 0.6) / 0.3, 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.font = 'bold 24px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(s).width + 44, h = 44, x = W / 2 - w / 2, ob = this.objective && this.objective.text ? this._objBox : null;
      // на узком виде (1000 юн.: iPad, квадратное окно) плашка цели справа вверху заходит под середину кадра — тогда плашка звука встаёт под ней (не на обучающую панель: та ниже, с y 112)
      const y = ob && x + w > ob.x - 8 && x < ob.x + ob.w + 8 ? Math.max(14 + (this._S().t || 0), ob.y + ob.h + 8) : 14 + (this._S().t || 0);
      this._sndBox = { x, y, w, h, text: s };
      rr(ctx, x, y, w, h, 22); ctx.fillStyle = 'rgba(255,246,228,0.94)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillText(s, W / 2, y + h / 2 + 1); ctx.restore();
    },

    _drawHud(ctx, W, H, scene) {
      const st = Ale.Game.state, S = this._S();
      // сердца
      const px = 26 + S.l, py = 40;
      for (let i = 0; i < st.maxHp; i++) {
        const full = i < st.hp;
        const bump = (i === st.hp && this.hearts.bump > 0) ? 1 + this.hearts.bump * 0.5 : 1;
        ctx.save(); ctx.translate(px + i * 42, py); ctx.scale(bump, bump);
        heart(ctx, 0, 0, 17);
        ctx.fillStyle = full ? '#e8445a' : 'rgba(58,36,49,0.55)';
        ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
        if (full) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-6, -6, 3.5, 2.5, -0.6, 0, 6.3); ctx.fill(); }
        ctx.restore();
      }
      // помидоры (в бою с Димасиком вместо них — набор: значок и счётчик, сцена отдаёт их через scene.kitHud())
      const kh = scene.kitHud ? scene.kitHud() : null;
      if (kh) {
        Ale.drawSprite(ctx, kh.sprite, 32 + S.l, 98, { sx: kh.scale || 1, sy: kh.scale || 1, rot: kh.rot || 0 });
        ctx.font = 'bold 28px ' + Ale.FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.strokeText(kh.text, 58 + S.l, 100);
        ctx.fillStyle = kh.warn ? '#ff9d9d' : '#fff'; ctx.fillText(kh.text, 58 + S.l, 100);
      } else {
        Ale.drawSprite(ctx, 'pr_tomato', 30 + S.l, 98, { sx: 1.05, sy: 1.05 });
        ctx.font = 'bold 30px ' + Ale.FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.strokeText('× ' + st.tomatoes, 52 + S.l, 100);
        ctx.fillStyle = st.tomatoes > 0 ? '#fff' : '#ff9d9d'; ctx.fillText('× ' + st.tomatoes, 52 + S.l, 100);
      }
      // босс
      const b = scene.boss;
      if (b) {
        const w = b.max > 8 ? 372 : 300, x = W / 2 - w / 2, y = 78;
        ctx.font = 'bold 22px ' + Ale.FONT; ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.strokeText(b.name, W / 2, y - 6);
        ctx.fillStyle = '#fff6e4'; ctx.fillText(b.name, W / 2, y - 6);
        const n = b.max, gap = 8, pw = (w - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const px2 = x + i * (pw + gap);
          rr(ctx, px2, y + 6, pw, 16, 8);
          ctx.fillStyle = i < b.value() ? '#d63421' : 'rgba(255,246,228,0.32)'; ctx.fill();       // пустая ячейка светлая — читается и на тёмном фоне туннеля
          ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
          ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,246,228,0.55)'; rr(ctx, px2 + 3, y + 9, pw - 6, 10, 5); ctx.stroke();
        }
      }
    },

    // Клавиша: скруглённый «кейкап». Возвращает ширину.
    _keycap(ctx, x, y, lab, w) {
      if (Ale.Icons && Ale.Icons.is(lab)) { Ale.Icons.button(ctx, lab, x + w / 2, y + 23, 22); return; }          // кнопка управления на касании: тот же круглый значок, что на экране
      rr(ctx, x, y + 4, w, 44, 10); ctx.fillStyle = 'rgba(58,36,49,0.35)'; ctx.fill();
      rr(ctx, x, y, w, 44, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 24px ' + Ale.FONT; ctx.fillText(lab, x + w / 2, y + 23);
    },

    // Рамка и устройство панели обучающей подсказки (её читают и рисование, и раскладка облачков: облачко не должно закрывать панель)
    _tipBox(ctx, W) {
      const t = this.tipS;
      if (!t || this.dlg || this.lock || this.menu || this.help || this._tipBlocked()) return null;
      const sp = t.spec, touch = Input.lastDevice === 'touch';
      const groups = (touch ? sp.touch : sp.kb) || sp.kb || [];
      ctx.font = 'bold 24px ' + Ale.FONT;
      const capW = (lab) => (Ale.Icons && Ale.Icons.is(lab) ? 48 : Math.max(46, ctx.measureText(lab).width + 26));
      const gap = 8, orW = 58;
      let keysW = 0;
      groups.forEach((g, gi) => { g.forEach((lab, i) => { keysW += capW(lab) + (i ? gap : 0); }); if (gi) keysW += orW; });
      ctx.font = 'bold 22px ' + Ale.FONT;
      const titleW = ctx.measureText(sp.title).width;
      ctx.font = '600 20px ' + Ale.FONT;
      const textW = sp.text ? ctx.measureText(sp.text).width : 0;
      const S = this._S(), w = Math.min(W - S.l - S.r - 40, Math.max(titleW, keysW, textW) + 64), h = 32 + (groups.length ? 56 : 0) + (sp.text ? 30 : 0) + 12;
      const slide = Ale.ease.outCubic(Ale.clamp(t.age / 0.4, 0, 1));
      const out = t.done ? Ale.clamp((t.doneT - 0.5) / 0.5, 0, 1) : 0;
      return { t, sp, groups, capW, gap, orW, keysW, w, h, out, x: W / 2 - w / 2, y: 112 - (1 - slide) * 90 - out * 90 };
    },

    _drawTip(ctx, W, H) {
      const B = this._tipBox(ctx, W);
      if (!B) return;
      const { t, sp, groups, capW, gap, orW, keysW, w, h, out, x, y } = B;
      ctx.save(); ctx.globalAlpha = (1 - out) * Ale.clamp(t.age / 0.2, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x, y + 6, w, h, 22); ctx.fill();
      rr(ctx, x, y, w, h, 22); ctx.fillStyle = t.done ? '#dff3d0' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = t.done ? '#4b8f45' : OUT; ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 22px ' + Ale.FONT; ctx.fillStyle = t.done ? '#3f7a3a' : '#c0562b';
      ctx.fillText((t.done ? '✓ ' : '') + sp.title, x + w / 2, y + 24);
      let cy = y + 42;
      if (groups.length) {
        ctx.font = 'bold 24px ' + Ale.FONT;
        let cx = x + w / 2 - keysW / 2;
        groups.forEach((g, gi) => {
          if (gi) { ctx.font = '600 20px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.7)'; ctx.textAlign = 'center'; ctx.fillText('или', cx + orW / 2, cy + 24); cx += orW; ctx.font = 'bold 24px ' + Ale.FONT; }
          g.forEach((lab, i) => { const cw = capW(lab); this._keycap(ctx, cx, cy, lab, cw); cx += cw + gap; });
          cx -= gap;
        });
        cy += 56;
      }
      if (sp.text) { ctx.font = '600 20px ' + Ale.FONT; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.text, x + w / 2, cy + 6); }
      ctx.restore();
    },

    // Где сейчас видно название места (экранные координаты) или null: облачка-подсказки под ним не рисуются (владелец 11.10.2026, финальная полировка: «Крысы! Прыгни на голову…» в начале улицы
    // накладывалось на «Париж / Улица», на узком виде — строка названия шла прямо по тексту облачка). Условия те же, что у _drawPlace.
    _placeRect(ctx, W, H) {
      const p = this.pl;
      if (!p || p.age < 0 || this.dlg || (Ale.Cards && Ale.Cards.busy) || this.miniBusy || this.menu || this.help) return null;
      if (Ale.clamp(Math.min(p.age / 0.6, (p.life - p.age) / 0.8), 0, 1) < 0.05) return null;
      ctx.save(); ctx.font = 'bold 60px ' + Ale.FONT; let w = ctx.measureText(p.title).width;
      if (p.sub) { ctx.font = 'bold 28px ' + Ale.FONT; w = Math.max(w, ctx.measureText(p.sub).width); }
      ctx.restore();
      return { x: W / 2 - w / 2 - 14, y: H * (p.y || 0.3) - 44, w: w + 28, h: (p.sub ? 50 + 24 : 36) + 44 };
    },

    _drawPlace(ctx, W, H) {
      const p = this.pl;
      if (!p || p.age < 0 || this.dlg || (Ale.Cards && Ale.Cards.busy) || this.miniBusy || this.menu || this.help) return;         // меню паузы, «Как играть» и громкость стоят поверх: название места просвечивало сквозь них (11.10.2026) и ждёт, пока меню закроют
      const a = Ale.clamp(Math.min(p.age / 0.6, (p.life - p.age) / 0.8), 0, 1);
      const rise = (1 - Ale.ease.outCubic(Ale.clamp(p.age / 0.7, 0, 1))) * 16;
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const py = H * (p.y || 0.3);
      ctx.font = 'bold 60px ' + Ale.FONT; ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.strokeText(p.title, W / 2, py + rise);
      const g = ctx.createLinearGradient(0, py - 28, 0, py + 28); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffc35e');
      ctx.fillStyle = g; ctx.fillText(p.title, W / 2, py + rise);
      if (p.sub) { ctx.font = 'bold 28px ' + Ale.FONT; ctx.lineWidth = 8; ctx.strokeText(p.sub, W / 2, py + 50 + rise); ctx.fillStyle = '#fff6e4'; ctx.fillText(p.sub, W / 2, py + 50 + rise); }
      ctx.restore();
    },

    _drawHelp(ctx, W, H) {
      const h = this.help, Hh = Ale.T.help, touch = Input.lastDevice === 'touch';
      const rows = touch ? Hh.touch : Hh.kb;
      ctx.fillStyle = 'rgba(14,8,20,0.72)'; ctx.fillRect(0, 0, W, H);
      const SF = this._S(), rowH = 42, pw = Math.min(W - SF.l - SF.r - 40, 820), ph = 96 + rows.length * rowH + 30 + Hh.tips.length * 30 + 44, px = (W - pw) / 2, py = Math.max(14, (H - ph) / 2);
      const k = Ale.ease.outCubic(Ale.clamp(h.t / 0.25, 0, 1));
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 16);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, px, py + 8, pw, ph, 28); ctx.fill();
      rr(ctx, px, py, pw, ph, 28); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = 'bold 36px ' + Ale.FONT; ctx.fillStyle = INK;
      ctx.fillText(Hh.title, px + pw / 2, py + 44);
      let y = py + 92;
      for (const [label, desc0, icons] of rows) {
        const desc = touch && icons && icons[0] === 'down' && Hh.touchCrouch ? Hh.touchCrouch[Ale.Touch.crouchKind()] || desc0 : desc0;          // где стоит «присесть», зависит от раскладки кнопок
        let lx = px + 44;
        if (touch && icons) { for (const n of icons) { Ale.Icons.button(ctx, '@' + n, lx + 17, y + rowH / 2, 17); lx += 38; } lx += 8; }          // на касании перед названием — кнопка, как она нарисована на экране
        ctx.textAlign = 'left'; ctx.font = 'bold 24px ' + Ale.FONT; ctx.fillStyle = '#c0562b'; ctx.fillText(label, lx, y + rowH / 2);
        ctx.font = '600 24px ' + Ale.FONT; ctx.fillStyle = INK; ctx.fillText(desc, px + 290, y + rowH / 2);
        ctx.strokeStyle = 'rgba(58,36,49,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 40, y + rowH); ctx.lineTo(px + pw - 40, y + rowH); ctx.stroke();
        y += rowH;
      }
      y += 26;
      ctx.font = '600 21px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.85)'; ctx.textAlign = 'left';
      for (const line of Hh.tips) { ctx.fillText('•  ' + line, px + 44, y + 12); y += 30; }
      ctx.textAlign = 'center'; ctx.font = '600 19px ' + Ale.FONT; ctx.fillStyle = 'rgba(58,36,49,0.6)';
      ctx.fillText(touch ? 'Нажми, чтобы закрыть' : 'Esc или Enter — закрыть', px + pw / 2, py + ph - 26);
      ctx.restore();
    },

    _drawObjective(ctx, W) {
      const o = this.objective;
      if (!o.text) return;
      const a = Ale.clamp(o.t / 0.4, 0, 1);
      ctx.font = 'bold 22px ' + Ale.FONT;
      const tw = ctx.measureText(o.text).width;
      const rsv = Ale.Touch && Ale.Touch.active ? Math.max(22, Ale.Touch.reserve || 0) : 22;       // на касании в правом верхнем углу стоит «II»: плашка цели сдвигается влево от неё
      const w = tw + 44, h = 40, x = W - w - rsv - this._S().r, y = 20 - (1 - Ale.ease.outCubic(a)) * 60;
      this._objBox = { x, y, w, h };                                                // где плашка нарисована (для проверок)
      ctx.globalAlpha = 0.92;
      rr(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(40,24,38,0.78)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,220,170,0.55)'; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe9c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.text, x + w / 2, y + h / 2 + 1);
    },

    _drawPrompt(ctx, scene) {
      const f = scene.focus;
      if (!f || this.dlg || scene.locked) return;
      const cam = scene.lastCam || { x: 0, y: 0 };
      const top = f.promptY !== undefined ? f.promptY : (f.headH || 120);
      const al = Ale.Game.alpha, fx = f.rx ? f.rx(al) : f.x, fy = f.ry ? f.ry(al) : f.y;          // по доле шага, как рисуется сам предмет: знак над идущей героиней (звонок) не дрожит на экранах 120 Гц
      const x = fx - cam.x, y = fy - top - cam.y - 20 + Math.sin(this.time * 5) * 3;
      const touch = Input.lastDevice === 'touch';
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.283); ctx.fillStyle = CREAM; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.font = 'bold 24px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (touch && Ale.Icons) Ale.Icons.draw(ctx, 'interact', 0, 1, 30); else { ctx.fillStyle = INK; ctx.fillText(touch ? '!' : 'E', 0, 2); }
      ctx.beginPath(); ctx.moveTo(-6, 19); ctx.lineTo(0, 29); ctx.lineTo(6, 19); ctx.fillStyle = CREAM; ctx.fill();
      // подпись действия (у знака, если предмет её задал: «Погладить», «Войти», «Потянуть рычаг»); может быть функцией — зависит от состояния
      const lab = typeof f.label === 'function' ? f.label() : f.label;
      if (lab) {
        const icon = typeof f.labelIcon === 'function' ? f.labelIcon() : f.labelIcon;           // значок предмета слева от подписи (фишка у автомата)
        ctx.font = 'bold 22px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const tw = ctx.measureText(lab).width, iw = icon ? 34 : 0, x0 = -(tw + iw) / 2;
        if (icon) Ale.drawSprite(ctx, icon, x0 + 14, -38, { sx: 0.46, sy: 0.46 });
        ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.strokeText(lab, x0 + iw + tw / 2, -38); ctx.fillStyle = CREAM; ctx.fillText(lab, x0 + iw + tw / 2, -38);
      }
      ctx.restore();
    },

    _anchorOf(scene, who) {
      const rv = Ale.River && Ale.River.anchorOf(who);                    // на подложке заплыва реплики показывают на героев берега Днепра, а не на тех, что стоят в сцене под ней
      if (rv) return rv;
      const e = scene.actors[who];
      const cam = scene.lastCam || { x: 0, y: 0 };
      if (!e) return null;
      const alpha = Ale.Game.alpha;
      return { x: e.rx(alpha) - cam.x, y: e.ry(alpha) - (e.headH || 120) - cam.y };
    },

    // Тела героев и опасностей на экране (экранные рамки): облачко не должно закрывать героя, поэтому оно поднимается над теми, кто стоит под ним (Бубел ходит за героиней по пятам, и облачко
    // над её головой почти всегда накрыло бы её самоё), а раскладка (Ale.HintLayout) не ставит его на чужие тела. Снаряды (kind 'shot') только поднимают и делают облачко полупрозрачным на миг.
    _hintBlockers(scene, cam, alpha) {
      const out = [], pl = scene.player;
      if (pl && !pl.hidden) {
        if (pl.onGround !== false) this._plGround = pl.ry(alpha);       // высота опоры запоминается: в прыжке облачко не прыгает вслед за героиней
        const gy = this._plGround === undefined ? pl.ry(alpha) : this._plGround, ht = (pl.headH || 158) + 10;
        out.push({ x: pl.rx(alpha) - 46 - cam.x, y: gy - ht - cam.y, w: 92, h: ht, owner: pl, kind: 'body' });
      }
      for (const e of scene.entities) {
        if (e.dead || e.hidden || e === pl) continue;
        if (e.hurtbox && (e.team === 'enemy' || e instanceof Ale.Projectile)) {
          const b = e.hurtbox();
          if (b.w > 0) { out.push({ x: b.x - cam.x, y: b.y - 34 - cam.y, w: b.w, h: b.h + 34, owner: e, kind: e instanceof Ale.Projectile ? 'shot' : 'body' }); continue; }
        }
        const hw = HINT_BODY_HW[e.constructor && e.constructor.name];       // Илюшкинс, Антін, семья, конь, Бубел, китёныш, продавщица: у них нет боевой рамки, берём рост по headH
        if (hw) { const ht = (e.headH || 120) + 6; out.push({ x: e.rx(alpha) - hw - cam.x, y: e.ry(alpha) - ht - cam.y, w: 2 * hw, h: ht, owner: e, kind: 'body' }); }
      }
      return out;
    },

    // Важное на экране, что облачко не должно закрывать (рамки в координатах экрана): полоса босса, панель обучающей подсказки, знак действия у предмета с подписью, тосты внизу.
    // Сердца, счётчик и цель закрыты границами раскладки (выше y = 96 и левее x = 190 над y = 150 облачко не бывает), название места — паузой облачка (h.hold).
    _hintReserved(ctx, W, H, scene) {
      const out = [];
      if (scene.boss && this.hudVisible && !scene.hideHud) out.push({ x: W / 2 - 192, y: 50, w: 384, h: 62 });
      const tb = this._tipBox(ctx, W); if (tb) out.push({ x: tb.x - 6, y: tb.y - 6, w: tb.w + 12, h: tb.h + 12 });
      const pr = this._promptBox(ctx, scene); if (pr) out.push(pr);
      if (Ale.Touch && Ale.Touch.active && Ale.Touch.playing) for (const r of Ale.Touch.rects) out.push(r);          // экранные кнопки: облачко не должно лежать под пальцем (на iPhone «ASSAS — вправо до конца…» заходило под «присесть»)
      for (const b of this._toastBoxes(ctx, W, H)) out.push({ x: b.x, y: b.y, w: b.w, h: b.h });
      return out;
    },

    // Где стоят тосты, в юнитах вида: капсулы одна над другой на полосе пола под подошвами (TOAST_Y). На телефоне (вид шире 1500 юнитов) экранные кнопки стоят по краям и тосты их не задевают;
    // на узком виде (планшет, квадратное окно) кнопки заходят на эту полосу и закрывали бы концы строки — тогда вся стопка поднимается над кнопками, мимо которых проходит строка.
    // Строка — это текст между краями капсулы (скруглённые концы под кнопкой не мешают). Эти же рамки обходят облачка (_hintReserved).
    _toastBoxes(ctx, W, H) {
      ctx.font = 'bold 26px ' + Ale.FONT;
      const btn = Ale.Touch && Ale.Touch.active && Ale.Touch.playing && !Ale.Touch.pauseOnly ? Ale.Touch.rects : [];
      const out = this.toasts.map((t) => { const iw = t.sprite ? 44 : 0, w = ctx.measureText(t.text).width + 48 + iw; return { x: W / 2 - w / 2, w, iw, h: 54 }; });
      let base = H - TOAST_Y;
      for (let pass = 0; pass < 4; pass++) {                                   // подъём над одной кнопкой мог подвести строку под другую: повторять, пока не встанет
        let moved = false;
        for (const b of out) for (const r of btn) {
          if (b.x + 24 + b.iw < r.x + r.w && b.x + b.w - 24 > r.x && base < r.y + r.h && base + b.h > r.y) { base = r.y - b.h - 8; moved = true; }
        }
        if (!moved) break;
      }
      out.forEach((b, i) => { b.y = base - i * 64; });
      return out;
    },

    // Знак действия над предметом в фокусе (круг с «E» и подпись): та же геометрия, что у _drawPrompt
    _promptBox(ctx, scene) {
      const f = scene.focus;
      if (!f || this.dlg || scene.locked) return null;
      const cam = scene.lastCam || { x: 0, y: 0 }, top = f.promptY !== undefined ? f.promptY : (f.headH || 120), al = Ale.Game.alpha;
      const fx = f.rx ? f.rx(al) : f.x, fy = f.ry ? f.ry(al) : f.y, x = fx - cam.x, y = fy - top - cam.y - 20;
      const lab = typeof f.label === 'function' ? f.label() : f.label;
      let half = 25;
      if (lab) { ctx.font = 'bold 22px ' + Ale.FONT; const icon = typeof f.labelIcon === 'function' ? f.labelIcon() : f.labelIcon; half = Math.max(half, (ctx.measureText(lab).width + (icon ? 34 : 0)) / 2 + 8); }
      return { x: x - half, y: y - (lab ? 56 : 26), w: 2 * half, h: lab ? 88 : 58 };
    },

    // Подсказки-облачка (реплики вне диалогов). Положение каждого — желаемое (над головой говорящего, поднятое над теми, кто стоит под ним), а потом его уточняет Ale.HintLayout.solve:
    // облачко не налезает на другое облачко, на важное на экране и на тела героев (владелец 11.10.2026); старые стоят на месте, новое подстраивается и плавно съезжает, когда место освободилось.
    // Полупрозрачным оно становится лишь на миг, если героиня в прыжке всё же задела его.
    _drawHints(ctx, W, H, scene) {
      if (!this.hints.length) return;
      const cam = scene.lastCam || { x: 0, y: 0 }, alpha = Ale.Game.alpha, S = this._S();
      const blockers = this._hintBlockers(scene, cam, alpha);
      const rvb = Ale.River && Ale.River.hintBlockers ? Ale.River.hintBlockers() : null;       // герои подводки на берегу Днепра (рамки уже в координатах экрана)
      if (rvb) for (const b of rvb) blockers.push({ x: b.x, y: b.y, w: b.w, h: b.h, owner: b.who, kind: 'body' });
      const fixed = this._hintReserved(ctx, W, H, scene);
      const placeR = this._placeRect(ctx, W, H);                       // видимое название места (или null)
      ctx.font = 'bold 24px ' + Ale.FONT;
      // 1. размеры и желаемые положения
      const items = [], hs = [];
      for (const h of this.hints) {
        h.hold = false;                                                // по умолчанию облачко стареет; под названием места ставится ниже
        const a = this._anchorOf(scene, h.who);
        if (!a) continue;
        const speaker = scene.actors[h.who] || h.who, bl = blockers.filter((b) => b.owner !== speaker && b.owner !== h.who);     // говорящий сам себя не «загораживает»
        const lines = wrap(ctx, h.text, 340);
        const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const bw = tw + 32, bh = lines.length * 30 + 22;
        let bx = Ale.clamp(a.x - bw / 2, 12 + S.l, W - S.r - bw - 12);
        let top = 1e9;                                                 // поднять над всеми, кто стоит под облачком
        for (const b of bl) if (b.x + b.w > bx - 10 && b.x < bx + bw + 10) top = Math.min(top, b.y);
        let by = a.y - bh - 24;
        if (top < 1e9) by = Math.min(by, top - bh - 20);
        by = Math.max(by, 96);                                          // не выше панели с сердцами и целью
        if (by < 150) bx = Ale.clamp(bx, 190 + S.l, W - S.r - bw - 24);            // счётчик помидоров слева и цель справа не закрываем
        items.push({ id: speaker, ax: a.x, ay: a.y, w: bw, h: bh, bx, by, prev: h.px !== undefined ? { x: h.px, y: h.py } : null });
        hs.push({ h, a, speaker, bl, lines, bw, bh, bx, by });
      }
      // 2. раскладка: не на облачка, не на важное, не на тела
      const bodies = blockers.filter((b) => b.kind === 'body');
      const res = Ale.HintLayout.solve(items, fixed, bodies, { W, H, minY: 96, leftX: 190 + S.l, leftY: 150, minX: S.l, maxX: W - S.r });
      // 3. рисование
      hs.forEach((s, i) => {
        const { h, a, speaker, bl, lines, bw, bh } = s, r = res[i];
        const fade = Math.min(1, h.age / 0.25, (h.life - h.age) / 0.35);
        // плавно: облачко не дёргается, когда враг проходит мимо или раскладка передвинула его; за идущим говорящим едет жёстко (смещение от желаемого, а не абсолютный x)
        const offX = r.x - s.bx;
        h.ox = h.ox === undefined ? offX : h.ox + (offX - h.ox) * 0.3;
        h.by = h.by === undefined ? r.y + 14 : h.by + (r.y - h.by) * 0.3;
        const bx = Ale.clamp(s.bx + h.ox, 12 + S.l, W - S.r - bw - 12), by = h.by;
        h.px = bx; h.py = by;
        h.box = { x: bx, y: by, w: bw, h: bh };                          // где облачко нарисовано сейчас (экранные координаты; для проверок)
        const pr = placeR && Ale.overlap(h.box, placeR);                 // под названием места: облачко прячется и не стареет, пока оно не погаснет
        h.hold = !!pr;
        const box = { x: bx - 8, y: by - 8, w: bw + 16, h: bh + 16 };
        let hit = false; for (const b of bl) if (Ale.overlap(box, b)) { hit = true; break; }
        h.see = Ale.approach(h.see === undefined ? 1 : h.see, pr ? 0 : hit ? 0.4 : 1, pr ? 0.12 : 0.08);
        ctx.font = 'bold 24px ' + Ale.FONT;
        ctx.globalAlpha = fade * h.see;
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, bx, by + 5, bw, bh, 18); ctx.fill();
        rr(ctx, bx, by, bw, bh, 18); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
        // хвост к говорящему (длинный — уже у основания)
        const tx = Ale.clamp(a.x, bx + 26, bx + bw - 26), gx = a.x - tx, gy = Math.max(1, a.y - 4 - (by + bh)), gl = Math.hypot(gx, gy);
        const tl = Math.min(gl, 56), tip = { x: tx + gx / gl * tl, y: by + bh + gy / gl * tl };     // короткий «клювик» в сторону говорящего, а не игла через полэкрана
        if (gy > 8) {
          ctx.beginPath(); ctx.moveTo(tx - 11, by + bh - 1); ctx.lineTo(tip.x, tip.y); ctx.lineTo(tx + 11, by + bh - 1);
          ctx.fillStyle = CREAM; ctx.fill(); ctx.stroke();
          ctx.fillStyle = CREAM; ctx.fillRect(tx - 9, by + bh - 5, 18, 8);
        }
        // Говорящий за краем кадра (камера боя едет за героиней и Димасиком): без подписи облачко было бы «из ниоткуда» — над ним ставится имя говорящего
        if (a.x < 8 || a.x > W - 8) {
          const sp = Ale.Speakers[h.who] || (speaker && speaker.kind && Ale.Speakers[speaker.kind]) || null;
          if (sp) {
            ctx.font = 'bold 18px ' + Ale.FONT; const nw = ctx.measureText(sp.name).width + 26, nx = a.x < 8 ? bx + 16 : bx + bw - 16 - nw, ny = by - 15;
            rr(ctx, nx, ny, nw, 28, 14); ctx.fillStyle = sp.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
            ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.name, nx + nw / 2, ny + 15);
            ctx.font = 'bold 24px ' + Ale.FONT;
          }
        }
        ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach((l, k) => ctx.fillText(l, bx + bw / 2, by + 11 + 15 + k * 30));
        ctx.globalAlpha = 1;
      });
    },

    _drawToasts(ctx, W, H) {
      const boxes = this._toastBoxes(ctx, W, H);
      this.toasts.forEach((t, i) => {
        const a = Math.min(1, t.age / 0.25, (t.life - t.age) / 0.35);
        ctx.font = 'bold 26px ' + Ale.FONT;
        const iw = t.sprite ? 44 : 0, bx = boxes[i];
        const w = bx.w, h = bx.h;
        const x = bx.x, y = bx.y + (1 - Ale.ease.outCubic(Math.min(1, t.age / 0.3))) * 30;
        ctx.globalAlpha = a;
        rr(ctx, x, y, w, h, 27); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
        if (t.sprite) { const sz = Ale.spriteSize(t.sprite), k = sz ? Math.min(0.9, 42 / Math.max(sz.w, sz.h)) : 0.9; Ale.drawSprite(ctx, t.sprite, x + 34, y + 27, { sx: k, sy: k }); }     // значок вписывается в кружок (билет — широкий)
        ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(t.text, x + 24 + iw, y + 28);
        ctx.globalAlpha = 1;
      });
    },

    _drawDialogue(ctx, W, H, scene) {
      const d = this.dlg;
      const l = d.lines[d.i];
      const spk = Ale.Speakers[l.who] || { name: l.who || '', portrait: null, color: '#ddd' };
      const FS = 29, LH = 37, PAD = 24, PORT = 96;
      ctx.font = 'bold ' + FS + 'px ' + Ale.FONT;
      // выражение лица: у реплики может быть mood (например 'angry'), тогда берётся портрет «имя_mood»; нет такого — обычный
      const portKey = spk.portrait && l.mood && Ale.Assets.portraits[spk.portrait + '_' + l.mood] ? spk.portrait + '_' + l.mood : spk.portrait;
      const hasPort = !!(portKey && Ale.Assets.portraits[portKey]);
      if (!d.layout || d.layout.i !== d.i || d.layout.W !== W) {
        const maxTextW = Math.min(540, W - 60 - (hasPort ? PORT + PAD : 0) - PAD * 2);
        const lines = wrap(ctx, l.text, maxTextW);
        const tw = Math.max(...lines.map((s) => ctx.measureText(s).width));
        d.layout = { i: d.i, W, lines, tw };
      }
      const L = d.layout;
      const bw = L.tw + PAD * 2 + (hasPort ? PORT + PAD : 0);
      const bh = Math.max(L.lines.length * LH + PAD * 2 - 6, hasPort ? PORT + PAD * 2 - 6 : 0);
      let a = this._anchorOf(scene, l.who);
      const boxed = !a;
      if (!a) a = { x: W / 2, y: H - 60 };
      const SF = this._S(), bx = Ale.clamp(a.x - bw / 2, 14 + SF.l, W - SF.r - bw - 14);
      // Тела героев и врагов на экране (кроме говорящего): облачко не должно закрывать того, с кем говорят. Бубел невысокая, и облачко над её головой ложилось на грудь и лицо Алеси,
      // которая стоит рядом (13.10.2026: «Бубел говорит — Алеси не видно»): облачко поднимается над самым высоким телом в своей полосе, а хвост тянется вниз к говорящему
      const cam = scene.lastCam || { x: 0, y: 0 }, bl = this._hintBlockers(scene, cam, Ale.Game.alpha).filter((b) => b.kind === 'body');
      const rvb = Ale.River && Ale.River.hintBlockers ? Ale.River.hintBlockers() : null;
      if (rvb) for (const b of rvb) bl.push({ x: b.x, y: b.y, w: b.w, h: b.h, owner: b.who, kind: 'body' });
      const sp = scene.actors[l.who];
      let top = 1e9;
      for (const b of bl) { if (b.owner === sp || b.owner === l.who) continue; if (b.x + b.w > bx - 10 && b.x < bx + bw + 10) top = Math.min(top, b.y); }
      let by = a.y - bh - 30;
      if (!boxed && top < 1e9) by = Math.min(by, top - bh - 26);
      if (by < 64) by = 64;
      // голос без героя в кадре (разговор по телефону): вверху кадра, под панелью сердец и цели, а не внизу — внизу облачко лежало на ногах героев; если вверху стоит кто-то высокий (площадка), как раньше внизу
      if (boxed) { by = 118; for (const b of bl) if (b.x + b.w > bx - 10 && b.x < bx + bw + 10 && b.y < by + bh + 16) by = H - bh - 36; }
      // плавно: пока идёт реплика, герой может подойти или уйти из-под облачка — оно не прыгает; на новой реплике (новый layout) встаёт сразу на место
      L.sy = L.sy === undefined ? by : L.sy + (by - L.sy) * 0.3;
      by = L.sy;
      d.box = { x: bx, y: by, w: bw, h: bh };                           // где облачко нарисовано сейчас (экранные координаты; для проверок)
      // тень + тело
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, bx, by + 7, bw, bh, 26); ctx.fill();
      // хвостик (коротким «клювиком» к говорящему: поднятое над героями облачко не тянет иглу через пол-экрана)
      if (!boxed) {
        const tx = Ale.clamp(a.x, bx + 50, bx + bw - 50), gx = a.x - tx, gy = Math.max(12, a.y - 2 - (by + bh)), gl = Math.hypot(gx, gy), tl = Math.min(gl, 84);
        const tipX = Ale.clamp(tx + gx / gl * tl, SF.l + 4, W - SF.r - 4);         // говорящий может стоять за краем безопасной зоны (у выреза): кончик хвоста с ним не уходит под вырез
        ctx.beginPath(); ctx.moveTo(tx - 16, by + bh - 2); ctx.lineTo(tipX, by + bh + gy / gl * tl); ctx.lineTo(tx + 16, by + bh - 2);
        ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.stroke();
      }
      rr(ctx, bx, by, bw, bh, 26); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      if (!boxed) { const tx = Ale.clamp(a.x, bx + 50, bx + bw - 50); ctx.fillStyle = CREAM; ctx.fillRect(tx - 13, by + bh - 6, 26, 9); }
      // портрет
      let textX = bx + PAD;
      if (hasPort) {
        const cx = bx + PAD + PORT / 2, cy = by + bh / 2;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, PORT / 2, 0, 6.283); ctx.clip();
        ctx.drawImage(Ale.Assets.portraits[portKey], cx - PORT / 2, cy - PORT / 2, PORT, PORT);
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, PORT / 2, 0, 6.283); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        textX = bx + PAD * 2 + PORT;
      }
      // имя
      ctx.font = 'bold 21px ' + Ale.FONT;
      const nw = ctx.measureText(spk.name).width + 30;
      rr(ctx, bx + 22, by - 17, nw, 32, 16); ctx.fillStyle = spk.color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(spk.name, bx + 37, by - 0.5);
      // текст с «печатной машинкой»
      ctx.font = 'bold ' + FS + 'px ' + Ale.FONT;
      let remaining = Math.floor(d.shown);
      const ty0 = by + bh / 2 - (L.lines.length * LH) / 2 + LH / 2;
      ctx.fillStyle = INK; ctx.textBaseline = 'middle';
      for (let i = 0; i < L.lines.length; i++) {
        const s = L.lines[i];
        // пробелы, съеденные переносом, в счёт не идут — считаем по видимым символам приблизительно
        const part = s.substring(0, Math.max(0, remaining));
        ctx.fillText(part, textX, ty0 + i * LH);
        remaining -= s.length + 1;
        if (remaining < 0) break;
      }
      if (l.choices && d.shown >= l.text.length) this._drawChoices(ctx, W, H, d, l);
      else if (d.shown >= l.text.length && !(l.auto !== undefined)) {
        const by2 = by + bh - 16 + Math.sin(this.time * 7) * 3;
        ctx.beginPath(); ctx.moveTo(bx + bw - 44, by2 - 6); ctx.lineTo(bx + bw - 30, by2 - 6); ctx.lineTo(bx + bw - 37, by2 + 3); ctx.closePath();
        ctx.fillStyle = OUT; ctx.fill();
      }
    },

    // Ответы Алеси под вопросом: плашки внизу экрана (каждая — вариант), выбранная подсвечена
    _drawChoices(ctx, W, H, d, l) {
      const n = l.choices.length, k = Ale.clamp((d.chT || 0) / 0.18, 0, 1), e = Ale.ease.outCubic(k);
      const SF = this._S(), rowH = 76, gap = 8, pw = Math.min(W - SF.l - SF.r - 40, 880), px = SF.l + (W - SF.l - SF.r - pw) / 2, totalH = n * rowH + (n - 1) * gap, y0 = H - 24 - totalH, slide = (1 - e) * 46;
      const spk = Ale.Speakers.ale;
      d.boxes = l.choices.map((c, i) => ({ x: px, y: y0 + i * (rowH + gap), w: pw, h: rowH }));
      ctx.save(); ctx.globalAlpha = e;
      ctx.font = 'bold 21px ' + Ale.FONT;
      const nw = ctx.measureText(spk.name).width + 30;
      rr(ctx, px + 22, y0 - 40 + slide, nw, 32, 16); ctx.fillStyle = spk.color; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(spk.name, px + 37, y0 - 24.5 + slide);
      ctx.font = '600 19px ' + Ale.FONT; ctx.fillStyle = 'rgba(255,246,228,0.95)'; ctx.textAlign = 'right';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(58,36,49,0.85)';
      const hint = Ale.tx(Ale.T.choiceHint).replace('{n}', n); ctx.strokeText(hint, px + pw - 8, y0 - 24.5 + slide); ctx.fillText(hint, px + pw - 8, y0 - 24.5 + slide);
      ctx.textAlign = 'left';
      l.choices.forEach((c, i) => {
        const b = d.boxes[i], sel = i === d.sel, y = b.y + slide + (sel ? Math.sin(this.time * 6) * 1.5 : 0);
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, b.x, y + 6, b.w, b.h, 24); ctx.fill();
        rr(ctx, b.x, y, b.w, b.h, 24); ctx.fillStyle = sel ? '#ffd98a' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x + 40, y + b.h / 2, 21, 0, 6.283); ctx.fillStyle = spk.color; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
        ctx.font = 'bold 25px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText(String(i + 1), b.x + 40, y + b.h / 2 + 1);
        ctx.font = 'bold 27px ' + Ale.FONT; ctx.textAlign = 'left';
        const rows = wrap(ctx, c.text, pw - 110), lh = 30, ty = y + b.h / 2 - (rows.length * lh) / 2 + lh / 2;
        rows.forEach((s, j) => ctx.fillText(s, b.x + 78, ty + j * lh + 1));
      });
      ctx.restore();
    },

    _drawMenu(ctx, W, H) {
      const m = this.menu;
      if (m.dim !== false) { ctx.fillStyle = 'rgba(14,8,20,0.62)'; ctx.fillRect(0, 0, W, H); }
      const many = m.items.length > 7, itemH = m.itemH || (many ? 54 : 62), gap = m.gap || (many ? 10 : 14);       // восемь пунктов (пауза в комнате-сюрпризе: титры) не помещались — заголовок «Пауза» уходил за верхний край
      const totalH = m.items.length * (itemH + gap) - gap;
      let y = (m.y !== undefined ? m.y : H / 2 - totalH / 2 + (m.title ? 30 : 0));
      if (m.title && m.y === undefined) y = Math.max(y, 156);          // семь-восемь пунктов: заголовок «Пауза» не заходит на плашку цели в правом верхнем углу (на самом узком виде они пересекались)
      if (m.title) {
        ctx.font = 'bold 54px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.strokeText(m.title, W / 2, y - 70);
        ctx.fillStyle = '#ffe9c4'; ctx.fillText(m.title, W / 2, y - 70);
      }
      m.boxes = [];
      ctx.font = 'bold 30px ' + Ale.FONT;
      m.items.forEach((it, i) => {
        const w = m.w || 420, x = W / 2 - w / 2;
        const sel = i === m.sel;
        const bob = sel ? Math.sin(this.time * 6) * 2 : 0;
        const box = { x, y, w, h: itemH };
        m.boxes.push(box);
        rr(ctx, x, y + bob, w, itemH, itemH / 2);
        ctx.fillStyle = it.disabled ? '#c9bcb8' : sel ? '#ffd98a' : CREAM; ctx.fill();       // недоступный пункт: плотный серый, читается и на яркой картине заставки
        ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.fillStyle = it.disabled ? '#6b5a5d' : INK; ctx.textBaseline = 'middle';
        if (it.slider) {
          // название слева, полоска с ручкой посередине, число справа
          const v = it.slider.get(), ty = y + itemH / 2 + bob, t0 = x + Math.round(w * 0.31), t1 = x + w - 128;
          box.track = { x0: t0, x1: t1 };
          ctx.textAlign = 'left'; ctx.fillText(it.label, x + 34, ty + 2);
          rr(ctx, t0, ty - 8, t1 - t0, 16, 8); ctx.fillStyle = 'rgba(58,36,49,0.16)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
          const kx = t0 + (t1 - t0) * v;
          if (v > 0.001) { rr(ctx, t0, ty - 8, Math.max(16, kx - t0), 16, 8); ctx.fillStyle = '#f2994a'; ctx.fill(); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(kx, ty, sel ? 20 : 18, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4.5; ctx.strokeStyle = OUT; ctx.stroke();
          ctx.fillStyle = v > 0.001 ? INK : '#8a6f76'; ctx.textAlign = 'right';
          ctx.fillText(v > 0.001 ? Math.round(v * 100) + '%' : Ale.T.audio.off, x + w - 32, ty + 2);
        } else {
          ctx.textAlign = 'center'; ctx.fillText(it.label, W / 2, y + itemH / 2 + 2 + bob);
        }
        y += itemH + gap;
      });
      if (m.hint) {           // короткая подсказка под меню (для ползунков: как двигать)
        const s = typeof m.hint === 'function' ? m.hint() : m.hint;
        ctx.font = '600 22px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(58,36,49,0.9)'; ctx.strokeText(s, W / 2, y + 16);
        ctx.fillStyle = '#fff6e4'; ctx.fillText(s, W / 2, y + 16);
      }
      const note = m.note ? (typeof m.note === 'function' ? m.note() : m.note) : '';
      if (note) {
        ctx.font = '600 20px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(58,36,49,0.9)'; ctx.strokeText(note, W / 2, y + 48);
        ctx.fillStyle = '#ffe2b0'; ctx.fillText(note, W / 2, y + 48);
      }
      if (m.legend) this._drawLegend(ctx, W, H);
    },

    // Окно «Громкость»: два ползунка (музыка, эффекты) и «Назад». onBack вызывается по «Назад», Esc, P и «II»; opts — параметры меню (например sel).
    openVolume(onBack, opts) {
      const A = Ale.Audio, T = Ale.T.audio;
      const slider = (kind, label) => ({ label, slider: { get: () => A.vol[kind], set: (v) => A.setVolume(kind, v), step: 0.05, toggle: () => A.toggleMute(kind), preview: kind === 'sfx' } });
      this.openMenu([slider('music', T.music), slider('sfx', T.sfx), { label: T.back, action: () => onBack() }],
        Object.assign({ title: T.title, w: 700, onBack: () => onBack(), hint: () => Ale.tx(T.hint), note: () => (A._ios && A._ios() ? T.phoneMute : ''), hideTouch: true }, opts));          // note — строка про бесшумный режим (только на iPhone и iPad)       // hideTouch: экранные кнопки на время окна убираются, чтобы не перекрывать полоски
    },

    // Короткая памятка по управлению слева от меню паузы (полное окно — пункт «Как играть»).
    // Строки памятки: в заплыве через Днепр — свои (бревно ведут вверх-вниз; ходьбы, прыжка и помидоров там нет; владелец 11.10.2026 открыл паузу в заплыве и увидел «Ходьба / Прыжок / Помидор»)
    _legendRows() {
      const L = Ale.T.legend, S = Ale.River && Ale.River.busy && L.swim ? L.swim : L, touch = Input.lastDevice === 'touch', rows = touch ? S.touch : S.kb;
      // в бою с Димасиком кнопка броска стреляет выбранным оружием (помидоры не тратятся): в памятке — его название и значок, а не «Помидор»
      const sc = Ale.Game && Ale.Game.scene, kit = sc && sc.kit && !sc.kit.dead && Ale.T.kyiv.kit[sc.kit.type] ? sc.kit : null;
      return kit ? rows.map((r) => (r[2] === 'throw' ? [touch ? [kit.cfg.touch] : r[0], Ale.T.kyiv.kit[kit.type].name] : r)) : rows;
    },
    _drawLegend(ctx, W, H) {
      const L = Ale.T.legend, rows = this._legendRows();
      const rowH = 46, pw = Math.min(272, W / 2 - 210 - 26), ph = 66 + rows.length * rowH + 14;
      if (pw < 200) return;
      const px = Math.max(12, W / 2 - 210 - 18 - pw), py = H / 2 - ph / 2 + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, px, py + 7, pw, ph, 24); ctx.fill();
      rr(ctx, px, py, pw, ph, 24); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = 'bold 28px ' + Ale.FONT; ctx.fillStyle = INK;
      ctx.fillText(L.title, px + pw / 2, py + 34);
      let y = py + 62;
      for (const [caps, label] of rows) {
        let x = px + 20;
        for (const c of caps) { x += this._miniCap(ctx, x, y + 6, c) + 5; }
        ctx.textAlign = 'left'; ctx.font = 'bold 21px ' + Ale.FONT; ctx.fillStyle = INK;
        ctx.fillText(label, px + 20 + 106, y + rowH / 2);
        y += rowH;
      }
    },
    _miniCap(ctx, x, y, lab) {
      if (Ale.Icons && Ale.Icons.is(lab)) { Ale.Icons.button(ctx, lab, x + 18, y + 18, 17); return 36; }
      ctx.font = 'bold 19px ' + Ale.FONT;
      const w = Math.max(34, ctx.measureText(lab).width + 18);
      rr(ctx, x, y + 3, w, 34, 8); ctx.fillStyle = 'rgba(58,36,49,0.35)'; ctx.fill();
      rr(ctx, x, y, w, 34, 8); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, x + w / 2, y + 18);
      return w;
    },

    drawLoading(ctx, W, H, p) {
      ctx.fillStyle = '#1b1420'; ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 40px ' + Ale.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9c4'; ctx.fillText('Загрузка…', W / 2, H / 2 - 30);
      const w = 360;
      rr(ctx, W / 2 - w / 2, H / 2 + 10, w, 22, 11); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      rr(ctx, W / 2 - w / 2, H / 2 + 10, Math.max(22, w * p), 22, 11); ctx.fillStyle = '#e8445a'; ctx.fill();
    },
  });
})();
