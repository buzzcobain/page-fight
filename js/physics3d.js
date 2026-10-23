// 3D Physics, Projectiles, Particle Engine, Active Cursor Warfare, and Auto-Fading Debris Simulation

class PhysicsWorld3D {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.projectiles3D = [];
    this.debris3D = [];
    this.particles3D = [];
    this.shockwaves3D = [];
    this.screenShake = 0;

    this.vortexActive = false;
    this.vortexCharge = 0;

    this.stats = {
      deflections: 0,
      parries: 0,
      shotsFired: 0,
      debrisCount: 0
    };
  }

  addTrauma(amount) {
    this.screenShake = Math.min(1.0, this.screenShake + amount);
  }

  getShakeOffset() {
    if (this.screenShake <= 0.001) return { x: 0, y: 0, z: 0, rotZ: 0 };
    const power = this.screenShake * this.screenShake;
    const maxOffset = 1.8 * power;
    const maxRot = 0.035 * power;
    return {
      x: (Math.random() * 2 - 1) * maxOffset,
      y: (Math.random() * 2 - 1) * maxOffset,
      z: (Math.random() * 2 - 1) * (maxOffset * 0.5),
      rotZ: (Math.random() * 2 - 1) * maxRot
    };
  }

  // --- 3D EXPANDING SHOCKWAVE RINGS ---
  spawnShockwaveRing3D(x, y, z, maxRadius = 9.0, colorHex = 0x38bdf8, orientFlat = false) {
    const geom = new THREE.RingGeometry(0.6, 1.15, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    if (orientFlat) {
      mesh.rotation.x = -Math.PI / 2;
    }
    this.scene.add(mesh);

    this.shockwaves3D.push({
      mesh,
      maxRadius,
      life: 0.35,
      maxLife: 0.35
    });
  }

  // --- ACTIVE CURSOR KINETIC REPULSOR & PARRY ---
  triggerCursorRepulsor(mouse3D, sceneManager3D, activeCharacters = []) {
    const cx = mouse3D.worldX;
    const cy = mouse3D.worldY;
    const cz = mouse3D.worldZ;

    if (window.soundEngine) window.soundEngine.playRepulsorBlast();
    this.addTrauma(0.32);
    this.spawnShockwaveRing3D(cx, cy, cz, 10.5, 0x38bdf8, false);
    this.spawnSparks3D(cx, cy, cz, 28, 0x38bdf8);
    mouse3D.triggerDeflection();

    let parriedCount = 0;

    // 1. Parry & Reflect Incoming Projectiles within 9.5 units
    for (const p of this.projectiles3D) {
      if (!p.mesh || p.parried) continue;
      const dx = p.mesh.position.x - cx;
      const dy = p.mesh.position.y - cy;
      const dz = p.mesh.position.z - cz;
      const dist = Math.hypot(dx, dy, dz);

      if (dist < 9.5) {
        p.parried = true;
        p.life = Math.max(p.life || 2.0, 2.5);
        parriedCount++;

        // Aim reflected projectile at nearest character or downward at floor below cursor
        let targetX = cx + (Math.random() - 0.5) * 10;
        let targetY = 0;
        let targetZ = 0;

        if (activeCharacters.length > 0) {
          let nearest = activeCharacters[0];
          let minD = Infinity;
          for (const ch of activeCharacters) {
            if (!ch || !ch.group) continue;
            const d = Math.abs(ch.group.position.x - cx);
            if (d < minD) {
              minD = d;
              nearest = ch;
            }
          }
          if (nearest && nearest.group) {
            targetX = nearest.group.position.x;
            targetY = Math.max(0.5, nearest.group.position.y + 2.0);
            targetZ = nearest.group.position.z;
          }
        }

        const rdx = targetX - p.mesh.position.x;
        const rdy = targetY - p.mesh.position.y;
        const rdz = targetZ - p.mesh.position.z;
        const rlen = Math.hypot(rdx, rdy, rdz) || 1;
        const reflectSpeed = 85;

        p.vx = (rdx / rlen) * reflectSpeed;
        p.vy = (rdy / rlen) * reflectSpeed;
        p.vz = (rdz / rlen) * reflectSpeed;
        p.damage = (p.damage || 35) * 2.5;

        if (p.mesh.material) {
          p.mesh.material.color.setHex(0x38bdf8);
          if (p.mesh.material.emissive) {
            p.mesh.material.emissive.setHex(0x0284c7);
            p.mesh.material.emissiveIntensity = 1.5;
          }
        }
        p.mesh.scale.set(1.45, 1.45, 1.45);
        this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 18, 0xfef08a);
      }
    }

    if (parriedCount > 0) {
      if (window.soundEngine) window.soundEngine.playParryReflect();
      this.stats.deflections += parriedCount;
      this.stats.parries += parriedCount;
      this.spawnShockwaveRing3D(cx, cy, cz, 14.0, 0xfef08a, false);
    }

    // 2. Blast & Knockback Nearby Characters (Can launch them into cracks!)
    for (const ch of activeCharacters) {
      if (!ch || !ch.group || ch.state === 'FREEFALL') continue;
      const charCenterY = ch.group.position.y + 3.6;
      const dx = ch.group.position.x - cx;
      const dy = charCenterY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < 11.0) {
        const pushDir = dx >= 0 ? 1 : -1;
        const falloff = 1 - dist / 11.0;
        const impulseX = pushDir * (18 + falloff * 22);
        const impulseY = 10 + falloff * 12;
        if (typeof ch.applyKnockback === 'function') {
          ch.applyKnockback(impulseX, impulseY, "REPULSOR BLAST!");
        }
      }
    }

    // 3. Concussive Structural Damage to Props & Floor Slabs near Cursor
    this.blastRadius3D(cx, cy, cz, 9.0, 55, sceneManager3D.props, sceneManager3D, []);
  }

  // --- SINGULARITY VORTEX (HOLD MOUSE / SPACE TO CAPTURE & LAUNCH DEBRIS) ---
  updateCursorVortex(dt, mouse3D, isHolding) {
    this.vortexActive = isHolding && mouse3D.active;
    if (!this.vortexActive) {
      this.vortexCharge = Math.max(0, this.vortexCharge - dt * 2.5);
      return;
    }

    this.vortexCharge = Math.min(1.0, this.vortexCharge + dt * 1.5);
    const cx = mouse3D.worldX;
    const cy = mouse3D.worldY;
    const cz = mouse3D.worldZ;

    // Pull debris chunks into orbital vortex around cursor
    for (const chunk of this.debris3D) {
      if (chunk.heldByRobot || !chunk.mesh) continue;
      const dx = cx - chunk.mesh.position.x;
      const dy = cy - chunk.mesh.position.y;
      const dz = cz - chunk.mesh.position.z;
      const dist = Math.hypot(dx, dy, dz) || 1;

      if (dist < 26.0) {
        chunk.isSettled = false;
        chunk.capturedByVortex = true;
        chunk.life = Math.max(chunk.life, 3.5);

        // Tangential swirl + radial attraction toward orbit radius ~3.2
        const targetOrbit = 3.2;
        const radialPull = (dist - targetOrbit) * 14.0;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        // Swirl perpendicular in XY plane
        const swirlSpeed = 24.0;
        chunk.vx += (nx * radialPull - ny * swirlSpeed - chunk.vx * 3.0) * dt;
        chunk.vy += (ny * radialPull + nx * swirlSpeed - chunk.vy * 3.0) * dt;
        chunk.vz += (nz * radialPull - chunk.vz * 3.0) * dt;
      }
    }
  }

  releaseCursorVortex(mouse3D, sceneManager3D, activeCharacters = []) {
    let launched = 0;
    const cx = mouse3D.worldX;
    const cy = mouse3D.worldY;

    for (const chunk of this.debris3D) {
      if (chunk.capturedByVortex && chunk.mesh) {
        chunk.capturedByVortex = false;
        chunk.thrownByCursor = true;
        chunk.isSettled = false;

        // Launch downward and outward toward characters/floor slabs
        let targetX = chunk.mesh.position.x + (chunk.mesh.position.x - cx) * 2.2;
        if (activeCharacters.length > 0 && Math.random() < 0.65) {
          const pick = activeCharacters[Math.floor(Math.random() * activeCharacters.length)];
          if (pick && pick.group) {
            targetX = pick.group.position.x + (Math.random() - 0.5) * 4.0;
          }
        }

        const dx = targetX - chunk.mesh.position.x;
        const dy = -1.0 - chunk.mesh.position.y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 62;

        chunk.vx = (dx / len) * spd;
        chunk.vy = (dy / len) * spd;
        chunk.vz = (Math.random() - 0.5) * 8;
        launched++;
      }
    }

    if (launched > 0) {
      if (window.soundEngine) window.soundEngine.playRobotThrow();
      this.addTrauma(0.35);
      this.spawnShockwaveRing3D(cx, cy, mouse3D.worldZ, 8.5, 0xc084fc, false);
    }
    this.vortexActive = false;
    this.vortexCharge = 0;
  }

  // --- 3D PARTICLES & SPARKS ---
  spawnSparks3D(x, y, z, count = 20, colorHex = 0x38bdf8) {
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions.push(x, y, z);
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = 12 + Math.random() * 28;
      velocities.push(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd + 8,
        Math.sin(theta) * Math.cos(phi) * spd
      );
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.45,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });

    const pSystem = new THREE.Points(geom, mat);
    this.scene.add(pSystem);

    this.particles3D.push({
      system: pSystem,
      velocities,
      life: 0.4,
      maxLife: 0.4
    });
  }

  // --- 3D VORONOI-LIKE FRACTURE DEBRIS WITH AUTO-FADE CLEANUP ---
  createDebrisFromBox3D(x, y, z, w, h, d, colorHex, pieces = 8, blastOrigin = null) {
    const subW = w / 2;
    const subH = h / Math.ceil(pieces / 4);
    const subD = d / 2;

    for (let px = -w / 2 + subW / 2; px <= w / 2; px += subW) {
      for (let py = -h / 2 + subH / 2; py <= h / 2; py += subH) {
        for (let pz = -d / 2 + subD / 2; pz <= d / 2; pz += subD) {
          const chunkGeom = new THREE.DodecahedronGeometry((Math.min(subW, subH) * 0.45) * (0.8 + Math.random() * 0.4));
          const chunkMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.7,
            metalness: 0.2
          });
          const chunkMesh = new THREE.Mesh(chunkGeom, chunkMat);
          chunkMesh.position.set(x + px, y + py, z + pz);
          chunkMesh.castShadow = true;
          chunkMesh.receiveShadow = true;
          this.scene.add(chunkMesh);

          let vx = (Math.random() - 0.5) * 16;
          let vy = 12 + Math.random() * 18;
          let vz = (Math.random() - 0.5) * 16;

          if (blastOrigin) {
            const dx = (x + px) - blastOrigin.x;
            const dy = (y + py) - blastOrigin.y;
            const dz = (z + pz) - blastOrigin.z;
            const dist = Math.hypot(dx, dy, dz) || 1;
            const force = 35 / Math.max(2, dist);
            vx += (dx / dist) * force;
            vy += (dy / dist) * force + 8;
            vz += (dz / dist) * force;
          }

          const vAng = new THREE.Vector3(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8
          );

          this.debris3D.push(new DebrisChunk3D(chunkMesh, vx, vy, vz, vAng, this.scene));
          this.stats.debrisCount++;
        }
      }
    }
  }

  // --- 3D PROJECTILES ---
  addProjectile3D(proj) {
    this.stats.shotsFired++;

    let mesh;
    switch (proj.type) {
      case 'bullet': {
        const bGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
        const bMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        mesh = new THREE.Mesh(bGeom, bMat);
        mesh.rotation.z = Math.PI / 2;
        break;
      }

      case 'rocket': {
        const rGeom = new THREE.ConeGeometry(0.5, 2.4, 8);
        const rMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.5, metalness: 0.6 });
        mesh = new THREE.Mesh(rGeom, rMat);
        break;
      }

      case 'grenade': {
        const gGeom = new THREE.SphereGeometry(0.55, 12, 12);
        const gMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        mesh = new THREE.Mesh(gGeom, gMat);
        break;
      }

      case 'magic_missile': {
        const mGeom = new THREE.SphereGeometry(0.65, 12, 12);
        const mMat = new THREE.MeshStandardMaterial({
          color: proj.color || 0xc084fc,
          emissive: proj.color || 0xa855f7,
          emissiveIntensity: 0.9
        });
        mesh = new THREE.Mesh(mGeom, mMat);
        break;
      }

      case 'meteor': {
        const metGeom = new THREE.DodecahedronGeometry(proj.radius || 1.8);
        const metMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          emissive: 0xea580c,
          emissiveIntensity: 0.6,
          roughness: 0.9
        });
        mesh = new THREE.Mesh(metGeom, metMat);
        break;
      }

      case 'javelin': {
        const jGeom = new THREE.CylinderGeometry(0.1, 0.1, 4.5, 6);
        const jMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.5 });
        mesh = new THREE.Mesh(jGeom, jMat);
        break;
      }

      case 'sword_wave': {
        const swGeom = new THREE.TorusGeometry(2.5, 0.2, 6, 16, Math.PI * 0.7);
        const swMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.8
        });
        mesh = new THREE.Mesh(swGeom, swMat);
        break;
      }
    }

    if (mesh) {
      mesh.position.set(proj.x, proj.y, proj.z || 0);
      this.scene.add(mesh);
      proj.mesh = mesh;
    }

    this.projectiles3D.push(proj);
  }

  // --- BLAST RADIUS 3D (Damages Props, Floor Slabs, and Knocks Back Characters) ---
  blastRadius3D(x, y, z, radius, damage, sceneryProps, sceneManager3D = null, activeCharacters = []) {
    if (sceneryProps) {
      for (const p of sceneryProps) {
        if (p.isAlive()) {
          const dx = p.group.position.x - x;
          const dy = p.group.position.y + p.h / 2 - y;
          const dz = p.group.position.z - z;
          const dist = Math.hypot(dx, dy, dz);
          if (dist < radius + p.radius) {
            p.takeDamage(damage * (1 - dist / (radius + p.radius)), { x, y, z }, this);
          }
        }
      }
    }

    // Physical Impact Damage to Floor Slabs when Blast is Near Floor
    if (sceneManager3D && Math.abs(y - sceneManager3D.floorY) <= radius + 3.5) {
      sceneManager3D.damageFloorAt(x, radius * 0.85, damage * 0.78, this);
    }

    // Apply Knockback to Nearby Characters
    if (activeCharacters && activeCharacters.length > 0) {
      for (const ch of activeCharacters) {
        if (!ch || !ch.group || ch.state === 'FREEFALL') continue;
        const dx = ch.group.position.x - x;
        const dy = (ch.group.position.y + 3.5) - y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius * 1.15) {
          const dir = dx >= 0 ? 1 : -1;
          const scale = Math.max(0.2, 1 - dist / (radius * 1.15));
          if (typeof ch.applyKnockback === 'function') {
            ch.applyKnockback(dir * 16 * scale, 9 * scale);
          }
        }
      }
    }

    // Push existing debris away
    for (const d of this.debris3D) {
      if (!d.mesh) continue;
      const dx = d.mesh.position.x - x;
      const dy = d.mesh.position.y - y;
      const dz = d.mesh.position.z - z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < radius * 1.4 && dist > 0.5) {
        const force = (1 - dist / (radius * 1.4)) * 35;
        d.vx += (dx / dist) * force;
        d.vy += (dy / dist) * force + 10;
        d.vz += (dz / dist) * force;
        d.isSettled = false;
      }
    }
  }

  // --- MAIN UPDATE LOOP ---
  update(dt, mouse3D, sceneryProps, floorY = 0, sceneManager3D = null, activeCharacters = []) {
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 1.8 * dt);
    }

    // 0. Update Expanding Shockwave Rings
    for (let i = this.shockwaves3D.length - 1; i >= 0; i--) {
      const sw = this.shockwaves3D[i];
      sw.life -= dt;
      const progress = 1.0 - Math.max(0, sw.life / sw.maxLife);
      const currentScale = 1.0 + progress * sw.maxRadius;
      sw.mesh.scale.set(currentScale, currentScale, 1);
      sw.mesh.material.opacity = Math.max(0, (1.0 - progress) * 0.85);

      if (sw.life <= 0) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        sw.mesh.material.dispose();
        this.shockwaves3D.splice(i, 1);
      }
    }

    // 1. Update & Auto-Dispose Debris Chunks
    for (let i = this.debris3D.length - 1; i >= 0; i--) {
      const chunk = this.debris3D[i];
      const alive = chunk.update(dt, floorY);

      if (!alive) {
        this.debris3D.splice(i, 1);
        continue;
      }

      // If hurled by Cursor Singularity Vortex, shatter props/slabs on impact!
      if (chunk.thrownByCursor && chunk.mesh) {
        for (const prop of sceneryProps) {
          if (prop.isAlive() && prop.contains3D(chunk.mesh.position.x, chunk.mesh.position.y, chunk.mesh.position.z)) {
            prop.takeDamage(65, chunk.mesh.position, this);
            this.spawnSparks3D(chunk.mesh.position.x, chunk.mesh.position.y, chunk.mesh.position.z, 18, 0xc084fc);
            chunk.thrownByCursor = false;
            break;
          }
        }
        if (chunk.mesh.position.y <= floorY + chunk.radius + 0.6) {
          chunk.thrownByCursor = false;
          if (sceneManager3D) {
            sceneManager3D.damageFloorAt(chunk.mesh.position.x, 5.5, 55, this);
          }
          this.spawnSparks3D(chunk.mesh.position.x, floorY + 0.2, chunk.mesh.position.z, 14, 0xc084fc);
        }
      }

      // Check collision with mouse shield if thrown by robot
      if (chunk.thrownByRobot && mouse3D.active) {
        const dist = Math.hypot(
          chunk.mesh.position.x - mouse3D.worldX,
          chunk.mesh.position.y - mouse3D.worldY,
          chunk.mesh.position.z - mouse3D.worldZ
        );
        if (dist < chunk.radius + 2.2) {
          window.soundEngine.playShieldDeflect();
          this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 25, 0xf59e0b);
          mouse3D.triggerDeflection();
          this.stats.deflections++;

          chunk.vx = -chunk.vx * 0.8 + (Math.random() - 0.5) * 12;
          chunk.vy = 14;
          chunk.vz = -chunk.vz * 0.8 + (Math.random() - 0.5) * 12;
          chunk.thrownByRobot = false;
          chunk.thrownByCursor = true;
          this.addTrauma(0.25);
        }
      }
    }

    // 2. Update 3D Sparks & Particles
    for (let i = this.particles3D.length - 1; i >= 0; i--) {
      const p = this.particles3D[i];
      p.life -= dt;
      const alpha = Math.max(0, p.life / p.maxLife);
      p.system.material.opacity = alpha;

      const positions = p.system.geometry.attributes.position.array;
      for (let j = 0; j < positions.length / 3; j++) {
        positions[j * 3 + 0] += p.velocities[j * 3 + 0] * dt;
        positions[j * 3 + 1] += p.velocities[j * 3 + 1] * dt;
        positions[j * 3 + 2] += p.velocities[j * 3 + 2] * dt;
        p.velocities[j * 3 + 1] -= 24 * dt;
      }
      p.system.geometry.attributes.position.needsUpdate = true;

      if (p.life <= 0) {
        this.scene.remove(p.system);
        p.system.geometry.dispose();
        p.system.material.dispose();
        this.particles3D.splice(i, 1);
      }
    }

    // 3. Update 3D Projectiles
    for (let i = this.projectiles3D.length - 1; i >= 0; i--) {
      const p = this.projectiles3D[i];
      let remove = false;

      // Check collision against characters if projectile was PARRIED by the user!
      if (p.parried && p.mesh && activeCharacters.length > 0) {
        for (const ch of activeCharacters) {
          if (!ch || !ch.group || ch.state === 'FREEFALL') continue;
          const dx = p.mesh.position.x - ch.group.position.x;
          const dy = p.mesh.position.y - (ch.group.position.y + 3.6);
          if (Math.hypot(dx, dy) < 2.8) {
            window.soundEngine.playHeavyExplosion(0.95);
            this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 32, 0x38bdf8);
            this.spawnShockwaveRing3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 7.5, 0x38bdf8);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 11, 110, sceneryProps, sceneManager3D, activeCharacters);
            if (typeof ch.applyKnockback === 'function') {
              ch.applyKnockback(Math.sign(p.vx || 1) * 22, 12, "DIRECT PARRY HIT!");
            }
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        if (p.mesh) {
          this.scene.remove(p.mesh);
          if (p.mesh.geometry) p.mesh.geometry.dispose();
          if (p.mesh.material) p.mesh.material.dispose();
        }
        this.projectiles3D.splice(i, 1);
        continue;
      }

      switch (p.type) {
        case 'bullet':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.life -= dt;

          if (!p.parried && mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY, p.mesh.position.z - mouse3D.worldZ) < 2.2) {
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 12, 0x60a5fa);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.mesh.position.y <= floorY || p.life <= 0) {
            this.spawnSparks3D(p.mesh.position.x, Math.max(floorY, p.mesh.position.y), p.mesh.position.z, 6, 0xeab308);
            if (p.mesh.position.y <= floorY && sceneManager3D) {
              sceneManager3D.damageFloorAt(p.mesh.position.x, 3.0, p.parried ? 45 : 14, this);
            }
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.contains3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
                prop.takeDamage(p.damage || 20, p.mesh.position, this);
                this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 8, 0xf97316);
                remove = true;
                break;
              }
            }
          }
          break;

        case 'rocket':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;

          if (!p.parried && mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 3.2) {
            window.soundEngine.playHeavyExplosion(1.0);
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 35, 0xf97316);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            this.addTrauma(0.5);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, 90, sceneryProps, sceneManager3D, activeCharacters);
            remove = true;
          } else if (p.mesh.position.y <= floorY || Math.abs(p.mesh.position.x) > 60) {
            window.soundEngine.playHeavyExplosion(1.0);
            this.spawnSparks3D(p.mesh.position.x, floorY, p.mesh.position.z, 30, 0xf97316);
            this.spawnShockwaveRing3D(p.mesh.position.x, floorY + 0.2, p.mesh.position.z, 10.0, 0xf97316, true);
            this.addTrauma(0.45);
            this.blastRadius3D(p.mesh.position.x, floorY, p.mesh.position.z, 14, p.parried ? 160 : 95, sceneryProps, sceneManager3D, activeCharacters);
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.contains3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
                window.soundEngine.playHeavyExplosion(1.0);
                this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 30, 0xf97316);
                this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, p.parried ? 160 : 95, sceneryProps, sceneManager3D, activeCharacters);
                remove = true;
                break;
              }
            }
          }
          break;

        case 'grenade':
          p.vy -= 26 * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.timer -= dt;

          if (p.mesh.position.y <= floorY + 0.5) {
            p.mesh.position.y = floorY + 0.5;
            p.vy = -p.vy * 0.55;
            p.vx *= 0.75;
          }

          if (p.timer <= 0 || (p.parried && p.mesh.position.y <= floorY + 0.8)) {
            window.soundEngine.playHeavyExplosion(1.1);
            this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 35, 0xea580c);
            this.spawnShockwaveRing3D(p.mesh.position.x, floorY + 0.2, p.mesh.position.z, 11.0, 0xea580c, true);
            this.addTrauma(0.5);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 14, p.parried ? 170 : 110, sceneryProps, sceneManager3D, activeCharacters);
            remove = true;
          }
          break;

        case 'magic_missile': {
          if (!p.parried) {
            const targetX = mouse3D.active ? mouse3D.worldX : p.targetX;
            const targetY = mouse3D.active ? mouse3D.worldY : p.targetY;
            const targetZ = mouse3D.active ? mouse3D.worldZ : (p.targetZ || 0);

            const tdx = targetX - p.mesh.position.x;
            const tdy = targetY - p.mesh.position.y;
            const tdz = targetZ - p.mesh.position.z;
            const tdist = Math.hypot(tdx, tdy, tdz) || 1;

            p.vx += (tdx / tdist) * 90 * dt;
            p.vy += (tdy / tdist) * 90 * dt;
            p.vz += (tdz / tdist) * 90 * dt;

            const spd = Math.hypot(p.vx, p.vy, p.vz);
            if (spd > p.speed) {
              p.vx = (p.vx / spd) * p.speed;
              p.vy = (p.vy / spd) * p.speed;
              p.vz = (p.vz / spd) * p.speed;
            }

            if (mouse3D.active && tdist < 2.5) {
              window.soundEngine.playShieldDeflect();
              this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 20, 0xc084fc);
              mouse3D.triggerDeflection();
              this.stats.deflections++;
              remove = true;
            }
          }

          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.life -= dt;

          if (p.mesh.position.y <= floorY || p.life <= 0) {
            this.spawnSparks3D(p.mesh.position.x, Math.max(floorY, p.mesh.position.y), p.mesh.position.z, 14, 0xc084fc);
            if (p.mesh.position.y <= floorY && sceneManager3D) {
              sceneManager3D.damageFloorAt(p.mesh.position.x, 5.0, p.parried ? 75 : 28, this);
            }
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.contains3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
                prop.takeDamage(p.parried ? 70 : 28, p.mesh.position, this);
                this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, 0xc084fc);
                remove = true;
                break;
              }
            }
          }
          break;
        }

        case 'meteor':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.rotation.x += 2.0 * dt;

          if (!p.parried && mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < p.radius + 2.0) {
            window.soundEngine.playHeavyExplosion(1.3);
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 45, 0xef4444);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            this.addTrauma(0.65);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 16, 140, sceneryProps, sceneManager3D, activeCharacters);
            remove = true;
          } else if (p.mesh.position.y <= floorY + 1.0) {
            window.soundEngine.playHeavyExplosion(1.3);
            this.spawnSparks3D(p.mesh.position.x, floorY, p.mesh.position.z, 40, 0xf97316);
            this.spawnShockwaveRing3D(p.mesh.position.x, floorY + 0.2, p.mesh.position.z, 13.0, 0xf97316, true);
            this.addTrauma(0.6);
            this.blastRadius3D(p.mesh.position.x, floorY, p.mesh.position.z, 16, p.parried ? 220 : 140, sceneryProps, sceneManager3D, activeCharacters);
            remove = true;
          }
          break;

        case 'javelin':
          if (!p.stuck) {
            p.vy -= 26 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;

            if (!p.parried && mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 2.5) {
              window.soundEngine.playArmorClang();
              window.soundEngine.playShieldDeflect();
              this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 16, 0xf8fafc);
              mouse3D.triggerDeflection();
              this.stats.deflections++;
              p.vx = -p.vx * 0.4;
              p.vy = 8;
            } else if (p.mesh.position.y <= floorY + 0.2) {
              p.mesh.position.y = floorY + 0.2;
              p.stuck = true;
              p.decayTimer = 3.0;
              if (sceneManager3D) {
                sceneManager3D.damageFloorAt(p.mesh.position.x, 4.0, p.parried ? 80 : 32, this);
              }
            } else {
              for (const prop of sceneryProps) {
                if (prop.isAlive() && prop.contains3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
                  prop.takeDamage(p.parried ? 85 : 35, p.mesh.position, this);
                  this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 10, 0xf8fafc);
                  remove = true;
                  break;
                }
              }
            }
          } else {
            p.decayTimer -= dt;
            if (p.decayTimer <= 0) remove = true;
          }
          break;

        case 'sword_wave':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.life -= dt;

          if (!p.parried && mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 3.0) {
            window.soundEngine.playArmorClang();
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 15, 0x38bdf8);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.mesh.position.y <= floorY || p.life <= 0) {
            if (p.mesh.position.y <= floorY && sceneManager3D) {
              sceneManager3D.damageFloorAt(p.mesh.position.x, 5.5, p.parried ? 85 : 35, this);
            }
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.contains3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z)) {
                prop.takeDamage(p.parried ? 90 : 40, p.mesh.position, this);
                this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, 0x38bdf8);
                remove = true;
                break;
              }
            }
          }
          break;
      }

      if (remove) {
        if (p.mesh) {
          this.scene.remove(p.mesh);
          if (p.mesh.geometry) p.mesh.geometry.dispose();
          if (p.mesh.material) p.mesh.material.dispose();
        }
        this.projectiles3D.splice(i, 1);
      }
    }
  }

  clearAllDebris() {
    for (const d of this.debris3D) {
      d.dispose();
    }
    this.debris3D = [];
  }

  accelerateDebrisDissolve() {
    for (const d of this.debris3D) {
      d.life = Math.min(d.life, 0.45);
      d.fadeDuration = Math.min(d.fadeDuration, 0.45);
    }
  }
}

window.PhysicsWorld3D = PhysicsWorld3D;
