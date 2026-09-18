import { Router } from 'express';
import { studentManagementController } from '../controllers/studentManagement.controller';
import { resultManagementController } from '../controllers/resultManagement.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Student Directory & Management Endpoints (PostgreSQL)
router.get('/', studentManagementController.getStudents);
router.get('/status/counts', studentManagementController.getDataStatus);
router.get('/:hallTicket/results', authenticate, resultManagementController.getStudentResults);
router.get('/:id', studentManagementController.getStudentById);

export default router;

