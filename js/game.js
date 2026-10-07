// Main Game & Orchestration Engine

class GameApp {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // Viewport dimensions
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.floorY = this.height - 85;

    // Subsystems
    this.physics = new PhysicsWorld();
    this.sceneManager = new SceneManager(this.width, this.height);

    // Mouse Tracking & Invincible Shield State
    this.mouse = {
      x: this.width * 0.5,
      y: this.height * 0.4,
      prevX: this.width * 0.5,
      prevY: this.height * 0.4,
      vx: 0,
      vy: 0,
      active: true,
      lastExitPos: null,
      shieldRipple: 0,
      triggerDeflection: () => {
        this.mouse.shieldRipple = 1.0;
      }
    };

    // Active Character
    this.activeCharacterType = 'wizard'; // 'wizard', 'soldier', 'knight', 'robot'
    this.character = null;
    this.multiSquadMode = false;
    this.squad = [];

    // Frame timing
    this.lastTime = performance.now();

    // DOM UI elements
    this.ui = {
      destructionFill: document.getElementById('destructionFill'),
      destructionText: document.getElementById('destructionText'),
      deflectionsCount: document.getElementById('deflectionsCount'),
      activeTargetStatus: document.getElementById('activeTargetStatus'),
      charTabs: document.querySelectorAll('.char-tab'),
      sceneSelect: document.getElementById('sceneSelect'),
      btnRegen: document.getElementById('btnRegenScene'),
      btnMute: document.getElementById('btnToggleMute'),
      btnSquad: document.getElementById('btnToggleSquad')
    };

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Setup input listeners
    this.setupMouseTracking();

    // Initial random scene
    this.sceneManager.loadRandomScene();

    // Create initial character
    const charTypes = ['wizard', 'soldier', 'knight', 'robot'];
    const initialChar = charTypes[Math.floor(Math.random() * charTypes.length)];
    this.setCharacter(initialChar);

    // Wire up UI events
    this.bindUI();

    // Start main loop
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.floorY = this.height - 85;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.physics.resize(this.width, this.height);
    this.sceneManager.resize(this.width, this.height);

    if (this.character) {
      this.character.floorY = this.floorY;
      this.character.y = this.floorY;
    }
  }

  setupMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      // First interaction initializes Web Audio
      window.soundEngine.ensureContext();

      const dx = e.clientX - this.mouse.x;
      const dy = e.clientY - this.mouse.y;
      this.mouse.vx = dx * 10;
      this.mouse.vy = dy * 10;
      this.mouse.prevX = this.mouse.x;
      this.mouse.prevY = this.mouse.y;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      if (!this.mouse.active) {
        this.mouse.active = true;
        this.updateStatusHUD();
      }
    });

    // Detect mouse leaving browser window (The "Hunting" trigger)
    document.addEventListener('mouseleave', (e) => {
      this.mouse.active = false;
      this.mouse.lastExitPos = {
        x: Math.max(10, Math.min(this.width - 10, e.clientX || this.mouse.x)),
        y: Math.max(10, Math.min(this.height - 10, e.clientY || this.mouse.y))
      };
      this.updateStatusHUD();
    });

    window.addEventListener('blur', () => {
      this.mouse.active = false;
      this.mouse.lastExitPos = { x: this.mouse.x, y: this.mouse.y };
      this.updateStatusHUD();
    });

    document.addEventListener('mouseenter', () => {
      window.soundEngine.ensureContext();
      this.mouse.active = true;
      this.updateStatusHUD();
    });

    window.addEventListener('focus', () => {
      window.soundEngine.ensureContext();
      this.mouse.active = true;
      this.updateStatusHUD();
    });

    // Keyboard shortcuts (1=Wizard, 2=Soldier, 3=Knight, 4=Robot, R=Regen)
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setCharacter('wizard');
      else if (e.key === '2') this.setCharacter('soldier');
      else if (e.key === '3') this.setCharacter('knight');
      else if (e.key === '4') this.setCharacter('robot');
      else if (e.key.toLowerCase() === 'r') this.sceneManager.loadRandomScene();
      else if (e.key.toLowerCase() === 'm') this.toggleMute();
    });
  }

  setCharacter(type) {
    this.activeCharacterType = type;
    const spawnX = this.width * 0.25;

    switch (type) {
      case 'wizard':
        this.character = new WizardCharacter(spawnX, this.floorY, this.floorY);
        break;
      case 'soldier':
        this.character = new SoldierCharacter(spawnX, this.floorY, this.floorY);
        break;
      case 'knight':
        this.character = new KnightCharacter(spawnX, this.floorY, this.floorY);
        break;
      case 'robot':
        this.character = new RobotCharacter(spawnX, this.floorY, this.floorY);
        break;
    }

    if (this.multiSquadMode) {
      this.initSquad();
    }

    // Update Tab UI
    this.ui.charTabs.forEach(tab => {
      if (tab.dataset.char === type) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.updateStatusHUD();
  }

  initSquad() {
    this.squad = [
      new WizardCharacter(this.width * 0.15, this.floorY, this.floorY),
      new SoldierCharacter(this.width * 0.35, this.floorY, this.floorY),
      new KnightCharacter(this.width * 0.65, this.floorY, this.floorY),
      new RobotCharacter(this.width * 0.85, this.floorY, this.floorY)
    ];
  }

  toggleSquad() {
    this.multiSquadMode = !this.multiSquadMode;
    if (this.multiSquadMode) {
      this.initSquad();
      this.ui.btnSquad.classList.add('active');
    } else {
      this.squad = [];
      this.ui.btnSquad.classList.remove('active');
      this.setCharacter(this.activeCharacterType);
    }
  }

  toggleMute() {
    const isMuted = window.soundEngine.toggleMute();
    if (this.ui.btnMute) {
      this.ui.btnMute.textContent = isMuted ? 'Audio: Muted' : 'Audio: Active';
      if (isMuted) {
        this.ui.btnMute.classList.add('muted');
      } else {
        this.ui.btnMute.classList.remove('muted');
      }
    }
  }

  bindUI() {
    // Character Tabs
    this.ui.charTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        window.soundEngine.ensureContext();
        this.setCharacter(tab.dataset.char);
      });
    });

    // Scene Select
    if (this.ui.sceneSelect) {
      this.ui.sceneSelect.value = this.sceneManager.currentSceneId;
      this.ui.sceneSelect.addEventListener('change', (e) => {
        window.soundEngine.ensureContext();
        this.sceneManager.loadScene(e.target.value);
      });
    }

    // Regen Scene
    if (this.ui.btnRegen) {
      this.ui.btnRegen.addEventListener('click', () => {
        window.soundEngine.ensureContext();
        this.sceneManager.loadScene(this.sceneManager.currentSceneId);
      });
    }

    // Mute Audio
    if (this.ui.btnMute) {
      this.ui.btnMute.addEventListener('click', () => {
        this.toggleMute();
      });
    }

    // Multi Squad Toggle
    if (this.ui.btnSquad) {
      this.ui.btnSquad.addEventListener('click', () => {
        window.soundEngine.ensureContext();
        this.toggleSquad();
      });
    }
  }

  updateStatusHUD() {
    if (!this.ui.activeTargetStatus) return;

    if (this.mouse.active) {
      this.ui.activeTargetStatus.textContent = 'TARGET LOCKED';
      this.ui.activeTargetStatus.className = 'status-tag locked';
    } else {
      this.ui.activeTargetStatus.textContent = 'HUNTING OFFSCREEN';
      this.ui.activeTargetStatus.className = 'status-tag hunting';
    }
  }

  // Draw the Invincible Forcefield / Cursor Shield
  renderMouseShield(ctx) {
    if (!this.mouse.active) return;

    const mx = this.mouse.x;
    const my = this.mouse.y;

    // Decay shield ripple
    if (this.mouse.shieldRipple > 0) {
      this.mouse.shieldRipple = Math.max(0, this.mouse.shieldRipple - 4.0 * (1 / 60));
    }

    ctx.save();
    ctx.translate(mx, my);

    // Subtle idle forcefield reticle
    const basePulse = Math.sin(Date.now() * 0.008) * 2;
    const shieldRadius = 18 + basePulse + this.mouse.shieldRipple * 16;

    // Hexagonal Shield Outline
    ctx.strokeStyle = this.mouse.shieldRipple > 0.1 ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = this.mouse.shieldRipple > 0.1 ? 3 : 1.5;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * shieldRadius;
      const py = Math.sin(a) * shieldRadius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Deflection energy flare
    if (this.mouse.shieldRipple > 0.05) {
      const flareGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, shieldRadius * 1.5);
      flareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      flareGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
      flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flareGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shieldRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw hunting indicator when mouse is offscreen
  renderOffscreenTrackingIndicator(ctx) {
    if (this.mouse.active || !this.mouse.lastExitPos) return;

    const pos = this.mouse.lastExitPos;
    ctx.save();

    // Pulsing search beacon at the exit point
    const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 16 + pulse * 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAST DETECTED', pos.x, pos.y + 36);

    ctx.restore();
  }

  loop(currentTime) {
    const dt = Math.min(0.06, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // 1. UPDATE SCENERY & FLOOR COLLAPSE
    const transitioned = this.sceneManager.update(dt, this.physics);
    if (transitioned) {
      // Crash landing into new subterranean level!
      if (this.character) {
        this.character.y = this.floorY;
        this.character.state = 'LANDING';
        this.character.landingTimer = 0.7;
        this.character.onLandImpact();
      }
      if (this.multiSquadMode) {
        for (const char of this.squad) {
          char.y = this.floorY;
          char.state = 'LANDING';
          char.landingTimer = 0.7;
          char.onLandImpact();
        }
      }
      // Massive dust clouds on impact
      this.physics.spawnExplosionParticles(this.width * 0.5, this.floorY, 70, '#64748b', 500);
      this.physics.spawnExplosionParticles(this.width * 0.25, this.floorY, 40, '#94a3b8', 420);
      this.physics.spawnExplosionParticles(this.width * 0.75, this.floorY, 40, '#94a3b8', 420);
      if (this.ui.sceneSelect) {
        this.ui.sceneSelect.value = this.sceneManager.currentSceneId;
      }
      const depthBadge = document.getElementById('depthDisplay');
      if (depthBadge) {
        depthBadge.textContent = `-${this.sceneManager.tierDepth}M [${this.sceneManager.currentSceneName.toUpperCase()}]`;
      }
    }

    // 2. UPDATE PHYSICS & CHARACTERS
    this.physics.update(dt, this.mouse, this.sceneManager.props);

    if (this.multiSquadMode) {
      for (const char of this.squad) {
        char.update(dt, this.mouse, this.physics, this.sceneManager);
      }
    } else if (this.character) {
      this.character.update(dt, this.mouse, this.physics, this.sceneManager);
    }

    // 3. RENDER
    const shake = this.physics.getShakeOffset();
    this.ctx.save();
    this.ctx.translate(shake.x, shake.y);
    if (shake.angle !== 0) {
      this.ctx.translate(this.width / 2, this.height / 2);
      this.ctx.rotate(shake.angle);
      this.ctx.translate(-this.width / 2, -this.height / 2);
    }

    // Clear Canvas & draw scene background
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.sceneManager.renderBackground(this.ctx);

    // Draw Floor Slabs
    this.sceneManager.renderFloor(this.ctx);

    // Draw Props
    this.sceneManager.renderProps(this.ctx);

    // Draw Characters
    if (this.multiSquadMode) {
      for (const char of this.squad) {
        char.render(this.ctx);
      }
    } else if (this.character) {
      this.character.render(this.ctx);
    }

    // Draw Physics (Projectiles, Debris, Particles, Floating Combat Text)
    this.physics.render(this.ctx);

    // Draw Offscreen Tracking Beacon
    this.renderOffscreenTrackingIndicator(this.ctx);

    // Draw Mouse Shield
    this.renderMouseShield(this.ctx);

    this.ctx.restore();

    // 4. UPDATE TELEMETRY UI
    const destructionPct = this.sceneManager.getDestructionPercentage();
    if (this.ui.destructionFill) {
      this.ui.destructionFill.style.width = `${destructionPct}%`;
    }
    if (this.ui.destructionText) {
      this.ui.destructionText.textContent = `${destructionPct}%`;
    }
    if (this.ui.deflectionsCount) {
      this.ui.deflectionsCount.textContent = this.physics.stats.deflections;
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new GameApp();
});
