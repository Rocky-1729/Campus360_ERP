import * as xlsx from 'xlsx';
import { connectDB, closeDB, query, getClient } from '../config/database';
import { ExaminationResultParser } from '../services/excel/examinationResultParser';
import { importStagingService } from '../services/excel/importStaging.service';
import { excelImportService } from '../services/excel/excelImport.service';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function check(passed: boolean, category: string, name: string, detail: string) {
  results.push({ category, name, passed, detail });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} [${category}] ${name}: ${detail}`);
}

async function runTests() {
  console.log('========================================================================');
  console.log('STARTING AUDIT & TEST SUITE: SIMPLIFIED RESULT IMPORT & STUDENT MAPPING');
  console.log('========================================================================\n');

  try {
    await connectDB();

    // -------------------------------------------------------------
    // PART 1: Schema Verification for Students table
    // -------------------------------------------------------------
    console.log('--- PART 1: Verifying Student Table Schema ---');
    const colsRes = await query<{ column_name: string; data_type: string; column_default: string }>(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'students' AND column_name IN ('academic_status', 'current_semester_id')
    `);

    const hasAcademicStatus = colsRes.rows.some(c => c.column_name === 'academic_status');
    const hasCurrentSem = colsRes.rows.some(c => c.column_name === 'current_semester_id');

    check(hasAcademicStatus, 'Schema', 'students.academic_status exists', 
      colsRes.rows.find(c => c.column_name === 'academic_status')?.data_type || 'missing');
    check(hasCurrentSem, 'Schema', 'students.current_semester_id exists', 
      colsRes.rows.find(c => c.column_name === 'current_semester_id')?.data_type || 'missing');

    // -------------------------------------------------------------
    // PART 2: Seed / Verify Diverse Student Batches (2020, 2023, 2024 Lateral)
    // -------------------------------------------------------------
    console.log('\n--- PART 2: Verifying Diverse Student Batches ---');
    
    // Ensure 2020 batch student exists
    const s2020 = await query<{ id: string }>('SELECT id FROM students WHERE UPPER(hall_ticket_number) = $1', ['20TP1A0547']);
    if (s2020.rows.length === 0) {
      await query(`
        INSERT INTO students (hall_ticket_number, full_name, email, academic_status, current_semester_id)
        VALUES ('20TP1A0547', 'Suresh Backlog Student', 'suresh.backlog@campus360.edu', 'ACTIVE', 4)
      `);
    }

    // Ensure 2023 batch student exists
    const s2023 = await query<{ id: string }>('SELECT id FROM students WHERE UPPER(hall_ticket_number) = $1', ['23TP1A0501']);
    if (s2023.rows.length === 0) {
      await query(`
        INSERT INTO students (hall_ticket_number, full_name, email, academic_status, current_semester_id)
        VALUES ('23TP1A0501', 'Regular Batch Student', 'regular.batch@campus360.edu', 'ACTIVE', 4)
      `);
    }

    // Ensure 2024 lateral entry student exists
    const s2024 = await query<{ id: string }>('SELECT id FROM students WHERE UPPER(hall_ticket_number) = $1', ['24TP5A0519']);
    if (s2024.rows.length === 0) {
      await query(`
        INSERT INTO students (hall_ticket_number, full_name, email, academic_status, current_semester_id)
        VALUES ('24TP5A0519', 'Ramesh Lateral Entry', 'ramesh.lateral@campus360.edu', 'ACTIVE', 4)
      `);
    }

    // Verify each student can be queried strictly by Hall Ticket Number
    const testCases = [
      { ht: '23TP1A0501', desc: 'Current 2023 batch regular student' },
      { ht: '20TP1A0547', desc: 'Older 2020 batch backlog student' },
      { ht: '24TP5A0519', desc: '2024 lateral entry student' },
      { ht: '99INVALID001', desc: 'Non-existent student' },
    ];

    for (const tc of testCases) {
      const qRes = await query<{ id: string; hall_ticket_number: string }>(
        'SELECT id, hall_ticket_number FROM students WHERE UPPER(hall_ticket_number) = UPPER($1)',
        [tc.ht]
      );
      if (tc.ht === '99INVALID001') {
        check(qRes.rows.length === 0, 'Student Matching', `Reject non-existent student ${tc.ht}`, 'Correctly returned 0 rows');
      } else {
        check(qRes.rows.length > 0, 'Student Matching', `Accept valid student ${tc.ht} (${tc.desc})`, `Found student id=${qRes.rows[0]?.id}`);
      }
    }

    // -------------------------------------------------------------
    // PART 3: Verify All 8 Semesters and Strict Examination Filtering
    // -------------------------------------------------------------
    console.log('\n--- PART 3: Verifying 8 Semesters and Filtered Examinations ---');
    const semRes = await query<{ id: string; semester_number: number; semester_name: string }>(
      'SELECT id, semester_number, semester_name FROM semesters ORDER BY semester_number'
    );
    check(semRes.rows.length === 8, 'Semesters', 'All 8 B.Tech Semesters present', `Found ${semRes.rows.length} semesters`);

    // Verify filtering by semester 4 + REGULAR
    const sem4 = semRes.rows.find(s => s.semester_number === 4);
    if (sem4) {
      const regExams = await query<{ id: string; exam_name: string; exam_type: string }>(
        'SELECT id, exam_name, exam_type FROM examinations WHERE semester_id = $1 AND exam_type = $2',
        [sem4.id, 'REGULAR']
      );
      check(regExams.rows.length > 0, 'Exam Filtering', 'Semester 4 Regular exams found', `Found ${regExams.rows.length} regular exams`);

      const suppExams = await query<{ id: string; exam_name: string; exam_type: string }>(
        'SELECT id, exam_name, exam_type FROM examinations WHERE semester_id = $1 AND exam_type = $2',
        [sem4.id, 'SUPPLEMENTARY']
      );
      check(suppExams.rows.length > 0, 'Exam Filtering', 'Semester 4 Supplementary exams found', `Found ${suppExams.rows.length} supplementary exams`);
    }

    // -------------------------------------------------------------
    // PART 4: Auto-Detection of Semester & Exam Type from Headers
    // -------------------------------------------------------------
    console.log('\n--- PART 4: Testing Header Auto-Detection ---');
    
    // Header Test 1: Regular Semester 4
    const rowsReg = [
      ['COLLEGE OF ENGINEERING & TECHNOLOGY (AUTONOMOUS)'],
      ['II B.TECH II SEMESTER REGULAR EXAMINATIONS JAN 2024'],
      ['BRANCH: COMPUTER SCIENCE & ENGINEERING'],
      ['HTNO', 'STUDENT NAME', 'CS401 INT', 'CS401 EXT', 'CS401 TOT', 'CS401 GRD', 'SGPA', 'CGPA', 'RESULT'],
      ['23TP1A0501', 'Test Student 1', '25', '60', '85', 'A+', '8.50', '8.50', 'PASS'],
    ];
    const wsReg = xlsx.utils.aoa_to_sheet(rowsReg);
    const parseReg = ExaminationResultParser.parse(wsReg);

    check(parseReg.metadata.semesterNumber === 4, 'Auto-Detection', 'Auto-detect Semester 4', `Detected: ${parseReg.metadata.semesterNumber}`);
    check(parseReg.metadata.examType === 'REGULAR', 'Auto-Detection', 'Auto-detect REGULAR type', `Detected: ${parseReg.metadata.examType}`);

    // Header Test 2: Supplementary Semester 5
    const rowsSupp = [
      ['COLLEGE OF ENGINEERING & TECHNOLOGY (AUTONOMOUS)'],
      ['III B.TECH I SEMESTER SUPPLEMENTARY EXAMINATIONS JULY 2024'],
      ['BRANCH: COMPUTER SCIENCE & ENGINEERING'],
      ['HTNO', 'STUDENT NAME', 'CS501 INT', 'CS501 EXT', 'CS501 TOT', 'CS501 GRD', 'SGPA', 'CGPA', 'RESULT'],
      ['20TP1A0547', 'Test Backlog Student', '22', '45', '67', 'B+', '7.00', '7.20', 'PASS'],
    ];
    const wsSupp = xlsx.utils.aoa_to_sheet(rowsSupp);
    const parseSupp = ExaminationResultParser.parse(wsSupp);

    check(parseSupp.metadata.semesterNumber === 5, 'Auto-Detection', 'Auto-detect Semester 5 (III-I)', `Detected: ${parseSupp.metadata.semesterNumber}`);
    check(parseSupp.metadata.examType === 'SUPPLEMENTARY', 'Auto-Detection', 'Auto-detect SUPPLEMENTARY type', `Detected: ${parseSupp.metadata.examType}`);

    // -------------------------------------------------------------
    // PART 5: Mixed Import Simulation (Valid students imported, invalid student rejected)
    // -------------------------------------------------------------
    console.log('\n--- PART 5: Testing Mixed Import (Diverse Valid + 1 Invalid) ---');
    const mixedRows = [
      ['COLLEGE OF ENGINEERING & TECHNOLOGY (AUTONOMOUS)'],
      ['II B.TECH II SEMESTER REGULAR EXAMINATIONS JAN 2024'],
      ['HTNO', 'STUDENT NAME', 'CS401PC INT', 'CS401PC EXT', 'CS401PC TOT', 'CS401PC GRD', 'SGPA', 'CGPA', 'RESULT'],
      ['23TP1A0501', 'Student 2023 Batch', '25', '60', '85', 'A+', '8.50', '8.50', 'PASS'],
      ['20TP1A0547', 'Student 2020 Backlog', '22', '55', '77', 'A', '7.80', '7.50', 'PASS'],
      ['24TP5A0519', 'Student 2024 Lateral', '24', '58', '82', 'A+', '8.20', '8.20', 'PASS'],
      ['99INVALID001', 'Non-Existent Student', '20', '50', '70', 'B+', '7.00', '7.00', 'PASS'],
    ];
    const wsMixed = xlsx.utils.aoa_to_sheet(mixedRows);
    const parsedMixed = ExaminationResultParser.parse(wsMixed);

    // Cross reference against DB students
    const existingHTs = new Set<string>();
    const dbHTRes = await query<{ ht: string }>(
      'SELECT UPPER(hall_ticket_number) AS ht FROM students WHERE UPPER(hall_ticket_number) = ANY($1)',
      [['23TP1A0501', '20TP1A0547', '24TP5A0519', '99INVALID001']]
    );
    dbHTRes.rows.forEach(r => existingHTs.add(r.ht));

    const validStudents: any[] = [];
    const invalidErrors: any[] = [];

    for (const r of parsedMixed.allStudentRows) {
      const ht = r.hallTicketNumber ? r.hallTicketNumber.trim().toUpperCase() : '';
      if (!existingHTs.has(ht)) {
        invalidErrors.push({ rowNumber: r.rowNumber, ht, reason: 'STUDENT_NOT_FOUND: Student not found in PostgreSQL' });
      } else {
        validStudents.push(r);
      }
    }

    check(validStudents.length === 3, 'Validation', '3 Valid students accepted across batches', `Accepted: ${validStudents.map(v => v.hallTicketNumber).join(', ')}`);
    check(invalidErrors.length === 1 && invalidErrors[0].ht === '99INVALID001', 'Validation', '1 Non-existent student rejected', `Rejected: ${invalidErrors[0].ht} (${invalidErrors[0].reason})`);

    // Stage and Import into PostgreSQL
    parsedMixed.summary.validStudents = validStudents.length;
    parsedMixed.summary.invalidStudents = invalidErrors.length;
    parsedMixed.allValidResults = validStudents;
    parsedMixed.validationErrors = invalidErrors;

    const testHash = 'test_hash_' + Date.now();
    const token = importStagingService.stageExaminationResult('test_mixed_import.xlsx', testHash, parsedMixed);

    // Get a valid Semester 4 examination
    const targetExam = await query<{ id: number; exam_name: string }>(
      'SELECT id, exam_name FROM examinations WHERE semester_id = $1 AND exam_type = $2 LIMIT 1',
      [sem4?.id, 'REGULAR']
    );

    if (targetExam.rows.length > 0) {
      const examId = Number(targetExam.rows[0].id);
      const importRes = await excelImportService.importExaminationResults(token, { examinationId: examId });

      check(importRes.studentsProcessed === 3, 'Import Execution', '3 students successfully processed into PostgreSQL', `Processed: ${importRes.studentsProcessed}`);
      check(importRes.resultsInserted >= 3, 'Import Execution', 'Marks inserted into exam_results', `Inserted marks: ${importRes.resultsInserted}`);

      // Verify audit record in excel_uploads
      const auditRes = await query<{ file_name: string; upload_status: string; total_rows: number; successful_rows: number; failed_rows: number }>(
        'SELECT file_name, upload_status, total_rows, successful_rows, failed_rows FROM excel_uploads WHERE file_hash = $1',
        [testHash]
      );
      check(auditRes.rows.length > 0, 'Audit Trail', 'Upload audit record created', `Status: ${auditRes.rows[0]?.upload_status}, Success: ${auditRes.rows[0]?.successful_rows}, Failed: ${auditRes.rows[0]?.failed_rows}`);
    }

    // -------------------------------------------------------------
    // PART 6: History Query Verification (No "Exam #N/A")
    // -------------------------------------------------------------
    console.log('\n--- PART 6: Testing Audit History Query Formatting ---');
    const history = await excelImportService.getUploadHistory();
    check(history.length > 0, 'History', 'History records returned from PostgreSQL', `Found ${history.length} records`);

    const latestExamUpload = history.find(h => h.fileHash === testHash);
    if (latestExamUpload) {
      check(Boolean(latestExamUpload.examinationName), 'History', 'Real examination name displayed', `Name: ${latestExamUpload.examinationName}`);
      check(latestExamUpload.semesterNumber === 4, 'History', 'Correct semester number joined', `Semester: ${latestExamUpload.semesterNumber}`);
      check(latestExamUpload.examType === 'REGULAR', 'History', 'Correct examination type joined', `Type: ${latestExamUpload.examType}`);
    }

    const studentMasterUpload = history.find(h => !h.examinationId);
    if (studentMasterUpload) {
      check(studentMasterUpload.examinationId === null, 'History', 'Student Master upload has examinationId = null (UI renders "Student Master Roster")', `File: ${studentMasterUpload.fileName}`);
    }

    console.log('\n========================================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Test execution failed with error:', err);
  } finally {
    await closeDB();
  }
}

runTests();
