"use strict";

AFRAME.registerSystem("the-game", {
  schema: {

  },  // System schema. Parses into `this.data`.
  init() {
    // Called on scene initialization.
    console.log("the-game system init");
    this.lastCreepReleaseTime = -60000;
    this.creepReleaseFrequency = 20000;
    this.paused = true;

    this.startSlots = [0,30,60,90,120,150,180,210,240,270,300,330];
    this._creepCount = 0;
  },

  tick(time, timeDelta) {
    if (this.paused) return;
    let elapsed = time - this.lastCreepReleaseTime;
    if (elapsed > this.creepReleaseFrequency) {
      this.lastCreepReleaseTime = time;
      this.placeCreepOnField();
    }
    // clean up dead creeps
    for (let creepEl of this.sceneEl.querySelectorAll("[death-throes]")) {
      let timeSinceDeath = time - creepEl.components["death-throes"].data;
      if (timeSinceDeath > 1500) {
        this.removeCreepFromField(creepEl);
        // make sure we get another creep on the field soonish
        if (this.sceneEl.time - this.lastCreepReleaseTime >  this.creepReleaseFrequency*0.25) {
          this.lastCreepReleaseTime -= this.creepReleaseFrequency*0.75;
          console.log("moved up next release to: ", this.lastCreepReleaseTime + this.creepReleaseFrequency);
        }
      }
    }
  },

  handleEvent(evt) {
    if (evt.type == "stateadded" && evt.detail == "dead") {
      // remove entity now unless it is doing a death animation
      if (evt.target.hasAttribute("creep") && !evt.target.hasAttribute("death-throes")) {
        console.log("stateadded=dead event: ", evt);
        this.removeCreepFromField(evt.target);
      }
    }
    else if (evt.type == "attack") {
      console.log("attack event: ", evt);
    }
  },

  start() {
    // load deferred assets then play
    let templateNode = document.querySelector("#deferred-assets");
    let loaded = this.loadAssets(templateNode, 25000); // give up after 25s
    loaded.then(() => {
      console.log("deferred-assets loaded, calling play()");
      this.play();
    }).catch(ex => {
      console.log(ex.message);
    });
  },

  loadAssets(template, timeoutMs) {
    let assetsFrag = document.importNode(template.content, true);
    let timerId;
    let timedOut = new Promise((res, rej) => setTimeout(() => {
      rej(new Error("Timeout loading assets"));
    }, timeoutMs));
    let loadPromises = Array.from(assetsFrag.children).map(function(elem) {
      if (!elem.src || elem.readyState) {
        console.log("nothing to load ", elem.getAttribute("src"));
        return Promise.resolve(true);
      }
      if (elem instanceof HTMLMediaElement) {
        elem.load();
        return new Promise((resolve, reject) => {
          elem.addEventListener("canplaythrough", resolve, { once: true });
        });
      }
      return new Promise((resolve, reject) => {
        elem.onload = () => { console.log("loaded: ", this); resolve() };
        elem.onerror = (ex) => { console.log("error: ", this, ex); reject() };
      });
    });
    let container = document.createElement("a-node");
    container.appendChild(assetsFrag);
    this.sceneEl.appendChild(container);

    return Promise.race([
      timedOut,
      Promise.all(loadPromises)
    ]);

  },

  play() {
    console.log("the-game play() called");

    this.sceneEl = document.querySelector("a-scene");
    this.targetEl = this.sceneEl.querySelector("#tower");
    this.cursorEl = this.sceneEl.querySelector("[cursor]");

    this.centerPosition = this.targetEl.object3D.position;
    this.outerEdgeRadius = 10; // distance in m from the center the creeps should spawn at

    this.sceneEl.addEventListener("stateadded", this);
    this.sceneEl.addEventListener("damage", this);

    this.cursorEl.setAttribute("sound", "src: ./assets/gun-shot.mp3; positional: false");

    // begin automatically after a bit
    setTimeout(() => this.startLevel(), 1000);
  },

  _shuffleSlots(ar) {
    // https://github.com/coolaj86/knuth-shuffle
    let currentIndex = ar.length, temporaryValue, randomIndex;
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = ar[currentIndex];
      ar[currentIndex] = ar[randomIndex];
      ar[randomIndex] = temporaryValue;
    }
    return ar;
  },

  startLevel() {
    this._shuffleSlots(this.startSlots);
    this._lastSlotIndexAssigned = -1;
    console.log("startLevel, is paused: ", this.paused);
    this.paused = false;
    // could reduce creepReleaseFrequency to speed things up each time
  },

  pause() {
    console.log("the-game pause() called");
    this.sceneEl.removeEventListener("stateadded", this);
  },

  placeCreepOnField() {
    // go around the circle using randomized slots (o'clocks)
    let slotIndex = this._lastSlotIndexAssigned + 1;
    if (slotIndex > this.startSlots.length - 1) {
      // we've used every slot, shuffle and reset
      this.startLevel();
      slotIndex = 0;
    }
    // check the slot is empty, if not we'll bail and try again next time around
    if (!this.slotNeedsCreep(this.startSlots[slotIndex])) {
      console.log(`Slot at ${this.startSlots[slotIndex]} occupied, bailing`);
      return;
    }

    let creepEntity = this.sceneEl.components.pool__creep.requestEntity();
    if (!creepEntity) {
      console.log("No more creeps in the pool");
      this.lastCreepReleaseTime = this.sceneEl.time;
      return;
    }
    if (!creepEntity.id) {
      creepEntity.id = "creep-" + (++this._creepCount);
    }

    this._lastSlotIndexAssigned = slotIndex;

    let target = this.centerPosition;
    creepEntity.setAttribute("material", "color: #4b5320");
    creepEntity.setAttribute("health", 2);
    creepEntity.setAttribute("radial", {
      angleDegrees: this.startSlots[slotIndex], // degrees around the circle
      radialDistance: this.outerEdgeRadius,
    });
    creepEntity.setAttribute("creep", {
      // speed: can be tied to current level or something
      finishDistance: 2,
    });
    creepEntity.removeState("dead");
    creepEntity.play();
    console.log("placeCreepOnField, creep health: ", creepEntity.components.health.data);
  },
  removeCreepFromField(creepEntity) {
    // uninit all the attributes and properties
    creepEntity.removeAttribute("creep");
    creepEntity.removeAttribute("death-throes");
    creepEntity.removeAttribute("health");
    creepEntity.removeAttribute("radial");
    creepEntity.removeAttribute("material");
    // console.log(`removeCreepFromField, ${creepEntity.id} has components: `, Object.keys(creepEntity.components));
    this.sceneEl.components.pool__creep.returnEntity(creepEntity);
  },
  slotNeedsCreep(slotDegrees) {
    // check there's nothing occupying this slot
    let minDistanceFromCenter = this.outerEdgeRadius - 1.5; // radius of the creep plus a bit?
    for (let entity of this.sceneEl.querySelectorAll("[creep]")) {
      // find a creep at this slot
      if (entity.components.radial.data.angleDegrees !== slotDegrees) continue;
      // see if there's room at this slot for another
      if (entity.components.radial.data.radialDistance >= minDistanceFromCenter) {
        return false; // slot is occupied
      }
    }
    // no matches, slot is empty
    return true;
  },
});
