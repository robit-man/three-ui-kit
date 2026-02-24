# WO-021 - Assembly Boundary Redesign

## Current State
- Grid assembly and non-assembly concerns are co-located:
  - editor grid + schema + tuneables in one section in [index.html](../index.html:821) through [index.html](../index.html:873).
- Assembly logic is feature-rich but mixed with binding and trigger controls:
  - grid render/drag/drop/click in [index.html](../index.html:2946) through [index.html](../index.html:3035),
  - schema build/apply in [index.html](../index.html:2704) through [index.html](../index.html:2886),
  - tuneables sync in [index.html](../index.html:2509) through [index.html](../index.html:2523).

## Failure Mode
- Users assembling layout must process hydration controls prematurely.
- Grid schema behavior (auto-trim, slot structure) is not clearly separated from data binding behavior.
- Editor focus is noisy: selecting a cell also mutates tuneables/customizer state, increasing accidental side effects.

## Intended State
- `Assembly` tab focuses only on structural composition:
  - grid canvas,
  - component placement/move/delete,
  - structural preview/schema output,
  - structural tuneables (for example auto-resize).
- Hydration controls move to dedicated Hydration boundary.
- Trigger behaviors are surfaced in a dedicated behavior region (Hydration or Scene) with explicit ownership.

## Plan of Action
1. Split Assembly tab into:
   - composition surface (`grid`),
   - structural inspector (`cell details`, `auto-resize`, schema summary).
2. Remove data-binding widgets from Assembly UI and route those controls to Hydration tab.
3. Refine selection semantics:
   - click selects cell/entity without hidden cross-boundary mutations.
4. Keep drag and trash interactions, but formalize action semantics:
   - add explicit undo-friendly action dispatch points.
5. Add structural validation panel:
   - surface `UIHydrate.validate` results for structure only.

## Success Metrics
- Assembly tasks can be completed without reading hydration controls.
- Grid drag/drop/trash behavior remains intact and stable.
- Structural schema output is deterministic for same cell arrangement.
- Cell selection no longer causes unintended boundary-side writes.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `821-873`: current mixed assembly+tuneables markup.
  - `2783-2861`: structural schema builder (`buildGridSchema`).
  - `2892-2921`: editor schema output composition.
  - `2923-2935`: trash-mode state behavior.
  - `2946-3035`: grid UI render + DnD handlers.
  - `4820-4837`: structural tuneable `autoResizeGrid` persistence/update path.
  - `4943-5003`: clear/delete/validate grid operations.
