/**
 * UIPointer — normalized pointer abstraction.
 * Common interface for mouse, touch, and XR ray pointers.
 */

import { Vector3 } from "three";

export type PointerKind = "mouse" | "touch" | "xr-ray";

export interface UIPointer {
  id: string;
  kind: PointerKind;
  origin: Vector3;
  direction: Vector3;
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  scrollDelta?: number;

  /** Reset per-frame transient flags (justPressed, justReleased, scrollDelta). */
  resetFrame(): void;
}
