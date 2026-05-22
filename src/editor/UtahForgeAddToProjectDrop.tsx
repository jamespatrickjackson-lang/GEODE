import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { readFile, writeFilesBatch } from "./save";
import { TECHNICAL_MONO_FONT } from "./styles";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 75 * 1024 * 1024;
const UTAH_FORGE_PROJECT_ROOT = "projects/utah-forge";
const LATEST_INTAKE_REVIEW_PATH = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/LATEST_INTAKE_REVIEW.json`;
const LATEST_AI_REVIEW_PATH = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/LATEST_AI_REVIEW.json`;
const NEXT_CODEX_PROMPT = "Ask for an explicit intake review pass";
type IntakeEntrypoint = "editor-header" | "home-project-list";

interface Props {
  open: boolean;
  projectRoot: string;
  entrypoint?: IntakeEntrypoint;
  onClose: () => void;
}

interface StagedFileEntry {
  originalName: string;
  relativePath: string;
  storedPath: string;
  size: number;
  type: string;
  lastModified: number;
  status: "staged_unprocessed";
}

interface PreparedFile {
  file: File;
  entry: StagedFileEntry;
}

interface LastDrop {
  dropId: string;
  folderPath: string;
  manifestPath: string;
  contextPath: string;
}

type AiReviewStatus =
  | "questions_required"
  | "route_options_ready"
  | "plan_proposed"
  | "blocked_needs_trace"
  | string;
type ResponseMode = "answer" | "agree" | "disregard" | "refine";

interface AiReviewQuestion {
  id: string;
  kind: string;
  question: string;
  whyItMatters: string;
  sourcePath: string;
  responseModeHint?: string;
  requiredBefore?: string;
}

interface AiReviewPlan {
  summary?: string;
  steps?: string[];
  filesLikelyTouched?: string[];
  filesForbidden?: string[];
  verification?: string[];
  remainingUnresolveds?: string[];
  nextGate?: string;
}

interface AiReviewRouteCandidate {
  id?: string;
  routeId?: string;
  normalizedRouteId?: string;
  label?: string;
  input?: string;
  possibleRoute?: string;
  approvalNeeded?: string;
  blocker?: string;
  requiredQuestionIds?: string[];
}

interface AiReviewPayload {
  kind: string;
  dropId: string;
  project: string;
  status: AiReviewStatus;
  accepted: false;
  reviewRequired: true;
  sourceTracePaths?: string[];
  questions: AiReviewQuestion[];
  plan: AiReviewPlan | null;
  routeCandidates?: AiReviewRouteCandidate[];
  boundary?: Record<string, unknown>;
  nextUiAction?: string;
  nextSmokeCall?: string;
}

interface ResponseDraft {
  questionId: string;
  mode: ResponseMode;
  answer: string;
  selectedRouteId: string;
  stillBlocked: boolean;
  notes: string;
}

interface UserContextResponsePayload {
  schemaVersion: string;
  kind: "geosee.intake.context-confirmation";
  dropId: string;
  project: string;
  createdAt: string;
  responseSource: "ui";
  status: "context_confirmed";
  accepted: false;
  reviewRequired: true;
  answers: Array<{
    questionId: string;
    kind: string;
    question: string;
    answer: string;
    meaning: string;
    selectedOption: string;
    selectedRouteId: string;
    freeText: string;
    createdAt: string;
  }>;
  selectedRouteId?: string;
  notes?: string;
  nextCodexPrompt: string;
}

interface LatestAiReviewPointer {
  dropId?: string;
  intakeReviewPath?: string;
  aiReviewPath?: string;
  status?: string;
}

export function UtahForgeAddToProjectDrop({
  open,
  projectRoot,
  entrypoint = "editor-header",
  onClose,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [userContext, setUserContext] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastDrop, setLastDrop] = useState<LastDrop | null>(null);
  const [pendingDropId, setPendingDropId] = useState<string | null>(null);
  const [reviewDropId, setReviewDropId] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewSourcePath, setReviewSourcePath] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewPayload | null>(null);
  const [responseDrafts, setResponseDrafts] = useState<ResponseDraft[]>([]);
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );
  const limitError = validateFileLimits(files);
  const canStage =
    open &&
    !busy &&
    files.length > 0 &&
    limitError === null &&
    projectRoot === UTAH_FORGE_PROJECT_ROOT;
  const targetDropId = pendingDropId ?? "<dropId>";
  const targetFolderPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${targetDropId}`;
  const activeReviewDropId = reviewDropId.trim() || lastDrop?.dropId || "";
  const canLoadReview = !busy && !reviewBusy && isSafeDropId(activeReviewDropId);
  const canSaveResponses =
    !busy &&
    !reviewBusy &&
    aiReview !== null &&
    responseDrafts.length > 0 &&
    isSafeDropId(aiReview.dropId);

  useEffect(() => {
    if (!open || reviewDropId.trim() || lastDrop?.dropId) return;
    let cancelled = false;
    void readFile(LATEST_INTAKE_REVIEW_PATH)
      .then((content) => {
        if (cancelled || !content) return readFile(LATEST_AI_REVIEW_PATH);
        return content;
      })
      .then((content) => {
        if (cancelled || !content) return;
        const pointer = JSON.parse(content) as LatestAiReviewPointer;
        if (pointer.dropId && isSafeDropId(pointer.dropId)) {
          setReviewDropId(pointer.dropId);
          setResponseMessage(
            `Loaded latest reviewed drop pointer: ${pointer.dropId}`,
          );
        }
      })
      .catch(() => {
        // The pointer is optional. Missing/invalid pointer should leave the
        // intake staging flow unchanged.
      });
    return () => {
      cancelled = true;
    };
  }, [lastDrop?.dropId, open, reviewDropId]);

  if (!open) return null;

  const setSelectedFiles = (selected: File[]) => {
    setLastDrop(null);
    setMessage(null);
    setPendingDropId(selected.length > 0 ? createDropId(new Date()) : null);
    const validation = validateFileLimits(selected);
    if (validation) {
      setFiles(selected);
      setError(validation);
      return;
    }
    setFiles(selected);
    setError(null);
    setResponseMessage(null);
  };

  const closeAndReset = () => {
    if (busy) return;
    setFiles([]);
    setUserContext("");
    setDragActive(false);
    setMessage(null);
    setError(null);
    setLastDrop(null);
    setPendingDropId(null);
    setReviewDropId("");
    setAiReview(null);
    setReviewSourcePath(null);
    setResponseDrafts([]);
    setResponseMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const stageFiles = async () => {
    if (!canStage) {
      setError(limitError ?? "Select files before staging.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("Committing intake...");
    const createdAt = new Date();
    const dropId = pendingDropId ?? createDropId(createdAt);
    const folderPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${dropId}`;
    const manifestPath = `${folderPath}/intake_manifest.json`;
    const contextPath = `${folderPath}/intake_context.md`;

    try {
      const prepared = prepareFiles(files, folderPath);
      const rawWrites = await Promise.all(
        prepared.map(async ({ file, entry }) => ({
          path: entry.storedPath,
          content: arrayBufferToBase64(await file.arrayBuffer()),
          encoding: "base64" as const,
        })),
      );
      const manifest = {
        schemaVersion: "0.1.0",
        dropId,
        project: "utah-forge",
        createdAt: createdAt.toISOString(),
        createdBy: "dev-ui",
        entrypoint,
        status: "staged_unprocessed",
        processingStatus: "not_started",
        accepted: false,
        reviewRequired: true,
        files: prepared.map(({ entry }) => entry),
        userContext: {
          text: userContext.trim(),
          providedAt: createdAt.toISOString(),
        },
        nextCodexPrompt: NEXT_CODEX_PROMPT,
      };
      const contextNote = createContextNote(
        dropId,
        createdAt,
        userContext,
        prepared.map(({ entry }) => entry),
      );
      await writeFilesBatch([
        ...rawWrites,
        {
          path: manifestPath,
          content: `${JSON.stringify(manifest, null, 2)}\n`,
          encoding: "utf8",
        },
        {
          path: contextPath,
          content: contextNote,
          encoding: "utf8",
        },
      ]);
      setLastDrop({
        dropId,
        folderPath,
        manifestPath,
        contextPath,
      });
      setReviewDropId(dropId);
      setAiReview(null);
      setReviewSourcePath(null);
      setResponseDrafts([]);
      setResponseMessage(null);
      setMessage("Files staged. They are unprocessed and require review.");
      setFiles([]);
      setUserContext("");
      setPendingDropId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(
        `Staging failed. Partial files may exist under ${folderPath}. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      setMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const loadAiReview = async () => {
    const dropId = activeReviewDropId;
    if (!isSafeDropId(dropId)) {
      setError("Enter a safe drop ID before loading intake review.");
      return;
    }
    setReviewBusy(true);
    setError(null);
    setResponseMessage(null);
    try {
      const intakeReviewPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${dropId}/INTAKE_REVIEW.json`;
      const aiReviewPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${dropId}/AI_REVIEW.json`;
      const switchboardPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${dropId}/INTAKE_SWITCHBOARD.json`;
      const intakeReviewText = await readFile(intakeReviewPath);
      const aiReviewText = intakeReviewText ? null : await readFile(aiReviewPath);
      const sourcePath = intakeReviewText ? intakeReviewPath : aiReviewText ? aiReviewPath : switchboardPath;
      const reviewText = intakeReviewText ?? aiReviewText ?? (await readFile(switchboardPath));
      if (!reviewText) {
        setAiReview(null);
        setReviewSourcePath(null);
        setResponseDrafts([]);
        setResponseMessage("No review file was found for this drop. Ask for an explicit intake review pass first.");
        return;
      }
      const parsed = JSON.parse(reviewText) as unknown;
      const normalized = normalizeAiReview(parsed, dropId);
      setAiReview(normalized);
      setReviewSourcePath(sourcePath);
      setResponseDrafts(
        normalized.questions.map((question) => ({
          questionId: question.id,
          mode: "answer",
          answer: "",
          selectedRouteId: "",
          stillBlocked: true,
          notes: "",
        })),
      );
      setResponseMessage(
        intakeReviewText
          ? "Loaded INTAKE_REVIEW.json."
          : aiReviewText
          ? "Loaded AI_REVIEW.json."
          : "Loaded legacy INTAKE_SWITCHBOARD.json fallback.",
      );
    } catch (err) {
      setAiReview(null);
      setReviewSourcePath(null);
      setResponseDrafts([]);
      setError(
        `Failed to load intake review. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const loadLatestReviewedDrop = async () => {
    setReviewBusy(true);
    setError(null);
    setResponseMessage(null);
    try {
      const content = (await readFile(LATEST_INTAKE_REVIEW_PATH)) ?? (await readFile(LATEST_AI_REVIEW_PATH));
      if (!content) {
        setResponseMessage("No latest intake review pointer found. Ask for an explicit intake review pass first.");
        return;
      }
      const pointer = JSON.parse(content) as LatestAiReviewPointer;
      if (!pointer.dropId || !isSafeDropId(pointer.dropId)) {
        setError("Latest intake review pointer does not contain a safe drop ID.");
        return;
      }
      setReviewDropId(pointer.dropId);
      setResponseMessage(`Filled latest reviewed drop: ${pointer.dropId}`);
    } catch (err) {
      setError(
        `Failed to load latest reviewed drop pointer. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const updateResponseDraft = (
    questionId: string,
    patch: Partial<ResponseDraft>,
  ) => {
    setResponseDrafts((drafts) =>
      drafts.map((draft) =>
        draft.questionId === questionId ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const saveUserContextResponse = async () => {
    if (!canSaveResponses || !aiReview || !reviewSourcePath) return;
    setReviewBusy(true);
    setError(null);
    setResponseMessage(null);
    const createdAt = new Date().toISOString();
    const responseJsonPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${aiReview.dropId}/USER_CONTEXT_RESPONSE.json`;
    const responseMdPath = `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${aiReview.dropId}/USER_CONTEXT_RESPONSE.md`;
    const payload = createUserContextResponse(
      aiReview,
      responseDrafts,
      createdAt,
    );
    try {
      await writeFilesBatch([
        {
          path: responseJsonPath,
          content: `${JSON.stringify(payload, null, 2)}\n`,
          encoding: "utf8",
        },
        {
          path: responseMdPath,
          content: createUserContextResponseMarkdown(
            payload,
            aiReview,
          ),
          encoding: "utf8",
        },
      ]);
      setResponseMessage(
        `Context response saved: ${responseJsonPath}. Next: ${NEXT_CODEX_PROMPT}. No processing has occurred.`,
      );
    } catch (err) {
      setError(
        `Failed to save user response trace. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div style={backdropStyle} role="presentation">
      <section
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="utah-forge-intake-title"
      >
        <div style={headerStyle}>
          <div>
            <h2 id="utah-forge-intake-title" style={titleStyle}>
              Add files to Utah FORGE intake
            </h2>
            <div style={badgeStyle}>Local dev intake only</div>
          </div>
          <button
            type="button"
            style={iconButtonStyle}
            onClick={closeAndReset}
            disabled={busy}
            aria-label="Close Add to Project"
            title="Close"
          >
            x
          </button>
        </div>

        <div
          style={{
            ...dropZoneStyle,
            borderColor: dragActive
              ? "rgba(107, 197, 255, 0.76)"
              : dropZoneStyle.borderColor,
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
            setSelectedFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div style={dropTitleStyle}>Drop small files here</div>
          <div style={helperStyle}>
            Files are staged only. Nothing is processed, accepted, interpreted,
            or added to project layers.
          </div>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(event) =>
              setSelectedFiles(Array.from(event.currentTarget.files ?? []))
            }
          />
        </div>

        <label style={fieldStyle}>
          <span style={labelStyle}>Context / notes for Codex</span>
          <textarea
            value={userContext}
            onChange={(event) => setUserContext(event.currentTarget.value)}
            placeholder="Example: These files came from a client email and may include well markers plus notes. Please inventory first."
            style={textareaStyle}
            disabled={busy}
          />
        </label>

        <div style={limitsStyle}>
          Limits: {MAX_FILES} files, {formatBytes(MAX_FILE_SIZE)} per file,{" "}
          {formatBytes(MAX_TOTAL_SIZE)} total.
        </div>

        {files.length > 0 && (
          <div style={preflightStyle}>
            <div style={fileListHeaderStyle}>
              Preflight review: {files.length} file
              {files.length === 1 ? "" : "s"} / {formatBytes(totalSize)}
            </div>
            <div style={codeLabelStyle}>Target path</div>
            <code style={codeStyle}>{targetFolderPath}/</code>
            <div style={fileListStyle}>
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  style={fileRowStyle}
                >
                  <span style={fileNameStyle}>{fileRelativePath(file)}</span>
                  <span style={fileMetaStyle}>{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
            <div style={preflightGridStyle}>
              <div>
                <div style={codeLabelStyle}>Commit Intake will write</div>
                <ul style={compactListStyle}>
                  <li>raw/</li>
                  <li>intake_manifest.json</li>
                  <li>intake_context.md</li>
                  <li>INTAKE_REVIEW after appraisal</li>
                  <li>USER_CONTEXT_RESPONSE only if questions are present</li>
                </ul>
              </div>
              <div>
                <div style={codeLabelStyle}>Commit Intake will not</div>
                <ul style={compactListStyle}>
                  <li>process files</li>
                  <li>update project layers or config</li>
                  <li>create computed artifacts</li>
                  <li>mark anything accepted</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {(error || limitError) && (
          <div style={errorStyle} role="alert">
            {error ?? limitError}
          </div>
        )}
        {message && !error && <div style={messageStyle}>{message}</div>}
        {lastDrop && (
          <div style={successStyle}>
            <div>Created drop folder:</div>
            <code style={codeStyle}>{lastDrop.folderPath}</code>
            <div style={{ marginTop: 8 }}>Next Codex command:</div>
            <div style={smallTextStyle}>{NEXT_CODEX_PROMPT}</div>
          </div>
        )}

        <section style={reviewPanelStyle} aria-label="Intake review">
          <div style={fileListHeaderStyle}>Intake Review</div>
          <div style={helperStyle}>
            Load the intake review after an explicit review pass. The review shows the actual
            dropped input, the concise plan, and questions only when something
            blocks the next step.
          </div>
          <div style={reviewLoadRowStyle}>
            <label style={{ ...fieldStyle, marginTop: 0, flex: 1 }}>
              <span style={labelStyle}>Drop ID</span>
              <input
                value={reviewDropId}
                onChange={(event) => {
                  setReviewDropId(event.currentTarget.value);
                  setResponseMessage(null);
                }}
                placeholder={lastDrop?.dropId ?? "2026-05-18_01-03-27_128bzd"}
                style={inputStyle}
                disabled={busy || reviewBusy}
              />
            </label>
            <button
              type="button"
              style={{
                ...secondaryButtonStyle,
                alignSelf: "end",
                opacity: reviewBusy ? 0.58 : 1,
              }}
              onClick={() => void loadLatestReviewedDrop()}
              disabled={busy || reviewBusy}
              title="Fill the latest AI-reviewed intake drop ID"
            >
              Use Latest
            </button>
            <button
              type="button"
              style={{
                ...secondaryButtonStyle,
                alignSelf: "end",
                opacity: canLoadReview ? 1 : 0.58,
                cursor: canLoadReview ? "pointer" : "not-allowed",
              }}
              onClick={() => void loadAiReview()}
              disabled={!canLoadReview}
            >
              {reviewBusy ? "Loading..." : "Load Intake Review"}
            </button>
          </div>
          {reviewSourcePath && (
            <>
              <div style={codeLabelStyle}>Review source</div>
              <code style={codeStyle}>{reviewSourcePath}</code>
            </>
          )}
          {aiReview && (
            <div style={reviewContentStyle}>
              <div style={reviewStatusRowStyle}>
                <span style={badgeStyle}>{aiReview.status}</span>
                <span>{aiReview.questions.length} question(s)</span>
              </div>
              {aiReview.questions.length > 0 ? (
                <div style={questionListStyle}>
                  {aiReview.questions.map((question) => {
                    const draft = responseDrafts.find(
                      (candidate) => candidate.questionId === question.id,
                    );
                    const routeOptions = routeOptionsForQuestion(
                      aiReview,
                      question,
                    );
                    return (
                      <article key={question.id} style={questionCardStyle}>
                        <div style={questionMetaStyle}>
                          <strong>{question.id}</strong>
                          <span>{question.kind}</span>
                        </div>
                        <div style={questionTextStyle}>{question.question}</div>
                        <div style={questionWhyStyle}>
                          {question.whyItMatters}
                        </div>
                        <div style={codeLabelStyle}>Source</div>
                        <code style={inlineCodeStyle}>{question.sourcePath}</code>
                        {draft && (
                          <div style={answerGridStyle}>
                            <label style={fieldStyle}>
                              <span style={labelStyle}>Confirmation option</span>
                              <select
                                value={draft.mode}
                                onChange={(event) =>
                                  updateResponseDraft(question.id, {
                                    mode: event.currentTarget
                                      .value as ResponseMode,
                                    selectedRouteId:
                                      event.currentTarget.value === "agree" &&
                                      !draft.selectedRouteId &&
                                      routeOptions.length === 1
                                        ? routeOptions[0].routeId
                                        : draft.selectedRouteId,
                                  })
                                }
                                style={inputStyle}
                                disabled={reviewBusy}
                              >
                                <option value="answer">answer</option>
                                <option value="agree">agree routeable</option>
                                <option value="disregard">disregard / park</option>
                                <option value="refine">refine</option>
                              </select>
                            </label>
                            <label style={fieldStyle}>
                              <span style={labelStyle}>Selected route</span>
                              {routeOptions.length > 0 ? (
                                <select
                                  value={draft.selectedRouteId}
                                  onChange={(event) =>
                                    updateResponseDraft(question.id, {
                                      selectedRouteId:
                                        event.currentTarget.value,
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={reviewBusy}
                                >
                                  <option value="">select route token</option>
                                  {routeOptions.map((option) => (
                                    <option
                                      key={`${question.id}-${option.routeId}`}
                                      value={option.routeId}
                                    >
                                      {option.routeId}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={draft.selectedRouteId}
                                  onChange={(event) =>
                                    updateResponseDraft(question.id, {
                                      selectedRouteId:
                                        event.currentTarget.value,
                                    })
                                  }
                                  placeholder="optional route id"
                                  style={inputStyle}
                                  disabled={reviewBusy}
                                />
                              )}
                            </label>
                            {routeOptions.length > 0 && (
                              <div
                                style={{
                                  ...questionWhyStyle,
                                  gridColumn: "1 / -1",
                                }}
                              >
                                Route options:{" "}
                                {routeOptions
                                  .map(
                                    (option) =>
                                      `${option.routeId} (${option.label})`,
                                  )
                                  .join("; ")}
                              </div>
                            )}
                            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                              <span style={labelStyle}>Context confirmation</span>
                              <textarea
                                value={draft.answer}
                                onChange={(event) =>
                                  updateResponseDraft(question.id, {
                                    answer: event.currentTarget.value,
                                  })
                                }
                                placeholder="Confirm context, answer the question, or explain the route choice."
                                style={{ ...textareaStyle, minHeight: 70 }}
                                disabled={reviewBusy}
                              />
                            </label>
                            <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                              <span style={labelStyle}>Notes</span>
                              <input
                                value={draft.notes}
                                onChange={(event) =>
                                  updateResponseDraft(question.id, {
                                    notes: event.currentTarget.value,
                                  })
                                }
                                placeholder="optional trace note"
                                style={inputStyle}
                                disabled={reviewBusy}
                              />
                            </label>
                            <label style={checkboxLabelStyle}>
                              <input
                                type="checkbox"
                                checked={draft.stillBlocked}
                                onChange={(event) =>
                                  updateResponseDraft(question.id, {
                                    stillBlocked:
                                      event.currentTarget.checked,
                                  })
                                }
                                disabled={reviewBusy}
                              />
                              still blocked
                            </label>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div style={messageStyle}>
                  No blocking questions were returned. Review the page/plan
                  and choose the next human action outside this first pass.
                </div>
              )}
              {aiReview.plan && (
                <div style={planBoxStyle}>
                  <div style={fileListHeaderStyle}>Proposed Plan</div>
                  <div style={helperStyle}>{aiReview.plan.summary}</div>
                  <ul style={compactListStyle}>
                    {(aiReview.plan.steps ?? []).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiReview.questions.length > 0 && (
              <div style={reviewActionsStyle}>
                <button
                  type="button"
                  style={{
                    ...primaryButtonStyle,
                    opacity: canSaveResponses ? 1 : 0.58,
                    cursor: canSaveResponses ? "pointer" : "not-allowed",
                  }}
                  onClick={() => void saveUserContextResponse()}
                  disabled={!canSaveResponses}
                >
                  {reviewBusy ? "Saving..." : "Save Context Response"}
                </button>
              </div>
              )}
            </div>
          )}
          {responseMessage && <div style={messageStyle}>{responseMessage}</div>}
        </section>

        <div style={actionsStyle}>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={closeAndReset}
            disabled={busy}
          >
            Exit
          </button>
          <button
            type="button"
            style={{
              ...primaryButtonStyle,
              opacity: canStage ? 1 : 0.58,
              cursor: canStage ? "pointer" : "not-allowed",
            }}
            onClick={() => void stageFiles()}
            disabled={!canStage}
          >
            {busy ? "Committing..." : "Commit Intake"}
          </button>
        </div>
      </section>
    </div>
  );
}

function normalizeAiReview(value: unknown, fallbackDropId: string): AiReviewPayload {
  const raw = isRecord(value) ? value : {};
  const rawQuestions = Array.isArray(raw.questions)
    ? raw.questions
    : Array.isArray(raw.unresolvedFirst)
      ? raw.unresolvedFirst
      : [];
  const questions: AiReviewQuestion[] = rawQuestions
    .filter(isRecord)
    .map((question, index) => ({
      id: stringValue(question.id) || `Q-${String(index + 1).padStart(3, "0")}`,
      kind: stringValue(question.kind) || "unresolved",
      question:
        stringValue(question.question) ||
        stringValue(question.humanQuestion) ||
        "Review this unresolved item.",
      whyItMatters: stringValue(question.whyItMatters),
      sourcePath:
        stringValue(question.sourcePath) ||
        stringValue(question.source) ||
        "unknown",
      responseModeHint: stringValue(question.responseModeHint),
      requiredBefore: stringValue(question.requiredBefore),
    }));
  return {
    kind:
      stringValue(raw.kind) === "geosee.intake.ai-review"
        ? "geosee.intake.ai-review"
        : "geosee.intake.ai-review",
    dropId: stringValue(raw.dropId) || fallbackDropId,
    project: stringValue(raw.project) || "utah-forge",
    status:
      stringValue(raw.status) ||
      (questions.length > 0 ? "questions_required" : "plan_proposed"),
    accepted: false,
    reviewRequired: true,
    sourceTracePaths: Array.isArray(raw.sourceTracePaths)
      ? raw.sourceTracePaths.map(String)
      : [],
    questions,
    plan: Array.isArray(raw.plan)
      ? {
          summary: stringValue(raw.summary),
          steps: raw.plan.map(String),
        }
      : isRecord(raw.plan) ? (raw.plan as AiReviewPlan) : null,
    routeCandidates: Array.isArray(raw.routeCandidates)
      ? normalizeRouteCandidates(raw.routeCandidates)
      : Array.isArray(raw.routes)
        ? normalizeRouteCandidates(raw.routes)
        : [],
    boundary: isRecord(raw.boundary) ? raw.boundary : {},
    nextUiAction: stringValue(raw.nextUiAction),
    nextSmokeCall: stringValue(raw.nextSmokeCall) || NEXT_CODEX_PROMPT,
  };
}

function createUserContextResponse(
  aiReview: AiReviewPayload,
  drafts: ResponseDraft[],
  createdAt: string,
): UserContextResponsePayload {
  const questionById = new Map(
    aiReview.questions.map((question) => [question.id, question]),
  );
  return {
    schemaVersion: "0.1.0",
    kind: "geosee.intake.context-confirmation",
    dropId: aiReview.dropId,
    project: aiReview.project,
    createdAt,
    responseSource: "ui",
    status: "context_confirmed",
    accepted: false,
    reviewRequired: true,
    answers: drafts.map((draft) => {
      const question = questionById.get(draft.questionId);
      const boundRouteId = question
        ? selectedRouteIdForDraft(aiReview, question, draft)
        : draft.selectedRouteId.trim();
      return {
        questionId: draft.questionId,
        kind: question?.kind ?? "",
        question: question?.question ?? "",
        answer: draft.answer || draft.mode,
        meaning: meaningForResponseMode(draft.mode),
        selectedOption: boundRouteId || draft.mode,
        selectedRouteId: boundRouteId,
        freeText: draft.notes,
        createdAt,
      };
    }),
    selectedRouteId: firstSelectedRouteId(aiReview, drafts),
    notes: "",
    nextCodexPrompt: NEXT_CODEX_PROMPT,
  };
}

function createUserContextResponseMarkdown(
  payload: UserContextResponsePayload,
  aiReview: AiReviewPayload,
): string {
  const questionById = new Map(
    aiReview.questions.map((question) => [question.id, question]),
  );
  const rows = payload.answers
    .map((answer) => {
      const question = questionById.get(answer.questionId);
      return `| ${escapeMarkdown(answer.questionId)} | ${escapeMarkdown(
        question?.question ?? answer.question,
      )} | ${escapeMarkdown(answer.answer)} | ${escapeMarkdown(
        answer.selectedOption,
      )} | ${escapeMarkdown(
        answer.selectedRouteId,
      )} | ${escapeMarkdown(answer.freeText)} |`;
    })
    .join("\n");
  return `# Context Confirmation: ${payload.dropId}

Status: context_confirmed

- createdAt: ${payload.createdAt}
- responseSource: ui
- selectedRouteId: ${payload.selectedRouteId || "none"}
- accepted: false
- reviewRequired: true
- next command: ${payload.nextCodexPrompt}

This confirms route/context for the next deterministic gate. It is not acceptance, validation, certification, final interpretation, project mutation, route execution, or runner authorization.

| question id | question | answer | selected option | selected route | free text |
| --- | --- | --- | --- | --- | --- |
${rows || "| none | none | none | none | none | no context confirmations recorded |"}

## Boundary

No processing has occurred. No PDF review, page, overlay, project config, environment config, layer, data, computed artifact, or accepted state was created by this response.

## Rule

Freeform answers remain context unless a later gate binds them to a requirements/spec/risk-bounded route.
`;
}

function firstSelectedRouteId(
  aiReview: AiReviewPayload,
  drafts: ResponseDraft[],
): string | undefined {
  for (const draft of drafts) {
    const question = aiReview.questions.find(
      (candidate) => candidate.id === draft.questionId,
    );
    const routeId = question
      ? selectedRouteIdForDraft(aiReview, question, draft)
      : draft.selectedRouteId.trim();
    if (routeId) return routeId;
  }
  return undefined;
}

function selectedRouteIdForDraft(
  aiReview: AiReviewPayload,
  question: AiReviewQuestion,
  draft: ResponseDraft,
): string {
  const explicitRouteId = draft.selectedRouteId.trim();
  if (explicitRouteId) return explicitRouteId;
  const options = routeOptionsForQuestion(aiReview, question);
  const affirmativePdfRoute = options.find(
    (option) => option.routeId === "generate_pdf_review",
  );
  if (
    affirmativePdfRoute &&
    question.kind === "missing_review_source" &&
    (draft.mode === "agree" || /^\s*y(es)?\b/i.test(draft.answer))
  ) {
    return affirmativePdfRoute.routeId;
  }
  if (options.length !== 1) return "";
  if (draft.mode === "agree") return options[0].routeId;
  if (/^\s*y(es)?\b/i.test(draft.answer)) return options[0].routeId;
  return "";
}

function routeOptionsForQuestion(
  aiReview: AiReviewPayload,
  question: AiReviewQuestion,
): Array<{ routeId: string; label: string }> {
  const candidates = aiReview.routeCandidates ?? [];
  const matches = candidates
    .filter((candidate) => routeCandidateMatchesQuestion(candidate, question))
    .map((candidate) => ({
      routeId: routeIdForCandidate(candidate),
      label:
        candidate.label ||
        candidate.possibleRoute ||
        candidate.input ||
        candidate.approvalNeeded ||
        "route",
    }))
    .filter((candidate) => candidate.routeId);
  const seen = new Set<string>();
  return matches.filter((candidate) => {
    if (seen.has(candidate.routeId)) return false;
    seen.add(candidate.routeId);
    return true;
  });
}

function routeCandidateMatchesQuestion(
  candidate: AiReviewRouteCandidate,
  question: AiReviewQuestion,
): boolean {
  if (candidate.requiredQuestionIds?.includes(question.id)) return true;
  const routeId = routeIdForCandidate(candidate);
  const haystack = [
    candidate.id,
    routeId,
    candidate.label,
    candidate.input,
    candidate.possibleRoute,
    candidate.approvalNeeded,
    candidate.blocker,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (question.kind === "missing_review_source") {
    return (
      routeId === "generate_pdf_review" ||
      haystack.includes("pdf_review") ||
      haystack.includes("pdf review")
    );
  }
  if (question.kind === "duplicate_or_supersession") {
    return routeId === "hold_unresolveds" || haystack.includes("hold");
  }
  return false;
}

function normalizeRouteCandidates(value: unknown[]): AiReviewRouteCandidate[] {
  return value.filter(isRecord).map((candidate) => ({
    id: stringValue(candidate.id),
    routeId: stringValue(candidate.routeId),
    normalizedRouteId: stringValue(candidate.normalizedRouteId),
    label: stringValue(candidate.label),
    input: stringValue(candidate.input),
    possibleRoute: stringValue(candidate.possibleRoute),
    approvalNeeded: stringValue(candidate.approvalNeeded),
    blocker: stringValue(candidate.blocker),
    requiredQuestionIds: Array.isArray(candidate.requiredQuestionIds)
      ? candidate.requiredQuestionIds.map(String)
      : [],
  }));
}

function routeIdForCandidate(candidate: AiReviewRouteCandidate): string {
  return (
    candidate.normalizedRouteId ||
    candidate.routeId ||
    normalizeLegacyRouteId(candidate.id || "")
  );
}

function normalizeLegacyRouteId(routeId: string): string {
  if (routeId === "ROUTE-001") return "hold_unresolveds";
  if (routeId === "ROUTE-002") return "generate_pdf_review";
  return routeId;
}

function meaningForResponseMode(mode: ResponseMode): string {
  if (mode === "agree") {
    return "Human indicates the route/context may be considered routeable by a later gate.";
  }
  if (mode === "disregard") {
    return "Human indicates the item should be parked or disregarded by a later gate.";
  }
  if (mode === "refine") {
    return "Human indicates the model should revise the route/context before execution.";
  }
  return "Human supplied context for a later deterministic route check.";
}

function isSafeDropId(dropId: string): boolean {
  return /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_[a-z0-9]+$/i.test(dropId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validateFileLimits(files: File[]): string | null {
  if (files.length > MAX_FILES) {
    return `Too many files. Test 1 allows ${MAX_FILES} files maximum.`;
  }
  const tooLarge = files.find((file) => file.size > MAX_FILE_SIZE);
  if (tooLarge) {
    return `${tooLarge.name} is too large. Test 1 allows ${formatBytes(
      MAX_FILE_SIZE,
    )} per file.`;
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_SIZE) {
    return `Drop is too large. Test 1 allows ${formatBytes(
      MAX_TOTAL_SIZE,
    )} total.`;
  }
  return null;
}

function prepareFiles(files: File[], folderPath: string): PreparedFile[] {
  const used = new Set<string>();
  return files.map((file) => {
    const relativePath = fileRelativePath(file);
    const sanitized = sanitizeRelativePath(relativePath);
    const storedRelativePath = uniqueRelativePath(sanitized, used);
    const storedPath = `${folderPath}/raw/${storedRelativePath}`;
    return {
      file,
      entry: {
        originalName: file.name,
        relativePath,
        storedPath,
        size: file.size,
        type: file.type || "application/octet-stream",
        lastModified: file.lastModified,
        status: "staged_unprocessed",
      },
    };
  });
}

function fileRelativePath(file: File): string {
  const withPath = file as File & { webkitRelativePath?: string };
  return withPath.webkitRelativePath || file.name;
}

function sanitizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(`Unsafe file path blocked: ${relativePath}`);
  }
  const segments = normalized
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .map(sanitizeSegment);
  if (segments.length === 0) throw new Error("File path is empty.");
  return segments.join("/");
}

function sanitizeSegment(segment: string): string {
  const sanitized = segment
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+$/, "_");
  return sanitized || "file";
}

function uniqueRelativePath(relativePath: string, used: Set<string>): string {
  if (!used.has(relativePath)) {
    used.add(relativePath);
    return relativePath;
  }
  const parts = relativePath.split("/");
  const name = parts.pop() ?? "file";
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  let candidate = "";
  do {
    candidate = [...parts, `${stem}_${index}${ext}`].join("/");
    index += 1;
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

function createDropId(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const random = randomId();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(
    date.getSeconds(),
  )}_${random}`;
}

function randomId(): string {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0].toString(36).slice(0, 6).padStart(6, "0");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function createContextNote(
  dropId: string,
  createdAt: Date,
  userContext: string,
  files: StagedFileEntry[],
): string {
  const rows = files
    .map(
      (file) =>
        `| ${escapeMarkdown(file.originalName)} | ${escapeMarkdown(
          file.storedPath.replace(
            `${UTAH_FORGE_PROJECT_ROOT}/intake_staging/drops/${dropId}/`,
            "",
          ),
        )} | ${file.size} | ${escapeMarkdown(file.type)} | ${
          file.lastModified
            ? new Date(file.lastModified).toISOString()
            : "unknown"
        } |`,
    )
    .join("\n");
  return `# Intake Drop: ${dropId}

## Created

${createdAt.toISOString()}

## Project

utah-forge

## User Context

${userContext.trim() || "_No user context provided._"}

## Files

| Original name | Stored path | Size | Type | Last modified |
| --- | --- | ---: | --- | --- |
${rows}

## Boundary

These files are staged only. They are not processed, accepted, interpreted, or added to project layers.

- They have not been moved into \`data/client_preprocessed/\`.
- They have not been moved into \`data/geosee_processed/\`.
- They have not created computed artifacts.
- They have not changed \`project.json\`, \`environment.json\`, pages, overlays, loaders, render settings, seismic products, MT products, scalar ranges, or color ramps.

## Suggested smoke/API call

${NEXT_CODEX_PROMPT}

This is a suggested smoke/API call recorded for trace. It is not a repo-local directive, authority file, or blocker.
`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 90,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "rgba(10, 12, 14, 0.42)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const modalStyle: React.CSSProperties = {
  width: "min(680px, calc(100vw - 48px))",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  boxSizing: "border-box",
  padding: 18,
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 12,
  background: "rgba(22, 25, 28, 0.88)",
  color: "rgba(244, 240, 232, 0.94)",
  boxShadow: "0 28px 88px rgba(0, 0, 0, 0.38)",
  fontFamily: TECHNICAL_MONO_FONT,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.2,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: 8,
  padding: "5px 8px",
  borderRadius: 6,
  background: "rgba(107, 197, 255, 0.12)",
  color: "rgba(202, 232, 255, 0.94)",
  fontSize: 11,
  fontWeight: 700,
};

const iconButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.06)",
  color: "rgba(244, 240, 232, 0.9)",
  cursor: "pointer",
  fontFamily: TECHNICAL_MONO_FONT,
};

const dropZoneStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
  justifyItems: "center",
  padding: 22,
  border: "1px dashed rgba(255, 255, 255, 0.34)",
  borderRadius: 10,
  background: "rgba(255, 255, 255, 0.045)",
  textAlign: "center",
};

const dropTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
};

const helperStyle: React.CSSProperties = {
  maxWidth: 480,
  color: "rgba(244, 240, 232, 0.72)",
  fontSize: 12,
  lineHeight: 1.45,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  marginTop: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
};

const textareaStyle: React.CSSProperties = {
  minHeight: 88,
  resize: "vertical",
  padding: 10,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.18)",
  color: "rgba(244, 240, 232, 0.94)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  lineHeight: 1.4,
};

const inputStyle: React.CSSProperties = {
  minHeight: 32,
  boxSizing: "border-box",
  padding: "7px 9px",
  border: "1px solid rgba(255, 255, 255, 0.22)",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.18)",
  color: "rgba(244, 240, 232, 0.94)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
};

const limitsStyle: React.CSSProperties = {
  marginTop: 10,
  color: "rgba(244, 240, 232, 0.64)",
  fontSize: 11,
  lineHeight: 1.35,
};

const preflightStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 10,
  background: "rgba(255, 255, 255, 0.045)",
};

const fileListStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.055)",
};

const fileListHeaderStyle: React.CSSProperties = {
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 800,
};

const fileRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  padding: "5px 0",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  fontSize: 11,
};

const fileNameStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const fileMetaStyle: React.CSSProperties = {
  color: "rgba(244, 240, 232, 0.66)",
};

const preflightGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 12,
};

const codeLabelStyle: React.CSSProperties = {
  marginTop: 8,
  color: "rgba(244, 240, 232, 0.7)",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
};

const compactListStyle: React.CSSProperties = {
  margin: "7px 0 0",
  paddingLeft: 18,
  color: "rgba(244, 240, 232, 0.72)",
  fontSize: 11,
  lineHeight: 1.45,
};

const reviewPanelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  border: "1px solid rgba(107, 197, 255, 0.22)",
  borderRadius: 10,
  background: "rgba(107, 197, 255, 0.055)",
};

const reviewLoadRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
  marginTop: 10,
};

const reviewContentStyle: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 12,
};

const reviewStatusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  color: "rgba(244, 240, 232, 0.72)",
  fontSize: 11,
};

const questionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const questionCardStyle: React.CSSProperties = {
  padding: 11,
  border: "1px solid rgba(255, 255, 255, 0.16)",
  borderRadius: 9,
  background: "rgba(0, 0, 0, 0.12)",
};

const questionMetaStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "rgba(202, 232, 255, 0.9)",
  fontSize: 11,
};

const questionTextStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.45,
  color: "rgba(244, 240, 232, 0.94)",
};

const questionWhyStyle: React.CSSProperties = {
  marginTop: 7,
  color: "rgba(244, 240, 232, 0.68)",
  fontSize: 11,
  lineHeight: 1.45,
};

const inlineCodeStyle: React.CSSProperties = {
  display: "block",
  marginTop: 5,
  color: "rgba(244, 240, 232, 0.74)",
  fontSize: 10,
  overflowWrap: "anywhere",
};

const answerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 9,
  marginTop: 10,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 7,
  alignItems: "center",
  color: "rgba(244, 240, 232, 0.74)",
  fontSize: 11,
};

const planBoxStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid rgba(113, 214, 154, 0.2)",
  borderRadius: 8,
  background: "rgba(113, 214, 154, 0.075)",
};

const reviewActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  border: "1px solid rgba(255, 112, 128, 0.38)",
  borderRadius: 8,
  background: "rgba(255, 112, 128, 0.1)",
  color: "rgba(255, 204, 210, 0.98)",
  fontSize: 12,
  lineHeight: 1.4,
};

const messageStyle: React.CSSProperties = {
  marginTop: 12,
  color: "rgba(202, 232, 255, 0.94)",
  fontSize: 12,
};

const successStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  borderRadius: 8,
  background: "rgba(113, 214, 154, 0.1)",
  color: "rgba(219, 255, 232, 0.94)",
  fontSize: 12,
  lineHeight: 1.45,
};

const codeStyle: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  padding: 7,
  borderRadius: 6,
  background: "rgba(0, 0, 0, 0.2)",
  color: "rgba(244, 240, 232, 0.92)",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
};

const smallTextStyle: React.CSSProperties = {
  color: "rgba(219, 255, 232, 0.84)",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 32,
  padding: "7px 12px",
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 7,
  background: "rgba(255, 255, 255, 0.06)",
  color: "rgba(244, 240, 232, 0.94)",
  cursor: "pointer",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  borderColor: "rgba(107, 197, 255, 0.46)",
  background: "rgba(107, 197, 255, 0.2)",
  color: "rgba(226, 244, 255, 0.98)",
};
