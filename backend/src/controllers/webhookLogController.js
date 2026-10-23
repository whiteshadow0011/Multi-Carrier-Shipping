import { query } from '../configs/db.js';
import { addWebhookJob } from '../queue/webhookQueue.js';


export const getWebhookLogs = async (req, res, next) => {
  try {
    const { delivery_status, limit = 50, offset = 0 } = req.query;

    let filterClause = 'WHERE 1=1';
    const params = [];

    if (delivery_status) {
      params.push(delivery_status.toUpperCase());
      filterClause += ` AND wl.delivery_status = $${params.length}`;
    }

    params.push(parseInt(limit, 10));
    const limitIdx = params.length;

    params.push(parseInt(offset, 10));
    const offsetIdx = params.length;

    const sql = `
      SELECT wl.*, s.tracking_number
      FROM webhook_logs wl
      JOIN shipments s ON wl.shipment_id = s.id
      ${filterClause}
      ORDER BY wl.dispatched_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const { rows } = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};


export const getLogsByShipment = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;

    const sql = `
      SELECT * FROM webhook_logs
      WHERE shipment_id = $1
      ORDER BY dispatched_at ASC;
    `;

    const { rows } = await query(sql, [shipmentId]);

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};


export const retryWebhookLog = async (req, res, next) => {
  try {
    const { logId } = req.params;

    const logRes = await query('SELECT * FROM webhook_logs WHERE id = $1', [logId]);
    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: `Log entry ${logId} not found.` });
    }

    const log = logRes.rows[0];

    
    await addWebhookJob(log.event_type, {
      shipmentId: log.shipment_id,
      eventType: log.event_type,
      targetUrl: log.target_url,
      payload: log.payload,
      isManualRetry: true,
    });

    return res.status(200).json({
      success: true,
      message: `Webhook ${log.event_type} re-enqueued for dispatch.`,
    });
  } catch (error) {
    next(error);
  }
};