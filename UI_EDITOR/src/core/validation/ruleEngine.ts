import type { Package } from "../schema/package";
import type { ProfileSelection } from "../schema/profiles";
import type {
  ValidationFinding,
  ValidationRule,
  ValidationRulePack,
} from "../schema/validation";
import { SEVERITY_ORDER } from "../schema/validation";

export interface RunRuleEngineOptions {
  pkg: Package;
  rulePack: ValidationRulePack;
  profile: ProfileSelection;
  frameId?: string | null;
  activeBackgroundId?: string | null;
}

export function runRuleEngine(opts: RunRuleEngineOptions): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const targetFrames = opts.frameId
    ? opts.pkg.frames.filter((f) => f.id === opts.frameId)
    : opts.pkg.frames;
  // Library-level rules are package-scoped, not frame-scoped. Run them once
  // (keyed by rule id) so multi-frame packages don't get duplicate findings.
  const libraryRulesRun = new Set<string>();
  for (const frame of targetFrames) {
    const components = Object.values(opts.pkg.components).filter((c) => c.frameId === frame.id);
    const containers = Object.values(opts.pkg.containers).filter((c) => c.frameId === frame.id);
    for (const rule of opts.rulePack.rules) {
      if (rule.appliesTo === "restricted") continue;
      if (rule.appliesTo === "library") {
        if (libraryRulesRun.has(rule.id)) continue;
        libraryRulesRun.add(rule.id);
      }
      findings.push(...invokeRule(rule, { frame, components, containers, pkg: opts.pkg, profile: opts.profile, activeBackgroundId: opts.activeBackgroundId ?? null }));
    }
  }
  return sortFindings(findings);
}

function invokeRule(
  rule: ValidationRule,
  ctx: Parameters<ValidationRule["run"]>[0],
): ValidationFinding[] {
  try {
    return rule.run(ctx);
  } catch (err) {
    return [
      {
        ruleId: rule.id,
        severity: "warning",
        message: `Rule \`${rule.id}\` threw: ${(err as Error).message}`,
        profileId: ctx.profile.useCaseId,
        location: { packageId: ctx.pkg.manifest.id, frameId: ctx.frame.id },
      },
    ];
  }
}

export function sortFindings(findings: ValidationFinding[]): ValidationFinding[] {
  return [...findings].sort((a, b) => {
    const ra = SEVERITY_ORDER.indexOf(a.severity);
    const rb = SEVERITY_ORDER.indexOf(b.severity);
    if (ra !== rb) return rb - ra;
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    return 0;
  });
}
