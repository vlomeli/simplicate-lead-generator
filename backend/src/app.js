import cors from 'cors';
import express from 'express';

import { config } from './config/env.js';
import leadRoutes from './routes/leadRoutes.js';
import outreachRoutes from './routes/outreachRoutes.js';

// The app owns HTTP configuration. Keeping it separate from server.js makes it
// easy to test later without opening a network port.
const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('This origin is not allowed to call the API.'));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.use('/api/leads', leadRoutes);
app.use('/api/outreach', outreachRoutes);

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

export default app;
