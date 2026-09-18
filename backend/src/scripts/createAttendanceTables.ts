import { connectDB, closeDB, query } from '../config/database';

export const createAttendanceTables = async (): Promise<void> => {
  console.log('====================================================');
  console.log('   CREATING POSTGRESQL ATTENDANCE ARCHITECTURE');
  console.log('====================================================\n');

  await connectDB();

  console.log('[1/3] Creating attendance_sessions table...');
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
        id BIGSERIAL PRIMARY KEY,
        academic_session_id BIGINT REFERENCES academic_sessions(id) ON DELETE CASCADE,
        semester_id BIGINT REFERENCES semesters(id) ON DELETE CASCADE,
        section_id BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        subject_id BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        faculty_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        session_date DATE NOT NULL,
        period_number SMALLINT NOT NULL DEFAULT 1,
        topic_covered VARCHAR(500),
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        locked_at TIMESTAMP WITH TIME ZONE,
        locked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_session_schedule UNIQUE (section_id, subject_id, session_date, period_number)
    );
  `);

  console.log('[2/3] Creating attendance_records table...');
  await query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
        id BIGSERIAL PRIMARY KEY,
        attendance_session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
        remarks VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_session_student UNIQUE (attendance_session_id, student_id)
    );
  `);

  console.log('[3/3] Creating attendance performance indexes...');
  await query(`
    CREATE INDEX IF NOT EXISTS idx_att_session_lookup ON attendance_sessions(subject_id, section_id, session_date);
    CREATE INDEX IF NOT EXISTS idx_att_session_date ON attendance_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_att_session_faculty ON attendance_sessions(faculty_user_id);
    CREATE INDEX IF NOT EXISTS idx_att_record_student ON attendance_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_att_record_session_status ON attendance_records(attendance_session_id, status);
  `);

  console.log('\n✅ Attendance schema and indexes created successfully in PostgreSQL.');
};

if (require.main === module) {
  createAttendanceTables()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Failed to create attendance tables:', err);
      await closeDB();
      process.exit(1);
    });
}
