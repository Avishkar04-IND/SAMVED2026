const express = require('express');
const router  = express.Router();
const { getWorkersBySupervisor, getUnassignedWorkers, updateWorkerStatus } = require('../controllers/workerController');

router.get('/unassigned',               getUnassignedWorkers);
router.get('/supervisor/:supervisorId', getWorkersBySupervisor);
router.patch('/:workerId/status',       updateWorkerStatus);

module.exports = router;