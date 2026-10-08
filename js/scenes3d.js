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

    this.maxHp = 160;
    this.hp = this.maxHp;
    this.collapsed = false;
    this.fallVy = 0;
    this.fallVAng = (Math.random() - 0.5) * 3;

    const geom = new THREE.BoxGeometry(w, h, d);
    let mat;

    if (theme === 'bunker') {
      const cyberTex = TextureGen.createCyberGridTexture();
      this.debrisColor = 0x06b6d4;
      mat = new THREE.MeshStandardMaterial({
        map: cyberTex,
        bumpMap: cyberTex,
        bumpScale: 0.05,
        color: 0x0f172a,
        metalness: 0.9,
        roughness: 0.18
      });
    } else if (theme === 'foundry') {
      const lavaTex = TextureGen.createObsidianLavaTexture();
      this.debrisColor = 0xea580c;
      mat = new THREE.MeshStandardMaterial({
        map: lavaTex,
        bumpMap: lavaTex,
        bumpScale: 0.18,
        color: 0x262626,
        emissive: 0xea580c,
        emissiveIntensity: 0.35,
        roughness: 0.85
      });
    } else if (theme === 'crypt') {
      const cryptTex = TextureGen.createMossyCryptTexture();
      this.debrisColor = 0x164e33;
      mat = new THREE.MeshStandardMaterial({
        map: cryptTex,
        bumpMap: cryptTex,
        bumpScale: 0.16,
        color: 0x2d4a3e,
        roughness: 0.9
      });
    } else if (theme === 'salon') {
      const woodTex = TextureGen.createWoodTexture();
      this.debrisColor = 0x92400e;
      mat = new THREE.MeshStandardMaterial({
        map: woodTex,
        bumpMap: woodTex,
        bumpScale: 0.06,
        roughness: 0.35,
        metalness: 0.08
      });
    } else if (theme === 'ruins') {
      const sandTex = TextureGen.createSandstoneTexture();
      this.debrisColor = 0xb45309;
      mat = new THREE.MeshStandardMaterial({
        map: sandTex,
        bumpMap: sandTex,
        bumpScale: 0.14,
        color: 0xd97706,
        roughness: 0.88
      });
    } else {
      // castle
      const stoneTex = TextureGen.createStoneBrickTexture();
      this.debrisColor = 0x475569;
      mat = new THREE.MeshStandardMaterial({
        map: stoneTex,
        bumpMap: stoneTex,
        bumpScale: 0.15,
        color: 0x334155,
        roughness: 0.8,
        metalness: 0.12
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

    if (this.mesh && this.mesh.material) {
      this.mesh.material.emissive.setHex(0xffaa44);
      setTimeout(() => {
        if (this.mesh && this.mesh.material) {
          const resetEmissive = this.theme === 'foundry' ? 0xea580c : 0x000000;
          this.mesh.material.emissive.setHex(resetEmissive);
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
    physics3D.addTrauma(0.35);

    this.fallVy = 6 + Math.random() * 8;

    physics3D.createDebrisFromBox3D(
      this.mesh.position.x,
      this.mesh.position.y,
      this.mesh.position.z,
      this.w,
      this.h,
      this.d,
      this.debrisColor || 0x475569,
      6
    );
  }

  update(dt) {
    if (this.collapsed) {
      this.fallVy += 42 * dt;
      this.mesh.position.y -= this.fallVy * dt;
      this.mesh.rotation.z += this.fallVAng * dt;

      if (this.mesh.position.y < -80) {
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
    const cyberTex = TextureGen.createCyberGridTexture();
    const lavaTex = TextureGen.createObsidianLavaTexture();
    const cryptTex = TextureGen.createMossyCryptTexture();
    const sandTex = TextureGen.createSandstoneTexture();
    const hazardTex = TextureGen.createHazardTexture();

    switch (this.type) {
      case 'tower': {
        const stoneMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          bumpMap: stoneTex,
          bumpScale: 0.15,
          roughness: 0.8,
          metalness: 0.15
        });

        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.25, 2.5, d * 1.25), stoneMat);
        baseMesh.position.y = 1.25;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.group.add(baseMesh);

        const shaftMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h - 5.0, d), stoneMat);
        shaftMesh.position.y = (h - 5.0) / 2 + 2.5;
        shaftMesh.castShadow = true;
        shaftMesh.receiveShadow = true;
        this.group.add(shaftMesh);

        const corbelMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 1.8, d * 1.3), stoneMat);
        corbelMesh.position.y = h - 1.8;
        corbelMesh.castShadow = true;
        this.group.add(corbelMesh);

        for (let i = 0; i < 3; i++) {
          const cMesh = new THREE.Mesh(new THREE.BoxGeometry(w / 3.5, 1.4, d * 1.3), stoneMat);
          cMesh.position.set(-w / 2 + (i * 2 + 1) * (w / 6), h - 0.2, 0);
          cMesh.castShadow = true;
          this.group.add(cMesh);
        }

        const slitMat = new THREE.MeshStandardMaterial({ color: 0x05070a });
        const slit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.0, 0.2), slitMat);
        slit.position.set(0, h * 0.55, d / 2 + 0.1);
        this.group.add(slit);

        const torchLight = new THREE.PointLight(0xf97316, 1.6, 16);
        torchLight.position.set(0, h * 0.55, d / 2 + 0.5);
        this.group.add(torchLight);
        break;
      }

      case 'pillar': {
        const colStoneMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          bumpMap: stoneTex,
          bumpScale: 0.1,
          roughness: 0.7,
          metalness: 0.1
        });

        const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 1.2, 1.2, w * 1.2), colStoneMat);
        plinth.position.y = 0.6;
        plinth.castShadow = true;
        this.group.add(plinth);

        const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.48, h - 2.8, 20), colStoneMat);
        colShaft.position.y = (h - 2.8) / 2 + 1.2;
        colShaft.castShadow = true;
        colShaft.receiveShadow = true;
        this.group.add(colShaft);

        const echinus = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.65, w * 0.45, 0.8, 16), colStoneMat);
        echinus.position.y = h - 1.2;
        this.group.add(echinus);

        const abacus = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 0.8, w * 1.3), colStoneMat);
        abacus.position.y = h - 0.4;
        abacus.castShadow = true;
        this.group.add(abacus);
        break;
      }

      case 'gate': {
        const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.3 });

        const turL = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.25, h, 16), stoneMat);
        turL.position.set(-w * 0.38, h / 2, 0);
        turL.castShadow = true;
        this.group.add(turL);

        const turR = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.25, h, 16), stoneMat);
        turR.position.set(w * 0.38, h / 2, 0);
        turR.castShadow = true;
        this.group.add(turR);

        const arch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 3.2, d), stoneMat);
        arch.position.set(0, h - 1.6, 0);
        arch.castShadow = true;
        this.group.add(arch);

        const barCount = 7;
        for (let b = 0; b < barCount; b++) {
          const barX = -w * 0.28 + b * (w * 0.56 / (barCount - 1));
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h - 4.5), ironMat);
          bar.position.set(barX, (h - 4.5) / 2, 0);
          this.group.add(bar);
        }
        break;
      }

      case 'sarcophagus': {
        const cryptMat = new THREE.MeshStandardMaterial({ map: cryptTex, bumpScale: 0.18, roughness: 0.85 });
        const chest = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.65, d), cryptMat);
        chest.position.y = (h * 0.65) / 2;
        chest.castShadow = true;
        this.group.add(chest);

        const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, h * 0.3, d * 1.08), cryptMat);
        lid.position.y = h * 0.65 + (h * 0.3) / 2;
        lid.castShadow = true;
        this.group.add(lid);

        const soulMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.2 });
        const soulGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), soulMat);
        soulGem.position.set(0, h + 0.8, 0);
        this.group.add(soulGem);

        const soulLight = new THREE.PointLight(0x10b981, 2.2, 18);
        soulLight.position.set(0, h + 1.0, 0);
        this.group.add(soulLight);
        break;
      }

      case 'brazier_pillar': {
        const cryptMat = new THREE.MeshStandardMaterial({ map: cryptTex, bumpScale: 0.16, roughness: 0.88 });
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.35 });

        const col = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.38, w * 0.44, h - 2.8, 16), cryptMat);
        col.position.y = (h - 2.8) / 2;
        col.castShadow = true;
        this.group.add(col);

        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.6, w * 0.25, 2.0, 16), ironMat);
        bowl.position.y = h - 1.8;
        this.group.add(bowl);

        const flameMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.4 });
        const flame = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, 3.2, 8), flameMat);
        flame.position.y = h + 0.6;
        this.group.add(flame);

        const bLight = new THREE.PointLight(0x10b981, 2.4, 20);
        bLight.position.set(0, h + 1.0, 0);
        this.group.add(bLight);
        break;
      }

      case 'gargoyle': {
        const cryptMat = new THREE.MeshStandardMaterial({ map: cryptTex, roughness: 0.9 });
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.55, h * 0.65, 8), cryptMat);
        pedestal.position.y = (h * 0.65) / 2;
        pedestal.castShadow = true;
        this.group.add(pedestal);

        const gargMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
        const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(w * 0.38), gargMat);
        torso.position.y = h * 0.65 + w * 0.38;
        this.group.add(torso);

        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 });
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), eyeMat);
        eyeL.position.set(-0.35, h * 0.65 + w * 0.42, w * 0.32);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), eyeMat);
        eyeR.position.set(0.35, h * 0.65 + w * 0.42, w * 0.32);
        this.group.add(eyeL);
        this.group.add(eyeR);
        break;
      }

      case 'server': {
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

        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3 });
        const ledCyan = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.2 });
        const ledGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 1.2 });

        const rows = Math.floor(h / 2.8);
        for (let r = 1; r < rows; r++) {
          const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 2.0, 0.4), bladeMat);
          bMesh.position.set(0, r * 2.8, d / 2 + 0.1);
          this.group.add(bMesh);

          for (let l = 0; l < 4; l++) {
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), l % 2 === 0 ? ledCyan : ledGreen);
            led.position.set(-w * 0.3 + l * 0.45, r * 2.8, d / 2 + 0.35);
            this.group.add(led);
          }
        }
        break;
      }

      case 'terminal': {
        const consoleMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.3, metalness: 0.8 });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), consoleMat);
        desk.position.y = 1.4;
        desk.castShadow = true;
        this.group.add(desk);

        const holoMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.55
        });
        const holo = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.3, 3.8, 16, 1, true), holoMat);
        holo.position.set(0, 4.0, 0);
        this.group.add(holo);

        const holoLight = new THREE.PointLight(0x38bdf8, 2.2, 16);
        holoLight.position.set(0, 4.0, 0);
        this.group.add(holoLight);
        break;
      }

      case 'reactor': {
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
        const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.55, 3.0, 16), darkMetal);
        coreBase.position.y = 1.5;
        this.group.add(coreBase);

        const coreCap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.5, 3.0, 16), darkMetal);
        coreCap.position.y = h - 1.5;
        this.group.add(coreCap);

        const plasmaMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x06b6d4,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.85
        });
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.3, h - 5.5, 16), plasmaMat);
        tube.position.y = h / 2;
        this.group.add(tube);

        const ringMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 1.0 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.45, 0.25, 8, 20), ringMat);
        ring.position.y = h / 2;
        this.group.add(ring);

        const rLight = new THREE.PointLight(0x06b6d4, 2.8, 22);
        rLight.position.set(0, h / 2, 0);
        this.group.add(rLight);
        break;
      }

      case 'smelter': {
        const basaltMat = new THREE.MeshStandardMaterial({ map: lavaTex, bumpScale: 0.2, roughness: 0.85 });
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.5, h, 16), basaltMat);
        chimney.position.y = h / 2;
        chimney.castShadow = true;
        this.group.add(chimney);

        const magmaMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.8 });
        const crucible = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, 3.5, 12), magmaMat);
        crucible.position.set(0, 2.2, w * 0.2);
        this.group.add(crucible);

        const sLight = new THREE.PointLight(0xea580c, 3.2, 25);
        sLight.position.set(0, 3.0, w * 0.3);
        this.group.add(sLight);
        break;
      }

      case 'cauldron': {
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.9, roughness: 0.4 });
        const vat = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.35, h * 0.75, 16), ironMat);
        vat.position.y = (h * 0.75) / 2;
        vat.castShadow = true;
        this.group.add(vat);

        const lavaMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf97316, emissiveIntensity: 1.6 });
        const surface = new THREE.Mesh(new THREE.CircleGeometry(w * 0.44, 16), lavaMat);
        surface.position.y = h * 0.72;
        surface.rotation.x = -Math.PI / 2;
        this.group.add(surface);

        const cLight = new THREE.PointLight(0xf97316, 2.5, 18);
        cLight.position.set(0, h * 0.8, 0);
        this.group.add(cLight);
        break;
      }

      case 'turbine': {
        const darkMetal = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.3, metalness: 0.85 });
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, h, 20), darkMetal);
        cyl.rotation.z = Math.PI / 2;
        cyl.position.y = h * 0.45;
        cyl.castShadow = true;
        this.group.add(cyl);

        const hzMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.4 });
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.44, w * 0.44, 2.5, 16), hzMat);
        belt.rotation.z = Math.PI / 2;
        belt.position.y = h * 0.45;
        this.group.add(belt);
        break;
      }

      case 'chandelier': {
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.45, 0.25, 8, 20), brassMat);
        ring.position.y = h / 2;
        ring.rotation.x = Math.PI / 2;
        this.group.add(ring);

        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(w * 0.25, 0.2, 8, 16), brassMat);
        ring2.position.y = h / 2 - 1.5;
        ring2.rotation.x = Math.PI / 2;
        this.group.add(ring2);

        const candleLight = new THREE.PointLight(0xf59e0b, 2.8, 26);
        candleLight.position.set(0, h / 2 + 0.5, 0);
        this.group.add(candleLight);
        break;
      }

      case 'bookcase': {
        const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.4 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
        frame.position.y = h / 2;
        frame.castShadow = true;
        this.group.add(frame);

        const bookColors = [0x991b1b, 0x166534, 0x1e3a8a, 0x854d0e];
        for (let r = 1; r < 4; r++) {
          const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[r % bookColors.length], roughness: 0.6 });
          const bookRow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 2.2, d * 0.5), bookMat);
          bookRow.position.set(0, r * (h / 4), d * 0.25);
          this.group.add(bookRow);
        }
        break;
      }

      case 'fireplace': {
        const marbleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25 });
        const mantel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), marbleMat);
        mantel.position.y = h / 2;
        mantel.castShadow = true;
        this.group.add(mantel);

        const fireCavity = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.55, d * 0.6), new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
        fireCavity.position.set(0, (h * 0.55) / 2 + 0.5, d * 0.25);
        this.group.add(fireCavity);

        const fireMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 1.6 });
        const fire = new THREE.Mesh(new THREE.ConeGeometry(w * 0.2, 2.5, 8), fireMat);
        fire.position.set(0, 1.8, d * 0.25);
        this.group.add(fire);

        const fLight = new THREE.PointLight(0xf59e0b, 2.2, 18);
        fLight.position.set(0, 2.5, d * 0.35);
        this.group.add(fLight);
        break;
      }

      case 'obelisk': {
        const obeliskMat = new THREE.MeshStandardMaterial({ map: sandTex, bumpScale: 0.15, roughness: 0.85 });
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.28, w * 0.45, h - 3.5, 4), obeliskMat);
        shaft.position.y = (h - 3.5) / 2;
        shaft.rotation.y = Math.PI / 4;
        shaft.castShadow = true;
        this.group.add(shaft);

        const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.15 });
        const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.4, 3.5, 4), goldMat);
        cap.position.y = h - 1.75;
        cap.rotation.y = Math.PI / 4;
        cap.castShadow = true;
        this.group.add(cap);
        break;
      }

      case 'lotus_pillar': {
        const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, bumpScale: 0.12, roughness: 0.85 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.55, 1.6, 16), sandMat);
        base.position.y = 0.8;
        this.group.add(base);

        const col = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.38, w * 0.42, h - 3.2, 16), sandMat);
        col.position.y = (h - 3.2) / 2 + 1.6;
        col.castShadow = true;
        this.group.add(col);

        const lotus = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.65, w * 0.38, 2.0, 16), sandMat);
        lotus.position.y = h - 1.0;
        this.group.add(lotus);
        break;
      }

      case 'sun_altar': {
        const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.88 });
        const dais = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), sandMat);
        dais.position.y = 1.25;
        dais.castShadow = true;
        this.group.add(dais);

        const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.0, metalness: 0.9, roughness: 0.2 });
        const sunDisc = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.35, 0.4, 24), goldMat);
        sunDisc.position.set(0, h * 0.65, 0);
        sunDisc.rotation.x = Math.PI / 2;
        this.group.add(sunDisc);

        const aLight = new THREE.PointLight(0xfbbf24, 2.5, 20);
        aLight.position.set(0, h * 0.65, 1.0);
        this.group.add(aLight);
        break;
      }

      default: {
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
  }

  isAlive() {
    return this.hp > 0 && !this.isDestroyed && !this.heldByRobot;
  }

  contains3D(x, y, z) {
    if (this.isDestroyed || this.heldByRobot) return false;
    const px = this.group.position.x;
    const py = this.group.position.y;
    const pz = this.group.position.z || 0;
    const zMatch = z === undefined ? true : (z >= pz - this.d / 2 - 1.2 && z <= pz + this.d / 2 + 1.2);
    return (
      x >= px - this.w / 2 &&
      x <= px + this.w / 2 &&
      y >= py &&
      y <= py + this.h &&
      zMatch
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
  constructor(scene, camera, lights = null) {
    this.scene = scene;
    this.camera = camera;
    this.lights = lights;
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

  setLights(lights) {
    this.lights = lights;
  }

  setupAtmosphere(sceneId) {
    if (!this.lights) return;
    const { ambLight, sunLight, rimLight, biomeLight } = this.lights;

    switch (sceneId) {
      case 'castle':
        this.scene.background = new THREE.Color(0x070b19);
        this.scene.fog = new THREE.FogExp2(0x070b19, 0.0075);
        if (ambLight) {
          ambLight.color.setHex(0x1e1b4b);
          ambLight.intensity = 0.65;
        }
        if (sunLight) {
          sunLight.color.setHex(0x93c5fd);
          sunLight.intensity = 1.3;
          sunLight.position.set(24, 42, 28);
        }
        if (rimLight) {
          rimLight.color.setHex(0x38bdf8);
          rimLight.intensity = 0.8;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0xf97316);
          biomeLight.intensity = 1.8;
          biomeLight.position.set(0, 10, 4);
        }
        break;

      case 'crypt':
        this.scene.background = new THREE.Color(0x021a0f);
        this.scene.fog = new THREE.FogExp2(0x021a0f, 0.009);
        if (ambLight) {
          ambLight.color.setHex(0x064e3b);
          ambLight.intensity = 0.75;
        }
        if (sunLight) {
          sunLight.color.setHex(0x34d399);
          sunLight.intensity = 1.0;
          sunLight.position.set(12, 38, 20);
        }
        if (rimLight) {
          rimLight.color.setHex(0x10b981);
          rimLight.intensity = 1.2;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0x059669);
          biomeLight.intensity = 2.6;
          biomeLight.position.set(0, 8, 4);
        }
        break;

      case 'bunker':
        this.scene.background = new THREE.Color(0x01030a);
        this.scene.fog = new THREE.FogExp2(0x01030a, 0.0065);
        if (ambLight) {
          ambLight.color.setHex(0x0284c7);
          ambLight.intensity = 0.45;
        }
        if (sunLight) {
          sunLight.color.setHex(0xe2e8f0);
          sunLight.intensity = 1.5;
          sunLight.position.set(30, 45, 20);
        }
        if (rimLight) {
          rimLight.color.setHex(0xf43f5e);
          rimLight.intensity = 1.5;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0x06b6d4);
          biomeLight.intensity = 2.5;
          biomeLight.position.set(0, 10, 4);
        }
        break;

      case 'foundry':
        this.scene.background = new THREE.Color(0x200505);
        this.scene.fog = new THREE.FogExp2(0x200505, 0.008);
        if (ambLight) {
          ambLight.color.setHex(0x7f1d1d);
          ambLight.intensity = 0.9;
        }
        if (sunLight) {
          sunLight.color.setHex(0xf97316);
          sunLight.intensity = 1.7;
          sunLight.position.set(-15, 38, 22);
        }
        if (rimLight) {
          rimLight.color.setHex(0xfef08a);
          rimLight.intensity = 1.3;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0xea580c);
          biomeLight.intensity = 3.2;
          biomeLight.position.set(0, 6, 4);
        }
        break;

      case 'salon':
        this.scene.background = new THREE.Color(0x160f0f);
        this.scene.fog = new THREE.FogExp2(0x160f0f, 0.006);
        if (ambLight) {
          ambLight.color.setHex(0x451a03);
          ambLight.intensity = 0.7;
        }
        if (sunLight) {
          sunLight.color.setHex(0xfde68a);
          sunLight.intensity = 1.3;
          sunLight.position.set(20, 36, 25);
        }
        if (rimLight) {
          rimLight.color.setHex(0xfef3c7);
          rimLight.intensity = 0.85;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0xf59e0b);
          biomeLight.intensity = 2.6;
          biomeLight.position.set(0, 14, 2);
        }
        break;

      case 'ruins':
      default:
        this.scene.background = new THREE.Color(0x3b2308);
        this.scene.fog = new THREE.FogExp2(0x3b2308, 0.0065);
        if (ambLight) {
          ambLight.color.setHex(0x78350f);
          ambLight.intensity = 0.85;
        }
        if (sunLight) {
          sunLight.color.setHex(0xfef9c3);
          sunLight.intensity = 2.0;
          sunLight.position.set(8, 48, 18);
        }
        if (rimLight) {
          rimLight.color.setHex(0xffedd5);
          rimLight.intensity = 1.1;
        }
        if (biomeLight) {
          biomeLight.color.setHex(0xfbbf24);
          biomeLight.intensity = 2.2;
          biomeLight.position.set(0, 10, 4);
        }
        break;
    }
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
      const ringGeom = new THREE.CylinderGeometry(65, 65, 10, 32, 1, true);
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.y = -r * 14 - 10;
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
    const order = ['castle', 'crypt', 'bunker', 'foundry', 'salon', 'ruins'];
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

    // Apply Biome Atmosphere & Lighting
    this.setupAtmosphere(sceneId);

    // Build Wide Panoramic 96-Unit Floor (16 Slabs)
    const slabCount = 16;
    const totalW = 96;
    const slabW = totalW / slabCount;
    for (let i = 0; i < slabCount; i++) {
      const slabX = -totalW / 2 + i * slabW + slabW / 2;
      this.floorSlabs.push(new FloorSlab3D(i, slabX, this.floorY, 0, slabW * 0.96, 2.8, 22, sceneId, this.scene));
    }

    // Deploy 5-6 Distinct Architectural Monuments per Biome across Panoramic View
    switch (sceneId) {
      case 'castle':
        this.currentSceneName = 'Castle Courtyard';
        this.props.push(new SceneryProp3D({ name: 'Keep Watchtower Left', x: -40, y: 0, z: -2, w: 7, h: 24, d: 7, type: 'tower', hp: 320, color: 0x475569 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Heraldic Pillar Alpha', x: -24, y: 0, z: -1, w: 3.5, h: 17, d: 3.5, type: 'pillar', hp: 200, color: 0x64748b }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Royal Portcullis Gate', x: 0, y: 0, z: -3, w: 12, h: 18, d: 5, type: 'gate', hp: 350, color: 0x334155 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Heraldic Pillar Beta', x: 24, y: 0, z: -1, w: 3.5, h: 17, d: 3.5, type: 'pillar', hp: 200, color: 0x64748b }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Keep Watchtower Right', x: 40, y: 0, z: -2, w: 7, h: 24, d: 7, type: 'tower', hp: 320, color: 0x475569 }, this.scene));
        break;

      case 'crypt':
        this.currentSceneName = 'Dungeon Crypt';
        this.props.push(new SceneryProp3D({ name: 'Catacomb Brazier Pillar Left', x: -38, y: 0, z: -2, w: 4.5, h: 20, d: 4.5, type: 'brazier_pillar', hp: 240, color: 0x1e3a2f }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Gargoyle Altar Left', x: -22, y: 0, z: -1, w: 5, h: 10, d: 5, type: 'gargoyle', hp: 180, color: 0x2d4a3e }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Imperial Stone Sarcophagus', x: 0, y: 0, z: -1, w: 10, h: 7, d: 5, type: 'sarcophagus', hp: 300, color: 0x164e33 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Gargoyle Altar Right', x: 22, y: 0, z: -1, w: 5, h: 10, d: 5, type: 'gargoyle', hp: 180, color: 0x2d4a3e }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Catacomb Brazier Pillar Right', x: 38, y: 0, z: -2, w: 4.5, h: 20, d: 4.5, type: 'brazier_pillar', hp: 240, color: 0x1e3a2f }, this.scene));
        break;

      case 'bunker':
        this.currentSceneName = 'Cyberpunk Bunker';
        this.props.push(new SceneryProp3D({ name: 'Mainframe Cluster Alpha', x: -38, y: 0, z: -2, w: 6, h: 22, d: 5, type: 'server', hp: 280, color: 0x0f172a }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Quantum Plasma Reactor', x: -18, y: 0, z: -2, w: 6, h: 17, d: 6, type: 'reactor', hp: 300, color: 0x06b6d4 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Holo Command Matrix', x: 0, y: 0, z: -1, w: 10, h: 7, d: 5, type: 'terminal', hp: 220, color: 0x38bdf8 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Defense Reactor Pylon', x: 20, y: 0, z: -2, w: 6, h: 17, d: 6, type: 'reactor', hp: 280, color: 0x06b6d4 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Mainframe Cluster Beta', x: 38, y: 0, z: -2, w: 6, h: 22, d: 5, type: 'server', hp: 280, color: 0x0f172a }, this.scene));
        break;

      case 'foundry':
        this.currentSceneName = 'Magma Core Foundry';
        this.props.push(new SceneryProp3D({ name: 'Industrial Blast Smelter Left', x: -38, y: 0, z: -2, w: 8, h: 23, d: 8, type: 'smelter', hp: 350, color: 0xea580c }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Slag Boiling Cauldron Alpha', x: -18, y: 0, z: -1, w: 6, h: 8, d: 6, type: 'cauldron', hp: 220, color: 0xf97316 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Heavy Pressure Turbine', x: 0, y: 0, z: -2, w: 8, h: 16, d: 8, type: 'turbine', hp: 320, color: 0x334155 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Slag Boiling Cauldron Beta', x: 18, y: 0, z: -1, w: 6, h: 8, d: 6, type: 'cauldron', hp: 220, color: 0xf97316 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Industrial Blast Smelter Right', x: 38, y: 0, z: -2, w: 8, h: 23, d: 8, type: 'smelter', hp: 350, color: 0xea580c }, this.scene));
        break;

      case 'salon':
        this.currentSceneName = 'Grand Manor Salon';
        this.props.push(new SceneryProp3D({ name: 'Mahogany Bookcase Left', x: -38, y: 0, z: -2, w: 8, h: 20, d: 4, type: 'bookcase', hp: 240, color: 0x92400e }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Carved Marble Fireplace', x: -18, y: 0, z: -2, w: 8, h: 12, d: 4, type: 'fireplace', hp: 280, color: 0xe2e8f0 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Grand Crystal Chandelier', x: 0, y: 16, z: 0, w: 8, h: 8, d: 8, type: 'chandelier', hp: 160, color: 0xf59e0b }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Classical Parlor Bookcase', x: 18, y: 0, z: -2, w: 7, h: 16, d: 4, type: 'bookcase', hp: 220, color: 0x92400e }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Mahogany Bookcase Right', x: 38, y: 0, z: -2, w: 8, h: 20, d: 4, type: 'bookcase', hp: 240, color: 0x92400e }, this.scene));
        break;

      case 'ruins':
      default:
        this.currentSceneName = 'Sunken Pharaoh Temple';
        this.props.push(new SceneryProp3D({ name: 'Sandstone Pharaoh Obelisk Left', x: -38, y: 0, z: -2, w: 5, h: 26, d: 5, type: 'obelisk', hp: 340, color: 0xd97706 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Lotus Blossom Pillar Alpha', x: -20, y: 0, z: -1, w: 4, h: 18, d: 4, type: 'lotus_pillar', hp: 220, color: 0xb45309 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Golden Ra Sun Altar', x: 0, y: 0, z: -1, w: 10, h: 10, d: 6, type: 'sun_altar', hp: 300, color: 0xf59e0b }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Lotus Blossom Pillar Beta', x: 20, y: 0, z: -1, w: 4, h: 18, d: 4, type: 'lotus_pillar', hp: 220, color: 0xb45309 }, this.scene));
        this.props.push(new SceneryProp3D({ name: 'Sandstone Pharaoh Obelisk Right', x: 38, y: 0, z: -2, w: 5, h: 26, d: 5, type: 'obelisk', hp: 340, color: 0xd97706 }, this.scene));
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

    // 1. Shatter any remaining intact props
    for (const p of this.props) {
      if (p.isAlive()) {
        p.destroy(physics3D);
      }
    }

    // 2. Collapse all remaining floor slabs
    for (const slab of this.floorSlabs) {
      if (!slab.collapsed) slab.collapse(physics3D);
    }

    // 3. Accelerate dissolve of all debris remnants so everything vanishes
    physics3D.accelerateDebrisDissolve();
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
        color: s.debrisColor || 0x475569
      };
    }
    return null;
  }

  isSlabCollapsedAt(worldX) {
    if (this.isCollapsing) return true;
    if (worldX < -48 || worldX > 48) return true;
    for (const slab of this.floorSlabs) {
      if (Math.abs(slab.x - worldX) <= slab.w / 2) {
        return slab.collapsed;
      }
    }
    return true;
  }

  isFloorIntactAt(worldX) {
    return !this.isSlabCollapsedAt(worldX);
  }

  getNearestIntactSlabX(worldX) {
    const intact = this.floorSlabs.filter(s => !s.collapsed);
    if (intact.length === 0) return 0;
    intact.sort((a, b) => Math.abs(a.x - worldX) - Math.abs(b.x - worldX));
    return intact[0].x;
  }

  update(dt, physics3D) {
    for (const slab of this.floorSlabs) slab.update(dt);

    const destructionPct = this.getDestructionPercentage();
    const collapsedCount = this.floorSlabs.filter(s => s.collapsed).length;

    // Trigger collapse when 85% destroyed or >= 50% of floor slabs collapsed
    if (!this.collapseTriggered && (destructionPct >= 85 || collapsedCount >= this.floorSlabs.length * 0.5)) {
      this.triggerCollapse(physics3D);
    }

    if (this.isCollapsing) {
      this.freefallTimer += dt;
      this.freefallProgress = Math.min(1.0, this.freefallTimer / 2.6);
      this.freefallSpeed = 50 + this.freefallProgress * 90;

      // Dissolve all remaining falling slabs into transparency as they plunge
      const alpha = Math.max(0, 1.0 - this.freefallProgress * 1.6);
      for (const slab of this.floorSlabs) {
        if (slab.mesh && slab.mesh.material) {
          slab.mesh.material.transparent = true;
          slab.mesh.material.opacity = alpha;
        }
      }

      for (const ring of this.shaftRings) {
        ring.position.y += this.freefallSpeed * dt;
        if (ring.position.y > 60) {
          ring.position.y -= 24 * 14;
        }
      }

      physics3D.addTrauma(0.04);

      if (this.freefallProgress >= 1.0) {
        // Clear all debris completely so no remnants linger
        physics3D.clearAllDebris();
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
