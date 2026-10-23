import { Worker } from 'bullmq';
import axios from 'axios';
import dotenv from 'dotenv';
import { redisConnection } from './queue/webhookQueue.js';
import { query } from './configs/db.js';

dotenv.config();

console.log('[Worker Process] Initializing BullMQ Webhook Consumer...');


const CONCURRENCY = 5;

export const webhookWorker = new Worker(
    'webhook-dispatch-queue',
    async (job) => {
        const {
            shipmentId,
            trackingNumber,
            eventType,
            status,
            targetUrl,
            timestamp,
            isManualRetry = false,
            payload: customPayload,
        } = job.data;


        const outboundPayload = customPayload || {
            event: eventType,
            tracking_number: trackingNumber,
            status: status,
            timestamp: timestamp || new Date().toISOString(),
            dispatched_at: new Date().toISOString(),
        };

        const currentAttempt = job.attemptsMade + 1;
        let httpStatus = null;
        let deliveryStatus = 'FAILED';
        let errorMessage = null;

        console.log(
            `[Worker] Processing Job ${job.id} | Event: ${eventType} | Target: ${targetUrl} | Attempt: ${currentAttempt}/${job.opts.attempts}`
        );

        try {
            const response = await axios.post(targetUrl, outboundPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'CarrierGateway-WebhookDispatcher/1.0',
                    'X-Event-Type': eventType,
                },
                timeout: 5000,
            });

            httpStatus = response.status;
            deliveryStatus = 'SUCCESS';

            console.log(`[Worker] Job ${job.id} dispatched successfully (HTTP ${httpStatus})`);
        } catch (error) {
            if (error.response) {
                httpStatus = error.response.status;
                errorMessage = `HTTP ${httpStatus}: ${JSON.stringify(error.response.data || error.message)}`;
            } else if (error.request) {
                httpStatus = 0;
                errorMessage = `Network Timeout/No Response: ${error.message}`;
            } else {
                errorMessage = error.message;
            }

            if (currentAttempt < job.opts.attempts) {
                deliveryStatus = 'RETRYING';
            } else {
                deliveryStatus = 'FAILED';
            }

            console.error(
                `[Worker] Job ${job.id} failed attempt ${currentAttempt}. Status: ${deliveryStatus}. Reason: ${errorMessage}`
            );

            throw new Error(errorMessage);
        } finally {
            try {
                const logQuery = `
          INSERT INTO webhook_logs (
            shipment_id, event_type, target_url, payload,
            http_status, attempt_count, delivery_status, error_details
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `;

                await query(logQuery, [
                    shipmentId,
                    eventType,
                    targetUrl,
                    JSON.stringify(outboundPayload),
                    httpStatus,
                    currentAttempt,
                    deliveryStatus,
                    errorMessage,
                ]);
            } catch (dbErr) {
                console.error('[Worker DB Log Error]: Failed to write webhook log:', dbErr.message);
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: CONCURRENCY,
    }
);


webhookWorker.on('completed', (job) => {
    console.log(`[Worker Event] Job ${job.id} (${job.name}) completed.`);
});

webhookWorker.on('failed', (job, err) => {
    console.error(`[Worker Event] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

webhookWorker.on('error', (err) => {
    console.error('[Worker Fatal Redis Error]:', err.message);
});