import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool, generateId } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username])
  if (!rows.length) return res.json({ ok: false, message: 'Invalid username or password' })
  const user = rows[0]
  if (user.status === 'Inactive') return res.json({ ok: false, message: 'Account is deactivated. Contact Admin.' })
  const match = await bcrypt.compare(password, user.password)
  if (!match) return res.json({ ok: false, message: 'Invalid username or password' })

  await pool.query(
    'INSERT INTO trail_logs (id, user, action, details) VALUES (?,?,?,?)',
    [generateId(), user.username, 'LOGIN_SUCCESS', `User ${user.username} logged in.`]
  )

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  )
  const { password: _, ...safeUser } = user
  res.json({ ok: true, token, user: safeUser })
})

// GET USERS
router.get('/users', authenticate, async (req, res) => {
  const [rows] = await pool.query('SELECT id, emp_id, name, email, department, username, role, status FROM users')
  res.json(rows)
})

// CREATE USER
router.post('/users', authenticate, async (req, res) => {
  const { empId, name, email, department, username, password, role, status } = req.body
  const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username])
  if (exists.length) return res.json({ ok: false, message: 'Username already exists' })
  const hash = await bcrypt.hash(password, 10)
  const id = generateId()
  await pool.query(
    'INSERT INTO users (id, emp_id, name, email, department, username, password, role, status) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, empId || 'N/A', name, email, department || 'N/A', username, hash, role || 'Staff', status || 'Active']
  )
  res.json({ ok: true, id })
})

// UPDATE USER
router.put('/users/:id', authenticate, async (req, res) => {
  const { id } = req.params
  const { empId, name, email, department, username, password, role, status } = req.body
  let hash = null
  if (password) hash = await bcrypt.hash(password, 10)

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id])
  if (!rows.length) return res.json({ ok: false, message: 'User not found' })

  await pool.query(
    `UPDATE users SET emp_id=?, name=?, email=?, department=?, username=?, role=?, status=? ${hash ? ', password=?' : ''} WHERE id=?`,
    hash
      ? [empId, name, email, department, username, role, status, hash, id]
      : [empId, name, email, department, username, role, status, id]
  )
  res.json({ ok: true })
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