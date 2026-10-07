// 3D Destructible Scenery & Floor Engine using Three.js
// Handles PBR volumetric environments, Voronoi-like 3D fracture debris with auto-fade disposal,
// and subterranean shaft collapse transitions.

class DebrisChunk3D {
  constructor(mesh, vx, vy, vz, vAng, scene) {
    this.mesh = mesh;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.vAng = vAng;
    this.scene = scene;

    this.life = 5.0; // Total lifetime in seconds
    this.fadeDuration = 1.8; // Time spent dissolving
    this.isSettled = false;
    this.heldByRobot = false;
    this.thrownByRobot = false;
    this.radius = mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 0.8;
  }

  update(dt, floorY = 0) {
    if (this.heldByRobot) return true;

    this.life -= dt;

    // Dissolve & Fade Out before disappearing
    if (this.life <= this.fadeDuration) {
      const alpha = Math.max(0, this.life / this.fadeDuration);
      if (this.mesh.material) {
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = alpha;
      }
      // Shrink slightly as it turns to dust
      const s = Math.max(0.01, alpha);
      this.mesh.scale.set(s, s, s);

      if (this.life <= 0) {
        // Dispose resources cleanly
        this.dispose();
        return false; // Remove from array
      }
    }

    if (!this.isSettled) {
      // 3D Gravity & Physics
      this.vy -= 26 * dt;
      this.mesh.position.x += this.vx * dt;
      this.mesh.position.y += this.vy * dt;
      this.mesh.position.z += this.vz * dt;

      this.mesh.rotation.x += this.vAng.x * dt;
      this.mesh.rotation.y += this.vAng.y * dt;
      this.mesh.rotation.z += this.vAng.z * dt;

      this.vx *= 0.985;
      this.vz *= 0.985;

      // Floor collision
      if (this.mesh.position.y <= floorY + this.radius) {
        this.mesh.position.y = floorY + this.radius;
        this.vy = -this.vy * 0.35;
        this.vx *= 0.7;
        this.vz *= 0.7;
        this.vAng.multiplyScalar(0.65);

        if (Math.abs(this.vy) < 1.0 && Math.abs(this.vx) < 0.5) {
          this.isSettled = true;
          this.vy = 0;
          this.vx = 0;
          this.vz = 0;
        }
      }
    }

    return true;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(m => m.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
    }
  }
}

class FloorSlab3D {
  constructor(index, x, y, z, w, h, d, theme, scene) {
    this.index = index;
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    this.h = h;
    this.d = d;
    this.theme = theme;
    this.scene = scene;

    this.maxHp = 140;
    this.hp = this.maxHp;
    this.collapsed = false;
    this.fallVy = 0;
    this.fallVAng = (Math.random() - 0.5) * 3;

    // Build 3D Mesh
    const geom = new THREE.BoxGeometry(w, h, d);
    let mat;

    if (theme === 'cyber' || theme === 'foundry') {
      mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.85,
        roughness: 0.3,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2
      });
    } else if (theme === 'salon') {
      mat = new THREE.MeshStandardMaterial({
        color: 0x78350f,
        roughness: 0.45,
        metalness: 0.1
      });
    } else {
      // Stone Flagstone Pavers
      mat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.75,
        metalness: 0.2
      });
    }

    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(x, y - h / 2, z);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }

  takeDamage(amount, physics3D) {
    if (this.collapsed) return;
    this.hp -= amount;

    // Flash white on hit
    if (this.mesh.material) {
      this.mesh.material.emissive.setHex(0xffaa44);
      setTimeout(() => {
        if (this.mesh && this.mesh.material) {
          this.mesh.material.emissive.setHex(0x000000);
        }
      }, 70);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.collapse(physics3D);
    }
  }

  collapse(physics3D) {
    if (this.collapsed) return;
    this.collapsed = true;
    window.soundEngine.playStoneCrush(1.4);
    physics3D.addTrauma(0.3);

    this.fallVy = 5 + Math.random() * 8;

    // Spawn 3D debris fragments that will dissolve
    physics3D.createDebrisFromBox3D(
      this.mesh.position.x,
      this.mesh.position.y,
      this.mesh.position.z,
      this.w,
      this.h,
      this.d,
      0x475569,
      5
    );
  }

  update(dt) {
    if (this.collapsed) {
      this.fallVy += 40 * dt;
      this.mesh.position.y -= this.fallVy * dt;
      this.mesh.rotation.z += this.fallVAng * dt;

      if (this.mesh.position.y < -120) {
        this.mesh.visible = false;
      }
    }
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
  }
}

class SceneryProp3D {
  constructor(options, scene) {
    this.name = options.name;
    this.type = options.type;
    this.scene = scene;
    this.maxHp = options.hp || 130;
    this.hp = this.maxHp;
    this.isDestroyed = false;
    this.heldByRobot = false;

    this.group = new THREE.Group();
    this.group.position.set(options.x, options.y, options.z || 0);

    this.color = options.color || 0x64748b;
    this.accentColor = options.accentColor || 0x334155;
    this.w = options.w || 4;
    this.h = options.h || 12;
    this.d = options.d || 4;
    this.radius = Math.hypot(this.w, this.h) * 0.5;

    this.buildGeometry();
    this.scene.add(this.group);
  }

  buildGeometry() {
    const w = this.w;
    const h = this.h;
    const d = this.d;

    switch (this.type) {
      case 'tower':
        // Fortress Keep Tower with Battlements
        const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.2 });
        const towerMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), towerMat);
        towerMesh.position.y = h / 2;
        towerMesh.castShadow = true;
        towerMesh.receiveShadow = true;
        this.group.add(towerMesh);

        // Crenel battlements on top
        const crenelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.2 });
        const cCount = 3;
        for (let i = 0; i < cCount; i++) {
          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(w / 4, 1.2, d), crenelMat);
          cMesh.position.set(-w / 2 + (i * 2 + 1) * (w / 6), h + 0.6, 0);
          cMesh.castShadow = true;
          this.group.add(cMesh);
        }
        break;

      case 'pillar':
        // Classical Fluted Doric Pillar with Capital & Base
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.1 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.4, h - 1.5, 16), pillarMat);
        shaft.position.y = (h - 1.5) / 2 + 0.75;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        this.group.add(shaft);

        const capMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.2 });
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, w), capMat);
        cap.position.y = h - 0.4;
        cap.castShadow = true;
        this.group.add(cap);

        const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.8, w * 1.1), capMat);
        base.position.y = 0.4;
        base.castShadow = true;
        this.group.add(base);
        break;

      case 'server':
        // Cyberpunk Server Rack with Blinking LED Array
        const serverMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.25 });
        const sMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), serverMat);
        sMesh.position.y = h / 2;
        sMesh.castShadow = true;
        sMesh.receiveShadow = true;
        this.group.add(sMesh);

        // Blue / Cyan status LED strips
        const ledMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.8
        });
        for (let l = 1; l < 5; l++) {
          const led = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.25, 0.1), ledMat);
          led.position.set(0, l * (h / 6), d / 2 + 0.05);
          this.group.add(led);
        }
        break;

      case 'terminal':
        // Holographic Console Station
        const deskMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), deskMat);
        desk.position.y = 1.25;
        desk.castShadow = true;
        this.group.add(desk);

        // Translucent Blue Hologram Screen
        const holoMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.45
        });
        const holo = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 3.5), holoMat);
        holo.position.set(0, 3.5, 0);
        holo.rotation.x = -0.2;
        this.group.add(holo);
        break;

      case 'chandelier':
        // Hanging Crystal Chandelier
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.2 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.4, 0.2, 8, 16), brassMat);
        ring.position.y = h / 2;
        ring.rotation.x = Math.PI / 2;
        this.group.add(ring);

        // Candle light point
        const candleLight = new THREE.PointLight(0xf59e0b, 1.2, 18);
        candleLight.position.set(0, h / 2 + 0.5, 0);
        this.group.add(candleLight);
        break;

      default:
        const boxMat = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.6, metalness: 0.3 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
        box.position.y = h / 2;
        box.castShadow = true;
        box.receiveShadow = true;
        this.group.add(box);
        break;
    }
  }

  isAlive() {
    return this.hp > 0 && !this.isDestroyed && !this.heldByRobot;
  }

  contains3D(x, y, z) {
    if (this.isDestroyed || this.heldByRobot) return false;
    const px = this.group.position.x;
    const py = this.group.position.y;
    return (
      x >= px - this.w / 2 &&
      x <= px + this.w / 2 &&
      y >= py &&
      y <= py + this.h
    );
  }

  takeDamage(amount, blastPoint, physics3D) {
    if (this.isDestroyed || this.heldByRobot) return;
    this.hp -= amount;

    // Visual impact flash
    this.group.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.emissive.setHex(0xffffff);
        setTimeout(() => {
          if (child && child.material) child.material.emissive.setHex(0x000000);
        }, 60);
      }
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.destroy(physics3D, blastPoint);
    }
  }

  destroy(physics3D, blastPoint = null) {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    window.soundEngine.playStoneCrush(1.3);
    physics3D.addTrauma(0.35);

    // Break into physics debris that will auto-decay & disappear
    physics3D.createDebrisFromBox3D(
      this.group.position.x,
      this.group.position.y + this.h / 2,
      this.group.position.z,
      this.w,
      this.h,
      this.d,
      this.color,
      8,
      blastPoint
    );

    this.dispose();
  }

  dispose() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }
  }
}

class SceneManager3D {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.floorY = 0;

    this.currentSceneId = 'castle';
    this.currentSceneName = 'Castle Courtyard';
    this.tierDepth = 0;

    this.props = [];
    this.floorSlabs = [];
    this.shaftRings = [];

    this.isCollapsing = false;
    this.freefallProgress = 0;
    this.freefallTimer = 0;
    this.freefallSpeed = 0;

    this.totalInitialHp = 1;
    this.collapseTriggered = false;

    // Build subterranean vertical shaft walls (initially invisible)
    this.buildSubterraneanShaft();
  }

  buildSubterraneanShaft() {
    this.shaftGroup = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2
    });

    for (let r = 0; r < 24; r++) {
      const ringGeom = new THREE.CylinderGeometry(28, 28, 6, 24, 1, true);
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.y = -r * 12 - 10;
      this.shaftGroup.add(ringMesh);
      this.shaftRings.push(ringMesh);
    }
    this.shaftGroup.visible = false;
    this.scene.add(this.shaftGroup);
  }

  loadRandomScene() {
    const list = ['castle', 'crypt', 'bunker', 'foundry', 'salon', 'ruins'];
    const pick = list[Math.floor(Math.random() * list.length)];
    this.loadScene(pick);
  }

  loadNextSubterraneanTier() {
    const order = ['castle', 'crypt', 'bunker', 'foundry', 'ruins', 'salon'];
    let idx = order.indexOf(this.currentSceneId) + 1;
    if (idx >= order.length) idx = 0;
    this.tierDepth += 250 + Math.floor(Math.random() * 150);
    this.loadScene(order[idx]);
  }

  clearCurrentScene() {
    for (const p of this.props) p.dispose();
    for (const f of this.floorSlabs) f.dispose();
    this.props = [];
    this.floorSlabs = [];
  }

  loadScene(sceneId) {
    this.clearCurrentScene();
    this.currentSceneId = sceneId;
    this.isCollapsing = false;
    this.collapseTriggered = false;
    this.freefallProgress = 0;
    this.freefallTimer = 0;
    this.freefallSpeed = 0;
    this.shaftGroup.visible = false;

    let theme = 'medieval';
    if (sceneId === 'bunker' || sceneId === 'foundry') theme = 'cyber';
    else if (sceneId === 'salon') theme = 'salon';
    else if (sceneId === 'crypt') theme = 'crypt';

    // 1. Build 3D Destructible Floor Slabs across X: -32 to +32
    const slabCount = 12;
    const slabW = 64 / slabCount;
    for (let i = 0; i < slabCount; i++) {
      const slabX = -32 + i * slabW + slabW / 2;
      this.floorSlabs.push(new FloorSlab3D(i, slabX, this.floorY, 0, slabW * 0.96, 2.5, 18, theme, this.scene));
    }

    // 2. Build 3D Architectural Props
    switch (sceneId) {
      case 'castle':
        this.currentSceneName = 'Castle Courtyard';
        this.props.push(new SceneryProp3D({ name: 'Keep Watchtower Left', x: -24, y: 0, z: -2, w: 6, h: 22, d: 6, type: 'tower', hp: 250 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Royal Pillar Alpha', x: -10, y: 0, z: -1, w: 3, h: 16, d: 3, type: 'pillar', hp: 180 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Royal Pillar Beta', x: 10, y: 0, z: -1, w: 3, h: 16, d: 3, type: 'pillar', hp: 180 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Keep Watchtower Right', x: 24, y: 0, z: -2, w: 6, h: 22, d: 6, type: 'tower', hp: 250 }, this.scene));
        break;

      case 'crypt':
        this.currentSceneName = 'Dungeon Crypt';
        this.props.push(new SceneryProp3D({ name: 'Catacomb Column Left', x: -22, y: 0, z: -1, w: 3.5, h: 18, d: 3.5, type: 'pillar', hp: 200 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Gargoyle Pedestal', x: -6, y: 0, z: -2, w: 4, h: 8, d: 4, type: 'tower', hp: 140 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Catacomb Column Right', x: 22, y: 0, z: -1, w: 3.5, h: 18, d: 3.5, type: 'pillar', hp: 200 }, this.scene));
        break;

      case 'bunker':
        this.currentSceneName = 'Cyberpunk Bunker';
        this.props.push(new SceneryProp3D({ name: 'Mainframe Server Alpha', x: -22, y: 0, z: -2, w: 5, h: 18, d: 5, type: 'server', hp: 220 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Holo Command Console', x: -6, y: 0, z: -1, w: 8, h: 6, d: 4, type: 'terminal', hp: 160 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Mainframe Server Beta', x: 18, y: 0, z: -2, w: 5, h: 20, d: 5, type: 'server', hp: 220 }, this.scene));
        break;

      case 'foundry':
        this.currentSceneName = 'Magma Core Foundry';
        this.props.push(new SceneryProp3D({ name: 'Molten Core Smelter', x: -20, y: 0, z: -2, w: 6, h: 19, d: 6, type: 'server', hp: 240 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Pressure Turbine', x: 16, y: 0, z: -2, w: 6, h: 19, d: 6, type: 'server', hp: 240 }, this.scene));
        break;

      case 'salon':
        this.currentSceneName = 'Grand Manor Salon';
        this.props.push(new SceneryProp3D({ name: 'Mahogany Bookshelf Left', x: -22, y: 0, z: -2, w: 6, h: 18, d: 4, type: 'server', hp: 180 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Crystal Chandelier', x: 0, y: 14, z: 0, w: 5, h: 5, d: 5, type: 'chandelier', hp: 120 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Mahogany Bookshelf Right', x: 22, y: 0, z: -2, w: 6, h: 18, d: 4, type: 'server', hp: 180 }, this.scene));
        break;

      default:
        this.currentSceneName = 'Ancient Temple Ruins';
        this.props.push(new SceneryProp3D({ name: 'Colonnade Pillar Alpha', x: -20, y: 0, z: -2, w: 3.5, h: 19, d: 3.5, type: 'pillar', hp: 190 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Colonnade Pillar Beta', x: 0, y: 0, z: -2, w: 3.5, h: 19, d: 3.5, type: 'pillar', hp: 190 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Colonnade Pillar Gamma', x: 20, y: 0, z: -2, w: 3.5, h: 19, d: 3.5, type: 'pillar', hp: 190 }, this.scene));
        break;
    }

    const pTotal = this.props.reduce((s, p) => s + p.maxHp, 0);
    const fTotal = this.floorSlabs.reduce((s, f) => s + f.maxHp, 0);
    this.totalInitialHp = pTotal + fTotal || 1;
  }

  getDestructionPercentage() {
    const curP = this.props.reduce((s, p) => s + (p.isAlive() ? p.hp : 0), 0);
    const curF = this.floorSlabs.reduce((s, f) => s + (f.collapsed ? 0 : f.hp), 0);
    const ratio = 1 - (curP + curF) / this.totalInitialHp;
    return Math.min(100, Math.max(0, Math.round(ratio * 100)));
  }

  damageFloorAt(worldX, radius, damage, physics3D) {
    for (const slab of this.floorSlabs) {
      if (!slab.collapsed && Math.abs(slab.x - worldX) < radius + slab.w / 2) {
        slab.takeDamage(damage, physics3D);
      }
    }
  }

  triggerCollapse(physics3D) {
    if (this.isCollapsing || this.collapseTriggered) return;
    this.isCollapsing = true;
    this.collapseTriggered = true;
    this.freefallTimer = 0;
    this.freefallProgress = 0;
    this.shaftGroup.visible = true;

    window.soundEngine.playEarthquakeRumble(2.5);
    window.soundEngine.playWindRush(2.5);
    physics3D.addTrauma(0.85);

    for (const slab of this.floorSlabs) {
      if (!slab.collapsed) slab.collapse(physics3D);
    }
  }

  findPropForRobot(robotX) {
    const alive = this.props.filter(p => p.isAlive());
    if (alive.length > 0) {
      alive.sort((a, b) => Math.abs(a.group.position.x - robotX) - Math.abs(b.group.position.x - robotX));
      return alive[0];
    }
    const intactSlabs = this.floorSlabs.filter(s => !s.collapsed);
    if (intactSlabs.length > 0) {
      intactSlabs.sort((a, b) => Math.abs(a.x - robotX) - Math.abs(b.x - robotX));
      const s = intactSlabs[0];
      return {
        name: 'Floor Slab #' + s.index,
        isFloorSlab: true,
        slabRef: s,
        group: { position: { x: s.x, y: s.y, z: s.z } },
        w: s.w,
        h: s.h,
        d: s.d,
        color: 0x475569
      };
    }
    return null;
  }

  update(dt, physics3D) {
    for (const slab of this.floorSlabs) slab.update(dt);

    const destructionPct = this.getDestructionPercentage();
    const collapsedCount = this.floorSlabs.filter(s => s.collapsed).length;

    if (!this.collapseTriggered && (destructionPct >= 95 || collapsedCount >= this.floorSlabs.length * 0.6)) {
      this.triggerCollapse(physics3D);
    }

    if (this.isCollapsing) {
      this.freefallTimer += dt;
      this.freefallProgress = Math.min(1.0, this.freefallTimer / 2.6);
      this.freefallSpeed = 40 + this.freefallProgress * 80;

      // Scroll shaft rings upward to simulate rapid vertical descent
      for (const ring of this.shaftRings) {
        ring.position.y += this.freefallSpeed * dt;
        if (ring.position.y > 40) {
          ring.position.y -= 24 * 12;
        }
      }

      physics3D.addTrauma(0.04);

      if (this.freefallProgress >= 1.0) {
        window.soundEngine.playHeavyImpactLand();
        physics3D.addTrauma(0.95);
        this.loadNextSubterraneanTier();
        return true;
      }
    }
    return false;
  }
}

window.SceneManager3D = SceneManager3D;
window.SceneryProp3D = SceneryProp3D;
window.FloorSlab3D = FloorSlab3D;
window.DebrisChunk3D = DebrisChunk3D;
