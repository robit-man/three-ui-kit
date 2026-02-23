/**
 * Panel — rounded-rect SDF panel primitive.
 * Single PlaneGeometry; shape drawn entirely in the fragment shader.
 */

import { Mesh, PlaneGeometry, Vector2 } from "three";
import { UIElement, type SizeProps, type StyleProps, type LayoutProps } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface PanelOptions {
  width?: number | "auto";
  height?: number | "auto";
  layout?: Partial<LayoutProps>;
  style?: Partial<StyleProps>;
  interactive?: boolean;
  id?: string;
  /** Enable per-element shader glow halo */
  glow?: boolean;
  glowIntensity?: number;
}

export class Panel extends UIElement {
  private _mesh: Mesh;
  private _glowMesh?: Mesh;
  private _geo: PlaneGeometry;

  constructor(opts: PanelOptions = {}) {
    super({
      layout: opts.layout ? { type: "STACK_Y", ...opts.layout } : { type: "STACK_Y" },
      sizing: {
        width: opts.width ?? 200,
        height: opts.height ?? 100,
      },
      style: opts.style,
      interactive: opts.interactive,
      id: opts.id,
    });

    this._geo = new PlaneGeometry(1, 1);
    this._mesh = new Mesh(this._geo);
    this._mesh.name = "panel-fill";
    super.add(this._mesh);

    if (opts.glow) {
      this._glowMesh = new Mesh(new PlaneGeometry(1, 1));
      this._glowMesh.name = "panel-glow";
      this._glowMesh.renderOrder = -1;
      super.add(this._glowMesh);
    }
  }

  /** Call after theme is assigned to build materials. */
  applyTheme(theme: UITheme): this {
    this.theme = theme;

    const s = this.style;
    const mat = theme.createPanelMaterial({
      fillColor: s.fillColor,
      fillAlpha: s.fillAlpha,
      strokeColor: s.strokeColor,
      strokeAlpha: s.strokeAlpha,
      strokeWidth: s.strokeWidth,
      cornerRadius: s.cornerRadius,
      innerGlow: s.innerGlow,
      noiseAmount: s.noiseAmount,
    });
    this._mesh.material = mat;

    if (this._glowMesh) {
      const glowMat = theme.createGlowMaterial({
        color: s.strokeColor ?? theme.tokens.accentA,
      });
      this._glowMesh.material = glowMat;
    }

    if (this.interactive) {
      this.registerHitRegion();
    }

    return this;
  }

  /** Resize the panel mesh to match computed layout size. */
  syncSize(): void {
    const w = this.computedWidth;
    const h = this.computedHeight;
    if (w <= 0 || h <= 0) return;

    this._mesh.scale.set(w, h, 1);
    this._mesh.position.set(w / 2, -h / 2, 0);

    const mat = this._mesh.material as any;
    if (mat?.uniforms?.uSize) {
      mat.uniforms.uSize.value.set(w, h);
    }

    if (this._glowMesh) {
      const pad = 16; // glow extends beyond panel
      this._glowMesh.scale.set(w + pad * 2, h + pad * 2, 1);
      this._glowMesh.position.set(w / 2, -h / 2, -0.01);
      const gm = this._glowMesh.material as any;
      if (gm?.uniforms?.uSize) {
        gm.uniforms.uSize.value.set(w + pad * 2, h + pad * 2);
      }
    }

    this.syncHitRegion();
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);
    const mat = this._mesh.material as any;
    if (mat?.uniforms?.uStateMul) {
      mat.uniforms.uStateMul.value = mul;
    }
    if (this._glowMesh) {
      const gm = this._glowMesh.material as any;
      if (gm?.uniforms?.uStateMul) {
        gm.uniforms.uStateMul.value = mul;
      }
    }
  }

  onUpdate(_dt: number): void {
    this.syncSize();
  }
}
