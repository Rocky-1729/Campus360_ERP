import { connectDB, query, closeDB } from '../config/database';

export async function runMigrationAcademicStatus() {
  await connectDB();
  console.log('\n======================================================');
  console.log('RUNNING MIGRATION: ADD ACADEMIC_STATUS & CURRENT_SEMESTER_ID');
  console.log('======================================================\n');

  // 1. Add academic_status column
  await query(`
    ALTER TABLE students 
    ADD COLUMN IF NOT EXISTS academic_status VARCHAR(20) DEFAULT 'ACTIVE';
  `);
  console.log('✅ Added academic_status column to students table (default: ACTIVE)');

  // 2. Add current_semester_id column with foreign key to semesters
  await query(`
    ALTER TABLE students 
    ADD COLUMN IF NOT EXISTS current_semester_id BIGINT REFERENCES semesters(id);
  `);
  console.log('✅ Added current_semester_id column to students table (references semesters.id)');

  // 3. Backfill any existing students with NULL academic_status to 'ACTIVE'
  const updateRes = await query(`
    UPDATE students 
    SET academic_status = 'ACTIVE' 
    WHERE academic_status IS NULL;
  `);
  console.log(`✅ Backfilled academic_status for ${updateRes.rowCount || 0} students`);

  // 4. Verify columns
  const verifyRes = await query(`
    SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'students' 
      AND column_name IN ('academic_status', 'current_semester_id');
  `);
  console.log('\nVerified columns in PostgreSQL:');
  console.log(JSON.stringify(verifyRes.rows, null, 2));

  console.log('\nMigration completed successfully.\n');
  await closeDB();
}

if (require.main === module) {
  runMigrationAcademicStatus()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
