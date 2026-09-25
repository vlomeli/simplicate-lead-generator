import { Router } from 'express';

import { searchLeads } from '../controllers/leadController.js';
import { requireAuthenticatedUser } from '../middleware/authenticate.js';

const router = Router();

// All lead-related endpoints belong here. Add future lead routes beside this one.
router.post('/search', requireAuthenticatedUser, searchLeads);

export default router;
