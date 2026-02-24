# WO-005 - Example Sidebar and Runtime Lifecycle

## Current State
- Landing UI is a full-screen overlay with one-time example buttons.
- Overlay is hidden after first selection.
- Example loading imports module and calls `animate()` with self-managed RAF loop.
- There is no active runtime registry, stop hook, or disposal handshake in the shell.
- `UIManager.dispose()` only detaches roots; input listeners and scene assets are not centrally managed by the shell.

## Failure Mode
- No persistent sidebar exists for switching examples after startup.
- Introducing sidebar switching without runtime lifecycle controls will stack RAF loops, UI managers, event handlers, and scene objects.
- Debug controls cannot be made global/stable without a persistent shell layout.

## Intended State
- Persistent left sidebar with example selection buttons and helper toggle controls.
- Main viewport remains active while switching examples.
- Exactly one active example runtime at a time.
- Standardized runtime contract includes cleanup hooks to dispose UI and scene resources.

## Plan of Action
1. Replace full-screen overlay structure in `index.html` with:
   - Persistent sidebar container
   - Main canvas area
   - Optional debug panel area
2. Define runtime contract for example modules, for example:
   - `start()` or `animate()`
   - `stop()`
   - `dispose()`
   - `onResize(width, height)`
3. Update all example modules to register created scene objects and cleanup them on dispose.
4. In shell loader, track `activeRuntime`; before loading a new example:
   - stop active runtime
   - dispose active runtime
   - clear scene residuals if needed
5. Keep info/status text synchronized with selected example in sidebar.

## Success Metrics
- User can switch between all examples from sidebar without page reload.
- Repeated switching (10+ cycles) does not multiply RAF callbacks or input events.
- Scene object count remains bounded and stable after each switch.
- `UIManager` instances from old examples are not receiving updates after switch.

## Affected and Included Files (Line Evidence)
- `index.html`
  - `17-24`: Current overlay shell model.
  - `47-54`: One-time start buttons.
  - `112-142`: Example load and animate start path.
  - `148-150`: Static button event binding.
- `src/examples/example1-loadout-panel.ts`
  - `219-227`: Infinite RAF loop in `animate()`.
  - `229`: Return object has no stop/dispose.
- `src/examples/example2-camera-hud.ts`
  - `255-278`: Infinite RAF loop in `animate()`.
  - `286`: Return object has no stop/dispose.
- `src/examples/example3-vr-wrist-menu.ts`
  - `216-230`: Infinite RAF loop in `animate()`.
  - `232`: Return object has no stop/dispose.
- `src/examples/example4-phone-touch.ts`
  - `215-229`: Infinite RAF loop in `animate()`.
  - `238`: Return object has no stop/dispose.
- `src/core/UIManager.ts`
  - `85-87`: Input listeners initialized in constructor.
  - `352-358`: `dispose()` scope currently limited to root detachment.
