<script setup>
import { ref, onMounted, inject } from 'vue'
import { getRequisitions } from '../modules/requisition.js'
import { refreshInventory, returnItem } from '../modules/inventory.js'

const showToast = inject('showToast')
const slips = ref([])

async function load() {
  slips.value = await getRequisitions()
}

async function handleReturn(slipId, itemId, itemName) {
  const qtyStr = prompt(`Enter quantity to return for "${itemName}":`)
  if (!qtyStr) return
  const qty = Number(qtyStr)
  if (isNaN(qty) || qty <= 0) return showToast('Invalid quantity', true)
  const slip = slips.value.find(s => s.id === slipId)
  const success = await returnItem(itemId, qty, `Returned from Slip ${slip?.slipNo}`)
  if (success) { await refreshInventory(); showToast(`Returned ${qty} ${itemName}`); await load() }
  else showToast('Failed to return item', true)
}

function getStatusColor(status) {
  if (status === 'Approved') return '#16a34a'
  if (status === 'Disapproved') return '#dc2626'
  return '#eab308'
}

onMounted(load)
</script>