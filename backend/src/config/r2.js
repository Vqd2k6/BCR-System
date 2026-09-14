const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const accountId = process.env.R2_ACCOUNT_ID || 'mock_account';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'mock_access_key';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'mock_secret_key';
const bucketName = process.env.R2_BUCKET_NAME || 'ksqh-metro2-photos';

// Cloudflare R2 S3 Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Generate Presigned Upload URL for Mobile App
 * Allows mobile surveyor to upload 4MB-5MB photos directly to R2 with zero server load
 */
async function generateUploadPresignedUrl(fileName, contentType = 'image/jpeg', expiresInSeconds = 3600) {
  const key = `surveys/${Date.now()}_${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
  const publicUrl = `${process.env.R2_PUBLIC_DOMAIN || 'https://r2.ksqh-metro2.vn'}/${key}`;

  return { uploadUrl, publicUrl, key };
}

module.exports = {
  r2Client,
  generateUploadPresignedUrl,
  bucketName,
};
