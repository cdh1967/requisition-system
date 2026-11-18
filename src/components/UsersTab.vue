<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getUsers, addUser, deleteUser, updateUser, getResetRequests, approvePasswordReset, rejectPasswordReset } from '../modules/auth.js'

const showToast = inject('showToast')
const currentUser = inject('currentUser')
const users = ref([])
const resets = ref([])
const searchQuery = ref('')

const showModal = ref(false)
const isEditing = ref(false)
const editingUserId = ref(null)

const form = ref({
  empId: '', name: '', email: '', department: '',
  username: '', password: '', role: 'Staff', status: 'Active'
})

async function loadUsers() {
  users.value = await getUsers()
  resets.value = await getResetRequests()
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

async function onSubmit() {
  if (!form.value.username) return showToast('Username is required', true)
  if (!isEditing.value && !form.value.password) return showToast('Password is required', true)

  let result
  if (isEditing.value) {
    result = await updateUser(editingUserId.value, form.value)
    if (!result.ok) return showToast(result.message, true)
    showToast('Account updated successfully')
  } else {
    result = await addUser(form.value)
    if (!result.ok) return showToast(result.message, true)
    showToast('Account created successfully')
  }
  showModal.value = false
  await loadUsers()
}

async function toggleStatus(user) {
  if (user.username === 'admin' || user.username === 'superadmin') {
    return showToast('Cannot deactivate main accounts', true)
  }
  const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
  const result = await updateUser(user.id, { status: newStatus })
  if (result.ok) {
    await loadUsers()
    showToast(`Account ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`)
  }
}

async function onDelete(id) {
  if (!confirm('Delete this user account?')) return
  const result = await deleteUser(id, currentUser.value?.role)
  if (!result.ok) return showToast(result.message, true)
  await loadUsers()
  showToast('User deleted')
}

async function handleApproveReset(reqId) {
  const req = resets.value.find(r => r.id === reqId)
  const newPassword = prompt(`Enter NEW PASSWORD for "${req?.username}":`)
  if (!newPassword) return
  const result = await approvePasswordReset(reqId, newPassword)
  if (result.ok) { showToast('Password reset successful'); await loadUsers() }
}

async function handleRejectReset(reqId) {
  if (!confirm('Reject this password reset request?')) return
  await rejectPasswordReset(reqId)
  showToast('Request rejected')
  await loadUsers()
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    <div class="header-banner">
      <div>
        <h2 class="title">👥 User Accounts</h2>
        <p class="subtitle">Find employees, manage account details and configure module access.</p>
      </div>
      <button @click="openCreateModal" class="create-btn">👤 Create user</button>
    </div>

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

    <div class="main-card" style="background: white; border-radius: 8px; padding: 1rem;">
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1e3a8a; font-size: 1.1rem;">Account list</h3>
        <button @click="loadUsers" class="refresh-btn" style="background: #2563eb; color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;">🔄 Refresh</button>
      </div>

      <div class="filter-bar" style="margin-bottom: 1rem;">
        <input v-model="searchQuery" type="text" placeholder="Search Employee ID, Name, Email, Department..."
          style="padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; width: 100%; max-width: 400px;" />
      </div>

      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">
        {{ filteredUsers.length }} matching accounts / {{ users.length }} total accounts
      </p>

      <div class="table-wrapper" style="overflow-x: auto;">
        <table class="styled-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Employee ID</th>
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Name</th>
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Email</th>
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Department</th>
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Status</th>
              <th style="border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredUsers.length">
              <td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">No users found.</td>
            </tr>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem;">{{ user.empId || 'N/A' }}</td>
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem; font-weight: 500;">{{ user.name || user.username }}</td>
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem;">{{ user.email || 'N/A' }}</td>
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem;">{{ user.department || 'N/A' }}</td>
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem;">
                <span :style="{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'white', background: user.status === 'Active' ? '#16a34a' : '#dc2626' }">
                  {{ user.status }}
                </span>
              </td>
              <td style="border: 1px solid #e2e8f0; padding: 0.5rem;">
                <div style="display: flex; gap: 5px;">
                  <button @click="openEditModal(user)" style="background: #2563eb; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Edit</button>
                  <button v-if="user.username !== 'admin' && user.username !== 'superadmin'" @click="toggleStatus(user)"
                    :style="{ background: user.status === 'Active' ? '#f59e0b' : '#16a34a', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }">
                    {{ user.status === 'Active' ? 'Deactivate' : 'Activate' }}
                  </button>
                  <button v-if="user.username !== 'admin' && user.username !== 'superadmin'" @click="onDelete(user.id)"
                    style="background: #dc2626; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
      <div style="background: white; padding: 2rem; border-radius: 8px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: #1e3a8a;">{{ isEditing ? 'Edit Account' : 'Create New Account' }}</h3>
        <form @submit.prevent="onSubmit" style="display: flex; flex-wrap: wrap; gap: 1rem;">
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Employee ID</label>
            <input v-model="form.empId" placeholder="e.g. 0001" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Full Name</label>
            <input v-model="form.name" placeholder="e.g. Dela Cruz, Juan" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Email</label>
            <input v-model="form.email" type="email" placeholder="e.g. juan@hospital.com" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Department</label>
            <input v-model="form.department" placeholder="e.g. Nursing" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Username</label>
            <input v-model="form.username" required placeholder="Username" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Password</label>
            <input v-model="form.password" type="password" :placeholder="isEditing ? 'Leave blank to keep' : 'Password'" :required="!isEditing" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;" />
          </div>
          <div style="flex: 1 1 calc(50% - 1rem); min-width: 200px; display: flex; flex-direction: column;">
            <label style="font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem;">Role</label>
            <select v-model="form.role" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;">
              <option v-for="r in availableRoles" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 1rem; width: 100%; justify-content: flex-end;">
            <button type="button" @click="showModal = false" style="background: #cbd5e1; color: #333; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: bold;">Cancel</button>
            <button type="submit" style="background: #16a34a; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: bold;">Save</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>