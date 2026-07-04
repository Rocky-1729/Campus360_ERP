import { Router } from 'express';
import * as facultyController from '../controllers/faculty.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';

const router = Router();

// Apply authentication to all routes, authorize faculty or admin roles
router.use(authenticate);
router.use(authorize('faculty', 'admin'));

router.get('/dashboard', facultyController.getDashboard);
router.get('/students', facultyController.getStudents);
router.get('/students/search/:hallTicket', facultyController.searchStudent);
router.get('/students/:hallTicket/profile', facultyController.getStudentProfile);

// Attendance marking
router.post('/attendance', facultyController.markAttendance);
router.put('/attendance/:id', facultyController.updateAttendance);
router.get('/attendance/marking', facultyController.getAttendanceForMarking);

// Certificates review
router.get('/certificates/pending', facultyController.getPendingCertificates);
router.patch('/certificates/:id', facultyController.reviewCertificate);

// Achievements review
router.get('/achievements/pending', facultyController.getPendingAchievements);
router.patch('/achievements/:id', facultyController.reviewAchievement);

// Analytics
router.get('/analytics', facultyController.getAnalytics);

export default router;
