// Невидимая точка действия: знак «E» над ней появляется, когда героиня рядом и canUse() не запрещает. Нужна там, где действие у предмета без собственного класса
// (пульт, торт) или у сущности, которая движется (follow — точка идёт за ней); anywhere вместе с follow героини — действие из любого места (звонок Илюшкинсу): оно в фокусе, пока рядом нет другого предмета, знак «E» над героиней. label — подпись действия у знака, arrow — стрелка «идти сюда».
(function () {
  'use strict';
  const Ale = (window.Ale = window.Ale || {});

  class Spot extends Ale.Entity {
    constructor(o) {
      super(Object.assign({ w: 10, h: 10, z: 5 }, o));
      this.interactable = true; this.interactRange = o.range || 90; this.interactDY = o.dy || 190;
      this.headH = o.headH || 160; this.promptY = o.promptY !== undefined ? o.promptY : this.headH;
      this.label = o.label || null; this.labelIcon = o.labelIcon || null; this.onUse = o.onUse || null; this.canUse = o.canUse || null; this.follow = o.follow || null;
      this.arrow = !!o.arrow;
      this.anywhere = !!o.anywhere;      // действие «в любом месте»: фокус на нём, если рядом нет другого предмета (см. Scene.updateFocus); обычно follow — героиня, знак «E» над ней
    }
    canInteract(p) { return !this.dead && (!this.canUse || !!this.canUse(p)); }
    interact(p) { if (this.onUse) this.onUse(p); }
    hurtbox() { return { x: 0, y: 0, w: 0, h: 0 }; }
    debugDraw() {}
    update(dt) { super.update(dt); if (this.follow) { this.x = this.follow.x; this.y = this.follow.y; } }
    draw(ctx) {
      if (!this.arrow || !this.canInteract()) return;
      const y = this.y - this.headH - 46 + Math.sin(this.t * 4) * 6;
      ctx.save(); ctx.translate(this.x, y);
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.lineTo(0, 26); ctx.closePath();
      ctx.fillStyle = '#ffd98a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#2b1a20'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
  }
  Ale.Spot = Spot;
})();
