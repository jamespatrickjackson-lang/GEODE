import * as THREE from "three";

/**
 * Register a capture-fidelity upgrade on a draped-overlay layer group.
 *
 * The SceneManager capture coordinator calls
 * `group.userData.captureFidelityUpgrade(enabled)` when the capture fidelity
 * lock toggles (see `SceneManager.setCaptureFullResolution`). Draped vector
 * overlays (geology, claim, trees, ...) are rasterized to a power-of-two canvas
 * and draped on the terrain with no mipmaps for the live profile (cheap, low
 * VRAM). With no mipmaps, anisotropy is inert, so the drape reads soft/aliased
 * at distance and oblique angles in outputs. At capture time this enables
 * mipmaps + anisotropy for sharp, non-aliased minification; the live config is
 * restored on lock release so the runtime view and its VRAM are unchanged.
 *
 * Intended for colour/outline fills. Do not use for masks that must keep hard
 * boolean edges (e.g. NearestFilter hydrography), where mipmaps would blur the
 * boundary.
 */
export function registerDrapedCaptureFidelity(
  group: THREE.Object3D,
  texture: THREE.Texture,
): void {
  group.userData.captureFidelityUpgrade = (enabled: boolean): void => {
    if (enabled) {
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.anisotropy = 16;
    } else {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.anisotropy = 1;
    }
    texture.needsUpdate = true;
  };
}
