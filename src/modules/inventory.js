// modules/inventory.js
const API = '/api/inventory'

let cache = []

export async function refreshInventory() {
  const res = await fetch(API, { credentials: 'include' })
  if (res.ok) cache = await res.json()
  return cache
}

export function getInventory() {
  return cache
}

export async function addItem(item) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(item)
  })
  if (!res.ok) return false
  await refreshInventory()
  return true
}

export async function updateItem(id, updates) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates)
  })
  if (!res.ok) return false
  await refreshInventory()
  return true
}

export async function deleteItem(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) return false
  await refreshInventory()
  return true
}

export async function restockItem(id, qty, reason) {
  const res = await fetch(`${API}/${id}/restock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ qty, reason })
  })
  if (!res.ok) return false
  await refreshInventory()
  return true
}

export async function returnItem(id, qty, reason) {
  const res = await fetch(`${API}/${id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ qty, reason })
  })
  if (!res.ok) return false
  await refreshInventory()
  return true
}

export async function getLogs() {
  const res = await fetch(`${API}/logs`, { credentials: 'include' })
  return res.ok ? await res.json() : []
}

export async function deleteLog(id) {
  await fetch(`${API}/logs/${id}`, { method: 'DELETE', credentials: 'include' })
}