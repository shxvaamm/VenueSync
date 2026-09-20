const express = require('express');
const router = express.Router();
const adminVenueController = require('../controllers/adminVenueController');
const { requireRole } = require('../middleware/auth');

// All routes here strictly require admin role
router.use(requireRole('admin'));

// Venue CRUD
router.get('/', adminVenueController.getVenuesList);
router.get('/new', adminVenueController.getNewVenueForm);
router.post('/', adminVenueController.postCreateVenue);
router.get('/:id/edit', adminVenueController.getEditVenueForm);
router.put('/:id', adminVenueController.putUpdateVenue);
router.post('/:id/toggle-status', adminVenueController.postToggleStatus);
router.delete('/:id', adminVenueController.deleteVenue);

// Maintenance Block endpoints
router.post('/:id/maintenance', adminVenueController.postAddMaintenanceBlock);
router.delete('/:id/maintenance/:blockId', adminVenueController.deleteMaintenanceBlock);

module.exports = router;
