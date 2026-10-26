// Ввод: клавиатура, сенсорные кнопки, геймпад и «виртуальный» источник для автотестов.
// Игра спрашивает только про действия (left, jump, attack...), а не про клавиши.
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  const ACTIONS = ['left', 'right', 'down', 'jump', 'attack', 'throw', 'interact', 'pause'];
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'ArrowUp', 'KeyW'],
    attack: ['KeyJ', 'KeyX'],
    throw: ['KeyK', 'KeyC'],
    interact: ['KeyE', 'Enter'],
    pause: ['Escape', 'KeyP'],
  };
  const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Tab']);

  const keyToActions = {};
  for (const a of ACTIONS) for (const k of KEYS[a]) (keyToActions[k] = keyToActions[k] || []).push(a);

  const Input = (Ale.Input = {
    ACTIONS,
    keys: new Set(),
    touch: {},
    pad: {},
    virtual: {},         // сюда пишет тестовый бот
    cur: {}, prev: {}, tapped: {}, pressedNow: {}, releasedNow: {},
    edgeQueue: new Set(), edgeNow: new Set(), pendP: {}, pendR: {},
    lastDevice: 'keyboard',

    down(a) { return !!this.cur[a]; },
    pressed(a) { return !!this.pressedNow[a]; },
    released(a) { return !!this.releasedNow[a]; },
    consume(a) { this.pressedNow[a] = false; this.tapped[a] = false; },
    consumeAll() { for (const a of ACTIONS) this.consume(a); },
    axis() { return (this.cur.right ? 1 : 0) - (this.cur.left ? 1 : 0); },
    edge(code) { return this.edgeNow.has(code); },   // клавиша нажата именно на этом шаге (для меню)
    anyPressed() { return ACTIONS.some((a) => this.pressedNow[a]) || !!this.pressedAnyKey; },

    // Вызывается в начале каждого шага симуляции.
    // frozen — на этом шаге мир будет заморожен (hitstop): нажатие или отпускание не должно пропасть,
    // а дождаться первого живого шага (иначе прыжок «в момент удара» терялся бы).
    update(frozen) {
      this.edgeNow = this.edgeQueue; this.edgeQueue = new Set();
      this._pollPad();
      for (const a of ACTIONS) {
        let d = !!(this.touch[a] || this.pad[a] || this.virtual[a]);
        if (!d) for (const k of KEYS[a]) if (this.keys.has(k)) { d = true; break; }
        this.prev[a] = !!this.cur[a];
        this.cur[a] = d;
        this.pressedNow[a] = (d && !this.prev[a]) || !!this.tapped[a] || !!this.pendP[a];
        this.releasedNow[a] = (!d && this.prev[a]) || !!this.pendR[a];
        this.pendP[a] = !!frozen && this.pressedNow[a];
        this.pendR[a] = !!frozen && this.releasedNow[a];
        this.tapped[a] = false;
      }
      this.pressedAnyKey = false;
    },

    clear() {
      this.keys.clear(); this.touch = {}; this.pad = {}; this.pendP = {}; this.pendR = {};
      for (const a of ACTIONS) { this.cur[a] = false; this.prev[a] = false; this.tapped[a] = false; this.pressedNow[a] = false; this.releasedNow[a] = false; }
      if (window.Ale && Ale.Touch && Ale.Touch.releaseAll) Ale.Touch.releaseAll();          // экранные кнопки тоже: иначе устаревший номер касания держит кнопку «нажатой» после возвращения в игру
    },

    _pollPad() {
      let pads = [];
      try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }       // SecurityError: страница во фрейме без allow="gamepad" (встроенная на чужой сайт) — без этого каждый шаг бросал исключение и игра стояла (11.10.2026)
      const p = pads && Array.prototype.find.call(pads, (g) => g && g.connected);
      const out = {};
      if (p) {
        const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        out.left = ax < -0.4 || b(14); out.right = ax > 0.4 || b(15); out.down = ay > 0.6 || b(13);
        out.btnA = b(0); out.btnB = b(1);                       // кнопки A и B: в меню — «выбрать» и «записка»
        out.jump = out.btnA || b(12); out.attack = b(2); out.throw = b(3) || b(7);
        out.interact = b(5); out.pause = b(9);
        out.up = ay < -0.6 || b(12);
        if (Object.values(out).some(Boolean)) this.lastDevice = 'pad';
        // для меню: стрелки и «Enter» по фронту нажатия на геймпаде (Enter — только кнопка A и «действие»: крестовина вверх не «выбирает»)
        const pv = this.padPrev || {};
        if (out.up && !pv.up) this.edgeQueue.add('ArrowUp');
        if (out.down && !pv.down) this.edgeQueue.add('ArrowDown');
        if (out.left && !pv.left) this.edgeQueue.add('ArrowLeft');
        if (out.right && !pv.right) this.edgeQueue.add('ArrowRight');
        if ((out.btnA && !pv.btnA) || (out.interact && !pv.interact)) this.edgeQueue.add('Enter');
        if (out.btnB && !pv.btnB) this.edgeQueue.add('KeyN');        // в замке посылки — открыть/закрыть записку
        // Start — только «пауза»: «Escape» в окнах (замок, шахматы, автомат) значит «назад», а паузу Start должен открывать везде (12.10.2026); меню закрывает pressed('pause')
      }
      this.padPrev = Object.assign({}, out);
      this.pad = out;
    },
  });
  for (const a of ACTIONS) { Input.cur[a] = false; Input.prev[a] = false; }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey) Input.clear();          // macOS не присылает keyup для клавиши, отпущенной при зажатом Command: без этого герой, задев Command, продолжал бежать сам (18.10.2026)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    Input.lastDevice = 'keyboard';
    Input.pressedAnyKey = true;
    if (e.repeat) return;
    Input.keys.add(e.code);
    Input.edgeQueue.add(e.code);
    for (const a of keyToActions[e.code] || []) Input.tapped[a] = true;
    if (e.code === 'F1') { e.preventDefault(); Ale.DEBUG.boxes = !Ale.DEBUG.boxes; Ale.DEBUG.fps = Ale.DEBUG.boxes; }
    if (e.code === 'F2') { e.preventDefault(); if (Ale.Game) Ale.Game.stats = !Ale.Game.stats; }          // экран диагностики (то же, что ?stats=1)
  });
  window.addEventListener('keyup', (e) => { Input.keys.delete(e.code); if (e.code === 'MetaLeft' || e.code === 'MetaRight') Input.clear(); });
  window.addEventListener('blur', () => Input.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Input.clear(); });
})();
