# WO-001 - Text Measurement and Layout Invalidation

## Current State
- Text measurement updates are asynchronous and happen in Troika `sync()` callbacks.
- `TextBlock.applyTheme()` updates intrinsic dimensions in `sync()` but does not call `markDirty()` afterward.
- `TextBlock.setText()` does call `markDirty()`, so update behavior differs between initial render and later text changes.
- `UIRoot` only recomputes layout when `root.layoutDirty` is true.
- `UIElement.add()` marks only the immediate parent as dirty, not ancestors.

## Failure Mode
- Initial layout can run before text metrics are ready, producing zero/stale text width and height.
- Parent stacks then place multiple labels as if they are zero-height/zero-width, causing overlap.
- When async metrics arrive, intrinsic sizes change without guaranteed root relayout, so misplacement persists.
- Runtime composition changes can fail to relayout if only a nested node is marked dirty.

## Intended State
- Any change in intrinsic size from async text sync triggers relayout from the root.
- Any tree mutation (`add`, `remove`, text sync, style/sizing changes) propagates dirty state up the UI tree.
- Initial frame stabilizes after text sync without overlapping labels in menus, headers, and readouts.

## Plan of Action
1. Update `UIElement.add()` to call `markDirty()` instead of setting only local `layoutDirty`.
2. Ensure removal paths (`remove`, optional helper mutation methods) also call `markDirty()`.
3. In `TextBlock.applyTheme()`, after `_updateMeasurement()`, compare previous intrinsic size and call `markDirty()` if changed.
4. Keep `TextBlock.setText()` behavior, but also guard against missed relayout when measurement delta is non-zero.
5. Add a lightweight "layout stabilized" debug log/assert path for development builds to detect persistent zero-size text blocks.

## Success Metrics
- First render after example load shows no overlapping text in title rows, menus, or readouts.
- `intrinsicWidth`/`intrinsicHeight` transitions from `0` to measured values trigger exactly one relayout cascade.
- Adding/removing UI children at runtime updates parent/ancestor layout without manual root invalidation.
- No regressions in pointer hit regions after relayout changes.

## Affected and Included Files (Line Evidence)
- `src/primitives/TextBlock.ts`
  - `91-94`: Async sync callback updates measurement only.
  - `103-112`: `setText()` path already marks dirty.
  - `126-137`: Intrinsic measurement update source.
- `src/core/UIRoot.ts`
  - `98-100`: Relayout gate depends on `this.layoutDirty`.
- `src/core/UIElement.ts`
  - `154-164`: `add()` currently sets local dirty only.
  - `272-278`: `markDirty()` already supports ancestor propagation.
- `src/core/UILayoutEngine.ts`
  - `14-45`: Current compute traversal and dirty handling model.
- `src/components/Menu.ts`
  - `141`: Explicit `markDirty()` call after menu build shows expected invalidation pattern.
- `src/examples/example1-loadout-panel.ts`
  - `143-146`: Title text composition path sensitive to text sizing timing.
- `src/examples/example2-camera-hud.ts`
  - `166-169`, `193-200`: Title and readout rows sensitive to text sizing timing.
- `src/examples/example3-vr-wrist-menu.ts`
  - `150-153`, `199-201`: Title and status text sensitivity.
- `src/examples/example4-phone-touch.ts`
  - `122-125`: Header text sensitivity.
