/**
 * UITheme — token set + material factory
 * All visual constants live here; components never hardcode colors.
 */

import {
  Color,
  ShaderMaterial,
  Vector2,
  FrontSide,
  AdditiveBlending,
  type Blending,
  NormalBlending,
} from "three";

/* ------------------------------------------------------------------ */
/*  Token types                                                       */
/* ------------------------------------------------------------------ */

export interface ThemeTokens {
  bg0: string;
  bg1: string;
  bg2: string;
  line0: string;
  line1: string;
  text0: string;
  text1: string;
  accentA: string;
  accentB: string;
  warn: string;
  ok: string;
  glowA: string;

  fontFamily: string;
  fontSizes: [number, number, number, number, number]; // 12/14/16/20/28
  letterSpacing: number;

  /** Multipliers applied per visual state */
  stateMultipliers: {
    idle: number;
    hover: number;
    pressed: number;
    active: number;
    disabled: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Default dark-HUD tokens                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_TOKENS: ThemeTokens = {
  bg0: "#050607",
  bg1: "#0B0C0D",
  bg2: "#121416",
  line0: "rgba(235,240,245,0.08)",
  line1: "rgba(235,240,245,0.16)",
  text0: "rgba(235,240,245,0.92)",
  text1: "rgba(235,240,245,0.70)",
  accentA: "#B88838",
  accentB: "#A56D1D",
  warn: "#D9B64C",
  ok: "#7FD6C1",
  glowA: "rgba(184,136,56,0.9)",

  fontFamily: "IBM Plex Mono, Space Mono, Rajdhani, monospace",
  fontSizes: [12, 14, 16, 20, 28],
  letterSpacing: 0.06,

  stateMultipliers: {
    idle: 1.0,
    hover: 1.35,
    pressed: 1.6,
    active: 1.5,
    disabled: 0.35,
  },
};

/* ------------------------------------------------------------------ */
/*  Parsed colour helper                                               */
/* ------------------------------------------------------------------ */

function parseColor(raw: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba()
  const rgbaMatch = raw.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]) / 255,
      g: Number(rgbaMatch[2]) / 255,
      b: Number(rgbaMatch[3]) / 255,
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  // Hex
  const c = new Color(raw);
  return { r: c.r, g: c.g, b: c.b, a: 1 };
}

/* ------------------------------------------------------------------ */
/*  UITheme class                                                      */
/* ------------------------------------------------------------------ */

export type VisualState = "idle" | "hover" | "pressed" | "active" | "disabled";

export class UITheme {
  tokens: ThemeTokens;

  /* Pre-parsed colours (linear-space Color + alpha) */
  colors: Record<string, { color: Color; alpha: number }> = {};

  constructor(tokens: Partial<ThemeTokens> = {}) {
    this.tokens = { ...DEFAULT_TOKENS, ...tokens };
    this._parseAll();
  }

  private _parseAll() {
    const t = this.tokens;
    const keys: (keyof ThemeTokens)[] = [
      "bg0", "bg1", "bg2", "line0", "line1",
      "text0", "text1", "accentA", "accentB",
      "warn", "ok", "glowA",
    ];
    for (const k of keys) {
      const raw = t[k] as string;
      const p = parseColor(raw);
      this.colors[k] = { color: new Color(p.r, p.g, p.b), alpha: p.a };
    }
  }

  /* Return a glow/stroke intensity multiplier for the current visual state */
  stateMultiplier(state: VisualState): number {
    return this.tokens.stateMultipliers[state];
  }

  /* ---------------------------------------------------------------- */
  /*  Material factories                                               */
  /* ---------------------------------------------------------------- */

  /**
   * Rounded-rect SDF panel material.
   * Single plane geometry; shape drawn entirely in the fragment shader.
   */
  createPanelMaterial(opts: {
    fillColor?: string;
    fillAlpha?: number;
    strokeColor?: string;
    strokeAlpha?: number;
    strokeWidth?: number;
    cornerRadius?: number;
    innerGlow?: number;
    noiseAmount?: number;
    depthTest?: boolean;
    renderOrder?: number;
  } = {}): ShaderMaterial {
    const fill = opts.fillColor
      ? parseColor(opts.fillColor)
      : parseColor(this.tokens.bg1);
    const stroke = opts.strokeColor
      ? parseColor(opts.strokeColor)
      : parseColor(this.tokens.line1);

    const mat = new ShaderMaterial({
      transparent: true,
      depthTest: opts.depthTest ?? true,
      depthWrite: false,
      side: FrontSide,
      uniforms: {
        uSize: { value: new Vector2(1, 1) },
        uFillColor: { value: new Color(fill.r, fill.g, fill.b) },
        uFillAlpha: { value: opts.fillAlpha ?? fill.a },
        uStrokeColor: { value: new Color(stroke.r, stroke.g, stroke.b) },
        uStrokeAlpha: { value: opts.strokeAlpha ?? stroke.a },
        uStrokeWidth: { value: opts.strokeWidth ?? 1.5 },
        uCornerRadius: { value: opts.cornerRadius ?? 6.0 },
        uInnerGlow: { value: opts.innerGlow ?? 0.0 },
        uNoise: { value: opts.noiseAmount ?? 0.0 },
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
        uniform vec3 uFillColor;
        uniform float uFillAlpha;
        uniform vec3 uStrokeColor;
        uniform float uStrokeAlpha;
        uniform float uStrokeWidth;
        uniform float uCornerRadius;
        uniform float uInnerGlow;
        uniform float uNoise;
        uniform float uStateMul;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b + r;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
        }

        // Simple hash for noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec2 px = vUv * uSize;
          vec2 center = uSize * 0.5;
          float dist = roundedBoxSDF(px - center, center, uCornerRadius);

          // Fill
          float fillMask = 1.0 - smoothstep(-1.0, 0.0, dist);
          vec4 col = vec4(uFillColor, uFillAlpha * fillMask);

          // Stroke
          float strokeOuter = smoothstep(0.0, 1.0, dist + uStrokeWidth);
          float strokeInner = smoothstep(0.0, 1.0, dist);
          float strokeMask = strokeOuter - strokeInner;
          // Boost stroke on hover/active via uStateMul
          float sMul = mix(1.0, uStateMul, 0.5);
          col.rgb = mix(col.rgb, uStrokeColor * sMul, strokeMask * uStrokeAlpha);
          col.a = max(col.a, strokeMask * uStrokeAlpha);

          // Inner glow (soft falloff from edges inward)
          if (uInnerGlow > 0.0) {
            float glowDist = clamp(-dist / (uSize.x * 0.25), 0.0, 1.0);
            float glow = (1.0 - glowDist) * uInnerGlow * sMul;
            col.rgb += uStrokeColor * glow * 0.3;
          }

          // Noise / grain
          if (uNoise > 0.0) {
            float n = hash(px * 0.5) * uNoise;
            col.rgb += n * 0.08;
          }

          if (col.a < 0.001) discard;
          gl_FragColor = col;
        }
      `,
    });

    mat.toneMapped = false;
    if (opts.renderOrder !== undefined) {
      // store for the mesh to pick up
      (mat as any)._uikitRenderOrder = opts.renderOrder;
    }
    return mat;
  }

  /**
   * Glow halo material — renders a soft outer glow around a shape.
   * Used for per-element shader glow (Tier A).
   */
  createGlowMaterial(opts: {
    color?: string;
    intensity?: number;
    falloff?: number;
    depthTest?: boolean;
  } = {}): ShaderMaterial {
    const gc = opts.color
      ? parseColor(opts.color)
      : parseColor(this.tokens.glowA);

    return new ShaderMaterial({
      transparent: true,
      depthTest: opts.depthTest ?? false,
      depthWrite: false,
      blending: AdditiveBlending as Blending,
      uniforms: {
        uSize: { value: new Vector2(1, 1) },
        uColor: { value: new Color(gc.r, gc.g, gc.b) },
        uIntensity: { value: opts.intensity ?? 0.5 },
        uFalloff: { value: opts.falloff ?? 8.0 },
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
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uFalloff;
        uniform float uStateMul;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b + r;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
        }

        void main() {
          vec2 px = vUv * uSize;
          vec2 center = uSize * 0.5;
          float dist = roundedBoxSDF(px - center, center, 6.0);
          float glow = exp(-dist / uFalloff) * uIntensity * uStateMul;
          float mask = smoothstep(0.0, 1.0, dist); // only outside
          gl_FragColor = vec4(uColor * glow * mask, glow * mask);
        }
      `,
    });
  }

  /**
   * Simple unlit flat-color material for strokes / dividers / markers.
   */
  createFlatMaterial(colorKey: string, opts: {
    depthTest?: boolean;
    blending?: Blending;
  } = {}): ShaderMaterial {
    const c = this.colors[colorKey] ?? { color: new Color(1, 1, 1), alpha: 1 };
    return new ShaderMaterial({
      transparent: true,
      depthTest: opts.depthTest ?? true,
      depthWrite: false,
      blending: opts.blending ?? NormalBlending,
      uniforms: {
        uColor: { value: c.color.clone() },
        uAlpha: { value: c.alpha },
        uStateMul: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColor;
        uniform float uAlpha;
        uniform float uStateMul;
        void main() {
          gl_FragColor = vec4(uColor * uStateMul, uAlpha);
        }
      `,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Factory helper                                                     */
/* ------------------------------------------------------------------ */

export function ThemeFactory(overrides?: Partial<ThemeTokens>): UITheme {
  return new UITheme(overrides);
}
