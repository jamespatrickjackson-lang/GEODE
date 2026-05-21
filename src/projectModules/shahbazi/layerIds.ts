// Canonical Shahbazi project layer ID constants.
//
// Shahbazi is a geomatics TLS / photogrammetry dataset used both as its
// own project and as a surface-backdrop reference inside the Case Study B
// demo. Layer-ID constants live here; consumers (SceneManager, LayerPanel,
// Case Study B audience lenses) import them so removing the project
// removes the IDs.

export const SHAHBAZI_GROUND_SURFACE_LAYER_ID = "shahbazi-tls-surface-preview";

export const SHAHBAZI_GROUND_CONTOUR_LAYER_ID = "shahbazi-tls-contours";
