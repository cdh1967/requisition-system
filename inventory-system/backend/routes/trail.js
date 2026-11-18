import express from 'express'
import { pool, generateId } from '../db.js'
import { authenticate } from '../middleware/auth.js'
const router = express.Router()

router.get('/', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trail_logs ORDER BY created_at DESC LIMIT 1000')
  // Map to camelCase `date` for frontend
  res.json(rows.map(r => ({
    id: r.id,
    user: r.user,
    action: r.action,
    details: r.details,
    date: r.created_at
  })))
})

router.delete('/', authenticate, async (req, res) => {
  await pool.query('DELETE FROM trail_logs')
  res.json({ ok: true })
})

export default router