import * as THREE from "three";
import type { EditableStyle, ProjectLayerSpec } from "../../pages/types";
import {
  applyLocalAtmosphereVolumeStyle as applyLocalAtmosphereVolumeRootStyle,
  createLocalAtmosphereVolume,
  findLocalAtmosphereVolumeRoot,
  isLocalAtmosphereLayerSpec,
} from "../atmosphere/localAtmosphereVolume";

type LocalAtmosphereStyleHost = {
  layers: Map<string, THREE.Object3D>;
};

function fallbackSpec(id: string): ProjectLayerSpec {
  return {
    id,
    label: id,
    type: "atmosphere-volume",
    files: {},
    metadata: {},
  } as ProjectLayerSpec;
}

export function applyLocalAtmosphereVolumeStyle(
  host: LocalAtmosphereStyleHost,
  id: string,
  style: EditableStyle,
): boolean {
  const layerGroup = host.layers.get(id);
  if (!layerGroup) return false;

  let root = findLocalAtmosphereVolumeRoot(layerGroup);
  const layerSpec = layerGroup.userData.layerSpec as ProjectLayerSpec | undefined;
  if (!root && layerSpec && isLocalAtmosphereLayerSpec(layerSpec)) {
    root = createLocalAtmosphereVolume(layerSpec);
    layerGroup.add(root);
  }
  if (!root) return false;

  const spec =
    (root.userData.layerSpec as ProjectLayerSpec | undefined) ??
    layerSpec ??
    fallbackSpec(id);
  applyLocalAtmosphereVolumeRootStyle(root, spec, style);
  layerGroup.userData.localAtmosphereDebug = root.userData.localAtmosphereDebug;
  layerGroup.userData.localAtmosphereStyleState =
    root.userData.localAtmosphereStyleState;
  return true;
}
