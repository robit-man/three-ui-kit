/**
 * GrainPass — subtle film grain + vignette post-processing pass.
 * Uses a simple full-screen shader for the HUD aesthetic.
 *
 * Can work standalone (as a ShaderPass for EffectComposer) or as
 * a per-panel noise texture (see UITheme.createPanelMaterial noiseAmount).
 */

import {
  WebGLRenderer,
  Camera,
  Scene,
  Vector2,
  ShaderMaterial,
  Mesh,
  PlaneGeometry,
  OrthographicCamera,
  WebGLRenderTarget,
  LinearFilter,
  RGBAFormat,
  HalfFloatType,
} from "three";

/* ------------------------------------------------------------------ */
/*  Grain shader                                                       */
/* ------------------------------------------------------------------ */

const grainVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const grainFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform float uGrainIntensity;
  uniform float uVignetteStrength;
  uniform float uVignetteFalloff;
  uniform vec2 uResolution;

  // Fast hash for grain
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec4 col = texture2D(tDiffuse, vUv);

    // Film grain
    vec2 grainUv = vUv * uResolution;
    float grain = hash(grainUv + uTime * 100.0) - 0.5;
    col.rgb += grain * uGrainIntensity;

    // Vignette
    vec2 uv = vUv * 2.0 - 1.0;
    float dist = length(uv);
    float vignette = 1.0 - smoothstep(uVignetteFalloff, uVignetteFalloff + 0.4, dist) * uVignetteStrength;
    col.rgb *= vignette;

    gl_FragColor = col;
  }
`;

/* ------------------------------------------------------------------ */
/*  Options                                                            */
/* ------------------------------------------------------------------ */

export interface GrainPassOptions {
  renderer: WebGLRenderer;
  /** Grain intensity (0–1). Default 0.04. */
  grainIntensity?: number;
  /** Vignette strength (0–1). Default 0.3. */
  vignetteStrength?: number;
  /** Vignette start falloff (0–1, center-to-edge). Default 0.7. */
  vignetteFalloff?: number;
}

/* ------------------------------------------------------------------ */
/*  GrainPass                                                          */
/* ------------------------------------------------------------------ */

export class GrainPass {
  private _renderer: WebGLRenderer;
  private _material: ShaderMaterial;
  private _quad: Mesh;
  private _orthoCamera: OrthographicCamera;
  private _renderTarget: WebGLRenderTarget;
  private _time = 0;

  enabled = true;

  constructor(opts: GrainPassOptions) {
    this._renderer = opts.renderer;

    const size = opts.renderer.getSize(new Vector2());

    this._material = new ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uGrainIntensity: { value: opts.grainIntensity ?? 0.04 },
        uVignetteStrength: { value: opts.vignetteStrength ?? 0.3 },
        uVignetteFalloff: { value: opts.vignetteFalloff ?? 0.7 },
        uResolution: { value: new Vector2(size.x, size.y) },
      },
      vertexShader: grainVertexShader,
      fragmentShader: grainFragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    this._quad = new Mesh(new PlaneGeometry(2, 2), this._material);
    this._quad.frustumCulled = false;

    this._orthoCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this._renderTarget = new WebGLRenderTarget(size.x, size.y, {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      format: RGBAFormat,
      type: HalfFloatType,
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Parameters                                                       */
  /* ---------------------------------------------------------------- */

  set grainIntensity(v: number) {
    this._material.uniforms.uGrainIntensity.value = v;
  }
  get grainIntensity(): number {
    return this._material.uniforms.uGrainIntensity.value;
  }

  set vignetteStrength(v: number) {
    this._material.uniforms.uVignetteStrength.value = v;
  }
  get vignetteStrength(): number {
    return this._material.uniforms.uVignetteStrength.value;
  }

  set vignetteFalloff(v: number) {
    this._material.uniforms.uVignetteFalloff.value = v;
  }
  get vignetteFalloff(): number {
    return this._material.uniforms.uVignetteFalloff.value;
  }

  /* ---------------------------------------------------------------- */
  /*  Render: wraps a scene render with grain + vignette overlay       */
  /* ---------------------------------------------------------------- */

  /**
   * Render scene into internal target, then apply grain/vignette
   * in a full-screen pass to the default framebuffer.
   */
  render(scene: Scene, camera: Camera): void {
    if (!this.enabled) {
      this._renderer.render(scene, camera);
      return;
    }

    // 1. Render scene to offscreen target
    this._renderer.setRenderTarget(this._renderTarget);
    this._renderer.render(scene, camera);
    this._renderer.setRenderTarget(null);

    // 2. Apply grain/vignette
    this._time += 0.016; // ~60fps tick for grain animation
    this._material.uniforms.tDiffuse.value = this._renderTarget.texture;
    this._material.uniforms.uTime.value = this._time;

    this._renderer.render(this._quad as any, this._orthoCamera);
  }

  /* ---------------------------------------------------------------- */
  /*  Resize                                                           */
  /* ---------------------------------------------------------------- */

  resize(width: number, height: number): void {
    this._renderTarget.setSize(width, height);
    this._material.uniforms.uResolution.value.set(width, height);
  }

  /* ---------------------------------------------------------------- */
  /*  Dispose                                                          */
  /* ---------------------------------------------------------------- */

  dispose(): void {
    this._renderTarget.dispose();
    this._material.dispose();
  }
}
