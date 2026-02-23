/**
 * Example 1 — Object-anchored "Loadout Panel" (diegetic)
 *
 * Thin-line wireframe aesthetic. Glow on accent strokes.
 * Anchor to object, BILLBOARD_YAW facing, nested submenu.
 */

import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BoxGeometry,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  Clock,
  Vector3,
} from "three";

import {
  UIManager,
  UIRoot,
  Panel,
  TextBlock,
  Button,
  Menu,
  Submenu,
  Divider,
  MarkerPlus,
  ThemeFactory,
} from "../index.js";
import { type ExampleRuntime, removeAndDispose } from "./runtime.js";
import { AstralBackdrop } from "./astral-backdrop.js";

/* ------------------------------------------------------------------ */
/*  Thin-line panel style presets                                       */
/* ------------------------------------------------------------------ */

const PANEL_BG = {
  fillColor: "#050607",
  fillAlpha: 0.04,
  strokeColor: "rgba(235,240,245,0.16)",
  strokeAlpha: 0.4,
  strokeWidth: 1,
  cornerRadius: 3,
  noiseAmount: 0.015,
};

const PANEL_ACCENT = {
  fillColor: "#050607",
  fillAlpha: 0.06,
  strokeColor: "#B88838",
  strokeAlpha: 0.5,
  strokeWidth: 1,
  cornerRadius: 3,
  innerGlow: 0.12,
};

/* ------------------------------------------------------------------ */
/*  Scene setup                                                        */
/* ------------------------------------------------------------------ */

export function createLoadoutPanelExample(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera
): ExampleRuntime & {
  uiManager: UIManager;
  root: UIRoot;
  weaponObject: LineSegments;
} {
  const backdrop = new AstralBackdrop({ scene });

  // Weapon/tool — wireframe box only
  const boxGeo = new BoxGeometry(0.4, 0.15, 1.0);
  const edges = new EdgesGeometry(boxGeo);
  const weaponObject = new LineSegments(
    edges,
    new LineBasicMaterial({ color: 0x556677, linewidth: 1 })
  );
  weaponObject.position.set(0, 1.2, -3);
  scene.add(weaponObject);

  // Second wireframe prop to give depth
  const box2Geo = new BoxGeometry(0.6, 0.6, 0.6);
  const edges2 = new EdgesGeometry(box2Geo);
  const prop2 = new LineSegments(
    edges2,
    new LineBasicMaterial({ color: 0x334455, linewidth: 1 })
  );
  prop2.position.set(2, 0.8, -4);
  scene.add(prop2);

  /* ---------------------------------------------------------------- */
  /*  Theme                                                            */
  /* ---------------------------------------------------------------- */

  const theme = ThemeFactory();

  /* ---------------------------------------------------------------- */
  /*  UI Root — anchored to weapon, billboard-yaw                      */
  /* ---------------------------------------------------------------- */

  const root = new UIRoot({
    theme,
    layout: { type: "STACK_Y", gap: 4, padding: 10 },
    sizing: { width: 260, height: "auto" },
    anchor: {
      target: weaponObject,
      mode: "object",
      facing: "BILLBOARD_YAW",
      offsetPos: new Vector3(0.35, 0.3, 0),
      smoothingHz: 10,
    },
    depthTest: true,
  });

  /* ---------------------------------------------------------------- */
  /*  Outer frame panel                                                */
  /* ---------------------------------------------------------------- */

  const frame = new Panel({
    width: 240,
    height: "auto",
    layout: { type: "STACK_Y", gap: 4, padding: 8 },
    style: PANEL_BG,
    glow: true,
    glowIntensity: 0.15,
  });
  frame.applyTheme(theme);
  root.add(frame);

  // Title
  const titleRow = new Panel({
    width: 224,
    height: 24,
    layout: { type: "STACK_X", gap: 6, padding: 2, align: "center" },
    style: { fillAlpha: 0, strokeWidth: 0 },
  });
  titleRow.applyTheme(theme);

  const marker = new MarkerPlus({ size: 8, colorKey: "accentA" });
  marker.applyTheme(theme);
  const titleText = new TextBlock({ text: "LOADOUT", variant: "title", colorKey: "accentA" });
  titleText.applyTheme(theme);
  titleRow.add(marker, titleText);
  frame.add(titleRow);

  const div = new Divider({ length: 224 });
  div.applyTheme(theme);
  frame.add(div);

  // Menu
  const mainMenu = new Menu({
    items: [
      { id: "primary", label: "PRIMARY WEAPON" },
      { id: "secondary", label: "SECONDARY" },
      { id: "utility", label: "UTILITY", children: [
        { id: "grenade", label: "GRENADE" },
        { id: "flashbang", label: "FLASHBANG" },
        { id: "smoke", label: "SMOKE" },
      ]},
      { id: "armor", label: "ARMOR" },
      { id: "comms", label: "COMMS", disabled: true },
    ],
    width: 224,
    itemHeight: 28,
    onSelect: (itemId) => {
      if (itemId === "utility") {
        const utilityRow = mainMenu.getItemElement(itemId);
        utilitySubmenu.toggle(utilityRow ?? mainMenu);
      } else {
        utilitySubmenu.close();
      }
    },
  });
  mainMenu.applyTheme(theme);
  frame.add(mainMenu);

  // Submenu
  const utilitySubmenu = new Submenu({
    items: [
      { id: "grenade", label: "FRAG GRENADE" },
      { id: "flashbang", label: "FLASHBANG" },
      { id: "smoke", label: "SMOKE SCREEN" },
    ],
    width: 180,
    offsetX: 6,
    onSelect: () => utilitySubmenu.close(),
  });
  utilitySubmenu.applyTheme(theme);
  frame.add(utilitySubmenu);

  const div2 = new Divider({ length: 224 });
  div2.applyTheme(theme);
  frame.add(div2);

  // Unlock button
  const unlockBtn = new Button({
    label: "UNLOCK",
    width: 224,
    height: 30,
    variant: "primary",
    onClick: () => unlockBtn.setLabel("UNLOCKED"),
  });
  unlockBtn.applyTheme(theme);
  frame.add(unlockBtn);

  /* ---------------------------------------------------------------- */
  /*  UIManager                                                        */
  /* ---------------------------------------------------------------- */

  const uiManager = new UIManager({
    renderer,
    camera,
    scene,
    touchSlop: 12,
    glowMode: "shader",
  });
  uiManager.addRoot(root);

  const clock = new Clock();
  const sceneObjects = [weaponObject, prop2];
  let running = false;
  let rafId = 0;

  function tick() {
    if (!running) return;
    const dt = clock.getDelta();
    weaponObject.rotation.y += dt * 0.2;
    prop2.rotation.y -= dt * 0.15;
    prop2.rotation.x += dt * 0.08;
    backdrop.update(dt, clock.elapsedTime);
    uiManager.update(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function start(): void {
    if (running) return;
    running = true;
    clock.start();
    clock.getDelta(); // reset spike on resume
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

  return { start, stop, dispose, uiManager, root, weaponObject };
}
