// Сюжет на почте: вступление и обучение Бубела, разговор со служащим, возвращение с ключом и кража, люк, шкаф и посылка.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  function env(sc) {
    const G = Ale.Game;
    return { G, S: G.state, F: G.state.flags, UI: Ale.UI, T: Ale.T, W: Ale.Wait, p: sc.player, bubel: sc.bubel, X: Ale.POST, tx: Ale.tx };
  }

  const PostStory = (Ale.PostStory = {
    setup(sc, entry) {
      const e = env(sc);
      // Для запуска с ?scene=postOffice&entry=... — подставляем флаги, которые к этому моменту уже должны быть.
      const base = ['clerk_talked', 'tomatoes_taken', 'tut_train', 'intro_seen', 'tut_move', 'tut_jump'];
      const need = {
        return: base.concat(['boss_defeated', 'has_key']),
        hatch: base.concat(['boss_defeated']),
        parcel: base.concat(['boss_defeated', 'has_key', 'hatch_armed', 'key_back', 'tunnel_done']),
        exit: base.concat(['boss_defeated', 'has_key', 'hatch_armed', 'key_back', 'tunnel_done', 'parcel_opened', 'has_apple', 'note_seen']),
      }[entry] || [];
      for (const f of need) if (!e.F[f]) e.F[f] = true;
      sc.backDoor.lockedText = e.T.hint.backDoor;
      sc.onBackDoor = () => { e.G.checkpoint('yard', 'start'); e.G.goto('yard', 'start'); };
      if (entry === 'parcel' || entry === 'exit') { sc.hatch.stage = 2; sc.hatch.board(); }
      Ale.PostParcel.setup(sc, e, entry);
      // шкаф до возврата ключа заперт
      const openScript = sc.cabinet.onInteract;
      sc.cabinet.onInteract = () => (e.F.key_back ? openScript() : e.UI.hint('bubel', e.F.hatch_armed ? e.T.hint.cabinetDan : e.F.has_key ? e.T.hint.cabinetHave : !e.F.clerk_talked ? e.T.hint.cabinetAsk : e.T.hint.cabinetLocked, 3.5));
      if (entry === 'return') return this.returnEntry(sc, e);
      if (entry === 'hatch') return this.hatchEntry(sc, e);
      if (entry === 'exit') return this.exitEntry(sc, e);
      if (entry === 'parcel') return;
      return this.start(sc, e);
    },

    // ------------------------------------------------------------------ начало и обучение
    start(sc, e) {
      const { G, F, UI, T, W, p, bubel, X, tx } = e;
      G.checkpoint('postOffice', 'start');
      const refresh = () => {
        if (!F.clerk_talked) UI.setObjective(T.obj.talk);
        else if (!F.tomatoes_taken) UI.setObjective(T.obj.tomatoes);
        else if (!F.tut_train) UI.setObjective(T.obj.train);
        else UI.setObjective(T.obj.street);
        sc.door.arrow = !!(F.clerk_talked && F.tomatoes_taken && F.tut_train);
      };
      refresh();

      sc.clerk.onTalk = () => sc.runScript(function* () {
        if (!F.clerk_talked) {
          yield UI.say(T.clerkFirst);
          G.set('clerk_talked'); refresh();
        } else yield UI.say(F.tomatoes_taken ? T.clerkAgain2 : T.clerkAgain1);
      });

      sc.onBasket = () => refresh();

      sc.onDoor = () => {
        if (!F.clerk_talked) return UI.hint('bubel', T.hint.doorLocked1, 3.5);
        if (!F.tomatoes_taken) return UI.hint('bubel', T.hint.doorLocked2, 3.5);
        if (!F.tut_train) return UI.hint('bubel', T.hint.doorTraining, 3.5);
        G.checkpoint('street', 'start');
        G.goto('street', 'start');
      };

      // Мини-урок: крыса вылезает из норки; учебные крысы не кусаются. Каждый приём — плашка с клавишами, ждём, пока игрок его сделает.
      function* lesson(tipKey, stopAt, okKey) {
        const rat = sc.add(new Ale.Rat({ x: X.mouse, y: 600, training: true, stopAt, facing: -1 }));
        Ale.Audio.sfx('squeak');
        UI.tip(T.tip[tipKey]);
        yield W.until(() => {
          // урок с помидором: если все промахнулись — в ящике нашлись ещё, чтобы игрок не застрял
          if (tipKey === 'throw' && G.state.tomatoes === 0 && !sc.entities.some((x) => x instanceof Ale.Projectile && x.team === 'player' && !x.dead)) {
            G.state.tomatoes = 3; sc.fx.text(p.x, p.y - 190, T.fx.bonus, { size: 26, life: 1.2 });
          }
          return rat.dead || rat.state === 'dead';
        });
        UI.tipDone();
        UI.hint('bubel', T[{ jump: 'trainOk1', stomp: 'trainOk2', tomato: 'trainOk3' }[rat.kind] || okKey], 4.8);       // хвалит за то, чем крыса убита на самом деле, а не за то, что просила плашка
        yield W.time(2.4);
      }

      function* training() {
        UI.setObjective(T.obj.train);
        sc.locked = true;
        yield W.time(0.3);
        yield UI.say(Ale.StoryKit.cue(T.trainIntro, { 0: () => Ale.Audio.sfx('squeak') }));          // «Слышишь, как пищит в стене?» — и правда слышно
        sc.locked = false;
        yield* lesson('hop', 300, 'trainOk1');
        yield* lesson('stomp', 300, 'trainOk2');
        if (G.state.tomatoes < 3) G.state.tomatoes = Ale.PLAYER.MAX_TOMATOES;
        yield* lesson('throw', 560, 'trainOk3');
        G.set('tut_train');          // как разговор со служащим и ящик (тоже только состояние): «Заново с последней точки» проходит обучение с них заново, а не оставляет его половину сделанной (18.10.2026)
        refresh();
        UI.hint('bubel', tx(T.hint.goStreet), 6);
      }

      // Обучение — один раз; управление всё время у игрока.
      // Игра НАЧИНАЕТСЯ с открытки: она встаёт с первого кадра проявления (instant), а сценарий стартует без паузы проявления (noScriptHold) — иначе первые полсекунды виден мир, и только потом
      // открывается иллюстрация (владелец 15.10.2026: «после кнопки начать играть появляется Алеся на почте на пол секунды, и уже после этого вылазит иллюстрация — эффект недоработки»)
      if (!F.intro_seen && Ale.Cards.willShow('still_01_post_office', { once: true })) sc.noScriptHold = true;
      sc.runScript(function* () {
        if (!F.intro_seen) {
          sc.locked = true;
          yield Ale.Cards.show('still_01_post_office', { once: true, instant: true });         // первая открытка: Алеся и Бубел входят на почту
          yield W.time(1.0);
          yield UI.say(T.intro);
          G.remember('intro_seen');
          sc.locked = false;
        }
        if (!F.tut_move) {
          UI.tip(T.tip.move);
          yield W.until(() => Math.abs(p.x - X.start) > 170);
          UI.tipDone(); G.remember('tut_move');
          yield W.time(1.0);
        }
        if (!F.tut_jump && p.x < X.bags + 90) {
          yield W.until(() => p.x > X.bags - 340);
          UI.tip(T.tip.jump);
          yield W.until(() => (!p.onGround && p.vy < -300) || p.x > X.bags + 90);
          UI.tipDone(); G.remember('tut_jump');
          yield W.time(0.6);
        }
        if (!F.clerk_talked) {
          yield W.until(() => Math.abs(p.x - X.clerk) < 470);
          UI.tip(T.tip.talk);
          yield W.until(() => F.clerk_talked);
          UI.tipDone();
        }
        if (!F.tomatoes_taken) {
          UI.tip(T.tip.crate);
          yield W.until(() => F.tomatoes_taken);
          UI.tipDone();
          yield W.time(1.2);
        }
        yield W.until(() => !UI.dlg);
        if (!F.tut_train) yield* training();
      });
    },

    // ------------------------------------------------------------------ вернулись с ключом: кража
    returnEntry(sc, e) {
      const { G, F, UI, T, W, p, bubel, X, tx } = e;
      G.checkpoint('postOffice', 'return');
      p.holdSprite = 'it_key';
      p.x = X.start; bubel.x = p.x - 80;                                 // вернулись с ключом: как и в начале игры — правее левой группы экранных кнопок
      UI.setObjective(T.obj.giveKey);
      const dan = sc.add(new Ale.Danechka({ x: X.counter + X.counterW + 40, y: 600, facing: -1, arena: { x0: 0, x1: 3000 } }));
      sc.dan = dan;
      const hatch = sc.hatch;
      const follow = { get x() { return dan.x; }, y: 600, get vx() { return dan.vx; } };

      sc.runScript(function* () {
        yield W.time(0.8);
        UI.hint('bubel', T.hint.keyBack, 5);
        yield W.until(() => p.x > X.counter - 60 && p.onGround && p.y > 590);
        // ---- начало сцены: управление у сценария
        UI.clearHints(); sc.locked = true; p.auto = null;
        yield UI.say(T.returnClerk);
        dan.giggle(0.9);
        yield W.walkTo(dan, p.x + 210, { speed: 150 });
        p.facing = 1; dan.facing = -1;
        yield UI.say(T.theft);
        // прыжок-«хвать»: присел, прыгнул, схватил ключ и приземлился рядом
        dan.leapTo(p.x + 62, 600, { pose: 'grab', clear: 46, after: 'script' });
        yield W.until(() => dan.state === 'land');
        p.holdSprite = null; dan.hasKey = true; p.startle(1);
        sc.fx.sparks(p.x + 50, p.y - 90, 8); Ale.Audio.sfx('key_grab'); sc.camera.shake(5, 0.2);
        yield W.time(0.5);
        yield Ale.Cards.show('still_03_key_theft', { once: true });    // кража ключа: Даня схватил ключ и приземлился — открытка (с 13.10.2026 полноэкранная), потом он убегает
        yield W.until(() => dan.state === 'script');
        dan.giggle(1.2); sc.fx.text(dan.x, dan.y - 205, T.fx.theft, { size: 24, life: 1.6 });
        // бежит к люку (настоящий бег), камера идёт за ним
        sc.cameraTarget = follow;
        yield W.walkTo(dan, X.hatch - 150, { speed: 440 });
        // крышку сдвинули, он прыгает вниз ногами в лаз (ниже кромки пола его уже не видно), и крышка возвращается на место
        hatch.open();
        dan.dive(X.hatch, hatch.rimY);
        yield W.until(() => dan.dead);
        hatch.close();
        yield W.time(0.8);
        sc.cameraTarget = null;
        sc.locked = false;
        yield UI.say(T.afterTheft);
        // люк теперь можно бить
        hatch.arm(); G.set('hatch_armed');
        Ale.Audio.prefetch(['tunnel']);          // музыка туннеля скачивается заранее, пока игрок идёт к люку
        G.checkpoint('postOffice', 'hatch');
        UI.setObjective(T.obj.hatch);
        // Бубел про люк ничего не знает: подсказывает только у самого люка
        yield W.until(() => Math.abs(p.x - X.hatch) < 420);
        UI.hint('bubel', tx(T.hint.hatchGo), 7);
      });
      this._hatchHooks(sc, e);
    },

    // ------------------------------------------------------------------ люк уже ждёт удара (чекпоинт)
    hatchEntry(sc, e) {
      const { G, UI, T, tx } = e;
      G.checkpoint('postOffice', 'hatch');
      e.p.x = Ale.POST.hatch - 320; e.bubel.x = e.p.x - 90;
      sc.hatch.arm();
      Ale.Audio.prefetch(['tunnel']);
      UI.setObjective(T.obj.hatch);
      UI.hint('bubel', tx(T.hint.hatchGo), 6);
      this._hatchHooks(sc, e);
    },

    _hatchHooks(sc, e) {
      const { G, UI, T, W, p } = e;
      // Второй удар игрок находит сам; если за 5 секунд после первого его нет — Бубел напоминает.
      sc.onCrack = () => sc.runScript(function* () {
        const t0 = sc.time;
        yield W.until(() => sc.hatch.stage >= 2 || sc.time - t0 > 5);
        if (sc.hatch.stage < 2) UI.hint('bubel', T.hatchCracked[0][1], 4);
      });
      sc.onHatchOpen = () => sc.runScript(function* () {
        UI.hint('bubel', T.hatchOpen[0][1], 4);
        yield W.until(() => p.y > 655);
        G.checkpoint('tunnel', 'start');
        G.goto('tunnel', 'start');
      });
    },

    // ------------------------------------------------------------------ посылка уже открыта: идём к служебному выходу
    exitEntry(sc, e) {
      const { G, UI, T, p, bubel, X } = e;
      const cab = sc.cabinet;
      cab.state = 'open'; cab.openT = 1; cab.fall = 2;
      sc.parcel.taken = true; sc.parcel.enabled = false;
      p.x = X.cabinet - 160; bubel.x = p.x - 90;
      p.holdSprite = 'it_apple';
      sc.backDoor.locked = false; sc.backDoor.arrow = true;
      G.checkpoint('postOffice', 'exit');
      UI.setObjective(T.obj.yard);
      UI.hint('bubel', T.hint.backGo, 6);
    },
  });

})();
