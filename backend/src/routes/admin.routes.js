import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as noticeController from '../controllers/notice.controller.js';
import * as analyticsController from '../controllers/analytics.controller.js';
import * as timetableController from '../controllers/timetable.controller.js';
import * as feedbackController from '../controllers/feedback.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as resourcesController from '../controllers/resources.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as securityController from '../controllers/security.controller.js';
import * as reportsController from '../controllers/reports.controller.js';
import * as institutionController from '../controllers/institution.controller.js';
import * as assignmentsController from '../controllers/assignments.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { uploadResourceFile } from '../middleware/upload.middleware.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// Dashboard summary
router.get('/dashboard', dashboardController.getDashboard);

// Institution profile (AdminInstitution page — Profile tab)
router.get('/institution', institutionController.getInstitutionProfile);
router.patch('/institution', institutionController.updateInstitutionProfile);

// Student/faculty signup approval (closes the join-institution flow)
router.get('/join-requests', adminController.listJoinRequests);
router.post('/join-requests/:id/approve', adminController.approveJoinRequest);
router.post('/join-requests/:id/reject', adminController.rejectJoinRequest);

// Department management
router.get('/departments', adminController.listDepartments);
router.post('/departments', adminController.createDepartment);
router.patch('/departments/:id', adminController.updateDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Course management
router.get('/courses', adminController.listCourses);
router.post('/courses', adminController.createCourse);
router.patch('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// Faculty management
router.get('/faculty', adminController.listFaculty);
router.get('/faculty/:id', adminController.getFaculty);
router.post('/faculty', adminController.createFaculty);
router.patch('/faculty/:id', adminController.updateFaculty);
router.delete('/faculty/:id', adminController.deleteFaculty);

// Student management
router.get('/students', adminController.listStudents);
router.get('/students/:id', adminController.getStudent);
router.post('/students', adminController.createStudent);
router.patch('/students/:id', adminController.updateStudent);
router.delete('/students/:id', adminController.deleteStudent);

// Audit logs
router.get('/audit-logs', adminController.listAuditLogs);

// Notices
router.get('/notices', noticeController.listNotices);
router.get('/notices/:id', noticeController.getNotice);
router.post('/notices', noticeController.createNotice);
router.patch('/notices/:id', noticeController.updateNotice);
router.delete('/notices/:id', noticeController.deleteNotice);

// Analytics (institution-wide attendance/performance rollups)
router.get('/analytics/attendance-overview', analyticsController.attendanceOverview);
router.get('/analytics/attendance-by-department', analyticsController.attendanceByDepartment);
router.get('/analytics/attendance-trend', analyticsController.attendanceTrend);
router.get('/analytics/attendance-heatmap', analyticsController.attendanceHeatmap);
router.get('/analytics/performance-overview', analyticsController.performanceOverview);
router.get('/analytics/performance-trend', analyticsController.performanceTrend);
router.get('/analytics/subject-performance', analyticsController.subjectPerformance);
router.get('/analytics/student-risk', analyticsController.studentRisk);
router.get('/analytics/faculty-workload', analyticsController.facultyWorkload);
router.get('/analytics/at-risk-students', analyticsController.atRiskStudents);

router.get('/assignments-overview', assignmentsController.getAssignmentsOverview);

// Timetable management
router.get('/timetable', timetableController.listTimetableSlots);
router.get('/timetable/:id', timetableController.getTimetableSlot);
router.post('/timetable', timetableController.createTimetableSlot);
router.post('/timetable/generate', timetableController.generateTimetable);
router.patch('/timetable/:id', timetableController.updateTimetableSlot);
router.delete('/timetable/:id', timetableController.deleteTimetableSlot);

// Feedback review
router.get('/feedback', feedbackController.listFeedback);
router.get('/feedback/:id', feedbackController.getFeedback);
router.delete('/feedback/:id', feedbackController.deleteFeedback);

// Resources (AdminResources page)
router.get('/resources', resourcesController.listResources);
router.get('/resources/summary', resourcesController.resourcesSummary);
router.get('/resources/export', resourcesController.exportResourcesCsv);
router.post('/resources', uploadResourceFile, resourcesController.uploadResource);
router.post('/resources/:id/approve', resourcesController.approveResource);
router.post('/resources/:id/reject', resourcesController.rejectResource);
router.post('/resources/:id/download', resourcesController.registerDownload);
router.delete('/resources', resourcesController.bulkDeleteResources);
router.delete('/resources/:id', resourcesController.deleteResource);

// Settings (AdminSettings page)
router.get('/settings', settingsController.getSettings);
router.patch('/settings', settingsController.updateSettings);
router.post('/settings/change-password', settingsController.changePassword);
router.post('/settings/sign-out-all-devices', settingsController.signOutAllDevices);
router.post('/settings/export-institution-data', settingsController.exportInstitutionData);

// Security Center
router.get('/security/overview', securityController.securityOverview);
router.patch('/security', securityController.updateSecurity);
router.post('/security/regenerate-institute-code', securityController.regenerateInstituteCode);

// Reports
router.post('/reports/generate', reportsController.generateReport);
router.get('/reports/recent', reportsController.listRecentReports);
router.delete('/reports/:id', reportsController.deleteReport);

export default router;