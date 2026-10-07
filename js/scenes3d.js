// Realistic 3D Architectural Scenery & Floor Engine using Three.js and Procedural PBR Textures
// Replaces flat primitive boxes with multi-tiered stone masonry, corbels, fluted columns, and detailed trims.

class DebrisChunk3D {
  constructor(mesh, vx, vy, vz, vAng, scene) {
    this.mesh = mesh;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.vAng = vAng;
    this.scene = scene;

    this.life = 4.8; // Dissolves after settling
    this.fadeDuration = 1.6;
    this.isSettled = false;
    this.heldByRobot = false;
    this.thrownByRobot = false;
    this.radius = mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 0.8;
  }

  update(dt, floorY = 0) {
    if (this.heldByRobot) return true;

    this.life -= dt;

    // Dissolve & fade out to prevent screen clutter
    if (this.life <= this.fadeDuration) {
      const alpha = Math.max(0, this.life / this.fadeDuration);
      if (this.mesh.material) {
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = alpha;
      }
      const s = Math.max(0.01, alpha);
      this.mesh.scale.set(s, s, s);

      if (this.life <= 0) {
        this.dispose();
        return false;
      }
    }

    if (!this.isSettled) {
      this.vy -= 26 * dt;
      this.mesh.position.x += this.vx * dt;
      this.mesh.position.y += this.vy * dt;
      this.mesh.position.z += this.vz * dt;

      this.mesh.rotation.x += this.vAng.x * dt;
      this.mesh.rotation.y += this.vAng.y * dt;
      this.mesh.rotation.z += this.vAng.z * dt;

      this.vx *= 0.985;
      this.vz *= 0.985;

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

    // Use Procedural Stone / Metal / Wood Texture
    const geom = new THREE.BoxGeometry(w, h, d);
    let mat;

    if (theme === 'cyber' || theme === 'foundry') {
      const metalTex = TextureGen.createMetalTexture();
      mat = new THREE.MeshStandardMaterial({
        map: metalTex,
        bumpMap: metalTex,
        bumpScale: 0.08,
        color: 0x334155,
        metalness: 0.85,
        roughness: 0.25
      });
    } else if (theme === 'salon') {
      const woodTex = TextureGen.createWoodTexture();
      mat = new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: woodTex,
        bumpScale: 0.05,
        roughness: 0.45
      });
    } else {
      const stoneTex = TextureGen.createStoneBrickTexture();
      stoneTex.repeat.set(1.5, 1);
      mat = new THREE.MeshStandardMaterial({
        map: stoneTex,
        bumpMap: stoneTex,
        bumpScale: 0.12,
        roughness: 0.75,
        metalness: 0.15
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
    this.maxHp = options.hp || 140;
    this.hp = this.maxHp;
    this.isDestroyed = false;
    this.heldByRobot = false;

    this.group = new THREE.Group();
    this.group.position.set(options.x, options.y, options.z || 0);

    this.color = options.color || 0x64748b;
    this.w = options.w || 4;
    this.h = options.h || 14;
    this.d = options.d || 4;
    this.radius = Math.hypot(this.w, this.h) * 0.5;

    this.buildArchitecturalModel();
    this.scene.add(this.group);
  }

  buildArchitecturalModel() {
    const w = this.w;
    const h = this.h;
    const d = this.d;

    const stoneTex = TextureGen.createStoneBrickTexture();
    const woodTex = TextureGen.createWoodTexture();
    const metalTex = TextureGen.createMetalTexture();

    switch (this.type) {
      case 'tower':
        // Fortress Keep Watchtower with corbelled parapet, archer slits, and plinth
        const stoneMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          bumpMap: stoneTex,
          bumpScale: 0.15,
          roughness: 0.8,
          metalness: 0.15
        });

        // Flared Base Plinth
        const baseGeom = new THREE.BoxGeometry(w * 1.25, 2.5, d * 1.25);
        const baseMesh = new THREE.Mesh(baseGeom, stoneMat);
        baseMesh.position.y = 1.25;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.group.add(baseMesh);

        // Tower Shaft with Stone Courses
        const shaftGeom = new THREE.BoxGeometry(w, h - 5.0, d);
        const shaftMesh = new THREE.Mesh(shaftGeom, stoneMat);
        shaftMesh.position.y = (h - 5.0) / 2 + 2.5;
        shaftMesh.castShadow = true;
        shaftMesh.receiveShadow = true;
        this.group.add(shaftMesh);

        // Overhanging Corbelled Parapet Top
        const corbelGeom = new THREE.BoxGeometry(w * 1.3, 1.8, d * 1.3);
        const corbelMesh = new THREE.Mesh(corbelGeom, stoneMat);
        corbelMesh.position.y = h - 1.8;
        corbelMesh.castShadow = true;
        this.group.add(corbelMesh);

        // Crenel battlements
        const cCount = 3;
        for (let i = 0; i < cCount; i++) {
          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(w / 3.5, 1.4, d * 1.3), stoneMat);
          cMesh.position.set(-w / 2 + (i * 2 + 1) * (w / 6), h - 0.2, 0);
          cMesh.castShadow = true;
          this.group.add(cMesh);
        }

        // Archer Slit with glowing internal torchlight
        const slitMat = new THREE.MeshStandardMaterial({ color: 0x05070a });
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.0, 0.2), slitMat);
        slit.position.set(0, h * 0.55, d / 2 + 0.1);
        this.group.add(slit);

        const torchLight = new THREE.PointLight(0xf97316, 1.5, 12);
        torchLight.position.set(0, h * 0.55, d / 2 + 0.5);
        this.group.add(torchLight);
        break;

      case 'pillar':
        // Classical Fluted Doric Column with Astragal, Capital & Plinth
        const colStoneMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          bumpMap: stoneTex,
          bumpScale: 0.1,
          roughness: 0.7,
          metalness: 0.1
        });

        // Plinth Block
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, 1.2, w * 1.2), colStoneMat);
        plinth.position.y = 0.6;
        plinth.castShadow = true;
        this.group.add(plinth);

        // Fluted Column Shaft
        const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.48, h - 2.8, 20), colStoneMat);
        colShaft.position.y = (h - 2.8) / 2 + 1.2;
        colShaft.castShadow = true;
        colShaft.receiveShadow = true;
        this.group.add(colShaft);

        // Echinus & Abacus Capital
        const echinus = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.65, w * 0.45, 0.8, 16), colStoneMat);
        echinus.position.y = h - 1.2;
        this.group.add(echinus);

        const abacus = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 0.8, w * 1.3), colStoneMat);
        abacus.position.y = h - 0.4;
        abacus.castShadow = true;
        this.group.add(abacus);
        break;

      case 'server':
        // Cyberpunk Modular Blade Server Rack
        const srvMetalMat = new THREE.MeshStandardMaterial({
          map: metalTex,
          bumpMap: metalTex,
          bumpScale: 0.05,
          color: 0x1e293b,
          metalness: 0.85,
          roughness: 0.25
        });

        const rackBody = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), srvMetalMat);
        rackBody.position.y = h / 2;
        rackBody.castShadow = true;
        rackBody.receiveShadow = true;
        this.group.add(rackBody);

        // Recessed Blade Server Chassis Rows with Glowing LED Arrays
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3 });
        const ledCyan = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0 });
        const ledGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 1.0 });

        const rows = Math.floor(h / 2.5);
        for (let r = 1; r < rows; r++) {
          const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 1.8, 0.4), bladeMat);
          bMesh.position.set(0, r * 2.4, d / 2 + 0.1);
          this.group.add(bMesh);

          for (let l = 0; l < 4; l++) {
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), l % 2 === 0 ? ledCyan : ledGreen);
            led.position.set(-w * 0.3 + l * 0.45, r * 2.4, d / 2 + 0.35);
            this.group.add(led);
          }
        }
        break;

      case 'terminal':
        // Holographic Command Console
        const consoleMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.3, metalness: 0.8 });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), consoleMat);
        desk.position.y = 1.25;
        desk.castShadow = true;
        this.group.add(desk);

        // Volumetric Hologram Projection Emitter
        const holoMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.5
        });
        const holo = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.3, 3.5, 16, 1, true), holoMat);
        holo.position.set(0, 3.5, 0);
        this.group.add(holo);

        const holoLight = new THREE.PointLight(0x38bdf8, 2.0, 14);
        holoLight.position.set(0, 3.5, 0);
        this.group.add(holoLight);
        break;

      case 'chandelier':
        // Crystal Chandelier with Gold Filigree
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.45, 0.25, 8, 20), brassMat);
        ring.position.y = h / 2;
        ring.rotation.x = Math.PI / 2;
        this.group.add(ring);

        const candleLight = new THREE.PointLight(0xf59e0b, 2.0, 20);
        candleLight.position.set(0, h / 2 + 0.5, 0);
        this.group.add(candleLight);
        break;

      default:
        const defMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          bumpMap: stoneTex,
          bumpScale: 0.1,
          roughness: 0.7
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), defMat);
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

    this.buildSubterraneanShaft();
  }

  buildSubterraneanShaft() {
    this.shaftGroup = new THREE.Group();
    const stoneTex = TextureGen.createStoneBrickTexture();
    const ringMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      bumpMap: stoneTex,
      bumpScale: 0.15,
      color: 0x1e293b,
      roughness: 0.8
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

    const slabCount = 12;
    const slabW = 64 / slabCount;
    for (let i = 0; i < slabCount; i++) {
      const slabX = -32 + i * slabW + slabW / 2;
      this.floorSlabs.push(new FloorSlab3D(i, slabX, this.floorY, 0, slabW * 0.96, 2.5, 18, theme, this.scene));
    }

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
