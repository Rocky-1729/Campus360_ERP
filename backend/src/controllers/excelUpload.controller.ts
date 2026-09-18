import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { query } from '../config/database';
import { detectExcelFileType } from '../services/excel/excelDetector';
import { StudentMasterParser } from '../services/excel/studentMasterParser';
import { ExaminationResultParser } from '../services/excel/examinationResultParser';
import { importStagingService } from '../services/excel/importStaging.service';
import { excelImportService } from '../services/excel/excelImport.service';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';

export const excelUploadController = {
  /**
   * Parses uploaded Excel file, performs structural & field validation,
   * stages verified payload in memory with a secure token, and returns a rich preview.
   */
  previewUpload: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file || !req.file.buffer) {
        throw ApiError.badRequest('FILE_REQUIRED: Please upload an Excel file (.xlsx or .xls)');
      }

      // Compute SHA-256 content hash
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

      // Read workbook from buffer
      let workbook: xlsx.WorkBook;
      try {
        workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      } catch (err) {
        throw ApiError.badRequest('INVALID_EXCEL: Unable to parse workbook file. Ensure it is a valid Excel spreadsheet.');
      }

      // Detect sheet type
      const detection = detectExcelFileType(workbook);

      if (detection.fileType === 'UNKNOWN') {
        throw ApiError.badRequest(
          `UNRECOGNIZED_FORMAT: Could not identify spreadsheet format. Reasons: ${detection.reasons.join(', ')}`
        );
      }

      const sheetName = detection.sheetName || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw ApiError.badRequest('EMPTY_SHEET: Primary worksheet in uploaded file is empty or missing.');
      }

      if (detection.fileType === 'STUDENT_MASTER') {
        let parseResult;
        try {
          parseResult = StudentMasterParser.parse(sheet);
        } catch (err: any) {
          throw ApiError.badRequest(err.message || 'Failed to parse student master spreadsheet.');
        }

        const token = importStagingService.stageStudentMaster(
          req.file.originalname,
          fileHash,
          parseResult
        );

        res.status(200).json(
          ApiResponse.success(
            {
              importToken: token,
              fileType: 'STUDENT_MASTER',
              fileName: req.file.originalname,
              fileHash,
              detection,
              metadata: parseResult.metadata,
              summary: parseResult.summary,
              preview: parseResult.preview,
              validationErrors: parseResult.validationErrors,
            },
            'Student master spreadsheet parsed and preview staged successfully'
          )
        );
        return;
      }

      if (detection.fileType === 'EXAMINATION_RESULT') {
        let parseResult;
        try {
          parseResult = ExaminationResultParser.parse(sheet);
        } catch (err: any) {
          throw ApiError.badRequest(err.message || 'Failed to parse examination results spreadsheet.');
        }

        // Cross-reference parsed students against PostgreSQL students table
        const hallTickets = parseResult.allStudentRows
          .map(r => (r.hallTicketNumber ? r.hallTicketNumber.trim().toUpperCase() : ''))
          .filter(Boolean);

        const existingStudents = new Set<string>();
        if (hallTickets.length > 0) {
          const studentQueryRes = await query<{ ht: string }>(
            'SELECT UPPER(hall_ticket_number) AS ht FROM students WHERE UPPER(hall_ticket_number) = ANY($1)',
            [hallTickets]
          );
          studentQueryRes.rows.forEach(r => existingStudents.add(r.ht));
        }

        const categorizedErrorSummary: Record<string, number> = {};
        const validationErrors: Array<{
          rowNumber: number;
          hallTicketNumber?: string;
          status: string;
          reason: string;
          errors: string[];
        }> = [];

        const verifiedValidResults: typeof parseResult.allStudentRows = [];

        for (const row of parseResult.allStudentRows) {
          const ht = row.hallTicketNumber ? row.hallTicketNumber.trim().toUpperCase() : '';
          const rowErrors = [...row.errors];

          if (!ht) {
            rowErrors.push('STUDENT_NOT_FOUND: Row missing Hall Ticket Number');
          } else if (!existingStudents.has(ht)) {
            rowErrors.push('STUDENT_NOT_FOUND: Student not found in PostgreSQL');
          }

          if (rowErrors.length > 0) {
            row.isValid = false;
            row.errors = rowErrors;

            for (const err of rowErrors) {
              const category = err.includes(':') ? err.split(':')[1].trim() : err.trim();
              categorizedErrorSummary[category] = (categorizedErrorSummary[category] || 0) + 1;
            }

            validationErrors.push({
              rowNumber: row.rowNumber,
              hallTicketNumber: row.hallTicketNumber || undefined,
              status: 'INVALID',
              reason: rowErrors.map(e => (e.includes(':') ? e.split(':')[1].trim() : e)).join('; '),
              errors: rowErrors,
            });
          } else {
            row.isValid = true;
            verifiedValidResults.push(row);
          }
        }

        // Update parseResult with DB-verified validity
        parseResult.summary.validStudents = verifiedValidResults.length;
        parseResult.summary.invalidStudents = parseResult.allStudentRows.length - verifiedValidResults.length;
        parseResult.summary.errorSummary = categorizedErrorSummary;
        parseResult.allValidResults = verifiedValidResults;
        parseResult.validationErrors = validationErrors;

        const token = importStagingService.stageExaminationResult(
          req.file.originalname,
          fileHash,
          parseResult
        );

        res.status(200).json(
          ApiResponse.success(
            {
              importToken: token,
              fileType: 'EXAMINATION_RESULT',
              fileName: req.file.originalname,
              fileHash,
              detection,
              metadata: parseResult.metadata,
              detectedSubjects: parseResult.detectedSubjects,
              summary: parseResult.summary,
              preview: parseResult.preview,
              validationErrors: parseResult.validationErrors,
            },
            'Examination results spreadsheet parsed and preview staged successfully'
          )
        );
        return;
      }

      throw ApiError.badRequest('UNSUPPORTED_IMPORT_TYPE: Format recognized but not supported for staging.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Confirms and executes atomic PostgreSQL transaction for a previously staged import token.
   */
  confirmImport: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, batchId, sectionId, examinationId } = req.body;

      if (!token || typeof token !== 'string') {
        throw ApiError.badRequest('TOKEN_REQUIRED: A valid staged importToken must be provided to confirm import.');
      }

      const staged = importStagingService.getStaged(token);
      if (!staged) {
        throw ApiError.badRequest(
          'IMPORT_TOKEN_EXPIRED: Staged import session expired or invalid. Please upload and preview the file again.'
        );
      }

      if (staged.fileType === 'STUDENT_MASTER') {
        const result = await excelImportService.importStudentMaster(token, {
          batchId: batchId ? Number(batchId) : undefined,
          sectionId: sectionId ? Number(sectionId) : undefined,
        });

        res.status(200).json(ApiResponse.success(result, 'Student master imported successfully into PostgreSQL'));
        return;
      }

      if (staged.fileType === 'EXAMINATION_RESULT') {
        if (!examinationId) {
          throw ApiError.badRequest(
            'EXAMINATION_ID_REQUIRED: An examinationId is required to import examination results into database.'
          );
        }

        const result = await excelImportService.importExaminationResults(token, {
          examinationId: Number(examinationId),
        });

        res.status(200).json(
          ApiResponse.success(result, 'Examination results imported successfully into PostgreSQL')
        );
        return;
      }

      throw ApiError.badRequest('UNRECOGNIZED_STAGED_TYPE: Unrecognized import type.');
    } catch (error) {
      next(error);
    }
  },

  /**
   * Fetches excel upload audit history records.
   */
  getUploadHistory: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const history = await excelImportService.getUploadHistory();
      res.status(200).json(ApiResponse.success(history, 'Upload audit history retrieved successfully'));
    } catch (error) {
      next(error);
    }
  },
};
