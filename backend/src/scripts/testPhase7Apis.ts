import http from 'http';
import { connectDB, query, closeDB } from '../config/database';
import app from '../app';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

const adminAuthToken = jwt.sign(
  { id: '1', role: 'admin', username: 'admin@campus360.edu' },
  env.JWT_SECRET,
  { expiresIn: '1h' }
);

function makeRequest(
  server: http.Server,
  path: string,
  method: string = 'GET',
  body?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const payload = body ? JSON.stringify(body) : null;
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
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
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase7Tests() {
  await connectDB();
  console.log('====================================================');
  console.log('STARTING PHASE 7 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✓ [PASS] ${testName}`);
    } else {
      console.error(`✗ [FAIL] ${testName}`, detail !== undefined ? detail : '');
    }
  }

  let s1Id: any, s2Id: any, regExamId: any, suppExamId: any;

  try {
    // -------------------------------------------------------------
    // Test 1: Empty Database & Nonexistent Student Result
    // -------------------------------------------------------------
    console.log('--- Step 1: Baseline / Empty Data & Nonexistent Student Tests ---');

    const notFoundRes = await makeRequest(server, '/api/students/NONEXISTENT999/results');
    assert(notFoundRes.status === 404, 'Nonexistent student results query returns 404 Not Found');

    const emptyOverviewRes = await makeRequest(server, '/api/analytics/overview');
    assert(emptyOverviewRes.status === 200, 'Analytics overview returns 200 OK');
    assert(emptyOverviewRes.body.success === true, 'Analytics overview has success=true');
    assert(typeof emptyOverviewRes.body.data.totalStudents === 'number', 'totalStudents is a valid number');
    assert(
      emptyOverviewRes.body.data.studentsWithResults === 0
        ? emptyOverviewRes.body.data.passPercentage === null
        : typeof emptyOverviewRes.body.data.passPercentage === 'number',
      'Pass percentage is null or numeric (no NaN)'
    );

    const emptyDeptRes = await makeRequest(server, '/api/analytics/departments');
    assert(emptyDeptRes.status === 200, 'Department analytics returns 200 OK');
    assert(Array.isArray(emptyDeptRes.body.data), 'Department analytics returns an array');

    // -------------------------------------------------------------
    // Test 2: Seed Test Academic Data (Students, Exams, Results)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Seeding Test Students, Examinations & Results ---');

    const batchRes = await query(`SELECT id FROM academic_batches LIMIT 1`);
    const secRes = await query(`SELECT id FROM sections LIMIT 1`);
    const sessRes = await query(`SELECT id FROM academic_sessions LIMIT 1`);
    const semRes = await query(`SELECT id FROM semesters ORDER BY semester_number ASC LIMIT 2`);
    const subRes = await query(`SELECT id, subject_code FROM subjects LIMIT 2`);

    const batchId = batchRes.rows[0].id;
    const sectionId = secRes.rows[0].id;
    const sessionId = sessRes.rows[0].id;
    const sem1Id = semRes.rows[0].id;
    const sub1Id = subRes.rows[0].id;
    const sub2Id = subRes.rows[1] ? subRes.rows[1].id : sub1Id;

    const hallTicket1 = 'TEST7_001';
    const hallTicket2 = 'TEST7_002';

    // Cleanup previous test data if any
    await query(`DELETE FROM exam_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number IN ($1, $2))`, [hallTicket1, hallTicket2]);
    await query(`DELETE FROM student_semester_results WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number IN ($1, $2))`, [hallTicket1, hallTicket2]);
    await query(`DELETE FROM student_academic_enrollments WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number IN ($1, $2))`, [hallTicket1, hallTicket2]);
    await query(`DELETE FROM students WHERE hall_ticket_number IN ($1, $2)`, [hallTicket1, hallTicket2]);

    const s1Res = await query(
      `INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [hallTicket1, 'Test Student Alice', 'alice@test.edu', '9876543210', 'FEMALE']
    );
    s1Id = s1Res.rows[0].id;

    const s2Res = await query(
      `INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [hallTicket2, 'Test Student Bob', 'bob@test.edu', '9876543211', 'MALE']
    );
    s2Id = s2Res.rows[0].id;

    await query(
      `INSERT INTO student_academic_enrollments (student_id, academic_batch_id, section_id, enrollment_status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($4, $2, $3, 'ACTIVE')`,
      [s1Id, batchId, sectionId, s2Id]
    );

    const regExamRes = await query(
      `INSERT INTO examinations (academic_session_id, semester_id, exam_type, exam_name, exam_date, status)
       VALUES ($1, $2, 'REGULAR', 'Test Regular Exam Jan 2024', '2024-01-10', 'COMPLETED')
       RETURNING id`,
      [sessionId, sem1Id]
    );
    regExamId = regExamRes.rows[0].id;

    const suppExamRes = await query(
      `INSERT INTO examinations (academic_session_id, semester_id, exam_type, exam_name, exam_date, status)
       VALUES ($1, $2, 'SUPPLEMENTARY', 'Test Supplementary Exam Jun 2024', '2024-06-15', 'COMPLETED')
       RETURNING id`,
      [sessionId, sem1Id]
    );
    suppExamId = suppExamRes.rows[0].id;

    // Alice:
    // Regular exam: Sub 1 PASS, Sub 2 FAIL (attempt 1) -> overall FAIL
    await query(
      `INSERT INTO exam_results (student_id, subject_id, examination_id, internal_marks, external_marks, total_marks, grade, result_status, attempt_number)
       VALUES 
       ($1, $2, $3, 35, 55, 90, 'A+', 'PASS', 1),
       ($1, $4, $3, 20, 15, 35, 'F', 'FAIL', 1)`,
      [s1Id, sub1Id, regExamId, sub2Id]
    );
    await query(
      `INSERT INTO student_semester_results (student_id, academic_session_id, semester_id, examination_id, sgpa, cgpa, total_credits, earned_credits, overall_result)
       VALUES ($1, $2, $3, $4, 5.5, 5.5, 20, 16, 'FAIL')`,
      [s1Id, sessionId, sem1Id, regExamId]
    );

    // Supplementary exam: Alice clears Sub 2 with attempt 2 -> overall PASS
    await query(
      `INSERT INTO exam_results (student_id, subject_id, examination_id, internal_marks, external_marks, total_marks, grade, result_status, attempt_number)
       VALUES ($1, $2, $3, 20, 40, 60, 'B', 'PASS', 2)`,
      [s1Id, sub2Id, suppExamId]
    );
    await query(
      `INSERT INTO student_semester_results (student_id, academic_session_id, semester_id, examination_id, sgpa, cgpa, total_credits, earned_credits, overall_result)
       VALUES ($1, $2, $3, $4, 7.2, 7.2, 20, 20, 'PASS')`,
      [s1Id, sessionId, sem1Id, suppExamId]
    );

    // Bob:
    // Regular exam: Sub 1 PASS, Sub 2 FAIL -> overall FAIL (No supplementary taken)
    await query(
      `INSERT INTO exam_results (student_id, subject_id, examination_id, internal_marks, external_marks, total_marks, grade, result_status, attempt_number)
       VALUES 
       ($1, $2, $3, 30, 45, 75, 'A', 'PASS', 1),
       ($1, $4, $3, 15, 10, 25, 'F', 'FAIL', 1)`,
      [s2Id, sub1Id, regExamId, sub2Id]
    );
    await query(
      `INSERT INTO student_semester_results (student_id, academic_session_id, semester_id, examination_id, sgpa, cgpa, total_credits, earned_credits, overall_result)
       VALUES ($1, $2, $3, $4, 5.0, 5.0, 20, 16, 'FAIL')`,
      [s2Id, sessionId, sem1Id, regExamId]
    );

    console.log('Seeded Alice (backlog cleared in supplementary) and Bob (1 active backlog).');

    // -------------------------------------------------------------
    // Test 3: Student Result API (GET /api/students/:hallTicket/results)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Student Result API Testing ---');

    const aliceRes = await makeRequest(server, `/api/students/${hallTicket1}/results`);
    assert(aliceRes.status === 200, 'GET student results returns 200 OK');
    assert(aliceRes.body.data.student.hallTicketNumber === hallTicket1, 'Student identity matches requested hall ticket');
    assert(aliceRes.body.data.results.length === 2, 'Alice has 2 examination records (Regular & Supplementary)');

    const regResult = aliceRes.body.data.results.find((r: any) => r.examination.examType === 'REGULAR');
    assert(regResult !== undefined, 'Regular examination found in student history');
    assert(regResult.subjects.length === 2, 'Regular exam contains 2 subjects');
    assert(regResult.summary.overallResult === 'FAIL', 'Regular exam overallResult is FAIL');

    const suppResult = aliceRes.body.data.results.find((r: any) => r.examination.examType === 'SUPPLEMENTARY');
    assert(suppResult !== undefined, 'Supplementary examination found in student history');
    assert(suppResult.subjects[0].resultStatus === 'PASS', 'Supplementary subject attempt cleared with PASS');
    assert(suppResult.summary.overallResult === 'PASS', 'Supplementary exam overallResult is PASS');

    // -------------------------------------------------------------
    // Test 4: Examination Results Ledger API (GET /api/examinations/:id/results)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Examination Results Ledger API Testing ---');

    const examLedgerRes = await makeRequest(server, `/api/examinations/${regExamId}/results?page=1&limit=10`);
    assert(examLedgerRes.status === 200, 'GET examination results ledger returns 200 OK');
    assert(examLedgerRes.body.data.pagination.total >= 2, 'Ledger includes both Alice and Bob');
    assert(Array.isArray(examLedgerRes.body.data.students), 'Students list is returned as an array');
    assert(examLedgerRes.body.data.students[0].subjectResults.length > 0, 'Student rows include subjectResults breakdown');

    // Search filter test
    const searchRes = await makeRequest(server, `/api/examinations/${regExamId}/results?search=Alice`);
    assert(searchRes.status === 200, 'Search filter on examination ledger returns 200 OK');
    assert(searchRes.body.data.students.length === 1, 'Search query "Alice" filters to exactly 1 student');
    assert(searchRes.body.data.students[0].hallTicketNumber === hallTicket1, 'Filtered student is Alice');

    // Invalid examination ID
    const invalidExamRes = await makeRequest(server, `/api/examinations/9999999/results`);
    assert(invalidExamRes.status === 404, 'Invalid examination ID returns 404 Not Found');

    // -------------------------------------------------------------
    // Test 5: Backlog Calculation & Analytics Overview
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Active Backlogs and Overview Analytics ---');

    const overviewRes = await makeRequest(server, '/api/analytics/overview');
    assert(overviewRes.status === 200, 'GET /api/analytics/overview returns 200 OK');
    const ov = overviewRes.body.data;
    assert(ov.totalStudents >= 2, 'Total students count includes seeded students');
    assert(ov.studentsWithResults >= 2, 'Students with results count is at least 2');

    // Backlog verification:
    // Alice cleared her backlog in supplementary exam -> 0 active backlogs
    // Bob has 1 active backlog
    console.log('Backlog Distribution from Database:', ov.backlogDistribution);
    assert(ov.backlogDistribution.oneBacklog >= 1, 'At least 1 student has exactly 1 active backlog (Bob)');
    assert(ov.backlogDistribution.totalBacklogStudents >= 1, 'totalBacklogStudents correctly includes Bob');

    assert(typeof ov.cgpaDistribution['9.0 - 10.0'] === 'number', 'cgpaDistribution 9-10 bucket is numeric');
    assert(typeof ov.cgpaDistribution['7.0 - 7.99'] === 'number', 'cgpaDistribution 7-8 bucket is numeric');

    // -------------------------------------------------------------
    // Test 6: Department Analytics API (GET /api/analytics/departments)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Department Analytics API Testing ---');

    const deptAnalyticsRes = await makeRequest(server, '/api/analytics/departments');
    assert(deptAnalyticsRes.status === 200, 'GET /api/analytics/departments returns 200 OK');
    assert(deptAnalyticsRes.body.data.length > 0, 'Returns at least one department row');
    const d0 = deptAnalyticsRes.body.data[0];
    assert(d0.departmentName !== undefined, 'Department has departmentName');
    assert(typeof d0.totalStudents === 'number', 'Department totalStudents is numeric');

    // -------------------------------------------------------------
    // Test 7: Examination Performance Analytics (GET /api/analytics/examinations/:id/performance)
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Examination Performance Analytics Testing ---');

    const perfRes = await makeRequest(server, `/api/analytics/examinations/${regExamId}/performance`);
    assert(perfRes.status === 200, 'GET examination performance returns 200 OK');
    const perf = perfRes.body.data;
    assert(perf.totalAppeared >= 2, 'Examination total appeared is at least 2');
    assert(typeof perf.gradeDistribution === 'object', 'Grade distribution is returned as an object');
    assert(perf.subjects.length > 0, 'Subject performance array is populated');
    const sPerf = perf.subjects[0];
    assert(sPerf.subjectCode !== undefined, 'Subject performance row has subjectCode');
    assert(typeof sPerf.appeared === 'number', 'Subject appeared is numeric');
    assert(typeof sPerf.averageTotalMarks === 'number', 'Subject averageTotalMarks is numeric');

    // -------------------------------------------------------------
    // Test 8: Security & Parameter Validation
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Security & Parameter Validation Testing ---');

    const badParamRes = await makeRequest(server, '/api/analytics/overview?departmentId=abc');
    assert(badParamRes.status === 400, 'Invalid alphanumeric departmentId returns 400 Bad Request');

    const badExamIdRes = await makeRequest(server, '/api/examinations/invalid/results');
    assert(badExamIdRes.status === 400, 'Invalid examinationId string returns 400 Bad Request');

  } catch (error) {
    console.error('Fatal error during test execution:', error);
  } finally {
    // Cleanup Test Data
    console.log('\n--- Cleanup: Removing seeded test records ---');
    try {
      if (s1Id && s2Id) {
        await query(`DELETE FROM exam_results WHERE student_id IN ($1, $2)`, [s1Id, s2Id]);
        await query(`DELETE FROM student_semester_results WHERE student_id IN ($1, $2)`, [s1Id, s2Id]);
        await query(`DELETE FROM student_academic_enrollments WHERE student_id IN ($1, $2)`, [s1Id, s2Id]);
        await query(`DELETE FROM students WHERE id IN ($1, $2)`, [s1Id, s2Id]);
      }
      if (regExamId && suppExamId) {
        await query(`DELETE FROM examinations WHERE id IN ($1, $2)`, [regExamId, suppExamId]);
      }
      console.log('Cleaned up test records.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

    server.close();
    await closeDB();
    console.log('\n====================================================');
    console.log(`PHASE 7 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log('====================================================');
    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runPhase7Tests();
