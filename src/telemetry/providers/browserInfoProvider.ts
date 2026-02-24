import type { TelemetryProvider } from "../types.js";
import { makeCameraHudPlaceholder } from "./utils.js";

function getBrowserLabel(): string {
  const nav = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string; version: string }>;
    };
  };

  const brand = nav.userAgentData?.brands
    ?.filter((b) => b.brand && b.brand.toLowerCase() !== "not.a/brand")
    ?.map((b) => `${b.brand} ${b.version}`)
    ?.join(" / ");
  if (brand) return brand;

  const ua = navigator.userAgent;
  if (/Edg\/(\d+)/.test(ua)) return `Edge ${RegExp.$1}`;
  if (/Chrome\/(\d+)/.test(ua)) return `Chrome ${RegExp.$1}`;
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${RegExp.$1}`;
  if (/Version\/(\d+).+Safari/.test(ua)) return `Safari ${RegExp.$1}`;
  return "unknown";
}

export function createBrowserInfoProvider(): TelemetryProvider {
  return {
    id: "browser-info",
    fieldIds: ["client.browser.label"],
    placeholders() {
      return [makeCameraHudPlaceholder("client.browser.label", "loading")];
    },
    start(emit) {
      emit({
        fieldId: "client.browser.label",
        value: getBrowserLabel(),
        status: "live",
        source: "user-agent",
        updatedAt: Date.now(),
      });
    },
  };
}

