// Physics, Particle, Debris, and Projectile Simulation Engine

class PhysicsWorld {
  constructor() {
    this.gravity = 1100; // px / s^2
    this.floorY = window.innerHeight - 80;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.debris = [];
    this.projectiles = [];
    this.particles = [];
    this.decals = [];
    this.floatingTexts = [];
    this.screenShake = 0; // Trauma: 0.0 to 1.0

    // Stats
    this.stats = {
      deflections: 0,
      shotsFired: 0,
      debrisCount: 0,
    };
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.floorY = h - 85;
  }

  addTrauma(amount) {
    this.screenShake = Math.min(1.0, this.screenShake + amount);
  }

  getShakeOffset() {
    if (this.screenShake <= 0.001) return { x: 0, y: 0, angle: 0 };
    const power = this.screenShake * this.screenShake; // Quadratic falloff
    const maxOffset = 22 * power;
    const maxAngle = 0.04 * power;
    return {
      x: (Math.random() * 2 - 1) * maxOffset,
      y: (Math.random() * 2 - 1) * maxOffset,
      angle: (Math.random() * 2 - 1) * maxAngle
    };
  }

  // --- FLOATING COMBAT TEXT ---
  spawnFloatingText(x, y, text, color = '#60a5fa') {
    this.floatingTexts.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 60,
      vy: -90 - Math.random() * 50,
      text,
      color,
      alpha: 1.0,
      life: 0.75,
      maxLife: 0.75
    });
  }

  // --- PARTICLES ---
  spawnExplosionParticles(x, y, count = 28, baseColor = '#f97316', speed = 350) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.2 + Math.random() * 0.8) * speed;
      const size = 3 + Math.random() * 7;
      const isSmoke = Math.random() > 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - (isSmoke ? 80 : 0),
        size,
        color: isSmoke ? '#4b5563' : (Math.random() > 0.4 ? baseColor : '#fbbf24'),
        alpha: 1.0,
        drag: isSmoke ? 0.94 : 0.97,
        gravity: isSmoke ? -40 : 500,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.4 + Math.random() * 0.5,
      });
    }
  }

  spawnSparks(x, y, dirAngle = null, count = 14, color = '#38bdf8') {
    for (let i = 0; i < count; i++) {
      const angle = dirAngle !== null ? dirAngle + (Math.random() - 0.5) * 1.8 : Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 320;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        drag: 0.92,
        gravity: 400,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.25 + Math.random() * 0.35,
      });
    }
  }

  spawnCasing(x, y, dirX) {
    // Ejected bullet casing
    this.particles.push({
      x,
      y,
      vx: -dirX * (60 + Math.random() * 60) + (Math.random() - 0.5) * 30,
      vy: -150 - Math.random() * 80,
      size: 3,
      length: 6,
      angle: Math.random() * Math.PI * 2,
      vAng: (Math.random() - 0.5) * 20,
      color: '#eab308',
      alpha: 1.0,
      drag: 0.99,
      gravity: 980,
      isCasing: true,
      life: 3.0,
      maxLife: 3.0,
    });
  }

  // --- BLAST CRATERS & DECALS ---
  addDecal(x, y, radius = 28) {
    this.decals.push({
      x,
      y: Math.min(y, this.floorY + 5),
      radius,
      alpha: 0.8,
      color: '#090a0f'
    });
    if (this.decals.length > 70) {
      this.decals.shift();
    }
  }

  // --- FRACTURED DEBRIS ---
  createDebrisFromBox(x, y, w, h, baseColor, numPieces = 6, blastOrigin = null, blastForce = 450) {
    const chunkW = w / Math.ceil(Math.sqrt(numPieces));
    const chunkH = h / Math.ceil(Math.sqrt(numPieces));

    for (let px = x - w / 2; px < x + w / 2; px += chunkW) {
      for (let py = y - h / 2; py < y + h / 2; py += chunkH) {
        const cx = px + chunkW * 0.5;
        const cy = py + chunkH * 0.5;

        let vx = (Math.random() - 0.5) * 140;
        let vy = -120 - Math.random() * 220;

        if (blastOrigin) {
          const dx = cx - blastOrigin.x;
          const dy = cy - blastOrigin.y;
          const dist = Math.hypot(dx, dy) || 1;
          const force = (blastForce / Math.max(40, dist)) * (0.8 + Math.random() * 0.6);
          vx += (dx / dist) * force * 15;
          vy += (dy / dist) * force * 15 - 120;
        }

        // Polygonal irregular shape
        const pts = [];
        const rad = Math.min(chunkW, chunkH) * (0.4 + Math.random() * 0.4);
        const sides = 4 + Math.floor(Math.random() * 3);
        for (let s = 0; s < sides; s++) {
          const a = (s / sides) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
          const r = rad * (0.7 + Math.random() * 0.6);
          pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }

        this.debris.push({
          x: cx,
          y: cy,
          vx,
          vy,
          angle: Math.random() * Math.PI * 2,
          vAng: (Math.random() - 0.5) * 12,
          points: pts,
          radius: rad,
          color: baseColor,
          darkColor: this.shadeColor(baseColor, -25),
          isSettled: false,
          settleTimer: 0,
          heldByRobot: false,
          thrownByRobot: false
        });
        this.stats.debrisCount++;
      }
    }
  }

  shadeColor(color, percent) {
    if (color.startsWith('#')) {
      let num = parseInt(color.slice(1), 16);
      if (color.length === 4) {
        num = parseInt(color[1] + color[1] + color[2] + color[2] + color[3] + color[3], 16);
      }
      let amt = Math.round(2.55 * percent);
      let R = (num >> 16) + amt;
      let B = ((num >> 8) & 0x00FF) + amt;
      let G = (num & 0x0000FF) + amt;
      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    }
    return color;
  }

  // --- PROJECTILES ---
  addProjectile(proj) {
    this.projectiles.push(proj);
    this.stats.shotsFired++;
  }

  // --- UPDATE LOOP ---
  update(dt, mouse, sceneryProps) {
    // 1. Shake Trauma Decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 1.8 * dt);
    }

    // 2. Update Floating Combat Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 3. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;

      if (p.isCasing) {
        p.angle += p.vAng * dt;
        if (p.y >= this.floorY) {
          p.y = this.floorY;
          p.vy = -p.vy * 0.4;
          p.vx *= 0.6;
          p.vAng *= 0.5;
        }
      }

      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 4. Update Debris Chunks (Physics with floor bouncing and prop deflection)
    const maxDebris = 180;
    if (this.debris.length > maxDebris) {
      this.debris.splice(0, this.debris.length - maxDebris);
    }

    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      if (d.heldByRobot) continue;

      if (!d.isSettled) {
        d.vy += this.gravity * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.angle += d.vAng * dt;

        d.vx *= 0.992;
        d.vAng *= 0.985;

        // Floor collision
        if (d.y + d.radius >= this.floorY) {
          d.y = this.floorY - d.radius;
          d.vy = -d.vy * 0.35; // Restitution
          d.vx *= 0.75; // Floor friction
          d.vAng *= 0.7;

          // Check for settling
          if (Math.abs(d.vy) < 35 && Math.abs(d.vx) < 25) {
            d.settleTimer += dt;
            if (d.settleTimer > 0.25) {
              d.isSettled = true;
              d.vy = 0;
              d.vx = 0;
            }
          }
        }

        // Walls
        if (d.x - d.radius < 0) {
          d.x = d.radius;
          d.vx = -d.vx * 0.5;
        } else if (d.x + d.radius > this.width) {
          d.x = this.width - d.radius;
          d.vx = -d.vx * 0.5;
        }

        // Check collision with mouse if thrown by robot
        if (d.thrownByRobot && mouse.active) {
          const mDist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
          if (mDist < d.radius + 24) {
            // Invincible cursor deflection!
            window.soundEngine.playShieldDeflect();
            this.spawnSparks(mouse.x, mouse.y, null, 18, '#fbbf24');
            this.spawnFloatingText(mouse.x, mouse.y - 15, 'CRUSH DEFLECTED!', '#f59e0b');
            mouse.triggerDeflection();
            this.stats.deflections++;

            // Ricochet the debris chunk backwards
            d.vx = -d.vx * 0.8 + (Math.random() - 0.5) * 200;
            d.vy = -Math.abs(d.vy) * 0.9 - 180;
            d.thrownByRobot = false;
            this.addTrauma(0.2);
          }
        }
      }
    }

    // 5. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      let remove = false;

      // Handle specific projectile behaviors
      switch (p.type) {
        case 'bullet':
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;

          // Check mouse collision (Invincible deflection)
          if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 22) {
            window.soundEngine.playShieldDeflect();
            this.spawnSparks(p.x, p.y, Math.atan2(-p.vy, -p.vx), 8, '#60a5fa');
            this.spawnFloatingText(mouse.x, mouse.y - 10, '0 DMG', '#93c5fd');
            mouse.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.y >= this.floorY || p.x < 0 || p.x > this.width || p.life <= 0) {
            // Ground/wall hit
            this.spawnSparks(p.x, Math.min(p.y, this.floorY), null, 6, '#eab308');
            remove = true;
          }

          // Scenery collision
          if (!remove) {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.containsPoint(p.x, p.y)) {
                prop.takeDamage(p.damage || 20, { x: p.x, y: p.y }, this);
                this.spawnSparks(p.x, p.y, null, 7, '#f97316');
                remove = true;
                break;
              }
            }
          }
          break;

        case 'rocket':
          // Accelerate rocket
          const rSpd = Math.hypot(p.vx, p.vy);
          p.vx += (p.vx / rSpd) * 800 * dt;
          p.vy += (p.vy / rSpd) * 800 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle = Math.atan2(p.vy, p.vx);

          // Smoke trail
          if (Math.random() > 0.3) {
            this.particles.push({
              x: p.x - Math.cos(p.angle) * 16,
              y: p.y - Math.sin(p.angle) * 16,
              vx: (Math.random() - 0.5) * 40,
              vy: (Math.random() - 0.5) * 40,
              size: 4 + Math.random() * 5,
              color: '#9ca3af',
              alpha: 0.8,
              drag: 0.9,
              gravity: -20,
              life: 0.4,
              maxLife: 0.4
            });
          }

          // Check mouse collision
          if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 32) {
            window.soundEngine.playHeavyExplosion(1.0);
            window.soundEngine.playShieldDeflect();
            this.spawnExplosionParticles(p.x, p.y, 40, '#f97316', 450);
            this.spawnFloatingText(mouse.x, mouse.y - 20, 'IMMUNE!', '#38bdf8');
            this.addDecal(p.x, p.y, 35);
            this.addTrauma(0.45);
            mouse.triggerDeflection();
            this.stats.deflections++;
            this.blastRadius(p.x, p.y, 110, 80, sceneryProps);
            remove = true;
          } else if (p.y >= this.floorY || p.x < 0 || p.x > this.width || p.y < -50) {
            window.soundEngine.playHeavyExplosion(1.0);
            this.spawnExplosionParticles(p.x, Math.min(p.y, this.floorY), 38, '#f97316', 400);
            this.addDecal(p.x, p.y, 40);
            this.addTrauma(0.4);
            this.blastRadius(p.x, p.y, 120, 90, sceneryProps);
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.containsPoint(p.x, p.y)) {
                window.soundEngine.playHeavyExplosion(1.0);
                this.spawnExplosionParticles(p.x, p.y, 38, '#f97316', 420);
                this.addDecal(p.x, p.y, 40);
                this.addTrauma(0.45);
                this.blastRadius(p.x, p.y, 130, 100, sceneryProps);
                remove = true;
                break;
              }
            }
          }
          break;

        case 'grenade':
          p.vy += this.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.vAng * dt;
          p.timer -= dt;

          // Floor bounce
          if (p.y >= this.floorY - 8) {
            p.y = this.floorY - 8;
            p.vy = -p.vy * 0.55;
            p.vx *= 0.75;
            p.vAng *= 0.7;
          }

          // Wall bounce
          if (p.x < 10 || p.x > this.width - 10) {
            p.vx = -p.vx * 0.6;
          }

          // Direct mouse contact or timer expiry
          const mDistG = mouse.active ? Math.hypot(p.x - mouse.x, p.y - mouse.y) : 999;
          if (p.timer <= 0 || mDistG < 22) {
            window.soundEngine.playHeavyExplosion(1.1);
            this.spawnExplosionParticles(p.x, p.y, 45, '#ea580c', 480);
            this.addDecal(p.x, p.y, 45);
            this.addTrauma(0.5);
            if (mDistG < 45 && mouse.active) {
              window.soundEngine.playShieldDeflect();
              this.spawnFloatingText(mouse.x, mouse.y - 18, 'ABSORBED!', '#38bdf8');
              mouse.triggerDeflection();
              this.stats.deflections++;
            }
            this.blastRadius(p.x, p.y, 140, 110, sceneryProps);
            remove = true;
          }
          break;

        case 'magic_missile':
          // Swirling homing trajectory towards mouse or last known position
          const targetX = mouse.active ? mouse.x : p.targetX;
          const targetY = mouse.active ? mouse.y : p.targetY;
          const tdx = targetX - p.x;
          const tdy = targetY - p.y;
          const angleToTgt = Math.atan2(tdy, tdx);

          // Steer towards target
          let curAngle = Math.atan2(p.vy, p.vx);
          let diffAngle = angleToTgt - curAngle;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          curAngle += diffAngle * Math.min(1.0, 9.0 * dt);

          p.speed = Math.min(650, p.speed + 200 * dt);
          p.vx = Math.cos(curAngle) * p.speed;
          p.vy = Math.sin(curAngle) * p.speed;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;

          // Spark trail
          if (Math.random() > 0.4) {
            this.particles.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              size: 3 + Math.random() * 4,
              color: p.color || '#a855f7',
              alpha: 0.9,
              drag: 0.92,
              gravity: 0,
              life: 0.35,
              maxLife: 0.35
            });
          }

          if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 26) {
            window.soundEngine.playShieldDeflect();
            window.soundEngine.playMagicMissile();
            this.spawnSparks(p.x, p.y, null, 16, '#c084fc');
            this.spawnFloatingText(mouse.x, mouse.y - 12, 'HEX NULLIFIED', '#c084fc');
            mouse.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.y >= this.floorY || p.life <= 0) {
            this.spawnSparks(p.x, p.y, null, 12, '#a855f7');
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.containsPoint(p.x, p.y)) {
                prop.takeDamage(35, { x: p.x, y: p.y }, this);
                this.spawnSparks(p.x, p.y, null, 14, '#c084fc');
                remove = true;
                break;
              }
            }
          }
          break;

        case 'meteor':
          p.vy += 450 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += 3.5 * dt;

          // Fiery tail
          for (let k = 0; k < 2; k++) {
            this.particles.push({
              x: p.x + (Math.random() - 0.5) * 20,
              y: p.y + (Math.random() - 0.5) * 20,
              vx: -p.vx * 0.2 + (Math.random() - 0.5) * 80,
              vy: -p.vy * 0.2 + (Math.random() - 0.5) * 80,
              size: 6 + Math.random() * 8,
              color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
              alpha: 0.9,
              drag: 0.94,
              gravity: -50,
              life: 0.45,
              maxLife: 0.45
            });
          }

          if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < p.radius + 20) {
            window.soundEngine.playHeavyExplosion(1.2);
            window.soundEngine.playShieldDeflect();
            this.spawnExplosionParticles(p.x, p.y, 50, '#ef4444', 500);
            this.spawnFloatingText(mouse.x, mouse.y - 25, 'TITANIC DEFLECT!', '#ef4444');
            this.addDecal(p.x, p.y, 50);
            this.addTrauma(0.65);
            mouse.triggerDeflection();
            this.stats.deflections++;
            this.blastRadius(p.x, p.y, 160, 140, sceneryProps);
            remove = true;
          } else if (p.y >= this.floorY - 15) {
            window.soundEngine.playHeavyExplosion(1.2);
            this.spawnExplosionParticles(p.x, this.floorY, 50, '#f97316', 500);
            this.addDecal(p.x, this.floorY, 50);
            this.addTrauma(0.6);
            this.blastRadius(p.x, this.floorY, 170, 140, sceneryProps);
            remove = true;
          }
          break;

        case 'javelin':
          if (!p.stuck) {
            p.vy += this.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.angle = Math.atan2(p.vy, p.vx);

            // Check mouse contact
            if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 25) {
              window.soundEngine.playArmorClang();
              window.soundEngine.playShieldDeflect();
              this.spawnSparks(mouse.x, mouse.y, null, 14, '#f8fafc');
              this.spawnFloatingText(mouse.x, mouse.y - 15, 'PARRIED!', '#f8fafc');
              mouse.triggerDeflection();
              this.stats.deflections++;

              // Javelin deflects and spins into ground
              p.vx = -p.vx * 0.4 + (Math.random() - 0.5) * 120;
              p.vy = -120;
            } else if (p.y >= this.floorY) {
              // Stick in ground
              p.y = this.floorY;
              p.stuck = true;
              p.vx = 0;
              p.vy = 0;
              p.decayTimer = 4.0;
              this.spawnSparks(p.x, this.floorY, null, 6, '#cbd5e1');
            } else {
              for (const prop of sceneryProps) {
                if (prop.isAlive() && prop.containsPoint(p.x, p.y)) {
                  prop.takeDamage(60, { x: p.x, y: p.y }, this);
                  this.spawnSparks(p.x, p.y, null, 10, '#cbd5e1');
                  p.stuck = true;
                  p.vx = 0;
                  p.vy = 0;
                  p.decayTimer = 3.0;
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
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          p.alpha = Math.max(0, p.life / p.maxLife);

          if (mouse.active && Math.hypot(p.x - mouse.x, p.y - mouse.y) < 32) {
            window.soundEngine.playArmorClang();
            window.soundEngine.playShieldDeflect();
            this.spawnSparks(mouse.x, mouse.y, null, 12, '#38bdf8');
            this.spawnFloatingText(mouse.x, mouse.y - 12, 'EDGE BROKEN', '#e2e8f0');
            mouse.triggerDeflection();
            this.stats.deflections++;
            remove = true;
          } else if (p.life <= 0) {
            remove = true;
          } else {
            for (const prop of sceneryProps) {
              if (prop.isAlive() && prop.containsPoint(p.x, p.y)) {
                prop.takeDamage(45, { x: p.x, y: p.y }, this);
                this.spawnSparks(p.x, p.y, null, 8, '#f1f5f9');
                remove = true;
                break;
              }
            }
          }
          break;
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  // --- BLAST RADIUS PROP DAMAGE & CHUNK LAUNCH ---
  blastRadius(x, y, radius, damage, sceneryProps) {
    // Damage props
    for (const prop of sceneryProps) {
      if (prop.isAlive()) {
        const dx = prop.x - x;
        const dy = prop.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius + prop.radius) {
          const falloff = 1 - (dist / (radius + prop.radius));
          prop.takeDamage(damage * Math.max(0.3, falloff), { x, y }, this);
        }
      }
    }

    // Push existing debris
    for (const d of this.debris) {
      const dx = d.x - x;
      const dy = d.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius * 1.3 && dist > 1) {
        const pwr = (1 - dist / (radius * 1.3)) * 600;
        d.vx += (dx / dist) * pwr;
        d.vy += (dy / dist) * pwr - 180;
        d.vAng += (Math.random() - 0.5) * 15;
        d.isSettled = false;
        d.settleTimer = 0;
      }
    }
  }

  // --- RENDER ALL PHYSICS BODIES ---
  render(ctx) {
    // 1. Draw Decals
    ctx.save();
    for (const d of this.decals) {
      ctx.fillStyle = d.color;
      ctx.globalAlpha = d.alpha * 0.7;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.radius, d.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw Debris
    for (const d of this.debris) {
      if (d.heldByRobot) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);

      ctx.fillStyle = d.color;
      ctx.strokeStyle = d.darkColor;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      for (let j = 0; j < d.points.length; j++) {
        const pt = d.points[j];
        if (j === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 3. Draw Projectiles
    for (const p of this.projectiles) {
      ctx.save();
      switch (p.type) {
        case 'bullet':
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
          ctx.stroke();
          break;

        case 'rocket':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          // Rocket body
          ctx.fillStyle = '#475569';
          ctx.fillRect(-12, -3, 24, 6);
          // Warhead
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.moveTo(12, -3);
          ctx.lineTo(18, 0);
          ctx.lineTo(12, 3);
          ctx.closePath();
          ctx.fill();
          // Thruster glow
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-12, -2);
          ctx.lineTo(-18 - Math.random() * 8, 0);
          ctx.lineTo(-12, 2);
          ctx.closePath();
          ctx.fill();
          break;

        case 'grenade':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-2, -12, 4, 4);
          break;

        case 'magic_missile':
          ctx.translate(p.x, p.y);
          const mGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
          mGrad.addColorStop(0, '#ffffff');
          mGrad.addColorStop(0.4, p.color || '#a855f7');
          mGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'meteor':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          // Rock core
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
          ctx.fill();
          // Fiery aura
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 4;
          ctx.stroke();
          break;

        case 'javelin':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          // Shaft
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-28, 0);
          ctx.lineTo(24, 0);
          ctx.stroke();
          // Iron tip
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(24, -4);
          ctx.lineTo(34, 0);
          ctx.lineTo(24, 4);
          ctx.closePath();
          ctx.fill();
          break;

        case 'sword_wave':
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, 30, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.stroke();
          break;
      }
      ctx.restore();
    }

    // 4. Draw Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.isCasing) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.length / 2, -p.size / 2, p.length, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Draw Floating Combat Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 13px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

window.PhysicsWorld = PhysicsWorld;
