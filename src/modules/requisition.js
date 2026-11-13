import { loadRequisitions, saveRequisitions, generateId } from './storage.js';
import { deductStock, getInventory } from './inventory.js';
import { addTrailLog } from './trail/trailService.js';

let requisitions = loadRequisitions();

function getCurrentUsername() {
  try {
    const session = JSON.parse(localStorage.getItem('rsi_session'));
    return session ? session.username : 'System';
  } catch { return 'System'; }
}

export function getRequisitions() {
  return requisitions;
}

export function createRequisition({ name, dept, date, items }) {
  const inv = getInventory();
  for (const line of items) {
    const invItem = inv.find((i) => i.id === line.itemId);
    if (!invItem || invItem.qty < line.qty) {
      return { ok: false, message: `Insufficient stock for "${line.name}"` };
    }
  }

  // --- LOGIC PARA SA YYMMDD-XX FORMAT ---
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2); // 2-digit year
  const mm = String(now.getMonth() + 1).padStart(2, '0'); // 2-digit month
  const dd = String(now.getDate()).padStart(2, '0'); // 2-digit day
  const datePrefix = `${yy}${mm}${dd}`;

  // Kuhaon ang pinakadako nga sequence number (XX) sa parehas nga adlaw
  const todaysSlips = requisitions.filter(r => r.slipNo.startsWith(datePrefix));
  let nextSequence = 1;

  if (todaysSlips.length > 0) {
    // Kuhaon ang mga last 2 digits, i-convert sa number, ug pangitaon ang pinakadako
    const maxSequence = Math.max(...todaysSlips.map(r => parseInt(r.slipNo.split('-')[1]) || 0));
    nextSequence = maxSequence + 1;
  }

  const sequenceString = String(nextSequence).padStart(2, '0'); // 2-digit sequence
  const generatedSlipNo = `${datePrefix}-${sequenceString}`;
  // ----------------------------------------

  const slip = {
    id: generateId(),
    slipNo: generatedSlipNo, // <-- Gigamit ang bag-ong format
    name: name.trim(),
    dept: dept.trim(),
    date,
    items: items.map((i) => ({ ...i })),
    createdAt: new Date().toISOString(),
    status: 'Pending Head Office',
    createdBy: getCurrentUsername(), 
  };

  requisitions.unshift(slip);
  saveRequisitions(requisitions);
  return { ok: true, slip };
}

export function approveHeadOffice(slipId) {
  const slip = requisitions.find(s => s.id === slipId);
  if (!slip || slip.status !== 'Pending Head Office') return { ok: false };
  
  slip.status = 'Pending Supply Release';
  saveRequisitions(requisitions);
  
  addTrailLog('REQUISITION_APPROVE_HO', `Approved slip ${slip.slipNo} (Head Office)`, getCurrentUsername());
  
  return { ok: true };
}

export function approveSupplyRelease(slipId) {
  const slip = requisitions.find(s => s.id === slipId);
  if (!slip || slip.status !== 'Pending Supply Release') return { ok: false };

  for (const line of slip.items) {
    deductStock(line.itemId, line.qty, `Released: ${slip.name} (${slip.dept})`);
  }
  slip.status = 'Approved';
  saveRequisitions(requisitions);
  
  addTrailLog('REQUISITION_APPROVE_SR', `Approved & Released slip ${slip.slipNo} (Supply Release)`, getCurrentUsername());
  
  return { ok: true };
}

export function disapproveRequisition(slipId) {
  const slip = requisitions.find(s => s.id === slipId);
  if (!slip || slip.status === 'Approved' || slip.status === 'Disapproved') return { ok: false };
  slip.status = 'Disapproved';
  saveRequisitions(requisitions);
  
  addTrailLog('REQUISITION_REJECT', `Disapproved slip ${slip.slipNo}`, getCurrentUsername());
  
  return { ok: true };
}