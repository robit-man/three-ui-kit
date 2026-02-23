/**
 * MarkerPlus — crosshair "+" marker glyph primitive.
 * Renders two intersecting thin rectangles for the HUD crosshair motif.
 */

import { Mesh, PlaneGeometry, Group } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface MarkerPlusOptions {
  size?: number;
  thickness?: number;
  colorKey?: string;
  id?: string;
}

export class MarkerPlus extends UIElement {
  private _hMesh: Mesh;
  private _vMesh: Mesh;
  private _size: number;
  private _thickness: number;
  private _colorKey: string;

  constructor(opts: MarkerPlusOptions = {}) {
    const sz = opts.size ?? 12;
    super({
      sizing: { width: sz, height: sz },
      id: opts.id,
    });

    this._size = sz;
    this._thickness = opts.thickness ?? 1;
    this._colorKey = opts.colorKey ?? "line1";

    const geo = new PlaneGeometry(1, 1);

    // Horizontal bar
    this._hMesh = new Mesh(geo.clone());
    this._hMesh.name = "marker-h";
    this._hMesh.scale.set(sz, this._thickness, 1);
    this._hMesh.position.set(sz / 2, -sz / 2, 0);

    // Vertical bar
    this._vMesh = new Mesh(geo.clone());
    this._vMesh.name = "marker-v";
    this._vMesh.scale.set(this._thickness, sz, 1);
    this._vMesh.position.set(sz / 2, -sz / 2, 0);

    super.add(this._hMesh, this._vMesh);
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    const mat = theme.createFlatMaterial(this._colorKey);
    this._hMesh.material = mat;
    this._vMesh.material = mat.clone();
    return this;
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);
    for (const m of [this._hMesh, this._vMesh]) {
      const mat = m.material as any;
      if (mat?.uniforms?.uStateMul) mat.uniforms.uStateMul.value = mul;
    }
  }
}
