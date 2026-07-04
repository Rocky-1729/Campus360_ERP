import * as db from '../config/database';
import { IMarks } from '../interfaces/db.interface';

export const marksRepository = {
  create: async (marks: IMarks): Promise<number> => {
    const res = await db.run(
      `INSERT INTO marks (
        hallTicketNumber, subjectCode, subjectName, internalMarks, externalMarks,
        totalMarks, grade, credits, sgpa, cgpa, result, semester, academicYear
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        marks.hallTicketNumber.toUpperCase().trim(),
        marks.subjectCode.toUpperCase().trim(),
        marks.subjectName,
        marks.internalMarks ?? 0,
        marks.externalMarks ?? 0,
        marks.totalMarks ?? 0,
        marks.grade ?? 'F',
        marks.credits ?? 4,
        marks.sgpa ?? 0,
        marks.cgpa ?? 0,
        marks.result ?? 'Fail',
        marks.semester,
        marks.academicYear,
      ]
    );
    return res.lastID!;
  },

  upsert: async (marks: IMarks): Promise<void> => {
    const existing = await db.get<IMarks>(
      `SELECT id FROM marks 
       WHERE UPPER(hallTicketNumber) = ? AND UPPER(subjectCode) = ? AND semester = ? AND academicYear = ?`,
      [
        marks.hallTicketNumber.toUpperCase().trim(),
        marks.subjectCode.toUpperCase().trim(),
        marks.semester,
        marks.academicYear,
      ]
    );

    if (existing && existing.id) {
      await db.run(
        `UPDATE marks SET
          subjectName = ?, internalMarks = ?, externalMarks = ?, totalMarks = ?,
          grade = ?, credits = ?, sgpa = ?, cgpa = ?, result = ?
         WHERE id = ?`,
        [
          marks.subjectName,
          marks.internalMarks ?? 0,
          marks.externalMarks ?? 0,
          marks.totalMarks ?? 0,
          marks.grade ?? 'F',
          marks.credits ?? 4,
          marks.sgpa ?? 0,
          marks.cgpa ?? 0,
          marks.result ?? 'Fail',
          existing.id,
        ]
      );
    } else {
      await marksRepository.create(marks);
    }
  },

  findByStudent: async (hallTicketNumber: string, semester?: string): Promise<IMarks[]> => {
    let sql = 'SELECT * FROM marks WHERE UPPER(hallTicketNumber) = ?';
    const params: any[] = [hallTicketNumber.toUpperCase().trim()];
    if (semester) {
      sql += ' AND semester = ?';
      params.push(semester);
    }
    sql += ' ORDER BY semester ASC, subjectCode ASC';
    return db.all<IMarks>(sql, params);
  },

  // Calculate SGPA/CGPA history for student dashboard
  getSemesterSummaries: async (hallTicketNumber: string): Promise<any[]> => {
    const ht = hallTicketNumber.toUpperCase().trim();
    // Fetch unique semesters for student
    const sems = await db.all<{ semester: string }>('SELECT DISTINCT semester FROM marks WHERE UPPER(hallTicketNumber) = ?', [ht]);
    const summaries: any[] = [];

    for (const s of sems) {
      const records = await db.all<IMarks>('SELECT * FROM marks WHERE UPPER(hallTicketNumber) = ? AND semester = ?', [ht, s.semester]);
      if (records.length === 0) continue;

      let totalCredits = 0;
      let earnedCredits = 0;
      let totalPoints = 0;
      let sgpa = 0;
      let cgpa = 0;

      // Grade point mappings
      const gradePoints: Record<string, number> = {
        'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0, 'Ab': 0
      };

      records.forEach((r) => {
        const crs = r.credits || 4;
        totalCredits += crs;
        if (r.result === 'Pass') {
          earnedCredits += crs;
        }
        const grPoint = gradePoints[r.grade || 'F'] || 0;
        totalPoints += grPoint * crs;
        sgpa = r.sgpa || 0;
        cgpa = r.cgpa || 0;
      });

      if (sgpa === 0 && totalCredits > 0) {
        sgpa = Number((totalPoints / totalCredits).toFixed(2));
      }

      summaries.push({
        semester: s.semester,
        sgpa,
        cgpa,
        totalCredits,
        earnedCredits,
      });
    }

    return summaries;
  },

  // Generate department-wide analytics
  getAnalytics: async (filters: {
    section?: string;
    semester?: string;
    subjectCode?: string;
    academicYear?: string;
  }): Promise<any> => {
    let sql = `
      SELECT m.*, s.section, s.year, s.name as studentName
      FROM marks m
      JOIN students s ON m.hallTicketNumber = s.hallTicketNumber
      WHERE s.isActive = 1
    `;
    const params: any[] = [];

    if (filters.section) {
      sql += ' AND s.section = ?';
      params.push(filters.section);
    }
    if (filters.semester) {
      sql += ' AND m.semester = ?';
      params.push(filters.semester);
    }
    if (filters.subjectCode) {
      sql += ' AND m.subjectCode = ?';
      params.push(filters.subjectCode);
    }
    if (filters.academicYear) {
      sql += ' AND m.academicYear = ?';
      params.push(filters.academicYear);
    }

    const rows = await db.all<any>(sql, params);

    // Group rows by student to find their overall CGPA and count backlogs
    const studentStats: Record<string, { 
      cgpa: number; 
      backlogs: number; 
      name: string; 
      hallTicketNumber: string;
      failedSubjects: { subjectCode: string; subjectName: string }[];
    }> = {};

    rows.forEach((r) => {
      const ht = r.hallTicketNumber;
      if (!studentStats[ht]) {
        studentStats[ht] = {
          cgpa: r.cgpa || 0,
          backlogs: 0,
          name: r.studentName,
          hallTicketNumber: ht,
          failedSubjects: [],
        };
      }
      if (r.result === 'Fail') {
        studentStats[ht].backlogs++;
        studentStats[ht].failedSubjects.push({
          subjectCode: r.subjectCode,
          subjectName: r.subjectName,
        });
      }
      // Pick highest cgpa found in marks rows
      if (r.cgpa > studentStats[ht].cgpa) {
        studentStats[ht].cgpa = r.cgpa;
      }
    });

    const students = Object.values(studentStats);

    // 1. CGPA distribution
    const cgpaDistribution = {
      '9-10': 0,
      '8-9': 0,
      '7-8': 0,
      'Below 7': 0,
    };

    // 2. Backlog distribution
    const backlogAnalysis = {
      'No Backlogs': 0,
      'One Backlog': 0,
      'Two Backlogs': 0,
      'Three or More': 0,
    };

    students.forEach((s) => {
      if (s.cgpa >= 9) cgpaDistribution['9-10']++;
      else if (s.cgpa >= 8) cgpaDistribution['8-9']++;
      else if (s.cgpa >= 7) cgpaDistribution['7-8']++;
      else cgpaDistribution['Below 7']++;

      if (s.backlogs === 0) backlogAnalysis['No Backlogs']++;
      else if (s.backlogs === 1) backlogAnalysis['One Backlog']++;
      else if (s.backlogs === 2) backlogAnalysis['Two Backlogs']++;
      else backlogAnalysis['Three or More']++;
    });

    // 3. Subject Analysis
    const subjectStats: Record<string, { total: number; count: number; max: number; min: number; pass: number; fail: number }> = {};
    rows.forEach((r) => {
      const code = r.subjectCode;
      if (!subjectStats[code]) {
        subjectStats[code] = { total: 0, count: 0, max: 0, min: 100, pass: 0, fail: 0 };
      }
      const score = r.totalMarks || 0;
      subjectStats[code].total += score;
      subjectStats[code].count++;
      if (score > subjectStats[code].max) subjectStats[code].max = score;
      if (score < subjectStats[code].min) subjectStats[code].min = score;
      if (r.result === 'Pass') subjectStats[code].pass++;
      else subjectStats[code].fail++;
    });

    const subjectAnalysis = Object.keys(subjectStats).map((code) => ({
      subjectCode: code,
      averageMarks: Number((subjectStats[code].total / subjectStats[code].count).toFixed(2)),
      highestMarks: subjectStats[code].max,
      lowestMarks: subjectStats[code].min === 100 ? 0 : subjectStats[code].min,
      passCount: subjectStats[code].pass,
      failCount: subjectStats[code].fail,
    }));

    // 4. Top Performers (Top 10 sorted by CGPA)
    const topPerformers = students
      .filter((s) => s.cgpa > 0)
      .sort((a, b) => b.cgpa - a.cgpa)
      .slice(0, 10);

    // 5. At-Risk Students (CGPA < 6 or backlogs > 2)
    // Add attendance warnings during service layer aggregation
    const atRiskStudents = students
      .filter((s) => s.cgpa < 6 || s.backlogs > 2)
      .map((s) => ({
        hallTicketNumber: s.hallTicketNumber,
        name: s.name,
        cgpa: s.cgpa,
        backlogs: s.backlogs,
      }));

    const backlogStudents = students
      .filter((s) => s.backlogs > 0)
      .map((s) => ({
        hallTicketNumber: s.hallTicketNumber,
        name: s.name,
        backlogs: s.backlogs,
        failedSubjects: s.failedSubjects,
      }));

    return {
      cgpaDistribution,
      backlogAnalysis,
      subjectAnalysis,
      topPerformers,
      atRiskStudents,
      backlogStudents,
    };
  },
};
