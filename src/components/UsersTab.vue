<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { 
  getUsers, 
  addUser, 
  deleteUser, 
  updateUser, 
  getResetRequests, 
  approvePasswordReset, 
  rejectPasswordReset 
} from '../modules/auth.js'

const showToast = inject('showToast')
const currentUser = inject('currentUser')
const users = ref([])
const resets = ref([]) 

const searchQuery = ref('')

const showModal = ref(false)
const isEditing = ref(false)
const editingUserId = ref(null)

const form = ref({
  empId: '',
  name: '',
  email: '',
  department: '',
  username: '',
  password: '',
  role: 'Staff',
  status: 'Active'
})

function loadUsers() {
  users.value = getUsers()
  resets.value = getResetRequests()
}

onMounted(loadUsers)

const availableRoles = computed(() => {
  if (currentUser.value?.role === 'Superadmin') {
    return ['Staff', 'Administrator', 'Superadmin', 'Head Office', 'Supply Release']
  }
  return ['Staff', 'Administrator', 'Head Office', 'Supply Release']
})

const filteredUsers = computed(() => {
  let list = users.value.filter(u => u.username !== 'superadmin')
  if (!searchQuery.value) return list
  
  const q = searchQuery.value.toLowerCase()
  return list.filter(u => 
    (u.empId && u.empId.toLowerCase().includes(q)) ||
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.department && u.department.toLowerCase().includes(q)) ||
    (u.username && u.username.toLowerCase().includes(q))
  )
})

function openCreateModal() {
  isEditing.value = false
  form.value = { empId: '', name: '', email: '', department: '', username: '', password: '', role: 'Staff', status: 'Active' }
  showModal.value = true
}

function openEditModal(user) {
  isEditing.value = true
  editingUserId.value = user.id
  form.value = { ...user }
  showModal.value = true
}

function onSubmit() {
  if (!form.value.username || !form.value.password) {
    showToast('Username and password are required', true)
    return
  }

  if (isEditing.value) {
    const result = updateUser(editingUserId.value, form.value)
    if (!result.ok) {
      showToast(result.message, true)
      return
    }
    showToast('Account updated successfully')
  } else {
    const result = addUser(form.value)
    if (!result.ok) {
      showToast(result.message, true)
      return
    }
    showToast('Account created successfully')
  }

  showModal.value = false
  loadUsers()
}

function toggleStatus(user) {
  if (user.username === 'admin' || user.username === 'superadmin') {
    showToast('Cannot deactivate main accounts', true)
    return
  }
  
  const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
  const result = updateUser(user.id, { status: newStatus })
  if (result.ok) {
    loadUsers()
    showToast(`Account ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`)
  }
}

function onDelete(id) {
  if (!confirm('Delete this user account?')) return
  const result = deleteUser(id, currentUser.value?.role)
  if (!result.ok) {
    showToast(result.message, true)
    return
  }
  loadUsers()
  showToast('User deleted')
}

function handleApproveReset(reqId) {
  const newPassword = prompt(`Enter NEW PASSWORD for "${resets.value.find(r => r.id === reqId).username}":`)
  if (!newPassword) return

  const result = approvePasswordReset(reqId, newPassword)
  if (result.ok) {
    showToast('Password reset successful')
    loadUsers()
  }
}

function handleRejectReset(reqId) {
  if (!confirm('Reject this password reset request?')) return
  rejectPasswordReset(reqId)
  showToast('Request rejected')
  loadUsers()
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    
    <!-- HEADER SA USER ACCOUNTS -->
    <div class="header-banner">
      <div>
        <h2 class="title">👥 User Accounts</h2>
        <p class="subtitle">Find employees, manage account details and configure module access.</p>
      </div>
      <button @click="openCreateModal" class="create-btn">
        👤 Create user
      </button>
    </div>

    <!-- PASSWORD RESET REQUESTS -->
    <div v-if="resets.length > 0" class="reset-requests" style="background: #fff3cd; border: 1px solid #ffe69c; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
      <h3 style="margin-top: 0; color: #856404;">🔔 Pending Password Resets ({{ resets.length }})</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li v-for="req in resets" :key="req.id" style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #ffe69c;">
          <div>
            <strong>{{ req.username }}</strong> ({{ req.name }}) requested a reset on {{ new Date(req.date).toLocaleDateString() }}
          </div>
          <div style="display: flex; gap: 10px;">
            <button @click="handleApproveReset(req.id)" style="background: #16a34a; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; border: none; cursor: pointer; font-weight: bold;">Reset Password</button>
            <button @click="handleRejectReset(req.id)" style="background: #dc2626; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; border: none; cursor: pointer;">Reject</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- CARD SA CONTENT -->
    <div class="main-card">
      <div class="card-header">
        <h3 style="margin: 0; color: #1e3a8a; font-size: 1.1rem;">Account list</h3>
        <button @click="loadUsers" class="refresh-btn">🔄 Refresh</button>
      </div>

      <!-- SEARCH BAR -->
      <div class="filter-bar">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search Employee ID, Name, Email, Department..." 
          class="search-input"
        />
        <button @click="searchQuery = ''" class="clear-btn" v-if="searchQuery">Clear</button>
      </div>

      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">
        {{ filteredUsers.length }} matching accounts / {{ users.length }} total accounts
      </p>

      <!-- TABLE -->
      <div class="table-wrapper">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredUsers.length">
              <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">No users found.</td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.empId || 'N/A' }}</td>
              <td style="font-weight: 500;">{{ user.name || user.username }}</td>
              <td>{{ user.email || 'N/A' }}</td>
              <td>{{ user.department || 'N/A' }}</td>
              <td>
                <span :class="['status-badge', user.status === 'Active' ? 'active' : 'inactive']">
                  {{ user.status }}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 5px;">
                  <button @click="openEditModal(user)" class="action-btn edit">Edit</button>
                  <button 
                    v-if="user.username !== 'admin' && user.username !== 'superadmin'"
                    @click="toggleStatus(user)" 
                    :class="['action-btn', user.status === 'Active' ? 'deactivate' : 'activate']"
                  >
                    {{ user.status === 'Active' ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button 
                    v-if="user.username !== 'admin' && user.username !== 'superadmin'"
                    @click="onDelete(user.id)" 
                    class="action-btn delete"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL PARA SA CREATE / EDIT -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-content">
        <h3 style="margin-top: 0; color: #1e3a8a;">{{ isEditing ? 'Edit Account' : 'Create New Account' }}</h3>
        
        <form @submit.prevent="onSubmit" class="modal-form">
          <div class="form-group">
            <label>Employee ID</label>
            <input v-model="form.empId" placeholder="e.g. 0001" />
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input v-model="form.name" placeholder="e.g. Dela Cruz, Juan" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="form.email" type="email" placeholder="e.g. juan@hospital.com" />
          </div>
          <div class="form-group">
            <label>Department</label>
            <input v-model="form.department" placeholder="e.g. Nursing" />
          </div>
          
          <hr style="width: 100%; border: 0; border-top: 1px solid #e2e8f0; margin: 0.5rem 0;" />
          
          <div class="form-group">
            <label>Username (Login)</label>
            <input v-model="form.username" required placeholder="Username" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="form.password" required placeholder="Password" />
          </div>
          <div class="form-group">
            <label>Role</label>
            <select v-model="form.role">
              <option v-for="role in availableRoles" :key="role" :value="role">{{ role }}</option>
            </select>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 1rem; width: 100%; justify-content: flex-end;">
            <button type="button" @click="showModal = false" class="action-btn" style="background: #cbd5e1; color: #333;">Cancel</button>
            <button type="submit" class="action-btn save" style="background: #16a34a;">Save Account</button>
          </div>
        </form>
      </div>
    </div>

  </section>
</template>

<style scoped>
/* ... existing CSS styles ... */
.header-banner { background: #047857; color: white; padding: 1.5rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
.header-banner .title { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: white; }
.header-banner .subtitle { margin: 0; font-size: 0.9rem; color: #d1fae5; }
.create-btn { background: transparent; border: 1px solid white; color: white; padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 5px; }
.create-btn:hover { background: rgba(255,255,255,0.1); }
.main-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 1.5rem; border: 1px solid #e2e8f0; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.refresh-btn { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 0.4rem 1rem; border-radius: 6px; cursor: pointer; }
.filter-bar { display: flex; gap: 10px; margin-bottom: 1rem; }
.search-input { flex: 1; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; }
.clear-btn { background: #ef4444; color: white; padding: 0.6rem 1rem; border-radius: 6px; }
.styled-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.styled-table th { background: #f8fafc; color: #475569; text-align: left; padding: 0.8rem; border-bottom: 2px solid #e2e8f0; font-weight: 600; }
.styled-table td { padding: 0.8rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
.status-badge { padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; }
.status-badge.active { color: #166534; }
.status-badge.inactive { color: #991b1b; }
.action-btn { padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; border: 1px solid #cbd5e1; background: white; color: #475569; cursor: pointer; font-weight: 500; }
.action-btn:hover { background: #f1f5f9; }
.action-btn.edit { color: #1d4ed8; border-color: #bfdbfe; }
.action-btn.delete { color: #dc2626; border-color: #fecaca; }
.action-btn.deactivate { color: #dc2626; border-color: #fecaca; }
.action-btn.activate { color: #16a34a; border-color: #bbf7d0; }
.action-btn.save { color: white; border: none; padding: 0.5rem 1rem; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 2rem; border-radius: 8px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
.modal-form { display: flex; flex-wrap: wrap; gap: 1rem; }
.form-group { display: flex; flex-direction: column; flex: 1 1 calc(50% - 1rem); min-width: 200px; }
.form-group label { font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem; font-weight: 500; }
.form-group input, .form-group select { padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; }
</style>