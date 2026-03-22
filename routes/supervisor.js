const express = require('express');
const router  = express.Router();
const { assignWorkers, removeWorker, getSupervisorWorkers } = require('../controllers/supervisorController');

router.post('/:supervisorId/assign',               assignWorkers);
router.delete('/:supervisorId/remove/:workerId',   removeWorker);
router.get('/:supervisorId/workers',               getSupervisorWorkers);

module.exports = router;