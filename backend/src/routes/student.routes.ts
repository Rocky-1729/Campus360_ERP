import { Router } from 'express';
import * as studentController from '../controllers/student.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import { uploadSingle } from '../middleware/upload';

const router = Router();

// Apply auth and student role check to all student routes
router.use(authenticate);
router.use(authorize('student'));

router.get('/dashboard', studentController.getDashboard);
router.get('/profile', studentController.getProfile);
router.get('/marks', studentController.getMarks);
router.get('/attendance', studentController.getAttendance);

// Certificates
router.post('/certificates', uploadSingle('file'), studentController.uploadCertificate);
router.get('/certificates', studentController.getCertificates);

// Achievements
router.post('/achievements', uploadSingle('file'), studentController.uploadAchievement);
router.get('/achievements', studentController.getAchievements);

export default router;
