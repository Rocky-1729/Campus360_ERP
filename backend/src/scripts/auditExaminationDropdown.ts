import { connectDB, query, closeDB } from '../config/database';
import { pgSubjectExamService } from '../services/pgSubjectExam.service';

async function runAudit() {
  await connectDB();

  console.log('=== 1. EXAMINATIONS TABLE ===');
  const exams = await query('SELECT * FROM examinations ORDER BY id ASC');
  console.log(`Total examinations in PostgreSQL: ${exams.rows.length}`);
  console.log(JSON.stringify(exams.rows, null, 2));

  console.log('\n=== 2. SEMESTERS TABLE ===');
  const sems = await query('SELECT * FROM semesters ORDER BY id ASC');
  console.log(`Total semesters in PostgreSQL: ${sems.rows.length}`);
  console.log(JSON.stringify(sems.rows, null, 2));

  console.log('\n=== 3. ACADEMIC SESSIONS TABLE ===');
  const sessions = await query('SELECT * FROM academic_sessions ORDER BY id ASC');
  console.log(`Total academic sessions in PostgreSQL: ${sessions.rows.length}`);
  console.log(JSON.stringify(sessions.rows, null, 2));

  console.log('\n=== 4. PROGRAMS TABLE ===');
  const progs = await query('SELECT * FROM programs ORDER BY id ASC');
  console.log(`Total programs in PostgreSQL: ${progs.rows.length}`);
  console.log(JSON.stringify(progs.rows, null, 2));

  console.log('\n=== 5. DEPARTMENTS TABLE ===');
  const depts = await query('SELECT * FROM departments ORDER BY id ASC');
  console.log(`Total departments in PostgreSQL: ${depts.rows.length}`);
  console.log(JSON.stringify(depts.rows, null, 2));

  console.log('\n=== 6. ACADEMIC BATCHES TABLE ===');
  const batches = await query('SELECT * FROM academic_batches ORDER BY id ASC');
  console.log(`Total batches in PostgreSQL: ${batches.rows.length}`);
  console.log(JSON.stringify(batches.rows, null, 2));

  console.log('\n=== 7. SECTIONS TABLE ===');
  const sections = await query('SELECT * FROM sections ORDER BY id ASC');
  console.log(`Total sections in PostgreSQL: ${sections.rows.length}`);
  console.log(JSON.stringify(sections.rows, null, 2));

  console.log('\n=== 8. EXAMINATIONS JOIN WITH SEMESTERS & SESSIONS ===');
  const detailedExams = await query(`
    SELECT 
      e.id,
      e.exam_name,
      e.exam_type,
      e.status,
      e.exam_date,
      e.academic_session_id,
      s.session_name,
      e.semester_id,
      sem.semester_name,
      sem.semester_number,
      sem.year_number
    FROM examinations e
    LEFT JOIN academic_sessions s ON e.academic_session_id = s.id
    LEFT JOIN semesters sem ON e.semester_id = sem.id
    ORDER BY e.id ASC
  `);
  console.log(JSON.stringify(detailedExams.rows, null, 2));

  console.log('\n=== 9. SERVICE CALL: pgSubjectExamService.getExaminations({}) ===');
  const serviceExams = await pgSubjectExamService.getExaminations({});
  console.log('Total returned by pgSubjectExamService.getExaminations:', serviceExams.length);
  console.log('Raw service result (identical to ApiResponse.data):');
  console.log(JSON.stringify(serviceExams, null, 2));

  await closeDB();
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
