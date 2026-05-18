import * as THREE from "three";

export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const disposable = obj as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    disposable.geometry?.dispose?.();
    const materials = Array.isArray(disposable.material)
      ? disposable.material
      : disposable.material
        ? [disposable.material]
        : [];
    for (const material of materials) {
      const withMap = material as THREE.Material & {
        map?: THREE.Texture | null;
      };
      withMap.map?.dispose?.();
      material.dispose?.();
    }
  });
}
