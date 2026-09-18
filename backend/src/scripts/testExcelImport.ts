import http from 'http';
import * as xlsx from 'xlsx';
import app from '../app';
import { connectDB, closeDB, query } from '../config/database';

interface TestCaseResult {
  step: string;
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestCaseResult[] = [];

function sendMultipartRequest(
  server: http.Server,
  path: string,
  filename: string,
  fileBuffer: Buffer
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const boundary = '---------------------------Campus360Boundary' + Math.random().toString(36).substring(2);
    const pre = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([pre, fileBuffer, post]);

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
        'Accept': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 0, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

function sendJsonRequest(
  server: http.Server,
  method: 'GET' | 'POST',
  path: string,
  payload?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const bodyStr = payload ? JSON.stringify(payload) : '';

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 0, body: parsed });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runExcelImportTests() {
  console.log('====================================================');
  console.log('Campus360 ERP — Phase 5 Real Excel Import System Tests');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    // -------------------------------------------------------------
    // Fetch real foreign key candidates from DB
    // -------------------------------------------------------------
    const batchRes = await query('SELECT id FROM academic_batches ORDER BY id ASC LIMIT 1');
    const defaultBatchId = batchRes.rows[0]?.id ? Number(batchRes.rows[0].id) : 1;

    const secRes = await query('SELECT id FROM sections ORDER BY id ASC LIMIT 1');
    const defaultSectionId = secRes.rows[0]?.id ? Number(secRes.rows[0].id) : 1;

    // Ensure subjects exist
    await query(`
      INSERT INTO subjects (subject_code, subject_name) 
      VALUES 
        ('CS101', 'Programming for Problem Solving'),
        ('MA101', 'Linear Algebra and Calculus')
      ON CONFLICT (subject_code) DO NOTHING
    `);

    const subjectsRes = await query("SELECT id, subject_code, subject_name FROM subjects WHERE subject_code IN ('CS101', 'MA101') ORDER BY subject_code ASC");
    const sub1 = subjectsRes.rows[0].subject_code;
    const sub2 = subjectsRes.rows[1].subject_code;

    // Ensure examination exists
    let examRes = await query('SELECT id, exam_name FROM examinations ORDER BY id ASC LIMIT 1');
    if (examRes.rows.length === 0) {
      await query(`
        INSERT INTO examinations (academic_session_id, semester_id, exam_type, exam_name, status, exam_date)
        VALUES (1, 1, 'REGULAR', 'I B.Tech I Semester Regular Examinations Jan 2024', 'COMPLETED', '2024-01-08')
      `);
      examRes = await query('SELECT id, exam_name FROM examinations ORDER BY id ASC LIMIT 1');
    }
    const defaultExamId = Number(examRes.rows[0].id);

    console.log(`[SETUP] Found Batch ID: ${defaultBatchId}, Section ID: ${defaultSectionId}`);
    console.log(`[SETUP] Using Subjects: ${sub1}, ${sub2}`);
    console.log(`[SETUP] Using Examination ID: ${defaultExamId} (${examRes.rows[0].exam_name})\n`);

    // Clean up prior test data if any
    const testHTs = ['TEST2026001', 'TEST2026002', 'TEST2026003'];
    await query('DELETE FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM student_semester_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM student_academic_enrollments WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM students WHERE hall_ticket_number = ANY($1)', [testHTs]);
    await query("DELETE FROM excel_uploads WHERE file_name LIKE 'TEST_%'");

    // =============================================================
    // TEST 1: TYPE A - STUDENT MASTER EXCEL PARSER & PREVIEW
    // =============================================================
    console.log('--- TEST 1: Student Master Upload & Preview ---');
    const masterRows = [
      ['COLLEGE OF ENGINEERING & TECHNOLOGY'],
      ['STUDENT ADMISSION MASTER LIST'],
      ['Course: B.TECH', 'Branch: COMPUTER SCIENCE & ENGINEERING', 'Batch: 2022-2026', 'Semester: I'],
      [], // blank row
      ['S.No', 'Hall Ticket No', 'Full Name', 'Gender', 'Date of Birth', 'Email', 'Phone Number'],
      [1, 'TEST2026001', 'Alice Brown', 'FEMALE', '2004-03-15', 'alice.b@campus360.edu', '9876543201'],
      [2, 'TEST2026002', 'Bob Smith', 'MALE', '2004-07-22', 'bob.s@campus360.edu', '9876543202'],
      [3, 'TEST2026003', 'Charlie Dave', 'MALE', '2003-11-05', 'charlie.d@campus360.edu', '9876543203'],
      [4, '', 'Missing HallTicket', 'MALE', '2004-01-01', 'missing@campus360.edu', '9876543204'], // Invalid
      [5, 'TEST2026001', 'Alice Duplicate', 'FEMALE', '2004-03-15', 'alice.dup@campus360.edu', '9876543205'], // Duplicate
    ];

    const masterWs = xlsx.utils.aoa_to_sheet(masterRows);
    const masterWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(masterWb, masterWs, 'StudentMaster');
    const masterBuf = xlsx.write(masterWb, { type: 'buffer', bookType: 'xlsx' });

    const masterPreviewRes = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'TEST_Student_Master_2026.xlsx',
      masterBuf
    );

    const masterPreviewPassed =
      masterPreviewRes.status === 200 &&
      masterPreviewRes.body?.data?.fileType === 'STUDENT_MASTER' &&
      masterPreviewRes.body?.data?.summary?.validRows === 3 &&
      masterPreviewRes.body?.data?.summary?.totalRows === 5 &&
      masterPreviewRes.body?.data?.summary?.duplicateRows === 1 &&
      typeof masterPreviewRes.body?.data?.importToken === 'string';

    const masterToken = masterPreviewRes.body?.data?.importToken;

    testResults.push({
      step: '1.1',
      name: 'Student Master: Upload & Preview API',
      passed: masterPreviewPassed,
      details: masterPreviewPassed
        ? `Detected STUDENT_MASTER, 3 valid, 1 invalid, 1 duplicate, token: ${masterToken?.slice(0, 10)}...`
        : `Failed: status=${masterPreviewRes.status}, body=${JSON.stringify(masterPreviewRes.body)}`,
    });
    console.log(`[TEST 1.1] ${masterPreviewPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 2: TYPE A - CONFIRM IMPORT INTO POSTGRESQL
    // =============================================================
    console.log('\n--- TEST 2: Student Master Confirm Import ---');
    const masterImportRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: masterToken,
        batchId: defaultBatchId,
        sectionId: defaultSectionId,
      }
    );

    const masterImportPassed =
      masterImportRes.status === 200 &&
      masterImportRes.body?.data?.insertedStudents === 3 &&
      masterImportRes.body?.data?.enrolledStudents === 3;

    testResults.push({
      step: '1.2',
      name: 'Student Master: Confirm Transactional Import',
      passed: masterImportPassed,
      details: masterImportPassed
        ? `Inserted: ${masterImportRes.body.data.insertedStudents}, Enrolled: ${masterImportRes.body.data.enrolledStudents}`
        : `Failed: status=${masterImportRes.status}, body=${JSON.stringify(masterImportRes.body)}`,
    });
    console.log(`[TEST 1.2] ${masterImportPassed ? 'PASSED' : 'FAILED'}`);

    // Verify in database
    const verifyMasterDb = await query(
      'SELECT id, hall_ticket_number, full_name, email FROM students WHERE hall_ticket_number = ANY($1)',
      [testHTs]
    );
    const dbVerificationPassed = verifyMasterDb.rows.length === 3;
    testResults.push({
      step: '1.3',
      name: 'Student Master: Verify PostgreSQL Records',
      passed: dbVerificationPassed,
      details: dbVerificationPassed
        ? `Found 3 verified students in database: ${verifyMasterDb.rows.map(r => r.hall_ticket_number).join(', ')}`
        : `Failed: expected 3, found ${verifyMasterDb.rows.length}`,
    });
    console.log(`[TEST 1.3] ${dbVerificationPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 3: IDEMPOTENCY / RE-IMPORT SKIP LOGIC
    // =============================================================
    console.log('\n--- TEST 3: Student Master Re-import / Duplicate Skip ---');
    // Upload again to get a new token
    const masterRePreview = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'TEST_Student_Master_2026.xlsx',
      masterBuf
    );
    const reToken = masterRePreview.body?.data?.importToken;

    const reImportRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: reToken,
        batchId: defaultBatchId,
        sectionId: defaultSectionId,
      }
    );

    const reImportPassed =
      reImportRes.status === 200 &&
      reImportRes.body?.data?.insertedStudents === 0 &&
      reImportRes.body?.data?.skippedStudents === 3;

    testResults.push({
      step: '1.4',
      name: 'Student Master: Safe Duplicate Skip Idempotency',
      passed: reImportPassed,
      details: reImportPassed
        ? `Safely skipped: 3 existing students, 0 duplicate errors`
        : `Failed: status=${reImportRes.status}, body=${JSON.stringify(reImportRes.body)}`,
    });
    console.log(`[TEST 1.4] ${reImportPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 4: TYPE B - EXAMINATION RESULTS WIDE FORMAT PARSER & PREVIEW
    // =============================================================
    console.log('\n--- TEST 4: Examination Results Upload & Preview (Wide Format) ---');
    const examRows = [
      ['JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY'],
      ['EXAMINATIONS BRANCH - SEMESTER END RESULTS'],
      ['REGULATION: R20', 'MONTH & YEAR: JAN 2024', 'EXAMINATION: REGULAR'],
      [],
      // Row 1: High-level subject headers & summary headers
      ['HTNO', 'STUDENT NAME', sub1, sub1, sub1, sub1, sub1, sub2, sub2, sub2, sub2, sub2, 'SGPA', 'CGPA', 'RESULT'],
      // Row 2: Sub-component headers
      ['', '', 'INT', 'EXT', 'TOT', 'GRD', 'RES', 'INT', 'EXT', 'TOT', 'GRD', 'RES', '', '', ''],
      // Data Rows
      ['TEST2026001', 'Alice Brown', 25, 60, 85, 'A+', 'PASS', 24, 55, 79, 'A', 'PASS', 8.50, 8.50, 'PASS'],
      ['TEST2026002', 'Bob Smith', 20, 45, 65, 'B', 'PASS', 18, 30, 48, 'C', 'PASS', 7.20, 7.20, 'PASS'],
      ['TEST2026003', 'Charlie Dave', 15, 20, 35, 'F', 'FAIL', 22, 50, 72, 'A', 'PASS', 5.50, 5.50, 'PROMOTED'],
    ];

    const examWs = xlsx.utils.aoa_to_sheet(examRows);
    const examWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(examWb, examWs, 'ExamResults');
    const examBuf = xlsx.write(examWb, { type: 'buffer', bookType: 'xlsx' });

    const examPreviewRes = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'TEST_Exam_Results_R20.xlsx',
      examBuf
    );

    const examPreviewPassed =
      examPreviewRes.status === 200 &&
      examPreviewRes.body?.data?.fileType === 'EXAMINATION_RESULT' &&
      examPreviewRes.body?.data?.detectedSubjects?.length === 2 &&
      examPreviewRes.body?.data?.summary?.totalStudents === 3 &&
      typeof examPreviewRes.body?.data?.importToken === 'string';

    const examToken = examPreviewRes.body?.data?.importToken;

    testResults.push({
      step: '2.1',
      name: 'Examination Results: Wide Format Upload & Preview',
      passed: examPreviewPassed,
      details: examPreviewPassed
        ? `Detected EXAMINATION_RESULT, 2 subjects (${sub1}, ${sub2}), 3 students normalized`
        : `Failed: status=${examPreviewRes.status}, body=${JSON.stringify(examPreviewRes.body)}`,
    });
    console.log(`[TEST 2.1] ${examPreviewPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 5: TYPE B - CONFIRM EXAMINATION RESULTS IMPORT
    // =============================================================
    console.log('\n--- TEST 5: Examination Results Confirm Import ---');
    const examImportRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: examToken,
        examinationId: defaultExamId,
      }
    );

    const examImportPassed =
      examImportRes.status === 200 &&
      examImportRes.body?.data?.studentsProcessed === 3 &&
      examImportRes.body?.data?.resultsInserted === 6 && // 3 students * 2 subjects
      examImportRes.body?.data?.semesterSummariesInserted === 3;

    testResults.push({
      step: '2.2',
      name: 'Examination Results: Wide-to-Normalized PostgreSQL Transaction',
      passed: examImportPassed,
      details: examImportPassed
        ? `Processed 3 students, inserted 6 normalized exam_results, 3 student_semester_results`
        : `Failed: status=${examImportRes.status}, body=${JSON.stringify(examImportRes.body)}`,
    });
    console.log(`[TEST 2.2] ${examImportPassed ? 'PASSED' : 'FAILED'}`);

    // Verify in database
    const verifyExamResults = await query(`
      SELECT er.id, er.internal_marks, er.external_marks, er.total_marks, er.grade, er.result_status, s.subject_code, st.hall_ticket_number
      FROM exam_results er
      JOIN students st ON er.student_id = st.id
      JOIN subjects s ON er.subject_id = s.id
      WHERE st.hall_ticket_number = ANY($1)
    `, [testHTs]);

    const verifySemResults = await query(`
      SELECT sr.id, sr.sgpa, sr.cgpa, sr.overall_result, st.hall_ticket_number
      FROM student_semester_results sr
      JOIN students st ON sr.student_id = st.id
      WHERE st.hall_ticket_number = ANY($1)
    `, [testHTs]);

    const examDbPassed = verifyExamResults.rows.length === 6 && verifySemResults.rows.length === 3;
    testResults.push({
      step: '2.3',
      name: 'Examination Results: Verify Normalized DB Tables',
      passed: examDbPassed,
      details: examDbPassed
        ? `Verified: 6 exam_results rows and 3 student_semester_results rows present in PostgreSQL`
        : `Failed: exam_results=${verifyExamResults.rows.length} (expected 6), semester_results=${verifySemResults.rows.length} (expected 3)`,
    });
    console.log(`[TEST 2.3] ${examDbPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 6: DUPLICATE EXAMINATION IMPORT PREVENTION
    // =============================================================
    console.log('\n--- TEST 6: Duplicate Exam Result Import Prevention ---');
    const examRePreview = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'TEST_Exam_Results_R20.xlsx',
      examBuf
    );
    const reExamToken = examRePreview.body?.data?.importToken;

    const dupImportRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: reExamToken,
        examinationId: defaultExamId,
      }
    );

    const dupBlockedPassed = dupImportRes.status === 409;
    testResults.push({
      step: '2.4',
      name: 'Duplicate Examination File Prevention (409 Conflict)',
      passed: dupBlockedPassed,
      details: dupBlockedPassed
        ? `Successfully blocked duplicate import with 409 Conflict: ${dupImportRes.body?.message}`
        : `Failed: expected 409, got ${dupImportRes.status}`,
    });
    console.log(`[TEST 2.4] ${dupBlockedPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 7: INVALID / EXPIRED TOKEN REJECTION
    // =============================================================
    console.log('\n--- TEST 7: Invalid Token Rejection ---');
    const badTokenRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: 'invalid_token_1234567890abcdef',
        batchId: defaultBatchId,
      }
    );

    const badTokenPassed = badTokenRes.status === 400;
    testResults.push({
      step: '3.1',
      name: 'Security: Invalid/Expired Staging Token Rejection (400)',
      passed: badTokenPassed,
      details: badTokenPassed
        ? `Correctly rejected invalid token with 400 Bad Request: ${badTokenRes.body?.message}`
        : `Failed: expected 400, got ${badTokenRes.status}`,
    });
    console.log(`[TEST 3.1] ${badTokenPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 8: UPLOAD AUDIT HISTORY API
    // =============================================================
    console.log('\n--- TEST 8: Upload Audit History API ---');
    const historyRes = await sendJsonRequest(server, 'GET', '/api/excel-upload/history');
    const historyPassed =
      historyRes.status === 200 &&
      Array.isArray(historyRes.body?.data) &&
      historyRes.body?.data.length > 0;

    testResults.push({
      step: '4.1',
      name: 'Audit Trail: Upload History API',
      passed: historyPassed,
      details: historyPassed
        ? `Retrieved ${historyRes.body.data.length} audit records from excel_uploads table`
        : `Failed: status=${historyRes.status}`,
    });
    console.log(`[TEST 4.1] ${historyPassed ? 'PASSED' : 'FAILED'}`);

    // =============================================================
    // TEST 9: POSTGRESQL TRANSACTION ROLLBACK INTEGRITY
    // =============================================================
    console.log('\n--- TEST 9: Rollback on Invalid Examination ID ---');
    // Generate new buffer with new filename so hash is distinct
    const rollbackRows = [
      ['JAWAHARLAL NEHRU TECHNOLOGICAL UNIVERSITY'],
      ['EXAMINATIONS BRANCH - SEMESTER END RESULTS'],
      ['REGULATION: R20', 'MONTH & YEAR: JAN 2024', 'EXAMINATION: REGULAR'],
      [],
      ['HTNO', 'STUDENT NAME', sub1, sub1, sub1, sub1, sub1, 'SGPA', 'CGPA', 'RESULT'],
      ['', '', 'INT', 'EXT', 'TOT', 'GRD', 'RES', '', '', ''],
      ['TEST2026001', 'Alice Brown', 25, 60, 85, 'A+', 'PASS', 8.50, 8.50, 'PASS'],
    ];
    const rbWs = xlsx.utils.aoa_to_sheet(rollbackRows);
    const rbWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(rbWb, rbWs, 'Results');
    const rbBuf = xlsx.write(rbWb, { type: 'buffer', bookType: 'xlsx' });

    const rbPreview = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'TEST_Rollback_9999.xlsx',
      rbBuf
    );
    const rbToken = rbPreview.body?.data?.importToken;

    // Use non-existent examinationId = 999999
    const rbRes = await sendJsonRequest(
      server,
      'POST',
      '/api/excel-upload/import',
      {
        token: rbToken,
        examinationId: 999999,
      }
    );

    const rollbackPassed = rbRes.status === 400;
    testResults.push({
      step: '5.1',
      name: 'Transactional Integrity: Safe Rollback on Missing Foreign Key',
      passed: rollbackPassed,
      details: rollbackPassed
        ? `Cleanly aborted and rolled back with error: ${rbRes.body?.message}`
        : `Failed: expected 400, got ${rbRes.status}`,
    });
    console.log(`[TEST 5.1] ${rollbackPassed ? 'PASSED' : 'FAILED'}`);

    // Clean up test records
    await query('DELETE FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM student_semester_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM student_academic_enrollments WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number = ANY($1))', [testHTs]);
    await query('DELETE FROM students WHERE hall_ticket_number = ANY($1)', [testHTs]);
    await query("DELETE FROM excel_uploads WHERE file_name LIKE 'TEST_%'");
    console.log('\n[TEARDOWN] Test records cleaned up.');

  } finally {
    server.close();
    await closeDB();
  }

  // =============================================================
  // SUMMARY REPORT
  // =============================================================
  console.log('\n====================================================');
  console.log('TEST EXECUTION SUMMARY');
  console.log('====================================================');
  let allPassed = true;
  for (const r of testResults) {
    const symbol = r.passed ? '✓' : '✗';
    console.log(`${symbol} [${r.step}] ${r.name}: ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log('====================================================');
  console.log(`Overall Result: ${allPassed ? 'ALL TESTS PASSED (9/9)' : 'SOME TESTS FAILED'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runExcelImportTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
