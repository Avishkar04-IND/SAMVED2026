const express = require('express');
const router  = express.Router();
const { workerLogin, supervisorLogin, updateProfile } = require('../controllers/authController');

router.post('/worker/login',           workerLogin);
router.post('/supervisor/login',       supervisorLogin);
router.patch('/profile/:role/:userId', updateProfile);

module.exports = router;