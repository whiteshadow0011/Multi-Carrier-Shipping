import { pool } from "../configs/db.js";

const initQuery = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Carriers Table
CREATE TABLE IF NOT EXISTS carriers (
    id SERIAL PRIMARY KEY,
    carrier_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    payload_format VARCHAR(10) NOT NULL DEFAULT 'JSON', -- 'JSON' or 'XML'
    api_endpoint VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number VARCHAR(64) UNIQUE NOT NULL,
    carrier_id INT REFERENCES carriers(id) ON DELETE RESTRICT,
    sender_name VARCHAR(100) NOT NULL,
    sender_address TEXT NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    destination_city VARCHAR(100) NOT NULL,
    destination_pincode VARCHAR(20) NOT NULL,
    package_weight_kg NUMERIC(6, 2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    client_webhook_url VARCHAR(500) NOT NULL,
    raw_carrier_response JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- 4. Webhook Logs Table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    target_url VARCHAR(500) NOT NULL,
    payload JSONB NOT NULL,
    http_status INT NULL,
    attempt_count INT DEFAULT 1,
    delivery_status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILED', 'RETRYING'
    error_details TEXT NULL,
    dispatched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_shipment_id ON webhook_logs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_delivery_status ON webhook_logs(delivery_status);

-- 5. Seed Initial Carriers (upsert if they exist)
INSERT INTO carriers (carrier_code, name, payload_format, api_endpoint)
VALUES 
  ('FEDEX', 'FedEx Express', 'JSON', 'https://mock-carrier.local/api/v1/fedex'),
  ('DHL', 'DHL Global Freight', 'XML', 'https://mock-carrier.local/api/v1/dhl/xml'),
  ('BLUEDART', 'Blue Dart Express', 'JSON', 'https://mock-carrier.local/api/v1/bluedart')
ON CONFLICT (carrier_code) DO NOTHING;
`;

async function initializeDatabase() {
  try {
    console.log('[PostgreSQL] Initializing tables and seed data...');
    await pool.query(initQuery);
    console.log('[PostgreSQL] Tables and initial carriers created successfully.');
  } catch (error) {
    console.error('[PostgreSQL Init Error]:', error.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase();