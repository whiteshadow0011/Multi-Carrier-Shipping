# Multi-Carrier Shipping & Webhook Dispatch Gateway

An event-driven middleware and telemetry platform that standardizes fragmented multi-carrier logistics protocols (JSON/XML) and provides asynchronous, fault-tolerant webhook delivery with exponential backoff retries.

---

## Architecture Overview

```text
       [ E-Commerce Client / React Operations Console ]
                              │
                              ▼
                  [ Express API Gateway ]
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
  [ Schema Transformer ]                   [ PostgreSQL ]
   - FedEx (REST / JSON)                    - Carrier Configurations
   - DHL Global (SOAP / XML)                - Normalized Shipments
   - Blue Dart (REST / JSON)                - Webhook Audit Logs
          │
          ▼
    [ Redis Queue ] (BullMQ)
          │
          ▼
  [ Background Worker Pool ] ──(HTTP POST + Backoff Retries)──> [ Client Webhook URL ]


////////////////////////////////////////////////
Prerequisites:

Docker & Docker Compose
////////////////////////////////////////////////


////////////////////////////////////////////////
Clone & Start:

git clone [https://github.com/whiteshadow0011/Multi-Carrier-Shipping.git](https://github.com/whiteshadow0011/Multi-Carrier-Shipping.git)
cd Multi-Carrier-Shipping

docker compose up --build
////////////////////////////////////////////////


////////////////////////////////////////////////
To stop all running services:

docker compose down
////////////////////////////////////////////////
