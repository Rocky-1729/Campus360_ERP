import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { env } from '../config/environment';

const dbPath = path.resolve(__dirname, '../database/campus360.db');
const sdb = new sqlite3.Database(dbPath);

sdb.serialize(() => {
  sdb.get("SELECT * FROM users WHERE role='admin' LIMIT 1", async (err, admin: any) => {
    if (err || !admin) {
      console.log('Admin query err:', err);
      return;
    }
    const adminPass = env.DEFAULT_ADMIN_PASSWORD;
    const match = await bcrypt.compare(adminPass, admin.password);
    console.log('Admin user found:', admin.username);
    console.log('Admin password matches env.DEFAULT_ADMIN_PASSWORD:', match);
  });

  sdb.get("SELECT * FROM users WHERE role='faculty' LIMIT 1", async (err, fac: any) => {
    if (err || !fac) return;
    console.log('Faculty user found:', fac.username);
    const matchUpper = await bcrypt.compare(fac.username.toUpperCase(), fac.password);
    const matchLower = await bcrypt.compare(fac.username.toLowerCase(), fac.password);
    console.log('Faculty default password matches username:', matchUpper || matchLower);
  });

  sdb.get("SELECT * FROM users WHERE role='student' LIMIT 1", async (err, stu: any) => {
    if (err || !stu) return;
    console.log('Student user found:', stu.username);
    const stuMatchUpper = await bcrypt.compare(stu.username.toUpperCase(), stu.password);
    const stuMatchLower = await bcrypt.compare(stu.username.toLowerCase(), stu.password);
    console.log('Student default password matches username:', stuMatchUpper || stuMatchLower);
    sdb.close();
  });
});
