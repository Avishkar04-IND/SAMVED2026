const express = require('express');
const router  = express.Router();
const { logAlert, getAlerts, triggerSOS } = require('../controllers/alertController');

router.post('/',                        logAlert);
router.get('/supervisor/:supervisorId', getAlerts);
router.post('/:workerId/sos',           triggerSOS);

module.exports = router;