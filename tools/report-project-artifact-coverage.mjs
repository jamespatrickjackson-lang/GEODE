import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const projects = [
  { slug: "utah-forge", title: "Utah FORGE", folder: "projects/utah-forge" },
  { slug: "case-study-b", title: "Case Study B / Shahbazi", folder: "projects/case-study-b" },
  { slug: "woodjam", title: "Woodjam", folder: "projects/woodjam" },
  { slug: "base-gui", title: "Base GUI", folder: "projects/base-gui" }
];
const outputDir = path.join(root, "test-results/project-artifact-coverage");
const jsonOutput = path.join(outputDir, "project-artifact-coverage.json");
const mdOutput = path.join(outputDir, "project-artifact-coverage.md");

function toDisplay(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonIfExists(filePath, notes) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    notes.push(`Could not parse ${toDisplay(filePath)}: ${error.message}`);
    return null;
  }
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry));
}

function listMetadataFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((entry) => entry.endsWith(".metadata.json"))
    .map((entry) => path.join(dirPath, entry));
}

function layerId(layer) {
  return typeof layer === "string" ? layer : layer?.id;
}

function layerLabel(layer) {
  if (typeof layer === "string") {
    return layer;
  }
  return layer?.label || layer?.name || layer?.id || "";
}

function layerType(layer) {
  if (typeof layer === "string") {
    return "unknown";
  }
  return layer?.type || "unknown";
}

function compactList(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function textIncludes(value, terms) {
  const text = String(value ?? "").toLowerCase();
  return terms.some((term) => {
    if (term.length <= 2) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
    }
    return text.includes(term);
  });
}

function layerBasicText(layer) {
  if (typeof layer === "string") {
    return layer;
  }
  return [
    layer?.id,
    layer?.label,
    layer?.name,
    layer?.type
  ].filter(Boolean).join(" ");
}

function layerSearchText(layer) {
  if (typeof layer === "string") {
    return layer;
  }
  return [
    layer?.id,
    layer?.label,
    layer?.name,
    layer?.type,
    layer?.metadata?.classification,
    layer?.metadata?.notes,
    layer?.metadata?.sourceFile
  ].filter(Boolean).join(" ");
}

function collectLayerRefs(value, knownLayerIds, refs) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && knownLayerIds.has(item)) {
        refs.add(item);
      } else {
        collectLayerRefs(item, knownLayerIds, refs);
      }
    }
    return;
  }

  if (!isObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (["visibilityOverrides", "layerOverrides", "layerStyles"].includes(key) && isObject(child)) {
      for (const candidate of Object.keys(child)) {
        if (knownLayerIds.has(candidate)) {
          refs.add(candidate);
        }
      }
    }

    if (typeof child === "string" && knownLayerIds.has(child) && /layer/i.test(key)) {
      refs.add(child);
    }

    collectLayerRefs(child, knownLayerIds, refs);
  }
}

function resolveIndexWrapperPath(projectDir, artifactDir, wrapperPath) {
  const candidates = [
    path.resolve(root, wrapperPath),
    path.resolve(projectDir, wrapperPath),
    path.resolve(artifactDir, wrapperPath)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function loadWrappers(projectDir, notes) {
  const artifactDir = path.join(projectDir, "artifact_metadata");
  const indexPath = path.join(artifactDir, "index.json");
  const index = readJsonIfExists(indexPath, notes);
  const metadataFiles = listMetadataFiles(artifactDir);
  const fileSet = new Set(metadataFiles.map((filePath) => path.resolve(filePath)));
  const wrappers = [];
  const indexPaths = [];

  if (Array.isArray(index?.wrappers)) {
    for (const entry of index.wrappers) {
      if (entry?.path) {
        const resolved = resolveIndexWrapperPath(projectDir, artifactDir, entry.path);
        indexPaths.push(resolved);
        if (!fs.existsSync(resolved)) {
          notes.push(`Index lists missing wrapper ${entry.path}`);
        }
      }
    }
  } else if (fs.existsSync(indexPath)) {
    notes.push(`${toDisplay(indexPath)} does not contain a wrappers array`);
  }

  const allWrapperFiles = compactList([...metadataFiles, ...indexPaths]);
  for (const filePath of allWrapperFiles) {
    const wrapper = readJsonIfExists(filePath, notes);
    if (wrapper) {
      wrappers.push({
        file: toDisplay(filePath),
        artifactId: wrapper.artifactId || path.basename(filePath, ".metadata.json"),
        artifactFamily: wrapper.artifactFamily || "unknown",
        artifactType: wrapper.artifactType || "unknown",
        renderRole: wrapper.renderRole || "unknown",
        loadClass: wrapper.loadClass || "unknown",
        status: wrapper.status || "unknown",
        reviewRequired: wrapper.reviewRequired,
        accepted: wrapper.accepted,
        relatedLayers: Array.isArray(wrapper.relatedLayers) ? wrapper.relatedLayers : [],
        relatedPages: Array.isArray(wrapper.relatedPages) ? wrapper.relatedPages : []
      });
    }
  }

  const filesNotListed = metadataFiles
    .filter((filePath) => !indexPaths.some((indexed) => path.resolve(indexed) === path.resolve(filePath)))
    .map(toDisplay);

  return {
    artifactMetadataIndex: fs.existsSync(indexPath) ? toDisplay(indexPath) : null,
    artifactMetadataFolder: fs.existsSync(artifactDir) ? toDisplay(artifactDir) : null,
    wrapperFilesNotListedInIndex: filesNotListed,
    wrappers
  };
}

function analyzeProject(config) {
  const notes = [];
  const projectDir = path.join(root, config.folder);
  const projectJsonPath = path.join(projectDir, "project.json");
  const environmentJsonPath = path.join(projectDir, "environment.json");
  const pagesDir = path.join(projectDir, "pages");
  const projectJson = readJsonIfExists(projectJsonPath, notes);
  const environmentJson = readJsonIfExists(environmentJsonPath, notes);
  const pageFiles = listJsonFiles(pagesDir);
  const pages = pageFiles.map((filePath) => ({
    file: toDisplay(filePath),
    data: readJsonIfExists(filePath, notes)
  })).filter((page) => page.data);

  const layers = Array.isArray(projectJson?.layers) ? projectJson.layers : [];
  const layerIds = compactList(layers.map(layerId));
  const knownLayerIds = new Set(layerIds);
  const layerMap = new Map(layers.map((layer) => [layerId(layer), layer]).filter(([id]) => id));
  const defaultVisibleLayerIds = compactList(
    Array.isArray(environmentJson?.defaultVisibleLayers) ? environmentJson.defaultVisibleLayers : []
  );

  const pageReferenced = new Set();
  for (const page of pages) {
    collectLayerRefs(page.data, knownLayerIds, pageReferenced);
  }
  const pageReferencedLayerIds = compactList([...pageReferenced]);

  const wrapperInfo = loadWrappers(projectDir, notes);
  const wrappers = wrapperInfo.wrappers;
  const wrapperLayerIds = compactList(wrappers.flatMap((wrapper) => wrapper.relatedLayers));
  const layersWithWrappers = layerIds.filter((id) => wrapperLayerIds.includes(id));
  const layersWithoutWrappers = layerIds.filter((id) => !wrapperLayerIds.includes(id));
  const wrappersWithoutMatchingObservedLayerId = wrappers
    .filter((wrapper) => !wrapper.relatedLayers.some((id) => knownLayerIds.has(id)))
    .map((wrapper) => ({
      artifactId: wrapper.artifactId,
      file: wrapper.file,
      relatedLayers: wrapper.relatedLayers
    }));

  const wrapperByLayer = new Map();
  for (const wrapper of wrappers) {
    for (const id of wrapper.relatedLayers) {
      if (!wrapperByLayer.has(id)) {
        wrapperByLayer.set(id, []);
      }
      wrapperByLayer.get(id).push(wrapper);
    }
  }

  const classified = {
    highFidelityOrClientFacing: compactList(wrappers
      .filter((wrapper) => ["high_fidelity_client_facing"].includes(wrapper.renderRole) || wrapper.loadClass === "high_fidelity_client_facing")
      .flatMap((wrapper) => wrapper.relatedLayers)),
    qaOrValidation: compactList(wrappers
      .filter((wrapper) => wrapper.renderRole === "qa_validation" || wrapper.loadClass === "qa_validation" || wrapper.artifactFamily === "qa_validation")
      .flatMap((wrapper) => wrapper.relatedLayers)),
    optionalOrAdvanced: compactList(wrappers
      .filter((wrapper) => wrapper.renderRole === "optional_advanced" || wrapper.loadClass === "toggle_on_demand")
      .flatMap((wrapper) => wrapper.relatedLayers)),
    futureOrPlaceholder: compactList([
      ...layers
        .filter((layer) => layer?.metadata?.placeholder === true || textIncludes(layerSearchText(layer), ["placeholder", "future"]))
        .map(layerId),
      ...wrappers
        .filter((wrapper) => wrapper.renderRole === "future_placeholder" || wrapper.loadClass === "future_placeholder" || wrapper.artifactFamily === "future_placeholder")
        .flatMap((wrapper) => wrapper.relatedLayers)
    ]),
    needsReview: compactList([
      ...wrappers
        .filter((wrapper) => wrapper.status === "needs_review" || wrapper.loadClass === "needs_human_review" || wrapper.reviewRequired === true || wrapper.accepted !== true)
        .flatMap((wrapper) => wrapper.relatedLayers),
      ...layersWithoutWrappers
    ])
  };

  const seismicRelatedLayers = layerIds.filter((id) => {
    const layer = layerMap.get(id);
    const wrappersForLayer = wrapperByLayer.get(id) || [];
    return textIncludes(layerBasicText(layer), ["seismic"]) ||
      wrappersForLayer.some((wrapper) => wrapper.artifactType === "seismic_product");
  });

  const mtResistivityRelatedLayers = layerIds.filter((id) => {
    const layer = layerMap.get(id);
    const wrappersForLayer = wrapperByLayer.get(id) || [];
    return textIncludes(layerBasicText(layer), ["mt", "resistivity", "electrical"]) ||
      wrappersForLayer.some((wrapper) => ["mt_resistivity", "scalar_volume", "scalar_slice", "threshold_surface", "top_surface", "point_cloud_tile", "station_marker"].includes(wrapper.artifactType));
  });

  const surfacePhotoPointCloudRelatedLayers = layerIds.filter((id) => {
    const layer = layerMap.get(id);
    const type = layerType(layer).toLowerCase();
    const wrappersForLayer = wrapperByLayer.get(id) || [];
    return ["mesh", "pointcloud", "geotiff", "surface", "terrain"].some((term) => type.includes(term)) ||
      textIncludes(layerBasicText(layer), ["surface", "photo", "texture", "point", "terrain", "mesh", "contour"]) ||
      wrappersForLayer.some((wrapper) => ["top_surface", "threshold_surface", "mesh_surface", "point_cloud_tile", "photo_texture_overlay", "terrain"].includes(wrapper.artifactType));
  });

  const layerRows = layerIds.map((id) => {
    const layer = layerMap.get(id);
    const layerWrappers = wrapperByLayer.get(id) || [];
    return {
      layerId: id,
      label: layerLabel(layer),
      type: layerType(layer),
      defaultVisible: defaultVisibleLayerIds.includes(id),
      referencedByPages: pageReferencedLayerIds.includes(id),
      wrapperArtifactIds: layerWrappers.map((wrapper) => wrapper.artifactId),
      wrapperFiles: layerWrappers.map((wrapper) => wrapper.file),
      proposedRenderRoles: compactList(layerWrappers.map((wrapper) => wrapper.renderRole)),
      proposedLoadClasses: compactList(layerWrappers.map((wrapper) => wrapper.loadClass)),
      wrapperStatuses: compactList(layerWrappers.map((wrapper) => wrapper.status))
    };
  });

  const risks = [];
  if (!wrapperInfo.artifactMetadataFolder) {
    risks.push("No project-local artifact_metadata folder observed.");
  }
  if (layersWithoutWrappers.length) {
    risks.push(`${layersWithoutWrappers.length} layer(s) do not have matching artifact metadata wrappers.`);
  }
  if (wrappersWithoutMatchingObservedLayerId.length) {
    risks.push(`${wrappersWithoutMatchingObservedLayerId.length} wrapper(s) have no matching observed layer ID.`);
  }
  if (wrapperInfo.wrapperFilesNotListedInIndex.length) {
    risks.push(`${wrapperInfo.wrapperFilesNotListedInIndex.length} wrapper file(s) are not listed in index.json.`);
  }
  if (seismicRelatedLayers.length) {
    risks.push("Seismic-related layers require preservation and human review before load/visibility/runtime changes.");
  }
  if (defaultVisibleLayerIds.some((id) => layersWithoutWrappers.includes(id))) {
    risks.push("Some default-visible layers do not yet have metadata wrappers.");
  }
  notes.push(...risks);

  return {
    slug: config.slug,
    title: config.title,
    folder: config.folder,
    projectJson: fs.existsSync(projectJsonPath) ? toDisplay(projectJsonPath) : null,
    environmentJson: fs.existsSync(environmentJsonPath) ? toDisplay(environmentJsonPath) : null,
    artifactMetadataIndex: wrapperInfo.artifactMetadataIndex,
    layerCount: layerIds.length,
    defaultVisibleLayerCount: defaultVisibleLayerIds.length,
    pageCount: pages.length,
    layerIds,
    defaultVisibleLayerIds,
    pageReferencedLayerIds,
    layersWithWrappers,
    layersWithoutWrappers,
    wrappersWithoutMatchingObservedLayerId,
    wrappers: wrappers.map((wrapper) => ({
      artifactId: wrapper.artifactId,
      file: wrapper.file,
      artifactFamily: wrapper.artifactFamily,
      artifactType: wrapper.artifactType,
      renderRole: wrapper.renderRole,
      loadClass: wrapper.loadClass,
      relatedLayers: wrapper.relatedLayers,
      status: wrapper.status,
      reviewRequired: wrapper.reviewRequired,
      accepted: wrapper.accepted
    })),
    wrapperFilesNotListedInIndex: wrapperInfo.wrapperFilesNotListedInIndex,
    inferredGroups: classified,
    seismicRelatedLayers,
    mtResistivityRelatedLayers,
    surfacePhotoPointCloudRelatedLayers,
    futurePlaceholderLayers: classified.futureOrPlaceholder,
    layerRows,
    risks,
    notes: compactList(notes)
  };
}

function mdList(values) {
  return values.length ? values.map((value) => `\`${value}\``).join(", ") : "_None observed._";
}

function mdTable(headers, rows) {
  if (!rows.length) {
    return "_None observed._\n";
  }
  const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`)
  ].join("\n") + "\n";
}

function projectSection(project) {
  const rows = project.layerRows.map((row) => [
    `\`${row.layerId}\``,
    row.type,
    row.defaultVisible ? "yes" : "no",
    row.referencedByPages ? "yes" : "no",
    row.wrapperArtifactIds.length ? row.wrapperArtifactIds.map((id) => `\`${id}\``).join(", ") : "no",
    row.proposedLoadClasses.length ? row.proposedLoadClasses.join(", ") : "unwrapped / unknown"
  ]);

  return `## ${project.title}

| Metric | Value |
| --- | --- |
| Project folder | \`${project.folder}\` |
| Layers | ${project.layerCount} |
| Default-visible layers | ${project.defaultVisibleLayerCount} |
| Pages | ${project.pageCount} |
| Wrappers | ${project.wrappers.length} |

Layer IDs: ${mdList(project.layerIds)}

Default-visible layer IDs: ${mdList(project.defaultVisibleLayerIds)}

Page-referenced layer IDs: ${mdList(project.pageReferencedLayerIds)}

Layers with wrappers: ${mdList(project.layersWithWrappers)}

Layers without wrappers: ${mdList(project.layersWithoutWrappers)}

Wrappers without matching observed layer ID: ${project.wrappersWithoutMatchingObservedLayerId.length ? project.wrappersWithoutMatchingObservedLayerId.map((wrapper) => `\`${wrapper.artifactId}\``).join(", ") : "_None observed._"}

Seismic-related layers: ${mdList(project.seismicRelatedLayers)}

MT/resistivity-related layers: ${mdList(project.mtResistivityRelatedLayers)}

Surface/photo/point-cloud-related layers: ${mdList(project.surfacePhotoPointCloudRelatedLayers)}

Future/placeholder layers: ${mdList(project.futurePlaceholderLayers)}

${mdTable(["layer_id", "type", "default visible?", "page referenced?", "wrapper(s)", "proposed load class(es)"], rows)}

Current risks / notes:

${project.notes.length ? project.notes.map((note) => `- ${note}`).join("\n") : "- No project-specific notes beyond generated counts."}
`;
}

function buildMarkdown(report) {
  const summaryRows = report.projects.map((project) => [
    project.title,
    project.layerCount,
    project.defaultVisibleLayerCount,
    project.pageCount,
    project.wrappers.length,
    project.layersWithoutWrappers.length,
    project.wrappersWithoutMatchingObservedLayerId.length
  ]);

  const allLayersWithoutWrappers = report.projects.flatMap((project) =>
    project.layersWithoutWrappers.map((id) => `${project.slug}:${id}`)
  );
  const allWrappersWithoutLayers = report.projects.flatMap((project) =>
    project.wrappersWithoutMatchingObservedLayerId.map((wrapper) => `${project.slug}:${wrapper.artifactId}`)
  );

  return `# Project Artifact Coverage Report

Generated: ${report.generatedAt}

This report is generated read-only analysis. It does not change runtime behavior, project manifests, environment files, page files, visibility, rendering, prep scripts, data artifacts, generated outputs, or acceptance state.

## Summary

${mdTable(["Project", "Layers", "Default visible", "Pages", "Wrappers", "Layers without wrappers", "Wrappers without observed layer"], summaryRows)}

${projectSection(report.projects.find((project) => project.slug === "utah-forge"))}

${projectSection(report.projects.find((project) => project.slug === "case-study-b"))}

${projectSection(report.projects.find((project) => project.slug === "woodjam"))}

${projectSection(report.projects.find((project) => project.slug === "base-gui"))}

## Cross-Project Notes

- Layers without wrappers: ${mdList(allLayersWithoutWrappers)}
- Wrappers without matching observed layer ID: ${mdList(allWrappersWithoutLayers)}
- Utah FORGE currently has project-local wrappers; the other scanned projects have no project-local artifact metadata folders unless noted above.
- Default-visible layers without wrappers should be reviewed before runtime loading, visibility, page, or render-policy changes.
- Coverage reporting does not replace visual checks, screenshots, build/typecheck verification, provenance review, or human acceptance.

## Human Review Needed

- Review the generated layer/wrapper coverage before any runtime loading changes.
- Decide which layers without wrappers need metadata next.
- Review any wrappers that do not map to manifest layer IDs.
- Confirm whether default-visible unwrapped layers need first-priority wrappers.
- Confirm the first actual runtime implementation candidate only after fresh visual/render evidence exists for high-risk artifacts.

## Next Safe Implementation Candidates

- Review this generated report with a human and mark priority wrappers.
- Create metadata wrappers for default-visible unwrapped context layers only after review.
- Complete focused visual screenshots/render receipts for Utah FORGE MT/seismic before runtime loading work.
- Keep lazy loading, disposal, visibility, material, scalar range, color ramp, seismic product, and page changes blocked until wrapper coverage and visual receipts are reviewed.
`;
}

const report = {
  generatedAt: new Date().toISOString(),
  scope: "Read-only project layer/artifact/wrapper coverage report.",
  projects: projects.map(analyzeProject)
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdOutput, buildMarkdown(report));

console.log(`Wrote ${toDisplay(jsonOutput)}`);
console.log(`Wrote ${toDisplay(mdOutput)}`);
