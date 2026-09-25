import { Router } from 'express';

import { searchLeads } from '../controllers/leadController.js';
import { getLeadUsage } from '../controllers/usageController.js';
import { requireAuthenticatedUser } from '../middleware/authenticate.js';
import { perUserSearchRateLimit } from '../middleware/searchRateLimit.js';

const router = Router();

// All lead-related endpoints belong here. Add future lead routes beside this one.
router.get('/usage', requireAuthenticatedUser, getLeadUsage);
router.post('/search', requireAuthenticatedUser, perUserSearchRateLimit, searchLeads);

export default router;
