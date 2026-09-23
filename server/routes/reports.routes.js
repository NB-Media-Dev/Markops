const express = require('express');
const {
  dbPool,
  dbTransactionsStore,
  dbLeadsStore,
  dbAdsStore,
  dbCallActivitiesStore,
  dbNotificationsStore,
} = require('../db');
const { recordAuditLog, getAuditLogs } = require('../services/audit.service');

const router = express.Router();

router.get('/reports/summary', (req, res) => {
  const totalRevenue = dbTransactionsStore.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalLeads = dbLeadsStore.length;
  const totalSpend = dbAdsStore.reduce((sum, a) => sum + Number(a.spend || 0), 0);
  const avgCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';
  const overallRoi = totalSpend > 0 ? (((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(1) : '0.0';
  const qualifiedCount = dbLeadsStore.filter((l) => l.status === 'QUALIFIED').length;
  const qualificationRate = totalLeads > 0 ? ((qualifiedCount / totalLeads) * 100).toFixed(1) : '0.0';

  return res.json({
    totalRevenue,
    totalLeads,
    totalSpend,
    avgCpl,
    overallRoi: `${overallRoi}%`,
    qualificationRate: `${qualificationRate}%`,
  });
});

router.get('/performance/metrics', (req, res) => {
  return res.json({
    designerRatios: {
      averageCompletionHours: 0,
      approvalRatePct: 0,
      totalRevisions: 0,
      onTimeDeliveryPct: 0,
    },
    telecallingRatios: {
      connectRatePct: 0,
      qualificationRatePct: 0,
      avgCallDurationSeconds: 0,
      totalCallsToday: dbCallActivitiesStore.length,
    },
    marketingRatios: {
      targetLeadsAchievementPct: 0,
      cplVariancePct: 0,
      campaignRoiPct: 0,
    },
  });
});

router.get('/exports/:type', async (req, res) => {
  const { type } = req.params;
  const filename = `MarkOps_${type.toUpperCase()}_Export_${new Date().toISOString().split('T')[0]}.csv`;

  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: `EXPORT_DOWNLOADED_${type.toUpperCase()}`,
    entityType: 'Export',
    entityId: type,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`ID,Name,Type,Status,Date\n1,Sample Record,${type},Active,2026-09-11`);
});

router.get('/notifications', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  let list = [...dbNotificationsStore];
  if (userId) {
    list = list.filter((n) => !n.userId || n.userId === userId);
  }
  return res.json(list);
});

router.patch('/notifications/:id/read', async (req, res) => {
  const notifId = req.params.id;
  const notif = dbNotificationsStore.find((n) => n.id === notifId);
  if (notif) {
    notif.isRead = true;
  }

  if (dbPool) {
    try {
      await dbPool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
    } catch (e) {
      console.error('[MySQL DB Error] UPDATE notification read state failed:', e?.message || e);
    }
  }

  return res.json({ success: true, id: notifId, isRead: true });
});

router.patch('/notifications/read-all', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  dbNotificationsStore.forEach((n) => {
    if (!userId || !n.userId || n.userId === userId) {
      n.isRead = true;
    }
  });

  if (dbPool && userId) {
    try {
      await dbPool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    } catch (e) {
      console.error('[MySQL DB Error] UPDATE read-all notifications failed:', e?.message || e);
    }
  }

  return res.json({ success: true, message: 'All notifications marked as read.' });
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs(dbPool);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

module.exports = router;
