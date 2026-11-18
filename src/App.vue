<script setup>
import { ref, provide, onMounted, computed, watch } from 'vue'
import InventoryTab from './components/InventoryTab.vue'
import RequisitionTab from './components/RequisitionTab.vue'
import HistoryTab from './components/HistoryTab.vue'
import ApprovalTab from './components/ApprovalTab.vue'
import UsersTab from './components/UsersTab.vue'
import InventoryReport from './components/InventoryReport.vue'
import TrailLogTab from './components/TrailLogTab.vue'
import { login, initUsers, requestPasswordReset, getSession, clearSession } from './modules/auth.js'

const isAuthenticated = ref(false)
const currentUser = ref(null)
const loginForm = ref({ username: '', password: '' })
const loginError = ref('')
const activeTab = ref('inventory')

onMounted(async () => {
  await initUsers()
  // Use server-side session instead of localStorage
  const session = await getSession()
  if (session && session.username) {
    currentUser.value = session
    isAuthenticated.value = true
  }
})

async function handleLogin() {
  loginError.value = ''
  const result = await login(loginForm.value.username, loginForm.value.password)
  if (result.ok) {
    currentUser.value = result.user
    isAuthenticated.value = true
    loginForm.value = { username: '', password: '' }
    activeTab.value = result.user.role === 'Staff' ? 'requisition' : 'inventory'
  } else {
    loginError.value = result.message
  }
}

async function handleForgotPassword() {
  const username = prompt("Enter your username to request a password reset:")
  if (!username) return
  const result = await requestPasswordReset(username)
  alert(result.message || 'Submitted')
}

async function handleLogout() {
  await clearSession()  // clear server session
  isAuthenticated.value = false
  currentUser.value = null
}

const tabs = computed(() => {
  const role = currentUser.value?.role
  if (role === 'Superadmin' || role === 'Administrator') {
    return [
      { id: 'inventory', label: 'Inventory' },
      { id: 'report', label: 'Inventory Report' },
      { id: 'requisition', label: 'Requisition Slip' },
      { id: 'approvals', label: 'Approvals' },
      { id: 'history', label: 'History' },
      { id: 'trail', label: 'Audit Trail' },
      { id: 'users', label: 'Users' }
    ]
  }
  if (role === 'Head Office') {
    return [
      { id: 'approvals', label: 'Head Office Approvals' },
      { id: 'history', label: 'History' }
    ]
  }
  if (role === 'Supply Release') {
    return [
      { id: 'approvals', label: 'Supply Release Approvals' },
      { id: 'history', label: 'History' }
    ]
  }
  return [{ id: 'requisition', label: 'Requisition Slip' }]
})

watch(isAuthenticated, (newVal) => {
  if (newVal) {
    const role = currentUser.value?.role
    if (role === 'Staff') activeTab.value = 'requisition'
    else if (role === 'Head Office' || role === 'Supply Release') activeTab.value = 'approvals'
    else activeTab.value = 'inventory'
  }
})

provide('currentUser', currentUser)

const toast = ref({ show: false, msg: '', error: false })
let toastTimer = null
function showToast(msg, error = false) {
  toast.value = { show: true, msg, error }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value.show = false), 2500)
}
provide('showToast', showToast)
</script>

<template>
  <!-- LOGIN SCREEN -->
  <div v-if="!isAuthenticated" class="login-container">
    <div class="login-box">
      <img src="/logo.svg" alt="CDH Logo" class="login-logo" />
      <h2>🔐 Login</h2>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <input v-model="loginForm.username" type="text" placeholder="Username" required />
        <input v-model="loginForm.password" type="password" placeholder="Password" required />
        <p v-if="loginError" class="error-text">{{ loginError }}</p>
        
        <button type="submit" class="primary-btn">Log In</button>
        
        <button type="button" @click="handleForgotPassword" class="forgot-btn">
          Forgot Password?
        </button>
      </form>
    </div>
  </div>

  <!-- MAIN APP -->
  <div v-else class="app-wrapper">
    <header>
      <div class="header-top">
        <div class="brand">
          <img src="/logo.svg" alt="CDH Logo" class="hospital-logo" />
          <h1>Requisition Slip Inventory</h1>
        </div>
        <div class="user-info">
          <span style="margin-right: 15px; font-size: 0.9rem; font-weight: 500;">
            👤 {{ currentUser?.username }} ({{ currentUser?.role }})
          </span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>
      <nav>
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
    </header>

    <main>
      <template v-if="currentUser?.role === 'Superadmin' || currentUser?.role === 'Administrator'">
        <InventoryTab v-show="activeTab === 'inventory'" />
        <InventoryReport v-show="activeTab === 'report'" />
        <RequisitionTab v-show="activeTab === 'requisition'" />
        <ApprovalTab v-show="activeTab === 'approvals'" :userRole="currentUser?.role" />
        <HistoryTab v-show="activeTab === 'history'" />
        <TrailLogTab v-show="activeTab === 'trail'" />
        <UsersTab v-show="activeTab === 'users'" />
      </template>
      <template v-else-if="currentUser?.role === 'Head Office' || currentUser?.role === 'Supply Release'">
        <ApprovalTab v-show="activeTab === 'approvals'" :userRole="currentUser?.role" />
        <HistoryTab v-show="activeTab === 'history'" />
      </template>
      <template v-else>
        <RequisitionTab v-show="activeTab === 'requisition'" />
      </template>
    </main>

    <div v-if="toast.show" class="toast show" :class="{ error: toast.error }">
      {{ toast.msg }}
    </div>
  </div>
</template>