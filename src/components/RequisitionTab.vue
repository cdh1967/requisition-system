<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getInventory, refreshInventory } from '../modules/inventory.js'
import { createRequisition, getRequisitions } from '../modules/requisition.js'
import { getUsers } from '../modules/auth.js'

const showToast = inject('showToast')
const currentUser = inject('currentUser')

const inventory = ref([])
const myRequests = ref([])

const showModal = ref(false)
const slipItems = ref([])
const selectedItemId = ref('')
const selectedQty = ref(1)
const selectedPriority = ref('ROUTINE')
const selectedRemarks = ref('')
const searchItemQuery = ref('')
const selectedCategory = ref('All Categories')
const searchQuery = ref('')

const header = ref({
  name: currentUser.value?.name || currentUser.value?.username || '',
  date: new Date().toISOString().slice(0, 16),
  posted: new Date().toLocaleString()
})

async function loadData() {
  await refreshInventory()
  inventory.value = [...getInventory()]
  const allSlips = await getRequisitions()
  const uname = currentUser.value?.username?.toLowerCase() || ''
  myRequests.value = allSlips.filter(s =>
    s.createdBy?.toLowerCase() === uname ||
    s.name?.toLowerCase() === uname ||
    s.name?.toLowerCase() === (currentUser.value?.name?.toLowerCase() || '')
  )
}

const filteredRequests = computed(() => {
  if (!searchQuery.value) return myRequests.value
  const q = searchQuery.value.toLowerCase()
  return myRequests.value.filter(s =>
    s.slipNo.toLowerCase().includes(q) || s.status.toLowerCase().includes(q)
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
  if (!id || qty < 1) return showToast('Select an item and valid qty', true)
  const invItem = inventory.value.find((i) => i.id === id)
  if (!invItem) return
  const existing = slipItems.value.find((l) => l.itemId === id)
  const totalRequested = (existing?.qty || 0) + qty
  if (totalRequested > invItem.qty) return showToast(`Only ${invItem.qty} ${invItem.unit} available`, true)
  if (existing) {
    existing.qty = totalRequested
  } else {
    slipItems.value.push({
      itemId: id, name: invItem.name, unit: invItem.unit, qty,
      priority: selectedPriority.value, remarks: selectedRemarks.value
    })
  }
  selectedItemId.value = ''
  selectedQty.value = 1
  selectedPriority.value = 'ROUTINE'
  selectedRemarks.value = ''
  searchItemQuery.value = ''
}

function removeLine(idx) { slipItems.value.splice(idx, 1) }

// ✅ ISA RA KA submitRequisition (async, kompleto)
async function submitRequisition() {
  const { name, date } = header.value
  if (!name || !date) return showToast('Fill in Requestor and Date', true)
  if (!slipItems.value.length) return showToast('Add at least one item', true)

  const result = await createRequisition({
    name: name, dept: 'Ward', date, items: slipItems.value
  })

  if (!result.ok) return showToast(result.message, true)
  showToast(`Slip ${result.slip.slipNo} submitted!`)
  slipItems.value = []
  header.value = {
    name: currentUser.value?.name || currentUser.value?.username || '',
    date: new Date().toISOString().slice(0, 16),
    posted: new Date().toLocaleString()
  }
  showModal.value = false
  await loadData()
}

// ✅ ISA RA KA printRequisition (async, kompleto)
async function printRequisition(slip) {
  const printWindow = window.open('', '_blank');
  const users = await getUsers();
  const headOfficeUser = users.find(u => u.role === 'Head Office');
  const headOfficeName = headOfficeUser ? (headOfficeUser.name || headOfficeUser.username) : '____________________';
  const logoUrl = `${window.location.origin}/logo.svg`;  // ✅ SVG na

  printWindow.document.write(`
    <html>
      <head>
        <title>Requisition Slip - ${slip.slipNo}</title>
        <style>
          @page { size: A6; margin: 8mm; }
          body { font-family: Arial, sans-serif; padding: 0; margin: 0; color: #000; font-size: 10px; }
          .header-container { display: flex; align-items: center; justify-content: center; gap: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
          .header-logo { width: 40px; height: 40px; object-fit: contain; }
          .header-text { text-align: center; }
          .header-text h2 { margin: 0; font-size: 14px; text-transform: uppercase; }
          .header-text h3 { margin: 2px 0 0 0; font-size: 10px; font-weight: normal; }
          .details { margin-bottom: 10px; line-height: 1.4; }
          .details p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 9px; }
          th, td { border: 1px solid black; padding: 4px; text-align: left; }
          th { background-color: #f2f2f2; text-align: center; }
          .signatures { display: flex; justify-content: space-between; margin-top: 25px; }
          .sig-box { width: 45%; text-align: center; }
          .sig-line { border-bottom: 1px solid black; margin-bottom: 3px; height: 20px; }
          .sig-name { font-weight: bold; text-transform: uppercase; font-size: 9px; }
          .footer-text { font-size: 8px; color: #333; margin-top: 2px; }
        </style>
      </head>
      <body onload="window.print(); setTimeout(window.close, 500);">
        <div class="header-container">
          <img src="${logoUrl}" alt="Logo" class="header-logo" />
          <div class="header-text">
            <h2>Requisition Slip</h2>
            <h3>Slip No: ${slip.slipNo}</h3>
          </div>
        </div>
        <div class="details">
          <p><strong>Requestor:</strong> ${slip.name}</p>
          <p><strong>Department:</strong> ${slip.dept}</p>
          <p><strong>Date Ordered:</strong> ${new Date(slip.date).toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr><th>Item Description</th><th>Qty</th><th>Priority</th><th>Remarks</th></tr>
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
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div class="sig-name">${slip.name}</div>
            <div class="footer-text">Requestor Signature</div>
          </div>
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

onMounted(loadData)
</script>