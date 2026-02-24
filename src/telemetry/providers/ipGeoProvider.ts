import { CAMERA_HUD_REFRESH_SECONDS } from "../camera-hud-baseline.js";
import type { TelemetryProvider } from "../types.js";
import { makeCameraHudPlaceholder } from "./utils.js";

interface IpGeoSnapshot {
  source: string;
  ip: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lon: number | null;
  raw: unknown;
}

interface TelemetryWindow extends Window {
  __THREE_UI_KIT_NETWORK_JSON__?: unknown;
  __THREE_UI_KIT_NETWORK_GEO__?:
    | {
        ip: string;
        source: string;
        city: string;
        region: string;
        country: string;
        lat: number | null;
        lon: number | null;
        capturedAt: string;
      }
    | null;
}

export interface IpGeoProviderOptions {
  cadenceSeconds?: number;
  debugExportToWindow?: boolean;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseIpApiPayload(payload: unknown): IpGeoSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  return {
    source: "ipapi.co",
    ip: typeof data.ip === "string" ? data.ip : "",
    city: typeof data.city === "string" ? data.city : "",
    region: typeof data.region === "string" ? data.region : "",
    country:
      typeof data.country_name === "string"
        ? data.country_name
        : typeof data.country === "string"
          ? data.country
          : "",
    lat: toFiniteNumber(data.latitude),
    lon: toFiniteNumber(data.longitude),
    raw: payload,
  };
}

function parseIpWhoPayload(payload: unknown): IpGeoSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const success = data.success;
  if (typeof success === "boolean" && !success) return null;
  return {
    source: "ipwho.is",
    ip: typeof data.ip === "string" ? data.ip : "",
    city: typeof data.city === "string" ? data.city : "",
    region: typeof data.region === "string" ? data.region : "",
    country: typeof data.country === "string" ? data.country : "",
    lat: toFiniteNumber(data.latitude),
    lon: toFiniteNumber(data.longitude),
    raw: payload,
  };
}

async function fetchIpGeoSnapshot(signal?: AbortSignal): Promise<IpGeoSnapshot | null> {
  const sources = [
    { url: "https://ipapi.co/json/", parser: parseIpApiPayload },
    { url: "https://ipwho.is/", parser: parseIpWhoPayload },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        signal,
      });
      if (!res.ok) continue;
      const payload = (await res.json()) as unknown;
      const parsed = src.parser(payload);
      if (parsed) return parsed;
    } catch {
      // Continue to next source.
    }
  }
  return null;
}

function toGeoDisplayValue(geo: IpGeoSnapshot | null): string {
  if (!geo) return "unavailable";
  if (geo.lat !== null && geo.lon !== null) {
    return `${geo.lat.toFixed(3)}, ${geo.lon.toFixed(3)}`;
  }
  const fallback = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
  return fallback || "unavailable";
}

function writeGeoGlobals(geo: IpGeoSnapshot | null): void {
  const win = window as TelemetryWindow;
  win.__THREE_UI_KIT_NETWORK_JSON__ = geo?.raw ?? null;
  win.__THREE_UI_KIT_NETWORK_GEO__ = geo
    ? {
        ip: geo.ip,
        source: geo.source,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        lat: geo.lat,
        lon: geo.lon,
        capturedAt: new Date().toISOString(),
      }
    : null;
}

export function createIpGeoProvider(
  opts: IpGeoProviderOptions = {}
): TelemetryProvider {
  const cadenceSeconds = Math.max(
    30,
    opts.cadenceSeconds ?? CAMERA_HUD_REFRESH_SECONDS.geo
  );
  const debugExportToWindow = opts.debugExportToWindow === true;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let abort: AbortController | null = null;

  return {
    id: "ip-geo",
    fieldIds: ["network.geo.display"],
    placeholders() {
      return [makeCameraHudPlaceholder("network.geo.display", "loading")];
    },
    start(emit) {
      const refresh = async () => {
        if (inFlight) return;
        inFlight = true;
        abort?.abort();
        abort = new AbortController();
        try {
          const geo = await fetchIpGeoSnapshot(abort.signal);
          if (debugExportToWindow) {
            writeGeoGlobals(geo);
          }

          emit({
            fieldId: "network.geo.display",
            value: toGeoDisplayValue(geo),
            status: geo ? "live" : "unavailable",
            source: "ip-geo-http",
            updatedAt: Date.now(),
            meta: geo
              ? {
                  ip: geo.ip,
                  city: geo.city,
                  region: geo.region,
                  country: geo.country,
                  lat: geo.lat,
                  lon: geo.lon,
                  provider: geo.source,
                }
              : undefined,
          });
        } catch (err) {
          emit({
            ...makeCameraHudPlaceholder("network.geo.display", "unavailable"),
            source: "ip-geo-http",
            status: "error",
            error: err instanceof Error ? err.message : "IP geo lookup failed",
            updatedAt: Date.now(),
          });
        } finally {
          inFlight = false;
        }
      };

      void refresh();
      intervalId = setInterval(() => {
        void refresh();
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

