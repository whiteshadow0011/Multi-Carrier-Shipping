import { z } from 'zod';
import crypto from 'crypto';
import { query } from '../configs/db.js';
import { addWebhookJob } from '../queue/webhookQueue.js';
import {transformToCarrierFormat} from "./carrierTransformer.js";

const shipmentSchema = z.object({
    carrier_code: z.string().min(2).max(20),
    sender_name: z.string().min(2).max(100),
    sender_address: z.string().min(5),
    receiver_name: z.string().min(2).max(100),
    destination_city: z.string().min(2).max(100),
    destination_pincode: z.string().min(3).max(20),
    package_weight_kg: z.number().positive(),
    client_webhook_url: z.string().url(),
});

export const createShipment = async (req, res, next) => {
    try {
        const validatedData = shipmentSchema.parse(req.body);

        const carrierRes = await query(
            'SELECT id, carrier_code, name, payload_format, api_endpoint, is_active FROM carriers WHERE carrier_code = $1',
            [validatedData.carrier_code.toUpperCase()]
        );

        if (carrierRes.rows.length === 0 || !carrierRes.rows[0].is_active) {
            return res.status(400).json({
                error: 'InvalidCarrier',
                message: `Carrier '${validatedData.carrier_code}' is not supported or inactive.`,
            });
        }

        const carrier = carrierRes.rows[0];

        const trackingNumber = `TRK-${carrier.carrier_code}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const transformedCarrierPayload = transformToCarrierFormat(validatedData, carrier);

        const insertQuery = `
      INSERT INTO shipments (
        tracking_number, carrier_id, sender_name, sender_address,
        receiver_name, destination_city, destination_pincode,
        package_weight_kg, status, client_webhook_url, raw_carrier_response
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CREATED', $9, $10)
      RETURNING *;
    `;

        const values = [
            trackingNumber,
            carrier.id,
            validatedData.sender_name,
            validatedData.sender_address,
            validatedData.receiver_name,
            validatedData.destination_city,
            validatedData.destination_pincode,
            validatedData.package_weight_kg,
            validatedData.client_webhook_url,
            JSON.stringify({
                transformedPayload: transformedCarrierPayload.payload,
                contentType: transformedCarrierPayload.contentType,
            }),
        ];

        const { rows } = await query(insertQuery, values);
        const newShipment = rows[0];

        await addWebhookJob('shipment.created', {
            shipmentId: newShipment.id,
            trackingNumber: newShipment.tracking_number,
            eventType: 'shipment.created',
            status: 'CREATED',
            targetUrl: newShipment.client_webhook_url,
            timestamp: newShipment.created_at,
        });

        return res.status(201).json({
            success: true,
            message: 'Shipment successfully created and queued for dispatch.',
            data: {
                tracking_number: newShipment.tracking_number,
                status: newShipment.status,
                carrier: carrier.name,
                carrier_format: carrier.payload_format,
                created_at: newShipment.created_at,
                transformed_preview: transformedCarrierPayload,
            },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'ValidationError', details: error.errors });
        }
        next(error);
    }
};


export const getShipmentByTracking = async (req, res, next) => {
    try {
        const { trackingNumber } = req.params;

        const sql = `
      SELECT s.*, c.name AS carrier_name, c.carrier_code, c.payload_format
      FROM shipments s
      JOIN carriers c ON s.carrier_id = c.id
      WHERE s.tracking_number = $1;
    `;

        const { rows } = await query(sql, [trackingNumber.toUpperCase()]);

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'NotFound',
                message: `Shipment with tracking number '${trackingNumber}' not found.`,
            });
        }

        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        next(error);
    }
};


export const listShipments = async (req, res, next) => {
    try {
        const { status, carrier, limit = 25, offset = 0 } = req.query;

        let filterClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            params.push(status.toUpperCase());
            filterClause += ` AND s.status = $${params.length}`;
        }

        if (carrier) {
            params.push(carrier.toUpperCase());
            filterClause += ` AND c.carrier_code = $${params.length}`;
        }

        params.push(parseInt(limit, 10));
        const limitIdx = params.length;

        params.push(parseInt(offset, 10));
        const offsetIdx = params.length;

        const sql = `
      SELECT s.id, s.tracking_number, s.status, s.sender_name, s.receiver_name,
             s.destination_city, s.package_weight_kg, s.created_at, s.updated_at,
             c.name AS carrier_name, c.carrier_code
      FROM shipments s
      JOIN carriers c ON s.carrier_id = c.id
      ${filterClause}
      ORDER BY s.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

        const countSql = `
      SELECT COUNT(*)::int AS total
      FROM shipments s
      JOIN carriers c ON s.carrier_id = c.id
      ${filterClause};
    `;

        const [dataResult, countResult] = await Promise.all([
            query(sql, params),
            query(countSql, params.slice(0, params.length - 2)),
        ]);

        return res.status(200).json({
            success: true,
            total: countResult.rows[0].total,
            data: dataResult.rows,
        });
    } catch (error) {
        next(error);
    }
};