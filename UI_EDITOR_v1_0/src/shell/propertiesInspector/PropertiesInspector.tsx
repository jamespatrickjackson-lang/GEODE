import { theme } from "../styles/theme";
import { useShell } from "../state/ShellContext";
import { NumberEditor } from "./PropertyEditors/NumberEditor";
import { TextEditor } from "./PropertyEditors/TextEditor";
import { ColourEditor } from "./PropertyEditors/ColourEditor";
import { VariantEditor } from "./PropertyEditors/VariantEditor";
import { ConstraintEditor } from "./PropertyEditors/ConstraintEditor";
import {
  dispatchIntentEdit,
  dispatchPropertyChange,
  dispatchResize,
  dispatchEffectsPatch,
  dispatchStyleApplied,
  dispatchStyleDetached,
  resolveSelection,
  sharedPropertyValue,
  type SelectionItem,
} from "./inspectorActions";

export function PropertiesInspector() {
  const { state, dispatch } = useShell();
  const items = resolveSelection(state.pkg, state.selection);

  if (!state.pkg || items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          background: theme.background.panel,
          color: theme.foreground.tertiary,
          font: `${theme.font.bodySize}px ${theme.font.ui}`,
          padding: theme.spacing.sm,
          overflowY: "auto",
        }}
      >
        Properties — no selection.
      </div>
    );
  }

  const pkg = state.pkg;
  const isMulti = items.length > 1;
  const isLocked = items.every((i) => i.element.locked);
  const styleRef = sharedPropertyValue(items, (i) => i.element.styleRef ?? "");
  const intentName = sharedPropertyValue(items, (i) => i.element.intent?.name ?? "");
  const intentText = sharedPropertyValue(items, (i) => i.element.intent?.intent ?? "");
  const intentBehaviour = sharedPropertyValue(
    items,
    (i) => i.element.intent?.behaviour ?? "",
  );
  const intentDataBinding = sharedPropertyValue(
    items,
    (i) => i.element.intent?.dataBinding ?? "",
  );

  const rect = !isMulti ? items[0]!.element.rect : null;
  const constraints = !isMulti ? items[0]!.element.constraints : "multiple" as const;
  const first = items[0]!;
  const opacityValue = sharedPropertyValue(items, (i) => i.element.effects?.opacity ?? 1);
  const blurValue = sharedPropertyValue(items, (i) => {
    const b = i.element.effects?.blur;
    return typeof b === "number" ? b : 0;
  });

  return (
    <div
      style={{
        flex: 1,
        background: theme.background.panel,
        color: theme.foreground.primary,
        font: `${theme.font.bodySize}px ${theme.font.ui}`,
        padding: theme.spacing.sm,
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <Section title={isMulti ? `${items.length} elements` : (items[0]!.element.name ?? items[0]!.element.id)}>
        <KvRow label="Archetype" value={isMulti ? "multiple" : items[0]!.element.archetype} />
        <KvRow label="Kind" value={isMulti ? "multiple" : items[0]!.kind} />
        {isLocked && (
          <div style={{ color: theme.severity.warning, fontSize: 11, marginTop: 4 }}>
            Locked — properties read-only.
          </div>
        )}
      </Section>

      <Section title="Intent">
        <TextEditor
          label="Name"
          value={intentName.value}
          disabled={isLocked}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchIntentEdit(pkg, dispatch, { kind: i.kind, id: i.element.id }, { name: v }),
            )
          }
        />
        <TextEditor
          label="Intent"
          value={intentText.value}
          multiline
          disabled={isLocked}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchIntentEdit(pkg, dispatch, { kind: i.kind, id: i.element.id }, { intent: v }),
            )
          }
        />
        <TextEditor
          label="Behaviour"
          value={intentBehaviour.value}
          multiline
          disabled={isLocked}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchIntentEdit(pkg, dispatch, { kind: i.kind, id: i.element.id }, { behaviour: v }),
            )
          }
        />
        <TextEditor
          label="Data binding"
          value={intentDataBinding.value}
          disabled={isLocked}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchIntentEdit(pkg, dispatch, { kind: i.kind, id: i.element.id }, { dataBinding: v }),
            )
          }
        />
      </Section>

      {!isMulti && rect ? (
        <Section title="Rect">
          <NumberEditor
            label="x"
            value={rect.x}
            disabled={isLocked}
            onCommit={(v) =>
              dispatchResize(pkg, dispatch, { kind: first.kind, id: first.element.id }, { ...rect, x: v })
            }
          />
          <NumberEditor
            label="y"
            value={rect.y}
            disabled={isLocked}
            onCommit={(v) =>
              dispatchResize(pkg, dispatch, { kind: first.kind, id: first.element.id }, { ...rect, y: v })
            }
          />
          <NumberEditor
            label="width"
            value={rect.w}
            min={1}
            disabled={isLocked}
            onCommit={(v) =>
              dispatchResize(pkg, dispatch, { kind: first.kind, id: first.element.id }, { ...rect, w: v })
            }
          />
          <NumberEditor
            label="height"
            value={rect.h}
            min={1}
            disabled={isLocked}
            onCommit={(v) =>
              dispatchResize(pkg, dispatch, { kind: first.kind, id: first.element.id }, { ...rect, h: v })
            }
          />
        </Section>
      ) : null}

      <Section title="Constraints">
        <ConstraintEditor
          value={constraints}
          disabled={isLocked || isMulti}
          onCommit={(next) =>
            first &&
            dispatchPropertyChange(
              pkg,
              dispatch,
              { kind: first.kind, id: first.element.id },
              "constraints",
              next,
            )
          }
        />
      </Section>

      <Section title="Style">
        <VariantEditor
          label="Style"
          value={styleRef.value === "" ? "(none)" : styleRef.value}
          options={[
            { value: "(none)", label: "(none)" },
            ...pkg.libraries.styles.map((s) => ({ value: s.id, label: s.name })),
          ]}
          disabled={isLocked}
          onCommit={(v) => {
            if (v === "(none)") dispatchStyleDetached(pkg, dispatch, state.selection);
            else dispatchStyleApplied(pkg, dispatch, state.selection, v);
          }}
        />
      </Section>

      <Section title="Effects">
        <NumberEditor
          label="Opacity"
          value={opacityValue.value}
          disabled={isLocked}
          min={0}
          max={1}
          step={0.05}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchEffectsPatch(pkg, dispatch, { kind: i.kind, id: i.element.id }, { opacity: v }),
            )
          }
        />
        <NumberEditor
          label="Blur (px)"
          value={blurValue.value}
          disabled={isLocked}
          min={0}
          max={48}
          step={1}
          onCommit={(v) =>
            items.forEach((i) =>
              dispatchEffectsPatch(pkg, dispatch, { kind: i.kind, id: i.element.id }, { blur: v }),
            )
          }
        />
      </Section>

      {!isMulti && first.kind === "component" ? (
        <ComponentPropsEditor item={first} disabled={isLocked} />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: theme.spacing.md }}>
      <div
        style={{
          color: theme.foreground.tertiary,
          textTransform: "uppercase",
          fontSize: theme.font.bodySize - 1,
          letterSpacing: 0.5,
          marginBottom: 4,
          paddingBottom: 2,
          borderBottom: theme.border.hairline,
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "2px 0" }}>
      <span style={{ width: 90, color: theme.foreground.tertiary, fontSize: 11 }}>{label}</span>
      <span style={{ color: theme.foreground.secondary, fontSize: 12 }}>{value}</span>
    </div>
  );
}

function ComponentPropsEditor({ item, disabled }: { item: SelectionItem; disabled: boolean }) {
  const { state, dispatch } = useShell();
  if (item.kind !== "component" || !state.pkg) return null;
  const pkg = state.pkg;
  const props = item.element.props;
  const sel = { kind: "component" as const, id: item.element.id };

  function set(path: string, value: unknown) {
    dispatchPropertyChange(pkg, dispatch, sel, path, value);
  }

  if (props.archetype === "pill-button") {
    return (
      <Section title="Pill button">
        <TextEditor label="Label" value={props.label} disabled={disabled} onCommit={(v) => set("label", v)} />
        <VariantEditor
          label="Surface"
          value={props.surface}
          options={[
            { value: "dark", label: "Dark" },
            { value: "tinted", label: "Tinted" },
          ]}
          disabled={disabled}
          onCommit={(v) => set("surface", v)}
        />
        {props.fill && "hex" in props.fill && (
          <ColourEditor
            label="Fill"
            hex={props.fill.hex}
            alpha={props.fill.alpha}
            disabled={disabled}
            onCommit={(hex, alpha) => set("fill", { hex, alpha })}
          />
        )}
      </Section>
    );
  }
  if (props.archetype === "text" || props.archetype === "inline-editable-text") {
    return (
      <Section title={props.archetype}>
        <TextEditor
          label="Value"
          value={props.value}
          multiline={props.archetype === "text"}
          disabled={disabled}
          onCommit={(v) => set("value", v)}
        />
        <NumberEditor
          label="Font size"
          value={typeof props.fontSize === "number" ? props.fontSize : 13}
          min={8}
          max={64}
          step={1}
          disabled={disabled}
          onCommit={(v) => set("fontSize", v)}
        />
      </Section>
    );
  }
  if (props.archetype === "slider") {
    return (
      <Section title="Slider">
        <TextEditor label="Label" value={props.label} disabled={disabled} onCommit={(v) => set("label", v)} />
        <NumberEditor label="Min" value={props.min} disabled={disabled} onCommit={(v) => set("min", v)} />
        <NumberEditor label="Max" value={props.max} disabled={disabled} onCommit={(v) => set("max", v)} />
        <NumberEditor label="Value" value={props.value} disabled={disabled} onCommit={(v) => set("value", v)} />
      </Section>
    );
  }
  if (props.archetype === "icon-button" || props.archetype === "footer-action-button") {
    return (
      <Section title={props.archetype}>
        <TextEditor
          label="aria-label"
          value={props.ariaLabel}
          disabled={disabled}
          onCommit={(v) => set("ariaLabel", v)}
        />
        <TextEditor
          label="Icon id"
          value={props.iconLibraryEntryId}
          disabled={disabled}
          onCommit={(v) => set("iconLibraryEntryId", v)}
        />
      </Section>
    );
  }
  if (props.archetype === "rectangle" || props.archetype === "ellipse") {
    return (
      <Section title={props.archetype}>
        {props.fill && "hex" in props.fill && (
          <ColourEditor
            label="Fill"
            hex={props.fill.hex}
            alpha={props.fill.alpha}
            disabled={disabled}
            onCommit={(hex, alpha) => set("fill", { hex, alpha })}
          />
        )}
      </Section>
    );
  }
  if (props.archetype === "tooltip") {
    return (
      <Section title="Tooltip">
        <TextEditor label="Text" value={props.text} multiline disabled={disabled} onCommit={(v) => set("text", v)} />
      </Section>
    );
  }
  return (
    <Section title={props.archetype}>
      <div style={{ color: theme.foreground.tertiary, fontSize: 11 }}>
        No dedicated editor yet — raw JSON props are not editable in v1.
      </div>
    </Section>
  );
}
