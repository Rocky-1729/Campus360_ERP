import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import { uploadExcel } from '../middleware/upload';

const router = Router();

// Apply auth and admin-role checks to all routes
router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', adminController.getDashboard);

// Faculty management
router.post('/faculty', adminController.createFaculty);
router.put('/faculty/:id', adminController.updateFaculty);
router.patch('/faculty/:id/toggle', adminController.toggleFaculty);
router.get('/faculty', adminController.getAllFaculty);

// Student management
router.post('/students/upload', uploadExcel('file'), adminController.uploadStudents);
router.get('/students', adminController.getStudents);
router.get('/students/search/:hallTicket', adminController.searchStudent);

// Marks upload
router.post('/marks/upload', uploadExcel('file'), adminController.uploadMarks);

// Subject management
router.post('/subjects', adminController.createSubject);
router.get('/subjects', adminController.getSubjects);
router.put('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

// Assignments
router.post('/assignments', adminController.createAssignment);
router.get('/assignments', adminController.getAssignments);
router.delete('/assignments/:id', adminController.deleteAssignment);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Backup and Restore system
router.get('/backup', adminController.backupDb);
router.post('/restore', uploadExcel('file'), adminController.restoreDb);
router.get('/upload-history', adminController.getUploadHistory);
router.get('/audit-logs', adminController.getAuditLogs);

export default router;
