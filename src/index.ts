/**
 * @hud/uikit — Three.js dark-HUD UI kit
 *
 * Camera/object anchored, quaternion-aligned, multi-input.
 * Supports WebGLRenderer and WebXR.
 */

/* ------------------------------------------------------------------ */
/*  Core                                                               */
/* ------------------------------------------------------------------ */

export {
  UIManager,
  type GlowMode,
  type UIManagerOptions,
  type UIDebugSnapshot,
} from "./core/UIManager.js";
export {
  UIRoot,
  type UIRootOptions,
  type AnchorPivot,
  type AnchorPivotPreset,
  type AnchorPivotOption,
} from "./core/UIRoot.js";
export {
  UIElement,
  type LayoutType,
  type LayoutProps,
  type SizeProps,
  type StyleProps,
  type Align,
  type HitRegion,
  type UIEventType,
  type UIEvent,
  type UIEventHandler,
} from "./core/UIElement.js";
export {
  UIAnchor,
  type FacingMode,
  type CustomFacingFn,
  type UIAnchorOptions,
} from "./core/UIAnchor.js";
export { UILayoutEngine } from "./core/UILayoutEngine.js";
export {
  UIConstraintFovFit,
  UIBreakpoints,
  type FovFitOptions,
  type Breakpoint,
} from "./core/UIConstraints.js";
export {
  UITheme,
  ThemeFactory,
  DEFAULT_TOKENS,
  type ThemeTokens,
  type VisualState,
} from "./core/UITheme.js";
export {
  UIHydrate,
  type UISchemaNode,
  type HydrateOptions,
} from "./core/UIHydrate.js";

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

export { Panel, type PanelOptions } from "./primitives/Panel.js";
export { TextBlock, type TextBlockOptions, type TextVariant, type TextAlignV } from "./primitives/TextBlock.js";
export { Stroke, type StrokeOptions } from "./primitives/Stroke.js";
export { Divider, type DividerOptions } from "./primitives/Divider.js";
export { Icon, type IconOptions } from "./primitives/Icon.js";
export { MarkerPlus, type MarkerPlusOptions } from "./primitives/MarkerPlus.js";

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

export { Button, type ButtonOptions } from "./components/Button.js";
export { Toggle, type ToggleOptions } from "./components/Toggle.js";
export { SliderLinear, type SliderLinearOptions } from "./components/SliderLinear.js";
export { RadialGauge, type RadialGaugeOptions } from "./components/RadialGauge.js";
export { Menu, type MenuItem, type MenuOptions } from "./components/Menu.js";
export { Submenu, type SubmenuOptions } from "./components/Submenu.js";
export { Tooltip, type TooltipOptions } from "./components/Tooltip.js";

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

export type { UIPointer, PointerKind } from "./input/UIPointer.js";
export { MousePointer } from "./input/MousePointer.js";
export { TouchPointer } from "./input/TouchPointer.js";
export { XRPointer } from "./input/XRPointer.js";

/* ------------------------------------------------------------------ */
/*  Effects                                                            */
/* ------------------------------------------------------------------ */

export { GlowComposer, GLOW_LAYER, type GlowComposerOptions } from "./fx/GlowComposer.js";
export { GrainPass, type GrainPassOptions } from "./fx/GrainPass.js";

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

export {
  smoothAlpha,
  billboardQuat,
  billboardYawQuat,
  cameraYawQuat,
  lockUpQuat,
  clamp,
} from "./utils/math.js";
export {
  easeOutCubic,
  easeInOutCubic,
  easeOutExpo,
  easeInOutQuad,
  springDamp,
} from "./utils/easing.js";
