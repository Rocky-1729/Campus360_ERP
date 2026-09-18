import * as xlsx from 'xlsx';

export interface DetectedSubjectColumn {
  subjectCode: string;
  subjectName?: string;
  intCol: number;
  extCol: number;
  totCol: number;
  gradeCol: number;
}

export interface ParsedSubjectScore {
  subjectCode: string;
  internalMarks: number | null;
  externalMarks: number | null;
  totalMarks: number | null;
  grade: string | null;
  resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'WITHHELD';
}

export interface ParsedStudentResultRow {
  rowNumber: number;
  hallTicketNumber: string;
  subjects: ParsedSubjectScore[];
  semesterSummary: {
    sgpa: number | null;
    cgpa: number | null;
    totalCredits: number | null;
    earnedCredits: number | null;
    overallResult: 'PASS' | 'FAIL' | 'PROMOTED' | 'WITHHELD' | null;
  };
  isValid: boolean;
  errors: string[];
}

export interface ExaminationResultParseResult {
  fileType: 'EXAMINATION_RESULT';
  metadata: {
    examinationName?: string;
    academicSession?: string;
    semester?: string;
    semesterNumber?: number;
    examType?: 'REGULAR' | 'SUPPLEMENTARY';
    branch?: string;
    regulation?: string;
  };
  detectedSubjects: Array<{
    subjectCode: string;
    subjectName?: string;
    hasInternal: boolean;
    hasExternal: boolean;
    hasTotal: boolean;
    hasGrade: boolean;
  }>;
  summary: {
    totalStudents: number;
    validStudents: number;
    invalidStudents: number;
    totalSubjectScores: number;
    errorSummary?: Record<string, number>;
  };
  preview: Array<{
    rowNumber: number;
    hallTicketNumber: string;
    subjectCount: number;
    sampleScores: ParsedSubjectScore[];
    sgpa: number | null;
    cgpa: number | null;
    overallResult: string | null;
  }>;
  validationErrors: Array<{
    rowNumber: number;
    hallTicketNumber?: string;
    status?: string;
    reason?: string;
    errors: string[];
  }>;
  allValidResults: ParsedStudentResultRow[];
  allStudentRows: ParsedStudentResultRow[];
}

// Helpers for robust cell value normalization
function isNotApplicable(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  return s === 'NA' || s === 'N/A' || s === '-' || s === '--' || s === 'NIL' || s === 'NONE' || s === 'NULL';
}

function isAbsentMark(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  return s === 'AB' || s === 'ABS' || s === 'ABSENT' || s === 'A' || s === 'AB.' || s === 'A.';
}

function isAbsentGrade(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toUpperCase();
  return s === 'AB' || s === 'ABS' || s === 'ABSENT' || s === 'F(AB)' || s === 'F (AB)';
}

/**
 * Normalizes an arbitrary semester string representation (Roman, digit, hyphenated)
 * to an integer between 1 and 8.
 */
export function parseSemesterNumber(val?: string | null): number | null {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim().toUpperCase();

  const yearSemMatch = s.match(/(?:(?:YEAR|B\.?TECH)\s*)?(IV|III|II|I|[1-4])\s*(?:YEAR|B\.?TECH)?\s*[-/–\s]\s*(?:YEAR|B\.?TECH|SEM|SEMESTER)?\s*(II|I|[1-2])\b/i);
  if (yearSemMatch) {
    const yStr = yearSemMatch[1].toUpperCase();
    const semStr = yearSemMatch[2].toUpperCase();
    let y = 1;
    if (yStr === 'IV' || yStr === '4') y = 4;
    else if (yStr === 'III' || yStr === '3') y = 3;
    else if (yStr === 'II' || yStr === '2') y = 2;
    else if (yStr === 'I' || yStr === '1') y = 1;

    let sem = 1;
    if (semStr === 'II' || semStr === '2') sem = 2;
    else if (semStr === 'I' || semStr === '1') sem = 1;

    return (y - 1) * 2 + sem;
  }

  const singleSemMatch = s.match(/(?:SEM|SEMESTER)\s*[-:]?\s*(VIII|VII|VI|V|IV|III|II|I|[1-8])\b/i) ||
                         s.match(/\b(VIII|VII|VI|V|IV|III|II|I|[1-8])\s*(?:ST|ND|RD|TH)?\s*(?:SEM|SEMESTER)\b/i);
  if (singleSemMatch) {
    const raw = singleSemMatch[1].toUpperCase();
    const map: Record<string, number> = {
      'I': 1, '1': 1,
      'II': 2, '2': 2,
      'III': 3, '3': 3,
      'IV': 4, '4': 4,
      'V': 5, '5': 5,
      'VI': 6, '6': 6,
      'VII': 7, '7': 7,
      'VIII': 8, '8': 8,
    };
    if (map[raw]) return map[raw];
  }

  const digitMatch = s.match(/^[1-8]$/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  return null;
}

export class ExaminationResultParser {
  public static parse(sheet: xlsx.WorkSheet): ExaminationResultParseResult {
    const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawRows.length === 0) {
      throw new Error('HEADER_NOT_FOUND: The uploaded sheet contains no data.');
    }

    // 1. Extract metadata from top rows
    const metadata: ExaminationResultParseResult['metadata'] = {};
    let headerRowIndex = -1;
    let subHeaderRowIndex = -1;

    for (let r = 0; r < Math.min(15, rawRows.length); r++) {
      const row = rawRows[r];
      const rowStr = row.map(c => String(c).trim()).join(' ');

      if (!metadata.examinationName && (rowStr.includes('EXAMINATIONS') || rowStr.includes('EXAMINATION') || rowStr.includes('RESULTS'))) {
        metadata.examinationName = rowStr.replace(/\s+/g, ' ').trim();
      }

      if (!metadata.examType) {
        if (rowStr.match(/\b(SUPPLEMENTARY|SUPPLE|BACKLOG|SUPPL)\b/i)) {
          metadata.examType = 'SUPPLEMENTARY';
        } else if (rowStr.match(/\b(REGULAR)\b/i)) {
          metadata.examType = 'REGULAR';
        }
      }

      const sessionMatch = rowStr.match(/(20\d{2}[-–]20\d{2}|\b20\d{2}\b)/);
      if (sessionMatch && !metadata.academicSession) metadata.academicSession = sessionMatch[1];

      const semMatch = rowStr.match(/(?:(?:YEAR|B\.?TECH)\s*)?(IV|III|II|I|[1-4])\s*(?:YEAR|B\.?TECH)?\s*[-/–\s]\s*(?:YEAR|B\.?TECH|SEM|SEMESTER)?\s*(II|I|[1-2])\b/i) ||
                       rowStr.match(/(?:SEM|SEMESTER)\s*[-:]?\s*(VIII|VII|VI|V|IV|III|II|I|[1-8])\b/i) ||
                       rowStr.match(/\b(VIII|VII|VI|V|IV|III|II|I)\s*(?:ST|ND|RD|TH)?\s*(?:SEM|SEMESTER)\b/i) ||
                       rowStr.match(/\b[1-4][-][1-2]\b/i);
      if (semMatch && !metadata.semester) {
        metadata.semester = semMatch[0].trim();
        const num = parseSemesterNumber(metadata.semester);
        if (num) metadata.semesterNumber = num;
      }

      const branchMatch = rowStr.match(/(CSE|ECE|EEE|MECH|CIVIL|IT|AIML|DS|CSBS)/i);
      if (branchMatch && !metadata.branch) metadata.branch = branchMatch[1].toUpperCase();

      const regMatch = rowStr.match(/R\d{2}/i);
      if (regMatch && !metadata.regulation) metadata.regulation = regMatch[0].toUpperCase();

      // Check for Hall Ticket header column
      const upperRow = row.map(c => String(c).trim().toUpperCase());
      const hasHT = upperRow.some(c =>
        c === 'HTNO' || c === 'HT NO' || c.includes('HALL TICKET') || c === 'ROLL NO' || c === 'ROLLNO'
      );

      if (hasHT) {
        headerRowIndex = r;
        // Check if next row is a sub-header row (Int, Ext, Tot, Gr, Grade)
        if (r + 1 < rawRows.length) {
          const nextRowUpper = rawRows[r + 1].map(c => String(c).trim().toUpperCase());
          const subKeywords = ['INT', 'INTERNAL', 'EXT', 'EXTERNAL', 'TOT', 'TOTAL', 'MARKS', 'GR', 'GRD', 'GRADE'];
          const matchCount = nextRowUpper.filter(c => subKeywords.some(k => c === k || c.startsWith(k))).length;
          if (matchCount >= 2) {
            subHeaderRowIndex = r + 1;
          }
        }
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error('HEADER_NOT_FOUND: Could not find student Hall Ticket Number column in results sheet.');
    }

    // 2. Identify HTNo column index and Summary Column indexes
    const mainHeaders = rawRows[headerRowIndex].map(c => String(c).trim());
    let htCol = -1;
    let sgpaCol = -1;
    let cgpaCol = -1;
    let totColSummary = -1;
    let crsCol = -1;
    let resCol = -1;

    mainHeaders.forEach((h, idx) => {
      const up = h.toUpperCase();
      if (htCol === -1 && (up === 'HTNO' || up === 'HT NO' || up.includes('HALL TICKET') || up === 'ROLL NO' || up === 'ROLLNO')) {
        htCol = idx;
      } else if (up === 'SGPA') {
        sgpaCol = idx;
      } else if (up === 'CGPA') {
        cgpaCol = idx;
      } else if (up === 'CRS' || up === 'CREDITS' || up === 'TOTAL CREDITS') {
        crsCol = idx;
      } else if (up === 'RES' || up === 'RESULT' || up === 'FINAL RESULT') {
        resCol = idx;
      } else if (up === 'TOT' || up === 'TOTAL' || up === 'TOTAL MARKS') {
        if (subHeaderRowIndex === -1 || idx > 10) {
          totColSummary = idx;
        }
      }
    });

    // Check sub-header row for SGPA / CGPA / CRS / RES if not found in main header
    if (subHeaderRowIndex !== -1) {
      const subHeaders = rawRows[subHeaderRowIndex].map(c => String(c).trim().toUpperCase());
      subHeaders.forEach((h, idx) => {
        if (sgpaCol === -1 && h === 'SGPA') sgpaCol = idx;
        if (cgpaCol === -1 && h === 'CGPA') cgpaCol = idx;
        if (crsCol === -1 && (h === 'CRS' || h === 'CREDITS')) crsCol = idx;
        if (resCol === -1 && (h === 'RES' || h === 'RESULT')) resCol = idx;
      });
    }

    // 3. Dynamically detect Subject Columns
    const detectedSubjects: DetectedSubjectColumn[] = [];
    const minCol = htCol + 1;
    // Summary columns define the upper boundary for subject columns
    const summaryCols = [sgpaCol, cgpaCol, totColSummary, crsCol, resCol].filter(c => c !== -1);
    const maxCol = summaryCols.length > 0 ? Math.min(...summaryCols) : mainHeaders.length;

    if (subHeaderRowIndex !== -1) {
      // Layout A: Hierarchical 2-row header (Row 1: Code, Row 2: Int, Ext, Tot, Gr)
      let currentSubjectCode = '';
      let currentGroup: { int?: number; ext?: number; tot?: number; gr?: number } = {};

      for (let c = minCol; c < maxCol; c++) {
        const topCell = String(rawRows[headerRowIndex][c] || '').trim();
        const subCell = String(rawRows[subHeaderRowIndex][c] || '').trim().toUpperCase();

        if (topCell && topCell !== currentSubjectCode) {
          // If we had a previous subject accumulated, push it
          if (currentSubjectCode && (currentGroup.int !== undefined || currentGroup.ext !== undefined || currentGroup.tot !== undefined)) {
            const parts = currentSubjectCode.split('-');
            const subjectName = parts.length > 1 ? parts.slice(1).join('-').trim() : undefined;
            detectedSubjects.push({
              subjectCode: currentSubjectCode,
              subjectName,
              intCol: currentGroup.int ?? -1,
              extCol: currentGroup.ext ?? -1,
              totCol: currentGroup.tot ?? -1,
              gradeCol: currentGroup.gr ?? -1,
            });
            currentGroup = {};
          }
          currentSubjectCode = topCell;
        }

        if (subCell === 'INT' || subCell.includes('INT') || subCell.includes('INTERNAL')) currentGroup.int = c;
        else if (subCell === 'EXT' || subCell.includes('EXT') || subCell.includes('EXTERNAL')) currentGroup.ext = c;
        else if (subCell === 'TOT' || subCell.includes('TOT') || subCell.includes('TOTAL') || subCell === 'MARKS') currentGroup.tot = c;
        else if (subCell === 'GR' || subCell === 'GRD' || subCell.includes('GRADE') || subCell.includes('GRD')) currentGroup.gr = c;
      }

      if (currentSubjectCode && (currentGroup.int !== undefined || currentGroup.ext !== undefined || currentGroup.tot !== undefined)) {
        const parts = currentSubjectCode.split('-');
        const subjectName = parts.length > 1 ? parts.slice(1).join('-').trim() : undefined;
        detectedSubjects.push({
          subjectCode: currentSubjectCode,
          subjectName,
          intCol: currentGroup.int ?? -1,
          extCol: currentGroup.ext ?? -1,
          totCol: currentGroup.tot ?? -1,
          gradeCol: currentGroup.gr ?? -1,
        });
      }
    } else {
      // Layout B: Single header with concatenated headers, e.g. "23CS401PC-DM Int", "23CS401PC-DM Ext"
      const subjectMap = new Map<string, { int?: number; ext?: number; tot?: number; gr?: number }>();

      for (let c = minCol; c < maxCol; c++) {
        const colHeader = String(rawRows[headerRowIndex][c] || '').trim();
        const match = colHeader.match(/^([A-Za-z0-9_-]+)\s*[-_ ]\s*(INT|INTERNAL|INTERNALS|EXT|EXTERNAL|EXTERNALS|TOT|TOTAL|MARKS|GR|GRD|GRADE)$/i) ||
                      colHeader.match(/^([A-Za-z0-9_-]+)\s+(INT|INTERNAL|INTERNALS|EXT|EXTERNAL|EXTERNALS|TOT|TOTAL|MARKS|GR|GRD|GRADE)$/i);
        if (match) {
          const code = match[1];
          const type = match[2].toUpperCase();
          if (!subjectMap.has(code)) subjectMap.set(code, {});
          const entry = subjectMap.get(code)!;
          if (type.startsWith('INT')) entry.int = c;
          else if (type.startsWith('EXT')) entry.ext = c;
          else if (type.startsWith('TOT') || type === 'MARKS') entry.tot = c;
          else if (type.startsWith('GR') || type.startsWith('GRADE')) entry.gr = c;
        }
      }

      subjectMap.forEach((entry, code) => {
        if (entry.int !== undefined || entry.ext !== undefined || entry.tot !== undefined) {
          const parts = code.split('-');
          const subjectName = parts.length > 1 ? parts.slice(1).join('-').trim() : undefined;
          detectedSubjects.push({
            subjectCode: code,
            subjectName,
            intCol: entry.int ?? -1,
            extCol: entry.ext ?? -1,
            totCol: entry.tot ?? -1,
            gradeCol: entry.gr ?? -1,
          });
        }
      });
    }

    if (detectedSubjects.length === 0) {
      throw new Error('NO_SUBJECTS_DETECTED: Unable to dynamically detect any subject marks columns in result sheet.');
    }

    // 4. Process each student row
    const dataStartRow = subHeaderRowIndex !== -1 ? subHeaderRowIndex + 1 : headerRowIndex + 1;
    const parsedResults: ParsedStudentResultRow[] = [];
    const validationErrors: ExaminationResultParseResult['validationErrors'] = [];
    let totalScoreCount = 0;

    for (let r = dataStartRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.every(c => String(c).trim() === '')) {
        continue;
      }

      const rowNumber = r + 1;
      const rawHT = String(row[htCol] || '').trim().toUpperCase();
      const errors: string[] = [];

      if (!rawHT) {
        errors.push('HALL_TICKET_NOT_FOUND: Row missing Hall Ticket Number');
      }

      const subjectScores: ParsedSubjectScore[] = [];

      for (const subj of detectedSubjects) {
        const rawInt = subj.intCol !== -1 ? row[subj.intCol] : null;
        const rawExt = subj.extCol !== -1 ? row[subj.extCol] : null;
        const rawTot = subj.totCol !== -1 ? row[subj.totCol] : null;
        const rawGr = subj.gradeCol !== -1 ? String(row[subj.gradeCol] || '').trim().toUpperCase() : null;

        // Determine if student was absent in this subject
        const isAbsent = isAbsentMark(rawInt) || isAbsentMark(rawExt) || isAbsentMark(rawTot) || isAbsentGrade(rawGr);

        let intMarks: number | null = null;
        let extMarks: number | null = null;
        let totMarks: number | null = null;

        if (!isAbsent) {
          if (rawInt !== null && rawInt !== undefined && String(rawInt).trim() !== '') {
            if (isNotApplicable(rawInt)) {
              intMarks = null;
            } else {
              const num = Number(rawInt);
              if (isNaN(num) || num < 0) {
                errors.push(`INVALID_MARKS: Invalid internal mark "${rawInt}" for subject ${subj.subjectCode}`);
              } else {
                intMarks = num;
              }
            }
          }

          if (rawExt !== null && rawExt !== undefined && String(rawExt).trim() !== '') {
            if (isNotApplicable(rawExt)) {
              extMarks = null;
            } else {
              const num = Number(rawExt);
              if (isNaN(num) || num < 0) {
                errors.push(`INVALID_MARKS: Invalid external mark "${rawExt}" for subject ${subj.subjectCode}`);
              } else {
                extMarks = num;
              }
            }
          }

          if (rawTot !== null && rawTot !== undefined && String(rawTot).trim() !== '') {
            if (isNotApplicable(rawTot)) {
              totMarks = null;
            } else {
              const num = Number(rawTot);
              if (isNaN(num) || num < 0) {
                errors.push(`INVALID_MARKS: Invalid total mark "${rawTot}" for subject ${subj.subjectCode}`);
              } else {
                totMarks = num;
              }
            }
          } else if (intMarks !== null && extMarks !== null) {
            totMarks = intMarks + extMarks;
          } else if (intMarks !== null && isNotApplicable(rawExt)) {
            totMarks = intMarks;
          }
        }

        // Determine Result Status matching CHECK constraint: ('PASS', 'FAIL', 'ABSENT', 'WITHHELD')
        let resultStatus: 'PASS' | 'FAIL' | 'ABSENT' | 'WITHHELD' = 'PASS';
        if (isAbsent) {
          resultStatus = 'ABSENT';
        } else if (rawGr === 'F' || rawGr === 'FAIL' || isAbsentGrade(rawGr)) {
          resultStatus = isAbsentGrade(rawGr) ? 'ABSENT' : 'FAIL';
        } else if (rawGr === 'WH' || rawGr === 'WITHHELD') {
          resultStatus = 'WITHHELD';
        } else if (!rawGr && totMarks !== null && totMarks < 40) {
          resultStatus = 'FAIL';
        }

        subjectScores.push({
          subjectCode: subj.subjectCode,
          internalMarks: intMarks,
          externalMarks: extMarks,
          totalMarks: totMarks,
          grade: rawGr || null,
          resultStatus,
        });

        totalScoreCount++;
      }

      // Extract Semester Summaries
      let parsedSgpa: number | null = null;
      let parsedCgpa: number | null = null;
      let parsedTotalCredits: number | null = null;
      let parsedOverallResult: 'PASS' | 'FAIL' | 'PROMOTED' | 'WITHHELD' | null = null;

      if (sgpaCol !== -1 && row[sgpaCol] !== '') {
        const val = Number(row[sgpaCol]);
        if (!isNaN(val) && val >= 0 && val <= 10) parsedSgpa = val;
      }

      if (cgpaCol !== -1 && row[cgpaCol] !== '') {
        const val = Number(row[cgpaCol]);
        if (!isNaN(val) && val >= 0 && val <= 10) parsedCgpa = val;
      }

      if (crsCol !== -1 && row[crsCol] !== '') {
        const val = Number(row[crsCol]);
        if (!isNaN(val) && val >= 0) parsedTotalCredits = val;
      }

      if (resCol !== -1 && row[resCol] !== undefined && String(row[resCol]).trim() !== '') {
        const val = String(row[resCol]).trim().toUpperCase();
        if (val === 'P' || val === 'PASS') parsedOverallResult = 'PASS';
        else if (val === 'F' || val === 'FAIL') parsedOverallResult = 'FAIL';
        else if (val.startsWith('PRO')) parsedOverallResult = 'PROMOTED';
        else if (val.startsWith('WH')) parsedOverallResult = 'WITHHELD';
        else parsedOverallResult = val as any;
      } else {
        // Infer from subject results
        const hasFail = subjectScores.some(s => s.resultStatus === 'FAIL' || s.resultStatus === 'ABSENT');
        parsedOverallResult = hasFail ? 'FAIL' : 'PASS';
      }

      const isValid = errors.length === 0;

      const studentResultRow: ParsedStudentResultRow = {
        rowNumber,
        hallTicketNumber: rawHT,
        subjects: subjectScores,
        semesterSummary: {
          sgpa: parsedSgpa,
          cgpa: parsedCgpa,
          totalCredits: parsedTotalCredits,
          earnedCredits: parsedOverallResult === 'PASS' ? parsedTotalCredits : null,
          overallResult: parsedOverallResult,
        },
        isValid,
        errors,
      };

      parsedResults.push(studentResultRow);

      if (!isValid) {
        validationErrors.push({
          rowNumber,
          hallTicketNumber: rawHT || undefined,
          status: 'INVALID',
          reason: errors.join('; '),
          errors,
        });
      }
    }

    const totalStudents = parsedResults.length;
    const validStudents = parsedResults.filter(s => s.isValid).length;
    const invalidStudents = parsedResults.filter(s => !s.isValid).length;

    const preview = parsedResults.slice(0, 10).map(s => ({
      rowNumber: s.rowNumber,
      hallTicketNumber: s.hallTicketNumber,
      subjectCount: s.subjects.length,
      sampleScores: s.subjects.slice(0, 3),
      sgpa: s.semesterSummary.sgpa,
      cgpa: s.semesterSummary.cgpa,
      overallResult: s.semesterSummary.overallResult,
    }));

    return {
      fileType: 'EXAMINATION_RESULT',
      metadata,
      detectedSubjects: detectedSubjects.map(d => ({
        subjectCode: d.subjectCode,
        subjectName: d.subjectName,
        hasInternal: d.intCol !== -1,
        hasExternal: d.extCol !== -1,
        hasTotal: d.totCol !== -1,
        hasGrade: d.gradeCol !== -1,
      })),
      summary: {
        totalStudents,
        validStudents,
        invalidStudents,
        totalSubjectScores: totalScoreCount,
      },
      preview,
      validationErrors,
      allValidResults: parsedResults.filter(s => s.isValid),
      allStudentRows: parsedResults,
    };
  }
}
