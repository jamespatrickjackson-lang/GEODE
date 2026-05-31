import type { Container } from "./container";
import type { Component } from "./component";
import type { Frame } from "./frame";
import type { ProfileSelection } from "./profiles";
import type { Package } from "./package";

export type Severity = "info" | "suggestion" | "warning" | "error" | "blocker";

export const SEVERITY_ORDER: readonly Severity[] = [
  "info",
  "suggestion",
  "warning",
  "error",
  "blocker",
];

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

export function worstSeverity(severities: readonly Severity[]): Severity | undefined {
  if (severities.length === 0) return undefined;
  let worst = severities[0]!;
  for (let i = 1; i < severities.length; i++) {
    if (severityRank(severities[i]!) > severityRank(worst)) {
      worst = severities[i]!;
    }
  }
  return worst;
}

export interface ValidationFindingLocation {
  packageId: string;
  frameId?: string;
  containerId?: string;
  componentId?: string;
  libraryEntryId?: string;
  propertyPath?: string;
}

export interface ValidationFinding {
  ruleId: string;
  severity: Severity;
  location: ValidationFindingLocation;
  message: string;
  currentValue?: unknown;
  suggestedValue?: unknown;
  profileId: string;
  acknowledged?: {
    by?: string;
    at?: string;
    rationale: string;
  };
  advisory?: {
    by: string;
    text: string;
  };
}

export interface ValidationRuleContext {
  frame: Frame;
  containers: readonly Container[];
  components: readonly Component[];
  pkg: Package;
  profile: ProfileSelection;
  activeBackgroundId: string | null;
}

export interface ValidationRule {
  id: string;
  severity: Severity;
  description: string;
  appliesTo: "component" | "container" | "frame" | "layout" | "library" | "restricted" | "global";
  run: (ctx: ValidationRuleContext) => ValidationFinding[];
}

export interface ValidationRulePack {
  id: string;
  version: number;
  description: string;
  triggerProfile: ProfileSelection;
  rules: ValidationRule[];
}

export interface RulePackFile {
  schemaVersion: 1;
  rulePackId: string;
  rulePackVersion: number;
  configOverrides?: Record<string, unknown>;
}

export interface FindingsFile {
  schemaVersion: 1;
  generatedAt: string;
  rulePackId: string;
  rulePackVersion: number;
  findings: ValidationFinding[];
}
