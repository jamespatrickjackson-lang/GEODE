import type { Package } from "../schema/package";

export interface ExportBriefOptions {
  includeIntent?: boolean;
}

export function exportAiAgentBrief(pkg: Package, opts: ExportBriefOptions = {}): string {
  const includeIntent = opts.includeIntent !== false;
  const lines: string[] = [];
  lines.push(`# AI-Agent Brief — ${pkg.manifest.name}`);
  lines.push("");
  lines.push(`**Target package**: \`${pkg.manifest.id}\`, target host app \`${pkg.manifest.targetHostApp.name}\`.`);
  lines.push("");
  lines.push(`**Build instruction.** Implement the GUI surfaces described below as React components in the target codebase. No other GUI changes are in scope.`);
  lines.push("");

  for (const frame of pkg.frames) {
    lines.push(`## Frame: ${frame.name} (\`${frame.id}\`)`);
    lines.push("");
    lines.push(`Frame size: ${frame.size.w}×${frame.size.h}.`);
    lines.push("");
    if (includeIntent && frame.intent?.intent) {
      lines.push(`**Intent.** ${frame.intent.intent}`);
      lines.push("");
    }
    const items = [
      ...Object.values(pkg.containers).filter((c) => c.frameId === frame.id).map((c) => ({ kind: "container" as const, el: c })),
      ...Object.values(pkg.components).filter((c) => c.frameId === frame.id).map((c) => ({ kind: "component" as const, el: c })),
    ];
    for (const { kind, el } of items) {
      lines.push(`### Element: \`${el.id}\` (${el.archetype})`);
      lines.push("");
      lines.push(`Layout: ${kind} ${el.rect.w}×${el.rect.h} px at (${el.rect.x}, ${el.rect.y}).`);
      lines.push("");
      if (includeIntent && el.intent?.intent) {
        lines.push("**Implement this element with the following intent:**");
        lines.push("");
        lines.push(el.intent.intent);
        lines.push("");
      }
      if (includeIntent && el.intent?.behaviour) {
        lines.push("**Required behaviour:**");
        lines.push("");
        lines.push(el.intent.behaviour);
        lines.push("");
      }
      if (includeIntent && el.intent?.dataBinding) {
        lines.push("**Data flow:**");
        lines.push("");
        lines.push(el.intent.dataBinding);
        lines.push("");
      }
      if (includeIntent && el.intent?.dependsOn && el.intent.dependsOn.length > 0) {
        lines.push("**Dependencies:** " + el.intent.dependsOn.map((d) => `\`${d}\``).join(", "));
        lines.push("");
      }
      if (el.locked) {
        lines.push("**Do not modify** — this element is locked.");
        lines.push("");
      }
    }
  }

  lines.push("## Tokens to honour");
  lines.push("");
  for (const tokenId of Object.keys(pkg.tokens).sort()) {
    const t = pkg.tokens[tokenId]!;
    lines.push(`- \`${t.id}\` = ${t.value}${t.unit ? ` ${t.unit}` : ""}`);
  }
  lines.push("");

  lines.push("## Validation acceptance criteria");
  lines.push("");
  lines.push(`Rule pack: \`${pkg.rulePack.rulePackId}\` version ${pkg.rulePack.rulePackVersion}.`);
  const errors = pkg.findings.filter((f) => f.severity === "error");
  const blockers = pkg.findings.filter((f) => f.severity === "blocker");
  const warnings = pkg.findings.filter((f) => f.severity === "warning");
  if (blockers.length > 0 || errors.length > 0) {
    lines.push(`Open Errors: ${errors.length}. Open Blockers: ${blockers.length}.`);
    lines.push("These must be resolved before downstream implementation.");
  } else {
    lines.push(`Open Warnings (informational): ${warnings.length}.`);
  }
  lines.push("");

  const lockedIds: string[] = [];
  for (const c of Object.values(pkg.components)) if (c.locked) lockedIds.push(c.id);
  for (const c of Object.values(pkg.containers)) if (c.locked) lockedIds.push(c.id);
  lines.push("## No-touch areas");
  lines.push("");
  if (lockedIds.length === 0) lines.push("No locked elements.");
  else for (const id of lockedIds) lines.push(`- \`${id}\` — locked. Do not modify.`);
  lines.push("");

  lines.push("## Acceptance test sketch");
  lines.push("");
  lines.push("- `tsc --noEmit` clean.");
  lines.push("- Visual smoke: every Frame above renders.");
  lines.push("- Re-running validation produces the same finding count.");
  lines.push("");

  lines.push("## Out of scope");
  lines.push("");
  lines.push("- Modifying GUI surfaces not described above.");
  lines.push("- Adding network calls, telemetry, or external services.");
  lines.push("- Changing the host app's data pipeline.");
  return lines.join("\n") + "\n";
}
