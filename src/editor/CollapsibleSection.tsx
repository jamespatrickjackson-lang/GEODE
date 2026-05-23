import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { panelStyles } from "./styles";

// Disclosure section. Header click toggles. No animation, no persisted state.
//
// DEV NOTES: top-level sidebar sections
// -------------------------------------
// This component renders the main sidebar heading bars:
// Global Settings, Layers, and Overlay Box Manager.
//
// Look in styles.ts for the visual styling:
// - panelStyles.collapsibleHeader: bar layout and edge spacing
// - frostedHeading: material, border, and full rounded/pill shape
// - panelStyles.disclosureTriangle / disclosureChevron: right-side arrow
//
// Look in EditorRoot.tsx to rename, reorder, add, or remove top-level sections.

interface Props {
  title: string;
  detail?: string;
  defaultOpen?: boolean;
  openSignal?: unknown;
  closeSignal?: unknown;
  accentColor?: string | null;
  onActivate?: () => void;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  openSignal,
  closeSignal,
  accentColor,
  onActivate,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const previousOpenSignal = useRef(openSignal);
  const previousCloseSignal = useRef(closeSignal);

  useEffect(() => {
    if (openSignal === undefined || openSignal === previousOpenSignal.current) {
      return;
    }
    previousOpenSignal.current = openSignal;
    setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (
      closeSignal === undefined ||
      closeSignal === previousCloseSignal.current
    ) {
      return;
    }
    previousCloseSignal.current = closeSignal;
    setOpen(false);
  }, [closeSignal]);
  const headerStyle = accentColor
    ? {
        ...panelStyles.collapsibleHeader,
        background: accentColor,
      }
    : panelStyles.collapsibleHeader;
  return (
    <div
      style={panelStyles.collapsibleSection}
      data-dev-source="src/editor/CollapsibleSection.tsx:35"
      data-dev-note="CollapsibleSection renders top-level sidebar sections; visual styles come from panelStyles in styles.ts."
    >
      <div
        style={headerStyle}
        data-dev-source="src/editor/styles.ts:180"
        data-dev-padding-source="src/editor/styles.ts:188"
        data-dev-note="panelStyles.collapsibleHeader controls top-level heading pill spacing and layout."
        onClick={() => {
          onActivate?.();
          setOpen((v) => !v);
        }}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate?.();
            setOpen((v) => !v);
          }
        }}
      >
        <span
          style={panelStyles.collapsibleTitle}
          data-dev-text-source="src/editor/CollapsibleSection.tsx:50"
          data-dev-note="This renders the top-level section title text; the title prop is passed from EditorRoot."
        >
          {title}
        </span>
        <span style={panelStyles.disclosureTriangle} aria-hidden="true">
          <span
            style={{
              ...panelStyles.disclosureChevron,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </div>
      {open && <div style={panelStyles.collapsibleBody}>{children}</div>}
    </div>
  );
}
