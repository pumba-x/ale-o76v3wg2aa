// Достопримечательности и уличная мебель Парижа: Эйфелева башня, Триумфальная арка, Нотр-Дам, небо и облака, фонари, тумбы Морриса,
// деревья, витрины-лавки. Собираются один раз в слои-«спрайты» (см. paris_kit.js).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT, K = Ale.Paris;

  function hazeFill(g, w, h, haze, color) {
    if (!haze) return;
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(' + (color || '236,224,214') + ',' + haze + ')'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  }

  // Достопримечательности и облака — нарисованные картинки (assets/sprites: lm_tower, lm_arc, lm_nd, cloud_a…d). Каждая функция собирает слой
  // того же вида, что и прежние рисованные кодом (ширина и высота в юнитах, основание внизу), и накладывает «дымку» расстояния (haze).
  const draw = (g, s, x, y, w, h) => { g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(s.img, x, y, w, h); g.restore(); };

  // ---------------------------------------------------------------- Эйфелева башня
  // H — высота в юнитах. o: haze (0..1), hazeColor, scale (плотность слоя). Основание — на 12 юнитов выше низа слоя.
  function tower(H, o) {
    o = o || {};
    const s = Ale.Assets.sprites.lm_tower, W = Math.ceil(H * s.w / s.h);
    const L = A.layer(W, H + 24, (g) => {
      draw(g, s, 0, 12, W, H);
      hazeFill(g, W, H + 24, o.haze, o.hazeColor);
    }, o.scale || 1.25);
    L.pad = 0; return L;
  }

  // ---------------------------------------------------------------- Триумфальная арка (ширина 340 юнитов)
  function arc(o) {
    o = o || {};
    const s = Ale.Assets.sprites.lm_arc, w = 340, h = Math.round(w * s.h / s.w), S = 8, W = w + S * 2, H = h + 30;
    return A.layer(W, H, (g) => {
      draw(g, s, S, H - 8 - h, w, h);
      hazeFill(g, W, H, o.haze, o.hazeColor);
    }, o.scale || 1.0);
  }

  // ---------------------------------------------------------------- Нотр-Дам (дальний план, ширина 300 юнитов)
  function notreDame(o) {
    o = o || {};
    const s = Ale.Assets.sprites.lm_nd, W = 300, h = Math.round(W * s.h / s.w), H = h + 6;
    return A.layer(W, H, (g) => {
      draw(g, s, 0, H - h, W, h);
      hazeFill(g, W, H, o.haze, o.hazeColor);
    }, 1);
  }

  // ---------------------------------------------------------------- облака (закатные, нарисованные): четыре формы, по номеру seed
  // w — ширина в юнитах; слой без полей (края облака мягкие).
  function cloud(w, seed) {
    const s = Ale.Assets.sprites['cloud_' + 'abcd'[((seed || 1) - 1 + 4) % 4]], h = Math.round(w * s.h / s.w);
    return A.layer(w, h, (g) => draw(g, s, 0, 0, w, h), 1);
  }

  // ---------------------------------------------------------------- фонарь эпохи Второй империи
  function lamp(H, o) {
    o = o || {};
    const W = 96;
    return A.layer(W, H + 6, (g) => {
      const cx = W / 2, base = H;
      const dark = o.dark || '#22352f', mid = o.mid || '#2f4a45', hi = o.hi || '#3d5f57';
      // цоколь и колонна
      A.box(g, cx - 13, base - 30, 26, 30, { fill: mid, lw: 3, hi: 'rgba(255,255,255,0.15)' });
      A.box(g, cx - 9, base - 44, 18, 16, { fill: dark, lw: 3 });
      g.fillStyle = A.linG(g, cx - 5, 0, cx + 5, 0, [[0, dark], [0.4, hi], [1, dark]]); g.fillRect(cx - 5, base - H + 40, 10, H - 80); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx - 5, base - H + 40, 10, H - 80);
      for (let y = base - 70; y > base - H + 60; y -= 46) { A.box(g, cx - 8, y, 16, 7, { fill: mid, lw: 2.4 }); }
      // рожки
      g.strokeStyle = mid; g.lineWidth = 5; g.lineCap = 'round';
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(cx, base - H + 44); g.quadraticCurveTo(cx + s * 30, base - H + 24, cx + s * 34, base - H + 50); g.stroke();
        g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke(); g.strokeStyle = mid; g.lineWidth = 5;
        // фонарь
        A.glow(g, cx + s * 34, base - H + 66, 46, 'rgba(255,224,150,', 0.55);
        g.fillStyle = '#fff2c4'; g.fillRect(cx + s * 34 - 9, base - H + 50, 18, 26); g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(cx + s * 34 - 9, base - H + 50, 18, 26);
        g.beginPath(); g.moveTo(cx + s * 34 - 13, base - H + 50); g.lineTo(cx + s * 34, base - H + 36); g.lineTo(cx + s * 34 + 13, base - H + 50); g.closePath(); g.fillStyle = mid; g.fill(); g.stroke();
        g.strokeStyle = mid; g.lineWidth = 5;
      }
      g.beginPath(); g.arc(cx, base - H + 40, 7, 0, 6.3); g.fillStyle = mid; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.6; g.stroke();
      A.speckle(g, 0, 0, W, H + 6, 0.14, 5);
    }, 2);
  }

  // Тумба Морриса: афишная колонна.
  function morris(H) {
    const W = 92;
    return A.layer(W, H + 10, (g) => {
      const cx = W / 2, base = H + 6, bw = 60;
      A.box(g, cx - bw / 2 - 6, base - 12, bw + 12, 12, { fill: '#22352f', lw: 3 });
      g.fillStyle = A.linG(g, cx - bw / 2, 0, cx + bw / 2, 0, [[0, '#2a4a40'], [0.35, '#3f6a5c'], [1, '#1f3830']]); g.fillRect(cx - bw / 2, base - H + 34, bw, H - 46);
      // афиши
      const cols = ['#e8b34a', '#d9503a', '#f2e6cc', '#4a7ac0', '#e07a9a', '#f2e6cc'];
      const R = A.rng(9);
      for (let i = 0; i < 6; i++) { const y = base - H + 42 + i * ((H - 60) / 6); g.fillStyle = cols[i]; g.fillRect(cx - bw / 2 + 4, y, bw - 8, (H - 60) / 6 - 3); g.strokeStyle = 'rgba(43,26,32,0.5)'; g.lineWidth = 1.4; g.strokeRect(cx - bw / 2 + 4, y, bw - 8, (H - 60) / 6 - 3); g.fillStyle = 'rgba(43,26,32,0.5)'; g.fillRect(cx - bw / 2 + 10, y + 6, R.range(16, bw - 24), 3); g.fillRect(cx - bw / 2 + 10, y + 14, R.range(10, bw - 26), 2.4); }
      g.strokeStyle = OUT; g.lineWidth = 3.2; g.strokeRect(cx - bw / 2, base - H + 34, bw, H - 46);
      // купол-крыша
      g.beginPath(); g.moveTo(cx - bw / 2 - 8, base - H + 36); g.quadraticCurveTo(cx, base - H - 4, cx + bw / 2 + 8, base - H + 36); g.closePath(); g.fillStyle = '#22352f'; g.fill(); g.lineWidth = 3.2; g.stroke();
      g.fillStyle = '#c9982f'; g.beginPath(); g.arc(cx, base - H + 4, 5, 0, 6.3); g.fill(); g.stroke();
      A.speckle(g, 0, 0, W, H + 10, 0.14, 6);
    }, 2);
  }

  // Платан на тротуаре: ствол с пятнистой корой, крона из клякс, решётка у корней.
  function tree(s, seed) {
    const R = A.rng(seed || 4), W = 300 * s, H = 300 * s;      // крона шире ±135: запас, чтобы её край не срезало границей слоя
    return A.layer(W, H, (g) => {
      const cx = W / 2, base = H - 4;
      g.fillStyle = A.linG(g, cx - 10 * s, 0, cx + 10 * s, 0, [[0, '#7a6350'], [0.5, '#9a8468'], [1, '#6a5544']]);
      g.beginPath(); g.moveTo(cx - 9 * s, base); g.quadraticCurveTo(cx - 7 * s, base - 80 * s, cx - 12 * s, base - 150 * s); g.lineTo(cx + 12 * s, base - 150 * s); g.quadraticCurveTo(cx + 8 * s, base - 80 * s, cx + 9 * s, base); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(200,190,160,' + R.range(0.3, 0.55).toFixed(2) + ')'; g.beginPath(); g.ellipse(cx + R.range(-6, 6) * s, base - R.range(20, 140) * s, R.range(3, 6) * s, R.range(5, 9) * s, R.range(-0.4, 0.4), 0, 6.3); g.fill(); }
      // ветви
      g.strokeStyle = '#6a5544'; g.lineWidth = 6 * s; g.lineCap = 'round'; for (const a of [-0.9, -0.35, 0.35, 0.9]) { g.beginPath(); g.moveTo(cx, base - 132 * s); g.quadraticCurveTo(cx + Math.sin(a) * 30 * s, base - 160 * s, cx + Math.sin(a) * 66 * s, base - 190 * s); g.stroke(); }
      // крона: одна общая заливка с единым контуром, объём — светлые и тёмные «листовые» пятна внутри
      const blobs = [[0, -210, 66], [-64, -186, 52], [66, -188, 54], [-30, -244, 50], [34, -240, 48], [0, -166, 58], [-90, -160, 38], [92, -162, 40], [-58, -228, 34], [62, -226, 36]];
      g.fillStyle = OUT; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(cx + bx * s, base + by * s, br * s + 3.2, 0, 6.3); g.fill(); }
      const canopy = () => { g.beginPath(); for (const [bx, by, br] of blobs) { g.moveTo(cx + bx * s + br * s, base + by * s); g.arc(cx + bx * s, base + by * s, br * s, 0, 6.3); } };
      canopy(); g.fillStyle = A.linG(g, 0, base - 280 * s, 0, base - 110 * s, [[0, '#7dbb64'], [0.55, '#5f9a52'], [1, '#3f7a44']]); g.fill();
      g.save(); canopy(); g.clip();
      for (let i = 0; i < 46; i++) { const lx = cx + R.range(-110, 110) * s, ly = base - R.range(120, 290) * s, lr = R.range(9, 20) * s; const up = ly < base - 210 * s; g.fillStyle = up ? 'rgba(220,255,170,' + R.range(0.14, 0.3).toFixed(2) + ')' : 'rgba(20,60,30,' + R.range(0.12, 0.26).toFixed(2) + ')'; g.beginPath(); g.arc(lx, ly, lr, 0, 6.3); g.fill(); }
      g.strokeStyle = 'rgba(20,50,30,0.35)'; g.lineWidth = 1.6; for (let i = 0; i < 26; i++) { const lx = cx + R.range(-105, 105) * s, ly = base - R.range(130, 280) * s; g.beginPath(); g.arc(lx, ly, R.range(8, 14) * s, 0.2, 2.8); g.stroke(); }
      A.speckle(g, 0, 0, W, H, 0.18, 8);
      g.restore();
      // решётка у корней
      g.fillStyle = '#33333c'; g.fillRect(cx - 26 * s, base - 5, 52 * s, 6); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - 26 * s, base - 5, 52 * s, 6);
    }, 1.5);
  }

  // ---------------------------------------------------------------- лавка: крашеный фасад с вывеской, витрина, дверь
  // o: { name, w, paint, ink, goods, door: 'left' | 'right' | null, size }. Высота фиксирована (220), низ — на линии стены.
  const GOODS = {
    bread(g, x, y, w, h) {
      for (let i = 0; i < 6; i++) { g.save(); g.translate(x + 18 + i * ((w - 36) / 5), y + h - 6); g.rotate(-0.4 + i * 0.16); g.fillStyle = '#d9a25a'; g.fillRect(-5, -h * 0.8, 10, h * 0.8); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-5, -h * 0.8, 10, h * 0.8); g.strokeStyle = 'rgba(120,70,30,0.7)'; g.lineWidth = 1.4; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-5, -h * 0.8 + k * 12); g.lineTo(5, -h * 0.8 + k * 12 + 4); g.stroke(); } g.restore(); }
      g.fillStyle = '#e8b56a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + 26 + i * 30, y + h - 10, 12, 8, 0.2, 0, 6.3); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
    },
    flowers(g, x, y, w, h) {
      const c = ['#e35a6b', '#f4b942', '#fff6e4', '#c86ad6', '#7ac0e8'];
      for (let i = 0; i < 5; i++) { const bx = x + 20 + i * ((w - 40) / 4); g.fillStyle = '#7a8aa0'; g.fillRect(bx - 12, y + h - 24, 24, 24); g.strokeStyle = OUT; g.lineWidth = 2.2; g.strokeRect(bx - 12, y + h - 24, 24, 24);
        for (let k = 0; k < 4; k++) { g.strokeStyle = '#4f8a4b'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx, y + h - 24); g.lineTo(bx - 10 + k * 7, y + h - 54 - (k % 2) * 8); g.stroke(); g.fillStyle = c[(i + k) % 5]; g.beginPath(); g.arc(bx - 10 + k * 7, y + h - 56 - (k % 2) * 8, 6, 0, 6.3); g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke(); } }
    },
    books(g, x, y, w, h) {
      const c = ['#7a2e3b', '#2f6f73', '#d9a441', '#3d5a80', '#5a7a4a', '#c8593a'], R = A.rng(6);
      for (let row = 0; row < 2; row++) { g.fillStyle = '#7a5a3a'; g.fillRect(x + 4, y + 30 + row * (h * 0.46), w - 8, 5); let bx = x + 8; while (bx < x + w - 16) { const bw = R.range(7, 13), bh = R.range(24, 40); g.fillStyle = c[Math.floor(R.next() * 6)]; g.fillRect(bx, y + 30 + row * (h * 0.46) - bh, bw, bh); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(bx, y + 30 + row * (h * 0.46) - bh, bw, bh); bx += bw + 1; } }
    },
    cheese(g, x, y, w, h) {
      for (let i = 0; i < 4; i++) { const bx = x + 22 + i * ((w - 44) / 3), by = y + h - 14 - (i % 2) * 22; g.fillStyle = i % 2 ? '#f2d060' : '#f8e28a'; g.beginPath(); g.ellipse(bx, by, 20, 12, 0, 0, 6.3); g.fill(); g.fillRect(bx - 20, by, 40, 12); g.beginPath(); g.ellipse(bx, by + 12, 20, 12, 0, 0, Math.PI); g.fill(); g.lineWidth = 2.2; g.strokeStyle = OUT; g.beginPath(); g.ellipse(bx, by, 20, 12, 0, 0, 6.3); g.stroke(); g.strokeRect(bx - 20, by, 40, 12); g.fillStyle = 'rgba(160,110,20,0.45)'; g.beginPath(); g.arc(bx - 6, by - 2, 3, 0, 6.3); g.arc(bx + 7, by + 1, 2.4, 0, 6.3); g.fill(); }
    },
    hats(g, x, y, w, h) {
      const c = ['#7a2e3b', '#2b3a55', '#e0c9a0', '#3f6a5c'];
      for (let i = 0; i < 4; i++) { const bx = x + 26 + i * ((w - 52) / 3), by = y + h - 26 - (i % 2) * 24; g.fillStyle = '#7a5a3a'; g.fillRect(bx - 2, by + 4, 4, 26); g.fillStyle = c[i]; g.beginPath(); g.ellipse(bx, by, 22, 6, 0, 0, 6.3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(bx - 12, by); g.quadraticCurveTo(bx - 12, by - 22, bx, by - 22); g.quadraticCurveTo(bx + 12, by - 22, bx + 12, by); g.fill(); g.stroke(); g.fillStyle = '#d9a441'; g.fillRect(bx - 12, by - 6, 24, 4); }
    },
    bottles(g, x, y, w, h) {
      const c = ['#2f6f73', '#7a2e3b', '#c9982f', '#5a7a4a'];
      for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++) { const bx = x + 14 + i * ((w - 28) / 6), by = y + 34 + row * (h * 0.44); g.fillStyle = c[(i + row) % 4]; g.fillRect(bx - 5, by - 22, 10, 24); g.fillRect(bx - 2.5, by - 32, 5, 12); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(bx - 5, by - 22, 10, 24); g.strokeRect(bx - 2.5, by - 32, 5, 12); }
    },
    poste(g, x, y, w, h) {
      const R = A.rng(5);
      for (let i = 0; i < 3; i++) { const bx = x + 16 + i * 44, bw = 34, bh = 26 + (i % 2) * 8; g.fillStyle = '#c9a06a'; g.fillRect(bx, y + h - bh, bw, bh); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(bx, y + h - bh, bw, bh); g.strokeStyle = '#7a5a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx + bw / 2, y + h - bh); g.lineTo(bx + bw / 2, y + h); g.stroke(); }
      for (let i = 0; i < 6; i++) { g.save(); g.translate(x + w - 30 - (i % 3) * 38, y + 40 + Math.floor(i / 3) * 34); g.rotate(R.range(-0.2, 0.2)); g.fillStyle = '#fff6e4'; g.fillRect(-15, -10, 30, 20); g.strokeStyle = OUT; g.lineWidth = 1.8; g.strokeRect(-15, -10, 30, 20); g.beginPath(); g.moveTo(-15, -10); g.lineTo(0, 2); g.lineTo(15, -10); g.stroke(); g.restore(); }
    },
    cafe(g, x, y, w, h) {
      for (let i = 0; i < 2; i++) { const bx = x + 40 + i * ((w - 80)); g.fillStyle = '#e9d6b0'; g.beginPath(); g.ellipse(bx, y + h - 26, 24, 7, 0, 0, 6.3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.fillStyle = '#2b3a3a'; g.fillRect(bx - 2, y + h - 26, 4, 26); g.fillStyle = '#fff'; g.fillRect(bx - 5, y + h - 40, 10, 12); g.strokeRect(bx - 5, y + h - 40, 10, 12); }
      g.fillStyle = 'rgba(255,224,150,0.5)'; g.beginPath(); g.arc(x + w / 2, y + 22, 26, 0, 6.3); g.fill(); g.fillStyle = '#fff2c4'; g.fillRect(x + w / 2 - 7, y + 14, 14, 20); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(x + w / 2 - 7, y + 14, 14, 20);
    },
  };

  function shop(o) {
    const w = o.w, h = 220, R = A.rng(o.seed || 3), paint = o.paint || '#2f6f73', ink = o.ink || '#f6e6b8';
    return A.layer(w + 16, h + 34, (g) => {
      g.translate(8, 30);
      const base = h;
      // стена лавки между пилястрами
      A.plaster(g, 0, 40, w, h - 40, [[0, K.STONES[1]], [1, '#d9c8a2']], { seed: (o.seed || 3) + 1, grain: 0.13 });
      // карниз с зубчиками
      A.box(g, -8, 0, w + 16, 16, { fill: '#f0e2c6', lw: 3, hi: 'rgba(255,255,255,0.4)' });
      g.fillStyle = 'rgba(80,55,35,0.28)'; for (let x = -4; x < w + 4; x += 10) g.fillRect(x, 12, 6, 7);
      // вывеска (крашеное дерево с золотым кантом и надписью)
      A.wood(g, 6, 20, w - 12, 44, { base: paint, seed: (o.seed || 3) + 5, knots: false, grain: 0.14, dir: 'h', lineGap: 9 });
      g.strokeStyle = OUT; g.lineWidth = 3.4; g.strokeRect(6, 20, w - 12, 44);
      g.strokeStyle = '#d9a441'; g.lineWidth = 2; g.strokeRect(11, 25, w - 22, 34);
      A.text(g, o.name, w / 2, 43, o.size || 24, ink, { stroke: 'rgba(30,18,20,0.55)', lw: 3 });
      A.edge(g, 6, 20, w - 12, 44, 'b', 14, 'rgba(0,0,0,0.25)');
      // пилястры
      for (const px of [0, w - 16]) { A.box(g, px, 40, 16, base - 40, { fill: '#f0e4c8', lw: 3, hi: 'rgba(255,255,255,0.4)' }); g.strokeStyle = 'rgba(43,26,32,0.22)'; g.lineWidth = 1.4; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(px + i * 5, 46); g.lineTo(px + i * 5, base - 8); g.stroke(); } }
      // витрина и дверь
      const dw = o.door ? 66 : 0, wx = o.door === 'left' ? 22 + dw : 22, ww = w - 44 - dw, wy = 76, wh = base - 76 - 22;
      A.wood(g, wx - 4, wy - 4, ww + 8, wh + 8, { base: paint, seed: (o.seed || 3) + 8, knots: false, grain: 0.14 }); g.strokeStyle = OUT; g.lineWidth = 3.2; g.strokeRect(wx - 4, wy - 4, ww + 8, wh + 8);
      g.fillStyle = A.linG(g, 0, wy, 0, wy + wh, [[0, '#6f97ad'], [1, '#cfe3e6']]); g.fillRect(wx, wy, ww, wh);
      if (GOODS[o.goods]) { g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip(); g.fillStyle = 'rgba(40,30,30,0.16)'; g.fillRect(wx, wy, ww, wh); GOODS[o.goods](g, wx, wy, ww, wh); g.restore(); }
      g.fillStyle = 'rgba(255,255,255,0.24)'; g.beginPath(); g.moveTo(wx + 14, wy); g.lineTo(wx + 52, wy); g.lineTo(wx + 18, wy + wh); g.lineTo(wx + 2, wy + wh); g.fill();
      g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(wx, wy, ww, wh);
      A.edge(g, wx, wy, ww, wh, 't', 10, 'rgba(0,0,0,0.3)');
      // подоконная панель
      A.box(g, wx - 4, wy + wh + 4, ww + 8, 18, { fill: paint, lw: 3, hi: 'rgba(255,255,255,0.2)' });
      if (o.door) {
        const dx = o.door === 'left' ? 20 : w - 20 - dw;
        A.box(g, dx, 76, dw, base - 76, { fill: paint, lw: 3.4 }); A.wood(g, dx + 2, 78, dw - 4, base - 80, { base: paint, seed: (o.seed || 3) + 12, dir: 'v', knots: false, grain: 0.14 });
        g.fillStyle = A.linG(g, 0, 84, 0, 84 + 80, [[0, '#6f97ad'], [1, '#cfe3e6']]); g.fillRect(dx + 8, 86, dw - 16, 78); g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(dx + 8, 86, dw - 16, 78);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(dx + 10, 164); g.lineTo(dx + 34, 86); g.lineTo(dx + 44, 86); g.lineTo(dx + 20, 164); g.fill();
        A.box(g, dx + 8, 172, dw - 16, base - 176, { fill: 'rgba(0,0,0,0.16)', lw: 2.4 });
        g.fillStyle = '#d9a441'; g.beginPath(); g.arc(o.door === 'left' ? dx + dw - 12 : dx + 12, 156, 4.5, 0, 6.3); g.fill(); g.lineWidth = 1.8; g.stroke();
      }
      // тёмный низ и общий контур
      A.edge(g, 0, base - 26, w, 26, 'b', 26, 'rgba(50,30,20,0.28)');
      g.strokeStyle = OUT; g.lineWidth = 3.4; g.strokeRect(0, 40, w, base - 40);
    }, 1.5);
  }

  Object.assign(K, { tower, arc, notreDame, cloud, lamp, morris, tree, hazeFill, shop });
})();
