// High-Fidelity Animated Character Engine with Skeletal Kinematics & Freefall AI

class CharacterBase {
  constructor(name, x, y, floorY) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.floorY = floorY;
    this.facing = 1;
    this.state = 'ATTACKING'; // 'ATTACKING', 'HUNTING', 'ALERT', 'FREEFALL', 'LANDING'
    this.huntTimer = 0;
    this.huntScanAngle = 0;
    this.alertTimer = 0;
    this.landingTimer = 0;

    // Kinematics & Animation
    this.walkCycle = 0;
    this.breathCycle = 0;
    this.aimAngle = 0;
    this.flailCycle = 0;
    this.capePoints = [0, 0, 0, 0];

    // Movement
    this.vx = 0;
    this.targetX = x;
    this.moveSpeed = 220;

    // Speech Bubble
    this.speechText = '';
    this.speechTimer = 0;
    this.speechMaxTimer = 2.5;

    this.attackCooldown = 0;
    this.rageLevel = 1.0;
  }

  say(text, duration = 2.2) {
    this.speechText = text;
    this.speechTimer = duration;
    this.speechMaxTimer = duration;
  }

  updateCommon(dt, mouse, physics, scenery) {
    this.breathCycle += dt * 3.5;

    // 1. Speech bubble decay
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0) {
        this.speechText = '';
      }
    }

    // 2. Freefall State Check (Triggered when scenery floor collapses)
    if (scenery.isCollapsing) {
      if (this.state !== 'FREEFALL') {
        this.state = 'FREEFALL';
        this.onStartFreefall();
      }
      this.flailCycle += dt * 14;
      // Drift towards center of shaft
      this.x += (scenery.width * 0.5 - this.x) * 1.5 * dt;

      // Stubbornly attack cursor from below while falling!
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && mouse.active) {
        this.attackCooldown = 0.8;
        this.fireUpwardAtCursor(mouse, physics, scenery);
      }
      return;
    } else if (this.state === 'FREEFALL') {
      // Just landed!
      this.state = 'LANDING';
      this.landingTimer = 0.6;
      this.onLandImpact();
    }

    if (this.state === 'LANDING') {
      this.landingTimer -= dt;
      if (this.landingTimer <= 0) {
        this.state = 'ATTACKING';
      }
      return;
    }

    // 3. Cursor state transition (ATTACKING vs HUNTING)
    if (!mouse.active) {
      if (this.state !== 'HUNTING') {
        this.state = 'HUNTING';
        this.huntTimer = 0;
        this.onStartHunting(mouse.lastExitPos);
      }
    } else {
      if (this.state === 'HUNTING') {
        this.state = 'ALERT';
        this.alertTimer = 0.6;
        this.onSpotCursor(mouse);
      } else if (this.state === 'ALERT') {
        this.alertTimer -= dt;
        if (this.alertTimer <= 0) {
          this.state = 'ATTACKING';
        }
      }
    }

    // 4. Aim & Facing
    const aimTargetX = mouse.active ? mouse.x : (mouse.lastExitPos ? mouse.lastExitPos.x : this.x + this.facing * 100);
    const aimTargetY = mouse.active ? mouse.y : (mouse.lastExitPos ? mouse.lastExitPos.y : this.y - 70);
    this.facing = aimTargetX > this.x ? 1 : -1;
    this.aimAngle = Math.atan2(aimTargetY - (this.y - 65), (aimTargetX - this.x) * this.facing);
  }

  renderSpeechBubble(ctx) {
    if (this.speechTimer <= 0 || !this.speechText) return;

    ctx.save();
    ctx.font = 'bold 12px ui-monospace, SFMono-Regular, monospace';
    const textMetrics = ctx.measureText(this.speechText);
    const bubbleW = textMetrics.width + 20;
    const bubbleH = 26;
    const bubbleX = this.x - bubbleW / 2;
    const bubbleY = this.y - 135;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(this.x - 5, bubbleY + bubbleH);
    ctx.lineTo(this.x, bubbleY + bubbleH + 7);
    ctx.lineTo(this.x + 5, bubbleY + bubbleH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.speechText, this.x, bubbleY + bubbleH / 2);
    ctx.restore();
  }
}

// ==========================================
// 1. WIZARD (High-Fidelity Robes, Staff & Runes)
// ==========================================
class WizardCharacter extends CharacterBase {
  constructor(x, y, floorY) {
    super('Wizard', x, y, floorY);
    this.runeRotation = 0;
    this.say("THE FOUNDATIONS CANNOT WITHSTAND MY ARCANE FIRE!");
    this.quips = [
      "DIE, INSOLENT GLYPH!",
      "I COMMAND THE COSMOS TO SMITE THEE!",
      "HOW CAN AN ARROW RESIST ARCANE FIRE?!",
      "BEHOLD THE WRATH OF A THOUSAND SUNS!",
      "CRUMBLE, HEAVENS AND EARTH!"
    ];
    this.fallQuips = [
      "BY THE NINE HELLS, THE FOUNDATIONS GAVE WAY!",
      "MY LEVITATION SPELL HATH FAILED!",
      "WE PLUNGE INTO THE ABYSS!",
      "CURSE THEE, I WILL SMITE THEE AS WE FALL!"
    ];
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
    this.targetX = lastExitPos ? Math.max(120, Math.min(window.innerWidth - 120, lastExitPos.x)) : this.x;
  }

  onSpotCursor(mouse) {
    this.say("AHA! IT RETURNS FROM THE VOID!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse, physics, scenery) {
    this.updateCommon(dt, mouse, physics, scenery);
    this.runeRotation += dt * 3.0;

    if (this.state === 'ATTACKING') {
      const desiredX = mouse.x < this.x ? mouse.x + 280 : mouse.x - 280;
      this.targetX = Math.max(80, Math.min(physics.width - 80, desiredX));
      const dist = this.targetX - this.x;
      this.x += dist * 2.5 * dt;
      this.walkCycle += Math.abs(dist) * 0.04;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.castSpell(mouse, physics, scenery);
      }
    } else if (this.state === 'HUNTING') {
      this.x += (this.targetX - this.x) * 1.5 * dt;
      this.huntTimer += dt;
      this.huntScanAngle = Math.sin(this.huntTimer * 2) * 0.4;
    }
  }

  castSpell(mouse, physics, scenery) {
    const roll = Math.random();

    if (roll < 0.45) {
      // 3-way homing arcane missiles
      window.soundEngine.playMagicMissile();
      for (let i = 0; i < 3; i++) {
        const spreadAngle = (i - 1) * 0.35 + (this.facing === 1 ? 0 : Math.PI);
        physics.addProjectile({
          type: 'magic_missile',
          x: this.x + this.facing * 35,
          y: this.y - 75,
          vx: Math.cos(spreadAngle) * 360,
          vy: Math.sin(spreadAngle) * 360 - 150,
          speed: 360,
          color: Math.random() > 0.5 ? '#c084fc' : '#38bdf8',
          life: 4.5,
          targetX: mouse.x,
          targetY: mouse.y
        });
      }
      this.attackCooldown = 0.65;
    } else if (roll < 0.75) {
      // Meteor Strike that damages both props and floor!
      window.soundEngine.playArcaneBeam();
      physics.addTrauma(0.35);
      const meteorX = mouse.x + (Math.random() - 0.5) * 160;

      physics.addProjectile({
        type: 'meteor',
        x: meteorX,
        y: -60,
        vx: (Math.random() - 0.5) * 70,
        vy: 520,
        radius: 28,
        angle: 0
      });

      // Ground shockwave damages floor
      scenery.damageFloorAt(meteorX, 110, 65, physics);

      if (Math.random() < 0.4) {
        this.say(this.quips[Math.floor(Math.random() * this.quips.length)]);
      }
      this.attackCooldown = 1.1;
    } else {
      // Chain Lightning shock that arcs to floor
      window.soundEngine.playLightning();
      physics.spawnSparks(mouse.x, mouse.y, null, 26, '#c084fc');
      physics.addTrauma(0.25);
      physics.blastRadius(mouse.x, mouse.y, 90, 55, scenery.props);
      scenery.damageFloorAt(mouse.x, 80, 50, physics);
      mouse.triggerDeflection();
      physics.stats.deflections++;
      this.attackCooldown = 0.85;
    }
  }

  fireUpwardAtCursor(mouse, physics, scenery) {
    window.soundEngine.playMagicMissile();
    physics.addProjectile({
      type: 'magic_missile',
      x: this.x,
      y: this.y - 60,
      vx: (mouse.x - this.x) * 0.8,
      vy: -600,
      speed: 550,
      color: '#ec4899',
      life: 2.5,
      targetX: mouse.x,
      targetY: mouse.y
    });
  }

  render(ctx) {
    const x = this.x;
    const isFall = this.state === 'FREEFALL';
    const y = isFall ? this.y - 120 + Math.sin(this.flailCycle) * 15 : this.y - Math.sin(this.walkCycle) * 4;
    const f = this.facing;

    ctx.save();

    // Freefall cape/robe blowing straight up
    if (isFall) {
      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.moveTo(x - 24, y - 50);
      ctx.lineTo(x - 35 + Math.sin(this.flailCycle) * 12, y - 110);
      ctx.lineTo(x + 35 - Math.sin(this.flailCycle) * 12, y - 110);
      ctx.lineTo(x + 24, y - 50);
      ctx.closePath();
      ctx.fill();
    }

    // Velvet Robes with Shaded Pleats & Gold Trim
    const robeGrad = ctx.createLinearGradient(x - 25, 0, x + 25, 0);
    robeGrad.addColorStop(0, '#1e1b4b');
    robeGrad.addColorStop(0.3, '#3730a3');
    robeGrad.addColorStop(0.7, '#4338ca');
    robeGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = robeGrad;

    ctx.beginPath();
    ctx.moveTo(x - f * 18, y - 70);
    ctx.lineTo(x + f * 20, y - 70);
    ctx.lineTo(x + f * 28, y);
    ctx.lineTo(x - f * 26, y);
    ctx.closePath();
    ctx.fill();

    // Gold Astrological Trim
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rotating Celestial Rune Wheel around left hand
    ctx.save();
    ctx.translate(x + f * 34, y - 60);
    ctx.rotate(this.runeRotation);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    for (let r = 0; r < 4; r++) {
      ctx.strokeRect(-4, -4, 8, 8);
      ctx.rotate(Math.PI / 4);
    }
    ctx.restore();

    // Braided Flowing Wizard Beard
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(x - f * 12, y - 62);
    ctx.quadraticCurveTo(x + f * 24, y - 48, x + f * 16, y - 15);
    ctx.quadraticCurveTo(x, y - 36, x - f * 12, y - 62);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(x, y - 76, 15, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Eyes
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(x + f * 7, y - 77, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Wizard Hat with Starry Velvet
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(x, y - 86, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 22, y - 88);
    ctx.lineTo(x + 22, y - 88);
    ctx.quadraticCurveTo(x + f * 14, y - 118, x - f * 20, y - 138);
    ctx.closePath();
    ctx.fill();

    // Ornate Carved Staff
    const staffX = x + f * 32;
    const staffTopY = y - 120;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(staffX, y);
    ctx.lineTo(staffX, staffTopY);
    ctx.stroke();

    // Swirling Elemental Orb in Staff Head
    const orbPulse = (Math.sin(Date.now() * 0.008) + 1) * 0.5;
    const orbGrad = ctx.createRadialGradient(staffX, staffTopY, 2, staffX, staffTopY, 18);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.5, '#a855f7');
    orbGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(staffX, staffTopY, 14 + orbPulse * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this.renderSpeechBubble(ctx);
  }
}

// ==========================================
// 2. SOLDIER (Tactical Spec-Ops Gear & Heavy Arsenal)
// ==========================================
class SoldierCharacter extends CharacterBase {
  constructor(x, y, floorY) {
    super('Soldier', x, y, floorY);
    this.recoil = 0;
    this.muzzleFlash = 0;
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
    this.targetX = lastExitPos ? Math.max(100, Math.min(window.innerWidth - 100, lastExitPos.x)) : this.x;
  }

  onSpotCursor(mouse) {
    this.say("CONTACT! TARGET RE-ACQUIRED! FIRE!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse, physics, scenery) {
    this.updateCommon(dt, mouse, physics, scenery);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - 18 * dt);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - 15 * dt);

    if (this.state === 'ATTACKING') {
      const desiredX = mouse.x + (mouse.x > this.x ? -260 : 260);
      this.targetX = Math.max(90, Math.min(physics.width - 90, desiredX));
      const dist = this.targetX - this.x;
      this.x += dist * 3.0 * dt;
      this.walkCycle += Math.abs(dist) * 0.05;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.fireArsenal(mouse, physics, scenery);
      }
    } else if (this.state === 'HUNTING') {
      this.x += (this.targetX - this.x) * 2.2 * dt;
      this.huntTimer += dt;
      this.huntScanAngle = Math.sin(this.huntTimer * 3) * 0.5;
    }
  }

  fireArsenal(mouse, physics, scenery) {
    const roll = Math.random();

    if (roll < 0.65) {
      // Rapid Assault Rifle Burst (3 rounds)
      this.recoil = 9;
      this.muzzleFlash = 1.0;
      window.soundEngine.playGunshot(false);

      const barrelX = this.x + this.facing * 48;
      const barrelY = this.y - 50;
      const angle = Math.atan2(mouse.y - barrelY, mouse.x - barrelX) + (Math.random() - 0.5) * 0.08;

      physics.addProjectile({
        type: 'bullet',
        x: barrelX,
        y: barrelY,
        vx: Math.cos(angle) * 1250,
        vy: Math.sin(angle) * 1250,
        damage: 22,
        life: 1.5
      });
      physics.spawnCasing(this.x + this.facing * 20, this.y - 52, this.facing);
      this.attackCooldown = 0.12;

      // Stray bullets chip the floor
      if (Math.random() < 0.25) {
        scenery.damageFloorAt(mouse.x + (Math.random() - 0.5) * 100, 40, 15, physics);
      }
    } else if (roll < 0.85) {
      // Frag Grenade that craters floor
      window.soundEngine.playJavelinThrow();
      const throwAngle = this.facing === 1 ? -Math.PI * 0.35 : -Math.PI * 0.65;

      physics.addProjectile({
        type: 'grenade',
        x: this.x + this.facing * 25,
        y: this.y - 65,
        vx: Math.cos(throwAngle) * 530 + (mouse.x - this.x) * 0.45,
        vy: Math.sin(throwAngle) * 530,
        angle: 0,
        vAng: 15,
        timer: 1.6
      });
      this.say("FRAG OUT!");
      this.attackCooldown = 1.0;
    } else {
      // RPG Rocket with catastrophic floor damage
      this.recoil = 20;
      this.muzzleFlash = 1.6;
      window.soundEngine.playGunshot(true);

      const barrelX = this.x + this.facing * 52;
      const barrelY = this.y - 56;
      const angle = Math.atan2(mouse.y - barrelY, mouse.x - barrelX);

      physics.addProjectile({
        type: 'rocket',
        x: barrelX,
        y: barrelY,
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        angle,
        life: 3.5
      });

      // Rocket backblast & ground shockwave
      scenery.damageFloorAt(mouse.x, 100, 75, physics);
      this.say("EAT BAZOOKA!");
      this.attackCooldown = 1.3;
    }
  }

  fireUpwardAtCursor(mouse, physics, scenery) {
    this.recoil = 12;
    this.muzzleFlash = 1.2;
    window.soundEngine.playGunshot(false);
    physics.addProjectile({
      type: 'bullet',
      x: this.x,
      y: this.y - 70,
      vx: (mouse.x - this.x) * 1.5,
      vy: -1100,
      damage: 25,
      life: 1.5
    });
  }

  render(ctx) {
    const x = this.x;
    const isFall = this.state === 'FREEFALL';
    const y = isFall ? this.y - 120 + Math.sin(this.flailCycle) * 12 : this.y;
    const f = this.facing;

    ctx.save();

    // Tactical Spec-Ops Camo Fatigue Pants
    ctx.fillStyle = '#1e3a1e';
    const legBend = isFall ? Math.sin(this.flailCycle) * 12 : Math.sin(this.walkCycle) * 8;
    ctx.fillRect(x - 14, y - 35, 11, 35 - legBend);
    ctx.fillRect(x + 3, y - 35, 11, 35 + legBend);

    // Combat Boots
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 16, y - 10 - legBend, 14, 10);
    ctx.fillRect(x + 2, y - 10 + legBend, 14, 10);

    // Ballistic Plate Carrier with MOLLE Webbing
    ctx.fillStyle = '#14532d';
    ctx.fillRect(x - 16, y - 72, 32, 40);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 13, y - 68, 26, 30);
    // MOLLE Webbing Rows
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.5;
    for (let m = 0; m < 3; m++) {
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 62 + m * 8);
      ctx.lineTo(x + 12, y - 62 + m * 8);
      ctx.stroke();
    }

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(x, y - 78, 12, 0, Math.PI * 2);
    ctx.fill();

    // Ballistic Helmet & NVG Goggle Monocle
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(x, y - 82, 14, Math.PI, 0);
    ctx.fill();

    // Glowing Green NVG Lens
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x + f * 8, y - 80, 4, 0, Math.PI * 2);
    ctx.fill();

    // Assault Rifle with Picatinny Rail
    const gunX = x + f * (14 - this.recoil);
    const gunY = y - 50;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gunX, gunY - 5, 42 * f, 9);
    // Magazine
    ctx.fillRect(gunX + 12 * f, gunY + 4, 8 * f, 14);

    // Muzzle Flash
    if (this.muzzleFlash > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(gunX + 46 * f, gunY, 14 * this.muzzleFlash, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this.renderSpeechBubble(ctx);
  }
}

// ==========================================
// 3. KNIGHT (Burnished Steel Plate & Greatsword)
// ==========================================
class KnightCharacter extends CharacterBase {
  constructor(x, y, floorY) {
    super('Knight', x, y, floorY);
    this.say("BY STEEL AND STONE, THOU SHALT BE CRUSHED!");
    this.quips = [
      "FACE MY STEEL, COWARD!",
      "I WILL CLEAVE THY DEMONIC CORE!",
      "THOU CANST NOT ESCAPE MY JAVELIN!",
      "STAND THY GROUND AND FIGHT ME!",
      "THE EARTH ITSELF TREMBLES AT MY CHARGE!"
    ];
    this.fallQuips = [
      "THE ABYSS HATH CLAIMED THE FLOOR!",
      "BRACE THY ARMOR! WE PLUNGE INTO CHAOS!",
      "MY BLADE WILL STRIKE THEE AS WE FALL!",
      "STAND RESOLUTE, EVEN UNTO THE CRAGS BELOW!"
    ];
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
    this.targetX = lastExitPos ? Math.max(90, Math.min(window.innerWidth - 90, lastExitPos.x)) : this.x;
  }

  onSpotCursor(mouse) {
    this.say("THOU HAST RETURNED! PREPARE THYSELF!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse, physics, scenery) {
    this.updateCommon(dt, mouse, physics, scenery);

    if (this.state === 'ATTACKING') {
      const distToMouse = Math.abs(mouse.x - this.x);
      if (distToMouse > 160) {
        const dir = mouse.x - this.x > 0 ? 1 : -1;
        this.x += dir * this.moveSpeed * dt;
        this.walkCycle += this.moveSpeed * dt * 0.05;
      }

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.meleeAssault(mouse, physics, scenery);
      }
    } else if (this.state === 'HUNTING') {
      this.x += (this.targetX - this.x) * 1.8 * dt;
      this.huntTimer += dt;
    }
  }

  meleeAssault(mouse, physics, scenery) {
    const roll = Math.random();

    if (roll < 0.45) {
      // Greatsword Cleave Wave
      window.soundEngine.playSwordSlash();
      const slashAngle = this.facing === 1 ? 0 : Math.PI;

      physics.addProjectile({
        type: 'sword_wave',
        x: this.x + this.facing * 35,
        y: this.y - 50,
        vx: Math.cos(slashAngle) * 580,
        vy: (mouse.y - (this.y - 50)) * 0.8,
        angle: slashAngle,
        life: 0.65,
        maxLife: 0.65
      });
      this.attackCooldown = 0.6;
    } else if (roll < 0.75) {
      // Hurled Javelin
      window.soundEngine.playJavelinThrow();
      const throwAngle = Math.atan2(mouse.y - (this.y - 70), mouse.x - (this.x + this.facing * 20));

      physics.addProjectile({
        type: 'javelin',
        x: this.x + this.facing * 25,
        y: this.y - 70,
        vx: Math.cos(throwAngle) * 750,
        vy: Math.sin(throwAngle) * 750,
        angle: throwAngle,
        stuck: false
      });
      this.say("TASTE MY JAVELIN!");
      this.attackCooldown = 0.9;
    } else {
      // Earthquake Shield Slam: Rips up floor slabs!
      window.soundEngine.playHeavyExplosion(0.9);
      physics.addTrauma(0.5);
      physics.spawnExplosionParticles(this.x + this.facing * 40, this.floorY, 32, '#94a3b8', 380);
      physics.blastRadius(this.x + this.facing * 50, this.floorY, 130, 80, scenery.props);

      // Major floor fissure
      scenery.damageFloorAt(this.x + this.facing * 50, 110, 85, physics);

      mouse.triggerDeflection();
      physics.stats.deflections++;
      this.say("CRUMBLE TO ASHES!");
      this.attackCooldown = 1.3;
    }
  }

  fireUpwardAtCursor(mouse, physics, scenery) {
    window.soundEngine.playJavelinThrow();
    physics.addProjectile({
      type: 'javelin',
      x: this.x,
      y: this.y - 70,
      vx: (mouse.x - this.x) * 1.4,
      vy: -800,
      angle: -Math.PI / 2,
      stuck: false
    });
  }

  render(ctx) {
    const x = this.x;
    const isFall = this.state === 'FREEFALL';
    const y = isFall ? this.y - 120 + Math.sin(this.flailCycle) * 14 : this.y;
    const f = this.facing;

    ctx.save();

    // Crimson Heraldic Cape with Dynamic Wind Flutter
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(x - f * 8, y - 76);
    if (isFall) {
      // Flapping straight upwards in freefall
      ctx.lineTo(x - 30 + Math.sin(this.flailCycle) * 14, y - 110);
      ctx.lineTo(x + 30 - Math.sin(this.flailCycle) * 14, y - 110);
    } else {
      const capeWave = Math.sin(Date.now() * 0.006) * 14;
      ctx.lineTo(x - f * 30 + capeWave, y - 12);
      ctx.lineTo(x - f * 8, y - 12);
    }
    ctx.closePath();
    ctx.fill();

    // Burnished Steel Plate Greaves & Sabatons
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x - 14, y - 36, 11, 36);
    ctx.fillRect(x + 3, y - 36, 11, 36);

    // Cuirass Breastplate with Steel Specular Highlights
    const armorGrad = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    armorGrad.addColorStop(0, '#64748b');
    armorGrad.addColorStop(0.3, '#cbd5e1');
    armorGrad.addColorStop(0.7, '#f8fafc');
    armorGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = armorGrad;

    ctx.beginPath();
    ctx.moveTo(x - 16, y - 76);
    ctx.lineTo(x + 16, y - 76);
    ctx.lineTo(x + 12, y - 36);
    ctx.lineTo(x - 12, y - 36);
    ctx.closePath();
    ctx.fill();

    // Helm with Red Berserk Eye Glint
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x, y - 84, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x + f * 3, y - 86, 9 * f, 4);

    // Ornate Zweihänder Greatsword
    const swordX = x + f * 28;
    const swordY = y - 55;
    ctx.save();
    ctx.translate(swordX, swordY);
    ctx.rotate(f === 1 ? -0.4 : 0.4);

    ctx.fillStyle = '#d97706';
    ctx.fillRect(-12, 10, 24, 5); // Crossguard
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-4, -68, 8, 78); // Blade
    ctx.restore();

    ctx.restore();
    this.renderSpeechBubble(ctx);
  }
}

// ==========================================
// 4. ROBOT (Hydraulic Scissor Arms & Scenery/Floor Ripper)
// ==========================================
class RobotCharacter extends CharacterBase {
  constructor(x, y, floorY) {
    super('Robot', x, y, floorY);
    this.armExtension = 0;
    this.armTargetX = x;
    this.armTargetY = y - 60;
    this.heldProp = null;
    this.heldChunk = null;
    this.stateTimer = 0;
    this.actionPhase = 'IDLE';
    this.say("DEMOLITION DIRECTIVE: ALL STRUCTURAL ASSETS TARGETED.");
    this.quips = [
      "SYSTEM OVERLOAD: TARGET IMMUNITY IS UNACCEPTABLE!",
      "DISMANTLING ENVIRONMENT AND FOUNDATIONS!",
      "CALCULATING FATALITY: 0% SUCCESS?! ERROR!",
      "MAXIMUM HYDRAULIC TORQUE ENGAGED!",
      "EXTERMINATE! EXTERMINATE!"
    ];
    this.fallQuips = [
      "TERRAIN INTEGRITY: 0%. GRAVITATIONAL PLUNGE INITIATED!",
      "RE-ROUTING PNEUMATICS! FREEFALL DETECTED!",
      "DOWNWARD TRAJECTORY ACTIVE! RESUMING ATTACK!",
      "SUBSURFACE CHASM BREACHED!"
    ];
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
    this.targetX = lastExitPos ? Math.max(120, Math.min(window.innerWidth - 120, lastExitPos.x)) : this.x;
  }

  onSpotCursor(mouse) {
    this.say("INTRUDER RE-ACQUIRED! PREPARE FOR CRUSH!");
    window.soundEngine.playAlert();
  }

  update(dt, mouse, physics, scenery) {
    this.updateCommon(dt, mouse, physics, scenery);

    if (this.state === 'ATTACKING') {
      const desiredX = mouse.x < this.x ? mouse.x + 300 : mouse.x - 300;
      this.targetX = Math.max(120, Math.min(physics.width - 120, desiredX));
      this.x += (this.targetX - this.x) * 2.0 * dt;

      this.attackCooldown -= dt;

      // Hydraulic Rip / Throw Mechanics
      if (this.actionPhase === 'EXTEND_RIP') {
        this.armExtension = Math.min(1.0, this.armExtension + 3.0 * dt);
        if (this.armExtension >= 1.0) {
          this.ripTarget(physics, scenery);
          this.actionPhase = 'HOLD_OVERHEAD';
          this.stateTimer = 0.35;
        }
      } else if (this.actionPhase === 'HOLD_OVERHEAD') {
        this.stateTimer -= dt;
        this.armTargetX = this.x;
        this.armTargetY = this.y - 140;
        if (this.stateTimer <= 0) {
          this.actionPhase = 'HURL';
        }
      } else if (this.actionPhase === 'HURL') {
        this.hurlObjectAtMouse(mouse, physics, scenery);
        this.actionPhase = 'IDLE';
        this.armExtension = 0;
        this.attackCooldown = 1.1;
      } else if (this.actionPhase === 'EXTEND_PUNCH') {
        this.armExtension = Math.min(1.0, this.armExtension + 6.0 * dt);
        if (this.armExtension >= 1.0) {
          this.actionPhase = 'IDLE';
          this.armExtension = 0;
          this.attackCooldown = 0.5;
        }
      } else {
        if (this.attackCooldown <= 0) {
          this.initiateAttack(mouse, physics, scenery);
        }
      }
    } else if (this.state === 'HUNTING') {
      this.x += (this.targetX - this.x) * 1.5 * dt;
      this.huntTimer += dt;
      this.armTargetX = mouse.lastExitPos ? mouse.lastExitPos.x : this.x + this.facing * 180;
      this.armTargetY = mouse.lastExitPos ? mouse.lastExitPos.y : this.y - 60;
      this.armExtension = 0.4 + Math.sin(this.huntTimer * 3) * 0.3;
    }
  }

  initiateAttack(mouse, physics, scenery) {
    const roll = Math.random();

    // High probability to RIP SCENERY OR FLOOR SLAB AND HURL IT
    if (roll < 0.7) {
      const targetToRip = scenery.findPropForRobot(this.x);
      if (targetToRip) {
        this.heldProp = targetToRip;
        this.armTargetX = targetToRip.x;
        this.armTargetY = targetToRip.y - targetToRip.h / 2;
        this.actionPhase = 'EXTEND_RIP';
        this.armExtension = 0;
        window.soundEngine.playRobotServo(true);
        this.say("DISMANTLING " + targetToRip.name.toUpperCase() + "!");
        return;
      }

      if (physics.debris.length > 0) {
        const chunk = physics.debris[Math.floor(Math.random() * physics.debris.length)];
        this.heldChunk = chunk;
        chunk.heldByRobot = true;
        this.armTargetX = chunk.x;
        this.armTargetY = chunk.y;
        this.actionPhase = 'EXTEND_RIP';
        this.armExtension = 0;
        window.soundEngine.playRobotServo(true);
        this.say("HARVESTING FOUNDATION SHARDS!");
        return;
      }
    }

    // Piston punch
    this.actionPhase = 'EXTEND_PUNCH';
    this.armTargetX = mouse.x;
    this.armTargetY = mouse.y;
    this.armExtension = 0;
    window.soundEngine.playRobotServo(true);

    if (mouse.active) {
      setTimeout(() => {
        if (mouse.active && Math.hypot(this.armTargetX - mouse.x, this.armTargetY - mouse.y) < 45) {
          window.soundEngine.playArmorClang();
          window.soundEngine.playShieldDeflect();
          physics.spawnSparks(mouse.x, mouse.y, null, 18, '#f59e0b');
          physics.spawnFloatingText(mouse.x, mouse.y - 18, 'PISTON DEFLECTED', '#f59e0b');
          mouse.triggerDeflection();
          physics.stats.deflections++;
        }
      }, 100);
    }
  }

  ripTarget(physics, scenery) {
    window.soundEngine.playRobotRip();
    physics.addTrauma(0.4);

    if (this.heldProp) {
      if (this.heldProp.isFloorSlab) {
        this.heldProp.slabRef.collapse(physics);
      } else {
        this.heldProp.heldByRobot = true;
        this.heldProp.isDestroyed = true;
      }
      physics.spawnSparks(this.heldProp.x, this.heldProp.y, null, 15, '#e2e8f0');
    }
  }

  hurlObjectAtMouse(mouse, physics, scenery) {
    window.soundEngine.playRobotThrow();
    physics.addTrauma(0.45);

    const startX = this.x;
    const startY = this.y - 130;
    const angle = Math.atan2(mouse.y - startY, mouse.x - startX);
    const spd = 780;

    if (this.heldProp) {
      physics.createDebrisFromBox(startX, startY, this.heldProp.w, this.heldProp.h, this.heldProp.color, 8, { x: startX, y: startY + 50 }, 650);
      for (let i = physics.debris.length - 8; i < physics.debris.length; i++) {
        if (physics.debris[i]) {
          physics.debris[i].vx = Math.cos(angle) * spd + (Math.random() - 0.5) * 120;
          physics.debris[i].vy = Math.sin(angle) * spd - 140;
          physics.debris[i].thrownByRobot = true;
        }
      }
      this.heldProp = null;
    } else if (this.heldChunk) {
      this.heldChunk.heldByRobot = false;
      this.heldChunk.x = startX;
      this.heldChunk.y = startY;
      this.heldChunk.vx = Math.cos(angle) * spd;
      this.heldChunk.vy = Math.sin(angle) * spd;
      this.heldChunk.thrownByRobot = true;
      this.heldChunk.isSettled = false;
      this.heldChunk = null;
    }

    // Heavy throw shockwaves also fracture floor below
    scenery.damageFloorAt(this.x, 90, 50, physics);
  }

  fireUpwardAtCursor(mouse, physics, scenery) {
    // Upward spring rocket punch during freefall
    this.actionPhase = 'EXTEND_PUNCH';
    this.armTargetX = mouse.x;
    this.armTargetY = mouse.y;
    this.armExtension = 1.0;
    window.soundEngine.playRobotServo(true);
  }

  render(ctx) {
    const x = this.x;
    const isFall = this.state === 'FREEFALL';
    const y = isFall ? this.y - 120 + Math.sin(this.flailCycle) * 14 : this.y;
    const f = this.facing;

    ctx.save();

    // 1. EXTENDABLE HYDRAULIC ACCORDION ARM
    const shoulderX = x + f * 20;
    const shoulderY = y - 68;
    const currentClawX = shoulderX + (this.armTargetX - shoulderX) * this.armExtension;
    const currentClawY = shoulderY + (this.armTargetY - shoulderY) * this.armExtension;

    const segments = 5;
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);

    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const segX = shoulderX + (currentClawX - shoulderX) * t;
      const segY = shoulderY + (currentClawY - shoulderY) * t;
      const offset = (s % 2 === 1 ? 1 : -1) * (1 - this.armExtension) * 18;
      ctx.lineTo(segX, segY + offset);
    }
    ctx.stroke();

    // Mechanical Claw Clamp
    ctx.fillStyle = '#334155';
    ctx.fillRect(currentClawX - 10, currentClawY - 10, 20, 20);
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(currentClawX - 10, currentClawY - 10);
    ctx.lineTo(currentClawX + f * 18, currentClawY - 16);
    ctx.lineTo(currentClawX + f * 8, currentClawY);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(currentClawX - 10, currentClawY + 10);
    ctx.lineTo(currentClawX + f * 18, currentClawY + 16);
    ctx.lineTo(currentClawX + f * 8, currentClawY);
    ctx.fill();

    // Held Item
    if (this.heldProp && (this.actionPhase === 'HOLD_OVERHEAD' || this.actionPhase === 'EXTEND_RIP')) {
      ctx.fillStyle = this.heldProp.color;
      ctx.fillRect(currentClawX - this.heldProp.w / 2, currentClawY - this.heldProp.h / 2, this.heldProp.w, this.heldProp.h);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentClawX - this.heldProp.w / 2, currentClawY - this.heldProp.h / 2, this.heldProp.w, this.heldProp.h);
    } else if (this.heldChunk && (this.actionPhase === 'HOLD_OVERHEAD' || this.actionPhase === 'EXTEND_RIP')) {
      ctx.fillStyle = this.heldChunk.color;
      ctx.beginPath();
      ctx.arc(currentClawX, currentClawY, this.heldChunk.radius || 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. MECH CHASSIS WITH HAZARD STRIPES
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 20, y - 36, 14, 36);
    ctx.fillRect(x + 6, y - 36, 14, 36);

    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 24, y - 82, 48, 48);

    // Hazard Stripes
    for (let st = 0; st < 4; st++) {
      ctx.fillStyle = st % 2 === 0 ? '#eab308' : '#0f172a';
      ctx.fillRect(x - 20 + st * 10, y - 50, 10, 12);
    }

    // Cyclops Scanner Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 16, y - 76, 32, 14);
    const pupilX = x + Math.sin(Date.now() * 0.01) * 10;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(pupilX, y - 69, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this.renderSpeechBubble(ctx);
  }
}

window.WizardCharacter = WizardCharacter;
window.SoldierCharacter = SoldierCharacter;
window.KnightCharacter = KnightCharacter;
window.RobotCharacter = RobotCharacter;
