// Procedural Texture Generator for Three.js PBR Materials
// Provides distinct, high-resolution textures tailored to each biome:
// Castle Granite, Cyberpunk Grid, Volcanic Magma, Mossy Crypt, Luxury Parquet, and Desert Sandstone.

class TextureGen {
  // 1. CASTLE GRANITE MASONRY (Stormy Fortress)
  static createStoneBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a'; // Deep dark slate mortar
    ctx.fillRect(0, 0, 512, 512);

    const rows = 10;
    const rowH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const cols = 5;
      const colW = 512 / cols;
      const offset = (r % 2) * (colW * 0.5);

      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const pad = 4;
        const tone = 60 + Math.floor(Math.sin(r * 4 + c * 5) * 16);
        ctx.fillStyle = `rgb(${tone - 4}, ${tone}, ${tone + 8})`;
        ctx.fillRect(x + pad, y + pad, colW - pad * 2, rowH - pad * 2);

        // Stone bevel edge highlights
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + pad, y + pad, colW - pad * 2, rowH - pad * 2);

        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(x + pad, y + rowH - pad);
        ctx.lineTo(x + pad, y + pad);
        ctx.lineTo(x + colW - pad, y + pad);
        ctx.stroke();

        // Grit speckles
        for (let p = 0; p < 30; p++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)';
          ctx.fillRect(x + pad + Math.random() * (colW - pad * 2), y + pad + Math.random() * (rowH - pad * 2), 2, 2);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 2. CYBERPUNK NEON MATRIX (Holographic Obsidian Grid)
  static createCyberGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Deep void black obsidian
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, 512, 512);

    // Glowing Cyan Grid
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    const gridSpacing = 64;
    for (let x = 0; x <= 512; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Hot pink neon accent nodes
    ctx.fillStyle = '#ec4899';
    for (let x = 0; x <= 512; x += gridSpacing) {
      for (let y = 0; y <= 512; y += gridSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 3. VOLCANIC BASALT WITH GLOWING LAVA VEINS (Magma Core)
  static createObsidianLavaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Scorched dark basalt base
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 512, 512);

    // Glowing Molten Lava Fissures
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ea580c';
    ctx.shadowBlur = 12;

    const paths = [
      [[0, 120], [140, 180], [280, 130], [512, 220]],
      [[80, 0], [190, 240], [220, 390], [340, 512]],
      [[280, 130], [360, 320], [512, 380]],
      [[0, 420], [180, 360], [390, 460], [512, 440]]
    ];

    for (const p of paths) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) {
        ctx.lineTo(p[i][0], p[i][1]);
      }
      ctx.stroke();

      // Yellow-hot magma core line
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Basalt rock crust patches
    ctx.shadowBlur = 0;
    for (let b = 0; b < 24; b++) {
      ctx.fillStyle = 'rgba(10, 8, 6, 0.65)';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 25 + Math.random() * 35, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 4. MOSSY SLIME COBBLESTONE (Forgotten Crypt)
  static createMossyCryptTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#064e3b'; // Dark moss underlayer
    ctx.fillRect(0, 0, 512, 512);

    // Ancient cracked tombstones
    const stones = 8;
    const sSize = 512 / stones;
    for (let r = 0; r < stones; r++) {
      for (let c = 0; c < stones; c++) {
        const x = c * sSize + 3;
        const y = r * sSize + 3;
        const tone = 45 + Math.floor(Math.sin(r + c * 3) * 12);
        ctx.fillStyle = `rgb(${tone - 10}, ${tone + 10}, ${tone - 5})`;
        ctx.fillRect(x, y, sSize - 6, sSize - 6);

        // Green mold patches
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.beginPath();
        ctx.arc(x + sSize * 0.4, y + sSize * 0.4, sSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 5. GOLDEN OAK PARQUET (Grand Manor Ballroom)
  static createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#92400e'; // Rich warm honey oak
    ctx.fillRect(0, 0, 512, 512);

    // Herringbone parquet planks
    for (let y = 0; y < 512; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? 'rgba(69, 26, 3, 0.4)' : 'rgba(217, 119, 6, 0.15)';
      ctx.fillRect(0, y, 512, 2);
    }
    for (let x = 0; x < 512; x += 64) {
      ctx.fillStyle = 'rgba(69, 26, 3, 0.35)';
      ctx.fillRect(x, 0, 3, 512);
    }

    // High gloss varnish sheen
    const spec = ctx.createLinearGradient(0, 0, 512, 512);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    spec.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // 6. GOLDEN DESERT SANDSTONE (Sunken Pharaoh Temple)
  static createSandstoneTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#d97706'; // Warm golden sandstone
    ctx.fillRect(0, 0, 512, 512);

    // Wind-blown desert sand ripple striations
    for (let y = 0; y < 512; y += 6) {
      const alpha = 0.08 + Math.sin(y * 0.15) * 0.06;
      ctx.fillStyle = `rgba(254, 243, 199, ${alpha})`;
      ctx.fillRect(0, y, 512, 3);
    }

    // Carved Egyptian hieroglyphic glyphs
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.4)';
    ctx.lineWidth = 2;
    for (let x = 40; x < 512; x += 90) {
      for (let y = 40; y < 512; y += 90) {
        ctx.strokeRect(x, y, 24, 30);
        ctx.beginPath();
        ctx.arc(x + 12, y + 10, 6, 0, Math.PI * 2);
        ctx.moveTo(x + 4, y + 22);
        ctx.lineTo(x + 20, y + 22);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- BRUSHED STEEL (Knight & Weapons) ---
  static createMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.5, '#cbd5e1');
    grad.addColorStop(1, '#64748b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 400; i++) {
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- INDUSTRIAL HAZARD STRIPES (Robot) ---
  static createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#0f172a';
    for (let x = -128; x < 512 + 128; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 24 - 48, 128);
      ctx.lineTo(x - 48, 128);
      ctx.closePath();
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- FABRIC TEXTURE (Soldier & Wizard) ---
  static createFabricTexture(baseHex = '#1e3a1e') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let x = 0; x < 256; x += 3) ctx.fillRect(x, 0, 1, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let y = 0; y < 256; y += 3) ctx.fillRect(0, y, 256, 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}

window.TextureGen = TextureGen;
