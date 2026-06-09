import * as THREE from "three";

// Loads an SVG (or raster) icon for the borehole "icon on top" element and
// rasterizes it into a crisp THREE texture. Textures are cached by source so a
// repeated style apply does not reload. SVG sources are loaded through an
// <img>, which rasterizes vector data at draw time; raster sources work too.

const ICON_CANVAS_SIZE = 512;

const textureCache = new Map<string, THREE.Texture | null>();
const pendingLoads = new Map<string, Promise<THREE.Texture | null>>();

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
    image.src = src;
  });
}

async function rasterizeToTexture(src: string): Promise<THREE.Texture | null> {
  if (typeof document === "undefined") return null;
  const image = await loadImageElement(src);
  const canvas = document.createElement("canvas");
  canvas.width = ICON_CANVAS_SIZE;
  canvas.height = ICON_CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE);
  const naturalWidth = image.naturalWidth || image.width || ICON_CANVAS_SIZE;
  const naturalHeight = image.naturalHeight || image.height || ICON_CANVAS_SIZE;
  // Contain-fit the source into the square canvas, centred.
  const scale = Math.min(
    ICON_CANVAS_SIZE / naturalWidth,
    ICON_CANVAS_SIZE / naturalHeight,
  );
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  ctx.drawImage(
    image,
    (ICON_CANVAS_SIZE - drawWidth) * 0.5,
    (ICON_CANVAS_SIZE - drawHeight) * 0.5,
    drawWidth,
    drawHeight,
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function loadBoreholeIconTexture(
  src: string,
): Promise<THREE.Texture | null> {
  if (textureCache.has(src)) {
    return Promise.resolve(textureCache.get(src) ?? null);
  }
  const inFlight = pendingLoads.get(src);
  if (inFlight) return inFlight;
  const load = rasterizeToTexture(src)
    .then((texture) => {
      textureCache.set(src, texture);
      pendingLoads.delete(src);
      return texture;
    })
    .catch(() => {
      textureCache.set(src, null);
      pendingLoads.delete(src);
      return null;
    });
  pendingLoads.set(src, load);
  return load;
}
