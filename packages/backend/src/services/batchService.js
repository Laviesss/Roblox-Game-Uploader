import { ConcurrencyQueue, withRetry, decrypt, getR2Client, uploadPlace, logger } from '@rgu/shared';

export class BatchService {
  constructor(prisma, encryptionKey) {
    this.prisma = prisma;
    this.encryptionKey = encryptionKey;
  }

  async processBatch(userId, universeId, placeId, files, concurrency = 3) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.robloxCookie) throw new Error('User cookie not found');

    const cookie = decrypt(user.robloxCookie, this.encryptionKey);
    const r2Client = getR2Client({
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    });

    const job = await this.prisma.job.create({
      data: {
        userId,
        type: 'BATCH_UPLOAD',
        status: 'RUNNING',
        details: { total: files.length, completed: 0, failed: 0, files }
      }
    });

    const queue = new ConcurrencyQueue(concurrency);
    const tasks = files.map(fileKey => async () => {
      try {
        await withRetry(async () => {
          const file = await r2Client.getObject({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey
          }).promise();

          await uploadPlace(cookie, universeId, placeId, file.Body);
        });

        await this.updateJobProgress(job.id, true);
        await this.logAction(userId, `Successfully uploaded ${fileKey}`, 'INFO', { fileKey, jobId: job.id });
      } catch (err) {
        await this.updateJobProgress(job.id, false, err.message);
        await this.logAction(userId, `Failed to upload ${fileKey}: ${err.message}`, 'ERROR', { fileKey, jobId: job.id });
      }
    });

    // Run tasks in background
    Promise.all(tasks.map(task => queue.add(task))).then(async () => {
      const finalJob = await this.prisma.job.findUnique({ where: { id: job.id } });
      const status = finalJob.details.failed === 0 ? 'COMPLETED' : (finalJob.details.completed === 0 ? 'FAILED' : 'PARTIAL_SUCCESS');
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status }
      });
    });

    return job;
  }

  async updateJobProgress(jobId, success, errorMessage = null) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    const details = { ...job.details };
    if (success) details.completed++;
    else details.failed++;

    await this.prisma.job.update({
      where: { id: jobId },
      data: { details }
    });
  }

  async logAction(userId, message, level, meta) {
    await this.prisma.log.create({
      data: { userId, message, level, meta }
    });
    logger.info(message, meta);
  }
}
