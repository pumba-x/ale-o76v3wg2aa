// Шахматы в Киеве: Димасик за столиком настаивает «сыграть быстро». Экран на весь кадр: сначала «ускоренная партия» (приём ускорения времени: ходы мелькают,
// у Димасика не остаётся ничего, кроме короля), потом задача для игрока — мат в два хода. Провала нет: подсказки, «Заново», после двух неудач подсказка включается сама.
//   yield Ale.Chess.play({});   — сценарий ждёт, пока задача не решена и экран не закрылся (опции: timelapse: false — сразу к задаче)
// Модуль устроен как модальное окно (образец — src/cards.js): busy, update(dt), draw(ctx, W, H), reset(); мир на время экрана стоит (UI.modal).
// Внутри — три слоя: engine (чистые функции без DOM: позиция, законные ходы, мат и пат, решатель «мат в два», ответ Димасика), Session (состояние и анимации)
// и рисование (доска; фигуры — картинки пиксельной живописи chess_wK…chess_bP, а если их нет — запасные силуэты контурами в Canvas; шрифтовые шахматные символы не годятся: на iOS значок пешки превращается в эмодзи).
// Время считается только по dt (в игровом коде нет часов), косметика — Ale.fxRng. Все надписи — в T.chess (src/text.js).
// Бот и проверки ходят через Session.pressSquare / solution / skip, а бот сюжета — через Ale.Chess.botStep() (зовёт каждый шаг, пока Ale.Chess.busy).
// Фазы сессии (Session.phase): 'timelapse' → 'glide' → 'puzzle' → 'reply' (ответ Димасика) → 'puzzle' (второй ход) → 'mate' (экран закрывается сам) или 'fail' (сообщение, возврат в 'puzzle').
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ================================================================== ДВИЖОК
  // Позиция: { b: массив из 64 символов (A1 = 0, H1 = 7, A8 = 56; пусто — ''; заглавные — белые, строчные — чёрные), turn: 'w' | 'b', hm, fm }.
  // Правила — обычные, кроме трёх упрощений: нет рокировки и взятия на проходе, пешка в последней горизонтали всегда становится ферзём (в задаче пешек нет).
  const FILES = 'abcdefgh';
  const sqName = (s) => FILES[s & 7] + ((s >> 3) + 1);
  const sqIndex = (n) => {
    if (typeof n === 'number') return n >= 0 && n < 64 ? n | 0 : -1;
    const m = /^([a-h])([1-8])$/.exec(String(n).trim().toLowerCase());
    return m ? (+m[2] - 1) * 8 + FILES.indexOf(m[1]) : -1;
  };
  const isW = (p) => p !== '' && p === p.toUpperCase();
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const RD = [[1, 0], [-1, 0], [0, 1], [0, -1]], BD = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
  const PUZZLE_FEN = '6k1/8/4R3/3K4/8/8/1Q6/8 w - - 0 1';

  function parseFen(fen) {
    const parts = String(fen).trim().split(/\s+/), b = new Array(64).fill('');
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r] || '') { if (/[1-8]/.test(ch)) f += +ch; else b[(7 - r) * 8 + f++] = ch; }
    }
    return { b, turn: parts[1] === 'b' ? 'b' : 'w', hm: +(parts[4] || 0), fm: +(parts[5] || 1) };
  }
  function toFen(pos) {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) { const p = pos.b[r * 8 + f]; if (!p) e++; else { if (e) { s += e; e = 0; } s += p; } }
      if (e) s += e;
      if (r) s += '/';
    }
    return s + ' ' + pos.turn + ' - - ' + (pos.hm || 0) + ' ' + (pos.fm || 1);
  }
  const clonePos = (pos) => ({ b: pos.b.slice(), turn: pos.turn, hm: pos.hm || 0, fm: pos.fm || 1 });

  // Клетка sq бьётся фигурами цвета by ('w' | 'b')?
  function attacked(b, sq, by) {
    const f = sq & 7, r = sq >> 3, white = by === 'w';
    const pr = white ? r - 1 : r + 1;
    if (pr >= 0 && pr < 8) for (const df of [-1, 1]) { const x = f + df; if (x >= 0 && x < 8 && b[pr * 8 + x] === (white ? 'P' : 'p')) return true; }
    const knight = white ? 'N' : 'n', king = white ? 'K' : 'k', rook = white ? 'R' : 'r', bishop = white ? 'B' : 'b', queen = white ? 'Q' : 'q';
    for (const [dx, dy] of KN) { const x = f + dx, y = r + dy; if (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === knight) return true; }
    for (const [dx, dy] of KG) { const x = f + dx, y = r + dy; if (x >= 0 && x < 8 && y >= 0 && y < 8 && b[y * 8 + x] === king) return true; }
    for (const [dx, dy] of RD) {
      let x = f + dx, y = r + dy;
      while (x >= 0 && x < 8 && y >= 0 && y < 8) { const p = b[y * 8 + x]; if (p) { if (p === rook || p === queen) return true; break; } x += dx; y += dy; }
    }
    for (const [dx, dy] of BD) {
      let x = f + dx, y = r + dy;
      while (x >= 0 && x < 8 && y >= 0 && y < 8) { const p = b[y * 8 + x]; if (p) { if (p === bishop || p === queen) return true; break; } x += dx; y += dy; }
    }
    return false;
  }
  const inCheck = (pos, color) => { const k = pos.b.indexOf(color === 'w' ? 'K' : 'k'); return k >= 0 && attacked(pos.b, k, color === 'w' ? 'b' : 'w'); };

  // Ходы без проверки шаха своему королю: { from, to, piece, cap, promo }
  function pseudoMoves(pos) {
    const b = pos.b, white = pos.turn === 'w', out = [];
    for (let s = 0; s < 64; s++) {
      const p = b[s];
      if (!p || isW(p) !== white) continue;
      const t = p.toUpperCase(), f = s & 7, r = s >> 3;
      const add = (to, cap, promo) => { const m = { from: s, to, piece: p, cap: cap || '' }; if (promo) m.promo = promo; out.push(m); };
      if (t === 'P') {
        const d = white ? 1 : -1, y = r + d, start = white ? 1 : 6, last = white ? 7 : 0;
        if (y >= 0 && y < 8) {
          if (!b[y * 8 + f]) {
            add(y * 8 + f, '', y === last ? (white ? 'Q' : 'q') : '');
            if (r === start && !b[(r + 2 * d) * 8 + f]) add((r + 2 * d) * 8 + f, '');
          }
          for (const df of [-1, 1]) { const x = f + df; if (x < 0 || x > 7) continue; const q = b[y * 8 + x]; if (q && isW(q) !== white) add(y * 8 + x, q, y === last ? (white ? 'Q' : 'q') : ''); }
        }
      } else if (t === 'N' || t === 'K') {
        for (const [dx, dy] of t === 'N' ? KN : KG) { const x = f + dx, y = r + dy; if (x < 0 || x > 7 || y < 0 || y > 7) continue; const q = b[y * 8 + x]; if (!q || isW(q) !== white) add(y * 8 + x, q); }
      } else {
        for (const [dx, dy] of t === 'R' ? RD : t === 'B' ? BD : RD.concat(BD)) {
          let x = f + dx, y = r + dy;
          while (x >= 0 && x < 8 && y >= 0 && y < 8) { const q = b[y * 8 + x]; if (!q) add(y * 8 + x, ''); else { if (isW(q) !== white) add(y * 8 + x, q); break; } x += dx; y += dy; }
        }
      }
    }
    return out;
  }
  // Законные ходы стороны, которая ходит (король не остаётся под шахом: так и короли не сходятся рядом), по порядку клеток «откуда» и «куда»
  function legalMoves(pos) {
    const b = pos.b, color = pos.turn, enemy = color === 'w' ? 'b' : 'w', out = [];
    for (const m of pseudoMoves(pos)) {
      const was = b[m.to];
      b[m.to] = m.promo || m.piece; b[m.from] = '';
      const k = m.piece === (color === 'w' ? 'K' : 'k') ? m.to : b.indexOf(color === 'w' ? 'K' : 'k');
      const bad = k >= 0 && attacked(b, k, enemy);
      b[m.from] = m.piece; b[m.to] = was;
      if (!bad) out.push(m);
    }
    out.sort((a, c) => a.from - c.from || a.to - c.to);
    return out;
  }
  function apply(pos, m) {
    const n = clonePos(pos);
    n.b[m.to] = m.promo || m.piece; n.b[m.from] = '';
    n.hm = m.piece.toUpperCase() === 'P' || m.cap ? 0 : (pos.hm || 0) + 1;
    if (pos.turn === 'b') n.fm = (pos.fm || 1) + 1;
    n.turn = pos.turn === 'w' ? 'b' : 'w';
    return n;
  }
  // 'mate' — ходить нечем и шах; 'stalemate' — ходить нечем, шаха нет; 'check' — шах; 'ok'
  function status(pos) {
    const none = legalMoves(pos).length === 0, chk = inCheck(pos, pos.turn);
    return none ? (chk ? 'mate' : 'stalemate') : chk ? 'check' : 'ok';
  }
  const isMate = (pos) => status(pos) === 'mate';
  const isStalemate = (pos) => status(pos) === 'stalemate';
  const mateIn1 = (pos) => legalMoves(pos).filter((m) => isMate(apply(pos, m)));
  const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
  const moveFromUci = (pos, s) => legalMoves(pos).find((m) => uci(m) === s) || null;

  // Первые ходы, после которых мат поставлен всегда: сразу (mate1) или следующим ходом при любом ответе. Для каждого — ответы и матующие ходы.
  function solveMate2(pos) {
    const res = [];
    for (const m of legalMoves(pos)) {
      const p1 = apply(pos, m), reps = legalMoves(p1);
      if (!reps.length) { if (inCheck(p1, p1.turn)) res.push({ move: m, mate1: true, replies: [] }); continue; }
      const replies = [];
      let all = true;
      for (const r of reps) { const mates = mateIn1(apply(p1, r)); if (!mates.length) { all = false; break; } replies.push({ reply: r, mates }); }
      if (all) res.push({ move: m, mate1: false, replies });
    }
    return res;
  }
  // Ответ Димасика: из законных ходов — первый (по порядку клеток), после которого мата в один ход нет («защищается»); если все ответы проигрывают — просто первый; нет ходов — null
  function replyFor(pos) {
    const lm = legalMoves(pos);
    if (!lm.length) return null;
    for (const m of lm) if (!mateIn1(apply(pos, m)).length) return m;
    return lm[0];
  }

  // Ускоренная партия: 53 полухода от стандартной расстановки (белые — Алеся, чёрные — Димасик); в конце у чёрных один король, у белых король, ферзь и ладья.
  // Рокировок, взятий на проходе и превращений в ряду нет: каждый ход — «фигура с клетки на клетку, что стоит на конечной — берётся».
  const GAME = ('b2b3 a7a6 g2g4 h7h5 g4h5 e7e6 h2h4 h8h5 c1a3 f8a3 b1a3 h5h4 h1h4 d8h4 a1c1 h4h2 c2c4 h2g1 a3b5 g1g4 b3b4 a6b5 c4b5 g4b4 c1c7 a8a2 c7c3 b4b5 e2e4 a2d2 f1b5 d2f2 e1f2 f7f5 e4f5 e6f5 c3c6 f5f4 c6c1 f4f3 f2f3 e8f8 b5d7 b8d7 d1d7 b7b5 d7b5 f8e7 c1c8 e7d6 c8g8 g7g5 b5g5').split(' ');

  const engine = {
    START_FEN, PUZZLE_FEN, GAME, sqName, sqIndex, parseFen, toFen, clonePos, attacked, inCheck, pseudoMoves, legalMoves, apply, status, isMate, isStalemate,
    mateIn1, solveMate2, replyFor, uci, moveFromUci,
    // Вся партия по ходам: список { move, pos } после каждого хода (ошибка в записи — исключение с номером хода)
    replayGame() {
      let pos = parseFen(START_FEN); const out = [];
      GAME.forEach((s, i) => {
        const m = moveFromUci(pos, s);
        if (!m) throw new Error('ход ' + (i + 1) + ' ' + s + ' невозможен в позиции ' + toFen(pos));
        pos = apply(pos, m); out.push({ move: m, pos });
      });
      return out;
    },
  };


  // ================================================================== ФИГУРЫ
  // Основной вид — картинки (Ale.Assets.sprites.chess_wK … chess_bP: пиксельная живопись с тёмным контуром, ортогонально спереди, белые — слоновая кость, чёрные — эбеновое
  // дерево; якорь — центр основания по x и низ основания по y; конь у обоих цветов смотрит вправо, зеркалить не нужно). Все фигуры рисуются в одном масштабе, найденном по
  // королю (его высота — KING_FRAC клетки): по таблице высот в юнитах картинки K 83, Q 76, B 70, N 64, R 60, P 47 пешка ниже ладьи, ладья ниже коня и слона, король выше ферзя.
  // Подошва стоит на FOOT_FRAC клетки ниже центра (в нижней трети), макушка короля чуть выше края клетки — фигуры в соседних рядах не касаются друг друга.
  // Нет картинок (старая сборка, файл не загрузился) — запасной рисунок ниже: плоские силуэты контурами.
  const KING_FRAC = 0.95;                // высота короля в долях размера клетки
  const FOOT_FRAC = 0.43;                // подошва ниже центра клетки в долях размера клетки
  const KING_UNITS = 83;                 // высота картинки короля в юнитах (запасное значение, если картинки короля нет)
  const pieceSprite = (ch) => {
    const A = Ale.Assets, s = A && A.sprites && A.sprites['chess_' + (isW(ch) ? 'w' : 'b') + ch.toUpperCase()];
    return s && s.img ? s : null;
  };
  // Масштаб «юнит картинки → единица холста»: один на все фигуры
  const pieceK = (size) => {
    const ks = pieceSprite('K'), kh = ks ? ks.h / (ks.res || Ale.Assets.os) : KING_UNITS;
    return KING_FRAC * size / kh;
  };
  // Где у фигуры ch при размере клетки size стоит подошва и какой ширины основание: foot — смещение подошвы вниз от центра клетки, half — половина ширины основания, top — смещение макушки вверх
  function pieceMetrics(ch, size) {
    const s = pieceSprite(ch);
    if (!s) return { sprite: false, foot: size * 0.44, half: size * 0.32, top: size * 0.47 };       // силуэты: подошва на 42 + 2 «шаблона» ниже центра, кромка ±32, макушка короля −49 + 2
    const rs = s.res || Ale.Assets.os, k = pieceK(size);
    return { sprite: true, foot: size * FOOT_FRAC, half: Math.min(s.ax, s.w - s.ax) / rs * k, top: (s.ay / rs) * k - size * FOOT_FRAC };
  }
  // Файл, уменьшенный вдвое столько раз, сколько нужно: если на экране фигура в два и более раза меньше файла (значки на карточках, мелкий вид), прямое сжатие без усреднения даёт «лесенку»
  const MIPS = new WeakMap();
  function mip(img, ratio) {
    const n = ratio >= 2 ? Math.min(3, Math.floor(Math.log2(ratio))) : 0;
    if (!n) return img;
    let chain = MIPS.get(img);
    if (!chain) { chain = [img]; MIPS.set(img, chain); }
    while (chain.length <= n) {
      const prev = chain[chain.length - 1], cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(prev.width / 2)); cv.height = Math.max(1, Math.ceil(prev.height / 2));
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(prev, 0, 0, cv.width, cv.height);
      chain.push(cv);
    }
    return chain[n];
  }
  function drawPieceSprite(ctx, s, cx, cy, size, o) {
    const rs = s.res || Ale.Assets.os, k = pieceK(size), sc = o.scale || 1, foot = size * FOOT_FRAC;
    const ax = s.ax / rs, ay = s.ay / rs, w = s.w / rs, h = s.h / rs;
    ctx.save();
    ctx.translate(cx, cy);
    if (o.rot) { const px = Math.min(ax, w - ax) * k; ctx.translate(px, foot); ctx.rotate(o.rot); ctx.translate(-px, -foot); }        // поворот вокруг правой кромки подошвы: падающий король
    ctx.scale(sc, sc);
    if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha *= Math.max(0, o.alpha);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const m = ctx.getTransform ? ctx.getTransform() : null, px = m ? Math.hypot(m.a, m.b) || 1 : 1;
    ctx.drawImage(mip(s.img, rs / (k * px)), -ax * k, foot - ay * k, w * k, h * k);
    ctx.restore();
  }

  // ---- запасной рисунок (силуэты контурами)
  // Силуэты в «шаблоне» 100×100: начало — центр клетки, y вниз, подошва на y ≈ 42, макушка короля ≈ −49. Каждая деталь (подошва, поясок, корпус, голова…) — отдельный
  // контур с обводкой и заливкой, как наклейки одна на другой: обводки сами дают кольца подставки. Белые — сливочные, чёрные — тёмно-сливовые; слева светлее (блик), справа темнее.
  // Контуры задаются строками SVG-пути (Path2D), их точки — на глаз по очертаниям классического набора; путь собирается один раз при первом показе.
  const LINE = '#2b1a20';
  const PAL = {
    w: { base: '#fff1d0', hi: '#ffffff', sh: '#d6b27a', line: LINE, blik: 'rgba(255,255,255,0.95)' },
    b: { base: '#3a2a3a', hi: '#9a7a9e', sh: '#1c111e', line: '#1b1017', blik: 'rgba(228,196,236,0.62)' },
  };
  const circ = (cx, cy, r) => 'M' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 1 0 ' + (cx - r) + ' ' + cy + ' Z';
  const FOOT = ['M-26 31 H26 Q32 31 32 36.5 Q32 42 26 42 H-26 Q-32 42 -32 36.5 Q-32 31 -26 31 Z', -32, 32];
  const RING = ['M-19 24 H19 Q25 24 25 28 V31 H-25 V28 Q-25 24 -19 24 Z', -25, 25];
  const BODY_Q = ['M-10 1 C-10 12 -18 18 -22 24 H22 C18 18 10 12 10 1 Z', -22, 22];
  const COLLAR_Q = ['M-14 -7 H14 Q17 -7 17 -4 V-1 Q17 2 14 2 H-14 Q-17 2 -17 -1 V-4 Q-17 -7 -14 -7 Z', -17, 17];
  const DEFS = {
    P: { parts: [FOOT, RING, ['M-7 5 C-7 13 -14 18 -18 24 H18 C14 18 7 13 7 5 Z', -18, 18], ['M-13 -2 H13 Q15 -2 15 0 V3 Q15 6 13 6 H-13 Q-15 6 -15 3 V0 Q-15 -2 -13 -2 Z', -15, 15], [circ(0, -14, 12.5), -12.5, 12.5]],
      blik: ['M-7 -19 Q-9.5 -15 -8 -11'], det: [] },
    R: { parts: [FOOT, RING, ['M-13 -17 L-15 24 H15 L13 -17 Z', -15, 15], ['M-19 -24 H19 Q21 -24 21 -22 V-19 Q21 -17 19 -17 H-19 Q-21 -17 -21 -19 V-22 Q-21 -24 -19 -24 Z', -21, 21],
      ['M-19 -24 V-41 H-11.5 V-34 H-4 V-41 H4 V-34 H11.5 V-41 H19 V-24 Z', -19, 19]],
      blik: ['M-8 -14 L-9 17', 'M-15 -33 L-15 -29'], det: [] },
    B: { parts: [FOOT, RING, ['M-9 -1 C-9 11 -17 18 -21 24 H21 C17 18 9 11 9 -1 Z', -21, 21], ['M-13 -8 H13 Q15 -8 15 -6 V-2 Q15 0 13 0 H-13 Q-15 0 -15 -2 V-6 Q-15 -8 -13 -8 Z', -15, 15],
      ['M0 -42 C9 -35 14 -27 14 -19 C14 -12 8 -8 0 -8 C-8 -8 -14 -12 -14 -19 C-14 -27 -9 -35 0 -42 Z', -14, 14], [circ(0, -45, 4.6), -4.6, 4.6]],
      blik: ['M-8 -26 Q-10 -20 -8 -15'], det: [{ d: 'M-4 -30 L4 -20', w: 3.2 }] },
    Q: { parts: [FOOT, RING, BODY_Q, COLLAR_Q, ['M-14 -6 L-23 -30 L-15 -21 L-11 -38 L-5 -22 L0 -41 L5 -22 L11 -38 L15 -21 L23 -30 L14 -6 Z', -23, 23],
      [circ(-23, -33, 3.9), -27, -19], [circ(-11, -41, 3.9), -15, -7], [circ(0, -44, 3.9), -4, 4], [circ(11, -41, 3.9), 7, 15], [circ(23, -33, 3.9), 19, 27]],
      blik: ['M-8 -3 L-9 10'], det: [] },
    K: { parts: [FOOT, RING, BODY_Q, COLLAR_Q, ['M-19 -6 C-26 -16 -20 -28 -9 -30 H9 C20 -28 26 -16 19 -6 Z', -26, 26],
      ['M-3.6 -49 H3.6 V-44.5 H9.5 V-38 H3.6 V-30 H-3.6 V-38 H-9.5 V-44.5 H-3.6 Z', -9.5, 9.5]],
      blik: ['M-14 -15 Q-16 -21 -11 -25'], det: [{ d: 'M-21 -13 Q0 -9 21 -13', w: 2.4 }] },
    N: { parts: [FOOT, RING, ['M-21 24 C-23 16 -20 8 -13 1 C-16 0 -20 -2 -23 -5 C-27 -8 -31 -10 -32 -14 C-33 -18 -30 -21 -26 -22 C-22 -23 -19 -26 -17 -29 C-16 -33 -16 -39 -13 -45 L-9.5 -38.5 L-5 -44 L-3 -36 C4 -38 13 -32 16 -22 C19 -14 19 -2 21 6 C22 12 21 18 21 24 Z', -33, 22]],
      blik: ['M-2 -33 C4 -34 10 -29 13 -21'], det: [{ d: circ(-16, -23, 2.3), w: 0, fill: true }, { d: circ(-28.5, -15, 1.6), w: 0, fill: true }, { d: 'M-1 -30 C5 -27 9 -20 9 -12', w: 2.3 }, { d: 'M3 -26 C8 -22 10 -16 10 -8', w: 2.3 }, { d: 'M-31 -11 Q-27 -9 -23 -9.5', w: 2.1 }] },
  };
  let SHAPES = null;
  function shapes() {
    if (SHAPES) return SHAPES;
    SHAPES = {};
    for (const k of Object.keys(DEFS)) {
      const d = DEFS[k];
      SHAPES[k] = { id: k, parts: d.parts.map((p) => ({ path: new Path2D(p[0]), x0: p[1], x1: p[2] })), blik: d.blik.map((s) => new Path2D(s)), det: (d.det || []).map((e) => ({ path: new Path2D(e.d), w: e.w, fill: !!e.fill })) };
    }
    return SHAPES;
  }
  // Градиенты деталей строятся один раз на контекст: их координаты — в «шаблоне» фигуры, а положение и размер задаёт матрица холста в момент заливки
  const GRADS = new WeakMap();
  function grads(ctx, side, shape) {
    let m = GRADS.get(ctx); if (!m) { m = {}; GRADS.set(ctx, m); }
    const k = side + shape.id; if (m[k]) return m[k];
    const pal = PAL[side];
    return (m[k] = shape.parts.map((p) => {
      const g = ctx.createLinearGradient(p.x0, 0, p.x1, 0);
      g.addColorStop(0, pal.hi); g.addColorStop(0.3, pal.base); g.addColorStop(0.72, pal.base); g.addColorStop(1, pal.sh);
      return g;
    }));
  }
  // Запасной рисунок: фигура ch (буква FEN: заглавная — белая) в центре (cx, cy) при размере клетки size. Параметры o — как у drawPiece
  function drawPieceVector(ctx, ch, cx, cy, size, o) {
    const sh = shapes()[ch.toUpperCase()];
    if (!sh) return;
    o = o || {};
    const pal = PAL[isW(ch) ? 'w' : 'b'], s = size / 100, lw = Math.max(3.1, 1.3 / s);
    ctx.save();
    ctx.translate(cx, cy + size * 0.02);               // фигура чуть ниже центра: шар слона и крест короля не выходят за верхний край клетки
    if (o.rot) { ctx.translate(32 * s, 42 * s); ctx.rotate(o.rot); ctx.translate(-32 * s, -42 * s); }
    const k = s * (o.scale || 1);
    ctx.scale(k, k);
    if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha *= Math.max(0, o.alpha);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const gr = grads(ctx, isW(ch) ? 'w' : 'b', sh);
    sh.parts.forEach((p, i) => {
      ctx.fillStyle = gr[i]; ctx.fill(p.path);
      ctx.lineWidth = lw; ctx.strokeStyle = pal.line; ctx.stroke(p.path);
    });
    for (const e of sh.det) {
      if (e.fill) { ctx.fillStyle = pal.line; ctx.fill(e.path); } else { ctx.lineWidth = Math.max(e.w, lw * 0.8); ctx.strokeStyle = pal.line; ctx.stroke(e.path); }
    }
    if (!o.light) { ctx.strokeStyle = pal.blik; ctx.lineWidth = 2.6; for (const b of sh.blik) ctx.stroke(b); }
    ctx.restore();
  }

  // Фигура ch (буква FEN: заглавная — белая) в центре клетки (cx, cy) при размере клетки size: картинка, а без неё — силуэт.
  // o: alpha, scale (сжатие к центру клетки), rot (поворот вокруг правой кромки подошвы: падающий король), light (без тонких деталей; у картинок не нужен)
  function drawPiece(ctx, ch, cx, cy, size, o) {
    o = o || {};
    const s = pieceSprite(ch);
    if (s) drawPieceSprite(ctx, s, cx, cy, size, o);
    else drawPieceVector(ctx, ch, cx, cy, size, o);
  }

  // ================================================================== ВРЕМЯ И СОСТОЯНИЕ
  const sfx = (name, o) => { if (Ale.Audio && Ale.Audio.sfx) Ale.Audio.sfx(name, o); };
  const EASE = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outBounce: (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; } if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; } t -= 2.625 / d; return n * t * t + 0.984375; },
  };
  // Темп ускоренной партии: первые 6 ходов по 0,30 с, дальше плавно до 0,06 с (всего ≈ 5,3 с); перед первым ходом — пауза, видна расстановка
  const TL_START = 0.55, SKIP_AFTER = 1.0;
  const plyDur = (i) => (i < 6 ? 0.30 : 0.06 + 0.24 * Math.exp(-(i - 6) / 2.2));
  let TL_AT = null;
  const plyTimes = () => {
    if (!TL_AT) { TL_AT = []; let t = TL_START; for (let i = 0; i < GAME.length; i++) { TL_AT.push(t); t += plyDur(i); } TL_AT.push(t); }
    return TL_AT;
  };
  const GLIDE = 0.9, GLIDE_FAST = 0.26;                    // «скольжение» четырёх оставшихся фигур в позицию задачи (счётчик доходит до «Ход 54»)
  const REPLY_WAIT = 0.6, REPLY_SLIDE = 0.34;              // Димасик «думает», потом ходит
  const FAIL_HOLD = 1.5, FAIL_BACK = 0.55;                 // сообщение о неудаче и возврат фигур
  const MATE_FALL = 0.3, MATE_CLOSE = 1.6, MATE_SKIP = 0.8, CLOSE_FADE = 0.4;

  class Session {
    constructor(opts) {
      opts = opts || {};
      this.opts = opts;
      this.t = 0; this.phaseT = 0; this.fade = 0; this.closing = false; this.closeT = 0; this.done = false;
      this.phase = 'timelapse';
      this.fails = 0; this.moveNo = 1;                      // moveNo: какой ход игрока сейчас, 1 или 2
      this.selected = -1; this.selT = 0; this.cursor = 44; this.cursorOn = false;       // курсор клавиатуры начинает с ладьи e6
      this.hintOn = false; this.hintMove = null; this.hintsUsed = 0;
      this.msg = null; this.lastMove = null; this.checkSq = -1;
      this.pieces = []; this.bySq = new Array(64).fill(null); this.ghosts = []; this.puffs = [];
      this.cap = { w: [], b: [] };                          // взятые фигуры: w — потерянные белыми, b — потерянные чёрными
      this.legal = []; this.rep = null; this.ply = 0; this.counter = 1; this.light = 0; this.clockAng = 0; this.nid = 0;
      this.glideDur = GLIDE; this.glideFast = false; this.cFrom = 1;
      this.vw = 0; this.vh = 0; this._tp = null; this._solKey = ''; this._solVal = null;
      this.sndCount = {};                                   // сколько раз какой звук запрошен (для проверок частоты звуков)
      this.mateFx = false; this.king = null; this.panelEnd = -1; this.capKey = ''; this.capT = 0;
      if (opts.timelapse === false) { this._setPos(PUZZLE_FEN); this.counter = 54; this.light = 1; this._enterPuzzle(); }
      else this._setPos(START_FEN);
    }

    _snd(name, vol) { this.sndCount[name] = (this.sndCount[name] || 0) + 1; sfx(name, vol === undefined ? undefined : { vol }); }

    // ---- фигуры: логическая клетка и плавно меняющееся положение на экране (в клетках: x — вертикаль 0…7, y — горизонталь 0…7, снизу вверх)
    _setPos(fen) {
      this.pos = parseFen(fen); this.pieces = []; this.bySq.fill(null);
      for (let s = 0; s < 64; s++) { const ch = this.pos.b[s]; if (ch) { const p = this._mk(ch, s); this.pieces.push(p); this.bySq[s] = p; } }
      this._updCheck();
    }
    _mk(ch, sq) { const f = sq & 7, r = sq >> 3; return { id: ++this.nid, ch, c: isW(ch) ? 'w' : 'b', sq, fx: f, fy: r, tx: f, ty: r, t0: 0, dur: 0, hop: 0, ease: 'outQuad', fall: -1, born: -9 }; }
    _alpha(p) { return p.born > -9 ? clamp((this.t - p.born) / 0.4, 0, 1) : 1; }                // съеденная фигура при возврате позиции проявляется
    _k(p) { return p.dur > 0 ? clamp((this.t - p.t0) / p.dur, 0, 1) : 1; }
    _px(p) { return lerp(p.fx, p.tx, (EASE[p.ease] || EASE.outQuad)(this._k(p))); }
    _py(p) { return lerp(p.fy, p.ty, (EASE[p.ease] || EASE.outQuad)(this._k(p))); }
    _lift(p) { const k = this._k(p); return p.hop > 0 && k < 1 ? p.hop * Math.sin(Math.PI * k) : 0; }
    _moving(p) { return p.dur > 0 && this.t < p.t0 + p.dur; }
    _slide(p, to, o) {
      const x = this._px(p), y = this._py(p);              // новое движение начинается оттуда, где фигура сейчас (быстрые ходы подряд не дёргаются)
      p.fx = x; p.fy = y; p.tx = to & 7; p.ty = to >> 3; p.t0 = this.t; p.dur = Math.max(0.001, o.dur); p.hop = o.hop || 0; p.ease = o.ease || 'outQuad'; p.sq = to;
    }
    _updCheck() { this.checkSq = engine.inCheck(this.pos, this.pos.turn) ? this.pos.b.indexOf(this.pos.turn === 'w' ? 'K' : 'k') : -1; }
    _puff(f, r, n) {
      const R = Ale.fxRng;
      for (let i = 0; i < n; i++) { const a = R.range(0, 6.283), v = R.range(0.5, 1.4); this.puffs.push({ x: f + 0.5, y: r + 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 + 0.35, age: 0, life: R.range(0.3, 0.52), r: R.range(0.07, 0.14), spark: false }); }
    }
    _sparks(f, r, n) {
      const R = Ale.fxRng;
      for (let i = 0; i < n; i++) { const a = R.range(0, 6.283), v = R.range(1.2, 3.0); this.puffs.push({ x: f + 0.5, y: r + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: R.range(0.7, 1.15), r: R.range(0.06, 0.1), spark: true }); }
    }

    // Один ход на доске: логика меняется сразу, фигура скользит (взятая рассыпается облачком)
    _doMove(mv, o) {
      const p = this.bySq[mv.from]; if (!p) return null;
      const cap = this.bySq[mv.to];
      if (cap) {
        this.pieces.splice(this.pieces.indexOf(cap), 1);
        this.ghosts.push({ ch: cap.ch, x: this._px(cap), y: this._py(cap), age: 0, life: o.instant ? 0.12 : 0.24 });
        this.cap[cap.c].push(cap.ch);
        this._puff(mv.to & 7, mv.to >> 3, o.instant ? 2 : 5);
      }
      this.bySq[mv.from] = null; this.bySq[mv.to] = p;
      this._slide(p, mv.to, o);
      if (mv.promo) p.ch = mv.promo;
      this.pos = engine.apply(this.pos, mv);
      this.lastMove = { from: mv.from, to: mv.to };
      this._updCheck();
      return cap;
    }

    // ---- ускоренная партия
    _applyPly(i, instant) {
      const mv = engine.moveFromUci(this.pos, GAME[i]);
      if (!mv) throw new Error('шахматы: ход ' + (i + 1) + ' ' + GAME[i] + ' невозможен');
      const dur = instant ? 0.14 : clamp(plyDur(i) * 0.85, 0.11, 0.26);
      const cap = this._doMove(mv, { dur, hop: instant ? 0 : mv.piece.toUpperCase() === 'N' ? 0.2 : 0.1, ease: 'inOutQuad', instant });
      if (instant) return;
      // звук не должен превращаться в трескотню: первые ходы — каждый, потом каждый второй, потом каждый четвёртый и тише
      const every = i < 6 ? 1 : i < 14 ? 2 : 4;
      if (i % every === 0) this._snd(cap ? 'chess_take' : 'chess_move', i < 6 ? 0.9 : i < 14 ? 0.75 : 0.55);
    }
    _updTimelapse() {
      const at = plyTimes();
      while (this.ply < GAME.length && this.t >= at[this.ply]) this._applyPly(this.ply++, false);
      const i = this.ply - 1;
      this.counter = 1 + (i >= 0 ? i + clamp((this.t - at[i]) / plyDur(i), 0, 1) : 0) / 2;       // номер хода «бежит» непрерывно
      this.light = clamp((this.counter - 1) / 53, 0, 1);
      if (this.ply >= GAME.length && this.t >= at[GAME.length] + 0.15) this._startGlide(false);
      else if (this.t >= SKIP_AFTER && this._wantsSkip()) this.skip();
    }
    // «Прошло ещё много ходов»: четыре оставшиеся фигуры плавно скользят в позицию задачи, счётчик быстро крутится до «Ход 54»
    _startGlide(fast) {
      this.phase = 'glide'; this.phaseT = 0; this.glideDur = fast ? GLIDE_FAST : GLIDE; this.glideFast = !!fast; this.cFrom = this.counter;
      const target = parseFen(PUZZLE_FEN);
      this.bySq.fill(null);
      for (const p of this.pieces) { const to = target.b.indexOf(p.ch); if (to >= 0) { this._slide(p, to, { dur: this.glideDur, ease: 'inOutCubic' }); this.bySq[to] = p; } }
      this.pos = target; this.lastMove = null; this.selected = -1; this._updCheck();
      this._snd('chess_whoosh');
    }
    _fastGlide() {
      this.glideFast = true; this.glideDur = 0.2; this.phaseT = 0; this.cFrom = this.counter;
      for (const p of this.pieces) this._slide(p, p.sq, { dur: 0.2, ease: 'outCubic' });
    }
    _updGlide() {
      const k = clamp(this.phaseT / this.glideDur, 0, 1);
      this.counter = lerp(this.cFrom, 54, EASE.outCubic(k)); this.light = clamp((this.counter - 1) / 53, 0, 1);
      if (!this.glideFast && this.phaseT >= 0.15 && this._wantsSkip()) { this._fastGlide(); return; }
      if (k >= 1) { this.counter = 54; this.light = 1; this.panelEnd = this.t; this._enterPuzzle(); }
    }

    // ---- задача
    _enterPuzzle() {
      if (!this.capBase) this.capBase = { w: this.cap.w.length, b: this.cap.b.length };           // сколько фигур взято в ускоренной партии (остальное вернётся при «Заново»)
      this.phase = 'puzzle'; this.phaseT = 0; this.legal = legalMoves(this.pos); this.selected = -1; this.msg = null; this.rep = null;
      this.hintOn = false; this.hintMove = null;
      if (this.fails >= 2) this._autoHint();
    }
    _autoHint() { this.hintOn = true; this.hintMove = this.solution(); }
    _select(sq) { this.selected = sq; this.selT = this.t; this.cursor = sq; this._snd('chess_pick'); }
    _deselect() { this.selected = -1; }

    // Единственная точка входа хода: нажатие на клетку (касание, клавиша подтверждения при курсоре, бот)
    pressSquare(sq) {
      sq = sqIndex(sq);
      if (this.phase !== 'puzzle' || this.closing || sq < 0) return 'ignored';
      const p = this.pos.b[sq], mine = !!p && isW(p), sel = this.selected;
      if (sel >= 0) {
        const mv = this.legal.find((m) => m.from === sel && m.to === sq);
        if (mv) return this._playerMove(mv);
        if (mine && sq !== sel) { this._select(sq); return 'select'; }
        this._deselect();
        return 'deselect';
      }
      if (mine) { this._select(sq); return 'select'; }
      return 'ignored';
    }

    _playerMove(mv) {
      this.selected = -1; this.hintOn = false; this.hintMove = null; this.msg = null;
      const cap = this._doMove(mv, { dur: 0.3, hop: 0.16, ease: 'inOutQuad' });
      this._snd(cap ? 'chess_take' : 'chess_move');
      const st = engine.status(this.pos);                   // дальше ходит Димасик: мат, пат или ответ
      if (st === 'mate') { this._success(); return 'mate'; }
      if (st === 'stalemate') { this._fail('stalemate'); return 'fail'; }
      if (this.moveNo >= 2) { this._fail('notmate'); return 'fail'; }
      this.phase = 'reply'; this.phaseT = 0; this.rep = { move: replyFor(this.pos), started: false };
      return 'move';
    }
    _updReply() {
      const r = this.rep, t = this.phaseT;
      if (!r) return;
      if (!r.started && t >= REPLY_WAIT) { r.started = true; this._doMove(r.move, { dur: REPLY_SLIDE, hop: 0.12, ease: 'inOutQuad' }); this._snd('chess_move', 0.7); }
      if (r.started && t >= REPLY_WAIT + REPLY_SLIDE + 0.08) { this.moveNo = 2; this.rep = null; this._enterPuzzle(); }
    }
    _fail(kind) {
      this.fails++; this.phase = 'fail'; this.phaseT = 0; this.failKind = kind; this.failBack = 0; this.rep = null;
      this.selected = -1; this.hintOn = false; this.hintMove = null;
      const T = Ale.T.chess || {};
      this.msg = { text: kind === 'stalemate' ? T.stalemate : T.notMate, t: this.t, kind };
      this._snd('chess_no');
    }
    // Исходная позиция задачи: фигуры плавно возвращаются на места; съеденная (король Димасика может взять ферзя, поставленного рядом без защиты) появляется заново
    _toStart(dur) {
      const target = parseFen(PUZZLE_FEN), pool = this.pieces.slice(), next = [];
      this.bySq.fill(null);
      for (let sq = 0; sq < 64; sq++) {
        const ch = target.b[sq]; if (!ch) continue;
        const i = pool.findIndex((p) => p.ch === ch);
        let p;
        if (i >= 0) { p = pool.splice(i, 1)[0]; this._slide(p, sq, { dur, ease: 'inOutCubic' }); }
        else { p = this._mk(ch, sq); p.born = this.t; }
        this.bySq[sq] = p; next.push(p);
      }
      this.pieces = next;
      if (this.capBase) { this.cap.w.length = Math.min(this.cap.w.length, this.capBase.w); this.cap.b.length = Math.min(this.cap.b.length, this.capBase.b); }       // взятые в задаче фигуры возвращаются из стопки
      this.pos = target; this.moveNo = 1; this.lastMove = null; this._updCheck();
    }
    _updFail() {
      const t = this.phaseT;
      if (!this.failBack && (t >= FAIL_HOLD || (t >= 0.7 && this._wantsSkip()))) { this.failBack = t; this._toStart(FAIL_BACK - 0.05); }
      if (this.failBack && t >= this.failBack + FAIL_BACK) this._enterPuzzle();
    }
    _success() {
      this.phase = 'mate'; this.phaseT = 0; this.mateFx = false; this.selected = -1; this.hintOn = false; this.hintMove = null; this.msg = null; this.rep = null;
      this.king = this.pieces.find((p) => p.ch === 'k') || null;
    }
    _updMate() {
      const t = this.phaseT;
      if (!this.mateFx && t >= MATE_FALL) {
        this.mateFx = true; this._snd('chess_mate');
        if (this.king) { this.king.fall = this.t; this._sparks(this.king.tx, this.king.ty, 16); }
      }
      if (!this.closing && (t >= MATE_CLOSE || (t >= MATE_SKIP && this._wantsSkip()))) { this.closing = true; this.closeT = 0; }
    }

    // ---- ввод
    _wantsSkip() {
      const I = Ale.Input;
      return !!this._tp || I.pressed('interact') || I.pressed('jump') || I.pressed('attack') || I.edge('Enter') || I.edge('Space') || I.edge('KeyE');
    }
    _lay() { return layout(this.vw || (Ale.Game && Ale.Game.viewW) || 1280, this.vh || (Ale.Game && Ale.Game.viewH) || 720); }
    _updPuzzle() {
      const I = Ale.Input, tp = this._tp, L = this._lay(), inBox = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      if (tp) {
        this.cursorOn = false;
        if (inBox(L.btnHint, tp)) this.hint();
        else if (inBox(L.btnAgain, tp)) this.reset();
        else { const sq = L.sqAt(tp.x, tp.y); if (sq >= 0) { this.cursor = sq; this.pressSquare(sq); } else if (this.selected >= 0) this._deselect(); }
        if (this.phase !== 'puzzle') return;
      }
      let dx = 0, dy = 0;
      if (I.edge('ArrowLeft') || I.edge('KeyA')) dx = -1;
      if (I.edge('ArrowRight') || I.edge('KeyD')) dx = 1;
      if (I.edge('ArrowUp') || I.edge('KeyW')) dy = 1;
      if (I.edge('ArrowDown') || I.edge('KeyS')) dy = -1;
      if (dx || dy) {
        const to = clamp((this.cursor >> 3) + dy, 0, 7) * 8 + clamp((this.cursor & 7) + dx, 0, 7);
        this.cursorOn = true;
        if (to !== this.cursor) { this.cursor = to; this._snd('chess_pick', 0.45); }                  // тихий щелчок на каждой клетке
      }
      if (I.edge('Enter') || I.edge('KeyE') || I.edge('Space') || I.pressed('interact')) { this.cursorOn = true; this.pressSquare(this.cursor); }
      if ((I.edge('Escape') || I.edge('Backspace') || I.edge('KeyN')) && this.selected >= 0) { this._deselect(); I.consume('pause'); }       // N — кнопка B геймпада; Esc со снятой фигурой — пауза (на выбранной он сначала снимает выбор и гасит нажатие)
      const pad = I.lastDevice === 'pad';                                                                                                    // геймпад: X — подсказка, Y — заново (клавиши H и R работают всегда)
      if (I.edge('KeyH') || (pad && I.pressed('attack'))) this.hint();
      if (I.edge('KeyR') || (pad && I.pressed('throw'))) this.reset();
    }

    // Второй ход, а мата в один ход уже нет (первый ход был не тот): экран подсказывает «Заново», игрок может и доиграть — получит «Не мат»
    get dead() { return this.phase === 'puzzle' && this.moveNo >= 2 && this.solution() === null; }

    // ---- публичное для бота и проверок
    // Первый ход решения из текущей позиции (на первом ходу — мат в два, на втором — мат); null, если мата в два уже нет
    solution() {
      if (this.pos.turn !== 'w') return null;
      const key = toFen(this.pos) + '|' + this.moveNo;
      if (this._solKey === key) return this._solVal;
      let m = null;
      if (this.moveNo >= 2) { const w = mateIn1(this.pos); if (w.length) m = w[0]; }
      else { const s = solveMate2(this.pos); if (s.length) m = s[0].move; }
      this._solKey = key; this._solVal = m ? { from: m.from, to: m.to, uci: uci(m) } : null;
      return this._solVal;
    }
    skip() {
      if (this.phase === 'timelapse') {
        while (this.ply < GAME.length) this._applyPly(this.ply++, true);
        this.counter = 27.5; this._startGlide(true);
        return 'skip';
      }
      if (this.phase === 'glide' && !this.glideFast) { this._fastGlide(); return 'skip'; }
      return 'ignored';
    }
    hint() {
      if (this.phase !== 'puzzle') return 'ignored';
      this.hintOn = true; this.hintMove = this.solution(); this.hintsUsed++;
      this._snd('chess_pick');
      return 'hint';
    }
    // «Заново»: исходная позиция задачи (неудачей не считается)
    reset() {
      if (this.phase !== 'puzzle' && this.phase !== 'reply' && this.phase !== 'fail') return 'ignored';
      this._toStart(0.4);
      this._enterPuzzle();
      return 'reset';
    }

    // Крупная подпись над доской по фазе
    captionText() {
      const T = Ale.T.chess || {};
      return this.phase === 'timelapse' ? T.timelapse : this.phase === 'glide' ? T.glide : this.phase === 'mate' ? T.mate : T.title;
    }

    // ---- каждый кадр
    update(dt) {
      this.t += dt; this.phaseT += dt;
      const UI = Ale.UI, tp = UI.tapPoint; UI.tapPoint = null; this._tp = tp;
      if (this.closing) { this.closeT += dt; this.fade = 1 - clamp(this.closeT / CLOSE_FADE, 0, 1); if (this.closeT >= CLOSE_FADE) this.done = true; }
      else this.fade = clamp(this.t / 0.4, 0, 1);
      if (!this.closing) {
        switch (this.phase) {
          case 'timelapse': this._updTimelapse(); break;
          case 'glide': this._updGlide(); break;
          case 'puzzle': this._updPuzzle(); break;
          case 'reply': this._updReply(); break;
          case 'fail': this._updFail(); break;
          case 'mate': this._updMate(); break;
        }
      } else if (this.phase === 'mate') this._updMate();
      // часы крутятся быстрее, пока идёт партия, и останавливаются к концу скольжения
      const rate = this.phase === 'timelapse' ? 2.5 + 5 * clamp(this.ply / 20, 0, 1) : this.phase === 'glide' ? 10 * (1 - clamp(this.phaseT / this.glideDur, 0, 1)) : 0;
      this.clockAng += rate * dt;
      const ck = this.captionText(); if (ck !== this.capKey) { this.capKey = ck; this.capT = this.t; }
      for (const g of this.ghosts) g.age += dt;
      this.ghosts = this.ghosts.filter((g) => g.age < g.life);
      for (const q of this.puffs) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy = q.vy * 0.94 - (q.spark ? 0.8 : 0.2) * dt; }
      this.puffs = this.puffs.filter((q) => q.age < q.life);
    }
  }

  // ================================================================== РАСКЛАДКА
  // Доска по центру (клетка ≈ (H − 156) / 8, на кадре 720 — 70 юн.), слева карточки игроков (Димасик сверху, Алеся снизу), справа часы со счётчиком ходов и кнопки;
  // подпись над доской, строка состояния и подсказки управления под ней. Всё держится в кадре от 1000 до 1700 юн. шириной.
  const FR = 14;
  let LCACHE = null;
  function layout(W, H) {
    if (LCACHE && LCACHE.W === W && LCACHE.H === H) return LCACHE;
    const cell = clamp(Math.floor((H - 156) / 8), 40, 76), bs = cell * 8, fw = bs + FR * 2;
    const fx = Math.round((W - fw) / 2), fy = 54, bx = fx + FR, by = fy + FR;
    const cardW = clamp(fx - 28, 140, 236), cardH = 142, rw = clamp(W - (fx + fw) - 28, 140, 236), rx = fx + fw + 14;
    const L = { W, H, cell, bs, fx, fy, fw, bx, by, FR };
    L.cardD = { x: fx - 14 - cardW, y: fy, w: cardW, h: cardH };                    // Димасик (чёрные): слева сверху
    L.cardA = { x: fx - 14 - cardW, y: fy + fw - cardH, w: cardW, h: cardH };       // Алеся (белые): слева снизу
    L.timeBox = { x: rx, y: fy, w: rw, h: 194 };                                      // часы и счётчик ходов (ускоренная партия)
    L.btnHint = { x: rx, y: fy + fw - 64 * 2 - 14, w: rw, h: 64 };
    L.btnAgain = { x: rx, y: fy + fw - 64, w: rw, h: 64 };
    L.frame = { x: fx, y: fy, w: fw, h: fw };
    L.board = { x: bx, y: by, w: bs, h: bs };
    L.caption = { x: Math.round(W / 2 - 230), y: 4, w: 460, h: 46 };
    L.status = { y: fy + fw + 27 };                                                   // середина строки состояния под доской
    L.sq = (sq) => ({ x: bx + (sq & 7) * cell, y: by + (7 - (sq >> 3)) * cell, w: cell, h: cell });
    L.sqAt = (x, y) => { const f = Math.floor((x - bx) / cell), r = 7 - Math.floor((y - by) / cell); return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1; };
    LCACHE = L;
    return L;
  }

  // ================================================================== РИСОВАНИЕ
  const OUT = '#3a2431', CREAM = '#fff6e4', INK = '#3a2431';
  const SQ_LIGHT = '#f3e2bd', SQ_DARK = '#a8744f';
  const font = (w, s) => w + ' ' + s + 'px ' + Ale.FONT;
  const fitFont = (ctx, text, weight, size, maxW, minSize) => { let s = size; ctx.font = font(weight, s); while (s > minSize && ctx.measureText(text).width > maxW) { s--; ctx.font = font(weight, s); } return s; };
  const mix = (a, b, t) => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  function outlined(ctx, text, x, y, fill, w) { ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); }

  // Приглушённая игра за доской; свет медленно уходит от утра к вечеру (без вспышек: меняется только цвет мягкого пятна)
  function drawBackdrop(ctx, S, W, H) {
    const f = S.fade, k = S.light;
    ctx.fillStyle = 'rgba(14,8,20,' + (0.8 * f).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    const col = k < 0.5 ? mix([255, 226, 160], [255, 168, 92], k * 2) : mix([255, 168, 92], [128, 96, 200], (k - 0.5) * 2);
    const cx = lerp(W * 0.22, W * 0.78, k), cy = lerp(H * 0.22, H * 0.5, k);
    const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(W, H) * 0.75);
    g.addColorStop(0, rgba(col, 0.26 * f)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.max(W, H) * 0.72);
    v.addColorStop(0, 'rgba(6,3,10,0)'); v.addColorStop(1, 'rgba(6,3,10,' + (0.5 * f).toFixed(3) + ')');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // полоса сверху чуть темнее: полоска сердец, счётчик и цель игры под доской не должны просвечивать
    const top = ctx.createLinearGradient(0, 0, 0, 170); top.addColorStop(0, 'rgba(10,5,14,' + (0.98 * f).toFixed(3) + ')'); top.addColorStop(0.75, 'rgba(10,5,14,' + (0.96 * f).toFixed(3) + ')'); top.addColorStop(1, 'rgba(10,5,14,0)');
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 170);
  }

  function drawCaption(ctx, S, L, T) {
    const text = S.captionText(), mate = S.phase === 'mate', size = mate ? 52 : 36;
    const k = EASE.outBack(clamp((S.t - S.capT) / 0.35, 0, 1)), sc = (mate ? 0.5 : 0.88) + (mate ? 0.5 : 0.12) * k;
    ctx.save(); ctx.translate(L.W / 2, mate ? 33 : 30); ctx.scale(sc, sc);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, text, 'bold', size, L.W - 60, 22);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffc35e');
    outlined(ctx, text, 0, 2, g, mate ? 11 : 9);
    ctx.restore();
  }

  function drawFrame(ctx, L) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; Ale.rr(ctx, L.fx + 4, L.fy + 10, L.fw, L.fw, 24); ctx.fill();
    const g = ctx.createLinearGradient(0, L.fy, 0, L.fy + L.fw); g.addColorStop(0, '#a8744b'); g.addColorStop(1, '#6e4429');
    Ale.rr(ctx, L.fx, L.fy, L.fw, L.fw, 24); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = LINE; ctx.stroke();
    Ale.rr(ctx, L.fx + 5, L.fy + 5, L.fw - 10, L.fw - 10, 19); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,170,0.35)'; ctx.stroke();
    // клетки
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { ctx.fillStyle = (f + r) % 2 === 0 ? SQ_DARK : SQ_LIGHT; ctx.fillRect(L.bx + f * L.cell, L.by + (7 - r) * L.cell, L.cell, L.cell); }
    ctx.lineWidth = 4; ctx.strokeStyle = LINE; ctx.strokeRect(L.bx - 2, L.by - 2, L.bs + 4, L.bs + 4);
    // вертикали и горизонтали по краям рамки
    ctx.fillStyle = 'rgba(255,233,196,0.82)'; ctx.font = font('bold', 12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) { ctx.fillText('abcdefgh'[i], L.bx + i * L.cell + L.cell / 2, L.by + L.bs + 8); ctx.fillText(String(8 - i), L.bx - 8, L.by + i * L.cell + L.cell / 2); }
  }

  function drawHighlights(ctx, S, L) {
    const c = L.cell, T = S.t;
    const tint = (sq, color) => { const r = L.sq(sq); ctx.fillStyle = color; ctx.fillRect(r.x, r.y, c, c); };
    if (S.lastMove && S.phase !== 'timelapse' && S.phase !== 'glide') { tint(S.lastMove.from, 'rgba(255,214,102,0.30)'); tint(S.lastMove.to, 'rgba(255,214,102,0.42)'); }
    if (S.checkSq >= 0 && S.phase !== 'mate' && S.phase !== 'timelapse' && S.phase !== 'glide') { const r = L.sq(S.checkSq), g = ctx.createRadialGradient(r.x + c / 2, r.y + c / 2, c * 0.1, r.x + c / 2, r.y + c / 2, c * 0.75); g.addColorStop(0, 'rgba(235,64,52,0.75)'); g.addColorStop(1, 'rgba(235,64,52,0)'); ctx.fillStyle = g; ctx.fillRect(r.x - c * 0.3, r.y - c * 0.3, c * 1.6, c * 1.6); }
    if (S.phase === 'puzzle') {
      if (S.hintOn && S.hintMove) {
        const pulse = 0.5 + 0.5 * Math.sin(T * 5.5);
        tint(S.hintMove.from, 'rgba(255,196,64,' + (0.38 + 0.3 * pulse).toFixed(3) + ')');
        const r = L.sq(S.hintMove.to); tint(S.hintMove.to, 'rgba(110,210,120,' + (0.34 + 0.3 * pulse).toFixed(3) + ')');
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,196,64,' + (0.7 + 0.3 * pulse).toFixed(3) + ')'; const f = L.sq(S.hintMove.from); ctx.strokeRect(f.x + 3, f.y + 3, c - 6, c - 6);
        ctx.strokeStyle = 'rgba(70,170,90,' + (0.7 + 0.3 * pulse).toFixed(3) + ')'; ctx.strokeRect(r.x + 3, r.y + 3, c - 6, c - 6);
      }
      if (S.selected >= 0) {
        tint(S.selected, 'rgba(255,217,138,0.78)');
        const r = L.sq(S.selected); ctx.lineWidth = 4; ctx.strokeStyle = '#e8a23a'; ctx.strokeRect(r.x + 2, r.y + 2, c - 4, c - 4);
        for (const m of S.legal) {
          if (m.from !== S.selected) continue;
          const q = L.sq(m.to);
          if (m.cap) { ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(214,52,33,0.8)'; ctx.beginPath(); ctx.arc(q.x + c / 2, q.y + c / 2, c * 0.4, 0, 6.283); ctx.stroke(); }
          else { ctx.fillStyle = 'rgba(58,36,49,0.5)'; ctx.beginPath(); ctx.arc(q.x + c / 2, q.y + c / 2, c * 0.15, 0, 6.283); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.55)'; ctx.stroke(); }
        }
      }
    }
  }

  function drawPieces(ctx, S, L) {
    const c = L.cell, size = c;
    const place = (x, y) => ({ cx: L.bx + (x + 0.5) * c, cy: L.by + (7 - y + 0.5) * c });
    const still = [], flying = [];
    for (const p of S.pieces) (S._moving(p) ? flying : still).push(p);
    const shadow = (p, lift, a) => {                               // мягкая тень на клетке под основанием (по ширине основания фигуры)
      const q = place(S._px(p), S._py(p)), m = pieceMetrics(p.ch, size);
      ctx.fillStyle = 'rgba(25,12,18,' + (0.3 * a * (1 - lift * 0.8)).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(q.cx, q.cy + m.foot - c * 0.012, m.half * 1.12 * (1 - lift * 0.17), c * 0.058, 0, 0, 6.283); ctx.fill();
    };
    for (const p of still) {
      if (p.fall >= 0) continue;
      const al = S._alpha(p), up = S.phase === 'puzzle' && S.selected === p.sq ? 0.06 * EASE.outCubic(clamp((S.t - S.selT) / 0.14, 0, 1)) : 0;       // выбранная фигура приподнимается
      shadow(p, up * 2, al); const q = place(S._px(p), S._py(p)); drawPiece(ctx, p.ch, q.cx, q.cy - up * c, size, al < 1 ? { alpha: al } : undefined);
    }
    for (const p of flying) {
      const lift = S._lift(p), al = S._alpha(p); shadow(p, lift, al);
      const q = place(S._px(p), S._py(p)); drawPiece(ctx, p.ch, q.cx, q.cy - lift * c, size, al < 1 ? { alpha: al } : undefined);
    }
    // упавший король (мат): поворот на 90° вокруг кромки подошвы, потускнение
    for (const p of S.pieces) {
      if (p.fall < 0) continue;
      const u = clamp((S.t - p.fall) / 0.7, 0, 1), q = place(S._px(p), S._py(p)), rot = 1.5 * EASE.outBounce(u);
      shadow(p, 0, 1 - 0.6 * u); drawPiece(ctx, p.ch, q.cx, q.cy, size, { rot, alpha: 1 - 0.38 * u });
    }
    for (const g of S.ghosts) {                                   // взятая фигура схлопывается и тает
      const u = g.age / g.life, q = place(g.x, g.y);
      drawPiece(ctx, g.ch, q.cx, q.cy, size, { scale: 1 - 0.45 * u, alpha: 1 - u, rot: u * 0.5 });
    }
    for (const q of S.puffs) {                                     // облачка и искры
      const u = q.age / q.life, p = place(q.x - 0.5, q.y - 0.5);
      ctx.save();
      if (q.spark) {
        ctx.translate(p.cx, p.cy); ctx.rotate(u * 3); ctx.globalAlpha *= (1 - u) * 0.95; const r = q.r * c * (1 + u * 0.4);
        ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.moveTo(0, -r * 1.6); ctx.lineTo(r * 0.5, -r * 0.5); ctx.lineTo(r * 1.6, 0); ctx.lineTo(r * 0.5, r * 0.5); ctx.lineTo(0, r * 1.6); ctx.lineTo(-r * 0.5, r * 0.5); ctx.lineTo(-r * 1.6, 0); ctx.lineTo(-r * 0.5, -r * 0.5); ctx.closePath(); ctx.fill();
      } else { ctx.globalAlpha *= (1 - u) * 0.8; ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(p.cx, p.cy, q.r * c * (1 + u * 1.6), 0, 6.283); ctx.fill(); }
      ctx.restore();
    }
  }

  // Мат: мягкое золотое свечение вокруг короля (одно, без мелькания)
  function drawMateGlow(ctx, S, L) {
    if (S.phase !== 'mate' || !S.mateFx) return;
    const u = clamp((S.phaseT - MATE_FALL) / 1.1, 0, 1), c = L.cell;
    const p = S.king ? L.sq(S.king.sq) : null; if (!p) return;
    const a = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.55;
    const g = ctx.createRadialGradient(p.x + c / 2, p.y + c / 2, c * 0.2, p.x + c / 2, p.y + c / 2, c * (1.1 + 1.6 * u));
    g.addColorStop(0, 'rgba(255,226,140,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = g; ctx.fillRect(L.bx, L.by, L.bs, L.bs);
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,226,140,' + (a * 0.9).toFixed(3) + ')'; Ale.rr(ctx, L.fx + 3, L.fy + 3, L.fw - 6, L.fw - 6, 21); ctx.stroke();
  }

  function drawCursor(ctx, S, L) {
    if (!S.cursorOn || S.phase !== 'puzzle' || Ale.Input.lastDevice === 'touch') return;
    const r = L.sq(S.cursor), c = L.cell, pulse = 0.5 + 0.5 * Math.sin(S.t * 6);
    ctx.lineWidth = 8; ctx.strokeStyle = LINE; Ale.rr(ctx, r.x + 3, r.y + 3, c - 6, c - 6, 9); ctx.stroke();
    ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(255,' + Math.round(238 - 28 * pulse) + ',' + Math.round(200 - 60 * pulse) + ',1)'; Ale.rr(ctx, r.x + 3, r.y + 3, c - 6, c - 6, 9); ctx.stroke();
  }

  // Карточка игрока: портрет, имя, сторона и стопка взятых им фигур
  function drawCard(ctx, S, L, r, white, T) {
    const side = white ? 'w' : 'b', active = (S.phase === 'puzzle' || S.phase === 'reply') && S.pos.turn === side;       // в ускоренной партии подсветка очереди мигала бы с частотой ходов — её там нет
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, r.x + 3, r.y + 7, r.w, r.h, 22); ctx.fill();
    Ale.rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = active ? 6 : 5; ctx.strokeStyle = active ? '#e8a23a' : OUT; ctx.stroke();
    // у Алеси выражение лица по ходу дела: после мата довольная, после неудачи в недоумении (портреты те же, что в репликах; нет такого — обычный)
    const base = white ? 'alesya' : 'dimasik', mood = white ? (S.phase === 'mate' ? 'smug' : S.phase === 'fail' ? 'puzzled' : '') : '', pf = Ale.Assets && Ale.Assets.portraits;
    const pr = 30, pcx = r.x + 14 + pr, pcy = r.y + 14 + pr, port = pf && ((mood && pf[base + '_' + mood]) || pf[base]);
    ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, 6.283); ctx.clip();
    if (port) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(port, pcx - pr, pcy - pr, pr * 2, pr * 2); }
    else { ctx.fillStyle = white ? '#f6b8c8' : '#d9777a'; ctx.fillRect(pcx - pr, pcy - pr, pr * 2, pr * 2); ctx.fillStyle = INK; ctx.font = font('bold', 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((white ? T.names.ale : T.names.dimasik).charAt(0), pcx, pcy + 2); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, 6.283); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    const tx = pcx + pr + 10, tw = r.x + r.w - 10 - tx, name = white ? T.names.ale : T.names.dimasik;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    fitFont(ctx, name, 'bold', 26, tw, 16); ctx.fillText(name, tx, pcy - 11);
    drawPiece(ctx, white ? 'K' : 'k', tx + 11, pcy + 19, 26, { light: true });         // значок стороны: король (подошва ниже центра на 11 юн., макушка на 13 выше)
    ctx.font = font('600', 17); ctx.fillStyle = 'rgba(58,36,49,0.75)'; ctx.fillText(T.sides[side], tx + 27, pcy + 18);
    // взятые фигуры: две строки мелких значков
    const list = white ? S.cap.b : S.cap.w, step = clamp(Math.floor((r.w - 54) / 7), 14, 20), per = Math.max(4, Math.floor((r.w - 28 - 26) / step) + 1), x0 = r.x + 14 + 13, y0 = r.y + 14 + pr * 2 + 24;     // до 15 значков в две строки при любой ширине карточки
    list.forEach((ch, i) => { const col = i % per, row = Math.floor(i / per); drawPiece(ctx, ch, x0 + col * step, y0 + row * 22, 26, { light: true }); });
  }

  // Часы и номер хода в углу: стрелки вращаются, цифры «крутятся», как на счётчике. После скольжения (k → 1) часы гаснут, остаётся плашка «Ход 54»: сколько партия уже идёт
  function drawTimePanel(ctx, S, L, T, k) {
    const r = L.timeBox, h = lerp(r.h, 92, k), cx = r.x + r.w / 2, cy = r.y + 56, R = 38;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, r.x + 3, r.y + 7, r.w, h, 22); ctx.fill();
    Ale.rr(ctx, r.x, r.y, r.w, h, 22); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    if (k < 1) {
      ctx.save(); ctx.globalAlpha *= 1 - k;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fillStyle = '#fffdf6'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, big = i % 3 === 0; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * R * (big ? 0.7 : 0.78), cy - Math.cos(a) * R * (big ? 0.7 : 0.78)); ctx.lineTo(cx + Math.sin(a) * R * 0.88, cy - Math.cos(a) * R * 0.88); ctx.lineWidth = big ? 3.5 : 2; ctx.strokeStyle = INK; ctx.stroke(); }
      const hand = (a, len, w, col) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * R * len, cy - Math.cos(a) * R * len); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); };
      hand(S.clockAng / 12, 0.5, 5, INK); hand(S.clockAng, 0.78, 3.5, '#d9553a');
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 6.283); ctx.fillStyle = INK; ctx.fill();
      ctx.restore();
    }
    // «Ход N»: цифры прокручиваются вертикально внутри окошка
    const bw = Math.min(r.w - 36, 150), bh = 52, bx = cx - bw / 2, by = r.y + lerp(128, 34, k), v = S.counter, n = Math.floor(v + 1e-6), fr = v - n;
    ctx.font = font('600', 18); ctx.fillStyle = 'rgba(58,36,49,0.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(T.moveLabel, cx, by - 13);
    Ale.rr(ctx, bx, by, bw, bh, 14); ctx.fillStyle = '#2b1f33'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.save(); Ale.rr(ctx, bx + 2, by + 2, bw - 4, bh - 4, 12); ctx.clip();
    ctx.font = font('bold', 40); ctx.fillStyle = '#ffe9c4';
    ctx.fillText(String(n), cx, by + bh / 2 + 2 - fr * bh); ctx.fillText(String(n + 1), cx, by + bh / 2 + 2 + (1 - fr) * bh);
    ctx.restore();
    ctx.restore();
  }

  function drawButton(ctx, S, L, b, label, key, pulse) {
    const touch = Ale.Input.lastDevice === 'touch', hot = pulse ? 0.5 + 0.5 * Math.sin(S.t * 6) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, b.x + 2, b.y + 6, b.w, b.h, b.h / 2); ctx.fill();
    Ale.rr(ctx, b.x, b.y, b.w, b.h, b.h / 2); ctx.fillStyle = pulse ? 'rgb(255,' + Math.round(217 + 20 * hot) + ',' + Math.round(138 + 40 * hot) + ')' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
    let x0 = b.x + 16;
    if (!touch) {
      ctx.font = font('bold', 19); const kw = Math.max(32, ctx.measureText(key).width + 16);
      Ale.rr(ctx, x0, b.y + b.h / 2 - 17, kw, 34, 9); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(key, x0 + kw / 2, b.y + b.h / 2 + 1); x0 += kw + 8;
    }
    const tw = b.x + b.w - 14 - x0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; fitFont(ctx, label, 'bold', 26, tw, 16); ctx.fillText(label, x0 + tw / 2, b.y + b.h / 2 + 1);
  }

  function pill(ctx, S, L, text, y, tone) {
    fitFont(ctx, text, 'bold', 26, L.W - 120, 16);
    const tw = ctx.measureText(text).width, w = tw + 60, h = 46, x = L.W / 2 - w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; Ale.rr(ctx, x + 2, y - h / 2 + 6, w, h, h / 2); ctx.fill();
    Ale.rr(ctx, x, y - h / 2, w, h, h / 2); ctx.fillStyle = tone === 'bad' ? '#ffe3d6' : CREAM; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = tone === 'bad' ? '#a83a26' : OUT; ctx.stroke();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, L.W / 2, y + 1);
  }

  function drawBottom(ctx, S, L, T) {
    const y = L.status.y, touch = Ale.Input.lastDevice === 'touch';
    if (S.phase === 'timelapse' || S.phase === 'glide') {
      const a = clamp((S.t - SKIP_AFTER) / 0.5, 0, 1) * (0.7 + 0.3 * Math.sin(S.t * 4));
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha *= a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font('600', 22); ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.9)';
      const s = Ale.tx(T.skip); ctx.strokeText(s, L.W / 2, y); ctx.fillStyle = CREAM; ctx.fillText(s, L.W / 2, y); ctx.restore();
      return;
    }
    if (S.phase === 'mate') return;
    if (S.msg) {
      const a = EASE.outCubic(clamp((S.t - S.msg.t) / 0.25, 0, 1)), out = S.failBack ? 1 - clamp((S.phaseT - S.failBack) / 0.3, 0, 1) : 1;
      ctx.save(); ctx.globalAlpha *= a * out; pill(ctx, S, L, S.msg.text, y + (1 - a) * 14, 'bad'); ctx.restore();
      return;
    }
    pill(ctx, S, L, S.phase === 'reply' ? T.replying : S.dead ? T.dead : T.turn, y, 'info');
    const s = Ale.tx(T.legend), yy = Math.min(L.H - 10, y + 37);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(43,26,32,0.85)';
    fitFont(ctx, s, '600', touch ? 21 : 18, L.W - 40, 12);
    ctx.strokeText(s, L.W / 2, yy); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fillText(s, L.W / 2, yy);
  }

  // «Думает…»: три точки у карточки Димасика, пока он выбирает ответ
  function drawThinking(ctx, S, L) {
    if (S.phase !== 'reply' || !S.rep || S.rep.started) return;
    const r = L.cardD, bx = r.x + r.w - 76, by = r.y + r.h + 10;
    Ale.rr(ctx, bx, by, 68, 38, 19); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(58,36,49,' + (0.35 + 0.5 * Math.max(0, Math.sin(S.t * 9 - i * 0.9))).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(bx + 19 + i * 15, by + 19, 5, 0, 6.283); ctx.fill(); }
  }

  function drawSession(ctx, S, W, H) {
    const L = layout(W, H), T = Ale.T.chess;
    ctx.save();
    drawBackdrop(ctx, S, W, H);
    const e = EASE.outCubic(S.fade);
    ctx.globalAlpha = S.fade; ctx.translate(0, (1 - e) * 18);
    if (S.phase !== 'mate') drawCaption(ctx, S, L, T);
    drawFrame(ctx, L);
    drawHighlights(ctx, S, L);
    drawPieces(ctx, S, L);
    drawMateGlow(ctx, S, L);
    drawCursor(ctx, S, L);
    drawCard(ctx, S, L, L.cardD, false, T);
    drawCard(ctx, S, L, L.cardA, true, T);
    const shrink = S.phase === 'timelapse' || S.phase === 'glide' ? 0 : S.panelEnd >= 0 ? EASE.outCubic(clamp((S.t - S.panelEnd) / 0.5, 0, 1)) : 1;
    drawTimePanel(ctx, S, L, T, shrink);
    if (S.phase === 'puzzle' || S.phase === 'reply' || S.phase === 'fail') {
      const ba = S.phase === 'puzzle' ? 1 : 0.55;
      ctx.save(); ctx.globalAlpha *= ba;
      drawButton(ctx, S, L, L.btnHint, T.hint, 'H', false);
      drawButton(ctx, S, L, L.btnAgain, T.again, 'R', S.dead);
      ctx.restore();
    }
    drawThinking(ctx, S, L);
    drawBottom(ctx, S, L, T);
    if (S.phase === 'mate') drawCaption(ctx, S, L, T);               // «Мат!» поверх рамки: крупная надпись чуть заходит на доску
    ctx.restore();
  }

  // ================================================================== ОБЩИЙ ОБЪЕКТ
  const Chess = (Ale.Chess = {
    busy: false,           // экран открыт: UI.modal останавливает мир, касания уходят в UI.tapPoint, сенсорные кнопки скрыты
    session: null,
    engine,
    layout, drawPiece, drawPieceVector, pieceSprite, pieceMetrics, PUZZLE_FEN, START_FEN, GAME,
    TIMELAPSE: { start: TL_START, plyDur, times: plyTimes, skipAfter: SKIP_AFTER, glide: GLIDE, glideFast: GLIDE_FAST, mateClose: MATE_CLOSE, mateSkip: MATE_SKIP, failHold: FAIL_HOLD },

    // Сценарий: yield Ale.Chess.play({}). opts: timelapse: false — сразу к задаче. Возвращает объект с update() (true, когда задача решена и экран закрылся)
    play(opts) {
      if (this.session) this.session.done = true;
      const s = new Session(opts);
      this.session = s; this.busy = true;
      if (!this._musicBack && Ale.Audio && Ale.Audio.screenMusic) this._musicBack = Ale.Audio.screenMusic('chess');           // своя дорожка на время экрана, потом возвращается прежняя
      Ale.Input.consumeAll(); Ale.UI.tapPoint = null;
      return { update: () => s.done, session: s };
    },
    _musicRestore() { const b = this._musicBack; this._musicBack = null; if (b) b(); },
    update(dt) {
      const s = this.session;
      if (!s) { this.busy = false; this._musicRestore(); return; }
      s.update(dt);
      if (s.done) { this.session = null; this.busy = false; this._musicRestore(); Ale.Input.consumeAll(); Ale.UI.tapPoint = null; }
    },
    draw(ctx, W, H) {
      const s = this.session;
      if (!s) return;
      s.vw = W; s.vh = H;
      drawSession(ctx, s, W, H);
    },
    reset() { const s = this.session; this.session = null; this.busy = false; if (s) s.done = true; this._musicRestore(); },

    // Бот сюжета зовёт это каждый шаг, пока busy: в ускоренной партии нажимает «пропустить», в задаче ходит по решению, в остальных фазах ждёт. Возвращает true, пока экран открыт
    botStep() {
      const s = this.session;
      if (!s || !this.busy) return false;
      if (s.phase === 'timelapse' || s.phase === 'glide') s.skip();
      else if (s.phase === 'puzzle') {
        const sol = s.solution();
        if (!sol) s.reset();
        else if (s.selected !== sol.from) s.pressSquare(sol.from);
        else s.pressSquare(sol.to);
      }
      return true;
    },
  });
  Chess.Session = Session;
})();
