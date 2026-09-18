import http from 'http';
import app from '../app';
import { connectDB, closeDB } from '../config/database';

interface TestResult {
  name: string;
  endpoint: string;
  expectedStatus: number;
  actualStatus: number;
  success: boolean;
  message: string;
  dataSummary: string;
}

const results: TestResult[] = [];

function makeRequest(server: http.Server, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Invalid server address'));
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method: 'GET',
      headers: {
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
    req.end();
  });
}

async function runStudentTests() {
  console.log('====================================================');
  console.log('Campus360 ERP — Phase 3 Student & Enrollment Tests');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const testCases = [
    {
      name: '1. Basic Student List',
      endpoint: '/api/students',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students) && typeof body?.data?.pagination === 'object',
    },
    {
      name: '2. Pagination Query',
      endpoint: '/api/students?page=2&limit=10',
      expectedStatus: 200,
      validate: (body: any) => body?.data?.pagination?.page === 2 && body?.data?.pagination?.limit === 10,
    },
    {
      name: '3. Search by Name/HallTicket',
      endpoint: '/api/students?search=John',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '4. Department Filtering',
      endpoint: '/api/students?departmentId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '5. Program Filtering',
      endpoint: '/api/students?programId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '6. Batch Filtering',
      endpoint: '/api/students?batchId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '7. Section Filtering',
      endpoint: '/api/students?sectionId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '8. Status Filtering',
      endpoint: '/api/students?status=ACTIVE',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data?.students),
    },
    {
      name: '9. Invalid departmentId Validation',
      endpoint: '/api/students?departmentId=not_a_number',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '10. Invalid page Validation',
      endpoint: '/api/students?page=-5',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '11. Invalid limit Validation',
      endpoint: '/api/students?limit=invalid_limit',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '12. Nonexistent Student by ID (404)',
      endpoint: '/api/students/999999',
      expectedStatus: 404,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '13. Nonexistent Student by HallTicket (404)',
      endpoint: '/api/students/NONEXISTENT_HT123',
      expectedStatus: 404,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '14. Database Counts Endpoint',
      endpoint: '/api/students/status/counts',
      expectedStatus: 200,
      validate: (body: any) => typeof body?.data?.students === 'number' && typeof body?.data?.enrollments === 'number',
    },
  ];

  for (const tc of testCases) {
    try {
      const response = await makeRequest(server, tc.endpoint);
      const isStatusMatch = response.status === tc.expectedStatus;
      const isCustomValid = tc.validate(response.body);
      const pass = isStatusMatch && isCustomValid;

      let summary = '';
      if (response.status === 200) {
        if (Array.isArray(response.body?.data?.students)) {
          summary = `students: ${response.body.data.students.length}, total: ${response.body.data.pagination.total}`;
        } else if (typeof response.body?.data?.students === 'number') {
          summary = `students in DB: ${response.body.data.students}, enrollments in DB: ${response.body.data.enrollments}`;
        } else {
          summary = JSON.stringify(response.body?.data).slice(0, 50);
        }
      } else {
        summary = response.body?.message || 'Error';
      }

      results.push({
        name: tc.name,
        endpoint: tc.endpoint,
        expectedStatus: tc.expectedStatus,
        actualStatus: response.status,
        success: pass,
        message: response.body?.message || (pass ? 'OK' : 'Validation failure'),
        dataSummary: summary,
      });

      console.log(`[${pass ? 'PASS' : 'FAIL'}] [HTTP ${response.status}] ${tc.name.padEnd(36)} (${tc.endpoint})`);
      console.log(`       Details: ${summary}\n`);
    } catch (err: any) {
      console.error(`Error testing ${tc.name}:`, err.message);
      results.push({
        name: tc.name,
        endpoint: tc.endpoint,
        expectedStatus: tc.expectedStatus,
        actualStatus: 500,
        success: false,
        message: err.message,
        dataSummary: 'Request failure',
      });
    }
  }

  server.close();
  await closeDB();

  console.log('====================================================');
  console.log('Summary of Student & Enrollment Test Results:');
  console.log('====================================================');
  console.table(results.map(r => ({
    Test: r.name,
    Endpoint: r.endpoint,
    Expected: r.expectedStatus,
    Actual: r.actualStatus,
    Result: r.success ? 'PASS' : 'FAIL',
    Summary: r.dataSummary,
  })));
}

runStudentTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
