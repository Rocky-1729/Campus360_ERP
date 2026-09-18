import { connectDB, query, closeDB } from '../config/database';

async function checkData() {
  await connectDB();
  const tables = [
    'departments', 'programs', 'academic_batches', 'sections',
    'academic_sessions', 'semesters', 'students', 'student_academic_enrollments',
    'subjects', 'curriculum_subjects', 'examinations', 'exam_results',
    'student_semester_results', 'excel_uploads'
  ];
  for (const t of tables) {
    const res = await query(`SELECT COUNT(*) FROM "${t}"`);
    console.log(`${t.padEnd(30)}: ${res.rows[0].count} rows`);
  }
  const sampleStudents = await query(`SELECT id, hall_ticket_number, full_name FROM students LIMIT 5`);
  console.log('Sample Students:', sampleStudents.rows);
  const sampleExams = await query(`SELECT id, exam_name, exam_type, exam_date FROM examinations LIMIT 5`);
  console.log('Sample Examinations:', sampleExams.rows);
  const sampleResults = await query(`SELECT * FROM exam_results LIMIT 5`);
  console.log('Sample exam_results:', sampleResults.rows);
  const sampleSemResults = await query(`SELECT * FROM student_semester_results LIMIT 5`);
  console.log('Sample student_semester_results:', sampleSemResults.rows);
  await closeDB();
}

checkData().catch(err => {
  console.error(err);
  process.exit(1);
});
