/**
 * GlowComposer — selective bloom post-processing for desktop.
 * Tier B glow: EffectComposer + UnrealBloomPass on a dedicated layer.
 *
 * Usage:
 *   Place glow-only meshes on layer GLOW_LAYER (default 1).
 *   The bloom pass renders only that layer, then composites.
 */

import {
  WebGLRenderer,
  Camera,
  Scene,
  Layers,
  Vector2,
  ShaderMaterial,
  MeshBasicMaterial,
  Color,
} from "three";

// Dynamic imports for post-processing (tree-shakeable)
// Users must have three/examples/jsm available

let EffectComposer: any;
let RenderPass: any;
let UnrealBloomPass: any;
let ShaderPass: any;

export const GLOW_LAYER = 1;

export interface GlowComposerOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  /** Bloom strength (default 0.8) */
  strength?: number;
  /** Bloom radius (default 0.4) */
  radius?: number;
  /** Bloom threshold (default 0.1) */
  threshold?: number;
  /** Resolution scale (default 0.5 for performance) */
  resolutionScale?: number;
}

export class GlowComposer {
  private _renderer: WebGLRenderer;
  private _scene: Scene;
  private _camera: Camera;
  private _composer: any; // EffectComposer
  private _bloomPass: any; // UnrealBloomPass
  private _enabled = false;
  private _initialized = false;

  strength: number;
  radius: number;
  threshold: number;
  resolutionScale: number;

  constructor(opts: GlowComposerOptions) {
    this._renderer = opts.renderer;
    this._scene = opts.scene;
    this._camera = opts.camera;
    this.strength = opts.strength ?? 0.8;
    this.radius = opts.radius ?? 0.4;
    this.threshold = opts.threshold ?? 0.1;
    this.resolutionScale = opts.resolutionScale ?? 0.5;
  }

  /**
   * Initialize post-processing pipeline.
   * Call once, after imports are available.
   */
  async init(): Promise<void> {
    try {
      const postModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/EffectComposer.js"
      );
      EffectComposer = postModule.EffectComposer;

      const renderModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/RenderPass.js"
      );
      RenderPass = renderModule.RenderPass;

      const bloomModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/UnrealBloomPass.js"
      );
      UnrealBloomPass = bloomModule.UnrealBloomPass;

      const shaderModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/ShaderPass.js"
      );
      ShaderPass = shaderModule.ShaderPass;
    } catch {
      console.warn("[GlowComposer] Could not load post-processing modules. Bloom disabled.");
      return;
    }

    const size = this._renderer.getSize(new Vector2());
    const w = Math.floor(size.x * this.resolutionScale);
    const h = Math.floor(size.y * this.resolutionScale);

    this._composer = new EffectComposer(this._renderer);
    this._composer.setSize(w, h);

    const renderPass = new RenderPass(this._scene, this._camera);
    this._composer.addPass(renderPass);

    this._bloomPass = new UnrealBloomPass(
      new Vector2(w, h),
      this.strength,
      this.radius,
      this.threshold
    );
    this._composer.addPass(this._bloomPass);

    this._initialized = true;
    this._enabled = true;
  }

  /** Render the bloom composite. Call instead of renderer.render() when enabled. */
  render(): void {
    if (!this._initialized || !this._enabled) {
      this._renderer.render(this._scene, this._camera);
      return;
    }
    this._composer.render();
  }

  /** Enable / disable bloom. */
  set enabled(v: boolean) { this._enabled = v; }
  get enabled(): boolean { return this._enabled; }

  /** Update bloom parameters live. */
  setParams(strength?: number, radius?: number, threshold?: number): void {
    if (strength !== undefined) {
      this.strength = strength;
      if (this._bloomPass) this._bloomPass.strength = strength;
    }
    if (radius !== undefined) {
      this.radius = radius;
      if (this._bloomPass) this._bloomPass.radius = radius;
    }
    if (threshold !== undefined) {
      this.threshold = threshold;
      if (this._bloomPass) this._bloomPass.threshold = threshold;
    }
  }

  /** Resize on viewport change. */
  resize(width: number, height: number): void {
    if (this._composer) {
      const w = Math.floor(width * this.resolutionScale);
      const h = Math.floor(height * this.resolutionScale);
      this._composer.setSize(w, h);
    }
  }

  dispose(): void {
    // EffectComposer doesn't have a dispose, but we can null refs
    this._composer = null;
    this._bloomPass = null;
    this._enabled = false;
  }
}
