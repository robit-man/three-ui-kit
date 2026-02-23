/**
 * Icon — simple quad with a texture or flat color.
 * For the HUD aesthetic, icons are typically thin-line SVG-style or
 * simple geometric shapes rendered via texture atlas.
 */

import { Mesh, PlaneGeometry, Texture, MeshBasicMaterial } from "three";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface IconOptions {
  size?: number;
  texture?: Texture;
  colorKey?: string;
  id?: string;
}

export class Icon extends UIElement {
  private _mesh: Mesh;
  private _size: number;
  private _colorKey: string;

  constructor(opts: IconOptions = {}) {
    const sz = opts.size ?? 20;
    super({
      sizing: { width: sz, height: sz },
      id: opts.id,
    });

    this._size = sz;
    this._colorKey = opts.colorKey ?? "text1";

    const geo = new PlaneGeometry(1, 1);
    const mat = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      map: opts.texture ?? null,
    });
    mat.toneMapped = false;

    this._mesh = new Mesh(geo, mat);
    this._mesh.name = "icon";
    super.add(this._mesh);
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    const c = theme.colors[this._colorKey];
    if (c) {
      (this._mesh.material as MeshBasicMaterial).color.copy(c.color);
      (this._mesh.material as MeshBasicMaterial).opacity = c.alpha;
    }
    return this;
  }

  setTexture(tex: Texture): void {
    (this._mesh.material as MeshBasicMaterial).map = tex;
    (this._mesh.material as MeshBasicMaterial).needsUpdate = true;
  }

  syncSize(): void {
    this._mesh.scale.set(this._size, this._size, 1);
    this._mesh.position.set(this._size / 2, -this._size / 2, 0);
  }

  onUpdate(): void {
    this.syncSize();
  }
}
