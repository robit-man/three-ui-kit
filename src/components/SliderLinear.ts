/**
 * SliderLinear - horizontal slider with track, fill, and draggable thumb.
 * Header text/readout is laid out separately from track geometry.
 */

import { Mesh, PlaneGeometry } from "three";
import { UIElement } from "../core/UIElement.js";
import { TextBlock } from "../primitives/TextBlock.js";
import type { UITheme } from "../core/UITheme.js";
import { clamp } from "../utils/math.js";

export interface SliderLinearOptions {
  label?: string;
  value?: number; // 0-1
  width?: number;
  height?: number;
  id?: string;
  showReadout?: boolean;
  onChange?: (value: number) => void;
}

const SPACER_EPSILON = 0.25;

class SliderHeaderSpacer extends UIElement {
  private _row: UIElement;
  private _left: UIElement;
  private _right: UIElement;
  private _gap: number;

  constructor(opts: { row: UIElement; left: UIElement; right: UIElement; gap: number }) {
    super({ sizing: { width: 0, height: 1 } });
    this._row = opts.row;
    this._left = opts.left;
    this._right = opts.right;
    this._gap = opts.gap;
  }

  onUpdate(): void {
    const pad = this._row.layout.padding ?? 0;
    const padX = this._row.layout.paddingX ?? pad;
    const innerW = Math.max(0, this._row.computedWidth - padX * 2);
    const desired = Math.max(
      0,
      innerW - this._left.computedWidth - this._right.computedWidth - this._gap * 2
    );
    const current = typeof this.sizing.width === "number" ? this.sizing.width : 0;
    if (Math.abs(current - desired) > SPACER_EPSILON) {
      this.sizing.width = desired;
      this.markDirty();
    }
  }
}

export class SliderLinear extends UIElement {
  private _trackRow: UIElement;
  private _trackMesh: Mesh;
  private _fillMesh: Mesh;
  private _thumbMesh: Mesh;
  private _labelText?: TextBlock;
  private _readoutText?: TextBlock;
  private _value: number;
  private _onChange?: (value: number) => void;
  private _trackW: number;
  private _trackH: number;
  private _thumbSize: number;
  private _trackRowHeight: number;

  constructor(opts: SliderLinearOptions = {}) {
    const tw = opts.width ?? 200;
    const rowH = opts.height ?? 28;
    const showReadout = opts.showReadout !== false;
    const hasHeader = Boolean(opts.label || showReadout);
    const headerGap = hasHeader ? 8 : 0;

    super({
      sizing: { width: tw, height: "auto" },
      interactive: true,
      id: opts.id,
      layout: { type: "STACK_Y", gap: headerGap },
    });

    this._value = clamp(opts.value ?? 0.5, 0, 1);
    this._onChange = opts.onChange;
    this._trackW = tw;
    this._trackH = 4;
    this._thumbSize = 12;
    this._trackRowHeight = rowH;

    if (hasHeader) {
      const headerRow = new UIElement({
        sizing: { width: tw, height: "auto" },
        layout: { type: "STACK_X", gap: 8, align: "center" },
      });

      if (opts.label) {
        this._labelText = new TextBlock({
          text: opts.label,
          variant: "label",
          colorKey: "text1",
        });
      }

      if (showReadout) {
        this._readoutText = new TextBlock({
          text: this._formatValue(),
          variant: "readout",
          colorKey: "accentA",
          align: "right",
        });
      }

      if (this._labelText && this._readoutText) {
        const spacer = new SliderHeaderSpacer({
          row: headerRow,
          left: this._labelText,
          right: this._readoutText,
          gap: 8,
        });
        headerRow.add(this._labelText, spacer, this._readoutText);
      } else if (this._labelText) {
        headerRow.add(this._labelText);
      } else if (this._readoutText) {
        headerRow.layout.justify = "end";
        headerRow.add(this._readoutText);
      }

      this.add(headerRow);
    }

    this._trackRow = new UIElement({
      sizing: { width: tw, height: rowH },
    });
    this.add(this._trackRow);

    this._trackMesh = new Mesh(new PlaneGeometry(1, 1));
    this._trackMesh.name = "slider-track";
    this._trackRow.add(this._trackMesh);

    this._fillMesh = new Mesh(new PlaneGeometry(1, 1));
    this._fillMesh.name = "slider-fill";
    this._trackRow.add(this._fillMesh);

    this._thumbMesh = new Mesh(new PlaneGeometry(1, 1));
    this._thumbMesh.name = "slider-thumb";
    this._trackRow.add(this._thumbMesh);

    this.on("drag", (e) => {
      this._setValue(this._valueFromLocalX(e.localX));
    });
    this.on("click", (e) => {
      this._setValue(this._valueFromLocalX(e.localX));
    });
    this.on("scroll", (e) => {
      const delta = (e.scrollDelta ?? 0) > 0 ? -0.02 : 0.02;
      this._setValue(clamp(this._value + delta, 0, 1));
    });
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._setValue(v);
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;

    this._trackMesh.material = theme.createPanelMaterial({
      fillColor: theme.tokens.bg2,
      fillAlpha: 0.8,
      strokeWidth: 0,
      cornerRadius: 2,
    });

    this._fillMesh.material = theme.createPanelMaterial({
      fillColor: theme.tokens.accentA,
      fillAlpha: 0.9,
      strokeWidth: 0,
      cornerRadius: 2,
    });

    this._thumbMesh.material = theme.createPanelMaterial({
      fillColor: theme.tokens.accentA,
      fillAlpha: 1,
      strokeColor: theme.tokens.bg0,
      strokeWidth: 1,
      cornerRadius: this._thumbSize / 2,
    });

    this._labelText?.applyTheme(theme);
    this._readoutText?.applyTheme(theme);
    this.registerHitRegion();

    return this;
  }

  private _valueFromLocalX(localX: number): number {
    return clamp(localX / this._trackW, 0, 1);
  }

  private _setValue(v: number): void {
    this._value = clamp(v, 0, 1);
    this._readoutText?.setText(this._formatValue());
    this._onChange?.(this._value);
  }

  private _formatValue(): string {
    return (this._value * 100).toFixed(0) + "%";
  }

  onUpdate(): void {
    const rowH = this._trackRow.computedHeight > 0 ? this._trackRow.computedHeight : this._trackRowHeight;
    const midY = rowH / 2;

    this._trackMesh.scale.set(this._trackW, this._trackH, 1);
    this._trackMesh.position.set(this._trackW / 2, -midY, 0);

    const fillW = Math.max(1, this._trackW * this._value);
    this._fillMesh.scale.set(fillW, this._trackH, 1);
    this._fillMesh.position.set(fillW / 2, -midY, 0.001);

    const tx = this._trackW * this._value;
    this._thumbMesh.scale.set(this._thumbSize, this._thumbSize, 1);
    this._thumbMesh.position.set(tx, -midY, 0.002);
  }
}
