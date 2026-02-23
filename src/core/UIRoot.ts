/**
 * UIRoot - root element for one UI surface (panel tree).
 * Manages its own anchor, constraint, and top-level layout.
 */

import { Object3D, Camera, Vector3 } from "three";
import { UIElement, type LayoutProps, type SizeProps } from "./UIElement.js";
import { UIAnchor, type UIAnchorOptions } from "./UIAnchor.js";
import { UILayoutEngine } from "./UILayoutEngine.js";
import { UIConstraintFovFit, type FovFitOptions } from "./UIConstraints.js";
import { UITheme, ThemeFactory } from "./UITheme.js";

/* ------------------------------------------------------------------ */
/*  Options                                                           */
/* ------------------------------------------------------------------ */

export type AnchorPivotPreset =
  | "TOP_LEFT"
  | "TOP_CENTER"
  | "TOP_RIGHT"
  | "CENTER_LEFT"
  | "CENTER"
  | "CENTER_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_CENTER"
  | "BOTTOM_RIGHT";

export interface AnchorPivot {
  /** Horizontal pivot 0..1 from left to right. */
  x: number;
  /** Vertical pivot 0..1 from top to bottom. */
  y: number;
}

export type AnchorPivotOption = AnchorPivotPreset | AnchorPivot;

export interface UIRootOptions {
  theme?: UITheme;
  layout?: Partial<LayoutProps>;
  sizing?: Partial<SizeProps>;
  anchor?: UIAnchorOptions;
  /** Which point of this root should sit on the anchor target. */
  pivot?: AnchorPivotOption;
  fovFit?: FovFitOptions;
  /** UI unit to meters. Default 0.01 (1 UI unit = 1 cm). */
  uiUnitMeters?: number;
  /** Depth test for all children (HUD = false, world = true). */
  depthTest?: boolean;
  /** Base render order for all children. */
  renderOrder?: number;
}

/* ------------------------------------------------------------------ */
/*  UIRoot                                                            */
/* ------------------------------------------------------------------ */

const _pivotWorldOffset = new Vector3();

export class UIRoot extends UIElement {
  anchor?: UIAnchor;
  fovFit?: UIConstraintFovFit;
  anchorPivot: AnchorPivot;
  uiUnitMeters: number;
  baseDepthTest: boolean;
  baseRenderOrder: number;

  private static readonly _PIVOT_PRESETS: Record<AnchorPivotPreset, AnchorPivot> = {
    TOP_LEFT: { x: 0, y: 0 },
    TOP_CENTER: { x: 0.5, y: 0 },
    TOP_RIGHT: { x: 1, y: 0 },
    CENTER_LEFT: { x: 0, y: 0.5 },
    CENTER: { x: 0.5, y: 0.5 },
    CENTER_RIGHT: { x: 1, y: 0.5 },
    BOTTOM_LEFT: { x: 0, y: 1 },
    BOTTOM_CENTER: { x: 0.5, y: 1 },
    BOTTOM_RIGHT: { x: 1, y: 1 },
  };

  constructor(opts: UIRootOptions = {}) {
    super({
      layout: { type: "STACK_Y", ...opts.layout },
      sizing: opts.sizing,
    });

    this.theme = opts.theme ?? ThemeFactory();
    this.anchorPivot = UIRoot._resolvePivot(opts.pivot);
    this.uiUnitMeters = opts.uiUnitMeters ?? 0.01;
    this.baseDepthTest = opts.depthTest ?? true;
    this.baseRenderOrder = opts.renderOrder ?? 0;

    if (opts.anchor) {
      this.anchor = new UIAnchor(opts.anchor);
    }
    if (opts.fovFit) {
      this.fovFit = new UIConstraintFovFit(opts.fovFit);
    }

    // Apply unit scale
    this.scale.setScalar(this.uiUnitMeters);
  }

  /* ---------------------------------------------------------------- */
  /*  Attach to scene                                                 */
  /* ---------------------------------------------------------------- */

  attachTo(parent: Object3D): this {
    parent.add(this);
    return this;
  }

  detach(): this {
    this.removeFromParent();
    return this;
  }

  /* ---------------------------------------------------------------- */
  /*  Per-frame update                                                */
  /* ---------------------------------------------------------------- */

  update(dt: number, camera: Camera): void {
    // Layout first so scale and pivot compensation use current dimensions.
    if (this.layoutDirty) {
      UILayoutEngine.compute(this);
    }

    // Anchor pose
    if (this.anchor) {
      this.anchor.update(this, dt, camera);
    }

    // FOV-fit constraint (only for camera-attached)
    if (this.fovFit) {
      const designH = this.computedHeight > 0 ? this.computedHeight : 300;
      const s = this.fovFit.compute(camera, designH, this.uiUnitMeters);
      this.scale.setScalar(this.uiUnitMeters * s);
    } else {
      this.scale.setScalar(this.uiUnitMeters);
    }

    // Move the root so the chosen pivot lands on the anchor pose.
    if (this.anchor) {
      this._applyAnchorPivotCompensation();
    }

    // Recursive child update
    this._updateChildren(this, dt);
  }

  private _updateChildren(parent: UIElement, dt: number): void {
    for (const child of parent.uiChildren) {
      child.onUpdate(dt);
      this._updateChildren(child, dt);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Collect all hit regions from the tree                           */
  /* ---------------------------------------------------------------- */

  collectHitRegions(): import("./UIElement.js").HitRegion[] {
    const regions: import("./UIElement.js").HitRegion[] = [];
    this._collectHR(this, regions);
    return regions;
  }

  private _collectHR(
    el: UIElement,
    out: import("./UIElement.js").HitRegion[]
  ): void {
    if (el.interactive && el.hitRegions.length > 0) {
      out.push(...el.hitRegions);
    }
    for (const child of el.uiChildren) {
      this._collectHR(child, out);
    }
  }

  private _applyAnchorPivotCompensation(): void {
    const px = this.anchorPivot.x;
    const py = this.anchorPivot.y;
    if ((px === 0 && py === 0) || (this.computedWidth <= 0 && this.computedHeight <= 0)) {
      return;
    }

    const localX = -this.computedWidth * px;
    const localY = this.computedHeight * py;
    _pivotWorldOffset
      .set(localX, localY, 0)
      .multiplyScalar(this.scale.x)
      .applyQuaternion(this.quaternion);

    this.position.add(_pivotWorldOffset);
  }

  private static _resolvePivot(pivot?: AnchorPivotOption): AnchorPivot {
    if (!pivot) return { x: 0, y: 0 };

    if (typeof pivot === "string") {
      const p = UIRoot._PIVOT_PRESETS[pivot];
      return p ? { x: p.x, y: p.y } : { x: 0, y: 0 };
    }

    return {
      x: UIRoot._clamp01(pivot.x ?? 0),
      y: UIRoot._clamp01(pivot.y ?? 0),
    };
  }

  private static _clamp01(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }
}
