import type { MarkupType, MarkupStatus } from "@plansimple/shared";

export type MarkupStyle = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
};

export type MarkupGeometry = Record<string, unknown>;

export type Markup = {
  id: string;
  pageId: string;
  revisionId: string;
  type: MarkupType | string;
  geometry: MarkupGeometry;
  style: MarkupStyle;
  status: MarkupStatus | string;
  subject: string | null;
  layer: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type DrawTool =
  | "pan"
  | "select"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polyline"
  | "polygon"
  | "cloud"
  | "freehand"
  | "highlighter"
  | "textbox"
  | "callout"
  | "cloud_callout"
  | "stamp";

export const DRAW_TOOLS: Array<{ id: DrawTool; label: string }> = [
  { id: "pan", label: "Pan (V)" },
  { id: "select", label: "Select (Esc)" },
  { id: "rectangle", label: "Rectangle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "polyline", label: "Polyline" },
  { id: "polygon", label: "Polygon" },
  { id: "cloud", label: "Cloud" },
  { id: "cloud_callout", label: "Cloud+" },
  { id: "freehand", label: "Pen" },
  { id: "highlighter", label: "Highlight" },
  { id: "textbox", label: "Text" },
  { id: "callout", label: "Callout" },
  { id: "stamp", label: "Stamp" },
];

export const DEFAULT_STYLE: MarkupStyle = {
  stroke: "#e11d48",
  fill: "transparent",
  strokeWidth: 2,
  opacity: 1,
  fontSize: 12,
};
