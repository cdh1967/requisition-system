const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function para mo-initialize sa tables kung wala pa
async function initDB() {
  try {
    const conn = await pool.getConnection();
    
    // Users Table
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY, empId VARCHAR(20), name VARCHAR(100), email VARCHAR(100), 
      department VARCHAR(100), username VARCHAR(50) UNIQUE, password VARCHAR(100), role VARCHAR(50), status VARCHAR(20)
    )`);

    // Inventory Table
    await conn.query(`CREATE TABLE IF NOT EXISTS inventory (
      id VARCHAR(50) PRIMARY KEY, name VARCHAR(200), category VARCHAR(50), qty INT, unit VARCHAR(20)
    )`);

    // Requisitions Table
    await conn.query(`CREATE TABLE IF NOT EXISTS requisitions (
      id VARCHAR(50) PRIMARY KEY, slipNo VARCHAR(50), name VARCHAR(100), dept VARCHAR(100), 
      date DATETIME, createdAt DATETIME, status VARCHAR(50), createdBy VARCHAR(50)
    )`);

    // Requisition Items Table
    await conn.query(`CREATE TABLE IF NOT EXISTS requisition_items (
      id VARCHAR(50) PRIMARY KEY, requisitionId VARCHAR(50), itemId VARCHAR(50), 
      name VARCHAR(200), unit VARCHAR(20), qty INT, priority VARCHAR(20), remarks TEXT
    )`);

    // Logs (Stockcard)
    await conn.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(50) PRIMARY KEY, itemId VARCHAR(50), itemName VARCHAR(200), type VARCHAR(20), 
      qty INT, unit VARCHAR(20), reason TEXT, date DATETIME
    )`);

    // Trail Logs (Audit)
    await conn.query(`CREATE TABLE IF NOT EXISTS trail_logs (
      id VARCHAR(50) PRIMARY KEY, user VARCHAR(50), action VARCHAR(50), details TEXT, date DATETIME
    )`);

    // Seed default users kung wala pa
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      await conn.query(`INSERT INTO users (id, empId, name, username, password, role, status) VALUES 
        ('1', '0000', 'Super Administrator', 'superadmin', 'super123', 'Superadmin', 'Active'),
        ('2', '0001', 'System Administrator', 'admin', 'admin123', 'Administrator', 'Active'),
        ('3', '0002', 'Head Office Manager', 'headoffice', 'head123', 'Head Office', 'Active'),
        ('4', '0003', 'Supply Release Staff', 'supply', 'supply123', 'Supply Release', 'Active')
      `);
    }
    
    conn.release();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
}

initDB().catch(err => {
  console.error('Unhandled initDB error:', err);
});