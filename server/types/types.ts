import { z } from "zod";

export const uploadSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number().min(1),
  key: z.string().optional(),
});

export type UploadRequest = z.infer<typeof uploadSchema>;


export const presignSchema = z.object({
  uploadId: z.string(),
  key: z.string(),
  parts: z.number().min(1),
});

export type PresignRequest = z.infer<typeof presignSchema>;


export const completeSchema = z.object({
  uploadId: z.string(),
  key: z.string(),
  parts: z.array(z.object({
    ETag: z.string(),
    PartNumber: z.number().min(1),
  })),
});

export type CompleteRequest = z.infer<typeof completeSchema>;