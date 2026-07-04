import * as XLSX from 'xlsx';
import { studentRepository } from '../repositories/student.repository';
import { userRepository } from '../repositories/user.repository';
import { marksRepository } from '../repositories/marks.repository';
import { subjectRepository } from '../repositories/subject.repository';
import { uploadRepository } from '../repositories/upload.repository';
import { flushAnalyticsCache } from './analytics.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { StudentExcelRow, MarksExcelRow, InvalidRow, ImportSummary } from '../interfaces/excel.interface';
import bcrypt from 'bcryptjs';

/**
 * Parse an Excel buffer for student data.
 * @param buffer - Buffer from the uploaded Excel file
 * @returns Object containing valid student rows and invalid row details
 */
export const parseStudentExcel = (
  buffer: Buffer
): { valid: StudentExcelRow[]; invalid: InvalidRow[] } => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw ApiError.badRequest('Excel file has no sheets.');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });

    // Find the header row (contains HTNo, HT No, or Hall Ticket Number)
    let headerIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r] || [];
      if (row.some(cell => {
        const str = String(cell).trim().toUpperCase();
        return str === 'HTNO' || str === 'HT NO' || str === 'HALL TICKET NUMBER';
      })) {
        headerIdx = r;
        break;
      }
    }

    if (headerIdx === -1) {
      throw ApiError.badRequest('Could not find student "HTNo" or "HT No" column header in Excel sheet.');
    }

    const headers = rawRows[headerIdx].map((h: any) => String(h).trim().toUpperCase());
    
    // Helper to find column index matching header options
    const findColIndex = (names: string[]) => {
      return headers.findIndex(h => names.includes(h));
    };

    const htCol = findColIndex(['HTNO', 'HT No', 'HALL TICKET NUMBER', 'HALLTICKETNUMBER']);
    const nameCol = findColIndex(['FULL NAME', 'STUDENT NAME', 'NAME', 'FULLNAME']);
    const fatherCol = findColIndex(['FATHER NAME', 'FATHERNAME']);
    const motherCol = findColIndex(['MOTHER NAME', 'MOTHERNAME']);
    const emailCol = findColIndex(['EMAIL', 'EMAIL ID']);
    const studMobileCol = findColIndex(['STUDENT MOBILE', 'STUDENTMOBILE']);
    const parentMobileCol = findColIndex(['PARENT MOBILE', 'PARENTMOBILE', 'MOBILE', 'PHONE']);
    const dobCol = findColIndex(['DOB', 'DATE OF BIRTH', 'DOB (DD-MM-YYYY)']);
    const genderCol = findColIndex(['GENDER', 'GENDER (0-FOR MALE, 1-FOR FEMALE)', 'GENDER (0-FOR M', 'GENDER (0-FORM']);
    const aadhaarCol = findColIndex(['AADHAARNO', 'AADHAAR NUMBER', 'AADHARNO', 'AADHAAR', 'AADHAR']);
    const abcCol = findColIndex(['ABCID', 'ABC ID', 'ABC ID NUMBER']);
    const complCol = findColIndex(['YEAROF COMPLETION', 'YEAR OF COMPLETION', 'YEAROF COMPLETI']);
    const admnDtCol = findColIndex(['ADMN DT', 'ADMISSION DATE']);
    const sectionCol = findColIndex(['SECTION']);
    const deptCol = findColIndex(['DEPARTMENT', 'BRANCH']);

    const valid: StudentExcelRow[] = [];
    const invalid: InvalidRow[] = [];

    logger.info(`Excel Student Import - Header Row index: ${headerIdx}, Rows to process: ${rawRows.length - headerIdx - 1}`);

    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const errors: string[] = [];
      const rowNum = r + 1;

      const hallTicket = htCol !== -1 ? String(row[htCol] || '').trim() : '';
      const name = nameCol !== -1 ? String(row[nameCol] || '').trim() : '';

      // Skip empty row placeholders
      if (!hallTicket && !name) continue;

      if (!hallTicket) errors.push('Hall Ticket Number is required');
      if (!name) errors.push('Student Name is required');

      if (errors.length > 0) {
        invalid.push({ row: rowNum, errors });
      } else {
        // Parse Gender
        const genderRaw = genderCol !== -1 ? String(row[genderCol] || '').trim() : '';
        let gender: 'Male' | 'Female' | 'Other' = 'Male';
        if (genderRaw === '1' || genderRaw.toLowerCase().startsWith('f')) {
          gender = 'Female';
        } else if (genderRaw === '0' || genderRaw.toLowerCase().startsWith('m')) {
          gender = 'Male';
        }

        // Parse Completion Year
        const completionYear = complCol !== -1 ? Number(row[complCol] || 0) : 0;
        let admissionYear = 2023;
        if (completionYear > 2000) {
          admissionYear = completionYear - 4;
        } else {
          const admnDt = admnDtCol !== -1 ? String(row[admnDtCol] || '') : '';
          const match = admnDt.match(/\d{4}/);
          if (match) {
            admissionYear = Number(match[0]);
          } else {
            const parts = admnDt.split(/[\/\-]/);
            if (parts.length === 3) {
              const yr = Number(parts[2]);
              if (yr > 2000) admissionYear = yr;
            }
          }
        }

        const currentYear = new Date().getFullYear() - admissionYear + 1;
        const year = Math.max(1, Math.min(4, currentYear));

        const email = emailCol !== -1 ? String(row[emailCol] || '').trim().toLowerCase() : '';
        const mobile = studMobileCol !== -1 && row[studMobileCol]
          ? String(row[studMobileCol]).trim()
          : (parentMobileCol !== -1 ? String(row[parentMobileCol] || '').trim() : '');

        valid.push({
          hallTicketNumber: hallTicket.toUpperCase(),
          name,
          fatherName: fatherCol !== -1 ? String(row[fatherCol] || '').trim() : '',
          motherName: motherCol !== -1 ? String(row[motherCol] || '').trim() : '',
          email: email || `${hallTicket.toLowerCase()}@campus360.edu`,
          mobile,
          dateOfBirth: dobCol !== -1 ? String(row[dobCol] || '').trim() : '',
          gender,
          aadhaarNumber: aadhaarCol !== -1 ? String(row[aadhaarCol] || '').trim() : '',
          abcId: abcCol !== -1 ? String(row[abcCol] || '').trim() : '',
          department: deptCol !== -1 && row[deptCol] ? String(row[deptCol]).trim() : 'CSE',
          year,
          section: sectionCol !== -1 && row[sectionCol] ? String(row[sectionCol]).trim().toUpperCase() : 'A',
        });
      }
    }

    return { valid, invalid };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Parse student Excel error:', error);
    throw ApiError.badRequest('Failed to parse Excel file. Ensure the format is correct.');
  }
};

/**
 * Import student rows into SQLite.
 * Logs spreadsheet upload metadata and clears analytics cache.
 */
export const importStudents = async (
  validRows: StudentExcelRow[],
  fileName: string,
  uploadedByUserId: number
): Promise<ImportSummary> => {
  const summary: ImportSummary = {
    total: validRows.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const row of validRows) {
    try {
      const username = row.hallTicketNumber.toLowerCase();
      
      // Resolve email uniqueness / placeholder dummy values
      let email = (row.email || '').trim().toLowerCase();
      const isDummy = !email || email === '1234567890@gmail.com' || email.includes('notavailable') || email.includes('noemail');
      
      let emailExists = false;
      if (!isDummy) {
        const existingUser = await userRepository.findByUsernameOrEmail(email);
        if (existingUser && existingUser.username !== username) {
          emailExists = true;
        }
      }

      if (isDummy || emailExists) {
        email = `${username}@campus360.edu`;
      }

      const existingStudent = await studentRepository.findByHallTicket(row.hallTicketNumber);

      if (existingStudent) {
        // Update existing student
        await studentRepository.update(row.hallTicketNumber, {
          name: row.name,
          fatherName: row.fatherName,
          motherName: row.motherName,
          email,
          mobile: row.mobile,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          aadhaarNumber: row.aadhaarNumber,
          abcId: row.abcId,
          department: row.department,
          year: row.year,
          section: row.section,
        });
        summary.updated++;
      } else {
        // Create user credential with username = HTNo and password = HTNo
        const passwordRaw = row.hallTicketNumber; // Default password is the hallTicketNumber itself!
        
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(passwordRaw, salt);

        let user = await userRepository.findByUsernameOrEmail(username);
        let userId: number;
        if (!user) {
          userId = await userRepository.create({
            username,
            email,
            password,
            role: 'student',
          });
        } else {
          userId = user.id!;
          // update user's email if it matches our resolved unique email
          await userRepository.update(userId, { email });
        }

        // Create student profile
        await studentRepository.create({
          userId,
          hallTicketNumber: row.hallTicketNumber,
          name: row.name,
          fatherName: row.fatherName,
          motherName: row.motherName,
          email,
          mobile: row.mobile,
          dateOfBirth: row.dateOfBirth,
          gender: row.gender,
          aadhaarNumber: row.aadhaarNumber,
          abcId: row.abcId,
          department: row.department,
          year: row.year,
          section: row.section,
        });
        summary.created++;
      }
    } catch (error) {
      summary.failed++;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      summary.errors.push({
        hallTicketNumber: row.hallTicketNumber,
        message: msg,
      });
      logger.error(`Import student ${row.hallTicketNumber} failed: ${msg}`);
    }
  }

  // Write Upload History Log
  await uploadRepository.logUpload({
    uploadedBy: uploadedByUserId,
    fileName,
    recordsImported: summary.created + summary.updated,
    status: summary.failed > 0 ? 'Partial Success' : 'Success',
  });

  // Clear dashboard cache
  await flushAnalyticsCache();

  return summary;
};

/**
 * Parse an Excel buffer for matrix-based university marks data.
 */
export const parseMarksExcel = (
  buffer: Buffer,
  userSemester?: string
): { valid: MarksExcelRow[]; invalid: InvalidRow[] } => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw ApiError.badRequest('Excel file has no sheets.');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: '',
    });

    const valid: MarksExcelRow[] = [];
    const invalid: InvalidRow[] = [];

    // 1. Auto-detect Semester from headers (rows index 0 to 4)
    let semester = userSemester || '1-1';
    if (!userSemester) {
      let titleStr = '';
      for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
        const rowText = rawRows[r].join(' ');
        if (rowText.includes('Exam :') || rowText.includes('EXAM :')) {
          titleStr = rowText;
          break;
        }
      }

      if (titleStr) {
        const normalizedTitle = titleStr.toUpperCase();
        if (normalizedTitle.includes('I B.TECH') && normalizedTitle.includes('I SEM')) semester = '1-1';
        else if (normalizedTitle.includes('I B.TECH') && normalizedTitle.includes('II SEM')) semester = '1-2';
        else if (normalizedTitle.includes('II B.TECH') && normalizedTitle.includes('I SEM')) semester = '2-1';
        else if (normalizedTitle.includes('II B.TECH') && normalizedTitle.includes('II SEM')) semester = '2-2';
        else if (normalizedTitle.includes('III B.TECH') && normalizedTitle.includes('I SEM')) semester = '3-1';
        else if (normalizedTitle.includes('III B.TECH') && normalizedTitle.includes('II SEM')) semester = '3-2';
        else if (normalizedTitle.includes('IV B.TECH') && normalizedTitle.includes('I SEM')) semester = '4-1';
        else if (normalizedTitle.includes('IV B.TECH') && normalizedTitle.includes('II SEM')) semester = '4-2';
      }
    }

    // 2. Find header rows containing "HT No" or "HTNo"
    let htRowIdx = -1;
    let subHeaderRowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r] || [];
      if (row.some(cell => String(cell).trim().toUpperCase() === 'HT NO' || String(cell).trim().toUpperCase() === 'HTNO')) {
        htRowIdx = r;
        subHeaderRowIdx = r + 1;
        break;
      }
    }

    if (htRowIdx === -1) {
      throw ApiError.badRequest('Could not find "HT No" column header in Excel sheet.');
    }

    const htRow = rawRows[htRowIdx];
    const subRow = rawRows[subHeaderRowIdx] || [];

    // 3. Map out Subject column indices
    interface SubjectColMapping {
      subjectCode: string;
      intCol: number;
      extCol: number;
      totCol: number;
      grCol: number;
    }

    const subjectMappings: SubjectColMapping[] = [];
    let currentSubject = '';

    // Summary statistics columns
    let totCol = -1;
    let percCol = -1;
    let sgpaCol = -1;
    let cgpaCol = -1;
    let crsCol = -1;
    let resCol = -1;

    for (let col = 1; col < htRow.length; col++) {
      const cellVal = String(htRow[col] || '').trim();
      const subVal = String(subRow[col] || '').trim().toUpperCase();

      if (cellVal) {
        const cellUpper = cellVal.toUpperCase();
        if (cellUpper === 'TOT' || cellUpper === 'TOTAL') {
          totCol = col;
          currentSubject = '';
          continue;
        }
        if (cellUpper === 'PERC' || cellUpper === 'PERCENTAGE') {
          percCol = col;
          currentSubject = '';
          continue;
        }
        if (cellUpper === 'SGPA') {
          sgpaCol = col;
          currentSubject = '';
          continue;
        }
        if (cellUpper === 'CGPA') {
          cgpaCol = col;
          currentSubject = '';
          continue;
        }
        if (cellUpper === 'CRS' || cellUpper === 'CREDITS') {
          crsCol = col;
          currentSubject = '';
          continue;
        }
        if (cellUpper === 'RES' || cellUpper === 'RESULT') {
          resCol = col;
          currentSubject = '';
          continue;
        }

        currentSubject = cellVal;
      }

      if (currentSubject) {
        let mapping = subjectMappings.find(m => m.subjectCode === currentSubject);
        if (!mapping) {
          mapping = { subjectCode: currentSubject, intCol: -1, extCol: -1, totCol: -1, grCol: -1 };
          subjectMappings.push(mapping);
        }

        if (subVal === 'INT') mapping.intCol = col;
        else if (subVal === 'EXT') mapping.extCol = col;
        else if (subVal === 'TOT') mapping.totCol = col;
        else if (subVal === 'GR' || subVal === 'GRADE') mapping.grCol = col;
      }
    }

    // 4. Parse Student rows
    for (let r = subHeaderRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const htNo = String(row[0] || '').trim();
      if (!htNo || htNo.toUpperCase() === 'HT NO' || htNo.toUpperCase() === 'HTNO' || htNo.startsWith('SIDDHARTHA')) {
        continue;
      }

      const sgpaVal = sgpaCol !== -1 ? Number(row[sgpaCol] || 0) : 0;
      const cgpaVal = cgpaCol !== -1 ? Number(row[cgpaCol] || 0) : 0;
      const resultVal = resCol !== -1 ? String(row[resCol] || '').trim() : '';

      subjectMappings.forEach(sub => {
        const intMarks = sub.intCol !== -1 ? String(row[sub.intCol]) : '';
        const extMarks = sub.extCol !== -1 ? String(row[sub.extCol]) : '';
        const totMarks = sub.totCol !== -1 ? String(row[sub.totCol]) : '';
        const gr = sub.grCol !== -1 ? String(row[sub.grCol]) : '';

        if (!totMarks && !gr) return;

        const parseMarksVal = (val: string) => {
          const clean = val.trim();
          if (clean.toLowerCase().includes('ab') || clean === '' || clean.toLowerCase().includes('f(ab)')) return 0;
          return Number(clean) || 0;
        };

        const parsedInt = parseMarksVal(intMarks);
        const parsedExt = parseMarksVal(extMarks);
        const parsedTot = parseMarksVal(totMarks);

        let resStr = 'Pass';
        if (gr.trim().toUpperCase() === 'F' || resultVal.toUpperCase() === 'F' || gr.trim().toUpperCase().includes('F')) {
          resStr = 'Fail';
        }

        valid.push({
          hallTicketNumber: htNo.toUpperCase(),
          subjectCode: sub.subjectCode.toUpperCase(),
          subjectName: sub.subjectCode,
          internalMarks: parsedInt,
          externalMarks: parsedExt,
          totalMarks: parsedTot,
          grade: gr || 'F',
          credits: 4,
          sgpa: sgpaVal,
          cgpa: cgpaVal,
          result: resStr,
          semester,
        });
      });
    }

    return { valid, invalid };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error('Parse marks Excel error:', error);
    throw ApiError.badRequest('Failed to parse marks Excel file.');
  }
};

/**
 * Import marks rows into SQLite.
 * Logs spreadsheet upload metadata and clears analytics cache.
 */
export const importMarks = async (
  validRows: MarksExcelRow[],
  academicYear: string,
  fileName: string,
  uploadedByUserId: number
): Promise<ImportSummary> => {
  const summary: ImportSummary = {
    total: validRows.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  const detectedSemester = validRows.length > 0 ? validRows[0].semester : '';

  for (const row of validRows) {
    try {
      // 1. Verify student profile exists in database
      const student = await studentRepository.findByHallTicket(row.hallTicketNumber);
      if (!student) {
        throw new Error(`Student roster profile not found in database. Please upload this student first.`);
      }

      // 2. Verify subject exists; if not, register it automatically on the fly
      const subject = await subjectRepository.findByCode(row.subjectCode);
      if (!subject) {
        await subjectRepository.create({
          subjectCode: row.subjectCode,
          subjectName: row.subjectName,
          semester: row.semester,
          credits: row.credits || 4,
          isActive: 1,
          department: 'CSE'
        });
      }

      await marksRepository.upsert({
        hallTicketNumber: row.hallTicketNumber,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        internalMarks: row.internalMarks,
        externalMarks: row.externalMarks,
        totalMarks: row.totalMarks,
        grade: row.grade,
        credits: row.credits,
        sgpa: row.sgpa,
        cgpa: row.cgpa,
        result: row.result,
        semester: row.semester,
        academicYear,
      });
      summary.created++;
    } catch (error) {
      summary.failed++;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      summary.errors.push({
        hallTicketNumber: row.hallTicketNumber,
        message: `${row.subjectCode}: ${msg}`,
      });
    }
  }

  // Log Upload History
  await uploadRepository.logUpload({
    uploadedBy: uploadedByUserId,
    fileName,
    semester: detectedSemester,
    year: academicYear,
    recordsImported: summary.created,
    status: summary.failed > 0 ? 'Partial Success' : 'Success',
  });

  // Clear cache
  await flushAnalyticsCache();

  return summary;
};
