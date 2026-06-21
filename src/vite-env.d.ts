/// <reference types="vite/client" />

// three ships the EXR exporter as untyped JS (no bundled .d.ts). Minimal ambient
// declaration for the float/EXR capture path.
declare module "three/examples/jsm/exporters/EXRExporter.js" {
  import type {
    WebGLRenderer,
    WebGLRenderTarget,
    DataTexture,
    TextureDataType,
  } from "three";
  export interface EXRExporterParseOptions {
    type?: TextureDataType;
    compression?: number;
  }
  export class EXRExporter {
    parse(
      renderer: WebGLRenderer,
      renderTarget: WebGLRenderTarget,
      options?: EXRExporterParseOptions,
    ): Promise<Uint8Array<ArrayBuffer>>;
    parse(
      texture: DataTexture,
      options?: EXRExporterParseOptions,
    ): Promise<Uint8Array<ArrayBuffer>>;
  }
  export const NO_COMPRESSION: number;
  export const ZIP_COMPRESSION: number;
  export const ZIPS_COMPRESSION: number;
}
