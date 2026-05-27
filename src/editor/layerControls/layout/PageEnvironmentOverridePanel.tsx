import type { PresentationPage, RenderPresetId } from "../../../pages/types";
import {
  PageBooleanOverrideRow,
  PageMoodOverrideRow,
  PageRenderPresetOverrideRow,
} from "../page/PageOverrideRows";
import { LayerGroup } from "./LayoutControls";
import { pageRenderPresetHelpStyle } from "./layoutStyles";

export function PageEnvironmentOverridePanel({
  page,
  setPageField,
  accentColor,
}: {
  page: PresentationPage;
  setPageField: (
    pageId: string,
    patch: Partial<
      Pick<
        PresentationPage,
        | "cinematicExposure"
        | "bloomBoost"
        | "sunLockToCamera"
        | "renderPreset"
        | "renderPresetId"
      >
    >,
  ) => void;
  accentColor?: string | null;
}) {
  return (
    <LayerGroup
      title="Page Render Preset Override"
      devSource="src/editor/LayerPanel.tsx:704"
      devNote="PageEnvironmentOverridePanel controls per-page Exposure and Bloom overrides."
      accentColor={accentColor}
    >
      <PageRenderPresetOverrideRow
        value={page.renderPreset ?? page.renderPresetId ?? ""}
        onChange={(value) =>
          setPageField(page.id, {
            renderPreset: value ? (value as RenderPresetId) : undefined,
            renderPresetId: undefined,
          })
        }
      />
      <div style={pageRenderPresetHelpStyle}>
        Overrides the project render preset for this page only.
      </div>
      <PageMoodOverrideRow
        label="Exposure"
        value={page.cinematicExposure ?? 1}
        min={0.4}
        max={2}
        step={0.05}
        overridden={page.cinematicExposure !== undefined}
        onEnable={() => setPageField(page.id, { cinematicExposure: 1 })}
        onClear={() => setPageField(page.id, { cinematicExposure: undefined })}
        onChange={(value) =>
          setPageField(page.id, { cinematicExposure: value })
        }
      />
      <PageMoodOverrideRow
        label="Bloom"
        value={page.bloomBoost ?? 1}
        min={0}
        max={3}
        step={0.05}
        overridden={page.bloomBoost !== undefined}
        onEnable={() => setPageField(page.id, { bloomBoost: 1 })}
        onClear={() => setPageField(page.id, { bloomBoost: undefined })}
        onChange={(value) => setPageField(page.id, { bloomBoost: value })}
      />
      <PageBooleanOverrideRow
        label="Sun follows camera"
        value={page.sunLockToCamera === true}
        overridden={page.sunLockToCamera !== undefined}
        onEnable={() => setPageField(page.id, { sunLockToCamera: true })}
        onClear={() => setPageField(page.id, { sunLockToCamera: undefined })}
        onChange={(value) => setPageField(page.id, { sunLockToCamera: value })}
      />
    </LayerGroup>
  );
}
