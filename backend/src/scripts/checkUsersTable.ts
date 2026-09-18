import { connectDB, query, closeDB } from '../config/database';

async function listAllTables() {
  await connectDB();
  const res = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log('ALL TABLES IN POSTGRESQL campus360:');
  res.rows.forEach((r: any) => console.log(' -', r.table_name));

  // Check if users table exists
  const hasUsers = res.rows.some((r: any) => r.table_name === 'users');
  console.log('Does "users" table exist in PostgreSQL?', hasUsers);

  await closeDB();
}

listAllTables().catch(err => {
  console.error(err);
  process.exit(1);
});
