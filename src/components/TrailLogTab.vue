<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getTrailLogs, clearTrailLogs } from '../modules/trail/trailService.js'

const showToast = inject('showToast')
const logs = ref([])
const searchQuery = ref('')

function getBadgeClass(action) {
  if (action.includes('LOGIN_SUCCESS')) return 'green'
  if (action.includes('LOGIN_FAILED')) return 'red'
  if (action.includes('ADD') || action.includes('RESTOCK')) return 'blue'
  if (action.includes('DELETE') || action.includes('DEDUCT') || action.includes('REJECT')) return 'red'
  if (action.includes('APPROVE')) return 'green'
  return 'gray'
}

function loadLogs() {
  logs.value = getTrailLogs()
}

onMounted(loadLogs)

const filteredLogs = computed(() => {
  if (!searchQuery.value) return logs.value
  const q = searchQuery.value.toLowerCase()
  return logs.value.filter(l => 
    l.user.toLowerCase().includes(q) || 
    l.action.toLowerCase().includes(q) || 
    l.details.toLowerCase().includes(q)
  )
})

function handleClear() {
  if (confirm('Are you sure you want to clear all trail logs? This cannot be undone.')) {
    clearTrailLogs()
    loadLogs()
    showToast('Trail logs cleared')
  }
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
        📜 Audit Trail Logs
      </h2>
      <div style="display: flex; gap: 10px;">
        <button @click="loadLogs" class="btn-refresh">🔄 Refresh</button>
        <button @click="handleClear" class="btn-danger">🗑️ Clear Logs</button>
      </div>
    </div>

    <div style="margin-bottom: 1rem; display: flex; justify-content: flex-end;">
      <input 
        v-model="searchQuery" 
        type="text" 
        placeholder="Search user, action, or details..." 
        style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; min-width: 300px;"
      />
    </div>

    <div class="table-wrapper">
      <table class="custom-table">
        <thead>
          <tr>
            <th style="width: 180px;">DATE & TIME</th>
            <th style="width: 120px;">USER</th>
            <th style="width: 150px;">ACTION</th>
            <th>DETAILS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredLogs.length === 0">
            <td colspan="4" style="text-align: center; padding: 2rem; color: #666;">No trail logs found.</td>
          </tr>
          <tr v-for="log in filteredLogs" :key="log.id">
            <td style="font-size: 0.8rem; color: #475569;">
              {{ new Date(log.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' }) }}
            </td>
            <td style="font-weight: 600; color: #1e3a8a;">{{ log.user }}</td>
            <td>
              <span :class="['badge', getBadgeClass(log.action)]">{{ log.action }}</span>
            </td>
            <td style="font-size: 0.85rem;">{{ log.details }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
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
}
.custom-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: bold;
  font-size: 0.8rem;
}

.btn-refresh {
  background: #2563eb;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-danger {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  color: white;
  display: inline-block;
}
.badge.green { background: #16a34a; }
.badge.blue { background: #3b82f6; }
.badge.red { background: #dc2626; }
.badge.orange { background: #f59e0b; }
.badge.gray { background: #64748b; }
</style>