import { connectDB, query, closeDB } from '../config/database';

interface AcademicSessionRow {
  id: string;
  session_name: string;
  start_date: string | null;
  end_date: string | null;
}

interface SemesterRow {
  id: string;
  semester_number: number;
  year_number: number;
  semester_name: string;
}

const ROMAN_YEARS: Record<number, string> = {
  1: 'I B.Tech',
  2: 'II B.Tech',
  3: 'III B.Tech',
  4: 'IV B.Tech',
};

const ROMAN_SEMS: Record<number, string> = {
  1: 'I Semester',
  2: 'II Semester',
  3: 'I Semester',
  4: 'II Semester',
  5: 'I Semester',
  6: 'II Semester',
  7: 'I Semester',
  8: 'II Semester',
};

/**
 * Standalone explicit CLI script to seed standard Regular and Supplementary
 * examinations for all 8 semesters across registered academic sessions.
 * 
 * IMPORTANT:
 * - This script NEVER runs on application startup.
 * - Fully idempotent: checks existing examinations before inserting.
 * - Does not modify or delete existing examination records.
 */
export async function seedStandardExaminations() {
  await connectDB();
  console.log('\n======================================================');
  console.log('SAFE STANDALONE EXAMINATION SEEDING (IDEMPOTENT)');
  console.log('======================================================\n');

  const sessionsRes = await query<AcademicSessionRow>(
    'SELECT id::text AS id, session_name, start_date, end_date FROM academic_sessions ORDER BY id ASC'
  );
  const semestersRes = await query<SemesterRow>(
    'SELECT id::text AS id, semester_number, year_number, semester_name FROM semesters ORDER BY semester_number ASC'
  );

  if (sessionsRes.rows.length === 0 || semestersRes.rows.length === 0) {
    console.error('Error: Required academic sessions or semesters not found in PostgreSQL.');
    await closeDB();
    return;
  }

  console.log(`Discovered ${sessionsRes.rows.length} academic sessions and ${semestersRes.rows.length} semesters.\n`);

  let totalChecked = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const session of sessionsRes.rows) {
    const startYear = parseInt(session.session_name.split('-')[0], 10) || 2024;
    const endYear = parseInt(session.session_name.split('-')[1], 10) || startYear + 1;

    for (const sem of semestersRes.rows) {
      const yearPrefix = ROMAN_YEARS[sem.year_number] || `Year ${sem.year_number}`;
      const semSuffix = ROMAN_SEMS[sem.semester_number] || `Semester ${sem.semester_number}`;
      const isOdd = sem.semester_number % 2 !== 0;

      // Determine nominal exam dates based on odd/even semester
      const examDateRegular = isOdd
        ? `${startYear}-12-15`
        : `${endYear}-05-20`;
      const examDateSupple = isOdd
        ? `${endYear}-02-10`
        : `${endYear}-07-15`;

      const examMonthYearRegular = isOdd ? `Dec ${startYear}` : `May ${endYear}`;
      const examMonthYearSupple = isOdd ? `Feb ${endYear}` : `July ${endYear}`;

      const examConfigs: Array<{
        type: 'REGULAR' | 'SUPPLEMENTARY';
        name: string;
        date: string;
      }> = [
        {
          type: 'REGULAR',
          name: `${yearPrefix} ${semSuffix} Regular Examinations ${examMonthYearRegular}`,
          date: examDateRegular,
        },
        {
          type: 'SUPPLEMENTARY',
          name: `${yearPrefix} ${semSuffix} Supplementary Examinations ${examMonthYearSupple}`,
          date: examDateSupple,
        },
      ];

      for (const config of examConfigs) {
        totalChecked++;

        // Idempotent duplicate check: matching session, semester, and type
        const existing = await query(
          `SELECT id, exam_name FROM examinations 
           WHERE academic_session_id = $1::bigint 
             AND semester_id = $2::bigint 
             AND exam_type = $3`,
          [session.id, sem.id, config.type]
        );

        if (existing.rows.length > 0) {
          totalSkipped++;
          console.log(`  [EXISTS] Session ${session.session_name} | Sem ${sem.semester_number} | ${config.type}: "${existing.rows[0].exam_name}" (ID: ${existing.rows[0].id})`);
        } else {
          const insertRes = await query<{ id: string }>(
            `INSERT INTO examinations (
              academic_session_id, semester_id, exam_type, exam_name, exam_date, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', NOW(), NOW())
            RETURNING id::text AS id`,
            [session.id, sem.id, config.type, config.name, config.date]
          );
          totalInserted++;
          console.log(`  [INSERTED] Session ${session.session_name} | Sem ${sem.semester_number} | ${config.type}: "${config.name}" -> ID: ${insertRes.rows[0].id}`);
        }
      }
    }
  }

  console.log('\n======================================================');
  console.log(`Summary: Checked ${totalChecked} exams | Inserted: ${totalInserted} | Skipped (already existed): ${totalSkipped}`);
  console.log('======================================================\n');

  await closeDB();
}

// Execute only when directly invoked from CLI
if (require.main === module) {
  seedStandardExaminations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
