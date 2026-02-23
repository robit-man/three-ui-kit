/**
 * Example 2 — Camera HUD "Radial Dial + Readouts" (responsive)
 *
 * Thin-line aesthetic. Glow on accent strokes.
 * Camera-anchored at comfortable distance, FOV-fit responsive.
 * Slider controls scene brightness. Animated gauge + readouts.
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
  Vector3,
} from "three";

import {
  UIManager,
  UIRoot,
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

/* ------------------------------------------------------------------ */
/*  Scene setup                                                        */
/* ------------------------------------------------------------------ */

export function createCameraHudExample(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): ExampleRuntime & {
  uiManager: UIManager;
  root: UIRoot;
  glowComposer: GlowComposer;
  toggleBloom: (enabled: boolean) => void;
} {
  const backdrop = new AstralBackdrop({ scene });

  // Wireframe icosahedron
  const icoGeo = new IcosahedronGeometry(0.6, 1);
  const icoEdges = new EdgesGeometry(icoGeo);
  const ico = new LineSegments(icoEdges, new LineBasicMaterial({ color: 0x4488aa }));
  ico.position.set(0, 1.2, -4);
  scene.add(ico);

  // Wireframe octahedron
  const octGeo = new OctahedronGeometry(0.4);
  const octEdges = new EdgesGeometry(octGeo);
  const oct = new LineSegments(octEdges, new LineBasicMaterial({ color: 0x886644 }));
  oct.position.set(-1.5, 0.8, -3.5);
  scene.add(oct);

  // Small wireframe cube
  const cubeEdges = new EdgesGeometry(new OctahedronGeometry(0.25));
  const cube = new LineSegments(cubeEdges, new LineBasicMaterial({ color: 0x557766 }));
  cube.position.set(1.8, 1.0, -5);
  scene.add(cube);

  let lineOpacity = 1.0;

  /* ---------------------------------------------------------------- */
  /*  Theme                                                            */
  /* ---------------------------------------------------------------- */

  const theme = ThemeFactory();

  /* ---------------------------------------------------------------- */
  /*  UI Root — camera-anchored HUD, bottom-center                     */
  /* ---------------------------------------------------------------- */

  const root = new UIRoot({
    theme,
    layout: { type: "STACK_X", gap: 16, padding: 12, align: "start" },
    sizing: { width: 480, height: "auto" },
    pivot: "BOTTOM_CENTER",
    anchor: {
      target: camera,
      mode: "camera",
      facing: "CAMERA",
      offsetPos: new Vector3(0, -0.9, -1.8),
      smoothingHz: 16,
    },
    fovFit: {
      distance: 1.8,
      targetHeightFrac: 0.22,
      minScale: 0.5,
      maxScale: 1.6,
    },
    depthTest: false,
    renderOrder: 100,
  });

  /* ---------------------------------------------------------------- */
  /*  Left panel: radial gauge                                         */
  /* ---------------------------------------------------------------- */

  const leftPanel = new Panel({
    width: 160,
    height: "auto",
    layout: { type: "STACK_Y", gap: 6, padding: 8, align: "center" },
    style: {
      fillColor: "#050607", fillAlpha: 0.04,
      strokeColor: "#B88838", strokeAlpha: 0.35,
      strokeWidth: 1, cornerRadius: 4,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  leftPanel.applyTheme(theme);

  const gaugeLabel = new TextBlock({ text: "POWER", variant: "label", colorKey: "text1", align: "center" });
  gaugeLabel.applyTheme(theme);

  const gauge = new RadialGauge({
    radius: 44,
    thickness: 3,
    value: 0.72,
    label: "OUTPUT",
    startAngle: -Math.PI * 0.75,
    sweepAngle: Math.PI * 1.5,
  });
  gauge.applyTheme(theme);

  leftPanel.add(gaugeLabel, gauge);
  root.add(leftPanel);

  /* ---------------------------------------------------------------- */
  /*  Right panel: readouts + slider                                   */
  /* ---------------------------------------------------------------- */

  const rightPanel = new Panel({
    width: 260,
    height: "auto",
    layout: { type: "STACK_Y", gap: 6, padding: 10 },
    style: {
      fillColor: "#050607", fillAlpha: 0.04,
      strokeColor: "#B88838", strokeAlpha: 0.35,
      strokeWidth: 1, cornerRadius: 4,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  rightPanel.applyTheme(theme);

  // Title row
  const titleRow = new Panel({
    width: 240,
    height: 22,
    layout: { type: "STACK_X", gap: 6, align: "center" },
    style: { fillAlpha: 0, strokeWidth: 0 },
  });
  titleRow.applyTheme(theme);

  const plusMark = new MarkerPlus({ size: 7, colorKey: "accentA" });
  plusMark.applyTheme(theme);
  const title = new TextBlock({ text: "SYSTEM STATUS", variant: "title", colorKey: "accentA" });
  title.applyTheme(theme);
  titleRow.add(plusMark, title);
  rightPanel.add(titleRow);

  const hDiv = new Divider({ length: 240 });
  hDiv.applyTheme(theme);
  rightPanel.add(hDiv);

  // Readouts
  const readouts = [
    { label: "TEMP", value: "42.7°C", key: "temp" },
    { label: "FREQ", value: "1.21 GHz", key: "freq" },
    { label: "LOAD", value: "68%", key: "load" },
  ];

  const readoutTexts: Map<string, TextBlock> = new Map();

  for (const ro of readouts) {
    const row = new Panel({
      width: 240,
      height: 20,
      layout: { type: "STACK_X", gap: 0, align: "center", justify: "start" },
      style: { fillAlpha: 0, strokeWidth: 0 },
    });
    row.applyTheme(theme);

    const lbl = new TextBlock({ text: ro.label, variant: "label", colorKey: "text1" });
    lbl.applyTheme(theme);
    const val = new TextBlock({ text: ro.value, variant: "readout", colorKey: "accentA" });
    val.applyTheme(theme);
    readoutTexts.set(ro.key, val);

    row.add(lbl, val);
    rightPanel.add(row);
  }

  const hDiv2 = new Divider({ length: 240 });
  hDiv2.applyTheme(theme);
  rightPanel.add(hDiv2);

  // Brightness slider
  const brightnessSlider = new SliderLinear({
    label: "BRIGHTNESS",
    value: 1.0,
    width: 240,
    onChange: (v) => {
      lineOpacity = v;
      (ico.material as LineBasicMaterial).opacity = v;
      (oct.material as LineBasicMaterial).opacity = v;
      (cube.material as LineBasicMaterial).opacity = v;
      const loadText = readoutTexts.get("load");
      loadText?.setText(`${Math.round(v * 100)}%`);
    },
  });
  brightnessSlider.applyTheme(theme);
  rightPanel.add(brightnessSlider);

  root.add(rightPanel);

  // Make line materials transparent-capable
  (ico.material as LineBasicMaterial).transparent = true;
  (oct.material as LineBasicMaterial).transparent = true;
  (cube.material as LineBasicMaterial).transparent = true;

  /* ---------------------------------------------------------------- */
  /*  UIManager                                                        */
  /* ---------------------------------------------------------------- */

  const uiManager = new UIManager({
    renderer,
    camera,
    scene,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  /* ---------------------------------------------------------------- */
  /*  Optional bloom composer                                          */
  /* ---------------------------------------------------------------- */

  const glowComposer = new GlowComposer({
    renderer, scene, camera,
    strength: 0.6, radius: 0.3, threshold: 0.15,
  });

  const clock = new Clock();
  let useBloom = false;
  let running = false;
  let rafId = 0;
  const sceneObjects = [ico, oct, cube];

  function frame() {
    if (!running) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    ico.rotation.y += dt * 0.3;
    ico.rotation.x += dt * 0.1;
    oct.rotation.y -= dt * 0.4;
    cube.rotation.y += dt * 0.5;
    cube.rotation.z += dt * 0.2;

    gauge.value = 0.5 + Math.sin(t * 0.5) * 0.3;
    const tempText = readoutTexts.get("temp");
    tempText?.setText(`${(40 + Math.sin(t) * 5).toFixed(1)}°C`);

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
    if (enabled && !glowComposer.enabled) glowComposer.init();
    uiManager.setGlowMode(enabled ? "bloom" : "shader");
  }

  function start(): void {
    if (running) return;
    running = true;
    clock.start();
    clock.getDelta();
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
    uiManager.dispose();
    backdrop.dispose();
    glowComposer.dispose();
    removeAndDispose(sceneObjects);
  }

  return { start, stop, dispose, onResize, uiManager, root, glowComposer, toggleBloom };
}
