# WO-015 - Grid Editor Binding Authoring and Profile Schema Evolution

## Current State
- Profile tuneables support grid auto-resize and nested trigger routing only.
- Grid editor serializes layout schema but has no UX for attaching telemetry bindings to elements.
- Live scene sync from editor rehydrates structure, not data-feed wiring.

## Failure Mode
- Custom grids cannot consume live telemetry without custom runtime code.
- Profile import/export lacks binding metadata for reusable data-driven panels.
- "No-code" workflow stops at static visuals + event triggers.

## Intended State
- Grid editor exposes binding authoring for selected elements.
- Profiles persist binding metadata, formatter selection, fallback placeholder, and source field IDs.
- Live scene updates react 1:1 when bindings are edited.

## Plan of Action
1. Extend profile tuneables/schema envelope with `dataBindings` metadata and versioned migration.
2. Add `Data Bindings` subsection in editor tuneables:
   - target element ID
   - target prop (`text`, `value`, etc.)
   - field ID
   - formatter
   - placeholder/fallback
3. Validate binding rows against schema element IDs and supported target prop types.
4. Persist bindings in local storage and profile import/export payload.
5. Wire binding edits to live runtime without requiring profile reload.

## Success Metrics
- User can bind any supported element in the active grid to a telemetry field from the sidebar editor.
- Saving/exporting/importing a profile preserves bindings exactly.
- Invalid binding references are blocked with explicit error messages.
- Live scene reflects binding edits immediately and deterministically.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `1380-1419`: tuneables model currently only `autoResizeGrid` + `nestedTriggers`.
  - `637-657`: tuneables UI currently lacks binding authoring controls.
  - `1895-1904`: schema output payload currently emits no binding model.
  - `3494-3504`: tuneables updates currently rebuild scene schema without binding context.
- `index.html`
  - `1744-1755`: profile commit path serializes grid and scene schema only.
  - `2330-2378`: profile import path validates scene schema but not data-binding payload.

