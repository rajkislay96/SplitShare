const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error((data && data.error) || 'Something went wrong.');
  }
  return data;
}

export const api = {
  signup: (name, email, password) => request('/auth/signup', { method: 'POST', body: { name, email, password } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/auth/me', { token }),

  listGroups: (token) => request('/groups', { token }),
  createGroup: (token, payload) => request('/groups', { method: 'POST', body: payload, token }),
  getGroup: (token, id) => request(`/groups/${id}`, { token }),
  addMember: (token, id, email) => request(`/groups/${id}/members`, { method: 'POST', body: { email }, token }),
  getBalances: (token, id) => request(`/groups/${id}/balances`, { token }),

  listExpenses: (token, groupId) => request(`/groups/${groupId}/expenses`, { token }),
  createExpense: (token, groupId, payload) => request(`/groups/${groupId}/expenses`, { method: 'POST', body: payload, token }),
  deleteExpense: (token, expenseId) => request(`/expenses/${expenseId}`, { method: 'DELETE', token }),

  createSettlement: (token, groupId, payload) => request(`/groups/${groupId}/settlements`, { method: 'POST', body: payload, token }),
  listSettlements: (token, groupId) => request(`/groups/${groupId}/settlements`, { token }),
};
