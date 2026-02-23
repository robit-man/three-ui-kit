# WO-004 - Camera-Relative Positioning and Look Direction

## Current State
- Anchor position is computed from target pose plus `offsetPos` in target-local space.
- Root orientation is derived from facing mode (`CAMERA`, `BILLBOARD_YAW`, `CUSTOM`, etc.).
- UI root layout uses top-left style coordinates for descendants.
- Root world origin is used directly as anchor pose without pivot compensation for root dimensions.
- Camera-attached examples use `offsetPos.x = 0` and large fixed widths.

## Failure Mode
- Camera-relative surfaces are visually offset from expected look direction because the root origin behaves like top-left, not center.
- Wider HUDs extend to one side of the reticle rather than framing around it.
- Object-attached surfaces can appear spatially plausible but still feel biased due to unmodeled pivot.
- Position tuning becomes ad-hoc per example and fragile across size changes.

## Intended State
- Root placement supports an explicit pivot model (for example: `CENTER`, `BOTTOM_CENTER`, `TOP_LEFT`).
- Anchor world pose is corrected by root dimensions and pivot before final placement.
- Camera HUD examples can target bottom-center of view consistently across widths and text changes.
- Object and wrist examples retain readable orientation while respecting desired local attachment points.

## Plan of Action
1. Add pivot configuration to root/anchor options:
   - Preset enum and optional normalized vector (`[0..1, 0..1]`).
2. In root update, after layout size is known, apply pivot compensation in local UI units converted to meters.
3. Ensure compensation is applied after FOV-fit scale and before final world transform assignment.
4. Update example anchors:
   - Example 2: bottom-center HUD.
   - Example 4: bottom-center phone overlay.
   - Example 1: object-right panel with intentional edge offset.
   - Example 3: wrist panel with controlled in-plane offset.
5. Validate facing math paths (`billboardYaw`, `cameraYaw`, custom wrist mode) after pivot shift.

## Success Metrics
- Example 2 and Example 4 HUDs remain centered relative to camera forward vector when rotating camera.
- No manual "magic" `offsetPos.x` hacks are needed to compensate for root width.
- Example 1 and Example 3 remain legible and stable under anchor smoothing.
- Positioning stays correct when text/content changes root size.

## Affected and Included Files (Line Evidence)
- `src/core/UIAnchor.ts`
  - `117-123`: Position computation from target/camera.
  - `125-129`: Orientation + offset rotation.
  - `142-143`: Final root pose assignment.
- `src/core/UIRoot.ts`
  - `88-95`: FOV-fit scale application.
  - `98-100`: Layout compute timing relative to transform updates.
- `src/core/UILayoutEngine.ts`
  - `262-273`: Top-left UI-to-Three coordinate mapping.
- `src/core/UIConstraints.ts`
  - `52-86`: FOV-fit scale model.
- `src/utils/math.ts`
  - `84-102`: Yaw billboard quaternion.
  - `107-120`: Camera yaw quaternion.
  - `125-136`: Lock-up quaternion.
- `src/examples/example1-loadout-panel.ts`
  - `103-113`: Object anchor config.
- `src/examples/example2-camera-hud.ts`
  - `82-101`: Camera anchor + FOV-fit config.
- `src/examples/example3-vr-wrist-menu.ts`
  - `79-98`: Custom wrist-facing function.
  - `104-118`: Wrist anchor config.
- `src/examples/example4-phone-touch.ts`
  - `71-90`: Camera anchor + FOV-fit config.
