// Аэропорт Шарль-де-Голль: площадь у вокзала (конь довёз), зал с регистрацией, металлодетектором, багажной каруселью и крысами,
// выход на посадку. Финал главы: билет, трап, взлёт.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const A = Ale.Art, AA = Ale.AirportArt;
  const FY = 600, WALL = 584, WIDTH = 3700;

  const X = Ale.AIRPORT = {
    start: 480, horse: 690, hallStart: 1080, board: 1560, desks: [1300, 1540, 1780], arch: 2080,
    belt0: 2360, belt1: 2860, gate: 3300, jet: 3560, windows: [[1180, 560], [1830, 560], [2480, 560], [3130, 340]],
  };

  Ale.Scenes.airport = function (game, entry) {
    const sc = new Ale.Scene(game, { id: 'airport', width: WIDTH, music: 'airport', place: entry === 'start' ? Ale.T.place.airport : null });
    const W = sc.world;
    const bg = A.layer(WIDTH, 720, (g, w, h) => AA.hallBackground(g, w, h, X), 1.4);

    // ---- геометрия
    W.addSolid(-400, FY, WIDTH + 800, 400, { kind: 'floor' });
    W.addSolid(-400, -400, 400, 1500);
    W.addSolid(WIDTH, -400, 400, 1500);
    W.addOneWay(1400, WALL - 62, 96, 12, { kind: 'cart' });
    W.addOneWay(1930, WALL - 62, 96, 12, { kind: 'cart' });
    const belt = W.addOneWay(X.belt0, WALL - 46, X.belt1 - X.belt0, 14, { kind: 'belt' }); belt.conveyor = 90;

    sc.back.push((ctx, cam) => { ctx.fillStyle = '#dfe4ec'; ctx.fillRect(0, 0, game.viewW, game.viewH); A.blitView(ctx, bg, -cam.x, -cam.y, game.viewW); });
    sc.front.push((ctx) => A.vignette(ctx, game.viewW, game.viewH, 0.3));

    // ---- декор
    const desks = ['A10', 'A11', 'A12'].map((n) => AA.checkinDesk(n)), cartL = AA.cart(), palm = AA.palm(), kiosk = AA.kioskAirport(), arch = AA.secArch(), gateD = AA.gateDesk(), jet = AA.jetDoor();
    X.desks.forEach((dx, di) => sc.add(new Ale.Decor({ x: dx, y: WALL, z: 22, draw: (ctx) => { A.shadow(ctx, dx, WALL, 110, 0.28); A.blit(ctx, desks[di], dx - 95, WALL - 128); } })));                // у каждой стойки свой номер (раньше на всех трёх было «A12»)
    for (const cx of [1448, 1978]) sc.add(new Ale.Decor({ x: cx, y: WALL, z: 24, draw: (ctx) => { A.shadow(ctx, cx, WALL, 56, 0.28); A.blit(ctx, cartL, cx - 48, WALL - 84); } }));
    for (const px of [1130, 3040]) sc.add(new Ale.Decor({ x: px, y: WALL, z: 20, draw: (ctx) => { A.shadow(ctx, px, WALL, 50, 0.26); A.blit(ctx, palm, px - 75, WALL - 190); } }));
    sc.add(new Ale.Decor({ x: 2250, y: WALL, z: 20, draw: (ctx) => { A.shadow(ctx, 2250, WALL, 100, 0.26); A.blit(ctx, kiosk, 2250 - 105, WALL - 190); } }));
    // табло вылета (обновляется)
    sc.add(new Ale.Decor({ x: X.board, y: 170, z: 21, draw: (ctx, d) => drawBoard(ctx, X.board, d.t) }));
    // рамка металлодетектора: лампы краснеют, когда она пищит
    const archE = sc.add(new Ale.Decor({ x: X.arch, y: WALL, z: 26, draw: (ctx, d) => {
      A.shadow(ctx, X.arch, WALL, 70, 0.28); A.blit(ctx, arch, X.arch - 75, WALL - 260);
      if (sc.beepT > 0) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(sc.time * 30); ctx.fillStyle = '#e0392f'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(X.arch - 75 + 26 + i * 24, WALL - 260 + 34, 5, 0, 6.3); ctx.fill(); } ctx.restore(); }
    } }));
    // багажная карусель: лента и ползущие чемоданы
    const suit = [AA.suitcase('#c8593a', '#f2c94c'), AA.suitcase('#3d5a80', '#fff'), AA.suitcase('#4f8a4b', '#e8e8e8'), AA.suitcase('#7a2e3b', '#f2c94c'), AA.suitcase('#8a6a2a', '#2b3a3a')];
    sc.add(new Ale.Decor({ x: X.belt0, y: WALL, z: 23, draw: (ctx) => drawBelt(ctx, X, suit, sc.time) }));
    // автоматические двери входа
    sc.add(new Ale.Decor({ x: X.hallStart, y: WALL, z: 27, draw: (ctx) => {
      const p = sc.player, k = Ale.clamp(1 - Math.abs(p.x - X.hallStart) / 300, 0, 1), o = Ale.ease.outCubic(k) * 66;
      for (const s of [-1, 1]) { ctx.save(); ctx.translate(X.hallStart + s * (34 + o), 0); ctx.fillStyle = 'rgba(150,196,214,0.28)'; ctx.fillRect(-32, 176, 64, 400); ctx.strokeStyle = 'rgba(43,58,85,0.85)'; ctx.lineWidth = 4; ctx.strokeRect(-32, 176, 64, 400); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(-26, 576); ctx.lineTo(0, 176); ctx.lineTo(12, 176); ctx.lineTo(-14, 576); ctx.fill(); ctx.restore(); }
    } }));
    sc.add(new Ale.Decor({ x: X.gate, y: WALL, z: 22, draw: (ctx) => { A.shadow(ctx, X.gate, WALL, 130, 0.28); A.blit(ctx, gateD, X.gate - 115, WALL - 128); } }));
    sc.add(new Ale.Decor({ x: X.jet, y: WALL, z: 12, draw: (ctx) => A.blit(ctx, jet, X.jet - 75, WALL - 318) }));
    sc.add(new Ale.HeartPickup({ x: 1448, y: WALL - 62 })); sc.add(new Ale.HeartPickup({ x: 1978, y: WALL - 62 }));

    // ---- герои, конь, дежурный, крысы
    const horse = sc.add(new Ale.Preslyukan({ x: X.horse, y: FY, facing: -1 }));
    sc.horse = horse; sc.actors.preslyukan = horse;
    const p = sc.add(new Ale.Player({ x: X.start, y: FY, facing: 1 }));
    sc.player = p;
    sc.bubel = sc.add(new Ale.Bubel({ x: X.start - 80, y: FY, facing: 1 }));
    const agent = sc.add(new Ale.Clerk({ x: X.gate, y: FY, counterTop: WALL - 80, facing: -1, id: 'agent', bust: 'att_bust' }));
    agent.interactRange = 170; agent.z = 21;
    sc.agent = agent;
    sc.jetDoor = sc.add(new Ale.Door({ x: X.jet, y: FY, id: 'jet', range: 70, headH: 300, locked: true, lockedText: Ale.T.hint.jetLocked, onUse: () => sc.onJet && sc.onJet() }));
    sc.rats = [
      sc.add(new Ale.Rat({ x: 1640, y: FY, range: 110 })),                  // между стойками регистрации
      sc.add(new Ale.Rat({ x: 2200, y: FY, range: 120 })),
      sc.add(new Ale.Rat({ x: 2560, y: FY, range: 100, facing: -1 })),      // под лентой карусели
      sc.add(new Ale.Rat({ x: 2960, y: FY, range: 110, facing: -1 })),
      sc.add(new Ale.Rat({ x: 3140, y: FY, range: 90 })),
    ];
    sc.beepT = 0; sc.archE = archE;

    Ale.AirportStory.setup(sc, entry);
    return sc;
  };

  // Ползущая лента с чемоданами.
  function drawBelt(ctx, X, suit, t) {
    const x0 = X.belt0, w = X.belt1 - X.belt0, top = 584 - 46;
    ctx.save();
    A.box(ctx, x0 - 10, top + 8, w + 20, 46, { fill: '#5c6472', lw: 3.6, r: 4 });
    ctx.beginPath(); ctx.rect(x0, top, w, 20); ctx.clip();
    ctx.fillStyle = '#2b2f38'; ctx.fillRect(x0, top, w, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; const off = (t * 90) % 40; for (let x = x0 - 40 + off; x < x0 + w; x += 40) ctx.fillRect(x, top + 2, 20, 16);
    ctx.restore();
    ctx.strokeStyle = A.OUT; ctx.lineWidth = 3; ctx.strokeRect(x0, top, w, 20);
    A.box(ctx, x0 - 10, top + 40, w + 20, 14, { fill: '#8a90a0', lw: 3 });
    // чемоданы плывут и зацикливаются; у краёв ленты уходят в заслонки (раньше выступали за раму на ширину чемодана)
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, top - 80, w + 20, 100); ctx.clip();
    for (let i = 0; i < suit.length * 2; i++) {
      const sp = w / (suit.length * 2), sx = x0 + ((i * sp + t * 90) % w), L = suit[i % suit.length];
      ctx.drawImage(L.c, sx - 29, top - 42 + 4, L.w, L.h);
    }
    ctx.restore();
  }

  // Табло вылета: строки с рейсами, «Киев» мигает.
  function drawBoard(ctx, cx, t) {
    const w = 460, h = 168, x = cx - w / 2, y = 96;
    ctx.save();
    ctx.lineCap = 'round'; for (const hx of [x + 70, x + w - 70]) { ctx.strokeStyle = A.OUT; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hx, 64); ctx.lineTo(hx, y + 2); ctx.stroke(); ctx.strokeStyle = '#9aa4b6'; ctx.lineWidth = 3.4; ctx.stroke(); }          // подвесы от потолка (раньше табло висело в воздухе)
    A.box(ctx, x, y, w, h, { fill: '#171c26', lw: 4.4, r: 8 });
    ctx.fillStyle = '#e4b73a'; ctx.font = 'bold 16px ' + Ale.FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('DÉPARTS', x + 16, y + 20); ctx.fillText('HEURE', x + 190, y + 20); ctx.textAlign = 'right'; ctx.fillText('STATUT', x + w - 16, y + 20);
    const rows = [['LONDON', '17:55', 'PARTI'], ['ROMA', '18:20', 'PARTI'], ['KYIV', '18:40', 'EMBARQUEMENT'], ['LISBOA', '19:05', 'ENREGISTREMENT'], ['NICE', '19:30', 'ENREGISTREMENT']];
    ctx.font = 'bold 20px monospace';
    rows.forEach((r, i) => {
      const yy = y + 48 + i * 25, hot = i === 2, on = !hot || (Math.floor(t * 1.6) % 2 === 0);
      ctx.fillStyle = hot ? (on ? '#7dff9a' : '#2f6a3d') : '#c7d2e8';
      ctx.textAlign = 'left'; ctx.fillText(r[0], x + 16, yy); ctx.fillText(r[1], x + 190, yy); ctx.textAlign = 'right'; ctx.fillText(r[2], x + w - 16, yy);
    });
    ctx.restore();
  }
})();
