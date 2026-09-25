import { Router } from 'express';
import * as facultyController from '../controllers/faculty.controller.js';
import * as faceController from '../controllers/face.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadResourceFile } from '../middleware/upload.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('faculty'));

router.get('/me', (req, res) => {
  res.json({ faculty: req.user });
});

router.get('/profile', facultyController.getProfile);
router.put('/profile', facultyController.updateProfile);

router.get('/dashboard', facultyController.getDashboard);
router.get('/classes', facultyController.getMyClasses);
router.get('/timetable', facultyController.getTimetable);
router.get('/performance', facultyController.getStudentPerformance);
router.get('/notices', facultyController.getNotices);
router.get('/feedback', facultyController.getFeedback);

router.get('/resources', facultyController.getResources);
router.post('/resources', uploadResourceFile, facultyController.uploadResource);
router.delete('/resources/:id', facultyController.deleteResource);

router.get('/attendance/roster', facultyController.getAttendanceRoster);
router.post('/attendance', facultyController.markAttendance);
router.post('/attendance/face-recognize', faceController.recognizeFaces);

router.get('/assignments', facultyController.listAssignments);
router.post('/assignments', facultyController.createAssignment);
router.get('/assignments/:id/submissions', facultyController.listSubmissions);
router.patch('/submissions/:id', facultyController.gradeSubmission);

router.get('/periodic-tests', facultyController.listPeriodicTests);
router.post('/periodic-tests', facultyController.createPeriodicTest);
router.patch('/periodic-tests/:id/results', facultyController.recordPeriodicTestResults);

router.get('/settings', facultyController.getSettings);
router.patch('/settings', facultyController.updateSettings);
router.post('/settings/change-password', facultyController.changePassword);
router.post('/settings/sign-out-all-devices', facultyController.signOutAllDevices);
router.post('/settings/request-deactivation', facultyController.requestDeactivation);

router.get('/workload', facultyController.getWorkload);

router.get('/lesson-plans', facultyController.listLessonPlans);
router.post('/lesson-plans/generate', facultyController.generateLessonPlan);
router.post('/lesson-plans', facultyController.saveLessonPlan);

export default router;