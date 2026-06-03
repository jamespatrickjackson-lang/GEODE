import * as THREE from "three";

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMistTexture(softness: number, seed: number): THREE.Texture {
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const center = size / 2;
  const radius = center * 0.96;
  const alphaStop = THREE.MathUtils.clamp(softness, 0.05, 1);
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(alphaStop * 0.62, "rgba(255,255,255,0.72)");
  gradient.addColorStop(Math.min(0.96, alphaStop * 0.9), "rgba(255,255,255,0.22)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  const rng = mulberry32(seed * 131 + Math.round(softness * 1000));
  for (let i = 0; i < image.data.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const dx = (x - center) / radius;
    const dy = (y - center) / radius;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const cellular = Math.sin((x * 0.13 + seed) * 1.7) * Math.cos((y * 0.11 - seed) * 1.4);
    const noise = 0.76 + rng() * 0.24 + cellular * 0.08;
    const edge = 1 - THREE.MathUtils.smoothstep(dist, 0.58, 1);
    image.data[i + 3] = Math.round(image.data[i + 3] * noise * edge);
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "generated-canvas local atmosphere mist texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
