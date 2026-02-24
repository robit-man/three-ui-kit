/**
 * DataTag - compact data label block with marker and text.
 */

import { Panel } from "./Panel.js";
import { MarkerPlus } from "./MarkerPlus.js";
import { TextBlock, type TextVariant } from "./TextBlock.js";
import type { UITheme } from "../core/UITheme.js";

export interface DataTagOptions {
  text?: string;
  variant?: TextVariant;
  width?: number;
  height?: number;
  colorKey?: string;
  textColorKey?: string;
  id?: string;
}

export class DataTag extends Panel {
  private _marker: MarkerPlus;
  private _label: TextBlock;

  constructor(opts: DataTagOptions = {}) {
    const width = opts.width ?? 120;
    const height = opts.height ?? 24;
    const colorKey = opts.colorKey ?? "accentA";
    const textColorKey = opts.textColorKey ?? "text1";

    super({
      width,
      height,
      layout: { type: "STACK_X", gap: 6, padding: 6, align: "center" },
      style: {
        fillColor: "#050607",
        fillAlpha: 0.03,
        strokeColor: colorKey === "accentA" ? "#B88838" : "#7FD6C1",
        strokeAlpha: 0.5,
        strokeWidth: 1,
        cornerRadius: 3,
      },
      id: opts.id,
      glow: true,
      glowIntensity: 0.08,
    });

    this._marker = new MarkerPlus({
      size: Math.max(6, Math.round(height * 0.35)),
      thickness: 1,
      colorKey,
    });
    this._label = new TextBlock({
      text: opts.text ?? "DATA TAG",
      variant: opts.variant ?? "small",
      colorKey: textColorKey,
      align: "left",
    });
    this._label.sizing.width = Math.max(10, width - 24);
    this._label.sizing.height = Math.max(12, height - 8);

    this.add(this._marker, this._label);
  }

  applyTheme(theme: UITheme): this {
    super.applyTheme(theme);
    this._marker.applyTheme(theme);
    this._label.applyTheme(theme);
    return this;
  }

  setText(text: string): void {
    this._label.setText(text);
  }
}
