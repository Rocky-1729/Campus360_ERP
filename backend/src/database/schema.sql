-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'faculty', 'student')),
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER UNIQUE NOT NULL,
  facultyId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  qualification TEXT DEFAULT '',
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER UNIQUE,
  hallTicketNumber TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  fatherName TEXT DEFAULT '',
  motherName TEXT DEFAULT '',
  email TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  dateOfBirth TEXT,
  gender TEXT,
  aadhaarNumber TEXT DEFAULT '',
  abcId TEXT DEFAULT '',
  department TEXT DEFAULT 'CSE',
  year INTEGER,
  section TEXT DEFAULT '',
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Semesters Table
CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, -- e.g., '1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2'
  name TEXT NOT NULL, -- e.g., 'I Year I Semester'
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subjectCode TEXT UNIQUE NOT NULL,
  subjectName TEXT NOT NULL,
  department TEXT DEFAULT 'CSE',
  semester TEXT NOT NULL, -- e.g., '1-1'
  credits INTEGER DEFAULT 4,
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester) REFERENCES semesters(code) ON DELETE RESTRICT
);

-- Faculty Assignments Table
CREATE TABLE IF NOT EXISTS faculty_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facultyId INTEGER NOT NULL,
  subjectId INTEGER NOT NULL,
  section TEXT NOT NULL,
  semester TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facultyId) REFERENCES faculty(id) ON DELETE CASCADE,
  FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (semester) REFERENCES semesters(code) ON DELETE CASCADE,
  UNIQUE(facultyId, subjectId, section)
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hallTicketNumber TEXT NOT NULL,
  subjectId INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
  date TEXT NOT NULL,
  semester TEXT NOT NULL,
  section TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hallTicketNumber) REFERENCES students(hallTicketNumber) ON DELETE CASCADE,
  FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (semester) REFERENCES semesters(code) ON DELETE CASCADE,
  UNIQUE(hallTicketNumber, subjectId, date)
);

-- Attendance Locks Table
CREATE TABLE IF NOT EXISTS attendance_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subjectId INTEGER NOT NULL,
  date TEXT NOT NULL,
  section TEXT NOT NULL,
  locked INTEGER DEFAULT 1,
  lockedBy INTEGER NOT NULL, -- HOD/Admin userId
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (lockedBy) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE(subjectId, date, section)
);

-- Marks Table
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hallTicketNumber TEXT NOT NULL,
  subjectCode TEXT NOT NULL,
  subjectName TEXT NOT NULL,
  internalMarks INTEGER DEFAULT 0,
  externalMarks INTEGER DEFAULT 0,
  totalMarks INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'F',
  credits INTEGER DEFAULT 4,
  sgpa REAL DEFAULT 0.0,
  cgpa REAL DEFAULT 0.0,
  result TEXT DEFAULT 'Fail',
  semester TEXT NOT NULL,
  academicYear TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hallTicketNumber) REFERENCES students(hallTicketNumber) ON DELETE CASCADE,
  FOREIGN KEY (subjectCode) REFERENCES subjects(subjectCode) ON DELETE RESTRICT,
  FOREIGN KEY (semester) REFERENCES semesters(code) ON DELETE RESTRICT,
  UNIQUE(hallTicketNumber, subjectCode, semester, academicYear)
);

-- Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hallTicketNumber TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  issuingOrganization TEXT NOT NULL,
  issueDate TEXT NOT NULL,
  certificateUrl TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  remarks TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hallTicketNumber) REFERENCES students(hallTicketNumber) ON DELETE CASCADE
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hallTicketNumber TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date TEXT NOT NULL,
  documentUrl TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  remarks TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hallTicketNumber) REFERENCES students(hallTicketNumber) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  senderId INTEGER NOT NULL,
  senderName TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  targetRole TEXT NOT NULL CHECK(targetRole IN ('admin', 'faculty', 'student', 'all')),
  targetSection TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
);

-- Notification Reads Table
CREATE TABLE IF NOT EXISTS notification_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notificationId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  isRead INTEGER DEFAULT 1,
  readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notificationId) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(notificationId, userId)
);

-- Upload History Table
CREATE TABLE IF NOT EXISTS upload_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploadedBy INTEGER NOT NULL,
  fileName TEXT NOT NULL,
  semester TEXT DEFAULT '',
  year TEXT DEFAULT '',
  recordsImported INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Success',
  uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE RESTRICT
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  tableName TEXT NOT NULL,
  recordId INTEGER,
  ipAddress TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Analytics Cache Table
CREATE TABLE IF NOT EXISTS analytics_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facultyId INTEGER UNIQUE, -- NULL for global/admin cache
  jsonData TEXT NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facultyId) REFERENCES faculty(id) ON DELETE CASCADE
);

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api TEXT NOT NULL,
  error TEXT NOT NULL,
  stack TEXT DEFAULT '',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
