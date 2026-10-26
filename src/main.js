// Запуск: сенсорное управление, затем гайд по установке на экран «Домой» (на iPhone в обычной вкладке; src/install.js), и только потом игра: пока гайд открыт, картинки и звук не загружаются.
// Сбой на любом шаге (не скачался какой-то скрипт, нет canvas) показывает страж запуска (src/boot_guard.js): надпись и кнопку «Обновить страницу», а не тёмный экран.
(function () {
  const fail = function (e) { if (window.Ale && window.Ale.bootFail) window.Ale.bootFail(e); else throw e; };
  try {
    window.Ale.Touch.init();
    window.Ale.Install.start(function () { try { window.Ale.Game.boot(); } catch (e) { fail(e); } });
  } catch (e) { fail(e); }
})();
