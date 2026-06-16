// Shared default for detached (non-page-transition) fades. Review success-factor
// A7: `DEFAULT_LAYER_FADE_MS` (the post-commit async-layer-resolve enter fade in
// SceneManager and the classifier's fallback) and `SCENE_OVERLAY_FADE_MS` (the
// non-transition overlay apply) were three independent `800` literals that
// agreed only by coincidence. They now alias this one constant so a future
// tuning change moves every detached fade together instead of desynchronizing
// them. Page-transition fades take their clock from the target page's
// `transition.duration`/`easing`, not this constant (see DEC-009 / the single
// clock authority in PageController).
export const DEFAULT_DETACHED_FADE_MS = 800;
