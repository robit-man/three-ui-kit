/**
 * Shared math helpers for the UI kit.
 */

import { Quaternion, Vector3, MathUtils } from "three";

const _v1 = new Vector3();
const _v2 = new Vector3();
const _q1 = new Quaternion();

/**
 * Exponential smoothing factor: returns the interpolation alpha
 * for a frame with delta `dt` and desired speed `hz`.
 *
 *   alpha = 1 - exp(-dt * hz)
 *
 * Use with slerp/lerp each frame for smooth follow.
 */
export function smoothAlpha(dt: number, hz: number): number {
  // `hz <= 0` means "disable smoothing" and snap directly to target.
  if (hz <= 0) return 1;
  return 1 - Math.exp(-dt * hz);
}

/**
 * Billboard quaternion — full face-camera.
 */
export function billboardQuat(
  objectPos: Vector3,
  cameraPos: Vector3,
  worldUp: Vector3,
  out: Quaternion
): Quaternion {
  _v1.subVectors(cameraPos, objectPos).normalize();
  // Build rotation from forward direction
  _v2.copy(worldUp);
  const right = _v1.clone().cross(_v2).normalize();
  const up = right.clone().cross(_v1).normalize();

  // Build matrix columns → quaternion
  const m00 = right.x, m01 = up.x, m02 = -_v1.x;
  const m10 = right.y, m11 = up.y, m12 = -_v1.y;
  const m20 = right.z, m21 = up.z, m22 = -_v1.z;

  // Quaternion from rotation matrix (simplified)
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    out.set(
      (m21 - m12) * s,
      (m02 - m20) * s,
      (m10 - m01) * s,
      0.25 / s
    );
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    out.set(
      0.25 * s,
      (m01 + m10) / s,
      (m02 + m20) / s,
      (m21 - m12) / s
    );
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    out.set(
      (m01 + m10) / s,
      0.25 * s,
      (m12 + m21) / s,
      (m02 - m20) / s
    );
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    out.set(
      (m02 + m20) / s,
      (m12 + m21) / s,
      0.25 * s,
      (m10 - m01) / s
    );
  }
  return out.normalize();
}

/**
 * Yaw-only billboard — face camera projected onto the worldUp plane.
 */
export function billboardYawQuat(
  objectPos: Vector3,
  cameraPos: Vector3,
  worldUp: Vector3,
  out: Quaternion
): Quaternion {
  // Direction from object to camera, projected onto the horizontal plane
  _v1.subVectors(cameraPos, objectPos);
  // Remove the component along worldUp
  const dot = _v1.dot(worldUp);
  _v1.addScaledVector(worldUp, -dot);
  _v1.normalize();

  // Yaw angle around worldUp
  const forward = new Vector3(0, 0, 1); // default forward
  const angle = Math.atan2(_v1.x, _v1.z);
  out.setFromAxisAngle(worldUp, angle);
  return out;
}

/**
 * Camera-yaw-only quaternion.
 */
export function cameraYawQuat(
  cameraQuat: Quaternion,
  worldUp: Vector3,
  out: Quaternion
): Quaternion {
  // Extract the camera's forward direction
  _v1.set(0, 0, -1).applyQuaternion(cameraQuat);
  // Project onto horizontal plane
  const dot = _v1.dot(worldUp);
  _v1.addScaledVector(worldUp, -dot).normalize();
  const angle = Math.atan2(_v1.x, _v1.z);
  out.setFromAxisAngle(worldUp, angle + Math.PI);
  return out;
}

/**
 * Lock-up quaternion — keep worldUp aligned, follow reference yaw.
 */
export function lockUpQuat(
  refQuat: Quaternion,
  worldUp: Vector3,
  out: Quaternion
): Quaternion {
  _v1.set(0, 0, -1).applyQuaternion(refQuat);
  const dot = _v1.dot(worldUp);
  _v1.addScaledVector(worldUp, -dot).normalize();
  const angle = Math.atan2(_v1.x, _v1.z);
  out.setFromAxisAngle(worldUp, angle + Math.PI);
  return out;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export { MathUtils };
