/**
 * UIConstraints — responsive sizing rules.
 * Primary: FOV-based scaling for camera-attached UI.
 */

import { PerspectiveCamera, Camera } from "three";
import { clamp } from "../utils/math.js";

/* ------------------------------------------------------------------ */
/*  FOV-fit constraint                                                 */
/* ------------------------------------------------------------------ */

export interface FovFitOptions {
  /** Distance from camera to UI root (meters) */
  distance: number;
  /** Target fraction of frustum height the UI should occupy */
  targetHeightFrac: number;
  /** Optional fixed design height (UI units) to avoid live layout scale jitter. */
  designHeightUI?: number;
  /** Optional cap on width fraction */
  targetWidthFrac?: number;
  /** Scale clamps */
  minScale?: number;
  maxScale?: number;
}

export class UIConstraintFovFit {
  distance: number;
  targetHeightFrac: number;
  designHeightUI?: number;
  targetWidthFrac: number;
  minScale: number;
  maxScale: number;

  /** Computed values (read after compute()) */
  scale = 1;
  frustumWidth = 0;
  frustumHeight = 0;

  constructor(opts: FovFitOptions) {
    this.distance = opts.distance;
    this.targetHeightFrac = opts.targetHeightFrac;
    this.designHeightUI = opts.designHeightUI;
    this.targetWidthFrac = opts.targetWidthFrac ?? 1;
    this.minScale = opts.minScale ?? 0.4;
    this.maxScale = opts.maxScale ?? 2.0;
  }

  /**
   * Compute the root scale so the UI occupies the desired screen fraction.
   * @param camera - PerspectiveCamera
   * @param rootHeightUI - the UI root's design height in UI units
   * @param uiUnitMeters - size of 1 UI unit in meters (default 0.01)
   * @returns scale to apply to the UI root
   */
  compute(
    camera: Camera,
    rootHeightUI: number,
    uiUnitMeters: number = 0.01
  ): number {
    if (!(camera instanceof PerspectiveCamera)) {
      this.scale = 1;
      return 1;
    }

    const fovRad = (camera.fov * Math.PI) / 180;
    this.frustumHeight = 2 * this.distance * Math.tan(fovRad / 2);
    this.frustumWidth = this.frustumHeight * camera.aspect;

    // Target world height for the UI
    const targetWorldH = this.frustumHeight * this.targetHeightFrac;

    // Current world height if scale=1
    const effectiveHeightUI = this.designHeightUI ?? rootHeightUI;
    const currentWorldH = effectiveHeightUI * uiUnitMeters;

    if (currentWorldH <= 0) {
      this.scale = 1;
      return 1;
    }

    let s = targetWorldH / currentWorldH;

    // Width cap
    // const targetWorldW = this.frustumWidth * this.targetWidthFrac;
    // could clamp here if needed

    s = clamp(s, this.minScale, this.maxScale);
    this.scale = s;
    return s;
  }
}

/* ------------------------------------------------------------------ */
/*  Breakpoint helper                                                  */
/* ------------------------------------------------------------------ */

export interface Breakpoint {
  maxWidth: number;
  apply: (availableWidth: number, availableHeight: number) => void;
}

export class UIBreakpoints {
  private _breakpoints: Breakpoint[] = [];

  add(bp: Breakpoint): this {
    this._breakpoints.push(bp);
    this._breakpoints.sort((a, b) => a.maxWidth - b.maxWidth);
    return this;
  }

  evaluate(width: number, height: number): void {
    for (const bp of this._breakpoints) {
      if (width <= bp.maxWidth) {
        bp.apply(width, height);
        return;
      }
    }
  }
}
