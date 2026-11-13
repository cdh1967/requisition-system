import {
  loadInventory,
  saveInventory,
  generateId,
  loadSeedData,
  loadLogs,
  saveLogs
} from './storage.js';
import { addTrailLog } from './trail/trailService.js';

let inventory = loadInventory();
let logs = loadLogs();

// Fix missing unitCost for existing items (Auto-migrate)
inventory = inventory.map(item => ({
  ...item,
  unitCost: item.unitCost !== undefined ? item.unitCost : 100
}));
saveInventory(inventory);

function getCurrentUsername() {
  try {
    const session = JSON.parse(localStorage.getItem('rsi_session'));
    return session ? session.username : 'System';
  } catch { return 'System'; }
}

if (inventory.length === 0) {
  inventory = loadSeedData();
  saveInventory(inventory);
}

export function getInventory() {
  return inventory;
}

export function addItem({ name, category, qty, unit, unitCost }) {
  // Force unitCost to be a valid number
  const parsedCost = Number(unitCost);
  if (isNaN(parsedCost) || parsedCost < 0) return false;

  const item = {
    id: generateId(),
    name: name.trim(),
    category: category.trim(),
    qty: Number(qty),
    unit: unit.trim(),
    unitCost: parsedCost
  };
  inventory.push(item);
  saveInventory(inventory);
  addLog(item.id, item.name, 'RESTOCK', item.qty, item.unit, 'Added new item');
  
  addTrailLog('INVENTORY_ADD', `Added new item: ${item.name} (${item.qty} ${item.unit} @ ${item.unitCost})`, getCurrentUsername());
  
  return true;
}

export function deleteItem(id) {
  const item = inventory.find(i => i.id === id);
  if (item) {
    addTrailLog('INVENTORY_DELETE', `Deleted item: ${item.name}`, getCurrentUsername());
  }
  inventory = inventory.filter((i) => i.id !== id);
  saveInventory(inventory);
}

export function deductStock(id, amount, reason = 'Requisition') {
  const item = inventory.find((i) => i.id === id);
  if (!item) return false;
  if (item.qty < amount) return false;
  
  item.qty -= amount;
  saveInventory(inventory);
  addLog(item.id, item.name, 'DEDUCT', amount, item.unit, reason);
  
  addTrailLog('INVENTORY_DEDUCT', `Deducted ${amount} ${item.unit} from ${item.name}. Reason: ${reason}`, getCurrentUsername());
  
  return true;
}

export function returnItem(id, amount, reason = 'Returned Item') {
  const item = inventory.find((i) => i.id === id);
  if (!item) return false;
  
  item.qty += Number(amount);
  saveInventory(inventory);
  addLog(item.id, item.name, 'RETURN', Number(amount), item.unit, reason);
  return true;
}

export function returnStock(id, amount, reason = 'Disapproved Requisition') {
  const item = inventory.find((i) => i.id === id);
  if (!item) return false;
  
  item.qty += Number(amount);
  saveInventory(inventory);
  addLog(item.id, item.name, 'RESTOCK', Number(amount), item.unit, reason);
  return true;
}

export function restockItem(id, amount) {
  const item = inventory.find((i) => i.id === id);
  if (!item) return false;
  
  item.qty += Number(amount);
  saveInventory(inventory);
  addLog(item.id, item.name, 'RESTOCK', Number(amount), item.unit, 'Manual restock');
  return true;
}

export function refreshInventory() {
  inventory = loadInventory();
  logs = loadLogs();
}

function addLog(itemId, itemName, type, qty, unit, reason) {
  const log = {
    id: generateId(),
    itemId,
    itemName,
    type,
    qty,
    unit,
    reason,
    date: new Date().toISOString(),
  };
  logs.unshift(log);
  saveLogs(logs);
}

export function getLogs() {
  return logs;
}

export function deleteLog(logId) {
  logs = logs.filter(l => l.id !== logId);
  saveLogs(logs);
}

export function getStockStatus(qty) {
  if (qty <= 0) return { label: 'Out of Stock', color: '#dc2626' };
  if (qty <= 20) return { label: 'Low Stock', color: '#ea580c' };
  if (qty <= 50) return { label: 'Medium', color: '#ca8a04' };
  return { label: 'Full', color: '#16a34a' };
}

export function updateItem(id, { name, category, qty, unit, unitCost }) {
  const item = inventory.find((i) => i.id === id);
  if (!item) return false;

  const parsedCost = Number(unitCost);
  if (isNaN(parsedCost) || parsedCost < 0) return false;

  item.name = name.trim();
  item.category = category.trim();
  item.qty = Number(qty);
  item.unit = unit.trim();
  item.unitCost = parsedCost;

  saveInventory(inventory);
  addLog(item.id, item.name, 'RESTOCK', 0, item.unit, 'Item details updated by admin');
  return true;
}