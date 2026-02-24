import type { TelemetryProvider } from "../types.js";
import { makeCameraHudPlaceholder } from "./utils.js";

export interface NetworkConnectionLike {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
  removeEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
}

function getConnectionObject(): NetworkConnectionLike | null {
  const nav = navigator as Navigator & {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function createNetworkConnectionProvider(): TelemetryProvider {
  let connection: NetworkConnectionLike | null = null;
  let changeListener: EventListener | null = null;

  return {
    id: "network-connection",
    fieldIds: ["network.effective_type", "network.downlink.mbps"],
    placeholders() {
      return [
        makeCameraHudPlaceholder("network.effective_type", "loading"),
        makeCameraHudPlaceholder("network.downlink.mbps", "loading"),
      ];
    },
    start(emit) {
      connection = getConnectionObject();

      const publish = () => {
        const ts = Date.now();

        if (!connection) {
          emit([
            {
              ...makeCameraHudPlaceholder("network.effective_type", "unavailable"),
              updatedAt: ts,
            },
            {
              ...makeCameraHudPlaceholder("network.downlink.mbps", "unavailable"),
              updatedAt: ts,
            },
          ]);
          return;
        }

        const effectiveType = connection.effectiveType?.toUpperCase() ?? "UNKNOWN";
        const saveDataLabel = connection.saveData ? " SD" : "";
        const downlink = connection.downlink;
        const hasDownlink =
          typeof downlink === "number" && Number.isFinite(downlink);

        emit([
          {
            fieldId: "network.effective_type",
            value: `${effectiveType}${saveDataLabel}`,
            status: "live",
            source: "network-information-api",
            updatedAt: ts,
            meta: {
              effectiveType: connection.effectiveType ?? "unknown",
              saveData: connection.saveData === true,
            },
          },
          hasDownlink
            ? {
                fieldId: "network.downlink.mbps",
                value: `${downlink.toFixed(1)} Mbps`,
                status: "live",
                source: "network-information-api",
                updatedAt: ts,
                meta: { downlinkMbps: downlink },
              }
            : {
                ...makeCameraHudPlaceholder(
                  "network.downlink.mbps",
                  "unavailable"
                ),
                source: "network-information-api",
                updatedAt: ts,
              },
        ]);
      };

      publish();

      if (connection?.addEventListener) {
        changeListener = () => publish();
        connection.addEventListener("change", changeListener);
      }

      return () => {
        if (connection?.removeEventListener && changeListener) {
          connection.removeEventListener("change", changeListener);
        }
        changeListener = null;
        connection = null;
      };
    },
  };
}
