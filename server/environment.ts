import 'dotenv/config';

class Environment {
  public static getPort(): number | string {
    return process.env.PORT || 3000;
  }

  public static getAWSRegion(): string {
    const apiKey = process.env.AWS_REGION;
    if (!apiKey) {
      throw new Error('AWS_ is not defined in the environment variables');
    }
    return apiKey;
  }

  public static getAWSAccessKeyId(): string {
    const apiKey = process.env.AWS_ACCESS_KEY_ID;
    if (!apiKey) {
      throw new Error('AWS_ACCESS_KEY_ID is not defined in the environment variables');
    }
    return apiKey;
  }

  public static getAWSSecretAccessKey(): string {
    const apiKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!apiKey) {
      throw new Error('AWS_SECRET_ACCESS_KEY is not defined in the environment variables');
    }
    return apiKey;
  }

  public static getS3BucketName(): string {
    const apiKey = process.env.AWS_S3_BUCKET_NAME;
    if (!apiKey) {
      throw new Error('S3_BUCKET_NAME is not defined in the environment variables');
    }
    return apiKey;
  }
}

export default Environment;