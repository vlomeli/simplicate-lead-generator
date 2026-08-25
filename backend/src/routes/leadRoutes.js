import { Router } from 'express';

import { searchLeads } from '../controllers/leadController.js';

const router = Router();

// All lead-related endpoints belong here. Add future lead routes beside this one.
router.post('/search', searchLeads);

export default router;
