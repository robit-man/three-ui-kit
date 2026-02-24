import { CAMERA_HUD_REFRESH_SECONDS } from "../camera-hud-baseline.js";
import type { TelemetryProvider } from "../types.js";
import type { NetworkConnectionLike } from "./networkConnectionProvider.js";
import { makeCameraHudPlaceholder } from "./utils.js";

function getConnectionObject(): NetworkConnectionLike | null {
  const nav = navigator as Navigator & {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export interface RttProbeProviderOptions {
  cadenceSeconds?: number;
  probeUrl?: string;
  useConnectionRtt?: boolean;
}

export function createRttProbeProvider(
  opts: RttProbeProviderOptions = {}
): TelemetryProvider {
  const cadenceSeconds = Math.max(
    1,
    opts.cadenceSeconds ?? CAMERA_HUD_REFRESH_SECONDS.rtt
  );
  const useConnectionRtt = opts.useConnectionRtt !== false;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let abort: AbortController | null = null;

  return {
    id: "rtt-probe",
    fieldIds: ["network.rtt.ms"],
    placeholders() {
      return [makeCameraHudPlaceholder("network.rtt.ms", "loading")];
    },
    start(emit) {
      const sample = async () => {
        if (inFlight) return;
        inFlight = true;

        try {
          const ts = Date.now();
          if (useConnectionRtt) {
            const connectionRtt = getConnectionObject()?.rtt;
            if (
              typeof connectionRtt === "number" &&
              Number.isFinite(connectionRtt) &&
              connectionRtt > 0
            ) {
              emit({
                fieldId: "network.rtt.ms",
                value: `${Math.round(connectionRtt)} ms`,
                status: "live",
                source: "network-information-api",
                updatedAt: ts,
                meta: { rttMs: connectionRtt },
              });
              return;
            }
          }

          abort?.abort();
          abort = new AbortController();

          const probeUrl = opts.probeUrl ?? window.location.href;
          const start = performance.now();
          await fetch(probeUrl, {
            method: "HEAD",
            cache: "no-store",
            signal: abort.signal,
          });
          const measuredRttMs = performance.now() - start;
          emit({
            fieldId: "network.rtt.ms",
            value: `${Math.round(measuredRttMs)} ms`,
            status: "live",
            source: "rtt-probe",
            updatedAt: Date.now(),
            meta: { rttMs: measuredRttMs, probeUrl },
          });
        } catch (err) {
          emit({
            ...makeCameraHudPlaceholder("network.rtt.ms", "unavailable"),
            source: "rtt-probe",
            status: "error",
            error: err instanceof Error ? err.message : "RTT probe failed",
            updatedAt: Date.now(),
          });
        } finally {
          inFlight = false;
        }
      };

      void sample();
      intervalId = setInterval(() => {
        void sample();
      }, cadenceSeconds * 1000);

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        abort?.abort();
        abort = null;
        inFlight = false;
      };
    },
  };
}

