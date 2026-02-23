# WO-006 - Debug Inspector and Axis Helpers

## Current State
- `UIManager` contains debug flags (`showHitRegions`, `showLayoutBounds`, `showAnchorAxes`) only as data.
- No helper meshes/groups are created or updated from those flags.
- No public API exists to query currently hovered element for inspection UI.
- Shell (`index.html`) has no debug controls or debug window.

## Failure Mode
- There is no way to toggle helper visuals or inspect hover element transform data.
- Requested workflow (hover + inspect position/orientation + axis helpers at element origins) is not possible.
- Existing debug flags can mislead implementation assumptions because they are currently inert.

## Intended State
- Sidebar includes a helper toggle button and optional per-helper toggles.
- Hovering any interactive UI element updates a debug window with:
  - element id
  - local and world position
  - quaternion and/or Euler orientation
  - size and hit-region bounds
- Axis helpers render at root anchor and hovered/interactive element origins when enabled.

## Plan of Action
1. Extend `UIManager` with debug subsystem:
   - Add helper scene group(s) per root.
   - Add update hooks in `update()` to maintain helper transforms.
   - Expose `getHovered(pointerId?)` or event callback for hover changes.
2. Implement axis helper creation:
   - Root anchor axis helper (always optional).
   - Element origin axis helpers (all interactive or hovered only).
3. Implement lightweight debug data extraction each frame:
   - element id, local/world transforms, computed size, hit region.
4. Add shell controls in sidebar:
   - `Toggle Helpers`
   - `Toggle Axis Origins`
   - optional `Toggle Hit Regions`
5. Add debug panel DOM in `index.html` and wire update loop from active runtime/uiManager.

## Success Metrics
- Helper toggle immediately shows/hides root and element axis helpers.
- Hovering different elements updates debug panel values within one frame.
- Displayed transforms match visual helper orientation in scene.
- Helper mode off returns scene to normal with no persistent helper artifacts.

## Affected and Included Files (Line Evidence)
- `src/core/UIManager.ts`
  - `72-76`: Existing debug flags.
  - `120-144`: Main update loop location for helper updates.
  - `150-205`: Pointer processing where hovered element changes are known.
  - `207-263`: Hit-test results source for hover data.
- `src/core/UIRoot.ts`
  - `82-104`: Root update integration point for helper anchoring.
- `src/core/UIElement.ts`
  - `114-123`: Hit regions and visual state metadata available to inspector.
  - `132-134`: `elementId` metadata for debug panel display.
- `index.html`
  - `38-42`: Existing `#info` panel area.
  - `79-80`: Root DOM handles for overlay/info.
  - `112-142`: Example load path where active manager/runtime hooks can be registered.
- `src/examples/example1-loadout-panel.ts`
  - `208-215`: UIManager creation and root registration.
- `src/examples/example2-camera-hud.ts`
  - `235-242`: UIManager creation and root registration.
- `src/examples/example3-vr-wrist-menu.ts`
  - `207-213`: UIManager creation and root registration.
- `src/examples/example4-phone-touch.ts`
  - `206-212`: UIManager creation and root registration.
