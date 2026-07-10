import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "editor", "reviewer", "viewer"]);
export type Role = z.infer<typeof roleSchema>;

export const emailSchema = z.string().email().max(320);

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: roleSchema.exclude(["owner"]).default("viewer"),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128).optional(),
  name: z.string().min(1).max(120).optional(),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

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

export const pointSchema = z.object({ x: z.number(), y: z.number() });

export const scaleCalibrationSchema = z.object({
  points: z.tuple([pointSchema, pointSchema]),
  realWorldDistance: z.number().positive(),
  unit: z.enum(["ft", "m", "in", "mm"]),
});
export type ScaleCalibration = z.infer<typeof scaleCalibrationSchema>;

export const processingStatusSchema = z.enum([
  "pending",
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const ocrStatusSchema = z.enum(["not_needed", "queued", "processing", "done", "failed"]);

export * from "./documents.js";
