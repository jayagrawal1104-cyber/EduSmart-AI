import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// GET /api/auth/institute/:code
router.get('/institute/:code', authController.lookupInstitute);

// GET /api/auth/institute/:code/departments — admin-created departments only
router.get('/institute/:code/departments', authController.listInstituteDepartments);

// GET /api/auth/institute/:code/courses?departmentId=... — admin-created courses only
router.get('/institute/:code/courses', authController.listInstituteCourses);

// POST /api/auth/admin-login
router.post('/admin-login', authController.adminLogin);

// POST /api/auth/student-login
router.post('/student-login', authController.studentLogin);

// POST /api/auth/faculty-login
router.post('/faculty-login', authController.facultyLogin);

// POST /api/auth/superadmin-login
router.post('/superadmin-login', authController.superAdminLogin);

// POST /api/auth/institute-creation
router.post('/institute-creation', authController.createInstitute);

// POST /api/auth/join-institution
router.post('/join-institution', authController.joinInstitution);

export default router;