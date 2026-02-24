# WO-016 - Resizable Sidebar, Drag Grabber, and Section Wrapping

## Current State
- Sidebar width is fixed at `320px` with no drag-resize affordance.
- Sidebar sections stack in a single vertical column.
- Utility rows use fixed two-column grids and do not adapt to narrow widths.

## Failure Mode
- Editor/customizer content becomes cramped as feature density grows.
- Users cannot trade scene width vs editor width dynamically.
- Dense controls overflow readability when sidebar is constrained.

## Intended State
- Sidebar width is user-resizable via a right-edge vertical grabber.
- Grabber is visually highlighted on hover/drag and tracks full sidebar height.
- Section internals can wrap/reflow to expose more controls without overlap.
- Scene viewport resizes correctly as sidebar width changes.

## Plan of Action
1. Add a sidebar split handle element (`#sidebar-resizer`) anchored to sidebar right edge.
2. Move sidebar width to CSS variable (`--sidebar-width`) and update layout with dynamic calculations.
3. Implement pointer drag lifecycle for resize:
   - `pointerdown` capture
   - `pointermove` width clamp/min/max
   - `pointerup` release and persist width in local storage
4. Add active/hover visual states for the grabber and full-height track.
5. Introduce wrapping/reflow rules:
   - convert fixed `.inline-row` to responsive wrapping for narrow widths
   - allow section action groups to wrap onto additional rows
6. Ensure renderer/camera resize remains synchronized with final viewport geometry.

## Success Metrics
- User can resize sidebar smoothly without text overlap or jitter.
- Grabber remains visible across full sidebar height and highlights during interaction.
- Sidebar width persists across reload.
- Controls remain usable at minimum and maximum widths through wrapping/reflow.
- Three.js viewport continues to render at correct aspect after repeated resizes.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `28-47`: fixed `#sidebar` width/structure with no resize hook.
  - `142-147`: `.inline-row` fixed two-column layout, no wrap behavior.
  - `539-552`: viewport sizing rules that must remain correct under sidebar resize.
  - `569-715`: sidebar/viewport DOM lacks resize handle element.
  - `3148-3184`: resize handler exists for viewport/camera and must stay authoritative.

