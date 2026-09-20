const express = require('express');
const router = express.Router();
const venueBrowseController = require('../controllers/venueBrowseController');

// Venues Catalog (Available to all visitors and logged in users)
router.get('/', venueBrowseController.getVenuesCatalog);
router.get('/:id', venueBrowseController.getVenueDetail);

module.exports = router;
