<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { getInventory, getLogs, refreshInventory, deleteLog } from '../modules/inventory.js'

const showToast = inject('showToast')
const currentUser = inject('currentUser')
const logs = ref([])
const inventory = ref([])
const selectedItemId = ref('')
const activeView = ref('stockcard')

const selectedMonth = ref(new Date().getMonth())
const selectedYear = ref(new Date().getFullYear())
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const monthlyCategory = ref('Janitorial Supplies')
const categories = ['Medical Supplies', 'Office Supplies', 'Janitorial Supplies']

async function loadData() {
  await refreshInventory()
  logs.value = await getLogs()
  inventory.value = [...getInventory()]
  if (inventory.value.length > 0 && !selectedItemId.value) {
    selectedItemId.value = inventory.value[0].id
  }
}

async function handleDeleteLog(id) {
  if (!confirm('Are you sure you want to delete this log entry?')) return
  await deleteLog(id)
  await loadData()
  showToast('Log entry deleted')
}

onMounted(loadData)

const selectedItem = computed(() => inventory.value.find(i => i.id === selectedItemId.value))

const itemLogs = computed(() => {
  if (!selectedItemId.value) return []
  const filtered = logs.value.filter(l => l.itemId === selectedItemId.value).reverse()
  return filtered.map(log => {
    let recQty = 0, issQty = 0
    if (log.type === 'RESTOCK') recQty = log.qty
    else if (log.type === 'DEDUCT') issQty = log.qty
    else if (log.type === 'RETURN') recQty = log.qty

    let requestor = '-', department = '-'
    if (log.type === 'DEDUCT' && log.reason) {
      const match = log.reason.match(/(?:Released|Approved):\s*(.*?)\s*\((.*?)\)/)
      if (match) { requestor = match[1]; department = match[2] }
      else requestor = log.reason
    }
    return { ...log, recQty, issQty, requestor, department, displayDate: formatDateTime(log.date) }
  })
})

const totalReceived = computed(() => itemLogs.value.reduce((sum, l) => sum + l.recQty, 0))
const totalIssued = computed(() => itemLogs.value.reduce((sum, l) => sum + l.issQty, 0))

function formatDateTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
}

function printStockCard() { setTimeout(() => window.print(), 100) }
function printDailyReport() { window.print() }
function printMonthlyReport() { window.print() }

// --- DAILY STOCK RECORD ---
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
    rows.push({ day, stocksReceived: 0, qtyReceived: 0, qtyDispensed: 0, qtyIssued: 0, losses: 0, balance: 0 })
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
    if (rows[i].balance === 0 && i > 0) rows[i].balance = rows[i-1].balance
    else if (i === 0 && rows[i].balance === 0) rows[i].balance = initialStock
  }
  const totals = {
    stocksReceived: rows.reduce((s, r) => s + r.stocksReceived, 0),
    qtyReceived: rows.reduce((s, r) => s + r.qtyReceived, 0),
    qtyDispensed: rows.reduce((s, r) => s + r.qtyDispensed, 0),
    qtyIssued: rows.reduce((s, r) => s + r.qtyIssued, 0),
    losses: rows.reduce((s, r) => s + r.losses, 0),
    endBalance: rows.length > 0 ? rows[rows.length - 1].balance : initialStock
  }
  return { rows, totals }
})

// --- MONTHLY INVENTORY REPORT ---
const monthlyReportData = computed(() => {
  const startOfMonth = new Date(selectedYear.value, selectedMonth.value, 1)
  const endOfMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0, 23, 59, 59)
  const categoryItems = inventory.value.filter(i => i.category === monthlyCategory.value)
  let totalBeginningValue = 0, totalPurchasedValue = 0, totalIssuedValue = 0, totalFinalBalanceValue = 0
  const rows = categoryItems.map((item, index) => {
    const itemLogsArr = logs.value.filter(l => l.itemId === item.id).reverse()
    let beginningQty = 0, purchasedQty = 0, issuedQty = 0
    itemLogsArr.forEach(log => {
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
    return { no: index + 1, name: item.name, unit: item.unit, expiryDate: '', beginningQty, unitCost, beginningTotal, purchasedQty, purchasedTotal, issuedQty, issuedTotal, balanceQty: finalBalanceQty, finalBalanceTotal }
  })
  return {
    rows,
    totals: { beginningTotal: totalBeginningValue, purchasedTotal: totalPurchasedValue, issuedTotal: totalIssuedValue, finalBalanceTotal: totalFinalBalanceValue }
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
          @page { size: 9in 13in landscape; margin: 0.5in; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
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
          <th>DATE</th><th>Stocks Received From:</th><th>Qty Received</th>
          <th>Qty Dispensed</th><th>Qty Issued</th><th>Losses</th><th>Balance</th>
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
          <td class="text-center">TOTAL</td><td></td>
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