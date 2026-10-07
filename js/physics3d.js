// 3D Physics, Projectiles, Particle Engine, and Auto-Fading Debris Simulation

class PhysicsWorld3D {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.projectiles3D = [];
    this.debris3D = [];
    this.particles3D = [];
    this.screenShake = 0;

    this.stats = {
      deflections: 0,
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
    const maxOffset = 1.2 * power;
    const maxRot = 0.03 * power;
    return {
      x: (Math.random() * 2 - 1) * maxOffset,
      y: (Math.random() * 2 - 1) * maxOffset,
      z: (Math.random() * 2 - 1) * (maxOffset * 0.5),
      rotZ: (Math.random() * 2 - 1) * maxRot
    };
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

          // Add to debris list (Chunk auto-dissolves and disposes after 5 seconds)
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
      case 'bullet':
        const bGeom = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6);
        const bMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        mesh = new THREE.Mesh(bGeom, bMat);
        mesh.rotation.z = Math.PI / 2;
        break;

      case 'rocket':
        const rGeom = new THREE.ConeGeometry(0.5, 2.4, 8);
        const rMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 });
        mesh = new THREE.Mesh(rGeom, rMat);
        break;

      case 'grenade':
        const gGeom = new THREE.SphereGeometry(0.55, 12, 12);
        const gMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        mesh = new THREE.Mesh(gGeom, gMat);
        break;

      case 'magic_missile':
        const mGeom = new THREE.SphereGeometry(0.65, 12, 12);
        const mMat = new THREE.MeshStandardMaterial({
          color: proj.color || 0xc084fc,
          emissive: proj.color || 0xa855f7,
          emissiveIntensity: 0.9
        });
        mesh = new THREE.Mesh(mGeom, mMat);
        break;

      case 'meteor':
        const metGeom = new THREE.DodecahedronGeometry(proj.radius || 1.8);
        const metMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          emissive: 0xea580c,
          emissiveIntensity: 0.6,
          roughness: 0.9
        });
        mesh = new THREE.Mesh(metGeom, metMat);
        break;

      case 'javelin':
        const jGeom = new THREE.CylinderGeometry(0.1, 0.1, 4.5, 6);
        const jMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.5 });
        mesh = new THREE.Mesh(jGeom, jMat);
        break;

      case 'sword_wave':
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

    if (mesh) {
      mesh.position.set(proj.x, proj.y, proj.z || 0);
      this.scene.add(mesh);
      proj.mesh = mesh;
    }

    this.projectiles3D.push(proj);
  }

  // --- BLAST RADIUS 3D ---
  blastRadius3D(x, y, z, radius, damage, sceneryProps) {
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

    // Push existing debris away
    for (const d of this.debris3D) {
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
  update(dt, mouse3D, sceneryProps, floorY = 0) {
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 1.8 * dt);
    }

    // 1. Update & Auto-Dispose Debris Chunks
    for (let i = this.debris3D.length - 1; i >= 0; i--) {
      const chunk = this.debris3D[i];
      const alive = chunk.update(dt, floorY);

      if (!alive) {
        this.debris3D.splice(i, 1);
        continue;
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

          // Ricochet backwards in 3D
          chunk.vx = -chunk.vx * 0.8 + (Math.random() - 0.5) * 12;
          chunk.vy = 14;
          chunk.vz = -chunk.vz * 0.8 + (Math.random() - 0.5) * 12;
          chunk.thrownByRobot = false;
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
        p.velocities[j * 3 + 1] -= 24 * dt; // Gravity
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

      switch (p.type) {
        case 'bullet':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.life -= dt;

          // Check mouse shield collision
          if (mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY, p.mesh.position.z - mouse3D.worldZ) < 2.2) {
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 12, 0x60a5fa);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.mesh.position.y <= floorY || p.life <= 0) {
            this.spawnSparks3D(p.mesh.position.x, Math.max(floorY, p.mesh.position.y), p.mesh.position.z, 6, 0xeab308);
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

          if (mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 3.2) {
            window.soundEngine.playHeavyExplosion(1.0);
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 35, 0xf97316);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            this.addTrauma(0.5);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, 90, sceneryProps);
            remove = true;
          } else if (p.mesh.position.y <= floorY || Math.abs(p.mesh.position.x) > 34) {
            window.soundEngine.playHeavyExplosion(1.0);
            this.spawnSparks3D(p.mesh.position.x, floorY, p.mesh.position.z, 30, 0xf97316);
            this.addTrauma(0.45);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 12, 90, sceneryProps);
            remove = true;
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

          if (p.timer <= 0) {
            window.soundEngine.playHeavyExplosion(1.1);
            this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 35, 0xea580c);
            this.addTrauma(0.5);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 14, 110, sceneryProps);
            remove = true;
          }
          break;

        case 'magic_missile':
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

          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.life -= dt;

          if (mouse3D.active && tdist < 2.5) {
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 20, 0xc084fc);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.mesh.position.y <= floorY || p.life <= 0) {
            this.spawnSparks3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 14, 0xc084fc);
            remove = true;
          }
          break;

        case 'meteor':
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.rotation.x += 2.0 * dt;

          if (mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < p.radius + 2.0) {
            window.soundEngine.playHeavyExplosion(1.3);
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 45, 0xef4444);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            this.addTrauma(0.65);
            this.blastRadius3D(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 16, 140, sceneryProps);
            remove = true;
          } else if (p.mesh.position.y <= floorY + 1.0) {
            window.soundEngine.playHeavyExplosion(1.3);
            this.spawnSparks3D(p.mesh.position.x, floorY, p.mesh.position.z, 40, 0xf97316);
            this.addTrauma(0.6);
            this.blastRadius3D(p.mesh.position.x, floorY, p.mesh.position.z, 16, 140, sceneryProps);
            remove = true;
          }
          break;

        case 'javelin':
          if (!p.stuck) {
            p.vy -= 26 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;

            if (mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 2.5) {
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
              p.decayTimer = 4.0;
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

          if (mouse3D.active && Math.hypot(p.mesh.position.x - mouse3D.worldX, p.mesh.position.y - mouse3D.worldY) < 3.0) {
            window.soundEngine.playArmorClang();
            window.soundEngine.playShieldDeflect();
            this.spawnSparks3D(mouse3D.worldX, mouse3D.worldY, mouse3D.worldZ, 15, 0x38bdf8);
            mouse3D.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.life <= 0) {
            remove = true;
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
}

window.PhysicsWorld3D = PhysicsWorld3D;
