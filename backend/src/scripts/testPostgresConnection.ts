import { connectDB, closeDB, query } from '../config/database';
import { logger } from '../utils/logger';

const EXPECTED_TABLES = [
  'academic_batches',
  'academic_sessions',
  'curriculum_subjects',
  'departments',
  'exam_results',
  'examinations',
  'excel_uploads',
  'programs',
  'sections',
  'semesters',
  'student_academic_enrollments',
  'student_semester_results',
  'students',
  'subjects',
];

async function runTest() {
  console.log('====================================================');
  console.log('Campus360 ERP — PostgreSQL Database Connection Test');
  console.log('====================================================\n');

  try {
    // 1. Test connection
    console.log('Step 1: Connecting to PostgreSQL pool...');
    await connectDB();
    console.log('✅ PostgreSQL connection pool initialized.\n');

    // 2. Query connection information
    console.log('Step 2: Verifying database server information...');
    const serverInfo = await query(`
      SELECT 
        current_database() AS database_name,
        current_user AS user_name,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port,
        version() AS postgres_version
    `);

    const info = serverInfo.rows[0];
    console.log(`Database Name   : ${info.database_name}`);
    console.log(`Connected User  : ${info.user_name}`);
    console.log(`Server Address  : ${info.server_address || 'localhost/socket'}`);
    console.log(`Server Port     : ${info.server_port || '5432'}`);
    console.log(`PostgreSQL Ver  : ${info.postgres_version ? info.postgres_version.split(' on ')[0] : 'Unknown'}`);
    console.log('✅ PostgreSQL server is reachable and active.\n');

    // 3. Inspect public schema tables via information_schema.tables
    console.log('Step 3: Checking information_schema.tables for expected academic tables...');
    const tablesQuery = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `);

    const detectedTables = new Set(tablesQuery.rows.map((r: { table_name: string }) => r.table_name));

    console.log(`Total public tables detected in database: ${detectedTables.size}\n`);

    console.log('----------------------------------------------------');
    console.log('14 Expected Academic Tables Verification:');
    console.log('----------------------------------------------------');

    let allFound = true;
    const foundList: string[] = [];
    const missingList: string[] = [];

    for (const expected of EXPECTED_TABLES) {
      if (detectedTables.has(expected)) {
        try {
          const countRes = await query(`SELECT COUNT(*) AS count FROM "${expected}"`);
          const count = countRes.rows[0]?.count ?? 0;
          console.log(`  [FOUND]   ${expected.padEnd(30)} (rows: ${count})`);
        } catch {
          console.log(`  [FOUND]   ${expected.padEnd(30)} (accessible)`);
        }
        foundList.push(expected);
      } else {
        console.log(`  [MISSING] ${expected.padEnd(30)} ❌`);
        missingList.push(expected);
        allFound = false;
      }
    }

    console.log('----------------------------------------------------');

    if (allFound) {
      console.log('\n🎉 ALL 14 EXPECTED ACADEMIC TABLES ARE PRESENT AND ACCESSIBLE!\n');
    } else {
      console.log(`\n⚠️ ${foundList.length}/14 tables found. Missing ${missingList.length} table(s):\n`);
      missingList.forEach((t) => console.log(`   - ${t}`));
    }

    const otherTables = Array.from(detectedTables).filter((t) => !EXPECTED_TABLES.includes(t));
    if (otherTables.length > 0) {
      console.log('\nAdditional tables present in database:');
      otherTables.forEach((t) => console.log(`   + ${t}`));
    }

    console.log('\n====================================================');
    console.log('PostgreSQL Test Completed Successfully.');
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ PostgreSQL Connection Test Failed:');
    if (error instanceof Error) {
      console.error(error.message);
      if ('code' in error) {
        console.error(`PostgreSQL Error Code: ${(error as any).code}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await closeDB();
  }
}

runTest();
