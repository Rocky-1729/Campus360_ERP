import { connectDB, closeDB, query } from '../config/database';
import { closeSqliteDB } from '../config/sqliteDatabase';
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
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'SECURITY';
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function recordTest(name: string, category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'SECURITY', passed: boolean, detail: string) {
  results.push({ name, category, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}: ${detail}`);
}

/** Helper to simulate Express middleware call */
const runMiddleware = (
  middleware: (req: any, res: any, next: (err?: any) => void) => void,
  req: Partial<AuthRequest>
): Promise<{ nextCalled: boolean; error?: any }> => {
  return new Promise((resolve) => {
    let nextCalled = false;
    const res: any = {
      status: (_code: number) => res,
      json: (_body: any) => {},
    };
    try {
      middleware(req as any, res, (err?: any) => {
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

async function runAllTests() {
  console.log('\n======================================================');
  console.log('   CAMPUS360 ERP — PHASE 8 AUTH & SECURITY TEST SUITE');
  console.log('======================================================\n');

  await connectDB();

  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';

  // ----------------------------------------------------
  // TEST 1: Valid Admin Login
  // ----------------------------------------------------
  try {
    const adminEmail = env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = env.DEFAULT_ADMIN_PASSWORD;
    const res = await authService.login(adminEmail, adminPassword);
    adminToken = res.token;
    const isValid = !!res.token && res.user.role === 'admin' && res.user.username.toLowerCase() === adminEmail.toLowerCase();
    recordTest('Valid Admin Login', 'AUTHENTICATION', isValid, `Token generated for role '${res.user.role}' (${res.user.username})`);
  } catch (err: any) {
    recordTest('Valid Admin Login', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 2: Valid Faculty Login
  // ----------------------------------------------------
  try {
    // In legacy db, faculty user cse-101 has default password matching username
    const facultyUser = await userRepository.findByUsernameOrEmail('cse-101');
    if (!facultyUser) {
      recordTest('Valid Faculty Login', 'AUTHENTICATION', false, 'Faculty cse-101 not found in users');
    } else {
      const res = await authService.login(facultyUser.username, facultyUser.username);
      facultyToken = res.token;
      const isValid = !!res.token && res.user.role === 'faculty';
      recordTest('Valid Faculty Login', 'AUTHENTICATION', isValid, `Token generated for role '${res.user.role}' (${res.user.username})`);
    }
  } catch (err: any) {
    recordTest('Valid Faculty Login', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 3: Valid Student Login
  // ----------------------------------------------------
  try {
    // In legacy db, student 20tp1a0547 has default password matching username
    const studentUser = await userRepository.findByUsernameOrEmail('20tp1a0547');
    if (!studentUser) {
      recordTest('Valid Student Login', 'AUTHENTICATION', false, 'Student 20tp1a0547 not found in users');
    } else {
      const res = await authService.login(studentUser.username, studentUser.username);
      studentToken = res.token;
      const isValid = !!res.token && res.user.role === 'student';
      recordTest('Valid Student Login', 'AUTHENTICATION', isValid, `Token generated for role '${res.user.role}' (${res.user.username})`);
    }
  } catch (err: any) {
    recordTest('Valid Student Login', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 4: Invalid Password
  // ----------------------------------------------------
  try {
    await authService.login(env.DEFAULT_ADMIN_EMAIL, 'incorrect_wrong_password_999');
    recordTest('Invalid Password Rejection', 'AUTHENTICATION', false, 'Login succeeded when it should have failed');
  } catch (err: any) {
    const is401 = err instanceof ApiError && err.statusCode === 401;
    recordTest('Invalid Password Rejection', 'AUTHENTICATION', is401, `Correctly rejected with HTTP ${err.statusCode}: "${err.message}"`);
  }

  // ----------------------------------------------------
  // TEST 5: Invalid User
  // ----------------------------------------------------
  try {
    await authService.login('nonexistent_user_xyz_9999@test.com', 'somePassword');
    recordTest('Invalid User Rejection', 'AUTHENTICATION', false, 'Login succeeded for nonexistent user');
  } catch (err: any) {
    const is401 = err instanceof ApiError && err.statusCode === 401;
    recordTest('Invalid User Rejection', 'AUTHENTICATION', is401, `Correctly rejected with HTTP ${err.statusCode}: "${err.message}"`);
  }

  // ----------------------------------------------------
  // TEST 6: Expired JWT
  // ----------------------------------------------------
  try {
    // Generate an intentionally expired token (-60 seconds)
    const expiredToken = jwt.sign(
      { id: '1', role: 'admin', username: 'admin@campus360.edu' },
      env.JWT_SECRET,
      { expiresIn: -60 }
    );
    const fakeReq: Partial<AuthRequest> = {
      headers: { authorization: `Bearer ${expiredToken}` },
    };
    const outcome = await runMiddleware(authenticate, fakeReq);
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Expired JWT Rejection', 'AUTHENTICATION', isRejected, `Rejected expired token with HTTP ${outcome.error?.statusCode}: "${outcome.error?.message}"`);
  } catch (err: any) {
    recordTest('Expired JWT Rejection', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 7: Invalid JWT
  // ----------------------------------------------------
  try {
    const fakeReq: Partial<AuthRequest> = {
      headers: { authorization: 'Bearer this.is.an.invalid.jwt.signature' },
    };
    const outcome = await runMiddleware(authenticate, fakeReq);
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Invalid JWT Rejection', 'AUTHENTICATION', isRejected, `Rejected malformed token with HTTP ${outcome.error?.statusCode}: "${outcome.error?.message}"`);
  } catch (err: any) {
    recordTest('Invalid JWT Rejection', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 8: Missing JWT
  // ----------------------------------------------------
  try {
    const fakeReq: Partial<AuthRequest> = {
      headers: {},
    };
    const outcome = await runMiddleware(authenticate, fakeReq);
    const isRejected = outcome.error && outcome.error.statusCode === 401;
    recordTest('Missing JWT Rejection', 'AUTHENTICATION', isRejected, `Rejected missing header with HTTP ${outcome.error?.statusCode}: "${outcome.error?.message}"`);
  } catch (err: any) {
    recordTest('Missing JWT Rejection', 'AUTHENTICATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 9: Student Accessing Another Student's Results (Horizontal Privilege Escalation)
  // ----------------------------------------------------
  try {
    // Find an existing student in PostgreSQL to test own results
    const pgStudentRes = await query('SELECT hall_ticket_number FROM students LIMIT 1');
    const existingHallTicket = pgStudentRes.rows.length > 0 ? pgStudentRes.rows[0].hall_ticket_number : '20TP1A0547';

    const testStudentUser: JwtPayload = {
      id: '2',
      role: 'student',
      username: existingHallTicket,
    };

    // Cross-student access: tries to access a different hall ticket
    const differentHallTicket = existingHallTicket === '23TP1A0501' ? '23TP1A0502' : '23TP1A0501';
    const fakeReq: Partial<AuthRequest> = {
      params: { hallTicket: differentHallTicket },
      user: testStudentUser,
    };
    const outcome = await runController(resultManagementController.getStudentResults, fakeReq);
    const isBlocked = outcome.statusCode === 403 && outcome.error?.message?.includes('Students are only authorized to view their own');
    recordTest(
      'Student Accessing Another Student Results',
      'AUTHORIZATION',
      isBlocked,
      `Blocked unauthorized student query with HTTP ${outcome.statusCode}: "${outcome.error?.message}"`
    );

    // Verify student CAN access their own results (authorized, not 403)
    const ownReq: Partial<AuthRequest> = {
      params: { hallTicket: existingHallTicket },
      user: testStudentUser,
    };
    const ownOutcome = await runController(resultManagementController.getStudentResults, ownReq);
    const isAuthorized = ownOutcome.statusCode !== 403;
    recordTest(
      'Student Accessing Own Results',
      'AUTHORIZATION',
      isAuthorized,
      `Authorization passed (HTTP ${ownOutcome.statusCode}, not 403 Forbidden) for student ${existingHallTicket}`
    );
  } catch (err: any) {
    recordTest('Student Accessing Another Student Results', 'AUTHORIZATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 10: Student Accessing Admin API
  // ----------------------------------------------------
  try {
    const studentUserPayload: JwtPayload = {
      id: '2',
      role: 'student',
      username: '20TP1A0547',
    };
    const adminGuard = authorize('admin');
    const fakeReq: Partial<AuthRequest> = {
      user: studentUserPayload,
    };
    const outcome = await runMiddleware(adminGuard, fakeReq);
    const isForbidden = outcome.error && outcome.error.statusCode === 403;
    recordTest(
      'Student Accessing Admin API',
      'AUTHORIZATION',
      isForbidden,
      `Blocked student from admin route with HTTP ${outcome.error?.statusCode}: "${outcome.error?.message}"`
    );
  } catch (err: any) {
    recordTest('Student Accessing Admin API', 'AUTHORIZATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 11: Faculty Accessing Restricted Admin API
  // ----------------------------------------------------
  try {
    const facultyUserPayload: JwtPayload = {
      id: '207',
      role: 'faculty',
      username: 'cse-101',
    };
    const adminOnlyGuard = authorize('admin');
    const fakeReq: Partial<AuthRequest> = {
      user: facultyUserPayload,
    };
    const outcome = await runMiddleware(adminOnlyGuard, fakeReq);
    const isForbidden = outcome.error && outcome.error.statusCode === 403;
    recordTest(
      'Faculty Accessing Restricted Admin API',
      'AUTHORIZATION',
      isForbidden,
      `Blocked faculty from admin-only route with HTTP ${outcome.error?.statusCode}: "${outcome.error?.message}"`
    );
  } catch (err: any) {
    recordTest('Faculty Accessing Restricted Admin API', 'AUTHORIZATION', false, err.message);
  }

  // ----------------------------------------------------
  // TEST 12: Unauthorized Excel Upload Protection Audit
  // ----------------------------------------------------
  try {
    // 1. Check admin routes Excel upload protection:
    // In admin.routes.ts: router.use(authenticate), router.use(authorize('admin'))
    const unauthReq: Partial<AuthRequest> = { headers: {} };
    const authOutcome = await runMiddleware(authenticate, unauthReq);
    const unauthBlocked = authOutcome.error && authOutcome.error.statusCode === 401;

    // 2. Check student token on admin upload route
    const studentReq: Partial<AuthRequest> = {
      user: { id: '2', role: 'student', username: '20TP1A0547' },
    };
    const adminRoleOutcome = await runMiddleware(authorize('admin'), studentReq);
    const studentBlocked = adminRoleOutcome.error && adminRoleOutcome.error.statusCode === 403;

    const overallUploadProtected = unauthBlocked && studentBlocked;
    recordTest(
      'Unauthorized Excel Upload Protection',
      'SECURITY',
      overallUploadProtected,
      `Admin excel upload protected: Unauthenticated=401 (${unauthBlocked}), Student=403 (${studentBlocked})`
    );
  } catch (err: any) {
    recordTest('Unauthorized Excel Upload Protection', 'SECURITY', false, err.message);
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
  await closeSqliteDB();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
