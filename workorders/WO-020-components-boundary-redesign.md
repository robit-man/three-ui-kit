# WO-020 - Components Boundary Redesign

## Current State
- Component management is split between two independent sections:
  - catalog list/filter in [index.html](../index.html:788) through [index.html](../index.html:800),
  - customizer form in [index.html](../index.html:802) through [index.html](../index.html:819).
- Catalog/customizer behavior is tightly coupled through imperative calls:
  - custom entry load/reset/save/delete in [index.html](../index.html:3121) through [index.html](../index.html:3254),
  - filtered catalog render loop in [index.html](../index.html:3261) through [index.html](../index.html:3333).
- Persistence for custom catalog entries is separate from profile persistence:
  - load/save custom entries in [index.html](../index.html:1444) through [index.html](../index.html:1466).

## Failure Mode
- Users do not see a formal "component authoring" stage; it feels like loose controls.
- Draft lifecycle is opaque:
  - unclear when edits are dirty, saved, or conflicting.
- Catalog selection and customizer state can desync conceptually because both panels operate as peers rather than one boundary.

## Intended State
- `Components` tab is a single bounded authoring surface with:
  - searchable catalog rail,
  - selected component inspector/editor,
  - explicit draft status (`clean`, `dirty`, `invalid`, `saved`),
  - controlled actions (`Save`, `Duplicate`, `Delete`, `Revert`).
- All component-level edits are validated and committed through one boundary action pipeline.

## Plan of Action
1. Merge catalog and customizer into one tab layout:
   - left rail for search/filter/list,
   - right inspector for schema + metadata.
2. Add draft state model:
   - track base item id, working copy, dirty/valid state, and validation errors.
3. Add explicit commit/discard workflow:
   - save only when valid,
   - revert to catalog source,
   - duplicate into custom namespace.
4. Normalize component persistence gateway:
   - route all custom element writes through one serializer/migrator path.
5. Surface downstream usage impact:
   - show count of profiles/grids currently referencing selected component key.

## Success Metrics
- Users can author/edit/delete components without leaving the Components tab.
- Draft status is visible and deterministic.
- Invalid schema edits are blocked from persistence with actionable errors.
- Catalog drag source behavior for Assembly remains functional after redesign.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `788-819`: current catalog/customizer markup to unify into one boundary surface.
  - `1001-1012`: catalog/customizer DOM refs and handlers.
  - `1444-1485`: custom catalog load/persist/rebuild lifecycle.
  - `3121-3254`: customizer state mutation and persistence hooks.
  - `3261-3333`: catalog filtering/render and selected-source wiring.
  - `4785-4818`: catalog/customizer event handlers.
