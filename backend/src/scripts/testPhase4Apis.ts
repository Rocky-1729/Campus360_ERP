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

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('Campus360 ERP — Phase 4 Subjects & Exam API Tests');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const testCases = [
    {
      name: '1. Basic Subjects List',
      endpoint: '/api/subjects',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '2. Subjects Filter by Semester',
      endpoint: '/api/subjects?semesterId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '3. Subjects Filter by Batch',
      endpoint: '/api/subjects?batchId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '4. Subjects Filter by Program',
      endpoint: '/api/subjects?programId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '5. Subjects Search (Name/Code)',
      endpoint: '/api/subjects?search=Computer',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '6. Subjects Invalid semesterId (400)',
      endpoint: '/api/subjects?semesterId=not_a_number',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '7. Basic Curriculum Subjects List',
      endpoint: '/api/curriculum-subjects',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '8. Curriculum Filter by Batch',
      endpoint: '/api/curriculum-subjects?batchId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '9. Curriculum Filter by Semester',
      endpoint: '/api/curriculum-subjects?semesterId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '10. Curriculum Invalid batchId (400)',
      endpoint: '/api/curriculum-subjects?batchId=invalid_val',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '11. Basic Examinations List',
      endpoint: '/api/examinations',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '12. Examinations Filter by Session',
      endpoint: '/api/examinations?academicSessionId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '13. Examinations Filter by Semester',
      endpoint: '/api/examinations?semesterId=1',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '14. Examinations Filter by Exam Type',
      endpoint: '/api/examinations?examinationType=REGULAR',
      expectedStatus: 200,
      validate: (body: any) => Array.isArray(body?.data),
    },
    {
      name: '15. Examinations Invalid exam_type (400)',
      endpoint: '/api/examinations?examinationType=UNKNOWN_TYPE',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '16. Examinations Invalid status (400)',
      endpoint: '/api/examinations?status=INVALID_STATUS',
      expectedStatus: 400,
      validate: (body: any) => body?.success === false,
    },
    {
      name: '17. Table Counts Verification',
      endpoint: '/api/exam-structure/counts',
      expectedStatus: 200,
      validate: (body: any) => typeof body?.data?.subjects === 'number',
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
        if (Array.isArray(response.body?.data)) {
          summary = `records: ${response.body.data.length}`;
        } else if (typeof response.body?.data === 'object' && response.body?.data !== null) {
          summary = JSON.stringify(response.body.data);
        } else {
          summary = String(response.body?.data);
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

      console.log(`[${pass ? 'PASS' : 'FAIL'}] [HTTP ${response.status}] ${tc.name.padEnd(40)} (${tc.endpoint})`);
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
  console.log('Summary of Phase 4 Test Results:');
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

runPhase4Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
