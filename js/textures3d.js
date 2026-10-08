// Procedural Texture Generator for Three.js PBR Materials
// Provides distinct, high-resolution textures tailored to each biome:
// Castle Granite, Cyberpunk Grid, Volcanic Magma, Mossy Crypt, Luxury Parquet, and Desert Sandstone.

class TextureGen {
  static _cache = {};

  static getCached(key, fn) {
    if (!TextureGen._cache[key]) {
      TextureGen._cache[key] = fn();
    }
    return TextureGen._cache[key];
  }
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

  // 7. REALISTIC HUMAN DERMIS / SKIN (Epidermal Micro-Pores & Subsurface Flushing)
  static createHumanSkinTexture(tone = 'fair') {
    return TextureGen.getCached(`skin_${tone}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const baseColor = tone === 'fair' ? '#f0b796' : (tone === 'tan' ? '#c88a58' : '#e0a98b');
      const underColor = tone === 'fair' ? '#d97d64' : (tone === 'tan' ? '#a05838' : '#c26e55');

      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, baseColor);
      grad.addColorStop(0.5, underColor);
      grad.addColorStop(1, baseColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 40; i++) {
        const rx = Math.random() * 512;
        const ry = Math.random() * 512;
        const rad = 20 + Math.random() * 45;
        const radGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
        radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
        radGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(rx, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let p = 0; p < data.length; p += 4) {
        const noise = (Math.random() - 0.5) * 16;
        data[p] = Math.min(255, Math.max(0, data[p] + noise));
        data[p + 1] = Math.min(255, Math.max(0, data[p + 1] + noise * 0.9));
        data[p + 2] = Math.min(255, Math.max(0, data[p + 2] + noise * 0.8));
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    });
  }

  // 8. REALISTIC ANATOMICAL FACE TEXTURE
  static createHumanFaceTexture(characterType = 'soldier') {
    return TextureGen.getCached(`face_${characterType}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const baseGrad = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
      baseGrad.addColorStop(0, '#f2be9b');
      baseGrad.addColorStop(0.7, '#e29e79');
      baseGrad.addColorStop(1, '#c97c58');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = 'rgba(160, 80, 50, 0.18)';
      ctx.beginPath();
      ctx.ellipse(140, 290, 60, 90, 0.2, 0, Math.PI * 2);
      ctx.ellipse(372, 290, 60, 90, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(120, 50, 30, 0.28)';
      ctx.beginPath();
      ctx.ellipse(190, 210, 48, 30, 0, 0, Math.PI * 2);
      ctx.ellipse(322, 210, 48, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      const eyeCenters = [190, 322];
      for (const ex of eyeCenters) {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.ellipse(ex, 210, 32, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#29140a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(ex, 210, 32, 18, 0, 0, Math.PI * 2);
        ctx.stroke();

        const irisColor = characterType === 'wizard' ? '#06b6d4' : (characterType === 'knight' ? '#3b82f6' : '#22c55e');
        ctx.fillStyle = irisColor;
        ctx.beginPath();
        ctx.arc(ex, 210, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ex, 210, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 4, 206, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = characterType === 'wizard' ? '#94a3b8' : '#29140a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(140, 185);
      ctx.quadraticCurveTo(190, 168, 230, 188);
      ctx.moveTo(372, 185);
      ctx.quadraticCurveTo(322, 168, 282, 188);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(150, 70, 40, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(250, 195);
      ctx.lineTo(248, 285);
      ctx.lineTo(238, 305);
      ctx.moveTo(258, 285);
      ctx.lineTo(268, 305);
      ctx.stroke();

      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(244, 305, 5, 3, 0.2, 0, Math.PI * 2);
      ctx.ellipse(268, 305, 5, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#b95d55';
      ctx.beginPath();
      ctx.ellipse(256, 360, 42, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a1d1d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(220, 360);
      ctx.quadraticCurveTo(256, 364, 292, 360);
      ctx.stroke();

      if (characterType === 'soldier') {
        for (let s = 0; s < 500; s++) {
          const sx = 180 + Math.random() * 152;
          const sy = 310 + Math.random() * 110;
          ctx.fillStyle = 'rgba(40, 25, 15, 0.15)';
          ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.fillStyle = 'rgba(20, 83, 45, 0.45)';
        ctx.beginPath();
        ctx.moveTo(130, 260); ctx.lineTo(210, 245); ctx.lineTo(205, 260); ctx.lineTo(125, 275);
        ctx.moveTo(382, 260); ctx.lineTo(302, 245); ctx.lineTo(307, 260); ctx.lineTo(387, 275);
        ctx.fill();
      } else if (characterType === 'wizard') {
        ctx.strokeStyle = 'rgba(120, 60, 40, 0.35)';
        ctx.lineWidth = 2;
        for (let y = 110; y <= 150; y += 14) {
          ctx.beginPath();
          ctx.moveTo(180, y);
          ctx.quadraticCurveTo(256, y - 8, 332, y);
          ctx.stroke();
        }
      } else if (characterType === 'knight') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(175, 160);
        ctx.lineTo(205, 240);
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    });
  }

  // 9. GRAINED WORN LEATHER TEXTURE
  static createLeatherTexture(baseHex = '#451a03') {
    return TextureGen.getCached(`leather_${baseHex}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);

      for (let i = 0; i < 600; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 2 + Math.random() * 4;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    });
  }

  // 10. RIVETED STEEL CHAINMAIL TEXTURE
  static createChainmailTexture() {
    return TextureGen.getCached('chainmail', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      const ringSpacing = 16;
      for (let y = 0; y <= 256; y += ringSpacing) {
        const offset = (y / ringSpacing) % 2 * (ringSpacing * 0.5);
        for (let x = -ringSpacing; x <= 256 + ringSpacing; x += ringSpacing) {
          ctx.beginPath();
          ctx.arc(x + offset, y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    });
  }
}

window.TextureGen = TextureGen;
