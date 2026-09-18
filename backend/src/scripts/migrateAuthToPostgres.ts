import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { connectDB, closeDB, getClient } from '../config/database';
import { env } from '../config/environment';

interface SQLiteUser {
  id: number;
  username: string;
  email: string | null;
  password: string;
  role: string;
  isActive: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ValidationReport {
  total: number;
  valid: number;
  invalid: number;
  roles: Record<string, number>;
  duplicateUsernames: string[];
  duplicateEmails: string[];
  invalidPasswords: number[];
  errors: string[];
}

/** Reads all users from SQLite */
const readSQLiteUsers = (): Promise<SQLiteUser[]> => {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, '../database/campus360.db');
    const sdb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Failed to open SQLite database: ${err.message}`));
    });

    sdb.all('SELECT * FROM users ORDER BY id ASC', [], (err, rows: SQLiteUser[]) => {
      sdb.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/** Validates users and detects potential conflicts */
const validateUsers = (users: SQLiteUser[]): { report: ValidationReport; validatedUsers: SQLiteUser[] } => {
  const report: ValidationReport = {
    total: users.length,
    valid: 0,
    invalid: 0,
    roles: {},
    duplicateUsernames: [],
    duplicateEmails: [],
    invalidPasswords: [],
    errors: [],
  };

  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();
  const validatedUsers: SQLiteUser[] = [];

  for (const u of users) {
    let isValid = true;

    // Validate ID
    if (!u.id || typeof u.id !== 'number' || u.id <= 0) {
      report.errors.push(`User #${u.id}: Invalid ID`);
      isValid = false;
    }

    // Validate Username
    const username = (u.username || '').toLowerCase().trim();
    if (!username) {
      report.errors.push(`User #${u.id}: Missing username`);
      isValid = false;
    } else if (seenUsernames.has(username)) {
      report.duplicateUsernames.push(username);
      report.errors.push(`User #${u.id}: Duplicate username '${username}'`);
      isValid = false;
    } else {
      seenUsernames.add(username);
    }

    // Validate Email
    const email = (u.email || '').toLowerCase().trim();
    if (!email) {
      report.errors.push(`User #${u.id}: Missing email`);
      isValid = false;
    } else if (seenEmails.has(email)) {
      report.duplicateEmails.push(email);
      report.errors.push(`User #${u.id}: Duplicate email '${email}'`);
      isValid = false;
    } else {
      seenEmails.add(email);
    }

    // Validate Password Hash (must be bcrypt Blowfish hash)
    if (!u.password || !u.password.startsWith('$2a$') || u.password.length !== 60) {
      report.invalidPasswords.push(u.id);
      report.errors.push(`User #${u.id}: Invalid bcrypt hash format`);
      isValid = false;
    }

    // Validate Role
    const role = (u.role || '').toLowerCase().trim();
    if (!['admin', 'faculty', 'student'].includes(role)) {
      report.errors.push(`User #${u.id}: Unrecognized role '${u.role}'`);
      isValid = false;
    } else {
      report.roles[role] = (report.roles[role] || 0) + 1;
    }

    if (isValid) {
      report.valid++;
      validatedUsers.push({
        ...u,
        username,
        email,
        role,
        isActive: u.isActive === 0 ? 0 : 1,
      });
    } else {
      report.invalid++;
    }
  }

  return { report, validatedUsers };
};

async function main() {
  const isLive = process.argv.includes('--live');
  const isDryRun = process.argv.includes('--dry-run') || !isLive;

  console.log('====================================================');
  console.log('   CAMPUS360 ERP — POSTGRESQL AUTHENTICATION MIGRATION');
  console.log(`   MODE: ${isLive ? '🔴 LIVE MIGRATION' : '🟡 DRY RUN (READ ONLY)'}`);
  console.log('====================================================\n');

  console.log('[1/4] Reading legacy SQLite user accounts...');
  const rawUsers = await readSQLiteUsers();
  console.log(`Found ${rawUsers.length} raw user records in SQLite.`);

  console.log('\n[2/4] Validating records and checking for conflicts...');
  const { report, validatedUsers } = validateUsers(rawUsers);

  console.log('\n--- Validation Statistics ---');
  console.log(`Total Records Scanned  : ${report.total}`);
  console.log(`Valid Records Ready    : ${report.valid}`);
  console.log(`Invalid Records Found  : ${report.invalid}`);
  console.log('Breakdown by Role      :');
  Object.entries(report.roles).forEach(([role, count]) => {
    console.log(`  - ${role.padEnd(10)}: ${count}`);
  });
  console.log(`Duplicate Usernames    : ${report.duplicateUsernames.length}`);
  console.log(`Duplicate Emails       : ${report.duplicateEmails.length}`);
  console.log(`Malformed Hashes       : ${report.invalidPasswords.length}`);

  if (report.invalid > 0) {
    console.error('\n❌ CRITICAL: Validation errors detected in legacy data:');
    report.errors.forEach(err => console.error(`  - ${err}`));
    console.error('Aborting migration. Fix data inconsistencies before retrying.');
    process.exit(1);
  }

  console.log('\n✅ 100% of legacy records passed validation without conflicts.');

  if (isDryRun) {
    console.log('\n====================================================');
    console.log('🟡 DRY RUN COMPLETE: 0 database modifications made.');
    console.log('To execute the live transactional migration, run:');
    console.log('  npx ts-node src/scripts/migrateAuthToPostgres.ts --live');
    console.log('====================================================');
    process.exit(0);
  }

  // ----------------------------------------------------
  // LIVE TRANSACTIONAL MIGRATION
  // ----------------------------------------------------
  console.log('\n[3/4] Connecting to PostgreSQL and executing transactional migration...');
  await connectDB();
  const client = await getClient();

  try {
    console.log('Beginning atomic database transaction (BEGIN)...');
    await client.query('BEGIN');

    // Step A: Create Sequence and Users Table if not exists
    console.log('Creating PostgreSQL "users_id_seq" and "users" table with constraints...');
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS users_id_seq;

      CREATE TABLE IF NOT EXISTS users (
          id BIGINT PRIMARY KEY DEFAULT nextval('users_id_seq'),
          username VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
          student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_users_username UNIQUE (username),
          CONSTRAINT uq_users_email UNIQUE (email)
      );

      CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);

    // Step B: Insert or Upsert validated users preserving legacy IDs
    console.log(`Inserting ${validatedUsers.length} users into PostgreSQL (preserving legacy IDs)...`);
    let insertedCount = 0;
    let updatedCount = 0;

    for (const u of validatedUsers) {
      const createdTime = u.createdAt ? new Date(u.createdAt) : new Date();
      const updatedTime = u.updatedAt ? new Date(u.updatedAt) : new Date();

      const insertRes = await client.query(`
        INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
        RETURNING (xmax = 0) AS is_insert;
      `, [
        u.id,
        u.username,
        u.email,
        u.password, // Raw bcrypt $2a$10$ hash
        u.role,
        u.isActive === 1,
        createdTime,
        updatedTime,
      ]);

      if (insertRes.rows[0]?.is_insert) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    }

    console.log(`Records inserted: ${insertedCount}, updated: ${updatedCount}`);

    // Step C: Link student_id for any matching students in PostgreSQL
    console.log('Resolving student_id linkages for student accounts...');
    const linkRes = await client.query(`
      UPDATE users u
      SET student_id = s.id
      FROM students s
      WHERE UPPER(u.username) = UPPER(s.hall_ticket_number) 
        AND u.role = 'student'
        AND (u.student_id IS NULL OR u.student_id != s.id)
      RETURNING u.id;
    `);
    console.log(`Linked ${linkRes.rowCount || 0} student users to PostgreSQL students table.`);

    // Step D: Synchronize users_id_seq sequence to MAX(id)
    console.log('Synchronizing PostgreSQL "users_id_seq" sequence to MAX(id)...');
    const seqRes = await client.query(`
      SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
    `);
    console.log(`Sequence users_id_seq reset to: ${seqRes.rows[0]?.setval}`);

    // Step E: Verification checks before commit
    console.log('\n[4/4] Verifying PostgreSQL migration data integrity...');
    const pgCountRes = await client.query('SELECT COUNT(*) as count FROM users');
    const pgCount = parseInt(pgCountRes.rows[0].count, 10);
    console.log(`PostgreSQL users count: ${pgCount} (expected: ${validatedUsers.length})`);

    if (pgCount < validatedUsers.length) {
      throw new Error(`Migration verification failed: expected at least ${validatedUsers.length} users, found ${pgCount}`);
    }

    // Verify admin account
    const adminRes = await client.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRes.rows.length === 0) {
      throw new Error('Migration verification failed: no administrator user found in PostgreSQL users table');
    }
    const adminUser = adminRes.rows[0];
    console.log(`Admin account verified: ID #${adminUser.id} (${adminUser.username})`);

    // Verify bcrypt password verification against default admin password
    const adminPassMatch = await bcrypt.compare(env.DEFAULT_ADMIN_PASSWORD, adminUser.password_hash);
    if (!adminPassMatch) {
      throw new Error('Migration verification failed: bcrypt compare failed on migrated admin hash');
    }
    console.log('Admin password hash verification: ✅ BCRYPT MATCH CONFIRMED');

    // Verify faculty and student sample bcrypt
    const facRes = await client.query("SELECT * FROM users WHERE role = 'faculty' LIMIT 1");
    if (facRes.rows.length > 0) {
      const fac = facRes.rows[0];
      const facMatch = (await bcrypt.compare(fac.username.toUpperCase(), fac.password_hash)) ||
                       (await bcrypt.compare(fac.username.toLowerCase(), fac.password_hash));
      console.log(`Faculty sample (${fac.username}) verification: ${facMatch ? '✅ MATCH' : '⚠️ NO DEFAULT MATCH'}`);
    }

    const stuRes = await client.query("SELECT * FROM users WHERE role = 'student' LIMIT 1");
    if (stuRes.rows.length > 0) {
      const stu = stuRes.rows[0];
      const stuMatch = (await bcrypt.compare(stu.username.toUpperCase(), stu.password_hash)) ||
                       (await bcrypt.compare(stu.username.toLowerCase(), stu.password_hash));
      console.log(`Student sample (${stu.username}) verification: ${stuMatch ? '✅ MATCH' : '⚠️ NO DEFAULT MATCH'}`);
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('\n====================================================');
    console.log('✅ TRANSACTION COMMITTED: Live migration successful!');
    console.log(`Total users migrated to PostgreSQL: ${pgCount}`);
    console.log('====================================================');

    client.release();
    await closeDB();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ ERROR during migration transaction:', err.message);
    try {
      console.log('Rolling back transaction (ROLLBACK)...');
      await client.query('ROLLBACK');
      console.log('Rollback successful. Database state restored.');
    } catch (rbErr: any) {
      console.error('Rollback error:', rbErr.message);
    }
    client.release();
    await closeDB();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
