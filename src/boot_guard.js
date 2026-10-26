// Страж запуска (18.10.2026, проход «найти все проблемы»; грузится первым). Если файл игры не скачался (обрыв сети у человека, которому дали ссылку) или запуск упал до первого кадра, игра раньше
// оставалась тёмным экраном без единого слова: следующие скрипты бросали ReferenceError в консоль, а человек не знал, что делать. Теперь на экране надпись и кнопка «Обновить страницу».
// Ловит ошибку загрузки любого <script> (событие error не всплывает, поэтому слушатель стоит на этапе перехвата) и сбои запуска, о которых сообщает main.js (Ale.bootFail). Только DOM без разметки из
// строк и без инлайн-стилей из атрибутов: страница выкладки идёт с политикой безопасности (make_site.py), где разрешены только свои файлы.
(function () {
  'use strict';
  let shown = false;
  function show(msg) {
    if (shown) return false;
    shown = true;
    try {
      const d = document.createElement('div');
      d.id = 'bootfail';
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center;background:#120d16;color:#ffe9c4;font:600 18px/1.4 -apple-system,system-ui,"Segoe UI",sans-serif';
      const p = document.createElement('div');
      p.textContent = msg;
      p.style.cssText = 'max-width:30em';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Обновить страницу';
      b.style.cssText = 'margin-top:18px;min-height:48px;padding:0 24px;border:0;border-radius:14px;background:#ffd98a;color:#3a2431;font:800 17px/1 -apple-system,system-ui,"Segoe UI",sans-serif';          // отступ полем, а не gap: у iOS до 14.5 gap во flex не работает
      b.addEventListener('click', function () { try { location.reload(); } catch (e) { /* без перезагрузки остаётся только закрыть страницу */ } });
      d.appendChild(p);
      d.appendChild(b);
      (document.body || document.documentElement).appendChild(d);
      return true;
    } catch (e) {
      return false;
    }
  }
  const MSG = 'Не удалось загрузить игру. Проверь интернет и обнови страницу.';
  const OPTIONAL = /\/(tracks|sfx)\.js(?:[?#]|$)/;          // списки записанных треков и эффектов необязательны: без них игра играет синтезом (src/audio.js), и экран сбоя из-за них не нужен
  // Только свои скрипты: у страницы выкладки политика безопасности не пускает чужие <script src> (расширения браузера, переводчик, чужие вставки), и их ошибка загрузки — не повод закрывать рабочую игру экраном сбоя
  // (адрес страницы берётся из document.baseURI, а не из location: во встроенных рамках проверок location.origin у WebKit — «null», хотя скрипты грузятся со своего адреса)
  const own = function (src) { try { return new URL(src, document.baseURI).origin === new URL(document.baseURI).origin; } catch (err) { return false; } };
  window.addEventListener('error', function (e) {
    const t = e && e.target;
    if (t && t !== window && t.tagName === 'SCRIPT' && own(t.src || '') && !OPTIONAL.test(t.src || '')) show(MSG);
  }, true);
  const Ale = (window.Ale = window.Ale || {});
  Ale.bootFail = function (err) { try { console.error(err); } catch (e) { /* консоли нет */ } return show(MSG); };
  Ale.bootGuard = { show: show, message: MSG, shown: function () { return shown; } };
})();
