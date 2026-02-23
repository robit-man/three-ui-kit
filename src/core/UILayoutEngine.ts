/**
 * UILayoutEngine — computes child positions and sizes from layout props.
 * Supports ABSOLUTE, STACK_X, STACK_Y, and GRID layout modes.
 */

import { UIElement, type LayoutType, type Align } from "./UIElement.js";
import { clamp } from "../utils/math.js";

export class UILayoutEngine {
  /**
   * Recursively compute layout for an element and its descendants.
   * Call on the UIRoot each frame (only if dirty).
   */
  static compute(element: UIElement): void {
    // Resolve own size first
    UILayoutEngine.resolveSize(element);

    // Layout children
    switch (element.layout.type) {
      case "STACK_X":
        UILayoutEngine.layoutStack(element, "x");
        break;
      case "STACK_Y":
        UILayoutEngine.layoutStack(element, "y");
        break;
      case "GRID":
        UILayoutEngine.layoutGrid(element);
        break;
      case "ABSOLUTE":
      default:
        UILayoutEngine.layoutAbsolute(element);
        break;
    }

    // Recurse into children
    for (const child of element.uiChildren) {
      if (child.layoutDirty) {
        UILayoutEngine.compute(child);
      }
    }

    // If own size is "auto", compute from children bounds
    UILayoutEngine.resolveAutoSize(element);

    element.layoutDirty = false;
  }

  /* ---------------------------------------------------------------- */
  /*  Size resolution                                                  */
  /* ---------------------------------------------------------------- */

  static resolveSize(el: UIElement): void {
    const s = el.sizing;
    let w = typeof s.width === "number" ? s.width : 0;
    let h = typeof s.height === "number" ? s.height : 0;

    // Intrinsic measurement (e.g., text)
    if (s.width === "auto" || s.height === "auto") {
      const m = el.measure();
      if (s.width === "auto") w = m.width;
      if (s.height === "auto") h = m.height;
    }

    // Apply constraints
    if (s.minWidth !== undefined) w = Math.max(w, s.minWidth);
    if (s.maxWidth !== undefined) w = Math.min(w, s.maxWidth);
    if (s.minHeight !== undefined) h = Math.max(h, s.minHeight);
    if (s.maxHeight !== undefined) h = Math.min(h, s.maxHeight);

    // Aspect ratio
    if (s.aspect !== undefined && s.aspect > 0) {
      if (s.width === "auto" && s.height !== "auto") {
        w = h * s.aspect;
      } else if (s.height === "auto" && s.width !== "auto") {
        h = w / s.aspect;
      }
    }

    el.computedWidth = w;
    el.computedHeight = h;
  }

  /* ---------------------------------------------------------------- */
  /*  Auto-size: compute from children bounding box                    */
  /* ---------------------------------------------------------------- */

  static resolveAutoSize(el: UIElement): void {
    const s = el.sizing;
    if (s.width !== "auto" && s.height !== "auto") return;

    const pad = el.layout.padding ?? 0;
    const padX = el.layout.paddingX ?? pad;
    const padY = el.layout.paddingY ?? pad;
    const children = el.uiChildren;

    if (children.length === 0) return;

    let maxR = 0;
    let maxB = 0;
    for (const child of children) {
      const r = child.layoutX + child.computedWidth;
      const b = child.layoutY + child.computedHeight;
      if (r > maxR) maxR = r;
      if (b > maxB) maxB = b;
    }

    if (s.width === "auto") {
      let w = maxR + padX;
      if (s.minWidth !== undefined) w = Math.max(w, s.minWidth);
      if (s.maxWidth !== undefined) w = Math.min(w, s.maxWidth);
      el.computedWidth = w;
    }

    if (s.height === "auto") {
      let h = maxB + padY;
      if (s.minHeight !== undefined) h = Math.max(h, s.minHeight);
      if (s.maxHeight !== undefined) h = Math.min(h, s.maxHeight);
      el.computedHeight = h;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  ABSOLUTE layout                                                  */
  /* ---------------------------------------------------------------- */

  static layoutAbsolute(parent: UIElement): void {
    for (const child of parent.uiChildren) {
      UILayoutEngine.resolveSize(child);
      // Position comes from child's own position property
      child.layoutX = child.position.x;
      child.layoutY = child.position.y;
      UILayoutEngine.applyPosition(child);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  STACK layout                                                     */
  /* ---------------------------------------------------------------- */

  static layoutStack(parent: UIElement, axis: "x" | "y"): void {
    const gap = parent.layout.gap ?? 0;
    const pad = parent.layout.padding ?? 0;
    const padX = parent.layout.paddingX ?? pad;
    const padY = parent.layout.paddingY ?? pad;
    const align = parent.layout.align ?? "start";
    const justify = parent.layout.justify ?? "start";
    const children = parent.uiChildren;

    // Measure all children
    for (const child of children) {
      UILayoutEngine.resolveSize(child);
    }

    // Total content size along the main axis
    let totalMain = 0;
    let maxCross = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const mainSize = axis === "x" ? child.computedWidth : child.computedHeight;
      const crossSize = axis === "x" ? child.computedHeight : child.computedWidth;
      totalMain += mainSize;
      if (i > 0) totalMain += gap;
      if (crossSize > maxCross) maxCross = crossSize;
    }

    // Available space
    const availMain = axis === "x"
      ? parent.computedWidth - padX * 2
      : parent.computedHeight - padY * 2;
    const availCross = axis === "x"
      ? parent.computedHeight - padY * 2
      : parent.computedWidth - padX * 2;

    // Justify offset along main axis
    let mainOffset = axis === "x" ? padX : padY;
    if (justify === "center") {
      mainOffset += (availMain - totalMain) / 2;
    } else if (justify === "end") {
      mainOffset += availMain - totalMain;
    }

    // Place children
    let cursor = mainOffset;
    for (const child of children) {
      const mainSize = axis === "x" ? child.computedWidth : child.computedHeight;
      const crossSize = axis === "x" ? child.computedHeight : child.computedWidth;

      // Cross-axis alignment
      let crossOffset = axis === "x" ? padY : padX;
      if (align === "center") {
        crossOffset += (availCross - crossSize) / 2;
      } else if (align === "end") {
        crossOffset += availCross - crossSize;
      }

      if (axis === "x") {
        child.layoutX = cursor;
        child.layoutY = crossOffset;
      } else {
        child.layoutX = crossOffset;
        child.layoutY = cursor;
      }

      UILayoutEngine.applyPosition(child);
      cursor += mainSize + gap;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  GRID layout                                                      */
  /* ---------------------------------------------------------------- */

  static layoutGrid(parent: UIElement): void {
    const cols = parent.layout.cols ?? 2;
    const rowGap = parent.layout.rowGap ?? (parent.layout.gap ?? 0);
    const colGap = parent.layout.colGap ?? (parent.layout.gap ?? 0);
    const pad = parent.layout.padding ?? 0;
    const padX = parent.layout.paddingX ?? pad;
    const padY = parent.layout.paddingY ?? pad;
    const children = parent.uiChildren;

    // Measure all
    for (const child of children) {
      UILayoutEngine.resolveSize(child);
    }

    // Compute column width (equal distribution)
    const availW = parent.computedWidth - padX * 2;
    const colW = (availW - colGap * (cols - 1)) / cols;

    let row = 0;
    let col = 0;
    let rowHeight = 0;
    let y = padY;

    for (const child of children) {
      child.layoutX = padX + col * (colW + colGap);
      child.layoutY = y;

      // Optionally stretch child width to fill column
      if (child.sizing.width === "auto") {
        child.computedWidth = colW;
      }

      rowHeight = Math.max(rowHeight, child.computedHeight);
      UILayoutEngine.applyPosition(child);

      col++;
      if (col >= cols) {
        col = 0;
        row++;
        y += rowHeight + rowGap;
        rowHeight = 0;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Position application                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Convert UI-unit layout coordinates to Three.js local position.
   * UI coordinates: origin at top-left, Y grows downward.
   * Three.js: origin at center, Y grows upward.
   * We use a simple mapping: the element's Object3D position.x/y
   * is set directly in UI units; the UIRoot applies a global scale.
   */
  static applyPosition(child: UIElement): void {
    child.position.x = child.layoutX;
    child.position.y = -child.layoutY; // flip Y for Three.js
    child.position.z = child.position.z; // preserve any manual z offset
    child.syncHitRegion();
  }
}
