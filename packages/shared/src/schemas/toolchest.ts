import { z } from "zod";
import { markupTypeSchema } from "./markups.js";

export const createToolChestItemSchema = z.object({
  name: z.string().min(1).max(200),
  shared: z.boolean().optional().default(false),
  markupType: markupTypeSchema,
  style: z.record(z.unknown()).optional(),
  defaultSubject: z.string().max(500).optional(),
  defaultGeometry: z.record(z.unknown()).optional(),
});
export type CreateToolChestItemInput = z.infer<typeof createToolChestItemSchema>;

export const exportDocumentSchema = z.object({
  mode: z.enum(["original", "annotations", "flattened"]).default("annotations"),
});
export type ExportDocumentInput = z.infer<typeof exportDocumentSchema>;
