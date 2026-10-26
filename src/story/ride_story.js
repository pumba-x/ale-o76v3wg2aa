// Сюжет скачки: подсказки по ходу маршрута, контрольная точка на середине, финал у аэропорта.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.RideStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, R = Ale.RIDE, rider = sc.player, tx = Ale.tx;
      for (const f of ['clerk_talked', 'tomatoes_taken', 'tut_train', 'boss_defeated', 'tunnel_done', 'parcel_opened', 'has_apple', 'horse_fed']) F[f] = true;
      G.checkpoint('ride', entry === 'mid' ? 'mid' : 'start');
      UI.setObjective(T.obj.ride);
      const said = {};
      if (entry === 'mid') { said.l0 = said.l1 = said.mid = true; }        // возобновление с середины: набережная и башня позади, контрольная точка уже взята
      const say = (key, who, text, dur) => { if (said[key]) return; said[key] = true; UI.hint(who, text, dur || 4); };
      let hitLine = 0, hitCool = 0;

      sc.onRiderHit = () => {
        if (hitCool > 0) return;
        hitCool = 5; UI.hint('bubel', T.rideHit[hitLine++ % T.rideHit.length], 2.4);
      };

      sc.onTick = (dt) => {
        if (hitCool > 0) hitCool -= dt;
        const k = rider.x / R.LEN;
        if (k > 0.057) say('jump', 'bubel', tx(T.hint.rideJump), 6);          // x > 1480 ≈ 2,6 с от старта: ответ Бубел на «не отставай» (до ≈ 2,45 с) успевает кончиться; первая группа препятствий — на x ≈ 2230 (≈ 4,3 с, за 330 юн. до неё ≈ 3,5 с): подсказка успевает раньше неё (при 0,1 она приходила после первого ящика)
        if (k > 0.21) say('l0', 'bubel', T.rideLines[0], 4);      // набережная начинается с 0.2, башня — в центре кадра на 0.3
        if (k > 0.28) say('l1', 'bubel', T.rideLines[1], 4);
        if (k > 0.93) say('l3', 'bubel', T.rideLines[2], 4);
        if (k > 0.5 && !said.mid && !sc.locked && rider.state === 'run') { said.mid = true; G.checkpoint('ride', 'mid'); UI.toast(T.toast.checkpoint, 'pr_tomato'); }
        if (rider.x >= R.END && !sc.finishing) { sc.finishing = true; sc.runScript(finish); }
      };

      function* finish() {
        sc.locked = true; rider.forced = 0; UI.clearHints(); UI.setObjective(T.obj.gate);
        yield W.until(() => rider.vx < 6);
        Ale.Audio.sfx('snort');
        sc.fx.dust(rider.x + 30, rider.y, 8, 1, 1.4);
        yield W.time(0.6);
        // карточка скачки — в самом конце, пока идёт остановка (стоит, пыль, фырканье): она же сглаживает переход к сцене аэропорта (владелец 13.10.2026). Закрывается в чёрное (toBlack): мир между
        // открыткой и затемнением больше не мелькает (владелец 15.10.2026: «появляется картинка, а до или после на долю секунды — обычный геймплей: эффект недоработки»)
        const card = Ale.Cards.willShow('still_06_gallop', { once: true });
        yield Ale.Cards.show('still_06_gallop', { once: true, toBlack: true });
        if (!card) yield W.time(0.3);                                      // открытки нет (уже показывали): прежняя пауза, переход обычным затемнением
        G.checkpoint('airport', 'start');
        G.goto('airport', 'start', { fade: card ? 0.3 : 0.8 });          // после открытки экран уже чёрный: затемнять нечего, короткая пауза в темноте и проявление аэропорта
      }

      // старт: короткий обмен репликами, пока конь разгоняется
      if (entry !== 'mid') {
        sc.runScript(function* () {
          yield W.time(0.12); UI.hint('ale', T.rideStart[0][1], 2.1);
          yield W.time(0.33); UI.hint('bubel', T.rideStart[1][1], 2.0);       // обмен (каждое облачко живёт столько, сколько нужно, чтобы его прочитать) кончается до подсказки про прыжок: она тоже от Бубел и заменила бы эту реплику
        });
      }
    },
  };
})();
