import { connectDB, query, closeDB } from '../config/database';

async function verifyAllColumns() {
  await connectDB();
  const tables = [
    'students',
    'student_academic_enrollments',
    'student_semester_results',
    'exam_results',
    'examinations',
    'semesters',
    'academic_sessions',
    'academic_batches',
    'programs',
    'departments',
    'sections',
    'subjects',
    'curriculum_subjects',
  ];

  for (const t of tables) {
    const cols = await query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = $1 
       ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\n========================================`);
    console.log(`TABLE: ${t}`);
    console.log(`========================================`);
    cols.rows.forEach((r: any) => {
      console.log(`- ${r.column_name}: ${r.data_type} (${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'})${r.column_default ? ' DEFAULT ' + r.column_default : ''}`);
    });
  }

  // Also check distinct values in examinations.exam_type and exam_results.result_status
  const examTypes = await query(`SELECT DISTINCT exam_type FROM examinations`);
  console.log('\nexaminations.exam_type values:', examTypes.rows.map((r: any) => r.exam_type));

  const resultStatuses = await query(`SELECT DISTINCT result_status FROM exam_results`);
  console.log('exam_results.result_status values:', resultStatuses.rows.map((r: any) => r.result_status));

  await closeDB();
}

verifyAllColumns().catch(err => {
  console.error(err);
  process.exit(1);
});
