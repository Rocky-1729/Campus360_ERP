import http from 'http';
import * as xlsx from 'xlsx';
import jwt from 'jsonwebtoken';
import app from '../app';
import { connectDB, closeDB, query } from '../config/database';
import { env } from '../config/environment';
import { ExaminationResultParser } from '../services/excel/examinationResultParser';
import { parseSemesterNumber } from '../services/excel/excelImport.service';

interface TestRecord {
  name: string;
  passed: boolean;
  category: string;
  detail: string;
}

const testResults: TestRecord[] = [];

function assert(condition: boolean, name: string, category: string, detail: string) {
  testResults.push({ name, passed: condition, category, detail });
  const icon = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${icon} [${category}] ${name} - ${detail}`);
}

/**
 * Creates an in-memory XLSX buffer with specified headers and rows
 */
function createTestWorkbook(
  headerRows: any[][],
  dataRows: any[][]
): Buffer {
  const wb = xlsx.utils.book_new();
  const allRows = [...headerRows, ...dataRows];
  const ws = xlsx.utils.aoa_to_sheet(allRows);
  xlsx.utils.book_append_sheet(wb, ws, 'Results');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export async function runDynamicExaminationTests() {
  console.log('\n================================================================');
  console.log('   DYNAMIC EXAMINATION, SEMESTER & GENERIC EXCEL TEST SUITE     ');
  console.log('================================================================\n');

  await connectDB();

  // Start HTTP test server on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  console.log(`Test server running at ${baseUrl}\n`);

  // Generate tokens for role tests
  const adminToken = jwt.sign({ id: '1', role: 'admin', username: 'admin@campus360.edu' }, env.JWT_SECRET, { expiresIn: '1h' });
  const facultyToken = jwt.sign({ id: '2', role: 'faculty', username: 'faculty_cse1' }, env.JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ id: '3', role: 'student', username: '23tp1a0501' }, env.JWT_SECRET, { expiresIn: '1h' });

  const createdTestExamIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: Role Authorization - ADMIN can create examination
    // -------------------------------------------------------------
    console.log('--- TEST 1: AUTHORIZATION - ADMIN CAN CREATE EXAMINATION ---');
    const adminCreateRes = await fetch(`${baseUrl}/examinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        examName: 'TEST Automated Admin Examination 2026',
        academicSessionId: 1,
        semesterId: 4,
        examType: 'REGULAR',
        examDate: '2026-05-15',
        status: 'DRAFT',
      }),
    });
    const adminCreateData: any = await adminCreateRes.json();
    assert(
      adminCreateRes.status === 201 && adminCreateData.success && adminCreateData.data.id,
      'Admin Role Authorization',
      'AUTH',
      `Admin successfully created examination with HTTP 201 (ID: ${adminCreateData.data?.id})`
    );
    if (adminCreateData.data?.id) {
      createdTestExamIds.push(adminCreateData.data.id);
    }

    // -------------------------------------------------------------
    // TEST 2: Role Authorization - FACULTY receives 403 Forbidden
    // -------------------------------------------------------------
    console.log('--- TEST 2: AUTHORIZATION - FACULTY FORBIDDEN ---');
    const facultyCreateRes = await fetch(`${baseUrl}/examinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        examName: 'Unauthorized Faculty Examination',
        academicSessionId: 1,
        semesterId: 4,
        examType: 'REGULAR',
      }),
    });
    assert(
      facultyCreateRes.status === 403,
      'Faculty Role Rejection',
      'AUTH',
      `Faculty received expected HTTP 403 Forbidden on POST /api/examinations`
    );

    // -------------------------------------------------------------
    // TEST 3: Role Authorization - STUDENT receives 403 Forbidden
    // -------------------------------------------------------------
    console.log('--- TEST 3: AUTHORIZATION - STUDENT FORBIDDEN ---');
    const studentCreateRes = await fetch(`${baseUrl}/examinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        examName: 'Unauthorized Student Examination',
        academicSessionId: 1,
        semesterId: 4,
        examType: 'REGULAR',
      }),
    });
    assert(
      studentCreateRes.status === 403,
      'Student Role Rejection',
      'AUTH',
      `Student received expected HTTP 403 Forbidden on POST /api/examinations`
    );

    // -------------------------------------------------------------
    // TEST 4: Multiple Semesters Retrieval
    // -------------------------------------------------------------
    console.log('--- TEST 4: MULTIPLE SEMESTERS RETRIEVAL ---');
    const semsRes = await fetch(`${baseUrl}/semesters`);
    const semsData: any = await semsRes.json();
    assert(
      semsRes.status === 200 && Array.isArray(semsData.data) && semsData.data.length === 8,
      'Multiple Semesters Retrieval',
      'SEMESTER',
      `Retrieved ${semsData.data?.length} semesters covering Semesters 1 through 8`
    );

    // -------------------------------------------------------------
    // TEST 5: Multiple Examinations Retrieval
    // -------------------------------------------------------------
    console.log('--- TEST 5: MULTIPLE EXAMINATIONS RETRIEVAL ---');
    const examsRes = await fetch(`${baseUrl}/examinations`);
    const examsData: any = await examsRes.json();
    assert(
      examsRes.status === 200 && Array.isArray(examsData.data) && examsData.data.length >= 60,
      'Multiple Examinations Retrieval',
      'EXAMINATION',
      `Retrieved ${examsData.data?.length} total examinations across all semesters and sessions`
    );

    // -------------------------------------------------------------
    // TEST 6: Semester-Specific Examination Filtering
    // -------------------------------------------------------------
    console.log('--- TEST 6: SEMESTER-SPECIFIC EXAMINATION FILTERING ---');
    const sem4ExamsRes = await fetch(`${baseUrl}/examinations?semesterId=4`);
    const sem4ExamsData: any = await sem4ExamsRes.json();
    const allAreSem4 = sem4ExamsData.data?.every((e: any) => Number(e.semesterNumber) === 4);
    assert(
      sem4ExamsRes.status === 200 && sem4ExamsData.data?.length > 0 && allAreSem4,
      'Semester-Specific Filtering',
      'FILTERING',
      `Filtered ${sem4ExamsData.data?.length} examinations, all belonging strictly to Semester 4`
    );

    // -------------------------------------------------------------
    // TEST 7: Regular Examination Selection
    // -------------------------------------------------------------
    console.log('--- TEST 7: REGULAR EXAMINATION SELECTION ---');
    const regularExamsRes = await fetch(`${baseUrl}/examinations?examinationType=REGULAR`);
    const regularExamsData: any = await regularExamsRes.json();
    const allRegular = regularExamsData.data?.every((e: any) => e.examType === 'REGULAR');
    assert(
      regularExamsRes.status === 200 && regularExamsData.data?.length > 0 && allRegular,
      'Regular Examination Filtering',
      'FILTERING',
      `Filtered ${regularExamsData.data?.length} Regular examinations with 100% type match`
    );

    // -------------------------------------------------------------
    // TEST 8: Supplementary Examination Selection
    // -------------------------------------------------------------
    console.log('--- TEST 8: SUPPLEMENTARY EXAMINATION SELECTION ---');
    const suppleExamsRes = await fetch(`${baseUrl}/examinations?examinationType=SUPPLEMENTARY`);
    const suppleExamsData: any = await suppleExamsRes.json();
    const allSupple = suppleExamsData.data?.every((e: any) => e.examType === 'SUPPLEMENTARY');
    assert(
      suppleExamsRes.status === 200 && suppleExamsData.data?.length > 0 && allSupple,
      'Supplementary Examination Filtering',
      'FILTERING',
      `Filtered ${suppleExamsData.data?.length} Supplementary examinations with 100% type match`
    );

    // -------------------------------------------------------------
    // TEST 9: Dynamic Excel Subject Detection (6, 8, 10 subjects)
    // -------------------------------------------------------------
    console.log('--- TEST 9: DYNAMIC EXCEL SUBJECT DETECTION ---');
    const subjectCountsToTest = [6, 8, 10];
    let allSubjectCountsPassed = true;

    for (const count of subjectCountsToTest) {
      const header1 = ['B.Tech III Year I Semester Regular Examinations Dec 2024'];
      const header2 = ['HTNO', 'STUDENT NAME'];
      const header3 = ['', ''];
      for (let i = 1; i <= count; i++) {
        const code = `CS${300 + i}`;
        header2.push(code, '', '', '');
        header3.push('INT', 'EXT', 'TOT', 'GRD');
      }
      header2.push('SGPA', 'CGPA', 'RESULT');
      header3.push('', '', '');

      const sampleStudent = ['23TP1A0501', 'Test Student'];
      for (let i = 1; i <= count; i++) {
        sampleStudent.push('25', '60', '85', 'A+');
      }
      sampleStudent.push('8.50', '8.50', 'PASS');

      const buf = createTestWorkbook([header1, header2, header3], [sampleStudent]);
      const wb = xlsx.read(buf, { type: 'buffer' });
      const parsed = ExaminationResultParser.parse(wb.Sheets['Results']);

      if (parsed.detectedSubjects.length !== count) {
        allSubjectCountsPassed = false;
        console.error(`Expected ${count} detected subjects, but got ${parsed.detectedSubjects.length}`);
      }
    }
    assert(
      allSubjectCountsPassed,
      'Dynamic Arbitrary Subject Count Detection',
      'PARSER',
      `Successfully detected varying subject counts (6, 8, and 10 subjects) without hardcoded limits`
    );

    // -------------------------------------------------------------
    // TEST 10: Column Header Aliases (Int/Internal, Ext/External, Tot/Total, Grd/Grade)
    // -------------------------------------------------------------
    console.log('--- TEST 10: COLUMN HEADER ALIASES ---');
    const aliasHeader1 = ['B.Tech I Year II Semester Regular Examinations May 2024'];
    const aliasHeader2 = ['HTNO', 'STUDENT NAME', 'CS101', '', '', '', 'MA101', '', '', '', 'SGPA', 'CGPA', 'RESULT'];
    const aliasHeader3 = ['', '', 'Internal', 'External', 'Total', 'Grade', 'Int', 'Ext', 'Tot', 'Grd', '', '', ''];
    const aliasRow = ['23TP1A0501', 'Alias Student', '28', '62', '90', 'O', '26', '58', '84', 'A+', '8.80', '8.80', 'PASS'];

    const aliasBuf = createTestWorkbook([aliasHeader1, aliasHeader2, aliasHeader3], [aliasRow]);
    const aliasWb = xlsx.read(aliasBuf, { type: 'buffer' });
    const aliasParsed = ExaminationResultParser.parse(aliasWb.Sheets['Results']);
    const cs101 = aliasParsed.detectedSubjects.find(s => s.subjectCode === 'CS101');
    const ma101 = aliasParsed.detectedSubjects.find(s => s.subjectCode === 'MA101');

    assert(
      Boolean(
        aliasParsed.detectedSubjects.length === 2 &&
        cs101?.hasInternal && cs101?.hasExternal && cs101?.hasTotal && cs101?.hasGrade &&
        ma101?.hasInternal && ma101?.hasExternal && ma101?.hasTotal && ma101?.hasGrade
      ),
      'Header Aliases Recognition',
      'PARSER',
      `Recognized both 'Internal/External/Total/Grade' and 'Int/Ext/Tot/Grd' cleanly`
    );

    // -------------------------------------------------------------
    // TEST 11: Strict Semester Mismatch Rejection
    // -------------------------------------------------------------
    console.log('--- TEST 11: STRICT SEMESTER MISMATCH REJECTION ---');
    // Prepare a Sem 4 spreadsheet buffer
    const sem4SpreadsheetHeader = ['B.Tech II Year II Semester Regular Examinations July 2025'];
    const sem4SpreadsheetCols = ['HTNO', 'STUDENT NAME', '23CS401PC-DM', '', '', '', 'SGPA', 'CGPA', 'RESULT'];
    const sem4SubHeaders = ['', '', 'INT', 'EXT', 'TOT', 'GRD', '', '', ''];
    const sem4StudentRow = ['23TP1A0501', 'Test Student', '25', '60', '85', 'A+', '8.25', '8.25', 'PASS'];

    const sem4Buf = createTestWorkbook([sem4SpreadsheetHeader, sem4SpreadsheetCols, sem4SubHeaders], [sem4StudentRow]);

    // Send to preview endpoint via FormData
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([sem4Buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'custom_sem4_results.xlsx'
    );

    const previewRes = await fetch(`${baseUrl}/excel/preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: formData,
    });
    const previewData: any = await previewRes.json();

    assert(
      previewRes.status === 200 && previewData.success && previewData.data.importToken,
      'Preview Staged for Semester Mismatch Test',
      'PREVIEW',
      `Staged import token: ${previewData.data?.importToken?.slice(0, 16)}... with detected semester: "${previewData.data?.metadata?.semester}"`
    );

    // Attempt to confirm against Examination ID 1 (which is Semester 1 Regular Examination Jan 2024)
    const mismatchConfirmRes = await fetch(`${baseUrl}/excel/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        token: previewData.data?.importToken,
        examinationId: 1, // Target is Semester 1!
      }),
    });
    const mismatchConfirmData: any = await mismatchConfirmRes.json();

    assert(
      mismatchConfirmRes.status === 400 && mismatchConfirmData.message?.includes('SEMESTER_MISMATCH'),
      'Strict Semester Mismatch Rejection',
      'VALIDATION',
      `Server strictly blocked import with HTTP 400 and SEMESTER_MISMATCH: "${mismatchConfirmData.message}"`
    );

    // -------------------------------------------------------------
    // TEST 12: Zero Hardcoded raghavendra.xlsx Dependency
    // -------------------------------------------------------------
    console.log('--- TEST 12: ZERO HARDCODED RAGHAVENDRA DEPENDENCY ---');
    const arbitraryFilename = 'university_annual_evaluation_dataset_2026.xlsx';
    const genericHeader = ['B.Tech I Year I Semester Regular Examinations Jan 2024'];
    const genericCols = ['HTNO', 'STUDENT NAME', 'CS101', '', '', '', 'SGPA', 'CGPA', 'RESULT'];
    const genericSub = ['', '', 'INT', 'EXT', 'TOT', 'GRD', '', '', ''];
    const genericRow = ['23TP1A0501', 'Generic Student', '25', '60', '85', 'A', '8.00', '8.00', 'PASS'];

    const genericBuf = createTestWorkbook([genericHeader, genericCols, genericSub], [genericRow]);
    const genericFormData = new FormData();
    genericFormData.append(
      'file',
      new Blob([genericBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      arbitraryFilename
    );

    const genericPreviewRes = await fetch(`${baseUrl}/excel/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: genericFormData,
    });
    const genericPreviewData: any = await genericPreviewRes.json();

    assert(
      genericPreviewRes.status === 200 && genericPreviewData.data.fileName === arbitraryFilename,
      'Arbitrary Filename Support',
      'GENERIC',
      `Successfully processed file named "${arbitraryFilename}" with zero static filename dependencies`
    );

  } finally {
    // Teardown: clean up test examinations created during tests
    if (createdTestExamIds.length > 0) {
      console.log(`\nCleaning up ${createdTestExamIds.length} test examination(s)...`);
      for (const id of createdTestExamIds) {
        await query('DELETE FROM examinations WHERE id = $1::bigint', [id]);
      }
      console.log('Cleanup completed cleanly.');
    }

    // Close server and database connection
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDB();
  }

  // Final Test Report Summary
  console.log('\n================================================================');
  console.log('                       TEST SUITE RESULTS                       ');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Tests Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nSome tests failed. Please review errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 12 AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

// Execute when invoked from CLI
if (require.main === module) {
  runDynamicExaminationTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
