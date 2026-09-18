import { connectDB, query, closeDB } from '../config/database';

async function inspect() {
  await connectDB();
  const tables = [
    'students',
    'student_academic_enrollments',
    'student_semester_results',
    'exam_results',
    'subjects',
    'curriculum_subjects',
    'examinations',
    'semesters',
    'academic_batches',
    'academic_sessions',
    'programs',
    'departments',
    'sections',
    'excel_uploads',
  ];

  for (const t of tables) {
    const cols = await query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = $1 
       ORDER BY ordinal_position`,
      [t]
    );
    console.log('=== TABLE:', t, '===');
    cols.rows.forEach((r: any) =>
      console.log(
        '  ',
        r.column_name.padEnd(28),
        ':',
        r.data_type.padEnd(20),
        r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL    ',
        r.column_default ? 'DEFAULT ' + r.column_default : ''
      )
    );

    // Get Foreign Keys
    const fks = await query(
      `SELECT
         kcu.column_name,
         ccu.table_name AS foreign_table_name,
         ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
      [t]
    );
    if (fks.rows.length > 0) {
      console.log('   Foreign Keys:');
      fks.rows.forEach((fk: any) =>
        console.log(
          `     ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`
        )
      );
    }

    // Check count
    const countRes = await query(`SELECT COUNT(*) FROM "${t}"`);
    console.log(`   Total Rows: ${countRes.rows[0].count}`);
    console.log('');
  }

  // Check distinct grades and result statuses in exam_results and student_semester_results
  const grades = await query(`SELECT DISTINCT grade, result_status FROM exam_results`);
  console.log('Distinct grades in exam_results:', grades.rows);

  const semStatuses = await query(`SELECT DISTINCT result_status FROM student_semester_results`);
  console.log('Distinct result_status in student_semester_results:', semStatuses.rows);

  // Check sample rows from exam_results
  const sampleExamResults = await query(`SELECT * FROM exam_results LIMIT 3`);
  console.log('Sample exam_results:', sampleExamResults.rows);

  // Check sample rows from student_semester_results
  const sampleSemResults = await query(`SELECT * FROM student_semester_results LIMIT 3`);
  console.log('Sample student_semester_results:', sampleSemResults.rows);

  // Check sample rows from examinations
  const sampleExams = await query(`SELECT * FROM examinations LIMIT 3`);
  console.log('Sample examinations:', sampleExams.rows);

  await closeDB();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
