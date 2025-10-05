import { S3Client } from '@aws-sdk/client-s3';
import Environment from '../environment';

export class AWSS3Config {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: Environment.getAWSRegion(),
      credentials: {
        accessKeyId: Environment.getAWSAccessKeyId(),
        secretAccessKey: Environment.getAWSSecretAccessKey(),
      },
    });
  }

  public getClient(): S3Client {
    return this.s3Client;
  }
}