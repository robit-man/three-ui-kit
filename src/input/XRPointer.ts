/**
 * XRPointer — VR / AR controller ray pointer.
 * Reads XRInputSource grip/ray data and maps selectstart/selectend to press/release.
 */

import { Vector3, Quaternion, WebGLRenderer, Matrix4 } from "three";
import type { UIPointer, PointerKind } from "./UIPointer.js";

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _quat = new Quaternion();
const _scale = new Vector3();
const _forward = new Vector3(0, 0, -1);

export class XRPointer implements UIPointer {
  id: string;
  kind: PointerKind = "xr-ray";
  origin = new Vector3();
  direction = new Vector3();
  pressed = false;
  justPressed = false;
  justReleased = false;
  scrollDelta?: number = 0;

  private _index: number;
  private _prevPressed = false;

  constructor(renderer: WebGLRenderer, index: number) {
    this._index = index;
    this.id = `xr-${index}`;

    // Hook XR select events
    const session = renderer.xr?.getSession?.();
    if (session) {
      session.addEventListener("selectstart", (e: any) => {
        if (this._matchesSource(e.inputSource, renderer)) {
          this.pressed = true;
          this.justPressed = true;
        }
      });
      session.addEventListener("selectend", (e: any) => {
        if (this._matchesSource(e.inputSource, renderer)) {
          this.pressed = false;
          this.justReleased = true;
        }
      });
    }
  }

  /**
   * Update ray origin/direction from an XRInputSource.
   */
  updateFromSource(source: XRInputSource, renderer: WebGLRenderer): void {
    const refSpace = renderer.xr.getReferenceSpace();
    if (!refSpace || !source.gripSpace) return;

    const frame = renderer.xr.getFrame?.();
    if (!frame) return;

    // Try target ray space first (more accurate for pointing)
    const space = source.targetRaySpace ?? source.gripSpace;
    const pose = frame.getPose(space, refSpace);
    if (!pose) return;

    const p = pose.transform.position;
    const q = pose.transform.orientation;

    this.origin.set(p.x, p.y, p.z);
    _quat.set(q.x, q.y, q.z, q.w);
    this.direction.copy(_forward).applyQuaternion(_quat).normalize();

    // Thumbstick scroll (axes[3] is typically vertical thumbstick)
    if (source.gamepad && source.gamepad.axes.length >= 4) {
      this.scrollDelta = source.gamepad.axes[3] * 10;
    }
  }

  private _matchesSource(source: XRInputSource, renderer: WebGLRenderer): boolean {
    const session = renderer.xr?.getSession?.();
    if (!session) return false;
    const sources = Array.from(session.inputSources);
    return sources.indexOf(source) === this._index;
  }

  resetFrame(): void {
    this.justPressed = false;
    this.justReleased = false;
    this.scrollDelta = 0;
  }
}
