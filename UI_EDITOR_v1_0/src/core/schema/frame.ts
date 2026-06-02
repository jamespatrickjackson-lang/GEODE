import type { ColourValue, TokenRef } from "./primitives";
import type { IntentAnnotations } from "./intent";

export interface FrameBackground {
  fill?: ColourValue | TokenRef;
  stressTestAssetId?: string;
}

export interface SafeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Frame {
  id: string;
  name: string;
  positionOnCanvas: { x: number; y: number };
  size: { w: number; h: number };
  safeArea: SafeArea | null;
  background: FrameBackground;
  containerIds: string[];
  componentIds: string[];
  hostSurface?: string;
  intent?: IntentAnnotations;
}

export interface FramesFile {
  schemaVersion: 1;
  frames: Frame[];
  activeFrameId: string | null;
}
