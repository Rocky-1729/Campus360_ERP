import { connectDB, query, closeDB } from '../config/database';

async function check() {
  await connectDB();
  const secCols = await query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sections';
  `);
  console.log('sections columns:', secCols.rows.map((r: any) => `${r.column_name} (${r.data_type})`));

  const secs = await query('SELECT * FROM sections LIMIT 5');
  console.log('sample sections:', secs.rows);

  const subCols = await query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subjects';
  `);
  console.log('subjects columns:', subCols.rows.map((r: any) => `${r.column_name} (${r.data_type})`));

  const subs = await query('SELECT id, subject_code, subject_name FROM subjects LIMIT 5');
  console.log('sample subjects:', subs.rows);

  await closeDB();
}

check().catch(console.error);
