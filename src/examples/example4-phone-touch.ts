/**
 * Example 4 — Phone touch overlay (camera-attached)
 *
 * Thin-line wireframe aesthetic. 44px-equivalent hit targets.
 * Touch input, inertia scroll, film grain toggle.
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Clock,
  Vector3,
  TorusKnotGeometry,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
} from "three";

import {
  UIManager,
  UIRoot,
  Panel,
  TextBlock,
  Button,
  SliderLinear,
  Toggle,
  Divider,
  MarkerPlus,
  ThemeFactory,
  GrainPass,
} from "../index.js";
import { type ExampleRuntime, removeAndDispose } from "./runtime.js";
import { AstralBackdrop } from "./astral-backdrop.js";

const MIN_TOUCH_TARGET = 44;

/* ------------------------------------------------------------------ */
/*  Scene setup                                                        */
/* ------------------------------------------------------------------ */

export function createPhoneTouchExample(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): ExampleRuntime & {
  uiManager: UIManager;
  root: UIRoot;
  grainPass: GrainPass;
  backdrop: AstralBackdrop;
} {
  const backdrop = new AstralBackdrop({ scene });

  // Wireframe torus knot
  const tkGeo = new TorusKnotGeometry(0.5, 0.15, 80, 12);
  const tkEdges = new EdgesGeometry(tkGeo);
  const torusKnot = new LineSegments(
    tkEdges,
    new LineBasicMaterial({ color: 0x4488aa, transparent: true })
  );
  torusKnot.position.set(0, 1.3, -3.5);
  scene.add(torusKnot);

  /* ---------------------------------------------------------------- */
  /*  Theme                                                            */
  /* ---------------------------------------------------------------- */

  const theme = ThemeFactory();

  /* ---------------------------------------------------------------- */
  /*  UI Root — camera-attached, bottom-center, responsive             */
  /* ---------------------------------------------------------------- */

  const root = new UIRoot({
    theme,
    layout: { type: "STACK_Y", gap: 6, padding: 10 },
    sizing: { width: 280, height: "auto" },
    pivot: "BOTTOM_CENTER",
    anchor: {
      target: camera,
      mode: "camera",
      facing: "CAMERA",
      offsetPos: new Vector3(0, -1.0, -1.8),
      smoothingHz: 20,
    },
    fovFit: {
      distance: 1.8,
      targetHeightFrac: 0.28,
      minScale: 0.4,
      maxScale: 1.8,
    },
    depthTest: false,
    renderOrder: 100,
  });

  /* ---------------------------------------------------------------- */
  /*  Frame                                                            */
  /* ---------------------------------------------------------------- */

  const frame = new Panel({
    width: 260,
    height: "auto",
    layout: { type: "STACK_Y", gap: 10, padding: 10 },
    style: {
      fillColor: "#050607", fillAlpha: 0.04,
      strokeColor: "#B88838", strokeAlpha: 0.35,
      strokeWidth: 1, cornerRadius: 4,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  frame.applyTheme(theme);
  root.add(frame);

  // Header
  const headerPanel = new Panel({
    width: 240,
    height: 28,
    layout: { type: "STACK_X", gap: 6, padding: 2, align: "center" },
    style: { fillAlpha: 0, strokeWidth: 0 },
  });
  headerPanel.applyTheme(theme);

  const plus = new MarkerPlus({ size: 7, colorKey: "accentA" });
  plus.applyTheme(theme);
  const headerText = new TextBlock({ text: "CONTROLS", variant: "title", colorKey: "accentA" });
  headerText.applyTheme(theme);
  headerPanel.add(plus, headerText);
  frame.add(headerPanel);

  const div1 = new Divider({ length: 240 });
  div1.applyTheme(theme);
  frame.add(div1);

  // Rotation slider
  let rotationSpeed = 2;
  const rotSlider = new SliderLinear({
    label: "ROTATION",
    value: 0.5,
    width: 240,
    height: Math.max(MIN_TOUCH_TARGET, 28),
    onChange: (v) => { rotationSpeed = v * 4; },
  });
  rotSlider.applyTheme(theme);
  frame.add(rotSlider);

  // Scale slider
  const scaleSlider = new SliderLinear({
    label: "SCALE",
    value: 0.5,
    width: 240,
    height: Math.max(MIN_TOUCH_TARGET, 28),
    onChange: (v) => { torusKnot.scale.setScalar(0.5 + v * 1.5); },
  });
  scaleSlider.applyTheme(theme);
  frame.add(scaleSlider);

  const div2 = new Divider({ length: 240 });
  div2.applyTheme(theme);
  frame.add(div2);

  // Grain toggle
  const grainToggle = new Toggle({
    label: "FILM GRAIN",
    value: false,
    width: 240,
    height: Math.max(MIN_TOUCH_TARGET, 22),
    onChange: (v) => { grainPass.enabled = v; },
  });
  grainToggle.applyTheme(theme);
  frame.add(grainToggle);

  const div3 = new Divider({ length: 240 });
  div3.applyTheme(theme);
  frame.add(div3);

  // Reset button
  const resetBtn = new Button({
    label: "RESET",
    width: 240,
    height: Math.max(MIN_TOUCH_TARGET, 32),
    variant: "primary",
    onClick: () => {
      torusKnot.rotation.set(0, 0, 0);
      torusKnot.scale.setScalar(1);
      rotSlider.value = 0.5;
      scaleSlider.value = 0.5;
      rotationSpeed = 2;
    },
  });
  resetBtn.applyTheme(theme);
  frame.add(resetBtn);

  /* ---------------------------------------------------------------- */
  /*  Film grain                                                       */
  /* ---------------------------------------------------------------- */

  const grainPass = new GrainPass({
    renderer,
    grainIntensity: 0.03,
    vignetteStrength: 0.2,
    vignetteFalloff: 0.7,
  });
  grainPass.enabled = false;

  /* ---------------------------------------------------------------- */
  /*  UIManager                                                        */
  /* ---------------------------------------------------------------- */

  const uiManager = new UIManager({
    renderer, camera, scene,
    touchSlop: 12,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  const clock = new Clock();
  let running = false;
  let rafId = 0;
  const sceneObjects = [torusKnot];

  function tick() {
    if (!running) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    torusKnot.rotation.y += dt * rotationSpeed;
    torusKnot.rotation.x += dt * rotationSpeed * 0.3;

    backdrop.update(dt, t);
    uiManager.update(dt);

    if (grainPass.enabled) {
      grainPass.render(scene, camera);
    } else {
      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(tick);
  }

  function onResize(width: number, height: number) {
    grainPass.resize(width, height);
  }

  function start(): void {
    if (running) return;
    running = true;
    clock.start();
    clock.getDelta();
    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function dispose(): void {
    stop();
    uiManager.dispose();
    backdrop.dispose();
    grainPass.dispose();
    removeAndDispose(sceneObjects);
  }

  return { start, stop, dispose, onResize, uiManager, root, grainPass, backdrop };
}
