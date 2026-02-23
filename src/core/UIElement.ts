/**
 * UIElement — base class for all UI nodes.
 * Extends Object3D so it participates in the Three.js scene graph.
 * Provides layout props, style, event handling, and hit regions.
 */

import { Object3D, Vector3, Box3 } from "three";
import type { UITheme, VisualState } from "./UITheme.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LayoutType = "ABSOLUTE" | "STACK_X" | "STACK_Y" | "GRID";
export type Align = "start" | "center" | "end";

export interface LayoutProps {
  type: LayoutType;
  gap?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  align?: Align;
  justify?: Align;
  /** Grid-specific */
  cols?: number;
  rowGap?: number;
  colGap?: number;
}

export interface SizeProps {
  width?: number | "auto";
  height?: number | "auto";
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  aspect?: number;
}

export interface StyleProps {
  fillColor?: string;
  fillAlpha?: number;
  strokeColor?: string;
  strokeAlpha?: number;
  strokeWidth?: number;
  cornerRadius?: number;
  innerGlow?: number;
  noiseAmount?: number;
  visible?: boolean;
}

export interface HitRegion {
  id: string;
  /** Local-space bounds on the UI plane (x, y, width, height in UI units) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Extra hit slop (expanded for touch) */
  slop: number;
  element: UIElement;
}

export type UIEventType =
  | "pointerenter"
  | "pointerleave"
  | "pointerdown"
  | "pointerup"
  | "click"
  | "drag"
  | "scroll";

export interface UIEvent {
  type: UIEventType;
  target: UIElement;
  /** Stops event from bubbling to parent */
  stopped: boolean;
  localX: number;
  localY: number;
  pointerId: string;
  scrollDelta?: number;
  stopPropagation(): void;
}

export type UIEventHandler = (event: UIEvent) => void;

/* ------------------------------------------------------------------ */
/*  UIElement                                                          */
/* ------------------------------------------------------------------ */

export class UIElement extends Object3D {
  /** Layout configuration for this element's children */
  layout: LayoutProps = { type: "ABSOLUTE" };

  /** Sizing rules */
  sizing: SizeProps = {};

  /** Style overrides (applied on top of theme) */
  style: StyleProps = {};

  /** Computed layout position relative to parent (UI units) */
  layoutX = 0;
  layoutY = 0;

  /** Computed size after layout (UI units) */
  computedWidth = 0;
  computedHeight = 0;

  /** Content size from intrinsic measurement (text, etc.) */
  intrinsicWidth = 0;
  intrinsicHeight = 0;

  /** Hit regions registered on this element */
  hitRegions: HitRegion[] = [];

  /** Is this element interactive? */
  interactive = false;

  /** Current visual state */
  visualState: VisualState = "idle";

  /** Whether layout needs recomputation */
  layoutDirty = true;

  /** Reference to the active theme */
  theme?: UITheme;

  /** Event listeners */
  private _listeners: Map<UIEventType, UIEventHandler[]> = new Map();

  /** Tag / id for schema hydration & lookup */
  elementId?: string;

  constructor(opts?: {
    layout?: Partial<LayoutProps>;
    sizing?: Partial<SizeProps>;
    style?: Partial<StyleProps>;
    interactive?: boolean;
    id?: string;
  }) {
    super();
    if (opts?.layout) Object.assign(this.layout, opts.layout);
    if (opts?.sizing) Object.assign(this.sizing, opts.sizing);
    if (opts?.style) Object.assign(this.style, opts.style);
    if (opts?.interactive !== undefined) this.interactive = opts.interactive;
    if (opts?.id) this.elementId = opts.id;
  }

  /* ---------------------------------------------------------------- */
  /*  Fluent child API                                                 */
  /* ---------------------------------------------------------------- */

  /** Add child and return `this` for chaining. */
  add(...objects: Object3D[]): this {
    for (const obj of objects) {
      super.add(obj);
      if (obj instanceof UIElement) {
        obj.theme = this.theme;
      }
    }
    this.markDirty();
    return this;
  }

  /** Remove child and mark layout dirty if UI children changed. */
  remove(...objects: Object3D[]): this {
    let removedUIChild = false;
    for (const obj of objects) {
      if (obj instanceof UIElement && obj.parent === this) {
        removedUIChild = true;
      }
      super.remove(obj);
    }
    if (removedUIChild) {
      this.markDirty();
    }
    return this;
  }

  /** Get typed UI children. */
  get uiChildren(): UIElement[] {
    return this.children.filter((c): c is UIElement => c instanceof UIElement);
  }

  /* ---------------------------------------------------------------- */
  /*  Events                                                           */
  /* ---------------------------------------------------------------- */

  on(type: UIEventType, handler: UIEventHandler): this {
    let list = this._listeners.get(type);
    if (!list) {
      list = [];
      this._listeners.set(type, list);
    }
    list.push(handler);
    return this;
  }

  off(type: UIEventType, handler: UIEventHandler): this {
    const list = this._listeners.get(type);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
    return this;
  }

  emit(event: UIEvent): void {
    const list = this._listeners.get(event.type);
    if (list) {
      for (const fn of list) {
        fn(event);
        if (event.stopped) return;
      }
    }
    // Bubble up
    if (!event.stopped && this.parent instanceof UIElement) {
      this.parent.emit(event);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Hit regions                                                      */
  /* ---------------------------------------------------------------- */

  registerHitRegion(region?: Partial<HitRegion>): HitRegion {
    const hr: HitRegion = {
      id: region?.id ?? this.elementId ?? this.uuid,
      x: region?.x ?? 0,
      y: region?.y ?? 0,
      w: region?.w ?? this.computedWidth,
      h: region?.h ?? this.computedHeight,
      slop: region?.slop ?? 0,
      element: this,
    };
    this.hitRegions.push(hr);
    return hr;
  }

  clearHitRegions(): void {
    this.hitRegions.length = 0;
  }

  /** Update hit region to match computed size. */
  syncHitRegion(): void {
    if (this.hitRegions.length > 0) {
      const hr = this.hitRegions[0];
      hr.w = this.computedWidth;
      hr.h = this.computedHeight;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Measurement (override in subclasses like TextBlock)              */
  /* ---------------------------------------------------------------- */

  /** Return intrinsic content size. Override in subclasses. */
  measure(): { width: number; height: number } {
    return { width: this.intrinsicWidth, height: this.intrinsicHeight };
  }

  /* ---------------------------------------------------------------- */
  /*  Visual state                                                     */
  /* ---------------------------------------------------------------- */

  setState(state: VisualState): void {
    if (this.visualState === state) return;
    this.visualState = state;
    this.onStateChange(state);
  }

  /** Override in subclasses to update materials. */
  protected onStateChange(_state: VisualState): void {}

  /* ---------------------------------------------------------------- */
  /*  Per-frame update (override in subclasses)                        */
  /* ---------------------------------------------------------------- */

  /** Called by UIManager each frame. */
  onUpdate(_dt: number): void {}

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  /** Mark this element and all ancestors as layout-dirty. */
  markDirty(): void {
    this.layoutDirty = true;
    if (this.parent instanceof UIElement) {
      this.parent.markDirty();
    }
  }

  /** Find a descendant by elementId. */
  findById(id: string): UIElement | null {
    if (this.elementId === id) return this;
    for (const child of this.uiChildren) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }

  /** Create a UIEvent helper. */
  static createEvent(
    type: UIEventType,
    target: UIElement,
    localX = 0,
    localY = 0,
    pointerId = "mouse",
    scrollDelta?: number
  ): UIEvent {
    return {
      type,
      target,
      stopped: false,
      localX,
      localY,
      pointerId,
      scrollDelta,
      stopPropagation() { this.stopped = true; },
    };
  }
}
