# WO-017 - Validation, Observability, and Safe Rollout for Data-Hydrated UI

## Current State
- Telemetry, profile hydration, and editor runtime changes are concentrated in runtime code with no dedicated regression harness.
- There is no explicit compatibility gate for old profiles when schema/binding contracts evolve.
- Debug panel shows hover/transform info, not feed health/binding status.

## Failure Mode
- Architectural refactor risk is high: silent binding failures can ship unnoticed.
- Profile compatibility issues can break existing saved layouts.
- Performance regressions may appear when multiple bindings/providers update frequently.

## Intended State
- Add explicit validation/migration checks for binding-enabled profiles.
- Add runtime observability for provider health, binding errors, and stale fields.
- Stage rollout behind feature flags/version gates to avoid breaking existing users.

## Plan of Action
1. Add schema/profile migration gate for binding-enabled versions with fallback behavior.
2. Add runtime diagnostics snapshot (`provider status`, `last update`, `stale/error counts`, `binding failures`).
3. Extend sidebar debug output with a telemetry/binding diagnostics section.
4. Add smoke tests for:
   - placeholder-to-live transitions
   - provider failover behavior
   - profile import of old/new versions
5. Define rollout checklist: opt-in flag, migration logging, backward compatibility window.

## Success Metrics
- Binding/profile version mismatches surface deterministic, user-facing errors.
- Debug tools show real-time provider and binding health.
- Existing profiles continue to load through migration shims.
- No material frame-time regression under expected update cadences.

## Rollout Checklist
- Keep `ROLLOUT_FLAGS.dataBindings` enabled only while migration compatibility notes remain empty in active profiles.
- Keep `ROLLOUT_FLAGS.telemetryDiagnostics` enabled during rollout to observe provider and binding health in debug panel.
- Keep `ROLLOUT_FLAGS.strictFutureBindingImport` enabled to block unsafe import of newer binding-enabled profiles.
- Validate `npm run smoke:wo017` passes before release packaging.
- Preserve backward compatibility window for v1/v2 profiles and monitor compatibility warnings in debug output.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `1892-1905`: schema diagnostics output currently lacks provider/binding health data.
  - `3306-3367`: debug panel currently focused on hover/transform and grid snapshots only.
  - `1474-1496`: profile storage load/persist path currently version-light and binding-unaware.
- `src/core/UIHydrate.ts`
  - `599-639`: current validation scope is type-level only.
- `src/examples/example2-camera-hud.ts`
  - `526-556`: async telemetry refresh logic with no shared observability hooks.
