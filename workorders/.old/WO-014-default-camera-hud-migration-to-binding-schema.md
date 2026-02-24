# WO-014 - Default Camera HUD Migration to Binding-Driven Schema

## Current State
- Default camera HUD is hand-built in `example2-camera-hud.ts` via direct component construction.
- A separate default HUD schema also exists in `index.html` for profile seeding/editor hydration.
- Telemetry updates are applied through local `Map<string, TextBlock>` and direct `RadialGauge` mutation.

## Failure Mode
- Duplicate HUD definitions drift over time.
- Telemetry behavior is locked to one runtime implementation and not inherited by schema-authored profiles.
- Builder-authored custom layouts cannot reuse "default HUD telemetry semantics" without manual coding.

## Intended State
- One canonical default HUD profile schema with declarative bindings.
- Example runtime consumes that schema through hydration + telemetry hub.
- Camera-attached default HUD and injected grid-authored HUD instances use the same binding engine.

## Plan of Action
1. Extract default HUD schema into a shared typed module (`src/profiles/defaultCameraHudProfile.ts`).
2. Replace imperative HUD build path in `createCameraHudExample` with `UIHydrate.fromSchema(...)`.
3. Route bloom slider behavior via explicit schema event mapping and effect controller API.
4. Replace manual readout `Map` and `setReadout` with binding runtime subscriptions.
5. Keep root anchor/fov-fit/post-processing behavior intact while removing duplicate UI structure.

## Success Metrics
- Default HUD structure is defined in one place only.
- Telemetry values and radial motion render identically before/after migration.
- Editor-hydrated profiles can opt into the same telemetry field bindings.
- Changes to default profile schema immediately affect both camera HUD and injected profile output.

## Affected and Included Files (Line Evidence)
- `src/examples/example2-camera-hud.ts`
  - `272-424`: manual UI construction for left/right panels and readouts.
  - `463-465`: local key-string write path.
  - `583-584`: direct gauge/readout mutation.
- `index.html`
  - `866-987`: separate static default HUD schema currently used for profile seeding.
  - `1501-1529`: default profile bootstrap path.
  - `2698-2713`: existing schema hydration path used by injected builder UI.

