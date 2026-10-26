// Сюжет улицы: короткое напоминание о приёмах при первой крысе, цель — ASSAS.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.StreetStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, p = sc.player;
      for (const f of ['clerk_talked', 'tomatoes_taken', 'tut_train']) F[f] = true;
      if (G.state.tomatoes < 1) G.state.tomatoes = Ale.PLAYER.MAX_TOMATOES;
      G.checkpoint('street', 'start');
      UI.setObjective(T.obj.street);
      const alive = () => sc.rats.filter((r) => !r.dead && r.state !== 'dead');

      sc.runScript(function* () {
        yield W.time(1.6);
        UI.hint('bubel', T.hint.streetGo, 5);
        // приёмы уже показаны на разминке: здесь только короткое напоминание при первой настоящей крысе
        if (!F.tut_street_rats) {
          yield W.until(() => alive().some((r) => Math.abs(r.x - p.x) < 560));
          UI.hint('bubel', T.hint.ratReminder, 6);
          G.remember('tut_street_rats');
        }
      });
    },
  };
})();
