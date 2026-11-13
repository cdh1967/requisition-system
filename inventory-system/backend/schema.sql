CREATE DATABASE IF NOT EXISTS cdh_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cdh_inventory;

-- USERS
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  emp_id VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  department VARCHAR(100),
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,   -- bcrypt hash
  role ENUM('Superadmin','Administrator','Head Office','Supply Release','Staff') NOT NULL DEFAULT 'Staff',
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INVENTORY
CREATE TABLE inventory (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category ENUM('Medical Supplies','Office Supplies','Janitorial Supplies') NOT NULL,
  qty INT NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- INVENTORY LOGS (Stockcard)
CREATE TABLE inventory_logs (
  id VARCHAR(50) PRIMARY KEY,
  item_id VARCHAR(50) NOT NULL,
  item_name VARCHAR(200) NOT NULL,
  type ENUM('RESTOCK','DEDUCT','RETURN') NOT NULL,
  qty INT NOT NULL,
  unit VARCHAR(30),
  reason VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- REQUISITIONS (header)
CREATE TABLE requisitions (
  id VARCHAR(50) PRIMARY KEY,
  slip_no VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  dept VARCHAR(100),
  date DATETIME NOT NULL,
  status ENUM('Pending Head Office','Pending Supply Release','Approved','Disapproved') NOT NULL DEFAULT 'Pending Head Office',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REQUISITION ITEMS (lines)
CREATE TABLE requisition_items (
  id VARCHAR(50) PRIMARY KEY,
  requisition_id VARCHAR(50) NOT NULL,
  item_id VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit VARCHAR(30),
  qty INT NOT NULL,
  priority VARCHAR(30) DEFAULT 'ROUTINE',
  remarks VARCHAR(500),
  FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
);

-- PASSWORD RESET REQUESTS
CREATE TABLE password_resets (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  name VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT TRAIL
CREATE TABLE trail_logs (
  id VARCHAR(50) PRIMARY KEY,
  user VARCHAR(100) DEFAULT 'System',
  action VARCHAR(100) NOT NULL,
  details VARCHAR(1000),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);