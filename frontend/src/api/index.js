import axios from 'axios'

const BASE = '/api'

function getToken() {
  return localStorage.getItem('appeng_token')
}

function handleUnauthorized() {
  localStorage.removeItem('appeng_token')
  localStorage.removeItem('appeng_user')
  window.location.href = '/login'
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────
  login: (username, password) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      return data
    }),

  me: () => request('/auth/me'),

  changePassword: (old_password, new_password) =>
    request('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password, new_password }),
    }),

  // ── Users (admin) ─────────────────────────────────────────────
  listUsers: () => request('/auth/users'),
  createUser: (username, password, role) =>
    request('/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    }),
  deleteUser: (username) =>
    request(`/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  // ── Admin ─────────────────────────────────────────────────────
  adminHealth:  () => request('/admin/health'),
  adminLogs:    (limit = 200, level = '', source = '') =>
    request(`/admin/logs?limit=${limit}${level ? `&level=${level}` : ''}${source ? `&source=${source}` : ''}`),
  clearLogs:    () => request('/admin/logs', { method: 'DELETE' }),
  adminConfig:  () => request('/admin/config'),
  setConfig:    (key, value) =>
    request(`/admin/config/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }),
  resetConfig:  (key) =>
    request(`/admin/config/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  frontendLog: (level, message, loggerName = 'frontend') =>
    request('/admin/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, logger: loggerName }),
    }).catch(() => {}),

  // ── Files ─────────────────────────────────────────────────────
  browse:          (prefix = '') => request(`/browse?prefix=${encodeURIComponent(prefix)}`),
  bucketInfo:      ()            => request('/bucket-info'),
  searchFiles:     (q)           => request(`/search?q=${encodeURIComponent(q)}`),
  embeddingStatus: (filename)    => request(`/embedding-status?filename=${encodeURIComponent(filename)}`),
  health:          ()            => fetch(`${BASE}/health`).then(r => r.json()),
  healthFull:      ()            => request('/health/full'),

  upload(prefix, file, onProgress) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('prefix', prefix)
    const token = getToken()
    return axios
      .post(`${BASE}/upload`, fd, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total))
        },
      })
      .then(res => res.data)
      .catch(err => {
        if (err.response?.status === 401) handleUnauthorized()
        throw new Error(err.response?.data?.detail || err.message || 'Upload failed')
      })
  },

  download:   (path) => `/api/download?path=${encodeURIComponent(path)}`,
  previewUrl: (path) => `/api/preview?path=${encodeURIComponent(path)}`,

  deleteFile:   (path) => request(`/delete?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),
  deleteFolder: (path) => request(`/delete-folder?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  createFolder: (prefix, folder_name) =>
    request('/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, folder_name }),
    }),

  reEmbed: (path) =>
    request('/re-embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }),

  chat: (question, history) =>
    request('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    }),

  // ── Systems ───────────────────────────────────────────────────
  listSystems:   ()     => request('/systems'),
  addSystem:     (body) => request('/systems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  updateSystem:  (id, body) => request(`/systems/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteSystem:  (id)   => request(`/systems/${id}`, { method: 'DELETE' }),
  checkSystem:   (id)   => request(`/systems/${id}/check`),
  restartRunner: (id)   => request(`/systems/${id}/restart`, { method: 'POST' }),
  openTerminal:  (id)   => request(`/systems/${id}/terminal`, { method: 'POST' }),

  // ── Links ─────────────────────────────────────────────────────
  listLinks:  ()     => request('/links'),
  addLink:    (body) => request('/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteLink: (id)   => request(`/links/${id}`, { method: 'DELETE' }),

  // ── Demo Feedback ──────────────────────────────────────────────
  listDemos: (customer, month) => {
    const p = new URLSearchParams()
    if (customer) p.set('customer', customer)
    if (month)    p.set('month', month)
    const q = p.toString()
    return request(`/demo${q ? '?' + q : ''}`)
  },
  listDemoCustomers: () => request('/demo/customers'),
  createDemo: (body) => request('/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  updateDemo: (id, body) => request(`/demo/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  deleteDemo: (id) => request(`/demo/${id}`, { method: 'DELETE' }),
}
