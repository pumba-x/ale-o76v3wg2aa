// Общие помощники сценариев (Киев, Монако): окружение, ходьба в точку со сроком, плавное изменение числа по времени сцены, поцелуй героев, флаги прошлых глав.
// Подключается перед kyiv_story.js и monaco_story.js; сценарии берут нужное из Ale.StoryKit.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const PARIS_FLAGS = ['clerk_talked', 'tomatoes_taken', 'tut_train', 'boss_defeated', 'has_key', 'hatch_armed', 'key_back', 'tunnel_done', 'parcel_opened', 'has_apple', 'horse_fed', 'boarded', 'chapter_done'];
  // Флаги Киева, которые должны быть выставлены в любой точке Монако (быстрый старт по ссылке и загрузка не должны зависеть от того, что сцены Киева «пройдены»)
  const KYIV_FLAGS = ['kyiv_arrival_seen', 'antin_done', 'ilyushkins_met', 'seaside_invitation', 'dimasik_intro_seen', 'chess_won', 'dimasik_defeated', 'kyiv_farewell_done', 'has_bubble_tea', 'has_glasses', 'has_sausage'];

  // «Поцелуй»: Алеся тянется к нему на цыпочках, он наклоняется к ней; dx — расстояние между их точками опоры (владелец 03.10.2026: «ближе»: при 58 между лицами оставался зазор, при 38 лица
  // касаются, а тела ещё не наезжают друг на друга). С 04.10.2026 (заказы 20–24) их рисует одна сущность-пара Ale.CoupleKiss — один рисунок на двоих, кадры cpl_lean (lean ≈ 0,5 с) → cpl_kiss
  // (kiss ≈ 0,45 с: звук, сердечки, открытка) → cpl_after (after ≈ 0,5 с); dx = 35 — среднее расстояние между стопами на этих трёх кадрах (34–36 юн.: точки footA и footI в манифесте), поэтому
  // оба стоят на своих местах и скачка нет. soloKiss — длина пика у запасного поцелуя прежними кадрами по одному (ale_kiss1/2 и ily_kiss1/2), когда рисунка пары в сборке нет.
  const KISS = { dx: 35, lean: 0.5, kiss: 0.45, after: 0.5, soloKiss: 1.3 };

  function env(sc) {
    const G = Ale.Game;
    return { G, F: G.state.flags, UI: Ale.UI, T: Ale.T, W: Ale.Wait, p: sc.player, bubel: sc.bubel, remember: (k, v) => { G.state[k] = v; if (G.checkpointState) G.checkpointState[k] = v; } };
  }
  const paris = (F) => { for (const f of PARIS_FLAGS) F[f] = true; };
  const kyiv = (F) => { for (const f of KYIV_FLAGS) F[f] = true; };

  // Ходьба актёра в точку со сроком: если путь перегорожен (стена, занятое место), сценарий идёт дальше, а не ждёт вечно (иначе сцена осталась бы заблокированной)
  const goTo = (sc, actor, x, opts, maxT) => {
    actor.autoWalk(x, opts); const t0 = sc.time;
    return Ale.Wait.until(() => { if (!actor.auto) return true; if (sc.time - t0 > (maxT || 8)) { actor.auto = null; return true; } return false; });
  };
  // Двое лицом друг к другу на время реплик между ними (одна стоит слева, другая справа — всё равно): поворачивает обоих. Раньше у такси и в сцене со смс героиня стояла к Илюшкинсу спиной (11.10.2026)
  const face = (a, b) => { const s = b.x >= a.x ? 1 : -1; a.facing = s; b.facing = -s; };
  // Плавное изменение числа по времени сцены: set(k) зовётся с k от 0 до 1 за dur секунд (для двери такси, ухода Димасика вглубь парка, портала)
  const tween = (sc, dur, set) => { const t0 = sc.time; return Ale.Wait.until(() => { const k = Ale.clamp((sc.time - t0) / dur, 0, 1); set(k); return k >= 1; }); };

  // Поцелуй: оба стоят лицом друг к другу (Илюшкинс с той стороны, где уже стоит), сердечки поднимаются вверх. Вызывается из сценария: yield* kiss(sc, p, ily)
  // opts.card — функция, которую сценарий вызывает на пике поцелуя и ждёт (открытка «у фонтана»: мир за ней стоит, по закрытии поцелуй доигрывается)
  // Героиня и Илюшкинс на время поцелуя спрятаны (hidden), их x и y не трогаются — после него они стоят там же; вместо них в сцену ставится пара Ale.CoupleKiss (sc.couple, кадр —
  // sc.couple.frameName); зеркально, если Илюшкинс слева от неё. Нет рисунка пары — прежний поцелуй кадрами по одному (p.pose 'kiss1' → 'kiss2', ily.pose 'ily_kiss1' → 'ily_kiss2').
  function* kiss(sc, p, ily, opts) {
    const W = Ale.Wait, mode = ily.mode; opts = opts || {};
    const side = ily.x >= p.x ? 1 : -1;
    p.vx = 0; p.auto = null; p.facing = side; ily.keepFacing = true; ily.mode = 'stay';
    if (Math.abs(ily.x - (p.x + side * KISS.dx)) > 10) yield goTo(sc, ily, p.x + side * KISS.dx, { speed: 170, arrive: 3 }, 5);      // подходит сам, не телепортом
    ily.vx = 0; ily.x = p.x + side * KISS.dx; ily.facing = -side;
    const hearts = (n) => sc.fx.hearts(p.x + side * KISS.dx / 2, p.y - 150, n);
    if (Ale.CoupleKiss && Ale.CoupleKiss.available()) {
      const wasP = p.hidden, wasI = ily.hidden;
      const couple = sc.add(new Ale.CoupleKiss({ a: p, b: ily, side, frame: 'cpl_lean' }));
      sc.couple = couple; p.hidden = true; ily.hidden = true;
      try {
        yield W.time(KISS.lean);
        couple.frameName = 'cpl_kiss';
        Ale.Audio.sfx('kiss'); hearts(5);
        yield W.time(KISS.kiss * 0.6);
        if (opts.card) yield opts.card();                              // на пике — действие сценария (например, показать открытку: card — функция, возвращающая ожидание показа)
        hearts(4);
        yield W.time(KISS.kiss * 0.4);
        couple.frameName = 'cpl_after';
        yield W.time(KISS.after);
      } finally {                                                      // и при сбое в открытке: герои не должны остаться спрятанными
        p.hidden = wasP; ily.hidden = wasI;
        couple.dead = true; if (sc.couple === couple) sc.couple = null;
      }
    } else {
      p.pose = 'kiss1'; ily.pose = 'ily_kiss1';
      yield W.time(KISS.lean);
      p.pose = 'kiss2'; ily.pose = 'ily_kiss2';
      Ale.Audio.sfx('kiss'); hearts(5);
      yield W.time(KISS.soloKiss * 0.35);
      if (opts.card) yield opts.card();
      hearts(4);
      yield W.time(KISS.soloKiss * 0.65);
      p.pose = null; ily.pose = null;
    }
    ily.keepFacing = false; ily.mode = mode;
  }

  // Реплики с «крючками»: cue(lines, { 2: fn }) — fn срабатывает, когда на экране появляется реплика с этим номером (поза говорящего меняется вместе с текстом, диалог не рвётся)
  const cue = (lines, hooks) => lines.map((l, i) => (hooks[i] ? [l[0], l[1], Object.assign({}, l[2], { do: hooks[i] })] : l));

  Ale.StoryKit = { PARIS_FLAGS, KYIV_FLAGS, KISS, env, paris, kyiv, goTo, tween, kiss, cue, face };
})();
