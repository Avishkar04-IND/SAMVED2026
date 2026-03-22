const { db } = require('../config/firebase');

// Get all workers under a supervisor
const getWorkersBySupervisor = async (req, res) => {
  const { supervisorId } = req.params;
  try {
    const snapshot = await db.ref('users/workers').get();
    if (!snapshot.exists()) return res.json([]);
    const workers = [];
    snapshot.forEach(child => {
      const w = child.val();
      if (w.supervisorId === supervisorId) workers.push(w);
    });
    return res.json(workers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get all unassigned workers (supervisorId is null or missing)
const getUnassignedWorkers = async (req, res) => {
  try {
    const snapshot = await db.ref('users/workers').get();
    if (!snapshot.exists()) return res.json([]);
    const workers = [];
    snapshot.forEach(child => {
      const w = child.val();
      if (!w.supervisorId) workers.push(w);
    });
    return res.json(workers);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Update worker status
const updateWorkerStatus = async (req, res) => {
  const { workerId } = req.params;
  const { status }   = req.body;
  try {
    await db.ref(`users/workers/${workerId}`).update({ status, lastSeen: Date.now() });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getWorkersBySupervisor, getUnassignedWorkers, updateWorkerStatus };