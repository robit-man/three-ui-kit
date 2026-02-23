/**
 * Stroke — thin-line stroke primitive.
 * Renders a horizontal or vertical line segment via a thin plane + flat material.
 */

import { Mesh, PlaneGeometry } from "three";
import { UIElement, type StyleProps } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface StrokeOptions {
  direction?: "horizontal" | "vertical";
  length?: number;
  thickness?: number;
  colorKey?: string;
  id?: string;
}

export class Stroke extends UIElement {
  private _mesh: Mesh;
  direction: "horizontal" | "vertical";
  length: number;
  thickness: number;
  colorKey: string;

  constructor(opts: StrokeOptions = {}) {
    super({
      sizing: {
        width: opts.direction === "vertical" ? (opts.thickness ?? 1) : (opts.length ?? 100),
        height: opts.direction === "vertical" ? (opts.length ?? 100) : (opts.thickness ?? 1),
      },
      id: opts.id,
    });

    this.direction = opts.direction ?? "horizontal";
    this.length = opts.length ?? 100;
    this.thickness = opts.thickness ?? 1;
    this.colorKey = opts.colorKey ?? "line1";

    this._mesh = new Mesh(new PlaneGeometry(1, 1));
    this._mesh.name = "stroke";
    super.add(this._mesh);
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._mesh.material = theme.createFlatMaterial(this.colorKey);
    return this;
  }

  syncSize(): void {
    const w = this.computedWidth || (this.direction === "horizontal" ? this.length : this.thickness);
    const h = this.computedHeight || (this.direction === "vertical" ? this.length : this.thickness);
    this._mesh.scale.set(w, h, 1);
    this._mesh.position.set(w / 2, -h / 2, 0);
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mat = this._mesh.material as any;
    if (mat?.uniforms?.uStateMul) {
      mat.uniforms.uStateMul.value = this.theme.stateMultiplier(state);
    }
  }

  onUpdate(): void {
    this.syncSize();
  }
}
