const express = require('express');
const cors = require('cors');
const db = require('./db');
const { v4: uuidv4 } = require('uuid'); // npm install uuid

const app = express();
app.use(cors());
app.use(express.json());

// --- AUTH & USERS ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query(`SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ?`, [username, password]);
    if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    
    const user = users[0];
    if (user.status === 'Inactive') return res.status(403).json({ message: 'Account deactivated' });
    
    await db.query(`INSERT INTO trail_logs (id, user, action, details, date) VALUES (?, ?, ?, ?, NOW())`, 
      [uuidv4(), user.username, 'LOGIN_SUCCESS', `User ${user.username} logged in`]);
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  const [users] = await db.query(`SELECT * FROM users`);
  res.json(users);
});

// --- INVENTORY ---
app.get('/api/inventory', async (req, res) => {
  const [items] = await db.query(`SELECT * FROM inventory`);
  res.json(items);
});

app.post('/api/inventory', async (req, res) => {
  const { name, category, qty, unit } = req.body;
  const id = uuidv4();
  await db.query(`INSERT INTO inventory (id, name, category, qty, unit) VALUES (?, ?, ?, ?, ?)`, [id, name, category, qty, unit]);
  res.json({ success: true, id });
});

app.put('/api/inventory/:id', async (req, res) => {
  const { name, category, qty, unit } = req.body;
  await db.query(`UPDATE inventory SET name=?, category=?, qty=?, unit=? WHERE id=?`, [name, category, qty, unit, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/inventory/:id', async (req, res) => {
  await db.query(`DELETE FROM inventory WHERE id=?`, [req.params.id]);
  res.json({ success: true });
});

// --- REQUISITIONS ---
app.get('/api/requisitions', async (req, res) => {
  try {
    const [reqs] = await db.query(`SELECT * FROM requisitions ORDER BY createdAt DESC`);
    const [items] = await db.query(`SELECT * FROM requisition_items`);
    
    const result = reqs.map(r => ({
      ...r,
      items: items.filter(i => i.requisitionId === r.id)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requisitions', async (req, res) => {
  const { name, dept, date, items, createdBy } = req.body;
  const reqId = uuidv4();
  
  // Generate Slip No (YYMMDD-XX)
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `${yy}${mm}${dd}`;
  
  try {
    const [existing] = await db.query(`SELECT COUNT(*) as count FROM requisitions WHERE slipNo LIKE ?`, [`${prefix}-%`]);
    const nextSeq = String(existing[0].count + 1).padStart(2, '0');
    const slipNo = `${prefix}-${nextSeq}`;
    
    await db.query(`INSERT INTO requisitions (id, slipNo, name, dept, date, createdAt, status, createdBy) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [reqId, slipNo, name, dept, date, 'Pending Head Office', createdBy]);
      
    for (const i of items) {
      await db.query(`INSERT INTO requisition_items (id, requisitionId, itemId, name, unit, qty, priority, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), reqId, i.itemId, i.name, i.unit, i.qty, i.priority, i.remarks]);
    }
    
    res.json({ ok: true, slipNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requisitions/:id/approve', async (req, res) => {
  const { role } = req.body; 
  const id = req.params.id;
  
  try {
    const [reqs] = await db.query(`SELECT * FROM requisitions WHERE id = ?`, [id]);
    if (reqs.length === 0) return res.status(404).json({ error: 'Not found' });
    const reqData = reqs[0];

    if (role === 'Head Office') {
      await db.query(`UPDATE requisitions SET status='Pending Supply Release' WHERE id=?`, [id]);
      return res.json({ ok: true });
    } 
    
    if (role === 'Supply Release') {
      const [items] = await db.query(`SELECT * FROM requisition_items WHERE requisitionId=?`, [id]);
      
      for (const i of items) {
        await db.query(`UPDATE inventory SET qty = qty - ? WHERE id = ?`, [i.qty, i.itemId]);
        await db.query(`INSERT INTO logs (id, itemId, itemName, type, qty, unit, reason, date) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), i.itemId, i.name, 'DEDUCT', i.qty, i.unit, `Released: ${reqData.name}`]);
      }
      await db.query(`UPDATE requisitions SET status='Approved' WHERE id=?`, [id]);
      res.json({ ok: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend API running on port ${PORT}`));