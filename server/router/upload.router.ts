import express, { Request, Response } from 'express';
import { z } from 'zod';
import { UploadController } from '../controller/upload.controller';
import { completeSchema, presignSchema, uploadSchema } from '../types/types';

export const uploadRouter = express.Router();
const uploadController = new UploadController();


uploadRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const parsedData = uploadSchema.parse(req.body);

    const result = await uploadController.uploadFile(parsedData);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error,
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    });
  }
});



uploadRouter.post('/generate-presigned-url', async (req: Request, res: Response) => {
  try {
    const { uploadId, parts, key } = presignSchema.parse(req.body);

    const presignedUrl = await uploadController.generatePresignedUrl({ uploadId, parts, key });

    return res.status(200).json({ url: presignedUrl });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return res.status(500).json({ error: 'Failed to generate presigned URL', message: (error as Error).message });
  }
});


uploadRouter.post('/complete-upload', async (req: Request, res: Response) => {
  try {
    const { uploadId, key, parts } = completeSchema.parse(req.body);

    const result = await uploadController.completeMultipartUpload({ uploadId, key, parts });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    return res.status(500).json({
      error: 'Failed to complete multipart upload',
      message: (error as Error).message
    });
  }
});