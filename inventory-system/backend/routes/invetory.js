import express from 'express'
import { pool, generateId } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

async function addLog(itemId, itemName, type, qty, unit, reason) {
  await pool.query(
    'INSERT INTO inventory_logs (id, item_id, item_name, type, qty, unit, reason) VALUES (?,?,?,?,?,?,?)',
    [generateId(), itemId, itemName, type, qty, unit, reason]
  )
}

// GET ALL
router.get('/', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM inventory ORDER BY name ASC')
  res.json(rows)
})

// GET LOGS
router.get('/logs', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM inventory_logs ORDER BY created_at DESC')
  res.json(rows)
})

// ADD ITEM
router.post('/', authenticate, async (req, res) => {
  const { name, category, qty, unit } = req.body
  const id = generateId()
  await pool.query('INSERT INTO inventory (id, name, category, qty, unit) VALUES (?,?,?,?,?)', [id, name, category, qty, unit])
  await addLog(id, name, 'RESTOCK', qty, unit, 'Added new item')
  await pool.query('INSERT INTO trail_logs (id,user,action,details) VALUES (?,?,?,?)',
    [generateId(), req.user.username, 'INVENTORY_ADD', `Added ${name} (${qty} ${unit})`])
  res.json({ ok: true, id })
})

// UPDATE ITEM
router.put('/:id', authenticate, async (req, res) => {
  const { name, category, qty, unit } = req.body
  await pool.query('UPDATE inventory SET name=?, category=?, qty=?, unit=? WHERE id=?', [name, category, qty, unit, req.params.id])
  await addLog(req.params.id, name, 'RESTOCK', 0, unit, 'Item details updated')
  res.json({ ok: true })
})

// DELETE ITEM
router.delete('/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM inventory WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

// RESTOCK
router.post('/:id/restock', authenticate, async (req, res) => {
  const { amount, reason } = req.body
  const [rows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [req.params.id])
  if (!rows.length) return res.json({ ok: false })
  const item = rows[0]
  await pool.query('UPDATE inventory SET qty = qty + ? WHERE id = ?', [amount, req.params.id])
  await addLog(item.id, item.name, 'RESTOCK', amount, item.unit, reason || 'Manual restock')
  res.json({ ok: true })
})

// RETURN
router.post('/:id/return', authenticate, async (req, res) => {
  const { amount, reason } = req.body
  const [rows] = await pool.query('SELECT * FROM inventory WHERE id = ?', [req.params.id])
  if (!rows.length) return res.json({ ok: false })
  const item = rows[0]
  await pool.query('UPDATE inventory SET qty = qty + ? WHERE id = ?', [amount, req.params.id])
  await addLog(item.id, item.name, 'RETURN', amount, item.unit, reason || 'Returned Item')
  res.json({ ok: true })
})

// DELETE LOG
router.delete('/logs/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM inventory_logs WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router