import express from 'express';
import { getR2Client, getPresignedUploadUrl } from '@rgu/shared';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const r2Client = getR2Client({
  endpoint: process.env.R2_ENDPOINT,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
});

router.post('/presigned-url', async (req, res) => {
  const { fileName, contentType } = req.body;
  const key = `uploads/${Date.now()}-${fileName}`;
  try {
    const url = await getPresignedUploadUrl(r2Client, process.env.R2_BUCKET_NAME, key);
    res.json({ url, key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate pre-signed URL' });
  }
});

export default router;
