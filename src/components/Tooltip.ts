/**
 * Tooltip — small floating panel that appears on hover.
 * Anchored above or below the target element.
 */

import { UIElement } from "../core/UIElement.js";
import { Panel } from "../primitives/Panel.js";
import { TextBlock } from "../primitives/TextBlock.js";
import type { UITheme } from "../core/UITheme.js";

export interface TooltipOptions {
  text: string;
  position?: "above" | "below";
  maxWidth?: number;
  id?: string;
}

export class Tooltip extends UIElement {
  private _panel: Panel;
  private _text: TextBlock;
  private _pos: "above" | "below";
  private _isShown = false;

  constructor(opts: TooltipOptions) {
    super({
      sizing: { width: "auto", height: "auto" },
      id: opts.id,
    });

    this._pos = opts.position ?? "above";

    this._panel = new Panel({
      width: "auto",
      height: "auto",
      style: {
        fillColor: "#0B0C0D",
        fillAlpha: 0.95,
        strokeColor: "#B88838",
        strokeAlpha: 0.3,
        strokeWidth: 1,
        cornerRadius: 4,
      },
      layout: { type: "STACK_Y", padding: 8 },
    });

    this._text = new TextBlock({
      text: opts.text,
      variant: "small",
      colorKey: "text0",
      maxWidth: opts.maxWidth ?? 200,
    });

    this._panel.add(this._text);
    this.add(this._panel);
    this.visible = false;
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._panel.applyTheme(theme);
    this._text.applyTheme(theme);
    return this;
  }

  show(targetElement: UIElement): void {
    this._isShown = true;
    this.visible = true;

    // Position relative to target
    if (this._pos === "above") {
      this.position.set(0, targetElement.computedHeight + 4, 0.02);
    } else {
      this.position.set(0, -(this._panel.computedHeight + 4), 0.02);
    }
  }

  hide(): void {
    this._isShown = false;
    this.visible = false;
  }

  get isShown(): boolean { return this._isShown; }

  setText(text: string): void {
    this._text.setText(text);
  }

  onUpdate(dt: number): void {
    this._panel.onUpdate(dt);
  }
}
