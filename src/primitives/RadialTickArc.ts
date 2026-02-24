/**
 * RadialTickArc - configurable arc of radial ticks.
 */

import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface RadialTickArcOptions {
  size?: number;
  radius?: number;
  tickCount?: number;
  tickLength?: number;
  thickness?: number;
  startAngle?: number;
  sweepAngle?: number;
  majorEvery?: number;
  majorScale?: number;
  colorKey?: string;
  id?: string;
}

export class RadialTickArc extends UIElement {
  private _ticks: Mesh[] = [];
  private _size: number;
  private _radius: number;
  private _tickLength: number;
  private _thickness: number;
  private _startAngle: number;
  private _sweepAngle: number;
  private _majorEvery: number;
  private _majorScale: number;
  private _colorKey: string;

  constructor(opts: RadialTickArcOptions = {}) {
    const size = opts.size ?? 88;
    const tickCount = Math.max(2, Math.round(opts.tickCount ?? 32));
    super({
      sizing: { width: size, height: size },
      id: opts.id,
    });

    this._size = size;
    this._radius = opts.radius ?? size * 0.38;
    this._tickLength = opts.tickLength ?? 6;
    this._thickness = opts.thickness ?? 1;
    this._startAngle = opts.startAngle ?? -Math.PI * 0.75;
    this._sweepAngle = opts.sweepAngle ?? Math.PI * 1.5;
    this._majorEvery = Math.max(1, Math.round(opts.majorEvery ?? 6));
    this._majorScale = opts.majorScale ?? 1.6;
    this._colorKey = opts.colorKey ?? "line1";

    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < tickCount; i++) {
      const tick = new Mesh(geo.clone());
      tick.name = `radial-tick-${i}`;
      this._ticks.push(tick);
      super.add(tick);
    }
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    for (const tick of this._ticks) {
      tick.material = theme.createFlatMaterial(this._colorKey);
    }
    return this;
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);
    for (const tick of this._ticks) {
      const mat = tick.material as ShaderMaterial & {
        uniforms?: { uStateMul?: { value: number } };
      };
      if (mat.uniforms?.uStateMul) mat.uniforms.uStateMul.value = mul;
    }
  }

  private _syncGeometry(): void {
    const size = this.computedWidth > 0 ? this.computedWidth : this._size;
    const centerX = size * 0.5;
    const centerY = -size * 0.5;
    const count = this._ticks.length;

    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const angle = this._startAngle + this._sweepAngle * t;
      const major = i % this._majorEvery === 0;
      const len = this._tickLength * (major ? this._majorScale : 1);

      const x = centerX + Math.cos(angle) * this._radius;
      const y = centerY + Math.sin(angle) * this._radius;

      const tick = this._ticks[i];
      tick.scale.set(len, this._thickness, 1);
      tick.position.set(x, y, 0);
      tick.rotation.set(0, 0, angle);
    }
  }

  onUpdate(): void {
    this._syncGeometry();
  }
}
