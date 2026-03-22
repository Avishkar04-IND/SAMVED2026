const express = require('express');
const router  = express.Router();
const { assignTask, getCurrentTask, completeTask, getTaskHistory } = require('../controllers/taskController');

router.post('/:workerId/assign',    assignTask);
router.get('/:workerId/current',    getCurrentTask);
router.patch('/:workerId/complete', completeTask);
router.get('/:workerId/history',    getTaskHistory);

module.exports = router;