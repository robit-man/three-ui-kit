# WO-011 - Telemetry Feed Reverse Engineering and Baseline Spec

## Current State
- Live telemetry for the camera HUD is assembled imperatively inside `createCameraHudExample`.
- The default camera HUD profile schema in `index.html` duplicates the same panel/readout shape but with static placeholder strings.
- Telemetry values are written directly to UI elements with ad hoc key strings (`speed`, `rtt`, `down`, `net`, `browser`, `geo`) and no shared contract.

## Failure Mode
- Feed behavior is not reusable by custom grid-authored profiles.
- UI schema and runtime telemetry semantics can drift because structure is duplicated in two places.
- There is no canonical field inventory describing source, cadence, placeholder, transform, fallback, and error behavior.

## Intended State
- A single baseline telemetry spec exists and is versioned.
- The spec enumerates each field used by the default HUD and provides placeholder/fallback semantics.
- The spec is consumable by both the default camera HUD and custom schema-authored grids.

## Plan of Action
1. Create a baseline telemetry document and type-safe map (`fieldId -> source -> transform -> cadence -> placeholder -> stale/error state`).
2. Extract and normalize current feed behavior (camera motion, network info, RTT probe, browser detection, IP geo).
3. Define consistent placeholder lifecycle for all fields: `loading`, `live`, `stale`, `error`, `unavailable`.
4. Remove implicit global side effects from feed code unless explicitly modeled as optional debug export.
5. Add a migration note mapping existing hardcoded readout keys to canonical field IDs.

## Success Metrics
- Every default HUD readout/radial value has exactly one canonical field definition.
- Placeholders and fallbacks are consistent between initial render and runtime updates.
- New custom profiles can reference field IDs without touching example runtime code.
- Feed behavior is documented and testable independent of UI rendering.

## Affected and Included Files (Line Evidence)
- `src/examples/example2-camera-hud.ts`
  - `350-357`: hardcoded readout key list and initial values.
  - `463-492`: key-string based `setReadout` and connection telemetry updates.
  - `511-524`: geo fallback logic.
  - `526-556`: async RTT and geo refresh flow.
  - `558-588`: camera motion normalization and gauge/readout writes.
- `index.html`
  - `866-987`: duplicated default camera HUD schema with static placeholder values.
  - `1438-1464`: profile seeding path that injects the static default schema.

