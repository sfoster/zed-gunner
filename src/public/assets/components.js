"use strict";
/*eslint quotes: [2, "double"] */

const TAU = Math.PI+Math.PI;
const QUARTER_CIRCLE = Math.PI/2;
const ONE_DEGREE = Math.PI/180;

AFRAME.registerComponent("health", {
  schema: {type: "int", default: 0},
  update(oldData) {
    if (this.data.health <= 0 && oldData.health > 0) {
      console.log("health component update, ", this.el, this.data.health);
      this.emit("death");
    }
  }
});

/*
 * position an entity at a distance and angle from a point
 */
AFRAME.registerComponent("radial", {
  schema: {
    angleDegrees: { type: "number", default: -1 }, // degrees
    radialDistance: { type: "number", default: -1 },
  },
  play() {
    console.log(this.el.id, "radial#play at: ", this.data.radialDistance);
  },
  update(oldData) {
    if (this.data.angleDegrees == -1) {
      throw new Error("radial component never got an angleDegrees?");
    }
    if (oldData.angleDegrees !== this.data.angleDegrees) {
      let rotateY = Math.PI * 2.5 - this.data.angleDegrees * ONE_DEGREE; // correct model rotation e.g. by  - QUARTER_CIRCLE
      console.log("adjust rotation: ", rotateY);
      this.el.object3D.rotation.set(0,
                                    rotateY,
                                    0);
    }
    this.updatePosition(this.data.angleDegrees * ONE_DEGREE, this.data.radialDistance);
  },
  updatePosition(radians, radius) {
    this.el.object3D.position.x = Math.cos(radians) * radius;
    this.el.object3D.position.y = 0;
    this.el.object3D.position.z = Math.sin(radians) * radius;
  },
});

AFRAME.registerComponent("creep", {
  schema: {
    speed: { type: "number", default: 0.2 }, // metre/second
    finishDistance: { type: "number", default: .2 },
  },
  healthColors: [
      "#ff0000",
      "#b31b1b", // 1: critical
      "#4b5320", // 2: healthy
  ],
  init() {
    console.log(this.el.id, "creep#init");
  },
  play() {
    console.log(this.el.id, "creep#play");
    this.el.addEventListener("fusing", this);
    this.el.addEventListener("click", this);
  },
  pause() {
    console.log(this.el.id, "creep#pause");
    this.el.removeEventListener("click", this);
  },
  handleEvent(evt) {
    if (evt.type == "click") {
      console.log(this.el.id, "handle click event", this.el.isPlaying, this.el.object3D.visible, this.el.is("dead"));
      if (!this.el.isPlaying) {
        throw new Error("Got click on paused entity");
      }
      if (!this.el.object3D.visible) {
        throw new Error("Got click on invisible entity");
      }
      this.takeHit();
    } else if (evt.type == "fusing") {
      console.log("fusing on creep");
    }
  },
  resetToDefaults() {
    for (let name in this.schema) {
      this.data[name] = this.schema[name].default;
    }
  },
  remove() {
    // set everything back to defaults
    this.resetToDefaults();
  },
  getRadius() {
    return this.el.components.radial.data.radialDistance;
  },
  tick: (function() {
    let radius;
    return function(time, timeDelta) {
      // update position
      if (!this.el.isConnected) return; // does this ever happen?
      if (this.el.is("dead")) return;

      radius = this.getRadius();
      if (radius < 0) return;
      if (radius > this.data.finishDistance) {
        this.el.setAttribute("radial", "radialDistance", radius - this.data.speed * .001 * timeDelta);
      } else {
        // maybe do damage
        // then die
        console.log("do damage: ", this.el.components.health.data);
        this.el.emit("attack", this.el.components.health.data);
        this.die("glorious");
      }
    };
  })(),
  takeHit() {
    console.log("takeHit!", this.el.components);
    let health = this.el.components.health.data -1;
    this.el.setAttribute("health", health);

    if (health > 0) {
      // TODO: change color when hit?
      // knock it back a bit
      this.el.setAttribute("radial", "radialDistance", this.getRadius() + 1);
    } else {
      this.die();
    }
    // console.log("I was clicked at: ", evt.detail.intersection.point);
  },
  die(typeOfDeath="") {
    if (typeOfDeath !== "glorious") {
      this.el.setAttribute("animation-mixer", "clip: Death; loop: once");
      this.el.setAttribute("death-throes", this.el.sceneEl.time);
    }
    this.el.addState("dead");
  },

});

AFRAME.registerComponent("death-throes", {
  schema: {type: "int", default: -1},
  play() {
    this.el.setAttribute("animation-mixer", {
      clip: "Death",
      loop: THREE.LoopOnce,
      duration: 1.6,
    });
  }
});

AFRAME.registerComponent("defender", {
  schema: {
    weapon: {type: 'selector'},
  },
  play() {
    console.log("defender play");
    this.data.weapon.addEventListener("click", this);
  },
  pause() {
    this.data.weapon.removeEventListener("click", this);
  },
  handleEvent(event) {
    if (event.type == "click") {
      console.log("click event: ", event);
      this.soundEffect();
    }
  },
  soundEffect() {
    this.data.weapon.components.sound.playSound();
  },
});
