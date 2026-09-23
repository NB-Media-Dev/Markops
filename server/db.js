const mysqlModule = require('mysql2/promise');

let dbPool = null;
try {
  const dbUrl = process.env.DATABASE_URL || 'mysql://root:Ratheesh@17@localhost:3303/markops';
  dbPool = mysqlModule.createPool(dbUrl);
  console.log('[MySQL DB] Database connection pool created with:', dbUrl.split('@')[1] || dbUrl);
} catch (err) {
  console.log('MySQL pool init notice (using memory store fallback):', err?.message || err);
}

const ROLE_MAP = {
  ADMINISTRATOR: { id: 'role_admin', name: 'Administrator', code: 'ADMINISTRATOR' },
  MARKETING_MANAGER: { id: 'role_mktg', name: 'Marketing Manager', code: 'MARKETING_MANAGER' },
  DIGITAL_MARKETING: { id: 'role_digital', name: 'Digital Marketing', code: 'DIGITAL_MARKETING' },
  DESIGNER: { id: 'role_designer', name: 'Designer', code: 'DESIGNER' },
  TELECALLER: { id: 'role_telecaller', name: 'Telecaller', code: 'TELECALLER' },
};

async function initDatabase() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      INSERT IGNORE INTO roles (id, name, code, description) VALUES
      ('role_admin', 'Administrator', 'ADMINISTRATOR', 'Full System Access'),
      ('role_mktg', 'Marketing Manager', 'MARKETING_MANAGER', 'Campaign Operations'),
      ('role_digital', 'Digital Marketing', 'DIGITAL_MARKETING', 'Ad Operations'),
      ('role_designer', 'Designer', 'DESIGNER', 'Asset Design'),
      ('role_telecaller', 'Telecaller', 'TELECALLER', 'Lead Telecalling')
    `);
    await dbPool.query(`
      INSERT IGNORE INTO users (id, email, password_hash, full_name, role_id, department, is_active) VALUES
      ('usr_admin_01', 'admin@markops.io', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G', 'System Administrator', 'role_admin', 'Executive Operations', 1)
    `);
    console.log('[MySQL DB] Roles and primary administrator initialized in MySQL.');
  } catch (err) {
    console.error('[MySQL DB Init Error]:', err?.message || err);
  }
}

// Persistent JSON File Storage Fallback for Tasks
const fs = require('fs');
const path = require('path');

const TASKS_FILE_PATH = path.resolve(process.cwd(), 'server', 'data_tasks.json');

function loadTasksFromFile() {
  try {
    if (fs.existsSync(TASKS_FILE_PATH)) {
      const data = fs.readFileSync(TASKS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[JSON DB Store] Error loading tasks file:', err?.message || err);
  }
  return [];
}

function saveTasksToFile(tasks) {
  try {
    fs.writeFileSync(TASKS_FILE_PATH, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('[JSON DB Store] Error saving tasks file:', err?.message || err);
  }
}

// In-Memory Fallback Stores with JSON File Persistence
const dbUsersStore = [
  {
    id: 'usr_admin_01',
    email: 'admin@markops.io',
    fullName: 'System Administrator',
    role: 'ADMINISTRATOR',
    department: 'Executive Operations',
    isActive: true,
    lastLoginAt: 'Just now',
    createdAt: '2026-01-10',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G',
    rawPassword: 'admin123',
  },
  {
    id: 'usr_telecaller_01',
    email: 'ananya@markops.io',
    fullName: 'Ananya Sharma',
    role: 'TELECALLER',
    department: 'Telecalling Operations',
    isActive: true,
    lastLoginAt: 'Active now',
    createdAt: '2026-01-15',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G',
    rawPassword: 'telecaller123',
  },
  {
    id: 'usr_telecaller_02',
    email: 'rohan@markops.io',
    fullName: 'Rohan Verma',
    role: 'TELECALLER',
    department: 'Telecalling Operations',
    isActive: true,
    lastLoginAt: '2 hours ago',
    createdAt: '2026-01-15',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G',
    rawPassword: 'telecaller123',
  },
  {
    id: 'usr_telecaller_03',
    email: 'priya@markops.io',
    fullName: 'Priya Gupta',
    role: 'TELECALLER',
    department: 'Telecalling Operations',
    isActive: true,
    lastLoginAt: 'Yesterday',
    createdAt: '2026-01-16',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G',
    rawPassword: 'telecaller123',
  },
];

const dbTasksStore = loadTasksFromFile();
const dbCampaignsStore = [];
const dbAdsStore = [];
const dbLeadsStore = [];
const dbCallActivitiesStore = [];
const dbFollowUpsStore = [];
const dbTransactionsStore = [];
const dbNotificationsStore = [];

module.exports = {
  dbPool,
  ROLE_MAP,
  initDatabase,
  dbUsersStore,
  dbTasksStore,
  saveTasksToFile,
  dbCampaignsStore,
  dbAdsStore,
  dbLeadsStore,
  dbCallActivitiesStore,
  dbFollowUpsStore,
  dbTransactionsStore,
  dbNotificationsStore,
};

