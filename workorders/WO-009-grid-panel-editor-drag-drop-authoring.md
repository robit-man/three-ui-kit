# WO-009 - Grid Panel Editor and Drag-Drop No-Code Authoring

## Current State
- The runtime supports layout modes (`ABSOLUTE`, `STACK_X`, `STACK_Y`, `GRID`) but no authoring UI exists to compose panels interactively.
- All demos are authored directly in TypeScript.

## Failure Mode
- Non-code users cannot build or iterate panel layouts.
- Grid layout support exists at runtime but has no editing workflow.
- Element composition requires rebuild/reload cycles instead of direct manipulation.

## Intended State
- Add a no-code editor mode with:
  - grid canvas (cell-based panel editor)
  - palette drag source (from catalog)
  - drop targets with occupancy and snapping rules
  - selection and inline property editing
- User can drag an element from palette into grid, reposition, resize cell span, and delete.

## Plan of Action
1. Create editor state model (`src/editor/state/`) for grid dimensions, placed nodes, selection, and undo stack.
2. Build grid canvas renderer (`src/editor/grid/`) using existing UI primitives for cell overlays and drop highlights.
3. Implement drag lifecycle:
   - palette pick
   - hover preview
   - drop commit
   - reparent/reorder in schema tree
4. Add inspector panel for key props (size, align, color keys, label text, etc.).
5. Round-trip editor state into schema consumable by `UIHydrate`.

## Success Metrics
- Drag from catalog to grid creates a concrete node with deterministic cell placement.
- Reordering/repositioning does not lose element props.
- Editor emits a valid schema that `UIHydrate.validate()` accepts.
- Undo/redo correctly restores prior layouts for at least 25 actions.

## Affected and Included Files (Line Evidence)
- `src/core/UIElement.ts`
  - `14`: Layout type includes `GRID`.
  - `68-71`: Existing pointer event taxonomy includes `drag`.
  - `288-291`: Dirty propagation behavior that editor mutations must trigger.
- `src/core/UILayoutEngine.ts`
  - `213-254`: Grid layout algorithm and col/row behavior that editor must target.
- `src/core/UIManager.ts`
  - `150-335`: Pointer hit/dispatch lifecycle for drag-drop interactions.
- `src/core/UIHydrate.ts`
  - `86-110`: Schema-to-root entrypoint used for preview/rendering edited state.
  - `463-465`: Schema validation entrypoint for editor output.
