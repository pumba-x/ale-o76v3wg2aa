// Процедурное рисование окружения: примитивы в стиле «тёмный контур + тёплые плоские цвета».
// Слои рисуются один раз в отдельный холст с удвоенным разрешением, а в кадре просто копируются.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const OUT = '#2b1a20';

  // Слой: рисуем в юнитах мира (w×h), хранится с разрешением scale пикселей на юнит.
  const pool = [];
  let keep = false;
  // Плотность больших слоёв. На настольных экранах с высокой плотностью пикселей («сетчатка») фон, построенный с 1,4 пикс/юн., растягивается в полтора раза
  // и выглядит мягким (вывески, оконные переплёты, швы кладки). Поэтому большие слои (> 1,2 млн юн²) строятся плотнее, до 1,45× от заказанного и до 2 пикс/юн.,
  // но не выше 13 Мпикс на слой. На телефонах и планшетах (включено сенсорное управление) слои остаются лёгкими: память Safari на iOS ограничена.
  // 27.10.2026, телефон (владелец, iPhone 16e со значка «Домой»: «картинка размытая, будто не то разрешение»): у экрана телефона холст — 1,4 (вкладка Safari) … 1,64 (значок «Домой», iPhone 14 Pro)
  // пикселя на юнит, а слои сцен строились по заказу сцены — 1,05…1,5 пикс/юн., у Монако, парка Киева и реки ещё ×0,8 (1,2 / 0,8): проба tests/_dens_probe.html (вид 844×390, плотность 3) показала,
  // что на всех местах, кроме ASSAS, 89–100 % площади слоёв мельче экрана, в среднем 1,1–1,3 пикс/юн. (скачка 1,09, переход Киева 1,10), то есть фон растягивался в 1,25–1,5 раза; у значка «Домой»
  // страница выше, чем во вкладке (390 pt против 336), и растяжение ещё на 16 % больше — отсюда «в ярлыке хуже». Теперь на касании слой строится не реже экрана (Game.nativeK — плотность, которую холст
  // имеет без автоподбора и без ловушки заставки), но не плотнее 2,2 пикс/юн., не больше 13 Мпикс на слой, а все слои сцены — не больше TOUCH_BUDGET пикселей (память Safari на iOS): что не влезает,
  // строится реже, но не реже, чем заказала сцена.
  const TOUCH_BUDGET = 5.2e7;
  function density(w, h, s) {
    const G = Ale.Game;
    if (Ale.Touch && Ale.Touch.active) {
      const t = G && G.nativeK ? G.nativeK() : 0;
      if (!(t > s)) return s;
      let d = Math.min(t, 2.2, Math.sqrt(1.3e7 / (w * h)));
      const used = poolPx(), room = TOUCH_BUDGET - used;
      if (w * h * d * d > room) d = room > 0 ? Math.sqrt(room / (w * h)) : s;
      return Math.max(s, d);
    }
    if (!G || !(G.k > 0) || w * h < 1.2e6) return s;
    return Math.max(s, Math.min(2, G.k * 0.9, s * 1.45, Math.sqrt(1.3e7 / (w * h))));
  }
  function poolPx() { let px = 0; for (const c of pool) px += c.width * c.height; return px; }
  function layer(w, h, fn, scale) {
    const s = density(w, h, scale || 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s)); c.height = Math.max(1, Math.ceil(h * s));
    c.__d = s;                 // плотность слоя (пикс/юн.): экран диагностики показывает самую низкую среди слоёв сцены
    const g = c.getContext('2d');
    g.scale(s, s);
    fn(g, w, h);
    if (!keep) pool.push(c);
    return { c, w, h };
  }
  // Слои сцены освобождаются при уходе из неё: Safari на iPhone держит память холстов до сборки мусора и может упасть.
  function releaseAll() { for (const c of pool) { c.width = 0; c.height = 0; } pool.length = 0; }
  function persistent(fn) { keep = true; try { return fn(); } finally { keep = false; } }
  function poolSize() { let px = 0, minD = 0; for (const c of pool) { px += c.width * c.height; if (c.__d && (!minD || c.__d < minD)) minD = c.__d; } return { layers: pool.length, megapixels: +(px / 1e6).toFixed(1), minD: +minD.toFixed(2) }; }
  function blit(ctx, l, x, y) { ctx.drawImage(l.c, x, y, l.w, l.h); }
  // Рисует слой так, чтобы его левый край был в экранной точке sx (вид: 0..viewW); только видимая часть.
  // Мир кончается на краю слоя, а на экране с вырезом камера ставит край мира на границу безопасного поля (Camera.setPad): между краем слоя и краем экрана остаётся полоса шириной в поле
  // (владелец 27.10.2026, iPhone: «слева на экране просто полоска обрезанная» — там была плоская заливка, а комнату и растение на самом краю обрезало). Полоса дозаполняется зеркальным
  // продолжением слоя: пол, стена, плинтус и узор идут дальше без шва, а то, что стояло на самом краю (растение, колонна), даёт симметричную пару. Слой шире полосы — иначе остаток не закрывается.
  function blitView(ctx, l, sx, sy, viewW) {
    const s = l.c.width / l.w;
    const x0 = Math.max(0, -sx), x1 = Math.min(l.w, viewW - sx);
    if (x1 > x0) ctx.drawImage(l.c, x0 * s, 0, (x1 - x0) * s, l.c.height, sx + x0, sy, x1 - x0, l.h);
    if (sx > 0) mirrorEdge(ctx, l, s, sx, sy, Math.min(sx, l.w), -1);
    const rx = sx + l.w;
    if (rx < viewW) mirrorEdge(ctx, l, s, rx, sy, Math.min(viewW - rx, l.w), 1);
  }
  // Зеркальная копия края слоя шириной w юнитов по ту сторону границы edge (dir −1 — слева от неё, 1 — справа)
  function mirrorEdge(ctx, l, s, edge, sy, w, dir) {
    if (!(w > 0.01)) return;
    ctx.save();
    ctx.translate(edge, 0); ctx.scale(-1, 1);
    if (dir < 0) ctx.drawImage(l.c, 0, 0, w * s, l.c.height, 0, sy, w, l.h);
    else ctx.drawImage(l.c, (l.w - w) * s, 0, w * s, l.c.height, -w, sy, w, l.h);
    ctx.restore();
  }

  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  // Прямоугольник с контуром, бликом сверху и тенью снизу.
  function box(ctx, x, y, w, h, o) {
    o = o || {};
    const lw = o.lw === undefined ? 3 : o.lw, r = o.r || 0;
    if (r) rrPath(ctx, x, y, w, h, r); else { ctx.beginPath(); ctx.rect(x, y, w, h); }
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.hi) { ctx.fillStyle = o.hi; ctx.fillRect(x + lw / 2, y + lw / 2, w - lw, Math.min(o.hiH || 4, h / 2)); }
    if (o.lo) { const lh = Math.min(o.loH || 5, h / 2); ctx.fillStyle = o.lo; ctx.fillRect(x + lw / 2, y + h - lh - lw / 2, w - lw, lh); }
    if (lw) { if (r) rrPath(ctx, x, y, w, h, r); else { ctx.beginPath(); ctx.rect(x, y, w, h); } ctx.lineWidth = lw; ctx.strokeStyle = o.stroke || OUT; ctx.lineJoin = 'round'; ctx.stroke(); }
  }

  function gradV(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  function gradH(ctx, x, y, w, h, stops) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }

  // Градиент как стиль заливки (для заливки произвольного контура): stops — [[t, цвет], ...].
  function linG(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    return g;
  }

  function rng(seed) { return new Ale.Rng(seed); }

  // Дощатый пол/панель: горизонтальные доски со швами и «сучками».
  function planks(ctx, x, y, w, h, o) {
    o = o || {};
    const R = rng(o.seed || 5), ph = o.plankH || 22;
    ctx.fillStyle = o.base || '#a86f45'; ctx.fillRect(x, y, w, h);
    for (let py = y, i = 0; py < y + h; py += ph, i++) {
      ctx.fillStyle = i % 2 ? (o.alt || 'rgba(0,0,0,0.06)') : 'rgba(255,255,255,0.05)'; ctx.fillRect(x, py, w, Math.min(ph, y + h - py));
      ctx.fillStyle = o.seam || 'rgba(43,26,32,0.55)'; ctx.fillRect(x, py, w, 1.6);
      // торцевые стыки
      let jx = x + R.range(0, 160);
      while (jx < x + w) { ctx.fillRect(jx, py, 1.6, Math.min(ph, y + h - py)); jx += R.range(180, 340); }
      // сучки
      for (let k = 0; k < w / 260; k++) { if (R.chance(0.45)) { ctx.fillStyle = 'rgba(43,26,32,0.14)'; ctx.beginPath(); ctx.ellipse(x + R.range(0, w), py + ph * 0.5, R.range(4, 9), R.range(1.5, 3), 0, 0, 6.3); ctx.fill(); ctx.fillStyle = o.seam || 'rgba(43,26,32,0.55)'; } }
    }
  }

  // Кирпичная кладка.
  function bricks(ctx, x, y, w, h, o) {
    o = o || {};
    const R = rng(o.seed || 9), bw = o.bw || 46, bh = o.bh || 20;
    ctx.fillStyle = o.mortar || '#3c2b31'; ctx.fillRect(x, y, w, h);
    const cols = o.colors || ['#9a5a45', '#8b4f3f', '#a8654d', '#84493a'];
    for (let row = 0, py = y; py < y + h; row++, py += bh) {
      const off = (row % 2) * bw / 2;
      for (let px = x - off; px < x + w; px += bw) {
        const bx = Math.max(x, px + 1.5), bwid = Math.min(x + w, px + bw - 1.5) - bx;
        const byh = Math.min(bh - 3, y + h - py - 1.5);
        if (bwid <= 0 || byh <= 0) continue;
        ctx.fillStyle = cols[Math.floor(R.next() * cols.length)];
        ctx.fillRect(bx, py + 1.5, bwid, byh);
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(bx, py + 1.5, bwid, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(bx, py + 1.5 + byh - 3, bwid, 3);
      }
    }
  }

  // Шахматный пол (плоские плитки).
  function checker(ctx, x, y, w, h, tw, c1, c2) {
    for (let px = x, i = 0; px < x + w; px += tw, i++) {
      for (let py = y, j = 0; py < y + h; py += tw * 0.5, j++) {
        ctx.fillStyle = (i + j) % 2 ? c1 : c2;
        ctx.fillRect(px, py, Math.min(tw, x + w - px), Math.min(tw * 0.5, y + h - py));
      }
    }
  }

  // Мягкий луч света из окна: три вложенные трапеции с градиентом (края мягче, середина ярче).
  function beam(ctx, x0, y0, w0, x1, y1, w1, a, color) {
    const c = color || 'rgba(255,240,200,';
    for (const [k, m] of [[1, 0.36], [0.66, 0.3], [0.34, 0.3]]) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, c + (a * m * 2).toFixed(3) + ')'); g.addColorStop(1, c + '0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0 - w0 * k / 2, y0); ctx.lineTo(x0 + w0 * k / 2, y0); ctx.lineTo(x1 + w1 * k / 2, y1); ctx.lineTo(x1 - w1 * k / 2, y1); ctx.closePath(); ctx.fill();
    }
  }

  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + a + ')'); g.addColorStop(1, color + '0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }

  // Виньетка по краям кадра (рисуется в экранных координатах).
  function vignette(ctx, W, H, s) {
    const g = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.35, W / 2, H * 0.52, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(20,8,20,0)'); g.addColorStop(1, 'rgba(20,8,20,' + (s === undefined ? 0.4 : s) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Мелкий текст с обводкой (вывески).
  function text(ctx, str, x, y, size, fill, o) {
    o = o || {};
    ctx.font = (o.weight || 'bold') + ' ' + size + 'px ' + Ale.FONT;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.stroke) { ctx.lineWidth = o.lw || 4; ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }

  // Мягкая контактная тень под предметом, стоящим на линии y (эллипс, темнее в центре).
  function shadow(ctx, x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.24);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(30,14,22,' + (a === undefined ? 0.3 : a) + ')'); g.addColorStop(0.7, 'rgba(30,14,22,' + ((a === undefined ? 0.3 : a) * 0.5) + ')'); g.addColorStop(1, 'rgba(30,14,22,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); ctx.restore();
  }

  // ---------------------------------------------------------------- «живопись»: зерно, объём, материалы
  // Мелкозернистый шум кладётся поверх плоских заливок режимами overlay/soft-light — так стены и дерево перестают быть «пластиковыми».
  const noiseCache = {};
  function noiseCanvas(seed, size) {
    size = size || 128;
    const key = seed + ':' + size;
    if (noiseCache[key]) return noiseCache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), id = g.createImageData(size, size), R = rng(seed);
    for (let i = 0; i < size * size; i++) { const v = 128 + Math.round((R.next() - 0.5) * 130); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
    return (noiseCache[key] = c);
  }
  // Зерно на прямоугольнике (a — сила, mode — режим смешивания, k — размер зерна в юнитах).
  function grain(g, x, y, w, h, a, mode, seed, k) {
    const pat = g.createPattern(noiseCanvas(seed || 1), 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(k || 0.5));
    g.save(); g.globalCompositeOperation = mode || 'overlay'; g.globalAlpha = a === undefined ? 0.12 : a;
    g.fillStyle = pat; g.fillRect(x, y, w, h); g.restore();
  }
  // Зерно ТОЛЬКО по уже нарисованному (спрайты с прозрачным фоном): чёрно-белые крапинки режимом source-atop.
  function speckle(g, x, y, w, h, a, seed, k) {
    const key = 'sp:' + seed;
    if (!noiseCache[key]) {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const gg = c.getContext('2d'), id = gg.createImageData(96, 96), R = rng(seed || 1);
      for (let i = 0; i < 96 * 96; i++) { const v = R.next(); const dark = v < 0.5; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = dark ? 0 : 255; id.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255); }
      gg.putImageData(id, 0, 0); noiseCache[key] = c;
    }
    const pat = g.createPattern(noiseCache[key], 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(k || 0.5));
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a === undefined ? 0.1 : a; g.fillStyle = pat; g.fillRect(x, y, w, h); g.restore();
  }
  // Мягкая тень/свет вдоль стороны прямоугольника: side 't' | 'b' | 'l' | 'r'.
  function edge(g, x, y, w, h, side, size, color) {
    let gr;
    if (side === 't') { gr = g.createLinearGradient(0, y, 0, y + size); }
    else if (side === 'b') { gr = g.createLinearGradient(0, y + h, 0, y + h - size); }
    else if (side === 'l') { gr = g.createLinearGradient(x, 0, x + size, 0); }
    else { gr = g.createLinearGradient(x + w, 0, x + w - size, 0); }
    gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  // Пятна-«потёртости»: крупные мягкие пятна светлее/темнее основы.
  function blotches(g, x, y, w, h, n, seed, dark, light) {
    const R = rng(seed || 3);
    for (let i = 0; i < n; i++) {
      const cx = x + R.range(0, w), cy = y + R.range(0, h), r = R.range(30, 120), d = R.chance(0.5);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = d ? (dark || 'rgba(60,30,20,') : (light || 'rgba(255,240,210,');
      gr.addColorStop(0, c + R.range(0.03, 0.08).toFixed(3) + ')'); gr.addColorStop(1, c + '0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  // Штукатурка: градиент, пятна и зерно.
  function plaster(g, x, y, w, h, stops, o) {
    o = o || {};
    gradV(g, x, y, w, h, stops);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    blotches(g, x, y, w, h, Math.round(w * h / 26000), o.seed || 7, o.dark, o.light);
    grain(g, x, y, w, h, o.grain === undefined ? 0.16 : o.grain, 'overlay', o.seed || 7);
    g.restore();
  }
  // Дерево: доски с волокнами, сучками и зерном. dir: 'h' — вдоль ширины.
  function wood(g, x, y, w, h, o) {
    o = o || {};
    const R = rng(o.seed || 4), base = o.base || '#8b5a3c';
    g.fillStyle = base; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const n = Math.max(3, Math.round((o.dir === 'v' ? w : h) / (o.lineGap || 7)));
    for (let i = 0; i < n; i++) {
      const dark = R.chance(0.6);
      g.strokeStyle = dark ? 'rgba(43,22,14,' + R.range(0.05, 0.16).toFixed(3) + ')' : 'rgba(255,225,180,' + R.range(0.03, 0.09).toFixed(3) + ')';
      g.lineWidth = R.range(0.6, 1.6); g.beginPath();
      if (o.dir === 'v') { const lx = x + (i + R.next()) * (w / n); g.moveTo(lx, y); for (let t = 0; t <= 6; t++) g.lineTo(lx + Math.sin(t * 1.3 + i) * 1.6, y + t * h / 6); }
      else { const ly = y + (i + R.next()) * (h / n); g.moveTo(x, ly); for (let t = 0; t <= 8; t++) g.lineTo(x + t * w / 8, ly + Math.sin(t * 1.1 + i) * 1.4); }
      g.stroke();
    }
    if (o.knots !== false) {
      const kn = Math.round(w * h / 9000);
      for (let i = 0; i < kn; i++) {
        const kx = x + R.range(6, w - 6), ky = y + R.range(4, h - 4);
        g.strokeStyle = 'rgba(43,22,14,0.22)'; g.lineWidth = 1;
        for (let r = 0; r < 3; r++) { g.beginPath(); g.ellipse(kx, ky, (o.dir === 'v' ? 2 : 6) + r * 2.4, (o.dir === 'v' ? 6 : 2) + r * 1.6, 0, 0, 6.3); g.stroke(); }
      }
    }
    grain(g, x, y, w, h, o.grain === undefined ? 0.13 : o.grain, 'overlay', o.seed || 4);
    g.restore();
  }
  // Обои в полоску с ромбиками в широких полосах.
  function wallpaper(g, x, y, w, h, base, stripe, period, o) {
    o = o || {};
    plaster(g, x, y, w, h, [[0, base[0]], [0.6, base[1]], [1, base[2]]], { seed: o.seed || 9, grain: 0.14 });
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let px = x, i = 0; px < x + w; px += period, i++) {
      g.fillStyle = i % 2 ? stripe : 'rgba(255,255,255,0.06)'; g.fillRect(px, y, period * 0.5, h);
      if (i % 2 === 0) { g.fillStyle = o.motif || 'rgba(160,110,70,0.13)'; for (let py = y + 30; py < y + h; py += 48) { g.beginPath(); g.moveTo(px + period * 0.25, py - 6); g.lineTo(px + period * 0.25 + 5, py); g.lineTo(px + period * 0.25, py + 6); g.lineTo(px + period * 0.25 - 5, py); g.fill(); } }
    }
    g.restore();
  }
  // Пол: доски с перспективой стыков, потёртостями и бликом.
  function parquet(g, x, y, w, h, o) {
    o = o || {};
    const R = rng(o.seed || 12), ph = o.plankH || 26;
    g.fillStyle = o.base || '#b57a45'; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let py = y, i = 0; py < y + h; py += ph, i++) {
      const k = (py - y) / h;                                   // ближе к зрителю — доски шире
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,225,170,0.06)'; g.fillRect(x, py, w, Math.min(ph, y + h - py));
      g.fillStyle = 'rgba(43,22,14,0.5)'; g.fillRect(x, py, w, 1.8);
      let jx = x + R.range(0, 200);
      while (jx < x + w) { g.fillRect(jx, py, 1.8, Math.min(ph, y + h - py)); jx += R.range(160, 330) * (0.8 + k * 0.5); }
      for (let t = 0; t < w / 90; t++) { g.strokeStyle = 'rgba(43,22,14,' + R.range(0.05, 0.12).toFixed(3) + ')'; g.lineWidth = 1; const lx = x + R.range(0, w), ly = py + R.range(4, ph - 4); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + R.range(30, 120), ly + R.range(-1, 1)); g.stroke(); }
    }
    blotches(g, x, y, w, h, Math.round(w / 90), o.seed || 12, 'rgba(60,30,14,', 'rgba(255,230,180,');
    grain(g, x, y, w, h, 0.14, 'overlay', o.seed || 12);
    g.restore();
  }
  // Брусчатка: ряды округлых камней, ближе к зрителю — крупнее. o: base, seed, grass (доля травинок в швах), tone.
  function cobbles(g, x, y, w, h, o) {
    o = o || {};
    const R = rng(o.seed || 7), base = o.base || ['#8a8590', '#6f6a78'];
    gradV(g, x, y, w, h, [[0, base[0]], [1, base[1]]]);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    // o.tile — полотно стыкуется само с собой при повторе по ширине (мостовая скачки лежит плиткой в 512): в ряду целое число булыжников, а камень, перешагнувший край, рисуется и у другого края
    for (let cy = y + 2, row = 0; cy < y + h; row++) {
      const k = (cy - y) / h, sh = 9 + k * 12, sw0 = 22 + k * 30, nTile = o.tile ? Math.max(1, Math.round(w / (sw0 + 3))) : 0, sw = o.tile ? w / nTile - 3 : sw0;
      const stone = (cx, t, wf) => {
        g.fillStyle = t < 0.3 ? 'rgba(255,255,255,0.10)' : t < 0.62 ? 'rgba(0,0,0,0.11)' : t < 0.8 ? 'rgba(255,230,190,0.07)' : 'rgba(40,60,90,0.08)';
        rrPath(g, cx + 1, cy + 1, sw * wf, sh, Math.min(6, sh / 2)); g.fill();
        g.strokeStyle = 'rgba(20,16,28,0.34)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(cx + 3, cy + 2, sw * 0.5, 2);
      };
      for (let cx = x - (row % 2) * sw / 2 - (o.tile ? 0 : R.range(0, 12)); cx < x + w; cx += sw + 3) {
        const t = R.next(), wf = R.range(0.9, 1);
        stone(cx, t, wf);
        if (o.tile) { if (cx + sw * wf + 2 > x + w) stone(cx - w, t, wf); if (cx < x) stone(cx + w, t, wf); }
      }
      cy += sh + 3;
    }
    if (o.grass) for (let i = 0; i < w * o.grass; i++) { const gx = x + R.range(0, w), gy = y + R.range(2, h - 2); g.strokeStyle = 'rgba(80,140,70,0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - 2, gy - R.range(3, 7)); g.moveTo(gx, gy); g.lineTo(gx + 2, gy - R.range(4, 8)); g.stroke(); }
    grain(g, x, y, w, h, 0.14, 'overlay', o.seed || 7);
    g.restore();
  }

  // Лёгкий металлический блеск: горизонтальная полоса-градиент.
  function sheen(g, x, y, w, h, a) {
    const gr = g.createLinearGradient(x, y, x + w, y);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }

  // Нарисованная картинка (assets/images: панорамы окон, афиши) в прямоугольнике (x, y, w, h) без искажений: обрезка «по заполнению».
  // at — центр кадра по ширине картинки (0…1), top — положение по высоте при zoom > 1, zoom ≥ 1 — приближение. Возвращает false, если картинки нет.
  // Качество 'high': слой строится один раз на сцену, поэтому уменьшение в несколько раз делаем без «лесенки».
  function image(g, name, x, y, w, h, o) {
    const im = Ale.Assets && Ale.Assets.images && Ale.Assets.images[name];
    if (!im) return false;
    o = o || {};
    const z = Math.max(1, o.zoom || 1), IW = im.naturalWidth || im.width, IH = im.naturalHeight || im.height;
    let sw = IW / z, sh = IH / z;
    if (sw / sh > w / h) sw = sh * w / h; else sh = sw * h / w;            // вписать по короткой стороне, лишнее обрезать
    const sx = Math.max(0, Math.min(IW - sw, (o.at === undefined ? 0.5 : o.at) * IW - sw / 2));
    const sy = Math.max(0, Math.min(IH - sh, (o.top === undefined ? 0.5 : o.top) * (IH - sh)));
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, sx, sy, sw, sh, x, y, w, h);
    g.restore();
    return true;
  }

  Ale.Art = { image, OUT, shadow, layer, releaseAll, persistent, poolSize, blit, blitView, rrPath, box, gradV, gradH, rng, planks, bricks, checker, beam, glow, vignette, text, cobbles, grain, speckle, edge, blotches, plaster, wood, wallpaper, parquet, sheen, noiseCanvas, linG };
})();
