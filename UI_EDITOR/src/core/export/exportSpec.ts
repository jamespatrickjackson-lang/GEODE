import type { Package } from "../schema/package";

export function exportSpec(pkg: Package): string {
  const lines: string[] = [];
  lines.push(`# ${pkg.manifest.name} — Implementation Brief`);
  lines.push("");
  lines.push(`Package id: \`${pkg.manifest.id}\`  `);
  lines.push(`Workbench version: ${pkg.manifest.workbenchVersion}  `);
  lines.push(`Target host app: ${pkg.manifest.targetHostApp.name}  `);
  lines.push(`Package state: ${pkg.manifest.packageState}  `);
  lines.push(`Rule pack: ${pkg.manifest.rulePackId}`);
  lines.push("");

  lines.push(`## Frames (${pkg.frames.length})`);
  lines.push("");
  for (const frame of pkg.frames) {
    const containerCount = Object.values(pkg.containers).filter((c) => c.frameId === frame.id).length;
    const componentCount = Object.values(pkg.components).filter((c) => c.frameId === frame.id).length;
    lines.push(`- **${frame.name}** (\`${frame.id}\`) — ${frame.size.w}×${frame.size.h} — ${containerCount} containers, ${componentCount} components`);
  }
  lines.push("");

  for (const frame of pkg.frames) {
    lines.push(`### Frame: ${frame.name} (\`${frame.id}\`)`);
    lines.push("");
    lines.push(`Size: ${frame.size.w}×${frame.size.h} px. Canvas position: (${frame.positionOnCanvas.x}, ${frame.positionOnCanvas.y}).`);
    lines.push("");
    if (frame.intent?.intent) {
      lines.push(`**Intent.** ${frame.intent.intent}`);
      lines.push("");
    }
    const frameContainers = Object.values(pkg.containers).filter((c) => c.frameId === frame.id);
    if (frameContainers.length > 0) {
      lines.push("**Containers**");
      for (const c of frameContainers) {
        lines.push(`- \`${c.id}\` — ${c.archetype} (${c.rect.w}×${c.rect.h}@${c.rect.x},${c.rect.y})`);
        if (c.intent?.intent) lines.push(`  - Intent: ${c.intent.intent}`);
        if (c.intent?.behaviour) lines.push(`  - Behaviour: ${c.intent.behaviour}`);
        if (c.intent?.dataBinding) lines.push(`  - Data binding: ${c.intent.dataBinding}`);
      }
      lines.push("");
    }
    const frameComponents = Object.values(pkg.components).filter((c) => c.frameId === frame.id);
    if (frameComponents.length > 0) {
      lines.push("**Components**");
      for (const c of frameComponents) {
        lines.push(`- \`${c.id}\` — ${c.archetype} (${c.rect.w}×${c.rect.h}@${c.rect.x},${c.rect.y})`);
        if (c.intent?.intent) lines.push(`  - Intent: ${c.intent.intent}`);
        if (c.intent?.behaviour) lines.push(`  - Behaviour: ${c.intent.behaviour}`);
        if (c.intent?.dataBinding) lines.push(`  - Data binding: ${c.intent.dataBinding}`);
        if (c.intent?.authorNotes) lines.push(`  - Author notes: ${c.intent.authorNotes}`);
      }
      lines.push("");
    }
  }

  lines.push("## Tokens used");
  lines.push("");
  for (const tokenId of Object.keys(pkg.tokens).sort()) {
    const t = pkg.tokens[tokenId]!;
    lines.push(`- \`${t.id}\` (${t.category}): ${t.value}${t.unit ? ` ${t.unit}` : ""}`);
  }
  lines.push("");

  lines.push("## Libraries");
  lines.push("");
  lines.push(`- Components: ${pkg.libraries.components.length}`);
  lines.push(`- Colours: ${pkg.libraries.colours.length}`);
  lines.push(`- Icons: ${pkg.libraries.icons.length}`);
  lines.push(`- Tokens: ${pkg.libraries.tokens.length}`);
  lines.push(`- Styles: ${pkg.libraries.styles.length}`);
  lines.push("");

  lines.push("## Validation status");
  lines.push("");
  if (pkg.findings.length === 0) {
    lines.push("No findings recorded.");
  } else {
    const bySeverity = pkg.findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    }, {});
    for (const sev of ["blocker", "error", "warning", "suggestion", "info"]) {
      if (bySeverity[sev]) lines.push(`- ${sev}: ${bySeverity[sev]}`);
    }
  }
  lines.push("");

  const lockedIds: string[] = [];
  for (const c of Object.values(pkg.components)) if (c.locked) lockedIds.push(c.id);
  for (const c of Object.values(pkg.containers)) if (c.locked) lockedIds.push(c.id);
  lines.push("## Restricted surfaces (locked)");
  lines.push("");
  if (lockedIds.length === 0) lines.push("None.");
  else for (const id of lockedIds) lines.push(`- \`${id}\``);
  lines.push("");

  lines.push("## Change log (most recent 20)");
  lines.push("");
  const recent = pkg.changeLog.slice(-20);
  for (const cr of recent) {
    lines.push(`- ${cr.timestamp} ${cr.kind}: ${cr.summary}`);
  }
  return lines.join("\n") + "\n";
}
