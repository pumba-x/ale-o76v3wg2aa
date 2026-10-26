// Оформление туннеля под почтой: кирпичный свод, трубы, фонари, вода, ящики, бочки, лестница.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;

  function pipe(g, x0, x1, y, r, col) {
    A.gradV(g, x0, y - r, x1 - x0, r * 2, [[0, 'rgba(255,255,255,0.35)'], [0.35, col], [1, 'rgba(0,0,0,0.35)']]);
    g.save(); g.beginPath(); g.rect(x0, y - r, x1 - x0, r * 2); g.clip();
    A.grain(g, x0, y - r, x1 - x0, r * 2, 0.32, 'overlay', 47 + r);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x0, y - r + 3, x1 - x0, 2.4);          // блик вдоль трубы
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0, y + r - 4, x1 - x0, 3);
    // редкие потёки ржавчины
    const R = A.rng(60 + r);
    for (let x = x0 + R.range(30, 200); x < x1; x += R.range(220, 520)) { g.fillStyle = 'rgba(150,80,30,0.22)'; g.beginPath(); g.ellipse(x, y + R.range(-r * 0.3, r * 0.5), R.range(10, 26), R.range(2.4, r * 0.5), 0, 0, 6.3); g.fill(); }
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x0, y - r, x1 - x0, r * 2);
    for (let x = x0 + 120; x < x1; x += 300) {
      A.box(g, x - 7, y - r - 5, 14, r * 2 + 10, { fill: '#7a8595', lw: 3, hi: 'rgba(255,255,255,0.3)' });
      A.grain(g, x - 6, y - r - 4, 12, r * 2 + 8, 0.3, 'overlay', 48);
      g.fillStyle = '#c4ccd8'; g.beginPath(); g.arc(x, y - r - 1, 1.8, 0, 6.3); g.arc(x, y + r + 1, 1.8, 0, 6.3); g.fill();      // болты
    }
  }

  function valve(g, x, y) {
    g.strokeStyle = '#a8762a'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 14, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.moveTo(x, y - 14); g.lineTo(x, y + 14); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, 17, 0, 6.3); g.stroke();
  }

  function lantern(g, x, y) {
    A.glow(g, x, y + 22, 170, 'rgba(255,190,100,', 0.5);
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y); g.stroke();                       // шнур идёт от самого верха кадра (потолок за ним): раньше он начинался посреди кирпичной стены на y = 60
    A.box(g, x - 13, y, 26, 34, { fill: '#2b2320', lw: 3, r: 3 });
    g.fillStyle = '#ffdd9a'; g.fillRect(x - 8, y + 6, 16, 22);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 5, y + 9, 4, 10);
    g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x, y - 12); g.lineTo(x + 17, y); g.closePath(); g.fillStyle = '#2b2320'; g.fill(); g.stroke();
  }

  function rib(g, x) {
    // каменное ребро свода: цилиндрическое освещение, тёсаные блоки с фасками, капитель и база
    const w = 52, l = x - w / 2;
    g.fillStyle = A.linG(g, l, 0, l + w, 0, [[0, '#2f292c'], [0.32, '#6a5d66'], [0.6, '#564b52'], [1, '#2a2427']]);
    g.fillRect(l, 90, w, 490);
    g.save(); g.beginPath(); g.rect(l, 90, w, 490); g.clip();
    A.grain(g, l, 90, w, 490, 0.3, 'overlay', 41 + (x % 7));
    const R = A.rng(Math.round(x));
    for (let y = 110; y < 580; y += 46) {
      g.fillStyle = 'rgba(0,0,0,0.26)'; g.fillRect(l, y, w, 3);
      g.fillStyle = 'rgba(255,240,230,0.13)'; g.fillRect(l, y + 3, w, 2);
      if (R.chance(0.5)) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(l, y + 5, w, 40); }
      if (R.chance(0.28)) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; g.beginPath(); const cx = l + R.range(6, w - 6); g.moveTo(cx, y + 8); g.lineTo(cx + R.range(-6, 6), y + 22); g.lineTo(cx + R.range(-8, 8), y + 38); g.stroke(); }     // трещинка
    }
    A.edge(g, l, 90, 16, 490, 'l', 16, 'rgba(0,0,0,0.3)'); A.edge(g, l + w - 16, 90, 16, 490, 'r', 16, 'rgba(0,0,0,0.34)');
    A.edge(g, l, 470, w, 110, 'b', 110, 'rgba(10,20,26,0.34)');                        // сырость у воды
    g.restore();
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(l, 90, w, 490);
    A.box(g, x - 34, 84, 68, 14, { fill: '#6f6465', lw: 3, hi: 'rgba(255,255,255,0.2)' }); A.box(g, x - 34, 566, 68, 14, { fill: '#5a4f52', lw: 3 });
    A.grain(g, x - 33, 85, 66, 12, 0.3, 'overlay', 43); A.grain(g, x - 33, 567, 66, 12, 0.3, 'overlay', 44);
  }

  function moss(g, W) {
    const R = A.rng(12);
    // мягкие пятна плесени и мха (радиальные, без резких краёв)
    for (let i = 0; i < W / 45; i++) {
      const x = R.range(0, W), y = R.pick([R.range(470, 576), R.range(120, 300)]), r = R.range(22, 56);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(84,138,66,' + R.range(0.2, 0.36).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(84,138,66,0)');
      g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1.6, 0.7); g.translate(-x, -y); g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.restore();
    }
    // потёки от труб: тёмные полосы, сужающиеся книзу
    for (let i = 0; i < W / 200; i++) {
      const x = R.range(0, W), h = R.range(120, 340), w0 = R.range(4, 9);
      const gr = g.createLinearGradient(0, 60, 0, 60 + h); gr.addColorStop(0, 'rgba(14,34,44,0.32)'); gr.addColorStop(1, 'rgba(14,34,44,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w0, 60); g.lineTo(x + w0, 60); g.lineTo(x + w0 * 0.3, 60 + h); g.lineTo(x - w0 * 0.3, 60 + h); g.closePath(); g.fill();
    }
  }

  // Каменные плиты пола в перспективе: три ряда, у каждой плиты своя тональность, фаски и зерно.
  function slabFloor(g, W) {
    A.gradV(g, 0, 580, W, 70, [[0, '#7d7378'], [1, '#5a5157']]);
    const R = A.rng(33);
    g.save(); g.beginPath(); g.rect(0, 580, W, 70); g.clip();
    for (let row = 0, y = 580; y < 650; row++) {
      const k = row / 3, h = 22 + row * 2;
      let x = -R.range(0, 80);
      while (x < W) {
        const sw = R.range(86, 138) * (1 + k * 0.25), t = R.next();
        g.fillStyle = t < 0.3 ? 'rgba(255,255,255,0.09)' : t < 0.6 ? 'rgba(0,0,0,0.10)' : t < 0.8 ? 'rgba(255,225,190,0.06)' : 'rgba(40,60,90,0.09)';
        g.fillRect(x + 1.5, y + 1.5, sw - 3, h - 3);
        g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 1.5, y + 1.5, sw - 3, 2.4);       // фаска сверху
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 1.5, y + h - 4, sw - 3, 2.6);              // тень снизу
        g.strokeStyle = 'rgba(20,10,20,0.55)'; g.lineWidth = 2; g.strokeRect(x, y, sw, h);
        if (R.chance(0.22)) { g.strokeStyle = 'rgba(20,10,20,0.28)'; g.lineWidth = 1; g.beginPath(); const cx = x + R.range(10, sw - 10); g.moveTo(cx, y + 4); g.lineTo(cx + R.range(-10, 10), y + h * 0.5); g.lineTo(cx + R.range(-12, 12), y + h - 3); g.stroke(); }
        x += sw;
      }
      y += h;
    }
    A.grain(g, 0, 580, W, 70, 0.26, 'overlay', 35);
    A.edge(g, 0, 580, W, 22, 't', 22, 'rgba(0,0,0,0.28)');                                       // тень от стены
    A.edge(g, 0, 620, W, 30, 'b', 30, 'rgba(10,24,32,0.28)');                                     // сырость у канавы
    g.restore();
  }

  function drawTunnel(g, W, H) {
    A.bricks(g, 0, 0, W, 590, { bw: 56, bh: 26, mortar: '#241a20', colors: ['#5c3b40', '#4e3238', '#66454c', '#54363c', '#5a4038'], seed: 4 });
    A.grain(g, 0, 0, W, 590, 0.24, 'overlay', 5);
    A.blotches(g, 0, 0, W, 590, Math.round(W / 190), 8, 'rgba(10,6,20,', 'rgba(255,196,140,');
    A.gradV(g, 0, 0, W, 590, [[0, 'rgba(12,6,24,0.72)'], [0.5, 'rgba(12,6,24,0.30)'], [1, 'rgba(12,6,24,0.5)']]);
    moss(g, W);
    for (let x = 300; x < W; x += 420) rib(g, x);
    // трубы вдоль свода
    pipe(g, 0, W, 116, 12, '#5b7185'); pipe(g, 0, W, 158, 8, '#7a5b3b');
    for (let x = 190; x < W; x += 640) valve(g, x, 116);                                      // вентили стоят в стороне от хомутов труб (хомуты — x0 + 120 + 300k)
    // вертикальные отводы: идут до плит пола и стоят у рёбер (x = 300 + 420k), а не под фонарями между ними (раньше висели на 10 юн. от фонаря и обрывались в воздухе на y = 368)
    for (let x = 372; x < W - 200; x += 840) {
      A.gradH(g, x - 7, 128, 14, 456, [[0, '#4a5c6e'], [0.5, '#7590a8'], [1, '#3a4a5a']]); g.strokeStyle = OUT; g.lineWidth = 2.5; g.strokeRect(x - 7, 128, 14, 456);
      A.box(g, x - 13, 578, 26, 9, { fill: '#7a8595', lw: 2.6, hi: 'rgba(255,255,255,0.3)' });                                 // фланец у плит
    }
    // фонари (у лестницы в конце туннеля свой луч света — фонарь там не нужен)
    for (let x = 510; x < W; x += 420) { if (x > W - 150) continue; lantern(g, x, 180 + ((x / 420) % 2) * 26); }
    // пол: плиты и водосточная канава
    slabFloor(g, W);
    A.gradV(g, 0, 650, W, 70, [[0, '#1d2f3a'], [1, '#0e1a22']]);
    const R = A.rng(30);
    // вода: тёмная гладь, мягкие блики фонарей и рябь
    for (let i = 0; i < W / 60; i++) { g.strokeStyle = 'rgba(160,200,220,' + R.range(0.1, 0.28).toFixed(2) + ')'; g.lineWidth = R.range(1.4, 2.6); const x = R.range(0, W), y = R.range(658, 714); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 2, x + R.range(24, 70), y); g.stroke(); }
    A.grain(g, 0, 650, W, 70, 0.18, 'overlay', 36);
    for (let x = 510; x < W; x += 420) { A.glow(g, x, 670, 80, 'rgba(255,190,100,', 0.22); }
    g.fillStyle = OUT; g.fillRect(0, 578, W, 3.5); g.fillRect(0, 648, W, 3);
  }

  // Ящик (сплошной блок).
  function crate(w, h, seed) {
    return A.layer(w + 8, h + 8, (g) => {
      const R = A.rng(seed || 1);
      A.box(g, 4, 4, w, h, { fill: '#9a6a44', lw: 4, hi: 'rgba(255,255,255,0.16)', lo: 'rgba(0,0,0,0.2)' });
      A.wood(g, 6, 6, w - 4, h - 4, { base: '#9a6a44', seed: (seed || 1) + 30, knots: true, grain: 0.18, lineGap: 6 });
      g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 2.6;
      for (let y = 4 + 20; y < h + 4; y += 20) { g.beginPath(); g.moveTo(4, y); g.lineTo(w + 4, y); g.stroke(); }
      // рама и диагональ
      g.strokeStyle = '#6a422c'; g.lineWidth = 8; g.strokeRect(12, 12, w - 16, h - 16);
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(8, 8, w - 8, h - 8); g.strokeRect(16, 16, w - 24, h - 24);
      g.strokeStyle = '#6a422c'; g.lineWidth = 8; g.beginPath(); g.moveTo(14, 14); g.lineTo(w - 4, h - 4); g.stroke();
      g.fillStyle = '#c9c9d0'; for (const [px, py] of [[12, 12], [w - 4, 12], [12, h - 4], [w - 4, h - 4]]) { g.beginPath(); g.arc(px, py, 2.6, 0, 6.3); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(8 + R.range(0, 20), 10, 3, h - 14);
    }, 2);
  }

  // Бочка (стоит, сбоку): платформа-ориентир.
  function barrel(w, h) {
    return A.layer(w + 8, h + 8, (g) => {
      g.beginPath(); g.moveTo(4 + w * 0.08, 4); g.quadraticCurveTo(4 - w * 0.06, 4 + h / 2, 4 + w * 0.08, 4 + h); g.lineTo(4 + w * 0.92, 4 + h); g.quadraticCurveTo(4 + w * 1.06, 4 + h / 2, 4 + w * 0.92, 4); g.closePath();
      A.gradH(g, 4, 4, w, h, [[0, '#7a4e33'], [0.35, '#b07a4c'], [0.7, '#9a6a42'], [1, '#5f3b28']]); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke();
      g.strokeStyle = 'rgba(43,26,32,0.45)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(4 + i * w / 6, 6); g.lineTo(4 + i * w / 6, h + 2); g.stroke(); }
      g.save(); g.beginPath(); g.moveTo(4 + w * 0.08, 4); g.quadraticCurveTo(4 - w * 0.06, 4 + h / 2, 4 + w * 0.08, 4 + h); g.lineTo(4 + w * 0.92, 4 + h); g.quadraticCurveTo(4 + w * 1.06, 4 + h / 2, 4 + w * 0.92, 4); g.closePath(); g.clip();
      A.grain(g, 0, 0, w + 8, h + 8, 0.3, 'overlay', 71);
      g.restore();
      for (const yy of [h * 0.18, h * 0.82]) {
        g.fillStyle = A.linG(g, 0, 4 + yy - 5, 0, 4 + yy + 5, [[0, '#6a707e'], [0.5, '#4a4f5c'], [1, '#33373f']]); g.fillRect(2, 4 + yy - 5, w + 4, 10);
        g.strokeStyle = OUT; g.lineWidth = 2.6; g.strokeRect(2, 4 + yy - 5, w + 4, 10);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(3, 4 + yy - 4, w + 2, 2);
      }
    }, 2);
  }

  // Катящаяся бочка (вид с торца, вращается).
  function wheel(r) {
    return A.layer(r * 2 + 8, r * 2 + 8, (g) => {
      const c = r + 4;
      g.beginPath(); g.arc(c, c, r, 0, 6.3); g.fillStyle = '#a56f44'; g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(43,26,32,0.6)'; g.lineWidth = 2.6;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(c + Math.cos(a) * r * 0.95, c + Math.sin(a) * r * 0.95); g.lineTo(c - Math.cos(a) * r * 0.95, c - Math.sin(a) * r * 0.95); g.stroke(); }
      g.beginPath(); g.arc(c, c, r * 0.8, 0, 6.3); g.strokeStyle = '#4a4f5c'; g.lineWidth = 7; g.stroke(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
      g.beginPath(); g.arc(c, c, r * 0.16, 0, 6.3); g.fillStyle = '#4a4f5c'; g.fill(); g.stroke();
      g.fillStyle = '#fff6e4'; g.beginPath(); g.arc(c + r * 0.45, c - r * 0.2, 3.2, 0, 6.3); g.fill();
      g.save(); g.beginPath(); g.arc(c, c, r - 2, 0, 6.3); g.clip(); A.grain(g, 0, 0, r * 2 + 8, r * 2 + 8, 0.26, 'overlay', 73); g.restore();
    }, 2);
  }

  function ladder(h) {
    return A.layer(84, h, (g) => {
      for (const x of [8, 66]) { A.box(g, x, 0, 10, h, { fill: '#8b5a3c', lw: 3, hi: 'rgba(255,255,255,0.2)' }); A.wood(g, x + 1.5, 1.5, 7, h - 3, { base: '#8b5a3c', dir: 'v', seed: x, knots: false, lineGap: 3, grain: 0.16 }); }
      for (let y = 16; y < h - 8; y += 34) { A.box(g, 12, y, 60, 9, { fill: '#a06a44', lw: 3 }); A.wood(g, 13.5, y + 1.5, 57, 6, { base: '#a06a44', seed: y, knots: false, lineGap: 3, grain: 0.14 }); }
    }, 2);
  }

  Ale.TunnelArt = { drawTunnel, crate, barrel, wheel, ladder, lantern };
})();
