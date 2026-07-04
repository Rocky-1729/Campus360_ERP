import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';

const router = Router();

// Apply authentication to all notification routes
router.use(authenticate);

// Composing is admin/faculty only
router.post('/', authorize('admin', 'faculty'), notificationController.create);

// Viewing/reading is available for all roles
router.get('/', notificationController.getAll);
router.patch('/:id/read', notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);

export default router;
