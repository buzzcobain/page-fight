// 3D Game Orchestration Engine using Three.js

class GameApp3D {
  constructor() {
    this.container = document.body;

    // Three.js Core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0c10);
    this.scene.fog = new THREE.FogExp2(0x0b0c10, 0.008);

    // Zoomed-out Epic Panoramic Camera
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 22, 75);
    this.camera.lookAt(0, 8, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Canvas insertion
    const oldCanvas = document.getElementById('gameCanvas');
    if (oldCanvas) oldCanvas.remove();
    this.renderer.domElement.id = 'webglCanvas';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.zIndex = '1';
    document.body.prepend(this.renderer.domElement);

    // Subsystems
    this.physics3D = new PhysicsWorld3D(this.scene, this.camera);
    this.sceneManager3D = new SceneManager3D(this.scene, this.camera);

    // Mouse Tracking in 3D Space
    this.mouse3D = {
      worldX: 0,
      worldY: 6,
      worldZ: 0,
      active: true,
      lastExitPos: null,
      lastExitWorldX: 0,
      shieldRipple: 0,
      triggerDeflection: () => {
        this.mouse3D.shieldRipple = 1.0;
        if (this.shieldMesh) {
          this.shieldMesh.scale.set(1.4, 1.4, 1.4);
        }
      }
    };

    this.raycaster = new THREE.Raycaster();
    this.mouseScreen = new THREE.Vector2();
    this.planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Characters
    this.character = null;
    this.activeCharacterType = 'wizard';
    this.multiSquadMode = false;
    this.squad = [];

    // Dialogue Overlay
    this.dialogueEl = document.getElementById('dialogueOverlay');

    this.lastTime = performance.now();

    this.setupLighting();
    this.sceneManager3D.setLights({
      ambLight: this.ambLight,
      sunLight: this.sunLight,
      rimLight: this.rimLight,
      biomeLight: this.biomeLight
    });

    this.setupCursorShield3D();
    this.setupInput();
    this.bindUI();

    // Load initial scene & character
    this.sceneManager3D.loadRandomScene();
    this.setCharacter('wizard');

    window.addEventListener('resize', () => this.onResize());
    requestAnimationFrame((t) => this.loop(t));
  }

  setupLighting() {
    // Ambient fill
    this.ambLight = new THREE.AmbientLight(0x384252, 0.85);
    this.scene.add(this.ambLight);

    // Directional sunlight with expanded panoramic soft shadow frustum
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    this.sunLight.position.set(24, 44, 28);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    this.sunLight.shadow.camera.left = -58;
    this.sunLight.shadow.camera.right = 58;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -12;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Dynamic accent rim light
    this.rimLight = new THREE.DirectionalLight(0x0ea5e9, 0.8);
    this.rimLight.position.set(-25, 20, -15);
    this.scene.add(this.rimLight);

    // Volumetric Biome Point Light
    this.biomeLight = new THREE.PointLight(0xf97316, 2.0, 50);
    this.biomeLight.position.set(0, 10, 4);
    this.scene.add(this.biomeLight);
  }

  setupCursorShield3D() {
    // Prominent 3D Hexagonal Energy Shield Reticle for Zoomed-Out Vista
    const shieldGeom = new THREE.RingGeometry(2.2, 2.8, 6);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    this.shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    this.scene.add(this.shieldMesh);

    this.shieldLight = new THREE.PointLight(0x38bdf8, 1.6, 14);
    this.shieldMesh.add(this.shieldLight);
  }

  setupInput() {
    window.addEventListener('mousemove', (e) => {
      window.soundEngine.ensureContext();
      this.mouseScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // Project onto Z = 0 plane
      this.raycaster.setFromCamera(this.mouseScreen, this.camera);
      const hit = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.planeZ, hit);

      if (hit) {
        this.mouse3D.worldX = hit.x;
        this.mouse3D.worldY = hit.y;
        this.mouse3D.worldZ = hit.z;
      }

      if (!this.mouse3D.active) {
        this.mouse3D.active = true;
        this.updateStatusHUD();
      }
    });

    document.addEventListener('mouseleave', (e) => {
      this.mouse3D.active = false;
      this.mouse3D.lastExitPos = { x: e.clientX, y: e.clientY };
      this.mouse3D.lastExitWorldX = this.mouse3D.worldX;
      this.updateStatusHUD();
    });

    document.addEventListener('mouseenter', () => {
      window.soundEngine.ensureContext();
      this.mouse3D.active = true;
      this.updateStatusHUD();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.setCharacter('wizard');
      else if (e.key === '2') this.setCharacter('soldier');
      else if (e.key === '3') this.setCharacter('knight');
      else if (e.key === '4') this.setCharacter('robot');
      else if (e.key.toLowerCase() === 'r') this.sceneManager3D.loadScene(this.sceneManager3D.currentSceneId);
      else if (e.key.toLowerCase() === 'm') this.toggleMute();
    });
  }

  setCharacter(type) {
    if (this.character) this.character.dispose();
    this.activeCharacterType = type;

    switch (type) {
      case 'wizard':
        this.character = new Wizard3D(-10, 0, 0, this.scene);
        break;
      case 'soldier':
        this.character = new Soldier3D(-10, 0, 0, this.scene);
        break;
      case 'knight':
        this.character = new Knight3D(-10, 0, 0, this.scene);
        break;
      case 'robot':
        this.character = new Robot3D(-10, 0, 0, this.scene);
        break;
    }

    if (this.multiSquadMode) {
      this.initSquad();
    }

    document.querySelectorAll('.char-tab').forEach(t => {
      if (t.dataset.char === type) t.classList.add('active');
      else t.classList.remove('active');
    });

    this.updateStatusHUD();
  }

  initSquad() {
    for (const c of this.squad) c.dispose();
    this.squad = [
      new Wizard3D(-32, 0, 0, this.scene),
      new Soldier3D(-11, 0, 0, this.scene),
      new Knight3D(11, 0, 0, this.scene),
      new Robot3D(32, 0, 0, this.scene)
    ];
  }

  toggleSquad() {
    this.multiSquadMode = !this.multiSquadMode;
    const btn = document.getElementById('btnToggleSquad');
    if (this.multiSquadMode) {
      this.initSquad();
      if (btn) btn.classList.add('active');
    } else {
      for (const c of this.squad) c.dispose();
      this.squad = [];
      if (btn) btn.classList.remove('active');
      this.setCharacter(this.activeCharacterType);
    }
  }

  toggleMute() {
    const isMuted = window.soundEngine.toggleMute();
    const btn = document.getElementById('btnToggleMute');
    if (btn) {
      btn.textContent = isMuted ? 'Audio: Muted' : 'Audio: Active';
      if (isMuted) btn.classList.add('muted');
      else btn.classList.remove('muted');
    }
  }

  setDialogue(name, text, duration) {
    if (!this.dialogueEl) return;
    this.dialogueEl.textContent = `${name.toUpperCase()}: "${text}"`;
    this.dialogueEl.style.opacity = '1';
    clearTimeout(this.dialogueTimeout);
    this.dialogueTimeout = setTimeout(() => {
      if (this.dialogueEl) this.dialogueEl.style.opacity = '0';
    }, duration * 1000);
  }

  bindUI() {
    document.querySelectorAll('.char-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        window.soundEngine.ensureContext();
        this.setCharacter(tab.dataset.char);
      });
    });

    const sceneSelect = document.getElementById('sceneSelect');
    if (sceneSelect) {
      sceneSelect.addEventListener('change', (e) => {
        window.soundEngine.ensureContext();
        this.sceneManager3D.loadScene(e.target.value);
      });
    }

    const btnRegen = document.getElementById('btnRegenScene');
    if (btnRegen) {
      btnRegen.addEventListener('click', () => {
        window.soundEngine.ensureContext();
        this.sceneManager3D.loadScene(this.sceneManager3D.currentSceneId);
      });
    }

    const btnMute = document.getElementById('btnToggleMute');
    if (btnMute) btnMute.addEventListener('click', () => this.toggleMute());

    const btnSquad = document.getElementById('btnToggleSquad');
    if (btnSquad) btnSquad.addEventListener('click', () => this.toggleSquad());
  }

  updateStatusHUD() {
    const statusEl = document.getElementById('activeTargetStatus');
    if (!statusEl) return;
    if (this.mouse3D.active) {
      statusEl.textContent = 'TARGET LOCKED';
      statusEl.className = 'status-tag locked';
    } else {
      statusEl.textContent = 'HUNTING OFFSCREEN';
      statusEl.className = 'status-tag hunting';
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loop(currentTime) {
    const dt = Math.min(0.06, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // 1. UPDATE SCENERY & FLOOR COLLAPSE
    const transitioned = this.sceneManager3D.update(dt, this.physics3D);
    if (transitioned) {
      // Landed on next subterranean depth!
      if (this.character) {
        this.character.group.position.y = 0;
        this.character.state = 'LANDING';
        this.character.landingTimer = 0.7;
      }
      if (this.multiSquadMode) {
        for (const c of this.squad) {
          c.group.position.y = 0;
          c.state = 'LANDING';
          c.landingTimer = 0.7;
        }
      }
      this.physics3D.spawnSparks3D(0, 0, 0, 60, 0x94a3b8);
      const sceneSelect = document.getElementById('sceneSelect');
      if (sceneSelect) sceneSelect.value = this.sceneManager3D.currentSceneId;
      const depthBadge = document.getElementById('depthDisplay');
      if (depthBadge) {
        depthBadge.textContent = `-${this.sceneManager3D.tierDepth}M [${this.sceneManager3D.currentSceneName.toUpperCase()}]`;
      }
    }

    // 2. UPDATE CHARACTERS
    if (this.multiSquadMode) {
      for (const c of this.squad) c.update(dt, this.mouse3D, this.physics3D, this.sceneManager3D);
    } else if (this.character) {
      this.character.update(dt, this.mouse3D, this.physics3D, this.sceneManager3D);
    }

    // 3. UPDATE 3D PHYSICS (auto-fading debris & projectiles)
    this.physics3D.update(dt, this.mouse3D, this.sceneManager3D.props, this.sceneManager3D.floorY);

    // 4. UPDATE MOUSE 3D SHIELD
    if (this.shieldMesh) {
      this.shieldMesh.position.set(this.mouse3D.worldX, this.mouse3D.worldY, this.mouse3D.worldZ);
      this.shieldMesh.rotation.z += 1.5 * dt;

      if (this.mouse3D.shieldRipple > 0) {
        this.mouse3D.shieldRipple = Math.max(0, this.mouse3D.shieldRipple - 3.5 * dt);
        const s = 1.0 + this.mouse3D.shieldRipple * 0.4;
        this.shieldMesh.scale.set(s, s, s);
      }
    }

    // 5. CAMERA TRAUMA & SHAKE (Epic Zoomed-Out Framing)
    const shake = this.physics3D.getShakeOffset();
    const baseCamY = this.sceneManager3D.isCollapsing ? 14 : 22;
    this.camera.position.set(shake.x, baseCamY + shake.y, 75 + shake.z);
    this.camera.rotation.z = shake.rotZ;
    this.camera.lookAt(shake.x * 0.2, 8 + shake.y * 0.2, 0);

    // 6. RENDER 3D SCENE
    this.renderer.render(this.scene, this.camera);

    // 7. TELEMETRY
    const destructionPct = this.sceneManager3D.getDestructionPercentage();
    const fill = document.getElementById('destructionFill');
    const text = document.getElementById('destructionText');
    const defl = document.getElementById('deflectionsCount');
    if (fill) fill.style.width = `${destructionPct}%`;
    if (text) text.textContent = `${destructionPct}%`;
    if (defl) defl.textContent = this.physics3D.stats.deflections;

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app3D = new GameApp3D();
});
