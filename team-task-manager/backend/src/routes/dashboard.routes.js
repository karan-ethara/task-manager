import { Router } from 'express';
import { getDashboard, getOverdueTasks } from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);
router.get('/', getDashboard);
router.get('/overdue', getOverdueTasks);

export default router;
