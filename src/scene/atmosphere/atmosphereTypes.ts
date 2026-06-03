import type { Vec3 } from "../../pages/types";

export type AtmosphereVolumeSubtype =
  | "mist"
  | "ground-fog"
  | "cloud-bank"
  | "steam-plume";

export type AtmosphereVolumeBoundsMode = "box" | "ellipsoid";

export interface LocalAtmosphereBounds {
  mode: AtmosphereVolumeBoundsMode;
  center: Vec3;
  size: Vec3;
}

export interface LocalAtmosphereVolumeMetadata {
  subtype?: AtmosphereVolumeSubtype;
  bounds?: Partial<LocalAtmosphereBounds> & {
    center?: Partial<Vec3> | number[];
    size?: Partial<Vec3> | number[];
  };
  artifactFamily?: string;
  renderingRole?: string;
  computationRole?: string;
  notes?: string;
}

export interface ResolvedLocalAtmosphereStyle {
  subtype: AtmosphereVolumeSubtype;
  bounds: LocalAtmosphereBounds;
  color: string;
  opacity: number;
  density: number;
  softness: number;
  puffCount: number;
  puffScaleM: number;
  scaleJitter: number;
  verticalFalloff: number;
  edgeFade: number;
  seed: number;
  driftEnabled: boolean;
  driftSpeedMps: number;
  driftDirection: Vec3;
  depthTest: boolean;
  renderOrder: number;
  boundsHelperVisible: boolean;
}
