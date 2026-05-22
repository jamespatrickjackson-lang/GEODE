# Architecture Hotspots

Status: active routing for large code surfaces

## Purpose

Use this file before modifying large mixed-concern modules. It points to the current high-risk surfaces and the extraction posture to use during normal feature work.

## Large Surfaces

| Surface | Risk | Preferred posture |
| --- | --- | --- |
| `src/scene/SceneManager.ts` | Very large runtime surface for scene layers, materials, transitions, controls, and visual state. | Patch exact regions. Extract active feature islands only when touching them. |
| `src/editor/LayerPanel.tsx` | Very large editor control surface. | Patch exact controls. Extract only a coherent control island with direct tests or verification. |
| `src/editor/EditorContext.tsx` | Broad authoring state and disk persistence coordination. | Avoid broad state rewrites. Preserve dev-write behavior unless the task is persistence-specific. |
| `src/scene/layerLoaders.ts` | Loader registry and project-specific loader cases. | Preserve handler order and runtime behavior unless the task is explicitly loader architecture. |

## Extraction Rules

- Do not refactor large files just because they are large.
- Extract only when the current task already touches a coherent feature island.
- Keep project data semantics, page IDs, provenance fields, and visual behavior stable unless the task explicitly changes them.
- Reopen exact source regions before editing; do not rely on stale context.
- Prefer existing validators and targeted browser suites before adding new broad tests.

## Current Useful Checks

- Runtime/data path impact: `npm run check:runtime-assets`
- Utah derived/data impact: `npm run check:utah-runtime`
- Page/project wiring impact: `npm run check:pages`
- Browser/render/editor behavior: targeted Utah browser scripts
- Broad regression: `npm run test:utah-forge` only after `npm run check:workspace`
