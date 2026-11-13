<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getInventory, getLogs, refreshInventory, deleteLog } from '../modules/inventory.js'

const showToast = inject('showToast')
const currentUser = inject('currentUser')
const logs = ref([])
const inventory = ref([])
const selectedItemId = ref('')

const isPrinting = ref(false)
const activeView = ref('stockcard') 

// --- DAILY STOCK RECORD ---
const selectedMonth = ref(new Date().getMonth()) 
const selectedYear = ref(new Date().getFullYear())
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

// --- MONTHLY INVENTORY REPORT ---
const monthlyCategory = ref('Janitorial Supplies')
const categories = ['Medical Supplies', 'Office Supplies', 'Janitorial Supplies']

function loadData() {
  refreshInventory()
  logs.value = [...getLogs()]
  inventory.value = [...getInventory()]
  
  if (inventory.value.length > 0 && !selectedItemId.value) {
    selectedItemId.value = inventory.value[0].id
  }
}

onMounted(loadData)

const selectedItem = computed(() => inventory.value.find(i => i.id === selectedItemId.value))

const itemLogs = computed(() => {
  if (!selectedItemId.value) return []
  const filtered = logs.value.filter(l => l.itemId === selectedItemId.value).reverse()
  
  return filtered.map(log => {
    let recQty = 0
    let issQty = 0
    
    if (log.type === 'RESTOCK') {
      recQty = log.qty
    } else if (log.type === 'DEDUCT' || log.type === 'RETURN') {
      if (log.type === 'DEDUCT') {
        issQty = log.qty
      } else {
        recQty = log.qty
      }
    }

    let requestor = '-'
    let department = '-'
    
    if (log.type === 'DEDUCT' && log.reason) {
      const match = log.reason.match(/(?:Released|Approved):\s*(.*?)\s*\((.*?)\)/)
      if (match) {
        requestor = match[1]
        department = match[2]
      } else {
        requestor = log.reason 
      }
    }

    return {
      ...log,
      recQty,
      issQty,
      requestor,
      department,
      displayDate: formatDateTime(log.date)
    }
  })
})

const totalReceived = computed(() => itemLogs.value.reduce((sum, l) => sum + l.recQty, 0))
const totalIssued = computed(() => itemLogs.value.reduce((sum, l) => sum + l.issQty, 0))

function formatDateTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-US', { 
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
  })
}

function printStockCard() {
  isPrinting.value = true
  setTimeout(() => {
    window.print()
    isPrinting.value = false
  }, 100)
}

function printDailyReport() {
  window.print()
}

function printMonthlyReport() {
  window.print()
}

function handleDeleteLog(id) {
  if (!confirm('Are you sure you want to delete this log entry?')) return
  deleteLog(id)
  loadData()
  showToast('Log entry deleted')
}

// --- FUNCTIONS PARA SA DAILY STOCK RECORD ---
const dailyRecordData = computed(() => {
  if (!selectedItem.value) return { rows: [], totals: {} }

  const allItemLogs = logs.value.filter(l => l.itemId === selectedItemId.value).reverse()
  const filteredLogs = allItemLogs.filter(log => {
    const d = new Date(log.date)
    return d.getMonth() === selectedMonth.value && d.getFullYear() === selectedYear.value
  })

  const daysInMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate()
  
  const rows = []
  for (let day = 1; day <= daysInMonth; day++) {
    rows.push({
      day: day,
      stocksReceived: 0,
      qtyReceived: 0,
      qtyDispensed: 0,
      qtyIssued: 0,
      losses: 0,
      balance: 0
    })
  }

  let initialStock = 0
  allItemLogs.forEach(log => {
    const d = new Date(log.date)
    if (d < new Date(selectedYear.value, selectedMonth.value, 1)) {
      if (log.type === 'RESTOCK') initialStock += log.qty
      if (log.type === 'DEDUCT') initialStock -= log.qty
      if (log.type === 'RETURN') initialStock += log.qty
    }
  })

  let runningBalance = initialStock

  filteredLogs.forEach(log => {
    const d = new Date(log.date)
    const dayIndex = d.getDate() - 1
    
    if (log.type === 'RESTOCK') {
      rows[dayIndex].stocksReceived += log.qty
      rows[dayIndex].qtyReceived += log.qty
      runningBalance += log.qty
    } else if (log.type === 'DEDUCT') {
      rows[dayIndex].qtyDispensed += log.qty
      runningBalance -= log.qty
    } else if (log.type === 'RETURN') {
      rows[dayIndex].stocksReceived += log.qty 
      rows[dayIndex].qtyReceived += log.qty
      runningBalance += log.qty
    }
    
    rows[dayIndex].balance = runningBalance
  })

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].balance === 0 && i > 0) {
       rows[i].balance = rows[i-1].balance
    } else if (i === 0 && rows[i].balance === 0) {
       rows[i].balance = initialStock
    }
  }

  const totals = {
    stocksReceived: rows.reduce((sum, r) => sum + r.stocksReceived, 0),
    qtyReceived: rows.reduce((sum, r) => sum + r.qtyReceived, 0),
    qtyDispensed: rows.reduce((sum, r) => sum + r.qtyDispensed, 0),
    qtyIssued: rows.reduce((sum, r) => sum + r.qtyIssued, 0),
    losses: rows.reduce((sum, r) => sum + r.losses, 0),
    endBalance: rows.length > 0 ? rows[rows.length - 1].balance : initialStock
  }

  return { rows, totals }
})

// --- FUNCTIONS PARA SA MONTHLY INVENTORY REPORT ---
const monthlyReportData = computed(() => {
  const startOfMonth = new Date(selectedYear.value, selectedMonth.value, 1)
  const endOfMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0, 23, 59, 59)

  const categoryItems = inventory.value.filter(i => i.category === monthlyCategory.value)
  
  let totalBeginningValue = 0
  let totalPurchasedValue = 0
  let totalIssuedValue = 0
  let totalFinalBalanceValue = 0

  const rows = categoryItems.map((item, index) => {
    const itemLogs = logs.value.filter(l => l.itemId === item.id).reverse()

    let beginningQty = 0
    let purchasedQty = 0
    let issuedQty = 0

    itemLogs.forEach(log => {
      const logDate = new Date(log.date)
      
      if (logDate < startOfMonth) {
        if (log.type === 'RESTOCK') beginningQty += log.qty
        if (log.type === 'DEDUCT') beginningQty -= log.qty
        if (log.type === 'RETURN') beginningQty += log.qty
      }
      
      if (logDate >= startOfMonth && logDate <= endOfMonth) {
        if (log.type === 'RESTOCK') purchasedQty += log.qty
        if (log.type === 'DEDUCT') issuedQty += log.qty
        if (log.type === 'RETURN') purchasedQty += log.qty 
      }
    })

    const unitCost = item.unitCost || 0 
    
    const beginningTotal = beginningQty * unitCost
    const purchasedTotal = purchasedQty * unitCost
    const issuedTotal = issuedQty * unitCost
    const finalBalanceQty = beginningQty + purchasedQty - issuedQty
    const finalBalanceTotal = finalBalanceQty * unitCost

    totalBeginningValue += beginningTotal
    totalPurchasedValue += purchasedTotal
    totalIssuedValue += issuedTotal
    totalFinalBalanceValue += finalBalanceTotal

    return {
      no: index + 1,
      name: item.name,
      unit: item.unit,
      expiryDate: '', 
      beginningQty,
      unitCost,
      beginningTotal,
      purchasedQty,
      purchasedTotal,
      issuedQty,
      issuedTotal,
      balanceQty: finalBalanceQty,
      finalBalanceTotal
    }
  })

  return {
    rows,
    totals: {
      beginningTotal: totalBeginningValue,
      purchasedTotal: totalPurchasedValue,
      issuedTotal: totalIssuedValue,
      finalBalanceTotal: totalFinalBalanceValue
    }
  }
})

// --- DOWNLOAD FUNCTIONS ---
function downloadHTMLReport(htmlContent, filename) {
  const fullHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; color: black; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 4px; font-size: 11px; }
          th { background-color: #60a5fa; text-align: center; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .header-title { text-align: center; margin-bottom: 20px; }
          .header-title h2 { margin: 0; font-size: 16px; }
          .header-title h3 { margin: 5px 0; font-size: 14px; text-decoration: underline; }
          .footer { margin-top: 30px; font-size: 11px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 40px; }
          .sig-box p { margin: 2px 0; }
          .sig-name { font-weight: bold; text-transform: uppercase; }
          
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          @page {
            size: 9in 13in landscape;
            margin: 0.5in;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        <\/script>
      </body>
    </html>
  `;

  const blob = new Blob([fullHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadMonthlyReport() {
  let html = `
    <div class="header-title">
      <h2>CALAMBA DISTRICT HOSPITAL</h2>
      <p style="margin: 2px 0; font-size: 12px;">Calamba, Misamis Occidental</p>
      <h3>MONTHLY INVENTORY OF ${monthlyCategory.value.toUpperCase()}</h3>
      <p style="margin: 0; font-size: 12px; font-weight: bold;">${monthNames[selectedMonth.value].toUpperCase()}, ${selectedYear.value}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th rowspan="2">NO.</th>
          <th rowspan="2">NAME OF SUPPLIES</th>
          <th rowspan="2">UNIT</th>
          <th rowspan="2">EXPIRY DATE</th>
          <th colspan="3">BEGINNING BALANCE</th>
          <th colspan="3">PURCHASED</th>
          <th colspan="3">ISSUED</th>
          <th rowspan="2">BALANCE</th>
          <th rowspan="2">FINAL BALANCE</th>
        </tr>
        <tr>
          <th>QTY</th><th>UNIT COST</th><th>TOTAL</th>
          <th>QTY</th><th>UNIT COST</th><th>TOTAL</th>
          <th>QTY</th><th>UNIT COST</th><th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
  `;

  monthlyReportData.value.rows.forEach(row => {
    html += `
      <tr>
        <td class="text-center">${row.no}</td>
        <td style="text-transform: uppercase; font-weight: bold;">${row.name}</td>
        <td class="text-center">${row.unit.toUpperCase()}</td>
        <td class="text-center">${row.expiryDate}</td>
        <td class="text-center">${row.beginningQty}</td>
        <td class="text-center">${row.unitCost.toFixed(2)}</td>
        <td class="text-right">${row.beginningTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="text-center">${row.purchasedQty}</td>
        <td class="text-center">${row.unitCost.toFixed(2)}</td>
        <td class="text-right">${row.purchasedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="text-center">${row.issuedQty}</td>
        <td class="text-center">${row.unitCost.toFixed(2)}</td>
        <td class="text-right">${row.issuedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        <td class="text-center font-bold">${row.balanceQty}</td>
        <td class="text-right font-bold">${row.finalBalanceTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot>
        <tr style="background-color: #93c5fd; font-weight: bold;">
          <td colspan="6" class="text-right">Total Amount</td>
          <td class="text-right">${monthlyReportData.value.totals.beginningTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td colspan="2"></td>
          <td class="text-right">${monthlyReportData.value.totals.purchasedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td colspan="2"></td>
          <td class="text-right">${monthlyReportData.value.totals.issuedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
          <td></td>
          <td class="text-right">${monthlyReportData.value.totals.finalBalanceTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        </tr>
      </tfoot>
    </table>
    
    <div class="footer">
      <p>I hereby certify under my official oath that this report shows the true issues of ${monthlyCategory.value} from the Supply during the month indicated above, consist of 1 sheet.</p>
      
      <div class="signatures">
        <div class="sig-box">
          <p style="text-align: left;">Prepared by:</p>
          <p class="sig-name" style="margin-top: 30px;">RUBEN J. AMARON JR.</p>
          <p style="font-style: italic;">Supply Officer-Designate</p>
        </div>
        <div class="sig-box">
          <p style="text-align: left;">Noted by:</p>
          <p class="sig-name" style="margin-top: 30px;">RODELLA C. CUIZON, RN, MN, HHA</p>
          <p style="font-style: italic;">Supervising Administrative Officer</p>
        </div>
        <div class="sig-box">
          <p style="text-align: left;">Examined and Approved by:</p>
          <p class="sig-name" style="margin-top: 30px;">ROMMER V. DESTURA, MD.</p>
          <p style="font-style: italic;">OIC-Chief of Hospital</p>
        </div>
      </div>
    </div>
  `;

  downloadHTMLReport(html, `Monthly_Inventory_${monthlyCategory.value}_${monthNames[selectedMonth.value]}_${selectedYear.value}`);
}

function downloadDailyReport() {
  let html = `
    <div class="header-title" style="text-align: left;">
      <h2 style="margin: 0; font-size: 16px;">DAILY STOCK RECORD BOOK</h2>
    </div>
    <table>
      <tbody>
        <tr>
          <td colspan="2" style="font-weight: bold; background-color: #fbbf24;">Program:</td>
          <td colspan="5" style="font-weight: bold; background-color: #fbbf24;">${selectedItem.value.category.toUpperCase()}</td>
        </tr>
        <tr>
          <td colspan="2" style="font-weight: bold;">Stock name and preparation:</td>
          <td colspan="5">${selectedItem.value.name}</td>
        </tr>
        <tr>
          <td colspan="2" style="font-weight: bold;">Units of Stock:</td>
          <td colspan="5">${selectedItem.value.unit.toUpperCase()}</td>
        </tr>
        <tr>
          <td colspan="2" style="font-weight: bold;">Year:</td>
          <td colspan="5">${selectedYear.value}</td>
        </tr>
        <tr>
          <td colspan="2" style="font-weight: bold;">Month:</td>
          <td colspan="5">${monthNames[selectedMonth.value].toUpperCase()}</td>
        </tr>
      </tbody>
    </table>
    
    <table>
      <thead>
        <tr>
          <th>DATE</th>
          <th>Stocks Received From:</th>
          <th>Qty Received</th>
          <th>Qty Dispensed</th>
          <th>Qty Issued</th>
          <th>Losses</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
  `;

  dailyRecordData.value.rows.forEach(row => {
    html += `
      <tr>
        <td class="text-center font-bold" style="background-color: #fef08a;">${row.day}</td>
        <td></td>
        <td class="text-center">${row.qtyReceived > 0 ? row.qtyReceived : ''}</td>
        <td class="text-center">${row.qtyDispensed > 0 ? row.qtyDispensed : ''}</td>
        <td class="text-center">${row.qtyIssued > 0 ? row.qtyIssued : ''}</td>
        <td class="text-center">${row.losses > 0 ? row.losses : ''}</td>
        <td class="text-center font-bold">${row.balance}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot>
        <tr style="background-color: #fbbf24; font-weight: bold;">
          <td class="text-center">TOTAL</td>
          <td></td>
          <td class="text-center">${dailyRecordData.value.totals.qtyReceived}</td>
          <td class="text-center">${dailyRecordData.value.totals.qtyDispensed}</td>
          <td class="text-center">${dailyRecordData.value.totals.qtyIssued}</td>
          <td class="text-center">${dailyRecordData.value.totals.losses}</td>
          <td class="text-center">${dailyRecordData.value.totals.endBalance}</td>
        </tr>
      </tfoot>
    </table>
  `;

  downloadHTMLReport(html, `Daily_Stock_Record_${selectedItem.value.name}_${monthNames[selectedMonth.value]}_${selectedYear.value}`);
}
</script>

<template>
  <section class="tab-content active" style="padding: 1rem;">
    
    <!-- TOP CONTROLS -->
    <div class="no-print" style="margin-bottom: 1rem; display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
      
      <!-- VIEW TOGGLES -->
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button 
          @click="activeView = 'stockcard'" 
          :style="{ 
            padding: '0.5rem 1rem', 
            borderRadius: '4px', 
            border: '1px solid #1e3a8a', 
            background: activeView === 'stockcard' ? '#1e3a8a' : 'white', 
            color: activeView === 'stockcard' ? 'white' : '#1e3a8a',
            fontWeight: 'bold',
            cursor: 'pointer'
          }"
        >
          📦 Stock Card
        </button>
        
        <button 
          @click="activeView = 'monthly'" 
          :style="{ 
            padding: '0.5rem 1rem', 
            borderRadius: '4px', 
            border: '1px solid #1e3a8a', 
            background: activeView === 'monthly' ? '#1e3a8a' : 'white', 
            color: activeView === 'monthly' ? 'white' : '#1e3a8a',
            fontWeight: 'bold',
            cursor: 'pointer'
          }"
        >
          📑 Monthly Inventory Report
        </button>
        
        <button 
          @click="activeView = 'daily'" 
          :style="{ 
            padding: '0.5rem 1rem', 
            borderRadius: '4px', 
            border: '1px solid #1e3a8a', 
            background: activeView === 'daily' ? '#1e3a8a' : 'white', 
            color: activeView === 'daily' ? 'white' : '#1e3a8a',
            fontWeight: 'bold',
            cursor: 'pointer'
          }"
        >
          📊 Daily Stock Record
        </button>
      </div>

    </div>

    <!-- ========================================= -->
    <!-- STOCK CARD VIEW -->
    <!-- ========================================= -->
    <div v-if="activeView === 'stockcard'" class="report-view">
      
      <!-- ITEM SELECTOR -->
      <div class="no-print" style="margin-bottom: 1rem; display: flex; gap: 10px; align-items: center;">
        <label style="font-weight: bold; color: #1e3a8a;">Select Item:</label>
        <select v-model="selectedItemId" @change="loadData" style="padding: 0.5rem; font-size: 1rem; min-width: 300px; border-radius: 4px; border: 1px solid #ccc;">
          <option v-for="item in inventory" :key="item.id" :value="item.id">
            {{ item.name }} (Stock: {{ item.qty }})
          </option>
        </select>
      </div>

      <!-- REPORT CONTAINER -->
      <div v-if="selectedItem" class="report-container">
        <!-- DETAILS SECTION -->
        <div class="card-section no-print">
          <h3 class="section-title"><span class="icon">ℹ️</span> Details</h3>
          <table class="details-table">
            <tbody>
              <tr><td class="label-green">➔ Code:</td><td>{{ selectedItem.id.slice(0, 12) }}</td></tr>
              <tr><td class="label-green">➔ Lotno:</td><td>968</td></tr>
              <tr><td class="label-green">➔ Drugname:</td><td>{{ selectedItem.name }}</td></tr>
              <tr><td class="label-green">➔ Account:</td><td>{{ selectedItem.category }}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- STOCKCARD SECTION -->
        <div class="card-section print-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 class="section-title" style="margin: 0;"><span class="icon">📦</span> Stockcard</h3>
            
            <button @click="printStockCard" class="primary-btn no-print" style="background: #1e3a8a; margin: 0; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem;">
              🖨️ Print Stock Card
            </button>
          </div>
          
          <div class="table-wrapper" style="border: 1px solid #ccc; overflow-x: auto;">
            <table class="stockcard-table">
              <thead>
                <tr>
                  <th>DATE</th><th>REFERENCE</th><th>REQUESTOR</th><th>DEPARTMENT</th><th>DESCRIPTION</th><th>RECEIVED (QTY)</th><th>ISSUED (QTY)</th>
                  <th v-if="currentUser?.role === 'Superadmin'" class="no-print">ACTION</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="itemLogs.length === 0">
                  <td :colspan="currentUser?.role === 'Superadmin' ? 8 : 7" style="text-align: center; padding: 2rem; color: #666;">No transactions yet.</td>
                </tr>
                <tr v-for="(log, index) in itemLogs" :key="log.id">
                  <td class="text-center">{{ log.displayDate }}</td>
                  <td class="text-center">
                    <span :class="['badge', log.type === 'RESTOCK' ? 'badge-delivery' : (log.type === 'DEDUCT' ? 'badge-issuance' : 'badge-return')]">
                      {{ log.type === 'RESTOCK' ? 'Delivery' : (log.type === 'DEDUCT' ? 'Issuance' : 'Return') }}
                    </span>
                  </td>
                  <td class="text-center" style="font-weight: 500;">{{ log.requestor }}</td>
                  <td class="text-center">{{ log.department }}</td>
                  <td>{{ log.reason }}</td>
                  <td class="text-center">{{ log.recQty > 0 ? log.recQty : '0' }}</td>
                  <td class="text-center">{{ log.issQty > 0 ? log.issQty : '0' }}</td>
                  <td v-if="currentUser?.role === 'Superadmin'" class="no-print text-center">
                    <button @click="handleDeleteLog(log.id)" style="background: #dc2626; padding: 0.2rem 0.5rem; border-radius: 4px; border: none; color: white; cursor: pointer;">Delete</button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: #f8fafc;">
                  <td colspan="5" class="text-right">TOTALS:</td>
                  <td class="text-center">{{ totalReceived }}</td>
                  <td class="text-center">{{ totalIssued }}</td>
                  <td v-if="currentUser?.role === 'Superadmin'" class="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ========================================= -->
    <!-- DAILY STOCK RECORD VIEW -->
    <!-- ========================================= -->
    <div v-else-if="activeView === 'daily'" class="report-view">
      
      <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #1e3a8a; font-size: 1.1rem;">📊 Daily Stock Record Book</h3>
        
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 0.85rem;">
          <label>Month:</label>
          <select v-model="selectedMonth" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; margin-right: 5px;">
            <option v-for="(m, i) in monthNames" :key="i" :value="i">{{ m }}</option>
          </select>
          <label>Year:</label>
          <input v-model.number="selectedYear" type="number" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; width: 60px; margin-right: 10px;" />
          
          <button @click="printDailyReport" class="primary-btn" style="background: #16a34a; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin: 0;">
            🖨️ Print
          </button>
          <button @click="downloadDailyReport" class="primary-btn" style="background: #f59e0b; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin: 0;">
            ⬇️ Download
          </button>
          <button @click="activeView = 'stockcard'" style="background: #64748b; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
            ← Back
          </button>
        </div>
      </div>

      <div class="excel-table-wrapper" style="overflow-x: auto; border: 1px solid #000;">
        <table class="excel-table" style="font-size: 0.75rem;">
          <thead>
            <tr><th colspan="7" class="excel-title" style="font-size: 1rem;">Daily Stock Record Book</th></tr>
            <tr>
              <td colspan="2" style="font-weight: bold; background: #fbbf24; padding: 3px;">Program:</td>
              <td colspan="5" style="font-weight: bold; background: #fbbf24; padding: 3px;">{{ selectedItem?.category.toUpperCase() }}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold; padding: 3px;">Stock name and preparation:</td>
              <td colspan="5" style="padding: 3px;">{{ selectedItem?.name }}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold; padding: 3px;">Units of Stock:</td>
              <td colspan="5" style="padding: 3px;">{{ selectedItem?.unit.toUpperCase() }}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold; padding: 3px;">Year:</td>
              <td colspan="5" style="padding: 3px;">{{ selectedYear }}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold; padding: 3px;">Month:</td>
              <td colspan="5" style="padding: 3px;">{{ monthNames[selectedMonth].toUpperCase() }}</td>
            </tr>
            <tr class="excel-header">
              <th style="width: 40px; padding: 4px;">DATE</th>
              <th style="padding: 4px;">Stocks Received From:</th>
              <th style="padding: 4px;">Qty Received</th>
              <th style="padding: 4px;">Qty Dispensed</th>
              <th style="padding: 4px;">Qty Issued</th>
              <th style="padding: 4px;">Losses</th>
              <th style="padding: 4px;">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dailyRecordData.rows" :key="row.day">
              <td class="text-center font-bold" style="background: #fef08a; padding: 2px;">{{ row.day }}</td>
              <td class="text-center" style="padding: 2px;"></td>
              <td class="text-center" style="padding: 2px;">{{ row.qtyReceived > 0 ? row.qtyReceived : '' }}</td>
              <td class="text-center" style="padding: 2px;">{{ row.qtyDispensed > 0 ? row.qtyDispensed : '' }}</td>
              <td class="text-center" style="padding: 2px;">{{ row.qtyIssued > 0 ? row.qtyIssued : '' }}</td>
              <td class="text-center" style="padding: 2px;">{{ row.losses > 0 ? row.losses : '' }}</td>
              <td class="text-center font-bold" style="padding: 2px;">{{ row.balance }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #fbbf24; font-weight: bold;">
              <td class="text-center" style="padding: 4px;">TOTAL</td>
              <td class="text-center" style="padding: 4px;"></td>
              <td class="text-center" style="padding: 4px;">{{ dailyRecordData.totals.qtyReceived }}</td>
              <td class="text-center" style="padding: 4px;">{{ dailyRecordData.totals.qtyDispensed }}</td>
              <td class="text-center" style="padding: 4px;">{{ dailyRecordData.totals.qtyIssued }}</td>
              <td class="text-center" style="padding: 4px;">{{ dailyRecordData.totals.losses }}</td>
              <td class="text-center" style="padding: 4px;">{{ dailyRecordData.totals.endBalance }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- ========================================= -->
    <!-- MONTHLY INVENTORY REPORT VIEW -->
    <!-- ========================================= -->
    <div v-else-if="activeView === 'monthly'" class="report-view monthly-print-page">
      
      <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0; color: #1e3a8a; font-size: 1.1rem;">📑 Monthly Inventory Report</h3>
        
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 0.85rem;">
          <label>Category:</label>
          <select v-model="monthlyCategory" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px;">
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <label style="margin-left: 5px;">Month:</label>
          <select v-model="selectedMonth" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px;">
            <option v-for="(m, i) in monthNames" :key="i" :value="i">{{ m }}</option>
          </select>
          <label>Year:</label>
          <input v-model.number="selectedYear" type="number" style="padding: 0.3rem; border: 1px solid #ccc; border-radius: 4px; width: 60px; margin-right: 10px;" />
          
          <button @click="printMonthlyReport" class="primary-btn" style="background: #16a34a; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin: 0;">
            🖨️ Print
          </button>
          <button @click="downloadMonthlyReport" class="primary-btn" style="background: #f59e0b; padding: 0.3rem 0.6rem; font-size: 0.8rem; margin: 0;">
            ⬇️ Download
          </button>
          <button @click="activeView = 'stockcard'" style="background: #64748b; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
            ← Back
          </button>
        </div>
      </div>

      <div class="monthly-print-area" style="background: white; padding: 1rem; border-radius: 8px; overflow-x: auto; border: 1px solid #e2e8f0;">
        
        <div style="text-align: center; margin-bottom: 1rem; font-family: Arial, sans-serif;">
          <h2 style="margin: 0; font-size: 1.1rem; font-weight: bold; color: #000;">CALAMBA DISTRICT HOSPITAL</h2>
          <p style="margin: 2px 0; font-size: 0.8rem;">Calamba, Misamis Occidental</p>
          <h3 style="margin: 8px 0 4px 0; font-size: 1rem; font-weight: bold; text-decoration: underline;">MONTHLY INVENTORY OF {{ monthlyCategory.toUpperCase() }}</h3>
          <p style="margin: 0; font-size: 0.8rem; font-weight: bold;">{{ monthNames[selectedMonth].toUpperCase() }}, {{ selectedYear }}</p>
        </div>

        <table class="monthly-report-table" style="font-size: 0.7rem;">
          <thead>
            <tr>
              <th rowspan="2" style="width: 20px; padding: 3px;">NO.</th>
              <th rowspan="2" style="padding: 3px;">NAME OF SUPPLIES</th>
              <th rowspan="2" style="width: 40px; padding: 3px;">UNIT</th>
              <th rowspan="2" style="width: 60px; padding: 3px;">EXPIRY DATE</th>
              <th colspan="3">BEGINNING BALANCE</th>
              <th colspan="3">PURCHASED</th>
              <th colspan="3">ISSUED</th>
              <th rowspan="2" style="width: 50px; padding: 3px;">BALANCE</th>
              <th rowspan="2" style="width: 70px; padding: 3px;">FINAL BALANCE</th>
            </tr>
            <tr>
              <th style="width: 40px; padding: 3px;">QTY</th>
              <th style="width: 50px; padding: 3px;">UNIT COST</th>
              <th style="width: 60px; padding: 3px;">TOTAL</th>
              <th style="width: 40px; padding: 3px;">QTY</th>
              <th style="width: 50px; padding: 3px;">UNIT COST</th>
              <th style="width: 60px; padding: 3px;">TOTAL</th>
              <th style="width: 40px; padding: 3px;">QTY</th>
              <th style="width: 50px; padding: 3px;">UNIT COST</th>
              <th style="width: 60px; padding: 3px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="monthlyReportData.rows.length === 0">
              <td colspan="15" style="text-align: center; padding: 1rem;">No items found in this category.</td>
            </tr>
            <tr v-for="row in monthlyReportData.rows" :key="row.no">
              <td class="text-center" style="padding: 3px;">{{ row.no }}</td>
              <td style="text-transform: uppercase; font-weight: bold; padding: 3px;">{{ row.name }}</td>
              <td class="text-center" style="padding: 3px;">{{ row.unit.toUpperCase() }}</td>
              <td class="text-center" style="padding: 3px;">{{ row.expiryDate }}</td>
              
              <td class="text-center" style="padding: 3px;">{{ row.beginningQty }}</td>
              <td class="text-center" style="padding: 3px;">{{ row.unitCost.toFixed(2) }}</td>
              <td class="text-right" style="padding: 3px;">{{ row.beginningTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              
              <td class="text-center" style="padding: 3px;">{{ row.purchasedQty }}</td>
              <td class="text-center" style="padding: 3px;">{{ row.unitCost.toFixed(2) }}</td>
              <td class="text-right" style="padding: 3px;">{{ row.purchasedTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              
              <td class="text-center" style="padding: 3px;">{{ row.issuedQty }}</td>
              <td class="text-center" style="padding: 3px;">{{ row.unitCost.toFixed(2) }}</td>
              <td class="text-right" style="padding: 3px;">{{ row.issuedTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              
              <td class="text-center font-bold" style="padding: 3px;">{{ row.balanceQty }}</td>
              <td class="text-right font-bold" style="padding: 3px;">{{ row.finalBalanceTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #93c5fd; font-weight: bold; text-transform: uppercase;">
              <td colspan="6" class="text-right" style="padding: 3px;">Total Amount</td>
              <td class="text-right" style="padding: 3px;">{{ monthlyReportData.totals.beginningTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              <td colspan="2"></td>
              <td class="text-right" style="padding: 3px;">{{ monthlyReportData.totals.purchasedTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              <td colspan="2"></td>
              <td class="text-right" style="padding: 3px;">{{ monthlyReportData.totals.issuedTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
              <td></td>
              <td class="text-right" style="padding: 3px;">{{ monthlyReportData.totals.finalBalanceTotal.toLocaleString(undefined, {minimumFractionDigits: 2}) }}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 1.5rem; font-family: Arial, sans-serif; font-size: 0.8rem;">
          <p style="margin-bottom: 20px;">I hereby certify under my official oath that this report shows the true issues of {{ monthlyCategory }} from the Supply during the month indicated above, consist of 1 sheet.</p>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center; margin-top: 30px;">
            <div>
              <p style="margin-bottom: 30px; text-align: left;">Prepared by:</p>
              <p style="font-weight: bold; margin: 0; text-transform: uppercase;">RUBEN J. AMARON JR.</p>
              <p style="margin: 0; font-style: italic;">Supply Officer-Designate</p>
            </div>
            
            <div>
              <p style="margin-bottom: 30px; text-align: left;">Noted by:</p>
              <p style="font-weight: bold; margin: 0; text-transform: uppercase;">RODELLA C. CUIZON, RN, MN, HHA</p>
              <p style="margin: 0; font-style: italic;">Supervising Administrative Officer</p>
            </div>
            
            <div>
              <p style="margin-bottom: 30px; text-align: left;">Examined and Approved by:</p>
              <p style="font-weight: bold; margin: 0; text-transform: uppercase;">ROMMER V. DESTURA, MD.</p>
              <p style="margin: 0; font-style: italic;">OIC-Chief of Hospital</p>
            </div>
          </div>
        </div>

      </div>
    </div>

  </section>
</template>

<style scoped>
/* ... existing styles ... */

/* EXCEL TABLE STYLES */
.excel-table-wrapper {
  border: 1px solid #000;
  background: #fff;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  font-family: Arial, sans-serif;
  color: #000;
}

.excel-table th, .excel-table td {
  border: 1px solid #000;
}

.excel-title {
  font-weight: bold;
  text-align: left;
  background: #fff;
  text-transform: uppercase;
}

.excel-header th {
  background: #fbbf24;
  text-align: center;
  font-weight: bold;
  vertical-align: middle;
}

/* MONTHLY REPORT TABLE STYLES */
.monthly-report-table {
  width: 100%;
  border-collapse: collapse;
  font-family: Arial, sans-serif;
  color: #000;
  border: 1px solid #000;
}

.monthly-report-table th, 
.monthly-report-table td {
  border: 1px solid #000;
  vertical-align: middle;
}

.monthly-report-table th {
  background: #60a5fa;
  text-align: center;
  font-weight: bold;
  text-transform: uppercase;
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.font-bold { font-weight: bold; }

/* =========================================
   PRINT STYLES - STRICTLY FOR REPORTS
   ========================================= */
@media print {
  /* 1. Tagoa ang tanang butang sa page */
  body, html { margin: 0; padding: 0; }
  body * { 
    visibility: hidden; 
  }

  /* 2. Tagoa jud ang main header, nav, ug ubang buttons sa gawas */
  header, nav, .no-print { 
    display: none !important; 
  }

  /* 3. Ipakaon (show) ang active report view */
  .report-view, .report-view * { 
    visibility: visible; 
  }

  /* 4. Ibutang sa pinaka-taas ug walay margin */
  .report-view { 
    position: absolute; 
    left: 0; 
    top: 0; 
    margin: 0; 
    width: 100%; 
    padding: 0;
  }

  /* 5. Siguroha nga walay box-shadow o border ang container */
  .tab-content {
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
  }

  /* Print styling for Stock Card */
  .print-section {
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }

  /* 6. Pugngi ang page breaks sa tunga sa table rows */
  .stockcard-table tr, .excel-table tr, .monthly-report-table tr {
    page-break-inside: avoid;
  }

  /* 7. Siguroha klaro ang borders ug colors */
  .excel-table th, .excel-table td,
  .monthly-report-table th, .monthly-report-table td,
  .stockcard-table th, .stockcard-table td {
    border: 1px solid #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .excel-header th, .excel-table tfoot tr {
    background: #fbbf24 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .monthly-report-table th, .monthly-report-table tfoot tr {
    background: #93c5fd !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .monthly-report-table {
    font-size: 0.65rem !important; 
  }

  /* Page settings for 9x13 landscape */
  @page {
    size: 9in 13in landscape; 
    margin: 0.5in; 
  }
}
</style>