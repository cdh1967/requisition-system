// modules/trail/trailService.js
const API = '/api/trail'

let cache = []

export async function refreshTrailLogs() {
  const res = await fetch(API, { credentials: 'include' })
  if (res.ok) cache = await res.json()
  return cache
}

export function getTrailLogs() {
  return cache
}

export async function logAction(user, action, details) {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user, action, details })
  })
  await refreshTrailLogs()
}

export async function clearTrailLogs() {
  await fetch(API, { method: 'DELETE', credentials: 'include' })
  cache = []
}