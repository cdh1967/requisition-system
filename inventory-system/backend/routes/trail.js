import express from 'express'
import { pool, generateId } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trail_logs ORDER BY created_at DESC LIMIT 1000')
  res.json(rows)
})

router.delete('/', authenticate, async (req, res) => {
  await pool.query('DELETE FROM trail_logs')
  res.json({ ok: true })
})

export default router