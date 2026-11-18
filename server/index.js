import express from 'express'
import session from 'express-session'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'cdh-inventory-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}))

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cdh_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Initialize schema
async function initDB() {
  const conn = await pool.getConnection()
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      empId VARCHAR(50),
      email VARCHAR(255),
      department VARCHAR(100),
      status VARCHAR(20) DEFAULT 'Active'
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      qty INT DEFAULT 0,
      unit VARCHAR(50),
      unitCost DECIMAL(10,2) DEFAULT 0
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(36) PRIMARY KEY,
      itemId VARCHAR(36),
      type VARCHAR(20),
      qty INT,
      reason TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS requisitions (
      id VARCHAR(36) PRIMARY KEY,
      slipNo VARCHAR(50),
      name VARCHAR(255),
      dept VARCHAR(100),
      date VARCHAR(50),
      createdAt VARCHAR(50),
      status VARCHAR(50),
      createdBy VARCHAR(100),
      items LONGTEXT
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS trail (
      id VARCHAR(36) PRIMARY KEY,
      user VARCHAR(100),
      action VARCHAR(100),
      details TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100),
      name VARCHAR(255),
      date VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Pending'
    )`)

    // Seed admin
    const [rows] = await conn.query('SELECT * FROM users WHERE username=?', ['superadmin'])
    if (rows.length === 0) {
      await conn.query(
        'INSERT INTO users (id,username,password,name,role,status) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), 'superadmin', bcrypt.hashSync('admin123', 10), 'Super Admin', 'Superadmin', 'Active']
      )
    }
    console.log('✅ Database initialized')
  } finally {
    conn.release()
  }
}

const authRequired = (req, res, next) => req.session.user ? next() : res.status(401).json({ message: 'Unauthorized' })

// ============ AUTH ============
app.post('/api/auth/init', async (req, res) => res.json({ ok: true }))

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    const user = rows[0]
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    if (user.status === 'Inactive') {
      return res.status(401).json({ message: 'Account is deactivated' })
    }
    const safe = { id: user.id, username: user.username, name: user.name, role: user.role }
    req.session.user = safe
    res.json({ user: safe })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'No session' })
  res.json({ user: req.session.user })
})

app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })))

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    if (rows.length === 0) return res.json({ message: 'If the username exists, a reset request was submitted.' })
    const user = rows[0]
    await pool.query('INSERT INTO password_resets (id,username,name,date,status) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user.username, user.name, new Date().toISOString(), 'Pending'])
    res.json({ message: 'Password reset request submitted. Please contact the admin.' })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/reset-requests', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM password_resets WHERE status='Pending' ORDER BY date DESC")
    res.json(rows)
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/approve', authRequired, async (req, res) => {
  try {
    const { newPassword } = req.body
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE id=?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' })
    const reset = rows[0]
    await pool.query('UPDATE users SET password=? WHERE username=?',
      [bcrypt.hashSync(newPassword, 10), reset.username])
    await pool.query("UPDATE password_resets SET status='Approved' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/reject', authRequired, async (req, res) => {
  try {
    await pool.query("UPDATE password_resets SET status='Rejected' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ USERS ============
app.get('/api/users', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT id,username,name,role,empId,email,department,status FROM users')
  res.json(rows)
})

app.post('/api/users', authRequired, async (req, res) => {
  try {
    const { username, password, name, role, empId, email, department, status } = req.body
    const id = crypto.randomUUID()
    await pool.query(
      'INSERT INTO users (id,username,password,name,role,empId,email,department,status) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, username, bcrypt.hashSync(password, 10), name, role, empId, email, department, status || 'Active']
    )
    res.json({ id })
  } catch (e) {
    res.status(400).json({ message: e.code === 'ER_DUP_ENTRY' ? 'Username already exists' : e.message })
  }
})

app.put('/api/users/:id', authRequired, async (req, res) => {
  try {
    const { name, role, empId, email, department, status, password } = req.body
    if (password) {
      await pool.query('UPDATE users SET password=? WHERE id=?', [bcrypt.hashSync(password, 10), req.params.id])
    }
    await pool.query(
      'UPDATE users SET name=?, role=?, empId=?, email=?, department=?, status=? WHERE id=?',
      [name, role, empId, email, department, status, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ message: e.message }) }
})

app.delete('/api/users/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ INVENTORY ============
app.get('/api/inventory', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM inventory')
  res.json(rows)
})

app.post('/api/inventory', authRequired, async (req, res) => {
  try {
    const { name, category, qty = 0, unit, unitCost = 0 } = req.body
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO inventory (id,name,category,qty,unit,unitCost) VALUES (?,?,?,?,?,?)',
      [id, name, category, qty, unit, unitCost])
    res.json({ id })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.put('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    const { name, category, qty, unit, unitCost } = req.body
    await pool.query('UPDATE inventory SET name=?,category=?,qty=?,unit=?,unitCost=? WHERE id=?',
      [name, category, qty, unit, unitCost, req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/restock', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RESTOCK', qty, reason || 'Restock', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/return', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RETURN', qty, reason || 'Return', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/inventory/logs', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM logs ORDER BY date DESC')
  res.json(rows)
})

app.delete('/api/inventory/logs/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM logs WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

// ============ REQUISITIONS ============
app.get('/api/requisitions', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY createdAt DESC')
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })))
})

app.post('/api/requisitions', authRequired, async (req, res) => {
  try {
    const { name, dept, date, items } = req.body
    const id = crypto.randomUUID()
    const slipNo = 'RS-' + Date.now().toString().slice(-6)
    await pool.query(
      'INSERT INTO requisitions (id,slipNo,name,dept,date,createdAt,status,createdBy,items) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, slipNo, name, dept, date, new Date().toISOString(), 'Pending Head Office', req.session.user.username, JSON.stringify(items)]
    )
    const [rows] = await pool.query('SELECT * FROM requisitions WHERE id=?', [id])
    res.json({ ...rows[0], items })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-head', authRequired, async (req, res) => {
  try {
    await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Pending Supply Release', req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-supply', authRequired, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT * FROM requisitions WHERE id=?', [req.params.id])
    if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Not found' }) }
    const slip = rows[0]
    const items = JSON.parse(slip.items)
    for (const it of items) {
      await conn.query('UPDATE inventory SET qty = qty - ? WHERE id=?', [it.qty, it.itemId])
      await conn.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), it.itemId, 'DEDUCT', it.qty, `Released: ${slip.name} (${slip.dept})`, new Date().toISOString()])
    }
    await conn.query('UPDATE requisitions SET status=? WHERE id=?', ['Approved', req.params.id])
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ message: e.message })
  } finally { conn.release() }
})

app.post('/api/requisitions/:id/disapprove', authRequired, async (req, res) => {
  await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Disapproved', req.params.id])
  res.json({ ok: true })
})

// ============ TRAIL ============
app.get('/api/trail', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trail ORDER BY date DESC')
  res.json(rows)
})

app.post('/api/trail', authRequired, async (req, res) => {
  try {
    const { user, action, details } = req.body
    await pool.query('INSERT INTO trail (id,user,action,details,date) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user, action, details, new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/trail', authRequired, async (req, res) => {
  await pool.query('DELETE FROM trail')
  res.json({ ok: true })
})

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`))
}).catch(err => {
  console.error('❌ DB init failed:', err)
  process.exit(1)
})import express from 'express'
import session from 'express-session'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'cdh-inventory-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}))

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cdh_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Initialize schema
async function initDB() {
  const conn = await pool.getConnection()
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      empId VARCHAR(50),
      email VARCHAR(255),
      department VARCHAR(100),
      status VARCHAR(20) DEFAULT 'Active'
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      qty INT DEFAULT 0,
      unit VARCHAR(50),
      unitCost DECIMAL(10,2) DEFAULT 0
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(36) PRIMARY KEY,
      itemId VARCHAR(36),
      type VARCHAR(20),
      qty INT,
      reason TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS requisitions (
      id VARCHAR(36) PRIMARY KEY,
      slipNo VARCHAR(50),
      name VARCHAR(255),
      dept VARCHAR(100),
      date VARCHAR(50),
      createdAt VARCHAR(50),
      status VARCHAR(50),
      createdBy VARCHAR(100),
      items LONGTEXT
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS trail (
      id VARCHAR(36) PRIMARY KEY,
      user VARCHAR(100),
      action VARCHAR(100),
      details TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100),
      name VARCHAR(255),
      date VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Pending'
    )`)

    // Seed admin
    const [rows] = await conn.query('SELECT * FROM users WHERE username=?', ['superadmin'])
    if (rows.length === 0) {
      await conn.query(
        'INSERT INTO users (id,username,password,name,role,status) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), 'superadmin', bcrypt.hashSync('admin123', 10), 'Super Admin', 'Superadmin', 'Active']
      )
    }
    console.log('✅ Database initialized')
  } finally {
    conn.release()
  }
}

const authRequired = (req, res, next) => req.session.user ? next() : res.status(401).json({ message: 'Unauthorized' })

// ============ AUTH ============
app.post('/api/auth/init', async (req, res) => res.json({ ok: true }))

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    const user = rows[0]
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    if (user.status === 'Inactive') {
      return res.status(401).json({ message: 'Account is deactivated' })
    }
    const safe = { id: user.id, username: user.username, name: user.name, role: user.role }
    req.session.user = safe
    res.json({ user: safe })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'No session' })
  res.json({ user: req.session.user })
})

app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })))

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    if (rows.length === 0) return res.json({ message: 'If the username exists, a reset request was submitted.' })
    const user = rows[0]
    await pool.query('INSERT INTO password_resets (id,username,name,date,status) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user.username, user.name, new Date().toISOString(), 'Pending'])
    res.json({ message: 'Password reset request submitted. Please contact the admin.' })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/reset-requests', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM password_resets WHERE status='Pending' ORDER BY date DESC")
    res.json(rows)
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/approve', authRequired, async (req, res) => {
  try {
    const { newPassword } = req.body
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE id=?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' })
    const reset = rows[0]
    await pool.query('UPDATE users SET password=? WHERE username=?',
      [bcrypt.hashSync(newPassword, 10), reset.username])
    await pool.query("UPDATE password_resets SET status='Approved' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/reject', authRequired, async (req, res) => {
  try {
    await pool.query("UPDATE password_resets SET status='Rejected' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ USERS ============
app.get('/api/users', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT id,username,name,role,empId,email,department,status FROM users')
  res.json(rows)
})

app.post('/api/users', authRequired, async (req, res) => {
  try {
    const { username, password, name, role, empId, email, department, status } = req.body
    const id = crypto.randomUUID()
    await pool.query(
      'INSERT INTO users (id,username,password,name,role,empId,email,department,status) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, username, bcrypt.hashSync(password, 10), name, role, empId, email, department, status || 'Active']
    )
    res.json({ id })
  } catch (e) {
    res.status(400).json({ message: e.code === 'ER_DUP_ENTRY' ? 'Username already exists' : e.message })
  }
})

app.put('/api/users/:id', authRequired, async (req, res) => {
  try {
    const { name, role, empId, email, department, status, password } = req.body
    if (password) {
      await pool.query('UPDATE users SET password=? WHERE id=?', [bcrypt.hashSync(password, 10), req.params.id])
    }
    await pool.query(
      'UPDATE users SET name=?, role=?, empId=?, email=?, department=?, status=? WHERE id=?',
      [name, role, empId, email, department, status, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ message: e.message }) }
})

app.delete('/api/users/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ INVENTORY ============
app.get('/api/inventory', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM inventory')
  res.json(rows)
})

app.post('/api/inventory', authRequired, async (req, res) => {
  try {
    const { name, category, qty = 0, unit, unitCost = 0 } = req.body
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO inventory (id,name,category,qty,unit,unitCost) VALUES (?,?,?,?,?,?)',
      [id, name, category, qty, unit, unitCost])
    res.json({ id })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.put('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    const { name, category, qty, unit, unitCost } = req.body
    await pool.query('UPDATE inventory SET name=?,category=?,qty=?,unit=?,unitCost=? WHERE id=?',
      [name, category, qty, unit, unitCost, req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/restock', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RESTOCK', qty, reason || 'Restock', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/return', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RETURN', qty, reason || 'Return', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/inventory/logs', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM logs ORDER BY date DESC')
  res.json(rows)
})

app.delete('/api/inventory/logs/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM logs WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

// ============ REQUISITIONS ============
app.get('/api/requisitions', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY createdAt DESC')
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })))
})

app.post('/api/requisitions', authRequired, async (req, res) => {
  try {
    const { name, dept, date, items } = req.body
    const id = crypto.randomUUID()
    const slipNo = 'RS-' + Date.now().toString().slice(-6)
    await pool.query(
      'INSERT INTO requisitions (id,slipNo,name,dept,date,createdAt,status,createdBy,items) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, slipNo, name, dept, date, new Date().toISOString(), 'Pending Head Office', req.session.user.username, JSON.stringify(items)]
    )
    const [rows] = await pool.query('SELECT * FROM requisitions WHERE id=?', [id])
    res.json({ ...rows[0], items })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-head', authRequired, async (req, res) => {
  try {
    await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Pending Supply Release', req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-supply', authRequired, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT * FROM requisitions WHERE id=?', [req.params.id])
    if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Not found' }) }
    const slip = rows[0]
    const items = JSON.parse(slip.items)
    for (const it of items) {
      await conn.query('UPDATE inventory SET qty = qty - ? WHERE id=?', [it.qty, it.itemId])
      await conn.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), it.itemId, 'DEDUCT', it.qty, `Released: ${slip.name} (${slip.dept})`, new Date().toISOString()])
    }
    await conn.query('UPDATE requisitions SET status=? WHERE id=?', ['Approved', req.params.id])
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ message: e.message })
  } finally { conn.release() }
})

app.post('/api/requisitions/:id/disapprove', authRequired, async (req, res) => {
  await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Disapproved', req.params.id])
  res.json({ ok: true })
})

// ============ TRAIL ============
app.get('/api/trail', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trail ORDER BY date DESC')
  res.json(rows)
})

app.post('/api/trail', authRequired, async (req, res) => {
  try {
    const { user, action, details } = req.body
    await pool.query('INSERT INTO trail (id,user,action,details,date) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user, action, details, new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/trail', authRequired, async (req, res) => {
  await pool.query('DELETE FROM trail')
  res.json({ ok: true })
})

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`))
}).catch(err => {
  console.error('❌ DB init failed:', err)
  process.exit(1)
})import express from 'express'
import session from 'express-session'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET || 'cdh-inventory-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
}))

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cdh_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Initialize schema
async function initDB() {
  const conn = await pool.getConnection()
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      empId VARCHAR(50),
      email VARCHAR(255),
      department VARCHAR(100),
      status VARCHAR(20) DEFAULT 'Active'
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      qty INT DEFAULT 0,
      unit VARCHAR(50),
      unitCost DECIMAL(10,2) DEFAULT 0
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(36) PRIMARY KEY,
      itemId VARCHAR(36),
      type VARCHAR(20),
      qty INT,
      reason TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS requisitions (
      id VARCHAR(36) PRIMARY KEY,
      slipNo VARCHAR(50),
      name VARCHAR(255),
      dept VARCHAR(100),
      date VARCHAR(50),
      createdAt VARCHAR(50),
      status VARCHAR(50),
      createdBy VARCHAR(100),
      items LONGTEXT
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS trail (
      id VARCHAR(36) PRIMARY KEY,
      user VARCHAR(100),
      action VARCHAR(100),
      details TEXT,
      date VARCHAR(50)
    )`)

    await conn.query(`CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100),
      name VARCHAR(255),
      date VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Pending'
    )`)

    // Seed admin
    const [rows] = await conn.query('SELECT * FROM users WHERE username=?', ['superadmin'])
    if (rows.length === 0) {
      await conn.query(
        'INSERT INTO users (id,username,password,name,role,status) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), 'superadmin', bcrypt.hashSync('admin123', 10), 'Super Admin', 'Superadmin', 'Active']
      )
    }
    console.log('✅ Database initialized')
  } finally {
    conn.release()
  }
}

const authRequired = (req, res, next) => req.session.user ? next() : res.status(401).json({ message: 'Unauthorized' })

// ============ AUTH ============
app.post('/api/auth/init', async (req, res) => res.json({ ok: true }))

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    const user = rows[0]
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    if (user.status === 'Inactive') {
      return res.status(401).json({ message: 'Account is deactivated' })
    }
    const safe = { id: user.id, username: user.username, name: user.name, role: user.role }
    req.session.user = safe
    res.json({ user: safe })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'No session' })
  res.json({ user: req.session.user })
})

app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })))

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body
    const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username])
    if (rows.length === 0) return res.json({ message: 'If the username exists, a reset request was submitted.' })
    const user = rows[0]
    await pool.query('INSERT INTO password_resets (id,username,name,date,status) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user.username, user.name, new Date().toISOString(), 'Pending'])
    res.json({ message: 'Password reset request submitted. Please contact the admin.' })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/auth/reset-requests', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM password_resets WHERE status='Pending' ORDER BY date DESC")
    res.json(rows)
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/approve', authRequired, async (req, res) => {
  try {
    const { newPassword } = req.body
    const [rows] = await pool.query('SELECT * FROM password_resets WHERE id=?', [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Not found' })
    const reset = rows[0]
    await pool.query('UPDATE users SET password=? WHERE username=?',
      [bcrypt.hashSync(newPassword, 10), reset.username])
    await pool.query("UPDATE password_resets SET status='Approved' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/auth/reset-requests/:id/reject', authRequired, async (req, res) => {
  try {
    await pool.query("UPDATE password_resets SET status='Rejected' WHERE id=?", [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ USERS ============
app.get('/api/users', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT id,username,name,role,empId,email,department,status FROM users')
  res.json(rows)
})

app.post('/api/users', authRequired, async (req, res) => {
  try {
    const { username, password, name, role, empId, email, department, status } = req.body
    const id = crypto.randomUUID()
    await pool.query(
      'INSERT INTO users (id,username,password,name,role,empId,email,department,status) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, username, bcrypt.hashSync(password, 10), name, role, empId, email, department, status || 'Active']
    )
    res.json({ id })
  } catch (e) {
    res.status(400).json({ message: e.code === 'ER_DUP_ENTRY' ? 'Username already exists' : e.message })
  }
})

app.put('/api/users/:id', authRequired, async (req, res) => {
  try {
    const { name, role, empId, email, department, status, password } = req.body
    if (password) {
      await pool.query('UPDATE users SET password=? WHERE id=?', [bcrypt.hashSync(password, 10), req.params.id])
    }
    await pool.query(
      'UPDATE users SET name=?, role=?, empId=?, email=?, department=?, status=? WHERE id=?',
      [name, role, empId, email, department, status, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) { res.status(400).json({ message: e.message }) }
})

app.delete('/api/users/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

// ============ INVENTORY ============
app.get('/api/inventory', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM inventory')
  res.json(rows)
})

app.post('/api/inventory', authRequired, async (req, res) => {
  try {
    const { name, category, qty = 0, unit, unitCost = 0 } = req.body
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO inventory (id,name,category,qty,unit,unitCost) VALUES (?,?,?,?,?,?)',
      [id, name, category, qty, unit, unitCost])
    res.json({ id })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.put('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    const { name, category, qty, unit, unitCost } = req.body
    await pool.query('UPDATE inventory SET name=?,category=?,qty=?,unit=?,unitCost=? WHERE id=?',
      [name, category, qty, unit, unitCost, req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/inventory/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id=?', [req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/restock', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RESTOCK', qty, reason || 'Restock', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/inventory/:id/return', authRequired, async (req, res) => {
  try {
    const { qty, reason } = req.body
    await pool.query('UPDATE inventory SET qty = qty + ? WHERE id=?', [qty, req.params.id])
    await pool.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.params.id, 'RETURN', qty, reason || 'Return', new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.get('/api/inventory/logs', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM logs ORDER BY date DESC')
  res.json(rows)
})

app.delete('/api/inventory/logs/:id', authRequired, async (req, res) => {
  await pool.query('DELETE FROM logs WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

// ============ REQUISITIONS ============
app.get('/api/requisitions', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM requisitions ORDER BY createdAt DESC')
  res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items) })))
})

app.post('/api/requisitions', authRequired, async (req, res) => {
  try {
    const { name, dept, date, items } = req.body
    const id = crypto.randomUUID()
    const slipNo = 'RS-' + Date.now().toString().slice(-6)
    await pool.query(
      'INSERT INTO requisitions (id,slipNo,name,dept,date,createdAt,status,createdBy,items) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, slipNo, name, dept, date, new Date().toISOString(), 'Pending Head Office', req.session.user.username, JSON.stringify(items)]
    )
    const [rows] = await pool.query('SELECT * FROM requisitions WHERE id=?', [id])
    res.json({ ...rows[0], items })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-head', authRequired, async (req, res) => {
  try {
    await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Pending Supply Release', req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.post('/api/requisitions/:id/approve-supply', authRequired, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rows] = await conn.query('SELECT * FROM requisitions WHERE id=?', [req.params.id])
    if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Not found' }) }
    const slip = rows[0]
    const items = JSON.parse(slip.items)
    for (const it of items) {
      await conn.query('UPDATE inventory SET qty = qty - ? WHERE id=?', [it.qty, it.itemId])
      await conn.query('INSERT INTO logs (id,itemId,type,qty,reason,date) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), it.itemId, 'DEDUCT', it.qty, `Released: ${slip.name} (${slip.dept})`, new Date().toISOString()])
    }
    await conn.query('UPDATE requisitions SET status=? WHERE id=?', ['Approved', req.params.id])
    await conn.commit()
    res.json({ ok: true })
  } catch (e) {
    await conn.rollback()
    res.status(500).json({ message: e.message })
  } finally { conn.release() }
})

app.post('/api/requisitions/:id/disapprove', authRequired, async (req, res) => {
  await pool.query('UPDATE requisitions SET status=? WHERE id=?', ['Disapproved', req.params.id])
  res.json({ ok: true })
})

// ============ TRAIL ============
app.get('/api/trail', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trail ORDER BY date DESC')
  res.json(rows)
})

app.post('/api/trail', authRequired, async (req, res) => {
  try {
    const { user, action, details } = req.body
    await pool.query('INSERT INTO trail (id,user,action,details,date) VALUES (?,?,?,?,?)',
      [crypto.randomUUID(), user, action, details, new Date().toISOString()])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ message: e.message }) }
})

app.delete('/api/trail', authRequired, async (req, res) => {
  await pool.query('DELETE FROM trail')
  res.json({ ok: true })
})

// ============ SERVE FRONTEND ============
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3000
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on :${PORT}`))
}).catch(err => {
  console.error('❌ DB init failed:', err)
  process.exit(1)
})