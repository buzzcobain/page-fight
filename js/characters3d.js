// Sculpted 3D Character Engine using Procedural Textures & Organic Mesh Assemblies
// Replaces primitive blocky geometries with contoured anatomical armor, flowing robes, and industrial hydraulics.

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
    this.walkCycle = 0;
    this.breathCycle = 0;
    this.flailCycle = 0;

    this.attackCooldown = 0;
    this.speechText = '';
    this.speechTimer = 0;

    this.targetX = x;
    this.moveSpeed = 16;
  }

  say(text, duration = 2.4) {
    this.speechText = text;
    this.speechTimer = duration;
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

    if (sceneManager3D.isCollapsing) {
      if (this.state !== 'FREEFALL') {
        this.state = 'FREEFALL';
        this.onStartFreefall();
      }
      this.flailCycle += dt * 14;
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

        // Active perimeter sweep and hunting loop
        if (this.huntScanTimer <= 0) {
          const roll = Math.random();
          if (roll < 0.45) {
            // Rush toward left/right border where cursor escaped
            const exitSign = (mouse3D.lastExitWorldX || 0) >= 0 ? 1 : -1;
            this.huntPatrolTargetX = exitSign * (36 + Math.random() * 6);
            this.huntScanTimer = 3.0 + Math.random() * 2.0;
            if (Math.random() < 0.5) window.soundEngine.playSonarPing();
            this.onScanBorder();
          } else if (roll < 0.8) {
            // Patrol across arena to other side
            this.huntPatrolTargetX = (Math.random() * 2 - 1) * 36;
            this.huntScanTimer = 3.5 + Math.random() * 2.0;
            if (Math.random() < 0.4) this.onScanBorder();
          } else {
            // Stand and scan border
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

    if (this.state !== 'HUNTING') {
      const targetX = mouse3D.active ? mouse3D.worldX : (mouse3D.lastExitWorldX || this.group.position.x + this.facing * 10);
      this.facing = targetX > this.group.position.x ? 1 : -1;
      this.group.rotation.y = this.facing === 1 ? 0 : Math.PI;
    }
  }

  onScanBorder() {
    if (this.huntQuips && this.huntQuips.length > 0 && Math.random() < 0.65) {
      const q = this.huntQuips[Math.floor(Math.random() * this.huntQuips.length)];
      this.say(q, 2.5);
    }
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
// 1. SCULPTED WIZARD 3D
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
    this.huntQuips = [
      "WHERE HAST THOU FLED, SPECTRAL ARROW?!",
      "I SENSE THY ESSENCE LURKING BEYOND THE FRAME!",
      "THOU ART COWARDLY TO ABANDON THE REALM!",
      "REVEAL THYSELF BEFORE I TEAR THE VEIL ASUNDER!"
    ];

    this.buildMesh();
  }

  buildMesh() {
    const clothTex = TextureGen.createFabricTexture('#312e81');

    // Flowing Contoured Robes
    const robeMat = new THREE.MeshStandardMaterial({
      map: clothTex,
      bumpMap: clothTex,
      bumpScale: 0.08,
      roughness: 0.7,
      metalness: 0.1
    });

    // Lower flared robe skirt with soft curvature
    const skirtGeom = new THREE.CylinderGeometry(1.2, 2.4, 5.0, 16, 4, true);
    this.skirt = new THREE.Mesh(skirtGeom, robeMat);
    this.skirt.position.y = 2.5;
    this.skirt.castShadow = true;
    this.group.add(this.skirt);

    // Upper sculpted torso
    const chestGeom = new THREE.CylinderGeometry(1.3, 1.2, 2.4, 16);
    const chest = new THREE.Mesh(chestGeom, robeMat);
    chest.position.y = 4.8;
    chest.castShadow = true;
    this.group.add(chest);

    // Gold Astrological Cowl Trim
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 8, 16), goldMat);
    collar.position.y = 5.8;
    collar.rotation.x = Math.PI / 2;
    this.group.add(collar);

    // Sculpted Head & Face
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), skinMat);
    head.position.y = 6.4;
    this.group.add(head);

    // Glowing Arcane Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.0 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
    eyeL.position.set(0.6, 6.5, 0.45);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
    eyeR.position.set(0.6, 6.5, -0.45);
    this.group.add(eyeL);
    this.group.add(eyeR);

    // Flowing Stranded Beard
    const beardMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.6, 8), beardMat);
    beard.position.set(0.65, 5.2, 0);
    beard.rotation.z = -0.25;
    this.group.add(beard);

    // Sculpted Wizard Hat with Folded Point
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.6 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.15, 24), hatMat);
    brim.position.y = 7.0;
    this.group.add(brim);

    const hatCone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.8, 16), hatMat);
    hatCone.position.set(-0.35, 8.8, 0);
    hatCone.rotation.z = 0.22;
    hatCone.castShadow = true;
    this.group.add(hatCone);

    // Gnarled Wooden Staff with Twisted Branch Feel
    const woodTex = TextureGen.createWoodTexture();
    const staffMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 });
    this.staff = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 9.5, 8), staffMat);
    this.staff.position.set(2.2, 4.8, 0.8);
    this.staff.castShadow = true;
    this.group.add(this.staff);

    // Golden Grasping Prongs holding Gem
    const prongs = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 12), goldMat);
    prongs.position.set(2.2, 9.4, 0.8);
    prongs.rotation.x = Math.PI / 2;
    this.group.add(prongs);

    // Faceted Pulsing Crystal Gem with Real Volumetric Point Light
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 1.0,
      roughness: 0.05,
      metalness: 0.1
    });
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), gemMat);
    this.gem.position.set(2.2, 9.6, 0.8);
    this.group.add(this.gem);

    this.staffLight = new THREE.PointLight(0xa855f7, 2.5, 18);
    this.staffLight.position.set(2.2, 9.6, 0.8);
    this.group.add(this.staffLight);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("A CRUDE LANDING... BUT THOU CANST NOT ESCAPE!", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say(this.huntQuips[0]);
    window.soundEngine.playSonarPing();
    this.huntPatrolTargetX = lastExitPos ? Math.max(-42, Math.min(42, (lastExitPos.x / window.innerWidth) * 88 - 44)) : (this.facing * 36);
  }

  onSpotCursor() {
    this.say("AHA! IT RETURNS FROM THE VOID!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    const hoverY = this.state === 'FREEFALL' ? 4 : 0.8 + Math.sin(this.breathCycle) * 0.4;
    this.group.position.y = hoverY;

    if (this.gem) {
      this.gem.rotation.y += 2.2 * dt;
      this.gem.rotation.x += 1.6 * dt;
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX < this.group.position.x ? mouse3D.worldX + 18 : mouse3D.worldX - 18;
      this.targetX = Math.max(-42, Math.min(42, desiredX));
      this.group.position.x += (this.targetX - this.group.position.x) * 2.2 * dt;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.castSpell(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.2) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 16 * dt);
        this.facing = dist >= 0 ? 1 : -1;
      }
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 3.5) * 0.45;
      if (this.staff) {
        this.staff.rotation.x = -0.3 + Math.sin(this.huntTimer * 2.8) * 0.35;
      }
    }
  }

  castSpell(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.45) {
      window.soundEngine.playMagicMissile();
      for (let i = 0; i < 3; i++) {
        const spreadAngle = (i - 1) * 0.35 + (this.facing === 1 ? 0 : Math.PI);
        physics3D.addProjectile3D({
          type: 'magic_missile',
          x: this.group.position.x + this.facing * 2.5,
          y: 7.2,
          z: 0.8,
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
// 2. SCULPTED SOLDIER 3D
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
    this.huntQuips = [
      "TARGET OFF-GRID! PERIMETER SEARCH IN EFFECT!",
      "WHERE IS THAT GLITCH HIDING?!",
      "SWEEPING SECTORS! IT CANNOT ESCAPE THE SYSTEM!",
      "EYES ON THE BORDERS! DON'T LET IT FLANK US!"
    ];

    this.buildMesh();
  }

  buildMesh() {
    const camoTex = TextureGen.createFabricTexture('#14532d');
    const vestTex = TextureGen.createFabricTexture('#0f172a');

    const camoMat = new THREE.MeshStandardMaterial({ map: camoTex, bumpMap: camoTex, bumpScale: 0.05, roughness: 0.7 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });

    // Contoured Legs with Knee Pads
    this.legL = new THREE.Group();
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 2.6, 12), camoMat);
    thighL.position.y = 1.3;
    const kneeL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bootMat);
    kneeL.position.set(0.18, 1.3, 0);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.1), bootMat);
    bootL.position.set(0.1, 0.3, 0);
    this.legL.add(thighL);
    this.legL.add(kneeL);
    this.legL.add(bootL);
    this.legL.position.set(-0.6, 0, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Group();
    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 2.6, 12), camoMat);
    thighR.position.y = 1.3;
    const kneeR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bootMat);
    kneeR.position.set(0.18, 1.3, 0);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.1), bootMat);
    bootR.position.set(0.1, 0.3, 0);
    this.legR.add(thighR);
    this.legR.add(kneeR);
    this.legR.add(bootR);
    this.legR.position.set(0.6, 0, 0);
    this.group.add(this.legR);

    // Anatomical Contoured Torso with MOLLE Pouches
    const vestMat = new THREE.MeshStandardMaterial({ map: vestTex, roughness: 0.6, metalness: 0.2 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 2.8, 14), vestMat);
    torso.position.y = 4.1;
    torso.castShadow = true;
    this.group.add(torso);

    // Ammo Pouches on Plate Carrier
    const pouchMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.5 });
    for (let p = -1; p <= 1; p++) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pouchMat);
      pouch.position.set(p * 0.6, 3.8, 1.1);
      this.group.add(pouch);
    }

    // Radio Antenna on back
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2), bootMat);
    antenna.position.set(-0.8, 5.2, -1.0);
    antenna.rotation.z = -0.15;
    this.group.add(antenna);

    // Head with Balaclava & Goggles
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16), skinMat);
    head.position.y = 5.9;
    this.group.add(head);

    // Sculpted Ballistic Helmet with ARC rails
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.45, metalness: 0.2 });
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.98, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
    helmet.position.y = 6.0;
    this.group.add(helmet);

    // Tactile NVG Monocle
    const nvgMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.0 });
    const nvg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.6), nvgMat);
    nvg.position.set(0.65, 6.0, 0.85);
    nvg.rotation.x = Math.PI / 2;
    this.group.add(nvg);

    // Detailed Assault Rifle with Holographic Sight & Flash Hider
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 });
    this.rifle = new THREE.Group();

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.45), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6), gunMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(2.4, 0.1, 0);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.35), gunMat);
    mag.position.set(0.2, -0.8, 0);
    mag.rotation.z = 0.2;
    const holoOptic = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.4), gunMat);
    holoOptic.position.set(0.2, 0.6, 0);

    this.rifle.add(receiver);
    this.rifle.add(barrel);
    this.rifle.add(mag);
    this.rifle.add(holoOptic);
    this.rifle.position.set(1.4, 4.2, 0.8);
    this.rifle.castShadow = true;
    this.group.add(this.rifle);

    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 14);
    this.muzzleLight.position.set(3.8, 4.3, 0.8);
    this.group.add(this.muzzleLight);
  }

  onStartFreefall() {
    this.say(this.fallQuips[Math.floor(Math.random() * this.fallQuips.length)], 3.0);
  }

  onLandImpact() {
    this.say("COMBAT LANDING CONFIRMED! RESUMING PURSUIT!", 2.2);
  }

  onStartHunting(lastExitPos) {
    this.say(this.huntQuips[0]);
    window.soundEngine.playSonarPing();
    this.huntPatrolTargetX = lastExitPos ? Math.max(-42, Math.min(42, (lastExitPos.x / window.innerWidth) * 88 - 44)) : (this.facing * 36);
  }

  onSpotCursor() {
    this.say("CONTACT! TARGET RE-ACQUIRED! FIRE!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - 15 * dt);
      this.rifle.position.x = 1.4 - this.recoil * 0.35;
    }
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - 25 * dt);
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX + (mouse3D.worldX > this.group.position.x ? -18 : 18);
      this.targetX = Math.max(-42, Math.min(42, desiredX));
      const dist = this.targetX - this.group.position.x;
      this.group.position.x += dist * 2.8 * dt;

      this.walkCycle += Math.abs(dist) * 0.4;
      this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
      this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.fireArsenal(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.5) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 18 * dt);
        this.walkCycle += 18 * dt * 0.4;
        this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
        this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;
        this.facing = dist >= 0 ? 1 : -1;
      } else {
        this.legL.rotation.x = 0;
        this.legR.rotation.x = 0;
      }
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 3.5) * 0.5;
    }
  }

  fireArsenal(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.65) {
      this.recoil = 1.0;
      this.muzzleLight.intensity = 3.5;
      window.soundEngine.playGunshot(false);

      const barrelX = this.group.position.x + this.facing * 3.8;
      const barrelY = this.group.position.y + 4.3;
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
// 3. SCULPTED KNIGHT 3D (Gothic Plate Armor)
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
    this.huntQuips = [
      "COME FORTH, PHANTOM! THOU CANST NOT HIDE FOREVER!",
      "THOU LURKEST BEYOND THE GATES OF VISION!",
      "STAND AND FIGHT, CRAVEN WHELP!",
      "I SHALT NOT REST UNTIL THOU ART CLEFT IN TWAIN!"
    ];

    this.buildMesh();
  }

  buildMesh() {
    const metalTex = TextureGen.createMetalTexture();

    // Burnished Steel Armor Material with High PBR Reflectivity
    const steelMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      bumpMap: metalTex,
      bumpScale: 0.08,
      metalness: 0.95,
      roughness: 0.16
    });

    // Articulated Gothic Plate Greaves & Sabatons
    this.legL = new THREE.Group();
    const greaveL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 2.8, 12), steelMat);
    greaveL.position.y = 1.4;
    const kneeCopL = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), steelMat);
    kneeCopL.position.set(0.2, 1.4, 0);
    const sabatonL = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8), steelMat);
    sabatonL.rotation.z = -Math.PI / 2;
    sabatonL.position.set(0.3, 0.25, 0);
    this.legL.add(greaveL);
    this.legL.add(kneeCopL);
    this.legL.add(sabatonL);
    this.legL.position.set(-0.7, 0, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Group();
    const greaveR = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 2.8, 12), steelMat);
    greaveR.position.y = 1.4;
    const kneeCopR = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), steelMat);
    kneeCopR.position.set(0.2, 1.4, 0);
    const sabatonR = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8), steelMat);
    sabatonR.rotation.z = -Math.PI / 2;
    sabatonR.position.set(0.3, 0.25, 0);
    this.legR.add(greaveR);
    this.legR.add(kneeCopR);
    this.legR.add(sabatonR);
    this.legR.position.set(0.7, 0, 0);
    this.group.add(this.legR);

    // Sculpted Peascod Cuirass Breastplate with Central Ridge
    const chestGeom = new THREE.CylinderGeometry(1.4, 1.1, 3.2, 16);
    const torso = new THREE.Mesh(chestGeom, steelMat);
    torso.position.y = 4.2;
    torso.castShadow = true;
    this.group.add(torso);

    // Overlapping Fluted Shoulder Pauldrons
    const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12, 0, Math.PI), steelMat);
    pauldronL.position.set(-1.6, 5.2, 0);
    pauldronL.rotation.z = 0.4;
    const pauldronR = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12, 0, Math.PI), steelMat);
    pauldronR.position.set(1.6, 5.2, 0);
    pauldronR.rotation.z = -0.4;
    this.group.add(pauldronL);
    this.group.add(pauldronR);

    // Sculpted Sallet / Armet Helmet with Visor Breather
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 16), steelMat);
    helm.position.y = 6.4;
    helm.castShadow = true;
    this.group.add(helm);

    // Glowing Red Visor Eye Slit
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.0 });
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.3), eyeMat);
    eye.position.set(0.75, 6.4, 0.7);
    this.group.add(eye);

    // Crimson Heraldic Mantle / Cape with Dynamic Wind Flutter
    const capeTex = TextureGen.createFabricTexture('#991b1b');
    const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, bumpMap: capeTex, bumpScale: 0.05, side: THREE.DoubleSide });
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8, 6, 6), capeMat);
    this.cape.position.set(-0.8, 4.0, -0.9);
    this.cape.rotation.y = Math.PI;
    this.group.add(this.cape);

    // Contoured Zweihänder Greatsword with Fuller & Leather Grip
    this.sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.5, 0.12), steelMat);
    blade.position.y = 3.25;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8), new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 }));
    hilt.position.y = -0.9;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), steelMat);
    pommel.position.y = -1.8;

    this.sword.add(blade);
    this.sword.add(guard);
    this.sword.add(hilt);
    this.sword.add(pommel);
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
    this.say(this.huntQuips[0]);
    window.soundEngine.playArmorClang();
    this.huntPatrolTargetX = lastExitPos ? Math.max(-42, Math.min(42, (lastExitPos.x / window.innerWidth) * 88 - 44)) : (this.facing * 36);
  }

  onSpotCursor() {
    this.say("THOU HAST RETURNED! PREPARE THYSELF!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    if (this.cape) {
      this.cape.rotation.x = this.state === 'FREEFALL' ? Math.PI : Math.sin(Date.now() * 0.006) * 0.25;
    }

    if (this.state === 'ATTACKING') {
      const dist = mouse3D.worldX - this.group.position.x;
      if (Math.abs(dist) > 12) {
        const dir = dist > 0 ? 1 : -1;
        this.group.position.x = Math.max(-44, Math.min(44, this.group.position.x + dir * this.moveSpeed * dt));
        this.walkCycle += this.moveSpeed * dt * 0.4;
        this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
        this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.meleeAssault(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.5) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), this.moveSpeed * 0.9 * dt);
        this.walkCycle += this.moveSpeed * dt * 0.4;
        this.legL.rotation.x = Math.sin(this.walkCycle) * 0.5;
        this.legR.rotation.x = -Math.sin(this.walkCycle) * 0.5;
        this.facing = dist >= 0 ? 1 : -1;
      } else {
        this.legL.rotation.x = 0;
        this.legR.rotation.x = 0;
      }
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 3.0) * 0.4;
    }
  }

  meleeAssault(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.45) {
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
// 4. SCULPTED ROBOT 3D (Industrial Mech & Hydraulic Ripper)
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
    this.huntQuips = [
      "OPTICAL MATRIX LOST. DEPLOYING EXTENDED SENSORS.",
      "SCANNING PERIMETER SECTORS FOR INTRUDER.",
      "CURSOR EXITED VIEWPORT MATRIX. TRACKING RESIDUAL TRACE.",
      "PURGE DIRECTIVE PERSISTS. STANDING BY FOR RE-ENTRY."
    ];

    this.buildMesh();
  }

  buildMesh() {
    const hazardTex = TextureGen.createHazardTexture();
    const castIronMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.08 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.35 });

    // Heavy Rounded Chassis
    this.torso = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.6, 3.8, 16), yellowMat);
    this.torso.position.y = 4.6;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Hazard Decal Belt across Chest
    const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4 });
    const chestBelt = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.9, 16), hazardMat);
    chestBelt.position.y = 4.6;
    this.group.add(chestBelt);

    // Articulated Hydraulic Legs with Exposed Chrome Piston Rams
    this.legL = new THREE.Group();
    const legCylL = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 12), castIronMat);
    legCylL.position.y = 1.4;
    const pistonL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2), chromeMat);
    pistonL.position.y = 1.4;
    const footL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), castIronMat);
    footL.position.set(0.2, 0.25, 0);
    this.legL.add(legCylL);
    this.legL.add(pistonL);
    this.legL.add(footL);
    this.legL.position.set(-1.2, 0, 0);
    this.group.add(this.legL);

    this.legR = new THREE.Group();
    const legCylR = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.8, 12), castIronMat);
    legCylR.position.y = 1.4;
    const pistonR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2), chromeMat);
    pistonR.position.y = 1.4;
    const footR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), castIronMat);
    footR.position.set(0.2, 0.25, 0);
    this.legR.add(legCylR);
    this.legR.add(pistonR);
    this.legR.add(footR);
    this.legR.position.set(1.2, 0, 0);
    this.group.add(this.legR);

    // Cyclops Red Optical Sensor with Focused Spotlight
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.0 });
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), eyeMat);
    this.eye.position.set(0.7, 5.6, 1.4);
    this.group.add(this.eye);

    this.eyeSpot = new THREE.SpotLight(0xef4444, 2.5, 30, Math.PI / 6, 0.4);
    this.eyeSpot.position.set(0.7, 5.6, 1.5);
    this.eyeSpot.target.position.set(12, 5.6, 1.5);
    this.group.add(this.eyeSpot);
    this.group.add(this.eyeSpot.target);

    // Exhaust Smokestacks
    const pipeL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4), castIronMat);
    pipeL.position.set(-0.8, 6.8, -0.9);
    const pipeR = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.4), castIronMat);
    pipeR.position.set(0.8, 6.8, -0.9);
    this.group.add(pipeL);
    this.group.add(pipeR);

    // Multi-Stage Cast-Iron Hydraulic Scissor Arm
    this.armRoot = new THREE.Group();
    this.armRoot.position.set(1.9, 5.0, 0);
    this.group.add(this.armRoot);

    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
    for (let b = 0; b < 4; b++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.45), bronzeMat);
      beam.position.set(b * 1.8, 0, 0);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6), chromeMat);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(b * 1.8, 0, 0);
      this.armRoot.add(beam);
      this.armRoot.add(pin);
    }

    // Industrial 3-Jaw Demolition Claw Clamp
    this.claw = new THREE.Group();
    const clawBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), castIronMat);
    const tooth1 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 6), chromeMat);
    tooth1.position.set(0.6, 0.6, 0);
    tooth1.rotation.z = -Math.PI / 3;
    const tooth2 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 6), chromeMat);
    tooth2.position.set(0.6, -0.6, 0);
    tooth2.rotation.z = Math.PI / 3;

    this.claw.add(clawBase);
    this.claw.add(tooth1);
    this.claw.add(tooth2);
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
    this.say(this.huntQuips[0]);
    window.soundEngine.playSonarPing();
    this.huntPatrolTargetX = lastExitPos ? Math.max(-42, Math.min(42, (lastExitPos.x / window.innerWidth) * 88 - 44)) : (this.facing * 36);
  }

  onSpotCursor() {
    this.say("INTRUDER RE-ACQUIRED! PREPARE FOR CRUSH!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse3D, physics3D, sceneManager3D) {
    this.updateCommon(dt, mouse3D, physics3D, sceneManager3D);

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX < this.group.position.x ? mouse3D.worldX + 20 : mouse3D.worldX - 20;
      this.targetX = Math.max(-42, Math.min(42, desiredX));
      this.group.position.x += (this.targetX - this.group.position.x) * 2.0 * dt;

      this.attackCooldown -= dt;

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
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 2.0) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 15 * dt);
        this.legL.position.y = Math.abs(Math.sin(this.huntTimer * 5.0)) * 0.6;
        this.legR.position.y = Math.abs(Math.cos(this.huntTimer * 5.0)) * 0.6;
        this.facing = dist >= 0 ? 1 : -1;
      } else {
        this.legL.position.y = 0;
        this.legR.position.y = 0;
      }
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 2.8) * 0.45;
      if (this.eyeSpot) {
        this.eyeSpot.target.position.x = this.facing * 16 + Math.sin(this.huntTimer * 4.0) * 8;
        this.eyeSpot.target.position.y = 6 + Math.cos(this.huntTimer * 3.0) * 5;
      }
    }
  }

  updateArmPose() {
    const scale = 0.3 + this.armExtension * 1.8;
    this.armRoot.scale.set(scale, 1, 1);
  }

  initiateAttack(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

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
