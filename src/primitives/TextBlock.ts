/**
 * TextBlock — SDF text rendering via troika-three-text.
 * Supports anchoring, baseline alignment, and monospaced numeric readouts.
 */

import { Color } from "three";
// @ts-ignore — troika-three-text ships its own types
import { Text } from "troika-three-text";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export type TextVariant = "body" | "label" | "title" | "readout" | "small";
export type TextAlignV = "top" | "center" | "bottom";

export interface TextBlockOptions {
  text?: string;
  variant?: TextVariant;
  colorKey?: string;
  align?: "left" | "center" | "right";
  alignV?: TextAlignV;
  maxWidth?: number;
  id?: string;
}

const VARIANT_SIZE_INDEX: Record<TextVariant, number> = {
  small: 0,   // 12
  label: 1,   // 14
  body: 2,    // 16
  title: 3,   // 20
  readout: 2, // 16 (mono, tabular)
};

export class TextBlock extends UIElement {
  private static readonly MEASURE_EPSILON = 0.01;
  private _troika: any; // troika Text instance
  private _variant: TextVariant;
  private _colorKey: string;
  private _text: string;
  private _alignX: "left" | "center" | "right";
  private _alignV: TextAlignV;
  private _maxWidth: number;
  private _synced = false;

  constructor(opts: TextBlockOptions = {}) {
    super({
      sizing: { width: "auto", height: "auto" },
      id: opts.id,
    });

    this._text = opts.text ?? "";
    this._variant = opts.variant ?? "body";
    this._colorKey = opts.colorKey ?? (this._variant === "label" ? "text1" : "text0");
    this._alignX = opts.align ?? "left";
    this._alignV = opts.alignV ?? "top";
    this._maxWidth = opts.maxWidth ?? 0;

    this._troika = new Text();
    this._troika.text = this._text;
    this._troika.anchorX = this._alignX;
    this._troika.anchorY = "top";
    this._troika.depthOffset = -0.001;
    this._troika.material.toneMapped = false;
    this._troika.name = "text-block";

    super.add(this._troika);
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    const t = theme.tokens;
    const sizeIdx = VARIANT_SIZE_INDEX[this._variant];
    const fontSize = t.fontSizes[sizeIdx];

    this._troika.font = undefined; // Use default (will be loaded by troika)
    this._troika.fontSize = fontSize;
    this._troika.letterSpacing = t.letterSpacing;

    if (this._variant === "readout") {
      this._troika.letterSpacing = 0.1;
      // Use monospace for readouts
      this._troika.font = undefined; // troika falls back to monospace
    }

    const c = theme.colors[this._colorKey];
    if (c) {
      this._troika.color = c.color.getHex();
      this._troika.fillOpacity = c.alpha;
    }

    if (this._maxWidth > 0) {
      this._troika.maxWidth = this._maxWidth;
    }

    this._troika.sync(() => {
      const prevW = this.intrinsicWidth;
      const prevH = this.intrinsicHeight;
      this._synced = true;
      this._updateMeasurement();
      if (this._measurementChanged(prevW, prevH) && this._sizeDependsOnMeasurement()) {
        this.markDirty();
      }
    });

    return this;
  }

  /* ---------------------------------------------------------------- */
  /*  Dynamic text update                                              */
  /* ---------------------------------------------------------------- */

  setText(text: string): void {
    if (this._text === text) return;
    this._text = text;
    this._troika.text = text;
    this._troika.sync(() => {
      const prevW = this.intrinsicWidth;
      const prevH = this.intrinsicHeight;
      this._synced = true;
      this._updateMeasurement();
      if (this._measurementChanged(prevW, prevH) && this._sizeDependsOnMeasurement()) {
        this.markDirty();
      }
    });
  }

  getText(): string {
    return this._text;
  }

  /* ---------------------------------------------------------------- */
  /*  Measurement                                                      */
  /* ---------------------------------------------------------------- */

  measure(): { width: number; height: number } {
    return { width: this.intrinsicWidth, height: this.intrinsicHeight };
  }

  private _updateMeasurement(): void {
    const bounds = this._troika.textRenderInfo?.blockBounds;
    if (bounds) {
      this.intrinsicWidth = bounds[2] - bounds[0];
      this.intrinsicHeight = bounds[3] - bounds[1];
    } else {
      // Approximate
      const size = this._troika.fontSize || 16;
      this.intrinsicWidth = this._text.length * size * 0.6;
      this.intrinsicHeight = size * 1.3;
    }
  }

  protected onStateChange(state: VisualState): void {
    if (!this.theme) return;
    const mul = this.theme.stateMultiplier(state);
    this._troika.fillOpacity = (this.theme.colors[this._colorKey]?.alpha ?? 1) * mul;
  }

  onUpdate(): void {
    this._syncAnchorOffset();
    if (!this._synced) return;
    const prevW = this.intrinsicWidth;
    const prevH = this.intrinsicHeight;
    this._updateMeasurement();
    if (this._measurementChanged(prevW, prevH) && this._sizeDependsOnMeasurement()) {
      this.markDirty();
    }
  }

  private _measurementChanged(prevW: number, prevH: number): boolean {
    return (
      Math.abs(this.intrinsicWidth - prevW) > TextBlock.MEASURE_EPSILON ||
      Math.abs(this.intrinsicHeight - prevH) > TextBlock.MEASURE_EPSILON
    );
  }

  private _sizeDependsOnMeasurement(): boolean {
    return this.sizing.width === "auto" || this.sizing.height === "auto";
  }

  private _syncAnchorOffset(): void {
    const widthRef =
      this.computedWidth > 0 ? this.computedWidth : this.intrinsicWidth;

    let x = 0;
    if (this._alignX === "center") {
      x = widthRef * 0.5;
    } else if (this._alignX === "right") {
      x = widthRef;
    }

    this._troika.position.x = x;
  }

  dispose(): void {
    this._troika.dispose();
  }
}
