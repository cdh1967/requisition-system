const BASE_URL = 'http://localhost:3000/api'; // Ilisi ang localhost sa IP sa imong VMware kung layo ang access

export const api = {
  login: async (username, password) => {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error((await res.json()).message);
    return res.json();
  },

  getInventory: async () => {
    const res = await fetch(`${BASE_URL}/inventory`);
    return res.json();
  },

  updateInventory: async (id, data) => {
    const res = await fetch(`${BASE_URL}/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  deleteInventory: async (id) => {
    const res = await fetch(`${BASE_URL}/inventory/${id}`, { method: 'DELETE' });
    return res.json();
  },

  getRequisitions: async () => {
    const res = await fetch(`${BASE_URL}/requisitions`);
    return res.json();
  },

  createRequisition: async (data) => {
    const res = await fetch(`${BASE_URL}/requisitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  approveRequisition: async (id, role) => {
    const res = await fetch(`${BASE_URL}/requisitions/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    return res.json();
  }
};