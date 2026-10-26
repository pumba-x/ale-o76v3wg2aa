// Оформление главного зала ASSAS: известняковые блоки, высокие окна с видом на парижские крыши, каннелированные пилястры, знамёна,
// дубовые панели, доска с меловой пылью, мраморный пол с прожилками и ковровая дорожка.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;

  function arch(g, x, y, w, h) {
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  }

  // ---------------------------------------------------------------- вид из окна: небо, дальние крыши Парижа, иногда башня
  function skyline(g, x, y, w, h, kind, seed) {
    const R = A.rng(seed);
    A.gradV(g, x, y, w, h, [[0, '#7fb6e0'], [0.55, '#bfe0ee'], [1, '#f7efd6']]);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.28, 30, 9, 0, 0, 6.3); g.ellipse(x + w * 0.46, y + h * 0.25, 22, 8, 0, 0, 6.3); g.ellipse(x + w * 0.66, y + h * 0.4, 26, 7, 0, 0, 6.3); g.fill();
    if (kind === 1) {
      const T = Ale.Paris.tower(h * 0.7, { haze: 0.62, hazeColor: '214,226,240' });
      g.drawImage(T.c, x + w * 0.5 - T.w / 2, y + h * 0.92 - T.h, T.w, T.h);
    }
    // два ряда крыш: дальние светлее
    for (const [row, col, hi, base, hh] of [[0, '#b9b4cc', '#d2cee2', 0.86, 46], [1, '#8e88a8', '#a7a1c0', 0.94, 40]]) {
      let px = x - 6 + R.range(0, 10);
      while (px < x + w) {
        const bw = R.range(22, 44), bh = R.range(hh * 0.5, hh);
        const by = y + h * base - bh;
        g.fillStyle = col; g.fillRect(px, by, bw, y + h - by);
        g.beginPath(); g.moveTo(px - 2, by); g.lineTo(px + 5, by - 9); g.lineTo(px + bw - 5, by - 9); g.lineTo(px + bw + 2, by); g.closePath(); g.fill();
        g.fillStyle = hi; g.fillRect(px + bw * 0.62, by - 15, 5, 8);                        // труба
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(px, by, 3, y + h - by);
        if (R.chance(0.6)) { g.fillStyle = 'rgba(255,236,170,0.55)'; g.fillRect(px + bw * 0.3, by + bh * 0.3, 4, 5); }
        px += bw + R.range(0, 4);
      }
    }
  }

  function hallWindow(g, cx, y, w, h, kind, seed) {
    const x = cx - w / 2;
    // наличник: светлый камень с фаской
    arch(g, x - 14, y - 14, w + 28, h + 14); g.fillStyle = '#eadfc4'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.save(); arch(g, x - 14, y - 14, w + 28, h + 14); g.clip(); A.grain(g, x - 14, y - 14, w + 28, h + 14, 0.2, 'overlay', seed + 2); A.edge(g, x - 14, y - 14, 10, h + 14, 'l', 10, 'rgba(255,255,255,0.35)'); A.edge(g, x + w + 4, y - 14, 10, h + 14, 'r', 10, 'rgba(80,60,30,0.22)'); g.restore();
    // стекло: вид на город
    g.save(); arch(g, x, y, w, h); g.clip();
    // вид на город: нарисованная панорама (каждое окно — свой участок: башня, купол, собор)
    if (!A.image(g, 'view_paris_day', x, y, w, h, { at: [0.2, 0.69, 0.93][Math.max(0, Math.min(2, Math.round((cx - 330) / 430)))], zoom: 1.05, top: 0.3 })) skyline(g, x, y, w, h, kind, seed);
    // блик на стекле
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x + w * 0.1, y + h); g.lineTo(x + w * 0.42, y + h); g.lineTo(x + w * 0.78, y); g.lineTo(x + w * 0.46, y); g.closePath(); g.fill();
    g.restore();
    // переплёт
    g.strokeStyle = '#efe4cb'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx, y + h); g.moveTo(x, y + h * 0.36); g.lineTo(x + w, y + h * 0.36); g.moveTo(x, y + h * 0.7); g.lineTo(x + w, y + h * 0.7); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    arch(g, x, y, w, h); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    // подоконник
    A.box(g, x - 24, y + h + 2, w + 48, 14, { fill: '#e6d8b8', lw: 3, hi: 'rgba(255,255,255,0.45)', lo: 'rgba(60,40,20,0.2)' });
    A.grain(g, x - 22, y + h + 4, w + 44, 10, 0.2, 'overlay', seed + 5);
    // замковый камень
    g.fillStyle = '#e6d8b8'; g.beginPath(); g.moveTo(cx - 13, y - 14); g.lineTo(cx + 13, y - 14); g.lineTo(cx + 9, y - 38); g.lineTo(cx - 9, y - 38); g.closePath(); g.fill(); g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(cx - 8, y - 36, 4, 20);
  }

  // Каннелированная пилястра: цилиндрическое освещение, канелюры, капитель и база.
  function pilaster(g, cx, top, bottom) {
    const w = 46, x = cx - w / 2, h = bottom - top;
    g.fillStyle = A.linG(g, x, 0, x + w, 0, [[0, '#cbbb98'], [0.28, '#f2e8d0'], [0.55, '#e8dcc0'], [1, '#c2b08a']]);
    g.fillRect(x, top, w, h);
    g.save(); g.beginPath(); g.rect(x, top, w, h); g.clip();
    A.grain(g, x, top, w, h, 0.18, 'overlay', 41);
    for (let i = 1; i < 6; i++) { const fx = x + i * (w / 6); g.fillStyle = 'rgba(70,50,20,0.16)'; g.fillRect(fx, top + 4, 2.2, h - 8); g.fillStyle = 'rgba(255,255,245,0.32)'; g.fillRect(fx + 2.2, top + 4, 1.4, h - 8); }
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, top, w, h);
    // капитель
    A.box(g, x - 9, top - 8, w + 18, 14, { fill: '#f4ead4', lw: 3, hi: 'rgba(255,255,255,0.5)', lo: 'rgba(60,40,20,0.16)' });
    A.box(g, x - 5, top + 6, w + 10, 8, { fill: '#e6d8b8', lw: 2.6 });
    // база
    A.box(g, x - 9, bottom - 12, w + 18, 14, { fill: '#e6d6b0', lw: 3, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(60,40,20,0.2)' });
    A.grain(g, x - 8, bottom - 11, w + 16, 12, 0.18, 'overlay', 44);
  }

  // Тканое знамя с бахромой.
  function banner(g, cx, top) {
    const p = () => { g.beginPath(); g.moveTo(cx - 22, top); g.lineTo(cx + 22, top); g.lineTo(cx + 22, top + 130); g.lineTo(cx, top + 108); g.lineTo(cx - 22, top + 130); g.closePath(); };
    p(); g.fillStyle = A.linG(g, cx - 22, 0, cx + 22, 0, [[0, '#6a2431'], [0.4, '#88323f'], [1, '#5c1f2b']]); g.fill();
    g.save(); p(); g.clip();
    for (let y = top + 3; y < top + 130; y += 4) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(cx - 22, y, 44, 1.2); }
    A.grain(g, cx - 22, top, 44, 130, 0.22, 'overlay', 47);
    g.strokeStyle = '#d9a441'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 17, top + 12); g.lineTo(cx - 17, top + 118); g.moveTo(cx + 17, top + 12); g.lineTo(cx + 17, top + 118); g.stroke();
    g.restore();
    p(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#d9a441'; g.fillRect(cx - 22, top, 44, 8); g.strokeRect(cx - 22, top, 44, 8);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - 21, top + 1.5, 42, 2);
    A.text(g, 'A', cx, top + 52, 34, '#d9a441', { stroke: '#4a1a24', lw: 4 });
    // кисточка
    g.fillStyle = '#d9a441'; g.beginPath(); g.arc(cx, top + 116, 3.2, 0, 6.3); g.fill(); g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
  }

  function clock(g, cx, cy, r) {
    g.beginPath(); g.arc(cx, cy, r + 10, 0, 6.3); g.fillStyle = A.linG(g, cx - r, cy - r, cx + r, cy + r, [[0, '#d9b45a'], [0.5, '#b48a3a'], [1, '#8a6626']]); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fillStyle = '#fff6e4'; g.fill(); g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(cx - r * 0.3, cy - r * 0.4, r * 0.5, r * 0.22, -0.5, 0, 6.3); g.fill();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.strokeStyle = OUT; g.lineWidth = i % 3 ? 2 : 4; g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4)); g.lineTo(cx + Math.sin(a) * (r - (i % 3 ? 9 : 14)), cy - Math.cos(a) * (r - (i % 3 ? 9 : 14))); g.stroke(); }
    g.lineCap = 'round'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(2.9) * r * 0.5, cy - Math.cos(2.9) * r * 0.5); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(0.5) * r * 0.78, cy - Math.cos(0.5) * r * 0.78); g.stroke(); g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fillStyle = OUT; g.fill();
  }

  function chandelier(g, cx, y) {
    const hy = y - 20;                                                                       // ступица: шнур кончается на ней, а от неё две цепочки идут к кольцу (раньше шнур упирался в пламя средней свечи)
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, 58); g.lineTo(cx, hy); g.stroke();
    A.glow(g, cx, y + 26, 240, 'rgba(255,214,140,', 0.34);
    g.strokeStyle = '#8a6626'; g.lineWidth = 8; g.beginPath(); g.ellipse(cx, y + 22, 74, 16, 0, 0, 6.3); g.stroke();
    g.strokeStyle = '#d9b45a'; g.lineWidth = 4.4; g.beginPath(); g.ellipse(cx, y + 22, 74, 16, 0, 0.15, Math.PI - 0.15); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, y + 22, 78, 19, 0, 0, 6.3); g.stroke();
    g.lineCap = 'round'; for (const dx of [-72, 72]) { g.strokeStyle = OUT; g.lineWidth = 4.6; g.beginPath(); g.moveTo(cx, hy + 2); g.lineTo(cx + dx, y + 20); g.stroke(); g.strokeStyle = '#d9b45a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx, hy + 2); g.lineTo(cx + dx, y + 20); g.stroke(); }
    g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(cx, hy, 5.5, 0, 6.3); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); g.lineCap = 'butt';
    for (let i = -3; i <= 3; i++) {
      const px = cx + i * 22, py = y + 22 + Math.sqrt(Math.max(0, 1 - (i * 22 / 74) ** 2)) * 16 * 0.4;
      g.fillStyle = '#fff6e4'; g.fillRect(px - 3, py - 22, 6, 22); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(px - 3, py - 22, 6, 22);
      A.glow(g, px, py - 27, 16, 'rgba(255,220,140,', 0.5);
      g.fillStyle = '#ffd98a'; g.beginPath(); g.ellipse(px, py - 26, 4, 7, 0, 0, 6.3); g.fill();
      g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(px, py - 25, 1.8, 3.6, 0, 0, 6.3); g.fill();
    }
  }

  // Доска: деревянная рама, меловая поверхность с разводами от тряпки, надпись, мелок и тряпка.
  function blackboard(g, x, y, w, h) {
    A.box(g, x - 14, y - 14, w + 28, h + 28, { fill: '#6a422c', lw: 4, hi: 'rgba(255,255,255,0.18)', lo: 'rgba(0,0,0,0.2)' });
    A.wood(g, x - 12, y - 12, w + 24, h + 24, { base: '#6a422c', seed: 55, knots: false, grain: 0.16 });
    A.gradV(g, x, y, w, h, [[0, '#2f4a45'], [1, '#26403b']]);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    A.grain(g, x, y, w, h, 0.3, 'overlay', 61);
    // разводы тряпки
    const R = A.rng(63);
    for (let i = 0; i < 9; i++) { const sx = x + R.range(20, w - 60), sy = y + R.range(10, h - 20); g.strokeStyle = 'rgba(235,240,232,' + R.range(0.03, 0.08).toFixed(3) + ')'; g.lineWidth = R.range(10, 22); g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + R.range(20, 60), sy + R.range(-14, 14), sx + R.range(60, 130), sy + R.range(-8, 8)); g.stroke(); }
    g.lineCap = 'butt';
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, y, w, h);
    // надпись мелом: всё по-французски, каждая строка сжимается, чтобы не выйти за рамку; лёгкая меловая зернистость — вторым слоем
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const chalk = (str, cy, size, alpha, maxW) => {
      let sz = size; g.font = 'bold ' + sz + 'px ' + Ale.FONT;
      while (g.measureText(str).width > maxW && sz > 12) { sz -= 0.5; g.font = 'bold ' + sz + 'px ' + Ale.FONT; }
      g.fillStyle = 'rgba(255,255,255,' + alpha + ')'; g.fillText(str, x + w / 2, cy);
      g.fillStyle = 'rgba(255,255,255,' + (alpha * 0.35).toFixed(2) + ')'; g.fillText(str, x + w / 2 + 0.7, cy + 0.5);
    };
    chalk('Leçon 1', y + 38, 36, 0.9, w - 56);
    chalk('Introduction au droit', y + 74, 23, 0.85, w - 44);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 36, y + 96); g.lineTo(x + w - 36, y + 96); g.stroke();
    chalk('§1. Retard ≠ argument', y + 128, 22, 0.72, w - 44);
    chalk('§2. Tomate ≠ argument', y + 160, 22, 0.72, w - 44);
    // лоток: мелок и тряпка
    A.box(g, x - 14, y + h + 12, w + 28, 9, { fill: '#7a4e33', lw: 3, hi: 'rgba(255,255,255,0.2)' });
    g.fillStyle = '#fff6e4'; g.fillRect(x + 20, y + h + 3, 26, 7); g.lineWidth = 1.6; g.strokeStyle = OUT; g.strokeRect(x + 20, y + h + 3, 26, 7);
    g.fillStyle = '#c9975a'; g.fillRect(x + w - 60, y + h - 1, 38, 12); g.strokeRect(x + w - 60, y + h - 1, 38, 12);
    g.fillStyle = 'rgba(80,50,20,0.25)'; g.fillRect(x + w - 60, y + h + 6, 38, 5);
  }

  // Мраморный бюст на постаменте (v — вариант: 0 борода, 1 венок).
  function bust(g, x, baseY, v) {
    const ped = () => { g.beginPath(); g.rect(x - 28, baseY - 66, 56, 66); };
    A.box(g, x - 28, baseY - 66, 56, 66, { fill: '#e6d8b8', lw: 3.5, hi: 'rgba(255,255,255,0.4)', lo: 'rgba(0,0,0,0.12)' });
    g.save(); ped(); g.clip(); A.grain(g, x - 28, baseY - 66, 56, 66, 0.2, 'overlay', 71); A.edge(g, x - 28, baseY - 66, 12, 66, 'l', 12, 'rgba(255,255,255,0.3)'); A.edge(g, x + 16, baseY - 66, 12, 66, 'r', 12, 'rgba(80,60,30,0.18)'); g.restore();
    A.box(g, x - 34, baseY - 78, 68, 14, { fill: '#f0e4c8', lw: 3.5, hi: 'rgba(255,255,255,0.45)' });
    const stone = '#ebe4d6', shade = '#c9c0ae';
    g.lineWidth = 3; g.strokeStyle = OUT; g.lineJoin = 'round';
    // плечи и складки тоги
    g.beginPath(); g.moveTo(x - 34, baseY - 78); g.quadraticCurveTo(x - 36, baseY - 98, x - 16, baseY - 100); g.lineTo(x + 16, baseY - 100); g.quadraticCurveTo(x + 36, baseY - 98, x + 34, baseY - 78); g.closePath();
    g.fillStyle = stone; g.fill(); g.save(); g.clip(); A.grain(g, x - 40, baseY - 104, 80, 30, 0.22, 'overlay', 73); g.restore(); g.stroke();
    g.strokeStyle = 'rgba(43,26,32,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 22, baseY - 96); g.quadraticCurveTo(x - 4, baseY - 88, x + 20, baseY - 80); g.moveTo(x - 14, baseY - 98); g.quadraticCurveTo(x, baseY - 92, x + 12, baseY - 84); g.stroke();
    // шея и голова
    g.lineWidth = 3; g.strokeStyle = OUT;
    g.fillStyle = shade; g.fillRect(x - 9, baseY - 108, 18, 12); g.strokeRect(x - 9, baseY - 108, 18, 12);
    g.beginPath(); g.ellipse(x, baseY - 128, 21, 26, 0, 0, 6.3); g.fillStyle = stone; g.fill();
    g.save(); g.clip(); A.grain(g, x - 24, baseY - 156, 48, 56, 0.22, 'overlay', 75); A.edge(g, x - 24, baseY - 156, 16, 56, 'l', 16, 'rgba(255,255,255,0.3)'); A.edge(g, x + 8, baseY - 156, 16, 56, 'r', 16, 'rgba(90,70,50,0.22)'); g.restore(); g.stroke();
    // волосы / венок
    g.fillStyle = shade;
    if (v === 1) {
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1 + i / 8); g.beginPath(); g.ellipse(x + Math.cos(a) * 21, baseY - 132 + Math.sin(a) * 22, 6, 3.4, a + 1.57, 0, 6.3); g.fillStyle = i % 2 ? '#9bb385' : '#86a172'; g.fill(); g.lineWidth = 1.6; g.stroke(); }
    } else {
      g.beginPath(); g.moveTo(x - 21, baseY - 132); g.quadraticCurveTo(x - 22, baseY - 156, x, baseY - 154); g.quadraticCurveTo(x + 22, baseY - 156, x + 21, baseY - 132); g.quadraticCurveTo(x, baseY - 142, x - 21, baseY - 132); g.fill(); g.lineWidth = 2.6; g.stroke();
      // борода
      g.beginPath(); g.moveTo(x - 17, baseY - 120); g.quadraticCurveTo(x - 20, baseY - 100, x, baseY - 102); g.quadraticCurveTo(x + 20, baseY - 100, x + 17, baseY - 120); g.quadraticCurveTo(x, baseY - 112, x - 17, baseY - 120); g.fill(); g.stroke();
    }
    // лицо: брови-выступ, глазницы, нос, рот
    g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 14, baseY - 135); g.lineTo(x - 4, baseY - 135); g.moveTo(x + 4, baseY - 135); g.lineTo(x + 14, baseY - 135); g.stroke();
    g.fillStyle = 'rgba(43,26,32,0.45)'; g.beginPath(); g.ellipse(x - 8, baseY - 130, 4, 2.6, 0, 0, 6.3); g.ellipse(x + 8, baseY - 130, 4, 2.6, 0, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(x, baseY - 132); g.lineTo(x - 3, baseY - 121); g.lineTo(x + 3, baseY - 121); g.strokeStyle = 'rgba(43,26,32,0.55)'; g.stroke();
    g.beginPath(); g.moveTo(x - 6, baseY - 113); g.lineTo(x + 6, baseY - 113); g.stroke();
  }

  // ---------------------------------------------------------------- стена, цоколь, пол
  function limestone(g, W, top, bot) {
    A.plaster(g, 0, top, W, bot - top, [[0, '#c6b899'], [0.5, '#d6c9ad'], [1, '#e0d5be']], { seed: 17, grain: 0.17, dark: 'rgba(90,70,40,', light: 'rgba(255,250,232,' });
    const R = A.rng(19);
    g.save(); g.beginPath(); g.rect(0, top, W, bot - top); g.clip();
    for (let y = 64, r = 0; y < bot; y += 40, r++) {
      for (let x = -((r % 2) * 56); x < W; x += 112) {
        const t = R.next();
        g.fillStyle = t < 0.28 ? 'rgba(255,250,232,0.10)' : t < 0.55 ? 'rgba(90,70,40,0.07)' : 'rgba(0,0,0,0)'; g.fillRect(x + 2, y + 2, 108, 36);
        g.fillStyle = 'rgba(255,255,240,0.20)'; g.fillRect(x + 2, y + 2, 108, 2); g.fillRect(x + 2, y + 2, 2, 36);       // фаска: свет сверху и слева
        g.fillStyle = 'rgba(60,40,20,0.16)'; g.fillRect(x + 2, y + 37, 108, 2); g.fillRect(x + 109, y + 2, 2, 36);       // тень снизу и справа
        if (R.chance(0.16)) { g.strokeStyle = 'rgba(70,50,30,0.16)'; g.lineWidth = 1; g.beginPath(); const sx = x + R.range(10, 90), sy = y + R.range(6, 30); g.moveTo(sx, sy); g.lineTo(sx + R.range(6, 20), sy + R.range(-4, 6)); g.lineTo(sx + R.range(18, 34), sy + R.range(-2, 10)); g.stroke(); }   // трещинка
      }
      g.fillStyle = 'rgba(43,26,32,0.13)'; g.fillRect(0, y, W, 1.6);
      for (let x = -((r % 2) * 56); x < W; x += 112) g.fillRect(x, y, 1.6, 40);
    }
    // сырость у панелей и мягкая тень под карнизом
    A.edge(g, 0, bot - 70, W, 70, 'b', 70, 'rgba(70,45,25,0.20)');
    A.edge(g, 0, top, W, 60, 't', 60, 'rgba(60,40,20,0.20)');
    g.restore();
  }

  function cornice(g, W) {
    A.plaster(g, 0, 0, W, 64, [[0, '#a99568'], [0.6, '#d0bf94'], [1, '#e6d9b4']], { seed: 23, grain: 0.18, dark: 'rgba(70,50,20,' });
    g.fillStyle = OUT; g.fillRect(0, 62, W, 3);
    for (let x = 8; x < W; x += 26) { g.fillStyle = 'rgba(80,60,30,0.32)'; g.fillRect(x, 40, 14, 14); g.fillStyle = 'rgba(255,255,240,0.28)'; g.fillRect(x, 40, 14, 2.5); }
    g.fillStyle = 'rgba(255,255,240,0.3)'; g.fillRect(0, 26, W, 2);
    g.fillStyle = 'rgba(70,50,20,0.28)'; g.fillRect(0, 30, W, 2);
  }

  function wainscot(g, W) {
    A.wood(g, 0, 430, W, 150, { base: '#6b4632', seed: 21, dir: 'v', lineGap: 9, knots: false, grain: 0.15 });
    for (let x = 0; x < W; x += 120) {
      // филёнка: рамка с фаской и вставка с волокнами
      A.box(g, x + 12, 456, 96, 100, { fill: '#5b3a28', lw: 2.4, stroke: 'rgba(30,16,12,0.9)' });
      A.wood(g, x + 18, 462, 84, 88, { base: '#61402c', seed: 22 + (x / 120), dir: 'v', lineGap: 8, knots: false, grain: 0.14 });
      g.fillStyle = 'rgba(255,225,180,0.16)'; g.fillRect(x + 18, 462, 84, 3); g.fillRect(x + 18, 462, 3, 88);
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(x + 18, 547, 84, 3); g.fillRect(x + 99, 462, 3, 88);
    }
    // поручень (планка) и плинтус
    A.box(g, -4, 420, W + 8, 16, { fill: '#a9764d', lw: 3, hi: 'rgba(255,255,255,0.3)', lo: 'rgba(0,0,0,0.2)' });
    A.wood(g, -2, 422, W + 4, 12, { base: '#a9764d', seed: 27, knots: false, grain: 0.12 });
    g.fillStyle = '#3f2a1e'; g.fillRect(0, 566, W, 14);
    A.wood(g, 0, 566, W, 14, { base: '#3f2a1e', seed: 28, knots: false, grain: 0.12 });
    g.fillStyle = OUT; g.fillRect(0, 565, W, 2);
  }

  function marbleFloor(g, W) {
    A.checker(g, 0, 580, W, 140, 78, '#ebe2d2', '#7d7180');
    g.save(); g.beginPath(); g.rect(0, 580, W, 140); g.clip();
    const R = A.rng(31);
    // прожилки мрамора
    for (let i = 0; i < W / 9; i++) {
      const x = R.range(0, W), y = R.range(580, 720);
      g.strokeStyle = 'rgba(90,80,104,' + R.range(0.05, 0.15).toFixed(3) + ')'; g.lineWidth = R.range(0.6, 1.5);
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + R.range(-14, 14), y + 4, x + R.range(14, 44), y - 5, x + R.range(30, 84), y + R.range(-7, 7)); g.stroke();
    }
    // швы плитки
    g.strokeStyle = 'rgba(43,26,32,0.20)'; g.lineWidth = 1.2;
    for (let px = 0; px < W; px += 78) { g.beginPath(); g.moveTo(px, 580); g.lineTo(px, 720); g.stroke(); }
    for (let py = 580; py < 720; py += 39) { g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke(); }
    A.grain(g, 0, 580, W, 140, 0.16, 'overlay', 33);
    // глянец: отражение панелей и общее затемнение к зрителю
    A.gradV(g, 0, 580, W, 140, [[0, 'rgba(255,255,255,0.10)'], [1, 'rgba(20,10,30,0.42)']]);
    A.gradV(g, 0, 580, W, 46, [[0, 'rgba(96,60,40,0.34)'], [1, 'rgba(96,60,40,0)']]);
    g.restore();
    g.fillStyle = OUT; g.fillRect(0, 578, W, 3.5);
  }

  function carpet(g, W) {
    const p = () => { g.beginPath(); g.moveTo(180, 616); g.lineTo(W - 180, 616); g.lineTo(W - 140, 664); g.lineTo(140, 664); g.closePath(); };
    p(); g.fillStyle = '#8f2f3b'; g.fill();
    g.save(); p(); g.clip();
    for (let x = 140; x < W - 140; x += 5) { g.fillStyle = (x / 5) % 2 ? 'rgba(0,0,0,0.07)' : 'rgba(255,200,200,0.05)'; g.fillRect(x, 616, 2.4, 50); }
    A.grain(g, 140, 616, W - 280, 50, 0.24, 'overlay', 37);
    // ромбы по центру
    g.fillStyle = 'rgba(217,164,65,0.55)';
    for (let x = 240; x < W - 220; x += 120) { g.beginPath(); g.moveTo(x, 640); g.lineTo(x + 12, 634); g.lineTo(x + 24, 640); g.lineTo(x + 12, 646); g.closePath(); g.fill(); }
    A.gradV(g, 140, 616, W - 280, 50, [[0, 'rgba(0,0,0,0.16)'], [1, 'rgba(0,0,0,0)']]);
    g.restore();
    p(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#d9a441'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(196, 623); g.lineTo(W - 196, 623); g.lineTo(W - 162, 656); g.lineTo(162, 656); g.closePath(); g.stroke();
    // бахрома по коротким краям
    g.strokeStyle = 'rgba(217,164,65,0.95)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? 180 : W - 180, x1 = s < 0 ? 140 : W - 140;
      for (let i = 0; i <= 14; i++) { const t = i / 14, px = x0 + (x1 - x0) * t, py = 616 + 48 * t; g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * 8, py + 0.8); g.stroke(); }
    }
    g.lineCap = 'butt';
  }

  function door(g, dx, dy) {
    arch(g, dx - 54, dy - 28, 108, 308); g.fillStyle = '#eadfc4'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.save(); arch(g, dx - 54, dy - 28, 108, 308); g.clip(); A.grain(g, dx - 54, dy - 28, 108, 308, 0.2, 'overlay', 81); g.restore();
    arch(g, dx - 42, dy - 16, 84, 296); g.fillStyle = '#5b3a2c'; g.fill(); g.stroke();
    g.save(); arch(g, dx - 42, dy - 16, 84, 296); g.clip(); A.wood(g, dx - 42, dy - 16, 84, 296, { base: '#5b3a2c', seed: 83, dir: 'v', lineGap: 8, knots: false, grain: 0.16 }); g.restore();
    for (const [py, ph] of [[22, 110], [142, 130]]) for (const px of [-34, 4]) { A.box(g, dx + px, dy + py, 30, ph, { fill: '#7a5038', lw: 3, hi: 'rgba(255,225,180,0.25)', lo: 'rgba(0,0,0,0.22)' }); A.wood(g, dx + px + 2, dy + py + 2, 26, ph - 4, { base: '#7a5038', seed: 85 + py, dir: 'v', lineGap: 7, knots: false, grain: 0.12 }); }
    g.fillStyle = A.linG(g, dx - 14, dy + 130, dx + 14, dy + 150, [[0, '#f0cc70'], [1, '#a87a2a']]); g.beginPath(); g.arc(dx - 8, dy + 140, 5, 0, 6.3); g.arc(dx + 8, dy + 140, 5, 0, 6.3); g.fill();
    g.lineWidth = 1.6; g.strokeStyle = OUT; g.beginPath(); g.arc(dx - 8, dy + 140, 5, 0, 6.3); g.stroke(); g.beginPath(); g.arc(dx + 8, dy + 140, 5, 0, 6.3); g.stroke();
  }

  function drawHall(g, W, H) {
    limestone(g, W, 60, 440);
    cornice(g, W);
    wainscot(g, W);
    marbleFloor(g, W);
    carpet(g, W);

    // окна (над доской окна нет: она висит на голой стене между пилястрами), лучи света на полу
    const wins = [[330, 0], [760, 1], [1190, 0]];
    for (const [cx, kind] of wins) { hallWindow(g, cx, 120, 150, 300, kind, 90 + cx); A.beam(g, cx, 430, 150, cx + 140, 578, 200, 0.20); }
    for (const cx of [545, 975, 1405, 1835]) pilaster(g, cx, 78, 578);                       // у двери пилястры нет: рама двери (x 8–116) закрывала бы левую половину её ствола
    for (const cx of [545, 975, 1405]) banner(g, cx, 96);
    clock(g, 975, 292, 42);                                                                  // ниже знамени (оно кончается на y 226): раньше часы закрывали его нижний конец и кисточку
    chandelier(g, 650, 130); chandelier(g, 1285, 130);

    // подиум с доской справа
    blackboard(g, 1470, 220, 300, 190);
    A.box(g, 1400, 548, 470, 36, { fill: '#8b5a3c', lw: 4, hi: 'rgba(255,255,255,0.25)', lo: 'rgba(0,0,0,0.2)' });
    A.wood(g, 1402, 550, 466, 32, { base: '#8b5a3c', seed: 91, knots: false, grain: 0.14 });
    A.box(g, 1392, 540, 486, 12, { fill: '#b98357', lw: 4, r: 2, hi: 'rgba(255,255,255,0.3)' });
    A.wood(g, 1394, 542, 482, 8, { base: '#b98357', seed: 92, knots: false, grain: 0.12 });
    // дверь слева (выход на улицу)
    door(g, 62, 300);
    bust(g, 430, 584, 0); bust(g, 1250, 584, 1);
    // мягкие тени у подножий пилястр и бюстов
    for (const cx of [545, 975, 1405, 1835]) A.shadow(g, cx, 582, 40, 0.22);
    for (const cx of [430, 1250]) A.shadow(g, cx, 586, 44, 0.24);
  }

  function lectureDesk() {
    return A.layer(260, 96, (g) => {
      // столешница, лицевая панель и ножки: верх столешницы = поверхность платформы
      A.box(g, 0, 0, 260, 14, { fill: '#b98357', lw: 3.5, r: 3, hi: 'rgba(255,255,255,0.32)', lo: 'rgba(0,0,0,0.18)' });
      A.wood(g, 2, 2, 256, 10, { base: '#b98357', seed: 101, knots: false, grain: 0.12 });
      A.box(g, 14, 14, 232, 38, { fill: '#8b5a3c', lw: 3.5, hi: 'rgba(255,255,255,0.12)' });
      A.wood(g, 16, 16, 228, 34, { base: '#8b5a3c', seed: 102, knots: false, grain: 0.14 });
      for (let i = 0; i < 3; i++) A.box(g, 24 + i * 74, 19, 68, 28, { fill: 'rgba(0,0,0,0.14)', lw: 2, stroke: 'rgba(43,26,32,0.7)' });
      A.box(g, 22, 52, 14, 44, { fill: '#5f3b28', lw: 3 }); A.box(g, 224, 52, 14, 44, { fill: '#5f3b28', lw: 3 });
      A.box(g, 22, 76, 216, 7, { fill: '#5f3b28', lw: 3 });
    });
  }

  function sideTable() {
    return A.layer(120, 56, (g) => {
      A.box(g, 0, 0, 120, 14, { fill: '#b98357', lw: 3.5, r: 3, hi: 'rgba(255,255,255,0.3)' });
      A.wood(g, 2, 2, 116, 10, { base: '#b98357', seed: 103, knots: false, grain: 0.12 });
      A.box(g, 10, 14, 12, 42, { fill: '#5f3b28', lw: 3 }); A.box(g, 98, 14, 12, 42, { fill: '#5f3b28', lw: 3 });
      A.box(g, 10, 36, 100, 7, { fill: '#5f3b28', lw: 2.5 });
    });
  }

  Ale.AssasArt = { drawHall, lectureDesk, sideTable, hallWindow };
})();
