<script setup>
import { ref, onMounted, inject } from 'vue'
import { getRequisitions } from '../modules/requisition.js'
import { refreshInventory, returnItem } from '../modules/inventory.js'

const showToast = inject('showToast')
const slips = ref([])

function load() {
  slips.value = [...getRequisitions()]
}

onMounted(load)

// FUNCTION PARA SA PAG-RETURN (Naa gihapon ni dinhi)
function handleReturn(slipId, itemId, itemName) {
  const qtyStr = prompt(`Enter quantity to return for "${itemName}":`)
  if (!qtyStr) return
  
  const qty = Number(qtyStr)
  if (isNaN(qty) || qty <= 0) {
    showToast('Invalid quantity', true)
    return
  }
  
  const success = returnItem(itemId, qty, `Returned from Slip ${slips.value.find(s => s.id === slipId).slipNo}`)
  
  if (success) {
    refreshInventory()
    showToast(`Successfully returned ${qty} ${itemName}`)
    load()
  } else {
    showToast('Failed to return item', true)
  }
}

function getStatusColor(status) {
  if (status === 'Approved') return '#16a34a'
  if (status === 'Disapproved') return '#dc2626'
  return '#eab308'
}
</script>

<template>
  <section class="tab-content active">
    <h2>Requisition History (All Status)</h2>

    <p v-if="!slips.length" class="empty">No requisition slips yet.</p>

    <div v-else>
      <div v-for="s in slips" :key="s.id" class="slip-card">
        <h4>{{ s.slipNo }} — {{ s.name }} ({{ s.dept }})</h4>
        <p>
          <small>
            Date: {{ s.date }} • Status:
            <strong :style="{ color: getStatusColor(s.status) }">{{ s.status }}</strong>
          </small>
        </p>
        
        <ul>
          <li v-for="(i, idx) in s.items" :key="idx" style="margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span>{{ i.name }} — {{ i.qty }} {{ i.unit }}</span>
              
              <!-- RETURN BUTTON KADA ITEM SA APPROVED SLIP -->
              <button 
                v-if="s.status === 'Approved'"
                @click="handleReturn(s.id, i.itemId, i.name)"
                style="background: #0ea5e9; color: white; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; margin-left: 10px; border: none; cursor: pointer;"
              >
                ↩ Return
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>