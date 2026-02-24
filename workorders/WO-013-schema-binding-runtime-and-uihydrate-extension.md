# WO-013 - Schema Binding Runtime and UIHydrate Extension

## Current State
- `UIHydrate` supports static schema hydration and event binding by `id`.
- Slot interpolation is text-only and one-way; it mutates existing rendered text and is not modeled as persistent binding metadata.
- Schema validation does not enforce/understand live data bindings.

## Failure Mode
- Live telemetry cannot be declared in schema and reused across profiles.
- Updating values requires manual imperative lookup and element mutation.
- Binding intent is not serialized in profile schema for editor/runtime round-trip.

## Intended State
- Add first-class schema binding definitions for supported UI targets.
- `UIHydrate` returns binding handles/registers adapters to apply live data snapshots.
- Validation includes binding shape/type checks.

## Plan of Action
1. Extend `UISchemaNode` with optional binding metadata (`bindings` or typed `props.bind`).
2. Add binder adapters by node type:
   - `text` / `data-tag` value updates
   - `radial-gauge` numeric value updates
   - `slider` readout/value updates when explicitly bound
3. Preserve original templates for text nodes so repeated updates do not lose token structure.
4. Add `HydrateOptions` support for a binding runtime context (formatter registry + subscription source).
5. Expand `UIHydrate.validate()` to reject invalid binding descriptors early.

## Success Metrics
- A schema can declare binding paths without imperative `setText` calls.
- Binding updates are applied per frame/tick without full rehydrate churn.
- Invalid bindings fail validation with actionable path-level errors.
- Existing non-bound schemas continue to hydrate unchanged.

## Affected and Included Files (Line Evidence)
- `src/core/UIHydrate.ts`
  - `40-82`: current schema node definition lacks binding metadata.
  - `84-92`: current hydrate options only include `events`, `slots`, `rootOptions`.
  - `269-293`: text builder performs immediate interpolation only.
  - `576-592`: slot walk mutates current text and has no persistent binding model.
  - `599-639`: validator currently does not inspect data binding declarations.
- `index.html`
  - `1790-1862`: grid scene schema generation does not include data-binding metadata.
  - `2698-2713`: `UIHydrate.fromSchema` usage currently wires events only.

