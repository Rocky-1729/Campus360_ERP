import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/ApiError';

/** Allowed MIME types for document/image uploads */
const DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/** Allowed MIME types for Excel file uploads */
const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];

/**
 * File filter for document/image uploads.
 */
const documentFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP, PDF.`
      )
    );
  }
};

/**
 * File filter for Excel uploads.
 */
const excelFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (EXCEL_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type: ${file.mimetype}. Only .xls and .xlsx files are allowed.`
      )
    );
  }
};

/** Multer instance for single document/image uploads (5 MB limit) */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: documentFilter,
});

/** Multer instance for Excel file uploads (10 MB limit) */
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: excelFilter,
});

/**
 * Middleware: accept a single file under the given field name (document/image).
 * @param fieldName - The form field name for the file
 */
export const uploadSingle = (fieldName: string = 'file') => {
  return documentUpload.single(fieldName);
};

/**
 * Middleware: accept a single Excel file under the given field name.
 * @param fieldName - The form field name for the file
 */
export const uploadExcel = (fieldName: string = 'file') => {
  return excelUpload.single(fieldName);
};
