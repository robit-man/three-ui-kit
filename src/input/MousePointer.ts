/**
 * MousePointer — desktop mouse input.
 * Converts DOM pointer events → NDC → world-space ray.
 */

import { Camera, Vector2, Vector3, Raycaster } from "three";
import type { UIPointer, PointerKind } from "./UIPointer.js";

const _ndc = new Vector2();
const _raycaster = new Raycaster();

export class MousePointer implements UIPointer {
  id = "mouse-0";
  kind: PointerKind = "mouse";
  origin = new Vector3();
  direction = new Vector3();
  pressed = false;
  justPressed = false;
  justReleased = false;
  scrollDelta?: number = 0;

  private _canvas: HTMLCanvasElement;
  private _camera: Camera;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this._canvas = canvas;
    this._camera = camera;
  }

  /* ---------------------------------------------------------------- */
  /*  DOM event handlers                                               */
  /* ---------------------------------------------------------------- */

  onPointerMove(e: PointerEvent): void {
    this._updateNDC(e);
  }

  onPointerDown(e: PointerEvent): void {
    this._updateNDC(e);
    this.pressed = true;
    this.justPressed = true;
  }

  onPointerUp(e: PointerEvent): void {
    this._updateNDC(e);
    this.pressed = false;
    this.justReleased = true;
  }

  onWheel(e: WheelEvent): void {
    this.scrollDelta = e.deltaY;
  }

  /* ---------------------------------------------------------------- */
  /*  Internals                                                        */
  /* ---------------------------------------------------------------- */

  private _updateNDC(e: PointerEvent): void {
    const rect = this._canvas.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_ndc, this._camera);
    this.origin.copy(_raycaster.ray.origin);
    this.direction.copy(_raycaster.ray.direction);
  }

  resetFrame(): void {
    this.justPressed = false;
    this.justReleased = false;
    this.scrollDelta = 0;
  }
}
