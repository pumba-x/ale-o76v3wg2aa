// Сюжет аэропорта: приезд на коне, зал (металлодетектор, крысы у карусели), допрос у стойки посадки (три вопроса с вариантами ответа), трап и взлёт.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.AirportStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, p = sc.player, bubel = sc.bubel, horse = sc.horse, agent = sc.agent, X = Ale.AIRPORT, tx = Ale.tx;
      for (const f of ['clerk_talked', 'tomatoes_taken', 'tut_train', 'boss_defeated', 'tunnel_done', 'parcel_opened', 'has_apple', 'horse_fed']) F[f] = true;
      if (G.state.tomatoes < 1) G.state.tomatoes = Ale.PLAYER.MAX_TOMATOES;
      G.checkpoint('airport', entry === 'gate' ? 'gate' : 'start');
      UI.setObjective(T.obj.gate);
      const alive = () => sc.rats.filter((r) => !r.dead && r.state !== 'dead');

      // ---- допрос у стойки посадки (T.check): дежурная задаёт три вопроса с вариантами ответа. Верные ответы она запоминает, ошибки выясняются
      // в конце разговора — посадку не разрешают. При следующем обращении сценарий уже другой (не «с нуля»): дежурная помнит сказанное,
      // Алеся придумывает оправдание, и отвечать заново нужно только на те вопросы, где вышла ошибка. Состояние живёт, пока жива сцена.
      const C = T.check, ck = (sc.check = { tries: 0, ok: {}, bad: {} });
      const pick = (arr, i) => arr[Math.max(0, Math.min(i, arr.length - 1))];

      function* askQuestion(id) {
        const q = C.q[id];
        const ask = UI.say([['agent', pick(q.ask, ck.tries), { choices: q.options, qid: id, mood: C.mood.ask }]]);
        yield ask;
        const i = Math.max(0, ask.choice), o = q.options[i];
        const lines = [['ale', o.say], ['agent', o.react, { mood: o.mood }]];
        if (o.bubel) lines.push(['bubel', o.bubel, { mood: o.bubelMood }]);
        yield UI.say(lines);
        if (o.right) { ck.ok[id] = true; delete ck.bad[id]; } else { ck.ok[id] = false; ck.bad[id] = i; }
      }

      agent.onTalk = () => sc.runScript(function* () {
        if (F.boarded) { yield UI.say(T.gateBoarded); return; }
        sc.locked = true; UI.clearHints();
        UI.setObjective(T.obj.check);                                      // она уже у стойки: цель «Дойти до стойки посадки» на время допроса была бы неправдой
        const again = ck.tries > 0;
        if (!again) {
          yield Ale.Cards.show('still_07_interrogation', { once: true });          // начало допроса: открытка до первой реплики (с 13.10.2026 полноэкранная)   // допрос у стойки — тихая открытка (картина заказа 25, с 10.10.2026 в сборке; у Алеси на ней прежние волосы до заказа 28, D13)
          // билет появляется в руке в тот миг, когда Алеся говорит «Вот.» (вторая реплика), и остаётся до конца разговора
          yield UI.say(C.intro.map((l, i) => (i === 1 ? [l[0], l[1], Object.assign({}, l[2], { do: () => { p.holdSprite = 'it_ticket'; Ale.Audio.sfx('key_get'); } })] : l)));
        } else {
          yield UI.say([['agent', pick(C.again, ck.tries - 1), { mood: pick(C.mood.again, ck.tries - 1) }]].concat(C.order.some((id) => ck.ok[id]) ? [['agent', C.againOk, { mood: C.mood.againOk }]] : []));
        }
        for (const id of C.order) {
          if (ck.ok[id]) continue;
          // не с нуля: дежурная помнит, что именно было сказано, а Алеся придумывает оправдание
          if (again && ck.bad[id] !== undefined) yield UI.say([['agent', C.q[id].options[ck.bad[id]].recall, { mood: C.mood.recall }]].concat(pick(C.q[id].excuse, ck.tries - 1)));
          yield* askQuestion(id);
        }
        const bad = C.order.filter((id) => !ck.ok[id]);
        if (bad.length) {
          const k = ck.tries;
          yield UI.say([['agent', pick(C.fail.head, k), { do: () => Ale.Audio.sfx('wrong'), mood: C.mood.head }]]
            .concat(bad.map((id) => ['agent', C.q[id].options[ck.bad[id]].blame, { mood: C.mood.blame }]), [['agent', pick(C.fail.tail, k), { mood: C.mood.tail }], ['bubel', pick(C.fail.bubel, k), { mood: pick(C.fail.bubelMood, k) }]]));
          ck.tries++;
          p.holdSprite = null;
          UI.setObjective(T.obj.gateRetry);
          sc.locked = false;
          UI.hint('bubel', T.hint.gateRetry, 5);
          return;
        }
        yield UI.say((again ? C.pass.again : C.pass.first).map((l, i) => (i === 0 ? [l[0], l[1], Object.assign({}, l[2], { do: () => { p.holdSprite = 'it_ticket'; Ale.Audio.sfx('unlock'); UI.setObjective(T.obj.board); } })] : l)));
        yield Ale.Cards.show('still_08_boarding', { once: true });
        p.holdSprite = null;
        G.set('boarded');
        sc.jetDoor.locked = false; sc.jetDoor.arrow = true;
        UI.setObjective(T.obj.board);
        G.checkpoint('airport', 'gate');
        sc.locked = false;
        UI.hint('bubel', T.hint.jetGo, 5);
      });

      sc.onJet = () => sc.runScript(function* () {
        sc.locked = true; UI.clearHints();
        p.autoWalk(X.jet, { speed: 200, arrive: 6 }); bubel.autoWalk(X.jet - 20, { speed: 240, arrive: 6 });
        yield W.until(() => !p.auto);
        p.hidden = true; bubel.hidden = true;
        yield W.time(0.4);
        G.set('chapter_done');
        G.checkpoint('takeoff', 'start', { heal: false });
        G.goto('takeoff', 'start', { fade: 0.9 });
      });

      // ---- начало: вступление на площади
      if (entry === 'gate') {
        p.x = X.gate - 220; bubel.x = p.x - 90; horse.dead = true;
        for (const r of sc.rats) r.dead = true;                                    // крысы этого прохода уже побеждены: после «Продолжить» они не должны стоять вокруг героини у стойки (11.10.2026)
        F.boarded = true; sc.jetDoor.locked = false; sc.jetDoor.arrow = true;      // билет уже проверен
        UI.setObjective(T.obj.board);
        UI.hint('bubel', T.hint.jetGo, 5);
        return;
      }
      let beeped = false, chimed = false;
      sc.onTick = (dt) => {
        if (sc.beepT > 0) sc.beepT -= dt;
        if (!beeped && p.x > X.arch + 10) {
          beeped = true; sc.beepT = 1.6; Ale.Audio.sfx('beep');
          UI.hint('bubel', T.detector, 4.5);
        }
        if (!chimed && p.x > X.hallStart + 60) { chimed = true; Ale.Audio.sfx('chime'); UI.toast(T.toast.boarding, 'it_ticket'); }
      };

      sc.runScript(function* () {
        sc.locked = true;
        yield W.time(1.0);
        sc.cameraTarget = { x: (p.x + horse.x) / 2, y: 600, vx: 0 };
        if (!F.airport_arrive_seen) { yield UI.say(T.airportArrive); G.remember('airport_arrive_seen'); }          // после поражения у крыс разговор на площади не повторяется — 11.10.2026
        // Преслюкан трусит домой
        horse.state = 'trot'; horse.trotSpeed = -320; Ale.Audio.sfx('snort');
        yield W.time(1.4);
        sc.cameraTarget = null;
        sc.locked = false;
        UI.hint('bubel', T.hint.gateGo, 6);
        yield W.until(() => horse.x < -160);
        horse.dead = true;
      });
    },
  };
})();
