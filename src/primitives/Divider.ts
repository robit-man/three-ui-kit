/**
 * Divider — hairline divider primitive.
 * Thin horizontal or vertical rule using the line0 colour token.
 */

import { Stroke, type StrokeOptions } from "./Stroke.js";
import type { UITheme } from "../core/UITheme.js";

export interface DividerOptions {
  direction?: "horizontal" | "vertical";
  length?: number;
  id?: string;
}

export class Divider extends Stroke {
  constructor(opts: DividerOptions = {}) {
    super({
      direction: opts.direction ?? "horizontal",
      length: opts.length ?? 100,
      thickness: 1,
      colorKey: "line0",
      id: opts.id,
    });
  }
}
