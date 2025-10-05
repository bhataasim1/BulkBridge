import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { AWSS3Config } from "../config/aws-s3.config";
import Environment from "../environment";
import { CompleteRequest, PresignRequest, UploadRequest } from "../types/types";

const s3Client = new AWSS3Config()

export class UploadController {
  private readonly s3Client: AWSS3Config = s3Client;

  constructor() {
    this.s3Client = s3Client;
  }

  public async uploadFile(parsedData: UploadRequest) {
    try {
      const sanitizedFileName = this.sanitizeFileName(parsedData.fileName);
      const uniqueKey = this.generateUniqueKey(sanitizedFileName, parsedData.key);

      const command = new CreateMultipartUploadCommand({
        Bucket: Environment.getS3BucketName(),
        Key: uniqueKey,
        ContentType: parsedData.fileType,
        Metadata: {
          originalFileName: sanitizedFileName,
          fileSize: parsedData.fileSize.toString(),
          'upload-type': 'multipart',
          'uploaded-at': new Date().toISOString(),
        },
      });


      const result = await this.s3Client.getClient().send(command);

      if (!result.UploadId) {
        throw new Error('Failed to initiate multipart upload');
      }

      return {
        uploadId: result.UploadId,
        key: uniqueKey,
        bucket: Environment.getS3BucketName()
      };

    } catch (error) {
      throw new Error('Failed to upload file: ' + (error as Error).message);
    }
  }

  public async generatePresignedUrl({ uploadId, parts, key }: PresignRequest): Promise<{ partNumber: number; url: string }[]> {
    try {
      const presignedUrls = await Promise.all(
        Array.from({ length: parts }, (_, index) => index + 1).map(
          async (partNumber) => {
            const command = new UploadPartCommand({
              Bucket: Environment.getS3BucketName(),
              Key: key,
              PartNumber: partNumber,
              UploadId: uploadId,
            });

            const url = await getSignedUrl(
              this.s3Client.getClient(),
              command,
              { expiresIn: 3600 }
            );

            return {
              partNumber,
              url,
            };
          }
        )
      );

      return presignedUrls;
    } catch (error) {
      throw new Error('Failed to generate presigned URL: ' + (error as Error).message);
    }
  }

  public async completeMultipartUpload({ uploadId, key, parts }: CompleteRequest) {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: Environment.getS3BucketName(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts,
          // Parts: parts.map(part => ({ ETag: part.ETag, PartNumber: part.PartNumber })),
        },
      });

      const result = await this.s3Client.getClient().send(command);

      return result;
    } catch (error) {
      throw new Error('Failed to complete multipart upload: ' + (error as Error).message);
    }
  }

  // keep them in utils file
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  private generateUniqueKey(fileName: string, key: string | undefined): string {
    if (key) return key;

    const timestamp = new Date().toISOString().slice(0, 10);

    const uniqueId = uuidv4();
    return `uploads/${timestamp}/${uniqueId}-${fileName}`;
  }
}