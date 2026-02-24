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
  IcosahedronGeometry,
  OctahedronGeometry,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  UIManager,
  UIRoot,
  UIElement,
  Panel,
  TextBlock,
  SliderLinear,
  RadialGauge,
  Divider,
  MarkerPlus,
  ThemeFactory,
  GlowComposer,
} from "../index.js";
import { type ExampleRuntime, removeAndDispose } from "./runtime.js";
import { AstralBackdrop } from "./astral-backdrop.js";

const SPACER_EPSILON = 0.25;
const CAMERA_HUD_ROOT_WIDTH = 440;
const CAMERA_HUD_ROOT_HEIGHT = 304;
const CAMERA_HUD_LEFT_PANEL_HEIGHT = 188;
const CAMERA_HUD_RIGHT_PANEL_HEIGHT = 282;
const CAMERA_MOTION_LINEAR_REF = 2.4; // meters/second
const CAMERA_MOTION_ANGULAR_REF = 2.8; // radians/second
const GEO_REFRESH_SECONDS = 300;
const RTT_REFRESH_SECONDS = 8;

interface NetworkConnectionLike {
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

class ReadoutSpacer extends UIElement {
  private _row: UIElement;
  private _left: UIElement;
  private _right: UIElement;
  private _gap: number;

  constructor(opts: {
    row: UIElement;
    left: UIElement;
    right: UIElement;
    gap: number;
  }) {
    super({ sizing: { width: 0, height: 1 } });
    this._row = opts.row;
    this._left = opts.left;
    this._right = opts.right;
    this._gap = opts.gap;
  }

  onUpdate(): void {
    const pad = this._row.layout.padding ?? 0;
    const padX = this._row.layout.paddingX ?? pad;
    const innerW = Math.max(0, this._row.computedWidth - padX * 2);
    const desired = Math.max(
      0,
      innerW - this._left.computedWidth - this._right.computedWidth - this._gap * 2
    );
    const current = typeof this.sizing.width === "number" ? this.sizing.width : 0;
    if (Math.abs(current - desired) > SPACER_EPSILON) {
      this.sizing.width = desired;
      this.markDirty();
    }
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getConnectionObject(): NetworkConnectionLike | null {
  const nav = navigator as Navigator & {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

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
      // Try next source.
    }
  }

  return null;
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

  const icoGeo = new IcosahedronGeometry(0.6, 1);
  const icoEdges = new EdgesGeometry(icoGeo);
  const ico = new LineSegments(icoEdges, new LineBasicMaterial({ color: 0x4488aa }));
  ico.position.set(0, 1.2, -4);
  scene.add(ico);

  const octGeo = new OctahedronGeometry(0.4);
  const octEdges = new EdgesGeometry(octGeo);
  const oct = new LineSegments(octEdges, new LineBasicMaterial({ color: 0x886644 }));
  oct.position.set(-1.5, 0.8, -3.5);
  scene.add(oct);

  const cubeEdges = new EdgesGeometry(new OctahedronGeometry(0.25));
  const cube = new LineSegments(cubeEdges, new LineBasicMaterial({ color: 0x557766 }));
  cube.position.set(1.8, 1.0, -5);
  scene.add(cube);

  (ico.material as LineBasicMaterial).transparent = true;
  (oct.material as LineBasicMaterial).transparent = true;
  (cube.material as LineBasicMaterial).transparent = true;

  const theme = ThemeFactory();

  const root = new UIRoot({
    theme,
    layout: { type: "STACK_X", gap: 12, padding: 10, align: "start" },
    sizing: { width: CAMERA_HUD_ROOT_WIDTH, height: CAMERA_HUD_ROOT_HEIGHT },
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
  });

  const glowComposer = new GlowComposer({
    renderer,
    scene,
    camera,
    strength: 0.95,
    radius: 0.35,
    threshold: 0.12,
    resolutionScale: 0.75,
  });

  const leftPanel = new Panel({
    width: 160,
    height: CAMERA_HUD_LEFT_PANEL_HEIGHT,
    layout: { type: "STACK_Y", gap: 6, padding: 8, align: "center" },
    style: {
      fillColor: "#050607",
      fillAlpha: 0.04,
      strokeColor: "#B88838",
      strokeAlpha: 0.35,
      strokeWidth: 1,
      cornerRadius: 4,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  leftPanel.applyTheme(theme);

  const gaugeLabel = new TextBlock({
    text: "CAMERA",
    variant: "label",
    colorKey: "text1",
    align: "center",
  });
  gaugeLabel.applyTheme(theme);

  const gauge = new RadialGauge({
    radius: 44,
    thickness: 3,
    value: 0,
    label: "MOTION",
    startAngle: -Math.PI * 0.75,
    sweepAngle: Math.PI * 1.5,
  });
  gauge.applyTheme(theme);

  leftPanel.add(gaugeLabel, gauge);
  root.add(leftPanel);

  const rightPanel = new Panel({
    width: 260,
    height: CAMERA_HUD_RIGHT_PANEL_HEIGHT,
    layout: { type: "STACK_Y", gap: 4, padding: 10 },
    style: {
      fillColor: "#050607",
      fillAlpha: 0.04,
      strokeColor: "#B88838",
      strokeAlpha: 0.35,
      strokeWidth: 1,
      cornerRadius: 4,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  rightPanel.applyTheme(theme);

  const titleRow = new Panel({
    width: 240,
    height: 22,
    layout: { type: "STACK_X", gap: 6, align: "center" },
    style: { fillAlpha: 0, strokeWidth: 0 },
  });
  titleRow.applyTheme(theme);

  const plusMark = new MarkerPlus({ size: 7, colorKey: "accentA" });
  plusMark.applyTheme(theme);
  const title = new TextBlock({
    text: "LIVE TELEMETRY",
    variant: "title",
    colorKey: "accentA",
  });
  title.applyTheme(theme);
  titleRow.add(plusMark, title);
  rightPanel.add(titleRow);

  const hDiv = new Divider({ length: 240 });
  hDiv.applyTheme(theme);
  rightPanel.add(hDiv);

  const readouts = [
    { label: "SPEED", value: "0.00 m/s", key: "speed" },
    { label: "RTT", value: "-- ms", key: "rtt" },
    { label: "DOWN", value: "-- Mbps", key: "down" },
    { label: "NET", value: "unknown", key: "net" },
    { label: "BROWSER", value: "detecting...", key: "browser" },
    { label: "GEO", value: "locating...", key: "geo" },
  ];

  const readoutTexts: Map<string, TextBlock> = new Map();

  for (const ro of readouts) {
    const rowGap = 6;
    const row = new Panel({
      width: 240,
      height: 22,
      layout: { type: "STACK_X", gap: rowGap, align: "center", justify: "start" },
      style: { fillAlpha: 0, strokeWidth: 0 },
    });
    row.applyTheme(theme);

    const lbl = new TextBlock({
      text: ro.label,
      variant: "label",
      colorKey: "text1",
      maxWidth: 72,
    });
    lbl.applyTheme(theme);
    lbl.sizing.minWidth = 72;

    const val = new TextBlock({
      text: ro.value,
      variant: "readout",
      colorKey: "accentA",
      align: "right",
      maxWidth: 152,
    });
    val.applyTheme(theme);
    val.sizing.width = 152;
    val.sizing.height = 18;
    readoutTexts.set(ro.key, val);

    const spacer = new ReadoutSpacer({
      row,
      left: lbl,
      right: val,
      gap: rowGap,
    });
    row.add(lbl, spacer, val);
    rightPanel.add(row);
  }

  const hDiv2 = new Divider({ length: 240 });
  hDiv2.applyTheme(theme);
  rightPanel.add(hDiv2);

  let bloomStrength = 0.95;
  let bloomRadius = 0.35;
  let bloomThreshold = 0.12;

  const bloomSlider = new SliderLinear({
    label: "BLOOM",
    value: 0.45,
    width: 240,
    onChange: (v) => {
      bloomStrength = 0.2 + v * 1.8;
      bloomRadius = 0.15 + v * 0.6;
      bloomThreshold = Math.max(0.02, 0.45 - v * 0.35);
      glowComposer.setParams(bloomStrength, bloomRadius, bloomThreshold);
    },
  });
  bloomSlider.applyTheme(theme);
  rightPanel.add(bloomSlider);

  root.add(rightPanel);

  const uiManager = new UIManager({
    renderer,
    camera,
    scene,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  const connection = getConnectionObject();
  const connectionChangeListener: EventListener = () => {
    applyConnectionTelemetry();
  };

  if (connection?.addEventListener) {
    connection.addEventListener("change", connectionChangeListener);
  }

  const clock = new Clock();
  let running = false;
  let rafId = 0;
  let useBloom = true;

  let measuredRttMs: number | null = null;
  let pingInFlight = false;
  let pingAccumulator = RTT_REFRESH_SECONDS;

  let geoInFlight = false;
  let geoAccumulator = GEO_REFRESH_SECONDS;
  let geoAbort: AbortController | null = null;

  let hasPrevCameraPose = false;
  let smoothedMotion = 0;
  const prevCamPos = new Vector3();
  const prevCamQuat = new Quaternion();
  const currCamPos = new Vector3();
  const currCamQuat = new Quaternion();

  const sceneObjects = [ico, oct, cube];

  function setReadout(key: string, value: string): void {
    readoutTexts.get(key)?.setText(value);
  }

  function applyBrowserTelemetry(): void {
    const browserLabel = getBrowserLabel();
    setReadout("browser", browserLabel);
  }

  function applyConnectionTelemetry(): void {
    const effectiveType = connection?.effectiveType?.toUpperCase() ?? "UNKNOWN";
    const saveDataLabel = connection?.saveData ? " SD" : "";
    setReadout("net", `${effectiveType}${saveDataLabel}`);

    const downlink = connection?.downlink;
    if (typeof downlink === "number" && Number.isFinite(downlink)) {
      setReadout("down", `${downlink.toFixed(1)} Mbps`);
    } else {
      setReadout("down", "-- Mbps");
    }

    const rtt = connection?.rtt;
    if (typeof rtt === "number" && Number.isFinite(rtt) && rtt > 0) {
      setReadout("rtt", `${Math.round(rtt)} ms`);
    } else if (measuredRttMs !== null && Number.isFinite(measuredRttMs)) {
      setReadout("rtt", `${Math.round(measuredRttMs)} ms`);
    } else {
      setReadout("rtt", "-- ms");
    }
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

  function applyGeoTelemetry(geo: IpGeoSnapshot | null): void {
    if (!geo) {
      setReadout("geo", "unavailable");
      return;
    }

    if (geo.lat !== null && geo.lon !== null) {
      setReadout("geo", `${geo.lat.toFixed(3)}, ${geo.lon.toFixed(3)}`);
      return;
    }

    const fallback = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
    setReadout("geo", fallback || "unavailable");
  }

  async function sampleRtt(): Promise<void> {
    if (pingInFlight) return;
    pingInFlight = true;
    const start = performance.now();
    try {
      await fetch(window.location.href, {
        method: "HEAD",
        cache: "no-store",
      });
      measuredRttMs = performance.now() - start;
    } catch {
      measuredRttMs = null;
    } finally {
      pingInFlight = false;
      applyConnectionTelemetry();
    }
  }

  async function refreshGeo(): Promise<void> {
    if (geoInFlight) return;
    geoInFlight = true;
    geoAbort?.abort();
    geoAbort = new AbortController();
    try {
      const geo = await fetchIpGeoSnapshot(geoAbort.signal);
      applyGeoTelemetry(geo);
      writeGeoGlobals(geo);
    } finally {
      geoInFlight = false;
    }
  }

  function updateCameraMotion(dt: number): void {
    camera.getWorldPosition(currCamPos);
    camera.getWorldQuaternion(currCamQuat);

    if (!hasPrevCameraPose) {
      prevCamPos.copy(currCamPos);
      prevCamQuat.copy(currCamQuat);
      hasPrevCameraPose = true;
      return;
    }

    const safeDt = Math.max(1e-4, dt);
    const linearSpeed = currCamPos.distanceTo(prevCamPos) / safeDt;

    const dotAbs = Math.min(1, Math.max(-1, Math.abs(currCamQuat.dot(prevCamQuat))));
    const angularDistance = 2 * Math.acos(dotAbs);
    const angularSpeed = angularDistance / safeDt;

    const linearNorm = Math.min(1, linearSpeed / CAMERA_MOTION_LINEAR_REF);
    const angularNorm = Math.min(1, angularSpeed / CAMERA_MOTION_ANGULAR_REF);
    const motion = Math.min(1, linearNorm * 0.65 + angularNorm * 0.55);

    const alpha = Math.min(1, safeDt * 8);
    smoothedMotion += (motion - smoothedMotion) * alpha;

    gauge.value = smoothedMotion;
    setReadout("speed", `${linearSpeed.toFixed(2)} m/s`);

    prevCamPos.copy(currCamPos);
    prevCamQuat.copy(currCamQuat);
  }

  function frame() {
    if (!running) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    ico.rotation.y += dt * 0.3;
    ico.rotation.x += dt * 0.1;
    oct.rotation.y -= dt * 0.4;
    cube.rotation.y += dt * 0.5;
    cube.rotation.z += dt * 0.2;

    updateCameraMotion(dt);

    pingAccumulator += dt;
    if (pingAccumulator >= RTT_REFRESH_SECONDS) {
      pingAccumulator = 0;
      void sampleRtt();
    }

    geoAccumulator += dt;
    if (geoAccumulator >= GEO_REFRESH_SECONDS) {
      geoAccumulator = 0;
      void refreshGeo();
    }

    backdrop.update(dt, t);
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

    applyBrowserTelemetry();
    applyConnectionTelemetry();
    void sampleRtt();
    void refreshGeo();
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
  }

  function onResize(width: number, height: number): void {
    glowComposer.resize(width, height);
  }

  function dispose(): void {
    stop();
    geoAbort?.abort();
    if (connection?.removeEventListener) {
      connection.removeEventListener("change", connectionChangeListener);
    }
    uiManager.dispose();
    backdrop.dispose();
    glowComposer.dispose();
    removeAndDispose(sceneObjects);
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
  };
}
