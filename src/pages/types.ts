// Page schema types -- strict subset of docs/schemas/page.json.md plus
// the environment-setup model added in #023.
//
// Key shapes:
//   EnvironmentSetup -- the "world" declaration. One per project. Owns
//     base layer styling, default visibility, and scene-level concerns.
//     Lives at projects/<project>/environment.json.
//   PresentationPage -- a moment in the world. One per page-list entry.
//     Has a camera and transition; expresses any divergence from the
//     environment as `layerOverrides` and `visibilityOverrides` deltas.
//   ScenePage -- transitional union used at the parse boundary only.
//     Runtime code never holds a ScenePage variable; the loader
//     discriminates and returns distinct fields.

export type Vec3 = [number, number, number];

export interface Pose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
}

export type EasingName =
  | "linear"
  | "easeInOutCubic"
  | "easeOutQuart"
  | "easeInOutSine"
  | "easeOutCubic";

export interface Transition {
  duration: number; // ms
  easing: EasingName;
}

export type RevealScrollBehavior = "auto" | "smooth";

export interface SceneCameraFocusSettings {
  durationMs?: number;
  easing?: EasingName;
  fitPaddingPx?: number;
  sameTargetZoomFactor?: number;
  singleClickDelayMs?: number;
  scrollSettleMs?: number;
  pulsePillMs?: number;
  pulseTextMs?: number;
  pulseStaticMs?: number;
  revealScrollBehavior?: RevealScrollBehavior;
  rmbExitDragPx?: number;
}

export interface CameraObjectFocus {
  targetId: string;
  worldPoint: Vec3;
}

export type DynamicCameraCurve = "linear" | "smooth" | "cinematic";

export interface DynamicCamera {
  enabled?: boolean;
  // Dynamic movement is additive over the authored page pose. Orbit and zoom
  // keep their legacy behavior; dolly/truck/crane are camera-local shot axes.
  mode?: "orbit";
  orbitEnabled?: boolean;
  poi?: Vec3;
  orbitSpeedDegPerSec?: number;
  orbitRadius?: number;
  orbitHeight?: number;
  orbitDirection?: 1 | -1;
  zoomFov?: number;
  zoomEnabled?: boolean;
  zoomDeltaFov?: number;
  zoomStartMs?: number;
  zoomEndMs?: number;
  zoomCurve?: DynamicCameraCurve;
  easeInMs?: number;
  transitionLeadMs?: number;
  transitionExitMs?: number;
  transitionBlendCurve?: DynamicCameraCurve;
  pathAwareBlend?: boolean;
  dollyEnabled?: boolean;
  dollyDistanceM?: number;
  truckEnabled?: boolean;
  truckDistanceM?: number;
  craneEnabled?: boolean;
  craneHeightM?: number;
  shotStartMs?: number;
  shotEndMs?: number;
  shotCurve?: DynamicCameraCurve;
  handheldEnabled?: boolean;
  handheldAmplitudeM?: number;
  handheldFrequencyHz?: number;
  rollDeg?: number;
}

export type DemoBoreholeLineStyle = "solid" | "dashed";
export type DemoBoreholePathTreatment =
  | "survey"
  | "smoothed"
  | "presentation-normalized";
export type DemoBoreholeSourceLocationMode =
  | "rounded-trace"
  | "line"
  | "pin"
  | "crosshair"
  | "hidden";

export interface DemoBoreholeWellStyle {
  visible?: boolean;
  pipeDiameterM?: number;
  color?: string;
  opacity?: number;
  lineStyle?: DemoBoreholeLineStyle;
  dashLengthM?: number;
  dashGapM?: number;
  centerlineVisible?: boolean;
  centerlineWidth?: number;
  centerlineOpacity?: number;
  centerlineColor?: string;
  collarVisible?: boolean;
  collarDiameterM?: number;
  pathTreatment?: DemoBoreholePathTreatment;
  smoothingStrength?: number;
  collarLabelVisible?: boolean;
  collarLabelText?: string;
  collarLabelLiftM?: number;
  toeLabelVisible?: boolean;
  toeLabelText?: string;
  toeLabelLiftM?: number;
}

export interface DemoOrientationBlockStyle {
  visible?: boolean;
  widthM?: number;
  depthM?: number;
  heightM?: number;
  liftM?: number;
  rotationDeg?: number;
  fillColor?: string;
  opacity?: number;
  outlineVisible?: boolean;
  outlineColor?: string;
  outlineThickness?: number;
  outlineOpacity?: number;
  labelVisible?: boolean;
  labelText?: string;
  labelLiftM?: number;
}

export interface DemoBoreholeSourceLocationStyle {
  visible?: boolean;
  mode?: DemoBoreholeSourceLocationMode;
  color?: string;
  opacity?: number;
  diameterM?: number;
  lengthM?: number;
  lineWidth?: number;
  topRingVisible?: boolean;
  topRingRadiusM?: number;
  topRingTubeM?: number;
  topRingColor?: string;
  topRingOpacity?: number;
  labelVisible?: boolean;
  labelLiftM?: number;
  items?: Record<string, DemoBoreholeSourceLocationItemStyle>;
}

export interface DemoBoreholeSourceLocationItemStyle {
  visible?: boolean;
  labelVisible?: boolean;
}

export interface MtSurfaceBoundaryStyle {
  visible?: boolean;
  label?: string;
  color?: string;
  comparison?: "<=" | ">=";
  thresholdOhmM?: number;
  thresholdLog10?: number;
  opacity?: number;
  source?: "precomputed" | "live";
}

export interface SeismicProductDisplayState {
  visible?: boolean;
  opacity?: number;
  renderMode?: "slice" | "raymarch";
  sliceAxis?: "inline" | "crossline" | "sample" | "line";
  sliceFraction?: number;
  sliceThroughVolume?: boolean;
  amplitudeMin?: number;
  amplitudeMax?: number;
  amplitudeGamma?: number;
  colormap?: "blue-white-red" | "grayscale" | "velocity";
  removeBackground?: boolean;
  backgroundCutoff?: number;
  timeScale?: number;
  volumeSampleSteps?: number;
}

// Style fields the alpha actually applies to the live scene. Loaders read
// these; the editor writes them. Unknown fields pass through untouched
// so future polish work can add fields without breaking the loader.
export interface EditableStyle {
  // Primary feature colour. For terrain-composited polygon layers like lakes,
  // this is the infill colour.
  color?: string;
  // Optional edge/outline colour for polygon layers that render a separate
  // boundary line, currently used by hydrography-lakes.
  outlineColor?: string;
  // Optional infill-only opacity for polygon layers with a distinct filled
  // surface. Currently used by hydrography-lakes so the lake body can be tuned
  // separately from the outline/whole-layer opacity.
  fillOpacity?: number;
  opacity?: number;
  // Generated local atmosphere impostor controls. Immutable/default placement
  // can live in ProjectLayerSpec.metadata.localAtmosphereVolume; these mutable
  // values are authored through environment.layerStyles and page layerOverrides.
  atmosphereSubtype?: "mist" | "ground-fog" | "cloud-bank" | "steam-plume";
  atmosphereBoundsMode?: "box" | "ellipsoid";
  atmosphereBoundsCenterX?: number;
  atmosphereBoundsCenterY?: number;
  atmosphereBoundsCenterZ?: number;
  atmosphereBoundsSizeX?: number;
  atmosphereBoundsSizeY?: number;
  atmosphereBoundsSizeZ?: number;
  atmosphereDensity?: number;
  atmosphereSoftness?: number;
  atmospherePuffCount?: number;
  atmospherePuffScaleM?: number;
  atmosphereScaleJitter?: number;
  atmosphereVerticalFalloff?: number;
  atmosphereEdgeFade?: number;
  atmosphereSeed?: number;
  atmosphereDriftEnabled?: boolean;
  atmosphereDriftSpeedMps?: number;
  atmosphereDriftDirectionX?: number;
  atmosphereDriftDirectionY?: number;
  atmosphereDriftDirectionZ?: number;
  atmosphereDepthTest?: boolean;
  atmosphereRenderOrder?: number;
  atmosphereBoundsHelperVisible?: boolean;
  // Screen-space line width for Line2/LineSegments2 layers and polygon
  // outline layers.
  lineWidth?: number;
  // Ground-surface contour display controls.
  contourDistanceFadeNearM?: number;
  contourDistanceFadeFarM?: number;
  contourFarLineScale?: number;
  contourFarOpacity?: number;
  contourLiftM?: number;
  // Internal render-preset contour patch fields. These are derived from the
  // active renderPreset.contourMode at runtime and target contour/isoline line
  // materials only; they are not authored layer controls.
  contourPresetMode?: CinematicContourMode;
  contourPresetColor?: string;
  contourPresetOpacity?: number;
  contourPresetLineWidth?: number;
  // Shahbazi ground surface preview height-gradient controls. These recolour
  // the mesh vertex colour buffer at runtime and do not affect other layers.
  surfaceGradientLowColor?: string;
  surfaceGradientMidColor?: string;
  surfaceGradientHighColor?: string;
  surfaceGradientMidpoint?: number;
  surfaceGradientContrast?: number;
  // Mesh-preview display variables for inferred/geophysical helper surfaces.
  // Used by the Utah FORGE MT top-envelope layer so the surface can be lifted
  // or shown as a wireframe without regenerating the source-derived artifact.
  meshSurfaceLiftM?: number;
  meshWireframe?: boolean;
  meshRoughness?: number;
  meshMetalness?: number;
  // Public surface context crop. Stored on the terrain layer style and
  // applied to terrain, roads, streams, and waterbodies together.
  publicSurfaceClipEnabled?: boolean;
  publicSurfaceClipCenterX?: number;
  publicSurfaceClipCenterY?: number;
  publicSurfaceClipCenterZ?: number;
  publicSurfaceClipSizeX?: number;
  publicSurfaceClipSizeY?: number;
  publicSurfaceClipSizeZ?: number;
  publicSurfaceClipRotationZDeg?: number;
  publicSurfaceClipShape?: "box" | "circle";
  publicSurfaceClipPreviewVisible?: boolean;
  // Deprecated compatibility state from DEC-077. Scene section planes and
  // frames now clip targeted topo context by default (DEC-097), so this flag
  // is retained only so older project JSON remains readable.
  topoSectionable?: boolean;
  // Terrain-draped longitude/latitude grid controls. Used by the Utah FORGE
  // topomap graticule layer; coordinates are generated from project CRS and
  // rendered as visual reference only.
  graticuleLabelVisible?: boolean;
  graticuleLabelSizeM?: number;
  graticuleLiftM?: number;
  graticuleEdgeFadeAware?: boolean;
  graticuleEdgeFadeStrength?: number;
  graticuleEdgeLineColor?: string;
  graticuleEdgeLineWidth?: number;
  // When true, graticule line widths are interpreted in world meters instead
  // of screen-space pixels, so lines visibly shrink with camera distance
  // (true perspective). Defaults to false so existing pages keep the
  // current screen-space line weight behavior.
  graticulePerspectiveLineWidth?: boolean;
  // When true, render the four graticule roles as flat ribbon meshes
  // (unlit, no shadow, world-space width) instead of LineSegments2. Ribbons
  // naturally exhibit perspective foreshortening — far portions of a ribbon
  // render thinner than near portions without any shader trickery.
  graticuleRibbonMode?: boolean;
  // Ribbon width in world meters when graticuleRibbonMode is true.
  graticuleRibbonWidthM?: number;
  // When true, ribbons use additive blending so their color survives the
  // scene's SSAO/post-processing darkening — keeps ribbons vibrant against
  // terrain. Defaults to true.
  graticuleRibbonAdditive?: boolean;
  // Brightness multiplier applied to ribbon material color. Useful when
  // additive blending alone isn't enough or the user wants extra punch.
  graticuleRibbonBrightness?: number;
  // Reserved for a future depth-aware overlay pass that soft-fades ribbon
  // alpha when ribbons pass behind other scene geometry. Currently a no-op —
  // ribbons render with `depthTest: true` against the existing scene depth
  // buffer (MT volume's `depthWrite: false` means MT does not yet occlude).
  graticuleRibbonOcclude?: boolean;
  // Falloff distance (metres) the future soft-mask would use. Currently a
  // no-op; see `graticuleRibbonOcclude`.
  graticuleRibbonOcclusionSoftnessM?: number;
  // ---- Half-degree (.5) line overrides ---------------------------------
  // When set, override the default major-line width/opacity/color for the
  // half-degree interior + leader dashed roles. Unset = fall back to the
  // main `lineWidth`/`opacity`/`color` scaled by TOPO_GRATICULE_MINOR_SCALE
  // (legacy behavior).
  graticuleMinorLineWidth?: number;
  graticuleMinorOpacity?: number;
  graticuleMinorColor?: string;
  graticuleMinorRibbonWidthM?: number;
  // ---- Leader colour blend --------------------------------------------
  // When true, leader segments (white edge ticks) fade their colour along
  // their length: inner end (at terrain edge) uses the inner colour, outer
  // end (at label end) uses the outer colour. Bridges the gap between the
  // interior graticule colour and the edge label colour visually.
  graticuleLeaderBlendEnabled?: boolean;
  // Defaults: inner = main graticule colour, outer = edge line colour.
  graticuleLeaderBlendInnerColor?: string;
  graticuleLeaderBlendOuterColor?: string;
  // Curve shape for the gradient: 0 = linear, 1 = smoothstep. Defaults to 1.
  graticuleLeaderBlendSmoothstep?: boolean;
  graticuleEdgeLabelColor?: string;
  graticuleEdgeLabelVisible?: boolean;
  graticuleEdgeLabelOffsetM?: number;
  graticuleEdgeLabelGapM?: number;
  // Generic scalar preview controls for source-derived point clouds and slice
  // meshes. Used by Utah FORGE MT resistivity previews; values remain in
  // source units, only the display ramp/range changes.
  scalarColorLow?: string;
  scalarColorMid?: string;
  scalarColorHigh?: string;
  scalarBlendMin?: number;
  scalarBlendMax?: number;
  scalarDisplayMin?: number;
  scalarDisplayMax?: number;
  scalarFocusMin?: number;
  scalarFocusMax?: number;
  // Source cell inclusion is separate from resistivity display/focus styling.
  // "all-valid" keeps source cells drawable while visual windows adjust color
  // and emphasis; "thresholded" permits log10 resistivity windows and lateral
  // support to filter draws.
  scalarInclusionMode?: "all-valid" | "thresholded";
  scalarMidpoint?: number;
  scalarContrast?: number;
  scalarEdgeHighlight?: number;
  scalarEdgeColor?: string;
  scalarEdgeLowerValue?: number;
  scalarEdgeUpperValue?: number;
  scalarEdgeLineWidth?: number;
  scalarEdgeAverage?: number;
  scalarEdgeFillOffset?: number;
  scalarEdgeLineStyle?: "solid" | "dashed";
  scalarNoiseThreshold?: number;
  scalarDistanceLightStrength?: number;
  scalarSurfaceMaskEnabled?: boolean;
  scalarSurfaceMaskDepthM?: number;
  scalarSurfaceMaskFeatherM?: number;
  scalarLegendVisible?: boolean;
  // Scalar section ISO controls. Applied to authored/future scalar section
  // meshes that expose per-vertex scalar values; point clouds keep using the
  // scalarEdge* controls above.
  sectionIsoEnabled?: boolean;
  sectionIsoLinesVisible?: boolean;
  sectionIsoBandsVisible?: boolean;
  sectionIsoTargetIds?: Record<string, boolean>;
  sectionIsoMin?: number;
  sectionIsoMax?: number;
  sectionIsoLevelCount?: number;
  sectionIsoLineWidth?: number;
  sectionIsoLineStyle?: "solid" | "dashed";
  sectionIsoBandOpacity?: number;
  sectionIsoFillOffset?: number;
  sectionIsoSourceOpacity?: number;
  // Symbolic point-marker display controls. Coordinates stay measured;
  // marker size/lift only changes readability in the scene.
  pointMarkerRadiusM?: number;
  pointMarkerLiftM?: number;
  pointMarkerLabelLiftM?: number;
  pointMarkerAlignToTopo?: boolean;
  // Utah FORGE demo/orientation borehole layer controls. Coordinates are
  // source-derived where available; these fields only tune presentation.
  demoBoreholeWells?: Record<string, DemoBoreholeWellStyle>;
  demoBoreholeBlock?: DemoOrientationBlockStyle;
  demoBoreholeSourceLocations?: DemoBoreholeSourceLocationStyle;
  siteDetailsAlwaysOnTop?: boolean;
  siteDetailsAlignToTopo?: boolean;
  demoBoreholePipeRadiusM?: number;
  demoBoreholeBlockVisible?: boolean;
  // Utah FORGE authored resistivity slice controls. Vertical scale remains
  // true 1:1; these only show/hide authored section surfaces.
  resistivityHorizontalSlicesVisible?: boolean;
  resistivityVerticalSectionsVisible?: boolean;
  resistivitySliceMode?: "stack" | "single";
  resistivitySelectedSliceId?: string;
  resistivitySectionTopTraceVisible?: boolean;
  resistivitySliceVisibility?: Record<string, boolean>;
  // Utah FORGE MT scalar-volume controls. These are source-derived render
  // controls for browser-ready scalar volumes and fixed threshold surfaces.
  scalarVolumeProductId?: string;
  scalarVolumeRenderMode?: "raymarch";
  scalarVolumeOpacity?: number;
  scalarVolumeDensity?: number;
  scalarVolumeSampleSteps?: number;
  scalarVolumeTransferMode?: "soft" | "balanced" | "dense";
  scalarVolumeThresholdMin?: number;
  scalarVolumeThresholdMax?: number;
  scalarVolumeMaskVisible?: boolean;
  mtIsosurfaceProductId?: string;
  mtSurfaceBoundaryMode?: "precomputed-bank" | "live-compute";
  mtSurfaceBoundaryOrder?: string[];
  mtSurfaceBoundariesById?: Record<string, MtSurfaceBoundaryStyle>;
  mtSurfaceBoundaryLegendVisible?: boolean;
  mtThresholdSurfaceVisibility?: Record<string, boolean>;
  mtThresholdSurfaceWireframe?: boolean;
  mtThresholdSurfaceRoughness?: number;
  mtThresholdSurfaceMetalness?: number;
  mtThresholdSurfaceSide?: "front" | "double";
  mtThresholdSurfaceSmoothNormals?: boolean;
  mtThresholdSurfaceEmissiveBoost?: number;
  mtThresholdSurfaceWireframeColor?: string;
  mtThresholdSurfaceWireframeOpacity?: number;
  mtStationQcSelectedStationId?: string;
  mtStationQcPanelOpen?: boolean;
  // Utah FORGE Phase 3 seismic browser controls. These select among processed
  // SEG-Y products and only affect browser display state.
  seismicProductId?: string;
  seismicProductVisibility?: Record<string, boolean>;
  seismicProductStates?: Record<string, SeismicProductDisplayState>;
  seismicRenderMode?: "slice" | "raymarch";
  seismicSliceAxis?: "inline" | "crossline" | "sample" | "line";
  seismicSliceFraction?: number;
  seismicAmplitudeMin?: number;
  seismicAmplitudeMax?: number;
  seismicAmplitudeGamma?: number;
  seismicColormap?: "blue-white-red" | "grayscale" | "velocity";
  seismicRemoveBackground?: boolean;
  seismicBackgroundCutoff?: number;
  seismicVolumeSampleSteps?: number;
  seismicTimeScale?: number;
  seismicNavigationVisible?: boolean;
  seismicAudienceMode?: "investor" | "technical" | "data-room" | "export";
  seismicAudiencePresetId?: string;
  seismicCapabilityPresetId?: string;
  seismicDisplayRecipeId?: string;
  seismicSliceThroughVolume?: boolean;
  seismicComparisonProductId?: string;
  seismicComparisonMode?: "overlay" | "side-by-side";
  seismicComparisonSpacingM?: number;
  seismicExportLayoutId?: string;
  seismicMtCoRender?: "seismic" | "mt" | "integrated";
  seismicIsoSource?: "seismic-amplitude" | "mt-resistivity";
  seismicNavigationRoleVisibility?: {
    sources?: boolean;
    receivers?: boolean;
    lines?: boolean;
  };
  seismicLegendVisible?: boolean;
  seismicFigureAnnotationsVisible?: boolean;
  seismicFigureTextColor?: string;
  seismicFigureAxisColor?: string;
  seismicFigureCaptionBoxColor?: string;
  seismicFigureCaptionBoxOpacity?: number;
  seismicFigureHorizonColor?: string;
  seismicFigureWellColor?: string;
  seismicFigureTitle?: string;
  seismicFigureCaption?: string;
  seismicFigureScaleLabel?: string;
  seismicFigureWellLabel?: string;
  seismicFigureWellVisible?: boolean;
  seismicFigureWellPosition?: number;
  seismicFigureHorizonVisible?: boolean;
  seismicFigureHorizonPoints?: Array<[number, number]>;
  seismicFigureOutsideOffsetM?: number;
  seismicFigureLabelSizeM?: number;
  // Utah FORGE scene-wide section plane tool. Stored as a virtual layer style
  // so environment defaults and page overrides can author walkthrough cuts.
  sceneSectionEnabled?: boolean;
  sceneSectionMode?: "cutaway";
  sceneSectionTargetScope?:
    | "selected-targets"
    | "all-visible"
    | "active-selection";
  sceneSectionActiveAxis?: "x" | "y" | "z";
  sceneSectionPlanes?: {
    x?: SceneSectionPlaneState;
    y?: SceneSectionPlaneState;
    z?: SceneSectionPlaneState;
  };
  sceneSectionWindowEnabled?: boolean;
  sceneSectionWindowActiveAxis?: "x" | "y";
  sceneSectionWindowByAxis?: {
    x?: SceneSectionWindowState;
    y?: SceneSectionWindowState;
    z?: SceneSectionWindowState;
  };
  sceneSectionFrameEnabled?: boolean;
  sceneSectionActiveFrameId?: string;
  sceneSectionFrames?: SceneSectionFrameEntry[];
  sceneSectionFrameByAxis?: {
    x?: SceneSectionFrameState;
    y?: SceneSectionFrameState;
    z?: SceneSectionFrameState;
  };
  sceneSectionObjectVisibilityByAxis?: {
    x?: Record<string, SceneSectionObjectVisibilityState>;
    y?: Record<string, SceneSectionObjectVisibilityState>;
    z?: Record<string, SceneSectionObjectVisibilityState>;
  };
  sceneSectionObjectVisibilityByFrameId?: Record<
    string,
    Record<string, SceneSectionObjectVisibilityState>
  >;
  sceneSectionGroundTraceVisible?: boolean;
  sceneSectionAxesVisible?: boolean;
  sceneSectionAxisIntervalM?: number;
  sceneSectionAxisTextScale?: number;
  sceneSectionTargetLayerIds?: string[];
  sceneSectionTargetProductIds?: string[];
  sceneSectionHelperVisible?: boolean;
  sceneSectionLegendVisible?: boolean;
  // Utah FORGE working-area focus clip. Stored as a virtual layer style so the
  // editor can author page-local site-of-interest masking without mutating data.
  workingAreaFocusEnabled?: boolean;
  workingAreaFocusMode?: "inside-only" | "outside-context";
  workingAreaFocusBoundsLayerId?: string;
  workingAreaFocusTargetLayerIds?: string[];
  workingAreaFocusOutsideOpacityByLayerId?: Record<string, number>;
  workingAreaFocusHelperVisible?: boolean;
  // Whether scene fog should affect this layer. Defaults true. Terrain and
  // terrain-composited masks use shader uniforms; ordinary meshes/lines use
  // their material fog flag.
  affectedByFog?: boolean;
  // Optional per-layer fog density. When unset, the layer uses the scene
  // atmosphere density from environment.scene.fog.density.
  fogDensity?: number;
  // 0..1 multiplier for topo lines that carry terrain-derived vertex shade.
  // Used by streams so drainage colour can sit in terrain shadow without
  // becoming a fully shaded/illegible relief layer.
  terrainShadowInfluence?: number;
  // Terrain-mask edge shaping for dissolved forest cover. Threshold/cut
  // decides where the mask edge lands; softness feathers or sharpens it.
  forestEdgeThreshold?: number;
  forestEdgeSoftness?: number;
  forestEmbossHeight?: number;
  // Soil geochemistry display. Values are read from the app-prepared
  // GeoJSON and styled as graduated terrain-draped point symbols.
  geochemElement?: string;
  geochemSymbolMinRadiusM?: number;
  geochemSymbolMaxRadiusM?: number;
  geochemLiftM?: number;
  geochemSymbolThicknessM?: number;
  geochemOpacity?: number;
  geochemUseLogScale?: boolean;
  geochemShowOutline?: boolean;
  geochemOutlineColor?: string;
  geochemOutlineOpacity?: number;
  geochemPaletteLow?: string;
  geochemPaletteMid?: string;
  geochemPaletteHigh?: string;
  // Hyperspectral coverage sleeves for raw SWIR scans.
  hyperspectralRadiusM?: number;
  hyperspectralEndpointVisible?: boolean;
  hyperspectralEndpointRadiusM?: number;
  // Reported LiDAR/imagery acquisition footprint guide. The raw 2024 LiDAR
  // data was referenced as external-drive delivery in ARIS, so this styles the
  // approximate report footprint rather than a loaded point cloud.
  imageryCornerVisible?: boolean;
  imageryCornerRadiusM?: number;
  // EZ Gamma downhole-log display tuning. These are visual controls only;
  // source depths and CPS values stay unchanged in data/ez_gamma_2024.geojson.
  gammaTrackOffsetM?: number;
  gammaTrackWidthM?: number;
  gammaDepthScale?: number;
  gammaPanelVisible?: boolean;
  gammaPanelColor?: string;
  gammaPanelOpacity?: number;
  gammaCollarVisible?: boolean;
  gammaCollarColor?: string;
  gammaCollarOpacity?: number;
  gammaCollarRadiusM?: number;
  gammaSurveyTubeVisible?: boolean;
  gammaSurveyTubeColor?: string;
  gammaSurveyTubeOpacity?: number;
  gammaSurveyTubeRadiusM?: number;
  gammaSurveyTubeMode?: "solid" | "dashed";
  gammaLoggedOverburdenVisible?: boolean;
  gammaLoggedOverburdenColor?: string;
  gammaLoggedOverburdenOpacity?: number;
  gammaLoggedOverburdenRadiusM?: number;
  gammaLoggedOverburdenMode?: "solid" | "dashed";
  gammaBedrockIntervalVisible?: boolean;
  gammaBedrockIntervalColor?: string;
  gammaBedrockIntervalOpacity?: number;
  gammaBedrockIntervalRadiusM?: number;
  gammaBedrockIntervalMode?: "solid" | "dashed";
  gammaContact1Visible?: boolean;
  gammaContact2Visible?: boolean;
  gammaContact1Color?: string;
  gammaContact2Color?: string;
  gammaContact1Opacity?: number;
  gammaContact2Opacity?: number;
  gammaContactRadiusM?: number;
  gammaContactThicknessM?: number;
  gammaContactShape?: "torus" | "coin";
  gammaTracesVisible?: boolean;
  gammaRedTraceVisible?: boolean;
  gammaBlueTraceVisible?: boolean;
  gammaMirrorTraceVisible?: boolean;
  gammaRedTraceColor?: string;
  gammaBlueTraceColor?: string;
  gammaTraceOpacity?: number;
  gammaTraceWidthPx?: number;
  // When true, every feature in the layer with a userData.displayName
  // gets a frosted floating label rendered by <SceneLabels />. Default
  // false so authors opt in -- labels add visual density and shouldn't
  // appear without intent. Composes through env + page-override the
  // same way as color/opacity.
  showLabels?: boolean;
  // Per-layer label tint -- applied to the label's border + text.
  // Falls back to `color` if unset, so labels match their feature
  // colour by default with explicit override available.
  labelColor?: string;
  // Optional split colors for the HTML label chip. These fall back to
  // labelColor so old saved files keep their appearance.
  labelTextColor?: string;
  labelOutlineColor?: string;
  labelFillColor?: string;
  labelTextOpacity?: number;
  labelOutlineOpacity?: number;
  labelFillOpacity?: number;
  // Label layout mode. Site elements use the existing clustered halo
  // placement for many nearby features. Land titles stay anchored to
  // their own land feature and render as larger callouts.
  labelKind?: "siteElement" | "landTitle" | "area" | "anomaly";
  // For land-title callouts, controls where the triangle pointer sits.
  // "auto" follows the feature anchor inside the box; left/right bias
  // the callout to the corresponding side.
  labelPointerSide?: "auto" | "left" | "right";
  // When false, hides the visual connector between the label box and
  // its feature. Site elements use a leader line; land titles use a
  // triangle pointer. Defaults true.
  labelPointerVisible?: boolean;
  // Optional per-layer distance gate for large site-scale labels.
  labelFadeNearM?: number;
  labelFadeFarM?: number;
  [k: string]: unknown;
}

export interface SceneSectionPlaneState {
  enabled?: boolean;
  positionM?: number;
  invert?: boolean;
}

export interface SceneSectionWindowState {
  minAlongM?: number;
  maxAlongM?: number;
  bottomElevationM?: number;
}

export interface SceneSectionFrameEntry {
  id: string;
  label?: string;
  // Deprecated for built-in X/Y/Z frames. Custom frames may still use this to
  // opt out of the quick legend. Per-axis helper visibility now lives on
  // SceneSectionFrameState.controlsVisible.
  legendVisible?: boolean;
  axis: "x" | "y" | "z";
  plane?: SceneSectionPlaneState;
  frame?: SceneSectionFrameState;
}

export type SceneSectionAxisAlignment = "utm" | "cardinal";
export type SceneSectionAxisDatum = "utm" | "local" | "latlon";

export interface SceneSectionFrameState {
  enabled?: boolean;
  controlsVisible?: boolean;
  minAM?: number;
  maxAM?: number;
  minBM?: number;
  maxBM?: number;
  groundTraceVisible?: boolean;
  groundTraceWidthM?: number;
  axesVisible?: boolean;
  axisIntervalM?: number;
  axisTextScale?: number;
  axisTextPaddingM?: number;
  axisAHeading?: string;
  axisBHeading?: string;
  axisHeadingPaddingM?: number;
  axisHeadingColor?: string;
  axisHeadingScale?: number;
  axisAlignment?: SceneSectionAxisAlignment;
  axisDatum?: SceneSectionAxisDatum;
  axisDatumOriginEastingM?: number;
  axisDatumOriginNorthingM?: number;
  axisDatumLatLonDecimals?: number;
}

export interface SceneSectionObjectVisibilityState {
  outsideOpacity?: number;
}

// ---------- Environment (the "world") ---------------------------------------

export interface BoxOverlayStyle {
  backgroundColor?: string;
  backgroundAlpha?: number;
  textColor?: string;
  secondaryTextColor?: string;
  bodyTextColor?: string;
  borderColor?: string;
  borderAlpha?: number;
  borderWidth?: number;
  topHighlightAlpha?: number;
  bottomShadowAlpha?: number;
  backdropBlurPx?: number;
  backdropSaturation?: number;
  shadowAlpha?: number;
  shadowBlur?: number;
  shadowOffsetY?: number;
  radius?: number;
  contentPadding?: number;
  textPadding?: number;
  imagePadding?: number;
  bevelRatio?: boolean;
  headingFontFamily?: string;
  headingFontSize?: number;
  headingFontWeight?: number;
  headingItalic?: boolean;
  subheadingFontFamily?: string;
  subheadingFontSize?: number;
  subheadingFontWeight?: number;
  subheadingItalic?: boolean;
  bodyFontFamily?: string;
  bodyFontSize?: number;
  bodyFontWeight?: number;
  bodyItalic?: boolean;
  imageRadius?: number;
  imageSpacing?: number;
  imageOutlineColor?: string;
  imageOutlineAlpha?: number;
  imageOutlineWidth?: number;
  imageShadowAlpha?: number;
  imageShadowBlur?: number;
  figureLabelVisible?: boolean;
  figureLabelPrefix?: string;
  figureLabelColor?: string;
  figureLabelFontFamily?: string;
  figureLabelFontSize?: number;
  figureLabelPaddingX?: number;
  figureLabelPaddingY?: number;
  figureLabelInset?: number;
  figureLabelBackgroundColor?: string;
  figureLabelBackgroundAlpha?: number;
  figureLabelRadius?: number;
}

export interface NavigatorOverlayStyle {
  useOverride?: boolean;
  backgroundColor?: string;
  backgroundAlpha?: number;
  textColor?: string;
  borderColor?: string;
  borderAlpha?: number;
  borderWidth?: number;
  topHighlightAlpha?: number;
  bottomShadowAlpha?: number;
  backdropBlurPx?: number;
  backdropSaturation?: number;
  dividerAlpha?: number;
  radius?: number;
  groupPadding?: number;
  buttonPaddingX?: number;
  buttonPaddingY?: number;
  gap?: number;
  bottom?: number;
  fontSize?: number;
  fontWeight?: number;
  fontItalic?: boolean;
  arrowSize?: number;
  arrowFillColor?: string;
  arrowFillAlpha?: number;
  arrowOutlineColor?: string;
  arrowOutlineAlpha?: number;
  arrowOutlineWidth?: number;
  arrowBevel?: number;
  arrowPaddingX?: number;
  arrowPaddingY?: number;
  shadowAlpha?: number;
  shadowBlur?: number;
}

export interface GuiLabelVisualStyle {
  textColor?: string;
  textOpacity?: number;
  outlineColor?: string;
  outlineOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  pointerVisible?: boolean;
  pointerSide?: "auto" | "left" | "right";
}

export interface GuiLabelSettings {
  enabled?: boolean;
  styles?: {
    siteElement?: GuiLabelVisualStyle;
    landTitle?: GuiLabelVisualStyle;
    area?: GuiLabelVisualStyle;
    anomaly?: GuiLabelVisualStyle;
  };
  followLerp?: number;
  maxSpringPx?: number;
  pinGapPx?: number;
  collisionPadPx?: number;
  fadeNearM?: number;
  fadeFarM?: number;
  frustumMargin?: number;
  maxSiteLabelsDesktop?: number;
  maxSiteLabelsMobile?: number;
  leaderVisibleThresholdPx?: number;
  nearNudgeMinPx?: number;
  nearNudgeMaxPx?: number;
  nearNudgeScale?: number;
  farNudgeMinPx?: number;
  farNudgeMaxPx?: number;
  farNudgeScale?: number;
  topNudgePenalty?: number;
  farNudgePenalty?: number;
  bottomPenalty?: number;
  bottomDiagonalPenalty?: number;
  overlapPenalty?: number;
  crossingPenalty?: number;
  distancePenaltyDivisor?: number;
  landTitleDistancePenaltyDivisor?: number;
  movementPenaltyDivisor?: number;
  sideChangePenalty?: number;
  belowAnchorPenalty?: number;
}

export interface EditorChromeSettings {
  uiScale?: number;
  panelWidthPx?: number;
  panelMarginPx?: number;
  panelLeftPx?: number;
  panelTopPx?: number;
  panelBottomSafePx?: number;
  panelCornerRadiusPx?: number;
  headerLogoPath?: string;
  headerLogoVisible?: boolean;
  headerLogoSizePx?: number;
  headerLogoGapPx?: number;
  headerLogoPaddingTopPx?: number;
  headerLogoPaddingRightPx?: number;
  headerLogoPaddingBottomPx?: number;
  headerLogoPaddingLeftPx?: number;
  headerLogoOpacity?: number;
  headerLogoBackgroundTransparent?: boolean;
  headerLogoBackgroundCutoff?: number;
  headerLogoEdgeSoftness?: number;
  headerLogoForegroundWhite?: boolean;
  headerLogoCropX?: number;
  headerLogoCropY?: number;
  headerLogoCropWidth?: number;
  headerLogoCropHeight?: number;
  headerTitleVisible?: boolean;
  headerHeightPx?: number;
  headerFontSizePx?: number;
  headerGapPx?: number;
  sectionMarginXPx?: number;
  sectionGapYPx?: number;
  topBarBottomGapPx?: number;
  containerGapPx?: number;
  containerAlignItems?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "stretch"
    | "baseline";
  containerJustifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  containerBodyIndentPx?: number;
  barRadiusPx?: number;
  topBarHeightPx?: number;
  nestedBarHeightPx?: number;
  pillTextInsetPx?: number;
  pageListIndentPx?: number;
  scrollEndPaddingPx?: number;
  saveFooterGapPx?: number;
  saveIconSizePx?: number;
  sliderTrackHeightPx?: number;
  sliderThumbSizePx?: number;
}

export interface BoxOverlayStylePreset {
  id: string;
  label: string;
  overlay: BoxOverlayStyle;
  navigator?: NavigatorOverlayStyle;
  labels?: GuiLabelSettings;
}

export interface TopoImageMaterialDetailOverlay {
  id: string;
  label?: string;
  texturePath?: string;
  texture4096Path?: string;
  texture8192Path?: string;
  textureBudget?: 4096 | 8192;
  format?: "jpeg" | "png" | "webp";
  hasAlpha?: boolean;
  bounds: [number, number, number, number];
  resolutionM?: number;
  opacity?: number;
  edgeFeatherM?: number;
}

export interface TopoImageMaterialSource {
  id: string;
  label: string;
  texturePath?: string;
  texture4096Path?: string;
  texture8192Path?: string;
  textureBudget?: 4096 | 8192;
  format?: "jpeg" | "png" | "webp";
  hasAlpha?: boolean;
  bounds?: [number, number, number, number];
  detailOverlays?: TopoImageMaterialDetailOverlay[];
  attribution?: string;
  provenancePath?: string;
  defaultSurfaceOpacity?: number;
  defaultOpacity?: number;
  defaultHillshadeBlend?: number;
  defaultBrightness?: number;
  defaultContrast?: number;
  defaultSaturation?: number;
}

export type BuiltInRenderPresetId =
  | "cinematic-dark"
  | "survey-daylight"
  | "boardroom"
  | "data-room"
  | "night-ops";

export type UserRenderPresetId = `user-${number}`;

export type RenderPresetId =
  | BuiltInRenderPresetId
  | UserRenderPresetId
  | (string & {});

export type LensPreset =
  | "ultra-wide"
  | "wide"
  | "documentary"
  | "standard"
  | "portrait"
  | "tele";

export type DepthOfFieldFocusMode =
  | "page-target"
  | "camera-object"
  | "manual-distance"
  | "picked-point";

export type ColorFilterPreset =
  | "none"
  | "warm"
  | "cool"
  | "bleach"
  | "noir"
  | "teal-orange"
  | "sepia"
  | "infrared";

// Open bag of scene-level concerns. The loader honours fields it knows and
// ignores the rest. Add new fields here as polish needs them without
// touching the loader.
export interface SceneProperties {
  // Renderer clear color for the dark/default scene mode.
  background?: string;
  // Renderer clear color for light scene mode. When absent, light mode uses
  // its runtime neutral default.
  lightModeBackground?: string;

  // Sun direction (still required -- drives the key light and terrain
  // hillshade). Sky-shader visuals are gone; this is purely geometric.
  sun?: {
    elevation?: number; // degrees above horizon
    azimuth?: number; // degrees clockwise from north
    lockToCamera?: boolean;
    // Sun light and sky-image controls are intentionally separate: authors
    // can use the orb as a fake visual, keep lighting with no visible sun,
    // or use both together.
    lightEnabled?: boolean;
    orbVisible?: boolean;
    orbColor?: string;
    orbOpacity?: number;
    orbSizeM?: number;
    orbDistanceM?: number;
    orbEdgeSoftness?: number;
    orbHaloColor?: string;
    orbHaloOpacity?: number;
    orbHaloScale?: number;
    orbRenderOrder?: number;
    sourceMarkerVisible?: boolean;
    sourceMarkerOpacity?: number;
  };

  // Exponential fog (FogExp2) -- soft falloff. Density tuned so the
  // farthest visible terrain dissolves before the tile edge.
  fog?: {
    enabled?: boolean;
    color?: string;
    lightModeColor?: string;
    density?: number;
  };
  shadows?: boolean;

  // Global camera treatment. Page poses still own position/target/up; this
  // optional lens value overrides page FOV so the whole presentation can be
  // made wider or flatter without re-capturing every page.
  camera?: { fov?: number; lensPreset?: LensPreset };
  cameraFocus?: SceneCameraFocusSettings;

  // Lighting rig. Tuned in code defaults; not user-touched in the
  // stripped editor panel except for the studio on/off switch. This is a
  // presentation-lighting treatment, not an engineering illumination model.
  lighting?: {
    enabled?: boolean;
    showSceneElements?: boolean;
    hemisphere?: { sky?: string; ground?: string; intensity?: number };
    directional?: {
      color?: string;
      intensity?: number;
      position?: Vec3;
      castShadow?: boolean;
    };
    fill?: { color?: string; intensity?: number; position?: Vec3 };
    rim?: { color?: string; intensity?: number; position?: Vec3 };
    sources?: Array<{
      id: string;
      label?: string;
      enabled?: boolean;
      type?: "spot" | "area" | "point" | "directional";
      color?: string;
      intensity?: number;
      gain?: number;
      position?: Vec3;
      target?: Vec3;
      distance?: number;
      decay?: number;
      angle?: number;
      penumbra?: number;
      width?: number;
      height?: number;
    }>;
  };

  // Tone mapping + exposure. ACES filmic by default.
  toneMapping?: "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx";
  exposure?: number;

  // Greyscale render-time override. When true, SceneManager swaps the
  // terrain elevation ramp to a neutral greyscale palette and the
  // fog / clear color to a light grey, so the whole frame reads as
  // light/neutral rather than warm/dark. Authored colors stay
  // untouched in env.json -- this is a render-time toggle, not a
  // destructive edit. Geological data (drillholes, collars, targets,
  // hydrography, claim boundary, scene overlays) keeps its authored
  // colors so it pops against the neutral terrain.
  lightMode?: boolean;

  // Bloom global defaults. Page-level `bloomBoost` multiplies these.
  bloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
  };

  // Screen-space ambient occlusion / contact depth. This adds grounded
  // creases around mesh-based customer data such as assay cylinders,
  // geochem pucks, hyperspectral tubes, EZ gamma geometry, and area outlines.
  ambientOcclusion?: {
    enabled?: boolean;
    radius?: number;
    minDistance?: number;
    maxDistance?: number;
  };

  // Drill trace assay display. These are global drilling presentation knobs:
  // the loader owns the assay data and color bins, while SceneManager applies
  // these material settings live when the environment changes.
  drilling?: {
    assays?: {
      traceMode?: "assay" | "lithology" | "both";
      showBoreLine?: boolean;
      boreLineColor?: string;
      boreLineWidthPx?: number;
      boreLineOpacity?: number;
      boreLineRenderOrder?: number;
      showBoreTube?: boolean;
      boreTubeColor?: string;
      boreTubeOpacity?: number;
      boreTubeRoughness?: number;
      boreTubeMetalness?: number;
      boreTubeEmissiveColor?: string;
      boreTubeEmissive?: number;
      boreTubeRenderOrder?: number;
      assayWidthMultiplier?: number;
      lithologyWidthMultiplier?: number;
      lithologyOpacity?: number;
      showAssaySides?: boolean;
      showAssayCaps?: boolean;
      assaySideOpacity?: number;
      assayCapOpacity?: number;
      assayCapThicknessM?: number;
      assaySideRoughness?: number;
      assayCapRoughness?: number;
      assayMetalness?: number;
      assaySideEmissive?: number;
      assayCapEmissive?: number;
      assaySideRenderOrder?: number;
      assayCapRenderOrder?: number;
      showBoreLens?: boolean;
      boreLensColor?: string;
      boreLensOpacity?: number;
      colorStops?: Array<{
        id: string;
        label: string;
        color: string;
      }>;
    };
  };

  // Topo-detail line distance treatment. These tune the terrain-projected
  // roads, streams, and power-line reference layers so they thin/fade into
  // camera distance instead of reading as flat screen-space ink.
  topoDetails?: {
    distanceFadeNear?: number;
    distanceFadeFar?: number;
    farLineScale?: number;
    farOpacity?: number;
  };

  // Optional post-grade fields. Hand-edit only; no panel UI.
  vignette?: { strength?: number; smoothness?: number };
  colorGrade?: {
    contrast?: number;
    saturation?: number;
    // Smart-saturation curve that mostly affects flat / pastel regions
    // and leaves already-saturated pixels alone. 1.0 = no effect.
    vibrancy?: number;
    tint?: string;
    tintStrength?: number;
    temperature?: number;
    blackPoint?: number;
    whitePoint?: number;
    lift?: number;
    gamma?: number;
    gain?: number;
    splitShadowColor?: string;
    splitHighlightColor?: string;
    splitToneAmount?: number;
    filterPreset?: ColorFilterPreset;
    filterIntensity?: number;
  };
  depthOfField?: {
    enabled?: boolean;
    focusMode?: DepthOfFieldFocusMode;
    focusDistanceM?: number;
    focusPoint?: Vec3;
    focusOffsetM?: number;
    aperture?: number;
    maxBlur?: number;
    debugFocusPlane?: boolean;
    debugFocusPlaneOpacity?: number;
    debugFocusPlaneScale?: number;
  };
  tiltShift?: {
    enabled?: boolean;
    centerX?: number;
    centerY?: number;
    angleDeg?: number;
    bandSize?: number;
    feather?: number;
    blur?: number;
  };
  lensEffects?: {
    grain?: number;
    grainSize?: number;
    distortion?: number;
    chromaticAberration?: number;
    sharpen?: number;
    diffusion?: number;
    halation?: number;
    anamorphicStreak?: number;
    anamorphicStreakLength?: number;
    anamorphicStreakThreshold?: number;
  };
  motionTrails?: {
    enabled?: boolean;
    amount?: number;
  };
  presentationFrame?: {
    letterbox?: boolean;
    aspectRatio?: "none" | "16:9" | "1.85:1" | "2.39:1" | "4:3";
    matteOpacity?: number;
    matteColor?: string;
    cornerFade?: number;
    gateWeave?: number;
  };
  compositionGuides?: {
    enabled?: boolean;
    ruleOfThirds?: boolean;
    centerCross?: boolean;
    safeFrame?: boolean;
    aspectMask?: "none" | "16:9" | "1.85:1" | "2.39:1";
    lineThickness?: number;
  };

  // Optional cinematic preset references. These are config-only until a
  // future resolver explicitly patches existing scene fields; missing values
  // preserve current behavior.
  activeRenderPresetId?: RenderPresetId;
  renderPresets?: RenderPreset[];

  // Presenter/UI chrome aesthetics. These are global, project-level visual
  // settings, not per-page content.
  gui?: {
    overlay?: BoxOverlayStyle;
    navigator?: NavigatorOverlayStyle;
    overlayStyles?: BoxOverlayStylePreset[];
    activeOverlayStyleId?: string;
    logo?: {
      path?: string;
      visible?: boolean;
      x?: number;
      y?: number;
      width?: number;
      opacity?: number;
    };
    labels?: GuiLabelSettings;
    editor?: EditorChromeSettings;
  };

  // Terrain shading (custom shader uniforms).
  terrain?: {
    materialPreset?: string;
    rampLow?: string;
    rampMid?: string;
    rampHigh?: string;
    elevLowM?: number;
    elevHighM?: number;
    surfaceElevationEnabled?: boolean;
    surfaceElevationLegendVisible?: boolean;
    surfaceElevationMinM?: number;
    surfaceElevationMaxM?: number;
    surfaceElevationColors?: string[];
    surfaceElevationColorPositions?: number[];
    surfaceElevationMidpoints?: number[];
    surfaceElevationTransitionSoftness?: number;
    surfaceElevationColorBlend?: number;
    surfaceElevationReverse?: boolean;
    verticalExaggeration?: number;
    hillshadeIntensity?: number;
    rockHueVariance?: number;
    shadowSharpness?: number;
    facetStrength?: number;
    edgeFadeDistanceM?: number;
    edgeFadeShape?: "square" | "rounded-square" | "circle";
    edgeFadeInsetM?: number;
    edgeFadeCornerRadiusM?: number;
    edgeOutlineEnabled?: boolean;
    edgeOutlineOffsetM?: number;
    edgeOutlineThicknessM?: number;
    edgeOutlineColor?: string;
    edgeOutlineOpacity?: number;
    edgeTopShine?: number;
    edgeCornerShine?: number;
    edgeBottomShine?: number;
    topoImageMaterialSources?: TopoImageMaterialSource[];
    orthoPhotoTextureBudget?: 4096 | 8192;
    orthoPhotoPath?: string;
    orthoPhotoTexture4096Path?: string;
    orthoPhotoTexture8192Path?: string;
    orthoPhotoBounds?: [number, number, number, number];
    orthoPhotoOpacity?: number;
    orthoPhotoEdgeClipInsetM?: number;
    orthoPhotoEdgeFadeDistanceM?: number;
    orthoPhotoHillshadeBlend?: number;
    orthoPhotoBrightness?: number;
    orthoPhotoContrast?: number;
    orthoPhotoSaturation?: number;
    orthoPhotoOutsideFillEnabled?: boolean;
    orthoPhotoOutsideSurfaceMode?: "solid" | "topo";
    orthoPhotoOutsideColor?: string;
    orthoPhotoOutsideOpacity?: number;
    orthoPhotoShadowStrength?: number;
    orthoPhotoShadowFloor?: number;
    orthoPhotoShadowTint?: string;
    projectedMapShadowsEnabled?: boolean;
    projectedMapShadowOpacity?: number;
    projectedMapShadowSoftness?: number;
    projectedMapShadowBias?: number;
    shadowTint?: string;
    gridEnabled?: boolean;
    gridColor?: string;
    gridOpacity?: number;
    gridSpacingM?: number;
    gridLineWidthM?: number;
    undersideOpacity?: number;
    fogGradientCurve?: number;
    topoMapBranding?: {
      visible?: boolean;
      logoPath?: string;
      logoSourcePath?: string;
      logoRenderablePath?: string;
      logoSourceFormat?: string;
      heading?: string;
      subheading?: string;
      anchor?: "south-west" | "south-east" | "north-west" | "north-east";
      layout?: "horizontal" | "stacked";
      logoPlacement?: "before" | "after";
      logoFit?: "contain" | "cover" | "stretch";
      offsetXM?: number;
      offsetYM?: number;
      rotationDeg?: number;
      liftM?: number;
      logoWidthM?: number;
      logoGapM?: number;
      logoOpacity?: number;
      headingSizeM?: number;
      subheadingSizeM?: number;
      lineGapM?: number;
      textColor?: string;
      textOpacity?: number;
      fontFamily?: "mono" | "sans" | "serif" | "condensed";
      headingWeight?: number;
      subheadingWeight?: number;
      headingItalic?: boolean;
      subheadingItalic?: boolean;
      textAlign?: "left" | "center" | "right";
      backgroundEnabled?: boolean;
      backgroundColor?: string;
      backgroundOpacity?: number;
      backgroundPaddingXM?: number;
      backgroundPaddingYM?: number;
      outlineEnabled?: boolean;
      outlineColor?: string;
      outlineOpacity?: number;
      outlineWidthM?: number;
      opacity?: number;
    };
  };

  areaOutlines?: AreaOutlineDef[];

  [k: string]: unknown;
}

export type CinematicTerrainMode = "matte" | "relief" | "ghost";

export type CinematicContourMode =
  | "off"
  | "subtle"
  | "technical"
  | "presentation"
  | "glow";

export type CinematicLightingMood =
  | "inherit"
  | "daylight"
  | "boardroom"
  | "data-room"
  | "night-ops";

export type CinematicPublicDataIntensity =
  | "minimal"
  | "subtle"
  | "standard"
  | "high-contrast";

export type CinematicLabelDensity = "off" | "low" | "medium" | "high";

export type CinematicLayerStyleTarget =
  | "roads"
  | "hydrography"
  | "boundaries"
  | "public-context"
  | "topo-contours"
  | "labels";

export type CinematicScenePatch = Partial<
  Pick<
    SceneProperties,
    | "background"
    | "fog"
    | "sun"
    | "lighting"
    | "terrain"
    | "topoDetails"
    | "lightMode"
    | "toneMapping"
    | "exposure"
    | "bloom"
    | "ambientOcclusion"
    | "vignette"
    | "colorGrade"
    | "depthOfField"
    | "tiltShift"
    | "lensEffects"
    | "motionTrails"
    | "presentationFrame"
    | "compositionGuides"
    | "gui"
  >
>;

export type CinematicLayerStylePatch = Partial<
  Pick<
    EditableStyle,
    | "color"
    | "outlineColor"
    | "fillOpacity"
    | "opacity"
    | "lineWidth"
    | "contourDistanceFadeNearM"
    | "contourDistanceFadeFarM"
    | "contourFarLineScale"
    | "contourFarOpacity"
    | "contourLiftM"
    | "affectedByFog"
    | "fogDensity"
    | "terrainShadowInfluence"
    | "showLabels"
    | "labelColor"
    | "labelTextColor"
    | "labelOutlineColor"
    | "labelFillColor"
    | "labelTextOpacity"
    | "labelOutlineOpacity"
    | "labelFillOpacity"
    | "labelKind"
    | "labelPointerVisible"
    | "labelPointerSide"
    | "labelFadeNearM"
    | "labelFadeFarM"
    | "siteDetailsAlwaysOnTop"
    | "siteDetailsAlignToTopo"
    | "pointMarkerAlignToTopo"
  >
>;

export interface CinematicLayerStylePresetPatch {
  target: CinematicLayerStyleTarget;
  style: CinematicLayerStylePatch;
}

export interface RenderPreset {
  id: RenderPresetId;
  label: string;
  source?: "built-in" | "user";
  createdAt?: string;
  updatedAt?: string;
  background: string;
  terrainMode: CinematicTerrainMode;
  contourMode: CinematicContourMode;
  publicDataMode: CinematicPublicDataIntensity;
  labelDensity: CinematicLabelDensity;
  fog: {
    enabled: boolean;
    color: string;
    density?: number;
    near?: number;
    far?: number;
  };
  lighting: {
    ambientIntensity: number;
    sunIntensity: number;
    rimIntensity: number;
    lockSunToCamera: boolean;
  };
  effects: {
    dataGlow: number;
    lineHalo: number;
    atmosphere: number;
  };
  scenePatch?: CinematicScenePatch;
  layerStylePatchesByLayerId?: Record<string, CinematicLayerStylePatch>;
}

export interface CinematicRenderPreset extends RenderPreset {
  description?: string;
  scene?: CinematicScenePatch;
  layerStylePatches?: CinematicLayerStylePresetPatch[];
  notes?: string;
}

export interface UserRenderPreset extends RenderPreset {
  source: "user";
  createdAt: string;
  scenePatch: CinematicScenePatch;
}

export interface AreaOutlineDef {
  id: string;
  label: string;
  center: [number, number];
  radiusX: number;
  radiusY: number;
  rotationDeg?: number;
  liftMeters?: number;
  fillVisible?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  outlineVisible?: boolean;
  outlineColor?: string;
  outlineOpacity?: number;
  outlineWidthM?: number;
  dashed?: boolean;
  outlineMode?: "terrain3d" | "flat2d";
  dashLengthM?: number;
  dashGapM?: number;
  labelKind?: EditableStyle["labelKind"];
}

// Scene overlays: georeferenced raster images draped on terrain (e.g.
// the Vizsla investor figures). Defined ONCE in the environment so the
// asset path + bounds + provenance live in a single place; activated
// per-page via PresentationPage.sceneOverlays so pages can show / hide
// / re-opacity the same image without duplicating its registration.
//
// Phase 1 covers plan-view rasters (the 2D maps that drape onto
// terrain). The schema accommodates a future cross-section variant
// (figure 4) but rendering for that case is deferred.
export type SceneOverlayClassification =
  | "environmental"
  | "observation"
  | "interpretation"
  | "narrative"
  | "planned";

export interface SceneOverlayDef {
  /** Path relative to project root, e.g. "data/source/vcu_2711_fig_3.png". */
  path: string;
  /** [minE, minN, maxE, maxN] in the project CRS (EPSG:26910). */
  bounds: [number, number, number, number];
  /** Lift in metres above terrain to win the depth fight (default 8 m). */
  liftMeters?: number;
  /** 0..1; used when a page references the overlay without an opacity. */
  defaultOpacity?: number;
  /**
   * Env-level enabled flag. Default true. When false, the overlay is
   * hidden everywhere regardless of which pages reference it. Toggled
   * by the editor's env-mode visibility checkbox.
   */
  enabled?: boolean;
  /**
   * Hex tint multiplied against the texture in the shader. Default
   * "#ffffff" leaves the image unchanged; greys de-emphasize, warm/
   * cool shifts mood without losing detail.
   */
  tint?: string;
  /** Display name surfaced by hover tooltips and the Layers panel. */
  label: string;
  provenance: {
    source: string;
    classification: SceneOverlayClassification;
    date?: string;
    notes?: string;
  };
}

export interface SceneOverlayRef {
  id: string; // matches a key in environment.sceneOverlays
  visible?: boolean; // defaults to true if listed
  opacity?: number; // overrides def.defaultOpacity if set
  tint?: string; // overrides def.tint if set
}

export interface TextOverlayTiming {
  /** CSS opacity fade duration in milliseconds. */
  fadeMs?: number;
  /** Time after fade-out completes before the next text starts fading in. */
  gapMs?: number;
  /** Legacy: how long before camera arrival the target text starts fading in. */
  leadMs?: number;
  /** Screen-space slide distance used during page overlay transitions. */
  slidePx?: number;
  /** Set false for fade-only overlay transitions in an authored page. */
  slideEnabled?: boolean;
  /** CSS easing for the text overlay opacity transition. */
  easing?: EasingName;
}

export interface TextOverlayContainer {
  position?: string;
  contentFile?: string;
  images?: Array<{
    file: string;
    caption?: string;
    position?: string;
  }>;
  timing?: TextOverlayTiming;
  // When true, the overlay box is suppressed at render time even if its
  // text/images are populated. Lets the author keep content in place but
  // hide it on this page. Missing/false = current behaviour (show iff
  // content non-empty).
  hidden?: boolean;
  [k: string]: unknown;
}

export interface EnvironmentSetup {
  id: "environment"; // literal sentinel -- file content carries this too
  // Optional project-level cinematic preset selection. Missing means current
  // environment scene fields apply exactly as before.
  renderPreset?: RenderPresetId;
  // User-authored presets saved from the GUI editor. These are non-technical
  // world-building patches over existing scene/style fields; missing or empty
  // preserves current behavior.
  customRenderPresets?: UserRenderPreset[];
  layerStyles: Record<string, EditableStyle>;
  defaultVisibleLayers: string[];
  scene?: SceneProperties;
  // Optional. Missing or empty = no scene overlays in the project.
  sceneOverlays?: Record<string, SceneOverlayDef>;
}

// ---------- Presentation pages (deltas against the environment) -------------

export interface PresentationPage {
  id: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  hidden?: boolean;
  camera: Pose;
  cameraObjectFocus?: CameraObjectFocus;
  // Page hierarchy. "global" or undefined: inherits directly from
  // environment.json. Any other value MUST equal the id of an existing Sub
  // Master page (a page whose envSnapshot is present). DEC-079.
  parentMasterId?: string;
  // Frozen environment snapshot at the moment this page became a Sub Master.
  // Present iff this page IS a Sub Master. parentMasterId must be "global"
  // or undefined when envSnapshot is present. DEC-079.
  envSnapshot?: EnvironmentSetup;
  // Assigned-once ordinal (1, 2, 3, ...) for display-time numbering and
  // palette indexing. Stable across reorders and child changes. DEC-079.
  subMasterOrdinal?: number;
  dynamicCamera?: DynamicCamera;
  transition: Transition;
  holdDuration: number;
  // Delta against environment.layerStyles. Missing entry -> inherit fully.
  // Present entry -> shallow-merge over environment.layerStyles[id].
  layerOverrides?: Record<string, EditableStyle>;
  // Delta against environment.defaultVisibleLayers. Missing -> inherit.
  // true -> force show; false -> force hide.
  visibilityOverrides?: Record<string, boolean>;
  // Delta against the resolved environment.scene. Used for page-local scene
  // variables such as topo material/terrain controls and authored scene shapes.
  // This is deliberately separate from envSnapshot, which remains Sub Master
  // inheritance state.
  sceneOverrides?: Partial<SceneProperties>;
  // Per-page mood knob (Week 4). Multiplies environment exposure and bloom
  // strength on transition. Missing = inherit env defaults.
  cinematicExposure?: number;
  bloomBoost?: number;
  // Missing = inherit environment.scene.sun.lockToCamera. Present = force
  // camera-locked sun on/off for this page.
  sunLockToCamera?: boolean;
  // Optional cinematic preset reference. This is config-only until a future
  // resolver patches existing scene/style fields.
  renderPreset?: RenderPresetId;
  renderPresetId?: RenderPresetId;
  // Per-page overlay container layout (position + size as fractions of
  // viewport, resilient to authoring/presenter viewport differences).
  // x ∈ [0, 1 - width], y ∈ [0, 0.95]. Width ∈ [0.15, 0.6]. height
  // omitted = auto-fit content (capped at viewport-minus-margins).
  overlayLayout?: {
    x: number;
    y: number;
    width: number;
    height?: number;
  };
  overlay?: TextOverlayContainer;
  annotations?: unknown[];
  presenterNotes?: string;
  // Per-page activation of environment-registered scene overlays.
  // Missing -> no overlays on this page. An entry with no opacity
  // inherits env's defaultOpacity; an entry with visible:false hides
  // an otherwise-listed overlay (rare; usually just omit the entry).
  sceneOverlays?: SceneOverlayRef[];
}

// Used only at the parse boundary -- the loader splits on shape.
export type ScenePage = EnvironmentSetup | PresentationPage;

// ---------- Project manifest -----------------------------------------------

export interface ProjectLayerSpec {
  id: string;
  label: string;
  type:
    | "atmosphere-volume"
    | "drillhole"
    | "geojson"
    | "gltf"
    | "geotiff"
    | "line"
    | "mesh"
    | "point"
    | "pointcloud"
    | "polygon"
    | "seismic"
    | "volume";
  files: Record<string, string>;
  // Active browser preview artifacts. When present, loaders prefer these over
  // files so future production targets can stay out of the active path set.
  previewFiles?: Record<string, string>;
  // Declared but inactive production targets such as GLB, Potree/EPT, or
  // orthomosaic outputs that are not expected to exist yet.
  futureTargets?: Record<string, string>;
  // Style is no longer here -- moved to environment.layerStyles per #023.
  metadata: Record<string, unknown>;
}

// Defaults that aren't scene-graph: inherited by pages that don't specify.
export interface PresentationDefaults {
  transitionDuration?: number;
  transitionEasing?: EasingName;
  holdDuration?: number;
  cameraUp?: Vec3;
}

export interface ProjectManifest {
  id: string;
  name: string;
  crs: { code: string; label?: string };
  bounds: { min: Vec3; max: Vec3 };
  sceneOrigin: Vec3;
  // defaultCamera removed per #023 (page 1 is the establishing shot).
  layers: ProjectLayerSpec[];
  pageOrder: string[];
  archivedPageOrder?: string[];
  presentationDefaults?: PresentationDefaults;
  watermark: string;
  [k: string]: unknown;
}
