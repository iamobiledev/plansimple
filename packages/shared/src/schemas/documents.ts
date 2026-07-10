import { z } from "zod";

export const initiateUploadSchema = z.object({
  filename: z.string().min(1).max(500),
  fileSize: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  contentType: z.string().default("application/pdf"),
  documentSetId: z.string().uuid().optional(),
});
export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

export const completeUploadSchema = z.object({
  documentId: z.string().uuid(),
  revisionId: z.string().uuid(),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
