import { Router } from 'express';
import { excelUploadController } from '../controllers/excelUpload.controller';
import { uploadExcel } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';

const router = Router();

// Apply authentication and admin role check to all Excel upload and import endpoints
router.use(authenticate);
router.use(authorize('admin'));

// Preview uploaded spreadsheet & stage in-memory with secure token
router.post('/preview', uploadExcel('file'), excelUploadController.previewUpload);

// Confirm and execute atomic transactional database import for staged token
router.post('/import', excelUploadController.confirmImport);

// Audit history of uploaded files
router.get('/history', excelUploadController.getUploadHistory);

export default router;

