import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('superadmin'));

// This file was empty, which crashed the server on startup (app.use() needs
// a real router). It's wired up now so login/auth work end-to-end.
// Platform-level endpoints (institution management, subscriptions, etc.)
// still need their own controller — this is out of scope for the auth fix,
// so for now there's just a sanity-check route to confirm the token works.
router.get('/me', (req, res) => {
  res.json({ superAdmin: req.user });
});

export default router;