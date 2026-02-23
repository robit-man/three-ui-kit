/**
 * Toggle - on/off switch component.
 * Pill-shaped track with a sliding indicator and optional inline label.
 */

import { Mesh, PlaneGeometry } from "three";
import { UIElement } from "../core/UIElement.js";
import { TextBlock } from "../primitives/TextBlock.js";
import type { UITheme } from "../core/UITheme.js";

export interface ToggleOptions {
  label?: string;
  value?: boolean;
  width?: number;
  height?: number;
  id?: string;
  onChange?: (value: boolean) => void;
}

export class Toggle extends UIElement {
  private _trackContainer: UIElement;
  private _trackMesh: Mesh;
  private _knobMesh: Mesh;
  private _label?: TextBlock;
  private _value: boolean;
  private _onChange?: (value: boolean) => void;
  private _trackW: number;
  private _trackH: number;
  private _knobX = 0;
  private _targetKnobX = 0;
  private _theme?: UITheme;

  constructor(opts: ToggleOptions = {}) {
    const tw = 44;
    const th = 22;
    super({
      sizing: {
        width: opts.width ?? (opts.label ? 160 : tw),
        height: opts.height ?? th,
      },
      interactive: true,
      id: opts.id,
      layout: { type: "STACK_X", gap: 8, align: "center", justify: "start" },
    });

    this._value = opts.value ?? false;
    this._onChange = opts.onChange;
    this._trackW = tw;
    this._trackH = th;

    this._trackContainer = new UIElement({
      sizing: { width: tw, height: th },
    });

    // Track
    this._trackMesh = new Mesh(new PlaneGeometry(1, 1));
    this._trackMesh.name = "toggle-track";
    this._trackMesh.scale.set(tw, th, 1);

    // Knob (small circle approximated as rounded rect)
    this._knobMesh = new Mesh(new PlaneGeometry(1, 1));
    this._knobMesh.name = "toggle-knob";
    const ks = th - 6;
    this._knobMesh.scale.set(ks, ks, 1);

    this._trackContainer.add(this._trackMesh, this._knobMesh);
    this.add(this._trackContainer);

    if (opts.label) {
      this._label = new TextBlock({
        text: opts.label,
        variant: "label",
        colorKey: "text1",
      });
      this.add(this._label);
    }

    this._updateKnobTarget();

    this.on("click", () => {
      this.value = !this._value;
      this._onChange?.(this._value);
    });
  }

  get value(): boolean {
    return this._value;
  }

  set value(v: boolean) {
    this._value = v;
    this._updateKnobTarget();
    this._syncValueVisual();
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._theme = theme;

    this._syncValueVisual();
    this._label?.applyTheme(theme);
    this.registerHitRegion();

    return this;
  }

  private _updateKnobTarget(): void {
    const margin = 3;
    const ks = this._trackH - 6;
    this._targetKnobX = this._value ? this._trackW - ks - margin : margin;
  }

  private _syncValueVisual(): void {
    if (!this._theme) return;

    this._trackMesh.material = this._theme.createPanelMaterial({
      fillColor: this._value ? this._theme.tokens.accentB : this._theme.tokens.bg2,
      fillAlpha: 0.7,
      strokeColor: this._theme.tokens.line1,
      strokeAlpha: 0.3,
      strokeWidth: 1,
      cornerRadius: this._trackH / 2,
    });

    this._knobMesh.material = this._theme.createPanelMaterial({
      fillColor: this._value ? this._theme.tokens.accentA : "#888888",
      fillAlpha: 1,
      cornerRadius: (this._trackH - 6) / 2,
      strokeWidth: 0,
    });
  }

  onUpdate(dt: number): void {
    this._knobX += (this._targetKnobX - this._knobX) * Math.min(1, dt * 12);
    const ks = this._trackH - 6;
    this._knobMesh.position.set(this._knobX + ks / 2, -this._trackH / 2, 0.01);
    this._trackMesh.position.set(this._trackW / 2, -this._trackH / 2, 0);
  }
}
