/**
 * RadialGauge - ring/arc gauge for displaying a 0-1 value.
 * Uses a dedicated gauge area with centered readout and optional label row.
 */

import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from "three";
import { UIElement } from "../core/UIElement.js";
import { TextBlock } from "../primitives/TextBlock.js";
import type { UITheme } from "../core/UITheme.js";
import { clamp } from "../utils/math.js";

export interface RadialGaugeOptions {
  radius?: number;
  thickness?: number;
  value?: number;
  label?: string;
  id?: string;
  startAngle?: number; // radians, default -PI/2 (top)
  sweepAngle?: number; // radians, default 2*PI
}

export class RadialGauge extends UIElement {
  private _mesh: Mesh;
  private _gaugeArea: UIElement;
  private _label?: TextBlock;
  private _labelRow?: UIElement;
  private _readout: TextBlock;
  private _value: number;
  private _radius: number;
  private _thickness: number;
  private _startAngle: number;
  private _sweepAngle: number;
  private _gaugeSize: number;

  constructor(opts: RadialGaugeOptions = {}) {
    const r = opts.radius ?? 60;
    const gaugeSize = r * 2 + 20; // extra for glow

    super({
      sizing: { width: gaugeSize, height: "auto" },
      layout: { type: "STACK_Y", gap: opts.label ? 8 : 0, align: "center" },
      id: opts.id,
    });

    this._value = clamp(opts.value ?? 0.65, 0, 1);
    this._radius = r;
    this._thickness = opts.thickness ?? 6;
    this._startAngle = opts.startAngle ?? -Math.PI / 2;
    this._sweepAngle = opts.sweepAngle ?? Math.PI * 2;
    this._gaugeSize = gaugeSize;

    this._gaugeArea = new UIElement({
      sizing: { width: gaugeSize, height: gaugeSize },
    });
    this.add(this._gaugeArea);

    this._mesh = new Mesh(new PlaneGeometry(1, 1));
    this._mesh.name = "radial-gauge";
    this._gaugeArea.add(this._mesh);

    this._readout = new TextBlock({
      text: this._formatValue(),
      variant: "readout",
      colorKey: "accentA",
      align: "center",
    });
    this._gaugeArea.add(this._readout);

    if (opts.label) {
      this._labelRow = new UIElement({
        sizing: { width: gaugeSize, height: "auto" },
        layout: { type: "STACK_X", gap: 0, align: "center", justify: "center" },
      });

      this._label = new TextBlock({
        text: opts.label,
        variant: "label",
        colorKey: "text1",
        align: "center",
      });
      this._labelRow.add(this._label);
      this.add(this._labelRow);
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
    const sz = this._gaugeSize;
    this._mesh.scale.set(sz, sz, 1);
    this._mesh.position.set(sz / 2, -sz / 2, 0);

    const readoutX = sz / 2;
    const readoutY = (sz - this._readout.computedHeight) / 2;
    this._readout.position.set(readoutX, -readoutY, 0.01);
  }
}
