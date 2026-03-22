const { db }             = require('../config/firebase');
const { classifyHealth } = require('../services/healthClassifier');

// Auto-assign task based on worker health class
const assignTask = async (req, res) => {
  const { workerId } = req.params;
  try {
    // Get latest sensor data for this worker
    const sensorSnap = await db.ref(`sensorData/${workerId}`).get();
    const sensorData = sensorSnap.exists()
      ? sensorSnap.val()
      : { temperature: 30, gasLevel: 452, baseline: 452, status: 'SAFE' };

    const health = classifyHealth(sensorData);

    // Update worker health class in DB
    await db.ref(`users/workers/${workerId}`).update({ healthClass: health.class });

    // Task pool by class
    const taskPool = {
      A: { title: 'Confined Space Inspection',   zone: 'Manhole / Sewer Line',  duration: '4 hrs' },
      B: { title: 'Surface Drain Cleaning',       zone: 'Street Level Drains',   duration: '3 hrs' },
      C: { title: 'Equipment Check & Reporting',  zone: 'Base Station',          duration: '2 hrs' },
    };

    const task = {
      ...taskPool[health.class],
      healthClass:  health.class,
      assignedAt:   Date.now(),
      status:       'pending',
      workerId,
    };

    await db.ref(`tasks/${workerId}/current`).set(task);
    return res.json({ success: true, task, health });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get current task for worker
const getCurrentTask = async (req, res) => {
  const { workerId } = req.params;
  try {
    const snap = await db.ref(`tasks/${workerId}/current`).get();
    return res.json(snap.val() || null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Mark task complete
const completeTask = async (req, res) => {
  const { workerId } = req.params;
  try {
    const snap = await db.ref(`tasks/${workerId}/current`).get();
    if (!snap.exists()) return res.status(404).json({ error: 'No active task.' });

    const task = { ...snap.val(), status: 'completed', completedAt: Date.now() };

    // Move to history
    await db.ref(`tasks/${workerId}/history`).push(task);
    await db.ref(`tasks/${workerId}/current`).remove();

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get task history for worker
const getTaskHistory = async (req, res) => {
  const { workerId } = req.params;
  try {
    const snap = await db.ref(`tasks/${workerId}/history`).get();
    if (!snap.exists()) return res.json([]);
    const history = [];
    snap.forEach(c => history.push(c.val()));
    return res.json(history.reverse());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { assignTask, getCurrentTask, completeTask, getTaskHistory };