import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import facultyRoutes from './routes/faculty.routes.js';
import adminRoutes from './routes/admin.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Uploaded resource files and generated report/export files are written to
// backend/uploads/** (see utils/fileStorage.js) and served back from here —
// fileUrl values stored in the DB are paths under /uploads/.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);

export default app;