/**
 * Example 3 — VR wrist menu (controller-attached)
 *
 * Thin-line wireframe aesthetic. Anchor to controller grip.
 * Facing: LOCK_UP + yaw toward head. Thumbstick scroll.
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Clock,
  Object3D,
  Vector3,
  Quaternion,
  BoxGeometry,
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
  Toggle,
  Menu,
  Divider,
  MarkerPlus,
  ThemeFactory,
  type FacingMode,
} from "../index.js";
import { type ExampleRuntime, removeAndDispose } from "./runtime.js";
import { AstralBackdrop } from "./astral-backdrop.js";

/* ------------------------------------------------------------------ */
/*  Scene setup                                                        */
/* ------------------------------------------------------------------ */

export function createVRWristMenuExample(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): ExampleRuntime & {
  uiManager: UIManager;
  root: UIRoot;
  leftController: Object3D;
  backdrop: AstralBackdrop;
} {
  const theme = ThemeFactory();
  const backdrop = new AstralBackdrop({ scene });

  // Wireframe controller proxy visible in scene
  const ctrlGeo = new BoxGeometry(0.04, 0.03, 0.12);
  const ctrlEdges = new EdgesGeometry(ctrlGeo);
  const ctrlMesh = new LineSegments(
    ctrlEdges,
    new LineBasicMaterial({ color: 0x667788 })
  );

  const leftController = new Object3D();
  leftController.name = "left-controller";
  leftController.position.set(-0.35, 1.0, -1.0);
  leftController.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI * 0.15);
  leftController.add(ctrlMesh);
  scene.add(leftController);

  // Background wireframe objects
  const bgBox = new LineSegments(
    new EdgesGeometry(new BoxGeometry(0.8, 0.8, 0.8)),
    new LineBasicMaterial({ color: 0x334455 })
  );
  bgBox.position.set(1.5, 1.0, -3);
  scene.add(bgBox);

  /* ---------------------------------------------------------------- */
  /*  Custom facing: LOCK_UP + yaw toward head                         */
  /* ---------------------------------------------------------------- */

  const customWristFacing = (
    _targetPos: Vector3,
    _targetQuat: Quaternion,
    cameraPos: Vector3,
    _cameraQuat: Quaternion,
    worldUp: Vector3,
    out: Quaternion
  ): void => {
    const forward = new Vector3(0, 0, -1).applyQuaternion(_targetQuat);
    const dot = forward.dot(worldUp);
    forward.addScaledVector(worldUp, -dot).normalize();

    const toCamera = new Vector3().subVectors(cameraPos, _targetPos);
    const dotCam = toCamera.dot(worldUp);
    toCamera.addScaledVector(worldUp, -dotCam).normalize();

    forward.lerp(toCamera, 0.3).normalize();
    const angle = Math.atan2(forward.x, forward.z);
    out.setFromAxisAngle(worldUp, angle + Math.PI);
  };

  /* ---------------------------------------------------------------- */
  /*  UI Root — wrist-attached                                         */
  /* ---------------------------------------------------------------- */

  const root = new UIRoot({
    theme,
    layout: { type: "STACK_Y", gap: 4, padding: 8 },
    sizing: { width: 200, height: "auto" },
    anchor: {
      target: leftController,
      mode: "object",
      facing: "CUSTOM" as FacingMode,
      customFacing: customWristFacing,
      offsetPos: new Vector3(0, 0.06, 0),
      smoothingHz: 10,
    },
    depthTest: true,
    uiUnitMeters: 0.001,
  });

  /* ---------------------------------------------------------------- */
  /*  Frame                                                            */
  /* ---------------------------------------------------------------- */

  const frame = new Panel({
    width: 184,
    height: "auto",
    layout: { type: "STACK_Y", gap: 4, padding: 6 },
    style: {
      fillColor: "#050607", fillAlpha: 0.05,
      strokeColor: "#B88838", strokeAlpha: 0.4,
      strokeWidth: 1, cornerRadius: 3,
    },
    glow: true,
    glowIntensity: 0.12,
  });
  frame.applyTheme(theme);
  root.add(frame);

  // Title
  const header = new Panel({
    width: 172,
    height: 22,
    layout: { type: "STACK_X", gap: 5, padding: 2, align: "center" },
    style: { fillAlpha: 0, strokeWidth: 0 },
  });
  header.applyTheme(theme);

  const mark = new MarkerPlus({ size: 7, colorKey: "accentA" });
  mark.applyTheme(theme);
  const titleText = new TextBlock({ text: "WRIST MENU", variant: "title", colorKey: "accentA" });
  titleText.applyTheme(theme);
  header.add(mark, titleText);
  frame.add(header);

  const div = new Divider({ length: 172 });
  div.applyTheme(theme);
  frame.add(div);

  // Menu
  const menu = new Menu({
    items: [
      { id: "inventory", label: "INVENTORY" },
      { id: "map", label: "MAP" },
      { id: "objectives", label: "OBJECTIVES" },
      { id: "comms", label: "COMMS" },
      { id: "settings", label: "SETTINGS" },
    ],
    width: 172,
    itemHeight: 26,
    onSelect: (itemId) => {
      statusText.setText(`> ${itemId.toUpperCase()}`);
    },
  });
  menu.applyTheme(theme);
  frame.add(menu);

  const div2 = new Divider({ length: 172 });
  div2.applyTheme(theme);
  frame.add(div2);

  // Toggles
  const hudToggle = new Toggle({
    label: "HUD",
    value: true,
    onChange: (v) => console.log(`[Wrist] HUD: ${v}`),
  });
  hudToggle.applyTheme(theme);
  frame.add(hudToggle);

  const audioToggle = new Toggle({
    label: "AUDIO",
    value: true,
    onChange: (v) => console.log(`[Wrist] Audio: ${v}`),
  });
  audioToggle.applyTheme(theme);
  frame.add(audioToggle);

  // Status
  const statusText = new TextBlock({ text: "> READY", variant: "small", colorKey: "text1" });
  statusText.applyTheme(theme);
  frame.add(statusText);

  /* ---------------------------------------------------------------- */
  /*  UIManager                                                        */
  /* ---------------------------------------------------------------- */

  const uiManager = new UIManager({
    renderer, camera, scene,
    touchSlop: 10,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  const clock = new Clock();
  let running = false;
  let rafId = 0;
  const sceneObjects = [leftController, bgBox];

  function tick() {
    if (!running) return;
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Idle hand sway
    leftController.position.y = 1.0 + Math.sin(t * 1.2) * 0.003;
    leftController.position.x = -0.35 + Math.sin(t * 0.8) * 0.002;

    bgBox.rotation.y += dt * 0.15;
    bgBox.rotation.x += dt * 0.08;

    backdrop.update(dt, t);
    uiManager.update(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
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
    removeAndDispose(sceneObjects);
  }

  return { start, stop, dispose, uiManager, root, leftController, backdrop };
}
