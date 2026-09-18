import http from 'http';
import app from '../app';
import { connectDB, closeDB } from '../config/database';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  count: number;
  message: string;
  sample?: any;
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

async function runTests() {
  console.log('====================================================');
  console.log('Campus360 ERP — Phase 2 Academic Structure API Tests');
  console.log('====================================================\n');

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const testEndpoints = [
    '/api/departments',
    '/api/programs',
    '/api/programs?departmentId=1',
    '/api/programs?departmentId=999',
    '/api/programs?departmentId=invalid_id',
    '/api/academic-batches',
    '/api/academic-batches?programId=1',
    '/api/academic-batches?programId=999',
    '/api/sections',
    '/api/sections?batchId=1',
    '/api/sections?batchId=999',
    '/api/academic-sessions',
    '/api/academic-sessions?isActive=true',
    '/api/semesters',
  ];

  for (const endpoint of testEndpoints) {
    try {
      const response = await makeRequest(server, endpoint);
      const isOk = response.status >= 200 && response.status < 400;
      const dataArr = Array.isArray(response.body?.data) ? response.body.data : [];
      const count = dataArr.length;

      results.push({
        endpoint,
        status: response.status,
        success: isOk && (response.body?.success ?? true),
        count,
        message: response.body?.message || (isOk ? 'OK' : 'Error response'),
        sample: count > 0 ? dataArr[0] : (response.body?.data || null),
      });

      console.log(`[HTTP ${response.status}] ${endpoint.padEnd(42)} -> ${count} record(s) returned`);
      if (count > 0) {
        console.log(`         Sample: ${JSON.stringify(dataArr[0])}`);
      } else if (!isOk) {
        console.log(`         Error details: ${JSON.stringify(response.body)}`);
      }
      console.log('');
    } catch (err: any) {
      console.error(`Failed request for ${endpoint}:`, err.message);
      results.push({
        endpoint,
        status: 500,
        success: false,
        count: 0,
        message: err.message,
      });
    }
  }

  server.close();
  await closeDB();

  console.log('====================================================');
  console.log('Summary of Test Results:');
  console.log('====================================================');
  console.table(results.map(r => ({
    Endpoint: r.endpoint,
    Status: r.status,
    Success: r.success ? 'PASS' : 'FAIL',
    Records: r.count,
    Message: r.message,
  })));
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
