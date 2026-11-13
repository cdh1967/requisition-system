import { generateId } from './storage.js';
import { addTrailLog } from './trail/trailService.js';

const KEY_USERS = 'rsi_users';
const KEY_RESETS = 'rsi_password_resets';

export function initUsers() {
  let users = getUsers();
  if (users.length === 0) {
    users = [
      {
        id: generateId(),
        empId: '0000',
        name: 'Super Administrator',
        email: 'superadmin@system.com',
        department: 'Administration',
        username: 'superadmin',
        password: 'super123',
        role: 'Superadmin',
        status: 'Active'
      },
      {
        id: generateId(),
        empId: '0001',
        name: 'System Administrator',
        email: 'admin@system.com',
        department: 'Administration',
        username: 'admin',
        password: 'admin123',
        role: 'Administrator',
        status: 'Active'
      },
      {
        id: generateId(),
        empId: '0002',
        name: 'Head Office Manager',
        email: 'headoffice@system.com',
        department: 'Head Office',
        username: 'headoffice',
        password: 'head123',
        role: 'Head Office',
        status: 'Active'
      },
      {
        id: generateId(),
        empId: '0003',
        name: 'Supply Release Staff',
        email: 'supply@system.com',
        department: 'Supply',
        username: 'supply',
        password: 'supply123',
        role: 'Supply Release',
        status: 'Active'
      }
    ];
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }
}

export function getUsers() {
  return JSON.parse(localStorage.getItem(KEY_USERS)) || [];
}

export function addUser({ empId, name, email, department, username, password, role, status }) {
  const users = getUsers();
  
  if (users.find(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return { ok: false, message: 'Username already exists' };
  }

  const newUser = {
    id: generateId(),
    empId: empId.trim() || 'N/A',
    name: name.trim(),
    email: email.trim(),
    department: department.trim() || 'N/A',
    username: username.trim(),
    password: password.trim(),
    role: role.trim() || 'Staff',
    status: status || 'Active'
  };

  users.push(newUser);
  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  return { ok: true, user: newUser };
}

export function deleteUser(id, currentUserRole) {
  const users = getUsers();
  const userToDelete = users.find(u => u.id === id);
  
  if (!userToDelete) return { ok: false, message: 'User not found' };

  if (userToDelete.username === 'admin' || userToDelete.username === 'superadmin') {
    return { ok: false, message: 'Cannot delete the main accounts' };
  }

  if (currentUserRole === 'Administrator' && userToDelete.role === 'Superadmin') {
    return { ok: false, message: 'Administrator cannot delete a Superadmin' };
  }

  const filtered = users.filter(u => u.id !== id);
  localStorage.setItem(KEY_USERS, JSON.stringify(filtered));
  return { ok: true };
}

export function updateUser(id, updatedData) {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) return { ok: false, message: 'User not found' };

  if (updatedData.username) {
    const existingUser = users.find(
      u => u.username.toLowerCase() === updatedData.username.trim().toLowerCase() && u.id !== id
    );
    if (existingUser) {
      return { ok: false, message: 'Username already exists' };
    }
  }

  users[userIndex] = {
    ...users[userIndex],
    ...updatedData
  };

  localStorage.setItem(KEY_USERS, JSON.stringify(users));
  return { ok: true };
}

export function login(username, password) {
  const users = getUsers();
  const user = users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  
  if (user) {
    if (user.status === 'Inactive') {
      addTrailLog('LOGIN_FAILED', `Deactivated account attempted login: ${username}`);
      return { ok: false, message: 'Account is deactivated. Contact Admin.' };
    }
    addTrailLog('LOGIN_SUCCESS', `User ${user.username} logged in.`, user.username);
    return { ok: true, user };
  }
  
  addTrailLog('LOGIN_FAILED', `Invalid login attempt for username: ${username}`);
  return { ok: false, message: 'Invalid username or password' };
}

// --- RESET PASSWORD FUNCTIONS ---
export function requestPasswordReset(username) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  
  if (!user) return { ok: false, message: 'Username not found.' };

  const resets = getResetRequests();
  
  if (resets.find(r => r.username === user.username)) {
    return { ok: false, message: 'You already have a pending request.' };
  }

  resets.push({
    id: generateId(),
    username: user.username,
    name: user.name,
    date: new Date().toISOString()
  });

  localStorage.setItem(KEY_RESETS, JSON.stringify(resets));
  return { ok: true, message: 'Reset request submitted. Please wait for Admin.' };
}

export function getResetRequests() {
  return JSON.parse(localStorage.getItem(KEY_RESETS)) || [];
}

export function approvePasswordReset(resetId, newPassword) {
  const resets = getResetRequests();
  const request = resets.find(r => r.id === resetId);
  if (!request) return { ok: false, message: 'Request not found' };

  const users = getUsers();
  const userIndex = users.findIndex(u => u.username === request.username);
  
  if (userIndex !== -1) {
    users[userIndex].password = newPassword.trim();
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
  }

  const filteredResets = resets.filter(r => r.id !== resetId);
  localStorage.setItem(KEY_RESETS, JSON.stringify(filteredResets));

  return { ok: true, message: 'Password reset successfully' };
}

export function rejectPasswordReset(resetId) {
  const resets = getResetRequests();
  const filtered = resets.filter(r => r.id !== resetId);
  localStorage.setItem(KEY_RESETS, JSON.stringify(filtered));
  return { ok: true };
}