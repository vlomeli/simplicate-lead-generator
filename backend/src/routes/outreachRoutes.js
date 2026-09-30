import { Router } from 'express';

import {
  createOutreachJob,
  downloadOutreachCsv,
  listRecentOutreachJobs,
  readOutreachJob,
} from '../controllers/outreachController.js';
import { requireAuthenticatedUser } from '../middleware/authenticate.js';
import { perUserSearchRateLimit } from '../middleware/searchRateLimit.js';

const router = Router();

router.post('/jobs', requireAuthenticatedUser, perUserSearchRateLimit, createOutreachJob);
router.get('/jobs', requireAuthenticatedUser, listRecentOutreachJobs);
router.get('/jobs/:jobId', requireAuthenticatedUser, readOutreachJob);
router.get('/jobs/:jobId/export', requireAuthenticatedUser, downloadOutreachCsv);

export default router;
