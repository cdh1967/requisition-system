<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { addItem, deleteItem, restockItem, updateItem, getInventory, refreshInventory } from '../modules/inventory.js'

const showToast = inject('showToast')
const items = ref([])

// --- STATE PARA SA TABLE ---
const searchQuery = ref('')
const activeFilter = ref('All active')
const limit = ref(10)
const currentPage = ref(1)

// BAG-ONG STATE PARA SA CATEGORY TABS
const activeCategoryTab = ref('Medical Supplies')
const categoryTabs = ['Medical Supplies', 'Office Supplies', 'Janitorial Supplies']

const filterTabs = [
  { label: 'All active', color: '#16a34a' },
  { label: 'Available', color: '#16a34a' },
  { label: 'Low stock', color: '#eab308' },
  { label: 'Out of stock', color: '#dc2626' },
  { label: 'Expiry alerts', color: '#f97316' }
]

function loadItems() {
  refreshInventory()
  items.value = [...getInventory()]
}

onMounted(loadItems)

// --- FILTER & PAGINATION ---
const filteredItems = computed(() => {
  // 1. Filter base sa Active Category Tab
  let result = items.value.filter(item => item.category === activeCategoryTab.value)

  // 2. Search Filter
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    )
  }

  // 3. Quick Filter Tabs
  if (activeFilter.value === 'Available') {
    result = result.filter(item => item.qty > 20)
  } else if (activeFilter.value === 'Low stock') {
    result = result.filter(item => item.qty > 0 && item.qty <= 20)
  } else if (activeFilter.value === 'Out of stock') {
    result = result.filter(item => item.qty === 0)
  } else if (activeFilter.value === 'Expiry alerts') {
    result = [] 
  }

  return result
})

const totalPages = computed(() => Math.ceil(filteredItems.value.length / limit.value))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * limit.value
  return filteredItems.value.slice(start, start + limit.value)
})

function changePage(page) {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page
}

// --- STATE PARA SA DETAILS MODAL ---
const showDetailsModal = ref(false)
const editingItem = ref({
  id: '',
  name: '',
  category: '',
  qty: 0,
  unit: '',
  unitCost: 0,
  beginningBalance: 0,
  adjustStock: 0
})

function openDetailsModal(item) {
  editingItem.value = {
    id: item.id,
    name: item.name,
    category: item.category,
    qty: item.qty,
    unit: item.unit,
    unitCost: item.unitCost || 0,
    beginningBalance: item.qty,
    adjustStock: 0
  }
  showDetailsModal.value = true
}

function saveDetails() {
  const { id, beginningBalance, adjustStock, unitCost } = editingItem.value
  
  if (isNaN(unitCost) || unitCost < 0) {
    showToast('Please enter a valid Unit Cost', true)
    return
  }

  const newQty = Number(beginningBalance) + Number(adjustStock)

  const success = updateItem(id, { 
    ...editingItem.value, 
    qty: newQty 
  })

  if (success) {
    showToast('Item details and stock updated!')
    showDetailsModal.value = false
    loadItems()
  } else {
    showToast('Failed to update item', true)
  }
}

function onDelete(id) {
  if (!confirm('Delete this item?')) return
  deleteItem(id)
  loadItems()
  showToast('Item deleted')
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
        📦 Inventory stocks
      </h2>
    </div>

    <!-- BAG-ONG CATEGORY TABS -->
    <div class="category-tabs">
      <button 
        v-for="cat in categoryTabs" 
        :key="cat"
        @click="activeCategoryTab = cat; currentPage = 1; searchQuery = ''"
        :class="['cat-btn', activeCategoryTab === cat ? 'active' : '']"
      >
        {{ cat }}
      </button>
    </div>

    <!-- QUICK FILTERS -->
    <div class="quick-filters" style="margin-top: 1rem;">
      <span style="font-weight: bold; font-size: 0.9rem; margin-right: 10px;">Quick filter:</span>
      <button 
        v-for="tab in filterTabs" 
        :key="tab.label"
        @click="activeFilter = tab.label; currentPage = 1"
        :style="{ 
          background: activeFilter === tab.label ? tab.color : 'white', 
          color: activeFilter === tab.label ? 'white' : tab.color,
          borderColor: tab.color
        }"
        class="filter-btn"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- SEARCH UG LIMIT -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 1rem 0;">
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
        Show 
        <select v-model="limit" @change="currentPage = 1" style="padding: 0.3rem; border-radius: 4px; border: 1px solid #ccc;">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="70">70</option>
          <option :value="9999">All</option>
        </select>
        entries
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
        Search: 
        <input v-model="searchQuery" @input="currentPage = 1" type="text" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px;" />
      </div>
    </div>

    <!-- TABLE -->
    <div class="table-wrapper">
      <table class="custom-inventory-table">
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            <th>AVAILABLE</th>
            <th>BEGINNING</th>
            <th>UNIT COST</th> <!-- BAG-ONG COLUMN -->
            <th style="text-align: right;">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedItems.length === 0">
            <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No items found in {{ activeCategoryTab }}.</td>
          </tr>
          <tr v-for="item in paginatedItems" :key="item.id">
            <td style="font-weight: 500;">
              {{ item.name }} <br>
              <small style="color: #64748b;">{{ item.category }}</small>
            </td>
            
            <!-- AVAILABLE (STOCK) -->
            <td>
              <span v-if="item.qty === 0" class="badge-red">No stock!</span>
              <span v-else class="badge-green">{{ item.qty }} {{ item.unit }}</span>
            </td>
            
            <!-- BEGINNING -->
            <td>{{ item.qty }}</td>

            <!-- UNIT COST -->
            <td>{{ item.unitCost ? item.unitCost.toFixed(2) : '0.00' }}</td>
            
            <!-- ACTIONS -->
            <td>
              <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button @click="openDetailsModal(item)" style="background: #16a34a; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <span style="font-size: 1rem;">⋮</span> Details
                </button>
                <button class="delete-btn" @click="onDelete(item.id)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAGINATION -->
    <div class="pagination-container">
      <div>
        Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, filteredItems.length) }} of {{ filteredItems.length }} entries
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

    <!-- ===================================== -->
    <!-- MODAL PARA SA DETAILS / EDIT STOCK -->
    <!-- ===================================== -->
    <div v-if="showDetailsModal" class="modal-overlay">
      <div class="modal-content">
        <h3 style="margin-top: 0; color: #1e3a8a; border-bottom: 1px solid #eee; padding-bottom: 10px;">
          📝 Edit Item Details
        </h3>
        
        <form @submit.prevent="saveDetails" class="modal-form">
          <div class="form-group">
            <label>Item Name</label>
            <input v-model="editingItem.name" type="text" required />
          </div>
          
          <div class="form-group">
            <label>Category</label>
            <select v-model="editingItem.category" style="padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px;">
              <option value="Medical Supplies">Medical Supplies</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Janitorial Supplies">Janitorial Supplies</option>
            </select>
          </div>

          <div class="form-group">
            <label>Unit</label>
            <input v-model="editingItem.unit" type="text" required />
          </div>

          <div class="form-group">
            <label>Unit Cost</label>
            <input v-model.number="editingItem.unitCost" type="number" step="0.01" min="0" required />
          </div>

          <hr style="width: 100%; border: 0; border-top: 1px solid #e2e8f0; margin: 0.5rem 0;" />

          <div class="form-group">
            <label style="color: #16a34a; font-weight: bold;">Beginning Balance</label>
            <input v-model.number="editingItem.beginningBalance" type="number" min="0" required />
          </div>

          <div class="form-group">
            <label style="color: #f59e0b; font-weight: bold;">Add/Subtract Stock (+/-)</label>
            <input v-model.number="editingItem.adjustStock" type="number" />
            <small style="color: #64748b;">Ibutang ang positive kung mag-restock, negative kung mag-deduct.</small>
          </div>

          <div style="background: #e0f2fe; padding: 10px; border-radius: 6px; width: 100%; margin-top: 0.5rem; display: flex; justify-content: space-between;">
            <span style="font-weight: bold; color: #1e3a8a;">New Total Stock:</span>
            <strong style="color: #1e3a8a;">{{ Number(editingItem.beginningBalance) + Number(editingItem.adjustStock) }} {{ editingItem.unit }}</strong>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 1rem; width: 100%; justify-content: flex-end;">
            <button type="button" @click="showDetailsModal = false" class="btn-cancel">Cancel</button>
            <button type="submit" class="btn-save">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

  </section>
</template>

<style scoped>
/* STYLES PARA SA CATEGORY TABS */
.category-tabs {
  display: flex;
  gap: 10px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.cat-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  font-weight: bold;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s;
}

.cat-btn:hover {
  background: #f1f5f9;
  color: #1e3a8a;
}

.cat-btn.active {
  color: #1e3a8a;
  border-bottom: 3px solid #1e3a8a;
  background: #eff6ff;
}

/* TABLE STYLES */
.custom-inventory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  border: 1px solid #e2e8f0;
}
.custom-inventory-table th, 
.custom-inventory-table td {
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  text-align: left;
}
.custom-inventory-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: bold;
  text-transform: uppercase;
  font-size: 0.8rem;
}
.custom-inventory-table tbody tr:hover {
  background: #f8fafc;
}

/* BADGES */
.badge-red {
  background: #dc2626;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}
.badge-green {
  background: #16a34a;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

/* FILTER BUTTONS */
.filter-btn {
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  border: 1px solid;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
}

/* PAGINATION */
.pagination-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #475569;
}
.pagination-buttons {
  display: flex;
  align-items: center;
}
.page-btn {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  margin: 0 2px;
  border-radius: 4px;
  color: #475569;
}
.page-btn.active {
  background: #1e3a8a;
  color: white;
  border-color: #1e3a8a;
}
.page-btn:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

/* MODAL STYLES */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.modal-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  flex: 1 1 calc(50% - 1rem);
  min-width: 200px;
}
.form-group label {
  font-size: 0.85rem;
  color: #475569;
  margin-bottom: 0.3rem;
  font-weight: 500;
}
.form-group input, .form-group select {
  padding: 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.btn-save {
  background: #16a34a;
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-save:hover {
  background: #15803d;
}

.btn-cancel {
  background: #cbd5e1;
  color: #333;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-cancel:hover {
  background: #94a3b8;
}
</style>