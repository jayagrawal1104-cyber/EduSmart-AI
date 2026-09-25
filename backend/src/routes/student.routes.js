import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import * as studyAssistantController from '../controllers/study-assistant.controller.js';
import * as faceController from '../controllers/face.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('student'));

router.get('/dashboard', studentController.getDashboard);
router.get('/attendance', studentController.getAttendance);
router.get('/assignments', studentController.getAssignments);
router.get('/performance', studentController.getPerformance);
router.get('/periodic-tests', studentController.getPeriodicTests);
router.get('/timetable', studentController.getTimetable);
router.get('/resources', studentController.getResources);
router.post('/resources/:id/download', studentController.registerResourceDownload);
router.get('/notices', studentController.getNotices);
router.get('/profile', studentController.getProfile);
router.put('/profile', studentController.updateProfile);
router.get('/feedback/faculty-options', studentController.getFacultyOptions);
router.get('/feedback', studentController.getMyFeedback);
router.post('/feedback', studentController.submitFeedback);
router.get('/settings', studentController.getSettings);
router.patch('/settings', studentController.updateSettings);
router.post('/settings/change-password', studentController.changePassword);
router.post('/settings/sign-out-all-devices', studentController.signOutAllDevices);
router.post('/settings/request-deactivation', studentController.requestDeactivation);
router.get('/ai/courses', studyAssistantController.getCourses);
router.post('/ai/chat', studyAssistantController.chat);

router.get('/face/status', faceController.getFaceStatus);
router.post('/face/enroll', faceController.enrollFace);
router.delete('/face/enroll', faceController.deleteFaceEnrollment);

export default router;