# WO-024 - State Layer And Persistence Refactor

## Current State
- Most application state is global mutable script state:
  - debug/nav/resize in [index.html](../index.html:1046) through [index.html](../index.html:1094),
  - editor/profile store in [index.html](../index.html:1380) through [index.html](../index.html:1392).
- Persistence is fragmented across feature-specific keys:
  - sidebar width key in [index.html](../index.html:1080),
  - profile store key in [index.html](../index.html:1103),
  - custom element key in [index.html](../index.html:1112).
- Mutation and persistence are tightly coupled in event handlers:
  - repeated `persistProfileStore()` chains throughout [index.html](../index.html:2495) through [index.html](../index.html:5003).
- Compatibility migration exists but is profile-scoped:
  - compatibility gates in [index.html](../index.html:1789) through [index.html](../index.html:2148).

## Failure Mode
- Hard to reason about cross-boundary side effects.
- Difficult to introduce undo/redo, test deterministic transitions, or batch writes.
- localStorage contracts are not unified, increasing migration risk across releases.

## Intended State
- Layered state stores with explicit ownership:
  - `uiShellState`, `componentsState`, `assemblyState`, `hydrationState`, `sceneState`, `profilesState`, `diagnosticsState`.
- Action-driven update model:
  - reducers are pure and synchronous,
  - side effects (localStorage, runtime rehydrate, debug sync) run in effect layer.
- One versioned persistence envelope for workflow shell and draft state, with migration policy.

## Plan of Action
1. Define store modules and action types under `src`:
   - typed domain states and selectors.
2. Implement adapter in `index.html`:
   - move direct mutation handlers to action dispatch calls.
3. Introduce persistence gateway:
   - single `workflowEnvelope.v1` root key with schema version + migration metadata.
4. Migrate existing key data:
   - read old keys, normalize, write envelope, keep backward read support for one release.
5. Add invariant checks:
   - boundary isolation rules and guard assertions for invalid cross-domain writes.

## Success Metrics
- Direct global state mutation in event handlers is reduced to boundary dispatch calls.
- Persistence writes flow through one gateway API.
- Reload restores complete shell + domain draft state from one envelope.
- Backward compatibility migration from old keys succeeds without data loss.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `1046-1094`: shell/debug/nav/resize global state.
  - `1380-1392`: editor/profile global state definitions.
  - `1444-1466`: custom element persistence path.
  - `2020-2050`: profile load/persist path.
  - `1789-2148`: profile compatibility/migration behavior.
  - `2495-5003`: repeated mutation + persistence chains in handlers.
- `src/core/UIHydrate.ts`
  - `41-151`: typed schema/runtime contracts for hydration state typing.
- `src/telemetry/types.ts`
  - `1-93`: telemetry domain types used by hydration/diagnostics state.
- `src/index.ts`
  - `57-76`, `130-175`: exported surface that should remain stable while internal state architecture changes.
