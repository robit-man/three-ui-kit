# WO-002 - Menu and Submenu Structure

## Current State
- Each `Menu` row is a `UIElement` with `STACK_X` layout and internal padding.
- A `Panel` background is added as the only row child with width equal to row width.
- Label text is added inside that background panel.
- If a row has children, the arrow indicator is also added to the same background panel.
- `Panel` defaults to `STACK_Y` child layout.
- Example 1 opens the submenu by passing `mainMenu` as the anchor element, not the selected row.
- Submenu is added into the same frame stack as normal flow content.

## Failure Mode
- Background panel width plus row padding causes layout overflow inside each menu row.
- Label and arrow are stacked vertically in the same panel, causing overlap/clipping in short row heights.
- Submenu opens relative to entire menu, not the selected item row.
- Closed submenu still participates in frame flow sizing, producing spacing and placement instability.

## Intended State
- Menu row internals are horizontally composed: label left, chevron right, both vertically centered.
- Row padding is applied once, with no width overflow.
- Submenu anchors to the selected row origin (or row edge) and tracks that row.
- Submenu is rendered out-of-flow (absolute overlay layer), so closed state does not consume layout height.

## Plan of Action
1. Refactor `Menu` row assembly:
   - Keep `row` as hit target and interactive owner.
   - Add `bg` as full-size backing without extra padded overflow.
   - Add a separate row content container (`STACK_X`, `justify: end|space-between` equivalent) for label and arrow.
2. Add API on `Menu` to retrieve row element by item id (`getItemElement(itemId)`).
3. Update `Submenu.open()` to accept the selected row element and compute placement from that row's local/world pose.
4. Move submenu to an absolute overlay container (sibling to frame content) or set it to absolute positioning with explicit exclusion from stack flow.
5. Update Example 1 selection handler to pass selected row, not `mainMenu`.

## Success Metrics
- Menu item text does not overlap arrow indicators at any row height >= 24.
- Utility submenu opens adjacent to the selected "UTILITY" row, not at menu origin.
- Toggling submenu open/closed does not change frame height or push neighboring controls.
- Pointer hit regions continue to match visible menu rows after refactor.

## Affected and Included Files (Line Evidence)
- `src/components/Menu.ts`
  - `70-75`: Row layout and sizing.
  - `77-98`: Background + label composition.
  - `100-109`: Arrow insertion path.
  - `111`: Row hit region registration.
  - `116-130`: Row event handling.
- `src/primitives/Panel.ts`
  - `29`: Default panel child layout is `STACK_Y`.
- `src/components/Submenu.ts`
  - `51-61`: Submenu placement logic.
- `src/examples/example1-loadout-panel.ts`
  - `153-170`: Menu select callback currently passes `mainMenu`.
  - `176-187`: Submenu created and added into frame flow.
- `src/core/UILayoutEngine.ts`
  - `140-207`: Stack placement behavior relevant to row overflow and submenu flow participation.
