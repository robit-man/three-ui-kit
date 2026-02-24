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
 *  - Runtime field bindings for text/value updates
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
import { TriChevron } from "../primitives/TriChevron.js";
import { SegmentedHexRing } from "../primitives/SegmentedHexRing.js";
import { ReticleCorners } from "../primitives/ReticleCorners.js";
import { RadialTickArc } from "../primitives/RadialTickArc.js";
import { NodeLinkGraph } from "../primitives/NodeLinkGraph.js";
import { DataTag } from "../primitives/DataTag.js";
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

export type UIBindingTarget = "text" | "value";

export interface UISchemaBinding {
  /** Field id in the bound runtime (e.g. telemetry field id). */
  field: string;
  /** Target property to update. Defaults by node type when omitted. */
  target?: UIBindingTarget;
  /** Optional named formatter from `HydrateOptions.bindingRuntime.formatters`. */
  formatter?: string;
  /** Fallback value when source value is missing/invalid. */
  fallback?: string | number | boolean | null;
  /**
   * Optional template for text targets.
   * `{{value}}` is replaced with bound output.
   */
  template?: string;
}

export interface UIBindingField {
  value: unknown;
  status?: string;
  source?: string;
  updatedAt?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface UIBindingUpdate {
  fields: Record<string, UIBindingField | undefined>;
  changedFieldIds?: string[];
}

export interface UIBindingFormatterContext {
  fieldId: string;
  field?: UIBindingField;
  binding: UISchemaBinding;
  element: UIElement;
}

export type UIBindingFormatter = (
  value: unknown,
  ctx: UIBindingFormatterContext
) => unknown;

export interface UIBindingRuntime {
  /** Subscribe to field updates. Return an unsubscribe callback. */
  subscribe(listener: (update: UIBindingUpdate) => void): () => void;
  /** Optional random access for initial hydration. */
  getField?(fieldId: string): UIBindingField | undefined;
  /** Optional named formatters used by schema bindings. */
  formatters?: Record<string, UIBindingFormatter>;
}

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
    | "tri-chevron"
    | "segmented-hex-ring"
    | "reticle-corners"
    | "radial-tick-arc"
    | "node-link-graph"
    | "data-tag"
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

  /** Optional live-data bindings for this node. */
  bindings?: UISchemaBinding[];

  /** Nested children */
  children?: UISchemaNode[];
}

export interface HydrateOptions {
  theme?: UITheme;
  /** Event handlers keyed by element id → event type */
  events?: Record<string, Record<string, (...args: any[]) => void>>;
  /** Slot values keyed by slot name */
  slots?: Record<string, any>;
  /** Runtime data-binding context for live field updates. */
  bindingRuntime?: UIBindingRuntime;
  /** Root options (anchor, fovFit, etc.) */
  rootOptions?: Partial<UIRootOptions>;
}

export type UIBindingDiagnosticSeverity = "warning" | "error";

export type UIBindingDiagnosticCode =
  | "unsupported-target"
  | "missing-formatter"
  | "formatter-throw"
  | "apply-throw";

export interface UIBindingDiagnosticEvent {
  at: number;
  severity: UIBindingDiagnosticSeverity;
  code: UIBindingDiagnosticCode;
  fieldId: string;
  elementId?: string;
  nodeType?: UISchemaNode["type"];
  detail: string;
}

export interface UIBindingDiagnosticsSnapshot {
  totalBindings: number;
  boundFieldCount: number;
  warningCount: number;
  errorCount: number;
  missingFormatterCount: number;
  unsupportedTargetCount: number;
  formatterErrorCount: number;
  applyErrorCount: number;
  lastEventAt: number | null;
  recentEvents: ReadonlyArray<UIBindingDiagnosticEvent>;
}

interface BuiltBindingRef {
  element: UIElement;
  nodeType: UISchemaNode["type"];
  binding: UISchemaBinding;
  templateText?: string;
}

interface BindingRuntimeHandle {
  unsubscribe: () => void;
  diagnostics: BindingDiagnosticsAccumulator;
}

interface BindingDiagnosticsAccumulator {
  totalBindings: number;
  boundFieldCount: number;
  warningCount: number;
  errorCount: number;
  missingFormatterCount: number;
  unsupportedTargetCount: number;
  formatterErrorCount: number;
  applyErrorCount: number;
  lastEventAt: number | null;
  recentEvents: UIBindingDiagnosticEvent[];
}

const SLOT_TEMPLATE_CACHE: WeakMap<TextBlock, string> = new WeakMap();
const ROOT_BINDING_HANDLE = Symbol("UIHydrate.rootBindingHandle");
const BINDING_DIAGNOSTIC_LIMIT = 24;

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
    const builtBindings: BuiltBindingRef[] = [];

    if (schema.children) {
      for (let i = 0; i < schema.children.length; i++) {
        const childSchema = schema.children[i];
        const child = UIHydrate._buildNode(
          childSchema,
          theme,
          opts,
          `root.children[${i}]`,
          builtBindings
        );
        root.add(child);
      }
    }

    if (opts.bindingRuntime && builtBindings.length > 0) {
      UIHydrate._attachBindings(root, builtBindings, opts.bindingRuntime);
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

  static disposeBindings(root: UIRoot): void {
    const r = root as UIRoot & {
      [ROOT_BINDING_HANDLE]?: BindingRuntimeHandle;
    };
    const handle = r[ROOT_BINDING_HANDLE];
    if (!handle) return;
    try {
      handle.unsubscribe();
    } finally {
      delete r[ROOT_BINDING_HANDLE];
    }
  }

  static getBindingDiagnostics(root: UIRoot): UIBindingDiagnosticsSnapshot | null {
    const r = root as UIRoot & {
      [ROOT_BINDING_HANDLE]?: BindingRuntimeHandle;
    };
    const handle = r[ROOT_BINDING_HANDLE];
    if (!handle) return null;
    return UIHydrate._snapshotBindingDiagnostics(handle.diagnostics);
  }

  /* ---------------------------------------------------------------- */
  /*  Internal builders                                                */
  /* ---------------------------------------------------------------- */

  private static _buildNode(
    schema: UISchemaNode,
    theme: UITheme,
    opts: HydrateOptions,
    path: string,
    builtBindings: BuiltBindingRef[]
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
      case "tri-chevron":
        element = UIHydrate._buildTriChevron(schema, theme);
        break;
      case "segmented-hex-ring":
        element = UIHydrate._buildSegmentedHexRing(schema, theme);
        break;
      case "reticle-corners":
        element = UIHydrate._buildReticleCorners(schema, theme);
        break;
      case "radial-tick-arc":
        element = UIHydrate._buildRadialTickArc(schema, theme);
        break;
      case "node-link-graph":
        element = UIHydrate._buildNodeLinkGraph(schema, theme);
        break;
      case "data-tag":
        element = UIHydrate._buildDataTag(schema, theme);
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

    const nodeBindings = UIHydrate._normalizeBindings(schema.bindings);
    if (nodeBindings.length > 0) {
      for (const binding of nodeBindings) {
        builtBindings.push({
          element,
          nodeType: schema.type,
          binding,
          templateText:
            element instanceof TextBlock
              ? element.getText()
              : typeof schema.props?.text === "string"
                ? schema.props.text
                : undefined,
        });
      }
    }

    // Recurse children
    if (schema.children) {
      for (let i = 0; i < schema.children.length; i++) {
        const childSchema = schema.children[i];
        const child = UIHydrate._buildNode(
          childSchema,
          theme,
          opts,
          `${path}.children[${i}]`,
          builtBindings
        );
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

  private static _buildTriChevron(schema: UISchemaNode, theme: UITheme): TriChevron {
    const p = schema.props ?? {};
    const tri = new TriChevron({
      size: p.size,
      thickness: p.thickness,
      inset: p.inset,
      colorKey: p.colorKey,
      id: schema.id,
    });
    tri.applyTheme(theme);
    return tri;
  }

  private static _buildSegmentedHexRing(
    schema: UISchemaNode,
    theme: UITheme
  ): SegmentedHexRing {
    const p = schema.props ?? {};
    const ring = new SegmentedHexRing({
      size: p.size,
      segments: p.segments,
      segmentLength: p.segmentLength,
      thickness: p.thickness,
      radius: p.radius,
      colorKey: p.colorKey,
      id: schema.id,
    });
    ring.applyTheme(theme);
    return ring;
  }

  private static _buildReticleCorners(
    schema: UISchemaNode,
    theme: UITheme
  ): ReticleCorners {
    const p = schema.props ?? {};
    const reticle = new ReticleCorners({
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      armLength: p.armLength,
      thickness: p.thickness,
      colorKey: p.colorKey,
      id: schema.id,
    });
    reticle.applyTheme(theme);
    return reticle;
  }

  private static _buildRadialTickArc(
    schema: UISchemaNode,
    theme: UITheme
  ): RadialTickArc {
    const p = schema.props ?? {};
    const sizeFromSchema =
      typeof schema.sizing?.width === "number"
        ? schema.sizing.width
        : typeof schema.sizing?.height === "number"
          ? schema.sizing.height
          : undefined;
    const arc = new RadialTickArc({
      size: sizeFromSchema ?? p.size,
      radius: p.radius,
      tickCount: p.tickCount,
      tickLength: p.tickLength,
      thickness: p.thickness,
      startAngle: p.startAngle,
      sweepAngle: p.sweepAngle,
      majorEvery: p.majorEvery,
      majorScale: p.majorScale,
      colorKey: p.colorKey,
      id: schema.id,
    });
    arc.applyTheme(theme);
    return arc;
  }

  private static _buildNodeLinkGraph(
    schema: UISchemaNode,
    theme: UITheme
  ): NodeLinkGraph {
    const p = schema.props ?? {};
    const graph = new NodeLinkGraph({
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      nodeCount: p.nodeCount,
      nodeSize: p.nodeSize,
      linkProbability: p.linkProbability,
      linkThickness: p.linkThickness,
      seed: p.seed,
      nodeColorKey: p.nodeColorKey,
      linkColorKey: p.linkColorKey,
      id: schema.id,
    });
    graph.applyTheme(theme);
    return graph;
  }

  private static _buildDataTag(schema: UISchemaNode, theme: UITheme): DataTag {
    const p = schema.props ?? {};
    const tag = new DataTag({
      text: p.text,
      variant: p.variant,
      width: schema.sizing?.width as number ?? p.width,
      height: schema.sizing?.height as number ?? p.height,
      colorKey: p.colorKey,
      textColorKey: p.textColorKey,
      id: schema.id,
    });
    tag.applyTheme(theme);
    return tag;
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
    const sizeFromSchema =
      typeof schema.sizing?.width === "number" && typeof schema.sizing?.height === "number"
        ? Math.min(schema.sizing.width, schema.sizing.height)
        : typeof schema.sizing?.width === "number"
          ? schema.sizing.width
          : typeof schema.sizing?.height === "number"
            ? schema.sizing.height
            : undefined;
    const gauge = new RadialGauge({
      size: sizeFromSchema ?? p.size,
      radius: p.radius,
      thickness: p.thickness,
      value: p.value,
      label: p.label,
      labelPosition: p.labelPosition,
      labelOffset: p.labelOffset,
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
  /*  Binding runtime                                                  */
  /* ---------------------------------------------------------------- */

  private static _normalizeBindings(
    bindings: UISchemaNode["bindings"]
  ): UISchemaBinding[] {
    if (!Array.isArray(bindings)) return [];
    const out: UISchemaBinding[] = [];
    for (const binding of bindings) {
      if (!binding || typeof binding !== "object") continue;
      if (typeof binding.field !== "string" || binding.field.trim().length === 0) {
        continue;
      }
      const normalized: UISchemaBinding = {
        field: binding.field.trim(),
      };
      if (binding.target === "text" || binding.target === "value") {
        normalized.target = binding.target;
      }
      if (
        typeof binding.formatter === "string" &&
        binding.formatter.trim().length > 0
      ) {
        normalized.formatter = binding.formatter.trim();
      }
      if (binding.fallback !== undefined) {
        normalized.fallback = binding.fallback;
      }
      if (typeof binding.template === "string") {
        normalized.template = binding.template;
      }
      out.push(normalized);
    }
    return out;
  }

  private static _attachBindings(
    root: UIRoot,
    builtBindings: BuiltBindingRef[],
    runtime: UIBindingRuntime
  ): void {
    UIHydrate.disposeBindings(root);

    const fieldMap = new Map<string, BuiltBindingRef[]>();
    for (const ref of builtBindings) {
      if (!fieldMap.has(ref.binding.field)) {
        fieldMap.set(ref.binding.field, []);
      }
      fieldMap.get(ref.binding.field)!.push(ref);
    }
    const diagnostics: BindingDiagnosticsAccumulator = {
      totalBindings: builtBindings.length,
      boundFieldCount: fieldMap.size,
      warningCount: 0,
      errorCount: 0,
      missingFormatterCount: 0,
      unsupportedTargetCount: 0,
      formatterErrorCount: 0,
      applyErrorCount: 0,
      lastEventAt: null,
      recentEvents: [],
    };

    const warnedMissingFormatter = new Set<string>();
    const warnedUnsupportedTarget = new Set<string>();

    const recordWarning = (
      code: Extract<UIBindingDiagnosticCode, "unsupported-target" | "missing-formatter">,
      ref: BuiltBindingRef,
      detail: string
    ) => {
      const key = `${code}|${ref.binding.field}|${ref.element.elementId ?? ""}`;
      const dedupe =
        code === "missing-formatter" ? warnedMissingFormatter : warnedUnsupportedTarget;
      if (dedupe.has(key)) return;
      dedupe.add(key);
      UIHydrate._recordBindingDiagnostic(diagnostics, {
        at: Date.now(),
        severity: "warning",
        code,
        fieldId: ref.binding.field,
        elementId: ref.element.elementId ?? undefined,
        nodeType: ref.nodeType,
        detail,
      });
    };

    const applyRef = (ref: BuiltBindingRef, field?: UIBindingField) => {
      const target = UIHydrate._resolveBindingTarget(ref.nodeType, ref.binding);
      if (!target) {
        recordWarning(
          "unsupported-target",
          ref,
          `Node type "${ref.nodeType}" does not support binding target "${ref.binding.target ?? "(default)"}".`
        );
        return;
      }

      let nextValue: unknown = field?.value;
      if (ref.binding.formatter) {
        const formatter = runtime.formatters?.[ref.binding.formatter];
        if (!formatter) {
          recordWarning(
            "missing-formatter",
            ref,
            `Formatter "${ref.binding.formatter}" was not found in binding runtime.`
          );
        } else {
          try {
            nextValue = formatter(nextValue, {
              fieldId: ref.binding.field,
              field,
              binding: ref.binding,
              element: ref.element,
            });
          } catch (err) {
            UIHydrate._recordBindingDiagnostic(diagnostics, {
              at: Date.now(),
              severity: "error",
              code: "formatter-throw",
              fieldId: ref.binding.field,
              elementId: ref.element.elementId ?? undefined,
              nodeType: ref.nodeType,
              detail:
                err instanceof Error
                  ? err.message
                  : `Formatter threw: ${String(err)}`,
            });
            return;
          }
        }
      }

      if (
        (nextValue === null ||
          nextValue === undefined ||
          (typeof nextValue === "number" && !Number.isFinite(nextValue))) &&
        ref.binding.fallback !== undefined
      ) {
        nextValue = ref.binding.fallback;
      }

      try {
        if (target === "text") {
          UIHydrate._applyTextBinding(ref, nextValue);
        } else if (target === "value") {
          UIHydrate._applyValueBinding(ref, nextValue);
        }
      } catch (err) {
        UIHydrate._recordBindingDiagnostic(diagnostics, {
          at: Date.now(),
          severity: "error",
          code: "apply-throw",
          fieldId: ref.binding.field,
          elementId: ref.element.elementId ?? undefined,
          nodeType: ref.nodeType,
          detail:
            err instanceof Error
              ? err.message
              : `Binding apply error: ${String(err)}`,
        });
      }
    };

    const applyFieldId = (fieldId: string, field?: UIBindingField) => {
      const refs = fieldMap.get(fieldId);
      if (!refs || refs.length === 0) return;
      for (const ref of refs) {
        applyRef(ref, field);
      }
    };

    for (const fieldId of fieldMap.keys()) {
      const field = runtime.getField?.(fieldId);
      applyFieldId(fieldId, field);
    }

    const unsubscribe = runtime.subscribe((update) => {
      const changedFieldIds =
        Array.isArray(update.changedFieldIds) && update.changedFieldIds.length > 0
          ? update.changedFieldIds
          : Object.keys(update.fields ?? {});
      for (const fieldId of changedFieldIds) {
        const field = update.fields[fieldId] ?? runtime.getField?.(fieldId);
        applyFieldId(fieldId, field);
      }
    });

    const r = root as UIRoot & {
      [ROOT_BINDING_HANDLE]?: BindingRuntimeHandle;
    };
    r[ROOT_BINDING_HANDLE] = {
      unsubscribe,
      diagnostics,
    };
  }

  private static _recordBindingDiagnostic(
    diagnostics: BindingDiagnosticsAccumulator,
    event: UIBindingDiagnosticEvent
  ): void {
    if (event.severity === "warning") {
      diagnostics.warningCount += 1;
      if (event.code === "missing-formatter") {
        diagnostics.missingFormatterCount += 1;
      }
      if (event.code === "unsupported-target") {
        diagnostics.unsupportedTargetCount += 1;
      }
    } else {
      diagnostics.errorCount += 1;
      if (event.code === "formatter-throw") {
        diagnostics.formatterErrorCount += 1;
      }
      if (event.code === "apply-throw") {
        diagnostics.applyErrorCount += 1;
      }
    }

    diagnostics.lastEventAt = event.at;
    diagnostics.recentEvents.push(event);
    if (diagnostics.recentEvents.length > BINDING_DIAGNOSTIC_LIMIT) {
      diagnostics.recentEvents.splice(
        0,
        diagnostics.recentEvents.length - BINDING_DIAGNOSTIC_LIMIT
      );
    }
  }

  private static _snapshotBindingDiagnostics(
    diagnostics: BindingDiagnosticsAccumulator
  ): UIBindingDiagnosticsSnapshot {
    return {
      totalBindings: diagnostics.totalBindings,
      boundFieldCount: diagnostics.boundFieldCount,
      warningCount: diagnostics.warningCount,
      errorCount: diagnostics.errorCount,
      missingFormatterCount: diagnostics.missingFormatterCount,
      unsupportedTargetCount: diagnostics.unsupportedTargetCount,
      formatterErrorCount: diagnostics.formatterErrorCount,
      applyErrorCount: diagnostics.applyErrorCount,
      lastEventAt: diagnostics.lastEventAt,
      recentEvents: diagnostics.recentEvents.slice(),
    };
  }

  private static _resolveBindingTarget(
    nodeType: UISchemaNode["type"],
    binding: UISchemaBinding
  ): UIBindingTarget | null {
    if (nodeType === "text" || nodeType === "data-tag") {
      if (!binding.target || binding.target === "text") return "text";
      return null;
    }
    if (nodeType === "radial-gauge" || nodeType === "slider") {
      if (!binding.target || binding.target === "value") return "value";
      return null;
    }
    return null;
  }

  private static _applyTextBinding(ref: BuiltBindingRef, value: unknown): void {
    const textValue =
      value === null || value === undefined ? "" : String(value);
    const template = ref.binding.template ?? ref.templateText;
    const output =
      template && /\{\{\s*value\s*\}\}/.test(template)
        ? template.replace(/\{\{\s*value\s*\}\}/g, textValue)
        : textValue;

    if (ref.element instanceof TextBlock) {
      ref.element.setText(output);
      return;
    }
    if (ref.element instanceof DataTag) {
      ref.element.setText(output);
    }
  }

  private static _applyValueBinding(ref: BuiltBindingRef, value: unknown): void {
    const n = UIHydrate._coerceNumber(value);
    if (n === null) return;
    if (ref.element instanceof RadialGauge) {
      ref.element.value = n;
      return;
    }
    if (ref.element instanceof SliderLinear) {
      ref.element.value = n;
    }
  }

  private static _coerceNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const direct = Number(value);
      if (Number.isFinite(direct)) {
        return direct;
      }
      const match = value.match(/[-+]?\d*\.?\d+/);
      if (!match) return null;
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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
      const template = SLOT_TEMPLATE_CACHE.get(element) ?? element.getText();
      if (!SLOT_TEMPLATE_CACHE.has(element)) {
        SLOT_TEMPLATE_CACHE.set(element, template);
      }
      const current = element.getText();
      const replaced = UIHydrate._interpolateSlots(template, slots);
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
      "icon", "marker-plus", "tri-chevron", "segmented-hex-ring",
      "reticle-corners", "radial-tick-arc", "node-link-graph",
      "data-tag", "button", "toggle", "slider", "radial-gauge",
      "menu", "submenu", "tooltip",
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

    UIHydrate._validateBindings(node, errors, path);

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

  private static _validateBindings(
    node: UISchemaNode,
    errors: string[],
    path: string
  ): void {
    if (node.bindings === undefined) return;
    if (!Array.isArray(node.bindings)) {
      errors.push(`${path}.bindings: expected an array`);
      return;
    }

    for (let i = 0; i < node.bindings.length; i++) {
      const raw = node.bindings[i] as any;
      const bindingPath = `${path}.bindings[${i}]`;

      if (!raw || typeof raw !== "object") {
        errors.push(`${bindingPath}: expected an object`);
        continue;
      }

      if (typeof raw.field !== "string" || raw.field.trim().length === 0) {
        errors.push(`${bindingPath}.field: must be a non-empty string`);
      }

      if (
        raw.target !== undefined &&
        raw.target !== "text" &&
        raw.target !== "value"
      ) {
        errors.push(`${bindingPath}.target: must be "text" or "value"`);
      }

      if (
        raw.formatter !== undefined &&
        (typeof raw.formatter !== "string" || raw.formatter.trim().length === 0)
      ) {
        errors.push(`${bindingPath}.formatter: must be a non-empty string`);
      }

      if (
        raw.template !== undefined &&
        typeof raw.template !== "string"
      ) {
        errors.push(`${bindingPath}.template: must be a string`);
      }

      const normalized = UIHydrate._normalizeBindings([raw])[0];
      if (!normalized) {
        continue;
      }
      const resolvedTarget = UIHydrate._resolveBindingTarget(node.type, normalized);

      if (!resolvedTarget) {
        errors.push(
          `${bindingPath}: node type "${node.type}" does not support bindings`
        );
      }
    }
  }
}
