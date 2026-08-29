import { Router } from 'express';
import { settings } from '../config/db.js';

const router = Router();

/* ================== GET PUBLIC SETTINGS ================== */
router.get('/settings/public', async (req, res) => {
  try {
    const config = await settings.findOne({ _id: 'global' });
    const method = config?.paymentApprovalMethod || 'gateway';
    res.json({ 
      success: true, 
      paymentApprovalMethod: method,
      maintenanceMode: !!config?.maintenanceMode 
    });
  } catch (err) {
    console.error('Failed to fetch public settings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

export default router;
