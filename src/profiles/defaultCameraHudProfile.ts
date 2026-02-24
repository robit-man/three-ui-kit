import type { UISchemaNode } from "../core/UIHydrate.js";
import { CAMERA_HUD_READOUT_ROWS } from "../telemetry/camera-hud-baseline.js";

export const CAMERA_HUD_SCHEMA_IDS = {
  root: "camera-hud-default-profile-root",
  gaugeMotion: "hud-gauge-motion",
  gaugeValue: "hud-gauge-value",
  bloomSlider: "hud-bloom-slider",
} as const;

function readoutRow(
  id: string,
  label: string,
  value: string,
  fieldId?: string
): UISchemaNode {
  return {
    type: "panel",
    id: `hud-readout-row-${id}`,
    sizing: { width: 240, height: 20 },
    layout: { type: "STACK_X", gap: 6, align: "center", justify: "start", padding: 0 },
    style: { fillAlpha: 0, strokeWidth: 0 },
    children: [
      {
        type: "text",
        id: `hud-readout-label-${id}`,
        props: { text: label, variant: "label", colorKey: "text1", align: "left" },
        sizing: { width: 76, height: 16 },
      },
      {
        type: "panel",
        id: `hud-readout-spacer-${id}`,
        sizing: { width: 4, height: 1 },
        style: { fillAlpha: 0, strokeAlpha: 0, strokeWidth: 0 },
      },
      {
        type: "text",
        id: `hud-readout-value-${id}`,
        props: { text: value, variant: "readout", colorKey: "accentA", align: "right" },
        sizing: { width: 152, height: 16 },
        bindings: fieldId ? [{ field: fieldId, target: "text" }] : undefined,
      },
    ],
  };
}

export function buildDefaultCameraHudProfileSchema(): UISchemaNode {
  const telemetryRows = CAMERA_HUD_READOUT_ROWS.map((row) =>
    readoutRow(row.legacyKey, row.label, row.placeholder, row.fieldId)
  );

  return {
    type: "root",
    id: CAMERA_HUD_SCHEMA_IDS.root,
    layout: { type: "STACK_X", gap: 12, padding: 10, align: "start" },
    sizing: { width: 440, height: 304 },
    children: [
      {
        type: "panel",
        id: "hud-left-panel",
        sizing: { width: 160, height: 188 },
        layout: { type: "STACK_Y", gap: 8, padding: 8, align: "center", justify: "start" },
        style: {
          fillColor: "#050607",
          fillAlpha: 0.04,
          strokeColor: "#B88838",
          strokeAlpha: 0.35,
          strokeWidth: 1,
          cornerRadius: 4,
        },
        children: [
          {
            type: "text",
            id: "hud-gauge-title",
            props: { text: "CAMERA", variant: "label", colorKey: "text1", align: "center" },
            sizing: { width: 140, height: 16 },
          },
          {
            type: "radial-gauge",
            id: CAMERA_HUD_SCHEMA_IDS.gaugeMotion,
            props: {
              radius: 44,
              thickness: 3,
              value: 0.42,
              label: "MOTION",
              startAngle: -Math.PI * 0.75,
              sweepAngle: Math.PI * 1.5,
            },
            bindings: [{ field: "camera.motion.norm", target: "value" }],
          },
          {
            type: "text",
            id: CAMERA_HUD_SCHEMA_IDS.gaugeValue,
            props: { text: "0.42", variant: "readout", colorKey: "accentA", align: "center" },
            sizing: { width: 140, height: 16 },
            bindings: [
              {
                field: "camera.motion.norm",
                target: "text",
                formatter: "hudMotionFraction",
              },
            ],
          },
        ],
      },
      {
        type: "panel",
        id: "hud-right-panel",
        sizing: { width: 260, height: 282 },
        layout: { type: "STACK_Y", gap: 4, padding: 10, align: "start", justify: "start" },
        style: {
          fillColor: "#050607",
          fillAlpha: 0.04,
          strokeColor: "#B88838",
          strokeAlpha: 0.35,
          strokeWidth: 1,
          cornerRadius: 4,
        },
        children: [
          {
            type: "panel",
            id: "hud-title-row",
            sizing: { width: 240, height: 22 },
            layout: { type: "STACK_X", gap: 6, align: "center", justify: "start" },
            style: { fillAlpha: 0, strokeWidth: 0 },
            children: [
              { type: "marker-plus", id: "hud-title-mark", props: { size: 7, colorKey: "accentA" } },
              {
                type: "text",
                id: "hud-title-text",
                props: { text: "LIVE TELEMETRY", variant: "title", colorKey: "accentA" },
              },
            ],
          },
          { type: "divider", id: "hud-divider-top", props: { length: 240 } },
          ...telemetryRows,
          { type: "divider", id: "hud-divider-bottom", props: { length: 240 } },
          {
            type: "slider",
            id: CAMERA_HUD_SCHEMA_IDS.bloomSlider,
            props: { label: "BLOOM", value: 0.45, showReadout: true },
            sizing: { width: 240, height: 16 },
          },
        ],
      },
    ],
  };
}

