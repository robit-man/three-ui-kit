/**
 * Example 2 - Camera HUD "Radial Dial + Live Telemetry"
 *
 * Camera-attached HUD with:
 * - motion-driven radial gauge (camera movement/orbit)
 * - real browser/network/IP-geo telemetry readouts
 * - bloom pass enabled by default
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Clock,
  Vector3,
} from "three";

import {
  UIManager,
  UIRoot,
  ThemeFactory,
  GlowComposer,
  UIHydrate,
  type UIBindingRuntime,
  buildDefaultCameraHudProfileSchema,
  CAMERA_HUD_SCHEMA_IDS,
  TelemetryHub,
  createCameraMotionProvider,
  createNetworkConnectionProvider,
  createRttProbeProvider,
  createBrowserInfoProvider,
  createIpGeoProvider,
} from "../index.js";
import { type ExampleRuntime } from "./runtime.js";
import { AstralBackdrop } from "./astral-backdrop.js";

const CAMERA_HUD_ROOT_HEIGHT = 304;

function createTelemetryBindingRuntime(
  telemetryHub: TelemetryHub
): UIBindingRuntime {
  return {
    subscribe(listener) {
      const unsubscribe = telemetryHub.subscribe((snapshot, changed) => {
        const fields: Record<string, any> = {};
        const changedFieldIds: string[] = [];
        if (Array.isArray(changed) && changed.length > 0) {
          for (const field of changed) {
            if (!field || typeof field.fieldId !== "string") continue;
            fields[field.fieldId] = field;
            changedFieldIds.push(field.fieldId);
          }
        } else if (snapshot && snapshot.fields && typeof snapshot.fields === "object") {
          for (const [fieldId, field] of Object.entries(snapshot.fields)) {
            fields[fieldId] = field;
            changedFieldIds.push(fieldId);
          }
        }
        listener({ fields, changedFieldIds });
      }, true);
      return typeof unsubscribe === "function" ? unsubscribe : () => {};
    },
    getField(fieldId) {
      if (!fieldId) return undefined;
      return telemetryHub.getField(fieldId) ?? undefined;
    },
    formatters: {
      hudMotionFraction(value) {
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n)) return "0.00";
        return n.toFixed(2);
      },
    },
  };
}

export function createCameraHudExample(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): ExampleRuntime & {
  uiManager: UIManager;
  root: UIRoot;
  glowComposer: GlowComposer;
  toggleBloom: (enabled: boolean) => void;
  backdrop: AstralBackdrop;
} {
  const backdrop = new AstralBackdrop({ scene });

  const theme = ThemeFactory();

  const glowComposer = new GlowComposer({
    renderer,
    scene,
    camera,
    strength: 0.95,
    radius: 0.35,
    threshold: 0.12,
    resolutionScale: 0.75,
  });

  let bloomStrength = 0.95;
  let bloomRadius = 0.35;
  let bloomThreshold = 0.12;

  const telemetryHub = new TelemetryHub();
  const telemetryProviders = [
    createCameraMotionProvider({ camera }),
    createNetworkConnectionProvider(),
    createRttProbeProvider(),
    createBrowserInfoProvider(),
    createIpGeoProvider({
      debugExportToWindow:
        (window as Window & { __THREE_UI_KIT_TELEMETRY_DEBUG_EXPORT__?: boolean })
          .__THREE_UI_KIT_TELEMETRY_DEBUG_EXPORT__ === true,
    }),
  ];
  for (const provider of telemetryProviders) {
    telemetryHub.register(provider);
  }

  const root = UIHydrate.fromSchema(
    buildDefaultCameraHudProfileSchema(),
    {
      theme,
      bindingRuntime: createTelemetryBindingRuntime(telemetryHub),
      events: {
        [CAMERA_HUD_SCHEMA_IDS.bloomSlider]: {
          change: (v: number) => {
            bloomStrength = 0.2 + v * 1.8;
            bloomRadius = 0.15 + v * 0.6;
            bloomThreshold = Math.max(0.02, 0.45 - v * 0.35);
            glowComposer.setParams(bloomStrength, bloomRadius, bloomThreshold);
          },
        },
      },
      rootOptions: {
        pivot: "BOTTOM_CENTER",
        anchor: {
          target: camera,
          mode: "camera",
          facing: "CAMERA",
          offsetPos: new Vector3(0, -1.02, -2.75),
          smoothingHz: 0,
        },
        fovFit: {
          distance: 2.75,
          targetHeightFrac: 0.14,
          designHeightUI: CAMERA_HUD_ROOT_HEIGHT,
          minScale: 0.34,
          maxScale: 1.05,
        },
        depthTest: false,
        renderOrder: 100,
      },
    }
  );

  const uiManager = new UIManager({
    renderer,
    camera,
    scene,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  const clock = new Clock();
  let running = false;
  let rafId = 0;
  let useBloom = true;

  function frame() {
    if (!running) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    telemetryHub.update(dt, t);

    backdrop.update(dt, t, camera);
    uiManager.update(dt);

    if (useBloom) {
      glowComposer.render();
    } else {
      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(frame);
  }

  function toggleBloom(enabled: boolean) {
    useBloom = enabled;
    glowComposer.enabled = enabled;
    if (enabled) {
      glowComposer.setParams(bloomStrength, bloomRadius, bloomThreshold);
      void glowComposer.init();
    }
    uiManager.setGlowMode(enabled ? "bloom" : "shader");
  }

  function start(): void {
    if (running) return;
    running = true;
    clock.start();
    clock.getDelta();

    telemetryHub.start();
    toggleBloom(true);

    rafId = requestAnimationFrame(frame);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    telemetryHub.stop();
  }

  function onResize(width: number, height: number): void {
    glowComposer.resize(width, height);
  }

  function dispose(): void {
    stop();
    UIHydrate.disposeBindings(root);
    uiManager.dispose();
    backdrop.dispose();
    glowComposer.dispose();
  }

  return {
    start,
    stop,
    dispose,
    onResize,
    uiManager,
    root,
    glowComposer,
    toggleBloom,
    backdrop,
    telemetryHub,
    getTelemetrySnapshot: () => telemetryHub.getSnapshot(),
  };
}
