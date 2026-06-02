import { useRef } from "react";
import { useEditor } from "./EditorContext";
import {
  EDITOR_PILL_TEXT_INSET_PX,
  FROSTED_HAIRLINE,
  frostedSubheading,
  panelStyles,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "./styles";
import { overlayImagePath, writeFile } from "./save";
import type { EasingName, TextOverlayContainer } from "../pages/types";

interface OverlayImage {
  file: string;
  caption?: string;
  position?: string;
}

const OVERLAY_EASINGS: EasingName[] = [
  "linear",
  "easeInOutCubic",
  "easeOutCubic",
  "easeOutQuart",
  "easeInOutSine",
];

export function OverlayPanel() {
  const {
    state,
    setOverlayText,
    addOverlayImage,
    removeOverlayImage,
    setPageField,
    setPageOverlayTiming,
    setPageOverlayHidden,
  } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pageId = state.selectedPageId;
  const page = state.pages.find((p) => p.id === pageId);

  if (!pageId || !page) {
    return (
      <div style={panelStyles.body}>
        <div style={panelStyles.muted}>Select a page to edit its overlay.</div>
      </div>
    );
  }

  const overlayText = state.overlays[pageId] ?? "";
  const overlay = (page.overlay ?? {}) as TextOverlayContainer & {
    images?: OverlayImage[];
  };
  const images = overlay.images ?? [];
  const timing = overlay.timing ?? {};
  const fadeMs = timing.fadeMs ?? 2000;
  const gapMs = timing.gapMs ?? 50;
  const easing = timing.easing ?? "linear";
  const overlayHidden = overlay.hidden === true;

  // Splice a markdown image reference at the textarea's current cursor
  // position. If the textarea isn't focused (no cursor available), fall
  // back to appending on a new line at the end. After the insert, focus
  // the textarea and place the cursor right after the inserted snippet
  // so the user can keep typing context around it.
  const insertImageRef = (filename: string) => {
    const ref = `![](${filename})`;
    const ta = textareaRef.current;
    const current = state.overlays[pageId] ?? "";
    let next: string;
    let cursor: number;
    if (
      ta &&
      typeof ta.selectionStart === "number" &&
      typeof ta.selectionEnd === "number"
    ) {
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      next = current.slice(0, s) + ref + current.slice(e);
      cursor = s + ref.length;
    } else {
      const sep = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
      next = current + sep + ref;
      cursor = next.length;
    }
    setOverlayText(pageId, next);
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (t) {
        t.focus();
        t.setSelectionRange(cursor, cursor);
      }
    });
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      // Read as base64 and write through /api/write-file. The plugin
      // decodes base64 on the server side.
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      try {
        await writeFile(
          overlayImagePath(pageId, file.name, state.projectRoot),
          base64,
          {
            encoding: "base64",
          },
        );
        addOverlayImage(pageId, file.name);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("image upload failed:", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div style={panelStyles.body}>
      <div style={{ marginBottom: 16 }}>
        <div style={overlaySubheadingStyle}>
          <span style={overlaySubheadingTitleStyle}>Page Text</span>
          <button
            type="button"
            onClick={() => setPageOverlayHidden(pageId, !overlayHidden)}
            title={
              overlayHidden
                ? "Overlay box is hidden on this page — click to show"
                : "Overlay box is visible on this page — click to hide"
            }
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "0 10px",
              fontSize: 11,
              color: overlayHidden ? vibrancySecondaryLabel : vibrancyLabel,
              opacity: overlayHidden ? 0.7 : 1,
            }}
            aria-pressed={overlayHidden ? "false" : "true"}
          >
            {overlayHidden ? "Hidden" : "Visible"}
          </button>
        </div>
        <div style={overlayBodyStyle}>
          <div style={panelStyles.row}>
            <label style={panelStyles.fieldLabel}>Title</label>
            <input
              type="text"
              value={page.title}
              onChange={(e) => setPageField(pageId, { title: e.target.value })}
              style={overlayTextInputStyle}
            />
          </div>
          <div style={panelStyles.row}>
            <label style={panelStyles.fieldLabel}>Subtitle</label>
            <input
              type="text"
              value={page.subtitle ?? ""}
              onChange={(e) =>
                setPageField(pageId, { subtitle: e.target.value })
              }
              style={overlayTextInputStyle}
            />
          </div>
          <textarea
            ref={textareaRef}
            style={panelStyles.textarea}
            value={overlayText}
            onChange={(e) => setOverlayText(pageId, e.target.value)}
            placeholder="Write the page text here. Markdown is stored as-is and rendered in presenter mode."
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={overlaySubheadingStyle}>
          <span style={overlaySubheadingTitleStyle}>Inset image</span>
          <span style={overlaySubheadingDetailStyle}>{images.length}</span>
        </div>
        <div style={overlayBodyStyle}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onUpload}
            style={{ color: vibrancySecondaryLabel, fontSize: 12 }}
          />
        {images.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {images.map((img) => {
              const filename = img.file.split("/").pop() ?? img.file;
              return (
                <div
                  key={img.file}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 0",
                      borderBottom: FROSTED_HAIRLINE,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                        color: vibrancySecondaryLabel,
                        fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {filename}
                  </span>
                  <button
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "0 8px",
                      fontSize: 11,
                    }}
                    onClick={() => insertImageRef(filename)}
                    title="Insert ![](filename) at cursor position in the markdown"
                  >
                    Insert
                  </button>
                  <button
                    style={panelStyles.iconButton}
                    onClick={() => removeOverlayImage(pageId, filename)}
                    title="Remove from page (file remains on disk)"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={overlaySubheadingStyle}>
          <span style={overlaySubheadingTitleStyle}>Timing</span>
          <span style={overlaySubheadingDetailStyle}>fade and gap</span>
        </div>
        <div style={overlayBodyStyle}>
          <div style={panelStyles.row}>
            <label style={panelStyles.fieldLabel}>Fade time (ms)</label>
            <input
              type="number"
              min={0}
              step={50}
              value={fadeMs}
              onChange={(e) =>
                setPageOverlayTiming(pageId, {
                  fadeMs: parseInt(e.target.value, 10) || 0,
                })
              }
              style={{ ...panelStyles.textInput, width: 90, flex: "none" }}
            />
          </div>
          <div style={panelStyles.row}>
            <label style={panelStyles.fieldLabel}>Gap time (ms)</label>
            <input
              type="number"
              min={0}
              step={50}
              value={gapMs}
              onChange={(e) =>
                setPageOverlayTiming(pageId, {
                  gapMs: parseInt(e.target.value, 10) || 0,
                })
              }
              style={{ ...panelStyles.textInput, width: 90, flex: "none" }}
            />
          </div>
          <div style={panelStyles.row}>
            <label style={panelStyles.fieldLabel}>Easing</label>
            <select
              value={easing}
              onChange={(e) =>
                setPageOverlayTiming(pageId, {
                  easing: e.target.value as EasingName,
                })
              }
            >
              {OVERLAY_EASINGS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlaySubheadingStyle: React.CSSProperties = {
  ...frostedSubheading,
  display: "flex",
  alignItems: "var(--editor-container-align, center)",
  justifyContent: "var(--editor-container-justify, space-between)",
  gap: "var(--editor-container-gap, 14px)",
  minHeight: "var(--editor-nested-bar-height, 42px)",
  padding: `0 var(--editor-pill-text-inset, ${EDITOR_PILL_TEXT_INSET_PX}px)`,
  marginBottom: 4,
  marginLeft: "var(--editor-page-list-indent, 18px)",
};

// DEV NOTES: overlay subheading bars
// ----------------------------------
// This same style is used for the second-level heading pills inside Overlays:
// Page Text, Inset image, and Timing.
//
// Material/rounding comes from `frostedSubheading` in styles.ts. Tune padding
// and minHeight here if those bars feel too tall or too tight.
const overlaySubheadingTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: vibrancyLabel,
};

const overlaySubheadingDetailStyle: React.CSSProperties = {
  fontSize: 11,
  color: vibrancySecondaryLabel,
};

// DEV NOTES: overlay content below each subheading
// ------------------------------------------------
// This is intentionally plain and indented. Do not add a material background
// here unless you want the text area/timing/image contents to become boxed.
// Inputs and textareas already get their own thin material from panelStyles.
const overlayBodyStyle: React.CSSProperties = {
  paddingLeft: "calc(var(--editor-container-body-indent, 28px) + 18px)",
};

const overlayTextInputStyle: React.CSSProperties = {
  ...panelStyles.textInput,
  flex: 1,
  minWidth: 0,
  height: 30,
  boxSizing: "border-box",
};

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  // Process in chunks to avoid stack overflow on large images.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}
