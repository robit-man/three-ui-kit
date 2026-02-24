/**
 * TriChevron - triangular chevron motif built from three line segments.
 */

import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface TriChevronOptions {
  size?: number;
  thickness?: number;
  inset?: number;
  colorKey?: string;
  id?: string;
}

export class TriChevron extends UIElement {
  private _segments: Mesh[] = [];
  private _size: number;
  private _thickness: number;
  private _inset: number;
  private _colorKey: string;

  constructor(opts: TriChevronOptions = {}) {
    const size = opts.size ?? 36;
    super({
      sizing: { width: size, height: size },
      id: opts.id,
    });

    this._size = size;
    this._thickness = opts.thickness ?? 1;
    this._inset = opts.inset ?? 4;
    this._colorKey = opts.colorKey ?? "accentA";

    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < 3; i++) {
      const seg = new Mesh(geo.clone());
      seg.name = `tri-chevron-seg-${i}`;
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

  private _syncGeometry(): void {
    const size = this.computedWidth > 0 ? this.computedWidth : this._size;
    const centerX = size * 0.5;
    const centerY = -size * 0.5;
    const radius = Math.max(1, size * 0.5 - this._inset);

    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI * 0.5 + (i * Math.PI * 2) / 3;
      const a1 = -Math.PI * 0.5 + ((i + 1) * Math.PI * 2) / 3;

      const x0 = centerX + Math.cos(a0) * radius;
      const y0 = centerY + Math.sin(a0) * radius;
      const x1 = centerX + Math.cos(a1) * radius;
      const y1 = centerY + Math.sin(a1) * radius;

      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.max(1, Math.hypot(dx, dy));

      const seg = this._segments[i];
      seg.scale.set(len, this._thickness, 1);
      seg.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, 0);
      seg.rotation.set(0, 0, Math.atan2(dy, dx));
    }
  }

  onUpdate(): void {
    this._syncGeometry();
  }
}
