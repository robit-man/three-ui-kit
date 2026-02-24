# WO-008 - Element Catalog with 1:1 Previews, Search, and Type Filter

## Current State
- The shell UI is example-switch focused and static.
- No palette/canvas exists for browsing available primitives/components.
- No search or type-filter affordance exists for discoverability.

## Failure Mode
- Authors cannot quickly inspect available UI building blocks.
- There is no standardized preview surface for evaluating elements in isolation.
- Expanding the kit increases cognitive load because there is no indexed catalog UI.

## Intended State
- Add an `Element Catalog` panel containing:
  - search input (`text`)
  - type dropdown (`All`, `Primitive`, `Component`, `Composite`)
  - scrollable long list of 1:1 preview cards (square canvases/scenes)
- Each preview card renders a single element in an embedded Three.js 1:1 viewport and exposes element metadata (`id`, type, props supported).

## Plan of Action
1. Add catalog shell section in `index.html` (between example controls and debug panel).
2. Build `src/editor/catalog/` modules:
   - registry model (element metadata + factory)
   - preview runtime factory (1:1 scene renderer per card)
   - search/filter reducer
3. Add lazy mounting/unmounting for preview cards to avoid over-rendering long lists.
4. Wire preview click/select into editor state for drag-drop authoring.

## Success Metrics
- Catalog displays all registered element types as square previews.
- Search filters by element id/name/tags in <100ms for 200+ entries.
- Dropdown type filter updates list deterministically.
- Scroll remains smooth with preview virtualization/lazy render.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `68-98`: Existing sidebar button list styles where catalog section styling should be extended.
  - `248-252`: Existing static example list insertion point for catalog controls.
  - `255-283`: Existing control sections pattern to replicate for catalog/search/filter sections.
- `src/core/UIManager.ts`
  - `150-335`: Pointer interaction system that preview cards/editor handles can reuse.
- `src/core/UIElement.ts`
  - `68-71`: Existing event types (`click`, `drag`) used for preview-selection and palette interactions.
- `src/core/UILayoutEngine.ts`
  - `140-207`: Stack layout behavior relevant for vertical catalog list composition.
  - `213-254`: Grid layout behavior relevant for square preview card grids.
