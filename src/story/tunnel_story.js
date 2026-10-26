// Сюжет туннеля: падение, погоня за Даней (он по-настоящему бежит, перепрыгивает ящики и катит бочки), бой на арене, возврат ключа.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.TunnelStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, p = sc.player, X = Ale.TUNNEL, tx = Ale.tx;
      for (const f of ['clerk_talked', 'tomatoes_taken', 'boss_defeated', 'hatch_armed']) F[f] = true;
      G.checkpoint('tunnel', entry === 'arena' ? 'arena' : 'start');
      UI.setObjective(T.obj.catch);
      let fight = false, dan = null;
      const cam = { x: 3200, y: 600, vx: 0 };
      const END = X.arena1 - 120;             // где Даня останавливается перед боем

      const newDan = (x, facing) => {
        dan = sc.add(new Ale.Danechka({ x, y: 600, facing, arena: { x0: X.arena0, x1: X.arena1 } }));
        sc.dan = dan; return dan;
      };
      const barrel = (x, dir) => sc.add(new Ale.RollingBarrel({ x, y: 600, dir, speed: 250, img: sc.wheelImg }));

      sc.onDanechkaHit = (d) => {
        if (d.hp > 0) UI.hint('danechka', T.danHit[Math.min(T.danHit.length - 1, Ale.DANECHKA.HP - 1 - d.hp)], 1.8);
        else sc.runScript(finale);
      };

      function* arenaIntro() {
        sc.locked = true; p.auto = null;
        dan = dan && !dan.dead ? dan : newDan(END, -1);
        if (Math.abs(dan.x - END) > 260 || dan.busy) { dan.x = END; dan.y = 600; dan.vx = dan.vy = 0; dan.state = 'script'; dan.ghost = false; }
        dan.auto = null; dan.facing = -1;
        sc.cameraTarget = cam;
        yield W.time(0.5);
        UI.setObjective(T.obj.danKey);                                    // «Догнать Даню» уже выполнено: он остановился, теперь надо отобрать ключ
        if (!F.dan_intro_seen) { yield UI.say(T.danFightIntro); G.remember('dan_intro_seen'); }
        dan.startFight(); fight = true;
        Ale.Audio.music('boss');
        sc.locked = false;
        UI.hint('bubel', T.hint.danFight, 5);
        // последняя пакость: с последней точки бега Даня пинает ещё одну бочку навстречу — она катится через всю арену, пока идёт бой
        dan.pose = 'kick1'; dan.giggle(0.5);
        yield W.time(0.25);
        dan.pose = 'kick2'; barrel(dan.x - 70, -1); Ale.Audio.sfx('barrel_kick');
        yield W.time(0.3);
        dan.pose = null;
      }

      function* finale() {
        sc.locked = true; fight = false; sc.boss = null; UI.clearHints();
        Ale.Audio.music('tunnel');
        for (const e of sc.entities) { if (e instanceof Ale.RollingBarrel) e.smash(); else if (e instanceof Ale.Projectile && e.team === 'enemy') e.dead = true; }
        dan.hasKey = true;
        p.pose = 'cheer';                                   // победа: кулак вверх, пока он сдаётся
        yield W.time(0.9);
        p.pose = null;
        const lines = T.danFinish.map((l, i) => (i === 1 ? [l[0], l[1], Object.assign({}, l[2], { do: () => { dan.hasKey = false; p.holdSprite = 'it_key'; Ale.Audio.sfx('key_get'); sc.fx.sparks(p.x + 50, p.y - 100, 10); UI.toast(T.toast.key, 'it_key'); UI.setObjective(T.obj.up); } })] : l));      // ключ у неё: цель сменилась вместе с тостом (не после разговора), настроение реплики сохранено
        yield UI.say(lines);
        G.set('key_back'); G.set('tunnel_done');
        G.checkpoint('postOffice', 'parcel');
        sc.cameraTarget = null; sc.locked = false;
        sc.exitDoor.locked = false; sc.exitDoor.arrow = true;
        sc.runScript(danyaLeaves);
      }

      // Проиграв, Даня не стоит столбом: убегает влево тем же путём, каким прибежал (через ящик с корзиной), за край экрана — и пропадает
      function* danyaLeaves() {
        const d = dan; if (!d || d.dead) return;
        d.pose = null; d.hasKey = false; d.vulnerable = false; d.vx = 0; d.auto = null; d.state = 'script'; d.facing = -1;
        d.autoWalk(X.basket + 160, { speed: Ale.DANECHKA.RUN, arrive: 6 }); yield W.until(() => !d.auto);
        d.leapTo(X.basket, 508, { clear: 44 }); yield W.until(() => d.state === 'script');
        d.leapTo(X.arena0 - 90, 600, { clear: 44 }); yield W.until(() => d.state === 'script');
        d.autoWalk(X.arena0 - 520, { speed: Ale.DANECHKA.RUN, arrive: 6 });
        yield W.until(() => !d.auto || d.x < sc.camera.x - 120);
        d.dead = true;
      }

      let emptyT = 0;
      sc.onTick = (dt) => {
        if (fight && G.state.tomatoes === 0 && !UI.modal && !p.down) { emptyT += dt; if (emptyT > 2.5) { emptyT = -14; UI.hint('bubel', T.hint.refillTunnel, 5); } } else if (G.state.tomatoes > 0) { emptyT = 0; UI.hints = UI.hints.filter((h) => h.text !== T.hint.refillTunnel); }
        if (fight && dan && !dan.dead) { cam.x = Ale.clamp((p.x + dan.x) / 2, 3060, 3380); cam.vx = 0; }
      };

      // ----- погоня: Даня всё время на виду, бежит вперёд, ждёт Алесю у препятствий и не исчезает
      // Туннель ОТКРЫВАЕТСЯ открыткой (она подписана «Люк, туннель и хихиканье впереди»): она встаёт с первого кадра проявления (instant), а сценарий стартует без паузы проявления (noScriptHold) — иначе секунду
      // виден туннель с падающей героиней, и только потом иллюстрация (владелец 15.10.2026: «прежде чем появится картинка, на долю секунды появляется обычный геймплей — эффект недоработки»). Падение по шахте — после открытки.
      const opening = entry !== 'arena' && Ale.Cards.willShow('still_04_tunnel_chase', { once: true });
      if (opening) sc.noScriptHold = true;
      sc.runScript(function* () {
        if (entry === 'arena') { yield* arenaIntro(); return; }
        const d = newDan(1180, -1);
        sc.locked = true;
        if (opening) yield Ale.Cards.show('still_04_tunnel_chase', { once: true, instant: true });
        yield W.until(() => p.onGround);
        yield W.time(0.5);
        if (!F.tunnel_intro_seen) { yield UI.say(Ale.StoryKit.cue(T.tunnelIn, { 1: () => d.giggle(0.9) })); G.remember('tunnel_intro_seen'); }       // «Слышишь, хихикает?» — Даня хихикает на этой реплике          // после поражения в погоне вступление не повторяется (как у боссов) — 11.10.2026
        // камера показывает, кого догонять
        sc.cameraTarget = { x: 1000, y: 600, vx: 0 };
        d.giggle(0.9); UI.hint('danechka', T.tunnelTaunts[0], 2.4);
        yield W.time(1.6);
        sc.cameraTarget = null; sc.locked = false;
        UI.hint('bubel', tx(T.hint.tunnelGo), 5);

        const run = function* (x, speed) { d.autoWalk(x, { speed: speed || D_RUN, arrive: 6 }); yield W.until(() => !d.auto); };
        const D_RUN = Ale.DANECHKA.RUN;
        const pace = (dist) => W.until(() => d.x - p.x < dist);          // ждёт, пока Алеся не подойдёт ближе dist
        const leap = function* (x, y, o) { d.leapTo(x, y, o); yield W.until(() => d.state === 'script'); };

        yield pace(760);
        // 1. бежит к ящикам-ступенькам и взбирается по ним
        yield* run(1570);
        yield pace(640);
        d.giggle(0.6);
        yield* leap(1770, 510, { clear: 44 });          // разбег заранее: в стену ящика прыжок упирается и теряет ход
        yield* leap(1882, 420, { clear: 44 });
        yield* leap(2070, 600, { clear: 40 });

        // 2. пакость: пинком пускает бочку навстречу
        yield* run(2260);
        yield pace(620);
        d.facing = -1; d.pose = 'kick1'; d.giggle(0.6);
        yield W.time(0.25);
        d.pose = 'kick2'; barrel(d.x - 70, -1); Ale.Audio.sfx('barrel_kick');
        UI.hint('danechka', T.tunnelTaunts[1], 2.4);                    // «Бочки! Я предупредил!» — вместе с первой бочкой (раньше звучало за несколько секунд до неё)
        yield W.time(0.3);
        d.pose = null;

        // 3. ещё одна: на последнем отрезке перед ареной
        yield* run(2600);
        yield pace(620);
        d.facing = -1; d.pose = 'kick1';
        yield W.time(0.25);
        d.pose = 'kick2'; barrel(d.x - 70, -1); Ale.Audio.sfx('barrel_kick');
        UI.hint('danechka', T.tunnelTaunts[2], 2.4);                    // «Да ладно тебе, это же шутка!» — со второй
        yield W.time(0.3);
        d.pose = null;

        // 4. на арену: взбирается на ящик с помидорами, спрыгивает, убегает в дальний конец и разворачивается
        d.giggle(0.6);
        yield* leap(X.basket, 508, { clear: 40 });
        yield* leap(2930, 600, { clear: 50 });
        yield* run(END);
        d.facing = -1;
        yield W.until(() => p.x > X.arena0 + 40);
        G.checkpoint('tunnel', 'arena');
        yield* arenaIntro();
      });
    },
  };
})();
