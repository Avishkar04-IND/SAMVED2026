const { db } = require('../config/firebase');

// ── WORKER LOGIN ─────────────────────────────────────────────
const workerLogin = async (req, res) => {
  const { name, workerId } = req.body;
  if (!name || !workerId)
    return res.status(400).json({ error: 'Name and Worker ID are required.' });

  try {
    const snapshot = await db.ref(`users/workers/${workerId}`).get();

    if (!snapshot.exists()) {
      // First time — register with empty profile fields
      await db.ref(`users/workers/${workerId}`).set({
        name:         name.trim(),
        workerId,
        role:         'worker',
        status:       'inactive',
        supervisorId: null,
        healthClass:  'A',
        // Profile fields — worker fills these in profile page
        phone:        '',
        address:      '',
        department:   'Sanitation',
        joiningDate:  new Date().toISOString().split('T')[0],
        // Medical fields
        bloodGroup:   '',
        conditions:   '',
        allergies:    '',
        emergencyContactName:  '',
        emergencyContactPhone: '',
        // Stats
        totalShifts:  0,
        lastShiftDate: '',
        createdAt:    Date.now(),
        lastSeen:     Date.now(),
      });
    } else {
      const stored = snapshot.val();
      if (stored.name.toLowerCase() !== name.trim().toLowerCase()) {
        return res.status(401).json({
          error: `This Worker ID is registered under the name "${stored.name}". Please enter the correct name.`,
        });
      }
      await db.ref(`users/workers/${workerId}`).update({ lastSeen: Date.now() });
    }

    const workerData = (await db.ref(`users/workers/${workerId}`).get()).val();
    return res.status(200).json({ success: true, user: workerData });
  } catch (err) {
    console.error('Worker login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

// ── SUPERVISOR LOGIN ─────────────────────────────────────────
const supervisorLogin = async (req, res) => {
  const { name, supervisorId, department, accessCode } = req.body;
  if (!name || !supervisorId || !department || !accessCode)
    return res.status(400).json({ error: 'All fields are required.' });

  if (accessCode !== process.env.SUPERVISOR_ACCESS_CODE && accessCode !== 'SAMVED2026')
    return res.status(401).json({ error: 'Invalid access code.' });

  try {
    const snapshot = await db.ref(`users/supervisors/${supervisorId}`).get();

    if (!snapshot.exists()) {
      await db.ref(`users/supervisors/${supervisorId}`).set({
        name:         name.trim(),
        supervisorId,
        department,
        role:         'supervisor',
        workers:      [],
        phone:        '',
        address:      '',
        joiningDate:  new Date().toISOString().split('T')[0],
        createdAt:    Date.now(),
        lastSeen:     Date.now(),
      });
    } else {
      const stored = snapshot.val();
      if (stored.name.toLowerCase() !== name.trim().toLowerCase()) {
        return res.status(401).json({
          error: `This Supervisor ID is registered under the name "${stored.name}". Please enter the correct name.`,
        });
      }
      await db.ref(`users/supervisors/${supervisorId}`).update({ lastSeen: Date.now() });
    }

    const supData = (await db.ref(`users/supervisors/${supervisorId}`).get()).val();
    return res.status(200).json({ success: true, user: supData });
  } catch (err) {
    console.error('Supervisor login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

// ── UPDATE PROFILE ───────────────────────────────────────────
const updateProfile = async (req, res) => {
  const { userId, role } = req.params;
  const updates = req.body;

  // Strip out fields that must not be overwritten
  delete updates.name;
  delete updates.workerId;
  delete updates.supervisorId;
  delete updates.role;
  delete updates.createdAt;

  try {
    const path = role === 'supervisor'
      ? `users/supervisors/${userId}`
      : `users/workers/${userId}`;
    await db.ref(path).update({ ...updates, updatedAt: Date.now() });
    const updated = (await db.ref(path).get()).val();
    return res.json({ success: true, user: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { workerLogin, supervisorLogin, updateProfile };