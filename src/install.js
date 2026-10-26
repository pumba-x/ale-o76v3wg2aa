// Гайд по установке игры на экран «Домой» (владелец 15.10.2026: «играя просто в браузере после QR-кода я получаю качество такое себе и неизбежные проблемы: нельзя убрать адресную строку и растянуть игру на весь
// экран, двойное касание приближает страницу и ломает всё; нужно сразу после QR-кода сделать понятный пошаговый гайд со слайдами, куда нажимать, чтобы добавить игру на рабочий стол, иначе играть нельзя»).
//
// Что делает: на iPhone, если страница открыта в обычной вкладке (не со значка «Домой»), вместо игры показывается пять слайдов — что нажать в Safari («Поделиться» → «На экран Домой» → «Добавить» →
// открыть значок). Игра при этом не загружается вовсе (картинки и звук не качаются, пока человек не установит её или не нажмёт «Всё равно играть в браузере»). Со значка «Домой», на компьютере, на Android и в
// проверках гайда нет. Тексты — Ale.T.install, картинки слайдов — векторные (ART), нарисованы кодом, никаких скриншотов чужого интерфейса.
//
// Вход: Ale.Install.start(callback) — main.js зовёт его вместо сразу Game.boot(); callback вызывается, когда гайд не нужен или закрыт («Всё равно играть в браузере»).
// `?install=1` показывает гайд в любом браузере (проверки и снимки слайдов), `?noinstall=1` отключает его (у быстрых ссылок со `scene=` и у проверок он отключён сам).
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  // ------------------------------------------------------------------ картинки слайдов (SVG)
  let uid = 0;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');          // и кавычка: esc стоит и внутри aria-label="…" (текст со страницы реплик с " ломал бы атрибут)
  const R = (x, y, w, h, r, fill, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>';
  const TX = (x, y, s, size, fill, extra) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '>' + esc(s) + '</text>';
  // значки 24×24 (штрих)
  const IC = {
    back: '<path d="M14.5 5 L7.5 12 L14.5 19"/>',
    fwd: '<path d="M9.5 5 L16.5 12 L9.5 19"/>',
    share: '<path d="M12 14 V3.5 M8 7.5 L12 3.5 L16 7.5"/><path d="M7.5 10.5 H6 A1.5 1.5 0 0 0 4.5 12 V19 A1.5 1.5 0 0 0 6 20.5 H18 A1.5 1.5 0 0 0 19.5 19 V12 A1.5 1.5 0 0 0 18 10.5 H16.5"/>',
    book: '<path d="M12 6.5 C9.5 4.8 6.5 4.6 3.5 5.5 V18.5 C6.5 17.6 9.5 17.8 12 19.5 C14.5 17.8 17.5 17.6 20.5 18.5 V5.5 C17.5 4.6 14.5 4.8 12 6.5 Z M12 6.5 V19.5"/>',
    tabs: '<rect x="8" y="3.5" width="12.5" height="12.5" rx="2.5"/><path d="M4.5 8 V18 A2 2 0 0 0 6.5 20 H15.5"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5 V6.7 A2.2 2.2 0 0 0 13.3 4.5 H6.7 A2.2 2.2 0 0 0 4.5 6.7 V13.3 A2.2 2.2 0 0 0 6.7 15.5 H8.5"/>',
    plus: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8 V16 M8 12 H16"/>',
    find: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M14.7 14.7 L19.5 19.5"/>',
    star: '<path d="M12 4 L14.2 9.2 L19.8 9.7 L15.5 13.4 L16.8 18.9 L12 16 L7.2 18.9 L8.5 13.4 L4.2 9.7 L9.8 9.2 Z"/>',
    dots: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor"/>',
  };
  const ic = (name, cx, cy, size, color, sw) => '<g transform="translate(' + (cx - size / 2) + ' ' + (cy - size / 2) + ') scale(' + size / 24 + ')" fill="none" stroke="' + color + '" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" style="color:' + color + '">' + IC[name] + '</g>';
  // корпус телефона (портрет) с экраном 29..211 × 11..319; всё содержимое обрезается по скруглённому экрану
  const phone = (inner) => {
    const id = 'ins' + (++uid);
    return '<svg viewBox="0 0 240 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><clipPath id="' + id + '"><rect x="29" y="11" width="182" height="308" rx="28"/></clipPath></defs>'
      + R(22, 4, 196, 322, 34, '#171019', 'stroke="#58465f" stroke-width="2.5"')
      + '<g clip-path="url(#' + id + ')">' + R(29, 11, 182, 308, 28, '#f6f1e9') + inner + '</g>'
      + R(98, 19, 44, 12, 6, '#07050a') + '</svg>';
  };
  const status = (dark) => TX(46, 29, '9:41', 9.5, dark ? '#fff6e4' : '#2a2030', 'font-weight="700"') + R(172, 22, 20, 9, 3, 'none', 'stroke="' + (dark ? '#fff6e4' : '#2a2030') + '" stroke-width="1.2"') + R(174, 24, 13, 5, 1.5, dark ? '#fff6e4' : '#2a2030');
  // подсветка «сюда нажать»: золотое кольцо и круг, который расходится
  // id связывает кольцо [data-hot] с тем, что оно подсвечивает, [data-target] (так проверки видят, что кольцо стоит ровно на нужном месте картинки)
  const hotAttr = (id) => (id ? ' data-hot="' + id + '"' : '');
  const tg = (id, inner) => '<g data-target="' + id + '">' + inner + '</g>';
  const ring = (cx, cy, r, id) => '<circle class="in-pulse"' + hotAttr(id) + ' cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(255,184,77,.32)" stroke="#ffb84d" stroke-width="2.4"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#ff9d1f" stroke-width="3"/>';
  const box = (x, y, w, h, r, id) => '<rect class="in-pulse"' + hotAttr(id) + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="rgba(255,184,77,.3)" stroke="#ffb84d" stroke-width="2.4"/><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="none" stroke="#ff9d1f" stroke-width="3"/>';
  const badge = (cx, cy, n) => '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#ffb84d" stroke="#3a2431" stroke-width="1"/>' + TX(cx, cy + 3.4, n, 9.5, '#3a2431', 'text-anchor="middle" font-weight="800" ' + FONT);
  const appIcon = (x, y, s, r) => { const id = 'ini' + (++uid); return '<clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="' + r + '"/></clipPath><image href="assets/icon-192.png" x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" clip-path="url(#' + id + ')" preserveAspectRatio="xMidYMid slice"/>'; };
  const FONT = 'font-family="-apple-system, system-ui, \'Segoe UI\', Roboto, sans-serif"';

  const ART = {
    // Игра как приложение: горизонтальный телефон с картиной из игры и значком
    welcome() {
      const id = 'insw' + (++uid), iid = 'insx' + uid;
      return '<svg viewBox="0 0 330 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
        + '<defs><clipPath id="' + id + '"><rect x="18" y="18" width="294" height="148" rx="22"/></clipPath><clipPath id="' + iid + '"><rect x="236" y="104" width="76" height="76" rx="18"/></clipPath>'
        + '<filter id="' + id + 's" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".5"/></filter></defs>'
        + R(8, 8, 314, 168, 30, '#171019', 'stroke="#58465f" stroke-width="2.5" filter="url(#' + id + 's)"')
        + '<g clip-path="url(#' + id + ')">' + R(18, 18, 294, 148, 22, '#2a1d33') + '<image href="assets/stills/still_01_post_office_s.jpg" x="18" y="18" width="294" height="148" preserveAspectRatio="xMidYMid slice"/></g>'
        + R(24, 78, 11, 40, 5.5, '#07050a')
        + '<g filter="url(#' + id + 's)"><rect x="233" y="101" width="82" height="82" rx="21" fill="#fff6e4"/><image href="assets/icon-192.png" x="236" y="104" width="76" height="76" clip-path="url(#' + iid + ')" preserveAspectRatio="xMidYMid slice"/></g>'
        + '<g fill="#ffd98a"><path d="M300 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path d="M42 140 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path d="M214 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" opacity=".8"/></g></svg>';
    },

    // Шаг 1: нижняя панель Safari, «Поделиться» подсвечено
    share() {
      const g = 'insg' + (++uid), host = esc((location.host || '192.168.0.2').slice(0, 20));
      return phone('<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2447"/><stop offset="1" stop-color="#150e1c"/></linearGradient></defs>'
        + R(29, 11, 182, 232, 0, 'url(#' + g + ')') + status(true)
        + appIcon(92, 78, 56, 14) + TX(120, 162, 'Ale Game', 14, '#ffe9c4', 'text-anchor="middle" font-weight="800" ' + FONT)
        + R(70, 176, 100, 7, 3.5, 'rgba(255,246,228,.5)') + R(86, 190, 68, 6, 3, 'rgba(255,246,228,.28)')
        + R(41, 250, 158, 24, 12, '#e7e1d6') + TX(120, 266, host, 9.5, '#6a6258', 'text-anchor="middle" ' + FONT)
        + R(29, 281, 182, 38, 0, '#fbf8f2') + '<path d="M29 281 H211" stroke="#e0d9cc" stroke-width="1"/>'
        + ic('back', 55, 300, 17, '#2f7cf6') + ic('fwd', 88, 300, 17, '#bdb6aa') + tg('share', ic('share', 121, 300, 18, '#2f7cf6')) + ic('book', 154, 300, 18, '#2f7cf6') + ic('tabs', 187, 300, 18, '#2f7cf6')
        + ring(121, 300, 19, 'share'));
    },

    // Шаг 1 на iOS 26 и новее (панель «Компактная», она по умолчанию): справа от адреса три точки, в их меню — «Поделиться»
    shareDots() {
      const g = 'insg' + (++uid), host = esc((location.host || '192.168.0.2').slice(0, 14)), glass = '#efeae2', edge = '#d6cdbf', ink = '#4b4553';
      return phone('<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2447"/><stop offset="1" stop-color="#150e1c"/></linearGradient></defs>'
        + R(29, 11, 182, 308, 0, 'url(#' + g + ')') + status(true)
        + appIcon(92, 56, 56, 14) + TX(120, 140, 'Ale Game', 14, '#ffe9c4', 'text-anchor="middle" font-weight="800" ' + FONT)
        + R(70, 154, 100, 7, 3.5, 'rgba(255,246,228,.5)') + R(86, 168, 68, 6, 3, 'rgba(255,246,228,.28)')
        + R(29, 11, 182, 308, 0, 'rgba(10,6,16,.38)')
        + R(98, 172, 106, 94, 18, '#f6f3ee', 'stroke="#d9d1c5" stroke-width="1"')
        + tg('share', R(104, 178, 94, 28, 9, '#fff4d6') + TX(112, 196, 'Поделиться', 10, '#7a4a00', 'font-weight="800" ' + FONT) + ic('share', 186, 192, 14, '#c97800', 1.8))
        + R(112, 218, 52, 5, 2.5, '#cfc9d3') + ic('book', 186, 221, 13, '#9b95a3', 1.7)
        + R(112, 244, 40, 5, 2.5, '#cfc9d3') + ic('tabs', 186, 247, 13, '#9b95a3', 1.7)
        + '<circle cx="50" cy="297" r="15" fill="' + glass + '" stroke="' + edge + '"/>' + ic('back', 50, 297, 14, ink, 2)
        + R(70, 283, 90, 28, 14, glass, 'stroke="' + edge + '"') + TX(115, 301, host, 8.5, '#6a6258', 'text-anchor="middle" ' + FONT)
        + tg('dots', '<circle cx="186" cy="297" r="15" fill="' + glass + '" stroke="' + edge + '"/>' + ic('dots', 186, 297, 16, ink, 1.9))
        + R(100, 315, 40, 3, 1.5, 'rgba(255,255,255,.75)')
        + box(100, 176, 100, 32, 10, 'share') + ring(186, 297, 19, 'dots')
        + badge(207, 279, 1) + badge(103, 177, 2));
    },

    // Шаг 2: меню «Поделиться», строка «На экран Домой» подсвечена
    add() {
      const rows = [['copy', 'Скопировать'], ['book', 'Добавить закладку'], ['plus', 'На экран Домой'], ['find', 'Найти на странице']];
      let out = R(29, 11, 182, 308, 0, '#6d6a74') + status(true) + R(29, 11, 182, 308, 0, 'rgba(15,10,20,.46)')
        + R(29, 60, 182, 270, 22, '#efedf3') + R(106, 67, 28, 4, 2, '#c3c0c9')
        + appIcon(42, 82, 26, 7) + TX(76, 93, 'Ale Game', 10.5, '#26202c', 'font-weight="700" ' + FONT) + TX(76, 105, (location.host || '192.168.0.2').slice(0, 22), 8, '#8d8794', FONT)
        + '<circle cx="193" cy="95" r="9" fill="#dcd9e1"/><path d="M189.5 91.5 L196.5 98.5 M196.5 91.5 L189.5 98.5" stroke="#6f6a78" stroke-width="1.6" stroke-linecap="round"/>';
      const apps = [['#3b8cf5', 'AirDrop'], ['#37c25c', 'Сообщения'], ['#4a9bf7', 'Почта'], ['#f4b43a', 'Заметки']];
      apps.forEach((a, i) => { const x = 46 + i * 41; out += R(x, 118, 30, 30, 8, a[0]) + R(x + 4, 153, 22, 3.5, 1.75, '#b9b5c1'); });
      out += R(40, 168, 160, 140, 12, '#ffffff');
      rows.forEach((r, i) => {
        const y = 168 + i * 34, hot = i === 2;
        const row = (hot ? R(40, y, 160, 34, 0, '#fff4d6') : '') + TX(50, y + 21, r[1], 10.5, hot ? '#7a4a00' : '#26202c', (hot ? 'font-weight="800" ' : '') + FONT) + ic(r[0], 184, y + 17, 15, hot ? '#c97800' : '#4b4553', 1.8);
        out += hot ? tg('add', row) : row;
        if (i < 3) out += '<path d="M50 ' + (y + 34) + ' H200" stroke="#ebe8ee" stroke-width="1"/>';
      });
      out += box(37, 235, 166, 36, 10, 'add');                                                           // ровно вокруг строки «На экран Домой» (третья: y = 168 + 2 · 34)
      out += '<path d="M120 296 V306 M114 301 L120 307 L126 301" stroke="#ff9d1f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>';
      return phone(out);
    },

    // Шаг 3: окно добавления, кнопка «Добавить» подсвечена
    confirm() {
      const d = 16;                                                                               // всё под заголовком сдвинуто вниз: в одной строке с кнопками он не помещается
      let out = R(29, 11, 182, 308, 0, '#efedf3') + status(false)
        + TX(38, 63, 'Отменить', 9.5, '#2f7cf6', FONT) + tg('addbtn', TX(202, 63, 'Добавить', 9.5, '#2f7cf6', 'text-anchor="end" font-weight="800" ' + FONT))
        + TX(120, 63 + d, 'На экран Домой', 11.5, '#26202c', 'text-anchor="middle" font-weight="800" ' + FONT)
        + R(40, 84 + d, 160, 78, 12, '#ffffff') + appIcon(50, 96 + d, 46, 11) + TX(106, 112 + d, 'Ale Game', 12, '#26202c', 'font-weight="700" ' + FONT) + '<path d="M106 ' + (120 + d) + ' H190" stroke="#e6e3ea" stroke-width="1"/>'
        + TX(106, 135 + d, (location.host || '192.168.0.2').slice(0, 22), 8.5, '#8d8794', FONT) + R(50, 143 + d, 140, 4, 2, '#eceaf0') + R(50, 152 + d, 96, 4, 2, '#eceaf0')
        + R(40, 176 + d, 160, 44, 12, '#ffffff') + TX(50, 195 + d, 'Открывать как', 9.5, '#26202c', FONT) + TX(50, 208 + d, 'веб-приложение', 9.5, '#26202c', FONT)
        + R(160, 187 + d, 30, 18, 9, '#34c759') + '<circle cx="181" cy="' + (196 + d) + '" r="7" fill="#fff"/>'
        + R(40, 236 + d, 120, 4, 2, '#dcd9e1') + R(40, 246 + d, 150, 4, 2, '#e4e1e8') + R(40, 256 + d, 90, 4, 2, '#e4e1e8');
      out += box(148, 48, 60, 24, 9, 'addbtn');                                                              // вокруг «Добавить» (текст кончается на x = 202)
      return phone(out);
    },

    // Шаг 4: экран «Домой» со значком игры
    open() {
      const g = 'inso' + (++uid), cols = [49, 93, 137, 181];
      const shades = ['#5aa0f0', '#f0b44a', '#53c27a', '#e9667a', '#9a82e8', '#52c0c8', '#f08a4a', '#7b8ea6', '#d78ad8', '#8ac04a'];
      let out = '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#5a3b8c"/><stop offset=".55" stop-color="#b3567e"/><stop offset="1" stop-color="#f08a5c"/></linearGradient></defs>'
        + R(29, 11, 182, 308, 0, 'url(#' + g + ')') + '<circle cx="190" cy="80" r="70" fill="rgba(255,225,170,.15)"/>' + status(true);
      let k = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const x = cols[c] - 17, y = 52 + r * 56;
        if (r === 1 && c === 2) { out += tg('icon', appIcon(x - 1, y - 1, 36, 9)) + TX(cols[c], y + 47, 'Ale Game', 8, '#fff', 'text-anchor="middle" font-weight="700" ' + FONT); continue; }
        out += R(x, y, 34, 34, 9, shades[k++ % shades.length], 'opacity=".78"') + R(cols[c] - 10, y + 41, 20, 3.5, 1.75, 'rgba(255,255,255,.55)');
      }
      out += R(38, 274, 164, 40, 15, 'rgba(255,255,255,.3)');
      [0, 1, 2, 3].forEach((i) => { out += R(48 + i * 38, 279, 30, 30, 8, shades[(i * 3 + 1) % shades.length], 'opacity=".85"'); });
      out += ring(cols[2], 52 + 56 + 17, 23, 'icon');                                           // кольцо не заходит на подпись «Ale Game» под значком
      return phone(out);
    },

    // Страница открыта не в Safari: скопировать ссылку и открыть её в Safari
    safari() {
      const id = 'inss' + (++uid), host = esc((location.host || '192.168.0.2').slice(0, 24));
      return '<svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb7ff"/><stop offset="1" stop-color="#1a63e8"/></linearGradient></defs>'
        + '<circle cx="130" cy="64" r="44" fill="url(#' + id + ')" stroke="#e8f1ff" stroke-width="4"/>'
        + '<g transform="rotate(45 130 64)"><path d="M130 30 L139 64 L130 98 L121 64 Z" fill="#fff"/><path d="M130 30 L139 64 L121 64 Z" fill="#ff4d4d"/></g><circle cx="130" cy="64" r="3.5" fill="#fff"/>'
        + R(24, 138, 212, 40, 20, '#f6f1e9', 'stroke="#d9d1c3" stroke-width="2"') + TX(48, 163, host, 13, '#4a4250', FONT) + tg('copy', ic('copy', 210, 158, 22, '#2f7cf6', 2)) + ring(210, 158, 23, 'copy')
        + '</svg>';
    },
  };

  // ------------------------------------------------------------------ показ
  const Install = (Ale.Install = {
    ART, el: null, i: 0, slides: [], onDone: null, browserKind: 'safari', compact: true, skipAsked: false, COPY_MS: 2200,          // COPY_MS — сколько кнопка копирования показывает итог (мс)

    // Нужен ли гайд: чистая функция. o = { search, ua, standalone, skipped }
    wanted(o) {
      const q = (o && o.search) || '';
      if (/[?&](manual|noinstall|skiptitle|scene)(=|&|$)/.test(q)) return false;          // проверки и быстрые ссылки на места игры: без гайда
      if (/[?&]install=1(&|$)/.test(q)) return !(o && o.standalone);                       // принудительно: проверки и снимки слайдов на любом устройстве, но не со значка «Домой» (значок, добавленный с такой страницы, не должен открывать гайд вечно)
      if (o && o.protocol === 'file:') return false;                                       // файл, открытый с диска (dist/ale-game.html): на экран «Домой» его не добавить, картинок гайда рядом нет
      if ((o && o.standalone) || (o && o.skipped)) return false;
      return /iPhone|iPod/.test((o && o.ua) || '');
    },
    // Не Safari: Chrome, Firefox и другие браузеры на iPhone добавить игру на экран «Домой» как приложение не умеют
    kindOf(ua) { return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Telegram|Line\/|MicroMessenger/i.test(ua || '') || !/Safari\//.test(ua || '') ? 'other' : 'safari'; },
    isStandalone() {
      let st = navigator.standalone === true;
      try { if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) st = true; } catch (e) { /* ок */ }
      return st;
    },
    _skipped() { try { return sessionStorage.getItem('ale-install-skip') === '1'; } catch (e) { return false; } },

    start(cb) {
      const o = { search: location.search, ua: navigator.userAgent, standalone: this.isStandalone(), skipped: this._skipped(), protocol: location.protocol };
      let want = false; try { want = this.wanted(o); } catch (e) { want = false; }
      if (!want) { cb(); return false; }
      this.onDone = cb;
      try { this.mount(); } catch (e) { this.onDone = null; if (this.el) { this.el.remove(); this.el = null; } document.body.classList.remove('install-on'); cb(); return false; }          // гайд не должен мешать игре
      return true;
    },

    // Какой вид у панели Safari: «компактная» (iOS 26 и новее, по умолчанию: «Поделиться» за тремя точками) или прежняя нижняя (значок «Поделиться» на панели). Версия Safari — в UA после Version/
    // (iOS в UA заморожена на 18); у чужих браузеров версии нет — считаем новым iOS.
    compactUI(ua) { const m = /Version\/(\d+)/.exec(ua || ''); return !m || +m[1] >= 26; },

    // Слайды по порядку: у других браузеров первый слайд — «Открой в Safari»; у новой панели Safari шаг 1 другой (три точки)
    list(kind, compact) {
      const T = Ale.T.install, all = T.slides.map((s) => (compact && s.art === 'share' ? Object.assign({}, s, T.shareDots) : s));
      return (kind === 'other' ? [T.other] : []).concat(all.slice(kind === 'other' ? 1 : 0));
    },

    mount(kind, ui) {
      if (this.el) return this.el;
      const T = Ale.T.install;
      this.browserKind = kind || (/[?&]installkind=(safari|other)/.exec(location.search) || [])[1] || this.kindOf(navigator.userAgent);          // `?installkind=other` — показать гайд для чужого браузера (проверки и снимки)
      const want = ui || (/[?&]installui=(classic|compact)/.exec(location.search) || [])[1];                                                       // `?installui=classic|compact` — вид панели Safari на картинке шага 1
      this.compact = want ? want === 'compact' : this.compactUI(navigator.userAgent);
      this.slides = this.list(this.browserKind, this.compact);
      const el = this.el = document.createElement('div');
      el.id = 'install'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', T.brand);
      const steps = this.slides.length;
      el.innerHTML = '<div class="in-wrap"><div class="in-head"><img src="assets/icon-192.png" alt=""><b>' + esc(T.brand) + '</b><span class="in-step"></span></div>'
        + '<div class="in-viewport"><div class="in-track">'
        + this.slides.map((s, n) => '<section class="in-slide' + (s.art === 'welcome' ? ' in-welcome' : '') + '" aria-label="' + esc(s.title) + '"><div class="in-art">' + (ART[s.art] ? ART[s.art]() : '') + '</div><div class="in-copy"><h2>' + esc(s.title) + '</h2><p>' + esc(s.text) + '</p>'
          + (s.art === 'safari' ? '<button type="button" class="in-btn in-copyb">' + esc(T.copy) + '</button>' : '') + '</div></section>').join('')
        + '</div></div>'
        + '<div class="in-dots">' + this.slides.map(() => '<i></i>').join('') + '</div>'
        + '<div class="in-nav"><button type="button" class="in-btn in-back">' + esc(T.back) + '</button><button type="button" class="in-btn in-next">' + esc(T.next) + '</button></div>'
        + '<div class="in-foot"><button type="button" class="in-skip">' + esc(T.browser) + '</button></div></div>'
        + '<div class="in-ask" hidden><div class="in-card" role="alertdialog" aria-label="' + esc(T.browser) + '"><p>' + esc(T.browserWarn) + '</p>'
        + '<div class="in-card-btns"><button type="button" class="in-btn in-stay">' + esc(T.browserStay) + '</button><button type="button" class="in-btn in-go">' + esc(T.browserYes) + '</button></div></div></div>';
      document.body.appendChild(el);
      const $ = (c) => el.querySelector(c);
      $('.in-next').addEventListener('click', () => (this.i >= this.slides.length - 1 ? this.go(0) : this.go(this.i + 1)));
      $('.in-back').addEventListener('click', () => this.go(this.i - 1));
      $('.in-skip').addEventListener('click', () => this.askSkip());
      $('.in-stay').addEventListener('click', () => this.cancelSkip());
      $('.in-go').addEventListener('click', () => this.skip());
      $('.in-ask').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.cancelSkip(); });          // касание мимо карточки — как «Вернуться»
      const cb = $('.in-copyb'); if (cb) cb.addEventListener('click', () => this.copyLink(cb));
      // листание пальцем
      const vp = $('.in-viewport'); let sx = null, sy = 0;
      vp.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
      vp.addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) this.go(this.i + (dx < 0 ? 1 : -1)); });
      vp.addEventListener('pointercancel', () => { sx = null; });
      window.addEventListener('keydown', this._key = (e) => { if (!this.el || !this.el.classList.contains('on')) return; if (e.key === 'ArrowRight') this.go(this.i + 1); else if (e.key === 'ArrowLeft') this.go(this.i - 1); });
      el.classList.add('on'); document.body.classList.add('install-on');
      this.go(0);
      return el;
    },

    go(n) {
      if (!this.el) return;
      const T = Ale.T.install, last = this.slides.length - 1;
      this.i = Math.max(0, Math.min(last, n));
      this.el.querySelector('.in-track').style.transform = 'translateX(' + (-100 * this.i) + '%)';
      this.el.querySelectorAll('.in-dots i').forEach((d, k) => d.classList.toggle('on', k === this.i));
      this.el.querySelectorAll('.in-slide').forEach((s, k) => { s.setAttribute('aria-hidden', k === this.i ? 'false' : 'true'); });
      const first = this.i === 0, steps = this.slides.length - 1;
      this.el.querySelector('.in-step').textContent = first ? '' : T.step.replace('{n}', this.i).replace('{m}', steps);
      this.el.querySelector('.in-next').textContent = this.i >= last ? T.again : T.next;
      this.cancelSkip();
      this.el.classList.toggle('in-first', first); this.el.classList.toggle('in-last', this.i >= last);
    },

    // Скопировать ссылку: настоящий буфер обмена есть только на https, на локальной сети (http) работает прежний способ через выделенное поле. Поле — шрифтом 16 px и «только для чтения»: меньший шрифт
    // заставляет iPhone приблизить страницу при фокусе (а приближенную страницу как раз и надо избегать).
    copyLink(btn) {
      const T = Ale.T.install, label = btn.dataset.label || (btn.dataset.label = btn.textContent);          // подпись запоминается один раз: при втором нажатии за 2,2 с кнопка иначе навсегда оставалась «Ссылка скопирована»
      const show = (msg) => { btn.textContent = msg; clearTimeout(btn._copyT); btn._copyT = setTimeout(() => { btn.textContent = label; }, this.COPY_MS); };
      const ok = () => show(T.copied), fail = () => show(T.copyManual);
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(location.href).then(ok, () => (this._copyOld() ? ok() : fail())); return; } } catch (e) { /* ок */ }
      if (this._copyOld()) ok(); else fail();
    },
    _copyOld() {
      const t = document.createElement('textarea'); let done = false;
      t.value = location.href; t.readOnly = true; t.setAttribute('aria-hidden', 'true');
      t.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;-webkit-user-select:text;user-select:text';          // выделяемое: на странице выделение запрещено везде, а iOS не даёт выделить такое поле программно
      document.body.appendChild(t);
      try { t.focus({ preventScroll: true }); t.select(); t.setSelectionRange(0, t.value.length); done = !!document.execCommand('copy'); } catch (e) { /* ок */ }
      t.remove();
      return done;
    },

    // «Всё равно играть в браузере»: сначала карточка с предупреждением («Вернуться» / «Играть в браузере»), игра стартует только с её кнопки
    askSkip() {
      if (!this.el) return;
      this.skipAsked = true; this.el.querySelector('.in-ask').hidden = false; this.el.classList.add('in-asking');
      const stay = this.el.querySelector('.in-stay'); if (stay && stay.focus) { try { stay.focus({ preventScroll: true }); } catch (e) { /* ок */ } }
    },
    cancelSkip() {
      this.skipAsked = false;
      if (!this.el) return;
      this.el.querySelector('.in-ask').hidden = true; this.el.classList.remove('in-asking');
    },

    // запомнить на время вкладки и запустить игру
    skip() {
      try { sessionStorage.setItem('ale-install-skip', '1'); } catch (e) { /* без хранилища */ }
      this.close();
    },
    close() {
      if (!this.el) return;
      window.removeEventListener('keydown', this._key);
      this.el.remove(); this.el = null; document.body.classList.remove('install-on');
      const cb = this.onDone; this.onDone = null; if (cb) cb();
    },
  });
})();
