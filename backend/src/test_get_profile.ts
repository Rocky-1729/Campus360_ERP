import { connectDB } from './config/database';
import { getStudentProfile } from './services/student.service';

async function run() {
  await connectDB();
  try {
    const profile = await getStudentProfile('1'); // userId 1 or studentId 1
    console.log('Profile found:', profile.student.name);
  } catch (err) {
    console.error('Error fetching by userId 1:', err);
  }

  try {
    const profile2 = await getStudentProfile('2'); // student with userId 2?
    console.log('Profile found:', profile2.student.name);
  } catch (err) {
    console.error('Error fetching by userId 2:', err);
  }

  process.exit(0);
}

run();
