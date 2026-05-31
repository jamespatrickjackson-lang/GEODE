import type { ChangeState, ChangeRecord, ChangeLogFile } from "./changeLog";
import type { Frame, FramesFile } from "./frame";
import type { Container, ContainersFile } from "./container";
import type { Component, ComponentsFile } from "./component";
import type { DesignToken, TokensFile } from "./tokens";
import type { Libraries, LibrariesFile } from "./library";
import type { Guide, GuidesFile } from "./guide";
import type { FindingsFile, RulePackFile, ValidationFinding } from "./validation";

export type PackageState = ChangeState;

export interface TargetHostApp {
  name: string;
  version?: string;
  adapterId?: string;
}

export interface PackageManifest {
  id: string;
  name: string;
  description?: string;
  schemaVersion: 1;
  workbenchVersion: string;
  packageState: PackageState;
  createdAt: string;
  updatedAt: string;
  author?: string;
  targetHostApp: TargetHostApp;
  profileDefaults: {
    deviceId: string;
    inputId: string;
    useCaseId: string;
  };
  rulePackId: string;
}

export interface Package {
  manifest: PackageManifest;
  frames: Frame[];
  activeFrameId: string | null;
  containers: Record<string, Container>;
  components: Record<string, Component>;
  tokens: Record<string, DesignToken>;
  libraries: Libraries;
  guides: Guide[];
  rulePack: {
    rulePackId: string;
    rulePackVersion: number;
    configOverrides?: Record<string, unknown>;
  };
  findings: ValidationFinding[];
  findingsGeneratedAt: string;
  changeLog: ChangeRecord[];
}

export interface PackageFiles {
  manifest: PackageManifest;
  frames: FramesFile;
  containers: ContainersFile;
  components: ComponentsFile;
  tokens: TokensFile;
  libraries: LibrariesFile;
  guides: GuidesFile;
  rulePack: RulePackFile;
  findings: FindingsFile;
  changeLog: ChangeLogFile;
}

export const WORKBENCH_VERSION = "1.0.0";
export const SCHEMA_VERSION = 1 as const;

export type SelectionKind = "container" | "component";

export interface SelectionId {
  kind: SelectionKind;
  id: string;
}

export type SelectionIds = ReadonlyArray<SelectionId>;
