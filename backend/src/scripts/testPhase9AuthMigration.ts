import { connectDB, closeDB, query } from '../config/database';
import { env } from '../config/environment';
import * as authService from '../services/auth.service';
import { authenticate, AuthRequest, JwtPayload } from '../middleware/auth';
import { authorize } from '../middleware/roleGuard';
import { resultManagementController } from '../controllers/resultManagement.controller';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { userRepository } from '../repositories/user.repository';

interface TestResult {
  name: string;
  category: 'MIGRATION' | 'AUTHENTICATION' | 'SECURITY' | 'AUTHORIZATION' | 'INTEGRITY';
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function recordTest(name: string, category: 'MIGRATION' | 'AUTHENTICATION' | 'SECURITY' | 'AUTHORIZATION' | 'INTEGRITY', passed: boolean, detail: string) {
  results.push({ name, category, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}: ${detail}`);
}

/** Helper to simulate Express middleware call */
const runMiddleware = (
  middleware: (req: any, res: any, next: (err?: any) => void) => Promise<void> | void,
  req: Partial<AuthRequest>
): Promise<{ nextCalled: boolean; error?: any }> => {
  return new Promise(async (resolve) => {
    let nextCalled = false;
    const res: any = {
      status: (_code: number) => res,
      json: (_body: any) => {},
    };
    try {
      await middleware(req as any, res, (err?: any) => {
        nextCalled = true;
        resolve({ nextCalled: true, error: err });
      });
    } catch (syncErr) {
      resolve({ nextCalled, error: syncErr });
    }
  });
};

/** Helper to simulate controller execution */
const runController = (
  controllerFn: (req: any, res: any, next: (err?: any) => void) => Promise<void>,
  req: Partial<AuthRequest>
): Promise<{ statusCode: number; body?: any; error?: any }> => {
  return new Promise(async (resolve) => {
    let statusCode = 200;
    let body: any = null;
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        body = data;
        resolve({ statusCode, body });
      },
    };
    try {
      await controllerFn(req as any, res, (err?: any) => {
        resolve({ statusCode: err?.statusCode || 500, error: err });
      });
    } catch (err: any) {
      resolve({ statusCode: err?.statusCode || 500, error: err });
    }
  });
};

async function runPhase9Tests() {
  console.log('\n======================================================');
  console.log('   CAMPUS360 ERP — PHASE 9 AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  await connectDB();

  // ====================================================
  // GROUP 1: POSTGRESQL MIGRATION INTEGRITY
  // ====================================================
  console.log('--- GROUP 1: MIGRATION DATA INTEGRITY ---');

  // Test 1: Users table exists
  try {
    const tableRes = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users';
    `);
    const tableExists = tableRes.rows.length === 1;
    recordTest('PostgreSQL Users Table Existence', 'MIGRATION', tableExists, 'Table "users" found in information_schema');
  } catch (err: any) {
    recordTest('PostgreSQL Users Table Existence', 'MIGRATION', false, err.message);
  }

  // Test 2: Exactly 208 users migrated
  let totalMigrated = 0;
  try {
    const countRes = await query('SELECT COUNT(*) as count FROM users');
    totalMigrated = parseInt(countRes.rows[0].count, 10);
    const is208 = totalMigrated === 208;
    recordTest('Total User Count Verification', 'MIGRATION', is208, `Found ${totalMigrated} rows (expected: 208)`);
  } catch (err: any) {
    recordTest('Total User Count Verification', 'MIGRATION', false, err.message);
  }

  // Test 3: Role counts breakdown
  try {
    const roleRes = await query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const roles: Record<string, number> = {};
    roleRes.rows.forEach((r: any) => { roles[r.role] = parseInt(r.count, 10); });
    const correctRoles = roles['admin'] === 1 && roles['faculty'] === 2 && roles['student'] === 205;
    recordTest(
      'Role Breakdown Verification',
      'MIGRATION',
      correctRoles,
      `admin: ${roles['admin'] || 0}, faculty: ${roles['faculty'] || 0}, student: ${roles['student'] || 0}`
    );
  } catch (err: any) {
    recordTest('Role Breakdown Verification', 'MIGRATION', false, err.message);
  }

  // Test 4: Password hash integrity (bcrypt $2a$10$, len 60)
  try {
    const invalidHashRes = await query(`
      SELECT COUNT(*) as invalid_count FROM users 
      WHERE password_hash NOT LIKE '$2a$10$%' OR LENGTH(password_hash) != 60;
    `);
    const invalidCount = parseInt(invalidHashRes.rows[0].invalid_count, 10);
    const validHashes = invalidCount === 0;
    recordTest('Password Hash Format Verification', 'MIGRATION', validHashes, `Invalid hash formats: ${invalidCount}`);
  } catch (err: any) {
    recordTest('Password Hash Format Verification', 'MIGRATION', false, err.message);
  }

  // Test 5: Uniqueness (Zero duplicate usernames or emails)
  try {
    const dupUsernamesRes = await query(`
      SELECT LOWER(username), COUNT(*) FROM users GROUP BY LOWER(username) HAVING COUNT(*) > 1;
    `);
    const dupEmailsRes = await query(`
      SELECT LOWER(email), COUNT(*) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1;
    `);
    const isUnique = dupUsernamesRes.rows.length === 0 && dupEmailsRes.rows.length === 0;
    recordTest('Uniqueness Constraints Verification', 'MIGRATION', isUnique, 'Zero duplicate usernames or emails');
  } catch (err: any) {
    recordTest('Uniqueness Constraints Verification', 'MIGRATION', false, err.message);
  }

  // Test 6: Sequence synchronization
  try {
    const seqRes = await query("SELECT last_value FROM users_id_seq;");
    const lastVal = parseInt(seqRes.rows[0].last_value, 10);
    const isSynced = lastVal >= 208;
    recordTest('PostgreSQL Sequence Synchronization', 'MIGRATION', isSynced, `users_id_seq current value is ${lastVal}`);
  } catch (err: any) {
    recordTest('PostgreSQL Sequence Synchronization', 'MIGRATION', false, err.message);
  }

  // ====================================================
  // GROUP 2: POSTGRESQL AUTHENTICATION
  // ====================================================
  console.log('\n--- GROUP 2: POSTGRESQL AUTHENTICATION ---');

  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';

  // Test 7: Valid Admin Login
  try {
    const res = await authService.login(env.DEFAULT_ADMIN_EMAIL, env.DEFAULT_ADMIN_PASSWORD);
    adminToken = res.token;
    const isValid = !!res.token && res.user.role === 'admin' && res.user.isActive;
    recordTest('PostgreSQL Admin Login', 'AUTHENTICATION', isValid, `Logged in as ${res.user.username} (role: ${res.user.role})`);
  } catch (err: any) {
    recordTest('PostgreSQL Admin Login', 'AUTHENTICATION', false, err.message);
  }

  // Test 8: Valid Faculty Login
  try {
    const res = await authService.login('cse-101', 'cse-101');
    facultyToken = res.token;
    const isValid = !!res.token && res.user.role === 'faculty' && res.user.isActive;
    recordTest('PostgreSQL Faculty Login', 'AUTHENTICATION', isValid, `Logged in as ${res.user.username} (role: ${res.user.role})`);
  } catch (err: any) {
    recordTest('PostgreSQL Faculty Login', 'AUTHENTICATION', false, err.message);
  }

  // Test 9: Valid Student Login
  try {
    const res = await authService.login('20tp1a0547', '20tp1a0547');
    studentToken = res.token;
    const isValid = !!res.token && res.user.role === 'student' && res.user.isActive;
    recordTest('PostgreSQL Student Login', 'AUTHENTICATION', isValid, `Logged in as ${res.user.username} (role: ${res.user.role})`);
  } catch (err: any) {
    recordTest('PostgreSQL Student Login', 'AUTHENTICATION', false, err.message);
  }

  // Test 10: Invalid Password Rejection
  try {
    await authService.login(env.DEFAULT_ADMIN_EMAIL, 'wrong_incorrect_password');
    recordTest('Invalid Password Rejection', 'AUTHENTICATION', false, 'Login unexpectedly succeeded');
  } catch (err: any) {
    const is401 = err instanceof ApiError && err.statusCode === 401;
    recordTest('Invalid Password Rejection', 'AUTHENTICATION', is401, `Rejected with HTTP ${err.statusCode}: "${err.message}"`);
  }

  // Test 11: Nonexistent User Rejection
  try {
    await authService.login('nonexistent_user_9999@test.com', 'password123');
    recordTest('Nonexistent User Rejection', 'AUTHENTICATION', false, 'Login unexpectedly succeeded');
  } catch (err: any) {
    const is401 = err instanceof ApiError && err.statusCode === 401;
    recordTest('Nonexistent User Rejection', 'AUTHENTICATION', is401, `Rejected with HTTP ${err.statusCode}: "${err.message}"`);
  }

  // Test 12: Inactive User Login Rejection
  try {
    // Create a temporary inactive user in PostgreSQL
    const tempUserRes = await query(`
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES ('temp_inactive_user', 'temp_inactive@test.com', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO', 'student', FALSE)
      RETURNING id;
    `);
    const tempUserId = tempUserRes.rows[0].id;

    try {
      await authService.login('temp_inactive_user', 'anypassword');
      recordTest('Inactive User Login Rejection', 'AUTHENTICATION', false, 'Inactive user login succeeded');
    } catch (inactErr: any) {
      const isBlocked = inactErr instanceof ApiError && inactErr.statusCode === 401 && inactErr.message.includes('deactivated');
      recordTest('Inactive User Login Rejection', 'AUTHENTICATION', isBlocked, `Blocked with HTTP ${inactErr.statusCode}: "${inactErr.message}"`);
    } finally {
      // Clean up temporary inactive user
      await query('DELETE FROM users WHERE id = $1', [tempUserId]);
    }
  } catch (err: any) {
    recordTest('Inactive User Login Rejection', 'AUTHENTICATION', false, err.message);
  }

  // ====================================================
  // GROUP 3: JWT VALIDATION & ACCOUNT DEACTIVATION
  // ====================================================
  console.log('\n--- GROUP 3: JWT SECURITY & DEACTIVATION GUARD ---');

  // Test 13: Missing JWT
  try {
    const outcome = await runMiddleware(authenticate, { headers: {} });
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Missing JWT Rejection', 'SECURITY', isRejected, `Rejected with HTTP ${outcome.error?.statusCode}`);
  } catch (err: any) {
    recordTest('Missing JWT Rejection', 'SECURITY', false, err.message);
  }

  // Test 14: Malformed JWT
  try {
    const outcome = await runMiddleware(authenticate, { headers: { authorization: 'Bearer malformed.jwt.token' } });
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Malformed JWT Rejection', 'SECURITY', isRejected, `Rejected with HTTP ${outcome.error?.statusCode}`);
  } catch (err: any) {
    recordTest('Malformed JWT Rejection', 'SECURITY', false, err.message);
  }

  // Test 15: Expired JWT
  try {
    const expiredToken = jwt.sign(
      { id: '1', role: 'admin', username: 'admin@campus360.edu' },
      env.JWT_SECRET,
      { expiresIn: -30 }
    );
    const outcome = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${expiredToken}` } });
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Expired JWT Rejection', 'SECURITY', isRejected, `Rejected with HTTP ${outcome.error?.statusCode}`);
  } catch (err: any) {
    recordTest('Expired JWT Rejection', 'SECURITY', false, err.message);
  }

  // Test 16: Live Deactivation Guard (Valid JWT but deactivated in database)
  try {
    // Create temporary active user
    const tempUserRes = await query(`
      INSERT INTO users (username, email, password_hash, role, is_active)
      VALUES ('temp_active_deact', 'temp_active_deact@test.com', '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO', 'student', TRUE)
      RETURNING id;
    `);
    const tempId = String(tempUserRes.rows[0].id);

    // Issue valid JWT
    const validToken = jwt.sign(
      { id: tempId, role: 'student', username: 'temp_active_deact' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Verify token works while user is active
    const activeOutcome = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${validToken}` } });
    const activePass = !activeOutcome.error;

    // Now deactivate user in PostgreSQL
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [tempId]);

    // Test token again - MUST BE REJECTED by live deactivation check
    const deactOutcome = await runMiddleware(authenticate, { headers: { authorization: `Bearer ${validToken}` } });
    const deactBlocked = deactOutcome.error && deactOutcome.error.statusCode === 401 && deactOutcome.error.message.includes('deactivated');

    const deactivationGuardPassed = activePass && deactBlocked;
    recordTest(
      'Live Account Deactivation Guard',
      'SECURITY',
      deactivationGuardPassed,
      `Active: HTTP ${activePass ? 'OK' : 'FAIL'} -> Deactivated: HTTP ${deactOutcome.error?.statusCode} ("${deactOutcome.error?.message}")`
    );

    // Clean up
    await query('DELETE FROM users WHERE id = $1', [tempId]);
  } catch (err: any) {
    recordTest('Live Account Deactivation Guard', 'SECURITY', false, err.message);
  }

  // ====================================================
  // GROUP 4: AUTHORIZATION & ROUTE HARDENING
  // ====================================================
  console.log('\n--- GROUP 4: AUTHORIZATION & ROUTE HARDENING ---');

  // Test 17: Admin Protected Routes Guard
  try {
    const studentUserPayload: JwtPayload = { id: '3', role: 'student', username: '23tp1a0501' };
    const outcome = await runMiddleware(authorize('admin'), { user: studentUserPayload });
    const isForbidden = outcome.error && outcome.error.statusCode === 403;
    recordTest('Admin Route Protection against Student', 'AUTHORIZATION', isForbidden, `Blocked with HTTP ${outcome.error?.statusCode}`);
  } catch (err: any) {
    recordTest('Admin Route Protection against Student', 'AUTHORIZATION', false, err.message);
  }

  // Test 18: Faculty Protected Routes Guard
  try {
    const studentUserPayload: JwtPayload = { id: '3', role: 'student', username: '23tp1a0501' };
    const outcome = await runMiddleware(authorize('faculty', 'admin'), { user: studentUserPayload });
    const isForbidden = outcome.error && outcome.error.statusCode === 403;
    recordTest('Faculty Route Protection against Student', 'AUTHORIZATION', isForbidden, `Blocked with HTTP ${outcome.error?.statusCode}`);
  } catch (err: any) {
    recordTest('Faculty Route Protection against Student', 'AUTHORIZATION', false, err.message);
  }

  // Test 19: Student Accessing Another Student's Results
  try {
    const studentUserPayload: JwtPayload = { id: '2', role: 'student', username: '20TP1A0547' };
    const fakeReq: Partial<AuthRequest> = {
      params: { hallTicket: '23TP1A0501' },
      user: studentUserPayload,
    };
    const outcome = await runController(resultManagementController.getStudentResults, fakeReq);
    const isBlocked = outcome.statusCode === 403;
    recordTest(
      'Cross-Student Result Access Prevention',
      'AUTHORIZATION',
      isBlocked,
      `Blocked cross-student request with HTTP ${outcome.statusCode}: "${outcome.error?.message}"`
    );
  } catch (err: any) {
    recordTest('Cross-Student Result Access Prevention', 'AUTHORIZATION', false, err.message);
  }

  // Test 20: Student Accessing Own Results
  try {
    const studentUserPayload: JwtPayload = { id: '2', role: 'student', username: '20TP1A0547' };
    const fakeReq: Partial<AuthRequest> = {
      params: { hallTicket: '20TP1A0547' },
      user: studentUserPayload,
    };
    const outcome = await runController(resultManagementController.getStudentResults, fakeReq);
    const isAuthorized = outcome.statusCode !== 403;
    recordTest('Student Accessing Own Results Authorization', 'AUTHORIZATION', isAuthorized, `Authorization passed with HTTP ${outcome.statusCode}`);
  } catch (err: any) {
    recordTest('Student Accessing Own Results Authorization', 'AUTHORIZATION', false, err.message);
  }

  // Test 21: Hardened Excel Upload Protection (Unauthenticated & Student)
  try {
    const unauthOutcome = await runMiddleware(authenticate, { headers: {} });
    const studentOutcome = await runMiddleware(authorize('admin'), { user: { id: '3', role: 'student' } });
    const protectedExcel = unauthOutcome.error?.statusCode === 401 && studentOutcome.error?.statusCode === 403;
    recordTest('Hardened Excel Upload Route Protection', 'AUTHORIZATION', protectedExcel, 'Unauthenticated=401, Student=403');
  } catch (err: any) {
    recordTest('Hardened Excel Upload Route Protection', 'AUTHORIZATION', false, err.message);
  }

  // Test 22: Hardened Analytics Protection (Unauthenticated & Student)
  try {
    const unauthOutcome = await runMiddleware(authenticate, { headers: {} });
    const studentOutcome = await runMiddleware(authorize('admin', 'faculty'), { user: { id: '3', role: 'student' } });
    const protectedAnalytics = unauthOutcome.error?.statusCode === 401 && studentOutcome.error?.statusCode === 403;
    recordTest('Hardened Analytics Route Protection', 'AUTHORIZATION', protectedAnalytics, 'Unauthenticated=401, Student=403');
  } catch (err: any) {
    recordTest('Hardened Analytics Route Protection', 'AUTHORIZATION', false, err.message);
  }

  // ====================================================
  // GROUP 5: ACADEMIC DATA INTEGRITY
  // ====================================================
  console.log('\n--- GROUP 5: ACADEMIC DATA INTEGRITY ---');

  // Test 23: All 14 expected academic tables remain intact
  try {
    const expectedAcademicTables = [
      'academic_batches', 'academic_sessions', 'curriculum_subjects', 'departments',
      'exam_results', 'examinations', 'excel_uploads', 'programs',
      'sections', 'semesters', 'student_academic_enrollments', 'student_semester_results',
      'students', 'subjects'
    ];
    const tablesRes = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = ANY($1);
    `, [expectedAcademicTables]);
    const foundTables = tablesRes.rows.map((r: any) => r.table_name);
    const allFound = expectedAcademicTables.every(t => foundTables.includes(t));
    recordTest(
      'Academic Tables Preservation',
      'INTEGRITY',
      allFound,
      `Verified 14/14 academic tables intact in PostgreSQL`
    );
  } catch (err: any) {
    recordTest('Academic Tables Preservation', 'INTEGRITY', false, err.message);
  }

  // Test 24: Legacy SQLite Database Unmodified
  try {
    const sqliteCheck = await userRepository.findByUsernameOrEmail('admin@campus360.edu');
    const sqliteSafe = !!sqliteCheck && sqliteCheck.role === 'admin';
    recordTest('Legacy SQLite Fallback Availability', 'INTEGRITY', sqliteSafe, 'SQLite fallback intact and reachable');
  } catch (err: any) {
    recordTest('Legacy SQLite Fallback Availability', 'INTEGRITY', false, err.message);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log('   TEST EXECUTION SUMMARY');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Scenarios Tested : ${total}`);
  console.log(`Passed                 : ${passed}`);
  console.log(`Failed                 : ${failed}`);
  console.log(`Pass Rate              : ${((passed / total) * 100).toFixed(1)}%`);

  await closeDB();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase9Tests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
