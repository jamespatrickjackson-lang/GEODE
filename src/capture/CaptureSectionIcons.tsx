import type { CSSProperties, ReactNode } from "react";

// Capture Director icon set. Matches the editor sidebar icon convention in
// CollapsibleSection.tsx: 24x24 viewBox, no fill, currentColor stroke, round
// caps/joins, ~1.9 stroke. Kept here so the dock and the editor read as one app.

export type CaptureIconName =
  | "realtime"
  | "render"
  | "still"
  | "camera-path"
  | "timeline"
  | "gpu"
  | "download"
  | "master"
  | "frames"
  | "play"
  | "pause"
  | "stop"
  | "record";

const baseStyle: CSSProperties = {
  flex: "none",
  color: "rgba(244, 240, 232, 0.78)",
};

const GLYPHS: Record<CaptureIconName, ReactNode> = {
  realtime: (
    <>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3z" />
      <circle cx="8" cy="12" r="2.2" />
    </>
  ),
  render: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17M8 4.5v15M16 4.5v15" />
    </>
  ),
  still: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3 15 5-4 4 3 3-2 6 4" />
      <circle cx="9" cy="9.5" r="1.4" />
    </>
  ),
  "camera-path": (
    <>
      <path d="M4 18c2.5-9 13.5-9 16-12" />
      <circle cx="4" cy="18" r="1.8" />
      <circle cx="20" cy="6" r="1.8" />
      <path d="M11 12.2 13 11" />
    </>
  ),
  timeline: (
    <>
      <path d="M3 8h18M3 16h18" />
      <path d="M8 6v4M14 14v4" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="14" cy="16" r="1.5" />
    </>
  ),
  gpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" />
      <path d="M9 6V3.5M15 6V3.5M9 20.5V18M15 20.5V18M6 9H3.5M6 15H3.5M20.5 9H18M20.5 15H18" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M5 19.5h14" />
    </>
  ),
  master: (
    <>
      <path d="M12 3.5 14.6 9l6 .8-4.4 4.2 1.1 6L12 17.2 6.7 20l1.1-6L3.4 9.8 9.4 9z" />
    </>
  ),
  frames: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="M7.5 20.5h11a2 2 0 0 0 2-2v-11" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1.6" />,
  record: <circle cx="12" cy="12" r="6" />,
};

export function CaptureSectionIcon({
  name,
  size = 16,
  style,
}: {
  name: CaptureIconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ ...baseStyle, ...style }}
    >
      {GLYPHS[name]}
    </svg>
  );
}
