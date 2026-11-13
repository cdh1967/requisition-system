import express from 'express'
import { pool, generateId } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Helper: insert trail
async function trail(user, action, details) {
  await pool.query('INSERT INTO trail_logs (id,user,action,details) VALUES (?,?,?,?)',
    [generateId(), user || 'System', action, details])
}

// GET ALL (with items)
router.get('/', authenticate, async (req, res) => {
  const [slips] = await pool.query('SELECT * FROM requisitions ORDER BY created_at DESC')
  const [items] = await pool.query('SELECT * FROM requisition_items')
  const result = slips.map(s => ({ ...s, items: items.filter(i => i.requisition_id === s.id) }))
  res.json(result)
})

// CREATE
router.post('/', authenticate, async (req, res) => {
  const { name, dept, date, items } = req.body
  if (!items?.length) return res.json({ ok: false, message: 'No items' })

  // check stock
  for (const line of items) {
    const [rows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [line.itemId])
    if (!rows.length || rows[0].qty < line.qty)
      return res.json({ ok: false, message: `Insufficient stock for ${line.name}` })
  }

  // Generate slipNo YYMMDD-XX
  const now = new Date()
  const datePrefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`
  const [today] = await pool.query('SELECT slip_no FROM requisitions WHERE slip_no LIKE ?', [`${datePrefix}-%`])
  const nextSeq = today.length
    ? Math.max(...today.map(r => parseInt(r.slip_no.split('-')[1]) || 0)) + 1
    : 1
  const slipNo = `${datePrefix}-${String(nextSeq).padStart(2,'0')}`

  const id = generateId()
  await pool.query(
    'INSERT INTO requisitions (id, slip_no, name, dept, date, status, created_by) VALUES (?,?,?,?,?,?,?)',
    [id, slipNo, name, dept, date, 'Pending Head Office', req.user.username]
  )
  for (const line of items) {
    await pool.query(
      'INSERT INTO requisition_items (id, requisition_id, item_id, name, unit, qty, priority, remarks) VALUES (?,?,?,?,?,?,?,?)',
      [generateId(), id, line.itemId, line.name, line.unit, line.qty, line.priority || 'ROUTINE', line.remarks || '']
    )
  }
  res.json({ ok: true, slip: { id, slipNo } })
})

// APPROVE HEAD OFFICE
router.post('/:id/approve-head-office', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions WHERE id = ?', [req.params.id])
  if (!rows.length || rows[0].status !== 'Pending Head Office') return res.json({ ok: false })
  await pool.query('UPDATE requisitions SET status = ? WHERE id = ?', ['Pending Supply Release', req.params.id])
  await trail(req.user.username, 'REQUISITION_APPROVE_HO', `Approved ${rows[0].slip_no} (Head Office)`)
  res.json({ ok: true })
})

// APPROVE SUPPLY RELEASE (deduct stock)
router.post('/:id/approve-supply-release', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions WHERE id = ?', [req.params.id])
  if (!rows.length || rows[0].status !== 'Pending Supply Release') return res.json({ ok: false })
  const slip = rows[0]

  const [items] = await pool.query('SELECT * FROM requisition_items WHERE requisition_id = ?', [slip.id])
  for (const line of items) {
    const [invRows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [line.item_id])
    if (!invRows.length) continue
    await pool.query('UPDATE inventory SET qty = qty - ? WHERE id = ?', [line.qty, line.item_id])
    await pool.query(
      'INSERT INTO inventory_logs (id, item_id, item_name, type, qty, unit, reason) VALUES (?,?,?,?,?,?,?)',
      [generateId(), line.item_id, line.name, 'DEDUCT', line.qty, line.unit, `Released: ${slip.name} (${slip.dept})`]
    )
  }
  await pool.query('UPDATE requisitions SET status = ? WHERE id = ?', ['Approved', slip.id])
  await trail(req.user.username, 'REQUISITION_APPROVE_SR', `Approved & Released ${slip.slip_no}`)
  res.json({ ok: true })
})

// DISAPPROVE
router.post('/:id/disapprove', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions WHERE id = ?', [req.params.id])
  if (!rows.length) return res.json({ ok: false })
  await pool.query('UPDATE requisitions SET status = ? WHERE id = ?', ['Disapproved', req.params.id])
  await trail(req.user.username, 'REQUISITION_REJECT', `Disapproved ${rows[0].slip_no}`)
  res.json({ ok: true })
})

export default router