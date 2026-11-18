const API = '/api'

export async function initUsers() {
  try { await fetch(`${API}/auth/init`, { method: 'POST' }) } catch (e) {}
}

export async function login(username, password) {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ username, password })
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, message: data.message || 'Login failed' }
    return { ok: true, user: data.user }
  } catch (e) { return { ok: false, message: 'Network error' } }
}

export async function getSession() {
  try {
    const res = await fetch(`${API}/auth/session`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data.user || null
  } catch { return null }
}

export async function clearSession() {
  try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }) } catch {}
}

export async function requestPasswordReset(username) {
  try {
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    })
    const data = await res.json()
    return { message: data.message || 'Submitted' }
  } catch { return { message: 'Network error' } }
}

export async function getUsers() {
  const res = await fetch(`${API}/users`, { credentials: 'include' })
  return res.ok ? await res.json() : []
}

export async function addUser(user) {
  const res = await fetch(`${API}/users`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(user)
  })
  const data = await res.json()
  return res.ok ? { ok: true, user: data } : { ok: false, message: data.message }
}

export async function updateUser(id, updates) {
  const res = await fetch(`${API}/users/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(updates)
  })
  const data = await res.json()
  return res.ok ? { ok: true } : { ok: false, message: data.message }
}

export async function deleteUser(id) {
  const res = await fetch(`${API}/users/${id}`, { method: 'DELETE', credentials: 'include' })
  return { ok: res.ok }
}

export async function getResetRequests() {
  const res = await fetch(`${API}/auth/reset-requests`, { credentials: 'include' })
  return res.ok ? await res.json() : []
}

export async function approvePasswordReset(reqId, newPassword) {
  const res = await fetch(`${API}/auth/reset-requests/${reqId}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify({ newPassword })
  })
  return { ok: res.ok }
}

export async function rejectPasswordReset(reqId) {
  const res = await fetch(`${API}/auth/reset-requests/${reqId}/reject`, {
    method: 'POST', credentials: 'include'
  })
  return { ok: res.ok }
}