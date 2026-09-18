import { connectDB, query, closeDB } from '../config/database';

async function checkFKs() {
  await connectDB();
  const res = await query(`
    SELECT
      tc.table_name, kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('departments', 'programs', 'academic_batches', 'academic_sessions', 'semesters', 'examinations', 'curriculum_subjects', 'sections')
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log('Foreign Keys:');
  res.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`));

  console.log('\nTable columns:');
  const cols = await query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name IN ('academic_sessions', 'semesters', 'academic_batches', 'departments', 'programs', 'examinations')
    ORDER BY table_name, ordinal_position;
  `);
  let curTable = '';
  cols.rows.forEach(c => {
    if (c.table_name !== curTable) {
      curTable = c.table_name;
      console.log(`\n[${curTable}]`);
    }
    console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
  });

  await closeDB();
}
checkFKs().catch(console.error);
