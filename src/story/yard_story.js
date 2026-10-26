// Сюжет двора: знакомство с Преслюканом, яблоко, седло и отъезд на дорогу в аэропорт.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.YardStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, p = sc.player, bubel = sc.bubel, horse = sc.horse, X = Ale.YARD, tx = Ale.tx;
      for (const f of ['clerk_talked', 'tomatoes_taken', 'tut_train', 'boss_defeated', 'tunnel_done', 'parcel_opened', 'has_apple']) F[f] = true;
      G.checkpoint('yard', 'start');
      UI.setObjective(T.obj.feed);
      p.holdSprite = 'it_apple';

      horse.onInteract = () => sc.runScript(feed);

      function* feed() {
        sc.locked = true; UI.clearHints();
        sc.cameraTarget = horse;
        p.autoWalk(horse.x - 150, { speed: 190, arrive: 6 });
        bubel.autoWalk(horse.x - 240, { speed: 240, arrive: 10 });
        yield W.until(() => !p.auto);
        p.facing = 1; horse.facing = -1;
        yield UI.say(T.yardFeed);
        // яблоко летит из руки Алеси к морде коня
        p.holdSprite = null;
        const a0 = { x: p.x + 58, y: p.y - 92 }, a1 = horse.mouth('down');
        sc.add(new Ale.Decor({ x: a0.x, y: a0.y, z: 70, draw: (ctx, d) => {
          const k = Ale.clamp(d.t / 0.55, 0, 1);
          const x = Ale.lerp(a0.x, a1.x, k), y = Ale.lerp(a0.y, a1.y, k) - Math.sin(k * Math.PI) * 46;
          // у морды яблоко «переходит» в нарисованное на кадре коня: летящее гаснет
          if (k < 1) Ale.drawSprite(ctx, 'it_apple', x, y, { sx: 0.75, sy: 0.75, rot: k * 5, alpha: Ale.clamp((0.88 - k) / 0.18, 0, 1) }); else d.dead = true;
        } }));
        yield W.time(0.4);
        horse.state = 'eat'; horse.eatT = 0;          // конь опускает голову к яблоку
        yield W.time(0.15);
        yield Ale.Cards.show('still_05_apple', { once: true });         // открытка — в самый миг кормления: яблоко долетело до морды, конь взял его (владелец 13.10.2026); потом жуёт
        Ale.Audio.sfx('horse_munch');                 // жуёт одним звуком; сердечки идут тихо (раньше на каждое играл «хруст», он звучал как хлопки)
        for (let i = 0; i < 4; i++) { sc.fx.hearts(horse.x - 30, horse.y - 150, 1); yield W.time(0.4); }
        horse.state = 'idle'; horse.swallow = 0.7;
        G.set('horse_fed');
        UI.setObjective(T.obj.ride);                                       // яблоко съедено — цель уже «доскакать» (не «Угостить Преслюкана» над разговором о поездке)
        yield W.time(0.3);
        yield UI.say(T.yardAte);
        // Алеся в седле: конь разворачивается, встаёт на дыбы и трогается
        p.autoWalk(horse.x - 46, { speed: 190, arrive: 6 });
        yield W.until(() => !p.auto);
        p.hidden = true; horse.mounted = true; horse.facing = 1; horse.hop = 0.3;
        Ale.Audio.sfx('jump'); sc.fx.sparks(horse.x, horse.y - 110, 8);
        // Бубел срывается за конём сразу, как Алеся села в седло, и бежит следом до ворот: цель — чуть позади седла и обновляется каждый кадр, скорость выше конской (владелец 13.10.2026: «когда мы ускакиваем —
        // Бубел не сразу бежит за нами»; раньше он ждал ещё полсекунды после посадки, бежал к одной точке впереди, добегал и стоял, пока конь уходил без него)
        // Погоня идёт и пока экран гаснет перед скачкой (sc.onTick живёт до смены сцены): иначе она обрывалась у ворот, а конь уходил на полэкрана вперёд
        for (const r of sc.world.solids.filter((r) => r.kind === 'hay')) sc.world.remove(r);          // тюки сена — декорация: конь проходит сквозь них, а собаке они были бы стеной (она застревала на них, и конь уходил на 500 юн. вперёд)
        sc.onTick = () => bubel.autoWalk(horse.x - 70, { speed: 640, arrive: 6 });
        yield W.time(0.5);
        horse.state = 'ride'; horse.vx = 0; horse.rideSpeed = 470;
        Ale.Audio.sfx('snort');
        yield W.until(() => horse.x > X.gate - 10);
        G.checkpoint('ride', 'start');
        G.goto('ride', 'start', { fade: 0.7 });
      }

      sc.runScript(function* () {
        sc.locked = true;
        yield W.time(1.5);
        sc.cameraTarget = horse;
        yield W.time(1.0);
        yield UI.say(T.yardIn);
        sc.cameraTarget = null;
        sc.locked = false;
        UI.hint('bubel', tx(T.hint.appleGo), 6);
      });
    },
  };
})();
