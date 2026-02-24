# WO-010 - Profile Persistence, Import/Export, and Runtime Schema Playback

## Current State
- `UIHydrate` can construct UI trees from schema.
- There is no profile storage layer (local, file export, or import) and no runtime profile switching.

## Failure Mode
- Authoring output is ephemeral.
- Teams cannot share/reload panel profiles without editing source code.
- No versioned schema envelope exists for migration safety.

## Intended State
- Introduce profile persistence pipeline:
  - `ProfileEnvelope` schema with version + metadata + root schema + bindings
  - save/load to `localStorage` (primary)
  - import/export JSON file
  - runtime profile selector in shell
- Include persisted geo/network context fields for reproducible telemetry overlays when desired.

## Plan of Action
1. Define `src/editor/profile/types.ts` with schema envelope and versioning.
2. Implement persistence adapters:
   - local (`localStorage`)
   - json string/file
3. Add profile manager UI in sidebar (save, duplicate, delete, export, import).
4. Use `UIHydrate.validate()` before save/load and reject invalid documents with actionable errors.
5. Add migration map for schema version upgrades.

## Success Metrics
- Profiles survive reload and can be switched without app restart.
- Exported JSON can be imported on another machine and reproduces layout.
- Invalid profiles are rejected with clear validation messages.
- Version migration path is tested for at least one simulated old version.

## Affected and Included Files (Line Evidence)
- `src/core/UIHydrate.ts`
  - `2-9`: Hydration responsibilities and supported features.
  - `86-110`: `fromSchema()` runtime entrypoint.
  - `463-465`: `validate()` hook for profile acceptance checks.
- `index.html`
  - `248-283`: Sidebar controls region where profile manager UI can be added.
  - `788-828`: Runtime load/unload path where profile playback integration occurs.
- `src/examples/runtime.ts`
  - `1-7`: Runtime interface contract to extend for profile-driven initial state.
- `src/core/UIElement.ts`
  - `132`: `elementId` support required for stable persisted bindings.
- Repository-wide persistence gap evidence:
  - No existing `localStorage`/`indexedDB` usage in `src/` (search result baseline).
