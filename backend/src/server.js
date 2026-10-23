import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './configs/db.js';
import apiRoutes from "./routes/api.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.text({ type: ['text/xml', 'application/xml'] }));

//ROUTES ARE HERE
app.use('/api/v1', apiRoutes);


app.get('/health', async (req, res) => {
    try {
        const dbResult = await query('SELECT NOW() AS current_db_time, COUNT(*)::int AS carriers_count FROM carriers');
        res.status(200).json({
            status: 'ok',
            service: 'Carrier Gateway Middleware API',
            database: 'connected',
            dbTime: dbResult.rows[0].current_db_time,
            configuredCarriers: dbResult.rows[0].carriers_count
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            service: 'Carrier Gateway Middleware API',
            database: 'disconnected',
            error: error.message
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'NotFound', message: `Cannot ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
    console.error('[Internal Error]:', err.stack || err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'An unexpected error occurred.'
    });
});

app.listen(PORT, () => {
    console.log(`[API Server] Running on http://localhost:${PORT}`);
});