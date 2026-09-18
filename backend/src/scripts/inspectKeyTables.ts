import { connectDB, query, closeDB } from '../config/database';

async function inspectKeyTables() {
  await connectDB();
  const tables = ['students', 'student_academic_enrollments', 'student_semester_results', 'exam_results'];
  for (const t of tables) {
    const cols = await query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = $1 
       ORDER BY ordinal_position`,
      [t]
    );
    console.log(`=== TABLE: ${t} ===`);
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
  }
  await closeDB();
}

inspectKeyTables().catch(err => {
  console.error(err);
  process.exit(1);
});
