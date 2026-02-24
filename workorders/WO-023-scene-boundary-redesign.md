# WO-023 - Scene Boundary Redesign

## Current State
- Scene deployment controls are split across camera/helper sections:
  - camera nav controls in [index.html](../index.html:876) through [index.html](../index.html:891),
  - placement actions in helper section in [index.html](../index.html:893) through [index.html](../index.html:918).
- Scene placement state machine exists in script scope:
  - instance creation/rehydration/switching in [index.html](../index.html:3921) through [index.html](../index.html:4096),
  - click/drag placement and attach flows in [index.html](../index.html:4098) through [index.html](../index.html:4305).
- Grid target acquisition uses backdrop APIs:
  - hover/select APIs in [src/examples/astral-backdrop.ts](../src/examples/astral-backdrop.ts:243) through [src/examples/astral-backdrop.ts](../src/examples/astral-backdrop.ts:329).

## Failure Mode
- Users cannot see one coherent "deploy to scene" stage.
- Placement controls and camera controls are mixed with unrelated helper toggles.
- Placement mode transitions (`armed`, `drag preview`, `placed`) are not visually represented as explicit states.

## Intended State
- `Scene` tab owns all runtime instantiation and placement interactions:
  - camera mode + snap controls,
  - inject/add/attach/restore actions,
  - placement state HUD (`Idle`, `Armed`, `Dragging`, `Placed`, `Error`),
  - selected grid target preview.
- Scene boundary receives a validated profile snapshot from upstream tabs.

## Plan of Action
1. Build Scene tab workspace:
   - camera controls, placement controls, anchor controls, placement status.
2. Consolidate placement state model:
   - explicit finite states and transitions with user-visible state badges.
3. Align drag/click placement behavior with one action contract:
   - same target resolution path, same error/status outputs.
4. Add scene deployment summary:
   - active profile id/name, anchor mode, selected grid point, instance count.
5. Keep helper toggles accessible but separated as diagnostics utilities, not core deployment actions.

## Success Metrics
- Users can deploy and reposition UI from a single Scene tab.
- Placement transitions are visible and deterministic.
- Attach-to-grid uses hovered/selected 3D point consistently with full XYZ fidelity.
- Camera mode switching does not break deployment interactions.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `876-918`: current camera/helper/placement control markup to consolidate.
  - `3921-4096`: builder instance creation, rehydration, and nested profile switching.
  - `4098-4254`: click/drag placement pipeline and cancellation handling.
  - `4256-4305`: attach-root-to-grid-point behavior.
  - `4714-4783`: scene control event handlers (nav mode, snapping, inject/add/attach/restore).
- `src/examples/astral-backdrop.ts`
  - `243-329`: hovered/selected grid point + snapshot APIs used for placement targeting.
