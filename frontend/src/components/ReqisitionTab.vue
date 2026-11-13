import { api } from '../modules/api.js';

async function loadData() {
  try {
    inventory.value = await api.getInventory();
    const allSlips = await api.getRequisitions();
    
    const currentUsername = currentUser.value?.username?.toLowerCase() || '';
    
    myRequests.value = allSlips.filter(s => {
      if (s.createdBy) return s.createdBy.toLowerCase() === currentUsername;
      return s.name.toLowerCase() === currentUsername;
    });
  } catch (err) {
    showToast('Error loading data', true);
  }
}

async function submitRequisition() {
  if (!slipItems.value.length) return;
  try {
    const result = await api.createRequisition({
      name: header.value.name,
      dept: 'Ward',
      date: header.value.date,
      items: slipItems.value,
      createdBy: currentUser.value?.username
    });
    showToast(`Slip ${result.slipNo} submitted!`);
    slipItems.value = [];
    showModal.value = false;
    loadData();
  } catch (err) {
    showToast('Failed to submit', true);
  }
}