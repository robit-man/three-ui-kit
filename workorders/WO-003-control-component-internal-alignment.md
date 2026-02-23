# WO-003 - Control Component Internal Alignment

## Current State
- Multiple controls combine layout-managed text (`UIElement`) with manually positioned `Mesh` children.
- `Button` adds a `TextBlock` into a `Panel` without explicit centering container logic.
- `Toggle` declares `STACK_X` layout but track/knob meshes are positioned manually; optional label is just another child.
- `SliderLinear` places label and readout as stacked children, while track/fill/thumb are manually positioned from fixed offsets.
- `SliderLinear` total height only accounts for label, not optional readout height.
- `RadialGauge` readout and label are manually offset with hardcoded constants.

## Failure Mode
- Text and geometry layers drift relative to each other, especially with optional labels/readouts enabled.
- Label/readout rows can overlap track geometry in sliders.
- Toggle label can conflict spatially with track and knob under different widths.
- Button and gauge text centering is inconsistent and sensitive to text width changes.

## Intended State
- Each control has deterministic internal structure:
  - Header/content rows are explicit layout containers.
  - Geometry rows are isolated from text rows.
  - Optional readouts contribute to computed height.
- Text placement uses either measured centering or explicit alignment containers, not magic offsets.

## Plan of Action
1. `Button`:
   - Create a full-size inner content container with center alignment.
   - Place label in that container.
2. `Toggle`:
   - Split into `trackContainer` (fixed width) + optional label container in a proper horizontal row.
   - Ensure component width reflects both zones.
3. `SliderLinear`:
   - Build top header row (`label` left, `readout` right).
   - Build bottom track row with consistent vertical spacing.
   - Recompute component height from row heights and gaps.
4. `RadialGauge`:
   - Center readout based on measured dimensions.
   - Place label in a dedicated row below gauge bounds.
   - Remove hardcoded `-10` offsets.

## Success Metrics
- In examples 2/3/4, controls display without text overlap at default and narrow widths.
- Slider readout never overlaps the slider track at any value.
- Toggle labels are consistently offset from track with stable spacing.
- Gauge readout remains centered when value text width changes.

## Affected and Included Files (Line Evidence)
- `src/components/Button.ts`
  - `39-57`: Current panel and label composition.
- `src/components/Toggle.ts`
  - `34-42`: Component layout declaration.
  - `60-70`: Child composition with label and meshes.
  - `122-132`: Manual track/knob placement.
- `src/components/SliderLinear.ts`
  - `39-43`: Size and layout declaration.
  - `52-65`: Label/readout insertion.
  - `142-159`: Manual track/fill/thumb placement.
- `src/components/RadialGauge.ts`
  - `36`: Component sizing baseline.
  - `51-67`: Readout/label composition.
  - `178-188`: Hardcoded text offsets.
- `src/primitives/TextBlock.ts`
  - `56-57`: Horizontal/vertical anchor behavior of text primitives.
- `src/core/UILayoutEngine.ts`
  - `140-207`: Stack align/justify behavior needed for row/container fixes.
- `src/examples/example2-camera-hud.ts`
  - `121-135`, `184-223`: Gauge/readout/slider usage.
- `src/examples/example3-vr-wrist-menu.ts`
  - `182-201`: Toggle/status usage.
- `src/examples/example4-phone-touch.ts`
  - `131-188`: Slider/toggle/button usage.
