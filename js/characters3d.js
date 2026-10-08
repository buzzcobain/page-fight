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

  calculateHumanoidGait(cycle) {
    const computeLeg = (phase) => {
      const sinP = Math.sin(phase);
      const cosP = Math.cos(phase);

      // Hip swings in local Z axis (forward is +Z rotation, backward is -Z rotation)
      const hip = sinP * 0.48;

      // Knee flexion: bends backward only (-Z rotation)
      // Active flexion during trailing swing phase (sinP < 0)
      let knee = 0;
      if (sinP < 0) {
        knee = -Math.pow(-sinP, 1.25) * 1.22 - 0.08;
      } else if (cosP < 0) {
        knee = -cosP * cosP * 0.38 - 0.08;
      } else {
        knee = -0.06; // stance shock absorption micro-flexion
      }

      // Ankle articulation: heel-strike dorsiflexion and push-off plantarflexion
      let ankle = 0;
      if (sinP > 0.35) {
        ankle = 0.22;
      } else if (sinP < -0.25) {
        ankle = -0.32;
      }

      return { hip, knee, ankle };
    };

    const legL = computeLeg(cycle);
    const legR = computeLeg(cycle + Math.PI);
    const bounceY = Math.abs(Math.sin(cycle)) * 0.28;
    const swayY = Math.sin(cycle) * 0.08;
    const rollZ = Math.cos(cycle) * 0.035;
    const torsoTwistY = -Math.sin(cycle) * 0.12;

    return { legL, legR, bounceY, swayY, rollZ, torsoTwistY };
  }

  buildSculptedHead(characterType, skinTone = 'fair', eyeColor = 0x22c55e) {
    const headGroup = new THREE.Group();
    const skinTex = TextureGen.createHumanSkinTexture(skinTone);

    const skinMat = new THREE.MeshStandardMaterial({
      map: skinTex,
      bumpMap: skinTex,
      bumpScale: 0.04,
      roughness: 0.55,
      metalness: 0.05
    });

    // Cranium
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 20), skinMat);
    cranium.scale.set(0.9, 1.05, 0.95);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Anatomical Jaw & Chin (tapers forward toward +X)
    const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.38, 0.75, 14), skinMat);
    jaw.position.set(0.12, -0.45, 0);
    jaw.scale.set(0.95, 1, 0.85);
    headGroup.add(jaw);

    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.44), skinMat);
    chin.position.set(0.38, -0.68, 0);
    headGroup.add(chin);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.85, 14), skinMat);
    neck.position.set(-0.05, -0.95, 0);
    headGroup.add(neck);

    // Sculpted 3D Eyes with Sclera, Iris, Pupil, Corneal Catchlight & Lids
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const irisMat = new THREE.MeshStandardMaterial({
      color: eyeColor,
      roughness: 0.1,
      metalness: 0.1,
      emissive: characterType === 'wizard' ? eyeColor : 0x000000,
      emissiveIntensity: characterType === 'wizard' ? 0.85 : 0
    });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const zOffsets = [0.32, -0.32];
    for (const z of zOffsets) {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(0.62, 0.05, z);

      // Eyeball
      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), scleraMat);
      eyeball.scale.set(0.65, 0.95, 1);
      eyeGroup.add(eyeball);

      // Iris
      const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), irisMat);
      iris.rotation.z = Math.PI / 2;
      iris.position.set(0.11, 0, 0);
      eyeGroup.add(iris);

      // Pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), pupilMat);
      pupil.position.set(0.13, 0, 0);
      eyeGroup.add(pupil);

      // Corneal catchlight
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), glintMat);
      glint.position.set(0.14, 0.04, 0.03);
      eyeGroup.add(glint);

      // Upper Eyelid Arch
      const upperLid = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 10, Math.PI), skinMat);
      upperLid.position.set(0.06, 0.08, 0);
      upperLid.rotation.y = Math.PI / 2;
      upperLid.rotation.x = Math.PI;
      eyeGroup.add(upperLid);

      headGroup.add(eyeGroup);
    }

    // Sculpted Brow Ridges
    const browColor = characterType === 'wizard' ? 0xd1d5db : 0x29140a;
    const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.8 });
    for (const z of zOffsets) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.32), browMat);
      brow.position.set(0.66, 0.24, z);
      brow.rotation.z = -0.15;
      brow.rotation.y = z > 0 ? 0.2 : -0.2;
      headGroup.add(brow);
    }

    // Sculpted 3D Nose
    const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.45, 0.16), skinMat);
    noseBridge.position.set(0.72, -0.05, 0);
    noseBridge.rotation.z = -0.32;
    headGroup.add(noseBridge);

    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), skinMat);
    noseTip.position.set(0.85, -0.22, 0);
    headGroup.add(noseTip);

    const nostrilL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
    nostrilL.position.set(0.78, -0.25, 0.12);
    headGroup.add(nostrilL);
    const nostrilR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
    nostrilR.position.set(0.78, -0.25, -0.12);
    headGroup.add(nostrilR);

    // Sculpted 3D Lips
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x9f4a3c, roughness: 0.5 });
    const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.36), lipMat);
    upperLip.position.set(0.66, -0.42, 0);
    upperLip.rotation.z = -0.15;
    headGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.32), lipMat);
    lowerLip.position.set(0.62, -0.52, 0);
    headGroup.add(lowerLip);

    // Anatomical Ears
    for (const z of [0.72, -0.72]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.06, 6, 12, Math.PI * 1.3), skinMat);
      ear.position.set(-0.05, 0.02, z);
      ear.rotation.y = z > 0 ? 0 : Math.PI;
      ear.rotation.z = 0.2;
      headGroup.add(ear);
    }

    return { headGroup, cranium, skinMat };
  }

  buildArticulatedLeg(thighMat, kneeMat, shinMat, bootMat, side = 1) {
    const hip = new THREE.Group();
    hip.position.set(0, 0, side * 0.55);

    const thighLen = 1.6;
    const shinLen = 1.6;

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, thighLen, 14), thighMat);
    thigh.position.y = -thighLen * 0.5;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -thighLen;
    hip.add(knee);

    const patella = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12), kneeMat);
    patella.position.set(0.12, 0, 0);
    patella.scale.set(1.1, 1, 1);
    patella.castShadow = true;
    knee.add(patella);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, shinLen, 14), shinMat);
    shin.position.y = -shinLen * 0.5;
    shin.castShadow = true;
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.y = -shinLen;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.52, 0.55), bootMat);
    foot.position.set(0.38, -0.22, 0);
    foot.castShadow = true;
    ankle.add(foot);

    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.52), bootMat);
    heel.position.set(-0.15, -0.28, 0);
    heel.castShadow = true;
    ankle.add(heel);

    return { hip, knee, ankle, thigh, patella, shin, foot };
  }

  buildArticulatedArm(upperMat, elbowMat, forearmMat, handMat, side = 1) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 0, side * 1.0);

    const upperLen = 1.35;
    const forearmLen = 1.35;

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, upperLen, 12), upperMat);
    upperArm.position.y = -upperLen * 0.5;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -upperLen;
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), elbowMat);
    elbowJoint.position.set(-0.06, 0, 0);
    elbowJoint.castShadow = true;
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, forearmLen, 12), forearmMat);
    forearm.position.y = -forearmLen * 0.5;
    forearm.castShadow = true;
    elbow.add(forearm);

    const wrist = new THREE.Group();
    wrist.position.y = -forearmLen;
    elbow.add(wrist);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.28), handMat);
    hand.position.set(0.12, -0.15, 0);
    hand.castShadow = true;
    wrist.add(hand);

    return { shoulder, elbow, wrist, upperArm, elbowJoint, forearm, hand };
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
// 1. SCULPTED WIZARD 3D (Anatomical Arcane Sage)
// ==========================================
class Wizard3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Wizard', x, y, z, scene);
    this.castPhase = 'IDLE';
    this.castTimer = 0;
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
    const robeTex = TextureGen.createFabricTexture('#1e1b4b');
    const leatherTex = TextureGen.createLeatherTexture('#451a03');
    const woodTex = TextureGen.createWoodTexture();

    const robeMat = new THREE.MeshStandardMaterial({
      map: robeTex,
      bumpMap: robeTex,
      bumpScale: 0.08,
      roughness: 0.72,
      metalness: 0.1
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.88,
      roughness: 0.22
    });

    const leatherMat = new THREE.MeshStandardMaterial({
      map: leatherTex,
      roughness: 0.6,
      metalness: 0.1
    });

    const woodMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.75,
      metalness: 0.05
    });

    const beardMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.85
    });

    // 1. Pelvis Center & Ornate Leather Belt
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 3.65;
    this.group.add(this.pelvis);

    const beltGeom = new THREE.CylinderGeometry(0.95, 0.9, 0.45, 14);
    const belt = new THREE.Mesh(beltGeom, leatherMat);
    this.pelvis.add(belt);

    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 12), goldMat);
    buckle.position.set(0.95, 0, 0);
    buckle.rotation.y = Math.PI / 2;
    this.pelvis.add(buckle);

    // Spell Scroll Holster & Potion Phial on Belt
    const scrollHolster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.85, 10), leatherMat);
    scrollHolster.rotation.z = Math.PI / 4;
    scrollHolster.position.set(-0.2, -0.3, -0.95);
    this.pelvis.add(scrollHolster);

    const potion = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.1
    }));
    potion.position.set(0.2, -0.35, 0.95);
    this.pelvis.add(potion);

    // Flowing Flared Robe Skirt (split front allowing leg motion)
    const skirtGeom = new THREE.CylinderGeometry(1.05, 2.3, 4.2, 16, 4, true);
    this.skirt = new THREE.Mesh(skirtGeom, robeMat);
    this.skirt.position.y = -1.9;
    this.skirt.castShadow = true;
    this.pelvis.add(this.skirt);

    // Gold embroidered hem trim along robe
    const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.1, 6, 16), goldMat);
    skirtTrim.rotation.x = Math.PI / 2;
    skirtTrim.position.y = -3.95;
    this.pelvis.add(skirtTrim);

    // 2. Articulated Legs Underneath Robes (Turnshoes)
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.6 });
    this.legLData = this.buildArticulatedLeg(robeMat, goldMat, robeMat, shoeMat, 1);
    this.pelvis.add(this.legLData.hip);
    this.legL = this.legLData.hip; // backwards compat

    this.legRData = this.buildArticulatedLeg(robeMat, goldMat, robeMat, shoeMat, -1);
    this.pelvis.add(this.legRData.hip);
    this.legR = this.legRData.hip; // backwards compat

    // 3. Spine & Embroidered Torso
    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);

    const midriff = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.85, 14), robeMat);
    midriff.position.y = 0.5;
    this.spine.add(midriff);

    this.chest = new THREE.Group();
    this.chest.position.y = 1.05;
    this.spine.add(this.chest);

    // Upper Cassock
    const chestGeom = new THREE.CylinderGeometry(1.25, 0.95, 1.7, 16);
    const chest = new THREE.Mesh(chestGeom, robeMat);
    chest.position.y = 0.65;
    chest.castShadow = true;
    this.chest.add(chest);

    // High Velvet Cowl Collar with Astrological Shoulder Clasps
    const cowl = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.25, 8, 16), robeMat);
    cowl.position.set(0, 1.5, 0);
    cowl.rotation.x = Math.PI / 2;
    this.chest.add(cowl);

    for (const z of [1.1, -1.1]) {
      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), goldMat);
      clasp.position.set(0.1, 1.45, z);
      this.chest.add(clasp);
    }

    // 4. Sage Head, Flowing Hair, Volumetric Beard & Conical Hat
    const headData = this.buildSculptedHead('wizard', 'fair', 0x06b6d4);
    this.headGroup = headData.headGroup;
    this.headGroup.position.set(0.05, 1.95, 0);
    this.chest.add(this.headGroup);

    // Flowing Layered Volumetric Beard
    this.beardGroup = new THREE.Group();
    this.beardGroup.position.set(0.55, -0.45, 0);

    const mainBeard = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.7, 12), beardMat);
    mainBeard.position.set(0.15, -1.1, 0);
    mainBeard.rotation.z = -0.25;
    this.beardGroup.add(mainBeard);

    for (const side of [0.35, -0.35]) {
      const sideLock = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.2, 8), beardMat);
      sideLock.position.set(0.05, -0.9, side);
      sideLock.rotation.z = -0.2;
      sideLock.rotation.x = side > 0 ? 0.15 : -0.15;
      this.beardGroup.add(sideLock);
    }

    // Contoured Mustache framing lips
    const mustacheL = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 6), beardMat);
    mustacheL.position.set(0.2, 0.05, 0.35);
    mustacheL.rotation.z = Math.PI / 2;
    mustacheL.rotation.y = 0.3;
    this.beardGroup.add(mustacheL);

    const mustacheR = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 6), beardMat);
    mustacheR.position.set(0.2, 0.05, -0.35);
    mustacheR.rotation.z = Math.PI / 2;
    mustacheR.rotation.y = -0.3;
    this.beardGroup.add(mustacheR);

    this.headGroup.add(this.beardGroup);

    // Silver Hair Locks falling behind shoulders
    for (const z of [0.55, -0.55]) {
      const hairLock = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 2.0, 8), beardMat);
      hairLock.position.set(-0.55, -0.65, z);
      hairLock.rotation.z = 0.2;
      this.headGroup.add(hairLock);
    }

    // Wide-Brimmed Conical Wizard Hat with Curled Tip
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.14, 24), robeMat);
    brim.position.set(-0.05, 0.65, 0);
    this.headGroup.add(brim);

    const hatBand = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 6, 16), goldMat);
    hatBand.position.set(-0.05, 0.72, 0);
    hatBand.rotation.x = Math.PI / 2;
    this.headGroup.add(hatBand);

    const hatCone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.6, 16), robeMat);
    hatCone.position.set(-0.35, 2.35, 0);
    hatCone.rotation.z = 0.22;
    hatCone.castShadow = true;
    this.headGroup.add(hatCone);

    // 5. Articulated Arms, Bell Sleeves & Somatic Casting Hand
    this.armRData = this.buildArticulatedArm(robeMat, goldMat, robeMat, headData.skinMat, -1);
    this.armRData.shoulder.position.set(-0.1, 1.25, -1.05);
    this.chest.add(this.armRData.shoulder);

    this.armLData = this.buildArticulatedArm(robeMat, goldMat, robeMat, headData.skinMat, 1);
    this.armLData.shoulder.position.set(0.12, 1.25, 1.05);
    this.chest.add(this.armLData.shoulder);

    // Flared Bell Sleeves draped over forearms
    for (const arm of [this.armRData, this.armLData]) {
      const bellSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 1.4, 12, 1, true), robeMat);
      bellSleeve.position.y = -0.7;
      arm.forearm.add(bellSleeve);
    }

    // 6. Gnarled Ancient Wooden Staff with Amethyst Crown
    this.staff = new THREE.Group();
    this.baseStaffPos = new THREE.Vector3(1.8, 0.6, -0.6);
    this.staff.position.copy(this.baseStaffPos);

    const staffShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9.6, 10), woodMat);
    staffShaft.position.y = 1.8;
    staffShaft.castShadow = true;
    this.staff.add(staffShaft);

    // Root Claw Prongs holding gem
    const rootProng = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 12), goldMat);
    rootProng.position.set(0, 6.4, 0);
    rootProng.rotation.x = Math.PI / 2;
    this.staff.add(rootProng);

    // Faceted Pulsing Amethyst Gem
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 1.2,
      roughness: 0.05,
      metalness: 0.1
    });
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), gemMat);
    this.gem.position.set(0, 6.6, 0);
    this.staff.add(this.gem);

    this.staffLight = new THREE.PointLight(0xa855f7, 2.5, 18);
    this.staffLight.position.set(0, 6.6, 0);
    this.staff.add(this.staffLight);

    this.chest.add(this.staff);

    // Right arm holds staff firmly
    this.armRData.shoulder.rotation.set(-0.2, 0.2, 0.65);
    this.armRData.elbow.rotation.set(0, 0, -0.75);

    // Left arm: somatic casting posture (ready to channel spells)
    this.armLData.shoulder.rotation.set(0.3, -0.2, 0.6);
    this.armLData.elbow.rotation.set(0, 0, -0.8);
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

    const hoverY = this.state === 'FREEFALL' ? 4 : 0.8 + Math.sin(this.breathCycle) * 0.35;
    this.group.position.y = hoverY;

    // Gem rotation and arcane pulse
    if (this.gem) {
      this.gem.rotation.y += 2.2 * dt;
      this.gem.rotation.x += 1.6 * dt;
      this.staffLight.intensity = 2.0 + Math.sin(this.breathCycle * 2) * 0.8;
    }

    // Robe hem physical wave undulation
    if (this.skirt) {
      this.skirt.rotation.z = Math.sin(this.breathCycle * 1.5) * 0.04;
      this.skirt.scale.set(1 + Math.sin(this.breathCycle) * 0.02, 1, 1 + Math.cos(this.breathCycle) * 0.02);
    }

    // Somatic casting gesture animation
    if (this.castPhase === 'CHARGE') {
      this.castTimer -= dt;
      this.armLData.shoulder.rotation.z = 1.35;
      this.armLData.elbow.rotation.z = -1.3;
      this.armLData.shoulder.rotation.y = 0.4;
      this.chest.rotation.z = -0.2;
      if (this.castTimer <= 0) {
        this.castPhase = 'RELEASE';
        this.castTimer = 0.22;
      }
    } else if (this.castPhase === 'RELEASE') {
      this.castTimer -= dt;
      this.armLData.shoulder.rotation.z = 0.2;
      this.armLData.elbow.rotation.z = -0.2;
      this.armLData.shoulder.rotation.y = -0.3;
      this.chest.rotation.z = 0.25;
      if (this.castTimer <= 0) {
        this.castPhase = 'IDLE';
      }
    } else {
      // Idle somatic hand breathing
      this.armLData.shoulder.rotation.z += (0.6 + Math.sin(this.breathCycle) * 0.1 - this.armLData.shoulder.rotation.z) * 6 * dt;
      this.armLData.elbow.rotation.z += (-0.8 + Math.cos(this.breathCycle) * 0.1 - this.armLData.elbow.rotation.z) * 6 * dt;
      this.chest.rotation.z += (0 - this.chest.rotation.z) * 6 * dt;
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX < this.group.position.x ? mouse3D.worldX + 18 : mouse3D.worldX - 18;
      this.targetX = Math.max(-42, Math.min(42, desiredX));
      const dist = this.targetX - this.group.position.x;
      this.group.position.x += dist * 2.2 * dt;

      // Leg articulation beneath robes
      if (Math.abs(dist) > 0.8) {
        this.walkCycle += Math.abs(dist) * 0.4 * dt * 6;
        const gait = this.calculateHumanoidGait(this.walkCycle);
        this.legLData.hip.rotation.z = gait.legL.hip * 0.8;
        this.legLData.knee.rotation.z = gait.legL.knee * 0.8;
        this.legRData.hip.rotation.z = gait.legR.hip * 0.8;
        this.legRData.knee.rotation.z = gait.legR.knee * 0.8;
        this.pelvis.rotation.y = gait.swayY;
      } else {
        this.legLData.hip.rotation.z += (0 - this.legLData.hip.rotation.z) * 6 * dt;
        this.legLData.knee.rotation.z += (-0.06 - this.legLData.knee.rotation.z) * 6 * dt;
        this.legRData.hip.rotation.z += (0 - this.legRData.hip.rotation.z) * 6 * dt;
        this.legRData.knee.rotation.z += (-0.06 - this.legRData.knee.rotation.z) * 6 * dt;
      }

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
      this.headGroup.rotation.y = Math.sin(this.huntTimer * 4.0) * 0.35;
      if (this.staff) {
        this.staff.rotation.x = -0.3 + Math.sin(this.huntTimer * 2.8) * 0.35;
      }
    }
  }

  castSpell(mouse3D, physics3D, sceneManager3D) {
    this.castPhase = 'CHARGE';
    this.castTimer = 0.15;

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
    this.castPhase = 'RELEASE';
    this.castTimer = 0.2;
    window.soundEngine.playMagicMissile();
    physics3D.addProjectile3D({
      type: 'magic_missile',
      x: this.group.position.x,
      y: this.group.position.y + 6.2,
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
// 2. SCULPTED SOLDIER 3D (Anatomical Tactical Operator)
// ==========================================
class Soldier3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Soldier', x, y, z, scene);
    this.recoil = 0;
    this.aimElevation = 0;
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
    const bootTex = TextureGen.createLeatherTexture('#0f172a');

    const camoMat = new THREE.MeshStandardMaterial({
      map: camoTex,
      bumpMap: camoTex,
      bumpScale: 0.05,
      roughness: 0.72
    });
    const vestMat = new THREE.MeshStandardMaterial({
      map: vestTex,
      bumpMap: vestTex,
      bumpScale: 0.06,
      roughness: 0.65,
      metalness: 0.15
    });
    const bootMat = new THREE.MeshStandardMaterial({
      map: bootTex,
      roughness: 0.45,
      metalness: 0.1
    });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.25 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.88, roughness: 0.2 });

    // 1. Pelvis Center & Tactical Battle Belt
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 3.65;
    this.group.add(this.pelvis);

    const beltGeom = new THREE.CylinderGeometry(0.95, 0.9, 0.4, 14);
    const belt = new THREE.Mesh(beltGeom, vestMat);
    this.pelvis.add(belt);

    // Cobra Buckle on Belt
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.32), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 }));
    buckle.position.set(0.95, 0, 0);
    this.pelvis.add(buckle);

    // Tactical Holster on Right Thigh & Dump Pouch on Left
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 0.3), padMat);
    holster.position.set(0.1, -0.4, -0.9);
    this.pelvis.add(holster);

    const dumpPouch = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.4), vestMat);
    dumpPouch.position.set(-0.2, -0.3, 0.95);
    this.pelvis.add(dumpPouch);

    // 2. Articulated 2-Segment Legs (Knee Patella Hinge & Ankle)
    this.legLData = this.buildArticulatedLeg(camoMat, padMat, camoMat, bootMat, 1);
    this.pelvis.add(this.legLData.hip);
    this.legL = this.legLData.hip; // backwards compat

    this.legRData = this.buildArticulatedLeg(camoMat, padMat, camoMat, bootMat, -1);
    this.pelvis.add(this.legRData.hip);
    this.legR = this.legRData.hip; // backwards compat

    // 3. Spine & Articulated Torso
    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);

    const midriff = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.92, 0.8, 14), camoMat);
    midriff.position.y = 0.5;
    this.spine.add(midriff);

    // Plate Carrier Chest Rig
    this.chest = new THREE.Group();
    this.chest.position.y = 1.0;
    this.spine.add(this.chest);

    const chestRig = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.75), vestMat);
    chestRig.position.y = 0.55;
    chestRig.castShadow = true;
    this.chest.add(chestRig);

    // Front Strike Face Ceramic Armor Plate
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.15, 1.3), vestMat);
    frontPlate.position.set(0.72, 0.55, 0);
    this.chest.add(frontPlate);

    // 3 M4 Magazine Pouches on Front Webbing
    for (let p = -1; p <= 1; p++) {
      const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.35), vestMat);
      magPouch.position.set(0.85, 0.45, p * 0.42);
      this.chest.add(magPouch);
    }

    // IFAK Trauma Pouch & PTT Radio on Shoulder
    const ifak = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.42), vestMat);
    ifak.position.set(-0.2, 0.5, 0.92);
    this.chest.add(ifak);

    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 0.3), padMat);
    radio.position.set(-0.6, 0.9, -0.7);
    this.chest.add(radio);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8), padMat);
    antenna.position.set(-0.6, 1.9, -0.7);
    antenna.rotation.z = -0.15;
    this.chest.add(antenna);

    // 4. Anatomically Sculpted Head & Tactical Helmet
    const headData = this.buildSculptedHead('soldier', 'tan', 0x15803d);
    this.headGroup = headData.headGroup;
    this.headGroup.position.set(0.05, 1.85, 0);
    this.chest.add(this.headGroup);

    // High-Cut FAST Ballistic Helmet
    const helmetGeom = new THREE.SphereGeometry(0.88, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const helmet = new THREE.Mesh(helmetGeom, camoMat);
    helmet.position.set(-0.02, 0.12, 0);
    helmet.castShadow = true;
    this.headGroup.add(helmet);

    // Wilcox NVG Shroud on Helmet Front
    const nvgShroud = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.28), padMat);
    nvgShroud.position.set(0.78, 0.25, 0);
    this.headGroup.add(nvgShroud);

    // Side ARC Rails & Velcro Patches
    for (const z of [0.82, -0.82]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.08), padMat);
      rail.position.set(0.05, 0.15, z);
      this.headGroup.add(rail);
    }

    // Comms Headset (Earcups over ears + boom mic)
    for (const z of [0.85, -0.85]) {
      const earcup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 10), padMat);
      earcup.rotation.x = Math.PI / 2;
      earcup.position.set(-0.05, 0.02, z);
      this.headGroup.add(earcup);
    }
    const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65), padMat);
    boomMic.position.set(0.35, -0.22, 0.65);
    boomMic.rotation.z = Math.PI / 3;
    this.headGroup.add(boomMic);

    // Tactical Ballistic Eye Protection (ESS Goggles on Helmet Brim)
    const goggleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.1), padMat);
    goggleFrame.position.set(0.72, 0.42, 0);
    this.headGroup.add(goggleFrame);
    const goggleLens = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.98), new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    }));
    goggleLens.position.set(0.82, 0.42, 0);
    this.headGroup.add(goggleLens);

    // 5. Articulated Arms & Two-Handed Tactical Rifle Platform
    this.armRData = this.buildArticulatedArm(camoMat, padMat, camoMat, gloveMat, -1);
    this.armRData.shoulder.position.set(-0.15, 1.1, -0.88);
    this.chest.add(this.armRData.shoulder);

    this.armLData = this.buildArticulatedArm(camoMat, padMat, camoMat, gloveMat, 1);
    this.armLData.shoulder.position.set(0.12, 1.1, 0.88);
    this.chest.add(this.armLData.shoulder);

    // Rig arms into tactical shooting stance
    // Right arm (trigger hand): shoulder angles forward, elbow bends snugly
    this.armRData.shoulder.rotation.set(-0.25, 0.2, 0.75);
    this.armRData.elbow.rotation.set(0, 0, -0.85);

    // Left arm (support hand): reaches across chest toward handguard in C-clamp grip
    this.armLData.shoulder.rotation.set(0.35, -0.25, 0.95);
    this.armLData.elbow.rotation.set(0, 0, -1.25);

    // 6. Detailed M4A1 Assault Rifle with EOTech Optic & PEQ Box
    this.rifle = new THREE.Group();
    this.baseRifleX = 0.55;
    this.rifle.position.set(this.baseRifleX, 0.85, 0.15);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.35), gunMat);
    receiver.position.set(0.4, 0, 0);
    this.rifle.add(receiver);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.25, 0.28), gunMat);
    mag.position.set(0.55, -0.65, 0);
    mag.rotation.z = 0.22;
    this.rifle.add(mag);

    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.85, 0.28), padMat);
    pistolGrip.position.set(-0.25, -0.55, 0);
    pistolGrip.rotation.z = -0.35;
    this.rifle.add(pistolGrip);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.48, 0.38), gunMat);
    handguard.position.set(2.2, 0, 0);
    this.rifle.add(handguard);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), gunMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(3.6, 0, 0);
    this.rifle.add(barrel);

    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45), gunMat);
    flashHider.rotation.z = Math.PI / 2;
    flashHider.position.set(4.35, 0, 0);
    this.rifle.add(flashHider);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.28), padMat);
    stock.position.set(-1.1, -0.05, 0);
    this.rifle.add(stock);

    // Holographic Sight (EOTech) with illuminated reticle lens
    const holoSight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.32), gunMat);
    holoSight.position.set(0.5, 0.48, 0);
    this.rifle.add(holoSight);

    const holoReticle = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    holoReticle.rotation.y = Math.PI / 2;
    holoReticle.position.set(0.86, 0.5, 0);
    this.rifle.add(holoReticle);

    // Top-Rail PEQ-15 Laser Unit
    const peq = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.32), padMat);
    peq.position.set(2.0, 0.35, 0);
    this.rifle.add(peq);

    this.rifle.castShadow = true;
    this.chest.add(this.rifle);

    // Dynamic Muzzle Light
    this.muzzleLight = new THREE.PointLight(0xfbbf24, 0, 16);
    this.muzzleLight.position.set(4.5, 0, 0);
    this.rifle.add(this.muzzleLight);
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

    // Recoil recovery
    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - 14 * dt);
      this.rifle.position.x = this.baseRifleX - this.recoil * 0.35;
      this.armRData.shoulder.rotation.z = 0.75 + this.recoil * 0.18;
      this.chest.rotation.z = -this.recoil * 0.1;
    } else {
      this.rifle.position.x = this.baseRifleX;
      this.armRData.shoulder.rotation.z = 0.75;
      this.chest.rotation.z = 0;
    }

    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - 24 * dt);
    }

    if (this.state === 'ATTACKING') {
      const desiredX = mouse3D.worldX + (mouse3D.worldX > this.group.position.x ? -18 : 18);
      this.targetX = Math.max(-42, Math.min(42, desiredX));
      const dist = this.targetX - this.group.position.x;
      this.group.position.x += dist * 2.8 * dt;

      // Biomechanical locomotion
      const isMoving = Math.abs(dist) > 0.8;
      if (isMoving) {
        this.walkCycle += Math.abs(dist) * 0.45 * dt * 8;
        const gait = this.calculateHumanoidGait(this.walkCycle);

        this.legLData.hip.rotation.z = gait.legL.hip;
        this.legLData.knee.rotation.z = gait.legL.knee;
        this.legLData.ankle.rotation.z = gait.legL.ankle;

        this.legRData.hip.rotation.z = gait.legR.hip;
        this.legRData.knee.rotation.z = gait.legR.knee;
        this.legRData.ankle.rotation.z = gait.legR.ankle;

        this.pelvis.position.y = 3.65 + gait.bounceY;
        this.pelvis.rotation.y = gait.swayY;
        this.pelvis.rotation.z = gait.rollZ;
        this.spine.rotation.y = gait.torsoTwistY;
      } else {
        // Natural tactical stance with breathing
        this.legLData.hip.rotation.z += (0 - this.legLData.hip.rotation.z) * 8 * dt;
        this.legLData.knee.rotation.z += (-0.06 - this.legLData.knee.rotation.z) * 8 * dt;
        this.legLData.ankle.rotation.z += (0 - this.legLData.ankle.rotation.z) * 8 * dt;

        this.legRData.hip.rotation.z += (0 - this.legRData.hip.rotation.z) * 8 * dt;
        this.legRData.knee.rotation.z += (-0.06 - this.legRData.knee.rotation.z) * 8 * dt;
        this.legRData.ankle.rotation.z += (0 - this.legRData.ankle.rotation.z) * 8 * dt;

        this.pelvis.position.y = 3.65 + Math.sin(this.breathCycle) * 0.06;
        this.spine.rotation.y = 0;
      }

      // Tactical weapon tracking / aim elevation toward cursor
      if (mouse3D.active) {
        const dy = mouse3D.worldY - (this.group.position.y + 4.5);
        const dx = Math.abs(mouse3D.worldX - this.group.position.x) || 1;
        const targetAimAngle = Math.atan2(dy, dx);
        this.aimElevation += (targetAimAngle - this.aimElevation) * 10 * dt;
        this.rifle.rotation.z = THREE.MathUtils.clamp(this.aimElevation, -0.55, 0.65);
        this.headGroup.rotation.z = THREE.MathUtils.clamp(this.aimElevation * 0.4, -0.3, 0.4);
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.fireArsenal(mouse3D, physics3D, sceneManager3D);
      }
    } else if (this.state === 'HUNTING') {
      const targetX = Math.max(-42, Math.min(42, this.huntPatrolTargetX || 0));
      const dist = targetX - this.group.position.x;
      if (Math.abs(dist) > 1.5) {
        this.group.position.x += Math.sign(dist) * Math.min(Math.abs(dist), 18 * dt);
        this.walkCycle += 18 * dt * 0.45;
        const gait = this.calculateHumanoidGait(this.walkCycle);

        this.legLData.hip.rotation.z = gait.legL.hip;
        this.legLData.knee.rotation.z = gait.legL.knee;
        this.legLData.ankle.rotation.z = gait.legL.ankle;

        this.legRData.hip.rotation.z = gait.legR.hip;
        this.legRData.knee.rotation.z = gait.legR.knee;
        this.legRData.ankle.rotation.z = gait.legR.ankle;

        this.pelvis.position.y = 3.65 + gait.bounceY;
        this.pelvis.rotation.y = gait.swayY;
        this.facing = dist >= 0 ? 1 : -1;
      } else {
        this.legLData.hip.rotation.z = 0;
        this.legLData.knee.rotation.z = -0.06;
        this.legRData.hip.rotation.z = 0;
        this.legRData.knee.rotation.z = -0.06;
        this.pelvis.position.y = 3.65 + Math.sin(this.breathCycle) * 0.05;
      }

      // Tactical head scanning while hunting
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 3.5) * 0.45;
      this.headGroup.rotation.y = Math.sin(this.huntTimer * 4.2) * 0.35;
      this.rifle.rotation.z = Math.sin(this.huntTimer * 2.5) * 0.15;
    }
  }

  fireArsenal(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.65) {
      this.recoil = 1.0;
      this.muzzleLight.intensity = 4.0;
      window.soundEngine.playGunshot(false);

      const barrelWorld = new THREE.Vector3();
      this.muzzleLight.getWorldPosition(barrelWorld);

      const dx = mouse3D.worldX - barrelWorld.x;
      const dy = mouse3D.worldY - barrelWorld.y;
      const dz = mouse3D.worldZ - barrelWorld.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const spd = 130;

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
      window.soundEngine.playJavelinThrow();
      const throwAngle = this.facing === 1 ? Math.PI * 0.25 : Math.PI * 0.75;
      physics3D.addProjectile3D({
        type: 'grenade',
        x: this.group.position.x + this.facing * 2.0,
        y: 5.2,
        z: 0.5,
        vx: Math.cos(throwAngle) * 35 + (mouse3D.worldX - this.group.position.x) * 0.4,
        vy: 28,
        vz: 0,
        timer: 1.5
      });
      this.say("FRAG OUT!");
      this.attackCooldown = 1.0;
    } else {
      this.recoil = 2.2;
      this.muzzleLight.intensity = 6.0;
      window.soundEngine.playGunshot(true);

      const barrelWorld = new THREE.Vector3();
      this.muzzleLight.getWorldPosition(barrelWorld);

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
    this.recoil = 1.5;
    this.muzzleLight.intensity = 3.5;
    window.soundEngine.playGunshot(false);
    physics3D.addProjectile3D({
      type: 'bullet',
      x: this.group.position.x,
      y: 6.2,
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
// 3. SCULPTED KNIGHT 3D (Gothic Plate Armor Champion)
// ==========================================
class Knight3D extends Character3DBase {
  constructor(x, y, z, scene) {
    super('Knight', x, y, z, scene);
    this.slashPhase = 'IDLE';
    this.slashTimer = 0;
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
    const mailTex = TextureGen.createChainmailTexture();
    const capeTex = TextureGen.createFabricTexture('#991b1b');
    const leatherTex = TextureGen.createLeatherTexture('#2e1065');

    // Burnished Gothic Steel Material
    const steelMat = new THREE.MeshStandardMaterial({
      map: metalTex,
      bumpMap: metalTex,
      bumpScale: 0.08,
      metalness: 0.95,
      roughness: 0.16
    });

    // Riveted Chainmail Material
    const mailMat = new THREE.MeshStandardMaterial({
      map: mailTex,
      bumpMap: mailTex,
      bumpScale: 0.06,
      metalness: 0.85,
      roughness: 0.5
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.92,
      roughness: 0.22
    });

    const capeMat = new THREE.MeshStandardMaterial({
      map: capeTex,
      bumpMap: capeTex,
      bumpScale: 0.05,
      side: THREE.DoubleSide,
      roughness: 0.65
    });

    const leatherMat = new THREE.MeshStandardMaterial({
      map: leatherTex,
      roughness: 0.6,
      metalness: 0.1
    });

    // 1. Pelvis Center & Articulated Faulds / Mail Skirt
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 3.65;
    this.group.add(this.pelvis);

    // Chainmail Hauberk Skirt underlayer
    const mailSkirt = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 1.1, 14, 1, true), mailMat);
    mailSkirt.position.y = -0.2;
    this.pelvis.add(mailSkirt);

    // Fluted Steel Fauld Lames & Tassets
    const faulds = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.32, 0.75, 16, 1, true), steelMat);
    faulds.position.y = 0.05;
    this.pelvis.add(faulds);

    // 2. Articulated 2-Segment Legs (Gothic Cuisses, Poleyns & Sabatons)
    this.legLData = this.buildArticulatedLeg(steelMat, steelMat, steelMat, steelMat, 1);
    this.pelvis.add(this.legLData.hip);
    this.legL = this.legLData.hip; // backwards compat

    this.legRData = this.buildArticulatedLeg(steelMat, steelMat, steelMat, steelMat, -1);
    this.pelvis.add(this.legRData.hip);
    this.legR = this.legRData.hip; // backwards compat

    // Spiked Poleyn Knee Wings
    for (const legData of [this.legLData, this.legRData]) {
      const poleynWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.55), steelMat);
      poleynWing.position.set(0.18, 0, 0);
      legData.knee.add(poleynWing);
    }

    // 3. Spine & Fluted Peascod Cuirass Breastplate
    this.spine = new THREE.Group();
    this.pelvis.add(this.spine);

    const waistPlate = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 0.85, 14), steelMat);
    waistPlate.position.y = 0.55;
    this.spine.add(waistPlate);

    this.chest = new THREE.Group();
    this.chest.position.y = 1.05;
    this.spine.add(this.chest);

    // Peascod Cuirass with central vertical deflection ridge
    const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.05, 1.8, 16), steelMat);
    cuirass.position.y = 0.65;
    cuirass.castShadow = true;
    this.chest.add(cuirass);

    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.35), goldMat);
    ridge.position.set(0.95, 0.65, 0);
    this.chest.add(ridge);

    // Steel Gorget Throat Armor
    const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.22, 8, 14), steelMat);
    gorget.rotation.x = Math.PI / 2;
    gorget.position.set(0, 1.6, 0);
    this.chest.add(gorget);

    // Fluted Grand Pauldrons with Besagew Roundels
    for (const z of [1.3, -1.3]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 14, 0, Math.PI), steelMat);
      pauldron.position.set(-0.1, 1.45, z);
      pauldron.rotation.z = z > 0 ? 0.35 : -0.35;
      pauldron.rotation.y = z > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.chest.add(pauldron);

      const besagew = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 10), goldMat);
      besagew.rotation.z = Math.PI / 2;
      besagew.position.set(0.45, 1.25, z * 0.9);
      this.chest.add(besagew);
    }

    // Heraldic Crimson Mantle / Cape with Dynamic Flutter
    this.cape = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2, 8, 8), capeMat);
    this.cape.position.set(-0.85, 1.1, 0);
    this.cape.rotation.y = Math.PI / 2;
    this.cape.castShadow = true;
    this.chest.add(this.cape);

    // 4. Head, Chainmail Coif & Gothic Sallet Helmet
    const headData = this.buildSculptedHead('knight', 'fair', 0x2563eb);
    this.headGroup = headData.headGroup;
    this.headGroup.position.set(0.05, 2.05, 0);
    this.chest.add(this.headGroup);

    // Chainmail Coif Hood
    const coif = new THREE.Mesh(new THREE.SphereGeometry(0.86, 16, 16), mailMat);
    coif.position.set(0, 0, 0);
    this.headGroup.add(coif);

    // Gothic Sallet Helmet with Skull Comb & Bevor Chin Guard
    const sallet = new THREE.Mesh(new THREE.SphereGeometry(0.98, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.65), steelMat);
    sallet.position.set(-0.05, 0.15, 0);
    sallet.castShadow = true;
    this.headGroup.add(sallet);

    // Raised Central Skull Comb
    const comb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.32, 0.14), steelMat);
    comb.position.set(-0.1, 0.95, 0);
    comb.rotation.z = -0.15;
    this.headGroup.add(comb);

    // Bevor Chin Guard
    const bevor = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 0.65, 12, 1, false, 0, Math.PI), steelMat);
    bevor.position.set(0.25, -0.42, 0);
    bevor.rotation.y = -Math.PI / 2;
    this.headGroup.add(bevor);

    // Glowing Visor Ocular Eye Slit with Piercing Battle Glare
    const visorRim = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 1.1), steelMat);
    visorRim.position.set(0.82, 0.12, 0);
    this.headGroup.add(visorRim);

    const eyeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), new THREE.MeshBasicMaterial({ color: 0x60a5fa }));
    eyeGlow.position.set(0.92, 0.12, 0);
    this.headGroup.add(eyeGlow);

    // 5. Articulated Arms & Two-Handed Zweihänder Greatsword
    this.armRData = this.buildArticulatedArm(steelMat, steelMat, steelMat, steelMat, -1);
    this.armRData.shoulder.position.set(-0.1, 1.3, -1.05);
    this.chest.add(this.armRData.shoulder);

    this.armLData = this.buildArticulatedArm(steelMat, steelMat, steelMat, steelMat, 1);
    this.armLData.shoulder.position.set(0.15, 1.3, 1.05);
    this.chest.add(this.armLData.shoulder);

    // Greatsword Group
    this.sword = new THREE.Group();
    this.baseSwordPos = new THREE.Vector3(1.5, 0.9, 0.2);
    this.sword.position.copy(this.baseSwordPos);

    // Fluted Double-Edged Blade with Fuller
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.8, 0.12), steelMat);
    blade.position.y = 3.4;
    blade.castShadow = true;
    this.sword.add(blade);

    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 0.15), goldMat);
    fuller.position.y = 3.0;
    this.sword.add(fuller);

    // Crossguard with Side Rings
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.35), goldMat);
    this.sword.add(crossguard);

    for (const z of [0.65, -0.65]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 10), goldMat);
      ring.position.set(0, 0, z);
      this.sword.add(ring);
    }

    // Long Two-Handed Leather Hilt & Scent-Stopper Pommel
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 1.9, 10), leatherMat);
    hilt.position.y = -0.95;
    this.sword.add(hilt);

    const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), steelMat);
    pommel.position.y = -1.95;
    this.sword.add(pommel);

    // Two-handed combat grip alignment:
    this.sword.rotation.z = -0.35;
    this.sword.rotation.x = 0.15;
    this.chest.add(this.sword);

    // Align arms to grip the greatsword hilt in authentic Vom Tag / Ox Guard
    this.armRData.shoulder.rotation.set(-0.25, 0.25, 0.85);
    this.armRData.elbow.rotation.set(0, 0, -0.95);

    this.armLData.shoulder.rotation.set(0.3, -0.2, 0.9);
    this.armLData.elbow.rotation.set(0, 0, -1.2);
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

    // Dynamic heraldic cape flutter
    if (this.cape) {
      this.cape.rotation.x = this.state === 'FREEFALL' ? Math.PI * 0.8 : Math.sin(Date.now() * 0.007) * 0.28;
    }

    // Slash animation state machine
    if (this.slashPhase === 'WINDUP') {
      this.slashTimer -= dt;
      this.sword.rotation.z = 0.9;
      this.chest.rotation.z = -0.35;
      this.armRData.shoulder.rotation.z = 1.3;
      this.armLData.shoulder.rotation.z = 1.35;
      if (this.slashTimer <= 0) {
        this.slashPhase = 'CLEAVE';
        this.slashTimer = 0.14;
        window.soundEngine.playSwordSlash();
      }
    } else if (this.slashPhase === 'CLEAVE') {
      this.slashTimer -= dt;
      this.sword.rotation.z = -1.2;
      this.chest.rotation.z = 0.45;
      this.armRData.shoulder.rotation.z = 0.4;
      this.armLData.shoulder.rotation.z = 0.5;
      if (this.slashTimer <= 0) {
        this.slashPhase = 'RECOVERY';
        this.slashTimer = 0.25;
      }
    } else if (this.slashPhase === 'RECOVERY') {
      this.slashTimer -= dt;
      this.sword.rotation.z += (-0.35 - this.sword.rotation.z) * 10 * dt;
      this.chest.rotation.z += (0 - this.chest.rotation.z) * 10 * dt;
      this.armRData.shoulder.rotation.z += (0.85 - this.armRData.shoulder.rotation.z) * 10 * dt;
      this.armLData.shoulder.rotation.z += (0.9 - this.armLData.shoulder.rotation.z) * 10 * dt;
      if (this.slashTimer <= 0) {
        this.slashPhase = 'IDLE';
      }
    }

    if (this.state === 'ATTACKING') {
      const dist = mouse3D.worldX - this.group.position.x;
      const isMoving = Math.abs(dist) > 10;

      if (isMoving) {
        const dir = dist > 0 ? 1 : -1;
        this.group.position.x = Math.max(-44, Math.min(44, this.group.position.x + dir * this.moveSpeed * dt));
        this.walkCycle += this.moveSpeed * dt * 0.42;

        const gait = this.calculateHumanoidGait(this.walkCycle);
        this.legLData.hip.rotation.z = gait.legL.hip;
        this.legLData.knee.rotation.z = gait.legL.knee;
        this.legLData.ankle.rotation.z = gait.legL.ankle;

        this.legRData.hip.rotation.z = gait.legR.hip;
        this.legRData.knee.rotation.z = gait.legR.knee;
        this.legRData.ankle.rotation.z = gait.legR.ankle;

        this.pelvis.position.y = 3.65 + gait.bounceY;
        this.pelvis.rotation.y = gait.swayY;
        this.pelvis.rotation.z = gait.rollZ;
        if (this.slashPhase === 'IDLE') {
          this.spine.rotation.y = gait.torsoTwistY;
        }
      } else {
        this.legLData.hip.rotation.z += (0 - this.legLData.hip.rotation.z) * 8 * dt;
        this.legLData.knee.rotation.z += (-0.06 - this.legLData.knee.rotation.z) * 8 * dt;
        this.legRData.hip.rotation.z += (0 - this.legRData.hip.rotation.z) * 8 * dt;
        this.legRData.knee.rotation.z += (-0.06 - this.legRData.knee.rotation.z) * 8 * dt;
        this.pelvis.position.y = 3.65 + Math.sin(this.breathCycle) * 0.05;
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
        this.walkCycle += this.moveSpeed * dt * 0.42;

        const gait = this.calculateHumanoidGait(this.walkCycle);
        this.legLData.hip.rotation.z = gait.legL.hip;
        this.legLData.knee.rotation.z = gait.legL.knee;
        this.legLData.ankle.rotation.z = gait.legL.ankle;

        this.legRData.hip.rotation.z = gait.legR.hip;
        this.legRData.knee.rotation.z = gait.legR.knee;
        this.legRData.ankle.rotation.z = gait.legR.ankle;

        this.pelvis.position.y = 3.65 + gait.bounceY;
        this.pelvis.rotation.y = gait.swayY;
        this.facing = dist >= 0 ? 1 : -1;
      } else {
        this.legLData.hip.rotation.z = 0;
        this.legLData.knee.rotation.z = -0.06;
        this.legRData.hip.rotation.z = 0;
        this.legRData.knee.rotation.z = -0.06;
        this.pelvis.position.y = 3.65 + Math.sin(this.breathCycle) * 0.04;
      }
      this.group.rotation.y = (this.facing === 1 ? 0 : Math.PI) + Math.sin(this.huntTimer * 3.0) * 0.4;
      this.headGroup.rotation.y = Math.sin(this.huntTimer * 3.8) * 0.35;
    }
  }

  meleeAssault(mouse3D, physics3D, sceneManager3D) {
    const roll = Math.random();

    if (roll < 0.45) {
      this.slashPhase = 'WINDUP';
      this.slashTimer = 0.15;

      const slashAngle = this.facing === 1 ? 0 : Math.PI;
      physics3D.addProjectile3D({
        type: 'sword_wave',
        x: this.group.position.x + this.facing * 3.2,
        y: 4.8,
        z: 0.5,
        vx: Math.cos(slashAngle) * 55,
        vy: (mouse3D.worldY - 4.8) * 0.8,
        vz: 0,
        life: 0.65
      });
      this.attackCooldown = 0.65;
    } else if (roll < 0.75) {
      window.soundEngine.playJavelinThrow();
      const dx = mouse3D.worldX - (this.group.position.x + this.facing * 2.2);
      const dy = mouse3D.worldY - 5.5;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 68;

      physics3D.addProjectile3D({
        type: 'javelin',
        x: this.group.position.x + this.facing * 2.2,
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
    window.soundEngine.playJavelinThrow();
    physics3D.addProjectile3D({
      type: 'javelin',
      x: this.group.position.x,
      y: 6.2,
      z: 0,
      vx: (mouse3D.worldX - this.group.position.x) * 1.5,
      vy: 75,
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
