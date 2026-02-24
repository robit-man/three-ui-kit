# WO-012 - Telemetry Hydration Contracts and Provider Registry

## Current State
- `ExampleRuntime` has lifecycle methods only and no typed telemetry channel.
- `UIHydrate` accepts `events` and `slots`, but there is no typed ingestion interface for live data streams.
- Telemetry providers are embedded in one example file and coupled to browser globals/fetch details.

## Failure Mode
- There is no reusable transport for feed snapshots into UI hydration/runtime layers.
- New feeds require per-example bespoke code rather than provider plug-ins.
- Cross-profile data reuse is blocked by missing contracts.

## Intended State
- Introduce a telemetry contract layer with provider registration and normalized snapshots.
- Providers can be started/stopped independently and consumed by any runtime/profile.
- Placeholder snapshots exist before first successful sample.

## Plan of Action
1. Add typed contracts in `src/telemetry/types.ts`:
   - `TelemetryFieldId`
   - `TelemetryStatus`
   - `TelemetrySnapshot`
   - `TelemetryProvider`
   - `TelemetryRegistry`
2. Implement provider modules:
   - `cameraMotionProvider`
   - `networkConnectionProvider`
   - `rttProbeProvider`
   - `browserInfoProvider`
   - `ipGeoProvider`
3. Add orchestrator (`src/telemetry/TelemetryHub.ts`) to fan-in provider output and publish merged snapshots.
4. Extend runtime surface to optionally expose telemetry hub/snapshot accessors.
5. Export telemetry interfaces from `src/index.ts` for downstream usage.

## Success Metrics
- Providers can be swapped/mocked without modifying UI scene code.
- Hub publishes deterministic merged snapshots with status metadata.
- Startup renders placeholders immediately, then transitions to live values.
- Runtime teardown cleanly unsubscribes all providers.

## Affected and Included Files (Line Evidence)
- `src/examples/runtime.ts`
  - `3-8`: runtime interface lacks telemetry ingestion/output hooks.
- `src/index.ts`
  - `12-123`: exports core/components/effects but no telemetry contract surface.
- `src/examples/example2-camera-hud.ts`
  - `45-58`: ad hoc local `NetworkConnectionLike` interface.
  - `60-85`: ad hoc geo/window typing specific to this example.
  - `131-222`: provider logic currently embedded in example.
  - `434-456`: provider lifecycle state tied directly to HUD runtime.

