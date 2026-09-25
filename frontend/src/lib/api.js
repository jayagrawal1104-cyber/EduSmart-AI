// Thin fetch wrapper around the Express backend.
// Base URL comes from VITE_API_URL (see .env / .env.example); falls back to
// the local dev backend so `npm run dev` works out of the box.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// Uploaded/generated files (resources, reports, exports) are served by the
// backend under /uploads, not /api — strip the /api suffix to get their host.
export const FILE_BASE_URL = BASE_URL.replace(/\/api\/?$/, '');

/** Builds an absolute, openable/downloadable URL from a fileUrl the backend returned (e.g. "/uploads/resources/...")  */
export function fileUrl(relativeUrl) {
  return relativeUrl ? `${FILE_BASE_URL}${relativeUrl}` : '';
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // Full parsed JSON error body, when the backend sent one (e.g. the
    // timetable clash-detection endpoints return `{ error, conflicts }`).
    this.data = data ?? null;
  }
}

/**
 * @param {string} path - e.g. '/auth/admin-login'
 * @param {{ method?: string, body?: object, token?: string|null }} [opts]
 */
async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Network failure (backend not running, CORS, offline, etc.)
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No/invalid JSON body — fall through with data = null
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }

  return data;
}

/**
 * Same contract as `request`, but sends a FormData body (multipart) instead
 * of JSON — used for file uploads. Content-Type is deliberately left unset
 * so the browser can add the multipart boundary itself.
 */
async function requestUpload(path, { method = 'POST', formData, token }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: formData });
  } catch (err) {
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no/invalid JSON body
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }

  return data;
}

/**
 * Fetches a file (CSV export, etc.) with the auth header attached — needed
 * because a plain <a href> can't send an Authorization header — and triggers
 * a browser download via a temporary object URL.
 */
async function downloadFile(path, { token, filename }) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json())?.error || message;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const authApi = {
  adminLogin: (payload) => request('/auth/admin-login', { method: 'POST', body: payload }),
  studentLogin: (payload) => request('/auth/student-login', { method: 'POST', body: payload }),
  facultyLogin: (payload) => request('/auth/faculty-login', { method: 'POST', body: payload }),
  superAdminLogin: (payload) => request('/auth/superadmin-login', { method: 'POST', body: payload }),
  createInstitute: (payload) => request('/auth/institute-creation', { method: 'POST', body: payload }),
  joinInstitution: (payload) => request('/auth/join-institution', { method: 'POST', body: payload }),
  lookupInstitute: (code) => request(`/auth/institute/${encodeURIComponent(code)}`),
  // Admin-created departments/courses only — powers the join form's pickers
  // before the applicant has any account/token.
  listInstituteDepartments: (code) => request(`/auth/institute/${encodeURIComponent(code)}/departments`),
  listInstituteCourses: (code, departmentId) =>
    request(`/auth/institute/${encodeURIComponent(code)}/courses${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ''}`),
};

/**
 * All admin endpoints require the admin's JWT — pass it as `token` in every call.
 * See backend/src/routes/admin.routes.js + admin.controller.js.
 */
export const adminApi = {
  listJoinRequests: (token, status) =>
    request(`/admin/join-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`, { token }),
  approveJoinRequest: (token, id, payload) =>
    request(`/admin/join-requests/${encodeURIComponent(id)}/approve`, { method: 'POST', body: payload, token }),
  rejectJoinRequest: (token, id) =>
    request(`/admin/join-requests/${encodeURIComponent(id)}/reject`, { method: 'POST', token }),
  listDepartments: (token) => request('/admin/departments', { token }),
  createDepartment: (token, payload) =>
    request('/admin/departments', { method: 'POST', body: payload, token }),
  updateDepartment: (token, id, payload) =>
    request(`/admin/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteDepartment: (token, id, force = false) =>
    request(`/admin/departments/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE', token }),

  listCourses: (token, departmentId) =>
    request(`/admin/courses${departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ''}`, { token }),
  createCourse: (token, payload) =>
    request('/admin/courses', { method: 'POST', body: payload, token }),
  updateCourse: (token, id, payload) =>
    request(`/admin/courses/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteCourse: (token, id, force = false) =>
    request(`/admin/courses/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE', token }),

  /**
   * @param {{ search?: string, departmentId?: string, status?: string }} [filters]
   */
  listFaculty: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/faculty${params ? `?${params}` : ''}`, { token });
  },
  getFaculty: (token, id) => request(`/admin/faculty/${encodeURIComponent(id)}`, { token }),
  createFaculty: (token, payload) =>
    request('/admin/faculty', { method: 'POST', body: payload, token }),
  updateFaculty: (token, id, payload) =>
    request(`/admin/faculty/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteFaculty: (token, id, force = false) =>
    request(`/admin/faculty/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE', token }),

  /**
   * @param {{ search?: string, departmentId?: string, courseId?: string, year?: string|number, status?: string }} [filters]
   */
  listStudents: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/students${params ? `?${params}` : ''}`, { token });
  },
  getStudent: (token, id) => request(`/admin/students/${encodeURIComponent(id)}`, { token }),
  createStudent: (token, payload) =>
    request('/admin/students', { method: 'POST', body: payload, token }),
  updateStudent: (token, id, payload) =>
    request(`/admin/students/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteStudent: (token, id, force = false) =>
    request(`/admin/students/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE', token }),
};

/**
 * GET /api/admin/dashboard — landing-page summary (counts, 30d attendance,
 * avg performance, recent notices + activity).
 */
export const dashboardApi = {
  getDashboard: (token) => request('/admin/dashboard', { token }),
};

/**
 * Institution profile (AdminInstitution page — Profile tab). Institute
 * code/QR regeneration lives on securityApi, not here.
 */
export const institutionApi = {
  getProfile: (token) => request('/admin/institution', { token }),
  updateProfile: (token, payload) => request('/admin/institution', { method: 'PATCH', body: payload, token }),
};

/**
 * GET /api/admin/audit-logs?module=&status=&from=&to=&page=&pageSize=
 */
export const auditApi = {
  listAuditLogs: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/audit-logs${params ? `?${params}` : ''}`, { token });
  },
};

/**
 * Admin-authored notices/broadcasts.
 */
export const noticeApi = {
  listNotices: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/notices${params ? `?${params}` : ''}`, { token });
  },
  getNotice: (token, id) => request(`/admin/notices/${encodeURIComponent(id)}`, { token }),
  createNotice: (token, payload) => request('/admin/notices', { method: 'POST', body: payload, token }),
  updateNotice: (token, id, payload) =>
    request(`/admin/notices/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteNotice: (token, id) => request(`/admin/notices/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};

/**
 * Institution-wide attendance/performance rollups.
 */
export const analyticsApi = {
  attendanceOverview: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/attendance-overview${params ? `?${params}` : ''}`, { token });
  },
  attendanceByDepartment: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/attendance-by-department${params ? `?${params}` : ''}`, { token });
  },
  attendanceTrend: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/attendance-trend${params ? `?${params}` : ''}`, { token });
  },
  attendanceHeatmap: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/attendance-heatmap${params ? `?${params}` : ''}`, { token });
  },
  performanceOverview: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/performance-overview${params ? `?${params}` : ''}`, { token });
  },
  performanceTrend: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/performance-trend${params ? `?${params}` : ''}`, { token });
  },
  subjectPerformance: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/subject-performance${params ? `?${params}` : ''}`, { token });
  },
  studentRisk: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/student-risk${params ? `?${params}` : ''}`, { token });
  },
  facultyWorkload: (token) => request('/admin/analytics/faculty-workload', { token }),
  atRiskStudents: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/analytics/at-risk-students${params ? `?${params}` : ''}`, { token });
  },
};

/**
 * Institution-wide assignment analytics (AdminAssignments page).
 */
export const assignmentsApi = {
  getOverview: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/assignments-overview${params ? `?${params}` : ''}`, { token });
  },
};

/**
 * Faculty weekly schedule slots.
 */
export const timetableApi = {
  listTimetableSlots: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/timetable${params ? `?${params}` : ''}`, { token });
  },
  getTimetableSlot: (token, id) => request(`/admin/timetable/${encodeURIComponent(id)}`, { token }),
  createTimetableSlot: (token, payload) => request('/admin/timetable', { method: 'POST', body: payload, token }),
  updateTimetableSlot: (token, id, payload) =>
    request(`/admin/timetable/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, token }),
  deleteTimetableSlot: (token, id) => request(`/admin/timetable/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
  generateTimetable: (token, payload) => request('/admin/timetable/generate', { method: 'POST', body: payload, token }),
};

/**
 * Feedback submitted by students/faculty, reviewed by admins.
 */
export const feedbackApi = {
  listFeedback: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/feedback${params ? `?${params}` : ''}`, { token });
  },
  getFeedback: (token, id) => request(`/admin/feedback/${encodeURIComponent(id)}`, { token }),
  deleteFeedback: (token, id) => request(`/admin/feedback/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};

/**
 * Institution resource library (AdminResources page).
 * See backend/src/routes/admin.routes.js + resources.controller.js.
 */
export const resourcesApi = {
  listResources: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return request(`/admin/resources${params ? `?${params}` : ''}`, { token });
  },
  getSummary: (token) => request('/admin/resources/summary', { token }),
  /** @param {{ title: string, subject: string, departmentId: string, type: string, file: File }} fields */
  uploadResource: (token, fields) => {
    const formData = new FormData();
    formData.append('title', fields.title);
    formData.append('subject', fields.subject);
    formData.append('departmentId', fields.departmentId);
    formData.append('type', fields.type);
    formData.append('file', fields.file);
    return requestUpload('/admin/resources', { formData, token });
  },
  approveResource: (token, id) => request(`/admin/resources/${encodeURIComponent(id)}/approve`, { method: 'POST', token }),
  rejectResource: (token, id) => request(`/admin/resources/${encodeURIComponent(id)}/reject`, { method: 'POST', token }),
  registerDownload: (token, id) => request(`/admin/resources/${encodeURIComponent(id)}/download`, { method: 'POST', token }),
  deleteResource: (token, id) => request(`/admin/resources/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
  bulkDeleteResources: (token, ids) => request('/admin/resources', { method: 'DELETE', body: { ids }, token }),
  exportResourcesCsv: (token, filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const params = new URLSearchParams(clean).toString();
    return downloadFile(`/admin/resources/export${params ? `?${params}` : ''}`, { token, filename: 'resources.csv' });
  },
};

/**
 * Institution-wide settings (AdminSettings page). One row per institution —
 * shares storage with securityApi below (twoFactorRequired, sessionTimeoutMinutes,
 * qrLoginEnabled, joinApprovalRequired live in the same backend record).
 */
export const settingsApi = {
  getSettings: (token) => request('/admin/settings', { token }),
  updateSettings: (token, payload) => request('/admin/settings', { method: 'PATCH', body: payload, token }),
  changePassword: (token, payload) => request('/admin/settings/change-password', { method: 'POST', body: payload, token }),
  signOutAllDevices: (token) => request('/admin/settings/sign-out-all-devices', { method: 'POST', token }),
  exportInstitutionData: (token) => request('/admin/settings/export-institution-data', { method: 'POST', token }),
};

/**
 * Security Center page — score/checklist plus the same shared security
 * settings surfaced by settingsApi.
 */
export const securityApi = {
  getOverview: (token) => request('/admin/security/overview', { token }),
  updateSecurity: (token, payload) => request('/admin/security', { method: 'PATCH', body: payload, token }),
  regenerateInstituteCode: (token) => request('/admin/security/regenerate-institute-code', { method: 'POST', token }),
};

/**
 * Reports page — generates a real CSV from live data and lists previously
 * generated reports.
 */
export const reportsApi = {
  generateReport: (token, payload) => request('/admin/reports/generate', { method: 'POST', body: payload, token }),
  listRecent: (token, limit) => request(`/admin/reports/recent${limit ? `?limit=${limit}` : ''}`, { token }),
  deleteReport: (token, id) => request(`/admin/reports/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
  // Generated report files are served as public static assets (see backend
  // app.js) — no auth header needed to fetch them, so components just open
  // fileUrl(report.fileUrl) directly (e.g. in a new tab) rather than calling
  // anything here.
};

export default request;

/**
 * Faculty-facing endpoints (mounted under /api/faculty, requireRole('faculty')).
 */
export const facultyApi = {
  getMe: (token) => request('/faculty/me', { token }),
  getProfile: (token) => request('/faculty/profile', { token }),
  updateProfile: (token, payload) => request('/faculty/profile', { method: 'PUT', body: payload, token }),
  getDashboard: (token) => request('/faculty/dashboard', { token }),
  getMyClasses: (token) => request('/faculty/classes', { token }),
  getTimetable: (token) => request('/faculty/timetable', { token }),
  getStudentPerformance: (token, { subjectId, section }) => {
    const params = new URLSearchParams({ subjectId });
    if (section) params.set('section', section);
    return request(`/faculty/performance?${params}`, { token });
  },
  getNotices: (token) => request('/faculty/notices', { token }),
  getFeedback: (token) => request('/faculty/feedback', { token }),

  getResources: (token) => request('/faculty/resources', { token }),
  /** @param {{ title: string, subject: string, type: string, description?: string, file: File }} fields */
  uploadResource: (token, fields) => {
    const formData = new FormData();
    formData.append('title', fields.title);
    formData.append('subject', fields.subject);
    formData.append('type', fields.type);
    if (fields.description) formData.append('description', fields.description);
    formData.append('file', fields.file);
    return requestUpload('/faculty/resources', { formData, token });
  },
  deleteResource: (token, id) => request(`/faculty/resources/${encodeURIComponent(id)}`, { method: 'DELETE', token }),

  getAttendanceRoster: (token, { subjectId, section, date }) =>
    request(`/faculty/attendance/roster?${new URLSearchParams({ subjectId, section, date })}`, { token }),
  markAttendance: (token, payload) => request('/faculty/attendance', { method: 'POST', body: payload, token }),
  /** @param {{ section: string, descriptors: number[][] }} payload — descriptors from one camera frame */
  recognizeFaces: (token, payload) => request('/faculty/attendance/face-recognize', { method: 'POST', body: payload, token }),

  listAssignments: (token) => request('/faculty/assignments', { token }),
  createAssignment: (token, payload) => request('/faculty/assignments', { method: 'POST', body: payload, token }),
  listSubmissions: (token, assignmentId) =>
    request(`/faculty/assignments/${encodeURIComponent(assignmentId)}/submissions`, { token }),
  gradeSubmission: (token, submissionId, marks) =>
    request(`/faculty/submissions/${encodeURIComponent(submissionId)}`, { method: 'PATCH', body: { marks }, token }),

  listPeriodicTests: (token) => request('/faculty/periodic-tests', { token }),
  createPeriodicTest: (token, payload) => request('/faculty/periodic-tests', { method: 'POST', body: payload, token }),
  recordPeriodicTestResults: (token, testId, results) =>
    request(`/faculty/periodic-tests/${encodeURIComponent(testId)}/results`, {
      method: 'PATCH',
      body: { results },
      token,
    }),

  getSettings: (token) => request('/faculty/settings', { token }),
  updateSettings: (token, payload) => request('/faculty/settings', { method: 'PATCH', body: payload, token }),
  changePassword: (token, payload) => request('/faculty/settings/change-password', { method: 'POST', body: payload, token }),
  signOutAllDevices: (token) => request('/faculty/settings/sign-out-all-devices', { method: 'POST', token }),
  requestDeactivation: (token) => request('/faculty/settings/request-deactivation', { method: 'POST', token }),

  getWorkload: (token) => request('/faculty/workload', { token }),

  listLessonPlans: (token) => request('/faculty/lesson-plans', { token }),
  generateLessonPlan: (token, payload) => request('/faculty/lesson-plans/generate', { method: 'POST', body: payload, token }),
  saveLessonPlan: (token, payload) => request('/faculty/lesson-plans', { method: 'POST', body: payload, token }),
};
/**
 * Student-facing endpoints (mounted under /api/student, requireRole('student')).
 */
export const studentApi = {
  getDashboard: (token) => request('/student/dashboard', { token }),
  getAttendance: (token) => request('/student/attendance', { token }),
  getAssignments: (token) => request('/student/assignments', { token }),
  getPerformance: (token) => request('/student/performance', { token }),
  getPeriodicTests: (token) => request('/student/periodic-tests', { token }),
  getTimetable: (token) => request('/student/timetable', { token }),
  getResources: (token) => request('/student/resources', { token }),
  registerResourceDownload: (token, id) => request(`/student/resources/${encodeURIComponent(id)}/download`, { method: 'POST', token }),
  getNotices: (token) => request('/student/notices', { token }),
  getProfile: (token) => request('/student/profile', { token }),
  updateProfile: (token, payload) => request('/student/profile', { method: 'PUT', body: payload, token }),
  getFeedbackFacultyOptions: (token) => request('/student/feedback/faculty-options', { token }),
  getMyFeedback: (token) => request('/student/feedback', { token }),
  submitFeedback: (token, payload) => request('/student/feedback', { method: 'POST', body: payload, token }),
  getSettings: (token) => request('/student/settings', { token }),
  updateSettings: (token, payload) => request('/student/settings', { method: 'PATCH', body: payload, token }),
  changePassword: (token, payload) => request('/student/settings/change-password', { method: 'POST', body: payload, token }),
  signOutAllDevices: (token) => request('/student/settings/sign-out-all-devices', { method: 'POST', token }),
  requestDeactivation: (token) => request('/student/settings/request-deactivation', { method: 'POST', token }),
  getAiCourses: (token) => request('/student/ai/courses', { token }),
  chatWithAi: (token, payload) => request('/student/ai/chat', { method: 'POST', body: payload, token }),

  // Face ID (Smart Attendance) — descriptor is a 128-length float array
  // computed client-side by face-api.js; the backend never receives a photo.
  getFaceStatus: (token) => request('/student/face/status', { token }),
  enrollFace: (token, descriptor) => request('/student/face/enroll', { method: 'POST', body: { descriptor }, token }),
  deleteFaceEnrollment: (token) => request('/student/face/enroll', { method: 'DELETE', token }),
};