/**
 * UIAnchor — computes a UIRoot's world pose from a reference
 * object or camera using quaternion alignment rules.
 */

import {
  Object3D,
  Camera,
  Vector3,
  Quaternion,
  PerspectiveCamera,
} from "three";
import {
  smoothAlpha,
  billboardQuat,
  billboardYawQuat,
  cameraYawQuat,
  lockUpQuat,
} from "../utils/math.js";

/* ------------------------------------------------------------------ */
/*  FacingMode                                                         */
/* ------------------------------------------------------------------ */

export type FacingMode =
  | "REFERENCE"
  | "BILLBOARD"
  | "BILLBOARD_YAW"
  | "BILLBOARD_PITCH"
  | "LOCK_UP"
  | "CAMERA"
  | "CAMERA_YAW"
  | "CUSTOM";

export type CustomFacingFn = (
  targetPos: Vector3,
  targetQuat: Quaternion,
  cameraPos: Vector3,
  cameraQuat: Quaternion,
  worldUp: Vector3,
  out: Quaternion
) => void;

/* ------------------------------------------------------------------ */
/*  Options                                                            */
/* ------------------------------------------------------------------ */

export interface UIAnchorOptions {
  target: Object3D | Camera;
  mode: "camera" | "object";
  facing: FacingMode;
  offsetPos?: Vector3;
  offsetRot?: Quaternion;
  worldUp?: Vector3;
  smoothingHz?: number;
  customFacing?: CustomFacingFn;
}

/* ------------------------------------------------------------------ */
/*  Anchor class                                                       */
/* ------------------------------------------------------------------ */

const _targetPos = new Vector3();
const _targetQuat = new Quaternion();
const _cameraPos = new Vector3();
const _cameraQuat = new Quaternion();
const _desiredPos = new Vector3();
const _desiredQuat = new Quaternion();
const _tempQuat = new Quaternion();
const _forward = new Vector3();

export class UIAnchor {
  target: Object3D | Camera;
  mode: "camera" | "object";
  facing: FacingMode;
  offsetPos: Vector3;
  offsetRot: Quaternion;
  worldUp: Vector3;
  smoothingHz: number;
  customFacing?: CustomFacingFn;

  /** Current smoothed pose */
  private _pos = new Vector3();
  private _quat = new Quaternion();
  private _initialized = false;

  /** External camera reference (set by UIManager if mode is "object") */
  camera?: Camera;

  constructor(opts: UIAnchorOptions) {
    this.target = opts.target;
    this.mode = opts.mode;
    this.facing = opts.facing;
    this.offsetPos = opts.offsetPos?.clone() ?? new Vector3(0, 0, -0.7);
    this.offsetRot = opts.offsetRot?.clone() ?? new Quaternion();
    this.worldUp = opts.worldUp?.clone() ?? new Vector3(0, 1, 0);
    this.smoothingHz = opts.smoothingHz ?? 12;
    this.customFacing = opts.customFacing;
  }

  /**
   * Compute and apply the anchor pose to the given root Object3D.
   * Call once per frame from UIManager.update().
   */
  update(root: Object3D, dt: number, camera: Camera): void {
    this.camera = camera;

    // Gather target world pose
    this.target.getWorldPosition(_targetPos);
    this.target.getWorldQuaternion(_targetQuat);

    // Gather camera world pose
    camera.getWorldPosition(_cameraPos);
    camera.getWorldQuaternion(_cameraQuat);

    /* ---------- Compute desired position ---------- */
    if (this.mode === "camera") {
      // Position relative to camera
      _desiredPos.copy(this.offsetPos).applyQuaternion(_cameraQuat).add(_cameraPos);
    } else {
      // Position relative to target object
      _desiredPos.copy(this.offsetPos).applyQuaternion(_targetQuat).add(_targetPos);
    }

    /* ---------- Compute desired orientation ---------- */
    this._computeFacing(_desiredPos, _targetQuat, _cameraPos, _cameraQuat, _desiredQuat);
    // Apply offset rotation
    _desiredQuat.multiply(this.offsetRot);

    /* ---------- Smooth ---------- */
    if (!this._initialized) {
      this._pos.copy(_desiredPos);
      this._quat.copy(_desiredQuat);
      this._initialized = true;
    } else {
      const alpha = smoothAlpha(dt, this.smoothingHz);
      this._pos.lerp(_desiredPos, alpha);
      this._quat.slerp(_desiredQuat, alpha);
    }

    /* ---------- Apply to root ---------- */
    root.position.copy(this._pos);
    root.quaternion.copy(this._quat);
  }

  /* ---------------------------------------------------------------- */
  /*  Internal facing computation                                      */
  /* ---------------------------------------------------------------- */

  private _computeFacing(
    objPos: Vector3,
    refQuat: Quaternion,
    camPos: Vector3,
    camQuat: Quaternion,
    out: Quaternion
  ): void {
    switch (this.facing) {
      case "REFERENCE":
        out.copy(refQuat);
        break;

      case "BILLBOARD":
        billboardQuat(objPos, camPos, this.worldUp, out);
        break;

      case "BILLBOARD_YAW":
        billboardYawQuat(objPos, camPos, this.worldUp, out);
        break;

      case "BILLBOARD_PITCH": {
        // Pitch toward camera but keep yaw from reference
        billboardQuat(objPos, camPos, this.worldUp, _tempQuat);
        // Extract pitch only — simplified: slerp between reference and full billboard
        out.copy(refQuat).slerp(_tempQuat, 0.5);
        break;
      }

      case "LOCK_UP":
        lockUpQuat(refQuat, this.worldUp, out);
        break;

      case "CAMERA":
        out.copy(camQuat);
        break;

      case "CAMERA_YAW":
        cameraYawQuat(camQuat, this.worldUp, out);
        break;

      case "CUSTOM":
        if (this.customFacing) {
          this.customFacing(objPos, refQuat, camPos, camQuat, this.worldUp, out);
        } else {
          out.copy(refQuat);
        }
        break;

      default:
        out.copy(refQuat);
    }
  }
}
