// Пятна помидоров на кадрах преподавательницы.
// Поза «попадание» нарисована с пятнами до стадии 4; чистые кадры (ходьба, замах и бросок, прыжок назад, пошатывание, ярость) дополняются брызгами,
// вырезанными по силуэту (source-atop), по одному набору на стадию 1..7: ходьба — заранее (build), остальные позы — при первом обращении (frame).
// Стадии 5–7 (боссу восемь попаданий) добавляют брызги поверх самой запятнанной нарисованной позы: tch_hit5/6/7.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  // Нормализованные положения брызг: [u, v, спрайт, масштаб, угол]. Каждая следующая стадия добавляет новые.
  const STAGES = [
    [],
    [[0.52, 0.36, 'fx_tomato2', 0.20, 0.3], [0.40, 0.62, 'fx_tomato1', 0.55, 1.2], [0.60, 0.55, 'fx_tomato3', 0.22, 2.1]],
    [[0.46, 0.46, 'fx_tomato2', 0.22, 1.5], [0.66, 0.70, 'fx_tomato3', 0.24, 0.2], [0.28, 0.60, 'fx_tomato1', 0.60, 2.8]],
    [[0.50, 0.28, 'fx_tomato2', 0.20, 0.9], [0.42, 0.12, 'fx_tomato1', 0.40, 0.3], [0.36, 0.52, 'fx_tomato2', 0.24, 2.4], [0.60, 0.78, 'fx_tomato3', 0.26, 1.1]],
    [[0.52, 0.16, 'fx_tomato2', 0.18, 2.2], [0.40, 0.40, 'fx_tomato3', 0.24, 0.2], [0.58, 0.46, 'fx_tomato2', 0.22, 1.4], [0.24, 0.70, 'fx_tomato3', 0.26, 0.7], [0.72, 0.80, 'fx_tomato2', 0.20, 2.6]],
    [[0.30, 0.32, 'fx_tomato1', 0.40, 1.9], [0.64, 0.34, 'fx_tomato3', 0.24, 0.5], [0.48, 0.64, 'fx_tomato2', 0.24, 2.9], [0.34, 0.86, 'fx_tomato3', 0.22, 1.2]],
    [[0.58, 0.24, 'fx_tomato1', 0.36, 0.4], [0.36, 0.46, 'fx_tomato2', 0.24, 1.7], [0.66, 0.60, 'fx_tomato1', 0.44, 2.3], [0.46, 0.80, 'fx_tomato3', 0.26, 0.9], [0.26, 0.20, 'fx_tomato2', 0.20, 2.1]],
    [[0.44, 0.30, 'fx_tomato1', 0.46, 2.6], [0.70, 0.42, 'fx_tomato3', 0.26, 1.3], [0.30, 0.56, 'fx_tomato2', 0.26, 0.6], [0.56, 0.72, 'fx_tomato1', 0.40, 1.5], [0.40, 0.90, 'fx_tomato2', 0.22, 2.8], [0.62, 0.14, 'fx_tomato3', 0.22, 0.8]],
  ];

  // Копия спрайта с брызгами поверх (только по силуэту). lists — наборы стадий, брызги складываются.
  function stained(A, base, name, lists) {
    const c = document.createElement('canvas');
    c.width = base.img.width; c.height = base.img.height;
    const g = c.getContext('2d');
    g.drawImage(base.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const bodyH = base.ay;
    for (const [u, v, sn, sc, rot] of [].concat(...lists)) {
      const sp = A.sprites[sn];
      if (!sp) continue;
      g.save();
      g.translate(base.img.width * u, bodyH * v);
      g.rotate(rot);
      g.globalAlpha = 0.93;
      const w = sp.w * sc, h = sp.h * sc;
      g.drawImage(sp.img, -w / 2, -h / 2, w, h);
      g.restore();
    }
    A.sprites[name] = { name, img: c, w: base.w, h: base.h, ax: base.ax, ay: base.ay, hs: base.hs, el: base.el || 0, white: null };
  }

  const Stain = (Ale.Stain = {
    // Чистая поза с пятнами нужной стадии (0 — без пятен): строится при первом обращении и запоминается; имя вида «tch_hop_s3».
    frame(base, stage) {
      if (!stage) return base;
      const name = base + '_s' + stage, A = Ale.Assets;
      if (!A.sprites[name]) {
        const b = A.sprites[base];
        if (!b) return base;
        stained(A, b, name, STAGES.slice(1, stage + 1));
      }
      return name;
    },

    // Регистрирует спрайты вида «tch_walk3_s2» (кадр 3 ходьбы, две стадии пятен).
    build() {
      const A = Ale.Assets, os = A.os;
      A.derive('fx_puff', 'fx_dust1', { x0: 56, y0: 0, x1: 152, y1: 56, feather: 14 });      // клуб пыли в стиле остальных спрайтов
      for (let i = 1; i <= 6; i++) {
        const base = A.sprites['tch_walk' + i];
        if (!base) continue;
        let acc = [];
        for (let st = 1; st <= 7; st++) {
          acc = acc.concat(STAGES[st]);
          const c = document.createElement('canvas');
          c.width = base.img.width; c.height = base.img.height;
          const g = c.getContext('2d');
          g.drawImage(base.img, 0, 0);
          g.globalCompositeOperation = 'source-atop';
          // область туловища: приблизительно по габаритам кадра (нижняя опора — ay)
          const bodyTop = 0, bodyH = base.ay;
          for (const [u, v, name, sc, rot] of acc) {
            const s = A.sprites[name];
            if (!s) continue;
            g.save();
            g.translate(base.img.width * u, bodyTop + bodyH * v);
            g.rotate(rot);
            g.globalAlpha = 0.93;
            const w = s.w * sc, h = s.h * sc;
            g.drawImage(s.img, -w / 2, -h / 2, w, h);
            g.restore();
          }
          A.sprites['tch_walk' + i + '_s' + st] = { name: 'tch_walk' + i + '_s' + st, img: c, w: base.w, h: base.h, ax: base.ax, ay: base.ay, hs: base.hs, white: null };
        }
      }
      // поза попадания: нарисованы стадии 1–4, выше — брызги поверх четвёртой
      const hit4 = A.sprites.tch_hit4;
      if (hit4) { stained(A, hit4, 'tch_hit5', [STAGES[5]]); stained(A, hit4, 'tch_hit6', [STAGES[5], STAGES[6]]); stained(A, hit4, 'tch_hit7', [STAGES[5], STAGES[6], STAGES[7]]); }
    },
  });
})();
