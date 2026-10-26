// Бой с преподавательницей: вступление, реакции, сдача, ключ.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  Ale.AssasStory = {
    setup(sc, entry) {
      const G = Ale.Game, F = G.state.flags, UI = Ale.UI, T = Ale.T, W = Ale.Wait, p = sc.player, t = sc.teacher, tx = Ale.tx, X = Ale.ASSAS;
      for (const f of ['clerk_talked', 'tomatoes_taken']) F[f] = true;
      G.checkpoint('assas', 'start');
      UI.setObjective(T.obj.key);
      let fight = false;
      const fightCam = { x: p.x, y: 600, vx: 0 };
      let emptyT = 0;
      // Бубел во время боя не бегает за героиней, а стоит в сторонке и болеет (владелец 02.10.2026): изредка выкрикивает короткую реплику
      // (облачко над головой, не диалог; пасть открыта, как при лае). Выкрик ставится в очередь на событие (начало боя, попадание, вторая фаза,
      // потеря сердца), говорится не чаще раза в CHEER_GAP секунд и не перебивает подсказку Бубела (обучающую) и диалог.
      const bubel = sc.bubel, CHEER_GAP = 4.5, PRIO = { hit: 1, hurt: 2, start: 3, phase2: 3 };
      let cheerQ = null, cheerCool = 0, lastHp = G.state.hp;
      const cheerAt = {};
      const cheerLine = (kind) => { const a = T.bubelCheer[kind], i = cheerAt[kind] = (cheerAt[kind] === undefined ? -1 : cheerAt[kind]) + 1; return a[i % a.length]; };
      const cheer = (kind, delay, text) => { if (cheerQ && PRIO[cheerQ.kind] > PRIO[kind]) return; cheerQ = { kind, t: delay || 0, text }; };
      sc.onTick = (dt) => {
        if (fight && G.state.tomatoes === 0 && !UI.modal && !p.down) { emptyT += dt; if (emptyT > 2.5) { emptyT = -14; UI.hint('bubel', T.hint.refill, 5); } } else if (G.state.tomatoes > 0) { emptyT = 0; UI.hints = UI.hints.filter((h) => h.text !== T.hint.refill); }          // взяла помидоры — подсказка «кончились» уходит сразу (раньше висела все 5 с над счётчиком «× 6»)
        if (!fight || !t || t.dead) return;
        let cx = p.x * 0.55 + t.x * 0.45;
        cx = Ale.clamp(cx, p.x - 380, p.x + 380);
        fightCam.x = cx; fightCam.vx = p.vx * 0.4;
        // сторонка — у левого края вида (позади героини, пока училка справа); с места Бубел уходит, только если вид уехал и он вот-вот выйдет из кадра
        // (или остался далеко от края): в полосе 30…330 юнитов от края он стоит, вне полосы — трусит на место в 130 юнитах от края
        const cam = sc.camera, viewL = cam.clampX(cx - cam.viewW / 2);
        if (bubel.x < viewL + 30 || bubel.x > viewL + 330) bubel.stayX = Ale.clamp(viewL + 130, X.arena0, X.arena1);
        // выкрики
        cheerCool = Math.max(0, cheerCool - dt);
        if (G.state.hp < lastHp && G.state.hp > 0) cheer('hurt', 0.5);          // на смертельном ударе «Держись!» уже не к чему
        lastHp = G.state.hp;
        if (cheerQ && cheerQ.kind === 'phase2' && t.state !== 'barrage') cheerQ = null;          // «Мел! Приседай и прыгай!» — только пока мел летит: после волны крик про мел был бы про то, чего нет на экране
        if (cheerQ) {
          cheerQ.t -= dt;
          if (cheerQ.t <= 0 && cheerCool <= 0 && !UI.modal && !sc.locked && !UI.hints.some((h) => h.who === 'bubel')) { UI.hint('bubel', cheerQ.text || cheerLine(cheerQ.kind), 2.4); cheerCool = CHEER_GAP; cheerQ = null; }
        }
      };

      sc.onTeacherShot = (kind) => {
        const key = { chalkHigh: 'tut_chalkH', chalkLow: 'tut_chalkL', paper: 'tut_paper' }[kind];
        if (!key || F[key]) return;
        G.set(key);
        const h = { chalkHigh: 'chalkHigh', chalkLow: 'chalkLow', paper: 'paper' }[kind];
        UI.hint('bubel', tx(T.hint[h]), 4.5);
      };
      sc.onTeacherSlap = () => { if (!F.tut_slap) G.set('tut_slap'); };

      // бросок к героине (обстрел издалека): короткий окрик над головой, не чаще раза в 6 с
      let rushSaid = -9, rushI = 0;
      sc.onTeacherRush = () => { if (sc.time - rushSaid > 6) { rushSaid = sc.time; UI.hint('teacher', T.bossRush[rushI++ % T.bossRush.length], 2.0); } };

      sc.onTeacherPhase2 = () => { UI.hint('teacher', T.bossPhase2[0], 2.8); cheer('phase2', 1.4, T.bubelCheer.phase2); };      // половина здоровья: фраза над головой, затем волна мела

      sc.onTeacherHit = (tc) => {
        const s = tc.stain;
        if (s < Ale.TEACHER.HP) UI.hint('teacher', T.bossHit[Math.min(s, T.bossHit.length) - 1], 2.6);
        if (s % 2 === 1 && s < Ale.TEACHER.HP) cheer('hit', 0.9, s === Ale.TEACHER.HP - 1 ? T.bubelCheer.last : undefined);      // на нечётных попаданиях; перед последним — «ещё одно»
        // попадание бодрит: на второй, четвёртой и шестой стадии Алеся возвращает себе сердце (мягче для неигроков); на половине здоровья (перед волной мела) — все
        if ((s === 2 || s === 4 || s === 6) && G.state.hp < G.state.maxHp) { p.heal(s === Ale.TEACHER.PHASE2_AT ? G.state.maxHp : 1); sc.fx.text(p.x, p.y - 176, Ale.T.fx.heart, { size: 24, color: '#ffb3c6' }); sc.fx.hearts(p.x, p.y - 120, 5); Ale.Audio.sfx('pickup'); }
        if (s >= Ale.TEACHER.HP) sc.runScript(defeat);
      };

      const onKeyPicked = () => {
        G.set('has_key'); G.set('boss_defeated');
        G.checkpoint('postOffice', 'return');
        sc.exitDoor.locked = false; sc.exitDoor.arrow = true;
        UI.setObjective(T.obj.back);
        UI.hint('bubel', T.hint.keyGo, 5);
      };

      function* defeat() {
        sc.locked = true; fight = false; cheerQ = null;
        bubel.mode = 'follow';                              // бой выигран: Бубел снова идёт за героиней
        UI.clearHints();
        for (const e of sc.entities) if (e instanceof Ale.Projectile && e.team === 'enemy') e.dead = true;   // летящие снаряды уже не в счёт
        t.markers.length = 0;                               // и красные круги под них — тоже
        sc.boss = null;
        Ale.Audio.music('paris');
        p.pose = 'cheer';                                   // победа: кулак вверх, пока она сдаётся
        yield W.time(0.9);
        p.pose = null;
        sc.cameraTarget = t;
        yield UI.say(T.bossSurrender);
        sc.add(new Ale.KeyItem({ x: t.x - 30, y: t.y - 120, vx: -190, vy: -560, onPick: onKeyPicked }));
        t.flee(sc.width + 260, () => {});
        Ale.Audio.sfx('teacher_flee');
        yield W.time(0.9);
        sc.cameraTarget = null;
        sc.locked = false;
        UI.hint('bubel', T.bossKeyDrop[0][1], 5);
      }

      // Начало: камера показывает преподавательницу, потом реплики, потом бой.
      sc.runScript(function* () {
        sc.locked = true;
        yield W.time(0.9);
        sc.cameraTarget = t;
        if (F.boss_intro_seen) { yield W.time(0.7); }        // после поражения вступление не повторяется
        else {
          yield W.time(1.5); yield Ale.Cards.show('still_02_lecture_hall', { once: true }); yield W.time(0.4);
          // Герои подходят к кафедре (раньше разговор шёл при камере на училке, а Алеся и Бубел стояли за левым краем кадра: её облачко росло из пустоты, а помидор, на который
          // отвечает училка, был не виден): оба в кадре — и на узком виде 1000 юнитов, и на широком; на «другой формат сдачи» помидор оказывается у неё на ладони
          p.autoWalk(X.teacher - 560, { speed: 300, arrive: 8 }); bubel.autoWalk(X.teacher - 670, { speed: 320, arrive: 10 });
          yield W.until(() => !p.auto && !bubel.auto);
          p.facing = 1; bubel.facing = 1;
          sc.cameraTarget = { x: (p.x + t.x) / 2, y: 600, vx: 0 };
          yield W.time(0.5);
          yield UI.say(Ale.StoryKit.cue(T.bossIntro, { 5: () => { p.holdSprite = 'pr_tomato'; } }));
          p.holdSprite = null;
          G.remember('boss_intro_seen');
        }
        t.startFight();
        Ale.Audio.music('boss');
        fight = true;
        bubel.mode = 'stay'; bubel.stayX = bubel.x;          // Бубел остаётся в сторонке (положение уточняет onTick по виду камеры)
        cheer('start', 0.7, T.bubelCheer.start);
        sc.cameraTarget = fightCam;
        sc.locked = false;
      });
    },
  };
})();
