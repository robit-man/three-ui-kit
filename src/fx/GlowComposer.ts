/**
 * GlowComposer - bloom post-processing manager for desktop.
 * Uses a resilient setup pattern:
 * - ensure composer/render pass exists
 * - ensure bloom pass exists when needed
 * - apply parameter updates even when toggled on late
 */

import {
  WebGLRenderer,
  Camera,
  Scene,
  Vector2,
} from "three";

let EffectComposerCtor: any;
let RenderPassCtor: any;
let UnrealBloomPassCtor: any;

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
  private _composer: any = null;
  private _renderPass: any = null;
  private _bloomPass: any = null;
  private _enabled = false;
  private _initialized = false;
  private _modulesLoaded = false;
  private _initPromise: Promise<void> | null = null;
  private _size = new Vector2();

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
   * Safe to call repeatedly.
   */
  async init(): Promise<void> {
    if (this._initialized) {
      this._enabled = true;
      this._syncBloomParams();
      return;
    }

    if (this._initPromise) {
      await this._initPromise;
      return;
    }

    this._initPromise = this._initInternal();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  private async _initInternal(): Promise<void> {
    const modulesReady = await this._ensureModules();
    if (!modulesReady) {
      this._enabled = false;
      this._initialized = false;
      return;
    }

    this._ensureComposer();
    this._ensureBloomPass();
    this._syncBloomParams();

    this._initialized = !!this._composer;
    this._enabled = this._initialized;
  }

  private async _ensureModules(): Promise<boolean> {
    if (this._modulesLoaded) return true;

    try {
      const postModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/EffectComposer.js"
      );
      EffectComposerCtor = postModule.EffectComposer;

      const renderModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/RenderPass.js"
      );
      RenderPassCtor = renderModule.RenderPass;

      const bloomModule = await import(
        // @ts-ignore
        "three/examples/jsm/postprocessing/UnrealBloomPass.js"
      );
      UnrealBloomPassCtor = bloomModule.UnrealBloomPass;

      this._modulesLoaded = true;
      return true;
    } catch {
      console.warn("[GlowComposer] Could not load post-processing modules. Bloom disabled.");
      return false;
    }
  }

  private _ensureComposer(): void {
    if (this._composer) return;
    if (!EffectComposerCtor || !RenderPassCtor) return;

    this._renderer.getSize(this._size);
    const w = Math.max(1, Math.floor(this._size.x * this.resolutionScale));
    const h = Math.max(1, Math.floor(this._size.y * this.resolutionScale));

    this._composer = new EffectComposerCtor(this._renderer);
    this._composer.setSize(w, h);

    this._renderPass = new RenderPassCtor(this._scene, this._camera);
    this._composer.addPass(this._renderPass);
  }

  private _ensureBloomPass(): void {
    if (!this._composer || this._bloomPass || !UnrealBloomPassCtor) return;

    this._renderer.getSize(this._size);
    const w = Math.max(1, Math.floor(this._size.x * this.resolutionScale));
    const h = Math.max(1, Math.floor(this._size.y * this.resolutionScale));

    this._bloomPass = new UnrealBloomPassCtor(
      new Vector2(w, h),
      this.strength,
      this.radius,
      this.threshold
    );
    this._composer.addPass(this._bloomPass);
  }

  private _syncBloomParams(): void {
    if (!this._bloomPass) return;
    this._bloomPass.strength = this.strength;
    this._bloomPass.radius = this.radius;
    this._bloomPass.threshold = this.threshold;
  }

  /** Render the bloom composite. Call instead of renderer.render() when enabled. */
  render(): void {
    if (!this._initialized || !this._enabled) {
      this._renderer.render(this._scene, this._camera);
      return;
    }
    this._syncBloomParams();
    this._composer.render();
  }

  /** Enable / disable bloom. */
  set enabled(v: boolean) {
    this._enabled = v;
    if (v && !this._initialized) {
      void this.init();
    }
  }
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

    if (this._enabled) {
      if (!this._initialized || !this._bloomPass) {
        void this.init();
      } else {
        this._syncBloomParams();
      }
    }
  }

  /** Resize on viewport change. */
  resize(width: number, height: number): void {
    if (this._composer) {
      const w = Math.max(1, Math.floor(width * this.resolutionScale));
      const h = Math.max(1, Math.floor(height * this.resolutionScale));
      this._composer.setSize(w, h);
      if (this._bloomPass && typeof this._bloomPass.setSize === "function") {
        this._bloomPass.setSize(w, h);
      }
    }
  }

  dispose(): void {
    // EffectComposer doesn't have a dispose, but we can null refs
    this._composer = null;
    this._renderPass = null;
    this._bloomPass = null;
    this._enabled = false;
    this._initialized = false;
    this._initPromise = null;
  }
}
