import sqlite3 from 'sqlite3';
import path from 'path';
import { connectDB, query, closeDB } from '../config/database';

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

async function inspect() {
  console.log('====================================================');
  console.log('STEP 1 & 2: DETAILED DATA INSPECTION');
  console.log('====================================================');

  const dbPath = path.resolve(__dirname, '../database/campus360.db');
  const sdb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

  const sqliteUsers: SQLiteUser[] = await new Promise((resolve, reject) => {
    sdb.all('SELECT * FROM users ORDER BY id ASC', [], (err, rows: SQLiteUser[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const sqliteStudents: any[] = await new Promise((resolve, reject) => {
    sdb.all('SELECT id, userId, hallTicketNumber, name, email, department, year, section FROM students', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const sqliteFaculty: any[] = await new Promise((resolve, reject) => {
    sdb.all('SELECT id, userId, facultyId, name, email, designation FROM faculty', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  sdb.close();

  console.log(`Total SQLite Users: ${sqliteUsers.length}`);
  console.log(`Total SQLite Students: ${sqliteStudents.length}`);
  console.log(`Total SQLite Faculty: ${sqliteFaculty.length}`);

  // Role Breakdown
  const roleCounts: Record<string, number> = {};
  sqliteUsers.forEach(u => {
    roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
  });
  console.log('\nUsers by Role:', roleCounts);

  // Username checks
  const usernames = sqliteUsers.map(u => u.username.toLowerCase().trim());
  const dupUsernames = usernames.filter((item, index) => usernames.indexOf(item) !== index);
  console.log(`Duplicate usernames: ${dupUsernames.length > 0 ? JSON.stringify(dupUsernames) : 'None'}`);

  // Email checks
  const emailsWithUsers = sqliteUsers.filter(u => u.email && u.email.trim().length > 0);
  const emails = emailsWithUsers.map(u => u.email!.toLowerCase().trim());
  const dupEmails = emails.filter((item, index) => emails.indexOf(item) !== index);
  console.log(`Users with email: ${emailsWithUsers.length}`);
  console.log(`Users with NULL/empty email: ${sqliteUsers.length - emailsWithUsers.length}`);
  console.log(`Duplicate emails: ${dupEmails.length > 0 ? JSON.stringify(dupEmails) : 'None'}`);

  // Missing password hash
  const missingPasswords = sqliteUsers.filter(u => !u.password || u.password.trim().length === 0);
  console.log(`Users with missing password: ${missingPasswords.length}`);

  // Password hash lengths & prefixes
  const hashPrefixes: Record<string, number> = {};
  sqliteUsers.forEach(u => {
    const prefix = u.password ? u.password.substring(0, 7) : 'NONE';
    hashPrefixes[prefix] = (hashPrefixes[prefix] || 0) + 1;
  });
  console.log('Password hash prefixes:', hashPrefixes);

  // Active status
  const activeCounts: Record<string, number> = {};
  sqliteUsers.forEach(u => {
    const st = u.isActive === 1 ? 'Active (1)' : u.isActive === 0 ? 'Inactive (0)' : `Null/Other (${u.isActive})`;
    activeCounts[st] = (activeCounts[st] || 0) + 1;
  });
  console.log('Active status counts:', activeCounts);

  // Inspect PostgreSQL Students
  await connectDB();
  const colRes = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students'
    ORDER BY ordinal_position;
  `);
  console.log('\nPostgreSQL students columns:');
  colRes.rows.forEach((c: any) => {
    console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
  });

  const pgStudentsRes = await query('SELECT * FROM students');
  const pgStudents = pgStudentsRes.rows;
  console.log(`\nTotal PostgreSQL Students: ${pgStudents.length}`);
  if (pgStudents.length > 0) {
    console.log('Sample PostgreSQL student:', pgStudents[0]);
  }

  // Map SQLite Student Users to PostgreSQL Students
  const studentUsers = sqliteUsers.filter(u => u.role === 'student');
  const pgStudentMapByHt = new Map<string, any>();
  pgStudents.forEach(s => {
    if (s.hall_ticket_number) {
      pgStudentMapByHt.set(s.hall_ticket_number.toUpperCase().trim(), s);
    }
  });

  let matchedStudents = 0;
  let unmatchedStudents = 0;
  const unmatchedSamples: string[] = [];

  studentUsers.forEach(u => {
    const ht = u.username.toUpperCase().trim();
    if (pgStudentMapByHt.has(ht)) {
      matchedStudents++;
    } else {
      unmatchedStudents++;
      if (unmatchedSamples.length < 5) unmatchedSamples.push(ht);
    }
  });

  console.log(`Student users matching PostgreSQL students: ${matchedStudents}`);
  console.log(`Student users NOT found in PostgreSQL students: ${unmatchedStudents}`);
  if (unmatchedSamples.length > 0) {
    console.log('Sample unmatched student usernames:', unmatchedSamples);
  }

  // SQLite student userId vs users.id
  let sqliteStudentUserLinks = 0;
  sqliteStudents.forEach(s => {
    const user = sqliteUsers.find(u => u.id === s.userId);
    if (user) sqliteStudentUserLinks++;
  });
  console.log(`SQLite students linked to users by userId: ${sqliteStudentUserLinks} / ${sqliteStudents.length}`);

  // SQLite faculty userId vs users.id
  let sqliteFacultyUserLinks = 0;
  sqliteFaculty.forEach(f => {
    const user = sqliteUsers.find(u => u.id === f.userId);
    if (user) sqliteFacultyUserLinks++;
  });
  console.log(`SQLite faculty linked to users by userId: ${sqliteFacultyUserLinks} / ${sqliteFaculty.length}`);

  // Inspect admin users
  const adminUsers = sqliteUsers.filter(u => u.role === 'admin');
  console.log('\nAdmin users in SQLite:');
  adminUsers.forEach(a => {
    console.log(`  ID: ${a.id}, Username: ${a.username}, Email: ${a.email}, Active: ${a.isActive}`);
  });

  await closeDB();
}

inspect().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
