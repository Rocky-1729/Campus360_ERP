import * as xlsx from 'xlsx';

export interface ParsedStudentRow {
  rowNumber: number;
  hallTicketNumber: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null; // ISO YYYY-MM-DD
  email: string | null;
  phoneNumber: string | null;
  isValid: boolean;
  errors: string[];
}

export interface StudentMasterParseResult {
  fileType: 'STUDENT_MASTER';
  metadata: {
    course?: string;
    branch?: string;
    semester?: string;
    batch?: string;
    section?: string;
  };
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  };
  preview: Array<{
    rowNumber: number;
    hallTicketNumber: string;
    fullName: string;
    gender: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phoneNumber: string | null;
  }>;
  validationErrors: Array<{
    rowNumber: number;
    hallTicketNumber?: string;
    errors: string[];
  }>;
  allValidStudents: ParsedStudentRow[];
}

/** Helper to parse date from Excel serial or string format */
const parseExcelDate = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null;

  // Excel serial number
  if (typeof val === 'number') {
    const d = xlsx.SSF.parse_date_code(val);
    if (d) {
      const year = d.y;
      const month = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Standard Date parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
};

export class StudentMasterParser {
  public static parse(sheet: xlsx.WorkSheet): StudentMasterParseResult {
    const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawRows.length === 0) {
      throw new Error('HEADER_NOT_FOUND: The uploaded sheet contains no data.');
    }

    // 1. Extract metadata from top rows before the header row
    const metadata: StudentMasterParseResult['metadata'] = {};
    let headerRowIndex = -1;

    for (let r = 0; r < Math.min(15, rawRows.length); r++) {
      const row = rawRows[r];
      const rowStr = row.map(c => String(c).trim()).join(' ');

      // Metadata extraction
      const courseMatch = rowStr.match(/Course\s*[:=-]\s*([A-Za-z0-9.]+)/i);
      if (courseMatch && !metadata.course) metadata.course = courseMatch[1].trim();

      const branchMatch = rowStr.match(/Branch\s*[:=-]\s*([A-Za-z0-9. ]+)/i);
      if (branchMatch && !metadata.branch) metadata.branch = branchMatch[1].trim();

      const batchMatch = rowStr.match(/Batch\s*[:=-]\s*([0-9]{4}[-–][0-9]{4})/i);
      if (batchMatch && !metadata.batch) metadata.batch = batchMatch[1].trim();

      const semMatch = rowStr.match(/Semester\s*[:=-]\s*([0-9A-Za-z -]+)/i);
      if (semMatch && !metadata.semester) metadata.semester = semMatch[1].trim();

      const secMatch = rowStr.match(/Section\s*[:=-]\s*([A-Za-z0-9]+)/i);
      if (secMatch && !metadata.section) metadata.section = secMatch[1].trim();

      // Check if this row is the column headers
      const upperRow = row.map(c => String(c).trim().toUpperCase());
      const hasHT = upperRow.some(c =>
        c === 'HTNO' || c === 'HT NO' || c.includes('HALL TICKET') || c === 'ROLL NO' || c === 'ROLLNO'
      );
      const hasName = upperRow.some(c =>
        c === 'NAME' || c === 'FULL NAME' || c === 'STUDENT NAME' || c.includes('NAME OF')
      );

      if (hasHT && hasName) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('HEADER_NOT_FOUND: Could not locate student header columns (HTNo, Full Name).');
    }

    // 2. Identify column indexes
    const headers = rawRows[headerRowIndex].map(c => String(c).trim().toUpperCase());
    let htCol = -1;
    let nameCol = -1;
    let genderCol = -1;
    let dobCol = -1;
    let mobileCol = -1;
    let emailCol = -1;

    headers.forEach((h, idx) => {
      if (htCol === -1 && (h === 'HTNO' || h === 'HT NO' || h.includes('HALL TICKET') || h === 'ROLL NO' || h === 'ROLLNO')) {
        htCol = idx;
      } else if (nameCol === -1 && (h === 'NAME' || h === 'FULL NAME' || h === 'STUDENT NAME' || h.includes('NAME OF THE STUDENT'))) {
        nameCol = idx;
      } else if (genderCol === -1 && (h === 'GENDER' || h === 'SEX')) {
        genderCol = idx;
      } else if (dobCol === -1 && (h === 'DOB' || h === 'DATE OF BIRTH' || h.includes('BIRTH'))) {
        dobCol = idx;
      } else if (mobileCol === -1 && (h === 'STUDENT MOBILE' || h === 'MOBILE' || h === 'PHONE' || h === 'PHONE NUMBER' || h === 'MOBILE NO')) {
        mobileCol = idx;
      } else if (emailCol === -1 && (h === 'EMAIL' || h === 'EMAIL ID' || h === 'STUDENT EMAIL')) {
        emailCol = idx;
      }
    });

    if (htCol === -1 || nameCol === -1) {
      throw new Error('HEADER_NOT_FOUND: Required columns (Hall Ticket Number, Full Name) are missing from header.');
    }

    // 3. Process each student row
    const seenHT = new Set<string>();
    const duplicateHT = new Set<string>();
    const parsedStudents: ParsedStudentRow[] = [];
    const validationErrors: StudentMasterParseResult['validationErrors'] = [];

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      // Skip completely blank rows
      if (!row || row.every(c => String(c).trim() === '')) {
        continue;
      }

      const rowNumber = r + 1;
      const rawHT = String(row[htCol] || '').trim().toUpperCase();
      const rawName = String(row[nameCol] || '').trim();
      const rawGender = genderCol !== -1 ? String(row[genderCol] || '').trim().toUpperCase() : null;
      const rawDOB = dobCol !== -1 ? row[dobCol] : null;
      const rawMobile = mobileCol !== -1 ? String(row[mobileCol] || '').trim() : null;
      const rawEmail = emailCol !== -1 ? String(row[emailCol] || '').trim().toLowerCase() : null;

      const errors: string[] = [];

      // Validate Hall Ticket
      if (!rawHT) {
        errors.push('HALL_TICKET_NOT_FOUND: Hall ticket number is required');
      } else {
        if (seenHT.has(rawHT)) {
          duplicateHT.add(rawHT);
          errors.push(`DUPLICATE_HALL_TICKET: Hall ticket "${rawHT}" appears multiple times in Excel`);
        } else {
          seenHT.add(rawHT);
        }
      }

      // Validate Name
      if (!rawName) {
        errors.push('NAME_NOT_FOUND: Student name is required');
      }

      // Validate Email (if provided)
      let parsedEmail: string | null = null;
      if (rawEmail) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          parsedEmail = rawEmail;
        } else {
          errors.push(`INVALID_EMAIL: Email "${rawEmail}" is not in valid format`);
        }
      }

      // Validate Date of Birth (if provided)
      let parsedDOB: string | null = null;
      if (rawDOB) {
        parsedDOB = parseExcelDate(rawDOB);
        if (!parsedDOB) {
          errors.push(`INVALID_DATE: Date of birth "${rawDOB}" could not be parsed`);
        }
      }

      // Gender normalization
      let parsedGender: string | null = null;
      if (rawGender) {
        if (rawGender.startsWith('M')) parsedGender = 'Male';
        else if (rawGender.startsWith('F')) parsedGender = 'Female';
        else parsedGender = 'Other';
      }

      const isValid = errors.length === 0;

      const studentRow: ParsedStudentRow = {
        rowNumber,
        hallTicketNumber: rawHT,
        fullName: rawName,
        gender: parsedGender,
        dateOfBirth: parsedDOB,
        email: parsedEmail,
        phoneNumber: rawMobile || null,
        isValid,
        errors,
      };

      parsedStudents.push(studentRow);

      if (!isValid) {
        validationErrors.push({
          rowNumber,
          hallTicketNumber: rawHT || undefined,
          errors,
        });
      }
    }

    const totalRows = parsedStudents.length;
    const validRows = parsedStudents.filter(s => s.isValid).length;
    const invalidRows = parsedStudents.filter(s => !s.isValid).length;
    const duplicateRows = duplicateHT.size;

    const preview = parsedStudents.slice(0, 15).map(s => ({
      rowNumber: s.rowNumber,
      hallTicketNumber: s.hallTicketNumber,
      fullName: s.fullName,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth,
      email: s.email,
      phoneNumber: s.phoneNumber,
    }));

    return {
      fileType: 'STUDENT_MASTER',
      metadata,
      summary: {
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
      },
      preview,
      validationErrors,
      allValidStudents: parsedStudents.filter(s => s.isValid),
    };
  }
}
