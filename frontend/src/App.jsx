import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Package, RefreshCw, Send, Clock, ShieldCheck 
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/v1';

export default function App() {
  const [carriers, setCarriers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    carrier_code: 'FEDEX',
    sender_name: 'Acme Warehouse Hub',
    sender_address: '42 Industrial Corridor, Pune',
    receiver_name: 'Priya Sharma',
    destination_city: 'Bengaluru',
    destination_pincode: '560001',
    package_weight_kg: 1.75,
    client_webhook_url: 'https://webhook.site/placeholder-url',
  });

  const [lastCreatedPayload, setLastCreatedPayload] = useState(null);

  useEffect(() => {
    fetchCarriers();
    fetchShipments();
    fetchLogs();
    const interval = setInterval(() => {
      fetchShipments();
      fetchLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchCarriers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/carriers`);
      setCarriers(res.data.data);
    } catch (err) {
      console.error('Error fetching carriers', err);
    }
  };

  const fetchShipments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/shipments?limit=15`);
      setShipments(res.data.data);
    } catch (err) {
      console.error('Error fetching shipments', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/webhooks/logs?limit=20`);
      setWebhookLogs(res.data.data);
    } catch (err) {
      console.error('Error fetching logs', err);
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/shipments`, {
        ...form,
        package_weight_kg: parseFloat(form.package_weight_kg),
      });
      setLastCreatedPayload(res.data.data.transformed_preview);
      fetchShipments();
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Shipment creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (trackingNumber, nextStatus) => {
    try {
      await axios.patch(`${API_BASE}/shipments/${trackingNumber}/status`, { nextStatus });
      fetchShipments();
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Transition failed');
    }
  };

  const handleRetryWebhook = async (logId) => {
    try {
      await axios.post(`${API_BASE}/webhooks/retry/${logId}`);
      alert('Webhook re-queued to Redis worker.');
      fetchLogs();
    } catch (err) {
      alert(err.response?.data?.message || 'Retry failed');
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="header-title">
            <Package color="#3b82f6" size={28} /> Carrier Gateway & Webhook Engine
          </h1>
          <p className="header-subtitle">Multi-Carrier Protocol Normalization & Distributed Dispatch Console</p>
        </div>
        <button 
          onClick={() => { fetchShipments(); fetchLogs(); }}
          className="btn-refresh"
        >
          <RefreshCw size={14} /> Refresh State
        </button>
      </header>

      {/* Main Grid */}
      <div className="main-grid">
        
        {/* Left: Dispatch Form */}
        <div className="card">
          <h2 className="card-title">
            <Send color="#60a5fa" size={18} /> Dispatch New Shipment
          </h2>
          <form onSubmit={handleCreateShipment}>
            <div className="form-group">
              <label>Select Carrier Protocol</label>
              <select 
                value={form.carrier_code}
                onChange={(e) => setForm({ ...form, carrier_code: e.target.value })}
              >
                {carriers.map(c => (
                  <option key={c.carrier_code} value={c.carrier_code}>
                    {c.name} ({c.payload_format})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sender Name</label>
                <input 
                  type="text" 
                  value={form.sender_name} 
                  onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Receiver Name</label>
                <input 
                  type="text" 
                  value={form.receiver_name} 
                  onChange={(e) => setForm({ ...form, receiver_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Destination City</label>
                <input 
                  type="text" 
                  value={form.destination_city} 
                  onChange={(e) => setForm({ ...form, destination_city: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input 
                  type="text" 
                  value={form.destination_pincode} 
                  onChange={(e) => setForm({ ...form, destination_pincode: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Client Webhook URL</label>
              <input 
                type="url" 
                value={form.client_webhook_url} 
                onChange={(e) => setForm({ ...form, client_webhook_url: e.target.value })}
                placeholder="https://webhook.site/..."
                className="input-mono"
                required
              />
              <span className="form-hint">Tip: Use webhook.site to inspect outgoing deliveries live.</span>
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? <RefreshCw className="spinning" size={16} /> : 'Ingest & Normalize Payload'}
            </button>
          </form>

          {lastCreatedPayload && (
            <div className="preview-box">
              <span className="preview-label">
                Transformed to {lastCreatedPayload.contentType}
              </span>
              <pre className="code-block">
                {typeof lastCreatedPayload.payload === 'object' 
                  ? JSON.stringify(lastCreatedPayload.payload, null, 2)
                  : lastCreatedPayload.payload}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Active Shipments */}
        <div className="card">
          <h2 className="card-title">
            <Clock color="#34d399" size={18} /> Active Shipments & State Machine
          </h2>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Tracking #</th>
                  <th>Carrier</th>
                  <th>City</th>
                  <th>Current State</th>
                  <th className="text-right">Advance Step</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td className="mono-cell tracking-cell">{s.tracking_number}</td>
                    <td>{s.carrier_code}</td>
                    <td>{s.destination_city}</td>
                    <td>
                      <span className={`badge ${
                        s.status === 'DELIVERED' ? 'badge-green' :
                        s.status === 'OUT_FOR_DELIVERY' ? 'badge-amber' :
                        s.status === 'IN_TRANSIT' ? 'badge-blue' : 'badge-default'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {s.status === 'CREATED' && (
                        <button 
                          onClick={() => handleAdvanceStatus(s.tracking_number, 'IN_TRANSIT')}
                          className="btn-action"
                        >
                          → In Transit
                        </button>
                      )}
                      {s.status === 'IN_TRANSIT' && (
                        <button 
                          onClick={() => handleAdvanceStatus(s.tracking_number, 'OUT_FOR_DELIVERY')}
                          className="btn-action"
                        >
                          → Out for Delivery
                        </button>
                      )}
                      {s.status === 'OUT_FOR_DELIVERY' && (
                        <button 
                          onClick={() => handleAdvanceStatus(s.tracking_number, 'DELIVERED')}
                          className="btn-action action-green"
                        >
                          ✓ Deliver
                        </button>
                      )}
                      {s.status === 'DELIVERED' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom: Webhook Observability Log */}
      <div className="card">
        <h2 className="card-title">
          <ShieldCheck color="#c084fc" size={18} /> Webhook Worker Observability & Audit Log
        </h2>

        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Tracking #</th>
                <th>Event</th>
                <th>Target Endpoint</th>
                <th>Response</th>
                <th>Attempt</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {webhookLogs.map((log) => (
                <tr key={log.id}>
                  <td className="mono-cell" style={{ color: 'var(--text-dim)' }}>
                    {new Date(log.dispatched_at).toLocaleTimeString()}
                  </td>
                  <td className="mono-cell tracking-cell">{log.tracking_number}</td>
                  <td>{log.event_type}</td>
                  <td className="mono-cell truncate" title={log.target_url}>{log.target_url}</td>
                  <td>
                    <span className={`badge ${
                      log.http_status >= 200 && log.http_status < 300 ? 'badge-green' : 'badge-red'
                    }`}>
                      {log.http_status ? `HTTP ${log.http_status}` : 'TIMEOUT'}
                    </span>
                  </td>
                  <td className="mono-cell">{log.attempt_count}/3</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: log.delivery_status === 'SUCCESS' ? 'var(--color-success)' :
                             log.delivery_status === 'RETRYING' ? 'var(--color-warning)' : 'var(--color-danger)'
                    }}>
                      {log.delivery_status}
                    </span>
                  </td>
                  <td className="text-right">
                    {log.delivery_status !== 'SUCCESS' && (
                      <button 
                        onClick={() => handleRetryWebhook(log.id)}
                        className="btn-link"
                      >
                        Re-queue
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}