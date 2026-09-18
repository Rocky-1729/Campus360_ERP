import { connectDB, query, closeDB } from '../config/database';
import sqlite3 from 'sqlite3';
import path from 'path';

async function main() {
  console.log('=== STEP 1: POSTGRESQL TABLES INSPECTION ===');
  await connectDB();
  const pgRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('PostgreSQL Tables in campus360:');
  pgRes.rows.forEach((r: any, idx: number) => {
    console.log(`  ${idx + 1}. ${r.table_name}`);
  });

  const hasUsers = pgRes.rows.some((r: any) => r.table_name.toLowerCase().includes('user'));
  const hasAuth = pgRes.rows.some((r: any) => r.table_name.toLowerCase().includes('auth'));
  const hasAttendance = pgRes.rows.some((r: any) => r.table_name.toLowerCase().includes('attend'));

  console.log('\nPostgreSQL Auth/Attendance presence:');
  console.log('  Users table exists in PG:', hasUsers);
  console.log('  Auth tables exist in PG:', hasAuth);
  console.log('  Attendance tables exist in PG:', hasAttendance);

  await closeDB();

  console.log('\n=== STEP 2: SQLITE CAMPUS360.DB INSPECTION ===');
  const sqliteDbPath = path.resolve(__dirname, '../database/campus360.db');
  console.log('SQLite DB path:', sqliteDbPath);

  const sdb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
      process.exit(1);
    }
  });

  sdb.serialize(() => {
    sdb.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
      if (err) {
        console.error('SQLite tables error:', err);
        return;
      }
      console.log('SQLite Tables:');
      tables.forEach((t: any, idx: number) => {
        console.log(`  ${idx + 1}. ${t.name}`);
      });

      // Check users table
      sdb.all("PRAGMA table_info(users)", [], (err, userCols) => {
        if (err) {
          console.error('Error getting users columns:', err);
        } else {
          console.log('\nSQLite users columns:');
          userCols.forEach((c: any) => {
            console.log(`  - ${c.name} (${c.type}) ${c.notnull ? 'NOT NULL' : 'NULL'} ${c.pk ? 'PK' : ''}`);
          });
        }
      });

      sdb.all("SELECT role, COUNT(*) as count FROM users GROUP BY role", [], (err, roles) => {
        if (err) {
          console.error('Error getting role counts:', err);
        } else {
          console.log('\nSQLite Users role counts:', roles);
        }
      });

      sdb.all("SELECT COUNT(*) as total FROM users", [], (err, total) => {
        if (err) {
          console.error('Error getting total user count:', err);
        } else {
          console.log('SQLite Total Users:', total);
        }
      });

      sdb.all("SELECT id, username, email, role, length(password) as pw_len, substr(password, 1, 7) as pw_prefix, isActive, createdAt FROM users LIMIT 10", [], (err, sample) => {
        if (err) {
          console.error('Error getting sample users:', err);
        } else {
          console.log('\nSQLite Sample Users (first 10):');
          sample.forEach((u: any) => {
            console.log(`  ID: ${u.id}, User: ${u.username}, Role: ${u.role}, PwLen: ${u.pw_len}, PwPrefix: ${u.pw_prefix}, Active: ${u.isActive}`);
          });
        }
      });

      // Check SQLite students table
      sdb.all("PRAGMA table_info(students)", [], (err, studentCols) => {
        if (!err && studentCols) {
          console.log('\nSQLite students columns:');
          studentCols.forEach((c: any) => {
            console.log(`  - ${c.name} (${c.type})`);
          });
        }
      });

      // Check SQLite faculty table
      sdb.all("PRAGMA table_info(faculty)", [], (err, facCols) => {
        if (!err && facCols) {
          console.log('\nSQLite faculty columns:');
          facCols.forEach((c: any) => {
            console.log(`  - ${c.name} (${c.type})`);
          });
        }
      });

      // Check SQLite attendance table if exists
      sdb.all("PRAGMA table_info(attendance)", [], (err, attCols) => {
        if (!err && attCols && attCols.length > 0) {
          console.log('\nSQLite attendance columns:');
          attCols.forEach((c: any) => {
            console.log(`  - ${c.name} (${c.type})`);
          });
        } else {
          console.log('\nSQLite attendance table: not found or empty columns');
        }

        sdb.close();
      });
    });
  });
}

main().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
