/**
 * Camera HUD telemetry baseline.
 *
 * This module centralizes:
 * - canonical field ids
 * - legacy key mapping used by existing HUD readouts
 * - placeholder lifecycle defaults
 * - source and cadence metadata
 */

import type { TelemetryStatus } from "./types.js";

export type TelemetryHydrationState = TelemetryStatus;

export type CameraHudTelemetryFieldId =
  | "camera.motion.norm"
  | "camera.speed.mps"
  | "network.rtt.ms"
  | "network.downlink.mbps"
  | "network.effective_type"
  | "client.browser.label"
  | "network.geo.display";

export type CameraHudLegacyReadoutKey =
  | "speed"
  | "rtt"
  | "down"
  | "net"
  | "browser"
  | "geo";

export interface TelemetryPlaceholderSpec {
  loading: string;
  stale: string;
  error: string;
  unavailable: string;
}

export interface CameraHudTelemetryFieldSpec {
  fieldId: CameraHudTelemetryFieldId;
  label: string;
  source:
    | "camera-motion"
    | "network-information-api"
    | "rtt-probe"
    | "user-agent"
    | "ip-geo-http";
  cadenceSeconds: number | null;
  placeholder: TelemetryPlaceholderSpec;
  legacyReadoutKey?: CameraHudLegacyReadoutKey;
  notes?: string;
}

export interface CameraHudReadoutRowSpec {
  fieldId: CameraHudTelemetryFieldId;
  legacyKey: CameraHudLegacyReadoutKey;
  label: string;
  placeholder: string;
}

export const CAMERA_HUD_MOTION_REFERENCE = {
  linearMetersPerSecond: 2.4,
  angularRadiansPerSecond: 2.8,
} as const;

export const CAMERA_HUD_REFRESH_SECONDS = {
  rtt: 8,
  geo: 300,
} as const;

export const CAMERA_HUD_LEGACY_KEY_TO_FIELD_ID: Record<
  CameraHudLegacyReadoutKey,
  CameraHudTelemetryFieldId
> = {
  speed: "camera.speed.mps",
  rtt: "network.rtt.ms",
  down: "network.downlink.mbps",
  net: "network.effective_type",
  browser: "client.browser.label",
  geo: "network.geo.display",
};

export const CAMERA_HUD_READOUT_ROWS = [
  {
    fieldId: "camera.speed.mps",
    legacyKey: "speed",
    label: "SPEED",
    placeholder: "0.00 m/s",
  },
  {
    fieldId: "network.rtt.ms",
    legacyKey: "rtt",
    label: "RTT",
    placeholder: "-- ms",
  },
  {
    fieldId: "network.downlink.mbps",
    legacyKey: "down",
    label: "DOWN",
    placeholder: "-- Mbps",
  },
  {
    fieldId: "network.effective_type",
    legacyKey: "net",
    label: "NET",
    placeholder: "unknown",
  },
  {
    fieldId: "client.browser.label",
    legacyKey: "browser",
    label: "BROWSER",
    placeholder: "detecting...",
  },
  {
    fieldId: "network.geo.display",
    legacyKey: "geo",
    label: "GEO",
    placeholder: "locating...",
  },
] as const satisfies ReadonlyArray<CameraHudReadoutRowSpec>;

export const CAMERA_HUD_TELEMETRY_FIELDS = [
  {
    fieldId: "camera.motion.norm",
    label: "MOTION",
    source: "camera-motion",
    cadenceSeconds: 0,
    placeholder: {
      loading: "0.00",
      stale: "0.00",
      error: "0.00",
      unavailable: "0.00",
    },
    notes: "Normalized 0..1 camera motion scalar driving radial gauge.",
  },
  {
    fieldId: "camera.speed.mps",
    label: "SPEED",
    source: "camera-motion",
    cadenceSeconds: 0,
    placeholder: {
      loading: "0.00 m/s",
      stale: "0.00 m/s",
      error: "--",
      unavailable: "--",
    },
    legacyReadoutKey: "speed",
  },
  {
    fieldId: "network.rtt.ms",
    label: "RTT",
    source: "rtt-probe",
    cadenceSeconds: CAMERA_HUD_REFRESH_SECONDS.rtt,
    placeholder: {
      loading: "-- ms",
      stale: "-- ms",
      error: "-- ms",
      unavailable: "-- ms",
    },
    legacyReadoutKey: "rtt",
  },
  {
    fieldId: "network.downlink.mbps",
    label: "DOWN",
    source: "network-information-api",
    cadenceSeconds: null,
    placeholder: {
      loading: "-- Mbps",
      stale: "-- Mbps",
      error: "-- Mbps",
      unavailable: "-- Mbps",
    },
    legacyReadoutKey: "down",
  },
  {
    fieldId: "network.effective_type",
    label: "NET",
    source: "network-information-api",
    cadenceSeconds: null,
    placeholder: {
      loading: "unknown",
      stale: "unknown",
      error: "unknown",
      unavailable: "unknown",
    },
    legacyReadoutKey: "net",
  },
  {
    fieldId: "client.browser.label",
    label: "BROWSER",
    source: "user-agent",
    cadenceSeconds: null,
    placeholder: {
      loading: "detecting...",
      stale: "unknown",
      error: "unknown",
      unavailable: "unknown",
    },
    legacyReadoutKey: "browser",
  },
  {
    fieldId: "network.geo.display",
    label: "GEO",
    source: "ip-geo-http",
    cadenceSeconds: CAMERA_HUD_REFRESH_SECONDS.geo,
    placeholder: {
      loading: "locating...",
      stale: "unavailable",
      error: "unavailable",
      unavailable: "unavailable",
    },
    legacyReadoutKey: "geo",
  },
] as const satisfies ReadonlyArray<CameraHudTelemetryFieldSpec>;
