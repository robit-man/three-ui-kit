/**
 * UIHydrate — declarative schema hydration.
 * Builds a UIRoot tree from a JSON schema definition.
 *
 * Supports:
 *  - All primitives and components
 *  - Nested children
 *  - Theme application
 *  - Event binding by element id
 *  - "Slots" for dynamic data injection
 */

import { UIElement, type LayoutProps, type SizeProps, type StyleProps } from "./UIElement.js";
import { UIRoot, type UIRootOptions } from "./UIRoot.js";
import { UITheme, ThemeFactory } from "./UITheme.js";
import { Panel } from "../primitives/Panel.js";
import { TextBlock, type TextVariant } from "../primitives/TextBlock.js";
import { Stroke } from "../primitives/Stroke.js";
import { Divider } from "../primitives/Divider.js";
import { Icon } from "../primitives/Icon.js";
import { MarkerPlus } from "../primitives/MarkerPlus.js";
import { Button } from "../components/Button.js";
import { Toggle } from "../components/Toggle.js";
import { SliderLinear } from "../components/SliderLinear.js";
import { RadialGauge } from "../components/RadialGauge.js";
import { Menu, type MenuItem } from "../components/Menu.js";
import { Submenu } from "../components/Submenu.js";
import { Tooltip } from "../components/Tooltip.js";

/* ------------------------------------------------------------------ */
/*  Schema types                                                       */
/* ------------------------------------------------------------------ */

export interface UISchemaNode {
  /** Element type */
  type:
    | "root"
    | "element"
    | "panel"
    | "text"
    | "stroke"
    | "divider"
    | "icon"
    | "marker-plus"
    | "button"
    | "toggle"
    | "slider"
    | "radial-gauge"
    | "menu"
    | "submenu"
    | "tooltip";

  /** Element id (for lookup + event binding) */
  id?: string;

  /** Component-specific props */
  props?: Record<string, any>;

  /** Style overrides */
  style?: Partial<StyleProps>;

  /** Layout overrides */
  layout?: Partial<LayoutProps>;

  /** Size overrides */
  sizing?: Partial<SizeProps>;

  /** Nested children */
  children?: UISchemaNode[];
}

export interface HydrateOptions {
  theme?: UITheme;
  /** Event handlers keyed by element id → event type */
  events?: Record<string, Record<string, (...args: any[]) => void>>;
  /** Slot values keyed by slot name */
  slots?: Record<string, any>;
  /** Root options (anchor, fovFit, etc.) */
  rootOptions?: Partial<UIRootOptions>;
}

/* ------------------------------------------------------------------ */
/*  UIHydrate                                                          */
/* ------------------------------------------------------------------ */

export class UIHydrate {
  /**
   * Build a UIRoot from a JSON schema.
   */
  static fromSchema(
    schema: UISchemaNode,
    opts: HydrateOptions = {}
  ): UIRoot {
    const theme = opts.theme ?? ThemeFactory();

    if (schema.type !== "root") {
      throw new Error(`[UIHydrate] Top-level schema node must be type "root", got "${schema.type}"`);
    }

    const root = new UIRoot({
      theme,
      layout: schema.layout,
      sizing: schema.sizing,
      ...opts.rootOptions,
    });

    if (schema.children) {
      for (const childSchema of schema.children) {
        const child = UIHydrate._buildNode(childSchema, theme, opts);
        root.add(child);
      }
    }

    return root;
  }

  /**
   * Find an element by id in a tree and return it.
   */
  static findById(root: UIElement, id: string): UIElement | null {
    return root.findById(id);
  }

  /**
   * Inject slot values into a tree. Slots are TextBlock elements
   * whose text contains `{{slotName}}` patterns.
   */
  static applySlots(root: UIElement, slots: Record<string, any>): void {
    UIHydrate._walkSlots(root, slots);
  }

  /* ---------------------------------------------------------------- */
  /*  Internal builders                                                */
  /* ---------------------------------------------------------------- */

  private static _buildNode(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): UIElement {
    let element: UIElement;

    switch (schema.type) {
      case "panel":
        element = UIHydrate._buildPanel(schema, theme);
        break;
      case "text":
        element = UIHydrate._buildText(schema, theme, opts);
        break;
      case "stroke":
        element = UIHydrate._buildStroke(schema, theme);
        break;
      case "divider":
        element = UIHydrate._buildDivider(schema, theme);
        break;
      case "icon":
        element = UIHydrate._buildIcon(schema, theme);
        break;
      case "marker-plus":
        element = UIHydrate._buildMarkerPlus(schema, theme);
        break;
      case "button":
        element = UIHydrate._buildButton(schema, theme, opts);
        break;
      case "toggle":
        element = UIHydrate._buildToggle(schema, theme, opts);
        break;
      case "slider":
        element = UIHydrate._buildSlider(schema, theme, opts);
        break;
      case "radial-gauge":
        element = UIHydrate._buildRadialGauge(schema, theme);
        break;
      case "menu":
        element = UIHydrate._buildMenu(schema, theme, opts);
        break;
      case "submenu":
        element = UIHydrate._buildSubmenu(schema, theme, opts);
        break;
      case "tooltip":
        element = UIHydrate._buildTooltip(schema, theme);
        break;
      case "element":
      default:
        element = new UIElement({
          layout: schema.layout ? { type: "ABSOLUTE", ...schema.layout } : undefined,
          sizing: schema.sizing,
          style: schema.style,
          interactive: schema.props?.interactive,
          id: schema.id,
        });
        break;
    }

    // Apply id
    if (schema.id && !element.elementId) {
      element.elementId = schema.id;
    }

    // Bind events by id
    if (schema.id && opts.events?.[schema.id]) {
      const handlers = opts.events[schema.id];
      for (const [eventType, handler] of Object.entries(handlers)) {
        element.on(eventType as any, handler);
      }
    }

    // Recurse children
    if (schema.children) {
      for (const childSchema of schema.children) {
        const child = UIHydrate._buildNode(childSchema, theme, opts);
        element.add(child);
      }
    }

    return element;
  }

  /* ---------------------------------------------------------------- */
  /*  Primitive builders                                               */
  /* ---------------------------------------------------------------- */

  private static _buildPanel(schema: UISchemaNode, theme: UITheme): Panel {
    const p = schema.props ?? {};
    const panel = new Panel({
      width: schema.sizing?.width ?? p.width,
      height: schema.sizing?.height ?? p.height,
      layout: schema.layout,
      style: schema.style,
      interactive: p.interactive,
      id: schema.id,
      glow: p.glow,
      glowIntensity: p.glowIntensity,
    });
    panel.applyTheme(theme);
    return panel;
  }

  private static _buildText(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): TextBlock {
    const p = schema.props ?? {};
    let text: string = p.text ?? "";

    // Slot interpolation
    if (opts.slots) {
      text = UIHydrate._interpolateSlots(text, opts.slots);
    }

    const tb = new TextBlock({
      text,
      variant: p.variant as TextVariant,
      colorKey: p.colorKey,
      align: p.align,
      alignV: p.alignV,
      maxWidth: p.maxWidth,
      id: schema.id,
    });
    tb.applyTheme(theme);
    return tb;
  }

  private static _buildStroke(schema: UISchemaNode, theme: UITheme): Stroke {
    const p = schema.props ?? {};
    const s = new Stroke({
      direction: p.direction,
      length: p.length,
      thickness: p.thickness,
      colorKey: p.colorKey,
      id: schema.id,
    });
    s.applyTheme(theme);
    return s;
  }

  private static _buildDivider(schema: UISchemaNode, theme: UITheme): Divider {
    const p = schema.props ?? {};
    const d = new Divider({
      direction: p.direction,
      length: p.length,
      id: schema.id,
    });
    d.applyTheme(theme);
    return d;
  }

  private static _buildIcon(schema: UISchemaNode, theme: UITheme): Icon {
    const p = schema.props ?? {};
    const icon = new Icon({
      size: p.size,
      colorKey: p.colorKey,
      id: schema.id,
    });
    icon.applyTheme(theme);
    return icon;
  }

  private static _buildMarkerPlus(schema: UISchemaNode, theme: UITheme): MarkerPlus {
    const p = schema.props ?? {};
    const m = new MarkerPlus({
      size: p.size,
      thickness: p.thickness,
      colorKey: p.colorKey,
      id: schema.id,
    });
    m.applyTheme(theme);
    return m;
  }

  /* ---------------------------------------------------------------- */
  /*  Component builders                                               */
  /* ---------------------------------------------------------------- */

  private static _buildButton(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): Button {
    const p = schema.props ?? {};
    const btn = new Button({
      label: p.label,
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      id: schema.id,
      variant: p.variant,
      onClick: schema.id ? opts.events?.[schema.id]?.click : undefined,
    });
    btn.applyTheme(theme);
    return btn;
  }

  private static _buildToggle(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): Toggle {
    const p = schema.props ?? {};
    const toggle = new Toggle({
      label: p.label,
      value: p.value,
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      id: schema.id,
      onChange: schema.id ? opts.events?.[schema.id]?.change as any : undefined,
    });
    toggle.applyTheme(theme);
    return toggle;
  }

  private static _buildSlider(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): SliderLinear {
    const p = schema.props ?? {};
    const slider = new SliderLinear({
      label: p.label,
      value: p.value,
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      id: schema.id,
      showReadout: p.showReadout,
      onChange: schema.id ? opts.events?.[schema.id]?.change as any : undefined,
    });
    slider.applyTheme(theme);
    return slider;
  }

  private static _buildRadialGauge(
    schema: UISchemaNode,
    theme: UITheme
  ): RadialGauge {
    const p = schema.props ?? {};
    const gauge = new RadialGauge({
      radius: p.radius,
      thickness: p.thickness,
      value: p.value,
      label: p.label,
      id: schema.id,
      startAngle: p.startAngle,
      sweepAngle: p.sweepAngle,
    });
    gauge.applyTheme(theme);
    return gauge;
  }

  private static _buildMenu(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): Menu {
    const p = schema.props ?? {};
    const menu = new Menu({
      items: (p.items ?? []) as MenuItem[],
      width: schema.sizing?.width as number ?? p.width,
      itemHeight: p.itemHeight,
      id: schema.id,
      onSelect: schema.id ? opts.events?.[schema.id]?.select as any : undefined,
    });
    menu.applyTheme(theme);
    return menu;
  }

  private static _buildSubmenu(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions
  ): Submenu {
    const p = schema.props ?? {};
    const sub = new Submenu({
      items: (p.items ?? []) as MenuItem[],
      width: schema.sizing?.width as number ?? p.width,
      offsetX: p.offsetX,
      offsetY: p.offsetY,
      id: schema.id,
      onSelect: schema.id ? opts.events?.[schema.id]?.select as any : undefined,
    });
    sub.applyTheme(theme);
    return sub;
  }

  private static _buildTooltip(schema: UISchemaNode, theme: UITheme): Tooltip {
    const p = schema.props ?? {};
    const tip = new Tooltip({
      text: p.text ?? "",
      position: p.position,
      maxWidth: p.maxWidth,
      id: schema.id,
    });
    tip.applyTheme(theme);
    return tip;
  }

  /* ---------------------------------------------------------------- */
  /*  Slot interpolation                                               */
  /* ---------------------------------------------------------------- */

  private static _interpolateSlots(text: string, slots: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return slots[key] !== undefined ? String(slots[key]) : `{{${key}}}`;
    });
  }

  private static _walkSlots(element: UIElement, slots: Record<string, any>): void {
    if (element instanceof TextBlock) {
      const current = element.getText();
      const replaced = UIHydrate._interpolateSlots(current, slots);
      if (replaced !== current) {
        element.setText(replaced);
      }
    }
    for (const child of element.uiChildren) {
      UIHydrate._walkSlots(child, slots);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Schema validation                                                */
  /* ---------------------------------------------------------------- */

  static validate(schema: UISchemaNode): string[] {
    const errors: string[] = [];
    UIHydrate._validateNode(schema, errors, "root");
    return errors;
  }

  private static _validateNode(
    node: UISchemaNode,
    errors: string[],
    path: string
  ): void {
    const validTypes = [
      "root", "element", "panel", "text", "stroke", "divider",
      "icon", "marker-plus", "button", "toggle", "slider",
      "radial-gauge", "menu", "submenu", "tooltip",
    ];

    if (!validTypes.includes(node.type)) {
      errors.push(`${path}: unknown type "${node.type}"`);
    }

    if (node.type === "text" && !node.props?.text) {
      errors.push(`${path}: text node missing props.text`);
    }

    if (node.type === "menu" && (!node.props?.items || !Array.isArray(node.props.items))) {
      errors.push(`${path}: menu node missing props.items array`);
    }

    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        UIHydrate._validateNode(
          node.children[i],
          errors,
          `${path}.children[${i}]`
        );
      }
    }
  }
}
