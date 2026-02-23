/**
 * UIManager - orchestrates update loop, layout, input dispatch,
 * XR integration, and debug helper overlays.
 */

import {
  AxesHelper,
  Camera,
  Euler,
  Matrix4,
  Object3D,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

import { UIRoot } from "./UIRoot.js";
import { UIElement } from "./UIElement.js";
import type { UIPointer } from "../input/UIPointer.js";
import { MousePointer } from "../input/MousePointer.js";
import { TouchPointer } from "../input/TouchPointer.js";
import { XRPointer } from "../input/XRPointer.js";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type GlowMode = "shader" | "bloom";

export interface UIManagerOptions {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  /** Touch hit slop in UI units. Default 10. */
  touchSlop?: number;
  /** Initial glow mode. Default "shader". */
  glowMode?: GlowMode;
}

export interface UIDebugSnapshot {
  pointerId: string;
  elementId: string;
  elementUuid: string;
  localPosition: { x: number; y: number; z: number };
  worldPosition: { x: number; y: number; z: number };
  worldQuaternion: { x: number; y: number; z: number; w: number };
  worldEulerDeg: { x: number; y: number; z: number };
  computedSize: { width: number; height: number };
  hitRegion?: { x: number; y: number; w: number; h: number; slop: number };
}

/* ------------------------------------------------------------------ */
/*  UIManager                                                         */
/* ------------------------------------------------------------------ */

const ROOT_AXIS_SIZE = 0.08;
const ELEMENT_AXIS_SIZE = 0.04;
const RAD_TO_DEG = 180 / Math.PI;

const _raycaster = new Raycaster();
const _invMatrix = new Matrix4();
const _tmpWorldPos = new Vector3();
const _tmpWorldQuat = new Quaternion();
const _tmpEuler = new Euler();

export class UIManager {
  renderer: WebGLRenderer;
  camera: Camera;
  scene: Scene;
  touchSlop: number;
  glowMode: GlowMode;
  private _canvas: HTMLCanvasElement;

  /** All managed roots */
  private _roots: UIRoot[] = [];

  /** Active pointers */
  private _pointers: UIPointer[] = [];
  private _mousePointer?: MousePointer;
  private _touchPointers: Map<number, TouchPointer> = new Map();
  private _xrPointers: XRPointer[] = [];

  /** Currently hovered element per pointer */
  private _hoveredMap: Map<string, UIElement | null> = new Map();
  private _touchCleanupTimers: Map<number, number> = new Map();

  /** DOM listeners kept for proper teardown */
  private _onMousePointerMove?: (e: PointerEvent) => void;
  private _onMousePointerDown?: (e: PointerEvent) => void;
  private _onMousePointerUp?: (e: PointerEvent) => void;
  private _onMouseWheel?: (e: WheelEvent) => void;
  private _onTouchPointerDown?: (e: PointerEvent) => void;
  private _onTouchPointerMove?: (e: PointerEvent) => void;
  private _onTouchPointerUp?: (e: PointerEvent) => void;
  private _onTouchPointerCancel?: (e: PointerEvent) => void;

  /** Debug helpers */
  private _rootAxesHelpers: Map<UIRoot, AxesHelper> = new Map();
  private _elementAxesHelpers: Map<UIElement, AxesHelper> = new Map();

  debug = {
    showHitRegions: false,
    showLayoutBounds: false,
    showAnchorAxes: false,
    showElementAxes: false,
  };

  constructor(opts: UIManagerOptions) {
    this.renderer = opts.renderer;
    this.camera = opts.camera;
    this.scene = opts.scene;
    this.touchSlop = opts.touchSlop ?? 10;
    this.glowMode = opts.glowMode ?? "shader";
    this._canvas = this.renderer.domElement;

    this._initMouseInput();
    this._initTouchInput();
  }

  /* ---------------------------------------------------------------- */
  /*  Root management                                                 */
  /* ---------------------------------------------------------------- */

  addRoot(root: UIRoot): this {
    this._roots.push(root);
    root.attachTo(this.scene);
    return this;
  }

  removeRoot(root: UIRoot): this {
    const idx = this._roots.indexOf(root);
    if (idx >= 0) {
      this._roots.splice(idx, 1);
      root.detach();
      this._removeRootAxesHelper(root);
      this._removeElementAxesForRoot(root);
    }
    return this;
  }

  /* ---------------------------------------------------------------- */
  /*  Glow mode                                                       */
  /* ---------------------------------------------------------------- */

  setGlowMode(mode: GlowMode): void {
    this.glowMode = mode;
  }

  /* ---------------------------------------------------------------- */
  /*  Debug access                                                    */
  /* ---------------------------------------------------------------- */

  setDebugHelpersEnabled(enabled: boolean): void {
    this.debug.showAnchorAxes = enabled;
    this.debug.showElementAxes = enabled;
  }

  getHovered(pointerId?: string): UIElement | null {
    const resolved = this._resolvePointerId(pointerId);
    if (!resolved) return null;
    return this._hoveredMap.get(resolved) ?? null;
  }

  getDebugSnapshot(pointerId?: string): UIDebugSnapshot | null {
    const resolved = this._resolvePointerId(pointerId);
    if (!resolved) return null;

    const hovered = this._hoveredMap.get(resolved) ?? null;
    if (!hovered) return null;

    hovered.getWorldPosition(_tmpWorldPos);
    hovered.getWorldQuaternion(_tmpWorldQuat);
    _tmpEuler.setFromQuaternion(_tmpWorldQuat, "YXZ");

    const hit = hovered.hitRegions[0];

    return {
      pointerId: resolved,
      elementId: hovered.elementId ?? "(unlabeled)",
      elementUuid: hovered.uuid,
      localPosition: {
        x: hovered.position.x,
        y: hovered.position.y,
        z: hovered.position.z,
      },
      worldPosition: {
        x: _tmpWorldPos.x,
        y: _tmpWorldPos.y,
        z: _tmpWorldPos.z,
      },
      worldQuaternion: {
        x: _tmpWorldQuat.x,
        y: _tmpWorldQuat.y,
        z: _tmpWorldQuat.z,
        w: _tmpWorldQuat.w,
      },
      worldEulerDeg: {
        x: _tmpEuler.x * RAD_TO_DEG,
        y: _tmpEuler.y * RAD_TO_DEG,
        z: _tmpEuler.z * RAD_TO_DEG,
      },
      computedSize: {
        width: hovered.computedWidth,
        height: hovered.computedHeight,
      },
      hitRegion: hit
        ? {
            x: hit.x,
            y: hit.y,
            w: hit.w,
            h: hit.h,
            slop: hit.slop,
          }
        : undefined,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Main update - call once per frame                               */
  /* ---------------------------------------------------------------- */

  update(dt: number): void {
    // Update XR pointers if in XR session
    this._updateXRPointers();

    // Update all roots
    for (const root of this._roots) {
      root.update(dt, this.camera);
    }

    // Gather all pointers
    this._pointers.length = 0;
    if (this._mousePointer) this._pointers.push(this._mousePointer);
    for (const tp of this._touchPointers.values()) this._pointers.push(tp);
    for (const xp of this._xrPointers) this._pointers.push(xp);

    // Process input for each pointer
    for (const pointer of this._pointers) {
      this._processPointer(pointer);
    }

    this._updateDebugHelpers();

    // Reset per-frame flags
    if (this._mousePointer) this._mousePointer.resetFrame();
    for (const tp of this._touchPointers.values()) tp.resetFrame();
    for (const xp of this._xrPointers) xp.resetFrame();
  }

  /* ---------------------------------------------------------------- */
  /*  Hit testing                                                     */
  /* ---------------------------------------------------------------- */

  private _processPointer(pointer: UIPointer): void {
    const hit = this._hitTest(pointer);
    const prevHovered = this._hoveredMap.get(pointer.id) ?? null;

    if (prevHovered && prevHovered !== hit?.element) {
      prevHovered.setState("idle");
      prevHovered.emit(
        UIElement.createEvent("pointerleave", prevHovered, 0, 0, pointer.id)
      );
    }
    if (hit && hit.element !== prevHovered) {
      hit.element.setState("hover");
      hit.element.emit(
        UIElement.createEvent(
          "pointerenter",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id
        )
      );
    }

    this._hoveredMap.set(pointer.id, hit?.element ?? null);

    if (!hit) return;

    if (pointer.justPressed) {
      hit.element.setState("pressed");
      hit.element.emit(
        UIElement.createEvent(
          "pointerdown",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id
        )
      );
    }

    if (pointer.justReleased) {
      hit.element.emit(
        UIElement.createEvent(
          "pointerup",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id
        )
      );
      hit.element.emit(
        UIElement.createEvent(
          "click",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id
        )
      );
      hit.element.setState("hover");
    }

    if (pointer.scrollDelta && pointer.scrollDelta !== 0) {
      hit.element.emit(
        UIElement.createEvent(
          "scroll",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id,
          pointer.scrollDelta
        )
      );
    }

    if (pointer.pressed && !pointer.justPressed) {
      hit.element.emit(
        UIElement.createEvent(
          "drag",
          hit.element,
          hit.localX,
          hit.localY,
          pointer.id
        )
      );
    }
  }

  private _hitTest(
    pointer: UIPointer
  ): { element: UIElement; localX: number; localY: number } | null {
    _raycaster.set(pointer.origin, pointer.direction);

    let bestHit: {
      element: UIElement;
      localX: number;
      localY: number;
      dist: number;
    } | null = null;

    for (const root of this._roots) {
      root.updateMatrixWorld(true);
      _invMatrix.copy(root.matrixWorld).invert();

      const localOrigin = pointer.origin.clone().applyMatrix4(_invMatrix);
      const localDir = pointer.direction
        .clone()
        .transformDirection(_invMatrix)
        .normalize();

      if (Math.abs(localDir.z) < 1e-6) continue;
      const t = -localOrigin.z / localDir.z;
      if (t < 0) continue;

      const lx = localOrigin.x + localDir.x * t;
      const ly = localOrigin.y + localDir.y * t;
      const dist = t;

      const regions = root.collectHitRegions();
      for (const region of regions) {
        const el = region.element;
        const worldPos = new Vector3();
        el.getWorldPosition(worldPos);
        const localElPos = worldPos.applyMatrix4(_invMatrix);

        const slop = pointer.kind === "touch" ? this.touchSlop : region.slop;
        const rx = localElPos.x - slop;
        const ry = localElPos.y - region.h - slop;
        const rw = region.w + slop * 2;
        const rh = region.h + slop * 2;

        if (lx >= rx && lx <= rx + rw && ly >= ry && ly <= ry + rh) {
          if (!bestHit || dist < bestHit.dist) {
            bestHit = {
              element: el,
              localX: lx - localElPos.x,
              localY: ly - localElPos.y,
              dist,
            };
          }
        }
      }
    }

    return bestHit
      ? { element: bestHit.element, localX: bestHit.localX, localY: bestHit.localY }
      : null;
  }

  /* ---------------------------------------------------------------- */
  /*  Debug helper update                                              */
  /* ---------------------------------------------------------------- */

  private _updateDebugHelpers(): void {
    if (!this.debug.showAnchorAxes) {
      this._clearRootAxesHelpers();
    } else {
      this._updateRootAxesHelpers();
    }

    if (!this.debug.showElementAxes) {
      this._clearElementAxesHelpers();
    } else {
      this._updateElementAxesHelpers();
    }
  }

  private _updateRootAxesHelpers(): void {
    const activeRoots = new Set<UIRoot>(this._roots);

    for (const root of this._roots) {
      let helper = this._rootAxesHelpers.get(root);
      if (!helper) {
        helper = this._createAxesHelper(ROOT_AXIS_SIZE);
        this._rootAxesHelpers.set(root, helper);
        this.scene.add(helper);
      }
      root.getWorldPosition(_tmpWorldPos);
      root.getWorldQuaternion(_tmpWorldQuat);
      helper.position.copy(_tmpWorldPos);
      helper.quaternion.copy(_tmpWorldQuat);
    }

    for (const [root, helper] of this._rootAxesHelpers) {
      if (!activeRoots.has(root)) {
        this._disposeAxesHelper(helper);
        this._rootAxesHelpers.delete(root);
      }
    }
  }

  private _updateElementAxesHelpers(): void {
    const activeElements = new Set<UIElement>();

    for (const root of this._roots) {
      const regions = root.collectHitRegions();
      for (const region of regions) {
        activeElements.add(region.element);
      }
    }

    const hovered = this.getHovered();
    if (hovered) activeElements.add(hovered);

    for (const element of activeElements) {
      let helper = this._elementAxesHelpers.get(element);
      if (!helper) {
        helper = this._createAxesHelper(ELEMENT_AXIS_SIZE);
        this._elementAxesHelpers.set(element, helper);
        this.scene.add(helper);
      }
      element.getWorldPosition(_tmpWorldPos);
      element.getWorldQuaternion(_tmpWorldQuat);
      helper.position.copy(_tmpWorldPos);
      helper.quaternion.copy(_tmpWorldQuat);
    }

    for (const [element, helper] of this._elementAxesHelpers) {
      if (!activeElements.has(element)) {
        this._disposeAxesHelper(helper);
        this._elementAxesHelpers.delete(element);
      }
    }
  }

  private _createAxesHelper(size: number): AxesHelper {
    const helper = new AxesHelper(size);
    const material = helper.material as any;
    if (Array.isArray(material)) {
      for (const m of material) {
        m.depthTest = false;
        m.transparent = true;
        m.opacity = 0.9;
        m.toneMapped = false;
      }
    } else if (material) {
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.9;
      material.toneMapped = false;
    }
    helper.renderOrder = 9999;
    return helper;
  }

  private _disposeAxesHelper(helper: AxesHelper): void {
    helper.removeFromParent();
    helper.geometry.dispose();
    const material = helper.material as any;
    if (Array.isArray(material)) {
      for (const m of material) {
        if (m && typeof m.dispose === "function") m.dispose();
      }
    } else if (material && typeof material.dispose === "function") {
      material.dispose();
    }
  }

  private _clearRootAxesHelpers(): void {
    for (const helper of this._rootAxesHelpers.values()) {
      this._disposeAxesHelper(helper);
    }
    this._rootAxesHelpers.clear();
  }

  private _clearElementAxesHelpers(): void {
    for (const helper of this._elementAxesHelpers.values()) {
      this._disposeAxesHelper(helper);
    }
    this._elementAxesHelpers.clear();
  }

  private _removeRootAxesHelper(root: UIRoot): void {
    const helper = this._rootAxesHelpers.get(root);
    if (!helper) return;
    this._disposeAxesHelper(helper);
    this._rootAxesHelpers.delete(root);
  }

  private _removeElementAxesForRoot(root: UIRoot): void {
    for (const [element, helper] of this._elementAxesHelpers) {
      if (this._belongsToRoot(element, root)) {
        this._disposeAxesHelper(helper);
        this._elementAxesHelpers.delete(element);
      }
    }
  }

  private _belongsToRoot(element: UIElement, root: UIRoot): boolean {
    let n: Object3D | null = element;
    while (n) {
      if (n === root) return true;
      n = n.parent;
    }
    return false;
  }

  private _resolvePointerId(preferred?: string): string | null {
    if (preferred && this._hoveredMap.has(preferred)) return preferred;
    if (this._hoveredMap.has("mouse-0")) return "mouse-0";

    for (const [id, el] of this._hoveredMap) {
      if (el) return id;
    }
    for (const id of this._hoveredMap.keys()) {
      return id;
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Mouse input                                                     */
  /* ---------------------------------------------------------------- */

  private _initMouseInput(): void {
    const canvas = this._canvas;
    this._mousePointer = new MousePointer(canvas, this.camera);

    this._onMousePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      this._mousePointer!.onPointerMove(e);
    };
    this._onMousePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      this._mousePointer!.onPointerDown(e);
    };
    this._onMousePointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      this._mousePointer!.onPointerUp(e);
    };
    this._onMouseWheel = (e: WheelEvent) => {
      this._mousePointer!.onWheel(e);
    };

    canvas.addEventListener("pointermove", this._onMousePointerMove);
    canvas.addEventListener("pointerdown", this._onMousePointerDown);
    canvas.addEventListener("pointerup", this._onMousePointerUp);
    canvas.addEventListener("wheel", this._onMouseWheel);
  }

  /* ---------------------------------------------------------------- */
  /*  Touch input                                                     */
  /* ---------------------------------------------------------------- */

  private _initTouchInput(): void {
    const canvas = this._canvas;

    this._onTouchPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      let tp = this._touchPointers.get(e.pointerId);
      if (!tp) {
        tp = new TouchPointer(canvas, this.camera, e.pointerId);
        this._touchPointers.set(e.pointerId, tp);
      }
      tp.onPointerDown(e);
    };
    this._onTouchPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const tp = this._touchPointers.get(e.pointerId);
      if (tp) tp.onPointerMove(e);
    };
    this._onTouchPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const tp = this._touchPointers.get(e.pointerId);
      if (tp) {
        tp.onPointerUp(e);
        const existingTimer = this._touchCleanupTimers.get(e.pointerId);
        if (existingTimer !== undefined) {
          clearTimeout(existingTimer);
        }
        const timerId = window.setTimeout(() => {
          this._touchPointers.delete(e.pointerId);
          this._touchCleanupTimers.delete(e.pointerId);
        }, 100);
        this._touchCleanupTimers.set(e.pointerId, timerId);
      }
    };
    this._onTouchPointerCancel = this._onTouchPointerUp;

    canvas.addEventListener("pointerdown", this._onTouchPointerDown);
    canvas.addEventListener("pointermove", this._onTouchPointerMove);
    canvas.addEventListener("pointerup", this._onTouchPointerUp);
    canvas.addEventListener("pointercancel", this._onTouchPointerCancel);
  }

  /* ---------------------------------------------------------------- */
  /*  XR input                                                        */
  /* ---------------------------------------------------------------- */

  private _updateXRPointers(): void {
    const session = this.renderer.xr?.getSession?.();
    if (!session) {
      this._xrPointers.length = 0;
      return;
    }

    const inputSources = session.inputSources;
    while (this._xrPointers.length < inputSources.length) {
      this._xrPointers.push(
        new XRPointer(this.renderer, this._xrPointers.length)
      );
    }
    this._xrPointers.length = inputSources.length;

    for (let i = 0; i < inputSources.length; i++) {
      this._xrPointers[i].updateFromSource(inputSources[i], this.renderer);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Dispose                                                         */
  /* ---------------------------------------------------------------- */

  dispose(): void {
    for (const root of this._roots) {
      root.detach();
    }
    this._roots.length = 0;
    this._pointers.length = 0;
    this._touchPointers.clear();
    this._xrPointers.length = 0;
    this._hoveredMap.clear();

    for (const timerId of this._touchCleanupTimers.values()) {
      clearTimeout(timerId);
    }
    this._touchCleanupTimers.clear();

    this._clearRootAxesHelpers();
    this._clearElementAxesHelpers();

    const canvas = this._canvas;
    if (this._onMousePointerMove) {
      canvas.removeEventListener("pointermove", this._onMousePointerMove);
    }
    if (this._onMousePointerDown) {
      canvas.removeEventListener("pointerdown", this._onMousePointerDown);
    }
    if (this._onMousePointerUp) {
      canvas.removeEventListener("pointerup", this._onMousePointerUp);
    }
    if (this._onMouseWheel) {
      canvas.removeEventListener("wheel", this._onMouseWheel);
    }
    if (this._onTouchPointerDown) {
      canvas.removeEventListener("pointerdown", this._onTouchPointerDown);
    }
    if (this._onTouchPointerMove) {
      canvas.removeEventListener("pointermove", this._onTouchPointerMove);
    }
    if (this._onTouchPointerUp) {
      canvas.removeEventListener("pointerup", this._onTouchPointerUp);
    }
    if (this._onTouchPointerCancel) {
      canvas.removeEventListener("pointercancel", this._onTouchPointerCancel);
    }
  }
}
