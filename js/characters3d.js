// Production 3D Character Engine using Skinned GLB Meshes & Skeletal Animation Mixers
// Powered by Three.js GLTFLoader and SkeletonUtils for natural anatomical movement and PBR texturing.

class CharacterAnimationController {
  constructor(model, mixer, animations) {
    this.model = model;
    this.mixer = mixer;
    this.actions = {};
    this.currentActionName = null;
    this.currentAction = null;
    this.onFinishListener = null;

    if (animations && mixer) {
      animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        this.actions[clip.name] = action;
        // Case-insensitive / alternate name fallback indexing
        this.actions[clip.name.toLowerCase()] = action;
      });
    }
  }

  getAction(name) {
    if (!name) return null;
    return this.actions[name] || this.actions[name.toLowerCase()] || null;
  }

  play(name, fadeDuration = 0.22, loop = THREE.LoopRepeat) {
    const nextAction = this.getAction(name);
    if (!nextAction) return;
    if (this.currentActionName === name && nextAction.isRunning()) return;

    nextAction.reset();
    nextAction.setLoop(loop);
    nextAction.clampWhenFinished = (loop === THREE.LoopOnce);

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.crossFadeTo(nextAction, fadeDuration, true);
    }
    nextAction.play();

    this.currentAction = nextAction;
    this.currentActionName = name;
  }

  playOnce(name, fallbackName = 'Idle', fadeDuration = 0.18) {
    const action = this.getAction(name);
    if (!action) {
      this.play(fallbackName, fadeDuration);
      return;
    }

    if (this.onFinishListener && this.mixer) {
      this.mixer.removeEventListener('finished', this.onFinishListener);
      this.onFinishListener = null;
    }

    action.reset();
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = false;

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.crossFadeTo(action, fadeDuration, true);
    }
    action.play();
    this.currentAction = action;
    this.currentActionName = name;

    this.onFinishListener = (e) => {
      if (e.action === action) {
        if (this.mixer) this.mixer.removeEventListener('finished', this.onFinishListener);
        this.onFinishListener = null;
        this.play(fallbackName, fadeDuration);
      }
    };
    this.mixer.addEventListener('finished', this.onFinishListener);
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  dispose() {
    if (this.onFinishListener && this.mixer) {
      this.mixer.removeEventListener('finished', this.onFinishListener);
      this.onFinishListener = null;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
  }
}

// Central Preloader & Skinned Instance Factory
const CharacterAssetManager = {
  cache: {},
  loadingPromises: {},
  modelDefs: {
    wizard: { url: 'models/Wizard.glb', scale: 2.30 },
    soldier: { url: 'models/Soldier.glb', scale: 3.95 },
    knight: { url: 'models/Warrior.glb', scale: 2.40 },
    robot: { url: 'models/Robot.glb', scale: 1.60 }
  },

  preload(type) {
    const key = type.toLowerCase();
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    if (this.loadingPromises[key]) return this.loadingPromises[key];

    const def = this.modelDefs[key];
    if (!def) return Promise.reject(new Error("Unknown character type: " + type));

    const loader = new THREE.GLTFLoader();
    this.loadingPromises[key] = new Promise((resolve, reject) => {
      loader.load(
        def.url,
        (gltf) => {
          this.cache[key] = {
            gltf: gltf,
            scene: gltf.scene,
            animations: gltf.animations,
            scale: def.scale
          };
          resolve(this.cache[key]);
        },
        undefined,
        (err) => {
          console.error("Failed to load model:", def.url, err);
          reject(err);
        }
      );
    });

    return this.loadingPromises[key];
  },

  preloadAll() {
    return Promise.all(Object.keys(this.modelDefs).map((k) => this.preload(k)));
  },

  createInstance(type) {
    const key = type.toLowerCase();
    const cached = this.cache[key];
    if (!cached) return null;

    // Use Three.js SkeletonUtils to deep-clone skinned meshes and bind bones
    const clonedScene = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(cached.scene) : cached.scene.clone();

    // Enable high-fidelity shadows and ensure PBR surface response
    clonedScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.depthWrite = true;
          if (node.material.map) {
            node.material.map.encoding = THREE.sRGBEncoding;
          }
        }
      }
    });

    const s = cached.scale;
    clonedScene.scale.set(s, s, s);

    const mixer = new THREE.AnimationMixer(clonedScene);
    const controller = new CharacterAnimationController(clonedScene, mixer, cached.animations);

    return {
      model: clonedScene,
      mixer: mixer,
      controller: controller,
      animations: cached.animations
    };
  }
};

// Immediately begin preloading all 4 production character models
if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
  CharacterAssetManager.preloadAll().catch((e) => console.warn("Background preload warning:", e));
}

// Base Controller for all 3D Characters
class Character3DBase {
  constructor(name, x, y, z, scene) {
    this.name = name;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.scene.add(this.group);

    this.facing = 1;
    this.state = 'ATTACKING';
    this.huntTimer = 0;
    this.alertTimer = 0;
    this.landingTimer = 0;

    this.attackCooldown = 0;
    this.speechText = '';
    this.speechTimer = 0;

    this.targetX = x;
    this.moveSpeed = 16;
    this.collisionRadius = 1.8;
    this.squadLaneZ = z || 0;
    this.squadOffsetX = 0;
    this.jumpTimer = 0;
    this.jumpOriginX = x;
    this.jumpTargetX = x;
    this.jumpProgress = 0;

    // Model & Animation container
    this.modelInstance = null;
    this.model = null;
    this.anim = null;
    this.modelReady = false;

    // Quips
    this.quips = [];
    this.fallQuips = [];
    this.huntQuips = [];
  }

  attachGLTFModel(type, onReady) {
    const setup = (instance) => {
      if (!instance || !this.group) return;
      this.modelInstance = instance;
      this.model = instance.model;
      this.anim = instance.controller;
      this.group.add(this.model);
      this.modelReady = true;

      // Start in default idle pose
      this.playIdle();

      if (typeof onReady === 'function') {
        onReady(this.model, this.anim);
      }
    };

    const immediate = CharacterAssetManager.createInstance(type);
    if (immediate) {
      setup(immediate);
    } else {
      CharacterAssetManager.preload(type).then(() => {
        const deferred = CharacterAssetManager.createInstance(type);
        setup(deferred);
      }).catch((err) => {
        console.error("Error attaching character model:", type, err);
      });
    }
  }

  playIdle() {
    if (!this.anim) return;
    this.anim.play('Idle');
  }

  playMove(speed) {
    if (!this.anim) return;
    if (speed > 18) {
      if (this.anim.getAction('Run') || this.anim.getAction('Running')) {
        this.anim.play(this.anim.getAction('Run') ? 'Run' : 'Running');
        return;
      }
    }
    if (this.anim.getAction('Walk') || this.anim.getAction('Walking')) {
      this.anim.play(this.anim.getAction('Walk') ? 'Walk' : 'Walking');
    } else {
      this.playIdle();
    }
  }

  say(text, duration = 2.4) {
    this.speechText = text;
    this.speechTimer = duration;
    if (window.app3D) {
      window.app3D.setDialogue(this.name, text, duration);
    }
  }

  onStartFreefall() {
    if (this.anim) {
      if (this.anim.getAction('Death')) this.anim.play('Death', 0.25, THREE.LoopOnce);
      else if (this.anim.getAction('Jump')) this.anim.play('Jump', 0.25, THREE.LoopOnce);
    }
    if (this.fallQuips && this.fallQuips.length > 0) {
      this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
    }
  }

  onLandImpact() {
    this.playIdle();
    if (window.soundEngine) window.soundEngine.playHeavyExplosion(0.85);
  }

  onStartHunting(lastExitPos) {
    this.playMove(10);
    if (this.huntQuips && this.huntQuips.length > 0) {
      this.say(this.huntQuips[Math.floor(Math.random() * this.huntQuips.length)], 2.8);
    }
  }

  onSpotCursor() {
    this.playIdle();
    this.say("TARGET RE-ACQUIRED! ENGAGING!");
    if (window.soundEngine) window.soundEngine.playAlertStinger();
  }

  onScanBorder() {
    if (this.huntQuips && this.huntQuips.length > 0 && Math.random() < 0.65) {
      const q = this.huntQuips[Math.floor(Math.random() * this.huntQuips.length)];
      this.say(q, 2.5);
    }
  }

  computeNavigationTargetZ(targetX, sceneManager3D) {
    let desiredZ = this.squadLaneZ || 0;

    if (sceneManager3D && sceneManager3D.props) {
      const charX = this.group.position.x;
      const charR = this.collisionRadius || 1.8;
      const moveDir = targetX > charX ? 1 : (targetX < charX ? -1 : 0);

      for (const prop of sceneManager3D.props) {
        if (!prop.isAlive()) continue;

        const hw = prop.w / 2;
        const hd = prop.d / 2;
        const propX = prop.group.position.x;
        const propZ = prop.group.position.z || 0;

        const xDist = Math.abs(charX - propX);
        const inXRange = xDist < hw + charR + 3.0;
        const movingTowards = moveDir !== 0 && (propX - charX) * moveDir > 0;

        if (inXRange || (movingTowards && xDist < hw + charR + 6.0)) {
          // Route around front face (+Z toward camera)
          const clearZ = propZ + hd + charR + 0.8;
          if (clearZ > desiredZ) {
            desiredZ = clearZ;
          }
        }
      }
    }

    return desiredZ;
  }

  resolveEnvironmentCollisions(dt, sceneManager3D, physics3D) {
    if (!sceneManager3D || sceneManager3D.isCollapsing || this.state === 'FREEFALL') return;

    const r = this.collisionRadius || 1.8;
    let px = this.group.position.x;
    let pz = this.group.position.z;

    // 1. Scenery Prop Physical AABB Collision Resolution (Never clip inside props)
    if (sceneManager3D.props) {
      for (const prop of sceneManager3D.props) {
        if (!prop.isAlive()) continue;

        const hw = prop.w / 2;
        const hd = prop.d / 2;
        const propX = prop.group.position.x;
        const propZ = prop.group.position.z || 0;

        const minX = propX - hw - r;
        const maxX = propX + hw + r;
        const minZ = propZ - hd - r;
        const maxZ = propZ + hd + r;

        if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) {
          const distLeft = px - minX;
          const distRight = maxX - px;
          const distBack = pz - minZ;
          const distFront = maxZ - pz;

          const minDist = Math.min(distLeft, distRight, distBack, distFront);

          if (minDist === distFront) {
            pz = maxZ;
          } else if (minDist === distBack) {
            pz = minZ;
          } else if (minDist === distLeft) {
            px = minX;
          } else {
            px = maxX;
          }
        }
      }
    }

    // 2. Clamp Stage Horizontal & Depth Boundaries
    px = Math.max(-44, Math.min(44, px));
    pz = Math.max(-5.5, Math.min(7.5, pz));

    this.group.position.x = px;
    this.group.position.z = pz;

    // 3. Debris Scattering Physics (Characters kick debris out of their way)
    if (physics3D && physics3D.debris3D) {
      for (const chunk of physics3D.debris3D) {
        if (chunk.heldByRobot || !chunk.mesh) continue;
        const cdx = chunk.mesh.position.x - px;
        const cdz = chunk.mesh.position.z - pz;
        const cdist = Math.hypot(cdx, cdz);
        const touchDist = r + chunk.radius + 0.3;

        if (cdist < touchDist && cdist > 0.001) {
          const pushForce = 18;
          chunk.vx += (cdx / cdist) * pushForce;
          chunk.vz += (cdz / cdist) * pushForce;
          chunk.vy += 6 + Math.random() * 4;
          chunk.isSettled = false;
        }
      }
    }

    // 4. Floor Slab Void / Chasm Jumping
    if (sceneManager3D.floorSlabs && sceneManager3D.floorSlabs.length > 0) {
      if (sceneManager3D.isSlabCollapsedAt(px)) {
        if (this.jumpTimer === undefined) this.jumpTimer = 0;
        if (this.jumpTimer <= 0) {
          const safeX = sceneManager3D.getNearestIntactSlabX(px);
          this.jumpTimer = 0.6;
          this.jumpOriginX = px;
          this.jumpTargetX = safeX;
          this.jumpProgress = 0;
          if (this.anim) {
            if (this.anim.getAction('Jump')) this.anim.playOnce('Jump', 'Idle');
          }
          if (window.soundEngine && typeof window.soundEngine.playJavelinThrow === 'function') {
            window.soundEngine.playJavelinThrow();
          }
        }
      }
    }

    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      this.jumpProgress = Math.min(1.0, 1.0 - this.jumpTimer / 0.6);
      this.group.position.x = THREE.MathUtils.lerp(this.jumpOriginX, this.jumpTargetX, this.jumpProgress);
      this.group.position.y = (this.state === 'FREEFALL' ? this.group.position.y : Math.sin(this.jumpProgress * Math.PI) * 4.5);
    }
  }

  postUpdatePhysics(dt, sceneManager3D, physics3D) {
    if (this.state !== 'FREEFALL') {
      const desiredZ = this.computeNavigationTargetZ(this.targetX, sceneManager3D);
      this.group.position.z += (desiredZ - this.group.position.z) * 4.0 * dt;
    }
    this.resolveEnvironmentCollisions(dt, sceneManager3D, physics3D);

    // Update skeletal animation mixer
    if (this.anim) {
      this.anim.update(dt);
    }
  }

  updateCommon(dt, mouse3D, physics3D, sceneManager3D) {
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    if (sceneManager3D.isCollapsing) {
      if (this.state !== 'FREEFALL') {
        this.state = 'FREEFALL';
        this.onStartFreefall();
      }
      this.group.position.x += (0 - this.group.position.x) * 1.5 * dt;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && mouse3D.active) {
        this.attackCooldown = 0.85;
        this.fireUpwardAtCursor(mouse3D, physics3D);
      }
      return;
    } else if (this.state === 'FREEFALL') {
      this.state = 'LANDING';
      this.landingTimer = 0.7;
      this.onLandImpact();
    }

    if (this.state === 'LANDING') {
      this.landingTimer -= dt;
      if (this.landingTimer <= 0) this.state = 'ATTACKING';
      return;
    }

    if (!mouse3D.active) {
      if (this.state !== 'HUNTING') {
        this.state = 'HUNTING';
        this.huntTimer = 0;
        this.huntScanTimer = 1.5;
        this.huntPatrolTargetX = mouse3D.lastExitWorldX || (this.facing * 35);
        this.onStartHunting(mouse3D.lastExitPos);
      } else {
        this.huntTimer += dt;
        this.huntScanTimer -= dt;

        if (this.huntScanTimer <= 0) {
          const roll = Math.random();
          if (roll < 0.45) {
            const exitSign = (mouse3D.lastExitWorldX || 0) >= 0 ? 1 : -1;
            this.huntPatrolTargetX = exitSign * (36 + Math.random() * 6);
            this.huntScanTimer = 3.0 + Math.random() * 2.0;
            if (Math.random() < 0.5 && window.soundEngine) window.soundEngine.playSonarPing();
            this.onScanBorder();
          } else if (roll < 0.8) {
            this.huntPatrolTargetX = (Math.random() * 2 - 1) * 36;
            this.huntScanTimer = 3.5 + Math.random() * 2.0;
            if (Math.random() < 0.4) this.onScanBorder();
          } else {
            this.huntScanTimer = 2.0;
            if (Math.random() < 0.4) this.onScanBorder();
          }
        }
      }
    } else {
      if (this.state === 'HUNTING') {
        this.state = 'ALERT';
        this.alertTimer = 0.6;
        this.onSpotCursor();
      } else if (this.state === 'ALERT') {
        this.alertTimer -= dt;
        if (this.alertTimer <= 0) this.state = 'ATTACKING';
      }
    }

    // Orient character towards cursor in 3D (with subtle camera forward bias)
    if (this.state !== 'HUNTING') {
      const targetX = mouse3D.active ? mouse3D.worldX : (mouse3D.lastExitWorldX || this.group.position.x + this.facing * 10);
      const targetZ = mouse3D.active ? mouse3D.worldZ : 0;
      const dx = targetX - this.group.position.x;
      const dz = targetZ - this.group.position.z;

      this.facing = dx >= 0 ? 1 : -1;

      // In Three.js GLTF, forward is +Z. To face target at (dx, dz):
      // Camera is at +Z looking at 0, so targetAngle = atan2(dx, dz + 5) creates a natural 3/4 frontal view
      const targetAngle = Math.atan2(dx, dz + 5.5);

      let diff = targetAngle - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, 9.0 * dt);
    }
  }

  dispose() {
    if (this.anim) {
      this.anim.dispose();
      this.anim = null;
    }
    if (this.group) {
      this.scene.remove(this.group);
      if (this.rifleGroup) {
        this.rifleGroup.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
        this.rifleGroup = null;
      }
      this.group = null;
    }
  }
}

// ==========================================
// 1. PRODUCTION 3D WIZARD (Skinned Arcane Sage)
// ==========================================
class Wizard3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Wizard', x, y, z, scene);
    this.collisionRadius = 1.8;
    this.moveSpeed = 16;

    this.say("THE FOUNDATIONS CANNOT WITHSTAND MY ARCANE FIRE!");
    this.quips = [
      "DIE, INSOLENT GLYPH!",
      "I COMMAND THE COSMOS TO SMITE THEE!",
      "HOW CAN AN ARROW RESIST ARCANE FIRE?!",
      "BEHOLD THE WRATH OF A THOUSAND SUNS!"
    ];
    this.fallQuips = [
      "BY THE NINE HELLS, THE FOUNDATIONS GAVE WAY!",
      "MY LEVITATION SPELL HATH FAILED!",
      "WE PLUNGE INTO THE ABYSS!",
      "I WILL SMITE THEE AS WE FALL!"
    ];
    this.huntQuips = [
      "WHERE HAST THOU FLED, SPECTRAL ARROW?!",
      "I SENSE THY ESSENCE LURKING BEYOND THE FRAME!",
      "THOU ART COWARDLY TO ABANDON THE REALM!",
      "REVEAL THYSELF BEFORE I TEAR THE VEIL ASUNDER!"
    ];

    this.attachGLTFModel('wizard', (model) => {
      // Find staff mesh and attach pulsing arcane aura light
      const staffMesh = model.getObjectByName('Wizard_Staff');
      this.orbLight = new THREE.PointLight(0xc084fc, 1.2, 14);
      this.orbLight.position.set(0, 0.45, 0);

      const staffBone = model.getObjectByName('WeaponR');
      if (staffBone) {
        staffBone.add(this.orbLight);
      } else if (staffMesh) {
        staffMesh.add(this.orbLight);
      } else {
        this.group.add(this.orbLight);
      }
    });
  }

  playIdle() {
    if (!this.anim) return;
    if (this.anim.getAction('Idle_Weapon')) {
      this.anim.play('Idle_Weapon');
    } else {
      this.anim.play('Idle');
    }
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);
    if (this.state === 'FREEFALL' || this.state === 'LANDING') {
      this.postUpdatePhysics(dt, sceneManager3D, physics3D);
      return;
    }

    if (this.state === 'ATTACKING' || this.state === 'ALERT') {
      const targetX = mouse3D.worldX + (this.squadOffsetX || 0);
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;

      if (Math.abs(dist) > 1.4) {
        const moveDir = Math.sign(dist);
        this.group.position.x += moveDir * Math.min(Math.abs(dist), this.moveSpeed * dt);
        this.playMove(this.moveSpeed);
      } else {
        this.playIdle();
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.castSpell(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.2) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 14 * dt);
        this.playMove(14);
      } else {
        this.playIdle();
      }

      const patrolAngle = Math.atan2(Math.sign(dist || this.facing) * 10, 4);
      let diff = patrolAngle - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, 6.0 * dt);
    }

    if (this.orbLight) {
      this.orbLight.intensity = 1.0 + Math.sin(performance.now() * 0.006) * 0.4;
    }

    this.postUpdatePhysics(dt, sceneManager3D, physics3D);
  }

  castSpell(mouse3D, physics3D, sceneManager3D) {
    if (this.anim) {
      if (this.anim.getAction('Spell1')) {
        this.anim.playOnce('Spell1', 'Idle_Weapon');
      } else if (this.anim.getAction('Staff_Attack')) {
        this.anim.playOnce('Staff_Attack', 'Idle_Weapon');
      }
    }

    if (this.orbLight) {
      this.orbLight.intensity = 4.5;
    }

    const roll = Math.random();

    if (roll < 0.45) {
      if (window.soundEngine) window.soundEngine.playMagicMissile();
      for (let i = 0; i < 3; i++) {
        const spreadAngle = (i - 1) * 0.35 + (this.facing === 1 ? 0 : Math.PI);
        physics3D.addProjectile3D({
          type: 'magic_missile',
          x: this.group.position.x + this.facing * 2.5,
          y: 7.2,
          z: this.group.position.z + 0.8,
          vx: Math.cos(spreadAngle) * 32,
          vy: Math.sin(spreadAngle) * 32 + 10,
          vz: (Math.random() - 0.5) * 8,
          speed: 32,
          color: 0xc084fc,
          life: 4.5,
          targetX: mouse3D.worldX,
          targetY: mouse3D.worldY,
          targetZ: mouse3D.worldZ
        });
      }
      this.attackCooldown = 0.65;
    } else if (roll < 0.75) {
      if (window.soundEngine) window.soundEngine.playArcaneBeam();
      physics3D.addTrauma(0.35);
      const meteorX = mouse3D.worldX + (Math.random() - 0.5) * 12;

      physics3D.addProjectile3D({
        type: 'meteor',
        x: meteorX,
        y: 35,
        z: mouse3D.worldZ + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 5,
        vy: -45,
        vz: 0,
        radius: 1.8
      });

      sceneManager3D.damageFloorAt(meteorX, 10, 65, physics3D);
      this.attackCooldown = 1.1;
      if (Math.random() < 0.4) this.say(this.quips[Math.floor(Math.random() * this.quips.length)]);
    } else {
      if (window.soundEngine) window.soundEngine.playLightning();
      physics3D.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 25, 0xc084fc);
      physics3D.addTrauma(0.25);
      physics3D.blastRadius3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 8, 55, sceneManager3D.props);
      sceneManager3D.damageFloorAt(mouse3D.worldX, 8, 50, physics3D);
      mouse3D.triggerDeflection();
      physics3D.stats.deflections++;
      this.attackCooldown = 0.85;
    }
  }

  fireUpwardAtCursor(mouse3D, physics3D) {
    if (window.soundEngine) window.soundEngine.playMagicMissile();
    physics3D.addProjectile3D({
      type: 'magic_missile',
      x: this.group.position.x,
      y: this.group.position.y + 6.2,
      z: this.group.position.z,
      vx: (mouse3D.worldX - this.group.position.x) * 0.8,
      vy: 45,
      vz: 0,
      speed: 40,
      color: 0xec4899,
      life: 2.5,
      targetX: mouse3D.worldX,
      targetY: mouse3D.worldY,
      targetZ: mouse3D.worldZ
    });
  }
}

// ==========================================
// 2. PRODUCTION 3D SOLDIER (Skinned Military Commando)
// ==========================================
class Soldier3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Soldier', x, y, z, scene);
    this.collisionRadius = 1.8;
    this.moveSpeed = 19;
    this.recoil = 0;

    this.say("LOCK AND LOAD! LIGHT UP THE GRID!");
    this.quips = [
      "LIGHT IT UP!",
      "WHY WON'T YOU BLEED?!",
      "UNLOAD ALL MAGAZINES!",
      "CALLING IN HIGH-CALIBER SUPPORT!"
    ];
    this.fallQuips = [
      "STRUCTURAL CAVE-IN! MAYDAY!",
      "GROUND IS GONE! DEPLOYING CHUTE!",
      "KEEP FIRING DOWN INTO THE BREACH!"
    ];
    this.huntQuips = [
      "TARGET BROKE VISUAL CONTACT. SWEEPING PERIMETER.",
      "CHECKING DEAD ZONES. FLUSH HIM OUT!",
      "RELOADING AND ADVANCING TO BOUNDARY."
    ];

    this.attachGLTFModel('soldier', (model) => {
      // Find right hand bone and attach tactical carbine
      const rightHand = model.getObjectByName('mixamorigRightHand');
      this.buildTacticalRifle(rightHand || this.group);
    });
  }

  buildTacticalRifle(parentBone) {
    this.rifleGroup = new THREE.Group();
    // Offset and align rifle with right grip
    this.rifleGroup.position.set(0.12, 0.22, 0.15);
    this.rifleGroup.rotation.set(-Math.PI * 0.45, 0, Math.PI * 0.5);

    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.28
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.7
    });

    // Receiver chassis
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 1.1), gunMat);
    this.rifleGroup.add(body);

    // Fluted heavy barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 10), gunMat);
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.set(0, 0.04, 0.85);
    this.rifleGroup.add(barrel);

    // Muzzle brake
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.2, 10), gunMat);
    muzzle.rotation.x = Math.PI * 0.5;
    muzzle.position.set(0, 0.04, 1.35);
    this.rifleGroup.add(muzzle);

    // Holographic optical sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.35), gunMat);
    sight.position.set(0, 0.22, 0.05);
    this.rifleGroup.add(sight);

    // Curved magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.26), gripMat);
    mag.position.set(0, -0.28, 0.2);
    mag.rotation.x = -0.25;
    this.rifleGroup.add(mag);

    // Muzzle flash dynamic light
    this.muzzleLight = new THREE.PointLight(0xf59e0b, 0, 16);
    this.muzzleLight.position.set(0, 0.04, 1.55);
    this.rifleGroup.add(this.muzzleLight);

    parentBone.add(this.rifleGroup);
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);
    if (this.state === 'FREEFALL' || this.state === 'LANDING') {
      this.postUpdatePhysics(dt, sceneManager3D, physics3D);
      return;
    }

    if (this.muzzleLight && this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 30);
    }

    if (this.state === 'ATTACKING' || this.state === 'ALERT') {
      const targetX = mouse3D.worldX + (this.squadOffsetX || 0);
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;

      if (Math.abs(dist) > 2.0) {
        const moveDir = Math.sign(dist);
        this.group.position.x += moveDir * Math.min(Math.abs(dist), this.moveSpeed * dt);
        this.playMove(this.moveSpeed);
      } else {
        this.playIdle();
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.fireArsenal(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.2) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 15 * dt);
        this.playMove(15);
      } else {
        this.playIdle();
      }

      const patrolAngle = Math.atan2(Math.sign(dist || this.facing) * 10, 4);
      let diff = patrolAngle - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, 7.0 * dt);
    }

    this.postUpdatePhysics(dt, sceneManager3D, physics3D);
  }

  fireArsenal(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    const barrelWorld = new THREE.Vector3();
    if (this.muzzleLight) {
      this.muzzleLight.getWorldPosition(barrelWorld);
    } else {
      barrelWorld.set(this.group.position.x + this.facing * 2.2, 5.2, this.group.position.z);
    }

    if (roll < 0.65) {
      if (this.muzzleLight) this.muzzleLight.intensity = 5.0;
      if (window.soundEngine) window.soundEngine.playGunshot(false);

      const dx = mouse3D.worldX - barrelWorld.x;
      const dy = mouse3D.worldY - barrelWorld.y;
      const dz = mouse3D.worldZ - barrelWorld.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const spd = 135;

      physics3D.addProjectile3D({
        type: 'bullet',
        x: barrelWorld.x,
        y: barrelWorld.y,
        z: barrelWorld.z,
        vx: (dx / len) * spd,
        vy: (dy / len) * spd,
        vz: (dz / len) * spd,
        damage: 22,
        life: 1.5
      });

      this.attackCooldown = 0.11;
      if (Math.random() < 0.25) {
        sceneManager3D.damageFloorAt(mouse3D.worldX, 3.5, 15, physics3D);
      }
    } else if (roll < 0.85) {
      if (window.soundEngine) window.soundEngine.playJavelinThrow();
      const throwAngle = this.facing === 1 ? Math.PI * 0.25 : Math.PI * 0.75;
      physics3D.addProjectile3D({
        type: 'grenade',
        x: this.group.position.x + this.facing * 2.0,
        y: 5.2,
        z: this.group.position.z + 0.5,
        vx: Math.cos(throwAngle) * 35 + (mouse3D.worldX - this.group.position.x) * 0.4,
        vy: 28,
        vz: 0,
        timer: 1.5
      });
      this.say("FRAG OUT!");
      this.attackCooldown = 1.0;
    } else {
      if (this.muzzleLight) this.muzzleLight.intensity = 8.0;
      if (window.soundEngine) window.soundEngine.playGunshot(true);

      const dx = mouse3D.worldX - barrelWorld.x;
      const dy = mouse3D.worldY - barrelWorld.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 36;

      physics3D.addProjectile3D({
        type: 'rocket',
        x: barrelWorld.x,
        y: barrelWorld.y,
        z: barrelWorld.z,
        vx: (dx / len) * spd,
        vy: (dy / len) * spd,
        vz: 0,
        life: 3.5
      });

      sceneManager3D.damageFloorAt(mouse3D.worldX, 9, 75, physics3D);
      this.say("EAT BAZOOKA!");
      this.attackCooldown = 1.3;
    }
  }

  fireUpwardAtCursor(mouse3D, physics3D) {
    if (this.muzzleLight) this.muzzleLight.intensity = 4.0;
    if (window.soundEngine) window.soundEngine.playGunshot(false);
    physics3D.addProjectile3D({
      type: 'bullet',
      x: this.group.position.x,
      y: 6.2,
      z: this.group.position.z,
      vx: (mouse3D.worldX - this.group.position.x) * 1.5,
      vy: 100,
      vz: 0,
      damage: 25,
      life: 1.5
    });
  }
}

// ==========================================
// 3. PRODUCTION 3D KNIGHT (Skinned Gothic Plate Warrior)
// ==========================================
class Knight3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Knight', x, y, z, scene);
    this.collisionRadius = 1.9;
    this.moveSpeed = 17;

    this.say("BY STEEL AND STONE, THOU SHALT BE CRUSHED!");
    this.quips = [
      "FACE MY STEEL, COWARD!",
      "I WILL CLEAVE THY DEMONIC CORE!",
      "NO CURSOR CAN SHIELD FROM VALOR!",
      "THOU ART NOTHING BEFORE CHIVALRY!"
    ];
    this.fallQuips = [
      "MY ARMOR IS TOO HEAVY! THE KEEP CRUMBLES!",
      "DOWNWARD INTO PERDITION!",
      "I SHALL CLEAVE THE VERY ABYSS!"
    ];
    this.huntQuips = [
      "COME FORTH AND DUEL LIKE A MAN!",
      "THOU CANST NOT HIDE FOREVER IN THE SHADOWS!",
      "I HEAR THY FOOTFALLS BEYOND THE PERIMETER!"
    ];

    this.attachGLTFModel('knight', (model) => {
      // Find greatsword and attach enchanted blade glow light
      const swordMesh = model.getObjectByName('Warrior_Sword');
      this.bladeLight = new THREE.PointLight(0x38bdf8, 1.0, 10);
      this.bladeLight.position.set(0, 0.4, 0);

      const weaponBone = model.getObjectByName('WeaponR');
      if (weaponBone) {
        weaponBone.add(this.bladeLight);
      } else if (swordMesh) {
        swordMesh.add(this.bladeLight);
      } else {
        this.group.add(this.bladeLight);
      }
    });
  }

  playIdle() {
    if (!this.anim) return;
    if (this.anim.getAction('Idle_Weapon')) {
      this.anim.play('Idle_Weapon');
    } else {
      this.anim.play('Idle');
    }
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);
    if (this.state === 'FREEFALL' || this.state === 'LANDING') {
      this.postUpdatePhysics(dt, sceneManager3D, physics3D);
      return;
    }

    if (this.state === 'ATTACKING' || this.state === 'ALERT') {
      const targetX = mouse3D.worldX + (this.squadOffsetX || 0);
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;

      if (Math.abs(dist) > 1.6) {
        const moveDir = Math.sign(dist);
        this.group.position.x += moveDir * Math.min(Math.abs(dist), this.moveSpeed * dt);
        this.playMove(this.moveSpeed);
      } else {
        this.playIdle();
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.slashSword(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.2) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 14 * dt);
        this.playMove(14);
      } else {
        this.playIdle();
      }

      const patrolAngle = Math.atan2(Math.sign(dist || this.facing) * 10, 4);
      let diff = patrolAngle - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, 7.0 * dt);
    }

    if (this.bladeLight) {
      this.bladeLight.intensity = 0.8 + Math.sin(performance.now() * 0.008) * 0.35;
    }

    this.postUpdatePhysics(dt, sceneManager3D, physics3D);
  }

  slashSword(mouse3D, physics3D, sceneManager3D) {
    if (this.anim) {
      if (this.anim.getAction('Sword_Attack')) {
        this.anim.playOnce('Sword_Attack', 'Idle_Weapon', 0.12);
      }
    }

    if (this.bladeLight) {
      this.bladeLight.intensity = 3.5;
    }

    const roll = Math.random();

    if (roll < 0.45) {
      if (window.soundEngine) window.soundEngine.playJavelinThrow();
      const slashAngle = this.facing === 1 ? 0 : Math.PI;
      physics3D.addProjectile3D({
        type: 'sword_wave',
        x: this.group.position.x + this.facing * 3.2,
        y: 4.8,
        z: this.group.position.z + 0.5,
        vx: Math.cos(slashAngle) * 55,
        vy: (mouse3D.worldY - 4.8) * 0.8,
        vz: 0,
        life: 0.65
      });
      this.attackCooldown = 0.65;
    } else if (roll < 0.75) {
      if (window.soundEngine) window.soundEngine.playJavelinThrow();
      const dx = mouse3D.worldX - (this.group.position.x + this.facing * 2.2);
      const dy = mouse3D.worldY - 5.5;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 68;

      physics3D.addProjectile3D({
        type: 'javelin',
        x: this.group.position.x + this.facing * 2.2,
        y: 5.5,
        z: this.group.position.z + 0.5,
        vx: (dx / len) * spd,
        vy: (dy / len) * spd,
        vz: 0,
        stuck: false
      });
      this.say("TASTE MY JAVELIN!");
      this.attackCooldown = 0.9;
    } else {
      if (window.soundEngine) window.soundEngine.playHeavyExplosion(0.9);
      physics3D.addTrauma(0.5);
      physics3D.spawnSparks3D(this.group.position.x + this.facing * 3.5, 0, 0, 35, 0x94a3b8);
      physics3D.blastRadius3D(this.group.position.x + this.facing * 4.0, 0, 0, 11, 80, sceneManager3D.props);
      sceneManager3D.damageFloorAt(this.group.position.x + this.facing * 4.0, 10, 85, physics3D);

      mouse3D.triggerDeflection();
      physics3D.stats.deflections++;
      this.say("CRUMBLE TO ASHES!");
      this.attackCooldown = 1.3;
    }
  }

  fireUpwardAtCursor(mouse3D, physics3D) {
    if (window.soundEngine) window.soundEngine.playJavelinThrow();
    physics3D.addProjectile3D({
      type: 'javelin',
      x: this.group.position.x,
      y: 6.2,
      z: this.group.position.z,
      vx: (mouse3D.worldX - this.group.position.x) * 1.5,
      vy: 75,
      vz: 0,
      stuck: false
    });
  }
}

// ==========================================
// 4. PRODUCTION 3D ROBOT (Skinned Expressive Mech)
// ==========================================
class Robot3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Robot', x, y, z, scene);
    this.collisionRadius = 2.4;
    this.moveSpeed = 15;
    this.heldProp = null;
    this.heldChunk = null;

    this.say("DEMOLITION DIRECTIVE: ALL STRUCTURAL ASSETS TARGETED.");
    this.quips = [
      "SYSTEM OVERLOAD: TARGET IMMUNITY IS UNACCEPTABLE!",
      "DISMANTLING ENVIRONMENT AND FOUNDATIONS!",
      "MAXIMUM HYDRAULIC TORQUE ENGAGED!",
      "EXTERMINATE! EXTERMINATE!"
    ];
    this.fallQuips = [
      "TERRAIN INTEGRITY: 0%. GRAVITATIONAL PLUNGE INITIATED!",
      "RE-ROUTING PNEUMATICS! FREEFALL DETECTED!",
      "SUBSURFACE CHASM BREACHED!"
    ];
    this.huntQuips = [
      "OPTICAL MATRIX LOST. DEPLOYING EXTENDED SENSORS.",
      "SCANNING PERIMETER SECTORS FOR INTRUDER.",
      "CURSOR EXITED VIEWPORT MATRIX. TRACKING RESIDUAL TRACE.",
      "PURGE DIRECTIVE PERSISTS. STANDING BY FOR RE-ENTRY."
    ];

    this.attachGLTFModel('robot', (model) => {
      // Find head and attach glowing cyclops optic sensor light
      const headNode = model.getObjectByName('Head') || model.getObjectByName('Head_1');
      this.eyeLight = new THREE.PointLight(0xef4444, 2.2, 12);
      this.eyeLight.position.set(0, 0.45, 0.4);

      if (headNode) {
        headNode.add(this.eyeLight);
      } else {
        this.group.add(this.eyeLight);
      }
    });
  }

  playIdle() {
    if (!this.anim) return;
    this.anim.play('Idle');
  }

  playMove(speed) {
    if (!this.anim) return;
    if (speed > 16) {
      this.anim.play('Running');
    } else {
      this.anim.play('Walking');
    }
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);
    if (this.state === 'FREEFALL' || this.state === 'LANDING') {
      this.postUpdatePhysics(dt, sceneManager3D, physics3D);
      return;
    }

    if (this.state === 'ATTACKING' || this.state === 'ALERT') {
      const targetX = mouse3D.worldX + (this.squadOffsetX || 0);
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;

      if (Math.abs(dist) > 2.0) {
        const moveDir = Math.sign(dist);
        this.group.position.x += moveDir * Math.min(Math.abs(dist), this.moveSpeed * dt);
        this.playMove(this.moveSpeed);
      } else {
        this.playIdle();
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.executeDemolitionAction(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      this.targetX = targetX;
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.2) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 12 * dt);
        this.playMove(12);
      } else {
        // Head shake scanner animation while scanning perimeter!
        if (this.anim && this.anim.getAction('No')) {
          this.anim.play('No');
        } else {
          this.playIdle();
        }
      }

      const patrolAngle = Math.atan2(Math.sign(dist || this.facing) * 10, 4);
      let diff = patrolAngle - this.group.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1.0, 6.0 * dt);
    }

    if (this.eyeLight) {
      this.eyeLight.intensity = 1.8 + Math.sin(performance.now() * 0.01) * 0.5;
    }

    this.postUpdatePhysics(dt, sceneManager3D, physics3D);
  }

  executeDemolitionAction(mouse3D, physics3D, sceneManager3D) {
    if (this.anim) {
      this.anim.playOnce('Punch', 'Idle', 0.15);
    }

    // 40% chance to rip nearby prop or throw debris
    if (Math.random() < 0.40 && sceneManager3D.props) {
      const candidates = sceneManager3D.props.filter((p) => p.isAlive() && !p.heldByRobot && Math.abs(p.group.position.x - this.group.position.x) < 18);
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        this.heldProp = target;
        target.heldByRobot = true;
        if (window.soundEngine) window.soundEngine.playRobotServo(true);
        this.say("DISMANTLING " + target.name.toUpperCase() + "!");
        this.ripTarget(physics3D, sceneManager3D);
        setTimeout(() => this.hurlObjectAtMouse(mouse3D, physics3D, sceneManager3D), 350);
        this.attackCooldown = 1.4;
        return;
      }

      if (physics3D.debris3D.length > 0) {
        const chunk = physics3D.debris3D[Math.floor(Math.random() * physics3D.debris3D.length)];
        this.heldChunk = chunk;
        chunk.heldByRobot = true;
        if (window.soundEngine) window.soundEngine.playRobotServo(true);
        this.say("HARVESTING FOUNDATION SHARDS!");
        setTimeout(() => this.hurlObjectAtMouse(mouse3D, physics3D, sceneManager3D), 300);
        this.attackCooldown = 1.2;
        return;
      }
    }

    // Standard Hydraulic Punch against cursor
    if (window.soundEngine) window.soundEngine.playRobotServo(true);
    if (mouse3D.active) {
      setTimeout(() => {
        if (mouse3D.active && Math.hypot(this.group.position.x + this.facing * 5.0 - mouse3D.worldX, 5.0 - mouse3D.worldY) < 6.5) {
          if (window.soundEngine) {
            window.soundEngine.playArmorClang();
            window.soundEngine.playShieldDeflect();
          }
          physics3D.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 20, 0xf59e0b);
          mouse3D.triggerDeflection();
          physics3D.stats.deflections++;
        }
      }, 120);
    }

    this.attackCooldown = 0.9;
  }

  ripTarget(physics3D, sceneManager3D) {
    if (window.soundEngine) window.soundEngine.playRobotRip();
    physics3D.addTrauma(0.4);

    if (this.heldProp) {
      if (this.heldProp.isFloorSlab) {
        this.heldProp.slabRef.collapse(physics3D);
      } else {
        this.heldProp.heldByRobot = true;
        this.heldProp.isDestroyed = true;
        if (this.heldProp.group) {
          this.heldProp.group.position.set(this.group.position.x, 11.5, 0);
          this.heldProp.group.rotation.z = Math.PI / 6;
          this.heldProp.group.scale.set(0.65, 0.65, 0.65);
        }
      }
      physics3D.spawnSparks3D(this.group.position.x, 10, 0, 15, 0xe2e8f0);
    }
  }

  hurlObjectAtMouse(mouse3D, physics3D, sceneManager3D) {
    if (window.soundEngine) window.soundEngine.playRobotThrow();
    physics3D.addTrauma(0.45);

    const startX = this.group.position.x;
    const startY = 11;
    const dx = mouse3D.worldX - startX;
    const dy = mouse3D.worldY - startY;
    const dz = mouse3D.worldZ;
    const len = Math.hypot(dx, dy, dz) || 1;
    const spd = 65;

    if (this.heldProp) {
      physics3D.createDebrisFromBox3D(startX, startY, 0, this.heldProp.w, this.heldProp.h, this.heldProp.d, this.heldProp.color, 8);
      for (let i = physics3D.debris3D.length - 8; i < physics3D.debris3D.length; i++) {
        if (physics3D.debris3D[i]) {
          physics3D.debris3D[i].vx = (dx / len) * spd + (Math.random() - 0.5) * 8;
          physics3D.debris3D[i].vy = (dy / len) * spd + 8;
          physics3D.debris3D[i].vz = (dz / len) * spd;
          physics3D.debris3D[i].thrownByRobot = true;
        }
      }
      if (typeof this.heldProp.dispose === 'function') {
        this.heldProp.dispose();
      }
      this.heldProp = null;
    } else if (this.heldChunk) {
      this.heldChunk.heldByRobot = false;
      this.heldChunk.mesh.position.set(startX, startY, 0);
      this.heldChunk.vx = (dx / len) * spd;
      this.heldChunk.vy = (dy / len) * spd;
      this.heldChunk.vz = (dz / len) * spd;
      this.heldChunk.thrownByRobot = true;
      this.heldChunk.isSettled = false;
      this.heldChunk = null;
    }

    sceneManager3D.damageFloorAt(this.group.position.x, 8, 50, physics3D);
  }

  fireUpwardAtCursor(mouse3D, physics3D) {
    if (this.anim) this.anim.playOnce('Punch', 'Idle', 0.1);
    if (window.soundEngine) window.soundEngine.playRobotServo(true);
  }

  dispose() {
    if (this.heldProp && typeof this.heldProp.dispose === 'function') {
      this.heldProp.dispose();
      this.heldProp = null;
    }
    super.dispose();
  }
}

// Global class exports
window.CharacterAssetManager = CharacterAssetManager;
window.Wizard3D = Wizard3D;
window.Soldier3D = Soldier3D;
window.Knight3D = Knight3D;
window.Robot3D = Robot3D;
