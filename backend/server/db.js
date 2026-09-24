const mysqlModule = require('mysql2/promise');

let activePool = null;

const dbPool = {
  query: async (...args) => {
    if (!activePool) return [[]];
    try {
      const res = await Promise.race([
        activePool.query(...args),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 1500)),
      ]);
      return res;
    } catch (e) {
      console.log('[MySQL Pool Query Notice]:', e?.message || e);
      return [[]];
    }
  },
  getConnection: async (...args) => {
    if (!activePool) throw new Error('Database pool not connected');
    return activePool.getConnection(...args);
  },
};

const ROLE_MAP = {
  ADMINISTRATOR: { id: 1, name: 'Administrator', code: 'ADMINISTRATOR' },
  MARKETING_MANAGER: { id: 2, name: 'Marketing Manager', code: 'MARKETING_MANAGER' },
  DIGITAL_MARKETING: { id: 3, name: 'Digital Marketing', code: 'DIGITAL_MARKETING' },
  DESIGNER: { id: 4, name: 'Designer', code: 'DESIGNER' },
  TELECALLER: { id: 5, name: 'Telecaller', code: 'TELECALLER' },
  BDM: { id: 6, name: 'Business Development Manager', code: 'BDM' },
};

async function initDatabase() {
  try {
    let pool = null;
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      pool = mysqlModule.createPool({ uri: dbUrl, connectTimeout: 1200, waitForConnections: true, connectionLimit: 5 });
    } else {
      pool = mysqlModule.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3303,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'Ratheesh@17',
        database: process.env.DB_NAME || 'markops',
        connectTimeout: 1200,
        waitForConnections: true,
        connectionLimit: 5,
      });
    }

    const conn = await Promise.race([
      pool.getConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 1200)),
    ]);
    conn.release();
    activePool = pool;

    await activePool.query(`
      INSERT IGNORE INTO roles (id, name, code, description) VALUES
      (1, 'Administrator', 'ADMINISTRATOR', 'Full System Access'),
      (2, 'Marketing Manager', 'MARKETING_MANAGER', 'Campaign Operations'),
      (3, 'Digital Marketing', 'DIGITAL_MARKETING', 'Ad Operations'),
      (4, 'Designer', 'DESIGNER', 'Asset Design'),
      (5, 'Telecaller', 'TELECALLER', 'Lead Telecalling'),
      (6, 'Business Development Manager', 'BDM', 'Package Task Management & Designer Collaboration')
    `);
    await activePool.query(`
      INSERT IGNORE INTO users (id, email, password_hash, full_name, role_id, department, is_active) VALUES
      (1, 'admin@markops.io', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G', 'System Administrator', 1, 'Executive Operations', 1),
      (2, 'bdm@markops.io', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G', 'Business Development Manager', 6, 'Business Development', 1)
    `);
    console.log('[MySQL DB] Roles and primary administrator initialized in MySQL.');
  } catch (err) {
    console.log('[MySQL DB Notice] MySQL unreachable, operating in high-performance memory store mode:', err?.message || err);
    activePool = null;
  }
}

// Persistent JSON File Storage Fallback for Tasks
const fs = require('fs');
const path = require('path');

const TASKS_FILE_PATH = path.resolve(__dirname, 'data_tasks.json');

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
    id: 'usr_bdm_01',
    email: 'bdm@markops.io',
    fullName: 'Business Development Manager',
    role: 'BDM',
    department: 'Business Development',
    isActive: true,
    lastLoginAt: 'Just now',
    createdAt: '2026-01-10',
    passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G',
    rawPassword: 'admin123',
  },
];

const dbTasksStore = loadTasksFromFile();
const dbCampaignsStore = [
  {
    id: 'cmp_careermate_q1',
    name: 'Careermate Tech Placement Drive 2026',
    objective: 'LEAD_GENERATION',
    status: 'ACTIVE',
    startDate: '2026-02-01',
    endDate: '2026-04-30',
    budget: 85000,
    targetLeads: 800,
    targetCpl: 45,
    targetQualifiedPct: 65,
    targetConversionPct: 18,
    spend: 42500,
    leadsCount: 940,
    cpl: 45.2,
    qualifiedLeads: 610,
    conversions: 142,
    convRate: 15.1,
    revenue: 426000,
    ownerId: 'usr_admin_01',
    ownerName: 'Digital Marketing Team',
    createdAt: '2026-02-01',
  },
  {
    id: 'cmp_classmate_launch',
    name: 'Classmate EdTech Admission Drive 2026',
    objective: 'LEAD_GENERATION',
    status: 'ACTIVE',
    startDate: '2026-02-15',
    endDate: '2026-05-15',
    budget: 120000,
    targetLeads: 600,
    targetCpl: 80,
    targetQualifiedPct: 70,
    targetConversionPct: 20,
    spend: 68400,
    leadsCount: 780,
    cpl: 87.7,
    qualifiedLeads: 540,
    conversions: 115,
    convRate: 14.7,
    revenue: 575000,
    ownerId: 'usr_admin_01',
    ownerName: 'Digital Marketing Team',
    createdAt: '2026-02-15',
  },
  {
    id: 'cmp_jesus_outreach',
    name: 'Jesus the messanger Global Outreach 2026',
    objective: 'BRAND_AWARENESS',
    status: 'ACTIVE',
    startDate: '2026-03-01',
    endDate: '2026-06-01',
    budget: 50000,
    targetLeads: 400,
    targetCpl: 55,
    targetQualifiedPct: 60,
    targetConversionPct: 15,
    spend: 12500,
    leadsCount: 220,
    cpl: 56.8,
    qualifiedLeads: 135,
    conversions: 28,
    convRate: 12.7,
    revenue: 140000,
    ownerId: 'usr_admin_01',
    ownerName: 'Digital Marketing Team',
    createdAt: '2026-03-01',
  },
  {
    id: 'cmp_careermate_retarget',
    name: 'Careermate Q1 Retargeting Funnel',
    objective: 'PERFORMANCE_SCALE',
    status: 'COMPLETED',
    startDate: '2026-01-05',
    endDate: '2026-02-28',
    budget: 60000,
    targetLeads: 500,
    targetCpl: 50,
    targetQualifiedPct: 75,
    targetConversionPct: 22,
    spend: 58900,
    leadsCount: 1120,
    cpl: 52.6,
    qualifiedLeads: 840,
    conversions: 235,
    convRate: 21.0,
    revenue: 705000,
    ownerId: 'usr_admin_01',
    ownerName: 'Digital Marketing Team',
    createdAt: '2026-01-05',
  }
];

const dbAdsStore = [
  {
    id: 'ad_meta_careermate_01',
    name: 'Careermate High Package Stories Carousel',
    campaignId: 'cmp_careermate_q1',
    campaignName: 'Careermate Tech Placement Drive 2026',
    platform: 'Meta',
    status: 'ACTIVE',
    spend: 18500,
    impressions: 142000,
    reach: 98000,
    clicks: 4620,
    ctr: 3.25,
    cpc: 4.0,
    leadsCount: 420,
    cpl: 44.05,
    platformAdId: 'meta_ad_984210',
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'ad_google_careermate_search',
    name: 'Careermate Google Search - Direct Hire IT Jobs',
    campaignId: 'cmp_careermate_q1',
    campaignName: 'Careermate Tech Placement Drive 2026',
    platform: 'Google Ads',
    status: 'ACTIVE',
    spend: 24000,
    impressions: 89000,
    reach: 65000,
    clicks: 5280,
    ctr: 5.93,
    cpc: 4.55,
    leadsCount: 520,
    cpl: 46.15,
    platformAdId: 'g_ad_551920',
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'ad_linkedin_classmate_exec',
    name: 'Classmate LinkedIn Sponsored - Higher Ed Guide',
    campaignId: 'cmp_classmate_launch',
    campaignName: 'Classmate EdTech Admission Drive 2026',
    platform: 'LinkedIn',
    status: 'ACTIVE',
    spend: 42000,
    impressions: 64000,
    reach: 48000,
    clicks: 1840,
    ctr: 2.88,
    cpc: 22.8,
    leadsCount: 460,
    cpl: 91.3,
    platformAdId: 'li_ad_774120',
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: 'ad_insta_jesus_video',
    name: 'Jesus the messanger Instagram Outreach Video',
    campaignId: 'cmp_jesus_outreach',
    campaignName: 'Jesus the messanger Global Outreach 2026',
    platform: 'Instagram',
    status: 'ACTIVE',
    spend: 12500,
    impressions: 78000,
    reach: 54000,
    clicks: 2150,
    ctr: 2.76,
    cpc: 5.81,
    leadsCount: 220,
    cpl: 56.82,
    platformAdId: 'ig_ad_332190',
    lastSyncedAt: new Date().toISOString(),
  }
];
const dbLeadsStore = [];
const dbCallActivitiesStore = [];
const dbFollowUpsStore = [];
const dbTransactionsStore = [];
const dbNotificationsStore = [];
const dbCommonTargetStore = {
  dailyCallsTarget: 30,
  dailyInterestedTarget: 5,
  dailyDurationTargetSeconds: 3600,
  updatedBy: 'Marketing Manager',
  updatedAt: new Date().toISOString(),
};
const dbTelecallerTargetsStore = [];

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
  dbCommonTargetStore,
  dbTelecallerTargetsStore,
};


