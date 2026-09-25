import multer from 'multer';
import { ensureUploadDir } from '../utils/fileStorage.js';

// Disk storage, namespaced per institution so two institutions never collide
// or can accidentally browse each other's files.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const institutionId = req.user?.institutionId || 'unassigned';
    const dir = ensureUploadDir(`resources/${institutionId}`);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

// 300MB ceiling covers the lecture-recording case seen in the mock data
// (e.g. "OS Scheduling — Lecture Recording", 248 MB) without being unbounded.
export const uploadResourceFile = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 },
}).single('file');
