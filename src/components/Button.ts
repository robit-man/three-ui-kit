/**
 * Button — interactive panel with label text.
 * Responds to click, hover, press states with themed visual feedback.
 */

import { Panel } from "../primitives/Panel.js";
import { TextBlock } from "../primitives/TextBlock.js";
import { UIElement } from "../core/UIElement.js";
import type { UITheme, VisualState } from "../core/UITheme.js";

export interface ButtonOptions {
  label?: string;
  width?: number;
  height?: number;
  id?: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
}

export class Button extends UIElement {
  private _panel: Panel;
  private _content: UIElement;
  private _label: TextBlock;
  private _onClick?: () => void;

  constructor(opts: ButtonOptions = {}) {
    const buttonW = opts.width ?? 160;
    const buttonH = opts.height ?? 36;

    super({
      sizing: {
        width: buttonW,
        height: buttonH,
      },
      interactive: true,
      id: opts.id,
    });

    const variant = opts.variant ?? "primary";
    this._onClick = opts.onClick;

    // Panel background
    this._panel = new Panel({
      width: buttonW,
      height: buttonH,
      style: Button._variantStyle(variant),
      glow: variant === "primary",
      glowIntensity: 0.3,
    });

    this._content = new UIElement({
      sizing: { width: buttonW, height: buttonH },
      layout: { type: "STACK_X", gap: 0, align: "center", justify: "center" },
    });

    // Label
    this._label = new TextBlock({
      text: opts.label ?? "BUTTON",
      variant: "label",
      align: "center",
      colorKey: variant === "ghost" ? "text1" : "text0",
    });

    this.add(this._panel);
    this._panel.add(this._content);
    this._content.add(this._label);

    // Click handler
    this.on("click", () => {
      this._onClick?.();
    });
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;
    this._panel.applyTheme(theme);
    this._label.applyTheme(theme);
    this.registerHitRegion();
    return this;
  }

  setLabel(text: string): void {
    this._label.setText(text);
  }

  protected onStateChange(state: VisualState): void {
    this._panel.setState(state);
    this._label.setState(state);
  }

  private static _variantStyle(variant: string) {
    switch (variant) {
      case "primary":
        return {
          fillColor: "#0B0C0D",
          strokeColor: "#B88838",
          strokeAlpha: 0.7,
          strokeWidth: 1.5,
          cornerRadius: 4,
          innerGlow: 0.15,
        };
      case "secondary":
        return {
          fillColor: "#0B0C0D",
          strokeColor: "#A56D1D",
          strokeAlpha: 0.4,
          strokeWidth: 1,
          cornerRadius: 4,
        };
      case "ghost":
        return {
          fillAlpha: 0,
          strokeAlpha: 0,
          cornerRadius: 4,
        };
      default:
        return {};
    }
  }

  onUpdate(dt: number): void {
    if (
      typeof this._content.sizing.width === "number" &&
      typeof this._content.sizing.height === "number" &&
      (this._content.sizing.width !== this.computedWidth ||
        this._content.sizing.height !== this.computedHeight)
    ) {
      this._content.sizing.width = this.computedWidth;
      this._content.sizing.height = this.computedHeight;
      this._content.markDirty();
    }

    this._panel.onUpdate(dt);
  }
}
