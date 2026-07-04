import { certificateRepository } from '../repositories/certificate.repository';
import { cloudinary } from '../config/cloudinary';
import * as db from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { ICertificate } from '../interfaces/db.interface';

/** Input for creating a certificate */
interface CreateCertificateInput {
  hallTicketNumber: string;
  type: string;
  title: string;
  issuingOrganization?: string;
  issueDate?: string;
}

/** Filter for pending certificates */
interface PendingFilter {
  hallTicketNumbers?: string[];
  type?: string;
}

/**
 * Upload a certificate file to Cloudinary and create a Certificate record.
 * @param data - Certificate metadata
 * @param file - Multer file buffer
 * @returns Created Certificate document
 */
export const createCertificate = async (
  data: CreateCertificateInput,
  file?: Express.Multer.File
): Promise<ICertificate> => {
  try {
    let certificateUrl = '';

    if (file) {
      // Upload to Cloudinary as a base64 data URI
      const base64 = file.buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64}`;

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'campus360/certificates',
        resource_type: 'auto',
      });

      certificateUrl = uploadResult.secure_url;
    }

    const certId = await certificateRepository.create({
      hallTicketNumber: data.hallTicketNumber.toUpperCase(),
      type: data.type,
      title: data.title,
      issuingOrganization: data.issuingOrganization || '',
      issueDate: data.issueDate || '',
      certificateUrl,
    });

    const certificate = await certificateRepository.findById(certId);
    return certificate!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Create certificate error:', error);
    throw ApiError.internal('An error occurred while creating certificate.');
  }
};

/**
 * Approve or reject a certificate.
 */
export const updateCertificateStatus = async (
  id: string,
  status: 'approved' | 'rejected',
  remarks: string,
  approvedBy: string
): Promise<ICertificate> => {
  try {
    const certificate = await certificateRepository.findById(Number(id));
    if (!certificate) {
      throw ApiError.notFound('Certificate not found.');
    }

    await certificateRepository.updateStatus(Number(id), status, remarks);
    const updated = await certificateRepository.findById(Number(id));
    return updated!;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Update certificate status error:', error);
    throw ApiError.internal('An error occurred while updating certificate.');
  }
};

/**
 * Get all certificates for a student.
 */
export const getCertificatesByHallTicket = async (
  hallTicket: string
): Promise<ICertificate[]> => {
  try {
    return certificateRepository.findByStudent(hallTicket);
  } catch (error) {
    logger.error('Get certificates error:', error);
    throw ApiError.internal('An error occurred while fetching certificates.');
  }
};

/**
 * Get pending certificates for review, optionally scoped to specific students.
 */
export const getPendingCertificates = async (
  filter: PendingFilter
): Promise<ICertificate[]> => {
  try {
    let sql = "SELECT * FROM certificates WHERE status = 'pending'";
    const params: any[] = [];

    if (filter.hallTicketNumbers && filter.hallTicketNumbers.length > 0) {
      const placeholders = filter.hallTicketNumbers.map(() => '?').join(',');
      sql += ` AND UPPER(hallTicketNumber) IN (${placeholders})`;
      filter.hallTicketNumbers.forEach((ht) => params.push(ht.toUpperCase()));
    }

    if (filter.type) {
      sql += ' AND type = ?';
      params.push(filter.type);
    }

    sql += ' ORDER BY createdAt DESC';
    return db.all<ICertificate>(sql, params);
  } catch (error) {
    logger.error('Get pending certificates error:', error);
    throw ApiError.internal('An error occurred while fetching pending certificates.');
  }
};
