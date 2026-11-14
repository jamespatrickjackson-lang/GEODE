/**
 * G1-01 public experience contract. This controls only application behavior:
 * it is not authentication or a server-side security boundary.
 * The development write API must never be deployed on a public static host.
 */
export type GateAMode = "public" | "developer";

export type GateACapability =
  | "project.open"
  | "view.orbit"
  | "view.pan"
  | "view.zoom"
  | "view.reset"
  | "project.create"
  | "project.import"
  | "project.save"
  | "project.write"
  | "page.author"
  | "layer.author"
  | "presenter.launch"
  | "capture.advanced"
  | "keyboard.save"
  | "dev.writeBatch";

export interface GateAExperience {
  mode: GateAMode;
  initialProjectSlug: string | null;
  error: string | null;
}

/** Project identity is stable; authored pages and their order are not authority. */
export const GATE_A_CURATED_PROJECT_SLUG = "utah-forge" as const;

const PUBLIC_CAPABILITIES: ReadonlySet<GateACapability> = new Set([
  "project.open",
  "view.orbit",
  "view.pan",
  "view.zoom",
  "view.reset",
]);

/**
 * The editor is intentionally accessible only through ?mode=developer on a
 * development build. Static public builds refuse the same direct URL.
 */
export function resolveGateAExperience(
  search: string,
  developmentBuild: boolean,
): GateAExperience {
  const params = new URLSearchParams(search);
  const mode = params.get("mode");
  const requestedProject = params.get("project");

  if (mode === "developer") {
    if (!developmentBuild) {
      return {
        mode: "public",
        initialProjectSlug: null,
        error: "The developer editor is available only in development builds.",
      };
    }
    return {
      mode: "developer",
      initialProjectSlug: requestedProject || null,
      error: null,
    };
  }

  if (mode !== null && mode !== "public") {
    return {
      mode: "public",
      initialProjectSlug: null,
      error: "This route is not supported in the public experience.",
    };
  }

  if (requestedProject && requestedProject !== GATE_A_CURATED_PROJECT_SLUG) {
    return {
      mode: "public",
      initialProjectSlug: null,
      error: "That project is unavailable in the public explorer.",
    };
  }

  return {
    mode: "public",
    initialProjectSlug: requestedProject || null,
    error: null,
  };
}

export function canUseGateACapability(
  mode: GateAMode,
  capability: GateACapability,
): boolean {
  return mode === "developer" || PUBLIC_CAPABILITIES.has(capability);
}

/** Explicitly reject attempted authoring actions rather than silently no-op. */
export function requireGateACapability(
  mode: GateAMode,
  capability: GateACapability,
): void {
  if (!canUseGateACapability(mode, capability)) {
    throw new Error(
      `Action "${capability}" is not available in the public explorer.`,
    );
  }
}

export function canOpenProject(
  experience: GateAExperience,
  projectSlug: string,
): boolean {
  return (
    canUseGateACapability(experience.mode, "project.open") &&
    (experience.mode === "developer" ||
      projectSlug === GATE_A_CURATED_PROJECT_SLUG)
  );
}
