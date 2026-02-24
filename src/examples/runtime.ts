import { Object3D } from "three";
import type { TelemetryHub } from "../telemetry/TelemetryHub.js";
import type { TelemetrySnapshot } from "../telemetry/types.js";

export interface ExampleRuntime {
  start(): void;
  stop(): void;
  dispose(): void;
  onResize?(width: number, height: number): void;
  telemetryHub?: TelemetryHub;
  getTelemetrySnapshot?(): TelemetrySnapshot;
}

export function disposeObjectTree(root: Object3D): void {
  root.traverse((node: any) => {
    if (node.geometry && typeof node.geometry.dispose === "function") {
      node.geometry.dispose();
    }

    const mat = node.material;
    if (!mat) return;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        if (m && typeof m.dispose === "function") m.dispose();
      }
      return;
    }
    if (typeof mat.dispose === "function") {
      mat.dispose();
    }
  });
}

export function removeAndDispose(objects: Object3D[]): void {
  for (const obj of objects) {
    obj.removeFromParent();
    disposeObjectTree(obj);
  }
}
