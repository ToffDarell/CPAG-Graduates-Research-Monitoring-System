import programHeadRoutes from "./routes/programhead.js";
import adviserRoutes from "./routes/adviser.js";
import studentRoutes from "./routes/student.js";
import scheduleRoutes from "./routes/schedule.js";
import deanRoutes from "./routes/dean.js";
import facultyRoutes from "./routes/faculty.js";
import googleCalendarRoutes from "./routes/googleCalendar.js";
import panelReviewRoutes from "./routes/panelReview.js";
import googleDriveRoutes from "./routes/googleDrive.js";


import express from 'express';
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js';
import { connectDB } from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PORT = process.env.PORT || 5000;

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

//Routes
app.use("/api/users", authRoutes)

// Public routes (no authentication required)
app.use("/api/panel-review", panelReviewRoutes);

//Routes
app.use("/api/adviser", adviserRoutes);
app.use("/api/programhead", programHeadRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/dean", deanRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/google-calendar", googleCalendarRoutes);
app.use("/api/google-drive", googleDriveRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
});

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});