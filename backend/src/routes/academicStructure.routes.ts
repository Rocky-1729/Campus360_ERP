import { Router } from 'express';
import { academicStructureController } from '../controllers/academicStructure.controller';

const router = Router();

// Academic Structure Read Endpoints
router.get('/departments', academicStructureController.getDepartments);
router.get('/programs', academicStructureController.getPrograms);
router.get('/academic-batches', academicStructureController.getAcademicBatches);
router.get('/sections', academicStructureController.getSections);
router.get('/academic-sessions', academicStructureController.getAcademicSessions);
router.get('/semesters', academicStructureController.getSemesters);

export default router;
