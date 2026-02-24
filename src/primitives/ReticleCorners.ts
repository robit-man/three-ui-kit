/**
 * ReticleCorners - four corner "L" marks for targeting/overlay motifs.
 */

import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface ReticleCornersOptions {
  width?: number;
  height?: number;
  armLength?: number;
  thickness?: number;
  colorKey?: string;
  id?: string;
}

export class ReticleCorners extends UIElement {
  private _segments: Mesh[] = [];
  private _width: number;
  private _height: number;
  private _armLength: number;
  private _thickness: number;
  private _colorKey: string;

  constructor(opts: ReticleCornersOptions = {}) {
    const width = opts.width ?? 64;
    const height = opts.height ?? 64;
    super({
      sizing: { width, height },
      id: opts.id,
    });

    this._width = width;
    this._height = height;
    this._armLength = opts.armLength ?? 12;
    this._thickness = opts.thickness ?? 1;
    this._colorKey = opts.colorKey ?? "line1";

    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < 8; i++) {
      const seg = new Mesh(geo.clone());
      seg.name = `reticle-corner-seg-${i}`;
      this._segments.push(seg);
      super.add(seg);
    }
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    for (const seg of this._segments) {
      seg.material = theme.createFlatMaterial(this._colorKey);
    }
    return this;
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);
    for (const seg of this._segments) {
      const mat = seg.material as ShaderMaterial & {
        uniforms?: { uStateMul?: { value: number } };
      };
      if (mat.uniforms?.uStateMul) mat.uniforms.uStateMul.value = mul;
    }
  }

  private _placeSegment(mesh: Mesh, x: number, y: number, w: number, h: number): void {
    mesh.scale.set(w, h, 1);
    mesh.position.set(x + w * 0.5, -(y + h * 0.5), 0);
  }

  private _syncGeometry(): void {
    const w = this.computedWidth > 0 ? this.computedWidth : this._width;
    const h = this.computedHeight > 0 ? this.computedHeight : this._height;
    const arm = Math.min(this._armLength, w * 0.5, h * 0.5);
    const t = this._thickness;

    // top-left
    this._placeSegment(this._segments[0], 0, 0, arm, t);
    this._placeSegment(this._segments[1], 0, 0, t, arm);
    // top-right
    this._placeSegment(this._segments[2], w - arm, 0, arm, t);
    this._placeSegment(this._segments[3], w - t, 0, t, arm);
    // bottom-left
    this._placeSegment(this._segments[4], 0, h - t, arm, t);
    this._placeSegment(this._segments[5], 0, h - arm, t, arm);
    // bottom-right
    this._placeSegment(this._segments[6], w - arm, h - t, arm, t);
    this._placeSegment(this._segments[7], w - t, h - arm, t, arm);
  }

  onUpdate(): void {
    this._syncGeometry();
  }
}
