import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool, generateId } from '../db.js'          // ✅ correct if db.js at root
import { authenticate } from '../middleware/auth.js' // ✅ correct
const router = express.Router()

// GET /login — return camelCase
const { password: _, emp_id, ...rest } = user
const safeUser = { ...rest, empId: emp_id }
res.json({ ok: true, token, user: safeUser })

// GET /users — return camelCase
router.get('/users', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT id, emp_id, name, email, department, username, role, status FROM users')
  res.json(rows.map(u => ({
    id: u.id, empId: u.emp_id, name: u.name, email: u.email,
    department: u.department, username: u.username, role: u.role, status: u.status
  })))
})

// GET /resets — return camelCase `date`
router.get('/resets', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM password_resets')
  res.json(rows.map(r => ({
    id: r.id, username: r.username, name: r.name, date: r.created_at
  })))
})
// DELETE USER
router.delete('/users/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT username FROM users WHERE id = ?', [req.params.id])
  if (!rows.length) return res.json({ ok: false, message: 'User not found' })
  if (['admin', 'superadmin'].includes(rows[0].username))
    return res.json({ ok: false, message: 'Cannot delete main accounts' })
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

// PASSWORD RESETS
router.get('/resets', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM password_resets')
  res.json(rows)
})

router.post('/resets/request', async (req, res) => {
  const { username } = req.body
  const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username])
  if (!users.length) return res.json({ ok: false, message: 'Username not found.' })
  const [exists] = await pool.query('SELECT id FROM password_resets WHERE username = ?', [username])
  if (exists.length) return res.json({ ok: false, message: 'You already have a pending request.' })
  await pool.query('INSERT INTO password_resets (id, username, name) VALUES (?,?,?)', [generateId(), username, users[0].name])
  res.json({ ok: true, message: 'Reset request submitted.' })
})

router.post('/resets/:id/approve', authenticate, async (req, res) => {
  const { newPassword } = req.body
  const [rows] = await pool.query('SELECT * FROM password_resets WHERE id = ?', [req.params.id])
  if (!rows.length) return res.json({ ok: false })
  const hash = await bcrypt.hash(newPassword, 10)
  await pool.query('UPDATE users SET password = ? WHERE username = ?', [hash, rows[0].username])
  await pool.query('DELETE FROM password_resets WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.delete('/resets/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM password_resets WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router