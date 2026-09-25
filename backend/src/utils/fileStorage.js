import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/**
 * Ensures backend/uploads/<subdir> exists and returns its absolute path.
 * subdir is one of: 'resources' | 'reports' | 'exports'
 */
export function ensureUploadDir(subdir) {
  const dir = path.join(UPLOADS_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Converts an absolute path under backend/uploads into the public URL path
 * the frontend should use (served via app.use('/uploads', express.static(...))).
 */
export function toPublicUrl(absolutePath) {
  const relative = path.relative(UPLOADS_ROOT, absolutePath).split(path.sep).join('/');
  return `/uploads/${relative}`;
}

export function humanFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
