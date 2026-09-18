import { connectDB, query, closeDB } from '../config/database';

async function checkIndexesAndConstraints() {
  await connectDB();
  const tables = ['student_semester_results', 'exam_results', 'examinations'];
  for (const t of tables) {
    const res = await query(
      `SELECT conname, pg_get_constraintdef(c.oid)
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE conrelid = $1::regclass`,
      [t]
    );
    console.log(`=== CONSTRAINTS: ${t} ===`);
    res.rows.forEach((r: any) => console.log('  ', r.conname, ':', r.pg_get_constraintdef));

    const idxRes = await query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1`,
      [t]
    );
    console.log(`=== INDEXES: ${t} ===`);
    idxRes.rows.forEach((r: any) => console.log('  ', r.indexname, ':', r.indexdef));
  }
  await closeDB();
}

checkIndexesAndConstraints().catch(err => {
  console.error(err);
  process.exit(1);
});
