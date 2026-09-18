import * as xlsx from 'xlsx';

export type ExcelFileType = 'STUDENT_MASTER' | 'EXAMINATION_RESULT' | 'UNKNOWN';

export interface DetectionResult {
  fileType: ExcelFileType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sheetName: string;
  reasons: string[];
}

export const detectExcelFileType = (workbook: xlsx.WorkBook): DetectionResult => {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      fileType: 'UNKNOWN',
      confidence: 'LOW',
      sheetName: '',
      reasons: ['Workbook has no sheets'],
    };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      fileType: 'UNKNOWN',
      confidence: 'LOW',
      sheetName,
      reasons: ['Primary sheet is empty or invalid'],
    };
  }

  const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length === 0) {
    return {
      fileType: 'UNKNOWN',
      confidence: 'LOW',
      sheetName,
      reasons: ['Primary sheet has 0 rows'],
    };
  }

  // Scan top 15 rows for pattern matching
  let examScore = 0;
  let studentMasterScore = 0;
  const examReasons: string[] = [];
  const masterReasons: string[] = [];

  const flattenedText = rawRows
    .slice(0, 15)
    .map(row => row.join(' ').toUpperCase())
    .join(' | ');

  // Examination Result Signatures
  const examKeywords = ['SGPA', 'CGPA', 'GRADE', 'EXTERNAL', 'EXT MARKS', 'INTERNAL', 'INT MARKS', 'SUPPLEMENTARY', 'REGULAR EXAMINATIONS', 'TOTAL MARKS', 'CREDITS', 'CRS'];
  examKeywords.forEach(kw => {
    if (flattenedText.includes(kw)) {
      examScore += 2;
      examReasons.push(`Found exam keyword: "${kw}"`);
    }
  });

  // Check for repeated marks sub-headers: Int, Ext, Tot, Gr
  let intCount = 0;
  let extCount = 0;
  let totCount = 0;
  let grCount = 0;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r];
    for (const cell of row) {
      const str = String(cell).trim().toUpperCase();
      if (str === 'INT' || str === 'INTERNAL' || str.endsWith(' INT')) intCount++;
      if (str === 'EXT' || str === 'EXTERNAL' || str.endsWith(' EXT')) extCount++;
      if (str === 'TOT' || str === 'TOTAL' || str.endsWith(' TOT')) totCount++;
      if (str === 'GR' || str === 'GRADE' || str.endsWith(' GR')) grCount++;
    }
  }

  if (intCount >= 2 && extCount >= 2) {
    examScore += 10;
    examReasons.push(`Detected wide-format repeated marks columns (Int: ${intCount}, Ext: ${extCount}, Tot: ${totCount}, Gr: ${grCount})`);
  }

  // Student Master Signatures
  const masterKeywords = ['DOB', 'DATE OF BIRTH', 'GENDER', 'FATHER NAME', 'MOTHER NAME', 'STUDENT MOBILE', 'PARENT MOBILE', 'AADHAR', 'ADMN NO', 'ADMISSION NO', 'FULL NAME', 'STUDENT NAME'];
  masterKeywords.forEach(kw => {
    if (flattenedText.includes(kw)) {
      studentMasterScore += 2;
      masterReasons.push(`Found student master keyword: "${kw}"`);
    }
  });

  // Decision Logic
  if (examScore >= 6 && examScore > studentMasterScore) {
    return {
      fileType: 'EXAMINATION_RESULT',
      confidence: examScore >= 10 ? 'HIGH' : 'MEDIUM',
      sheetName,
      reasons: examReasons,
    };
  }

  if (studentMasterScore >= 4 && studentMasterScore > examScore) {
    return {
      fileType: 'STUDENT_MASTER',
      confidence: studentMasterScore >= 8 ? 'HIGH' : 'MEDIUM',
      sheetName,
      reasons: masterReasons,
    };
  }

  // Fallback check on header row column names
  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const rowUpper = rawRows[r].map(c => String(c).trim().toUpperCase());
    const hasHT = rowUpper.some(c => c.includes('HTNO') || c.includes('HALL TICKET') || c.includes('ROLL'));
    const hasName = rowUpper.some(c => c.includes('NAME'));
    
    if (hasHT && hasName) {
      if (rowUpper.some(c => c.includes('SGPA') || c.includes('CGPA') || c.includes('EXT'))) {
        return {
          fileType: 'EXAMINATION_RESULT',
          confidence: 'MEDIUM',
          sheetName,
          reasons: ['Found HTNo + SGPA/CGPA in header row'],
        };
      }
      return {
        fileType: 'STUDENT_MASTER',
        confidence: 'MEDIUM',
        sheetName,
        reasons: ['Found HTNo + Student Name in header row without marks breakdown'],
      };
    }
  }

  return {
    fileType: 'UNKNOWN',
    confidence: 'LOW',
    sheetName,
    reasons: ['Unable to confidently determine file structure from headers or content'],
  };
};
