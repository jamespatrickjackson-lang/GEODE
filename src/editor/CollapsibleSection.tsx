import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { panelStyles } from "./styles";

// Disclosure section. Header click toggles. No animation, no persisted state.
//
// DEV NOTES: top-level sidebar sections
// -------------------------------------
// This component renders the main sidebar heading bars:
// Pages, Cinematics, Sections, Topo, Forge/Data, and Cards.
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
  manifestId?: string;
  onActivate?: () => void;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  openSignal,
  closeSignal,
  accentColor,
  manifestId,
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
  const sectionStyle = accentColor
    ? ({
        ...panelStyles.collapsibleSection,
        "--editor-slider-thumb": accentColor,
      } as CSSProperties)
    : panelStyles.collapsibleSection;
  return (
    <div
      style={sectionStyle}
      data-dev-source="src/editor/CollapsibleSection.tsx:35"
      data-dev-container="true"
      data-dev-container-type="top-level-section"
      data-dev-container-name={title}
      data-dev-container-scope="CollapsibleSection / panelStyles.collapsibleHeader"
      data-dev-note="CollapsibleSection renders top-level sidebar sections; visual styles come from panelStyles in styles.ts."
      data-editor-section-id={manifestId}
      data-dev-order-group={manifestId ? "sidebar-structure" : undefined}
      data-dev-order-id={manifestId}
    >
      <div
        style={headerStyle}
        data-dev-source="src/editor/styles.ts:180"
        data-dev-container="true"
        data-dev-container-type="top-level-section-header"
        data-dev-container-name={title}
        data-dev-container-scope="panelStyles.collapsibleHeader"
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
          <TopLevelSectionIcon title={title} />
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
      {open && (
        <div style={panelStyles.collapsibleBody}>
          <div
            style={panelStyles.collapsibleBodyFrame}
            data-dev-source="src/editor/styles.ts:collapsible-body-frame"
            data-dev-container="true"
            data-dev-container-type="top-level-section-body"
            data-dev-container-name={`${title} body`}
            data-dev-container-scope="panelStyles.collapsibleBodyFrame / containerBodyIndentPx"
            data-dev-padding-source="src/editor/styles.ts:collapsible-body-frame"
            data-dev-note="panelStyles.collapsibleBodyFrame controls the indented body container below each top-level section heading."
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function TopLevelSectionIcon({ title }: { title: string }) {
  const icon = topLevelSectionIconForTitle(title);
  return (
    <svg
      style={topLevelSectionIconStyle}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function PagesBookLeafIcon() {
  return (
    <>
      <path
        data-editor-icon-part="image-three-left-page"
        d="M4.8 7.3c3-.8 6.2-.7 7.2 1.5v11c-1.2-1.5-4.1-1.8-7.2-.6V7.3Z"
      />
      <path
        data-editor-icon-part="image-three-right-page"
        d="M19.2 7.3c-3-.8-6.2-.7-7.2 1.5v11c1.2-1.5 4.1-1.8 7.2-.6V7.3Z"
      />
      <path
        data-editor-icon-part="image-three-center-fold"
        d="M12 8.8v11.6"
      />
      <path
        data-editor-icon-part="image-three-bottom-notch"
        d="M4.8 19.2c3.1-1 6-.8 7.2 1.3 1.2-2.1 4.1-2.3 7.2-1.3"
      />
    </>
  );
}

function topLevelSectionIconForTitle(title: string): ReactNode {
  const normalized = title.toLowerCase();
  if (normalized === "pages" || normalized.includes("page manager")) {
    return <PagesBookLeafIcon />;
  }
  if (normalized.includes("cinematics")) {
    return (
      <>
        <path d="M7 7.5 9 5h6l2 2.5h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2Z" />
        <circle cx="12" cy="13" r="3.2" />
        <path d="M18 10h.01" />
      </>
    );
  }
  if (normalized.includes("visual studio")) {
    return (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
        <circle cx="8" cy="7" r="1.8" />
        <circle cx="15" cy="12" r="1.8" />
        <circle cx="11" cy="17" r="1.8" />
      </>
    );
  }
  if (normalized === "ui" || normalized.includes("interface")) {
    return (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 5v14" />
        <path d="M8 10h12" />
      </>
    );
  }
  if (normalized.includes("sections") || normalized.includes("cropping")) {
    return (
      <>
        <path d="M6 4v14a2 2 0 0 0 2 2h12" />
        <path d="M4 6h12a2 2 0 0 1 2 2v12" />
        <path d="M8 16 16 8" />
      </>
    );
  }
  if (normalized.includes("topo") || normalized.includes("map")) {
    return (
      <>
        <path d="M3 17.5 8 6l5 11.5" />
        <path d="m11.5 17.5 3-7 6.5 7" />
        <path d="M8 6h7" />
        <path d="M2.75 17.5h18.5" />
      </>
    );
  }
  if (
    normalized === "forge" ||
    normalized.includes("forge data") ||
    normalized.includes("public data") ||
    normalized.includes("customer data")
  ) {
    return (
      <>
        <path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z" />
        <path d="M4 12l8 4.5 8-4.5" />
        <path d="M4 16.5 12 21l8-4.5" />
      </>
    );
  }
  if (normalized === "cards" || normalized.includes("overlay")) {
    return (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M7 9h10" />
        <path d="M7 13h6" />
        <path d="M7 16h4" />
      </>
    );
  }
  return (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l3 2" />
    </>
  );
}

const topLevelSectionIconStyle: CSSProperties = {
  width: 18,
  height: 18,
  flex: "none",
  color: "rgba(244, 240, 232, 0.78)",
};
