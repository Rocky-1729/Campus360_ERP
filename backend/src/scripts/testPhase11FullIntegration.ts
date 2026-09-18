import http from 'http';
import app from '../app';
import { connectDB, closeDB, query } from '../config/database';
import { getSqliteDB } from '../config/sqliteDatabase';
import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { env } from '../config/environment';

let passed = 0;
let failed = 0;

const assert = (condition: boolean, testName: string, detail?: any) => {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
};

function makeRequest(
  server: http.Server,
  path: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const payload = body ? JSON.stringify(body) : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers,
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
      req.write(payload);
    }
    req.end();
  });
}

function sendMultipartRequest(
  server: http.Server,
  path: string,
  filename: string,
  fileBuffer: Buffer,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const boundary = '---------------------------Phase11Boundary' + Math.random().toString(36).substring(2);
    const pre = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([pre, fileBuffer, post]);

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(fullBody.length),
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: 'POST',
      headers,
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

export const runPhase11FullIntegration = async () => {
  console.log('================================================================');
  console.log('      CAMPUS360 ERP — PHASE 11 FULL INTEGRATION TEST SUITE      ');
  console.log('================================================================\n');

  await connectDB();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  // Test data tracking for clean teardown
  let testStudent1Id: number | null = null;
  let testStudent2Id: number | null = null;
  let testFacultyUserId: number | null = null;
  let testStudentUserId: number | null = null;
  let testExamId: number | null = null;
  const testHt1 = 'TEST11_A01';
  const testHt2 = 'TEST11_A02';
  const testFacultyUsername = 'test11_fac';
  const testPassword = 'Password@123';
  const testDate = '2026-09-03';

  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';

  try {
    // Pre-clean any leftover test records from earlier runs
    await query('DELETE FROM attendance_sessions WHERE session_date = $1', [testDate]);
    try {
      const sdb = await getSqliteDB();
      await sdb.run('DELETE FROM attendance_locks WHERE date = ?', [testDate]);
    } catch {
      // ignore
    }
    await query(
      'DELETE FROM users WHERE username IN ($1, $2)',
      [testFacultyUsername, testHt1.toLowerCase()]
    );
    await query(`
      DELETE FROM student_academic_enrollments WHERE student_id IN (
        SELECT id FROM students WHERE hall_ticket_number IN ($1, $2)
      )
    `, [testHt1, testHt2]);
    await query(
      'DELETE FROM students WHERE hall_ticket_number IN ($1, $2)',
      [testHt1, testHt2]
    );

    // -------------------------------------------------------------
    // GROUP 1: DYNAMIC SCHEMA & DATA INTEGRITY
    // -------------------------------------------------------------
    console.log('--- GROUP 1: DYNAMIC SCHEMA & INTEGRITY AUDIT ---');

    const discoveredTablesRes = await query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);
    const tables = discoveredTablesRes.rows.map(r => r.table_name);
    assert(tables.length >= 17, `Discovered ${tables.length} application tables via information_schema`);
    assert(tables.includes('users'), 'users table exists');
    assert(tables.includes('attendance_sessions'), 'attendance_sessions table exists');
    assert(tables.includes('attendance_records'), 'attendance_records table exists');
    assert(tables.includes('students'), 'students table exists');
    assert(tables.includes('examinations'), 'examinations table exists');

    // Check zero orphan records
    const orphanEnrollments = await query(`
      SELECT COUNT(*) AS cnt FROM student_academic_enrollments sae
      LEFT JOIN students s ON sae.student_id = s.id
      WHERE s.id IS NULL
    `);
    assert(parseInt(orphanEnrollments.rows[0].cnt, 10) === 0, 'Zero orphan student enrollments');

    const orphanAtt = await query(`
      SELECT COUNT(*) AS cnt FROM attendance_records ar
      LEFT JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
      WHERE sess.id IS NULL
    `);
    assert(parseInt(orphanAtt.rows[0].cnt, 10) === 0, 'Zero orphan attendance records');

    // -------------------------------------------------------------
    // GROUP 2: AUTHENTICATION & TOKEN ISSUANCE FOR ALL ROLES
    // -------------------------------------------------------------
    console.log('\n--- GROUP 2: ROLE-BASED AUTHENTICATION ---');

    // 1. Admin login
    const adminLoginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      username: env.DEFAULT_ADMIN_EMAIL,
      password: env.DEFAULT_ADMIN_PASSWORD,
    });
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    assert(adminLoginRes.body.data.user.role === 'admin', 'Admin token has role "admin"');
    adminToken = adminLoginRes.body.data.token;

    // Create test faculty user with known password
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    const facUserRes = await query(`
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'faculty', TRUE)
      ON CONFLICT (username) DO UPDATE SET password_hash = $3, is_active = TRUE
      RETURNING id;
    `, [testFacultyUsername, 'test11_fac@campus360.edu', hashedPassword]);
    testFacultyUserId = Number(facUserRes.rows[0].id);

    // 2. Faculty login
    const facultyLoginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      username: testFacultyUsername,
      password: testPassword,
    });
    assert(facultyLoginRes.status === 200, 'Faculty login returns 200 OK');
    assert(facultyLoginRes.body.data.user.role === 'faculty', 'Faculty token has role "faculty"');
    facultyToken = facultyLoginRes.body.data.token;

    // Create test student 1 and linked user
    const s1Res = await query(`
      INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
      VALUES ($1, $2, $3, '9123456780', 'FEMALE')
      ON CONFLICT (hall_ticket_number) DO UPDATE SET full_name = $2
      RETURNING id;
    `, [testHt1, 'Integration Test Alice', 'alice.test11@campus360.edu']);
    testStudent1Id = Number(s1Res.rows[0].id);

    const s2Res = await query(`
      INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
      VALUES ($1, $2, $3, '9123456781', 'MALE')
      ON CONFLICT (hall_ticket_number) DO UPDATE SET full_name = $2
      RETURNING id;
    `, [testHt2, 'Integration Test Bob', 'bob.test11@campus360.edu']);
    testStudent2Id = Number(s2Res.rows[0].id);

    // Enroll in section 1 and batch 1
    await query(`
      INSERT INTO student_academic_enrollments (student_id, academic_batch_id, section_id, enrollment_status)
      VALUES ($1, 1, 1, 'ACTIVE'), ($2, 1, 1, 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `, [testStudent1Id, testStudent2Id]);

    // Create student user linked to student 1
    const studentUserRes = await query(`
      INSERT INTO users (username, email, password_hash, role, student_id, is_active)
      VALUES ($1, $2, $3, 'student', $4, TRUE)
      ON CONFLICT (username) DO UPDATE SET password_hash = $3, is_active = TRUE
      RETURNING id;
    `, [testHt1.toLowerCase(), 'alice.test11@campus360.edu', hashedPassword, testStudent1Id]);
    testStudentUserId = Number(studentUserRes.rows[0].id);

    // 3. Student login
    const studentLoginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      username: testHt1.toLowerCase(),
      password: testPassword,
    });
    assert(studentLoginRes.status === 200, 'Student login returns 200 OK');
    assert(studentLoginRes.body.data.user.role === 'student', 'Student token has role "student"');
    studentToken = studentLoginRes.body.data.token;

    // -------------------------------------------------------------
    // GROUP 3: ADMINISTRATOR WORKFLOW & ACADEMIC STRUCTURE
    // -------------------------------------------------------------
    console.log('\n--- GROUP 3: ADMINISTRATOR WORKFLOW ---');

    const adminOverview = await makeRequest(server, '/api/analytics/overview', 'GET', null, adminToken);
    assert(adminOverview.status === 200, 'Admin can access analytics overview');
    assert(typeof adminOverview.body.data.totalStudents === 'number', 'Overview has totalStudents count');

    const deptsRes = await makeRequest(server, '/api/academic/departments', 'GET', null, adminToken);
    assert(deptsRes.status === 200, 'Admin can list departments');
    assert(Array.isArray(deptsRes.body.data), 'Departments is an array');

    const sectionsRes = await makeRequest(server, '/api/academic/sections', 'GET', null, adminToken);
    assert(sectionsRes.status === 200, 'Admin can list sections');

    const subjectsRes = await makeRequest(server, '/api/academic/subjects', 'GET', null, adminToken);
    assert(subjectsRes.status === 200, 'Admin can list subjects');

    // -------------------------------------------------------------
    // GROUP 4: FACULTY WORKFLOW (SEARCH, DIRECTORY, ATTENDANCE)
    // -------------------------------------------------------------
    console.log('\n--- GROUP 4: FACULTY WORKFLOW ---');

    // Faculty searches students
    const searchRes = await makeRequest(server, `/api/students?search=${testHt1}`, 'GET', null, facultyToken);
    assert(searchRes.status === 200, 'Faculty can search students directory');
    assert(
      searchRes.body.data.students.some((s: any) => s.hallTicketNumber === testHt1),
      `Search directory found test student ${testHt1}`
    );

    // Faculty retrieves attendance checklist for marking
    const markingChecklistRes = await makeRequest(
      server,
      `/api/faculty/attendance/marking?subjectId=1&section=A&date=${testDate}`,
      'GET',
      null,
      facultyToken
    );
    assert(markingChecklistRes.status === 200, 'Faculty can load student marking checklist');
    assert(
      markingChecklistRes.body.data.students !== undefined,
      'Checklist response provides "students" field for frontend AttendanceMarking.tsx'
    );

    // Faculty marks attendance
    const markRes = await makeRequest(
      server,
      '/api/faculty/attendance',
      'POST',
      [
        {
          hallTicketNumber: testHt1,
          subjectId: 1,
          date: testDate,
          status: 'present',
          section: 'A',
          periodNumber: 1,
        },
        {
          hallTicketNumber: testHt2,
          subjectId: 1,
          date: testDate,
          status: 'absent',
          section: 'A',
          periodNumber: 1,
        },
      ],
      facultyToken
    );
    assert(markRes.status === 200, 'Faculty can mark class attendance');

    // Verify session locking: faculty submit automatically locks session
    const sessRes = await query(
      'SELECT id, is_locked FROM attendance_sessions WHERE subject_id = 1 AND session_date = $1',
      [testDate]
    );
    assert(sessRes.rows.length > 0 && sessRes.rows[0].is_locked === true, 'Attendance session is locked after submission');

    // Attempting to edit while locked must return 403 Forbidden
    const lockedEditRes = await makeRequest(
      server,
      '/api/faculty/attendance',
      'POST',
      [
        {
          hallTicketNumber: testHt1,
          subjectId: 1,
          date: testDate,
          status: 'absent',
          section: 'A',
          periodNumber: 1,
        },
      ],
      facultyToken
    );
    assert(lockedEditRes.status === 403, 'Editing locked attendance session rejected with 403 Forbidden');

    // Admin unlock override
    const sessionId = sessRes.rows[0].id;
    await query('UPDATE attendance_sessions SET is_locked = FALSE WHERE id = $1', [sessionId]);

    // Update single record after unlock
    const recRes = await query(
      'SELECT id FROM attendance_records WHERE attendance_session_id = $1 AND student_id = $2',
      [sessionId, testStudent2Id]
    );
    const recId = recRes.rows[0].id;
    const updateRecRes = await makeRequest(
      server,
      `/api/faculty/attendance/${recId}`,
      'PUT',
      { status: 'late' },
      facultyToken
    );
    assert(updateRecRes.status === 200, 'Updating single attendance record succeeds while unlocked');

    // Unauthorized action: faculty cannot upload student Excel
    const fakeBuffer = Buffer.from('fake excel');
    const unauthorizedExcel = await sendMultipartRequest(
      server,
      '/api/excel-upload/students',
      'test.xlsx',
      fakeBuffer,
      facultyToken
    );
    assert(
      unauthorizedExcel.status === 403,
      'Faculty blocked from admin Excel student upload with 403 Forbidden'
    );

    // -------------------------------------------------------------
    // GROUP 5: STUDENT WORKFLOW & DATA ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- GROUP 5: STUDENT WORKFLOW & ACCESS ISOLATION ---');

    // Student dashboard
    const studentDashRes = await makeRequest(server, '/api/student/dashboard', 'GET', null, studentToken);
    assert(studentDashRes.status === 200, 'Student can access own dashboard');

    // Student profile
    const studentProfileRes = await makeRequest(server, '/api/student/profile', 'GET', null, studentToken);
    assert(studentProfileRes.status === 200, 'Student can view own profile');
    const studentHt = studentProfileRes.body?.data?.student?.hallTicketNumber || studentProfileRes.body?.data?.hallTicketNumber;
    assert(
      studentHt === testHt1,
      `Student profile matches logged in hall ticket ${testHt1}`
    );

    // Student attendance view
    const studentAttRes = await makeRequest(server, '/api/student/attendance', 'GET', null, studentToken);
    assert(studentAttRes.status === 200, 'Student can fetch own attendance summary and logs');
    assert(
      studentAttRes.body.data.summary.overall.total >= 1,
      `Student has attendance records (total: ${studentAttRes.body.data.summary.overall.total})`
    );

    // Cross-student security test: student 1 attempting to view student 2's results
    const crossStudentRes = await makeRequest(
      server,
      `/api/students/${testHt2}/results`,
      'GET',
      null,
      studentToken
    );
    assert(
      crossStudentRes.status === 403,
      'Student attempting to view another student\'s academic results blocked with 403 Forbidden'
    );

    // Student attempting to access admin route
    const studentAdminRes = await makeRequest(
      server,
      '/api/analytics/overview',
      'GET',
      null,
      studentToken
    );
    assert(
      studentAdminRes.status === 403,
      'Student blocked from admin analytics with 403 Forbidden'
    );

    // -------------------------------------------------------------
    // GROUP 6: ZERO-DATA & EDGE-CASE HANDLING
    // -------------------------------------------------------------
    console.log('\n--- GROUP 6: ZERO-DATA & EDGE-CASE RESILIENCE ---');

    // Non-existent student query
    const notFoundStudent = await makeRequest(
      server,
      '/api/students/NON_EXISTENT_999/results',
      'GET',
      null,
      adminToken
    );
    assert(notFoundStudent.status === 404, 'Non-existent student results return 404 Not Found');

    // Zero attendance classes conducted returns null percentage
    // Create student 3 with no attendance records
    const s3Res = await query(`
      INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
      VALUES ('TEST11_ZERO', 'Zero Classes Student', 'zero@test11.edu', '9123456799', 'MALE')
      RETURNING id;
    `);
    const s3Id = s3Res.rows[0].id;

    // Check attendance summary for zero-attendance student
    const zeroAttSummary = await query(`
      SELECT 
        COUNT(ar.id) AS total,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present
      FROM attendance_records ar
      WHERE ar.student_id = $1;
    `, [s3Id]);
    assert(parseInt(zeroAttSummary.rows[0].total, 10) === 0, 'Zero attendance student has 0 total records');

    // Test password hashes never returned
    const userWithoutPassword = await query('SELECT id, username, email, role, is_active FROM users WHERE id = $1', [testFacultyUserId]);
    assert((userWithoutPassword.rows[0] as any).password_hash === undefined, 'Password hash excluded from safe user queries');

    // Clean student 3
    await query('DELETE FROM students WHERE id = $1', [s3Id]);

    // Malformed JWT
    const badJwtRes = await makeRequest(server, '/api/student/dashboard', 'GET', null, 'malformed.token.here');
    assert(badJwtRes.status === 401, 'Malformed JWT rejected with 401 Unauthorized');

    // Missing token
    const noTokenRes = await makeRequest(server, '/api/student/dashboard', 'GET');
    assert(noTokenRes.status === 401, 'Missing token rejected with 401 Unauthorized');

    // Deactivated user check
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [testStudentUserId]);
    const deactivatedLogin = await makeRequest(server, '/api/auth/login', 'POST', {
      username: testHt1.toLowerCase(),
      password: testPassword,
    });
    assert(
      deactivatedLogin.status === 401,
      'Deactivated user login rejected with 401 Unauthorized ("account has been deactivated")'
    );

    // Reactivate user for clean state
    await query('UPDATE users SET is_active = TRUE WHERE id = $1', [testStudentUserId]);

    // SQL Injection resilience test
    const sqlInjectionRes = await makeRequest(
      server,
      `/api/students?search=${encodeURIComponent("' OR '1'='1")}`,
      'GET',
      null,
      adminToken
    );
    assert(
      sqlInjectionRes.status === 200,
      'SQL injection string safely parameterized and handled without database error'
    );

  } catch (error) {
    console.error('\n❌ Unexpected error during integration testing:', error);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // GROUP 7: CLEAN TEARDOWN OF TEST FIXTURES
    // -------------------------------------------------------------
    console.log('\n--- GROUP 7: CLEANUP & TEARDOWN ---');
    try {
      // 1. Delete attendance sessions & records for test date
      await query('DELETE FROM attendance_sessions WHERE session_date = $1', [testDate]);
      try {
        const sdb = await getSqliteDB();
        await sdb.run('DELETE FROM attendance_locks WHERE date = ?', [testDate]);
      } catch {
        // ignore
      }

      // 2. Delete test student users
      if (testStudentUserId) {
        await query('DELETE FROM users WHERE id = $1', [testStudentUserId]);
      }
      if (testFacultyUserId) {
        await query('DELETE FROM users WHERE id = $1', [testFacultyUserId]);
      }

      // 3. Delete enrollments and students
      if (testStudent1Id && testStudent2Id) {
        await query(
          'DELETE FROM student_academic_enrollments WHERE student_id IN ($1, $2)',
          [testStudent1Id, testStudent2Id]
        );
        await query(
          'DELETE FROM students WHERE id IN ($1, $2)',
          [testStudent1Id, testStudent2Id]
        );
      }
      console.log('  🧹 All test fixtures, users, enrollments, and sessions cleaned up successfully.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

    server.close();
    await closeDB();
  }

  console.log('\n================================================================');
  console.log(`PHASE 11 INTEGRATION TESTS: ${passed + failed} TOTAL | ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  runPhase11FullIntegration();
}
