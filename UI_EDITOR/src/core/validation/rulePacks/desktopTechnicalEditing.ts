import type { ValidationFinding, ValidationRule, ValidationRulePack } from "../../schema/validation";
import type { Package } from "../../schema/package";
import type { Container } from "../../schema/container";
import type { Component } from "../../schema/component";
import type { Frame } from "../../schema/frame";

const PROFILE_ID = "desktop-technical-editing";

function fComp(
  pkg: Package,
  frame: Frame,
  c: Component,
  ruleId: string,
  severity: ValidationFinding["severity"],
  message: string,
  extra?: Partial<ValidationFinding>,
): ValidationFinding {
  return {
    ruleId,
    severity,
    message,
    profileId: PROFILE_ID,
    location: { packageId: pkg.manifest.id, frameId: frame.id, componentId: c.id },
    ...extra,
  };
}

function fCont(
  pkg: Package,
  frame: Frame,
  c: Container,
  ruleId: string,
  severity: ValidationFinding["severity"],
  message: string,
  extra?: Partial<ValidationFinding>,
): ValidationFinding {
  return {
    ruleId,
    severity,
    message,
    profileId: PROFILE_ID,
    location: { packageId: pkg.manifest.id, frameId: frame.id, containerId: c.id },
    ...extra,
  };
}

const touchTargetRule: ValidationRule = {
  id: "component.touch-target-min",
  severity: "suggestion",
  description: "Component min(w, h) ≥ 24 px",
  appliesTo: "component",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const clickable = new Set(["pill-button", "icon-button", "footer-action-button", "checkbox", "colour-swatch", "toggle-button"]);
    for (const c of ctx.components) {
      if (!clickable.has(c.archetype)) continue;
      const min = Math.min(c.rect.w, c.rect.h);
      if (min < 24) {
        out.push(
          fComp(ctx.pkg, ctx.frame, c, "component.touch-target-min", "suggestion",
            `Touch target is ${min} px; suggested minimum is 24 px even on desktop.`,
            { currentValue: min, suggestedValue: 24 }),
        );
      }
    }
    return out;
  },
};

const buttonLabelNonEmpty: ValidationRule = {
  id: "component.button.label-non-empty",
  severity: "warning",
  description: "Pill / footer action buttons must have non-empty labels.",
  appliesTo: "component",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const c of ctx.components) {
      if (c.archetype !== "pill-button" && c.archetype !== "footer-action-button") continue;
      const label = (c.props as { label?: string }).label;
      if (!label || label.trim().length === 0) {
        out.push(fComp(ctx.pkg, ctx.frame, c, "component.button.label-non-empty", "warning", "Button has empty label."));
      }
    }
    return out;
  },
};

const textFontSizeMin: ValidationRule = {
  id: "component.text.font-size-min",
  severity: "warning",
  description: "Body text must be ≥ 11 px",
  appliesTo: "component",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const c of ctx.components) {
      if (!["text", "inline-editable-text", "numeric-label"].includes(c.archetype)) continue;
      const fs = (c.props as { fontSize?: number | { tokenRef: string } }).fontSize;
      const literal = typeof fs === "number" ? fs : undefined;
      if (literal !== undefined && literal < 11) {
        out.push(fComp(ctx.pkg, ctx.frame, c, "component.text.font-size-min", "warning",
          `Font size ${literal} px is below the 11 px desktop minimum for body text.`,
          { currentValue: literal, suggestedValue: 11 }));
      }
    }
    return out;
  },
};

const textFontSizeSuggested: ValidationRule = {
  id: "component.text.font-size-suggested",
  severity: "suggestion",
  description: "Suggested body text size ≥ 13 px",
  appliesTo: "component",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const c of ctx.components) {
      if (!["text", "inline-editable-text"].includes(c.archetype)) continue;
      const fs = (c.props as { fontSize?: number | { tokenRef: string } }).fontSize;
      const literal = typeof fs === "number" ? fs : undefined;
      if (literal !== undefined && literal < 13) {
        out.push(fComp(ctx.pkg, ctx.frame, c, "component.text.font-size-suggested", "suggestion",
          `Font size ${literal} px is below the 13 px suggested minimum for sustained reading.`,
          { currentValue: literal, suggestedValue: 13 }));
      }
    }
    return out;
  },
};

const elementOverlap: ValidationRule = {
  id: "layout.element-overlap.warning",
  severity: "warning",
  description: "Sibling elements should not overlap",
  appliesTo: "layout",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const all = [
      ...ctx.components.map((c) => ({ id: c.id, parentId: c.parentId, rect: c.rect, kind: "component" as const })),
      ...ctx.containers.map((c) => ({ id: c.id, parentId: c.parentId, rect: c.rect, kind: "container" as const })),
    ];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        if (a.parentId !== b.parentId) continue;
        if (!rectsIntersect(a.rect, b.rect)) continue;
        out.push({
          ruleId: "layout.element-overlap.warning",
          severity: "warning",
          message: `Element ${a.id} overlaps element ${b.id}.`,
          profileId: PROFILE_ID,
          location: { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id, componentId: a.kind === "component" ? a.id : undefined, containerId: a.kind === "container" ? a.id : undefined },
        });
      }
    }
    return out;
  },
};

const outsideSafeArea: ValidationRule = {
  id: "layout.element-outside-safe-area.forbidden",
  severity: "error",
  description: "Element wholly outside safe area",
  appliesTo: "layout",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const sa = ctx.frame.safeArea;
    if (!sa) return out;
    const saLeft = sa.left;
    const saTop = sa.top;
    const saRight = ctx.frame.size.w - sa.right;
    const saBottom = ctx.frame.size.h - sa.bottom;
    for (const el of ctx.components) {
      if (el.rect.x + el.rect.w <= saLeft || el.rect.x >= saRight || el.rect.y + el.rect.h <= saTop || el.rect.y >= saBottom) {
        out.push(fComp(ctx.pkg, ctx.frame, el, "layout.element-outside-safe-area.forbidden", "error", `Element ${el.id} sits outside the Safe Area.`));
      }
    }
    for (const el of ctx.containers) {
      if (el.rect.x + el.rect.w <= saLeft || el.rect.x >= saRight || el.rect.y + el.rect.h <= saTop || el.rect.y >= saBottom) {
        out.push(fCont(ctx.pkg, ctx.frame, el, "layout.element-outside-safe-area.forbidden", "error", `Element ${el.id} sits outside the Safe Area.`));
      }
    }
    return out;
  },
};

const outsideFrame: ValidationRule = {
  id: "layout.element-outside-frame.blocker",
  severity: "blocker",
  description: "Element wholly outside its frame",
  appliesTo: "layout",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const el of ctx.components) {
      if (el.parentId != null) continue;
      if (el.rect.x + el.rect.w <= 0 || el.rect.x >= ctx.frame.size.w || el.rect.y + el.rect.h <= 0 || el.rect.y >= ctx.frame.size.h) {
        out.push(fComp(ctx.pkg, ctx.frame, el, "layout.element-outside-frame.blocker", "blocker", `Element ${el.id} sits outside its Frame's bounds.`));
      }
    }
    for (const el of ctx.containers) {
      if (el.parentId != null) continue;
      if (el.rect.x + el.rect.w <= 0 || el.rect.x >= ctx.frame.size.w || el.rect.y + el.rect.h <= 0 || el.rect.y >= ctx.frame.size.h) {
        out.push(fCont(ctx.pkg, ctx.frame, el, "layout.element-outside-frame.blocker", "blocker", `Element ${el.id} sits outside its Frame's bounds.`));
      }
    }
    return out;
  },
};

const zeroSize: ValidationRule = {
  id: "layout.element-zero-size.warning",
  severity: "warning",
  description: "Element has zero dimension",
  appliesTo: "layout",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const el of ctx.components) {
      if (el.rect.w === 0 || el.rect.h === 0) {
        out.push(fComp(ctx.pkg, ctx.frame, el, "layout.element-zero-size.warning", "warning", `Element ${el.id} has a zero dimension.`));
      }
    }
    for (const el of ctx.containers) {
      if (el.rect.w === 0 || el.rect.h === 0) {
        out.push(fCont(ctx.pkg, ctx.frame, el, "layout.element-zero-size.warning", "warning", `Element ${el.id} has a zero dimension.`));
      }
    }
    return out;
  },
};

const negativeRect: ValidationRule = {
  id: "layout.element-negative-rect.blocker",
  severity: "blocker",
  description: "Element has invalid (negative) rect",
  appliesTo: "layout",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const el of ctx.components) {
      if (el.rect.w < 0 || el.rect.h < 0 || (el.parentId == null && el.rect.x < 0)) {
        out.push(fComp(ctx.pkg, ctx.frame, el, "layout.element-negative-rect.blocker", "blocker", `Element ${el.id} has invalid rect.`));
      }
    }
    for (const el of ctx.containers) {
      if (el.rect.w < 0 || el.rect.h < 0 || (el.parentId == null && el.rect.x < 0)) {
        out.push(fCont(ctx.pkg, ctx.frame, el, "layout.element-negative-rect.blocker", "blocker", `Element ${el.id} has invalid rect.`));
      }
    }
    return out;
  },
};

const unresolvedTokenRef: ValidationRule = {
  id: "library.unresolved-token-ref",
  severity: "warning",
  description: "Token reference not in package",
  appliesTo: "library",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const tokenIds = new Set(Object.keys(ctx.pkg.tokens));
    const walk = (val: unknown, location: ValidationFinding["location"]) => {
      if (val && typeof val === "object") {
        const tk = (val as { tokenRef?: string }).tokenRef;
        if (typeof tk === "string" && !tokenIds.has(tk)) {
          out.push({
            ruleId: "library.unresolved-token-ref",
            severity: "warning",
            message: `References Token \`${tk}\` which is not in the package's Token Library.`,
            profileId: PROFILE_ID,
            location,
          });
        }
        for (const v of Object.values(val as Record<string, unknown>)) walk(v, location);
      } else if (Array.isArray(val)) {
        for (const v of val) walk(v, location);
      }
    };
    for (const c of ctx.components) walk(c.props, { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id, componentId: c.id });
    for (const c of ctx.containers) walk(c, { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id, containerId: c.id });
    return out;
  },
};

const duplicateId: ValidationRule = {
  id: "library.duplicate-id",
  severity: "error",
  description: "Library duplicate id within a kind",
  appliesTo: "library",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const check = (kind: string, entries: ReadonlyArray<{ id: string }>) => {
      const seen = new Set<string>();
      for (const e of entries) {
        if (seen.has(e.id)) {
          out.push({
            ruleId: "library.duplicate-id",
            severity: "error",
            message: `Library kind \`${kind}\` has duplicate id \`${e.id}\`.`,
            profileId: PROFILE_ID,
            location: { packageId: ctx.pkg.manifest.id, libraryEntryId: e.id },
          });
        }
        seen.add(e.id);
      }
    };
    check("components", ctx.pkg.libraries.components);
    check("colours", ctx.pkg.libraries.colours);
    check("icons", ctx.pkg.libraries.icons);
    check("tokens", ctx.pkg.libraries.tokens);
    check("styles", ctx.pkg.libraries.styles);
    return out;
  },
};

const intentMissing: ValidationRule = {
  id: "intent.missing.suggestion",
  severity: "suggestion",
  description: "Element has no intent.intent",
  appliesTo: "global",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const c of ctx.components) {
      if (!c.intent?.intent) {
        out.push(fComp(ctx.pkg, ctx.frame, c, "intent.missing.suggestion", "suggestion",
          `${c.name ?? c.id} lacks an intent annotation. Downstream agents will not know why this element exists.`));
      }
    }
    return out;
  },
};

const intentDependsOnSelf: ValidationRule = {
  id: "intent.depends-on-self.error",
  severity: "error",
  description: "Element lists itself in dependsOn",
  appliesTo: "global",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    for (const c of ctx.components) {
      if (c.intent?.dependsOn?.includes(c.id)) {
        out.push(fComp(ctx.pkg, ctx.frame, c, "intent.depends-on-self.error", "error", `${c.name ?? c.id} cannot depend on itself.`));
      }
    }
    return out;
  },
};

const effectsOpacityOutOfRange: ValidationRule = {
  id: "effects.opacity-out-of-range.error",
  severity: "error",
  description: "Effects opacity out of [0,1]",
  appliesTo: "global",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    const check = (entityId: string, isComp: boolean, opacity: number | undefined) => {
      if (opacity === undefined) return;
      if (opacity < 0 || opacity > 1) {
        out.push({
          ruleId: "effects.opacity-out-of-range.error",
          severity: "error",
          message: `${entityId} has opacity ${opacity}; valid range is [0, 1].`,
          profileId: PROFILE_ID,
          location: { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id, ...(isComp ? { componentId: entityId } : { containerId: entityId }) },
          currentValue: opacity,
        });
      }
    };
    for (const c of ctx.components) check(c.id, true, c.effects?.opacity);
    for (const c of ctx.containers) check(c.id, false, c.effects?.opacity);
    return out;
  },
};

const frameBackgroundContrast: ValidationRule = {
  id: "frame.background.contrast-text-min",
  severity: "warning",
  description: "Frame text contrast over active background",
  appliesTo: "frame",
  run: (ctx) => {
    const out: ValidationFinding[] = [];
    if (!ctx.activeBackgroundId) return out;
    const bgRgb = backgroundRgbFor(ctx.activeBackgroundId);
    if (!bgRgb) return out;
    const bgLum = relativeLuminance(bgRgb);
    let worst = Infinity;
    for (const c of ctx.components) {
      if (!["text", "inline-editable-text", "numeric-label", "letter-glyph"].includes(c.archetype)) continue;
      const colour = (c.props as { colour?: { hex?: string; alpha?: number } }).colour;
      const rgb = colour ? rgbFromHex(colour.hex, colour.alpha) : { r: 244, g: 240, b: 232, a: 1 };
      const ratio = contrastRatio(rgb, bgLum);
      if (ratio < worst) worst = ratio;
    }
    if (worst < 4.5 && Number.isFinite(worst)) {
      out.push({
        ruleId: "frame.background.contrast-text-min",
        severity: "warning",
        message: `Worst-case text contrast on Frame ${ctx.frame.id} is ${worst.toFixed(2)}; WCAG AA requires 4.5:1.`,
        profileId: PROFILE_ID,
        location: { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id },
        currentValue: worst,
        suggestedValue: 4.5,
      });
    }
    return out;
  },
};

function backgroundRgbFor(id: string): { r: number; g: number; b: number } | null {
  switch (id) {
    case "plain_dark": return { r: 13, g: 14, b: 18 };
    case "plain_light": return { r: 244, g: 240, b: 232 };
    case "noise_low_contrast": return { r: 136, g: 136, b: 136 };
    case "terrain_capture": return { r: 110, g: 100, b: 75 };
    default: return null;
  }
}

function rgbFromHex(hex: string | undefined, alpha: number | undefined): { r: number; g: number; b: number; a: number } {
  if (!hex) return { r: 244, g: 240, b: 232, a: alpha ?? 1 };
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return { r: 244, g: 240, b: 232, a: alpha ?? 1 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: alpha ?? 1,
  };
}

function relativeLuminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrastRatio(fg: { r: number; g: number; b: number; a: number }, bgLum: number): number {
  const fgLum = relativeLuminance(fg);
  const [a, b] = fgLum > bgLum ? [fgLum, bgLum] : [bgLum, fgLum];
  return (a + 0.05) / (b + 0.05);
}

export const DESKTOP_TECHNICAL_EDITING: ValidationRulePack = {
  id: "desktop-technical-editing",
  version: 1,
  description: "Default rule pack for mouse + keyboard on ≥1080p monitors used for technical authoring.",
  triggerProfile: {
    deviceId: "desktop-1080p",
    inputId: "mouse-keyboard",
    useCaseId: "technical-editing",
  },
  rules: [
    touchTargetRule,
    buttonLabelNonEmpty,
    textFontSizeMin,
    textFontSizeSuggested,
    elementOverlap,
    outsideSafeArea,
    outsideFrame,
    zeroSize,
    negativeRect,
    unresolvedTokenRef,
    duplicateId,
    intentMissing,
    intentDependsOnSelf,
    effectsOpacityOutOfRange,
    frameBackgroundContrast,
  ],
};

function rectsIntersect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
