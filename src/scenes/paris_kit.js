// «Набор Парижа»: османовские дома, мансарды, ажурные балконы, магазинные фасады, Эйфелева башня, Триумфальная арка,
// небо, река, уличная мебель. Всё рисуется кодом в тёплой контурной манере игры (тёмный контур + 2–3 тона + зерно).
// Дома и достопримечательности собираются в отдельные слои-«спрайты» один раз, а фон — это лишь их раскладка по слоям параллакса.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, OUT = A.OUT;

  const STONES = ['#efe0c4', '#e9d6b6', '#f2e6d0', '#e8cfc0', '#eadbbe', '#e4d8c2', '#f0e2c8'];
  const ROOFS = ['#5b6b8c', '#4d5c7e', '#6a5f80', '#586b73', '#5f6489'];
  const SHUTTERS = ['#2f6f73', '#3d5a80', '#7a2e3b', '#4d7a4d', '#3a5f6b', '#8a6a2a', '#5b4a7a'];
  const IRON = '#2b2b34';

  // ---------------------------------------------------------------- отдельные детали
  // Ажурная решётка балкона: перила, балясины и завитки.
  function rail(g, x0, x1, y, h, o) {
    o = o || {};
    g.save();
    g.strokeStyle = IRON; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.moveTo(x0, y + h); g.lineTo(x1, y + h); g.moveTo(x0, y + h * 0.5); g.lineTo(x1, y + h * 0.5); g.stroke();
    g.lineWidth = 1.6;
    for (let x = x0 + 3; x <= x1 - 2; x += 7) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); }
    // завитки между перилами
    g.lineWidth = 1.8;
    for (let x = x0 + 10; x <= x1 - 10; x += 21) { g.beginPath(); g.arc(x, y + h * 0.75, 3.6, 0, 6.3); g.stroke(); g.beginPath(); g.arc(x, y + h * 0.25, 2.4, 0, 6.3); g.stroke(); }
    if (o.plate !== false) { g.fillStyle = '#d7c6a2'; g.fillRect(x0 - 5, y + h, x1 - x0 + 10, 6); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(x0 - 5, y + h, x1 - x0 + 10, 6); }
    g.restore();
  }

  // Высокое окно: рама, стекло с бликом и (по желанию) светом, створки-ставни, сандрик над ним.
  function win(g, x, y, w, h, o) {
    o = o || {};
    const lit = !!o.lit;
    // ставни (распахнуты по бокам)
    if (o.shutter) {
      const sw = Math.max(9, w * 0.42);
      for (const side of [-1, 1]) {
        const sx = side < 0 ? x - sw - 1 : x + w + 1;
        g.fillStyle = o.shutter; g.fillRect(sx, y - 2, sw, h + 4);
        g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1.4;
        for (let yy = y + 3; yy < y + h; yy += 5) { g.beginPath(); g.moveTo(sx + 1, yy); g.lineTo(sx + sw - 1, yy); g.stroke(); }
        g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(sx, y - 2, sw, h + 4);
      }
    }
    // сандрик
    if (o.pediment === 'tri') {
      g.beginPath(); g.moveTo(x - 6, y - 4); g.lineTo(x + w / 2, y - 16); g.lineTo(x + w + 6, y - 4); g.closePath();
      g.fillStyle = '#f6ecd6'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    } else if (o.pediment === 'seg') {
      g.beginPath(); g.moveTo(x - 6, y - 4); g.quadraticCurveTo(x + w / 2, y - 22, x + w + 6, y - 4); g.closePath();
      g.fillStyle = '#f6ecd6'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    }
    // рама и стекло
    g.fillStyle = '#f6ecd6'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    const gl = lit ? [[0, '#ffe7a6'], [1, '#f2b25c']] : [[0, '#4b5d78'], [0.6, '#7b91ab'], [1, '#93a8bd']];
    g.fillStyle = A.linG(g, 0, y, 0, y + h, gl); g.fillRect(x, y, w, h);
    if (o.curtain) { g.fillStyle = 'rgba(255,246,228,0.85)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.34, y); g.quadraticCurveTo(x + w * 0.2, y + h * 0.5, x + w * 0.3, y + h); g.lineTo(x, y + h); g.fill(); g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w * 0.66, y); g.quadraticCurveTo(x + w * 0.8, y + h * 0.5, x + w * 0.7, y + h); g.lineTo(x + w, y + h); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.26)'; g.beginPath(); g.moveTo(x + 3, y + h - 2); g.lineTo(x + w * 0.45, y + 2); g.lineTo(x + w * 0.62, y + 2); g.lineTo(x + w * 0.2, y + h - 2); g.fill();
    g.strokeStyle = '#f6ecd6'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.4); g.lineTo(x + w, y + h * 0.4); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 2.2; g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    g.strokeStyle = 'rgba(43,26,32,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h * 0.4); g.lineTo(x + w, y + h * 0.4); g.stroke();
    A.edge(g, x, y, w, h, 't', 8, 'rgba(0,0,0,0.3)');
    // подоконник
    g.fillStyle = '#e4d6b8'; g.fillRect(x - 6, y + h + 3, w + 12, 5); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(x - 6, y + h + 3, w + 12, 5);
    if (o.flowers) {
      g.fillStyle = '#8a5a3a'; g.fillRect(x - 3, y + h - 7, w + 6, 10); g.strokeStyle = OUT; g.lineWidth = 1.6; g.strokeRect(x - 3, y + h - 7, w + 6, 10);
      const cols = ['#e35a6b', '#f4b942', '#fff6e4', '#c86ad6'];
      for (let i = 0; i < 5; i++) { g.fillStyle = '#4f8a4b'; g.beginPath(); g.arc(x + 2 + i * ((w - 4) / 4), y + h - 9, 4.6, 0, 6.3); g.fill(); g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(x + 2 + i * ((w - 4) / 4), y + h - 13, 3.2, 0, 6.3); g.fill(); }
    }
  }

  // Шифер/цинк: горизонтальные ряды и вертикальные швы. path() строит контур.
  function slate(g, path, color, seed, bounds) {
    const R = A.rng(seed);
    g.save(); path(); g.fillStyle = color; g.fill(); g.clip();
    const [x0, y0, x1, y1] = bounds;
    g.fillStyle = A.linG(g, 0, y0, 0, y1, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(0,0,0,0.18)']]); g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(20,24,40,0.34)'; g.lineWidth = 1.2;
    for (let y = y0 + 6, r = 0; y < y1; y += 8, r++) {
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      for (let x = x0 + (r % 2) * 7; x < x1; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); }
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,' + R.range(0.02, 0.07).toFixed(3) + ')'; g.fillRect(R.range(x0, x1), R.range(y0, y1), R.range(6, 20), 6); }
    A.grain(g, x0, y0, x1 - x0, y1 - y0, 0.16, 'overlay', seed);
    g.restore();
  }

  function chimney(g, x, y, w, h) {
    A.wood(g, x, y - h, w, h, { base: '#b7674a', seed: Math.round(x), dir: 'h', lineGap: 6, knots: false, grain: 0.2 });
    g.strokeStyle = 'rgba(43,26,32,0.35)'; g.lineWidth = 1.2; for (let yy = y - h + 6; yy < y; yy += 6) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(x, y - h, w, h);
    g.fillStyle = '#d8ccbc'; g.fillRect(x - 3, y - h - 5, w + 6, 6); g.strokeRect(x - 3, y - h - 5, w + 6, 6);
    // трубы-горшки
    g.fillStyle = '#a4553b'; for (const dx of [w * 0.28, w * 0.72]) { g.beginPath(); g.ellipse(x + dx, y - h - 10, 4, 6, 0, 0, 6.3); g.fill(); g.lineWidth = 1.8; g.stroke(); }
  }

  function dormer(g, x, y, w, h, roof, lit) {
    // слуховое окно на скате: рамка, стекло, двускатная крыша
    g.fillStyle = '#f0e6d0'; g.fillRect(x, y, w, h); g.strokeStyle = OUT; g.lineWidth = 2.4; g.strokeRect(x, y, w, h);
    g.fillStyle = A.linG(g, 0, y, 0, y + h, lit ? [[0, '#ffe7a6'], [1, '#f2b25c']] : [[0, '#4b5d78'], [1, '#8fa5bd']]); g.fillRect(x + 4, y + 5, w - 8, h - 9);
    g.strokeStyle = '#f0e6d0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2, y + 5); g.lineTo(x + w / 2, y + h - 4); g.stroke();
    g.beginPath(); g.moveTo(x - 5, y + 1); g.lineTo(x + w / 2, y - h * 0.5); g.lineTo(x + w + 5, y + 1); g.closePath(); g.fillStyle = roof; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 5, y + 6, 4, h - 10);
  }

  // ---------------------------------------------------------------- османовский дом
  // o: { w, floors, seed, stone, roof, shutter, lit (доля освещённых окон), haze (0..1), scale }
  // Возвращает слой { c, w, h, top } — основание дома на нижней кромке слоя (низ = baseY слоя).
  function building(o) {
    const w = o.w, floors = o.floors, seed = o.seed || 1, R = A.rng(seed);
    const stone = o.stone || STONES[Math.floor(R.next() * STONES.length)], roof = o.roof || ROOFS[Math.floor(R.next() * ROOFS.length)];
    const shut = o.shutter || SHUTTERS[Math.floor(R.next() * SHUTTERS.length)];
    const fh = 92, gh = 96, roofH = 88, bodyH = gh + floors * fh, H = bodyH + roofH + 62;
    const pad = 12;
    const L = A.layer(w + pad * 2, H, (g) => {
      g.translate(pad, 0);
      const top = H - 6 - bodyH, base = H - 6;
      // ---- стена
      A.plaster(g, 0, top, w, bodyH, [[0, stone], [0.7, stone], [1, '#d9c7a4']], { seed: seed + 3, grain: 0.13, dark: 'rgba(90,60,40,', light: 'rgba(255,250,235,' });
      // дождевые потёки
      for (let i = 0; i < w / 60; i++) { const sx = R.range(6, w - 6); g.fillStyle = 'rgba(90,70,50,' + R.range(0.035, 0.07).toFixed(3) + ')'; g.fillRect(sx, top + R.range(0, bodyH * 0.4), R.range(3, 8), R.range(60, 220)); }
      // цоколь: рустовка крупными блоками
      g.save(); g.beginPath(); g.rect(0, base - gh, w, gh); g.clip();
      g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, base - gh, w, gh);
      g.strokeStyle = 'rgba(60,40,30,0.38)'; g.lineWidth = 1.6;
      for (let y = base - gh + 24, r = 0; y < base; y += 24, r++) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (r % 2) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x, y); g.stroke(); } }
      g.restore();
      // угловые «кирпичи» (квоины)
      for (const cx of [0, w - 12]) for (let y = base - gh - fh * floors, i = 0; y < base; y += 30, i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(80,55,35,0.10)'; g.fillRect(cx, y, 12, 30); g.strokeStyle = 'rgba(60,40,30,0.3)'; g.lineWidth = 1.2; g.strokeRect(cx, y, 12, 30); }
      // пояса между этажами
      for (let f = 0; f <= floors; f++) {
        const cy = base - gh - f * fh;
        A.box(g, -4, cy - 5, w + 8, 9, { fill: '#f2e6cf', lw: 2.6, hi: 'rgba(255,255,255,0.4)' });
      }
      // ---- окна
      const cols = Math.max(2, Math.floor((w - 34) / 62)), gap = (w - 24) / cols;
      for (let f = 0; f < floors; f++) {
        const fy = base - gh - (f + 1) * fh;                    // верх этажа
        const belle = f === 0;                                  // бельэтаж: высокие окна и общий балкон
        const ww = belle ? 32 : 28, wh = belle ? 66 : 56, wy = fy + (belle ? 14 : 20);
        for (let c = 0; c < cols; c++) {
          const wx = 12 + c * gap + gap / 2 - ww / 2;
          win(g, wx, wy, ww, wh, {
            shutter: !belle && R.chance(0.72) ? shut : null, pediment: belle ? (c % 2 ? 'seg' : 'tri') : (f === 1 && R.chance(0.4) ? 'seg' : null),
            lit: R.chance(o.lit === undefined ? 0.14 : o.lit), curtain: R.chance(0.35), flowers: !belle && f !== floors - 1 && R.chance(0.3),
          });
        }
        if (belle) rail(g, 6, w - 6, wy + wh - 26, 22);
        else if (f === 1 && R.chance(0.55)) rail(g, 8, w - 8, wy + wh - 22, 18);
      }
      // ---- цоколь: арки-двери или окна лавок
      for (let c = 0; c < cols; c++) {
        const wx = 12 + c * gap + gap / 2 - 22, wy = base - gh + 22;
        if (c === 0 && R.chance(0.7)) { A.box(g, wx - 4, wy, 52, gh - 22, { fill: '#5b3a2c', lw: 3 }); A.wood(g, wx - 3, wy + 1, 50, gh - 24, { base: '#6b4632', seed: seed + c, dir: 'v', knots: false }); g.fillStyle = '#d9a441'; g.beginPath(); g.arc(wx + 38, wy + 44, 3.4, 0, 6.3); g.fill(); }
        else win(g, wx + 6, wy, 32, gh - 40, { lit: R.chance(0.2), curtain: R.chance(0.5) });
      }
      // ---- карниз с зубчиками
      A.box(g, -8, top - 14, w + 16, 18, { fill: '#f0e2c6', lw: 3, hi: 'rgba(255,255,255,0.4)' });
      g.fillStyle = 'rgba(80,55,35,0.28)'; for (let x = -4; x < w + 4; x += 10) g.fillRect(x, top - 6, 6, 7);
      // ---- мансарда: две линии ската, слуховые окна, трубы
      const rl = 8, rt = top - 14;
      const lower = () => { g.beginPath(); g.moveTo(-rl, rt); g.lineTo(12, rt - 58); g.lineTo(w - 12, rt - 58); g.lineTo(w + rl, rt); g.closePath(); };
      slate(g, lower, roof, seed + 7, [-rl, rt - 58, w + rl, rt]);
      g.save(); lower(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.restore();
      const cap = () => { g.beginPath(); g.moveTo(12, rt - 58); g.lineTo(34, rt - roofH); g.lineTo(w - 34, rt - roofH); g.lineTo(w - 12, rt - 58); g.closePath(); };
      slate(g, cap, ROOFS[(Math.floor(R.next() * 5)) % 5] === roof ? '#727a98' : roof, seed + 9, [12, rt - roofH, w - 12, rt - 58]);
      g.save(); cap(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fill(); g.restore();
      const dn = Math.max(1, Math.floor(w / 110));
      for (let d = 0; d < dn; d++) { const dx = (d + 0.5) * (w / dn) - 15; dormer(g, dx, rt - 52, 30, 34, roof, R.chance(0.3)); }
      chimney(g, w * 0.16, rt - 62, 16, 34); chimney(g, w * 0.72, rt - 64, 16, 32);
      if (w > 260) chimney(g, w * 0.44, rt - 76, 14, 26);
      // общий контур дома и мягкое затемнение по краям
      g.strokeStyle = OUT; g.lineWidth = 3.2; g.strokeRect(0, top, w, bodyH);
      A.edge(g, 0, top, 22, bodyH, 'l', 22, 'rgba(60,40,30,0.18)'); A.edge(g, w - 22, top, 22, bodyH, 'r', 22, 'rgba(60,40,30,0.18)');
      A.edge(g, 0, base - 40, w, 40, 'b', 40, 'rgba(60,40,30,0.22)');
      if (o.haze) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(' + (o.hazeColor || '236,224,214') + ',' + o.haze + ')'; g.fillRect(-pad, 0, w + pad * 2, H); g.globalCompositeOperation = 'source-over'; }
    }, o.scale || 1.25);
    L.pad = pad; L.bodyW = w; L.bodyH = bodyH; L.roofH = roofH;
    return L;
  }

  Ale.Paris = Ale.Paris || {};
  Object.assign(Ale.Paris, { STONES, ROOFS, SHUTTERS, IRON, rail, win, slate, chimney, dormer, building });
})();
