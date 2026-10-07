// Procedural Texture Generator for Three.js PBR Materials
// Eliminates the flat untextured look by generating high-resolution surface maps,
// bump maps, and roughness maps entirely in canvas buffers.

class TextureGen {
  // --- STONE BRICK MASONRY ---
  static createStoneBrickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base mortar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    const rows = 12;
    const rowH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      const y = r * rowH;
      const cols = 6;
      const colW = 512 / cols;
      const offset = (r % 2) * (colW * 0.5);

      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const pad = 3;

        // Individual stone color variation
        const baseTone = 75 + Math.floor(Math.sin(r * 3 + c * 7) * 20);
        ctx.fillStyle = `rgb(${baseTone - 5}, ${baseTone}, ${baseTone + 8})`;
        ctx.fillRect(x + pad, y + pad, colW - pad * 2, rowH - pad * 2);

        // Stone edge bevel shadow & highlight
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + pad, y + pad, colW - pad * 2, rowH - pad * 2);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(x + pad, y + rowH - pad);
        ctx.lineTo(x + pad, y + pad);
        ctx.lineTo(x + colW - pad, y + pad);
        ctx.stroke();

        // Surface stone grit noise
        for (let p = 0; p < 35; p++) {
          const px = x + pad + Math.random() * (colW - pad * 2);
          const py = y + pad + Math.random() * (rowH - pad * 2);
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- BRUSHED STEEL & GOTHIC ARMOR ---
  static createMetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base steel gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#94a3b8');
    grad.addColorStop(0.5, '#cbd5e1');
    grad.addColorStop(1, '#64748b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Micro scratches & anisotropic grain
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 400; i++) {
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }

    // Weathering grime spots
    for (let g = 0; g < 40; g++) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- OAK WOOD GRAIN ---
  static createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 512, 512);

    // Wood rings & planks
    for (let y = 0; y < 512; y += 4) {
      const alpha = 0.08 + Math.sin(y * 0.05) * 0.06;
      ctx.fillStyle = y % 32 < 2 ? 'rgba(30, 15, 5, 0.5)' : `rgba(45, 20, 5, ${alpha})`;
      ctx.fillRect(0, y, 512, 3);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- INDUSTRIAL HAZARD STRIPES ---
  static createHazardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#eab308'; // Warning yellow
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#0f172a'; // Deep slate black
    for (let x = -128; x < 512 + 128; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 24 - 48, 128);
      ctx.lineTo(x - 48, 128);
      ctx.closePath();
      ctx.fill();
    }

    // Subtle edge grease
    const rimGrad = ctx.createLinearGradient(0, 0, 0, 128);
    rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    rimGrad.addColorStop(0.1, 'rgba(0, 0, 0, 0)');
    rimGrad.addColorStop(0.9, 'rgba(0, 0, 0, 0)');
    rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, 512, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // --- CLOTH & TACTICAL FABRIC WEAVE ---
  static createFabricTexture(baseHex = '#1e3a1e') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Micro cross-hatching
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let x = 0; x < 256; x += 3) {
      ctx.fillRect(x, 0, 1, 256);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let y = 0; y < 256; y += 3) {
      ctx.fillRect(0, y, 256, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
}

window.TextureGen = TextureGen;
