import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  regularLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import type { EditorChromeSettings } from "../pages/types";

interface HoverInfo {
  x: number;
  y: number;
  source: string;
  note?: string;
  label: string;
  rect?: DOMRect;
  padding?: PaddingHit;
  box?: BoxModelInfo;
  locked?: boolean;
  element?: Element;
  containerName?: string;
  containerType?: string;
  containerScope?: string;
  textElement?: HTMLElement;
  textValue?: string;
  textSource?: string;
}

const SOURCE_ATTR = "data-dev-source";
const NOTE_ATTR = "data-dev-note";
const TEXT_SOURCE_ATTR = "data-dev-text-source";
const PADDING_SOURCE_ATTR = "data-dev-padding-source";
const CONTAINER_ATTR = "data-dev-container";
const CONTAINER_TYPE_ATTR = "data-dev-container-type";
const CONTAINER_NAME_ATTR = "data-dev-container-name";
const CONTAINER_SCOPE_ATTR = "data-dev-container-scope";
const ALIGN_ITEM_OPTIONS: NonNullable<
  EditorChromeSettings["containerAlignItems"]
>[] = ["flex-start", "center", "flex-end", "stretch", "baseline"];
const JUSTIFY_CONTENT_OPTIONS: NonNullable<
  EditorChromeSettings["containerJustifyContent"]
>[] = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
];
const FONT_FAMILY_OPTIONS = [
  "inherit",
  TECHNICAL_MONO_FONT,
  "system-ui, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Georgia, serif",
  "Consolas, monospace",
] as const;
const FONT_WEIGHT_OPTIONS = ["400", "500", "600", "700", "800"] as const;
const FONT_STYLE_OPTIONS = ["normal", "italic"] as const;
const TEXT_TRANSFORM_OPTIONS = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;

interface BoxModelInfo {
  rect: DOMRect;
  content: RectLike;
  paddingTop: RectLike | null;
  paddingRight: RectLike | null;
  paddingBottom: RectLike | null;
  paddingLeft: RectLike | null;
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PaddingHit {
  sides: string[];
  source: string;
}

interface DevModeInspectorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  editorSettings: EditorChromeSettings;
  onEditorSettingsChange: (patch: EditorChromeSettings) => void;
}

interface ContainerOutlineInfo {
  key: string;
  rect: DOMRect;
  name: string;
  type: string;
  scope?: string;
  element: Element;
}

interface ContainerLabelGeometry {
  left: number;
  top: number;
  width: number;
  lineY: number;
  lineStartX: number;
  lineEndX: number;
  lineEndY: number;
}

export function DevModeInspector({
  enabled,
  onEnabledChange,
  editorSettings,
  onEditorSettingsChange,
}: DevModeInspectorProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [locked, setLocked] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isTypingTarget(document.activeElement)
      ) {
        return;
      }
      event.preventDefault();
      const next = !enabled;
      if (!next) {
        setHover(null);
        setLocked(null);
      }
      onEnabledChange(next);
      setHover(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onEnabledChange]);

  useEffect(() => {
    if (!enabled) return;

    const onPointerMove = (event: PointerEvent) => {
      if (locked) return;
      if (isDevModeControlTarget(event.target)) return;
      const next = inspectAtPoint(event);
      if (next) setHover(next);
    };

    const onPointerLeave = () => setHover(null);
    const onClick = (event: MouseEvent) => {
      if (isDevModeControlTarget(event.target)) return;
      const next = inspectAtPoint(event, { lock: true });
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      setLocked(next);
      setHover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLocked(null);
    };

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [enabled, locked]);

  if (!enabled) return null;

  const info = locked ?? hover;
  const containerOutlines = collectContainerOutlines();
  const tooltipLeft = info
    ? Math.min(info.x + 14, window.innerWidth - 330)
    : 16;
  const tooltipTop = info
    ? Math.min(info.y + 16, window.innerHeight - 132)
    : 16;

  return createPortal(
    <>
      <div style={devModeBadgeStyle}>Dev mode: hover to find code</div>
      {containerOutlines.map((outline) => (
        <ContainerOutline
          key={outline.key}
          outline={outline}
          selected={outline.element === locked?.element}
        />
      ))}
      {info?.box && <BoxModelOverlay box={info.box} />}
      {info?.rect && (
        <div
          style={{
            ...highlightStyle,
            left: info.rect.left,
            top: info.rect.top,
            width: info.rect.width,
            height: info.rect.height,
          }}
        />
      )}
      {info && (
        <div
          style={{
            ...tooltipStyle,
            left: tooltipLeft,
            top: tooltipTop,
          }}
        >
          <div style={tooltipKickerStyle}>
            {info.locked ? "clicked" : "hover"} - {info.label}
          </div>
          {info.containerName && (
            <div style={tooltipPaddingStyle}>
              {info.containerName} - {info.containerType}
            </div>
          )}
          <div style={tooltipSourceStyle}>{info.source}</div>
          {info.containerScope && (
            <div style={tooltipNoteStyle}>scope: {info.containerScope}</div>
          )}
          {info.padding && (
            <div style={tooltipPaddingStyle}>
              padding: {info.padding.sides.join(" + ")}
            </div>
          )}
          {info.note && <div style={tooltipNoteStyle}>{info.note}</div>}
          {info.locked && (
            <div style={tooltipNoteStyle}>Press Esc to clear the lock.</div>
          )}
        </div>
      )}
      {locked && (
        <DevContainerControlPanel
          info={locked}
          editorSettings={editorSettings}
          onPatch={onEditorSettingsChange}
          onClose={() => setLocked(null)}
        />
      )}
    </>,
    document.body,
  );
}

function inspectAtPoint(
  event: Pick<MouseEvent | PointerEvent, "clientX" | "clientY" | "target">,
  opts: { lock?: boolean } = {},
): HoverInfo | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  const textHit = findTextHit(event.clientX, event.clientY);
  const baseElement = textHit?.element ?? target;
  const container = baseElement.closest(`[${CONTAINER_ATTR}="true"]`);
  const annotated = container ?? baseElement.closest(`[${SOURCE_ATTR}]`);
  const fallback = annotated ? null : readReactDebugSource(baseElement);
  const element = annotated ?? fallback?.element ?? baseElement;
  const source =
    textHit?.source ?? annotated?.getAttribute(SOURCE_ATTR) ?? fallback?.source;
  const note =
    textHit?.note ?? annotated?.getAttribute(NOTE_ATTR) ?? fallback?.note;
  const containerName =
    container?.getAttribute(CONTAINER_NAME_ATTR) ?? cleanText(element.textContent) ?? undefined;
  const containerType =
    container?.getAttribute(CONTAINER_TYPE_ATTR) ?? genericContainerType(element);
  const containerScope =
    container?.getAttribute(CONTAINER_SCOPE_ATTR) ?? undefined;
  const textElement = findPrimaryTextElement(textHit?.element, element);
  const textValue = textElement ? readEditableText(textElement) : undefined;
  const textSource =
    textElement?.getAttribute(TEXT_SOURCE_ATTR) ??
    textHit?.source ??
    undefined;

  const rect = element.getBoundingClientRect();
  const box = opts.lock ? readBoxModel(element) : undefined;
  const padding = opts.lock
    ? readPaddingHit(element, event.clientX, event.clientY, source)
    : undefined;

  if (!source) {
    return {
      x: event.clientX,
      y: event.clientY,
      source: "No source tag found",
      note: "Add data-dev-source or data-dev-text-source to the nearest JSX element.",
      label: textHit?.label ?? describeElement(baseElement),
      rect: baseElement.getBoundingClientRect(),
      box: opts.lock ? readBoxModel(baseElement) : undefined,
      locked: opts.lock,
      element: baseElement,
      containerName,
      containerType,
      containerScope,
      textElement,
      textValue,
      textSource,
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
    source: padding?.source ?? source,
    note:
      padding && padding.sides.length > 0
        ? "Clicked inside this element's padding area."
        : note,
    label: containerName
      ? `${containerName} (${containerType})`
      : textHit?.label ?? describeElement(element),
    rect,
    box,
    padding,
    locked: opts.lock,
    element,
    containerName,
    containerType,
    containerScope,
    textElement,
    textValue,
    textSource,
  };
}

function BoxModelOverlay({ box }: { box: BoxModelInfo }) {
  return (
    <>
      {box.paddingTop && <div style={paddingRectStyle(box.paddingTop)} />}
      {box.paddingRight && <div style={paddingRectStyle(box.paddingRight)} />}
      {box.paddingBottom && <div style={paddingRectStyle(box.paddingBottom)} />}
      {box.paddingLeft && <div style={paddingRectStyle(box.paddingLeft)} />}
      <div style={contentRectStyle(box.content)} />
    </>
  );
}

function ContainerOutline({
  outline,
  selected,
}: {
  outline: ContainerOutlineInfo;
  selected: boolean;
}) {
  const label = containerLabelGeometry(
    outline.rect,
    outline.name,
    outline.type,
  );
  return (
    <>
      <div
        style={{
          ...containerOutlineStyle,
          ...(selected ? selectedContainerOutlineStyle : {}),
          left: outline.rect.left,
          top: outline.rect.top,
          width: outline.rect.width,
          height: outline.rect.height,
        }}
      />
      <svg style={containerPointerSvgStyle} aria-hidden="true">
        <line
          x1={label.lineStartX}
          y1={label.lineY}
          x2={label.lineEndX}
          y2={label.lineEndY}
          style={selected ? selectedContainerPointerLineStyle : containerPointerLineStyle}
        />
        <circle
          cx={label.lineEndX}
          cy={label.lineEndY}
          r={2.5}
          style={selected ? selectedContainerPointerDotStyle : containerPointerDotStyle}
        />
      </svg>
      <div
        style={{
          ...containerLabelStyle,
          left: label.left,
          top: label.top,
          width: label.width,
        }}
      >
        {outline.name} - {outline.type}
      </div>
    </>
  );
}

function DevContainerControlPanel({
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
  }, [editorSettings, info, placement.maxHeight]);

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

      <DevTextControls info={info} />

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
      </DevControlGroup>

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

      <div style={controlPanelLowLevelLabelStyle}>Low-level chrome</div>

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

function DevControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={controlGroupStyle}>
      <div style={controlGroupTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

interface TextDraft {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textTransform: string;
  color: string;
  opacity: number;
}

function DevTextControls({ info }: { info: HoverInfo }) {
  const target = info.textElement ?? null;
  const [draft, setDraft] = useState<TextDraft>(() => readTextDraft(target));

  useEffect(() => {
    setDraft(readTextDraft(target));
  }, [target]);

  if (!target) return null;

  const updateText = (value: string) => {
    writeEditableText(target, value);
    setDraft((current) => ({ ...current, text: value }));
  };
  const updateStyle = <K extends keyof TextDraft>(
    key: K,
    value: TextDraft[K],
  ) => {
    applyTextStyle(target, key, value);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <DevControlGroup title="Text">
      <div style={controlPanelMetaStyle}>
        <div>text source: {info.textSource ?? "runtime text node"}</div>
      </div>
      <DevTextField
        label="Text"
        value={draft.text}
        onChange={updateText}
      />
      <DevRange
        label="Size"
        value={draft.fontSize}
        min={8}
        max={40}
        step={1}
        onChange={(value) => updateStyle("fontSize", value)}
      />
      <DevSelect
        label="Type"
        value={draft.textTransform}
        options={TEXT_TRANSFORM_OPTIONS}
        onChange={(value) => updateStyle("textTransform", value)}
      />
      <DevSelect
        label="Font"
        value={draft.fontFamily}
        options={FONT_FAMILY_OPTIONS}
        onChange={(value) => updateStyle("fontFamily", value)}
      />
      <DevSelect
        label="Weight"
        value={draft.fontWeight}
        options={FONT_WEIGHT_OPTIONS}
        onChange={(value) => updateStyle("fontWeight", value)}
      />
      <DevSelect
        label="Style"
        value={draft.fontStyle}
        options={FONT_STYLE_OPTIONS}
        onChange={(value) => updateStyle("fontStyle", value)}
      />
      <DevColorInput
        label="Color"
        value={draft.color}
        onChange={(value) => updateStyle("color", value)}
      />
      <DevRange
        label="Opacity"
        value={draft.opacity}
        min={0}
        max={1}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(value) => updateStyle("opacity", value)}
      />
    </DevControlGroup>
  );
}

function ComputedValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={computedLabelStyle}>{label}</span>
      <span style={computedValueStyle}>{value || "n/a"}</span>
    </div>
  );
}

function DevTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={devTextFieldRowStyle}>
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={devTextInputStyle}
      />
    </label>
  );
}

function DevColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={devColorInputStyle}
      />
      <span style={devControlValueStyle}>{value}</span>
    </label>
  );
}

function DevRange({
  label,
  value,
  min,
  max,
  step,
  format = (next) => `${next.toFixed(0)} px`,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        style={{
          minWidth: 0,
          "--editor-slider-fill": `${((value - min) / (max - min)) * 100}%`,
        } as React.CSSProperties}
      />
      <span style={devControlValueStyle}>{format(value)}</span>
    </label>
  );
}

function DevSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        style={devSelectStyle}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DevCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={devControlRowStyle}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ justifySelf: "start" }}
      />
      <span style={devControlValueStyle}>{checked ? "on" : "off"}</span>
    </label>
  );
}

function isTypingTarget(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function isDevModeControlTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-dev-mode-control]"));
}

function containerLabelGeometry(
  rect: DOMRect,
  name: string,
  type: string,
): ContainerLabelGeometry {
  const width = Math.min(
    300,
    Math.max(148, (name.length + type.length + 3) * 6.2),
  );
  const left = Math.max(4, rect.left - width - 24);
  const top = Math.max(
    4,
    Math.min(
      window.innerHeight - 22,
      rect.top + Math.max(0, Math.min(12, rect.height / 2 - 10)),
    ),
  );
  const lineY = top + 11;
  const lineStartX = left + width;
  const lineEndX = Math.max(lineStartX + 8, rect.left);
  const lineEndY = Math.min(
    Math.max(rect.top + 8, lineY),
    rect.bottom - 8,
  );
  return { left, top, width, lineY, lineStartX, lineEndX, lineEndY };
}

function controlPanelPlacement(info: HoverInfo): {
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function collectContainerOutlines(): ContainerOutlineInfo[] {
  return Array.from(
    document.querySelectorAll(`[${CONTAINER_ATTR}="true"]`),
  ).flatMap((element, index) => {
    if (!(element instanceof HTMLElement)) return [];
    if (element.closest("[data-dev-mode-control]")) return [];
    const rect = element.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return [];
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return [];
    }
    const type = element.getAttribute(CONTAINER_TYPE_ATTR) ?? genericContainerType(element);
    const name =
      element.getAttribute(CONTAINER_NAME_ATTR) ??
      element.getAttribute("aria-label") ??
      cleanText(element.textContent) ??
      element.tagName.toLowerCase();
    const source = element.getAttribute(SOURCE_ATTR) ?? "unknown";
    return [
      {
        key: `${type}:${name}:${source}:${index}`,
        rect,
        name,
        type,
        scope: element.getAttribute(CONTAINER_SCOPE_ATTR) ?? undefined,
        element,
      },
    ];
  });
}

function genericContainerType(element: Element | undefined): string {
  if (!element) return "unknown";
  const attrType = element.getAttribute(CONTAINER_TYPE_ATTR);
  if (attrType) return attrType;
  const role = element.getAttribute("role");
  if (role) return `${element.tagName.toLowerCase()}[${role}]`;
  return element.tagName.toLowerCase();
}

function findPrimaryTextElement(
  preferred: Element | undefined,
  fallback: Element,
): HTMLElement | undefined {
  const candidates = [preferred, fallback];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (
      candidate instanceof HTMLElement &&
      candidate.hasAttribute(TEXT_SOURCE_ATTR)
    ) {
      return candidate;
    }
    const closest = candidate.closest?.(`[${TEXT_SOURCE_ATTR}]`);
    if (closest instanceof HTMLElement) return closest;
    const child = candidate.querySelector?.(`[${TEXT_SOURCE_ATTR}]`);
    if (child instanceof HTMLElement) return child;
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof HTMLElement && readEditableText(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function readEditableText(element: HTMLElement): string {
  const directText = Array.from(element.childNodes)
    .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.nodeValue ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return directText || element.textContent?.replace(/\s+/g, " ").trim() || "";
}

function writeEditableText(element: HTMLElement, value: string) {
  const directText = Array.from(element.childNodes).find(
    (node): node is Text =>
      node.nodeType === Node.TEXT_NODE && Boolean((node.nodeValue ?? "").trim()),
  );
  if (directText) {
    directText.nodeValue = value;
    return;
  }
  element.textContent = value;
}

function readTextDraft(element: HTMLElement | null): TextDraft {
  if (!element) {
    return {
      text: "",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: "600",
      fontStyle: "normal",
      textTransform: "none",
      color: "#f4f0e8",
      opacity: 1,
    };
  }
  const style = getComputedStyle(element);
  return {
    text: readEditableText(element),
    fontSize: cssNumber(style.fontSize) || 13,
    fontFamily: normalizeFontFamily(style.fontFamily),
    fontWeight: normalizeFontWeight(style.fontWeight),
    fontStyle: normalizeOption(style.fontStyle, FONT_STYLE_OPTIONS, "normal"),
    textTransform: normalizeOption(
      style.textTransform,
      TEXT_TRANSFORM_OPTIONS,
      "none",
    ),
    color: cssColorToHex(style.color),
    opacity: clampNumber(cssNumber(style.opacity) || 1, 0, 1),
  };
}

function applyTextStyle<K extends keyof TextDraft>(
  element: HTMLElement,
  key: K,
  value: TextDraft[K],
) {
  if (key === "fontSize") {
    element.style.fontSize = `${value}px`;
    return;
  }
  if (key === "fontFamily") {
    element.style.fontFamily = value === "inherit" ? "" : String(value);
    return;
  }
  if (key === "fontWeight") {
    element.style.fontWeight = String(value);
    return;
  }
  if (key === "fontStyle") {
    element.style.fontStyle = String(value);
    return;
  }
  if (key === "textTransform") {
    element.style.textTransform = String(value);
    return;
  }
  if (key === "color") {
    element.style.color = String(value);
    return;
  }
  if (key === "opacity") {
    element.style.opacity = String(value);
  }
}

function normalizeFontFamily(fontFamily: string): typeof FONT_FAMILY_OPTIONS[number] {
  const lower = fontFamily.toLowerCase();
  if (lower.includes("georgia")) return "Georgia, serif";
  if (lower.includes("arial")) return "Arial, Helvetica, sans-serif";
  if (lower.includes("consolas")) return "Consolas, monospace";
  if (lower.includes("system")) return "system-ui, sans-serif";
  if (lower.includes("mono")) return TECHNICAL_MONO_FONT;
  return "inherit";
}

function normalizeFontWeight(weight: string): typeof FONT_WEIGHT_OPTIONS[number] {
  const numeric = Number.parseInt(weight, 10);
  if (!Number.isFinite(numeric)) return "600";
  if (numeric <= 400) return "400";
  if (numeric <= 500) return "500";
  if (numeric <= 600) return "600";
  if (numeric <= 700) return "700";
  return "800";
}

function normalizeOption<T extends readonly string[]>(
  value: string,
  options: T,
  fallback: T[number],
): T[number] {
  return options.includes(value) ? value : fallback;
}

function cssColorToHex(value: string): string {
  const rgb = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgb) return "#f4f0e8";
  const parts = rgb[1]
    .split(",")
    .slice(0, 3)
    .map((part) => clampNumber(Number.parseFloat(part.trim()), 0, 255));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return "#f4f0e8";
  }
  return `#${parts
    .map((part) => Math.round(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function findTextHit(x: number, y: number):
  | { element: Element; source?: string; note?: string; label: string }
  | null {
  const node = getTextNodeAtPoint(x, y);
  if (!node || !cleanText(node.textContent)) return null;
  const element = node.parentElement;
  if (!element) return null;

  const textSourceElement = element.closest(`[${TEXT_SOURCE_ATTR}]`);
  const annotated = element.closest(`[${SOURCE_ATTR}]`);
  const source =
    textSourceElement?.getAttribute(TEXT_SOURCE_ATTR) ??
    annotated?.getAttribute(SOURCE_ATTR) ??
    readReactDebugSource(element)?.source;

  return {
    element: textSourceElement ?? annotated ?? element,
    source,
    note: textSourceElement
      ? textSourceElement.getAttribute(NOTE_ATTR) ?? undefined
      : "Text node hit. Add data-dev-text-source for a more exact text-location tag.",
    label: `text "${cleanText(node.textContent)}"`,
  };
}

function getTextNodeAtPoint(x: number, y: number): Text | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const position = doc.caretPositionFromPoint?.(x, y);
  if (position?.offsetNode.nodeType === Node.TEXT_NODE) {
    return position.offsetNode as Text;
  }

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range?.startContainer.nodeType === Node.TEXT_NODE) {
    return range.startContainer as Text;
  }

  return null;
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  const sourceLabel =
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    cleanText(element.textContent);
  return [tag, role ? `[role=${role}]` : "", sourceLabel]
    .filter(Boolean)
    .join(" ");
}

function readBoxModel(element: Element): BoxModelInfo {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const borderTop = cssNumber(style.borderTopWidth);
  const borderRight = cssNumber(style.borderRightWidth);
  const borderBottom = cssNumber(style.borderBottomWidth);
  const borderLeft = cssNumber(style.borderLeftWidth);
  const paddingTop = cssNumber(style.paddingTop);
  const paddingRight = cssNumber(style.paddingRight);
  const paddingBottom = cssNumber(style.paddingBottom);
  const paddingLeft = cssNumber(style.paddingLeft);

  const paddingBox = {
    left: rect.left + borderLeft,
    top: rect.top + borderTop,
    right: rect.right - borderRight,
    bottom: rect.bottom - borderBottom,
  };
  const content = {
    left: paddingBox.left + paddingLeft,
    top: paddingBox.top + paddingTop,
    width: Math.max(0, paddingBox.right - paddingBox.left - paddingLeft - paddingRight),
    height: Math.max(0, paddingBox.bottom - paddingBox.top - paddingTop - paddingBottom),
  };

  return {
    rect,
    content,
    paddingTop:
      paddingTop > 0
        ? {
            left: paddingBox.left,
            top: paddingBox.top,
            width: Math.max(0, paddingBox.right - paddingBox.left),
            height: paddingTop,
          }
        : null,
    paddingRight:
      paddingRight > 0
        ? {
            left: paddingBox.right - paddingRight,
            top: content.top,
            width: paddingRight,
            height: content.height,
          }
        : null,
    paddingBottom:
      paddingBottom > 0
        ? {
            left: paddingBox.left,
            top: paddingBox.bottom - paddingBottom,
            width: Math.max(0, paddingBox.right - paddingBox.left),
            height: paddingBottom,
          }
        : null,
    paddingLeft:
      paddingLeft > 0
        ? {
            left: paddingBox.left,
            top: content.top,
            width: paddingLeft,
            height: content.height,
          }
        : null,
  };
}

function readPaddingHit(
  element: Element,
  x: number,
  y: number,
  fallbackSource?: string,
): PaddingHit | undefined {
  const box = readBoxModel(element);
  const sides = [
    box.paddingTop && containsPoint(box.paddingTop, x, y) ? "top" : null,
    box.paddingRight && containsPoint(box.paddingRight, x, y) ? "right" : null,
    box.paddingBottom && containsPoint(box.paddingBottom, x, y) ? "bottom" : null,
    box.paddingLeft && containsPoint(box.paddingLeft, x, y) ? "left" : null,
  ].filter((side): side is string => !!side);
  if (sides.length === 0) return undefined;

  const paddingSource =
    element.closest(`[${PADDING_SOURCE_ATTR}]`)?.getAttribute(PADDING_SOURCE_ATTR) ??
    element.closest(`[${SOURCE_ATTR}]`)?.getAttribute(SOURCE_ATTR) ??
    fallbackSource ??
    "No padding source tag found";
  return { sides, source: paddingSource };
}

function containsPoint(rect: RectLike, x: number, y: number): boolean {
  return (
    x >= rect.left &&
    x <= rect.left + rect.width &&
    y >= rect.top &&
    y <= rect.top + rect.height
  );
}

function cssNumber(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > 44 ? `${cleaned.slice(0, 41)}...` : cleaned;
}

function readReactDebugSource(element: Element):
  | { source: string; note: string; element: Element }
  | null {
  const reactKey = Object.keys(element).find((key) =>
    key.startsWith("__reactFiber$"),
  );
  if (!reactKey) return null;

  let fiber = (element as unknown as Record<string, unknown>)[reactKey] as
    | Record<string, unknown>
    | undefined;
  if (!fiber) return null;

  while (fiber) {
    const debugSource = fiber._debugSource as
      | { fileName?: string; lineNumber?: number; columnNumber?: number }
      | undefined;
    if (debugSource?.fileName && debugSource.lineNumber) {
      const source = `${shortenPath(debugSource.fileName)}:${debugSource.lineNumber}`;
      return {
        source,
        note: "React dev source fallback. Add data-dev-source for a more specific style location.",
        element,
      };
    }
    fiber = fiber.return as Record<string, unknown> | undefined;
  }
  return null;
}

function shortenPath(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/");
  const srcIndex = normalized.lastIndexOf("/src/");
  if (srcIndex >= 0) return normalized.slice(srcIndex + 1);
  return normalized;
}

const devModeBadgeStyle: React.CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 12,
  zIndex: 2147483647,
  padding: "6px 10px",
  border: FROSTED_HAIRLINE,
  borderRadius: 999,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  pointerEvents: "none",
  ...regularLightMaterial,
};

const CONTROL_PANEL_WIDTH_PX = 392;

const containerOutlineStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483641,
  border: "1px solid rgba(244, 240, 232, 0.62)",
  boxShadow: "0 0 0 1px rgba(0, 122, 255, 0.18)",
  borderRadius: 8,
  pointerEvents: "none",
  boxSizing: "border-box",
};

const selectedContainerOutlineStyle: React.CSSProperties = {
  border: "2px solid rgba(255, 214, 102, 0.94)",
  boxShadow: "0 0 0 3px rgba(255, 214, 102, 0.18)",
};

const containerPointerSvgStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 2147483642,
  pointerEvents: "none",
};

const containerPointerLineStyle: React.CSSProperties = {
  stroke: "rgba(244, 240, 232, 0.58)",
  strokeWidth: 1,
  strokeDasharray: "3 3",
};

const selectedContainerPointerLineStyle: React.CSSProperties = {
  ...containerPointerLineStyle,
  stroke: "rgba(255, 214, 102, 0.94)",
  strokeWidth: 1.5,
};

const containerPointerDotStyle: React.CSSProperties = {
  fill: "rgba(244, 240, 232, 0.68)",
};

const selectedContainerPointerDotStyle: React.CSSProperties = {
  fill: "rgba(255, 214, 102, 0.94)",
};

const containerLabelStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483642,
  padding: "2px 6px",
  borderRadius: 6,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.82)",
  border: FROSTED_HAIRLINE,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 10,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  pointerEvents: "none",
  boxSizing: "border-box",
};

const highlightStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483645,
  border: "1px solid rgba(0, 122, 255, 0.85)",
  boxShadow: "0 0 0 2px rgba(0, 122, 255, 0.18)",
  borderRadius: 8,
  pointerEvents: "none",
};

const controlPanelStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483647,
  width: CONTROL_PANEL_WIDTH_PX,
  boxSizing: "border-box",
  overflowY: "auto",
  padding: 12,
  border: FROSTED_HAIRLINE,
  borderRadius: 14,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  lineHeight: 1.35,
  pointerEvents: "auto",
  ...regularLightMaterial,
};

const controlPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 8,
};

const controlPanelKickerStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const controlPanelTitleStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontSize: 14,
  fontWeight: 700,
};

const controlPanelCloseStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  border: FROSTED_HAIRLINE,
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.54)",
  cursor: "pointer",
  font: "inherit",
};

const controlPanelScrollHintStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483648,
  width: CONTROL_PANEL_WIDTH_PX,
  boxSizing: "border-box",
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  borderBottomLeftRadius: 14,
  borderBottomRightRadius: 14,
  background:
    "linear-gradient(180deg, rgba(18, 21, 24, 0), rgba(18, 21, 24, 0.9))",
};

const controlPanelScrollHintChevronStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRight: `2px solid ${vibrancyLabel}`,
  borderBottom: `2px solid ${vibrancyLabel}`,
  transform: "rotate(45deg)",
};

const controlPanelMetaStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  fontSize: 11,
  display: "grid",
  gap: 3,
  marginBottom: 10,
  wordBreak: "break-word",
};

const computedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  marginBottom: 12,
  paddingBottom: 10,
  borderBottom: FROSTED_HAIRLINE,
};

const computedLabelStyle: React.CSSProperties = {
  display: "block",
  color: vibrancyTertiaryLabel,
  fontSize: 10,
};

const computedValueStyle: React.CSSProperties = {
  display: "block",
  color: vibrancySecondaryLabel,
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const controlGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 0",
  borderBottom: FROSTED_HAIRLINE,
};

const controlGroupTitleStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontWeight: 700,
  marginTop: 2,
};

const controlPanelLowLevelLabelStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0,
  margin: "10px 0 2px",
  textTransform: "uppercase",
};

const devControlRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "104px minmax(0, 1fr) 70px",
  alignItems: "center",
  gap: 8,
  color: vibrancySecondaryLabel,
};

const devTextFieldRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "104px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  color: vibrancySecondaryLabel,
};

const devTextInputStyle: React.CSSProperties = {
  minWidth: 0,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: "5px 8px",
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.72)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 11,
};

const devColorInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 24,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: 2,
  background: "rgba(18, 21, 24, 0.72)",
};

const devControlValueStyle: React.CSSProperties = {
  color: vibrancyLabel,
  fontSize: 11,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const devSelectStyle: React.CSSProperties = {
  gridColumn: "2 / 4",
  minWidth: 0,
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  padding: "4px 8px",
  color: vibrancyLabel,
  background: "rgba(18, 21, 24, 0.72)",
  fontFamily: TECHNICAL_MONO_FONT,
};

function paddingRectStyle(rect: RectLike): React.CSSProperties {
  return {
    position: "fixed",
    zIndex: 2147483644,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    background: "rgba(255, 149, 0, 0.32)",
    border: "1px solid rgba(255, 149, 0, 0.62)",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}

function contentRectStyle(rect: RectLike): React.CSSProperties {
  return {
    position: "fixed",
    zIndex: 2147483644,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    border: "1px dashed rgba(0, 122, 255, 0.8)",
    boxSizing: "border-box",
    pointerEvents: "none",
  };
}

const tooltipStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2147483646,
  width: 316,
  padding: "8px 10px",
  border: FROSTED_HAIRLINE,
  borderRadius: 10,
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  lineHeight: 1.35,
  pointerEvents: "none",
  ...regularLightMaterial,
};

const tooltipKickerStyle: React.CSSProperties = {
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  marginBottom: 2,
};

const tooltipSourceStyle: React.CSSProperties = {
  fontWeight: 700,
  color: vibrancyLabel,
};

const tooltipPaddingStyle: React.CSSProperties = {
  marginTop: 4,
  fontWeight: 700,
  color: "rgba(168, 92, 0, 0.95)",
};

const tooltipNoteStyle: React.CSSProperties = {
  color: vibrancySecondaryLabel,
  marginTop: 4,
};
