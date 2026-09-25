import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

/**
 * Verifies the Bearer token and attaches the decoded payload to req.user.
 * Expected payload shape: { id, role, institutionId, email, name }
 * role is one of: 'student' | 'faculty' | 'admin' | 'superadmin'
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Admin/Student/Faculty Settings' "Sign out of all devices" bumps that
  // role's sessionsInvalidatedAt. Any token issued before that moment (iat,
  // in seconds) is rejected here so the sign-out actually takes effect
  // instead of just being a UI toggle.
  const SESSION_CHECKED_ROLES = {
    admin: prisma.admin,
    student: prisma.student,
    faculty: prisma.faculty,
  };
  const model = SESSION_CHECKED_ROLES[payload.role];
  if (model) {
    try {
      const account = await model.findUnique({
        where: { id: payload.id },
        select: { sessionsInvalidatedAt: true },
      });
      if (!account) {
        return res.status(401).json({ error: 'Account no longer exists' });
      }
      if (account.sessionsInvalidatedAt && payload.iat * 1000 < account.sessionsInvalidatedAt.getTime()) {
        return res.status(401).json({ error: 'Session expired — please sign in again' });
      }
    } catch (err) {
      console.error('Session check failed:', err);
      return res.status(500).json({ error: 'Authentication check failed' });
    }
  }

  req.user = payload;
  next();
}

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 *   router.get('/dashboard', requireAuth, requireRole('student'), ctrl.getDashboard)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}