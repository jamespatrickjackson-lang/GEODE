import { useEffect, useState } from "react";
import {
  FONT_FAMILY_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
} from "./constants";
import {
  DevColorInput,
  DevControlGroup,
  DevRange,
  DevSelect,
  DevTextField,
} from "./controls";
import { controlPanelMetaStyle, untaggedTextNoteStyle } from "./styles";
import type { DevTextOverride } from "./overrideStore";
import {
  applyTextStyle,
  readTextDraft,
  writeEditableText,
  type TextDraft,
} from "./text";
import type { HoverInfo } from "./types";

export function DevTextControls({
  info,
  overrideKey,
  onPersist,
}: {
  info: HoverInfo;
  overrideKey: string | null;
  onPersist: (patch: DevTextOverride) => void;
}) {
  const target = info.textElement ?? null;
  const [draft, setDraft] = useState<TextDraft>(() => readTextDraft(target));

  useEffect(() => {
    setDraft(readTextDraft(target));
  }, [target]);

  if (!target) return null;

  const updateText = (value: string) => {
    writeEditableText(target, value);
    setDraft((current) => ({ ...current, text: value }));
    if (overrideKey) onPersist({ text: value });
  };
  const updateStyle = <K extends keyof TextDraft>(
    key: K,
    value: TextDraft[K],
  ) => {
    applyTextStyle(target, key, value);
    setDraft((current) => ({ ...current, [key]: value }));
    if (overrideKey) onPersist({ [key]: value } as DevTextOverride);
  };

  return (
    <DevControlGroup title="Text">
      <div style={controlPanelMetaStyle}>
        <div>text source: {info.textSource ?? "runtime text node"}</div>
      </div>
      {!overrideKey && (
        <div style={untaggedTextNoteStyle}>
          Session only - not persistable. Add a data-dev-text-source tag to save.
        </div>
      )}
      <DevTextField label="Text" value={draft.text} onChange={updateText} />
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
