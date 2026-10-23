import { query } from '../configs/db.js';
import { addWebhookJob } from '../queue/webhookQueue.js';

const VALID_TRANSITIONS = {
  CREATED: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['CREATED'], 
};


export const advanceShipmentStatus = async (req, res, next) => {
  try {
    const { trackingNumber } = req.params;
    const { nextStatus } = req.body;

    if (!nextStatus) {
      return res.status(400).json({ error: 'BadRequest', message: 'Field nextStatus is required.' });
    }

    const targetStatus = nextStatus.toUpperCase();

    
    const selectRes = await query(
      'SELECT id, tracking_number, status, client_webhook_url FROM shipments WHERE tracking_number = $1',
      [trackingNumber.toUpperCase()]
    );

    if (selectRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: `Shipment '${trackingNumber}' not found.` });
    }

    const currentShipment = selectRes.rows[0];
    const allowedNext = VALID_TRANSITIONS[currentShipment.status] || [];

    if (!allowedNext.includes(targetStatus)) {
      return res.status(400).json({
        error: 'InvalidStateTransition',
        message: `Cannot transition from '${currentShipment.status}' to '${targetStatus}'. Allowed: [${allowedNext.join(', ')}]`,
      });
    }
    
    const updateRes = await query(
      'UPDATE shipments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [targetStatus, currentShipment.id]
    );

    const updatedShipment = updateRes.rows[0];

    
    await addWebhookJob('shipment.status_updated', {
      shipmentId: updatedShipment.id,
      trackingNumber: updatedShipment.tracking_number,
      eventType: 'shipment.status_updated',
      status: updatedShipment.status,
      targetUrl: updatedShipment.client_webhook_url,
      timestamp: updatedShipment.updated_at,
    });

    return res.status(200).json({
      success: true,
      message: `Shipment status updated to ${targetStatus} and webhook enqueued.`,
      data: updatedShipment,
    });
  } catch (error) {
    next(error);
  }
};