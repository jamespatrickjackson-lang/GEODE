import type { Package } from "../schema/package";
import type { ProfileSelection } from "../schema/profiles";
import type { ValidationFinding } from "../schema/validation";
import { runRuleEngine } from "./ruleEngine";
import { DESKTOP_TECHNICAL_EDITING } from "./rulePacks/desktopTechnicalEditing";

const RULE_PACKS = [DESKTOP_TECHNICAL_EDITING];

export function runValidation(
  pkg: Package,
  frameId: string | null,
  profile: ProfileSelection,
  activeBackgroundId: string | null = null,
): ValidationFinding[] {
  const pack = RULE_PACKS.find(
    (p) =>
      p.triggerProfile.deviceId === profile.deviceId &&
      p.triggerProfile.inputId === profile.inputId &&
      p.triggerProfile.useCaseId === profile.useCaseId,
  );
  if (!pack) {
    return [
      {
        ruleId: "validation.no-rule-pack-for-profile",
        severity: "info",
        message: `No validation rule pack matches profile ${profile.useCaseId} / ${profile.deviceId} / ${profile.inputId}.`,
        profileId: profile.useCaseId,
        location: { packageId: pkg.manifest.id },
      },
    ];
  }
  return runRuleEngine({
    pkg,
    rulePack: pack,
    profile,
    frameId,
    activeBackgroundId,
  });
}
