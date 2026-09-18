import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../app';
import { connectDB, closeDB } from '../config/database';
import { env } from '../config/environment';

function sendJsonRequest(
  server: http.Server,
  urlPath: string,
  method: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') return reject(new Error('Invalid server address'));

    const payload = body ? JSON.stringify(body) : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 0, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sendMultipartRequest(
  server: http.Server,
  urlPath: string,
  filename: string,
  fileBuffer: Buffer,
  token?: string
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
      path: urlPath,
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

async function run() {
  await connectDB();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    console.log('Logging in as admin...');
    const loginRes = await sendJsonRequest(server, '/api/auth/login', 'POST', {
      username: env.DEFAULT_ADMIN_EMAIL,
      password: env.DEFAULT_ADMIN_PASSWORD,
    });
    if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
    }
    const adminToken = loginRes.body.data.token;
    console.log('Admin login successful. Token acquired.');

    const filePath = 'C:\\Users\\chint\\Downloads\\raghavendra.xlsx';
    console.log('Reading file:', filePath);
    const fileBuf = fs.readFileSync(filePath);

    console.log('\n--- Sending /api/excel-upload/preview for raghavendra.xlsx ---');
    const previewRes = await sendMultipartRequest(
      server,
      '/api/excel-upload/preview',
      'raghavendra.xlsx',
      fileBuf,
      adminToken
    );

    console.log('HTTP Status:', previewRes.status);
    console.log('Response Success:', previewRes.body?.success);
    console.log('Message:', previewRes.body?.message);

    const data = previewRes.body?.data;
    if (!data) {
      console.error('No data returned!', previewRes.body);
      process.exit(1);
    }

    console.log('\n--- PREVIEW METADATA & SUMMARY ---');
    console.log('File Type:', data.fileType);
    console.log('Total Students:', data.summary?.totalStudents);
    console.log('Valid Students:', data.summary?.validStudents);
    console.log('Invalid Students:', data.summary?.invalidStudents);
    console.log('Total Subject Scores:', data.summary?.totalSubjectScores);
    console.log('Categorized Error Summary:', data.summary?.errorSummary);
    console.log('Detected Subjects Count:', data.detectedSubjects?.length);
    console.log('Import Token Generated:', typeof data.importToken === 'string' && data.importToken.length > 0);

    console.log('\n--- VALIDATION ERRORS (Exact Rows) ---');
    console.log('Count:', data.validationErrors?.length);
    console.log(JSON.stringify(data.validationErrors, null, 2));

    console.log('\n--- SAMPLE PREVIEW STUDENTS ---');
    console.log(JSON.stringify(data.preview?.slice(0, 2), null, 2));

    // Assertions
    const passed =
      previewRes.status === 200 &&
      data.fileType === 'EXAMINATION_RESULT' &&
      data.summary?.totalStudents === 205 &&
      data.summary?.validStudents === 203 &&
      data.summary?.invalidStudents === 2 &&
      data.summary?.totalSubjectScores === 2050 &&
      data.validationErrors?.length === 2 &&
      data.validationErrors[0]?.hallTicketNumber === '23TP1A0529' &&
      data.validationErrors[1]?.hallTicketNumber === '22TP1A0565';

    console.log('\n====================================================');
    console.log(`TEST VERIFICATION: ${passed ? 'PASSED (100% MATCH)' : 'FAILED'}`);
    console.log('====================================================');

    if (!passed) {
      process.exit(1);
    }
  } finally {
    server.close();
    await closeDB();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
