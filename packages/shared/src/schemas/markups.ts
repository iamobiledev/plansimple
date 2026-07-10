import { z } from "zod";

export const markupTypeSchema = z.enum([
  "rectangle",
  "ellipse",
  "polygon",
  "polyline",
  "arrow",
  "line",
  "freehand",
  "cloud",
  "cloud_callout",
  "textbox",
  "callout",
  "highlighter",
  "stamp",
  "length",
  "polylength",
  "area",
  "perimeter",
  "volume",
  "count",
]);
export type MarkupType = z.infer<typeof markupTypeSchema>;

export const markupStatusSchema = z.enum(["open", "in_review", "resolved", "void"]);
export type MarkupStatus = z.infer<typeof markupStatusSchema>;

export const measurementKindSchema = z.enum(["length", "area", "volume", "count"]);

export const measurementSchema = z.object({
  kind: measurementKindSchema,
  rawValue: z.number(),
  calibratedValue: z.number().nullable(),
  unit: z.string(),
});

const jsonRecordSchema = z.record(z.unknown());

export const createMarkupSchema = z.object({
  pageId: z.string().uuid(),
  revisionId: z.string().uuid(),
  type: markupTypeSchema,
  geometry: jsonRecordSchema,
  style: jsonRecordSchema.optional(),
  subject: z.string().max(500).optional(),
  layer: z.string().max(120).optional(),
  status: markupStatusSchema.optional(),
  measurement: measurementSchema.optional(),
});
export type CreateMarkupInput = z.infer<typeof createMarkupSchema>;

export const updateMarkupSchema = z
  .object({
    style: jsonRecordSchema.optional(),
    geometry: jsonRecordSchema.optional(),
    subject: z.string().max(500).nullable().optional(),
    layer: z.string().max(120).nullable().optional(),
    status: markupStatusSchema.optional(),
    measurement: measurementSchema.nullable().optional(),
  })
  .strict();
export type UpdateMarkupInput = z.infer<typeof updateMarkupSchema>;

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: markupStatusSchema,
});
export type BulkStatusInput = z.infer<typeof bulkStatusSchema>;
