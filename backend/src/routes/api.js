import express from 'express';
import {
  createShipment,
  getShipmentByTracking,
  listShipments,
} from '../controllers/shipmentController.js';
import { advanceShipmentStatus } from '../controllers/simulationController.js';
import {
  getWebhookLogs,
  getLogsByShipment,
  retryWebhookLog,
} from '../controllers/webhookLogController.js';
import { getCarriers } from '../controllers/carrierController.js';

const router = express.Router();

// Carrier 
router.get('/carriers', getCarriers);

// Shipment 
router.post('/shipments', createShipment);
router.get('/shipments', listShipments);
router.get('/shipments/:trackingNumber', getShipmentByTracking);

// Simulation 
router.patch('/shipments/:trackingNumber/status', advanceShipmentStatus);

// Webhook Observability 
router.get('/webhooks/logs', getWebhookLogs);
router.get('/webhooks/logs/:shipmentId', getLogsByShipment);
router.post('/webhooks/retry/:logId', retryWebhookLog);

export default router;