/**
 * SegmentedHexRing - segmented ring motif with hex-biased orientation.
 */

import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface SegmentedHexRingOptions {
  size?: number;
  segments?: number;
  segmentLength?: number;
  thickness?: number;
  radius?: number;
  colorKey?: string;
  id?: string;
}

export class SegmentedHexRing extends UIElement {
  private _segments: Mesh[] = [];
  private _size: number;
  private _segmentCount: number;
  private _segmentLength: number;
  private _thickness: number;
  private _radius: number;
  private _colorKey: string;

  constructor(opts: SegmentedHexRingOptions = {}) {
    const size = opts.size ?? 72;
    const count = Math.max(6, Math.round(opts.segments ?? 18));
    super({
      sizing: { width: size, height: size },
      id: opts.id,
    });

    this._size = size;
    this._segmentCount = count;
    this._segmentLength = opts.segmentLength ?? 8;
    this._thickness = opts.thickness ?? 1;
    this._radius = opts.radius ?? size * 0.34;
    this._colorKey = opts.colorKey ?? "accentA";

    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const seg = new Mesh(geo.clone());
      seg.name = `segmented-hex-ring-${i}`;
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
    const baseRadius = this._radius;

    for (let i = 0; i < this._segments.length; i++) {
      const t = i / this._segments.length;
      const angle = -Math.PI * 0.5 + t * Math.PI * 2;
      const hexSnap = Math.round((angle / (Math.PI * 2)) * 6) * (Math.PI / 3);
      const snapDelta = Math.abs(angle - hexSnap);
      const bias = 1 - Math.min(1, snapDelta / (Math.PI / 6));

      const radius = baseRadius * (0.9 + bias * 0.1);
      const segLength = this._segmentLength * (0.9 + bias * 0.25);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const seg = this._segments[i];
      seg.scale.set(segLength, this._thickness, 1);
      seg.position.set(x, y, 0);
      seg.rotation.set(0, 0, angle + Math.PI * 0.5);
    }
  }

  onUpdate(): void {
    this._syncGeometry();
  }
}
