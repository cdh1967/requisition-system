<script setup>
import { ref, onMounted, inject, computed, defineProps } from 'vue'
import { getRequisitions, approveHeadOffice, approveSupplyRelease, disapproveRequisition } from '../modules/requisition.js'
import { refreshInventory } from '../modules/inventory.js'

const props = defineProps({ userRole: String })

const showToast = inject('showToast')
const slips = ref([])
const searchQuery = ref('')
const limit = ref(10)
const currentPage = ref(1)

function load() {
  const allSlips = getRequisitions()
  if (props.userRole === 'Head Office') {
    slips.value = allSlips.filter(s => s.status === 'Pending Head Office')
  } else if (props.userRole === 'Supply Release') {
    slips.value = allSlips.filter(s => s.status === 'Pending Supply Release')
  } else {
    slips.value = allSlips.filter(s => s.status.includes('Pending'))
  }
}

onMounted(load)

const flattenedOrders = computed(() => {
  let orders = []
  slips.value.forEach(slip => {
    slip.items.forEach(item => {
      orders.push({
        slipId: slip.id,
        date: slip.createdAt || slip.date,
        chargeSlip: slip.slipNo,
        patientName: slip.name,
        description: item.name,
        doctor: slip.dept,
        status: slip.status,
        priority: 'ROUTINE',
        isGo: 'NO',
        ward: 'NURSES STATION',
        itemData: item
      })
    })
  })
  orders.sort((a, b) => new Date(b.date) - new Date(a.date))
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    orders = orders.filter(o => o.patientName.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
  }
  return orders
})

const totalPages = computed(() => Math.ceil(flattenedOrders.value.length / limit.value))
const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * limit.value
  return flattenedOrders.value.slice(start, start + limit.value)
})
function changePage(page) {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page
}
function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}
function getRowSpan(slipId) { return flattenedOrders.value.filter(o => o.slipId === slipId).length }
function isFirstOccurrence(index, slipId) {
  if (index === 0) return true
  return paginatedOrders.value[index - 1].slipId !== slipId
}

function handleApprove(slipId) {
  if (props.userRole === 'Head Office') {
    const res = approveHeadOffice(slipId)
    if (res.ok) { load(); showToast('Approved by Head Office. Forwarded to Supply Release.') }
  } else if (props.userRole === 'Supply Release') {
    const res = approveSupplyRelease(slipId)
    if (res.ok) { refreshInventory(); load(); showToast('Approved by Supply Release. Stock deducted.') }
  } else {
    const slip = slips.value.find(s => s.id === slipId)
    if (slip.status === 'Pending Head Office') {
      approveHeadOffice(slipId); load(); showToast('Approved as Head Office.')
    } else if (slip.status === 'Pending Supply Release') {
      approveSupplyRelease(slipId); refreshInventory(); load(); showToast('Approved as Supply Release.')
    }
  }
}

function handleDisapprove(slipId) {
  if (!confirm('Are you sure you want to disapprove this order?')) return
  const res = disapproveRequisition(slipId)
  if (res.ok) { load(); showToast('Order disapproved') }
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    <div class="page-header">
      <h2 style="margin: 0; color: #047857; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
        ✔️ Pending Approvals (Doctor's Order / Requisitions)
      </h2>
      <button @click="load" class="header-btn">🔄 Refresh List</button>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
        Show 
        <select v-model="limit" @change="currentPage = 1" style="padding: 0.2rem; border-radius: 4px; border: 1px solid #ccc;">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        entries
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
        Search: 
        <input v-model="searchQuery" @input="currentPage = 1" type="text" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px;" />
      </div>
    </div>

    <div class="table-wrapper">
      <table class="doctor-order-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>CHARGESLIP</th>
            <th>REQUESTOR (PATIENT)</th>
            <th>DESCRIPTION</th>
            <th>DEPARTMENT (DOCTOR)</th>
            <th>STATUS</th>
            <th>PRIORITY</th>
            <th>IS MAY GO GOME?</th>
            <th>WARD</th>
            <th style="text-align: center;">ACTION</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedOrders.length === 0">
            <td colspan="10" style="text-align: center; padding: 2rem; color: #666;">No pending orders found.</td>
          </tr>
          <tr v-for="(order, index) in paginatedOrders" :key="order.slipId + '-' + order.itemData.itemId">
            <td class="text-center text-sm">{{ formatDate(order.date) }}</td>
            
            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center text-sm" style="border-right: 1px solid #ddd;">
              {{ order.chargeSlip }}
            </td>
            
            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" style="font-weight: 500;">
              {{ order.patientName }}
            </td>
            
            <td class="text-sm">{{ order.description }}</td>
            
            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-sm">
              {{ order.doctor }}
            </td>
            
            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center">
              <span class="badge-status unserved" :style="{ background: order.status === 'Pending Head Office' ? '#f59e0b' : '#3b82f6' }">
                {{ order.status }}
              </span>
            </td>

            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center">
              <span class="badge-priority">ROUTINE</span>
            </td>

            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center text-sm">
              NO
            </td>

            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center text-sm">
              {{ order.ward }}
            </td>

            <td v-if="isFirstOccurrence(index, order.slipId)" :rowspan="getRowSpan(order.slipId)" class="text-center">
              <div style="display: flex; flex-direction: column; gap: 5px; align-items: center;">
                <button @click="handleApprove(order.slipId)" style="background: #16a34a; color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">
                  {{ order.status === 'Pending Head Office' ? 'Approve (Head Office)' : 'Approve (Release)' }}
                </button>
                <button @click="handleDisapprove(order.slipId)" style="background: #dc2626; color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">
                  Reject ✖
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination-container">
      <div>
        Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, flattenedOrders.length) }} of {{ flattenedOrders.length }} entries
      </div>
      <div class="pagination-buttons">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1" class="page-btn">Previous</button>
        <button 
          v-for="p in Math.min(totalPages, 5)" 
          :key="p" 
          @click="changePage(p)"
          :class="['page-btn', currentPage === p ? 'active' : '']"
        >
          {{ p }}
        </button>
        <span v-if="totalPages > 5" style="padding: 0 10px;">...</span>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages" class="page-btn">Next</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* CSS gikan sa imong daan nga ApprovalTab */
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; background: #ecfdf5; padding: 0.8rem 1rem; border: 1px solid #d1fae5; border-radius: 6px; }
.header-btn { background: white; border: 1px solid #ccc; color: #333; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.doctor-order-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 1px solid #e2e8f0; }
.doctor-order-table th, .doctor-order-table td { border: 1px solid #e2e8f0; padding: 0.6rem; text-align: left; vertical-align: top; }
.doctor-order-table th { background: #f8fafc; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 0.8rem; }
.text-center { text-align: center; }
.text-sm { font-size: 0.8rem; color: #475569; }
.badge-status { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: white; }
.badge-status.unserved { background: #ef4444; }
.badge-priority { background: #4f46e5; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; font-size: 0.85rem; color: #475569; }
.pagination-buttons { display: flex; align-items: center; }
.page-btn { background: white; border: 1px solid #cbd5e1; padding: 0.3rem 0.8rem; cursor: pointer; margin: 0 2px; border-radius: 4px; color: #475569; }
.page-btn.active { background: #1e3a8a; color: white; border-color: #1e3a8a; }
.page-btn:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
</style>