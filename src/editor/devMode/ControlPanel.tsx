import { useEffect, useRef, useState } from "react";
import type { EditorChromeSettings } from "../../pages/types";
import { ALIGN_ITEM_OPTIONS, JUSTIFY_CONTENT_OPTIONS } from "./constants";
import { containerLabelGeometry } from "./containerOutlines";
import {
  ComputedValue,
  DevCheckbox,
  DevControlGroup,
  DevRange,
  DevSelect,
} from "./controls";
import {
  relevantControlGroups,
  resolveInheritedControlSources,
  type DevControlGroupId,
} from "./controlRegistry";
import { genericContainerType } from "./inspect";
import {
  mergeOverride,
  overrideKeyForElement,
  type DevTextOverride,
} from "./overrideStore";
import {
  CONTROL_PANEL_WIDTH_PX,
  computedGridStyle,
  controlPanelCloseStyle,
  controlPanelHeaderStyle,
  controlPanelKickerStyle,
  controlPanelLowLevelLabelStyle,
  controlPanelMetaStyle,
  controlPanelScrollHintChevronStyle,
  controlPanelScrollHintStyle,
  controlPanelStyle,
  controlPanelTitleStyle,
  scopeToggleStyle,
} from "./styles";
import { DevTextControls } from "./textControls";
import type { HoverInfo } from "./types";
import { clampNumber } from "./util";

export function DevContainerControlPanel({
  info,
  editorSettings,
  onPatch,
  onClose,
}: {
  info: HoverInfo;
  editorSettings: EditorChromeSettings;
  onPatch: (patch: EditorChromeSettings) => void;
  onClose: () => void;
}) {
  const style = info.element ? getComputedStyle(info.element) : null;
  const placement = controlPanelPlacement(info);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [scrollHintVisible, setScrollHintVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const ownGroups = new Set<DevControlGroupId>(
    relevantControlGroups(info.containerType),
  );
  const inherited = resolveInheritedControlSources(info.element);
  const groupVisible = (id: DevControlGroupId) => showAll || ownGroups.has(id);
  const lowLevelVisible =
    showAll ||
    ownGroups.has("panel") ||
    ownGroups.has("header") ||
    ownGroups.has("sliders");

  const overrideKey = overrideKeyForElement(info.textElement ?? null);
  const persistText = (patch: DevTextOverride) => {
    if (!overrideKey) return;
    onPatch({
      devTextOverrides: mergeOverride(
        editorSettings.devTextOverrides,
        overrideKey,
        patch,
      ),
    });
  };

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const updateScrollHint = () => {
      const hasOverflow = panel.scrollHeight > panel.clientHeight + 2;
      const atBottom =
        panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4;
      const next = hasOverflow && !atBottom;
      setScrollHintVisible((current) => (current === next ? current : next));
    };

    updateScrollHint();
    panel.addEventListener("scroll", updateScrollHint, { passive: true });
    window.addEventListener("resize", updateScrollHint);
    return () => {
      panel.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [editorSettings, info, placement.maxHeight, showAll]);

  return (
    <>
      <div
        ref={panelRef}
        style={{
          ...controlPanelStyle,
          left: placement.left,
          top: placement.top,
          maxHeight: placement.maxHeight,
        }}
        data-dev-mode-control="true"
      >
      <div style={controlPanelHeaderStyle}>
        <div>
          <div style={controlPanelKickerStyle}>Dev container</div>
          <div style={controlPanelTitleStyle}>
            {info.containerName ?? info.label}
          </div>
        </div>
        <button
          type="button"
          style={controlPanelCloseStyle}
          onClick={onClose}
          aria-label="Close dev container controls"
        >
          x
        </button>
      </div>

      <div style={controlPanelMetaStyle}>
        <div>type: {info.containerType ?? genericContainerType(info.element)}</div>
        {info.containerScope && <div>scope: {info.containerScope}</div>}
        <div>source: {info.source}</div>
      </div>

      {style && (
        <div style={computedGridStyle}>
          <ComputedValue label="display" value={style.display} />
          <ComputedValue label="align" value={style.alignItems} />
          <ComputedValue label="justify" value={style.justifyContent} />
          <ComputedValue label="gap" value={style.gap} />
          <ComputedValue
            label="padding"
            value={`${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`}
          />
          <ComputedValue label="radius" value={style.borderRadius} />
        </div>
      )}

      <button
        type="button"
        style={scopeToggleStyle}
        onClick={() => setShowAll((current) => !current)}
      >
        {showAll ? "Show relevant only" : "Show all chrome"}
      </button>

      <DevTextControls
        info={info}
        overrideKey={overrideKey}
        onPersist={persistText}
      />

      {groupVisible("padding-bars") && (
        <DevControlGroup title="Padding - bars">
          <DevRange
            label="Side inset"
            value={editorSettings.sectionMarginXPx ?? 12}
            min={0}
            max={40}
            step={1}
            onChange={(value) => onPatch({ sectionMarginXPx: value })}
          />
          <DevRange
            label="Row gap"
            value={editorSettings.sectionGapYPx ?? 10}
            min={0}
            max={32}
            step={1}
            onChange={(value) => onPatch({ sectionGapYPx: value })}
          />
          <DevRange
            label="Bottom gap"
            value={editorSettings.topBarBottomGapPx ?? 6}
            min={0}
            max={24}
            step={1}
            onChange={(value) => onPatch({ topBarBottomGapPx: value })}
          />
          <DevRange
            label="Bar radius"
            value={editorSettings.barRadiusPx ?? 999}
            min={0}
            max={999}
            step={1}
            format={(value) => (value >= 999 ? "pill" : `${value.toFixed(0)} px`)}
            onChange={(value) => onPatch({ barRadiusPx: value })}
          />
          <DevRange
            label="Top height"
            value={editorSettings.topBarHeightPx ?? 44}
            min={32}
            max={72}
            step={1}
            onChange={(value) => onPatch({ topBarHeightPx: value })}
          />
          <DevRange
            label="Text inset"
            value={editorSettings.pillTextInsetPx ?? 24}
            min={8}
            max={40}
            step={1}
            onChange={(value) => onPatch({ pillTextInsetPx: value })}
          />
        </DevControlGroup>
      )}

      {groupVisible("padding-body") && (
        <DevControlGroup title="Padding - body">
          <DevRange
            label="Nested height"
            value={editorSettings.nestedBarHeightPx ?? 42}
            min={30}
            max={68}
            step={1}
            onChange={(value) => onPatch({ nestedBarHeightPx: value })}
          />
          <DevRange
            label="Inner gap"
            value={editorSettings.containerGapPx ?? 14}
            min={0}
            max={32}
            step={1}
            onChange={(value) => onPatch({ containerGapPx: value })}
          />
          <DevRange
            label="Body indent"
            value={editorSettings.containerBodyIndentPx ?? 28}
            min={0}
            max={72}
            step={1}
            onChange={(value) => onPatch({ containerBodyIndentPx: value })}
          />
          <DevRange
            label="Page indent"
            value={editorSettings.pageListIndentPx ?? 18}
            min={0}
            max={48}
            step={1}
            onChange={(value) => onPatch({ pageListIndentPx: value })}
          />
          <DevRange
            label="Scroll end"
            value={editorSettings.scrollEndPaddingPx ?? 4}
            min={0}
            max={96}
            step={1}
            onChange={(value) => onPatch({ scrollEndPaddingPx: value })}
          />
          <DevRange
            label="Save footer gap"
            value={editorSettings.saveFooterGapPx ?? 8}
            min={0}
            max={64}
            step={1}
            onChange={(value) => onPatch({ saveFooterGapPx: value })}
          />
          <DevRange
            label="Save icon"
            value={editorSettings.saveIconSizePx ?? 13}
            min={8}
            max={24}
            step={1}
            onChange={(value) => onPatch({ saveIconSizePx: value })}
          />
        </DevControlGroup>
      )}

      {groupVisible("alignment") && (
        <DevControlGroup title="Alignment">
          <DevSelect
            label="Align items"
            value={editorSettings.containerAlignItems ?? "center"}
            options={ALIGN_ITEM_OPTIONS}
            onChange={(value) => onPatch({ containerAlignItems: value })}
          />
          <DevSelect
            label="Justify content"
            value={editorSettings.containerJustifyContent ?? "space-between"}
            options={JUSTIFY_CONTENT_OPTIONS}
            onChange={(value) => onPatch({ containerJustifyContent: value })}
          />
        </DevControlGroup>
      )}

      {inherited.map((source) => (
        <DevControlGroup
          key={`inherited:${source.name}`}
          title={`Inherited - ${source.name}`}
        >
          <div style={controlPanelMetaStyle}>
            <div>from: {source.type}</div>
          </div>
          <DevRange
            label="Body indent"
            value={editorSettings.containerBodyIndentPx ?? 28}
            min={0}
            max={72}
            step={1}
            onChange={(value) => onPatch({ containerBodyIndentPx: value })}
          />
          <DevRange
            label="Inner gap"
            value={editorSettings.containerGapPx ?? 14}
            min={0}
            max={32}
            step={1}
            onChange={(value) => onPatch({ containerGapPx: value })}
          />
          <DevRange
            label="Page indent"
            value={editorSettings.pageListIndentPx ?? 18}
            min={0}
            max={48}
            step={1}
            onChange={(value) => onPatch({ pageListIndentPx: value })}
          />
        </DevControlGroup>
      ))}

      {lowLevelVisible && (
        <div style={controlPanelLowLevelLabelStyle}>Low-level chrome</div>
      )}

      {groupVisible("panel") && (
        <DevControlGroup title="Panel">
          <DevRange
            label="UI scale"
            value={editorSettings.uiScale ?? 0.75}
            min={0.6}
            max={1.25}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => onPatch({ uiScale: value })}
          />
          <DevRange
            label="Width"
            value={editorSettings.panelWidthPx ?? 512}
            min={360}
            max={760}
            step={8}
            onChange={(value) => onPatch({ panelWidthPx: value })}
          />
          <DevRange
            label="Margin"
            value={editorSettings.panelMarginPx ?? 44}
            min={8}
            max={120}
            step={1}
            onChange={(value) => onPatch({ panelMarginPx: value })}
          />
          <DevRange
            label="X position"
            value={editorSettings.panelLeftPx ?? 44}
            min={0}
            max={1400}
            step={1}
            onChange={(value) => onPatch({ panelLeftPx: value })}
          />
          <DevRange
            label="Y position"
            value={editorSettings.panelTopPx ?? 44}
            min={0}
            max={900}
            step={1}
            onChange={(value) => onPatch({ panelTopPx: value })}
          />
          <DevRange
            label="Bottom safe"
            value={editorSettings.panelBottomSafePx ?? 112}
            min={40}
            max={260}
            step={2}
            onChange={(value) => onPatch({ panelBottomSafePx: value })}
          />
          <DevRange
            label="Corners"
            value={editorSettings.panelCornerRadiusPx ?? 34}
            min={6}
            max={64}
            step={1}
            onChange={(value) => onPatch({ panelCornerRadiusPx: value })}
          />
        </DevControlGroup>
      )}

      {groupVisible("header") && (
        <DevControlGroup title="Header">
          <DevCheckbox
            label="Heading text"
            checked={editorSettings.headerTitleVisible !== false}
            onChange={(value) => onPatch({ headerTitleVisible: value })}
          />
          <DevRange
            label="Height"
            value={editorSettings.headerHeightPx ?? 54}
            min={36}
            max={180}
            step={1}
            onChange={(value) => onPatch({ headerHeightPx: value })}
          />
          <DevRange
            label="Font size"
            value={editorSettings.headerFontSizePx ?? 18}
            min={12}
            max={24}
            step={1}
            onChange={(value) => onPatch({ headerFontSizePx: value })}
          />
          <DevRange
            label="Gap"
            value={editorSettings.headerGapPx ?? 16}
            min={0}
            max={40}
            step={1}
            onChange={(value) => onPatch({ headerGapPx: value })}
          />
          <DevRange
            label="Logo size"
            value={editorSettings.headerLogoSizePx ?? 24}
            min={10}
            max={160}
            step={1}
            onChange={(value) => onPatch({ headerLogoSizePx: value })}
          />
          <DevRange
            label="Logo opacity"
            value={editorSettings.headerLogoOpacity ?? 0.92}
            min={0}
            max={1}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => onPatch({ headerLogoOpacity: value })}
          />
          <DevCheckbox
            label="Transparent bg"
            checked={editorSettings.headerLogoBackgroundTransparent === true}
            onChange={(value) =>
              onPatch({ headerLogoBackgroundTransparent: value })
            }
          />
          <DevCheckbox
            label="Text to white"
            checked={editorSettings.headerLogoForegroundWhite !== false}
            onChange={(value) => onPatch({ headerLogoForegroundWhite: value })}
          />
          <DevRange
            label="BG cutoff"
            value={editorSettings.headerLogoBackgroundCutoff ?? 0.93}
            min={0.75}
            max={1}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => onPatch({ headerLogoBackgroundCutoff: value })}
          />
          <DevRange
            label="Edge softness"
            value={editorSettings.headerLogoEdgeSoftness ?? 0.06}
            min={0}
            max={0.2}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => onPatch({ headerLogoEdgeSoftness: value })}
          />
        </DevControlGroup>
      )}

      {groupVisible("sliders") && (
        <DevControlGroup title="Sliders">
          <DevRange
            label="Track height"
            value={editorSettings.sliderTrackHeightPx ?? 8}
            min={3}
            max={18}
            step={1}
            onChange={(value) => onPatch({ sliderTrackHeightPx: value })}
          />
          <DevRange
            label="Knob size"
            value={editorSettings.sliderThumbSizePx ?? 20}
            min={8}
            max={34}
            step={1}
            onChange={(value) => onPatch({ sliderThumbSizePx: value })}
          />
        </DevControlGroup>
      )}
      </div>
      {scrollHintVisible && (
        <div
          style={{
            ...controlPanelScrollHintStyle,
            left: placement.left,
            top: placement.top + placement.maxHeight - 30,
          }}
          data-dev-mode-control="true"
          aria-hidden="true"
        >
          <span style={controlPanelScrollHintChevronStyle} />
        </div>
      )}
    </>
  );
}

export function controlPanelPlacement(info: HoverInfo): {
  left: number;
  top: number;
  maxHeight: number;
} {
  const margin = 12;
  const gap = 14;
  const width = CONTROL_PANEL_WIDTH_PX;
  const maxHeight = Math.max(260, window.innerHeight - margin * 2);
  const rect = info.rect ?? info.element?.getBoundingClientRect();
  if (!rect) {
    return {
      left: Math.max(margin, window.innerWidth - width - margin),
      top: margin,
      maxHeight,
    };
  }

  const targetTop = clampNumber(
    rect.top,
    margin,
    Math.max(margin, window.innerHeight - maxHeight - margin),
  );
  const rightLeft = rect.right + gap;
  if (rightLeft + width <= window.innerWidth - margin) {
    return { left: rightLeft, top: targetTop, maxHeight };
  }

  const label = containerLabelGeometry(
    rect,
    info.containerName ?? info.label,
    info.containerType ?? genericContainerType(info.element),
  );
  const leftOfLabel = label.left - width - gap;
  if (leftOfLabel >= margin) {
    return { left: leftOfLabel, top: targetTop, maxHeight };
  }

  const leftOfTarget = rect.left - width - gap;
  if (leftOfTarget >= margin) {
    return { left: leftOfTarget, top: targetTop, maxHeight };
  }

  const belowTop = rect.bottom + gap;
  if (belowTop + 220 <= window.innerHeight - margin) {
    return {
      left: clampNumber(rect.left, margin, window.innerWidth - width - margin),
      top: belowTop,
      maxHeight: Math.min(maxHeight, window.innerHeight - belowTop - margin),
    };
  }

  return {
    left: clampNumber(rect.left, margin, window.innerWidth - width - margin),
    top: margin,
    maxHeight,
  };
}
