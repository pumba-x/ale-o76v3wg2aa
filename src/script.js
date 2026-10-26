// Сценарии на генераторах: линейный код для кат-сцен и обучения.
//   *function () { yield Wait.time(1); yield UI.say(...); yield Wait.until(() => x); }
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const Wait = (Ale.Wait = {
    time(s) { return { t: 0, d: s, update(dt) { this.t += dt; return this.t >= this.d; } }; },
    until(fn) { return { update() { return !!fn(); } }; },
    all(...ws) { return { update(dt) { let done = true; for (const w of ws) if (!w.done) { if (w.update(dt)) w.done = true; else done = false; } return done; } }; },
    // Ждёт, пока актёр дойдёт до x (актёр сам ведёт себя через .auto).
    walkTo(actor, x, opts) {
      actor.autoWalk(x, opts);
      return { update() { return !actor.auto; } };
    },
  });

  class Script {
    constructor(genFn, ctx) {
      this.gen = genFn.call(ctx);
      this.wait = null;
      this.done = false;
    }

    step(dt) {
      let guard = 0;
      // Сбой внутри кат-сцены не должен навсегда оставить сцену «заблокированной»: сценарий завершается, сцена получает onError (сняться блокировка).
      const fail = (e) => {
        this.done = true; this.wait = null;
        if (Ale.Game) Ale.Game.errors = (Ale.Game.errors || 0) + 1;
        console.error(e);
        if (this.onError) this.onError(e);
      };
      while (!this.done && guard++ < 64) {
        if (this.wait) {
          let ready;
          try { ready = this.wait.update(dt); }
          catch (e) { fail(e); return; }          // исключение в условии ожидания (Wait.until) раньше уходило наружу и роняло шаг сцены каждый кадр до перезапуска с контрольной точки (11.10.2026)
          if (!ready) return;
          this.wait = null;
          dt = 0;
        }
        let r;
        try { r = this.gen.next(); }
        catch (e) { fail(e); return; }
        if (r.done) { this.done = true; return; }
        let v = r.value;
        if (typeof v === 'number') v = Wait.time(v);
        else if (typeof v === 'function') v = Wait.until(v);
        else if (Array.isArray(v)) v = Wait.all(...v);
        this.wait = v || null;
      }
    }
  }

  Ale.Script = Script;
})();
