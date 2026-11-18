// modules/requisition.js
const API = '/api/requisitions'

export async function getRequisitions() {
  const res = await fetch(API, { credentials: 'include' })
  return res.ok ? await res.json() : []
}

export async function createRequisition(data) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })
  const result = await res.json()
  return res.ok ? { ok: true, slip: result } : { ok: false, message: result.message }
}

export async function approveHeadOffice(id) {
  const res = await fetch(`${API}/${id}/approve-head`, { method: 'POST', credentials: 'include' })
  return { ok: res.ok }
}

export async function approveSupplyRelease(id) {
  const res = await fetch(`${API}/${id}/approve-supply`, { method: 'POST', credentials: 'include' })
  return { ok: res.ok }
}

export async function disapproveRequisition(id) {
  const res = await fetch(`${API}/${id}/disapprove`, { method: 'POST', credentials: 'include' })
  return { ok: res.ok }
}