// 3D Animated Character Engine using Three.js with PBR Materials & Skeletal Kinematics

class Character3DBase {
  constructor(name, x, y, z, scene) {
    this.name = name;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.scene.add(this.group);

    this.facing = 1;
    this.state = 'ATTACKING'; // 'ATTACKING', 'HUNTING', 'ALERT', 'FREEFALL', 'LANDING'
    this.huntTimer = 0;
    this.alertTimer = 0;
    this.landingTimer = 0;
    this.walkCycle = 0;
    this.breathCycle = 0;
    this.flailCycle = 0;

    this.attackCooldown = 0;
    this.speechText = '';
    this.speechTimer = 0;

    this.targetX = x;
    this.moveSpeed = 16; // Units per second in 3D world
  }

  say(text, duration = 2.4) {
    this.speechText = text;
    this.speechTimer = duration;
    // Dispatch event to 2D UI overlay for crisp dialogue bubble rendering
    if (window.app3D) {
      window.app3D.setDialogue(this.name, text, duration);
    }
  }

  updateCommon(dt, mouse3D, physics3D, sceneManager3D) {
    this.breathCycle += dt * 3.5;

    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) this.speechText = '';
    }

    // 1. Freefall check
    if (sceneManager3D.isCollapsing) {
      if (this.state !== 'FREEFALL') {
        this.state = 'FREEFALL';
        this.onStartFreefall();
      }
      this.flailCycle += dt * 14;
      this.group.position.x += (0 - this.group.position.x) * 1.5 * dt;

      // Still fire upward at cursor during freefall
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

    // 2. Cursor active / hunting transitions
    if (!mouse3D.active) {
      if (this.state !== 'HUNTING') {
        this.state = 'HUNTING';
        this.huntTimer = 0;
        this.onStartHunting(mouse3D.lastExitPos);
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

    // 3. Facing & Rotation
    const targetX = mouse3D.active ? mouse3D.worldX : (mouse3D.lastExitWorldX || this.group.position.x + this.facing * 10);
    this.facing = targetX > this.group.position.x ? 1 : -1;
    this.group.rotation.y = this.facing === 1 ? 0 : Math.PI;
  }

  dispose() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        }
      });
    }
  }
}

// ==========================================
// 1. WIZARD 3D
// ==========================================
class Wizard3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Wizard', x, y, z, scene);
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

    this.buildMesh();
  }

  buildMesh() {
    // Velvet Conical Robe
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x3730a3, roughness: 0.6, metalness: 0.2 });
    this.robe = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.5, 16), robeMat);
    this.robe.position.y = 2.75;
    this.robe.castShadow = true;
    this.group.add(this.robe);

    // Head
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 16), skinMat);
    head.position.y = 5.8;
    head.castShadow = true;
    this.group.add(head);

    // Wizard Beard
    const beardMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 8), beardMat);
    beard.position.set(0.6, 5.0, 0);
    beard.rotation.z = -0.3;
    this.group.add(beard);

    // Pointy Hat
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.2, 16), hatMat);
    brim.position.y = 6.4;
    this.group.add(brim);

    const hatCone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.8, 12), hatMat);
    hatCone.position.set(-0.3, 8.2, 0);
    hatCone.rotation.z = 0.2;
    hatCone.castShadow = true;
    this.group.add(hatCone);

    // Gnarled Staff
    const staffMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    this.staff = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9.0, 8), staffMat);
    this.staff.position.set(2.2, 4.5, 0.5);
    this.staff.castShadow = true;
    this.group.add(this.staff);

    // Crystal Gem with Real Point Light
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), gemMat);
    this.gem.position.set(2.2, 9.0, 0.5);
    this.group.add(this.gem);

    this.staffLight = new THREE.PointLight(0xa855f7, 2.0, 16);
    this.staffLight.position.set(2.2, 9.0, 0.5);
    this.group.add(this.staffLight);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("A CRUDE LANDING... BUT THOU CANST NOT ESCAPE!", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say("WHERE HAST THOU FLED, PHANTOM?!");
    window.soundEngine.playSonarPing();
    this.targetX = lastExitPos ? Math.max(-25, Math.min(25, (lastExitPos.x / window.innerWidth) * 50 - 25)) : this.group.position.x;
  }

  onSpotCursor() {
    this.say("AHA! IT RETURNS FROM THE VOID!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    // Hover levitation
    const hoverY = this.state === 'FREEFALL' ? 4 : 0.8 + Math.sin(this.breathCycle) * 0.4;
    this.group.position.y = hoverY;

    if (this.gem) {
      this.gem.rotation.y += 2.0 * dt;
      this.gem.rotation.x += 1.5 * dt;
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX < this.group.position.x ? mouse3D.worldX + 18 : mouse3D.worldX - 18;
      this.targetX = Math.max(-26, Math.min(26, desiredX));
      this.group.position.x += (this.targetX - this.group.position.x) * 2.2 * dt;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.castSpell(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      this.group.position.x += (this.targetX - this.group.position.x) * 1.5 * dt;
    }
  }

  castSpell(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.45) {
      // 3D Homing Arcane Missiles
      window.soundEngine.playMagicMissile();
      for (let i = 0; i < 3; i++) {
        const spreadAngle = (i - 1) * 0.35 + (this.facing === 1 ? 0 : Math.PI);
        physics3D.addProjectile3D({
          type: 'magic_missile',
          x: this.group.position.x + this.facing * 2.5,
          y: 7.0,
          z: 0.5,
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
      // 3D Meteor Strike
      window.soundEngine.playArcaneBeam();
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
      // 3D Lightning Arc
      window.soundEngine.playLightning();
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
    window.soundEngine.playMagicMissile();
    physics3D.addProjectile3D({
      type: 'magic_missile',
      x: this.group.position.x,
      y: this.group.position.y + 6,
      z: 0,
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
// 2. SOLDIER 3D
// ==========================================
class Soldier3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Soldier', x, y, z, scene);
    this.recoil = 0;
    this.say("LOCK AND LOAD! LIGHT UP THE GRID!");
    this.quips = [
      "LIGHT IT UP!",
      "WHY WON'T YOU BLEED?!",
      "UNLOAD ALL MAGAZINES!",
      "DIRECT HIT AND ZERO CASUALTIES?! WTF!",
      "CALLING IN HEAVY ARTILLERY!"
    ];
    this.fallQuips = [
      "STRUCTURAL BREACH! WE'RE GOING DOWN! MAYDAY!",
      "THE FLOOR GAVE WAY! MAN DOWN!",
      "FREEFALL COMBAT ENGAGED! FIRE ON TARGET!",
      "HOLD ONTO YOUR HELMETS!"
    ];

    this.buildMesh();
  }

  buildMesh() {
    // Legs & Combat Boots
    const camoMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.7 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.9), camoMat);
    this.legL.position.set(-0.6, 1.3, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.9), camoMat);
    this.legR.position.set(0.6, 1.3, 0);
    this.group.add(this.legR);

    // Torso & Ballistic Plate Carrier
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 1.4), vestMat);
    torso.position.y = 4.0;
    torso.castShadow = true;
    this.group.add(torso);

    // Head & Ballistic Helmet with NVG Monocle
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16), skinMat);
    head.position.y = 5.9;
    this.group.add(head);

    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.5 });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
    helmet.position.y = 6.0;
    this.group.add(helmet);

    // Green NVG Monocle
    const nvgMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 });
    const nvg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5), nvgMat);
    nvg.position.set(0.6, 6.0, 0.8);
    nvg.rotation.x = Math.PI / 2;
    this.group.add(nvg);

    // Assault Rifle
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    this.rifle = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.5), gunMat);
    this.rifle.position.set(1.4, 4.2, 0.8);
    this.rifle.castShadow = true;
    this.group.add(this.rifle);

    // Muzzle Light Flash
    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 12);
    this.muzzleLight.position.set(3.4, 4.2, 0.8);
    this.group.add(this.muzzleLight);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("COMBAT LANDING CONFIRMED! RESUMING PURSUIT!", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say("TARGET OFF-GRID! PERIMETER SEARCH IN EFFECT!");
    window.soundEngine.playSonarPing();
    this.targetX = lastExitPos ? Math.max(-25, Math.min(25, (lastExitPos.x / window.innerWidth) * 50 - 25)) : this.group.position.x;
  }

  onSpotCursor() {
    this.say("CONTACT! TARGET RE-ACQUIRED! FIRE!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - 15 * dt);
      this.rifle.position.x = 1.4 - this.recoil * 0.4;
    }
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - 25 * dt);
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX + (mouse3D.worldX > this.group.position.x ? -18 : 18);
      this.targetX = Math.max(-25, Math.min(25, desiredX));
      const dist = this.targetX - this.group.position.x;
      this.group.position.x += dist * 2.8 * dt;

      // Leg stride animation
      this.walkCycle += Math.abs(dist) * 0.4;
      this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
      this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.fireArsenal(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      this.group.position.x += (this.targetX - this.group.position.x) * 1.8 * dt;
    }
  }

  fireArsenal(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.65) {
      // 3D Rapid Bullet Stream
      this.recoil = 1.0;
      this.muzzleLight.intensity = 3.5;
      window.soundEngine.playGunshot(false);

      const barrelX = this.group.position.x + this.facing * 3.4;
      const barrelY = this.group.position.y + 4.2;
      const barrelZ = this.group.position.z + 0.8;

      const dx = mouse3D.worldX - barrelX;
      const dy = mouse3D.worldY - barrelY;
      const dz = mouse3D.worldZ - barrelZ;
      const len = Math.hypot(dx, dy, dz) || 1;
      const spd = 120;

      physics3D.addProjectile3D({
        type: 'bullet',
        x: barrelX,
        y: barrelY,
        z: barrelZ,
        vx: (dx / len) * spd,
        vy: (dy / len) * spd,
        vz: (dz / len) * spd,
        damage: 22,
        life: 1.5
      });

      this.attackCooldown = 0.12;
      if (Math.random() < 0.25) {
        sceneManager3D.damageFloorAt(mouse3D.worldX, 3.5, 15, physics3D);
      }
    } else if (roll < 0.85) {
      // 3D Frag Grenade
      window.soundEngine.playJavelinThrow();
      const throwAngle = this.facing === 1 ? Math.PI * 0.25 : Math.PI * 0.75;
      physics3D.addProjectile3D({
        type: 'grenade',
        x: this.group.position.x + this.facing * 2.0,
        y: 5.0,
        z: 0.5,
        vx: Math.cos(throwAngle) * 35 + (mouse3D.worldX - this.group.position.x) * 0.4,
        vy: 28,
        vz: 0,
        timer: 1.5
      });
      this.say("FRAG OUT!");
      this.attackCooldown = 1.0;
    } else {
      // 3D RPG Rocket
      this.recoil = 2.0;
      this.muzzleLight.intensity = 5.0;
      window.soundEngine.playGunshot(true);

      const dx = mouse3D.worldX - this.group.position.x;
      const dy = mouse3D.worldY - 5.0;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 35;

      physics3D.addProjectile3D({
        type: 'rocket',
        x: this.group.position.x + this.facing * 3.5,
        y: 4.5,
        z: 0.8,
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
    this.recoil = 1.5;
    this.muzzleLight.intensity = 3.0;
    window.soundEngine.playGunshot(false);
    physics3D.addProjectile3D({
      type: 'bullet',
      x: this.group.position.x,
      y: 6.0,
      z: 0,
      vx: (mouse3D.worldX - this.group.position.x) * 1.5,
      vy: 100,
      vz: 0,
      damage: 25,
      life: 1.5
    });
  }
}

// ==========================================
// 3. KNIGHT 3D
// ==========================================
class Knight3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Knight', x, y, z, scene);
    this.say("BY STEEL AND STONE, THOU SHALT BE CRUSHED!");
    this.quips = [
      "FACE MY STEEL, COWARD!",
      "I WILL CLEAVE THY DEMONIC CORE!",
      "STAND THY GROUND AND FIGHT ME!",
      "THE EARTH ITSELF TREMBLES AT MY CHARGE!"
    ];
    this.fallQuips = [
      "THE ABYSS HATH CLAIMED THE FLOOR!",
      "BRACE THY ARMOR! WE PLUNGE INTO CHAOS!",
      "MY BLADE WILL STRIKE THEE AS WE FALL!"
    ];

    this.buildMesh();
  }

  buildMesh() {
    // Burnished Steel Armor Material with High PBR Reflectivity
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.92,
      roughness: 0.18
    });

    // Plate Legs
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 1.0), steelMat);
    this.legL.position.set(-0.65, 1.4, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.8, 1.0), steelMat);
    this.legR.position.set(0.65, 1.4, 0);
    this.group.add(this.legR);

    // Cuirass Breastplate
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 1.5), steelMat);
    torso.position.y = 4.2;
    torso.castShadow = true;
    this.group.add(torso);

    // Great-helm Helmet
    const helm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 1.8), steelMat);
    helm.position.y = 6.2;
    helm.castShadow = true;
    this.group.add(helm);

    // Glowing Red Visor Eye Slit
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 });
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.2), eyeMat);
    eye.position.set(0.6, 6.2, 0.95);
    this.group.add(eye);

    // Crimson Velvet Cape
    const capeMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7, side: THREE.DoubleSide });
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.5, 4, 4), capeMat);
    this.cape.position.set(-0.8, 3.8, -0.85);
    this.cape.rotation.y = Math.PI;
    this.group.add(this.cape);

    // Zweihänder Greatsword
    const swordMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.95, roughness: 0.1 });
    this.sword = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.5, 0.15), swordMat);
    this.sword.position.set(2.0, 5.0, 0.5);
    this.sword.rotation.z = -0.3;
    this.sword.castShadow = true;
    this.group.add(this.sword);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("A WARRIOR BOWS TO NO CHASM! DRAW STEEL!", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say("COME FORTH, PHANTOM! THOU CANST NOT HIDE FOREVER!");
    window.soundEngine.playArmorClang();
    this.targetX = lastExitPos ? Math.max(-25, Math.min(25, (lastExitPos.x / window.innerWidth) * 50 - 25)) : this.group.position.x;
  }

  onSpotCursor() {
    this.say("THOU HAST RETURNED! PREPARE THYSELF!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    // Cape flutter
    if (this.cape) {
      this.cape.rotation.x = this.state === 'FREEFALL' ? Math.PI : Math.sin(Date.now() * 0.006) * 0.2;
    }

    if (this.state === 'ATTACKING') {
      const dist = mouse3D.worldX - this.group.position.x;
      if (Math.abs(dist) > 12) {
        const dir = dist > 0 ? 1 : -1;
        this.group.position.x += dir * this.moveSpeed * dt;
        this.walkCycle += this.moveSpeed * dt * 0.4;
        this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
        this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.meleeAssault(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      this.group.position.x += (this.targetX - this.group.position.x) * 1.6 * dt;
    }
  }

  meleeAssault(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.45) {
      // 3D Sword Cleave Wave
      window.soundEngine.playSwordSlash();
      const slashAngle = this.facing === 1 ? 0 : Math.PI;

      physics3D.addProjectile3D({
        type: 'sword_wave',
        x: this.group.position.x + this.facing * 3.0,
        y: 4.5,
        z: 0.5,
        vx: Math.cos(slashAngle) * 50,
        vy: (mouse3D.worldY - 4.5) * 0.8,
        vz: 0,
        life: 0.65
      });
      this.attackCooldown = 0.6;
    } else if (roll < 0.75) {
      // 3D Thrown Javelin / Spear
      window.soundEngine.playJavelinThrow();
      const dx = mouse3D.worldX - (this.group.position.x + this.facing * 2.0);
      const dy = mouse3D.worldY - 5.5;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 65;

      physics3D.addProjectile3D({
        type: 'javelin',
        x: this.group.position.x + this.facing * 2.0,
        y: 5.5,
        z: 0.5,
        vx: (dx / len) * spd,
        vy: (dy / len) * spd,
        vz: 0,
        stuck: false
      });
      this.say("TASTE MY JAVELIN!");
      this.attackCooldown = 0.9;
    } else {
      // Earthquake Shield Slam (Destroys Floor)
      window.soundEngine.playHeavyExplosion(0.9);
      physics3D.addTrauma(0.5);
      physics3D.spawnSparks3D(this.group.position.x + this.facing * 3.5, 0, 0, 30, 0x94a3b8);
      physics3D.blastRadius3D(this.group.position.x + this.facing * 4.0, 0, 0, 11, 80, sceneManager3D.props);
      sceneManager3D.damageFloorAt(this.group.position.x + this.facing * 4.0, 10, 85, physics3D);

      mouse3D.triggerDeflection();
      physics3D.stats.deflections++;
      this.say("CRUMBLE TO ASHES!");
      this.attackCooldown = 1.3;
    }
  }

  fireUpwardAtCursor(mouse3D, physics3D) {
    window.soundEngine.playJavelinThrow();
    physics3D.addProjectile3D({
      type: 'javelin',
      x: this.group.position.x,
      y: 6.0,
      z: 0,
      vx: (mouse3D.worldX - this.group.position.x) * 1.5,
      vy: 70,
      vz: 0,
      stuck: false
    });
  }
}

// ==========================================
// 4. ROBOT 3D (3D Extendable Arm & Scenery Ripper)
// ==========================================
class Robot3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Robot', x, y, z, scene);
    this.armExtension = 0;
    this.armTarget = new THREE.Vector3();
    this.heldProp = null;
    this.heldChunk = null;
    this.actionPhase = 'IDLE';
    this.stateTimer = 0;

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

    this.buildMesh();
  }

  buildMesh() {
    // Industrial Heavy Mech Materials
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.25 });

    // Hydraulic Legs
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), metalMat);
    this.legL.position.set(-1.0, 1.6, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), metalMat);
    this.legR.position.set(1.0, 1.6, 0);
    this.group.add(this.legR);

    // Mech Chassis
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.6, 2.4), yellowMat);
    this.torso.position.y = 4.6;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Hazard Stripes across chest
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 2.5), stripeMat);
    stripe.position.y = 4.6;
    this.group.add(stripe);

    // Cyclops Red Optical Sensor with Spotlight
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.0 });
    this.eye = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16), eyeMat);
    this.eye.position.set(0, 5.5, 1.2);
    this.eye.rotation.x = Math.PI / 2;
    this.group.add(this.eye);

    this.eyeSpot = new THREE.SpotLight(0xef4444, 2.5, 30, Math.PI / 6, 0.4);
    this.eyeSpot.position.set(0, 5.5, 1.3);
    this.eyeSpot.target.position.set(10, 5.5, 1.3);
    this.group.add(this.eyeSpot);
    this.group.add(this.eyeSpot.target);

    // 3D Extendable Hydraulic Scissor Arm Hierarchy
    this.armRoot = new THREE.Group();
    this.armRoot.position.set(1.8, 5.0, 0);
    this.group.add(this.armRoot);

    // Multi-link Scissor Mesh
    const linkMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
    this.linkBeams = [];
    for (let b = 0; b < 4; b++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.4), linkMat);
      beam.position.set(b * 1.8, 0, 0);
      this.armRoot.add(beam);
      this.linkBeams.push(beam);
    }

    // Heavy Hardened Steel Claw Clamp
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });
    this.claw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), clawMat);
    this.claw.position.set(7.2, 0, 0);
    this.armRoot.add(this.claw);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("IMPACT DAMPENERS ENGAGED. RESUMING PURGE.", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say("OPTICAL MATRIX LOST. DEPLOYING EXTENDED SENSORS.");
    window.soundEngine.playSonarPing();
    this.targetX = lastExitPos ? Math.max(-25, Math.min(25, (lastExitPos.x / window.innerWidth) * 50 - 25)) : this.group.position.x;
  }

  onSpotCursor() {
    this.say("INTRUDER RE-ACQUIRED! PREPARE FOR CRUSH!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX < this.group.position.x ? mouse3D.worldX + 20 : mouse3D.worldX - 20;
      this.targetX = Math.max(-25, Math.min(25, desiredX));
      this.group.position.x += (this.targetX - this.group.position.x) * 2.0 * dt;

      this.attackCooldown -= dt;

      // Hydraulic Extension Mechanics
      if (this.actionPhase === 'EXTEND_RIP') {
        this.armExtension = Math.min(1.0, this.armExtension + 3.0 * dt);
        this.updateArmPose();
        if (this.armExtension >= 1.0) {
          this.ripTarget(physics3D, sceneManager3D);
          this.actionPhase = 'HOLD_OVERHEAD';
          this.stateTimer = 0.35;
        }
      } else if (this.actionPhase === 'HOLD_OVERHEAD') {
        this.stateTimer -= dt;
        this.armTarget.set(this.group.position.x, 12, 0);
        this.updateArmPose();
        if (this.stateTimer <= 0) {
          this.actionPhase = 'HURL';
        }
      } else if (this.actionPhase === 'HURL') {
        this.hurlObjectAtMouse(mouse3D, physics3D, sceneManager3D);
        this.actionPhase = 'IDLE';
        this.armExtension = 0;
        this.updateArmPose();
        this.attackCooldown = 1.1;
      } else if (this.actionPhase === 'EXTEND_PUNCH') {
        this.armExtension = Math.min(1.0, this.armExtension + 6.0 * dt);
        this.updateArmPose();
        if (this.armExtension >= 1.0) {
          this.actionPhase = 'IDLE';
          this.armExtension = 0;
          this.updateArmPose();
          this.attackCooldown = 0.5;
        }
      } else {
        if (this.attackCooldown <= 0) {
          this.initiateAttack(mouse3D, physics3D, sceneManager3D);
        }
      }
    } else if (this.state === 'HUNTING') {
      this.group.position.x += (this.targetX - this.group.position.x) * 1.5 * dt;
    }
  }

  updateArmPose() {
    const scale = 0.3 + this.armExtension * 1.8;
    this.armRoot.scale.set(scale, 1, 1);
  }

  initiateAttack(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    // 70% chance to RIP SCENERY OR FLOOR SLAB AND HURL IT
    if (roll < 0.7) {
      const target = sceneManager3D.findPropForRobot(this.group.position.x);
      if (target) {
        this.heldProp = target;
        this.armTarget.set(target.group.position.x, target.group.position.y + 2, target.group.position.z || 0);
        this.actionPhase = 'EXTEND_RIP';
        this.armExtension = 0;
        window.soundEngine.playRobotServo(true);
        this.say("DISMANTLING " + target.name.toUpperCase() + "!");
        return;
      }

      if (physics3D.debris3D.length > 0) {
        const chunk = physics3D.debris3D[Math.floor(Math.random() * physics3D.debris3D.length)];
        this.heldChunk = chunk;
        chunk.heldByRobot = true;
        this.armTarget.copy(chunk.mesh.position);
        this.actionPhase = 'EXTEND_RIP';
        this.armExtension = 0;
        window.soundEngine.playRobotServo(true);
        this.say("HARVESTING FOUNDATION SHARDS!");
        return;
      }
    }

    // Spring punch directly at mouse cursor
    this.actionPhase = 'EXTEND_PUNCH';
    this.armTarget.set(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ);
    this.armExtension = 0;
    window.soundEngine.playRobotServo(true);

    if (mouse3D.active) {
      setTimeout(() => {
        if (mouse3D.active && Math.hypot(this.group.position.x + 8 - mouse3D.worldX, 5.0 - mouse3D.worldY) < 5) {
          window.soundEngine.playArmorClang();
          window.soundEngine.playShieldDeflect();
          physics3D.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 20, 0xf59e0b);
          mouse3D.triggerDeflection();
          physics3D.stats.deflections++;
        }
      }, 100);
    }
  }

  ripTarget(physics3D, sceneManager3D) {
    window.soundEngine.playRobotRip();
    physics3D.addTrauma(0.4);

    if (this.heldProp) {
      if (this.heldProp.isFloorSlab) {
        this.heldProp.slabRef.collapse(physics3D);
      } else {
        this.heldProp.heldByRobot = true;
        this.heldProp.isDestroyed = true;
      }
      physics3D.spawnSparks3D(this.heldProp.group.position.x, this.heldProp.group.position.y, 0, 15, 0xe2e8f0);
    }
  }

  hurlObjectAtMouse(mouse3D, physics3D, sceneManager3D) {
    window.soundEngine.playRobotThrow();
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
    this.actionPhase = 'EXTEND_PUNCH';
    this.armExtension = 1.0;
    this.updateArmPose();
    window.soundEngine.playRobotServo(true);
  }
}

window.Wizard3D = Wizard3D;
window.Soldier3D = Soldier3D;
window.Knight3D = Knight3D;
window.Robot3D = Robot3D;
