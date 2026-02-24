# WO-025 - Diagnostics, Tests, And Rollout Governance

## Current State
- Diagnostics are concentrated in one text-heavy debug panel:
  - debug panel markup in [index.html](../index.html:920) through [index.html](../index.html:923),
  - render loop in [index.html](../index.html:4564) through [index.html](../index.html:4699).
- Compatibility and rollout guards exist, but are profile/data-binding scoped:
  - rollout flags and versions in [index.html](../index.html:1104) through [index.html](../index.html:1111),
  - compatibility gate in [index.html](../index.html:1789) through [index.html](../index.html:1904).
- Binding and telemetry diagnostics exist in core modules:
  - binding diagnostics in [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:949) through [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:996),
  - telemetry diagnostics in [src/telemetry/TelemetryHub.ts](../src/telemetry/TelemetryHub.ts:125) through [src/telemetry/TelemetryHub.ts](../src/telemetry/TelemetryHub.ts:176).

## Failure Mode
- Diagnostics are not mapped to workflow boundaries, so users cannot quickly answer:
  - "what is broken in this stage?"
- Limited automated safety net for major shell/state refactor workorders.
- Rollout signals are present but not structured as staged release gates.

## Intended State
- Diagnostics become workflow-native:
  - tab-level health banners,
  - boundary-specific issue lists,
  - consolidated lifecycle health summary.
- Automated tests and governance policy cover:
  - schema validity,
  - binding validity,
  - persistence migration,
  - scene placement lifecycle.

## Plan of Action
1. Introduce boundary health model:
   - aggregate compatibility, hydration, and scene placement signals by tab.
2. Replace monolithic debug-only text with structured health surfaces:
   - summary badges + expandable details.
3. Add regression tests for critical flows:
   - profile migration, binding validation, grid assembly, inject/attach placement.
4. Add rollout gates:
   - feature flags and migration version checks for shell/state changes.
5. Add observability hooks:
   - log structured transition and validation events for easier issue triage.

## Success Metrics
- Each workflow tab exposes clear `ok/warn/error` health state.
- Automated checks detect schema/binding/persistence regressions before release.
- Rollout can be incrementally enabled with safe fallback paths.
- Debug panel still supports deep inspection but is no longer the only diagnostics surface.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `920-923`: debug panel host.
  - `1104-1111`: version and rollout flag definitions.
  - `1789-1904`: compatibility gating logic.
  - `4564-4699`: diagnostics render loop and composed output.
- `src/core/UIHydrate.ts`
  - `949-996`: binding diagnostics event/snapshot generation.
  - `1135-1192`: validation errors for unsupported bindings.
- `src/telemetry/TelemetryHub.ts`
  - `125-176`: provider/field diagnostic snapshot.
  - `371-388`: provider error recording details.
- `src/examples/example2-camera-hud.ts`
  - `106-120`: telemetry provider registration.
  - `245-247`: runtime telemetry snapshot exposure used by diagnostics surfaces.
