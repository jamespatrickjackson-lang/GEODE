export interface TransitionEntityOpacityFrame {
  entityKey: string;
  parentLayerId?: string | null;
  opacityFactor: number;
  done?: boolean;
}

export interface TransitionEntityOpacityObject {
  visible?: boolean;
  userData?: Record<string, unknown>;
  material?: TransitionEntityOpacityMaterial | TransitionEntityOpacityMaterial[];
  traverse(callback: (object: TransitionEntityOpacityObject) => void): void;
}

interface TransitionEntityOpacityMaterial {
  opacity?: number;
  transparent?: boolean;
  needsUpdate?: boolean;
  userData?: Record<string, unknown>;
  uniforms?: {
    uOpacity?: { value: unknown };
  };
}

interface TransitionEntityOpacityApplyOptions {
  parentOpacityForLayer?: (layerId: string) => number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function finiteUserDataNumber(
  userData: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = userData?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function baseOpacityForMaterial(
  material: TransitionEntityOpacityMaterial,
): number {
  const userData = material.userData ?? (material.userData = {});
  const stored =
    finiteUserDataNumber(userData, "transitionBaseMaterialOpacity") ??
    finiteUserDataNumber(userData, "preserveMaterialOpacityBase") ??
    finiteUserDataNumber(userData, "seismicFigureBaseOpacity");
  if (stored !== null) return clamp01(stored);
  const opacity =
    typeof material.opacity === "number" && Number.isFinite(material.opacity)
      ? material.opacity
      : 1;
  const base = clamp01(opacity);
  userData.transitionBaseMaterialOpacity = base;
  return base;
}

function materialList(
  object: TransitionEntityOpacityObject,
): TransitionEntityOpacityMaterial[] {
  if (!object.material) return [];
  return Array.isArray(object.material) ? object.material : [object.material];
}

function transitionEntityKeyForObject(
  object: TransitionEntityOpacityObject,
): string | null {
  const key = object.userData?.transitionEntityKey;
  return typeof key === "string" && key.trim() ? key : null;
}

function parentLayerIdForFrame(
  frame: TransitionEntityOpacityFrame,
  object: TransitionEntityOpacityObject,
): string | null {
  if (typeof frame.parentLayerId === "string" && frame.parentLayerId.trim()) {
    return frame.parentLayerId;
  }
  const tagged = object.userData?.transitionParentLayerId;
  return typeof tagged === "string" && tagged.trim() ? tagged : null;
}

function parentOpacityForFrame(
  frame: TransitionEntityOpacityFrame,
  object: TransitionEntityOpacityObject,
  options: TransitionEntityOpacityApplyOptions,
): number {
  const parentLayerId = parentLayerIdForFrame(frame, object);
  if (!parentLayerId || !options.parentOpacityForLayer) return 1;
  return clamp01(options.parentOpacityForLayer(parentLayerId));
}

export function collectTransitionEntityObjects(
  root: TransitionEntityOpacityObject,
): Map<string, TransitionEntityOpacityObject[]> {
  const result = new Map<string, TransitionEntityOpacityObject[]>();
  root.traverse((object) => {
    const key = transitionEntityKeyForObject(object);
    if (!key) return;
    const objects = result.get(key) ?? [];
    objects.push(object);
    result.set(key, objects);
  });
  return result;
}

export function applyTransitionEntityOpacityToTree(
  root: TransitionEntityOpacityObject,
  parentLayerOpacity: number,
  entityOpacityFactor: number,
): void {
  const parentOpacity = clamp01(parentLayerOpacity);
  const entityFactor = clamp01(entityOpacityFactor);
  const treeFactor = clamp01(parentOpacity * entityFactor);
  root.visible = treeFactor > 0.001;
  root.traverse((object) => {
    object.visible = treeFactor > 0.001;
    for (const material of materialList(object)) {
      const nextOpacity = clamp01(baseOpacityForMaterial(material) * treeFactor);
      if (typeof material.opacity === "number") {
        material.opacity = nextOpacity;
      }
      material.transparent =
        material.userData?.forceTransparent === true || nextOpacity < 0.999;
      if (
        material.uniforms?.uOpacity &&
        typeof material.uniforms.uOpacity.value === "number"
      ) {
        material.uniforms.uOpacity.value = nextOpacity;
      }
      material.needsUpdate = true;
      const userData = material.userData ?? (material.userData = {});
      userData.transitionParentLayerOpacity = parentOpacity;
      userData.transitionEntityOpacityFactor = entityFactor;
      userData.transitionEffectiveOpacity = nextOpacity;
    }
  });
}

export function applyTransitionEntityOpacityFrames(
  root: TransitionEntityOpacityObject,
  frames: readonly TransitionEntityOpacityFrame[],
  options: TransitionEntityOpacityApplyOptions = {},
): void {
  if (frames.length === 0) return;
  const objectsByKey = collectTransitionEntityObjects(root);
  for (const frame of frames) {
    const targets = objectsByKey.get(frame.entityKey);
    if (!targets || targets.length === 0) continue;
    for (const object of targets) {
      applyTransitionEntityOpacityToTree(
        object,
        parentOpacityForFrame(frame, object, options),
        frame.opacityFactor,
      );
    }
  }
}
