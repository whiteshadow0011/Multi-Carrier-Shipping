import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  maxRetriesPerRequest: null,
};

export const webhookQueue = new Queue('webhook-dispatch-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed HTTP calls up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000, // Wait 2s, then 4s, then 8s
    },
    removeOnComplete: 1000, // Keep last 1000 completed jobs in Redis
    removeOnFail: 5000,     // Retain failed jobs for dead-letter inspection
  },
});

export const addWebhookJob = async (jobName, payload) => {
  return await webhookQueue.add(jobName, payload);
};