/**
 * TouchPointer — phone / tablet touch input.
 * Uses pointer events (pointerId distinguishes touches).
 * Builds a world-space ray identical to mouse, but with touch-specific handling.
 */

import { Camera, Vector2, Vector3, Raycaster } from "three";
import type { UIPointer, PointerKind } from "./UIPointer.js";

const _ndc = new Vector2();
const _raycaster = new Raycaster();

export class TouchPointer implements UIPointer {
  id: string;
  kind: PointerKind = "touch";
  origin = new Vector3();
  direction = new Vector3();
  pressed = false;
  justPressed = false;
  justReleased = false;
  scrollDelta?: number = 0;

  private _canvas: HTMLCanvasElement;
  private _camera: Camera;
  private _pointerId: number;

  /** Inertia tracking for scroll */
  private _lastY = 0;
  private _velocityY = 0;

  constructor(canvas: HTMLCanvasElement, camera: Camera, pointerId: number) {
    this._canvas = canvas;
    this._camera = camera;
    this._pointerId = pointerId;
    this.id = `touch-${pointerId}`;
  }

  onPointerDown(e: PointerEvent): void {
    this._updateNDC(e);
    this.pressed = true;
    this.justPressed = true;
    this._lastY = e.clientY;
    this._velocityY = 0;
  }

  onPointerMove(e: PointerEvent): void {
    this._updateNDC(e);
    // Compute scroll delta from vertical movement
    const dy = e.clientY - this._lastY;
    this.scrollDelta = dy;
    this._velocityY = dy;
    this._lastY = e.clientY;
  }

  onPointerUp(e: PointerEvent): void {
    this._updateNDC(e);
    this.pressed = false;
    this.justReleased = true;
  }

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
