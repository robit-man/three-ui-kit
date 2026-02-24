/**
 * RadialGauge - ring/arc gauge for displaying a 0-1 value.
 * Keeps the gauge centered in its own box and can place an optional label
 * around that center (top/right/bottom/left).
 */

import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from "three";
import { UIElement } from "../core/UIElement.js";
import { TextBlock } from "../primitives/TextBlock.js";
import type { UITheme } from "../core/UITheme.js";
import { clamp } from "../utils/math.js";

export type RadialGaugeLabelPosition = "top" | "right" | "bottom" | "left";

export interface RadialGaugeOptions {
  size?: number;
  radius?: number;
  thickness?: number;
  value?: number;
  label?: string;
  labelPosition?: RadialGaugeLabelPosition;
  labelOffset?: number;
  id?: string;
  startAngle?: number; // radians, default -PI/2 (top)
  sweepAngle?: number; // radians, default 2*PI
}

export class RadialGauge extends UIElement {
  private _mesh: Mesh;
  private _label?: TextBlock;
  private _readout: TextBlock;
  private _value: number;
  private _radius: number;
  private _thickness: number;
  private _startAngle: number;
  private _sweepAngle: number;
  private _gaugeSize: number;
  private _labelPosition: RadialGaugeLabelPosition;
  private _labelOffset: number;
  private _readoutBoxWidth: number;
  private _readoutBoxHeight: number;

  constructor(opts: RadialGaugeOptions = {}) {
    const explicitSize =
      typeof opts.size === "number" && Number.isFinite(opts.size)
        ? Math.max(12, opts.size)
        : undefined;
    const fallbackRadius =
      typeof opts.radius === "number" && Number.isFinite(opts.radius)
        ? Math.max(2, opts.radius)
        : explicitSize !== undefined
          ? Math.max(2, explicitSize * 0.5 - 10)
          : 60;
    const gaugeSize = explicitSize ?? fallbackRadius * 2 + 20; // extra for glow
    const maxRadius = Math.max(2, gaugeSize * 0.5 - 2);
    const ringRadius = Math.min(fallbackRadius, maxRadius);

    super({
      sizing: { width: gaugeSize, height: gaugeSize },
      layout: { type: "ABSOLUTE" },
      id: opts.id,
    });

    this._value = clamp(opts.value ?? 0.65, 0, 1);
    this._radius = ringRadius;
    this._thickness = opts.thickness ?? 6;
    this._startAngle = opts.startAngle ?? -Math.PI / 2;
    this._sweepAngle = opts.sweepAngle ?? Math.PI * 2;
    this._gaugeSize = gaugeSize;
    this._labelPosition = opts.labelPosition ?? "bottom";
    this._labelOffset =
      typeof opts.labelOffset === "number" && Number.isFinite(opts.labelOffset)
        ? Math.max(0, opts.labelOffset)
        : 6;
    this._readoutBoxWidth = Math.max(40, Math.round(gaugeSize * 0.5));
    this._readoutBoxHeight = 20;

    this._mesh = new Mesh(new PlaneGeometry(1, 1));
    this._mesh.name = "radial-gauge";
    this.add(this._mesh);

    this._readout = new TextBlock({
      text: this._formatValue(),
      variant: "readout",
      colorKey: "accentA",
      align: "center",
    });
    this._readout.sizing.width = this._readoutBoxWidth;
    this._readout.sizing.height = this._readoutBoxHeight;
    this.add(this._readout);

    if (opts.label) {
      this._label = new TextBlock({
        text: opts.label,
        variant: "label",
        colorKey: "text1",
        align: "center",
      });
      this.add(this._label);
    }
  }

  get value(): number {
    return this._value;
  }

  set value(v: number) {
    this._value = clamp(v, 0, 1);
    const nextText = this._formatValue();
    if (this._readout.getText() !== nextText) {
      this._readout.setText(nextText);
    }
    this._updateUniform();
  }

  applyTheme(theme: UITheme): this {
    this.theme = theme;

    const accentC = theme.colors.accentA;
    const bgC = theme.colors.bg2;
    const glowC = theme.colors.glowA;

    const mat = new ShaderMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: new Vector2(this._gaugeSize, this._gaugeSize) },
        uRadius: { value: this._radius },
        uThickness: { value: this._thickness },
        uValue: { value: this._value },
        uStartAngle: { value: this._startAngle },
        uSweepAngle: { value: this._sweepAngle },
        uFillColor: { value: accentC.color.clone() },
        uBgColor: { value: bgC.color.clone() },
        uGlowColor: { value: glowC.color.clone() },
        uStateMul: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uSize;
        uniform float uRadius;
        uniform float uThickness;
        uniform float uValue;
        uniform float uStartAngle;
        uniform float uSweepAngle;
        uniform vec3 uFillColor;
        uniform vec3 uBgColor;
        uniform vec3 uGlowColor;
        uniform float uStateMul;

        #define PI 3.14159265359

        void main() {
          vec2 px = (vUv - 0.5) * uSize;
          float dist = length(px);
          float angle = atan(px.y, px.x);

          // Normalize angle relative to start
          float a = angle - uStartAngle;
          if (a < 0.0) a += 2.0 * PI;
          if (a > 2.0 * PI) a -= 2.0 * PI;

          // Ring mask
          float ringDist = abs(dist - uRadius) - uThickness * 0.5;
          float ringMask = 1.0 - smoothstep(0.0, 1.5, ringDist);

          // Background arc (full sweep)
          float bgMask = ringMask * step(a, uSweepAngle);
          vec4 col = vec4(uBgColor * 0.3, bgMask * 0.5);

          // Fill arc
          float fillEnd = uSweepAngle * uValue;
          float fillMask = ringMask * step(a, fillEnd);
          col.rgb = mix(col.rgb, uFillColor * uStateMul, fillMask);
          col.a = max(col.a, fillMask * 0.9);

          // Outer glow on the fill arc
          float glowDist = abs(dist - uRadius) - uThickness;
          float glow = exp(-glowDist * 0.3) * fillMask * 0.3 * uStateMul;
          col.rgb += uGlowColor * glow;
          col.a = max(col.a, glow);

          if (col.a < 0.001) discard;
          gl_FragColor = col;
        }
      `,
    });
    mat.toneMapped = false;

    this._mesh.material = mat;
    this._readout.applyTheme(theme);
    this._label?.applyTheme(theme);

    return this;
  }

  private _updateUniform(): void {
    const mat = this._mesh.material as ShaderMaterial;
    if (mat?.uniforms?.uValue) {
      mat.uniforms.uValue.value = this._value;
    }
  }

  private _formatValue(): string {
    return Math.round(this._value * 100).toString();
  }

  onUpdate(): void {
    const boxW = this.computedWidth > 0 ? this.computedWidth : this._gaugeSize;
    const boxH = this.computedHeight > 0 ? this.computedHeight : this._gaugeSize;
    const sz = Math.max(1, Math.min(boxW, boxH));
    const insetX = (boxW - sz) * 0.5;
    const insetY = (boxH - sz) * 0.5;
    const ringRadius = Math.max(2, Math.min(this._radius, sz * 0.5 - 2));

    this._mesh.scale.set(sz, sz, 1);
    this._mesh.position.set(insetX + sz * 0.5, -(insetY + sz * 0.5), 0);

    const mat = this._mesh.material as ShaderMaterial;
    if (mat?.uniforms?.uSize) {
      mat.uniforms.uSize.value.set(sz, sz);
    }
    if (mat?.uniforms?.uRadius) {
      mat.uniforms.uRadius.value = ringRadius;
    }
    if (mat?.uniforms?.uThickness) {
      mat.uniforms.uThickness.value = this._thickness;
    }

    const readoutW =
      this._readout.computedWidth > 0
        ? this._readout.computedWidth
        : this._readoutBoxWidth;
    const readoutH =
      this._readout.computedHeight > 0
        ? this._readout.computedHeight
        : this._readoutBoxHeight;
    const readoutX = insetX + (sz - readoutW) * 0.5;
    const readoutY = insetY + (sz - readoutH) * 0.5;
    this._readout.position.set(readoutX, -readoutY, 0.01);

    if (!this._label) return;

    const labelW =
      this._label.computedWidth > 0 ? this._label.computedWidth : this._label.measure().width;
    const labelH =
      this._label.computedHeight > 0 ? this._label.computedHeight : this._label.measure().height;
    const centerX = insetX + sz * 0.5;
    const centerY = insetY + sz * 0.5;
    const radialDistance = ringRadius + this._thickness * 0.5 + this._labelOffset;

    let labelCenterX = centerX;
    let labelCenterY = centerY;
    switch (this._labelPosition) {
      case "top":
        labelCenterY -= radialDistance;
        break;
      case "right":
        labelCenterX += radialDistance;
        break;
      case "left":
        labelCenterX -= radialDistance;
        break;
      case "bottom":
      default:
        labelCenterY += radialDistance;
        break;
    }

    const labelX = labelCenterX - labelW * 0.5;
    const labelY = labelCenterY - labelH * 0.5;
    this._label.position.set(labelX, -labelY, 0.01);
  }
}
