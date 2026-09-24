const express = require('express');
const bcrypt = require('bcryptjs');
const { dbPool, dbUsersStore, ROLE_MAP } = require('../db');
const { recordAuditLog } = require('../services/audit.service');

const router = express.Router();

// GET /api/users - List all users from MySQL Workbench database or fallback memory store
router.get('/users', async (req, res) => {
  if (dbPool) {
    try {
      const [rows] = await dbPool.query(`
        SELECT u.id, u.email, u.full_name as fullName, COALESCE(r.code, 'ADMINISTRATOR') as role, u.department, u.is_active as isActive, u.last_login_at as lastLoginAt, u.created_at as createdAt
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        ORDER BY u.created_at DESC
      `);
      if (Array.isArray(rows) && rows.length > 0) {
        const formatted = rows.map((r) => ({
          id: r.id,
          email: r.email,
          fullName: r.fullName,
          role: r.role,
          department: r.department || 'General Operations',
          isActive: Boolean(r.isActive),
          lastLoginAt: r.lastLoginAt ? String(r.lastLoginAt) : 'Never',
          createdAt: r.createdAt ? String(r.createdAt).split('T')[0] : '2026-01-10',
        }));
        return res.json(formatted);
      }
    } catch (e) {
      console.log('MySQL query notice (using fallback memory store):', e?.message || e);
    }
  }

  if (!dbUsersStore.some((u) => u.id === 'usr_admin_01' || u.email === 'admin@markops.io')) {
    dbUsersStore.unshift({
      id: 'usr_admin_01',
      email: 'admin@markops.io',
      fullName: 'System Administrator',
      role: 'ADMINISTRATOR',
      department: 'Executive Operations',
      isActive: true,
      lastLoginAt: 'Just now',
      createdAt: '2026-01-10',
    });
  }
  return res.json(dbUsersStore);
});

// POST /api/users - Admin user creation flow
router.post('/users', async (req, res) => {
  const { email, fullName, role, department, isActive, password } = req.body;
  if (!email || !fullName || !role) {
    return res.status(400).json({ error: 'Email, Full Name, and Role are required fields.' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const userId = `usr_${Math.random().toString(36).substring(2, 11)}`;
  const userDept = String(department || 'General Operations').trim();
  const userActive = isActive !== undefined ? Boolean(isActive) : true;
  const targetRoleId = ROLE_MAP[String(role)]?.id || 'role_admin';

  const rawPassword = password && String(password).length >= 1 ? String(password) : 'admin123';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const newUser = {
    id: userId,
    email: normalizedEmail,
    fullName: String(fullName).trim(),
    role: String(role),
    department: userDept,
    isActive: userActive,
    lastLoginAt: 'Never',
    createdAt: new Date().toISOString().split('T')[0],
    passwordHash: hashedPassword,
    rawPassword: rawPassword,
  };

  dbUsersStore.unshift(newUser);

  if (dbPool) {
    try {
      const [insertRes] = await dbPool.query(
        `INSERT INTO users (email, password_hash, full_name, role_id, department, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), department = VALUES(department), is_active = VALUES(is_active)`,
        [normalizedEmail, hashedPassword, newUser.fullName, targetRoleId, userDept, userActive ? 1 : 0]
      );
      const insertedUserId = insertRes?.insertId || 1;
      console.log(`[MySQL DB] Successfully inserted user ${normalizedEmail} (ID: ${insertedUserId}) into table 'users'.`);

      await dbPool.query(
        `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, NOW())`,
        [
          insertedUserId,
          'Welcome to MarkOps Platform',
          `Your ${newUser.role} user account has been successfully provisioned.`,
          'SUCCESS',
        ]
      );
    } catch (e) {
      console.error('[MySQL DB Error] INSERT user query failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: userId,
    newState: { email: normalizedEmail, fullName: newUser.fullName, role: newUser.role, department: userDept, isActive: userActive },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.status(201).json(newUser);
});

// DELETE /api/users/:id - Delete user with Audit Event
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;

  if (userId === 'usr_admin_01' || userId === '1') {
    return res.status(403).json({ error: 'System Administrator account (usr_admin_01) cannot be deleted.' });
  }

  const index = dbUsersStore.findIndex((u) => String(u.id) === String(userId));
  const deletedUser = index !== -1 ? dbUsersStore.splice(index, 1)[0] : { id: userId };

  if (dbPool) {
    try {
      await dbPool.query('DELETE FROM users WHERE id = ?', [userId]);
      console.log(`[MySQL DB] Successfully deleted user ${userId} from table 'users'.`);
    } catch (e) {
      console.error('[MySQL DB Error] DELETE query failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: userId,
    previousState: deletedUser,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.json({ message: 'User successfully deleted from database.', user: deletedUser });
});

// PATCH /api/users/:id/status - Toggle user active status
router.patch('/users/:id/status', async (req, res) => {
  const userId = req.params.id;
  const user = dbUsersStore.find((u) => String(u.id) === String(userId));

  let newActiveState = true;
  let previousActiveState = false;
  if (user) {
    previousActiveState = user.isActive;
    user.isActive = !user.isActive;
    newActiveState = user.isActive;
  }

  if (dbPool) {
    try {
      if (!user) {
        const [rows] = await dbPool.query('SELECT is_active FROM users WHERE id = ?', [userId]);
        if (Array.isArray(rows) && rows.length > 0) {
          previousActiveState = Boolean(rows[0].is_active);
          newActiveState = !previousActiveState;
        }
      }
      await dbPool.query('UPDATE users SET is_active = ? WHERE id = ?', [newActiveState ? 1 : 0, userId]);
      console.log(`[MySQL DB] Updated user ${userId} status to ${newActiveState}.`);
    } catch (e) {
      console.error('[MySQL DB Error] UPDATE query failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'STATUS_CHANGED',
    entityType: 'User',
    entityId: userId,
    previousState: { isActive: previousActiveState },
    newState: { isActive: newActiveState },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.json({ id: userId, isActive: newActiveState });
});

// PUT /api/users/:id - Update user details & password
router.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { email, fullName, role, department, isActive, password } = req.body;

  const user = dbUsersStore.find((u) => String(u.id) === String(userId));
  const previousState = user ? { ...user } : null;

  if (user) {
    if (email) user.email = String(email).toLowerCase().trim();
    if (fullName) user.fullName = String(fullName).trim();
    if (role) user.role = String(role);
    if (department) user.department = String(department).trim();
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    if (password && String(password).length >= 1) {
      user.rawPassword = String(password);
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }
  }

  if (dbPool) {
    try {
      const targetRoleId = ROLE_MAP[String(role)]?.id || 'role_admin';
      let sql = 'UPDATE users SET full_name = ?, email = ?, role_id = ?, department = ?, is_active = ?';
      const params = [fullName, email, targetRoleId, department, isActive ? 1 : 0];

      if (password && password.length >= 6) {
        const hash = await bcrypt.hash(password, 10);
        sql += ', password_hash = ?';
        params.push(hash);
      }

      sql += ' WHERE id = ?';
      params.push(userId);

      await dbPool.query(sql, params);
      console.log(`[MySQL DB] Updated user ${userId} in database.`);
    } catch (e) {
      console.error('[MySQL DB Error] PUT update failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: password ? 'USER_UPDATED_AND_PASSWORD_CHANGED' : 'USER_UPDATED',
    entityType: 'User',
    entityId: userId,
    previousState,
    newState: { email, fullName, role, department, isActive },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.json({ id: userId, message: 'User updated successfully' });
});

module.exports = router;
