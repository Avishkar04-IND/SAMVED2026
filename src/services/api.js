import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(config => {
  const user = JSON.parse(localStorage.getItem('safetynet_user') || '{}');
  if (user?.id)   config.headers['x-user-id']   = user.id;
  if (user?.role) config.headers['x-user-role'] = user.role;
  return config;
});

// ── AUTH ──────────────────────────────────────────────────────
export const workerLogin     = (data) => api.post('/auth/worker/login',     data);
export const supervisorLogin = (data) => api.post('/auth/supervisor/login', data);

// ── PROFILE ───────────────────────────────────────────────────
export const updateProfile = (role, userId, data) => api.patch(`/auth/profile/${role}/${userId}`, data);

// ── WORKERS ───────────────────────────────────────────────────
export const getUnassignedWorkers   = ()           => api.get('/workers/unassigned');
export const getWorkersBySupervisor = (supId)      => api.get(`/workers/supervisor/${supId}`);
export const updateWorkerStatus     = (id, status) => api.patch(`/workers/${id}/status`, { status });

// ── SUPERVISOR ────────────────────────────────────────────────
export const assignWorkers = (supId, workerIds) => api.post(`/supervisor/${supId}/assign`, { workerIds });
export const removeWorker  = (supId, workerId)  => api.delete(`/supervisor/${supId}/remove/${workerId}`);

// ── TASKS ─────────────────────────────────────────────────────
export const autoAssignTask = (workerId) => api.post(`/tasks/${workerId}/assign`);
export const getCurrentTask = (workerId) => api.get(`/tasks/${workerId}/current`);
export const completeTask   = (workerId) => api.patch(`/tasks/${workerId}/complete`);
export const getTaskHistory = (workerId) => api.get(`/tasks/${workerId}/history`);

// ── ALERTS ────────────────────────────────────────────────────
export const getAlerts  = (supId)         => api.get(`/alerts/supervisor/${supId}`);
export const triggerSOS = (workerId, data) => api.post(`/alerts/${workerId}/sos`, data);

export default api;