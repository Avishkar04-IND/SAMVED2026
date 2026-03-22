const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const authRoutes       = require('./routes/auth');
const workerRoutes     = require('./routes/workers');
const supervisorRoutes = require('./routes/supervisor');
const taskRoutes       = require('./routes/tasks');
const alertRoutes      = require('./routes/alerts');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/workers',    workerRoutes);
app.use('/api/supervisor', supervisorRoutes);
app.use('/api/tasks',      taskRoutes);
app.use('/api/alerts',     alertRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'SafetyNet Pro API running ✅' }));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));