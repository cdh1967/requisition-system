// backend/seed.js
import bcrypt from 'bcryptjs'
import { pool, generateId } from './db.js'

const seedUsers = [
  { username: 'superadmin', pass: 'super123',  role: 'Superadmin',    name: 'Super Administrator',     emp: '0000', dept: 'Administration' },
  { username: 'admin',      pass: 'admin123',  role: 'Administrator', name: 'System Administrator',    emp: '0001', dept: 'Administration' },
  { username: 'headoffice', pass: 'head123',   role: 'Head Office',   name: 'Head Office Manager',     emp: '0002', dept: 'Head Office' },
  { username: 'supply',     pass: 'supply123', role: 'Supply Release',name: 'Supply Release Staff',    emp: '0003', dept: 'Supply' }
]

async function seed() {
  for (const u of seedUsers) {
    const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [u.username])
    if (exists.length) {
      console.log(`⏭️  Skip ${u.username} (already exists)`)
      continue
    }
    const hash = await bcrypt.hash(u.pass, 10)
    await pool.query(
      `INSERT INTO users (id, emp_id, name, email, department, username, password, role, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [generateId(), u.emp, u.name, `${u.username}@cdh.local`, u.dept, u.username, hash, u.role, 'Active']
    )
    console.log(`✅ Created ${u.username} (password: ${u.pass})`)
  }
  console.log('\n🎉 Seed complete!')
  process.exit(0)
}

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1) })