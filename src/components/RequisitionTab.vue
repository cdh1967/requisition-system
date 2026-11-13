<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getInventory, refreshInventory } from '../modules/inventory.js'
import { createRequisition, getRequisitions } from '../modules/requisition.js' 
import { getUsers } from '../modules/auth.js' 

const showToast = inject('showToast')
const currentUser = inject('currentUser')

const inventory = ref([])
const myRequests = ref([])

// State para sa Modal ug Filters
const showModal = ref(false)
const slipItems = ref([])
const selectedItemId = ref('')
const selectedQty = ref(1)
const selectedPriority = ref('ROUTINE')
const selectedRemarks = ref('')
const searchItemQuery = ref('')
const selectedCategory = ref('All Categories')
const searchQuery = ref('')

// Header details sa form
const header = ref({
  name: currentUser.value?.name || currentUser.value?.username || '',
  date: new Date().toISOString().slice(0, 16),
  posted: new Date().toLocaleString()
})

function loadData() {
  refreshInventory()
  inventory.value = [...getInventory()]
  
  const allSlips = getRequisitions()
  const currentUsername = currentUser.value?.username?.toLowerCase() || ''
  
  myRequests.value = allSlips.filter(s => {
    if (s.createdBy) {
      return s.createdBy.toLowerCase() === currentUsername
    }
    return s.name.toLowerCase() === currentUsername || s.name.toLowerCase() === (currentUser.value?.name?.toLowerCase() || '')
  })
}

onMounted(loadData)

const filteredRequests = computed(() => {
  if (!searchQuery.value) return myRequests.value
  const q = searchQuery.value.toLowerCase()
  return myRequests.value.filter(s => 
    s.slipNo.toLowerCase().includes(q) || 
    s.status.toLowerCase().includes(q)
  )
})

const filteredInventory = computed(() => {
  let result = inventory.value.filter(i => i.qty > 0)
  if (selectedCategory.value !== 'All Categories') {
    result = result.filter(i => i.category === selectedCategory.value)
  }
  if (searchItemQuery.value) {
    const q = searchItemQuery.value.toLowerCase()
    result = result.filter(i => i.name.toLowerCase().includes(q))
  }
  return result
})

function addToSlip() {
  const id = selectedItemId.value
  const qty = Number(selectedQty.value)
  if (!id || qty < 1) {
    showToast('Select an item and valid qty', true)
    return
  }
  const invItem = inventory.value.find((i) => i.id === id)
  if (!invItem) return
  const existing = slipItems.value.find((l) => l.itemId === id)
  const totalRequested = (existing?.qty || 0) + qty
  if (totalRequested > invItem.qty) {
    showToast(`Only ${invItem.qty} ${invItem.unit} available`, true)
    return
  }
  if (existing) {
    existing.qty = totalRequested
  } else {
    slipItems.value.push({
      itemId: id,
      name: invItem.name,
      unit: invItem.unit,
      qty,
      priority: selectedPriority.value,
      remarks: selectedRemarks.value
    })
  }
  selectedItemId.value = ''
  selectedQty.value = 1
  selectedPriority.value = 'ROUTINE'
  selectedRemarks.value = ''
  searchItemQuery.value = ''
}

function removeLine(idx) {
  slipItems.value.splice(idx, 1)
}

function submitRequisition() {
  const { name, date } = header.value
  if (!name || !date) {
    showToast('Fill in Requestor and Date', true)
    return
  }
  if (!slipItems.value.length) {
    showToast('Add at least one item', true)
    return
  }

  const result = createRequisition({
    name: name,
    dept: 'Ward',
    date,
    items: slipItems.value,
  })

  if (!result.ok) {
    showToast(result.message, true)
    return
  }

  showToast(`Slip ${result.slip.slipNo} submitted!`)
  slipItems.value = []
  header.value = { 
    name: currentUser.value?.name || currentUser.value?.username || '', 
    date: new Date().toISOString().slice(0, 16),
    posted: new Date().toLocaleString()
  }
  showModal.value = false
  loadData() 
}

// --- UPDATED PRINT FUNCTION PARA SA A6 PAPER ---
function printRequisition(slip) {
  const printWindow = window.open('', '_blank');

  // 1. Kuhaa ang aktwal nga ngalan sa Head Office gikan sa users
  const users = getUsers();
  const headOfficeUser = users.find(u => u.role === 'Head Office');
  const headOfficeName = headOfficeUser ? (headOfficeUser.name || headOfficeUser.username) : '____________________';

  // 2. Kuhaa ang Logo URL (Siguroha nga naa sa public folder)
  const logoUrl = `${window.location.origin}/logo.png`;

  printWindow.document.write(`
    <html>
      <head>
        <title>Requisition Slip - ${slip.slipNo}</title>
        <style>
          /* CSS PARA SA A6 PAPER SIZE (105mm x 148mm) */
          @page {
            size: A6;
            margin: 8mm;
          }
          body { 
            font-family: Arial, sans-serif; 
            padding: 0; 
            margin: 0; 
            color: #000; 
            font-size: 10px;
          }
          .header-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          .header-logo {
            width: 40px;
            height: 40px;
            object-fit: contain;
          }
          .header-text {
            text-align: center;
          }
          .header-text h2 {
            margin: 0;
            font-size: 14px;
            text-transform: uppercase;
          }
          .header-text h3 {
            margin: 2px 0 0 0;
            font-size: 10px;
            font-weight: normal;
          }
          .details { 
            margin-bottom: 10px; 
            line-height: 1.4;
          }
          .details p { 
            margin: 2px 0; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px; 
            font-size: 9px;
          }
          th, td { 
            border: 1px solid black; 
            padding: 4px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            text-align: center;
          }
          .signatures { 
            display: flex; 
            justify-content: space-between; 
            margin-top: 25px; 
          }
          .sig-box { 
            width: 45%; 
            text-align: center; 
          }
          .sig-line { 
            border-bottom: 1px solid black; 
            margin-bottom: 3px; 
            height: 20px; 
          }
          .sig-name {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 9px;
          }
          .footer-text {
            font-size: 8px; 
            color: #333;
            margin-top: 2px;
          }
        </style>
      </head>
      <body onload="window.print(); setTimeout(window.close, 500);">
        
        <!-- HEADER -->
        <div class="header-container">
          <img src="${logoUrl}" alt="Logo" class="header-logo" />
          <div class="header-text">
            <h2>Requisition Slip</h2>
            <h3>Slip No: ${slip.slipNo}</h3>
          </div>
        </div>

        <!-- DETAILS -->
        <div class="details">
          <p><strong>Requestor:</strong> ${slip.name}</p>
          <p><strong>Department:</strong> ${slip.dept}</p>
          <p><strong>Date Ordered:</strong> ${new Date(slip.date).toLocaleString()}</p>
        </div>

        <!-- ITEMS TABLE -->
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Priority</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${slip.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: center;">${item.qty} ${item.unit}</td>
                <td style="text-align: center;">${item.priority}</td>
                <td>${item.remarks || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- SIGNATURES -->
        <div class="signatures">
          <!-- Requestor -->
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-name">${slip.name}</div>
            <div class="footer-text">Requestor Signature</div>
          </div>
          
          <!-- Head Office -->
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-name">${headOfficeName}</div>
            <div class="footer-text">Head Office Signature (Approved By)</div>
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    
    <!-- MAIN LIST VIEW -->
    <div v-if="!showModal">
      <div class="list-header">
        <h2 style="margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          📦 My Requisition Requests
        </h2>
        <div style="display: flex; gap: 8px;">
          <button @click="showModal = true" class="btn-green">➕ Add Supplies</button>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; margin-top: 1rem;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
          Show 10 entries
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
          Search: <input v-model="searchQuery" type="text" placeholder="Search Slip No or Status..." style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
      </div>

      <div class="table-wrapper">
        <table class="custom-table">
          <thead>
            <tr>
              <th>DATE LOG</th>
              <th>SLIP NO</th>
              <th>ITEM DESCRIPTION</th>
              <th>QUANTITY</th>
              <th>PRIORITY</th>
              <th>REMARKS</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredRequests.length === 0">
              <td colspan="8" style="text-align: center; padding: 2rem;">No data available in table</td>
            </tr>
            
            <template v-for="slip in filteredRequests" :key="slip.id">
              <tr v-for="(item, index) in slip.items" :key="item.itemId">
                
                <td v-if="index === 0" :rowspan="slip.items.length" style="font-size: 0.75rem;">
                  {{ new Date(slip.createdAt).toLocaleString() }}
                </td>
                
                <td v-if="index === 0" :rowspan="slip.items.length" style="font-weight: bold; color: #1e3a8a;">
                  {{ slip.slipNo }}
                </td>
                
                <td>{{ item.name }}</td>
                <td>{{ item.qty }} {{ item.unit }}</td>
                <td>{{ item.priority }}</td>
                <td>{{ item.remarks || '-' }}</td>
                
                <td v-if="index === 0" :rowspan="slip.items.length" style="text-align: center;">
                  <span :style="{
                    background: slip.status === 'Approved' ? '#16a34a' : (slip.status === 'Disapproved' ? '#dc2626' : '#f59e0b'), 
                    color: 'white', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold'
                  }">
                    {{ slip.status }}
                  </span>
                </td>
                
                <td v-if="index === 0" :rowspan="slip.items.length" style="text-align: center;">
                  <button @click="printRequisition(slip)" class="btn-print" title="Print Requisition Slip">
                    🖨️ Print
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL VIEW -->
    <div v-else class="modal-view">
      <div class="modal-header">
        <h3>📊 Supplies</h3>
        <button @click="showModal = false" style="background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: white;">✖</button>
      </div>
      
      <div class="modal-body">
        <h4 class="section-title">📑 Details</h4>
        <div class="details-grid">
          <div class="form-group">
            <label>Ordered:</label>
            <input type="datetime-local" v-model="header.date" class="form-input" />
          </div>
          <div class="form-group">
            <label>Posted:</label>
            <input type="text" class="form-input" :value="header.posted" readonly disabled style="background: #f1f5f9;" />
          </div>
          
          <div class="form-group">
            <label>Requestor:</label>
            <input type="text" v-model="header.name" placeholder="Staff Name" class="form-input" />
          </div>
        </div>

        <h4 class="section-title" style="margin-top: 1.5rem;">📋 List of Supplies</h4>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <label style="font-size: 0.8rem; color: #475569;">Category:</label>
            <select v-model="selectedCategory" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
              <option value="All Categories">All Categories</option>
              <option value="Medical Supplies">Medical Supplies</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Janitorial Supplies">Janitorial Supplies</option>
            </select>
          </div>

          <div style="flex: 2; min-width: 150px;">
            <label style="font-size: 0.8rem; color: #475569;">Search Item:</label>
            <input type="text" v-model="searchItemQuery" placeholder="Type to search..." style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
          </div>

          <div style="flex: 3; min-width: 200px;">
            <label style="font-size: 0.8rem; color: #475569;">Select Item:</label>
            <select v-model="selectedItemId" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;">
              <option value="">-- Choose Supply --</option>
              <option v-for="i in filteredInventory" :key="i.id" :value="i.id">
                {{ i.name }} (Stock: {{ i.qty }})
              </option>
            </select>
          </div>

          <div style="flex: 1; min-width: 80px;">
            <label style="font-size: 0.8rem; color: #475569;">Qty:</label>
            <input type="number" v-model.number="selectedQty" min="1" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
          </div>

          <div style="flex: 2; min-width: 150px;">
            <label style="font-size: 0.8rem; color: #475569;">Remarks:</label>
            <input type="text" v-model="selectedRemarks" placeholder="Optional" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
          </div>

          <button @click="addToSlip" class="btn-green" style="padding: 0.5rem 1rem; height: 38px;">+ Add</button>
        </div>

        <div class="table-wrapper" style="margin-top: 1rem;">
          <table class="custom-table">
            <thead>
              <tr>
                <th>ITEM DESCRIPTION</th>
                <th>QUANTITY</th>
                <th>PRIORITY</th>
                <th>REMARKS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="slipItems.length === 0">
                <td colspan="5" style="text-align: center; padding: 1rem;">No items added yet.</td>
              </tr>
              <tr v-for="(item, idx) in slipItems" :key="item.itemId">
                <td>{{ item.name }}</td>
                <td>{{ item.qty }} {{ item.unit }}</td>
                <td>{{ item.priority }}</td>
                <td>{{ item.remarks || '-' }}</td>
                <td>
                  <button @click="removeLine(idx)" class="btn-red" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Remove</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <div class="modal-footer">
        <button @click="submitRequisition" class="btn-green">💾 Submit</button>
        <button @click="showModal = false" class="btn-red">✖ Cancel</button>
      </div>
    </div>

  </section>
</template>

<style scoped>
/* ... existing styles ... */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #eff6ff;
  padding: 0.8rem 1rem;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
}

.btn-green { 
  background: #2563eb; 
  color: white; 
  border: none; 
  padding: 0.4rem 1rem; 
  border-radius: 4px; 
  cursor: pointer; 
  font-weight: bold; 
  display: flex; 
  align-items: center; 
  gap: 5px; 
}
.btn-green:hover { background: #1d4ed8; }

.btn-red { 
  background: #dc2626; 
  color: white; 
  border: none; 
  padding: 0.4rem 1rem; 
  border-radius: 4px; 
  cursor: pointer; 
  font-weight: bold; 
  display: flex; 
  align-items: center; 
  gap: 5px; 
}
.btn-red:hover { background: #b91c1c; }

.btn-print {
  background: #fff;
  color: #1e3a8a;
  border: 1px solid #1e3a8a;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}
.btn-print:hover {
  background: #1e3a8a;
  color: white;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  border: 1px solid #e2e8f0;
}
.custom-table th, .custom-table td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  text-align: left;
  vertical-align: middle;
}
.custom-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: bold;
  font-size: 0.8rem;
}

.modal-view {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  border: 1px solid #ccc;
  height: 100%;
  min-height: 80vh;
}

.modal-header {
  background: #1e3a8a;
  color: white;
  padding: 0.8rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 8px 8px 0 0;
}
.modal-header h3 { margin: 0; font-size: 1.1rem; }

.modal-body {
  padding: 1.5rem;
  flex: 1;
}

.section-title {
  color: #1e3a8a; 
  font-size: 1.1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
  font-weight: normal;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-group label {
  width: 100px;
  font-size: 0.85rem;
  color: #475569;
}

.form-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
}

.form-input:focus {
  outline: 2px solid #2563eb;
  border-color: transparent;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8fafc;
  border-radius: 0 0 8px 8px;
}

@media (max-width: 768px) {
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>