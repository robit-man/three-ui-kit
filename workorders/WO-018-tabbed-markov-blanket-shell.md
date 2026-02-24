# WO-018 - Tabbed Markov Blanket Shell

## Current State
- Sidebar flow is physically stacked instead of stage-based:
  - profile/canvas/catalog/customizer/editor/camera/helpers/debug all appear in one vertical stream in [index.html](../index.html:772) through [index.html](../index.html:924).
- The active workflow stage is implicit:
  - no `activeBoundary` state exists beside DOM refs and global runtime state in [index.html](../index.html:973) through [index.html](../index.html:1069).
- Sidebar sizing behavior is mature but independent from workflow hierarchy:
  - width + compact/wide class switching in [index.html](../index.html:3534) through [index.html](../index.html:3663).

## Failure Mode
- Users must scroll and mentally parse unrelated controls while performing one stage task.
- Stage transition is not explicit, so accidental edits happen in wrong context (for example editing bindings while intending to place scene instances).
- There is no resilient workspace resume point (tab restoration + last active context) on reload.

## Intended State
- A strict top-level tab shell defines Markov blankets:
  - `Components`
  - `Assembly`
  - `Hydration`
  - `Scene`
  - `Profiles`
- Each tab owns a bounded workspace and only renders boundary-relevant controls.
- A boundary transition rail provides explicit movement (`Back`, `Validate`, `Continue`) and writes stage checkpoint state.

## Plan of Action
1. Add workflow shell markup:
   - Insert `workflow-tabs` + `workflow-stage-host` above existing section stack and remount legacy sections into tab-owned panels.
2. Introduce shell state model:
   - `activeBoundary`, `boundaryValidation`, and `lastFocusedEntity` state objects in sidebar runtime layer.
3. Add tab routing + persistence:
   - bind tab clicks/keyboard navigation, persist `activeBoundary` to localStorage, restore at bootstrap.
4. Add transition rail contract:
   - per-boundary transition guard hook (`canExitBoundary`, `canEnterBoundary`) and shared status feedback.
5. Make shell responsive:
   - compact mode collapses tab labels; wide mode shows title + subtitle + step count.

## Success Metrics
- Users can identify workflow order from tab structure without documentation.
- Reload restores the same boundary and preserves in-progress draft context.
- Boundary switches do not mutate unrelated data domains.
- Keyboard access works for tabs (`ArrowLeft/ArrowRight`, `Home/End`, `Enter/Space`).

## Affected and Included Files (Line Evidence)
- `index.html`
  - `54-87`: sidebar layout behavior and compact/wide class rules.
  - `772-924`: existing unbounded sidebar section stack to be remapped into tabs.
  - `973-1069`: sidebar/control state variables where workflow shell state is introduced.
  - `3534-3663`: sidebar resize initialization/hooks that must remain compatible with tab shell.
  - `5005-5016`: bootstrap sequence where active boundary restore should run.
