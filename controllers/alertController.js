const { db } = require('../config/firebase');

// Log a new alert
const logAlert = async (req, res) => {
  const { workerId, type, message, supervisorId } = req.body;
  try {
    const alert = { workerId, type, message, supervisorId, timestamp: Date.now(), seen: false };
    await db.ref('alerts').push(alert);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get all alerts for a supervisor's workers
const getAlerts = async (req, res) => {
  const { supervisorId } = req.params;
  try {
    const snap = await db.ref('alerts').orderByChild('supervisorId').equalTo(supervisorId).get();
    if (!snap.exists()) return res.json([]);
    const alerts = [];
    snap.forEach(c => alerts.push({ id: c.key, ...c.val() }));
    return res.json(alerts.reverse());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Trigger SOS / distress for a worker
const triggerSOS = async (req, res) => {
  const { workerId } = req.params;
  const { supervisorId, triggeredBy } = req.body;
  try {
    const alert = {
      workerId, supervisorId,
      type: 'SOS',
      message: `🆘 SOS triggered for worker ${workerId} by ${triggeredBy}`,
      timestamp: Date.now(),
      seen: false,
    };
    await db.ref('alerts').push(alert);
    await db.ref(`users/workers/${workerId}`).update({ sosActive: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { logAlert, getAlerts, triggerSOS };