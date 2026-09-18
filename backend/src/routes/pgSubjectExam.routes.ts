import { Router } from 'express';
import { pgSubjectExamController } from '../controllers/pgSubjectExam.controller';
import { resultManagementController } from '../controllers/resultManagement.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';

const router = Router();

// Read APIs for Subjects, Curriculum Subjects, and Examinations
router.get('/subjects', pgSubjectExamController.getSubjects);
router.get('/curriculum-subjects', pgSubjectExamController.getCurriculumSubjects);
router.get('/examinations', pgSubjectExamController.getExaminations);
router.get('/examinations/:examinationId/results', resultManagementController.getExaminationResults);
router.get('/exam-structure/counts', pgSubjectExamController.getTableCounts);

// Examination Management - Strictly ADMIN only
router.post('/examinations', authenticate, authorize('admin'), pgSubjectExamController.createExamination);

export default router;
