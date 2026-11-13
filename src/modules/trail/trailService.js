// Trail Log Service
const PREFIX = import.meta.env.VITE_STORAGE_PREFIX || 'rsi_';
const KEY_TRAIL = `${PREFIX}trail_logs`;

export function getTrailLogs() {
  return JSON.parse(localStorage.getItem(KEY_TRAIL)) || [];
}

export function addTrailLog(action, details, user = 'System') {
  const logs = getTrailLogs();
  
  const newLog = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    user: user,
    action: action, // e.g., 'LOGIN', 'APPROVE', 'DEDUCT', 'ADD_ITEM'
    details: details // e.g., 'User superadmin logged in', 'Approved slip RS-123456'
  };

  logs.unshift(newLog); // Ibutang sa pinaka-una
  
  // Limitahan nato sa 1000 logs aron dili mo-bug-at ang localStorage
  if (logs.length > 1000) {
    logs.pop();
  }

  localStorage.setItem(KEY_TRAIL, JSON.stringify(logs));
  return newLog;
}

export function clearTrailLogs() {
  localStorage.removeItem(KEY_TRAIL);
}