import { Router } from 'express';
import { pgAnalyticsController } from '../controllers/pgAnalytics.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';

const router = Router();

// Apply authentication and restrict institutional analytics to Admin and Faculty
router.use(authenticate);
router.use(authorize('admin', 'faculty'));

// Real PostgreSQL Analytics Endpoints
router.get('/overview', pgAnalyticsController.getOverview);
router.get('/departments', pgAnalyticsController.getDepartments);
router.get('/examinations/:id/performance', pgAnalyticsController.getExaminationPerformance);

export default router;

