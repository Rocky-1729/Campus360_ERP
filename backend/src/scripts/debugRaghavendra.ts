import fs from 'fs';
import * as xlsx from 'xlsx';
import { connectDB, query, closeDB } from '../config/database';
import { ExaminationResultParser } from '../services/excel/examinationResultParser';

async function run() {
  const filePath = 'C:\\Users\\chint\\Downloads\\raghavendra.xlsx';
  const buf = fs.readFileSync(filePath);
  const workbook = xlsx.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  console.log('\n--- TESTING ExaminationResultParser.parse ---');
  const parseResult = ExaminationResultParser.parse(sheet);
  console.log('Parser summary:', parseResult.summary);
  console.log('Validation errors count:', parseResult.validationErrors.length);
  if (parseResult.validationErrors.length > 0) {
    console.log('Sample validation error:', parseResult.validationErrors.slice(0, 3));
  }
  console.log('Detected subjects:', parseResult.detectedSubjects.map(s => `${s.subjectCode} (${s.subjectName || 'no name'})`));
  console.log('Sample preview[0]:', parseResult.preview[0]);
  console.log('----------------------------------------------\n');

  const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('Headers:');
  console.log('Row 4 (Main):', JSON.stringify(rawRows[3]));
  console.log('Row 5 (Sub):', JSON.stringify(rawRows[4]));

  // Check unique non-numeric values in all score columns
  const nonNumericInt = new Set<string>();
  const nonNumericExt = new Set<string>();
  const nonNumericTot = new Set<string>();
  const allGrades = new Set<string>();

  const hallTickets: string[] = [];

  for (let r = 5; r < rawRows.length; r++) {
    const row = rawRows[r];
    const ht = String(row[0] || '').trim().toUpperCase();
    if (ht) hallTickets.push(ht);

    // Each subject has 4 columns starting at col 1
    // Let's check all cells in row
    for (let c = 1; c < row.length; c++) {
      const subHeader = String(rawRows[4][c] || '').trim().toUpperCase();
      const val = String(row[c] || '').trim();
      if (!val) continue;

      if (subHeader === 'INT') {
        if (isNaN(Number(val))) nonNumericInt.add(val);
      } else if (subHeader === 'EXT') {
        if (isNaN(Number(val))) nonNumericExt.add(val);
      } else if (subHeader === 'TOT') {
        if (isNaN(Number(val))) nonNumericTot.add(val);
      } else if (subHeader === 'GR') {
        allGrades.add(val);
      }
    }
  }

  console.log('\nHall Tickets in Excel (count):', hallTickets.length);
  console.log('Sample 10 HTs:', hallTickets.slice(0, 10));
  console.log('Distinct non-numeric INT:', Array.from(nonNumericInt));
  console.log('Distinct non-numeric EXT:', Array.from(nonNumericExt));
  console.log('Distinct non-numeric TOT:', Array.from(nonNumericTot));
  console.log('Distinct Grades:', Array.from(allGrades));

  await connectDB();
  // Check how many of these hall tickets exist in PostgreSQL
  const pgStudentsRes = await query<{ hall_ticket_number: string }>(
    'SELECT hall_ticket_number FROM students WHERE UPPER(hall_ticket_number) = ANY($1)',
    [hallTickets]
  );
  console.log('\n--- PostgreSQL Match Results ---');
  console.log('Total students in Excel:', hallTickets.length);
  console.log('Found in PostgreSQL students table:', pgStudentsRes.rows.length);

  const foundSet = new Set(pgStudentsRes.rows.map(r => r.hall_ticket_number.toUpperCase()));
  const missingFromDb = hallTickets.filter(ht => !foundSet.has(ht));
  console.log('Missing from PostgreSQL:', missingFromDb.length);
  if (missingFromDb.length > 0) {
    console.log('Missing HTs:', missingFromDb);
  }

  // Check enrollment of found students
  const enrollmentsRes = await query(
    `SELECT s.hall_ticket_number, sae.academic_batch_id, sae.section_id, sae.enrollment_status,
            b.batch_name, p.program_code, d.department_code
     FROM students s
     LEFT JOIN student_academic_enrollments sae ON s.id = sae.student_id
     LEFT JOIN academic_batches b ON sae.academic_batch_id = b.id
     LEFT JOIN programs p ON b.program_id = p.id
     LEFT JOIN departments d ON p.department_id = d.id
     WHERE UPPER(s.hall_ticket_number) = ANY($1)`,
    [hallTickets]
  );
  console.log('Enrollments found:', enrollmentsRes.rows.length);
  console.log('Sample 3 enrollments:', enrollmentsRes.rows.slice(0, 3));

  // Check subjects in database matching detected subjects
  const detectedSubjCodes = [
    '23CS401PC', '23SM402MS', '23CS403PC', '23CS404PC', '23CS405PC',
    '23CS406PC', '23CS407PC', '23CS408PC', '23CS409PC', '23MC401'
  ];
  const dbSubsRes = await query(
    'SELECT id, subject_code, subject_name FROM subjects WHERE UPPER(subject_code) = ANY($1)',
    [detectedSubjCodes]
  );
  console.log('\nSubjects matching in DB:', dbSubsRes.rows.length, 'out of 10');
  console.log('Matched subjects:', dbSubsRes.rows);

  const allDbSubs = await query('SELECT subject_code, subject_name FROM subjects LIMIT 20');
  console.log('Sample subjects in DB:', allDbSubs.rows);

  // Check examinations in DB
  const exams = await query('SELECT id, exam_name, exam_type, semester_id, academic_session_id FROM examinations');
  console.log('\nExaminations in DB:', exams.rows);

  await closeDB();
}

run().catch(console.error);
