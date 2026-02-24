# WO-007 - Visual Element Taxonomy and New Primitive Library

## Current State
- The kit exposes core primitives/components (`Panel`, `TextBlock`, `Icon`, `MarkerPlus`, `Button`, `Toggle`, `SliderLinear`, `RadialGauge`, `Menu`, `Submenu`) but does not include motif primitives matching the shared references (tri-chevrons, segmented hex rings, node-link webs, reticle corners, radial tick arcs).
- Schema hydration already supports typed component construction but only for existing types.

## Failure Mode
- Current interfaces cannot reproduce the reference language without hand-building custom mesh trees in each example.
- Reuse is poor: recurring motifs are duplicated ad hoc instead of being reusable primitives.

## Intended State
- Add a new primitive family oriented around the provided references:
  - `TriChevron`
  - `SegmentedHexRing`
  - `ReticleCorners`
  - `RadialTickArc`
  - `NodeLinkGraph`
  - `DataTag`
- All new primitives are:
  - theme-aware
  - schema-hydratable
  - exported from package entrypoint
  - available in preview catalog and editor palette

## Plan of Action
1. Implement new primitives under `src/primitives/` with narrow option interfaces.
2. Add schema type literals and builders in `UIHydrate`.
3. Export new primitives from `src/index.ts`.
4. Add at least one integration use per example scene to validate rendering/input/layout compatibility.

## Success Metrics
- Every new primitive can be instantiated via code and via `UIHydrate.fromSchema`.
- Each primitive renders correctly at both camera-anchored and object-anchored scales.
- Theme token changes (accent/text/line) immediately affect all new primitive materials.

## Affected and Included Files (Line Evidence)
- `src/index.ts`
  - `67-83`: Current public exports list where new primitives/components must be added.
- `src/core/UIHydrate.ts`
  - `34-52`: `UISchemaNode.type` union where new schema types must be declared.
  - `143-181`: Type switch dispatch for build path expansion.
  - `223-430`: Builder method pattern to mirror for new primitive constructors.
- `src/primitives/Icon.ts`
  - `18-67`: Existing primitive constructor/material pattern baseline.
- `src/primitives/MarkerPlus.ts`
  - `24-75`: Existing line-motif primitive baseline.
- `src/primitives/Panel.ts`
  - `27-108`: SDF panel + theme integration pattern for reusable primitives.
