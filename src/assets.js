// Загрузка спрайтов и портретов, рисование по точке опоры.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});
  const M = window.ALE_MANIFEST;

  const Assets = (Ale.Assets = {
    os: M.os,           // пикселей файла на единицу мира
    sprites: {},
    portraits: {},
    images: {},         // готовые картинки: виды из окон, афиши, титульная картина (assets/images/*.jpg) и логотип с прозрачностью (.png)
    stills: {},         // сюжетные открытки (assets/stills/*.jpg + маленькие эскизы для альбома): грузятся по мере надобности, см. Ale.Cards
    ready: false,
    TRIES: 6,
    retryDelay(attempt) { return Math.min(4, 0.4 * Math.pow(2, attempt - 1)); },          // пауза перед следующей попыткой после неудачной номер attempt, с
    load(onProgress) {
      const entries = [];
      for (const [name, s] of Object.entries(M.sprites)) entries.push({ kind: 'sprite', name, file: s.f, meta: s });
      for (const [name, f] of Object.entries(M.portraits)) entries.push({ kind: 'portrait', name, file: f });
      for (const [name, im] of Object.entries(M.images || {})) entries.push({ kind: 'image', name, file: im.f, meta: im });
      let done = 0;
      const total = entries.length;
      const base = (window.ALE_ASSET_BASE || 'assets/');
      // Одна неудачная загрузка (обрыв сети на телефоне) не должна ронять игру: до шести попыток на файл с нарастающей паузой (0,4 / 0,8 / 1,6 / 3,2 / 4 с — всего ≈ 10 с). Раньше было три попытки за 1,2 с:
      // обрыв связи на пару секунд (туннель, переход с Wi-Fi на мобильную сеть) выбивал сразу все ≈ 250 картинок, они повторялись в ту же дыру, и игра не запускалась (18.10.2026).
      const loadOne = (e, attempt) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (e.kind === 'sprite') Assets.sprites[e.name] = { name: e.name, img, w: e.meta.w, h: e.meta.h, ax: e.meta.ax, ay: e.meta.ay, hs: e.meta.hs, el: e.meta.el || 0, pts: e.meta.pts || null, white: null };
          else if (e.kind === 'image') Assets.images[e.name] = img;
          else Assets.portraits[e.name] = img;
          done++;
          if (onProgress) onProgress(done / total);
          resolve();
        };
        img.onerror = () => {
          if (attempt < Assets.TRIES) setTimeout(() => loadOne(e, attempt + 1).then(resolve, reject), Assets.retryDelay(attempt) * 1000);
          else reject(new Error('Не загрузился файл ' + e.file + '. Проверь соединение и обнови страницу.'));
        };
        const url = /^(data:|blob:|https?:)/.test(e.file) ? e.file : base + e.file;
        img.src = (attempt > 1 && !/^(data:|blob:)/.test(url)) ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'retry=' + attempt : url;
      });
      return Promise.all(entries.map((e) => loadOne(e, 1))).then(() => { Assets.ready = true; });
    },
  });

  for (const [name, s] of Object.entries(M.stills || {})) Assets.stills[name] = { name, f: s.f, t: s.t, w: s.w, h: s.h, img: null, thumb: null, p: null, tp: null };

  // Загрузка открытки (или её эскиза) по требованию. Возвращает обещание с картинкой или null, если файл не загрузился (до трёх попыток).
  Assets.loadStill = function (name, thumb) {
    const s = Assets.stills[name];
    if (!s) return Promise.resolve(null);
    const key = thumb ? 'thumb' : 'img', pk = thumb ? 'tp' : 'p';
    if (s[key]) return Promise.resolve(s[key]);
    if (s[pk]) return s[pk];
    const file = thumb ? s.t : s.f, base = window.ALE_ASSET_BASE || 'assets/';
    s[pk] = new Promise((resolve) => {
      const attempt = (n) => {
        const im = new Image();
        im.onload = () => {
          // расшифровка заранее, вне кадра: иначе первый показ большой картины подвесил бы игру на слабом телефоне;
          // но ждать её дольше 0,9 с не нужно (в скрытой вкладке браузер может её отложить)
          let done = false; const fin = () => { if (!done) { done = true; s[key] = im; resolve(im); } };
          if (im.decode) im.decode().then(fin, fin); else fin();
          setTimeout(fin, 900);
        };
        im.onerror = () => { if (n < Assets.TRIES) setTimeout(() => attempt(n + 1), Assets.retryDelay(n) * 1000); else { s[pk] = null; resolve(null); } };
        const url = /^(data:|blob:|https?:)/.test(file) ? file : base + file;
        im.src = (n > 1 && !/^(data:|blob:)/.test(url)) ? url + (url.indexOf('?') < 0 ? '?' : '&') + 'retry=' + n : url;
      };
      attempt(1);
    });
    return s[pk];
  };

  // Белый силуэт спрайта для вспышки при попадании (создаётся лениво).
  function whiteOf(s) {
    if (s.white) return s.white;
    const c = document.createElement('canvas');
    c.width = s.img.width; c.height = s.img.height;
    const g = c.getContext('2d');
    g.drawImage(s.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    s.white = c;
    return c;
  }

  // Производный спрайт: вырезка из уже загруженного (например, клуб пыли из длинной пыльной волны).
  // crop — в юнитах спрайта-источника; опора нового спрайта — середина низа.
  Assets.derive = function (name, from, crop) {
    const s = Assets.sprites[from];
    if (!s) return null;
    const os = s.res || Assets.os;
    const cw = Math.max(1, Math.round((crop.x1 - crop.x0) * os)), ch = Math.max(1, Math.round((crop.y1 - crop.y0) * os));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.drawImage(s.img, Math.round(crop.x0 * os), Math.round(crop.y0 * os), cw, ch, 0, 0, cw, ch);
    if (crop.feather) {           // мягкие края: вырезка не должна давать прямых вертикальных срезов
      const f = crop.feather * os;
      g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, 0, cw, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(Math.min(0.49, f / cw), 'rgba(0,0,0,1)');
      gr.addColorStop(Math.max(0.51, 1 - f / cw), 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
    }
    return (Assets.sprites[name] = { name, img: c, w: cw, h: ch, ax: cw / 2, ay: ch, hs: ch / os, res: os, white: null });
  };

  const NONE = {};
  // Рисует спрайт так, что (x, y) — точка опоры. o: flip, sx, sy, rot, alpha, flash (0..1, белый), ox, oy.
  Ale.drawSprite = function (ctx, name, x, y, o) {
    const s = Assets.sprites[name];
    if (!s) { if (Ale.DEBUG.warn) console.warn('нет спрайта', name); return; }
    o = o || NONE;
    const os = Assets.os;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';        // картинки спрайтов кэшируются вместе с уменьшенными копиями — 'high' почти бесплатно и заметно чище
    ctx.translate(x + (o.ox || 0), y + (o.oy || 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const rs = s.res || os;
    const dx = -s.ax / rs, dy = -s.ay / rs, w = s.w / rs, h = s.h / rs;
    ctx.drawImage(s.img, dx, dy, w, h);
    if (o.flash) {
      ctx.globalAlpha *= o.flash;
      ctx.drawImage(whiteOf(s), dx, dy, w, h);
    }
    ctx.restore();
  };

  // Размер спрайта в единицах мира (для проверок и раскладки).
  Ale.spriteSize = (name) => { const s = Assets.sprites[name]; if (!s) return null; const rs = s.res || Assets.os; return { w: s.w / rs, h: s.h / rs, ax: s.ax / rs, ay: s.ay / rs }; };

  // Точка спрайта (hx вправо, hy ВВЕРХ от опоры, в юнитах исходного кадра «лицом вправо») → мировая точка при рисовании с параметрами o
  // (flip, sx, sy, rot, ox, oy) в позиции (x, y). Так предметы «приклеиваются» к руке и не летают рядом.
  Ale.spritePoint = (x, y, o, hx, hy) => {
    o = o || {};
    const fx = (o.flip ? -1 : 1) * (o.sx || 1) * hx, fy = (o.sy || 1) * -hy;
    const c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0);
    return { x: x + (o.ox || 0) + fx * c - fy * sn, y: y + (o.oy || 0) + fx * sn + fy * c };
  };

  // Регистрирует нарисованный кодом спрайт (холст): res — пикселей на юнит, (ax, ay) — точка опоры в пикселях холста.
  Assets.addCanvas = function (name, canvas, res, ax, ay) {
    Assets.sprites[name] = { name, img: canvas, w: canvas.width, h: canvas.height, ax: ax === undefined ? canvas.width / 2 : ax, ay: ay === undefined ? canvas.height / 2 : ay, hs: canvas.height / res, res, white: null };
    return Assets.sprites[name];
  };
})();
