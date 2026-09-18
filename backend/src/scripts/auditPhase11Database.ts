import { connectDB, closeDB, query } from '../config/database';

export const runDatabaseAudit = async () => {
  await connectDB();
  console.log('====================================================');
  console.log('       CAMPUS360 ERP — PHASE 11 DATABASE AUDIT     ');
  console.log('====================================================\n');

  console.log('--- DYNAMIC SCHEMA TABLE DISCOVERY ---');
  const tablesDiscovery = await query<{ table_name: string }>(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);
  const tables = tablesDiscovery.rows.map(r => r.table_name);
  console.log(`Discovered ${tables.length} tables in PostgreSQL "campus360":`);
  tables.forEach((t, i) => console.log(`  [${i + 1}] ${t}`));

  console.log('\n--- TABLE ROW COUNTS ---');
  for (const t of tables) {
    try {
      const r = await query<{ count: string }>(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`${t.padEnd(30)}: ${r.rows[0].count}`);
    } catch(e: any) {
      console.log(`${t.padEnd(30)}: ERROR ${e.message}`);
    }
  }

  console.log('\n--- FOREIGN KEY RELATIONSHIPS ---');
  const fkRes = await query(`
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
    ORDER BY tc.table_name, kcu.column_name;
  `);
  for (const r of fkRes.rows) {
    console.log(`${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
  }

  console.log('\n--- USERS BREAKDOWN ---');
  const userRoles = await query('SELECT role, is_active, count(*) FROM users GROUP BY role, is_active');
  console.log(userRoles.rows);

  console.log('\n--- ACADEMIC ENTITIES ---');
  const depts = await query('SELECT id, department_code, department_name FROM departments');
  console.log('Departments:', depts.rows);
  const progs = await query('SELECT id, program_code, program_name, department_id FROM programs');
  console.log('Programs:', progs.rows);
  const batches = await query('SELECT id, batch_name, program_id, start_year, expected_completion_year FROM academic_batches');
  console.log('Batches:', batches.rows);
  const sessions = await query('SELECT * FROM academic_sessions LIMIT 5');
  console.log('Sessions:', sessions.rows);
  const sems = await query('SELECT * FROM semesters ORDER BY semester_number');
  console.log('Semesters count:', sems.rows.length);
  const secs = await query('SELECT * FROM sections');
  console.log('Sections:', secs.rows);
  const subs = await query('SELECT * FROM subjects');
  console.log('Subjects:', subs.rows);
  const exams = await query('SELECT * FROM examinations');
  console.log('Exams:', exams.rows);

  console.log('\n--- ORPHAN RECORDS AUDIT ---');
  // Check student enrollments pointing to non-existent students
  const orphanEnrollments = await query(`
    SELECT COUNT(*) FROM student_academic_enrollments sae
    LEFT JOIN students s ON sae.student_id = s.id
    WHERE s.id IS NULL
  `);
  console.log('Orphan student enrollments:', orphanEnrollments.rows[0].count);

  // Check users pointing to non-existent students
  const orphanUsers = await query(`
    SELECT COUNT(*) FROM users u
    LEFT JOIN students s ON u.student_id = s.id
    WHERE u.student_id IS NOT NULL AND s.id IS NULL
  `);
  console.log('Orphan users with student_id:', orphanUsers.rows[0].count);

  // Check attendance records pointing to non-existent sessions
  const orphanAttRecords = await query(`
    SELECT COUNT(*) FROM attendance_records ar
    LEFT JOIN attendance_sessions sess ON ar.attendance_session_id = sess.id
    WHERE sess.id IS NULL
  `);
  console.log('Orphan attendance records:', orphanAttRecords.rows[0].count);

  // Check exam results pointing to non-existent students
  const orphanExamResults = await query(`
    SELECT COUNT(*) FROM exam_results er
    LEFT JOIN students s ON er.student_id = s.id
    WHERE s.id IS NULL
  `);
  console.log('Orphan exam results:', orphanExamResults.rows[0].count);

  await closeDB();
};

if (require.main === module) {
  runDatabaseAudit();
}
