import {
  CAMERA_HUD_TELEMETRY_FIELDS,
  type CameraHudTelemetryFieldId,
  type TelemetryHydrationState,
} from "../camera-hud-baseline.js";
import type { TelemetryFieldSnapshot } from "../types.js";

const _specByFieldId = new Map(
  CAMERA_HUD_TELEMETRY_FIELDS.map((spec) => [spec.fieldId, spec] as const)
);

export function getCameraHudFieldSpec(fieldId: CameraHudTelemetryFieldId) {
  return _specByFieldId.get(fieldId) ?? null;
}

export function makeCameraHudPlaceholder(
  fieldId: CameraHudTelemetryFieldId,
  status: TelemetryHydrationState = "loading"
): TelemetryFieldSnapshot {
  const spec = getCameraHudFieldSpec(fieldId);
  const fallback = "--";
  const placeholderStatus: Exclude<TelemetryHydrationState, "live"> =
    status === "live" ? "loading" : status;
  return {
    fieldId,
    value: spec?.placeholder[placeholderStatus] ?? fallback,
    status,
    source: spec?.source ?? "placeholder",
    updatedAt: Date.now(),
  };
}
