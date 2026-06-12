import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SEISMIC_DIR =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis";
const MANIFEST_PATH = path.join(
  ROOT,
  SEISMIC_DIR,
  "browser/seismic_manifest.json",
);
const RECIPES_PATH = path.join(
  ROOT,
  SEISMIC_DIR,
  "browser/seismic_demo_recipes.json",
);
const PROJECT_PATH = path.join(ROOT, "projects/utah-forge/project.json");
const RECIPES_PROJECT_PATH = `${SEISMIC_DIR}/browser/seismic_demo_recipes.json`;
const SEISMIC_LAYER_ID = "utah-forge-phase3-seismic-browser";

const DISCLOSURE_LABELS = [
  "public geothermal demo data",
  "processed seismic product",
  "not a mineral resource estimate",
];

const PSDM_SURROGATE_PRESET_ID = "psdm-depth-surrogate-showcase";
const PSDM_SURROGATE_LABEL =
  "Presentation-enhanced PSDM surrogate - GDR 1141, unenhanced source";
const PSDM_SURROGATE_PROVENANCE_NOTE =
  "Presentation-enhanced PSDM surrogate. Rendered from the GDR 1141 unenhanced anisotropic PSDM depth volume (Forge3d_ANI_PSDM_Stack_UnEnh). In-app contrast tuning reproduces the post-stack display-enhancement class described by the published enhanced product; no enhanced SEG-Y is held. NAD83 UTM 12N (EPSG:26912), 1800 m datum. Source: GDR 1141.";
const PSDM_58_32_TIE_PRESET_ID = "psdm-mt-58-32-source-location-tie";
const PSDM_58_32_TIE_LABEL = "PSDM + MT + 58-32 source-location tie";
const PSDM_58_32_TIE_PROVENANCE_NOTE =
  "PSDM + MT + 58-32 source-location tie. Presentation-enhanced PSDM surrogate rendered from the GDR 1141 unenhanced anisotropic PSDM depth volume (Forge3d_ANI_PSDM_Stack_UnEnh), with source-derived MT resistivity context near the IL-93 review line. No enhanced SEG-Y is held. 58-32 is shown as a GDR 1358 source-location-only marker; no 58-32 trajectory or well-tie calibration geometry is claimed.";

const PRODUCT_IDS = {
  depth3d: "gdr-1141-forge3d-ani-psdm-stack-unenh",
  time3d: "gdr-1141-forge3d-pstm-stack-enh",
  fxy3d: "gdr-1141-forge3d-poststack-time-migration-fxydecon-stack",
  velocity3d: "gdr-1015-forge3d-velo5d-float-01312018",
  line301Depth: "gdr-1015-forge2d-301-migr-depth",
  line301PsdmEnhanced: "gdr-1141-line-301-pdm-enh",
  line301PsdmUnenhanced: "gdr-1141-line-301-psdm-unenh",
  line302Depth: "gdr-1141-line-302-psdm-enh",
  line302DepthCompare: "gdr-1141-line-302-psdm-unenh",
  lineL5Depth: "gdr-1141-line-l5-psdm-enh",
  lineL5DepthCompare: "gdr-1141-line-l5-psdm-unenh",
  lineL11Depth: "gdr-1141-line-l11-psdm-enh",
  lineL11DepthCompare: "gdr-1141-line-l11-psdm-unenh",
};

const REQUIRED_LINE_IDS = ["301", "302", "L11", "L5"];

const PROCESSING_STAGE_RANK = {
  "migrated-depth-section": 1,
  "psdm-depth-section": 2,
  "pstm-time-stack": 3,
  "unmigrated-time-stack": 4,
  "time-stack": 5,
  "psdm-interval-velocity": 6,
  "velocity-model": 7,
};

function lineCatalogProducts(products) {
  return products
    .filter((product) => REQUIRED_LINE_IDS.includes(product.lineId))
    .sort((a, b) => {
      const lineDelta =
        REQUIRED_LINE_IDS.indexOf(a.lineId) - REQUIRED_LINE_IDS.indexOf(b.lineId);
      if (lineDelta !== 0) return lineDelta;
      const stageDelta =
        (PROCESSING_STAGE_RANK[a.processingStage] ?? 99) -
        (PROCESSING_STAGE_RANK[b.processingStage] ?? 99);
      if (stageDelta !== 0) return stageDelta;
      return (a.canonicalLabel ?? a.label).localeCompare(b.canonicalLabel ?? b.label);
    });
}

const exportLayouts = [
  {
    id: "investor-slide-overview",
    label: "Investor slide overview",
    audience: "investor",
    output: "deck-ready screenshot",
    includes: [
      "title",
      "survey footprint",
      "legend",
      "data status badges",
      "source submission",
      "caveat text",
    ],
    caveat:
      "Report-supporting visual only; not a mineral resource estimate or regulatory disclosure package.",
  },
  {
    id: "technical-section-layout",
    label: "Technical section layout",
    audience: "technical",
    output: "PDF-ready section figure",
    includes: [
      "north arrow",
      "scale bar",
      "CRS",
      "time/depth scale",
      "amplitude legend",
      "source file provenance",
    ],
    caveat:
      "Processed seismic display for technical review; interpretation requires qualified professional review.",
  },
  {
    id: "qp-report-support-layout",
    label: "QP report support layout",
    audience: "regulatory",
    output: "report appendix figure",
    includes: [
      "map grid",
      "legend",
      "scale bar",
      "data source",
      "CRS",
      "date",
      "limitations",
    ],
    caveat:
      "Prepared as report-supporting visualization; it does not by itself satisfy NI 43-101 or S-K 1300 disclosure requirements.",
  },
];

const derivedViews = [
  {
    id: "amplitude-strength",
    label: "Amplitude strength",
    status: "planned-experimental",
    basis: "envelope-style magnitude derived from processed amplitude tiles",
    reviewStatus: "requires-geophysicist-review",
    caveat: "Experimental display aid; not an interpreted structure or target.",
  },
  {
    id: "edge-gradient",
    label: "Edge / gradient emphasis",
    status: "planned-experimental",
    basis: "local amplitude-gradient enhancement on source-derived tiles",
    reviewStatus: "requires-geophysicist-review",
    caveat: "Experimental continuity cue; not an automatic fault pick.",
  },
  {
    id: "coherence-like-discontinuity",
    label: "Coherence-like discontinuity",
    status: "planned-experimental",
    basis: "neighborhood similarity proxy for discontinuity screening",
    reviewStatus: "requires-geophysicist-review",
    caveat: "Screening layer only; manual interpretation required before use.",
  },
  {
    id: "horizon-following-slice",
    label: "Horizon-following slice",
    status: "planned-experimental",
    basis: "manually reviewed horizon surface sampled against seismic volume",
    reviewStatus: "requires-geophysicist-review",
    caveat: "Requires reviewed horizon basis before being shown as interpretation.",
  },
];

const interpretationLayers = [
  {
    id: "reviewed-faults",
    label: "Reviewed faults",
    status: "planned",
    geometry: "polyline / surface traces",
    author: null,
    reviewStatus: "unreviewed",
    confidence: "not assigned",
    caveat: "No seismic reflector is auto-labeled as a fault or mineralized structure.",
  },
  {
    id: "reviewed-horizons",
    label: "Reviewed horizons",
    status: "planned",
    geometry: "section picks and optional horizon surfaces",
    author: null,
    reviewStatus: "unreviewed",
    confidence: "not assigned",
    caveat: "Horizons must be manually reviewed before investor or regulatory display.",
  },
  {
    id: "target-corridors",
    label: "Target corridors",
    status: "planned",
    geometry: "annotation polygons / volumes",
    author: null,
    reviewStatus: "unreviewed",
    confidence: "not assigned",
    caveat:
      "Target corridors are interpreted overlays and must not imply mineralization without review.",
  },
  {
    id: "presentation-annotations",
    label: "Presentation annotations",
    status: "planned",
    geometry: "callouts and labels",
    author: null,
    reviewStatus: "unreviewed",
    confidence: "not assigned",
    caveat: "Annotations should distinguish measured, processed, and interpreted content.",
  },
];

function ensureProduct(productIds, id) {
  if (!productIds.has(id)) {
    throw new Error(`Preset references missing seismic product: ${id}`);
  }
  return id;
}

function makePreset({
  id,
  label,
  audienceMode,
  rank,
  summary,
  displayRecipeId,
  productId,
  visibleProductIds,
  renderMode = "slice",
  sliceAxis = "inline",
  sliceFraction = 0.5,
  opacity = 0.62,
  amplitudeMin = 0.08,
  amplitudeMax = 0.92,
  amplitudeGamma = 1,
  colormap = "blue-white-red",
  backgroundCutoff = 0.16,
  volumeSampleSteps = 96,
  timeScale = 2,
  navigationVisible = true,
  presentationBarVisible = false,
  sliceThroughVolume = false,
  comparisonProductId,
  comparisonMode = "overlay",
  mtCoRender = "seismic",
  navigationRoleVisibility,
  removeBackground = false,
  capabilityGroup,
  mtStylePatch,
  exportLayoutId,
  cameraShot,
  caveats = [],
  badges = DISCLOSURE_LABELS,
  provenanceClassification,
  provenanceNote,
}) {
  return {
    id,
    label,
    audienceMode,
    rank,
    summary,
    displayRecipeId,
    productId,
    visibleProductIds: visibleProductIds ?? [productId],
    renderMode,
    sliceAxis,
    sliceFraction,
    opacity,
    amplitudeMin,
    amplitudeMax,
    amplitudeGamma,
    colormap,
    backgroundCutoff,
    volumeSampleSteps,
    timeScale,
    navigationVisible,
    presentationBarVisible,
    sliceThroughVolume,
    comparisonProductId,
    comparisonMode,
    mtCoRender,
    navigationRoleVisibility,
    removeBackground,
    capabilityGroup,
    mtStylePatch,
    exportLayoutId,
    cameraShot,
    badges,
    provenanceClassification,
    provenanceNote,
    caveats: [...DISCLOSURE_LABELS, ...caveats],
  };
}

function makeProductCatalogPreset(product, index) {
  const fallbackPlacement =
    product.navigationPlacement?.navigationSource === "fallback" ||
    product.navigationPlacement?.placementAccuracy === "approximate";
  const isVelocity = product.productKind === "velocity";
  return makePreset({
    id: `seismic-product-${product.id}`,
    label: product.canonicalLabel ?? product.label,
    audienceMode: "technical",
    rank: 100 + index,
    summary: `${product.lineLabel} ${product.processingStage} source product.`,
    displayRecipeId: "2d-line-theatre",
    capabilityGroup: "seismic-product-catalog",
    productId: product.id,
    visibleProductIds: [product.id],
    renderMode: "slice",
    sliceAxis: "line",
    opacity: isVelocity ? 0.82 : 0.74,
    colormap: isVelocity ? "velocity" : "blue-white-red",
    amplitudeMin: isVelocity ? 0 : 0.08,
    amplitudeMax: isVelocity ? 1 : 0.92,
    navigationVisible: true,
    navigationRoleVisibility: fallbackPlacement
      ? { sources: false, receivers: false, lines: true }
      : { sources: true, receivers: true, lines: true },
    mtCoRender: "seismic",
    mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
    cameraShot: `line-${product.lineId.toLowerCase()}-product-catalog`,
    caveats: fallbackPlacement
      ? ["Approximate legacy line placement; precise registration is not validated."]
      : [],
  });
}

function simplifyProduct(product) {
  return {
    id: product.id,
    label: product.label,
    lineId: product.lineId,
    lineLabel: product.lineLabel,
    processingStage: product.processingStage,
    canonicalLabel: product.canonicalLabel,
    nameEvidence: product.nameEvidence,
    surveyKind: product.surveyKind,
    productKind: product.productKind,
    domainKind: product.domainKind,
    domainUnit: product.domainUnit,
    datumM: product.datumM,
    navigationPlacement: product.navigationPlacement,
    verticalReference: product.verticalReference,
    valueEncoding: product.valueEncoding,
    sourceSubmission: product.sourceSubmission,
    amplitudeStats: product.amplitudeStats,
    raymarchVolume: product.raymarchVolume
      ? {
          dimensions: product.raymarchVolume.dimensions,
          sceneBounds: product.raymarchVolume.sceneBounds,
          sampleDomain: product.raymarchVolume.sampleDomain,
          verticalReference: product.raymarchVolume.verticalReference,
          valueEncoding: product.raymarchVolume.valueEncoding,
          amplitudeStats: product.raymarchVolume.amplitudeStats,
        }
      : null,
    raymarchCapable: Boolean(product.raymarchVolume),
  };
}

function sortByIds(products, ids) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const productIds = new Set(manifest.products.map((product) => product.id));

  for (const id of Object.values(PRODUCT_IDS)) {
    ensureProduct(productIds, id);
  }

  const threeDIds = manifest.products
    .filter((product) => product.surveyKind === "3d")
    .map((product) => product.id);
  const lineTheatreIds = [
    PRODUCT_IDS.line301Depth,
    PRODUCT_IDS.line302Depth,
    PRODUCT_IDS.lineL5Depth,
    PRODUCT_IDS.lineL11Depth,
  ];
  const requiredLineCatalogProducts = lineCatalogProducts(manifest.products);
  const productCatalogPresets = requiredLineCatalogProducts.map((product, index) =>
    makeProductCatalogPreset(product, index),
  );
  const comparisonPairs = [
    {
      id: "line-301-psdm-enhanced-vs-unenhanced",
      label: "Line 301 enhanced vs unenhanced PSDM",
      primaryProductId: PRODUCT_IDS.line301PsdmEnhanced,
      comparisonProductId: PRODUCT_IDS.line301PsdmUnenhanced,
      purpose: "before/after processing comparison",
    },
    {
      id: "line-302-psdm-enhanced-vs-unenhanced",
      label: "Line 302 enhanced vs unenhanced PSDM",
      primaryProductId: PRODUCT_IDS.line302Depth,
      comparisonProductId: PRODUCT_IDS.line302DepthCompare,
      purpose: "before/after processing comparison",
    },
    {
      id: "line-l5-psdm-enhanced-vs-unenhanced",
      label: "Line L5 enhanced vs unenhanced PSDM",
      primaryProductId: PRODUCT_IDS.lineL5Depth,
      comparisonProductId: PRODUCT_IDS.lineL5DepthCompare,
      purpose: "legacy line processing comparison",
    },
    {
      id: "line-l11-psdm-enhanced-vs-unenhanced",
      label: "Line L11 enhanced vs unenhanced PSDM",
      primaryProductId: PRODUCT_IDS.lineL11Depth,
      comparisonProductId: PRODUCT_IDS.lineL11DepthCompare,
      purpose: "legacy line processing comparison",
    },
  ];

  const displayRecipes = [
    {
      id: "investor-story",
      label: "Investor Story Mode",
      rank: 1,
      audience: "investor",
      purpose:
        "Show the survey footprint, one understandable seismic view, and MT coexistence with disclosure labels.",
      productIds: [PRODUCT_IDS.depth3d],
      renderModes: ["raymarch", "slice"],
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "3d-seismic-showcase",
      label: "3D Seismic Showcase",
      rank: 2,
      audience: "investor / technical",
      purpose:
        "Polish raymarch-capable volumes with preset shots and synchronized slice-through-volume behavior.",
      productIds: threeDIds,
      renderModes: ["raymarch", "slice"],
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "2d-line-theatre",
      label: "2D Line Theatre",
      rank: 3,
      audience: "technical / investor",
      purpose:
        "Present one section curtain at a time with comparison products, navigation provenance, and placement-status disclosure.",
      productIds: lineTheatreIds,
      comparisonPairs,
      renderModes: ["slice"],
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "integrated-geophysics",
      label: "Geophysical Integration View",
      rank: 4,
      audience: "investor / technical",
      purpose:
        "Co-render seismic and MT resistivity to demonstrate multi-method spatial integration.",
      productIds: [PRODUCT_IDS.depth3d, PRODUCT_IDS.time3d],
      renderModes: ["raymarch", "slice"],
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "confidence-provenance",
      label: "Confidence And Provenance Mode",
      rank: 5,
      audience: "data-room",
      purpose:
        "Expose inventory, CRS, processing type, provenance, domain, amplitude stats, and data confidence.",
      productIds: manifest.products.map((product) => product.id),
      renderModes: ["slice"],
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "interpretation-overlays",
      label: "Interpretation Overlay System",
      rank: 6,
      audience: "technical / investor",
      purpose:
        "Reserve reviewed faults, horizons, targets, and annotations as separate interpreted layers.",
      productIds: [PRODUCT_IDS.depth3d],
      renderModes: ["slice"],
      interpretationLayerIds: interpretationLayers.map((layer) => layer.id),
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "regulatory-export-pack",
      label: "Regulatory / QP Export Pack",
      rank: 7,
      audience: "export",
      purpose:
        "Create static map and section layouts with scale, legend, CRS, source, date, and caveats.",
      productIds: lineTheatreIds,
      renderModes: ["slice"],
      exportLayoutIds: exportLayouts.map((layout) => layout.id),
      disclosureLabels: DISCLOSURE_LABELS,
    },
    {
      id: "derived-attribute-experiments",
      label: "Derived Attribute Experiments",
      rank: 8,
      audience: "technical",
      purpose:
        "Evaluate experimental amplitude, edge, discontinuity, and horizon-following views without implying unsupported geology.",
      productIds: threeDIds,
      renderModes: ["slice"],
      derivedViewIds: derivedViews.map((view) => view.id),
      disclosureLabels: DISCLOSURE_LABELS,
    },
  ];

  const audiencePresets = [
    makePreset({
      id: PSDM_SURROGATE_PRESET_ID,
      label: PSDM_SURROGATE_LABEL,
      audienceMode: "technical",
      rank: 0,
      summary:
        "Source-derived 3D ANI PSDM depth volume with disclosed presentation enhancement from the unenhanced GDR 1141 source.",
      displayRecipeId: "3d-seismic-showcase",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "crossline",
      sliceFraction: 0.52,
      opacity: 0.5,
      amplitudeMin: 0.08,
      amplitudeMax: 0.92,
      amplitudeGamma: 1.05,
      colormap: "blue-white-red",
      backgroundCutoff: 0.16,
      volumeSampleSteps: 112,
      timeScale: 2,
      navigationVisible: true,
      presentationBarVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.34, scalarLegendVisible: true },
      cameraShot: "psdm-surrogate-showcase",
      provenanceClassification: "source-derived",
      provenanceNote: PSDM_SURROGATE_PROVENANCE_NOTE,
      caveats: [
        "Rendered from the unenhanced GDR 1141 ANI PSDM depth volume.",
        "Presentation enhancement is disclosed; no enhanced SEG-Y is held.",
        "MT is co-rendered as a separate source-derived inversion visualization.",
      ],
    }),
    makePreset({
      id: PSDM_58_32_TIE_PRESET_ID,
      label: PSDM_58_32_TIE_LABEL,
      audienceMode: "technical",
      rank: 0.5,
      summary:
        "Source-derived PSDM surrogate and MT context with 58-32 shown only as a source-location marker.",
      displayRecipeId: "3d-seismic-showcase",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.544,
      opacity: 0.5,
      amplitudeMin: 0.08,
      amplitudeMax: 0.92,
      amplitudeGamma: 1.05,
      colormap: "blue-white-red",
      backgroundCutoff: 0.16,
      volumeSampleSteps: 112,
      timeScale: 2,
      navigationVisible: true,
      presentationBarVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.42, scalarLegendVisible: true },
      cameraShot: "psdm-mt-58-32-source-location-tie",
      provenanceClassification: "source-derived",
      provenanceNote: PSDM_58_32_TIE_PROVENANCE_NOTE,
      caveats: [
        "Rendered from the unenhanced GDR 1141 ANI PSDM depth volume.",
        "Inline review slice is positioned near IL-93 for the 58-32 source-location tie.",
        "Presentation enhancement is disclosed; no enhanced SEG-Y is held.",
        "MT is co-rendered as a separate source-derived inversion visualization.",
        "58-32 is source-location-only; no 58-32 trajectory or well-tie calibration geometry is claimed.",
      ],
    }),
    makePreset({
      id: "investor-overview-volume",
      label: "Investor overview volume",
      audienceMode: "investor",
      rank: 1,
      summary:
        "Clean 3D volume, survey navigation, and MT coexistence for a first investor pass.",
      displayRecipeId: "investor-story",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.46,
      amplitudeMin: 0.12,
      amplitudeMax: 0.9,
      amplitudeGamma: 0.85,
      colormap: "blue-white-red",
      backgroundCutoff: 0.18,
      volumeSampleSteps: 112,
      timeScale: 2,
      navigationVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.34, scalarLegendVisible: true },
      cameraShot: "survey-overview",
      caveats: [
        "Uses one representative Phase 3 processed 3D product.",
        "MT is co-rendered as a separate source-derived inversion visualization.",
      ],
    }),
    makePreset({
      id: "investor-clean-slice",
      label: "Investor clean slice",
      audienceMode: "investor",
      rank: 2,
      summary:
        "Readable single inline section for discussions where volume rendering is too dense.",
      displayRecipeId: "investor-story",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.7,
      navigationVisible: true,
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.08, scalarLegendVisible: false },
      cameraShot: "inline-section",
    }),
    makePreset({
      id: "showcase-time-volume",
      label: "3D time volume flythrough",
      audienceMode: "technical",
      rank: 3,
      summary:
        "Raymarched PSTM time-domain product with time-scaled vertical display.",
      displayRecipeId: "3d-seismic-showcase",
      productId: PRODUCT_IDS.time3d,
      renderMode: "raymarch",
      sliceAxis: "crossline",
      sliceFraction: 0.52,
      opacity: 0.52,
      amplitudeGamma: 0.9,
      volumeSampleSteps: 112,
      timeScale: 3.25,
      navigationVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.08, scalarLegendVisible: false },
      cameraShot: "volume-flythrough",
    }),
    makePreset({
      id: "line-theatre-301",
      label: "Line 301 theatre",
      audienceMode: "technical",
      rank: 4,
      summary:
        "Curated Line 301 migrated-depth curtain with source-backed companion PSDM product available.",
      displayRecipeId: "2d-line-theatre",
      productId: PRODUCT_IDS.line301Depth,
      visibleProductIds: [PRODUCT_IDS.line301Depth, PRODUCT_IDS.line301PsdmEnhanced],
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.72,
      navigationVisible: true,
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "line-301-section",
      caveats: ["Line 301 view starts from the GDR 1015 migrated-depth product."],
    }),
    makePreset({
      id: "line-theatre-302",
      label: "Line 302 theatre",
      audienceMode: "technical",
      rank: 5,
      summary:
        "Curated Line 302 PSDM curtain with enhanced/unenhanced comparison visible.",
      displayRecipeId: "2d-line-theatre",
      productId: PRODUCT_IDS.line302Depth,
      visibleProductIds: [PRODUCT_IDS.line302Depth, PRODUCT_IDS.line302DepthCompare],
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.72,
      navigationVisible: true,
      comparisonProductId: PRODUCT_IDS.line302DepthCompare,
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "line-302-section",
      caveats: ["Displays both enhanced and unenhanced processed products."],
    }),
    makePreset({
      id: "integrated-geophysics",
      label: "Integrated geophysics",
      audienceMode: "investor",
      rank: 6,
      summary:
        "Seismic plus MT resistivity, tuned to show GeoSee's multi-method value proposition.",
      displayRecipeId: "integrated-geophysics",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "sample",
      sliceFraction: 0.42,
      opacity: 0.58,
      navigationVisible: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.42, scalarLegendVisible: true },
      cameraShot: "integrated-overview",
      caveats: ["Seismic and MT are separate geophysical methods shown together."],
    }),
    makePreset({
      id: "data-room-inventory",
      label: "Data room inventory",
      audienceMode: "data-room",
      rank: 7,
      summary:
        "Provenance-first view for product counts, source submissions, CRS, and confidence badges.",
      displayRecipeId: "confidence-provenance",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "inline",
      opacity: 0.62,
      navigationVisible: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.28, scalarLegendVisible: true },
      cameraShot: "data-room-overview",
      caveats: ["Inventory metadata remains browser-ready and source-traceable."],
    }),
    makePreset({
      id: "export-line-301-section",
      label: "Export Line 301 section",
      audienceMode: "export",
      rank: 8,
      summary:
        "PDF-ready Line 301 layout metadata with legend, scale, CRS, source, date, and caveat text.",
      displayRecipeId: "regulatory-export-pack",
      productId: PRODUCT_IDS.line301Depth,
      visibleProductIds: [PRODUCT_IDS.line301Depth],
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.78,
      navigationVisible: true,
      exportLayoutId: "qp-report-support-layout",
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.04, scalarLegendVisible: false },
      cameraShot: "report-section",
      caveats: [
        "The export layout is a report-supporting visual, not a compliance certification.",
      ],
    }),
  ];

  const capabilityPresets = [
    makePreset({
      id: PSDM_SURROGATE_PRESET_ID,
      label: PSDM_SURROGATE_LABEL,
      audienceMode: "technical",
      rank: 0,
      summary:
        "Source-derived 3D ANI PSDM depth volume with disclosed presentation enhancement from the unenhanced GDR 1141 source.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-volume-products",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "crossline",
      sliceFraction: 0.52,
      opacity: 0.5,
      amplitudeMin: 0.08,
      amplitudeMax: 0.92,
      amplitudeGamma: 1.05,
      backgroundCutoff: 0.16,
      volumeSampleSteps: 112,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      presentationBarVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.34, scalarLegendVisible: true },
      cameraShot: "psdm-surrogate-showcase",
      provenanceClassification: "source-derived",
      provenanceNote: PSDM_SURROGATE_PROVENANCE_NOTE,
      caveats: [
        "Rendered from the unenhanced GDR 1141 ANI PSDM depth volume.",
        "Presentation enhancement is disclosed; no enhanced SEG-Y is held.",
        "MT is co-rendered as a separate source-derived inversion visualization.",
      ],
    }),
    makePreset({
      id: PSDM_58_32_TIE_PRESET_ID,
      label: PSDM_58_32_TIE_LABEL,
      audienceMode: "technical",
      rank: 0.5,
      summary:
        "Source-derived PSDM surrogate and MT context with 58-32 shown only as a source-location marker.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "integrated-geophysics",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.544,
      opacity: 0.5,
      amplitudeMin: 0.08,
      amplitudeMax: 0.92,
      amplitudeGamma: 1.05,
      backgroundCutoff: 0.16,
      volumeSampleSteps: 112,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      presentationBarVisible: true,
      sliceThroughVolume: true,
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.42, scalarLegendVisible: true },
      cameraShot: "psdm-mt-58-32-source-location-tie",
      provenanceClassification: "source-derived",
      provenanceNote: PSDM_58_32_TIE_PROVENANCE_NOTE,
      caveats: [
        "Rendered from the unenhanced GDR 1141 ANI PSDM depth volume.",
        "Inline review slice is positioned near IL-93 for the 58-32 source-location tie.",
        "Presentation enhancement is disclosed; no enhanced SEG-Y is held.",
        "MT is co-rendered as a separate source-derived inversion visualization.",
        "58-32 is source-location-only; no 58-32 trajectory or well-tie calibration geometry is claimed.",
      ],
    }),
    makePreset({
      id: "3d-volume-psdm-depth",
      label: "3D PSDM depth volume",
      audienceMode: "technical",
      rank: 1,
      summary: "True 3D PSDM depth product in raymarch volume mode.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-volume-products",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.48,
      amplitudeGamma: 0.9,
      backgroundCutoff: 0.18,
      volumeSampleSteps: 112,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "psdm-depth-volume",
    }),
    makePreset({
      id: "3d-volume-pstm-time",
      label: "3D PSTM time volume",
      audienceMode: "technical",
      rank: 2,
      summary: "True 3D PSTM time product in raymarch volume mode.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-volume-products",
      productId: PRODUCT_IDS.time3d,
      renderMode: "raymarch",
      sliceAxis: "crossline",
      sliceFraction: 0.5,
      opacity: 0.52,
      amplitudeGamma: 0.85,
      backgroundCutoff: 0.18,
      volumeSampleSteps: 112,
      timeScale: 3.25,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "pstm-time-volume",
    }),
    makePreset({
      id: "3d-volume-fxydecon",
      label: "3D FXY decon volume",
      audienceMode: "technical",
      rank: 3,
      summary: "Post-stack time migration FXY decon product in 3D volume mode.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-volume-products",
      productId: PRODUCT_IDS.fxy3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.52,
      amplitudeGamma: 0.9,
      backgroundCutoff: 0.18,
      volumeSampleSteps: 112,
      timeScale: 3.25,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "fxydecon-volume",
    }),
    makePreset({
      id: "3d-velocity-volume",
      label: "3D velocity volume",
      audienceMode: "technical",
      rank: 4,
      summary: "GDR 1015 3D velocity-time product in raymarch volume mode.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-volume-products",
      productId: PRODUCT_IDS.velocity3d,
      renderMode: "raymarch",
      sliceAxis: "sample",
      sliceFraction: 0.45,
      opacity: 0.48,
      amplitudeGamma: 1.1,
      colormap: "velocity",
      backgroundCutoff: 0.14,
      volumeSampleSteps: 96,
      timeScale: 3,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "velocity-volume",
    }),
    makePreset({
      id: "inline-slice",
      label: "Inline slice",
      audienceMode: "technical",
      rank: 5,
      summary: "3D product as a standard inline section.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-slice-planes",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.7,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "inline-slice",
    }),
    makePreset({
      id: "crossline-slice",
      label: "Crossline slice",
      audienceMode: "technical",
      rank: 6,
      summary: "3D product as a standard crossline section.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-slice-planes",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "crossline",
      sliceFraction: 0.5,
      opacity: 0.7,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "crossline-slice",
    }),
    makePreset({
      id: "time-depth-plane",
      label: "Time/depth plane",
      audienceMode: "technical",
      rank: 7,
      summary: "Horizontal sample-domain plane through a 3D seismic product.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "3d-slice-planes",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "sample",
      sliceFraction: 0.42,
      opacity: 0.68,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "time-depth-plane",
    }),
    makePreset({
      id: "volume-slice-sync",
      label: "Volume + synced slice",
      audienceMode: "technical",
      rank: 8,
      summary: "Raymarched 3D product with the selected slice plane visible.",
      displayRecipeId: "3d-seismic-showcase",
      capabilityGroup: "volume-slice-sync",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "raymarch",
      sliceAxis: "inline",
      sliceFraction: 0.5,
      opacity: 0.5,
      amplitudeGamma: 0.85,
      backgroundCutoff: 0.18,
      volumeSampleSteps: 112,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      sliceThroughVolume: true,
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.06, scalarLegendVisible: false },
      cameraShot: "synced-volume-slice",
    }),
    makePreset({
      id: "line-301-theatre",
      label: "Line 301 section theatre",
      audienceMode: "technical",
      rank: 9,
      summary: "Line 301 as a single georeferenced section curtain.",
      displayRecipeId: "2d-line-theatre",
      capabilityGroup: "2d-legacy-section-theatre",
      productId: PRODUCT_IDS.line301Depth,
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.74,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "line-301-theatre",
    }),
    makePreset({
      id: "line-302-theatre",
      label: "Line 302 section theatre",
      audienceMode: "technical",
      rank: 10,
      summary: "Line 302 as a single georeferenced section curtain.",
      displayRecipeId: "2d-line-theatre",
      capabilityGroup: "2d-legacy-section-theatre",
      productId: PRODUCT_IDS.line302Depth,
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.74,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "line-302-theatre",
    }),
    makePreset({
      id: "legacy-l5-l11-theatre",
      label: "Legacy L5 / L11 theatre",
      audienceMode: "technical",
      rank: 11,
      summary: "Legacy lines L5 and L11 as approximate reference section curtains.",
      displayRecipeId: "2d-line-theatre",
      capabilityGroup: "2d-legacy-section-theatre",
      productId: PRODUCT_IDS.lineL5Depth,
      visibleProductIds: [PRODUCT_IDS.lineL5Depth, PRODUCT_IDS.lineL11Depth],
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.72,
      navigationVisible: true,
      navigationRoleVisibility: { sources: false, receivers: false, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "legacy-lines-theatre",
      caveats: [
        "Approximate legacy line placement; precise registration is not validated.",
      ],
    }),
    makePreset({
      id: "enhanced-vs-unenhanced",
      label: "Enhanced vs unenhanced",
      audienceMode: "technical",
      rank: 12,
      summary: "Line 301 enhanced and unenhanced processed products overlaid.",
      displayRecipeId: "2d-line-theatre",
      capabilityGroup: "processing-comparison",
      productId: PRODUCT_IDS.line301PsdmEnhanced,
      visibleProductIds: [PRODUCT_IDS.line301PsdmEnhanced, PRODUCT_IDS.line301PsdmUnenhanced],
      renderMode: "slice",
      sliceAxis: "line",
      opacity: 0.7,
      comparisonProductId: PRODUCT_IDS.line301PsdmUnenhanced,
      comparisonMode: "overlay",
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "processing-comparison",
      caveats: ["Overlay comparison uses two source-derived processed products."],
    }),
    makePreset({
      id: "survey-geometry",
      label: "Survey geometry",
      audienceMode: "technical",
      rank: 13,
      summary: "Source points, receiver points, and survey lines emphasized.",
      displayRecipeId: "confidence-provenance",
      capabilityGroup: "survey-geometry",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "sample",
      sliceFraction: 0.5,
      opacity: 0.45,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "seismic",
      mtStylePatch: { opacity: 0.05, scalarLegendVisible: false },
      cameraShot: "survey-geometry",
      caveats: ["Navigation is measured acquisition geometry parsed from SEG-P1."],
    }),
    makePreset({
      id: "integrated-geophysics",
      label: "Integrated seismic + MT",
      audienceMode: "investor",
      rank: 14,
      summary: "Seismic section with MT resistivity visible for multi-method context.",
      displayRecipeId: "integrated-geophysics",
      capabilityGroup: "integrated-geophysics",
      productId: PRODUCT_IDS.depth3d,
      renderMode: "slice",
      sliceAxis: "sample",
      sliceFraction: 0.42,
      opacity: 0.58,
      navigationVisible: true,
      navigationRoleVisibility: { sources: true, receivers: true, lines: true },
      mtCoRender: "integrated",
      mtStylePatch: { opacity: 0.42, scalarLegendVisible: true },
      cameraShot: "integrated-geophysics",
      caveats: ["Seismic and MT are separate source-derived geophysical methods."],
    }),
    ...productCatalogPresets,
  ];

  for (const preset of audiencePresets) {
    ensureProduct(productIds, preset.productId);
    for (const id of preset.visibleProductIds) ensureProduct(productIds, id);
    if (preset.comparisonProductId) ensureProduct(productIds, preset.comparisonProductId);
  }
  for (const preset of capabilityPresets) {
    ensureProduct(productIds, preset.productId);
    for (const id of preset.visibleProductIds) ensureProduct(productIds, id);
    if (preset.comparisonProductId) ensureProduct(productIds, preset.comparisonProductId);
  }

  const productGroups = {
    raymarchCapable3d: sortByIds(manifest.products, threeDIds).map(simplifyProduct),
    lineTheatre: sortByIds(manifest.products, lineTheatreIds).map(simplifyProduct),
    requiredLineCatalog: requiredLineCatalogProducts.map(simplifyProduct),
    requiredLineFamilies: Object.fromEntries(
      REQUIRED_LINE_IDS.map((lineId) => [
        lineId,
        requiredLineCatalogProducts
          .filter((product) => product.lineId === lineId)
          .map(simplifyProduct),
      ]),
    ),
    allProcessedProducts: manifest.products.map(simplifyProduct),
  };

  manifest.displayRecipes = displayRecipes;
  manifest.audiencePresets = audiencePresets;
  manifest.capabilityPresets = capabilityPresets;
  manifest.derivedViews = derivedViews;
  manifest.interpretationLayers = interpretationLayers;
  manifest.exportLayouts = exportLayouts;

  const recipesArtifact = {
    schema: "geosee.seismic-demo-recipes.v1",
    derivedDate: manifest.derivedDate ?? "2026-05-13",
    sourceManifest:
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json",
    productCount: manifest.products.length,
    raymarchProductCount: threeDIds.length,
    disclosureLabels: DISCLOSURE_LABELS,
    requiredLineSourceGates: manifest.requiredLineSourceGates,
    requiredProductSourceGates: manifest.requiredProductSourceGates ?? [],
    productGroups,
    comparisonPairs,
    displayRecipes,
    audiencePresets,
    capabilityPresets,
    derivedViews,
    interpretationLayers,
    exportLayouts,
  };

  await mkdir(path.dirname(RECIPES_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(RECIPES_PATH, `${JSON.stringify(recipesArtifact, null, 2)}\n`);

  const project = JSON.parse(await readFile(PROJECT_PATH, "utf8"));
  const layer = project.layers.find((candidate) => candidate.id === SEISMIC_LAYER_ID);
  if (!layer) throw new Error(`Missing project layer ${SEISMIC_LAYER_ID}`);
  layer.previewFiles = {
    ...(layer.previewFiles ?? {}),
    seismicDemoRecipes: RECIPES_PROJECT_PATH,
  };
  layer.metadata = {
    ...(layer.metadata ?? {}),
    defaultSeismicProductId: manifest.defaultProductId,
    seismicVerticalReference: manifest.verticalReference,
    seismicValueEncoding: manifest.valueEncoding,
    seismicProducts: manifest.products.map(simplifyProduct),
    seismicRequiredLineSourceGates: manifest.requiredLineSourceGates,
    seismicRequiredProductSourceGates: manifest.requiredProductSourceGates ?? [],
    seismicDemoDisclosureLabels: DISCLOSURE_LABELS,
    seismicDisplayRecipes: displayRecipes,
    seismicAudiencePresets: audiencePresets,
    seismicCapabilityPresets: capabilityPresets,
    seismicDerivedViews: derivedViews,
    seismicInterpretationLayers: interpretationLayers,
    seismicExportLayouts: exportLayouts,
  };
  await writeFile(PROJECT_PATH, `${JSON.stringify(project, null, 2)}\n`);

  console.log(
    `Wrote ${audiencePresets.length} seismic audience presets, ${capabilityPresets.length} capability presets, and ${displayRecipes.length} display recipes.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
