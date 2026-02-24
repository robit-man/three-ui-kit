# WO-019 - Consistent Workspace Surface System

## Current State
- Sidebar UI uses many parallel style systems:
  - section card style groups in [index.html](../index.html:146) through [index.html](../index.html:199),
  - mixed form row conventions in [index.html](../index.html:184) through [index.html](../index.html:260),
  - tuneables-specific row system in [index.html](../index.html:308) through [index.html](../index.html:442).
- Section internals vary in information architecture:
  - free-form inline rows, one-off subtle helper text, and inconsistent action grouping in [index.html](../index.html:821) through [index.html](../index.html:918).

## Failure Mode
- UI visual grammar changes per section, so users cannot predict where to look for:
  - the primary action,
  - selected entity details,
  - validation/error details.
- Compact widths introduce clipping/stack pressure because row contracts are not uniform.

## Intended State
- Every workflow tab uses one reusable workspace anatomy:
  - `workspace-header`
  - `workspace-main`
  - `workspace-inspector`
  - `workspace-footer`
- Shared control semantics across boundaries:
  - `primary` (advance or commit),
  - `secondary` (local mutate),
  - `destructive` (delete/clear),
  - `quiet` (diagnostics/help toggles).

## Plan of Action
1. Introduce reusable CSS and markup primitives for workspace anatomy and state badges.
2. Normalize all input rows into one contract:
   - label column, control column, optional helper/error line.
3. Normalize empty/loading/error blocks:
   - one visual treatment and one copy contract per state class.
4. Convert tab internals incrementally:
   - Components, Assembly, Hydration, Scene, Profiles.
5. Add compact-width overflow policy:
   - deterministic wrap rules and no overlap at sidebar min width.

## Success Metrics
- All tabs render with the same structural skeleton.
- Button semantics are consistent and visually distinct.
- No clipping/overlap at `SIDEBAR_MIN_WIDTH`.
- DOM/CSS complexity decreases (fewer one-off selectors, fewer duplicate row styles).

## Affected and Included Files (Line Evidence)
- `index.html`
  - `146-199`: current section shell styles to replace with shared workspace classes.
  - `184-260`: existing control/input rows to normalize.
  - `308-442`: tuneables-specific row implementation to merge into shared contract.
  - `821-918`: representative sections needing conversion to unified workspace anatomy.
  - `756-758`: current mobile column collapse behavior that must remain valid post-refactor.
