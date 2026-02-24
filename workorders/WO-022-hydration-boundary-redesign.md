# WO-022 - Hydration Boundary Redesign

## Current State
- Hydration controls exist inside Assembly tuneables:
  - binding UI controls in [index.html](../index.html:856) through [index.html](../index.html:871).
- Binding lifecycle logic is broad and mostly imperative:
  - options sync and validation in [index.html](../index.html:2264) through [index.html](../index.html:2426),
  - row render/add/remove in [index.html](../index.html:2428) through [index.html](../index.html:2635).
- Binding engine contracts are already typed in core/runtime modules:
  - schema binding model and runtime adapter in [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:41) through [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:151),
  - runtime apply/diagnostics in [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:788) through [src/core/UIHydrate.ts](../src/core/UIHydrate.ts:1011).
- Telemetry field taxonomy exists but is not presented as first-class hydration inventory:
  - baseline fields/rows in [src/telemetry/camera-hud-baseline.ts](../src/telemetry/camera-hud-baseline.ts:83) through [src/telemetry/camera-hud-baseline.ts](../src/telemetry/camera-hud-baseline.ts:214),
  - provider diagnostics in [src/telemetry/TelemetryHub.ts](../src/telemetry/TelemetryHub.ts:125) through [src/telemetry/TelemetryHub.ts](../src/telemetry/TelemetryHub.ts:176).

## Failure Mode
- Hydration appears as a sub-feature of assembly, masking its complexity.
- Users cannot clearly reason about:
  - available fields,
  - provider health,
  - binding validity and formatter availability.
- Validation feedback is spread across status text, schema JSON, and debug panel.

## Intended State
- `Hydration` tab is a dedicated data-binding workspace with:
  - field/provider inventory,
  - binding table editor,
  - formatter selector and preview,
  - per-binding and per-profile validation pane.
- Hydration state is explicitly versioned and decoupled from structural grid operations.

## Plan of Action
1. Move binding controls from Assembly into Hydration tab.
2. Add hydration inventory panel:
   - list telemetry fields with source, status, cadence, placeholder policy.
3. Add binding authoring table:
   - element id, target, field, formatter, fallback/template, validation status.
4. Add hydration diagnostics surface:
   - summarize missing formatter/unsupported target/apply errors via `UIHydrate` diagnostics.
5. Add explicit hydration checkpoints:
   - `Validate Hydration`, `Apply`, `Revert` actions with persisted result status.

## Success Metrics
- Hydration workflow is discoverable and complete in one tab.
- Binding validation failures are attributable to a specific row and rule.
- Provider/field health is visible without opening raw debug text.
- Hydration edits do not mutate structural grid layout state.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `856-871`: current binding controls to migrate into Hydration boundary.
  - `2264-2426`: binding option sync + validation helpers.
  - `2428-2635`: binding row rendering and add/remove mutation flow.
  - `4853-4861`: binding action event handlers.
- `src/core/UIHydrate.ts`
  - `41-57`: binding schema contract.
  - `788-947`: runtime binding attach/apply pipeline.
  - `949-996`: binding diagnostics accumulation/snapshot.
  - `1135-1192`: schema-level binding validation.
- `src/telemetry/camera-hud-baseline.ts`
  - `83-120`: canonical HUD readout rows.
  - `122-214`: canonical field registry and placeholder metadata.
- `src/telemetry/TelemetryHub.ts`
  - `125-176`: provider + field diagnostics snapshot contract.
- `src/examples/example2-camera-hud.ts`
  - `39-75`: binding runtime adapter used by hydrated scene.
  - `106-120`: provider registration lifecycle.
