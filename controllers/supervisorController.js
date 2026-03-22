const { db } = require('../config/firebase');

// Helper — Firebase may return array as object {0:'a',1:'b'} or real array
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

// Assign workers to supervisor
const assignWorkers = async (req, res) => {
  const { supervisorId } = req.params;
  const { workerIds }    = req.body;

  if (!Array.isArray(workerIds) || workerIds.length === 0)
    return res.status(400).json({ error: 'No workers selected.' });
  if (workerIds.length > 5)
    return res.status(400).json({ error: 'Maximum 5 workers per supervisor.' });

  try {
    const updates = {};
    workerIds.forEach(id => {
      updates[`users/workers/${id}/supervisorId`] = supervisorId;
      updates[`users/workers/${id}/status`]       = 'active';
    });
    updates[`users/supervisors/${supervisorId}/workers`] = workerIds;
    await db.ref().update(updates);
    return res.json({ success: true, assigned: workerIds });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Remove a single worker from supervisor's team
const removeWorker = async (req, res) => {
  const { supervisorId, workerId } = req.params;
  try {
    // Get current workers list — handle Firebase object-as-array
    const snap    = await db.ref(`users/supervisors/${supervisorId}/workers`).get();
    const current = toArray(snap.val());
    const updated = current.filter(id => id !== workerId);

    console.log(`Removing ${workerId} from [${current}] → [${updated}]`);

    const updates = {};
    updates[`users/supervisors/${supervisorId}/workers`] = updated;
    updates[`users/workers/${workerId}/supervisorId`]    = null;
    updates[`users/workers/${workerId}/status`]          = 'inactive';

    await db.ref().update(updates);
    return res.json({ success: true, removed: workerId });
  } catch (err) {
    console.error('Remove worker error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Get supervisor's assigned workers list
const getSupervisorWorkers = async (req, res) => {
  const { supervisorId } = req.params;
  try {
    const snap = await db.ref(`users/supervisors/${supervisorId}/workers`).get();
    return res.json(toArray(snap.val()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { assignWorkers, removeWorker, getSupervisorWorkers };