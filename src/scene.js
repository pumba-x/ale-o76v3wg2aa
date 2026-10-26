// Сцена = одна локация: геометрия, сущности, слои фона, сценарий.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  class Scene {
    constructor(game, cfg) {
      this.game = game;
      this.id = cfg.id;
      this.width = cfg.width;
      this.height = cfg.height || 720;
      this.floorY = cfg.floorY || 600;
      this.world = new Ale.World();
      this.camera = new Ale.Camera();
      this.camera.bounds = { x0: 0, y0: 0, x1: this.width, y1: this.height };
      this.camera.setView(game.viewW, game.viewH);
      this.fx = new Ale.FX();
      this.entities = [];
      this.actors = {};       // по id: 'ale', 'bubel', 'clerk', ...
      this.player = null;
      this.back = [];         // слои фона: (ctx, cam, scene)
      this.front = [];        // слои переднего плана
      this.scripts = [];      // одновременно идущие сценарии (главный + короткие по действию игрока)
      this.time = 0;
      this.locked = false;    // кат-сцена: управление у сценария
      this.focus = null;      // ближайший предмет для взаимодействия
      this.music = cfg.music || null;
      this.place = cfg.place || null;       // [крупно, мелко]: название места при входе
      this.placeY = cfg.placeY || 0.3;      // на какой высоте кадра (доля) стоит название места: у комнаты-сюрприза оно выше праздничного баннера, а не поверх него
      this.cameraTarget = null;
      this.scriptHold = 0;     // сколько секунд сценарий ещё ждёт (проявление после перехода)
      this.boss = null;       // для полосы босса в HUD
    }

    add(e) {
      e.scene = this;
      e.px = e.x; e.py = e.y;
      this.entities.push(e);
      if (e.id) this.actors[e.id] = e;
      if (e.onAdd) e.onAdd();
      return e;
    }

    remove(e) { e.dead = true; }

    of(ctor) { return this.entities.filter((e) => e instanceof ctor && !e.dead); }

    runScript(genFn) {
      const s = new Ale.Script(genFn, this);
      // если сценарий упал посреди кат-сцены — вернуть игроку управление (иначе сцена осталась бы заблокированной навсегда)
      s.onError = () => { this.locked = false; this.cameraTarget = null; if (this.player) this.player.auto = null; if (Ale.UI) Ale.UI.dlg = null; };
      this.scripts.push(s); return s;
    }

    update(dt) {
      this.time += dt;
      if (this.scriptHold > 0) this.scriptHold -= dt;            // переход между сценами: сценарий начинается, когда картина уже проявилась (Game.enterScene)
      else {
        for (const s of this.scripts.slice()) if (!s.done) s.step(dt);
        if (this.scripts.some((s) => s.done)) this.scripts = this.scripts.filter((s) => !s.done);
      }
      for (const e of this.entities) { e.px = e.x; e.py = e.y; }
      const list = this.entities.slice();
      for (const e of list) if (!e.dead) e.update(dt);
      if (this.entities.some((e) => e.dead)) {
        for (const e of this.entities) if (e.dead && e.id && this.actors[e.id] === e) delete this.actors[e.id];
        this.entities = this.entities.filter((e) => !e.dead);
      }
      this.fx.update(dt);
      this.updateFocus();
      if (this.onTick) this.onTick(dt);
      this.camera.update(dt, this.cameraTarget || this.player);
    }

    updateFocus() {
      this.focus = null;
      const p = this.player;
      if (!p || this.locked || p.down || !p.canInteract()) return;
      let best = null, bd = 1e9, anywhere = null;
      for (const e of this.entities) {
        if (!e.interactable || e.dead) continue;
        if (e.canInteract && !e.canInteract(p)) continue;
        if (e.anywhere) { if (!anywhere) anywhere = e; continue; }             // действие «в любом месте» (звонок Илюшкинсу): берётся, только если рядом нет другого предмета
        const dx = Math.abs(e.x - p.x);
        const r = e.interactRange || 90;
        if (dx <= r && Math.abs(e.y - p.y) < (e.interactDY || 150) && dx < bd) { best = e; bd = dx; }
      }
      this.focus = best || anywhere;
    }

    // Только косметика при заморозке (диалог): ничего не двигаем.
    draw(ctx, alpha) {
      const cam = this.camera.offset(alpha);
      cam.x = Math.round(cam.x * this.game.k) / this.game.k;
      cam.y = Math.round(cam.y * this.game.k) / this.game.k;
      this.lastCam = cam;
      for (const L of this.back) L(ctx, cam, this);
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      const list = this.entities.slice().sort((a, b) => a.z - b.z);
      for (const e of list) e.draw(ctx, alpha);
      this.fx.draw(ctx);
      if (Ale.DEBUG.boxes) {
        ctx.save();
        for (const s of this.world.solids) { ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, s.h); }
        for (const s of this.world.oneways) { ctx.strokeStyle = 'rgba(80,160,255,0.95)'; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, Math.min(s.h, 8)); }
        for (const e of list) e.debugDraw(ctx);
        ctx.restore();
      }
      ctx.restore();
      for (const L of this.front) L(ctx, cam, this);
    }
  }

  Ale.Scene = Scene;
  Ale.Scenes = Ale.Scenes || {};
})();
