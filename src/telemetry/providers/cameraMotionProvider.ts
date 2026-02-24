import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { CAMERA_HUD_MOTION_REFERENCE } from "../camera-hud-baseline.js";
import type { TelemetryProvider } from "../types.js";
import { makeCameraHudPlaceholder } from "./utils.js";

export interface CameraMotionProviderOptions {
  camera: PerspectiveCamera;
  linearRefMps?: number;
  angularRefRadPerSec?: number;
  smoothingGain?: number;
}

export function createCameraMotionProvider(
  opts: CameraMotionProviderOptions
): TelemetryProvider {
  const linearRef =
    opts.linearRefMps ?? CAMERA_HUD_MOTION_REFERENCE.linearMetersPerSecond;
  const angularRef =
    opts.angularRefRadPerSec ?? CAMERA_HUD_MOTION_REFERENCE.angularRadiansPerSecond;
  const smoothingGain = opts.smoothingGain ?? 8;

  let hasPrevPose = false;
  let smoothedMotion = 0;
  const prevPos = new Vector3();
  const prevQuat = new Quaternion();
  const currPos = new Vector3();
  const currQuat = new Quaternion();

  return {
    id: "camera-motion",
    fieldIds: ["camera.motion.norm", "camera.speed.mps"],
    placeholders() {
      return [
        {
          ...makeCameraHudPlaceholder("camera.motion.norm", "loading"),
          value: 0,
        },
        makeCameraHudPlaceholder("camera.speed.mps", "loading"),
      ];
    },
    start() {
      hasPrevPose = false;
      smoothedMotion = 0;
    },
    update(dt, _elapsedSeconds, emit) {
      opts.camera.getWorldPosition(currPos);
      opts.camera.getWorldQuaternion(currQuat);

      if (!hasPrevPose) {
        prevPos.copy(currPos);
        prevQuat.copy(currQuat);
        hasPrevPose = true;
        return;
      }

      const safeDt = Math.max(1e-4, dt);
      const linearSpeed = currPos.distanceTo(prevPos) / safeDt;
      const dotAbs = Math.min(1, Math.max(-1, Math.abs(currQuat.dot(prevQuat))));
      const angularDistance = 2 * Math.acos(dotAbs);
      const angularSpeed = angularDistance / safeDt;

      const linearNorm = Math.min(1, linearSpeed / linearRef);
      const angularNorm = Math.min(1, angularSpeed / angularRef);
      const motion = Math.min(1, linearNorm * 0.65 + angularNorm * 0.55);

      const alpha = Math.min(1, safeDt * smoothingGain);
      smoothedMotion += (motion - smoothedMotion) * alpha;

      const ts = Date.now();
      emit([
        {
          fieldId: "camera.motion.norm",
          value: smoothedMotion,
          status: "live",
          source: "camera-motion",
          updatedAt: ts,
          meta: {
            linearSpeedMps: linearSpeed,
            angularSpeedRadPerSec: angularSpeed,
          },
        },
        {
          fieldId: "camera.speed.mps",
          value: `${linearSpeed.toFixed(2)} m/s`,
          status: "live",
          source: "camera-motion",
          updatedAt: ts,
          meta: { speedMps: linearSpeed },
        },
      ]);

      prevPos.copy(currPos);
      prevQuat.copy(currQuat);
    },
    stop() {
      hasPrevPose = false;
      smoothedMotion = 0;
    },
  };
}

