import axios from 'axios'

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  browse:          (prefix = '') => request(`/browse?prefix=${encodeURIComponent(prefix)}`),
  bucketInfo:      ()            => request('/bucket-info'),
  embeddingStatus: (filename)    => request(`/embedding-status?filename=${encodeURIComponent(filename)}`),
  health:          ()            => request('/health'),
  healthFull:      ()            => request('/health/full'),

  upload(prefix, file, onProgress) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('prefix', prefix)
    return axios
      .post(`${BASE}/upload`, fd, {
        onUploadProgress: (event) => {
          if (event.total) {
            onProgress?.(Math.round((event.loaded * 100) / event.total))
          }
        },
      })
      .then(res => res.data)
      .catch(err => {
        throw new Error(err.response?.data?.detail || err.message || 'Upload failed')
      })
  },

  download:  (path) => `/api/download?path=${encodeURIComponent(path)}`,
  previewUrl:(path) => `/api/preview?path=${encodeURIComponent(path)}`,

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
}
