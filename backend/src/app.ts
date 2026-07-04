import express from 'express';
import cors from 'cors';
import { env } from './config/environment';
import { errorHandler } from './middleware/errorHandler';

// Import routers
import authRouter from './routes/auth.routes';
import adminRouter from './routes/admin.routes';
import facultyRouter from './routes/faculty.routes';
import studentRouter from './routes/student.routes';
import notificationRouter from './routes/notification.routes';

const app = express();

// Express configuration middlewares
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mounting API routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/faculty', facultyRouter);
app.use('/api/student', studentRouter);
app.use('/api/notifications', notificationRouter);

// Base route for health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'campus360-backend' });
});

// Global central error handler middleware (should be last)
app.use(errorHandler);

export default app;
