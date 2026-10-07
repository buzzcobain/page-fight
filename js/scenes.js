// Realistic Destructible Scenery & Multi-Tier Destructible Floor Engine

class FloorSlab {
  constructor(index, x, y, w, h, theme) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.theme = theme;
    this.maxHp = 140;
    this.hp = this.maxHp;
    this.cracks = [];
    this.collapsed = false;
    this.fallVy = 0;
    this.fallAngle = 0;
    this.fallVAng = 0;
    this.fallY = y;
  }

  takeDamage(amount, hitPoint, physics) {
    if (this.collapsed) return;
    this.hp -= amount;

    if (hitPoint && this.cracks.length < 8) {
      this.cracks.push({
        x: hitPoint.x - (this.x - this.w / 2),
        y: hitPoint.y - this.y,
        len: 10 + Math.random() * 20,
        angle: Math.random() * Math.PI * 2
      });
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.collapse(physics);
    } else {
      physics.spawnSparks(hitPoint ? hitPoint.x : this.x, this.y, null, 4, '#94a3b8');
    }
  }

  collapse(physics) {
    if (this.collapsed) return;
    this.collapsed = true;
    window.soundEngine.playStoneCrush(1.4);
    physics.addTrauma(0.35);

    this.fallVy = 80 + Math.random() * 120;
    this.fallVAng = (Math.random() - 0.5) * 4;

    // Launch fragment chunks
    physics.createDebrisFromBox(this.x, this.y + this.h / 2, this.w, this.h, '#475569', 6, null, 350);
  }

  update(dt) {
    if (this.collapsed) {
      this.fallVy += 980 * dt;
      this.fallY += this.fallVy * dt;
      this.fallAngle += this.fallVAng * dt;
    }
  }

  render(ctx) {
    ctx.save();
    if (this.collapsed) {
      ctx.translate(this.x, this.fallY + this.h / 2);
      ctx.rotate(this.fallAngle);
      ctx.translate(-this.x, -(this.fallY + this.h / 2));
    }

    const left = this.x - this.w / 2;
    const top = this.collapsed ? this.fallY : this.y;
    const w = this.w;
    const h = this.h;

    // Realistic Floor Slab Texturing based on Theme
    if (this.theme === 'medieval' || this.theme === 'crypt') {
      // Weathered Stone Flagstone Paver
      const slabGrad = ctx.createLinearGradient(left, top, left, top + h);
      slabGrad.addColorStop(0, '#475569');
      slabGrad.addColorStop(0.2, '#334155');
      slabGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = slabGrad;
      ctx.fillRect(left, top, w, h);

      // Stone slab bevel highlight
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left + 1, top + 1, w - 2, h - 2);

      // Flagstone mortar grooves & stone grit
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, top + h);
      ctx.moveTo(left + w, top);
      ctx.lineTo(left + w, top + h);
      ctx.stroke();

      // Stone texture specks
      ctx.fillStyle = '#64748b';
      for (let s = 0; s < 4; s++) {
        ctx.fillRect(left + 10 + s * 18, top + 12 + (s % 2) * 14, 2, 2);
      }
    } else if (this.theme === 'cyber' || this.theme === 'foundry') {
      // Industrial Steel Treadplate with Hazard Border
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(left, top, w, h);

      // Metallic Top Rim
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(left, top, w, 2);

      // Hazard warning diagonal stripes
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top + 2, w, 8);
      ctx.clip();
      for (let str = left - 10; str < left + w + 20; str += 14) {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(str, top + 2);
        ctx.lineTo(str + 7, top + 2);
        ctx.lineTo(str, top + 10);
        ctx.lineTo(str - 7, top + 10);
        ctx.fill();
      }
      ctx.restore();

      // Steel floor rivets
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(left + 6, top + 16, 2, 0, Math.PI * 2);
      ctx.arc(left + w - 6, top + 16, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Parquet Oak Wood Planks
      ctx.fillStyle = '#78350f';
      ctx.fillRect(left, top, w, h);
      // Wood grain lines
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      for (let g = 0; g < h; g += 7) {
        ctx.beginPath();
        ctx.moveTo(left, top + g);
        ctx.lineTo(left + w, top + g);
        ctx.stroke();
      }
      // Top varnish reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(left, top, w, 3);
    }

    // Render Fractures & Cracks
    if (this.cracks.length > 0) {
      ctx.strokeStyle = '#05070a';
      ctx.lineWidth = 2.2;
      for (const c of this.cracks) {
        ctx.beginPath();
        const cx = left + c.x;
        const cy = top + c.y;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(c.angle) * c.len, cy + Math.sin(c.angle) * c.len);
        ctx.stroke();
      }
    }

    // Health bar if damaged but not collapsed
    if (!this.collapsed && this.hp < this.maxHp) {
      const barRatio = this.hp / this.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(left + 4, top + h - 6, w - 8, 3);
      ctx.fillStyle = barRatio > 0.4 ? '#eab308' : '#ef4444';
      ctx.fillRect(left + 4, top + h - 6, (w - 8) * barRatio, 3);
    }

    ctx.restore();
  }
}

class SceneryProp {
  constructor(options) {
    this.name = options.name;
    this.x = options.x;
    this.y = options.y;
    this.w = options.w;
    this.h = options.h;
    this.radius = Math.hypot(this.w, this.h) * 0.5;
    this.maxHp = options.hp || 120;
    this.hp = this.maxHp;
    this.type = options.type;
    this.color = options.color || '#64748b';
    this.accentColor = options.accentColor || '#475569';
    this.isHanging = options.isHanging || false;
    this.debrisPieces = options.debrisPieces || 10;
    this.cracks = [];
    this.isDestroyed = false;
    this.heldByRobot = false;
  }

  isAlive() {
    return this.hp > 0 && !this.isDestroyed && !this.heldByRobot;
  }

  containsPoint(px, py) {
    if (this.isDestroyed || this.heldByRobot) return false;
    return (
      px >= this.x - this.w / 2 &&
      px <= this.x + this.w / 2 &&
      py >= this.y - this.h &&
      py <= this.y
    );
  }

  takeDamage(amount, hitPoint, physics) {
    if (this.isDestroyed || this.heldByRobot) return;
    this.hp -= amount;

    if (hitPoint && this.cracks.length < 14) {
      this.cracks.push({
        x: hitPoint.x - (this.x - this.w / 2),
        y: hitPoint.y - (this.y - this.h),
        len: 12 + Math.random() * 22,
        angle: Math.random() * Math.PI * 2
      });
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.destroy(physics, hitPoint);
    } else {
      physics.spawnSparks(hitPoint ? hitPoint.x : this.x, hitPoint ? hitPoint.y : this.y - this.h / 2, null, 8, this.accentColor);
    }
  }

  destroy(physics, blastPoint = null) {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    window.soundEngine.playStoneCrush(1.4);
    physics.addTrauma(0.35);

    physics.createDebrisFromBox(
      this.x,
      this.y - this.h / 2,
      this.w,
      this.h,
      this.color,
      this.debrisPieces,
      blastPoint,
      450
    );
  }

  render(ctx) {
    if (this.isDestroyed || this.heldByRobot) return;

    ctx.save();
    const x = this.x;
    const y = this.y;
    const w = this.w;
    const h = this.h;
    const topY = y - h;
    const hpRatio = Math.max(0, this.hp / this.maxHp);

    // Realistic Prop Shading & Texturing
    switch (this.type) {
      case 'tower':
        // Fortress Watchtower with individual stone masonry courses
        const towerGrad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        towerGrad.addColorStop(0, '#1e293b');
        towerGrad.addColorStop(0.3, '#334155');
        towerGrad.addColorStop(0.8, '#475569');
        towerGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = towerGrad;
        ctx.fillRect(x - w / 2, topY, w, h);

        // Stone Brick Courses
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        const rowH = 18;
        for (let r = topY; r < y; r += rowH) {
          ctx.beginPath();
          ctx.moveTo(x - w / 2, r);
          ctx.lineTo(x + w / 2, r);
          ctx.stroke();

          // Staggered vertical mortar joints
          const offset = ((r / rowH) % 2) * 14;
          for (let brickX = x - w / 2 + offset; brickX < x + w / 2; brickX += 28) {
            ctx.beginPath();
            ctx.moveTo(brickX, r);
            ctx.lineTo(brickX, r + rowH);
            ctx.stroke();
          }
        }

        // Overhanging Stone Battlements
        ctx.fillStyle = '#475569';
        ctx.fillRect(x - w / 2 - 6, topY - 18, w + 12, 18);
        const crenelCount = 4;
        const cW = (w + 12) / (crenelCount * 2 - 1);
        for (let c = 0; c < crenelCount; c++) {
          ctx.fillRect(x - w / 2 - 6 + c * cW * 2, topY - 32, cW, 14);
        }

        // Archer Slit Windows with Torch Glow
        ctx.fillStyle = '#090d16';
        ctx.fillRect(x - 6, topY + 45, 12, 34);
        ctx.fillRect(x - 6, topY + 125, 12, 34);
        // Orange torchlight glow from inside window
        ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.fillRect(x - 4, topY + 50, 8, 20);
        break;

      case 'pillar':
        // Fluted Classical Marble Pillar with Shadows & Specular Highlight
        const colGrad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        colGrad.addColorStop(0, '#475569');
        colGrad.addColorStop(0.2, '#94a3b8');
        colGrad.addColorStop(0.5, '#cbd5e1');
        colGrad.addColorStop(0.8, '#64748b');
        colGrad.addColorStop(1, '#334155');

        // Capital & Plinth
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x - w / 2 - 8, topY, w + 16, 20);
        ctx.fillRect(x - w / 2 - 10, y - 18, w + 20, 18);

        // Shaft
        ctx.fillStyle = colGrad;
        ctx.fillRect(x - w / 2, topY + 20, w, h - 38);

        // Fluting Grooves with Shadow Pairs
        const flutes = 5;
        for (let f = 1; f < flutes; f++) {
          const fx = x - w / 2 + (w / flutes) * f;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(fx, topY + 20);
          ctx.lineTo(fx, y - 18);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.moveTo(fx + 1.5, topY + 20);
          ctx.lineTo(fx + 1.5, y - 18);
          ctx.stroke();
        }
        break;

      case 'arch':
        // Fortress Portcullis Arch
        ctx.fillStyle = '#334155';
        ctx.fillRect(x - w / 2, topY, 28, h);
        ctx.fillRect(x + w / 2 - 28, topY, 28, h);
        // Keystone Arch Top
        ctx.fillStyle = '#475569';
        ctx.fillRect(x - w / 2 - 4, topY, w + 8, 36);

        // Heavy Iron Portcullis Spikes
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        for (let bar = x - w / 2 + 36; bar < x + w / 2 - 28; bar += 18) {
          ctx.beginPath();
          ctx.moveTo(bar, topY + 36);
          ctx.lineTo(bar, y);
          ctx.stroke();
          // Pointed tip
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(bar - 4, y - 12);
          ctx.lineTo(bar, y);
          ctx.lineTo(bar + 4, y - 12);
          ctx.fill();
        }
        break;

      case 'server':
        // High-Tech Cyber Mainframe Tower
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(x - w / 2, topY, w, h);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2, topY, w, h);

        // Server Rack Units
        const units = Math.floor(h / 26);
        for (let u = 0; u < units; u++) {
          const uy = topY + 6 + u * 24;
          ctx.fillStyle = '#111827';
          ctx.fillRect(x - w / 2 + 4, uy, w - 8, 20);

          // Ventilation Grille
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1;
          for (let g = 0; g < 4; g++) {
            ctx.beginPath();
            ctx.moveTo(x - w / 2 + 8, uy + 4 + g * 3);
            ctx.lineTo(x + w / 2 - 28, uy + 4 + g * 3);
            ctx.stroke();
          }

          // Blinking Activity LEDs
          for (let l = 0; l < 3; l++) {
            const on = Math.sin(Date.now() * 0.006 + u * 2 + l) > -0.2;
            ctx.fillStyle = on ? (l === 0 ? '#38bdf8' : (l === 1 ? '#10b981' : '#f59e0b')) : '#064e3b';
            ctx.beginPath();
            ctx.arc(x + w / 2 - 18 + l * 6, uy + 10, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'terminal':
        // Holographic Console Station
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x - w / 2, y - 42, w, 42);
        // Angled holo projector base
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 24, y - 46, 48, 6);
        // Blue volumetric hologram projection
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 30, y - 46);
        ctx.lineTo(x - 36, topY);
        ctx.lineTo(x + 36, topY);
        ctx.lineTo(x + 30, y - 46);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Holo radar sine wave
        ctx.strokeStyle = '#7dd3fc';
        ctx.beginPath();
        for (let hx = x - 26; hx < x + 26; hx += 3) {
          const hy = topY + 22 + Math.sin(hx * 0.3 + Date.now() * 0.008) * 8;
          if (hx === x - 26) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.stroke();
        break;

      case 'bookshelf':
        // Rich Mahogany Bookshelf with Hundreds of Shaded Volumes
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x - w / 2, topY, w, h);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x - w / 2 + 3, topY + 3, w - 6, h - 6);

        // Shelves
        const sCount = 4;
        const sH = (h - 6) / sCount;
        const palette = ['#991b1b', '#1e3a8a', '#14532d', '#b45309', '#581c87', '#334155'];

        for (let s = 0; s < sCount; s++) {
          const sy = topY + 3 + (s + 1) * sH;
          // Wooden Shelf Lip
          ctx.fillStyle = '#291002';
          ctx.fillRect(x - w / 2 + 2, sy - 6, w - 4, 6);

          // Books on Shelf
          let curX = x - w / 2 + 6;
          let seed = s * 7;
          while (curX < x + w / 2 - 10) {
            const bW = 6 + (seed % 5) * 2;
            const bH = sH - 12 - (seed % 6);
            ctx.fillStyle = palette[seed % palette.length];
            ctx.fillRect(curX, sy - 6 - bH, bW, bH);
            // Gold Embossed Spine Foil
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(curX + 1, sy - 6 - bH + 3, bW - 2, 2);
            curX += bW + 2;
            seed++;
          }
        }
        break;

      case 'sofa':
        // Chesterfield Tufted Velvet Sofa
        ctx.fillStyle = '#7f1d1d';
        // Backrest with Tufting Dots
        ctx.fillRect(x - w / 2, topY, w, h);
        for (let tx = x - w / 2 + 12; tx < x + w / 2 - 6; tx += 18) {
          for (let ty = topY + 10; ty < y - 24; ty += 16) {
            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Rolled Armrests
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(x - w / 2 - 8, topY + 8, 14, h - 8);
        ctx.fillRect(x + w / 2 - 6, topY + 8, 14, h - 8);
        // Plush Cushions
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(x - w / 2 + 6, y - 22, w - 12, 18);
        break;

      case 'chandelier':
        // Hanging Crystal Chandelier
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, topY + 16);
        ctx.stroke();

        // Brass Frame
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(x, topY + 24, w / 2, 0, Math.PI);
        ctx.fill();

        // Candles with flickering flames
        for (let c = -3; c <= 3; c++) {
          const cx = x + c * 12;
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(cx - 2, topY + 10, 4, 14);
          // Flame
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.ellipse(cx, topY + 6 + Math.sin(Date.now() * 0.01 + c) * 2, 3, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'gargoyle':
        // Weathered Granite Gargoyle Statue
        ctx.fillStyle = '#334155';
        ctx.fillRect(x - w / 2, y - 26, w, 26);
        ctx.fillStyle = '#64748b';
        // Head
        ctx.beginPath();
        ctx.arc(x, y - 56, 18, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 60);
        ctx.lineTo(x - 38, y - 96);
        ctx.lineTo(x - 16, y - 48);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 60);
        ctx.lineTo(x + 38, y - 96);
        ctx.lineTo(x + 16, y - 48);
        ctx.fill();
        break;

      default:
        ctx.fillStyle = this.color;
        ctx.fillRect(x - w / 2, topY, w, h);
        break;
    }

    // Fractures
    if (this.cracks.length > 0) {
      ctx.strokeStyle = '#05070a';
      ctx.lineWidth = 2.2;
      for (const c of this.cracks) {
        ctx.beginPath();
        const cx = x - w / 2 + c.x;
        const cy = topY + c.y;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(c.angle) * c.len, cy + Math.sin(c.angle) * c.len);
        ctx.stroke();
      }
    }

    // Health Bar
    if (hpRatio < 1.0) {
      const barW = Math.min(65, w);
      const barH = 5;
      const barY = topY - 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(x - barW / 2, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.4 ? '#eab308' : '#ef4444';
      ctx.fillRect(x - barW / 2, barY, barW * hpRatio, barH);
    }

    ctx.restore();
  }
}

class SceneManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.floorY = height - 85;

    this.currentSceneId = 'castle';
    this.currentSceneName = 'Castle Courtyard';
    this.tierDepth = 0; // Subterranean depth in meters
    this.props = [];
    this.floorSlabs = [];
    this.totalInitialHp = 1;

    // Catastrophic Collapse & Freefall State
    this.isCollapsing = false;
    this.freefallProgress = 0; // 0 to 1
    this.freefallTimer = 0;
    this.freefallSpeed = 0;
    this.shaftOffsetY = 0;
    this.collapseTriggered = false;

    this.backgroundPreset = null;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.floorY = h - 85;
  }

  getAvailableScenes() {
    return [
      { id: 'castle', name: 'Castle Courtyard', theme: 'medieval' },
      { id: 'crypt', name: 'Forgotten Dungeon Crypt', theme: 'crypt' },
      { id: 'bunker', name: 'Cyberpunk Bunker', theme: 'cyber' },
      { id: 'foundry', name: 'Magma Core Foundry', theme: 'foundry' },
      { id: 'salon', name: 'Grand Manor Salon', theme: 'salon' },
      { id: 'ruins', name: 'Ancient Temple Ruins', theme: 'ruins' }
    ];
  }

  loadRandomScene() {
    const list = this.getAvailableScenes();
    const pick = list[Math.floor(Math.random() * list.length)];
    this.loadScene(pick.id);
  }

  loadNextSubterraneanTier() {
    // Sequence to next subterranean depth
    const sceneOrder = ['castle', 'crypt', 'bunker', 'foundry', 'ruins', 'salon'];
    let nextIdx = sceneOrder.indexOf(this.currentSceneId) + 1;
    if (nextIdx >= sceneOrder.length) nextIdx = 0;
    this.tierDepth += 250 + Math.floor(Math.random() * 150);
    this.loadScene(sceneOrder[nextIdx]);
  }

  loadScene(sceneId) {
    this.currentSceneId = sceneId;
    this.props = [];
    this.floorSlabs = [];
    this.isCollapsing = false;
    this.collapseTriggered = false;
    this.freefallProgress = 0;
    this.freefallTimer = 0;
    this.freefallSpeed = 0;

    const floorY = this.floorY;
    const w = this.width;

    // 1. Build Destructible Floor Slabs across entire screen
    const slabCount = Math.max(10, Math.floor(w / 80));
    const slabW = w / slabCount;
    let theme = 'medieval';
    if (sceneId === 'bunker' || sceneId === 'foundry') theme = 'cyber';
    else if (sceneId === 'salon') theme = 'salon';
    else if (sceneId === 'crypt') theme = 'crypt';

    for (let i = 0; i < slabCount; i++) {
      this.floorSlabs.push(new FloorSlab(i, i * slabW + slabW / 2, floorY, slabW, 85, theme));
    }

    // 2. Build Scene Props
    switch (sceneId) {
      case 'castle':
        this.currentSceneName = 'Castle Courtyard';
        this.backgroundPreset = {
          skyGradient: ['#0f172a', '#1e293b'],
          theme: 'medieval'
        };
        this.props.push(new SceneryProp({ name: 'Keep Watchtower Left', x: w * 0.12, y: floorY, w: 90, h: 280, hp: 220, type: 'tower', color: '#475569', debrisPieces: 14 }));
        this.props.push(new SceneryProp({ name: 'Fortress Gate Arch', x: w * 0.38, y: floorY, w: 120, h: 190, hp: 180, type: 'arch', color: '#64748b', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Stone Gargoyle Plinth', x: w * 0.60, y: floorY, w: 60, h: 110, hp: 120, type: 'gargoyle', color: '#94a3b8', debrisPieces: 8 }));
        this.props.push(new SceneryProp({ name: 'Fluted Royal Pillar', x: w * 0.78, y: floorY, w: 55, h: 220, hp: 150, type: 'pillar', color: '#64748b', debrisPieces: 10 }));
        this.props.push(new SceneryProp({ name: 'Keep Watchtower Right', x: w * 0.91, y: floorY, w: 80, h: 260, hp: 200, type: 'tower', color: '#475569', debrisPieces: 12 }));
        break;

      case 'crypt':
        this.currentSceneName = 'Forgotten Dungeon Crypt';
        this.backgroundPreset = {
          skyGradient: ['#05070c', '#0f172a'],
          theme: 'crypt'
        };
        this.props.push(new SceneryProp({ name: 'Catacomb Column Left', x: w * 0.16, y: floorY, w: 65, h: 260, hp: 180, type: 'pillar', color: '#475569', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Iron Torture Arch', x: w * 0.42, y: floorY, w: 110, h: 170, hp: 160, type: 'arch', color: '#334155', debrisPieces: 10 }));
        this.props.push(new SceneryProp({ name: 'Gargoyle Sentinel', x: w * 0.68, y: floorY, w: 65, h: 120, hp: 130, type: 'gargoyle', color: '#64748b', debrisPieces: 8 }));
        this.props.push(new SceneryProp({ name: 'Catacomb Column Right', x: w * 0.86, y: floorY, w: 65, h: 240, hp: 170, type: 'pillar', color: '#475569', debrisPieces: 12 }));
        break;

      case 'bunker':
        this.currentSceneName = 'Cyberpunk Bunker';
        this.backgroundPreset = {
          skyGradient: ['#050811', '#0b1329'],
          theme: 'cyber'
        };
        this.props.push(new SceneryProp({ name: 'Mainframe Rack Alpha', x: w * 0.15, y: floorY, w: 75, h: 230, hp: 160, type: 'server', color: '#0f172a', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Holo Command Console', x: w * 0.36, y: floorY, w: 110, h: 100, hp: 130, type: 'terminal', color: '#1e293b', debrisPieces: 8 }));
        this.props.push(new SceneryProp({ name: 'Mainframe Rack Beta', x: w * 0.62, y: floorY, w: 80, h: 250, hp: 180, type: 'server', color: '#0f172a', debrisPieces: 14 }));
        this.props.push(new SceneryProp({ name: 'Cryo-Reactor Core', x: w * 0.84, y: floorY, w: 90, h: 170, hp: 190, type: 'server', color: '#1e293b', debrisPieces: 12 }));
        break;

      case 'foundry':
        this.currentSceneName = 'Magma Core Foundry';
        this.backgroundPreset = {
          skyGradient: ['#1f0a05', '#431407'],
          theme: 'foundry'
        };
        this.props.push(new SceneryProp({ name: 'Foundry Smelter Left', x: w * 0.18, y: floorY, w: 85, h: 240, hp: 200, type: 'server', color: '#292524', debrisPieces: 14 }));
        this.props.push(new SceneryProp({ name: 'Molten Siphon Terminal', x: w * 0.44, y: floorY, w: 100, h: 110, hp: 140, type: 'terminal', color: '#1c1917', debrisPieces: 8 }));
        this.props.push(new SceneryProp({ name: 'Foundry Smelter Right', x: w * 0.76, y: floorY, w: 85, h: 250, hp: 210, type: 'server', color: '#292524', debrisPieces: 14 }));
        break;

      case 'salon':
        this.currentSceneName = 'Grand Manor Salon';
        this.backgroundPreset = {
          skyGradient: ['#1c1917', '#292524'],
          theme: 'salon'
        };
        this.props.push(new SceneryProp({ name: 'Antique Bookshelf Left', x: w * 0.15, y: floorY, w: 90, h: 240, hp: 140, type: 'bookshelf', color: '#78350f', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Tufted Velvet Sofa', x: w * 0.38, y: floorY, w: 130, h: 90, hp: 120, type: 'sofa', color: '#991b1b', debrisPieces: 8 }));
        this.props.push(new SceneryProp({ name: 'Crystal Chandelier', x: w * 0.52, y: 200, w: 90, h: 80, hp: 100, type: 'chandelier', color: '#fef08a', isHanging: true, debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Antique Bookshelf Right', x: w * 0.85, y: floorY, w: 85, h: 230, hp: 130, type: 'bookshelf', color: '#78350f', debrisPieces: 10 }));
        break;

      case 'ruins':
        this.currentSceneName = 'Ancient Temple Ruins';
        this.backgroundPreset = {
          skyGradient: ['#18181b', '#27272a'],
          theme: 'ruins'
        };
        this.props.push(new SceneryProp({ name: 'Pillar of Hera', x: w * 0.15, y: floorY, w: 60, h: 250, hp: 160, type: 'pillar', color: '#a1a1aa', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Stone Colossus Arch', x: w * 0.40, y: floorY, w: 100, h: 160, hp: 180, type: 'arch', color: '#71717a', debrisPieces: 12 }));
        this.props.push(new SceneryProp({ name: 'Cracked Colonnade', x: w * 0.65, y: floorY, w: 55, h: 220, hp: 140, type: 'pillar', color: '#a1a1aa', debrisPieces: 10 }));
        this.props.push(new SceneryProp({ name: 'Sun Obelisk', x: w * 0.86, y: floorY, w: 70, h: 270, hp: 200, type: 'pillar', color: '#a1a1aa', debrisPieces: 14 }));
        break;
    }

    const propsHp = this.props.reduce((s, p) => s + p.maxHp, 0);
    const floorHp = this.floorSlabs.reduce((s, f) => s + f.maxHp, 0);
    this.totalInitialHp = propsHp + floorHp;
  }

  getDestructionPercentage() {
    const alivePropsHp = this.props.reduce((s, p) => s + (p.isAlive() ? p.hp : 0), 0);
    const aliveFloorHp = this.floorSlabs.reduce((s, f) => s + (f.collapsed ? 0 : f.hp), 0);
    const currentHp = alivePropsHp + aliveFloorHp;
    const ratio = 1 - (currentHp / this.totalInitialHp);
    return Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }

  // Check if character/explosions damaged the floor
  damageFloorAt(x, radius, damage, physics) {
    for (const slab of this.floorSlabs) {
      if (!slab.collapsed && Math.abs(slab.x - x) < radius + slab.w / 2) {
        slab.takeDamage(damage, { x, y: this.floorY }, physics);
      }
    }
  }

  // Trigger Catastrophic Collapse
  triggerCollapse(physics) {
    if (this.isCollapsing || this.collapseTriggered) return;
    this.isCollapsing = true;
    this.collapseTriggered = true;
    this.freefallTimer = 0;
    this.freefallProgress = 0;

    window.soundEngine.playEarthquakeRumble(2.5);
    window.soundEngine.playWindRush(2.5);
    physics.addTrauma(0.8);

    // Collapse all remaining floor slabs
    for (const slab of this.floorSlabs) {
      if (!slab.collapsed) {
        slab.collapse(physics);
      }
    }
  }

  findPropForRobot(robotX) {
    const alive = this.props.filter(p => p.isAlive());
    if (alive.length > 0) {
      alive.sort((a, b) => Math.abs(a.x - robotX) - Math.abs(b.x - robotX));
      return alive[0];
    }
    // If all props dead, robot can target floor slabs!
    const intactSlabs = this.floorSlabs.filter(s => !s.collapsed);
    if (intactSlabs.length > 0) {
      intactSlabs.sort((a, b) => Math.abs(a.x - robotX) - Math.abs(b.x - robotX));
      const s = intactSlabs[0];
      return {
        name: 'Floor Slab #' + s.index,
        x: s.x,
        y: s.y + s.h / 2,
        w: s.w,
        h: s.h,
        color: '#475569',
        isFloorSlab: true,
        slabRef: s
      };
    }
    return null;
  }

  update(dt, physics) {
    // 1. Update floor slabs
    for (const slab of this.floorSlabs) {
      slab.update(dt);
    }

    // 2. Check for catastrophic floor collapse condition
    const destructionPct = this.getDestructionPercentage();
    const collapsedSlabs = this.floorSlabs.filter(s => s.collapsed).length;

    // Trigger collapse when scenery is heavily obliterated or > 55% of floor is gone
    if (!this.collapseTriggered && (destructionPct >= 95 || collapsedSlabs >= this.floorSlabs.length * 0.6)) {
      this.triggerCollapse(physics);
    }

    // 3. Freefall sequence handling
    if (this.isCollapsing) {
      this.freefallTimer += dt;
      this.freefallProgress = Math.min(1.0, this.freefallTimer / 2.6); // 2.6 seconds fall
      this.freefallSpeed = 800 + this.freefallProgress * 1200;
      this.shaftOffsetY = (this.shaftOffsetY + this.freefallSpeed * dt) % 120;

      // Heavy camera trauma during freefall
      physics.addTrauma(0.04);

      if (this.freefallProgress >= 1.0) {
        // Crash land into next subterranean level!
        window.soundEngine.playHeavyImpactLand();
        physics.addTrauma(0.95);
        this.loadNextSubterraneanTier();
        return true; // Indicates level transition just completed
      }
    }
    return false;
  }

  renderBackground(ctx) {
    if (this.isCollapsing) {
      // RENDER FREEFALLING VERTICAL SHAFT
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, this.width, this.height);

      // Parallax Rushing Shaft Walls & High-Speed Wind Streaks
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      for (let sy = -120; sy < this.height + 120; sy += 40) {
        const yPos = sy + this.shaftOffsetY;
        // Shaft brick joints
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(120, yPos);
        ctx.moveTo(this.width - 120, yPos);
        ctx.lineTo(this.width, yPos);
        ctx.stroke();
      }

      // High-speed vertical motion blur streaks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (let s = 0; s < 25; s++) {
        const sx = (s * 87) % this.width;
        const sy = (Date.now() * 1.5 + s * 140) % (this.height + 200) - 100;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - 80 - Math.random() * 60);
        ctx.stroke();
      }

      // Subterranean glowing chasm warning glow from below
      const abyssGrad = ctx.createLinearGradient(0, this.height - 180, 0, this.height);
      abyssGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      abyssGrad.addColorStop(1, 'rgba(239, 68, 68, 0.45)');
      ctx.fillStyle = abyssGrad;
      ctx.fillRect(0, this.height - 180, this.width, 180);
      return;
    }

    if (!this.backgroundPreset) return;

    // Normal Realistic Scene Sky & Background Wall
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.floorY);
    skyGrad.addColorStop(0, this.backgroundPreset.skyGradient[0]);
    skyGrad.addColorStop(1, this.backgroundPreset.skyGradient[1]);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.floorY);

    // Architectural Depth Silhouettes
    if (this.backgroundPreset.theme === 'medieval' || this.backgroundPreset.theme === 'crypt') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, this.floorY);
      ctx.lineTo(this.width * 0.2, this.floorY - 110);
      ctx.lineTo(this.width * 0.45, this.floorY - 70);
      ctx.lineTo(this.width * 0.75, this.floorY - 130);
      ctx.lineTo(this.width, this.floorY - 60);
      ctx.lineTo(this.width, this.floorY);
      ctx.fill();
    } else if (this.backgroundPreset.theme === 'foundry') {
      // Glowing Molten Lava background reflections
      const lavaGlow = ctx.createLinearGradient(0, this.floorY - 140, 0, this.floorY);
      lavaGlow.addColorStop(0, 'rgba(239, 68, 68, 0)');
      lavaGlow.addColorStop(1, 'rgba(249, 115, 22, 0.2)');
      ctx.fillStyle = lavaGlow;
      ctx.fillRect(0, this.floorY - 140, this.width, 140);
    }
  }

  renderFloor(ctx) {
    // Render all floor slabs
    for (const slab of this.floorSlabs) {
      slab.render(ctx);
    }
  }

  renderProps(ctx) {
    for (const prop of this.props) {
      prop.render(ctx);
    }
  }
}

window.SceneManager = SceneManager;
window.SceneryProp = SceneryProp;
window.FloorSlab = FloorSlab;
