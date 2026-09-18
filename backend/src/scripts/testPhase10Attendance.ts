import { connectDB, closeDB, query } from '../config/database';
import { pgAttendanceRepository } from '../repositories/pgAttendance.repository';
import * as attendanceService from '../services/attendance.service';
import { ApiError } from '../utils/ApiError';

let passed = 0;
let failed = 0;

const assert = (condition: boolean, testName: string, detail?: any) => {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
    failed++;
  }
};

export const runPhase10AttendanceTests = async () => {
  console.log('================================================================');
  console.log('         PHASE 10: POSTGRESQL ATTENDANCE VERIFICATION SUITE     ');
  console.log('================================================================\n');

  await connectDB();

  let s1Id: number | null = null;
  let s2Id: number | null = null;
  let sectionId: number = 1;
  let subjectId: number = 1;
  const testDate = '2026-09-01';
  const testDate2 = '2026-09-02';

  try {
    // -------------------------------------------------------------
    // 1. SCHEMA AND CONSTRAINT VERIFICATION
    // -------------------------------------------------------------
    console.log('--- 1. SCHEMA AND CONSTRAINTS ---');

    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('attendance_sessions', 'attendance_records')
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r: any) => r.table_name);
    assert(
      tables.includes('attendance_sessions') && tables.includes('attendance_records'),
      'attendance_sessions and attendance_records tables exist in PostgreSQL'
    );

    const indexesRes = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('attendance_sessions', 'attendance_records')
      ORDER BY indexname;
    `);
    const indexes = indexesRes.rows.map((r: any) => r.indexname);
    assert(indexes.includes('idx_att_session_lookup'), 'idx_att_session_lookup index exists');
    assert(indexes.includes('idx_att_session_date'), 'idx_att_session_date index exists');
    assert(indexes.includes('idx_att_record_student'), 'idx_att_record_student index exists');
    assert(indexes.includes('idx_att_record_session_status'), 'idx_att_record_session_status index exists');

    // -------------------------------------------------------------
    // 2. SEED TEST STUDENTS AND ENROLLMENTS
    // -------------------------------------------------------------
    console.log('\n--- 2. ENVIRONMENT PREREQUISITES & SEEDING ---');

    const sampleSection = await query('SELECT id, section_name FROM sections LIMIT 1');
    assert(sampleSection.rows.length > 0, 'Found at least one section in PostgreSQL');
    sectionId = Number(sampleSection.rows[0].id);
    const sectionName = sampleSection.rows[0].section_name;

    const sampleSubject = await query('SELECT id, subject_code, subject_name FROM subjects LIMIT 1');
    assert(sampleSubject.rows.length > 0, 'Found at least one subject in PostgreSQL');
    subjectId = Number(sampleSubject.rows[0].id);
    const subjectCode = sampleSubject.rows[0].subject_code;

    const sampleBatch = await query('SELECT id FROM academic_batches LIMIT 1');
    const batchId = sampleBatch.rows[0]?.id || 1;

    const ht1 = 'TEST10_001';
    const ht2 = 'TEST10_002';

    // Cleanup any lingering test data first
    await query('DELETE FROM attendance_sessions WHERE section_id = $1 AND subject_id = $2', [sectionId, subjectId]);
    await query('DELETE FROM student_academic_enrollments WHERE student_id IN (SELECT id FROM students WHERE hall_ticket_number IN ($1, $2))', [ht1, ht2]);
    await query('DELETE FROM students WHERE hall_ticket_number IN ($1, $2)', [ht1, ht2]);

    // Insert 2 test students
    const s1Res = await query(
      `INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [ht1, 'Attendance Test Alice', 'alice.att@campus360.edu', '9988776655', 'FEMALE']
    );
    s1Id = Number(s1Res.rows[0].id);

    const s2Res = await query(
      `INSERT INTO students (hall_ticket_number, full_name, email, phone_number, gender)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [ht2, 'Attendance Test Bob', 'bob.att@campus360.edu', '9988776656', 'MALE']
    );
    s2Id = Number(s2Res.rows[0].id);

    // Enroll students into test section
    await query(
      `INSERT INTO student_academic_enrollments (student_id, academic_batch_id, section_id, enrollment_status)
       VALUES ($1, $2, $3, 'ACTIVE'), ($4, $2, $3, 'ACTIVE')`,
      [s1Id, batchId, sectionId, s2Id]
    );

    assert(s1Id > 0 && s2Id > 0, `Seeded test students ${ht1} and ${ht2} into section ${sectionName}`);

    const testPeriod = 1;

    // -------------------------------------------------------------
    // 3. STUDENT CHECKLIST FOR MARKING
    // -------------------------------------------------------------
    console.log('\n--- 3. CHECKLIST RETRIEVAL ---');

    const checklist = await pgAttendanceRepository.getSectionChecklist(
      subjectId,
      sectionId,
      testDate,
      testPeriod
    );
    assert(Array.isArray(checklist) && checklist.length >= 2, `getSectionChecklist returns enrolled students (count: ${checklist.length})`);
    assert(
      checklist.some((c) => c.hallTicketNumber.toUpperCase() === ht1),
      `Checklist contains test student ${ht1}`
    );
    assert(
      checklist.some((c) => c.hallTicketNumber.toUpperCase() === ht2),
      `Checklist contains test student ${ht2}`
    );

    // -------------------------------------------------------------
    // 4. SESSION CREATION & BULK ATTENDANCE MARKING
    // -------------------------------------------------------------
    console.log('\n--- 4. SESSION CREATION & MARKING ---');

    const markResult = await attendanceService.markAttendance([
      {
        hallTicketNumber: ht1,
        subjectId: subjectId,
        date: testDate,
        status: 'present',
        section: sectionName,
        periodNumber: testPeriod,
      },
      {
        hallTicketNumber: ht2,
        subjectId: subjectId,
        date: testDate,
        status: 'late',
        section: sectionName,
        periodNumber: testPeriod,
      },
    ]);

    assert(markResult.inserted === 2, `markAttendance inserted 2 records (got ${markResult.inserted})`);

    // Verify session was created
    const createdSession = await pgAttendanceRepository.findOrCreateSession({
      sectionId,
      subjectId,
      sessionDate: testDate,
      periodNumber: testPeriod,
    });
    assert(createdSession.id > 0, `attendance_session created with id ${createdSession.id}`);
    assert(createdSession.is_locked === false, 'Newly created attendance session is unlocked by default');

    // -------------------------------------------------------------
    // 5. IDEMPOTENT UPSERT & DUPLICATE PREVENTION
    // -------------------------------------------------------------
    console.log('\n--- 5. IDEMPOTENT UPSERT & DUPLICATE PREVENTION ---');

    // Re-marking should update student2 from late to absent without duplicate insertion
    const reMarkResult = await attendanceService.markAttendance([
      {
        hallTicketNumber: ht1,
        subjectId: subjectId,
        date: testDate,
        status: 'present',
        section: sectionName,
        periodNumber: testPeriod,
      },
      {
        hallTicketNumber: ht2,
        subjectId: subjectId,
        date: testDate,
        status: 'absent',
        section: sectionName,
        periodNumber: testPeriod,
      },
    ]);

    assert(reMarkResult.updated === 2, `Idempotent mark updated 2 records instead of duplicating`);

    const countRecordsRes = await query(
      'SELECT COUNT(*) AS cnt FROM attendance_records WHERE attendance_session_id = $1',
      [createdSession.id]
    );
    assert(
      parseInt(countRecordsRes.rows[0].cnt, 10) === 2,
      `Exactly 2 records exist for session (no duplicate rows created)`
    );

    // -------------------------------------------------------------
    // 6. STUDENT ATTENDANCE HISTORY & FORMATTING
    // -------------------------------------------------------------
    console.log('\n--- 6. ATTENDANCE HISTORY & FORMATTING ---');

    const history = await attendanceService.getAttendanceByHallTicket(ht1);
    assert(Array.isArray(history) && history.length > 0, 'getAttendanceByHallTicket returns records array');
    const firstHist = history[0];
    assert(typeof firstHist.subjectId === 'object', 'Record has nested subjectId object for frontend');
    assert(firstHist.subjectId.subjectCode !== undefined, 'Nested subjectId has subjectCode');
    assert(firstHist.status === 'present', 'Student1 status is present');

    // -------------------------------------------------------------
    // 7. ATTENDANCE SUMMARY & WEIGHTED CALCULATION
    // -------------------------------------------------------------
    console.log('\n--- 7. ATTENDANCE SUMMARY & PERCENTAGES ---');

    // Student 1 has 1 PRESENT class -> 100%
    const student1Summary = await attendanceService.getAttendanceSummary(ht1);
    assert(student1Summary.overall.total >= 1, `Student 1 overall total is at least 1 (${student1Summary.overall.total})`);
    assert(student1Summary.overall.present >= 1, `Student 1 present count >= 1`);
    assert(Array.isArray(student1Summary.subjectWise), 'Student 1 has subjectWise array');

    // Mark second session: student 1 is LATE
    await attendanceService.markAttendance([
      {
        hallTicketNumber: ht1,
        subjectId: subjectId,
        date: testDate2,
        status: 'late',
        section: sectionName,
        periodNumber: testPeriod,
      },
    ]);

    // Student 1 has 1 Present (1.0) + 1 Late (0.5) = 1.5 / 2 = 75%
    const summaryWithLate = await attendanceService.getAttendanceSummary(ht1);
    const subWise = summaryWithLate.subjectWise.find(
      (s: any) => s.subjectId === String(subjectId)
    );
    assert(subWise !== undefined, 'Found subject-wise summary for tested subject');
    if (subWise) {
      assert(subWise.total === 2, `Subject total classes is 2 (got ${subWise.total})`);
      assert(subWise.present === 1, `Subject present classes is 1 (got ${subWise.present})`);
      assert(subWise.late === 1, `Subject late classes is 1 (got ${subWise.late})`);
      assert(
        subWise.percentage === 75,
        `Weighted percentage correctly computes (1 + 0.5) / 2 = 75% (got ${subWise.percentage}%)`
      );
    }

    // -------------------------------------------------------------
    // 8. RECORD UPDATE AND SESSION LOCKING
    // -------------------------------------------------------------
    console.log('\n--- 8. RECORD UPDATE & SESSION LOCKING ---');

    // Fetch the record ID for student 2 in session 1
    const recRes = await query(
      'SELECT id FROM attendance_records WHERE attendance_session_id = $1 AND student_id = $2',
      [createdSession.id, s2Id]
    );
    const recId = recRes.rows[0].id;

    // Single record update while unlocked
    const updatedRec = await attendanceService.updateAttendance(String(recId), 'present');
    assert(
      updatedRec && updatedRec.status === 'PRESENT',
      'Single record status updated to PRESENT while session unlocked'
    );

    // Lock session
    await pgAttendanceRepository.lockSession(createdSession.id, 1);
    const lockedSession = await pgAttendanceRepository.getSessionById(createdSession.id);
    assert(lockedSession?.is_locked === true, 'Session is_locked set to TRUE');

    // Attempting to update record on locked session must fail
    let lockBlocked = false;
    try {
      await attendanceService.updateAttendance(String(recId), 'absent');
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 403) {
        lockBlocked = true;
      }
    }
    assert(lockBlocked, 'Updating record on locked session rejected with 403 Forbidden');

    // Attempting to bulk mark on locked session must also fail
    let bulkLockBlocked = false;
    try {
      await attendanceService.markAttendance([
        {
          hallTicketNumber: ht1,
          subjectId: subjectId,
          date: testDate,
          status: 'absent',
          section: sectionName,
          periodNumber: testPeriod,
        },
      ]);
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 403) {
        bulkLockBlocked = true;
      }
    }
    assert(bulkLockBlocked, 'Bulk marking on locked session rejected with 403 Forbidden');

    // Unlock session (Admin override)
    await pgAttendanceRepository.unlockSession(createdSession.id);
    const unlockedSession = await pgAttendanceRepository.getSessionById(createdSession.id);
    assert(unlockedSession?.is_locked === false, 'Session is_locked cleared to FALSE on unlock');

    // Now update succeeds again
    const postUnlockUpdate = await attendanceService.updateAttendance(String(recId), 'late');
    assert(
      postUnlockUpdate && postUnlockUpdate.status === 'LATE',
      'Update succeeds again after session unlocked'
    );

  } catch (error) {
    console.error('\n❌ Unexpected error during testing:', error);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // 9. CLEANUP TEST DATA
    // -------------------------------------------------------------
    console.log('\n--- 9. TEST ARTIFACT CLEANUP ---');
    try {
      await query(
        'DELETE FROM attendance_sessions WHERE section_id = $1 AND subject_id = $2 AND session_date IN ($3, $4)',
        [sectionId, subjectId, testDate, testDate2]
      );
      if (s1Id && s2Id) {
        await query(
          'DELETE FROM student_academic_enrollments WHERE student_id IN ($1, $2)',
          [s1Id, s2Id]
        );
        await query(
          'DELETE FROM students WHERE id IN ($1, $2)',
          [s1Id, s2Id]
        );
      }
      console.log('  🧹 Cleaned up temporary test sessions, records, enrollments, and students.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }

    await closeDB();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  runPhase10AttendanceTests();
}
