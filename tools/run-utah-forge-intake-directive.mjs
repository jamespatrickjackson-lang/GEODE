import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const projectRoot = "projects/utah-forge";
const dropsRoot = `${projectRoot}/intake_staging/drops`;
const latestIntakeReviewPath = `${projectRoot}/intake_staging/LATEST_INTAKE_REVIEW.json`;
const latestAiReviewPath = `${projectRoot}/intake_staging/LATEST_AI_REVIEW.json`;
const ignoredStatuses = new Set(["ignored_test", "archived", "superseded", "rejected"]);
const routeHandlers = createRouteHandlerRegistry();

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});

async function main() {
  const dropId = args.drop ?? findLatestActiveDropId();
  if (!dropId) {
    console.log(JSON.stringify({ ok: true, message: "No active Utah FORGE intake drop is ready." }, null, 2));
    return;
  }

  const drop = loadDrop(dropId);
  const initialState = deriveDropState(drop);
  const routeExecution = args.dryRun
    ? planRouteExecution(drop, initialState)
    : executeRouteIfSelected(drop, initialState);
  const derived = deriveDropState(drop, routeExecution);
  const plannedWrites = planWrites(drop, derived);

  const result = {
    ok: true,
    dryRun: args.dryRun,
    dropId,
    mode: drop.mode,
    dropRoot: drop.dropRoot,
    manifestPath: drop.manifestPath,
    contextPath: drop.contextPath,
    plannedWrites: plannedWrites.map((write) => write.file),
    existing: derived.existing,
    markdownDocsRead: derived.markdownDocs.map((doc) => doc.file.originalName),
    unresolveds: derived.unresolveds.map((item) => item.id),
    routeCandidates: derived.routeCandidates.map((item) => item.id),
    responseFound: derived.userContextResponse.present,
    contextConfirmed: derived.userContextResponse.present,
    selectedRouteId: derived.routeDispatch.selectedRouteId,
    routeReady: derived.routeDispatch.routeReady,
    routeHandlerStatus: derived.routeDispatch.routeHandlerStatus,
    routeExecutionStatus: derived.routeExecution.status,
    routeStatus: deriveAiReviewStatus(derived),
    pdfReview: derived.pdfReview.summary,
    duplicateOf: derived.duplicateOf,
    boundaries: boundarySummary(derived)
  };

  if (args.dryRun) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const write of plannedWrites) {
    writeAllowedFile(write.file, write.content);
  }

  console.log(JSON.stringify({
    ...result,
    dryRun: false,
    filesWritten: plannedWrites.map((write) => write.file)
  }, null, 2));
}

function parseArgs(argv) {
  const parsed = { dryRun: false, latest: false, drop: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--latest") {
      parsed.latest = true;
      continue;
    }
    if (arg === "--drop") {
      parsed.drop = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!parsed.latest && !parsed.drop) {
    parsed.latest = true;
  }
  if (parsed.latest && parsed.drop) {
    throw new Error("Use either --latest or --drop, not both.");
  }
  if (parsed.drop && !isSafeDropId(parsed.drop)) {
    throw new Error(`Unsafe drop id: ${parsed.drop}`);
  }
  return parsed;
}

function findLatestActiveDropId() {
  const folder = abs(dropsRoot);
  if (!fs.existsSync(folder)) return null;
  const candidates = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeDropId(entry.name))
    .map((entry) => {
      const manifestPath = `${dropsRoot}/${entry.name}/intake_manifest.json`;
      if (!fs.existsSync(abs(manifestPath))) return null;
      const manifest = readJson(manifestPath);
      const status = String(manifest.status ?? "");
      if (ignoredStatuses.has(status)) return null;
      return {
        dropId: entry.name,
        createdAt: Date.parse(manifest.createdAt ?? "") || 0
      };
    })
    .filter(Boolean);
  candidates.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return b.dropId.localeCompare(a.dropId);
  });
  return candidates[0]?.dropId ?? null;
}

function loadDrop(dropId) {
  const dropRoot = `${dropsRoot}/${dropId}`;
  assertInsideDrops(dropRoot);
  const manifestPath = `${dropRoot}/intake_manifest.json`;
  const contextPath = `${dropRoot}/intake_context.md`;
  assertRepoFile(manifestPath);
  assertRepoFile(contextPath);
  const manifest = readJson(manifestPath);
  return {
    dropId,
    dropRoot,
    manifestPath,
    contextPath,
    manifest,
    contextText: readText(contextPath),
    mode: String(manifest.processingStatus ?? manifest.status ?? "manifest_trace")
  };
}

function deriveDropState(drop, routeExecution = noRouteExecution()) {
  const paths = {
    intakeReviewJson: `${drop.dropRoot}/INTAKE_REVIEW.json`,
    intakeReviewMd: `${drop.dropRoot}/INTAKE_REVIEW.md`,
    sourceInventoryJson: `${drop.dropRoot}/source_inventory.json`,
    sourceInventoryMd: `${drop.dropRoot}/source_inventory.md`,
    proposedNextStepsMd: `${drop.dropRoot}/proposed_next_steps.md`,
    aiReviewJson: `${drop.dropRoot}/AI_REVIEW.json`,
    aiReviewMd: `${drop.dropRoot}/AI_REVIEW.md`,
    switchboardJson: `${drop.dropRoot}/INTAKE_SWITCHBOARD.json`,
    switchboardMd: `${drop.dropRoot}/INTAKE_SWITCHBOARD.md`,
    intentBindingsMd: `${drop.dropRoot}/INTENT_BINDINGS.md`,
    userContextResponseJson: `${drop.dropRoot}/USER_CONTEXT_RESPONSE.json`,
    userContextResponseMd: `${drop.dropRoot}/USER_CONTEXT_RESPONSE.md`
  };
  const existing = Object.values(paths).filter((file) => fs.existsSync(abs(file)));
  const userContextResponse = readUserContextResponse(paths.userContextResponseJson);
  const pdfReview = inspectPdfReview(drop.dropRoot);
  const duplicateOf = findOlderDuplicateDrops(drop);
  const markdownDocs = readMarkdownDocs(drop);
  const requestedPages = parseRequestedPages(markdownDocs);
  const files = manifestFiles(drop.manifest).map((file) => classifyManifestFile(file, pdfReview));
  const projectFit = deriveProjectFit(requestedPages);
  const unresolveds = deriveUnresolveds({ drop, pdfReview, duplicateOf, requestedPages, projectFit, files });
  const routeCandidates = deriveRouteCandidates({ requestedPages, unresolveds, projectFit });
  const routeDispatch = dispatchRouteShell(drop, {
    paths,
    existing,
    routeExecution,
    userContextResponse,
    unresolveds
  });
  return {
    paths,
    existing,
    routeExecution,
    userContextResponse,
    pdfReview,
    duplicateOf,
    markdownDocs,
    requestedPages,
    files,
    projectFit,
    unresolveds,
    routeCandidates,
    routeDispatch
  };
}

function planWrites(drop, derived) {
  const writes = [
    {
      file: latestIntakeReviewPath,
      content: `${JSON.stringify(createLatestIntakeReviewPointer(drop, derived), null, 2)}\n`
    },
    {
      file: latestAiReviewPath,
      content: `${JSON.stringify(createLatestAiReviewPointer(drop, derived), null, 2)}\n`
    },
    {
      file: derived.paths.sourceInventoryJson,
      content: `${JSON.stringify(createSourceInventory(drop, derived), null, 2)}\n`
    },
    {
      file: derived.paths.sourceInventoryMd,
      content: createSourceInventoryMarkdown(drop, derived)
    },
    {
      file: derived.paths.proposedNextStepsMd,
      content: createProposedNextStepsMarkdown(drop, derived)
    },
    {
      file: derived.paths.intakeReviewJson,
      content: `${JSON.stringify(createIntakeReview(drop, derived), null, 2)}\n`
    },
    {
      file: derived.paths.intakeReviewMd,
      content: createIntakeReviewMarkdown(drop, derived)
    },
    {
      file: derived.paths.aiReviewJson,
      content: `${JSON.stringify(createAiReview(drop, derived), null, 2)}\n`
    },
    {
      file: derived.paths.aiReviewMd,
      content: createAiReviewMarkdown(drop, derived)
    },
    {
      file: derived.paths.switchboardJson,
      content: `${JSON.stringify(createSwitchboard(drop, derived), null, 2)}\n`
    },
    {
      file: derived.paths.switchboardMd,
      content: createSwitchboardMarkdown(drop, derived)
    }
  ];
  if (derived.unresolveds.length > 0 && !derived.userContextResponse.present) {
    writes.push({
      file: derived.paths.intentBindingsMd,
      content: createIntentBindingsTemplate(drop, derived)
    });
  }
  return writes;
}

function createLatestAiReviewPointer(drop, derived) {
  const status = deriveAiReviewStatus(derived);
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.intake.latest-ai-review",
    project: "utah-forge",
    dropId: drop.dropId,
    status,
    accepted: false,
    reviewRequired: true,
    updatedAt: new Date().toISOString(),
    aiReviewPath: derived.paths.aiReviewJson,
    aiReviewMarkdownPath: derived.paths.aiReviewMd,
    sourceInventoryPath: derived.paths.sourceInventoryJson,
    responseFound: derived.userContextResponse.present,
    contextConfirmed: derived.userContextResponse.present,
    selectedRouteId: derived.routeDispatch.selectedRouteId,
    routeReady: derived.routeDispatch.routeReady,
    routeHandlerStatus: derived.routeDispatch.routeHandlerStatus,
    routeExecutionStatus: derived.routeExecution.status,
    nextUiAction: deriveNextUiAction(derived),
    nextSmokeCall: "run intake trailhead"
  };
}

function createLatestIntakeReviewPointer(drop, derived) {
  const review = createIntakeReview(drop, derived);
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.intake.latest-review",
    project: "utah-forge",
    dropId: drop.dropId,
    status: review.status,
    accepted: false,
    reviewRequired: true,
    updatedAt: new Date().toISOString(),
    intakeReviewPath: derived.paths.intakeReviewJson,
    intakeReviewMarkdownPath: derived.paths.intakeReviewMd,
    reviewPage: review.createdOutputs.reviewPage,
    reviewOverlay: review.createdOutputs.reviewOverlay,
    questionCount: review.questions.length,
    nextUiAction: review.nextActions[0] ?? "show_intake_review",
    nextSmokeCall: "run intake trailhead"
  };
}

function createSourceInventory(drop, derived) {
  const openAppraisalCreated = derived.routeExecution.status === "open_appraisal_review_created";
  return {
    schemaVersion: "0.3.0",
    kind: "geosee.utah-forge.source-inventory",
    dropId: drop.dropId,
    project: "utah-forge",
    status: openAppraisalCreated ? "open_appraisal_review_created" : "switchboard_only",
    accepted: false,
    reviewRequired: true,
    mode: drop.mode,
    inventoryCreatedAt: currentDateString(),
    sourceBasis: [
      "intake_manifest.json",
      "intake_context.md",
      "raw filenames and lightweight manifest metadata",
      "staged Markdown/text document contents",
      ...(derived.pdfReview.present ? ["exact-drop pdf_review outputs"] : [])
    ],
    pdfReviewOutputsPresent: derived.pdfReview.present,
    pdfContentParsed: derived.routeExecution.routeId === "generate_pdf_review" || openAppraisalCreated,
    rawPdfParsingPerformed: false,
    projectDataProcessingPerformed: false,
    appVisiblePageCreated: openAppraisalCreated,
    overlayCreated: openAppraisalCreated,
    projectJsonChanged: openAppraisalCreated,
    environmentJsonChanged: false,
    computedArtifactCreated: false,
    filesInventoried: derived.files.length,
    files: derived.files,
    markdownDocsRead: derived.markdownDocs.map((doc) => ({
      originalName: doc.file.originalName,
      storedPath: doc.file.storedPath,
      headingsFound: doc.headings,
      requestedPageCount: doc.requestedPages.length
    })),
    summary: {
      likelyFamilies: [...new Set(derived.files.map((file) => file.likelyFamily))],
      pdfCount: derived.files.filter((file) => file.extension === ".pdf").length,
      markdownCount: derived.files.filter((file) => file.extension === ".md").length,
      duplicateOf: derived.duplicateOf,
      unresolvedCount: derived.unresolveds.length,
      responseFound: derived.userContextResponse.present,
      selectedRouteId: derived.userContextResponse.selectedRouteId,
      routeReady: derived.routeDispatch.routeReady,
      routeHandlerStatus: derived.routeDispatch.routeHandlerStatus,
      routeExecutionStatus: derived.routeExecution.status,
      routeCandidateCount: derived.routeCandidates.length
    },
    boundariesHeld: boundarySummary(derived)
  };
}

function createSourceInventoryMarkdown(drop, derived) {
  const openAppraisalCreated = derived.routeExecution.status === "open_appraisal_review_created";
  const rows = derived.files.map((file) =>
    `| \`${file.originalName}\` | ${file.size.toLocaleString()} | \`${file.type}\` | ${file.likelyFamily} | ${file.recommendedHandling} |`
  ).join("\n");
  return `# Source Inventory: ${drop.dropId}

Status: ${openAppraisalCreated ? "open_appraisal_review_created" : "switchboard_only"}

- accepted: false
- reviewRequired: true
- project: utah-forge
- mode: ${drop.mode}

${openAppraisalCreated
  ? "This inventory records the open appraisal review route. It created review-only appraisal outputs and one intake review page/overlay, without creating accepted project data, layers, computed artifacts, or final truth."
  : "This inventory supports the intake switchboard only. It does not create pages, overlays, layers, project config changes, data processing, or computed artifacts."}

## Files Inventoried

| Original name | Size | Type | Likely family | Handling |
| --- | ---: | --- | --- | --- |
${rows}

## PDF Review

${derived.pdfReview.markdown}

## Boundary

- No raw PDF parsing was performed outside the selected review route.
- App-visible review page created: ${openAppraisalCreated ? "yes" : "no"}.
- Overlay created: ${openAppraisalCreated ? "yes" : "no"}.
- \`project.json\` pageOrder changed: ${openAppraisalCreated ? "yes, intake review page append only" : "no"}.
- No project data or computed artifacts were created.
`;
}

function createProposedNextStepsMarkdown(drop, derived) {
  if (derived.routeExecution.status === "open_appraisal_review_created") {
    return createOpenAppraisalNextSteps(drop, derived.routeExecution.fileReviews ?? []);
  }
  return `# Proposed Next Steps: ${drop.dropId}

Status: proposed

- accepted: false
- reviewRequired: true
- selectedRouteId: ${derived.userContextResponse.selectedRouteId || "none"}
- routeHandlerStatus: ${derived.routeDispatch.routeHandlerStatus}
- routeExecutionStatus: ${derived.routeExecution.status}
- pdfReview: ${derived.pdfReview.summary}

## Route Result

${derived.routeExecution.note || "No route execution occurred."}

Changed by route:

${derived.routeExecution.filesChanged.length ? derived.routeExecution.filesChanged.map((file) => `- \`${file}\``).join("\n") : "- none"}

## Next Valid Move

${derived.routeExecution.nextValidMove || "Record or review a bounded route before any mutation."}

## Boundaries

- No pages created.
- No overlays created.
- No project.json change.
- No environment.json change.
- No data layers created.
- No geosee_processed write.
- No accepted, validated, certified, approved, final, or technically authoritative state.
`;
}

function createSwitchboard(drop, derived) {
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.utah-forge.intake-switchboard",
    dropId: drop.dropId,
    project: "utah-forge",
    status: "switchboard_only",
    accepted: false,
    reviewRequired: true,
    createdAt: currentDateString(),
    unresolvedFirst: derived.unresolveds,
    inputSummary: {
      fileCount: derived.files.length,
      markdownDocsRead: derived.markdownDocs.map((doc) => doc.file.originalName),
      pdfReview: derived.pdfReview.summary,
      duplicateOf: derived.duplicateOf,
      userContext: drop.manifest.userContext?.text ?? "",
      responseFound: derived.userContextResponse.present,
      selectedRouteId: derived.userContextResponse.selectedRouteId,
      routeReady: derived.routeDispatch.routeReady,
      routeHandlerStatus: derived.routeDispatch.routeHandlerStatus,
      routeExecutionStatus: derived.routeExecution.status
    },
    inferredRequests: derived.requestedPages.map((page) => ({
      id: `request-page-${page.number}`,
      source: page.sourceFile,
      title: page.title,
      requestedLayerType: page.layerType || null,
      controlsNeeded: page.controlsNeeded || null,
      status: "inferred_from_markdown"
    })),
    projectDataReferentialMap: derived.projectFit,
    routes: derived.routeCandidates,
    commitChecklist: createCommitChecklist(derived),
    boundary: boundarySummary(derived)
  };
}

function createIntakeReview(drop, derived) {
  const fileReviews = derived.routeExecution.fileReviews ?? [];
  const questions = deriveReviewQuestions(drop, derived, fileReviews);
  const createdOutputs = createIntakeReviewCreatedOutputs(drop, derived);
  const preview = createIntakeReviewPreview(drop, fileReviews);
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.intake.review",
    dropId: drop.dropId,
    project: "utah-forge",
    status: questions.length > 0 ? "needs_user_answer" : "review_ready",
    accepted: false,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
    files: fileReviews.length
      ? fileReviews.map((review) => ({
          originalName: review.originalName,
          family: review.family,
          sourcePath: review.sourcePath,
          size: review.size,
          type: review.type,
          contentInspected: review.contentInspected,
          confidence: review.confidence,
          recommendedRoute: review.recommendedRoute,
          notes: review.uncertainty
        }))
      : derived.files.map((file) => ({
          originalName: file.originalName,
          family: file.likelyFamily,
          sourcePath: file.storedPath,
          size: file.size,
          type: file.type,
          contentInspected: false,
          confidence: "metadata",
          recommendedRoute: file.recommendedHandling,
          notes: []
        })),
    preview,
    summary: createIntakeReviewSummary(drop, derived, fileReviews),
    plan: createIntakeReviewPlan(derived, fileReviews),
    questions,
    nextActions: questions.length > 0
      ? ["answer blocking intake questions in the Add to Project review panel"]
      : ["review the generated intake page", "choose refine, archive, keep review-only, or request a later bounded build route"],
    createdOutputs,
    boundaries: {
      accepted: false,
      reviewRequired: true,
      existingDemoPagesEdited: false,
      existingOverlaysEdited: false,
      environmentJsonChanged: false,
      layersCreated: false,
      geoseeProcessedWritten: false,
      validationOrApprovalCreated: false
    },
    compatibilityAliases: {
      aiReviewPath: derived.paths.aiReviewJson,
      switchboardPath: derived.paths.switchboardJson
    }
  };
}

function createIntakeReviewMarkdown(drop, derived) {
  const review = createIntakeReview(drop, derived);
  const fileRows = review.files.map((file) =>
    `| \`${file.originalName}\` | ${file.family} | ${file.contentInspected ? "yes" : "metadata only"} | ${file.recommendedRoute} |`
  ).join("\n");
  const questionRows = review.questions.map((question) =>
    `| ${question.id} | ${question.kind} | ${question.question} | ${question.whyItMatters} |`
  ).join("\n");
  return `# Intake Review: ${drop.dropId}

Status: ${review.status}

- accepted: false
- reviewRequired: true
- project: utah-forge
- reviewPage: ${review.createdOutputs.reviewPage || "none"}
- reviewOverlay: ${review.createdOutputs.reviewOverlay || "none"}

${review.summary}

## Preview

- type: ${review.preview.type}
- path: ${review.preview.path || "none"}
- status: ${review.preview.status}

## Concise Plan

${review.plan.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Questions

${review.questions.length ? "| ID | Kind | Question | Why it matters |\n| --- | --- | --- | --- |\n" + questionRows : "No blocking questions for this review page."}

## Files

| File | Family | Inspected | Recommended route |
| --- | --- | --- | --- |
${fileRows || "| none | n/a | no | hold |"}

## Created Outputs

${Object.entries(review.createdOutputs).filter(([, value]) => value).map(([key, value]) => `- ${key}: \`${value}\``).join("\n") || "- none"}

## Boundaries

- No accepted project truth was created.
- No validation, certification, approval, or final interpretation was created.
- No layers or environment changes were created.
- Existing demo pages and overlays were not edited.
`;
}

function deriveReviewQuestions(drop, derived, fileReviews = []) {
  const questions = [];
  if (manifestFiles(drop.manifest).length === 0) {
    questions.push({
      id: "Q-001",
      kind: "missing_input_files",
      question: "No staged input files were found. Should this drop be archived or restaged?",
      whyItMatters: "The review page cannot represent actual input data without a staged source file.",
      sourcePath: drop.manifestPath
    });
  }
  for (const review of fileReviews) {
    if (review.family === "missing") {
      questions.push({
        id: `Q-${String(questions.length + 1).padStart(3, "0")}`,
        kind: "missing_staged_file",
        question: `The staged file ${review.originalName} is missing on disk. Should the drop be restaged or archived?`,
        whyItMatters: "The runner cannot safely appraise or preview a missing file.",
        sourcePath: review.sourcePath
      });
    }
    if (review.family === "unknown_or_binary") {
      questions.push({
        id: `Q-${String(questions.length + 1).padStart(3, "0")}`,
        kind: "unknown_file_family",
        question: `What kind of project input is ${review.originalName}?`,
        whyItMatters: "The file could not be safely inspected, so the next action needs human context.",
        sourcePath: review.sourcePath
      });
    }
  }
  if (derived.routeExecution.status === "failed") {
    questions.push({
      id: `Q-${String(questions.length + 1).padStart(3, "0")}`,
      kind: "route_execution_failed",
      question: "The intake review route failed. Should this drop be retried, refined, or archived?",
      whyItMatters: "A failed route cannot produce a reliable review surface.",
      sourcePath: `${drop.dropRoot}/route_execution_log.json`
    });
  }
  return questions;
}

function createIntakeReviewPreview(drop, fileReviews) {
  const primaryPreview = findPrimaryReviewPreview(fileReviews);
  if (!primaryPreview) {
    return {
      type: "none",
      path: "",
      status: "no visual preview generated"
    };
  }
  return {
    type: primaryPreview.extension.replace(".", "") || "image",
    path: `${projectRoot}/overlays/intake_${drop.dropId}/input-preview${primaryPreview.extension}`,
    status: "created"
  };
}

function createIntakeReviewSummary(drop, derived, fileReviews) {
  const first = fileReviews[0];
  const fileName = first?.originalName ?? derived.files[0]?.originalName ?? "staged input";
  const family = first?.family ?? derived.files[0]?.likelyFamily ?? "unknown";
  return `This intake review appraised ${derived.files.length} staged file(s). The primary input is \`${fileName}\` (${family}). It created one review page and overlay for human inspection; the drop remains proposed and unaccepted.`;
}

function createIntakeReviewPlan(derived, fileReviews) {
  const hasPreview = Boolean(findPrimaryReviewPreview(fileReviews));
  return [
    "Preserve the staged files as source evidence.",
    hasPreview ? "Show the strongest safe preview of the actual input in the app." : "Show the best available metadata summary because no visual preview was generated.",
    "Summarize what the file appears to request or contain.",
    "Ask only blocking questions, if any.",
    "Stop before project truth, layers, environment state, or accepted data changes."
  ];
}

function createIntakeReviewCreatedOutputs(drop, derived) {
  const page = `${projectRoot}/pages/intake_${drop.dropId}.json`;
  const overlay = `${projectRoot}/overlays/intake_${drop.dropId}/text.md`;
  return {
    intakeReviewJson: derived.paths.intakeReviewJson,
    intakeReviewMd: derived.paths.intakeReviewMd,
    reviewPage: fs.existsSync(abs(page)) || derived.routeExecution.status === "open_appraisal_review_created" ? page : "",
    reviewOverlay: fs.existsSync(abs(overlay)) || derived.routeExecution.status === "open_appraisal_review_created" ? overlay : "",
    routeLogJson: `${drop.dropRoot}/route_execution_log.json`,
    sourceInventoryJson: derived.paths.sourceInventoryJson,
    compatibilityAiReviewJson: derived.paths.aiReviewJson,
    compatibilitySwitchboardJson: derived.paths.switchboardJson
  };
}

function createAiReview(drop, derived) {
  const questions = derived.unresolveds.map((item) => ({
    id: item.id,
    kind: item.kind,
    question: item.question,
    whyItMatters: item.whyItMatters,
    sourcePath: item.source,
    responseModeHint: "answer",
    requiredBefore: "route_decision"
  }));
  const status = deriveAiReviewStatus(derived);
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.intake.ai-review",
    dropId: drop.dropId,
    project: "utah-forge",
    status,
    accepted: false,
    reviewRequired: true,
    createdAt: currentDateString(),
    sourceTracePaths: [
      drop.manifestPath,
      drop.contextPath,
      ...(derived.userContextResponse.present ? [derived.paths.userContextResponseJson] : []),
      ...(derived.pdfReview.present ? [`${drop.dropRoot}/pdf_review/pdf_index.json`] : [])
    ],
    questions,
    plan: status === "plan_proposed" || status === "route_ready" || status === "open_appraisal_review_created" || status === "pdf_review_created" ? createReviewPlan(derived) : null,
    unresolveds: derived.unresolveds,
    routeCandidates: derived.routeCandidates,
    responseFound: derived.userContextResponse.present,
    contextConfirmed: derived.userContextResponse.present,
    responsePath: derived.userContextResponse.present ? derived.paths.userContextResponseJson : null,
    selectedRouteId: derived.userContextResponse.selectedRouteId,
    routeReady: derived.routeDispatch.routeReady,
    routeHandlerStatus: derived.routeDispatch.routeHandlerStatus,
    routeDispatch: derived.routeDispatch,
    routeExecution: derived.routeExecution,
    userContextResponse: derived.userContextResponse.present
      ? {
          status: derived.userContextResponse.status,
          createdAt: derived.userContextResponse.createdAt,
          answers: derived.userContextResponse.answers
        }
      : null,
    routeExecutionImplemented: ["generate_pdf_review", "open_appraisal_review"].includes(derived.routeExecution.routeId),
    routeExecutionNote: derived.routeExecution.note || (derived.userContextResponse.present
      ? "Human context confirmation was detected and the route is ready for the next explicit gate. This runner does not execute the route, generate review artifacts, inspect additional raw content, create pages, or mutate project state in this step."
      : "No USER_CONTEXT_RESPONSE.json was found; unresolved questions remain non-actionable."),
    boundary: boundarySummary(derived),
    nextUiAction: deriveNextUiAction(derived),
    nextSmokeCall: "run intake trailhead"
  };
}

function createReviewPlan(derived) {
  if (derived.routeExecution.status === "open_appraisal_review_created") {
    return {
      summary: "The open_appraisal_review route executed and created proposed review artifacts plus one app-visible review page/overlay.",
      steps: [
        "review the generated intake appraisal page and overlay",
        "review route_execution_log.json PRIOR_STATE and RETURN_STATE",
        "choose whether to keep review-only, refine input, run a file-family route, or approve a later bounded project update route"
      ],
      filesLikelyTouched: derived.routeExecution.filesChanged,
      filesForbidden: [
        "projects/utah-forge/environment.json",
        "existing projects/utah-forge/pages/**",
        "existing projects/utah-forge/overlays/**",
        "projects/utah-forge/data/**",
        "projects/utah-forge/data/geosee_processed/**",
        "src/**",
        "prep/**"
      ],
      verification: [
        "generated page JSON parses",
        "project.json parses",
        "route_execution_log.json parses",
        "accepted remains false",
        "reviewRequired remains true"
      ],
      remainingUnresolveds: deriveOpenAppraisalUnresolveds(derived.routeExecution.fileReviews ?? []).map((item) => item.issue),
      nextGate: "human_open_appraisal_review"
    };
  }
  if (
    derived.routeExecution.status === "pdf_review_created" ||
    derived.routeExecution.status === "pdf_review_created_with_warnings" ||
    (derived.routeExecution.routeId === "generate_pdf_review" && derived.routeExecution.status === "already_created")
  ) {
    const alreadyCreated = derived.routeExecution.status === "already_created";
    return {
      summary: alreadyCreated
        ? "Exact-drop PDF review outputs already existed, and the generate_pdf_review handler preserved them without regenerating."
        : "The generate_pdf_review route executed and created exact-drop PDF review outputs.",
      steps: [
        "review pdf_review/pdf_index.json",
        "review per-PDF summary, extracted text, and first-page preview outputs",
        "choose the next bounded route only after human review"
      ],
      filesLikelyTouched: derived.routeExecution.filesChanged,
      filesForbidden: [
        "projects/utah-forge/project.json",
        "projects/utah-forge/environment.json",
        "projects/utah-forge/pages/**",
        "projects/utah-forge/overlays/**",
        "projects/utah-forge/data/geosee_processed/**",
        "src/**"
      ],
      verification: [
        "pdf_review/pdf_index.json parses",
        "INTAKE_REVIEW.json parses",
        "AI_REVIEW.json compatibility mirror parses",
        "no pages/project/environment/data/runtime writes"
      ],
      remainingUnresolveds: ["canonical_pdf_unknown"],
      nextGate: "human_pdf_review"
    };
  }
  if (derived.userContextResponse.present) {
    return {
      summary: "Human response trace was found. The selected route is ready for a later explicit route-execution gate, but no route execution is implemented or performed by this step.",
      steps: [
        `review USER_CONTEXT_RESPONSE.json (${derived.userContextResponse.answers.length} answer(s))`,
        `confirm selected route ${derived.userContextResponse.selectedRouteId || "is specified before execution"}`,
        "run a separate explicit route gate before any file-family-specific processing, review generation, page, overlay, project config, environment config, data, or computed-artifact write"
      ],
      filesLikelyTouched: [],
      filesForbidden: [
        "projects/utah-forge/project.json",
        "projects/utah-forge/environment.json",
        "projects/utah-forge/pages/**",
        "projects/utah-forge/overlays/**",
        "projects/utah-forge/data/**",
        "src/**"
      ],
      verification: [
        "INTAKE_REVIEW.json reports route_ready or equivalent review state",
        "AI_REVIEW.json compatibility mirror reports route_ready",
        "responseFound is true",
        `routeHandlerStatus is ${derived.routeDispatch.routeHandlerStatus}`,
        "routeExecutionImplemented is false",
        "no route outputs were created"
      ],
      remainingUnresolveds: derived.unresolveds.map((item) => item.id),
      nextGate: "route_execution_not_implemented"
    };
  }
  return {
    summary: "No unresolved questions were detected by the intake review. Hold for human review before any later route or runner.",
    steps: createCommitChecklist(derived),
    filesLikelyTouched: [],
    filesForbidden: [
      "projects/utah-forge/project.json",
      "projects/utah-forge/environment.json",
      "projects/utah-forge/pages/**",
      "projects/utah-forge/overlays/**",
      "projects/utah-forge/data/**",
      "src/**"
    ],
    verification: [
      "review INTAKE_REVIEW.md",
      "record USER_CONTEXT_RESPONSE before any later route",
      "do not mutate project state from this gate"
    ],
    remainingUnresolveds: [],
    nextGate: "human_review"
  };
}

function createAiReviewMarkdown(drop, derived) {
  const review = createAiReview(drop, derived);
  const questionRows = review.questions.map((item) =>
    `| ${item.id} | ${item.kind} | ${item.question} | ${item.whyItMatters} | ${item.sourcePath} |`
  ).join("\n");
  const routeRows = derived.routeCandidates.map((route) =>
    `| ${route.id} | ${route.normalizedRouteId || route.routeId || route.id} | ${route.input} | ${route.possibleRoute} | ${route.approvalNeeded} |`
  ).join("\n");
  return `# AI Review: ${drop.dropId}

Status: ${review.status}

- accepted: false
- reviewRequired: true
- responseFound: ${review.responseFound ? "true" : "false"}
- contextConfirmed: ${review.contextConfirmed ? "true" : "false"}
- selectedRouteId: ${review.selectedRouteId || "none"}
- routeReady: ${review.routeReady ? "true" : "false"}
- routeHandlerStatus: ${review.routeHandlerStatus}
- routeExecutionImplemented: ${review.routeExecutionImplemented ? "true" : "false"}
- routeExecutionStatus: ${derived.routeExecution.status}
- nextUiAction: ${review.nextUiAction}
- nextSmokeCall: \`${review.nextSmokeCall}\`

This is the AI review gate for the intake drop. It returns UI questions or a proposed plan. It does not create pages, overlays, layers, project config, environment config, generated artifacts, processed data, or runtime changes.

## Questions For UI

| ID | Kind | Question | Why it matters | Source |
| --- | --- | --- | --- | --- |
${questionRows || "| none | none | No questions required. | Review the plan before any later route. | n/a |"}

## Route Candidates

| Legacy ID | Route token | Input | Possible route | Approval needed |
| --- | --- | --- | --- | --- |
${routeRows || "| none | none | Drop inputs | Hold review and stop. | Human review required before mutation. |"}

## Plan

${review.plan ? review.plan.steps.map((step) => `- ${step}`).join("\n") : "_No plan proposed until UI questions are answered._"}

## Route Execution

${review.routeExecutionNote}

## Route Dispatch Shell

- routeReady: ${review.routeDispatch.routeReady ? "true" : "false"}
- selectedRouteId: ${review.routeDispatch.selectedRouteId || "none"}
- routeHandlerStatus: ${review.routeDispatch.routeHandlerStatus}
- handlerLabel: ${review.routeDispatch.handler?.label || "none"}

## User Response Trace

${review.userContextResponse ? review.userContextResponse.answers.map((answer) => `- ${answer.questionId}: ${answer.answer || "no answer"}${answer.selectedRouteId ? ` (route: ${answer.selectedRouteId})` : ""}`).join("\n") : "_No user response trace found._"}

## Boundary

- Pages created: ${derived.routeExecution.status === "open_appraisal_review_created" ? "one review-only intake page" : "none"}.
- Overlays created: ${derived.routeExecution.status === "open_appraisal_review_created" ? "one review-only intake overlay" : "none"}.
- Project config changed: ${derived.routeExecution.status === "open_appraisal_review_created" ? "project.json pageOrder append only" : "none"}.
- No environment config changed.
- No layers created.
- No data processing.
- Generated artifacts: ${derived.routeExecution.status === "open_appraisal_review_created" ? "drop-local review artifacts only" : "none"}.
- No runtime behavior changed.

User responses belong in \`USER_CONTEXT_RESPONSE.md\` and \`USER_CONTEXT_RESPONSE.json\`.
`;
}

function createSwitchboardMarkdown(drop, derived) {
  const unresolvedRows = derived.unresolveds.map((item) =>
    `| ${item.id} | ${item.kind} | ${item.question} | ${item.whyItMatters} |`
  ).join("\n");
  const routeRows = derived.routeCandidates.map((route) =>
    `| ${route.id} | ${route.normalizedRouteId || route.routeId || route.id} | ${route.input} | ${route.inferredIntent} | ${route.projectFit} | ${route.blocker || "none"} | ${route.possibleRoute} | ${route.approvalNeeded} |`
  ).join("\n");
  const requestRows = derived.requestedPages.map((page) =>
    `| ${page.number} | ${page.title} | ${page.layerType || "not specified"} | ${page.controlsNeeded || "not specified"} |`
  ).join("\n");
  return `# Intake Switchboard: ${drop.dropId}

Status: switchboard_only

- accepted: false
- reviewRequired: true
- mode: ${drop.mode}
- responseFound: ${derived.userContextResponse.present ? "true" : "false"}
- selectedRouteId: ${derived.userContextResponse.selectedRouteId || "none"}
- routeReady: ${derived.routeDispatch.routeReady ? "true" : "false"}
- routeHandlerStatus: ${derived.routeDispatch.routeHandlerStatus}

This is the intelligence-layer preflight. It makes the drop actionable and project-data referential, then stops for human intent.

## Unresolved First

Unresolved does not mean task incomplete. It means the input does not yet have a known project/data/software route.

| ID | Kind | Human question | Why it matters |
| --- | --- | --- | --- |
${unresolvedRows || "| none | none | No unresolveds detected. | The switchboard still requires route approval before mutation. |"}

## Input Summary

- files inventoried: ${derived.files.length}
- Markdown/text docs read: ${derived.markdownDocs.map((doc) => `\`${doc.file.originalName}\``).join(", ") || "none"}
- pdf_review: ${derived.pdfReview.summary}
- duplicate drops: ${derived.duplicateOf.map((id) => `\`${id}\``).join(", ") || "none"}
- user context: ${drop.manifest.userContext?.text ? `\`${drop.manifest.userContext.text}\`` : "none"}
- user response: ${derived.userContextResponse.present ? `\`${derived.paths.userContextResponseJson}\`` : "missing"}

## Inferred Requests From Markdown/Text

| Page | Title | Requested layer type | Requested controls |
| ---: | --- | --- | --- |
${requestRows || "| n/a | No requested pages detected. | n/a | n/a |"}

## Route Table

| Legacy ID | Route token | Input | Inferred intent | Project fit | Blocker | Possible route | Approval needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
${routeRows || "| route-none | none | Drop inputs | Inventory only | Review context | Human has not selected a route | Hold unresolveds and stop | yes |"}

## SAT-Style Commit Checklist

Approve exactly one next move:

${createCommitChecklist(derived).map((item) => `- [ ] ${item}`).join("\n")}

## Boundary

- Pages created: ${derived.routeExecution.status === "open_appraisal_review_created" ? "one review-only intake page" : "none"}.
- Overlays created: ${derived.routeExecution.status === "open_appraisal_review_created" ? "one review-only intake overlay" : "none"}.
- \`project.json\` pageOrder update: ${derived.routeExecution.status === "open_appraisal_review_created" ? "intake page append only" : "none"}.
- No \`environment.json\` change.
- No layers created.
- No project data processing.
- Route execution: ${derived.routeExecution.routeId || "not run"}
- No accepted computed artifacts.

Human responses to unresolveds should be recorded in \`USER_CONTEXT_RESPONSE.json\` before any later runner mutates project state. \`INTENT_BINDINGS.md\` is compatibility trace only.
`;
}

function createIntentBindingsTemplate(drop, derived) {
  return `# Intent Bindings: ${drop.dropId}

Status: waiting_for_human

Human responses here convert unresolved messy inputs into routeable project intent.

Do not treat blank bindings as approval.

| unresolved id | human answer | resulting route/state | still blocked? |
| --- | --- | --- | --- |
${derived.unresolveds.map((item) => `| ${item.id} |  |  | yes |`).join("\n")}

## Rule

The runner may not act on unresolveds until the human answer is recorded and a route is selected.
`;
}

function noRouteExecution() {
  return {
    status: "not_requested",
    routeId: "",
    selectedRouteId: "",
    handlerStatus: "not_requested",
    filesChanged: [],
    pdfResults: [],
    note: "No route execution requested.",
    nextValidMove: "",
    PRIOR_STATE: {
      existingOutputs: []
    },
    RETURN_STATE: {
      filesChanged: []
    }
  };
}

function planRouteExecution(drop, derived) {
  const selectedRouteId = normalizeSelectedRouteId(derived.userContextResponse.selectedRouteId) || "open_appraisal_review";
  if (selectedRouteId !== "generate_pdf_review" && selectedRouteId !== "open_appraisal_review") return noRouteExecution();
  return {
    ...noRouteExecution(),
    status: "dry_run_planned",
    routeId: selectedRouteId,
    selectedRouteId,
    handlerStatus: "planned",
    note: `Dry run only. The ${selectedRouteId} route would execute on a normal run.`,
    nextValidMove: selectedRouteId === "generate_pdf_review"
      ? "Run without --dry-run to generate exact-drop pdf_review outputs."
      : "Run without --dry-run to generate open appraisal review artifacts and one app-visible review page.",
    PRIOR_STATE: {
      dropId: drop.dropId,
      manifestStatus: String(drop.manifest.status ?? ""),
      selectedRouteId,
      accepted: Boolean(drop.manifest.accepted),
      reviewRequired: Boolean(drop.manifest.reviewRequired),
      existingOutputs: derived.existing
    }
  };
}

function executeRouteIfSelected(drop, derived) {
  const selectedRouteId = normalizeSelectedRouteId(derived.userContextResponse.selectedRouteId) || "open_appraisal_review";
  if (selectedRouteId === "generate_pdf_review") {
    return executeGeneratePdfReviewRoute(drop, derived, selectedRouteId);
  }
  if (selectedRouteId === "open_appraisal_review") {
    return executeOpenAppraisalReviewRoute(drop, derived, selectedRouteId);
  }
  return noRouteExecution();
}

function executeGeneratePdfReviewRoute(drop, derived, selectedRouteId) {
  const priorState = {
    dropId: drop.dropId,
    manifestStatus: String(drop.manifest.status ?? ""),
    selectedRouteId,
    accepted: Boolean(drop.manifest.accepted),
    reviewRequired: Boolean(drop.manifest.reviewRequired),
    existingOutputs: derived.existing
  };
  const pdfFiles = manifestFiles(drop.manifest).filter((file) => {
    const extension = path.extname(file.originalName || file.relativePath || "").toLowerCase();
    return extension === ".pdf" || file.type === "application/pdf";
  });
  if (pdfFiles.length === 0) {
    return {
      ...noRouteExecution(),
      status: "blocked",
      routeId: "generate_pdf_review",
      selectedRouteId,
      handlerStatus: "blocked_no_pdf_files",
      note: "The generate_pdf_review route was selected, but no PDF files are present in the active drop.",
      nextValidMove: "Select a route that matches the staged files or stage PDF files first.",
      PRIOR_STATE: priorState
    };
  }
  if (derived.pdfReview.present) {
    return {
      ...noRouteExecution(),
      status: "already_created",
      routeId: "generate_pdf_review",
      selectedRouteId,
      handlerStatus: "already_created",
      note: "Exact-drop pdf_review outputs already exist; the handler did not regenerate them.",
      nextValidMove: "Review pdf_review outputs, then choose the next bounded route.",
      PRIOR_STATE: priorState
    };
  }

  const reviewRoot = `${drop.dropRoot}/pdf_review`;
  const usedSlugs = new Set();
  const pdfResults = [];
  const filesChanged = [];
  for (const file of pdfFiles) {
    const sourcePath = file.storedPath ?? `${drop.dropRoot}/raw/${file.relativePath ?? file.originalName}`;
    const slug = uniqueSlug(path.basename(file.originalName || file.relativePath || "pdf"), usedSlugs);
    const pdfFolder = `${reviewRoot}/${slug}`;
    const previewFolder = `${pdfFolder}/page_previews`;
    const summaryPath = `${pdfFolder}/summary.md`;
    const extractedTextPath = `${pdfFolder}/extracted_text.txt`;
    const previewPath = `${previewFolder}/page_001.png`;
    fs.mkdirSync(abs(pdfFolder), { recursive: true });
    const pdfInfo = readPdfInfo(sourcePath);
    const textResult = extractPdfText(sourcePath, extractedTextPath);
    if (textResult.ok) filesChanged.push(extractedTextPath);
    const previewResult = renderPdfFirstPage(sourcePath, previewFolder, previewPath);
    if (previewResult.ok) filesChanged.push(previewPath);
    const summary = createPdfSummaryMarkdown({
      drop,
      file,
      sourcePath,
      pdfInfo,
      textResult,
      previewResult,
      extractedTextPath,
      previewPath
    });
    writeRouteFile(summaryPath, summary);
    filesChanged.push(summaryPath);
    pdfResults.push({
      originalName: file.originalName,
      sourcePath,
      size: file.size ?? null,
      type: file.type ?? "application/pdf",
      reviewFolder: pdfFolder,
      summaryPath,
      pageCount: pdfInfo.pageCount,
      pdfInfoStatus: pdfInfo.ok ? "succeeded" : "failed",
      pdfInfoError: pdfInfo.error,
      textExtractionStatus: textResult.ok ? "succeeded" : "failed",
      extractedTextPath: textResult.ok ? extractedTextPath : null,
      textExtractionError: textResult.error,
      firstPagePreviewStatus: previewResult.ok ? "succeeded" : "failed",
      firstPagePreview: previewResult.ok ? previewPath : null,
      firstPagePreviewError: previewResult.error
    });
  }

  const index = createPdfReviewIndex(drop, pdfResults);
  const indexJsonPath = `${reviewRoot}/pdf_index.json`;
  const indexMdPath = `${reviewRoot}/pdf_index.md`;
  writeRouteFile(indexJsonPath, `${JSON.stringify(index, null, 2)}\n`);
  writeRouteFile(indexMdPath, createPdfReviewIndexMarkdown(drop, pdfResults));
  filesChanged.push(indexJsonPath, indexMdPath);

  const failed = pdfResults.some(
    (result) =>
      result.pdfInfoStatus === "failed" ||
      result.textExtractionStatus === "failed" ||
      result.firstPagePreviewStatus === "failed"
  );
  return {
    status: failed ? "pdf_review_created_with_warnings" : "pdf_review_created",
    routeId: "generate_pdf_review",
    selectedRouteId,
    handlerStatus: failed ? "executed_with_warnings" : "executed",
    filesChanged,
    pdfResults,
    note: failed
      ? "PDF review outputs were created, with one or more extraction/render warnings recorded."
      : "PDF review outputs were created successfully.",
    nextValidMove: "Review pdf_review outputs, then choose the next bounded route.",
    PRIOR_STATE: priorState,
    RETURN_STATE: {
      routeReady: true,
      routeHandlerStatus: failed ? "executed_with_warnings" : "executed",
      filesChanged,
      accepted: false,
      reviewRequired: true
    }
  };
}

function executeOpenAppraisalReviewRoute(drop, derived, selectedRouteId) {
  const priorState = createRoutePriorState(drop, derived, selectedRouteId, {
    projectFilesExpectedToBeTouched: [
      `${projectRoot}/pages/intake_${drop.dropId}.json`,
      `${projectRoot}/overlays/intake_${drop.dropId}/text.md`,
      `${projectRoot}/project.json`
    ],
    plannedOutputs: [
      `${drop.dropRoot}/source_inventory.json`,
      `${drop.dropRoot}/source_inventory.md`,
      `${drop.dropRoot}/INTAKE_REVIEW.json`,
      `${drop.dropRoot}/INTAKE_REVIEW.md`,
      `${drop.dropRoot}/AI_REVIEW.json`,
      `${drop.dropRoot}/AI_REVIEW.md`,
      `${drop.dropRoot}/proposed_next_steps.md`,
      `${drop.dropRoot}/processing_plan.md`,
      `${drop.dropRoot}/proposed_page_update_plan.md`,
      `${drop.dropRoot}/route_execution_log.json`,
      `${drop.dropRoot}/route_execution_log.md`,
      `${projectRoot}/pages/intake_${drop.dropId}.json`,
      `${projectRoot}/overlays/intake_${drop.dropId}/text.md`,
      `${projectRoot}/project.json`
    ]
  });
  const filesChanged = [];
  const filesRead = [
    drop.manifestPath,
    drop.contextPath,
    ...(derived.userContextResponse.present ? [derived.paths.userContextResponseJson] : [])
  ];
  const fileReviews = [];

  for (const file of manifestFiles(drop.manifest)) {
    const review = appraiseStagedFile(drop, file);
    fileReviews.push(review);
    filesRead.push(...review.filesRead);
    filesChanged.push(...(review.createdFiles ?? []));
    for (const output of review.outputs) {
      writeRouteFile(output.file, output.content);
      filesChanged.push(output.file);
    }
  }

  const pageId = `intake_${drop.dropId}`;
  const pagePath = `${projectRoot}/pages/${pageId}.json`;
  const overlayPath = `${projectRoot}/overlays/${pageId}/text.md`;
  const processingPlanPath = `${drop.dropRoot}/processing_plan.md`;
  const pageUpdatePlanPath = `${drop.dropRoot}/proposed_page_update_plan.md`;
  const routeLogJsonPath = `${drop.dropRoot}/route_execution_log.json`;
  const routeLogMdPath = `${drop.dropRoot}/route_execution_log.md`;
  const nextStepsPath = `${drop.dropRoot}/proposed_next_steps.md`;

  const reviewArtifactPaths = fileReviews.flatMap((review) => [
    ...(review.createdFiles ?? []),
    ...review.outputs.map((output) => output.file)
  ]);
  const primaryPreview = findPrimaryReviewPreview(fileReviews);
  const overlayPreviewFile = primaryPreview ? `input-preview${primaryPreview.extension}` : "";
  const overlayPreviewPath = primaryPreview ? `${projectRoot}/overlays/${pageId}/${overlayPreviewFile}` : "";
  if (primaryPreview) {
    copyRouteFile(primaryPreview.sourcePath, overlayPreviewPath);
    filesChanged.push(overlayPreviewPath);
    reviewArtifactPaths.push(overlayPreviewPath);
  }
  const pdfReviews = fileReviews.filter((review) => review.family === "pdf");
  if (pdfReviews.length > 0) {
    const pdfResults = pdfReviews.map((review) => ({
      originalName: review.originalName,
      sourcePath: review.sourcePath,
      size: review.size,
      type: review.type || "application/pdf",
      reviewFolder: review.details.reviewFolder,
      summaryPath: review.details.summaryPath,
      pageCount: review.details.pageCount,
      pdfInfoStatus: review.details.pdfInfoStatus,
      pdfInfoError: review.details.pdfInfoError,
      textExtractionStatus: review.details.textExtractionStatus,
      extractedTextPath: review.details.extractedTextPath,
      textExtractionError: review.details.textExtractionError,
      firstPagePreviewStatus: review.details.firstPagePreviewStatus,
      firstPagePreview: review.details.firstPagePreview,
      firstPagePreviewError: review.details.firstPagePreviewError
    }));
    const reviewRoot = `${drop.dropRoot}/pdf_review`;
    const indexJsonPath = `${reviewRoot}/pdf_index.json`;
    const indexMdPath = `${reviewRoot}/pdf_index.md`;
    writeRouteFile(indexJsonPath, `${JSON.stringify(createPdfReviewIndex(drop, pdfResults), null, 2)}\n`);
    writeRouteFile(indexMdPath, createPdfReviewIndexMarkdown(drop, pdfResults));
    filesChanged.push(indexJsonPath, indexMdPath);
  }
  writeRouteFile(processingPlanPath, createOpenAppraisalProcessingPlan(drop, fileReviews));
  filesChanged.push(processingPlanPath);
  writeRouteFile(pageUpdatePlanPath, createOpenAppraisalPageUpdatePlan(drop, pageId, fileReviews));
  filesChanged.push(pageUpdatePlanPath);
  writeRouteFile(
    overlayPath,
    createOpenAppraisalOverlayMarkdown(
      drop,
      fileReviews,
      reviewArtifactPaths,
      overlayPreviewFile,
      deriveReviewQuestions(drop, derived, fileReviews)
    )
  );
  filesChanged.push(overlayPath);
  writeRouteFile(pagePath, `${JSON.stringify(createOpenAppraisalPage(drop, pageId, Boolean(primaryPreview)), null, 2)}\n`);
  filesChanged.push(pagePath);
  const projectUpdate = updateProjectPageOrder(pageId);
  if (projectUpdate.changed) filesChanged.push(projectUpdate.path);
  const manifestUpdate = updateManifestForOpenAppraisal(drop, {
    pagePath,
    overlayPath,
    reviewArtifactPaths,
    routeLogJsonPath,
    routeLogMdPath
  });
  filesChanged.push(manifestUpdate.path);
  writeRouteFile(nextStepsPath, createOpenAppraisalNextSteps(drop, fileReviews));
  filesChanged.push(nextStepsPath);

  const returnState = {
    routeReady: true,
    routeHandlerStatus: "executed",
    filesRead: uniqueStrings(filesRead),
    filesCreated: filesChanged.filter((file) => !priorState.existingOutputs.includes(file)),
    filesModified: filesChanged.filter((file) => priorState.existingOutputs.includes(file)),
    filesChanged,
    filesIntentionallyNotTouched: [
      "raw input files",
      `${projectRoot}/environment.json`,
      "existing Utah FORGE demo pages",
      "existing Utah FORGE overlays",
      `${projectRoot}/data/**`,
      `${projectRoot}/data/geosee_processed/**`,
      "src/**",
      "prep/**"
    ],
    manifestStatusAfterAction: "open_appraisal_review_created",
    accepted: false,
    reviewRequired: true,
    routeStatusAfterAction: "open_appraisal_review_created",
    projectPageOverlayChanges: {
      pagePath,
      overlayPath,
      projectJsonPageOrder: projectUpdate.changed ? "appended" : "already_present"
    },
    previewReviewArtifactsCreated: reviewArtifactPaths,
    dataComputedArtifactsCreated: [],
    validationBuildResults: [],
    unresolveds: deriveOpenAppraisalUnresolveds(fileReviews),
    nextValidHumanDecision: "Review the intake page/overlay and decide whether to archive, refine, run a file-family route, or approve a later bounded project update route."
  };
  writeRouteFile(routeLogJsonPath, `${JSON.stringify({
    schemaVersion: "0.1.0",
    kind: "geosee.utah-forge.route-execution-log",
    dropId: drop.dropId,
    project: "utah-forge",
    status: "open_appraisal_review_created",
    accepted: false,
    reviewRequired: true,
    routeId: selectedRouteId,
    createdAt: new Date().toISOString(),
    PRIOR_STATE: priorState,
    RETURN_STATE: returnState
  }, null, 2)}\n`);
  filesChanged.push(routeLogJsonPath);
  writeRouteFile(routeLogMdPath, createRouteExecutionLogMarkdown(drop, selectedRouteId, priorState, returnState));
  filesChanged.push(routeLogMdPath);

  return {
    status: "open_appraisal_review_created",
    routeId: "open_appraisal_review",
    selectedRouteId,
    handlerStatus: "executed",
    filesChanged,
    pdfResults: fileReviews.filter((review) => review.family === "pdf").map((review) => review.details),
    note: "Open appraisal review route created proposed review artifacts, one app-visible intake page, and one intake overlay. Outputs remain review-only and unaccepted.",
    nextValidMove: returnState.nextValidHumanDecision,
    PRIOR_STATE: priorState,
    RETURN_STATE: returnState,
    fileReviews
  };
}

function createRoutePriorState(drop, derived, selectedRouteId, overrides = {}) {
  return {
    dropId: drop.dropId,
    manifestStatus: String(drop.manifest.status ?? ""),
    selectedRouteId,
    inputFiles: manifestFiles(drop.manifest).map((file) => ({
      originalName: file.originalName,
      storedPath: file.storedPath,
      size: file.size,
      type: file.type,
      status: file.status
    })),
    accepted: Boolean(drop.manifest.accepted),
    reviewRequired: Boolean(drop.manifest.reviewRequired),
    existingOutputs: [
      ...derived.existing,
      ...existingRouteOutputPaths(drop)
    ],
    protectedAreas: [
      "raw input files",
      `${projectRoot}/environment.json`,
      "existing Utah FORGE demo pages and overlays",
      "existing MT/seismic products",
      "existing render settings, loaders, materials, scalar ranges, color ramps, camera behavior, and computed artifacts",
      `${projectRoot}/data/**`,
      `${projectRoot}/data/geosee_processed/**`,
      "src/**",
      "prep/**"
    ],
    ...overrides
  };
}

function existingRouteOutputPaths(drop) {
  const paths = [];
  for (const candidate of [
    `${drop.dropRoot}/pdf_review`,
    `${drop.dropRoot}/image_review`,
    `${drop.dropRoot}/text_review`,
    `${drop.dropRoot}/csv_review`,
    `${drop.dropRoot}/json_review`,
    `${drop.dropRoot}/geojson_review`,
    `${drop.dropRoot}/file_review`,
    `${drop.dropRoot}/processing_plan.md`,
    `${drop.dropRoot}/proposed_page_update_plan.md`,
    `${drop.dropRoot}/route_execution_log.json`,
    `${drop.dropRoot}/route_execution_log.md`,
    `${projectRoot}/pages/intake_${drop.dropId}.json`,
    `${projectRoot}/overlays/intake_${drop.dropId}/text.md`
  ]) {
    if (fs.existsSync(abs(candidate))) paths.push(candidate);
  }
  return paths;
}

function createPdfReviewIndex(drop, pdfResults) {
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.utah-forge.pdf-review",
    dropId: drop.dropId,
    project: "utah-forge",
    status: "pdf_review_created",
    accepted: false,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
    canonicalPdf: null,
    canonicalStatus: "unknown",
    note: "No canonical PDF was inferred by this route. Human review is required.",
    pdfCount: pdfResults.length,
    pdfs: pdfResults
  };
}

function createPdfReviewIndexMarkdown(drop, pdfResults) {
  const rows = pdfResults.map((result) =>
    `| \`${result.originalName}\` | ${result.pageCount ?? "unknown"} | ${result.textExtractionStatus} | ${result.firstPagePreviewStatus} | \`${result.summaryPath}\` |`
  ).join("\n");
  return `# PDF Review Index: ${drop.dropId}

Status: pdf_review_created

- accepted: false
- reviewRequired: true
- canonicalPdf: unknown
- route: generate_pdf_review

This is an exact-drop PDF review output. It does not create pages, overlays, layers, project config, environment config, data products, computed artifacts, accepted interpretation, validation, certification, or approval.

| PDF | Pages | Text extraction | First-page preview | Summary |
| --- | ---: | --- | --- | --- |
${rows || "| none | n/a | n/a | n/a | n/a |"}

## Next

Human review should decide which PDF, if any, is canonical and what later route is allowed.
`;
}

function createPdfSummaryMarkdown({
  drop,
  file,
  sourcePath,
  pdfInfo,
  textResult,
  previewResult,
  extractedTextPath,
  previewPath
}) {
  return `# PDF Summary: ${file.originalName}

Status: proposed

- dropId: ${drop.dropId}
- accepted: false
- reviewRequired: true
- sourcePath: \`${sourcePath}\`
- size: ${file.size ?? "unknown"}
- pageCount: ${pdfInfo.pageCount ?? "unknown"}
- textExtraction: ${textResult.ok ? "succeeded" : "failed"}
- firstPagePreview: ${previewResult.ok ? "succeeded" : "failed"}

## Outputs

- extractedTextPath: ${textResult.ok ? `\`${extractedTextPath}\`` : "not created"}
- firstPagePreview: ${previewResult.ok ? `\`${previewPath}\`` : "not created"}

## Notes

${pdfInfo.error ? `- pdfinfo error: ${pdfInfo.error}\n` : ""}${textResult.error ? `- text extraction error: ${textResult.error}\n` : ""}${previewResult.error ? `- first-page render error: ${previewResult.error}\n` : ""}- Canonical PDF was not inferred.
- This output is review evidence only, not accepted project truth.
`;
}

function appraiseStagedFile(drop, file) {
  const sourcePath = file.storedPath ?? `${drop.dropRoot}/raw/${file.relativePath ?? file.originalName}`;
  const extension = path.extname(file.originalName || file.relativePath || "").toLowerCase();
  const type = file.type || "";
  const slug = sanitizeSlug(path.basename(file.originalName || file.relativePath || "file", extension));
  const baseReview = {
    originalName: file.originalName,
    sourcePath,
    size: file.size ?? null,
    type,
    extension,
    confidence: "medium",
    uncertainty: [],
    contentInspected: false,
    recommendedRoute: "hold_for_human_review",
    filesRead: [sourcePath],
    outputs: [],
    details: {}
  };
  if (!fs.existsSync(abs(sourcePath))) {
    return {
      ...baseReview,
      family: "missing",
      confidence: "high",
      uncertainty: ["stored file path was missing"],
      outputs: [{
        file: `${drop.dropRoot}/file_review/${slug}/summary.md`,
        content: createGenericFileSummary(drop, file, {
          ...baseReview,
          family: "missing",
          contentInspected: false,
          recommendedRoute: "restore_or_restage_file",
          details: { error: "storedPath missing on disk" }
        })
      }]
    };
  }
  if (extension === ".pdf" || type === "application/pdf") {
    return appraisePdfFile(drop, file, sourcePath, slug, baseReview);
  }
  if (extension === ".md" || extension === ".txt" || type.startsWith("text/")) {
    return appraiseTextFile(drop, file, sourcePath, slug, baseReview);
  }
  if (extension === ".csv") {
    return appraiseCsvFile(drop, file, sourcePath, slug, baseReview);
  }
  if (extension === ".json" || extension === ".geojson") {
    return appraiseJsonFile(drop, file, sourcePath, slug, baseReview, extension === ".geojson");
  }
  if (isImageFile(extension, type)) {
    return appraiseImageFile(drop, file, sourcePath, slug, baseReview);
  }
  return {
    ...baseReview,
    family: "unknown_or_binary",
    confidence: "low",
    uncertainty: ["content was not inspected because the file type is unknown or binary"],
    outputs: [{
      file: `${drop.dropRoot}/file_review/${slug}/summary.md`,
      content: createGenericFileSummary(drop, file, {
        ...baseReview,
        family: "unknown_or_binary",
        recommendedRoute: "human_classification_or_metadata_route"
      })
    }]
  };
}

function appraisePdfFile(drop, file, sourcePath, slug, baseReview) {
  const reviewRoot = `${drop.dropRoot}/pdf_review`;
  const folder = `${reviewRoot}/${slug}`;
  const previewFolder = `${folder}/page_previews`;
  fs.mkdirSync(abs(folder), { recursive: true });
  const pdfInfo = readPdfInfo(sourcePath);
  const extractedTextPath = `${folder}/extracted_text.txt`;
  const textResult = extractPdfText(sourcePath, extractedTextPath);
  const previewPath = `${previewFolder}/page_001.png`;
  const previewResult = renderPdfFirstPage(sourcePath, previewFolder, previewPath);
  const result = {
    ...baseReview,
    family: "pdf",
    contentInspected: textResult.ok,
    recommendedRoute: "human_pdf_review_then_route_selection",
    uncertainty: [
      "canonical PDF was not inferred",
      ...(pdfInfo.ok ? [] : [`pdf metadata failed: ${pdfInfo.error}`]),
      ...(textResult.ok ? [] : [`text extraction failed: ${textResult.error}`]),
      ...(previewResult.ok ? [] : [`first-page preview failed: ${previewResult.error}`])
    ],
    details: {
      pageCount: pdfInfo.pageCount,
      pdfInfoStatus: pdfInfo.ok ? "succeeded" : "failed",
      textExtractionStatus: textResult.ok ? "succeeded" : "failed",
      extractedTextPath: textResult.ok ? extractedTextPath : null,
      firstPagePreviewStatus: previewResult.ok ? "succeeded" : "failed",
      firstPagePreview: previewResult.ok ? previewPath : null,
      reviewFolder: folder,
      summaryPath: `${folder}/summary.md`,
      pdfInfoStatus: pdfInfo.ok ? "succeeded" : "failed",
      pdfInfoError: pdfInfo.error,
      textExtractionError: textResult.error,
      firstPagePreviewError: previewResult.error
    },
    createdFiles: [
      ...(textResult.ok ? [extractedTextPath] : []),
      ...(previewResult.ok ? [previewPath] : [])
    ],
    outputs: []
  };
  result.outputs.push({
    file: `${folder}/summary.md`,
    content: createPdfSummaryMarkdown({
      drop,
      file,
      sourcePath,
      pdfInfo,
      textResult,
      previewResult,
      extractedTextPath,
      previewPath
    })
  });
  const pdfIndex = createPdfReviewIndex(drop, [{
    originalName: file.originalName,
    sourcePath,
    size: file.size ?? null,
    type: file.type ?? "application/pdf",
    reviewFolder: folder,
    summaryPath: `${folder}/summary.md`,
    pageCount: pdfInfo.pageCount,
    pdfInfoStatus: pdfInfo.ok ? "succeeded" : "failed",
    pdfInfoError: pdfInfo.error,
    textExtractionStatus: textResult.ok ? "succeeded" : "failed",
    extractedTextPath: textResult.ok ? extractedTextPath : null,
    textExtractionError: textResult.error,
    firstPagePreviewStatus: previewResult.ok ? "succeeded" : "failed",
    firstPagePreview: previewResult.ok ? previewPath : null,
    firstPagePreviewError: previewResult.error
  }]);
  result.outputs.push({
    file: `${reviewRoot}/pdf_index.json`,
    content: `${JSON.stringify(pdfIndex, null, 2)}\n`
  });
  result.outputs.push({
    file: `${reviewRoot}/pdf_index.md`,
    content: createPdfReviewIndexMarkdown(drop, pdfIndex.pdfs)
  });
  return result;
}

function appraiseTextFile(drop, file, sourcePath, slug, baseReview) {
  const size = file.size ?? fs.statSync(abs(sourcePath)).size;
  const safe = size <= 1_000_000;
  const text = safe ? readText(sourcePath) : "";
  const headings = safe ? extractHeadings(text).slice(0, 24) : [];
  const requestedPages = safe ? parsePagesFromText(text, file) : [];
  const review = {
    ...baseReview,
    family: "text_or_markdown",
    contentInspected: safe,
    confidence: safe ? "high" : "medium",
    recommendedRoute: requestedPages.length ? "propose_project_update_plan" : "human_text_review",
    uncertainty: safe ? [] : ["file exceeded safe text appraisal size"],
    details: {
      headings,
      requestedPageCount: requestedPages.length,
      excerpt: safe ? cleanText(text.slice(0, 1200)) : ""
    }
  };
  return {
    ...review,
    outputs: [{
      file: `${drop.dropRoot}/text_review/${slug}/summary.md`,
      content: createGenericFileSummary(drop, file, review)
    }]
  };
}

function appraiseCsvFile(drop, file, sourcePath, slug, baseReview) {
  const size = file.size ?? fs.statSync(abs(sourcePath)).size;
  const safe = size <= 2_000_000;
  const text = safe ? readText(sourcePath) : "";
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(",").map((value) => cleanText(value)).slice(0, 80) ?? [];
  const review = {
    ...baseReview,
    family: "csv",
    contentInspected: safe,
    recommendedRoute: "classify_csv_preview",
    uncertainty: safe ? ["CSV dialect was inferred lightly only"] : ["file exceeded safe CSV appraisal size"],
    details: {
      headers,
      sampledRows: Math.max(0, Math.min(lines.length - 1, 20)),
      rowCountApprox: safe ? Math.max(0, lines.length - 1) : null
    }
  };
  return {
    ...review,
    outputs: [{
      file: `${drop.dropRoot}/csv_review/${slug}/summary.md`,
      content: createGenericFileSummary(drop, file, review)
    }]
  };
}

function appraiseJsonFile(drop, file, sourcePath, slug, baseReview, forceGeoJson) {
  const size = file.size ?? fs.statSync(abs(sourcePath)).size;
  const safe = size <= 2_000_000;
  let parsed = null;
  let error = "";
  if (safe) {
    try {
      parsed = readJson(sourcePath);
    } catch (caught) {
      error = caught.message;
    }
  }
  const isGeoJson = forceGeoJson || parsed?.type === "FeatureCollection" || parsed?.type === "Feature";
  const featureCount = parsed?.type === "FeatureCollection" && Array.isArray(parsed.features) ? parsed.features.length : null;
  const family = isGeoJson ? "geojson" : "json";
  const review = {
    ...baseReview,
    family,
    contentInspected: Boolean(parsed),
    recommendedRoute: isGeoJson ? "inspect_geojson_bounds" : "human_json_review",
    uncertainty: [
      ...(safe ? [] : ["file exceeded safe JSON appraisal size"]),
      ...(error ? [`JSON parse failed: ${error}`] : []),
      ...(isGeoJson ? ["bounds were not promoted into project state"] : [])
    ],
    details: {
      topLevelType: parsed?.type ?? (Array.isArray(parsed) ? "array" : parsed ? typeof parsed : null),
      topLevelKeys: parsed && !Array.isArray(parsed) && typeof parsed === "object" ? Object.keys(parsed).slice(0, 80) : [],
      featureCount
    }
  };
  return {
    ...review,
    outputs: [{
      file: `${drop.dropRoot}/${family}_review/${slug}/summary.md`,
      content: createGenericFileSummary(drop, file, review)
    }]
  };
}

function appraiseImageFile(drop, file, sourcePath, slug, baseReview) {
  const dimensions = readImageDimensions(sourcePath, path.extname(sourcePath).toLowerCase());
  const review = {
    ...baseReview,
    family: "image",
    contentInspected: dimensions.ok,
    recommendedRoute: "inspect_image_metadata",
    uncertainty: dimensions.ok ? [] : [`image dimensions failed: ${dimensions.error}`],
    details: {
      width: dimensions.width,
      height: dimensions.height,
      metadataStatus: dimensions.ok ? "succeeded" : "failed"
    }
  };
  return {
    ...review,
    outputs: [{
      file: `${drop.dropRoot}/image_review/${slug}/summary.md`,
      content: createGenericFileSummary(drop, file, review)
    }]
  };
}

function createGenericFileSummary(drop, file, review) {
  return `# File Review: ${file.originalName}

Status: proposed

- dropId: ${drop.dropId}
- accepted: false
- reviewRequired: true
- sourcePath: \`${review.sourcePath}\`
- family: ${review.family}
- size: ${file.size ?? "unknown"}
- type: ${file.type || "unknown"}
- contentInspected: ${review.contentInspected ? "true" : "false"}
- confidence: ${review.confidence}
- recommendedRoute: ${review.recommendedRoute}

## Details

\`\`\`json
${JSON.stringify(review.details, null, 2)}
\`\`\`

## Uncertainty

${review.uncertainty.length ? review.uncertainty.map((item) => `- ${item}`).join("\n") : "- none recorded"}

## Boundary

This is review-only appraisal. It is not accepted project truth, validation, certification, approval, or final interpretation.
`;
}

function createOpenAppraisalProcessingPlan(drop, fileReviews) {
  return `# Processing Plan: ${drop.dropId}

Status: proposed

- accepted: false
- reviewRequired: true
- route: open_appraisal_review

This route performed safe review appraisal only. It did not create accepted data products, layers, computed artifacts, or project truth.

## File Families

${summarizeFileReviews(fileReviews)}

## Later Route Candidates

- hold unresolveds
- inspect file-family metadata in a bounded route
- create a rough review page only after human review
- promote nothing until a future route explicitly permits it
`;
}

function createOpenAppraisalPageUpdatePlan(drop, pageId, fileReviews) {
  return `# Proposed Page Update Plan: ${drop.dropId}

Status: proposed

- accepted: false
- reviewRequired: true
- proposed review page: \`${projectRoot}/pages/${pageId}.json\`
- proposed overlay: \`${projectRoot}/overlays/${pageId}/text.md\`

## What This Route Did

Created one review-only intake page and overlay that summarize staged input and safe appraisal results.

## What It Did Not Do

- no existing demo page edits
- no existing overlay edits
- no environment changes
- no layers
- no data promotion
- no accepted interpretation

## Family Summary

${summarizeFileReviews(fileReviews)}
`;
}

function createOpenAppraisalNextSteps(drop, fileReviews) {
  return `# Proposed Next Steps: ${drop.dropId}

Status: proposed

- accepted: false
- reviewRequired: true
- route: open_appraisal_review

## Recommended Next Human Decision

Review the generated intake page and overlay, then choose one:

- keep as review-only and stop
- refine the staged context
- run a file-family-specific route
- approve a later bounded project update plan
- archive/reject/supersede this drop

## Appraisal Summary

${summarizeFileReviews(fileReviews)}
`;
}

function createActualInputSummaryMarkdown(fileReviews) {
  if (!fileReviews.length) return "_No staged files were available for appraisal._";
  return fileReviews.map((review) => {
    if (review.family === "pdf") {
      return [
        `### ${review.originalName}`,
        "",
        `- type: PDF`,
        `- pages: ${review.details?.pageCount ?? "unknown"}`,
        `- text extraction: ${review.details?.textExtractionStatus ?? "unknown"}`,
        `- first-page preview: ${review.details?.firstPagePreviewStatus ?? "unknown"}`
      ].join("\n");
    }
    if (review.family === "image") {
      return [
        `### ${review.originalName}`,
        "",
        `- type: image`,
        `- dimensions: ${review.details?.width ?? "unknown"} x ${review.details?.height ?? "unknown"} px`,
        `- metadata: ${review.details?.metadataStatus ?? "unknown"}`
      ].join("\n");
    }
    if (review.family === "text_or_markdown") {
      return [
        `### ${review.originalName}`,
        "",
        `- type: text / Markdown`,
        `- requested pages found: ${review.details?.requestedPageCount ?? 0}`,
        `- headings: ${Array.isArray(review.details?.headings) && review.details.headings.length ? review.details.headings.map((item) => `\`${item}\``).join(", ") : "none"}`,
        "",
        review.details?.excerpt ? `> ${cleanText(review.details.excerpt).slice(0, 420)}` : "_No safe excerpt available._"
      ].join("\n");
    }
    if (review.family === "csv") {
      return [
        `### ${review.originalName}`,
        "",
        `- type: CSV`,
        `- approximate rows: ${review.details?.rowCountApprox ?? "unknown"}`,
        `- sampled rows: ${review.details?.sampledRows ?? 0}`,
        `- fields: ${Array.isArray(review.details?.headers) && review.details.headers.length ? review.details.headers.map((item) => `\`${item}\``).join(", ") : "unknown"}`
      ].join("\n");
    }
    if (review.family === "json" || review.family === "geojson") {
      return [
        `### ${review.originalName}`,
        "",
        `- type: ${review.family}`,
        `- top-level type: ${review.details?.topLevelType ?? "unknown"}`,
        `- feature count: ${review.details?.featureCount ?? "n/a"}`,
        `- keys: ${Array.isArray(review.details?.topLevelKeys) && review.details.topLevelKeys.length ? review.details.topLevelKeys.map((item) => `\`${item}\``).join(", ") : "none"}`
      ].join("\n");
    }
    return [
      `### ${review.originalName}`,
      "",
      `- type: ${review.family}`,
      `- inspected: ${review.contentInspected ? "yes" : "metadata only"}`,
      `- route: ${review.recommendedRoute}`
    ].join("\n");
  }).join("\n\n");
}

function findPrimaryReviewPreview(fileReviews) {
  for (const review of fileReviews) {
    const preview = review.details?.firstPagePreview || review.details?.thumbnailPath;
    if (preview && fs.existsSync(abs(preview))) {
      return {
        sourcePath: preview,
        extension: normalizedImageExtension(preview) || ".png"
      };
    }
    if (review.family === "image" && fs.existsSync(abs(review.sourcePath))) {
      return {
        sourcePath: review.sourcePath,
        extension: normalizedImageExtension(review.sourcePath) || ".png"
      };
    }
  }
  return null;
}

function normalizedImageExtension(file) {
  const extension = path.extname(file).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return extension;
  return "";
}

function createOpenAppraisalOverlayMarkdown(drop, fileReviews, reviewArtifactPaths, previewImageFile = "", reviewQuestions = []) {
  const rows = fileReviews.map((review) =>
    `| \`${review.originalName}\` | ${review.family} | ${review.contentInspected ? "yes" : "metadata only"} | ${review.recommendedRoute} | ${review.uncertainty.join("; ") || "none"} |`
  ).join("\n");
  const firstFile = fileReviews[0];
  const unresolveds = reviewQuestions.map((item) => ({
      id: item.id ?? "",
      file: item.sourcePath ?? "intake route",
      issue: item.question ?? item.reason ?? item.kind ?? "unresolved route question",
      source: item.kind ?? "route"
  }));
  const visualBlock = previewImageFile
    ? `![Actual staged input preview](${previewImageFile})`
    : "_No visual preview was generated for this staged input._";
  const unresolvedBlock = unresolveds.length
    ? `## Questions / Unresolved\n\n${unresolveds.map((item) => `- ${item.id ? `${item.id}: ` : ""}${item.issue} (${item.file}; ${item.source})`).join("\n")}\n`
    : "";
  return `# Utah FORGE Input Review: ${firstFile?.originalName ?? drop.dropId}

Status: proposed / needs_review

- accepted: false
- reviewRequired: true
- route: open_appraisal_review
- drop: ${drop.dropId}

${visualBlock}

This page shows the actual staged input preview for review. It is demo-ready context, not final acceptance, official project truth, validation, certification, approval, or engineering authority.

## Concise Plan

1. Preserve the staged file as review evidence.
2. Show the strongest safe preview of the actual input in the app.
3. Park unresolveds only if they block promotion or routing.
4. Let the next human decision choose review-only, refine, archive, or a later bounded project-update route.

## Input Data Summary

${createActualInputSummaryMarkdown(fileReviews)}

${unresolvedBlock}
## Files Dropped

| File | Family | Inspected | Recommended route | Unresolved / uncertainty |
| --- | --- | --- | --- | --- |
${rows || "| none | n/a | no | hold | no files found |"}

## Review Artifacts

${reviewArtifactPaths.length ? reviewArtifactPaths.map((file) => `- \`${file}\``).join("\n") : "- none"}

## What Was Built

- app-visible review page focused on the actual input preview
- overlay-local input preview image
- source inventory and file-family review summaries
- processing plan and proposed page update plan
- route execution log with PRIOR_STATE and RETURN_STATE

## Boundaries Held

- raw files were not deleted or overwritten
- no existing demo pages or overlays were edited
- no layers were created
- no project data was accepted or promoted
- no existing MT/seismic/render behavior was changed
- no validation, certification, approval, or final interpretation was created

## Next Human Decisions

- decide whether this drop remains review-only, needs refinement, should run a file-family route, or should be archived/rejected/superseded
- decide whether any later project update route is allowed
`;
}

function createOpenAppraisalPage(drop, pageId, hasPreviewImage = false) {
  return {
    id: pageId,
    title: "Utah FORGE FigJam Input Review",
    subtitle: `Actual staged input preview - ${drop.dropId}`,
    camera: {
      position: [10621.214773340043, -6159.24121512361, 94269.30430018228],
      target: [-5527, -10484, 996],
      up: [0, 0, 1],
      fov: 52
    },
    transition: { duration: 3000, easing: "easeInOutCubic" },
    holdDuration: 4000,
    accentColor: "#6bc5ff",
    intakeLifecycle: {
      dropId: drop.dropId,
      status: "open_appraisal_review_created",
      accepted: false,
      reviewRequired: true,
      routeExecuted: "open_appraisal_review",
      reviewPage: `${projectRoot}/pages/${pageId}.json`,
      reviewOverlay: `${projectRoot}/overlays/${pageId}/text.md`
    },
    visibilityOverrides: {
      terrain: true,
      "transport-roads": true,
      "hydrography-streams": true,
      "hydrography-lakes": true,
      "utah-forge-phase3-working-area": true,
      "utah-forge-mt-resistivity-full-density": false,
      "utah-forge-phase3-seismic-browser": false
    },
    layerOverrides: {
      terrain: { meshSurfaceLiftM: -700 }
    },
    overlayLayout: hasPreviewImage
      ? { x: 0.2, y: 0.04, width: 0.6, height: 0.88 }
      : { x: 0.04, y: 0.08, width: 0.46 },
    overlay: {
      contentFile: `overlays/${pageId}/text.md`,
      timing: { fadeMs: 450, gapMs: 0, leadMs: 0, easing: "easeInOutCubic" }
    },
    presenterNotes: "Proposed intake appraisal review surface only. This page does not mark staged files as accepted project truth."
  };
}

function updateProjectPageOrder(pageId) {
  const projectPath = `${projectRoot}/project.json`;
  const project = readJson(projectPath);
  if (!Array.isArray(project.pageOrder)) project.pageOrder = [];
  if (project.pageOrder.includes(pageId)) {
    return { path: projectPath, changed: false };
  }
  project.pageOrder.push(pageId);
  project.modified = new Date().toISOString();
  writeRouteFile(projectPath, `${JSON.stringify(project, null, 4)}\n`);
  return { path: projectPath, changed: true };
}

function updateManifestForOpenAppraisal(drop, output) {
  const manifest = {
    ...drop.manifest,
    status: "open_appraisal_review_created",
    processingStatus: "open_appraisal_review_created",
    accepted: false,
    reviewRequired: true,
    routeExecuted: "open_appraisal_review",
    reviewPage: output.pagePath,
    reviewPages: [output.pagePath],
    reviewOverlay: output.overlayPath,
    reviewOverlays: [output.overlayPath],
    reviewArtifactPaths: output.reviewArtifactPaths,
    routeExecutionLog: output.routeLogJsonPath,
    updatedAt: new Date().toISOString()
  };
  writeRouteFile(drop.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { path: drop.manifestPath, changed: true };
}

function createRouteExecutionLogMarkdown(drop, routeId, priorState, returnState) {
  return `# Route Execution Log: ${drop.dropId}

Status: ${returnState.routeStatusAfterAction}

- route: ${routeId}
- accepted: false
- reviewRequired: true

## PRIOR_STATE

\`\`\`json
${JSON.stringify(priorState, null, 2)}
\`\`\`

## RETURN_STATE

\`\`\`json
${JSON.stringify(returnState, null, 2)}
\`\`\`
`;
}

function deriveOpenAppraisalUnresolveds(fileReviews) {
  const unresolveds = [];
  for (const review of fileReviews) {
    for (const item of review.uncertainty) {
      unresolveds.push({
        file: review.originalName,
        family: review.family,
        issue: item,
        status: "needs_review"
      });
    }
  }
  if (!unresolveds.length) {
    unresolveds.push({
      file: "drop",
      family: "all",
      issue: "human review still required before any acceptance or project update",
      status: "needs_review"
    });
  }
  return unresolveds;
}

function summarizeFileReviews(fileReviews) {
  return fileReviews.length
    ? fileReviews.map((review) => `- \`${review.originalName}\`: ${review.family}; inspected=${review.contentInspected ? "true" : "false"}; recommendedRoute=${review.recommendedRoute}`).join("\n")
    : "- no files reviewed";
}

function isImageFile(extension, type) {
  return [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension) || type.startsWith("image/");
}

function readImageDimensions(sourcePath, extension) {
  try {
    const buffer = fs.readFileSync(abs(sourcePath));
    if (extension === ".png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
      return { ok: true, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), error: "" };
    }
    if ((extension === ".jpg" || extension === ".jpeg") && buffer.length > 4) {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
          return {
            ok: true,
            width: buffer.readUInt16BE(offset + 7),
            height: buffer.readUInt16BE(offset + 5),
            error: ""
          };
        }
        offset += 2 + length;
      }
    }
    return { ok: false, width: null, height: null, error: "unsupported image header" };
  } catch (caught) {
    return { ok: false, width: null, height: null, error: caught.message };
  }
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function readPdfInfo(sourcePath) {
  const result = spawnPdfTool("pdfinfo", [abs(sourcePath)]);
  if (!result.ok) {
    return {
      ok: false,
      pageCount: null,
      error: result.error
    };
  }
  const pagesMatch = result.stdout.match(/^Pages:\s+(\d+)/im);
  return {
    ok: true,
    pageCount: pagesMatch ? Number(pagesMatch[1]) : null,
    error: ""
  };
}

function extractPdfText(sourcePath, outputPath) {
  const result = spawnPdfTool("pdftotext", ["-layout", abs(sourcePath), abs(outputPath)]);
  if (!result.ok) return result;
  return {
    ok: fs.existsSync(abs(outputPath)),
    error: fs.existsSync(abs(outputPath)) ? "" : "pdftotext completed but did not create output."
  };
}

function renderPdfFirstPage(sourcePath, previewFolder, previewPath) {
  fs.mkdirSync(abs(previewFolder), { recursive: true });
  const prefix = `${previewFolder}/page`;
  const result = spawnPdfTool("pdftoppm", ["-f", "1", "-l", "1", "-png", "-singlefile", abs(sourcePath), abs(prefix)]);
  const generatedPath = `${prefix}.png`;
  if (result.ok && fs.existsSync(abs(generatedPath))) {
    if (normalizeRepo(generatedPath) !== normalizeRepo(previewPath)) {
      fs.renameSync(abs(generatedPath), abs(previewPath));
    }
    return { ok: true, error: "" };
  }
  return {
    ok: false,
    error: result.ok
      ? "pdftoppm completed but did not create a first-page preview."
      : result.error
  };
}

function spawnPdfTool(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    return { ok: false, stdout: "", stderr: "", error: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: (result.stderr || result.stdout || `${command} exited with ${result.status}`).trim()
    };
  }
  return {
    ok: true,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: ""
  };
}

function writeRouteFile(file, content) {
  assertRouteWrite(file);
  const target = abs(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function copyRouteFile(source, targetFile) {
  assertRouteWrite(targetFile);
  const target = abs(targetFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(abs(source), target);
}

function assertRouteWrite(file) {
  const normalized = normalizeRepo(file);
  const dropRoutePatterns = [
    new RegExp(`^${escapeRegExp(dropsRoot)}/[^/]+/(pdf_review|image_review|text_review|csv_review|json_review|geojson_review|file_review)/`),
    new RegExp(`^${escapeRegExp(dropsRoot)}/[^/]+/(processing_plan\\.md|proposed_page_update_plan\\.md|proposed_next_steps\\.md|route_execution_log\\.json|route_execution_log\\.md|intake_manifest\\.json)$`)
  ];
  if (dropRoutePatterns.some((pattern) => pattern.test(normalized))) return;
  const intakePagePattern = new RegExp(`^${escapeRegExp(projectRoot)}/pages/intake_[^/]+\\.json$`);
  if (intakePagePattern.test(normalized)) return;
  const intakeOverlayPattern = new RegExp(`^${escapeRegExp(projectRoot)}/overlays/intake_[^/]+/(text\\.md|[^/]+\\.(png|jpg|jpeg|webp))$`, "i");
  if (intakeOverlayPattern.test(normalized)) return;
  if (normalized === `${projectRoot}/project.json`) return;
  throw new Error(`Blocked route write outside allowed intake route paths: ${file}`);
}

function uniqueSlug(value, used) {
  const ext = path.extname(value);
  const stem = path.basename(value, ext) || "pdf";
  const base = sanitizeSlug(stem);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function sanitizeSlug(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "pdf";
}

function normalizeSelectedRouteId(routeId) {
  if (routeId === "ROUTE-002") return "generate_pdf_review";
  if (routeId === "ROUTE-001") return "hold_unresolveds";
  if (["appraise_messy_intake", "rough_review_pages", "generate_review_surface"].includes(routeId)) return "open_appraisal_review";
  return String(routeId ?? "");
}

function deriveAiReviewStatus(derived) {
  if (derived.routeExecution.status === "open_appraisal_review_created") return "open_appraisal_review_created";
  if (derived.routeExecution.status === "pdf_review_created") return "pdf_review_created";
  if (derived.routeExecution.status === "pdf_review_created_with_warnings") return "pdf_review_created";
  if (derived.routeExecution.status === "already_created") return "pdf_review_created";
  if (derived.routeExecution.status === "failed") return "route_execution_failed";
  if (derived.userContextResponse.present) return "route_ready";
  return derived.unresolveds.length > 0 ? "questions_required" : "plan_proposed";
}

function deriveNextUiAction(derived) {
  if (derived.routeExecution.status === "open_appraisal_review_created") return "show_open_appraisal_review_created";
  if (derived.routeExecution.status === "pdf_review_created") return "show_pdf_review_created";
  if (derived.routeExecution.status === "failed") return "show_route_execution_failed";
  if (derived.userContextResponse.present) return "show_route_ready";
  return derived.unresolveds.length > 0 ? "show_questions_in_ui" : "show_plan_in_ui";
}

function createRouteHandlerRegistry() {
  const protectedAreas = [
    "projects/utah-forge/project.json",
    "projects/utah-forge/environment.json",
    "projects/utah-forge/pages/**",
    "projects/utah-forge/overlays/**",
    "projects/utah-forge/data/geosee_processed/**",
    "projects/utah-forge/data/**",
    "src/**",
    "prep/**"
  ];
  const base = [
    {
      routeId: "hold_unresolveds",
      label: "Hold unresolveds",
      allowedReads: ["drop trace files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["INTAKE_REVIEW.json", "INTAKE_REVIEW.md", "AI_REVIEW.json compatibility", "AI_REVIEW.md compatibility", "INTAKE_SWITCHBOARD.json compatibility", "INTAKE_SWITCHBOARD.md compatibility"],
      outputStatus: "route_ready",
      verificationRequired: ["confirm no route outputs were created"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "generate_pdf_review",
      label: "Generate exact-drop PDF review",
      allowedReads: ["drop-local raw PDF files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local pdf_review/**"],
      outputStatus: "pdf_review_created",
      verificationRequired: ["pdf_index.json parses", "no project config/page/data/runtime writes"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "open_appraisal_review",
      label: "Open appraisal review",
      allowedReads: [
        "drop trace files",
        "safe staged Markdown/text/CSV/JSON/GeoJSON contents",
        "safe PDF text/metadata/previews when local tools allow",
        "safe image metadata/dimensions"
      ],
      allowedWrites: [
        "drop-local source inventory and review outputs",
        "drop-local file-family review folders",
        "drop-local processing/page/update plans",
        "drop-local route execution log",
        "projects/utah-forge/pages/intake_<dropId>.json",
        "projects/utah-forge/overlays/intake_<dropId>/text.md",
        "projects/utah-forge/project.json pageOrder append only"
      ],
      protectedAreas: [
        "raw input files",
        "projects/utah-forge/environment.json",
        "existing projects/utah-forge/pages/** other than intake_<dropId>.json",
        "existing projects/utah-forge/overlays/** other than intake_<dropId>/text.md",
        "projects/utah-forge/data/**",
        "projects/utah-forge/data/geosee_processed/**",
        "src/**",
        "prep/**"
      ],
      outputStatus: "open_appraisal_review_created",
      verificationRequired: ["page JSON parses", "project.json parses", "route_execution_log.json parses", "accepted remains false"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "inspect_image_metadata",
      label: "Inspect image metadata",
      allowedReads: ["drop-local image files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local image review outputs"],
      outputStatus: "image_metadata_review_created",
      verificationRequired: ["metadata output parses", "no project data promotion"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "parse_text_handoff",
      label: "Parse text handoff",
      allowedReads: ["drop-local Markdown/text files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local handoff review outputs"],
      outputStatus: "text_handoff_review_created",
      verificationRequired: ["review output exists", "no project mutation"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "classify_csv_preview",
      label: "Classify CSV preview",
      allowedReads: ["drop-local CSV files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local CSV preview outputs"],
      outputStatus: "csv_preview_classified",
      verificationRequired: ["preview output parses", "no data promotion"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "inspect_geojson_bounds",
      label: "Inspect GeoJSON bounds",
      allowedReads: ["drop-local GeoJSON files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local GeoJSON bounds review outputs"],
      outputStatus: "geojson_bounds_review_created",
      verificationRequired: ["bounds output parses", "no project layer creation"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "create_intake_review_page",
      label: "Create intake review page",
      allowedReads: ["INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json", "drop-local review outputs"],
      allowedWrites: ["projects/utah-forge/pages/intake_<dropId>.json", "projects/utah-forge/overlays/intake_<dropId>/text.md"],
      outputStatus: "review_page_created",
      verificationRequired: ["page JSON parses", "overlay exists", "no existing page/overlay edits"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "propose_project_update_plan",
      label: "Propose project update plan",
      allowedReads: ["drop trace files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["drop-local proposed update plan"],
      outputStatus: "project_update_plan_proposed",
      verificationRequired: ["plan output exists", "no project mutation"],
      requiresHumanConfirmation: true
    },
    {
      routeId: "ask_more_context",
      label: "Ask for more context",
      allowedReads: ["drop trace files", "INTAKE_REVIEW.json", "AI_REVIEW.json compatibility", "USER_CONTEXT_RESPONSE.json"],
      allowedWrites: ["INTAKE_REVIEW.json", "INTAKE_REVIEW.md", "AI_REVIEW.json compatibility", "AI_REVIEW.md compatibility"],
      outputStatus: "questions_required",
      verificationRequired: ["questions remain UI-only", "no route outputs"],
      requiresHumanConfirmation: true
    }
  ].map((handler) => ({ protectedAreas, ...handler }));
  return new Map([
    ...base.map((handler) => [handler.routeId, handler]),
    ["ROUTE-001", base[0]],
    ["ROUTE-002", base[1]],
    ["appraise_messy_intake", base[2]],
    ["rough_review_pages", base[2]],
    ["generate_review_surface", base[2]]
  ]);
}

function dispatchRouteShell(drop, state) {
  const selectedRouteId = normalizeSelectedRouteId(state.userContextResponse.selectedRouteId) || normalizeSelectedRouteId(state.routeExecution.selectedRouteId);
  const handler = selectedRouteId ? routeHandlers.get(selectedRouteId) ?? null : null;
  const routeReady = state.userContextResponse.present;
  const routeHandlerStatus = state.routeExecution.status === "open_appraisal_review_created"
    ? "executed"
    : state.routeExecution.status === "pdf_review_created"
    ? "executed"
    : state.routeExecution.status === "pdf_review_created_with_warnings"
      ? "executed_with_warnings"
    : state.routeExecution.status === "already_created"
      ? "already_created"
      : state.routeExecution.status === "failed"
        ? "failed"
        : selectedRouteId
    ? handler
      ? "not_implemented"
      : "unknown_route"
    : routeReady
      ? "no_route_selected"
      : "waiting_for_context_confirmation";
  return {
    routeReady,
    selectedRouteId,
    routeHandlerStatus,
    handler: handler ? { ...handler } : null,
    routeExecutionImplemented: ["generate_pdf_review", "open_appraisal_review"].includes(state.routeExecution.routeId),
    routeExecution: state.routeExecution,
    PRIOR_STATE: {
      dropId: drop.dropId,
      manifestStatus: String(drop.manifest.status ?? ""),
      selectedRouteId,
      accepted: Boolean(drop.manifest.accepted),
      reviewRequired: Boolean(drop.manifest.reviewRequired),
      existingOutputs: state.routeExecution.PRIOR_STATE.existingOutputs.length
        ? state.routeExecution.PRIOR_STATE.existingOutputs
        : state.existing
    },
    RETURN_STATE: {
      routeReady,
      routeHandlerStatus,
      filesChanged: state.routeExecution.filesChanged,
      accepted: false,
      reviewRequired: true,
      nextValidMove: state.routeExecution.nextValidMove || (
        selectedRouteId
          ? "Implement the selected route handler in a separate explicit gate."
          : "Record a selectedRouteId or add route-selection normalization before execution."
      )
    }
  };
}

function deriveUnresolveds({ drop, pdfReview, duplicateOf, requestedPages, projectFit, files }) {
  const unresolveds = [];
  if (!pdfReview.present && files.some((file) => file.extension === ".pdf")) {
    unresolveds.push({
      id: "UNR-001",
      kind: "missing_review_source",
      question: "PDF files are present but exact-drop pdf_review outputs are missing. Should PDF review be generated before any PDF-derived route?",
      whyItMatters: "Raw PDF parsing is blocked in this rail, so PDF visual references cannot safely become route evidence yet.",
      source: "intake_manifest.json",
      parkingLocation: "INTAKE_SWITCHBOARD.md",
      actionable: false
    });
  }
  if (duplicateOf.length > 0) {
    unresolveds.push({
      id: "UNR-002",
      kind: "duplicate_or_supersession",
      question: `This drop duplicates older file signatures (${duplicateOf.join(", ")}). Is it the new canonical test drop, a duplicate, or a supersession?`,
      whyItMatters: "Duplicate content does not suppress processing, but lifecycle intent affects archive/supersede/reject routing.",
      source: "intake_manifest.json",
      parkingLocation: "INTAKE_SWITCHBOARD.md",
      actionable: false
    });
  }
  if (drop.manifest.userContext?.text) {
    unresolveds.push({
      id: "UNR-003",
      kind: "human_request_scope",
      question: `User context says "${drop.manifest.userContext.text}". Should that mean switchboard planning only, review-page generation, or page wiring after approval?`,
      whyItMatters: "Short human phrases carry deep intent; the system should bind that intent before mutation.",
      source: "intake_manifest.json userContext",
      parkingLocation: "INTENT_BINDINGS.md",
      actionable: false
    });
  }
  for (const page of requestedPages) {
    const fit = projectFit.find((item) => item.requestId === `request-page-${page.number}`);
    if (fit?.fitStatus !== "routeable_existing_assets") {
      unresolveds.push({
        id: `UNR-PAGE-${String(page.number).padStart(2, "0")}`,
        kind: "narrative_or_data_fit",
        question: `Page ${page.number} (${page.title}) does not fully map to existing routeable project assets. What narrative role should it have?`,
        whyItMatters: "The page may be reference-only, placeholder, data acquisition, or later page wiring; the AI should not invent that route.",
        source: page.sourceFile,
        parkingLocation: "INTENT_BINDINGS.md",
        actionable: false
      });
    }
  }
  return unresolveds;
}

function deriveProjectFit(requestedPages) {
  return requestedPages.map((page) => {
    const known = existingAssetFitForPage(page.number);
    return {
      requestId: `request-page-${page.number}`,
      title: page.title,
      fitStatus: known.fitStatus,
      existingLayerIds: known.existingLayerIds,
      missingRoots: known.missingRoots,
      narrativeFit: known.narrativeFit
    };
  });
}

function existingAssetFitForPage(pageNumber) {
  const map = {
    1: {
      fitStatus: "partial_existing_assets",
      existingLayerIds: ["terrain", "transport-roads", "hydrography-streams", "hydrography-lakes", "utah-forge-phase3-working-area"],
      missingRoots: ["well landmarks", "infrastructure labels"],
      narrativeFit: "site arrival context"
    },
    4: {
      fitStatus: "routeable_existing_assets",
      existingLayerIds: ["utah-forge-mt-stations"],
      missingRoots: ["station phase label toggle"],
      narrativeFit: "measured MT station network"
    },
    5: {
      fitStatus: "routeable_existing_assets",
      existingLayerIds: ["utah-forge-mt-resistivity-full-density", "utah-forge-mt-resistivity-volume"],
      missingRoots: ["human choice of primary visual anchor"],
      narrativeFit: "source-derived resistivity overview"
    },
    6: {
      fitStatus: "routeable_existing_assets",
      existingLayerIds: ["utah-forge-mt-resistivity-slices"],
      missingRoots: ["human confirmation that slices are the money shot"],
      narrativeFit: "source-derived depth slices"
    },
    7: {
      fitStatus: "partial_existing_assets",
      existingLayerIds: ["utah-forge-mt-stations", "utah-forge-mt-resistivity-slices", "utah-forge-phase3-seismic-browser"],
      missingRoots: ["well trajectory", "basement contact surface"],
      narrativeFit: "integrated geophysics context"
    }
  };
  return map[pageNumber] ?? {
    fitStatus: "not_yet_routeable",
    existingLayerIds: [],
    missingRoots: ["no confirmed app data route"],
    narrativeFit: "reference or placeholder until human intent is bound"
  };
}

function deriveRouteCandidates({ requestedPages, unresolveds, projectFit }) {
  const routes = [];
  routes.push({
    id: "ROUTE-001",
    routeId: "hold_unresolveds",
    normalizedRouteId: "hold_unresolveds",
    label: "Hold unresolveds",
    requiredQuestionIds: [],
    input: "all staged files",
    inferredIntent: "inventory and switchboard only",
    projectFit: "always valid",
    blocker: "",
    possibleRoute: "hold unresolveds and stop",
    approvalNeeded: "none; this is the current pass"
  });
  if (unresolveds.some((item) => item.id === "UNR-001")) {
    routes.push({
      id: "ROUTE-002",
      routeId: "generate_pdf_review",
      normalizedRouteId: "generate_pdf_review",
      label: "Generate exact-drop PDF review",
      requiredQuestionIds: ["UNR-001"],
      input: "PDF files",
      inferredIntent: "visual reference support",
      projectFit: "not routeable until pdf_review exists",
      blocker: "missing exact-drop pdf_review outputs",
      possibleRoute: "generate pdf_review in a separate approved pass",
      approvalNeeded: "human approves PDF review generation"
    });
  }
  routes.push({
    id: "ROUTE-OPEN-APPRAISAL",
    routeId: "open_appraisal_review",
    normalizedRouteId: "open_appraisal_review",
    label: "Open appraisal review",
    requiredQuestionIds: unresolveds.map((item) => item.id),
    input: "all staged files",
    inferredIntent: "appraise messy intake and create review-only app surface",
    projectFit: "review-only Utah FORGE intake surface",
    blocker: unresolveds.length ? "human context confirmation / route selection required" : "human route selection required",
    possibleRoute: "create file-family review artifacts plus one intake page/overlay",
    approvalNeeded: "human selects open_appraisal_review"
  });
  for (const fit of projectFit.filter((item) => item.fitStatus === "routeable_existing_assets")) {
    routes.push({
      id: `ROUTE-${fit.requestId.replace("request-page-", "PAGE-")}`,
      routeId: `wire_${fit.requestId.replace("request-page-", "page_")}`,
      normalizedRouteId: `wire_${fit.requestId.replace("request-page-", "page_")}`,
      label: `Wire ${fit.title}`,
      requiredQuestionIds: [],
      input: fit.title,
      inferredIntent: fit.narrativeFit,
      projectFit: fit.existingLayerIds.join(", "),
      blocker: fit.missingRoots.join("; "),
      possibleRoute: "later page wiring with existing assets only",
      approvalNeeded: "human binds narrative role and approves page wiring"
    });
  }
  return routes;
}

function createCommitChecklist(derived) {
  const checklist = [
    "hold unresolveds and stop",
    "generate exact-drop pdf_review only",
    "create review pages only after intent binding",
    "wire existing Utah FORGE assets only after intent binding",
    "archive/supersede duplicate drop"
  ];
  if (!derived.unresolveds.length) {
    checklist.unshift("accept switchboard as routeable planning state");
  }
  return checklist;
}

function readMarkdownDocs(drop) {
  return manifestFiles(drop.manifest)
    .filter((file) => isTextLikeFile(file))
    .map((file) => {
      const storedPath = file.storedPath ?? `${drop.dropRoot}/raw/${file.relativePath ?? file.originalName}`;
      const text = fs.existsSync(abs(storedPath)) ? readText(storedPath) : "";
      return {
        file,
        text,
        headings: extractHeadings(text),
        requestedPages: parsePagesFromText(text, file)
      };
    });
}

function parseRequestedPages(markdownDocs) {
  const pages = [];
  const seen = new Set();
  for (const doc of markdownDocs) {
    for (const page of doc.requestedPages) {
      const key = `${page.number}:${page.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pages.push(page);
    }
  }
  pages.sort((a, b) => a.number - b.number);
  return pages;
}

function parsePagesFromText(text, file) {
  const pageRegex = /^###\s+Page\s+(\d+):\s+(.+)$/gim;
  const matches = [...text.matchAll(pageRegex)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const body = text.slice(start, end).trim();
    return {
      number: Number(match[1]),
      title: cleanText(match[2]).replace(/\*+$/g, "").trim(),
      body,
      sourceFile: file.storedPath,
      layerType: extractLabeledLine(body, "Layer type"),
      controlsNeeded: extractLabeledLine(body, "Controls needed")
    };
  });
}

function classifyManifestFile(file, pdfReview) {
  const extension = path.extname(file.originalName || file.relativePath || "").toLowerCase();
  const type = file.type || "application/octet-stream";
  const isPdf = extension === ".pdf" || type === "application/pdf";
  const isMarkdown = extension === ".md" || type === "text/markdown";
  const reviewed = isPdf && pdfReview.byOriginalName.get(file.originalName);
  return {
    originalName: file.originalName,
    relativePath: file.relativePath,
    storedPath: file.storedPath,
    size: file.size,
    type,
    extension,
    lastModified: file.lastModified,
    lastModifiedIso: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    stagedStatus: file.status ?? "staged_unprocessed",
    accepted: false,
    reviewRequired: true,
    likelyFamily: isMarkdown
      ? "demo_visual_handoff"
      : isPdf
        ? "figjam_visual_reference_export"
        : "staged_source_candidate",
    likelyFormat: isMarkdown ? "markdown_text" : isPdf ? "pdf" : extension.replace(/^\./, "") || "unknown",
    classificationConfidence: isMarkdown ? "high" : isPdf ? "medium" : "low",
    pageCount: reviewed?.pageCount ?? null,
    textExtracted: Boolean(reviewed?.extractedTextPath),
    extractedTextPath: reviewed?.extractedTextPath ?? null,
    firstPagePreview: reviewed?.firstPagePreview ?? null,
    summaryPath: reviewed?.summaryPath ?? null,
    recommendedHandling: isPdf
      ? "Park as staged visual reference unless exact-drop pdf_review exists; do not raw-parse PDF in this pass."
      : "Use as switchboard context only until human intent is bound."
  };
}

function inspectPdfReview(dropRoot) {
  const reviewRoot = `${dropRoot}/pdf_review`;
  const indexJson = `${reviewRoot}/pdf_index.json`;
  const indexMarkdown = `${reviewRoot}/pdf_index.md`;
  if (!fs.existsSync(abs(reviewRoot))) {
    return {
      present: false,
      byOriginalName: new Map(),
      summary: "missing",
      output: {
        status: "missing",
        expectedFolder: reviewRoot,
        note: "No exact-drop pdf_review index, summaries, extracted text, or first-page previews were present. Raw PDF parsing was not performed."
      },
      markdown: "Missing for this exact drop. Raw PDF parsing was avoided."
    };
  }
  const byOriginalName = new Map();
  if (fs.existsSync(abs(indexJson))) {
    const index = readJson(indexJson);
    const pdfs = Array.isArray(index.pdfs) ? index.pdfs : Array.isArray(index.files) ? index.files : [];
    for (const item of pdfs) {
      const name = item.originalName ?? item.fileName ?? item.name;
      if (!name) continue;
      byOriginalName.set(name, {
        pageCount: item.pageCount ?? null,
        extractedTextPath: item.extractedTextPath ?? null,
        firstPagePreview: item.firstPagePreview ?? item.firstPagePreviewPath ?? null,
        summaryPath: item.summaryPath ?? null
      });
    }
  }
  return {
    present: true,
    byOriginalName,
    summary: "present",
    output: {
      status: "present",
      folder: reviewRoot,
      indexJson: fs.existsSync(abs(indexJson)) ? indexJson : null,
      indexMarkdown: fs.existsSync(abs(indexMarkdown)) ? indexMarkdown : null,
      reviewedPdfCount: byOriginalName.size
    },
    markdown: `Found exact-drop \`pdf_review/\` outputs. PDFs referenced in index: ${byOriginalName.size}. Raw PDF parsing was avoided.`
  };
}

function readUserContextResponse(file) {
  if (!fs.existsSync(abs(file))) {
    return {
      present: false,
      path: file,
      selectedRouteId: "",
      answers: []
    };
  }
  const raw = readJson(file);
  const answers = normalizeUserContextAnswers(raw);
  const selectedRouteId = normalizeSelectedRouteId(String(
    raw.selectedRouteId
      ?? answers.find((answer) => answer.selectedRouteId)?.selectedRouteId
      ?? inferSelectedRouteIdFromAnswers(answers)
      ?? ""
  ));
  return {
    present: true,
    path: file,
    status: String(raw.status ?? ""),
    kind: String(raw.kind ?? ""),
    createdAt: String(raw.createdAt ?? raw.respondedAt ?? ""),
    selectedRouteId,
    answers
  };
}

function normalizeUserContextAnswers(raw) {
  if (Array.isArray(raw.answers)) {
    return raw.answers.map((answer) => ({
      questionId: String(answer.questionId ?? ""),
      kind: String(answer.kind ?? ""),
      question: String(answer.question ?? ""),
      answer: String(answer.answer ?? ""),
      selectedOption: String(answer.selectedOption ?? ""),
      selectedRouteId: String(answer.selectedRouteId ?? ""),
      freeText: String(answer.freeText ?? ""),
      createdAt: String(answer.createdAt ?? raw.createdAt ?? "")
    }));
  }
  if (Array.isArray(raw.responses)) {
    return raw.responses.map((response) => ({
      questionId: String(response.questionId ?? ""),
      kind: "",
      question: "",
      answer: String(response.answer ?? response.mode ?? ""),
      selectedOption: String(response.mode ?? ""),
      selectedRouteId: String(response.selectedRouteId ?? ""),
      freeText: String(response.notes ?? ""),
      createdAt: String(raw.createdAt ?? raw.respondedAt ?? "")
    }));
  }
  return [];
}

function inferSelectedRouteIdFromAnswers(answers) {
  for (const answer of answers) {
    const existingRoute = normalizeSelectedRouteId(answer.selectedRouteId);
    if (existingRoute) return existingRoute;
    const haystack = [
      answer.questionId,
      answer.kind,
      answer.question,
      answer.answer,
      answer.selectedOption,
      answer.freeText
    ].join(" ").toLowerCase();
    if (
      answer.kind === "missing_review_source" &&
      answer.questionId === "UNR-001" &&
      /\byes\b/.test(haystack) &&
      (haystack.includes("pdf review") || haystack.includes("pdf_review") || haystack.includes("exact-drop pdf"))
    ) {
      return "generate_pdf_review";
    }
  }
  return "";
}

function findOlderDuplicateDrops(drop) {
  const signature = manifestSignature(drop.manifest);
  if (!signature) return [];
  const folder = abs(dropsRoot);
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== drop.dropId && isSafeDropId(entry.name))
    .map((entry) => {
      const manifestPath = `${dropsRoot}/${entry.name}/intake_manifest.json`;
      if (!fs.existsSync(abs(manifestPath))) return null;
      const manifest = readJson(manifestPath);
      return manifestSignature(manifest) === signature ? entry.name : null;
    })
    .filter(Boolean)
    .sort();
}

function manifestSignature(manifest) {
  const files = manifestFiles(manifest);
  if (!files.length) return "";
  return files
    .map((file) => `${file.originalName ?? file.relativePath ?? ""}:${file.size ?? ""}`)
    .sort()
    .join("|");
}

function manifestFiles(manifest) {
  return Array.isArray(manifest.files) ? manifest.files : [];
}

function isTextLikeFile(file) {
  const extension = path.extname(file.originalName || file.relativePath || "").toLowerCase();
  const type = file.type || "";
  return extension === ".md" || extension === ".txt" || type.startsWith("text/");
}

function extractHeadings(text) {
  return [...text.matchAll(/^#{1,4}\s+(.+)$/gm)].map((match) => cleanText(match[1])).slice(0, 60);
}

function extractLabeledLine(text, label) {
  const regex = new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*([^\\n]+)`, "i");
  const match = text.match(regex);
  return match ? cleanText(match[1]) : "";
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(abs(file), "utf8");
}

function writeAllowedFile(file, content) {
  assertAllowedWrite(file);
  const target = abs(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function assertAllowedWrite(file) {
  const normalized = normalizeRepo(file);
  if (normalized === latestAiReviewPath || normalized === latestIntakeReviewPath) {
    return;
  }
  const intakeFilePattern = new RegExp(`^${escapeRegExp(dropsRoot)}/[^/]+/(INTAKE_REVIEW\\.json|INTAKE_REVIEW\\.md|source_inventory\\.json|source_inventory\\.md|proposed_next_steps\\.md|AI_REVIEW\\.json|AI_REVIEW\\.md|INTAKE_SWITCHBOARD\\.json|INTAKE_SWITCHBOARD\\.md|INTENT_BINDINGS\\.md|processing_plan\\.md|proposed_page_update_plan\\.md|route_execution_log\\.json|route_execution_log\\.md)$`);
  if (intakeFilePattern.test(normalized)) {
    return;
  }
  throw new Error(`Blocked write outside switchboard-only intake paths: ${file}`);
}

function assertRepoFile(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

function assertInsideDrops(file) {
  const relative = normalizeRepo(file);
  if (!relative.startsWith(`${dropsRoot}/`)) {
    throw new Error(`Path is outside intake drops: ${file}`);
  }
}

function isSafeDropId(dropId) {
  return /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[a-z0-9]+$/i.test(dropId);
}

function normalizeRepo(file) {
  return path.relative(root, abs(file)).replaceAll("\\", "/");
}

function abs(file) {
  return path.resolve(root, file);
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function boundarySummary(derived = null) {
  const openAppraisalCreated = derived?.routeExecution?.status === "open_appraisal_review_created";
  return {
    status: openAppraisalCreated ? "open_appraisal_review_created" : "trace_and_route_state",
    accepted: false,
    reviewRequired: true,
    appVisiblePages: openAppraisalCreated,
    overlays: openAppraisalCreated,
    projectJsonChanges: openAppraisalCreated,
    environmentJsonChanges: false,
    layers: false,
    dataProcessing: false,
    rawPdfParsing: false,
    computedArtifacts: false,
    runtimeChanges: false,
    validationOrApproval: false
  };
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/Ã¢â‚¬â€/g, "-")
    .replace(/Ã¢â‚¬â€œ/g, "-")
    .replace(/Ã¢â€ â€™/g, "->")
    .replace(/Ã¢â€šÂÃ¢â€šâ‚¬/g, "10")
    .replace(/ÃŽÂ©/g, "Ohm")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
