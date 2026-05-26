const express = require('express');
const upload = require('../../config/upload-media');
const { authenticate } = require('../../middlewares/auth.middleware');
const mediaController = require('./media.controller');

const router = express.Router();

router.use(authenticate);

// Accept multiple files field name 'files'
router.post('/', upload.array('files', 12), mediaController.uploadMultiple);

module.exports = router;
