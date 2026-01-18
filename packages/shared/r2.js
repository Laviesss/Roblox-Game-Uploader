import AWS from 'aws-sdk';

export function getR2Client(config) {
  return new AWS.S3({
    endpoint: config.endpoint,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
  });
}

export async function getPresignedUploadUrl(s3, bucket, key, expires = 3600) {
  return s3.getSignedUrlPromise('putObject', { Bucket: bucket, Key: key, Expires: expires });
}
