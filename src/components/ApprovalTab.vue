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

async function load() {
  const allSlips = await getRequisitions()
  if (props.userRole === 'Head Office') {
    slips.value = allSlips.filter(s => s.status === 'Pending Head Office')
  } else if (props.userRole === 'Supply Release') {
    slips.value = allSlips.filter(s => s.status === 'Pending Supply Release')
  } else {
    slips.value = allSlips.filter(s => s.status.includes('Pending'))
  }
}

async function handleApprove(slipId) {
  const slip = slips.value.find(s => s.id === slipId)
  if (props.userRole === 'Head Office' || slip?.status === 'Pending Head Office') {
    const res = await approveHeadOffice(slipId)
    if (res.ok) { await load(); showToast('Approved by Head Office. Forwarded to Supply Release.') }
    else showToast('Approval failed', true)
  } else if (props.userRole === 'Supply Release' || slip?.status === 'Pending Supply Release') {
    const res = await approveSupplyRelease(slipId)
    if (res.ok) { await refreshInventory(); await load(); showToast('Approved. Stock deducted.') }
    else showToast('Approval failed', true)
  }
}

async function handleDisapprove(slipId) {
  if (!confirm('Are you sure you want to disapprove this order?')) return
  const res = await disapproveRequisition(slipId)
  if (res.ok) { await load(); showToast('Order disapproved') }
  else showToast('Disapproval failed', true)
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
</script>