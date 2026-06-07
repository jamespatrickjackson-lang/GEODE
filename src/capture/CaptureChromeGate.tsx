import type { ReactNode } from "react";
import { isCaptureGroupVisible } from "./captureProfiles";
import type { CaptureVisibilityGroup } from "./captureTypes";
import { useCaptureDirector } from "./CaptureDirectorProvider";

export function CaptureChromeGate({
  group,
  children,
}: {
  group: CaptureVisibilityGroup;
  children: ReactNode;
}) {
  const { captureMode } = useCaptureDirector();
  if (!isCaptureGroupVisible(captureMode, group)) {
    return null;
  }
  return (
    <div data-capture-group={group} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
