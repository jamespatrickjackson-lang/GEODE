import * as THREE from "three";
import type { EditableStyle, SceneProperties } from "../pages/types";
import {
  TOPO_MAP_BRANDING_DEFAULT_ANCHOR,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
  TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
} from "./settings";
import {
  publicSurfaceClipAxes,
  publicSurfaceClipBox,
  publicSurfaceFrameAuthored,
} from "./publicSurfaceClipRuntime";
import type { TerrainEdgeFadeState } from "./surfaceRuntime";
import { assetUrl, clamp01 } from "./runtimeUtils";

type TopoMapBrandingAnchor =
  | "south-west"
  | "south-east"
  | "north-west"
  | "north-east";

interface TopoMapBrandingTextMesh extends THREE.Mesh {
  userData: THREE.Mesh["userData"] & {
    topoMapBrandingTexture?: THREE.Texture;
  };
}

export interface TopoMapBrandingRuntimeOptions {
  scene: THREE.Scene;
  resolveAssetPath(path: string): string;
}

export interface RebuildTopoMapBrandingParams {
  sceneProperties: SceneProperties;
  terrainStyle: EditableStyle;
  terrainEdge: TerrainEdgeFadeState | null;
}

export class TopoMapBrandingRuntime {
  private group: THREE.Group | null = null;
  private logoLoadSeq = 0;

  constructor(private readonly options: TopoMapBrandingRuntimeOptions) {}

  dispose(): void {
    if (!this.group) return;
    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map;
        map?.dispose();
        material.dispose();
      }
      const texture = (obj as TopoMapBrandingTextMesh).userData
        ?.topoMapBrandingTexture;
      texture?.dispose();
    });
    this.group = null;
    this.logoLoadSeq += 1;
  }

  rebuild({
    sceneProperties,
    terrainStyle,
    terrainEdge,
  }: RebuildTopoMapBrandingParams): void {
    this.dispose();
    const terrain = sceneProperties.terrain ?? {};
    const branding = terrain.topoMapBranding ?? {};
    if (branding.visible !== true) return;
    const heading =
      typeof branding.heading === "string" ? branding.heading.trim() : "";
    const subheading =
      typeof branding.subheading === "string"
        ? branding.subheading.trim()
        : "";
    const logoPath =
      typeof branding.logoRenderablePath === "string" &&
      branding.logoRenderablePath.trim()
        ? branding.logoRenderablePath.trim()
        : typeof branding.logoPath === "string"
          ? branding.logoPath.trim()
          : "";
    if (!heading && !subheading && !logoPath) return;

    const anchor: TopoMapBrandingAnchor =
      branding.anchor === "south-west" ||
      branding.anchor === "south-east" ||
      branding.anchor === "north-west" ||
      branding.anchor === "north-east"
        ? branding.anchor
        : TOPO_MAP_BRANDING_DEFAULT_ANCHOR;
    const opacity = clamp01(
      typeof branding.opacity === "number" ? branding.opacity : 0.92,
    );
    const textColor =
      typeof branding.textColor === "string" ? branding.textColor : "#ffffff";
    const fontFamily =
      branding.fontFamily === "sans"
        ? "system-ui, -apple-system, Segoe UI, sans-serif"
        : branding.fontFamily === "serif"
          ? "Georgia, Times New Roman, serif"
          : branding.fontFamily === "condensed"
            ? "Arial Narrow, Helvetica Condensed, sans-serif"
            : "monospace";
    const textAlign =
      branding.textAlign === "center" || branding.textAlign === "right"
        ? branding.textAlign
        : "left";
    const layout = branding.layout === "stacked" ? "stacked" : "horizontal";
    const logoPlacement =
      branding.logoPlacement === "after" ? "after" : "before";
    const logoFit =
      branding.logoFit === "cover" || branding.logoFit === "stretch"
        ? branding.logoFit
        : "contain";
    const liftM = typeof branding.liftM === "number" ? branding.liftM : 260;
    const offsetXM =
      typeof branding.offsetXM === "number"
        ? branding.offsetXM
        : TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M;
    const offsetYM =
      typeof branding.offsetYM === "number"
        ? branding.offsetYM
        : TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M;
    const logoWidthM = Math.max(
      0,
      typeof branding.logoWidthM === "number" ? branding.logoWidthM : 46000,
    );
    const logoGapM =
      typeof branding.logoGapM === "number" ? branding.logoGapM : 16000;
    const logoOpacity = clamp01(
      typeof branding.logoOpacity === "number" ? branding.logoOpacity : opacity,
    );
    const textOpacity = clamp01(
      typeof branding.textOpacity === "number" ? branding.textOpacity : opacity,
    );
    const headingSizeM = Math.max(
      1000,
      typeof branding.headingSizeM === "number"
        ? branding.headingSizeM
        : 18000,
    );
    const subheadingSizeM = Math.max(
      1000,
      typeof branding.subheadingSizeM === "number"
        ? branding.subheadingSizeM
        : 10500,
    );
    const lineGapM =
      typeof branding.lineGapM === "number" ? branding.lineGapM : 2500;
    const anchorPoint = this.anchorPoint(anchor, terrainStyle, terrainEdge);
    if (!anchorPoint) return;
    const group = new THREE.Group();
    group.name = "__topo_map_branding__";
    group.renderOrder = 4564;
    group.userData.topoMapBranding = true;
    // DEC-077: when the terrain layer style opts in via topoSectionable, the
    // branding meshes flow through scene-section clipping like ordinary
    // layer geometry. Default off preserves prior reference-context
    // behavior. The flag is mirrored onto every child + material after the
    // group is built (see end of rebuild).
    group.userData.topoSectionable = terrainStyle.topoSectionable === true;
    group.rotation.z =
      this.frameRotationRad(terrainStyle) +
      THREE.MathUtils.degToRad(
        typeof branding.rotationDeg === "number" ? branding.rotationDeg : 0,
      );
    group.position
      .copy(anchorPoint)
      .add(new THREE.Vector3(offsetXM, offsetYM, liftM));

    const contentGroup = new THREE.Group();
    contentGroup.userData.topoMapBrandingContent = true;

    let logoHeightM = logoPath && logoWidthM > 0 ? logoWidthM : 0;
    let logo: THREE.Mesh | null = null;
    let textBlockWidth = 0;
    const textMeshes: Array<{
      mesh: THREE.Mesh;
      widthM: number;
      heightM: number;
      role: "heading" | "subheading";
    }> = [];

    if (logoPath && logoWidthM > 0) {
      const geometry = new THREE.PlaneGeometry(logoWidthM, logoHeightM);
      const material = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: logoOpacity,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      material.toneMapped = false;
      material.fog = false;
      material.userData.forceTransparent = true;
      const logoMesh = new THREE.Mesh(geometry, material);
      logo = logoMesh;
      logoMesh.renderOrder = 4564;
      logoMesh.userData.topoMapBranding = true;
      logoMesh.userData.topoMapBrandingRole = "logo";
      contentGroup.add(logoMesh);
      const loadSeq = ++this.logoLoadSeq;
      new THREE.TextureLoader().load(
        assetUrl(logoPath, this.options.resolveAssetPath),
        (texture) => {
          if (loadSeq !== this.logoLoadSeq) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          const image = texture.image as { width?: number; height?: number };
          const aspect =
            image?.width && image?.height ? image.height / image.width : 1;
          logoHeightM =
            logoFit === "stretch" ? logoWidthM : Math.max(1, logoWidthM * aspect);
          logoMesh.geometry.dispose();
          logoMesh.geometry = new THREE.PlaneGeometry(logoWidthM, logoHeightM);
          material.map?.dispose();
          material.map = texture;
          material.needsUpdate = true;
          layoutTitleBlock();
        },
        undefined,
        () => {
          logoMesh.visible = false;
        },
      );
    }

    if (heading) {
      const { mesh, widthM } = this.createText(
        heading,
        headingSizeM,
        textColor,
        textOpacity,
        typeof branding.headingWeight === "number"
          ? Math.round(branding.headingWeight)
          : 800,
        fontFamily,
        branding.headingItalic === true,
      );
      mesh.userData.topoMapBrandingRole = "heading";
      contentGroup.add(mesh);
      textBlockWidth = Math.max(textBlockWidth, widthM);
      textMeshes.push({ mesh, widthM, heightM: headingSizeM, role: "heading" });
    }
    if (subheading) {
      const { mesh, widthM } = this.createText(
        subheading,
        subheadingSizeM,
        textColor,
        textOpacity,
        typeof branding.subheadingWeight === "number"
          ? Math.round(branding.subheadingWeight)
          : 500,
        fontFamily,
        branding.subheadingItalic === true,
      );
      mesh.userData.topoMapBrandingRole = "subheading";
      contentGroup.add(mesh);
      textBlockWidth = Math.max(textBlockWidth, widthM);
      textMeshes.push({
        mesh,
        widthM,
        heightM: subheadingSizeM,
        role: "subheading",
      });
    }

    const backgroundEnabled = branding.backgroundEnabled === true;
    const outlineEnabled = branding.outlineEnabled === true;
    const paddingX =
      typeof branding.backgroundPaddingXM === "number"
        ? Math.max(0, branding.backgroundPaddingXM)
        : Math.max(6000, headingSizeM * 0.65);
    const paddingY =
      typeof branding.backgroundPaddingYM === "number"
        ? Math.max(0, branding.backgroundPaddingYM)
        : Math.max(5000, headingSizeM * 0.45);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color:
        typeof branding.backgroundColor === "string"
          ? branding.backgroundColor
          : "#050607",
      transparent: true,
      opacity: clamp01(
        typeof branding.backgroundOpacity === "number"
          ? branding.backgroundOpacity
          : 0.36,
      ),
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    backgroundMaterial.toneMapped = false;
    backgroundMaterial.fog = false;
    backgroundMaterial.userData.forceTransparent = true;
    const background = backgroundEnabled
      ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backgroundMaterial)
      : null;
    if (background) {
      background.renderOrder = 4563;
      background.position.z = -2;
      background.userData.topoMapBranding = true;
      background.userData.topoMapBrandingRole = "background";
      contentGroup.add(background);
    } else {
      backgroundMaterial.dispose();
    }

    const outlineStrips: THREE.Mesh[] = [];
    if (outlineEnabled) {
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color:
          typeof branding.outlineColor === "string"
            ? branding.outlineColor
            : textColor,
        transparent: true,
        opacity: clamp01(
          typeof branding.outlineOpacity === "number"
            ? branding.outlineOpacity
            : 0.8,
        ),
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      outlineMaterial.toneMapped = false;
      outlineMaterial.fog = false;
      outlineMaterial.userData.forceTransparent = true;
      for (let i = 0; i < 4; i += 1) {
        const strip = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          outlineMaterial,
        );
        strip.renderOrder = 4563.5;
        strip.position.z = -1;
        strip.userData.topoMapBranding = true;
        strip.userData.topoMapBrandingRole = "outline";
        outlineStrips.push(strip);
        contentGroup.add(strip);
      }
    }

    const layoutTitleBlock = () => {
      const textBlockHeight =
        heading && subheading
          ? headingSizeM + lineGapM + subheadingSizeM
          : textMeshes.length > 0
            ? textMeshes[0].heightM
            : 0;
      const hasLogo = !!logo && logoWidthM > 0 && logo.visible !== false;
      const hasText = textMeshes.length > 0;
      const gap = hasLogo && hasText ? logoGapM : 0;
      let contentWidth = 1;
      let contentHeight = 1;
      let logoCenterX = logoWidthM * 0.5;
      let logoCenterY = 0;
      let textOriginX = 0;
      let textCenterY = 0;

      if (layout === "stacked") {
        contentWidth = Math.max(hasLogo ? logoWidthM : 0, textBlockWidth, 1);
        contentHeight =
          (hasLogo ? logoHeightM : 0) +
          gap +
          (hasText ? textBlockHeight : 0);
        if (hasLogo) {
          logoCenterX = contentWidth * 0.5;
          logoCenterY =
            logoPlacement === "before"
              ? contentHeight * 0.5 - logoHeightM * 0.5
              : -contentHeight * 0.5 + logoHeightM * 0.5;
        }
        if (hasText) {
          textOriginX = (contentWidth - textBlockWidth) * 0.5;
          textCenterY =
            logoPlacement === "before"
              ? -contentHeight * 0.5 + textBlockHeight * 0.5
              : contentHeight * 0.5 - textBlockHeight * 0.5;
        }
      } else {
        contentWidth =
          (hasLogo ? logoWidthM : 0) + gap + (hasText ? textBlockWidth : 0);
        contentHeight = Math.max(
          hasLogo ? logoHeightM : 0,
          hasText ? textBlockHeight : 0,
          1,
        );
        if (hasLogo) {
          logoCenterX =
            logoPlacement === "before"
              ? logoWidthM * 0.5
              : contentWidth - logoWidthM * 0.5;
        }
        if (hasText) {
          textOriginX =
            logoPlacement === "before" && hasLogo ? logoWidthM + gap : 0;
          textCenterY = 0;
        }
      }

      if (logo) logo.position.set(logoCenterX, logoCenterY, 0);
      for (const item of textMeshes) {
        const y =
          textMeshes.length === 2
            ? item.role === "heading"
              ? textCenterY + textBlockHeight * 0.5 - item.heightM * 0.5
              : textCenterY - textBlockHeight * 0.5 + item.heightM * 0.5
            : textCenterY;
        const x =
          textAlign === "center"
            ? textOriginX + textBlockWidth * 0.5
            : textAlign === "right"
              ? textOriginX + textBlockWidth - item.widthM * 0.5
              : textOriginX + item.widthM * 0.5;
        item.mesh.position.set(x, y, 0);
      }

      const framedWidth = contentWidth + paddingX * 2;
      const framedHeight = contentHeight + paddingY * 2;
      if (background) {
        background.scale.set(framedWidth, framedHeight, 1);
        background.position.set(contentWidth * 0.5, 0, -2);
      }
      if (outlineStrips.length === 4) {
        const outlineWidth = Math.max(
          1,
          typeof branding.outlineWidthM === "number"
            ? branding.outlineWidthM
            : 2500,
        );
        const left = contentWidth * 0.5 - framedWidth * 0.5;
        const right = contentWidth * 0.5 + framedWidth * 0.5;
        const top = framedHeight * 0.5;
        const bottom = -framedHeight * 0.5;
        const [topStrip, rightStrip, bottomStrip, leftStrip] = outlineStrips;
        topStrip.scale.set(framedWidth, outlineWidth, 1);
        topStrip.position.set(contentWidth * 0.5, top, -1);
        bottomStrip.scale.set(framedWidth, outlineWidth, 1);
        bottomStrip.position.set(contentWidth * 0.5, bottom, -1);
        rightStrip.scale.set(outlineWidth, framedHeight, 1);
        rightStrip.position.set(right, 0, -1);
        leftStrip.scale.set(outlineWidth, framedHeight, 1);
        leftStrip.position.set(left, 0, -1);
      }

      contentGroup.position.x = anchor.includes("east") ? -contentWidth : 0;
      contentGroup.position.y = anchor.includes("south")
        ? contentHeight * 0.5
        : -contentHeight * 0.5;
      contentGroup.userData.topoMapBrandingContentWidthM = contentWidth;
      contentGroup.userData.topoMapBrandingContentHeightM = contentHeight;
    };

    layoutTitleBlock();
    group.add(contentGroup);

    // DEC-077: propagate the section-clipping opt-in onto every descendant
    // object + material so sceneSectionObjectExcludedFromClipping and
    // applySceneSectionMaterial honor the flag without needing to walk back
    // up to the root group.
    const sectionable = group.userData.topoSectionable === true;
    group.traverse((obj) => {
      obj.userData.topoSectionable = sectionable;
      const material = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const item of materials) item.userData.topoSectionable = sectionable;
    });

    this.options.scene.add(group);
    this.group = group;
  }

  private anchorPoint(
    anchor: TopoMapBrandingAnchor,
    terrainStyle: EditableStyle,
    terrainEdge: TerrainEdgeFadeState | null,
  ): THREE.Vector3 | null {
    if (publicSurfaceFrameAuthored(terrainStyle)) {
      const box = publicSurfaceClipBox(terrainStyle);
      const { xAxis, yAxis } = publicSurfaceClipAxes(box);
      const west = anchor.includes("west");
      const south = anchor.includes("south");
      return box.center
        .clone()
        .addScaledVector(xAxis, west ? -box.halfSize.x : box.halfSize.x)
        .addScaledVector(yAxis, south ? -box.halfSize.y : box.halfSize.y);
    }

    if (!terrainEdge) return null;
    const centerX = (terrainEdge.boundsMin.x + terrainEdge.boundsMax.x) * 0.5;
    const centerY = (terrainEdge.boundsMin.y + terrainEdge.boundsMax.y) * 0.5;
    const halfX = Math.max(
      1,
      (terrainEdge.boundsMax.x - terrainEdge.boundsMin.x) * 0.5 -
        terrainEdge.insetM,
    );
    const halfY = Math.max(
      1,
      (terrainEdge.boundsMax.y - terrainEdge.boundsMin.y) * 0.5 -
        terrainEdge.insetM,
    );
    const west = anchor.includes("west");
    const south = anchor.includes("south");
    return new THREE.Vector3(
      centerX + (west ? -halfX : halfX),
      centerY + (south ? -halfY : halfY),
      0,
    );
  }

  private frameRotationRad(terrainStyle: EditableStyle): number {
    return publicSurfaceFrameAuthored(terrainStyle)
      ? publicSurfaceClipBox(terrainStyle).rotationZRad
      : 0;
  }

  private createText(
    text: string,
    sizeM: number,
    color: string,
    opacity: number,
    weight: number,
    fontFamily: string,
    italic: boolean,
  ): { mesh: TopoMapBrandingTextMesh; widthM: number; heightM: number } {
    const clean = text.trim();
    const canvas = document.createElement("canvas");
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    const font = `${italic ? "italic " : ""}${weight} 96px ${fontFamily}`;
    if (measureCtx) measureCtx.font = font;
    const measuredWidth = measureCtx?.measureText(clean).width ?? 512;
    canvas.width = Math.max(512, Math.min(4096, Math.ceil(measuredWidth + 96)));
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(clean, 36, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const widthM = sizeM * Math.max(2.6, clean.length * 0.66);
    const geometry = new THREE.PlaneGeometry(widthM, sizeM);
    const material = new THREE.MeshBasicMaterial({
      color,
      map: texture,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.toneMapped = false;
    material.fog = false;
    material.userData.forceTransparent = true;
    const mesh = new THREE.Mesh(geometry, material) as TopoMapBrandingTextMesh;
    mesh.renderOrder = 4564;
    mesh.userData.topoMapBranding = true;
    mesh.userData.topoMapBrandingTexture = texture;
    return { mesh, widthM, heightM: sizeM };
  }
}
