import { useMemo, useRef, useState } from "react";
import type React from "react";
import { writeFilesBatch } from "./save";
import { TECHNICAL_MONO_FONT } from "./styles";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 75 * 1024 * 1024;
const UTAH_FORGE_PROJECT_ROOT = "projects/utah-forge";
const NEXT_CODEX_PROMPT = "read build directive";
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
  buildDirectivePath: string;
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
    const buildDirectivePath = `${folderPath}/BUILD_DIRECTIVE.md`;

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
      const buildDirective = createDropBuildDirective(dropId);
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
        {
          path: buildDirectivePath,
          content: buildDirective,
          encoding: "utf8",
        },
      ]);
      setLastDrop({
        dropId,
        folderPath,
        manifestPath,
        contextPath,
        buildDirectivePath,
      });
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
                  <li>BUILD_DIRECTIVE.md</li>
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

## Next safe Codex instruction

${NEXT_CODEX_PROMPT}
`;
}

function createDropBuildDirective(dropId: string): string {
  return `# Intake Drop Build Directive

## Drop ID

${dropId}

## Project

utah-forge

## Mode

source_inventory_plus_review_page

## Intelligence Layer Trigger

Manual test trigger:

\`\`\`text
read build directive
\`\`\`

For this test, the human manually sends this trigger to Codex. Codex acts as the temporary intelligence layer / API stand-in.

In a future implementation, this may be replaced by an API call or agent event.

## Input files

Refer to:

- intake_manifest.json
- intake_context.md
- raw/

## Codex task

Create source inventory outputs:

- source_inventory.json
- source_inventory.md
- proposed_next_steps.md

If the directive run explicitly proceeds in \`source_inventory_plus_review_page\` mode, Codex may also create a staged review surface:

- projects/utah-forge/pages/intake_${dropId}.json
- projects/utah-forge/overlays/intake_${dropId}/text.md
- project.json pageOrder update only to add intake_${dropId}

The review page is proposed / needs_review only. It does not accept, process, or promote the staged files.

## Instructions

- read intake_manifest.json
- read intake_context.md
- inspect raw/ filenames and lightweight metadata
- classify each file by likely family and format
- identify risks and missing context
- propose next processing steps
- do not process data
- do not move files
- do not create computed artifacts
- do not update environment.json or geosee_processed
- do not update project.json, pages, or overlays except for the explicitly allowed intake review page outputs above
- do not create layers from dropped files
- do not mark anything accepted

## Forbidden outputs

- no data processing
- no computed artifacts
- no layers from dropped files
- no geosee_processed writes
- no accepted interpretation

## Output status

All outputs must use:

- status: proposed
- accepted: false
- reviewRequired: true

## Next human decision

Human decides whether to process, ignore, ask for more context, or promote to a project data workflow.
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
