<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getTrailLogs, clearTrailLogs, refreshTrailLogs } from '../modules/trail/trailService.js'

const showToast = inject('showToast')
const logs = ref([])
const searchQuery = ref('')

// ✅ Naa na ang getBadgeClass (kulang sa imong version)
function getBadgeClass(action) {
  if (!action) return 'gray'
  if (action.includes('LOGIN_SUCCESS')) return 'green'
  if (action.includes('LOGIN_FAILED')) return 'red'
  if (action.includes('ADD') || action.includes('RESTOCK')) return 'blue'
  if (action.includes('DELETE') || action.includes('DEDUCT') || action.includes('REJECT')) return 'red'
  if (action.includes('APPROVE')) return 'green'
  return 'gray'
}

async function loadLogs() {
  await refreshTrailLogs()
  logs.value = getTrailLogs()
}

async function handleClear() {
  if (!confirm('Are you sure you want to clear all trail logs? This cannot be undone.')) return
  await clearTrailLogs()
  await loadLogs()
  showToast('Trail logs cleared')
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
</script>