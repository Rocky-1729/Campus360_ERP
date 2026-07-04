import { userRepository } from '../repositories/user.repository';
import { connectDB, closeDB } from '../config/database';
import { env } from '../config/environment';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();

    logger.info('Checking if default admin exists...');
    const adminEmail = env.DEFAULT_ADMIN_EMAIL.toLowerCase();

    // In repositories layer, findByUsernameOrEmail takes the identifier
    const existingAdmin = await userRepository.findByUsernameOrEmail(adminEmail);
    if (existingAdmin) {
      logger.info(`Default admin with email '${adminEmail}' already exists. Skipping seeding.`);
      await closeDB();
      process.exit(0);
    }

    logger.info('Creating default admin account...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(env.DEFAULT_ADMIN_PASSWORD, salt);

    await userRepository.create({
      username: adminEmail,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      isActive: 1,
    });

    logger.info('Default admin account seeded successfully!');
    await closeDB();
    process.exit(0);
  } catch (error) {
    logger.error('Admin seeding failed:', error);
    process.exit(1);
  }
};

// Execute seed script
seedAdmin();
