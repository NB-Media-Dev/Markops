const express = require('express');
const { dbPool, dbCampaignsStore, dbAdsStore } = require('../db');
const { recordAuditLog } = require('../services/audit.service');
const { emitRealtimeEvent } = require('../events');

const router = express.Router();

router.get('/campaigns', (req, res) => {
  return res.json(dbCampaignsStore);
});

router.post('/campaigns', async (req, res) => {
  const { name, objective, status, startDate, endDate, budget, targetLeads, targetCpl, targetQualifiedPct, targetConversionPct, ownerId, ownerName, ownerEmail } = req.body;
  if (!name || !objective) {
    return res.status(400).json({ error: 'Campaign Name and Objective are required.' });
  }
  const id = `cmp_${Math.random().toString(36).substring(2, 10)}`;
  const effectiveOwnerId = ownerId || req.headers['x-user-id'] || 'usr_admin_01';
  const effectiveOwnerName = ownerName || req.headers['x-user-name'] || 'System Administrator';

  const newCmp = {
    id,
    name: String(name).trim(),
    objective: String(objective),
    status: status || 'PLANNING',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || null,
    budget: Number(budget) || 10000,
    targetLeads: Number(targetLeads) || 200,
    targetCpl: Number(targetCpl) || 50,
    targetQualifiedPct: Number(targetQualifiedPct) || 60,
    targetConversionPct: Number(targetConversionPct) || 15,
    leadsCount: 0,
    spend: 0,
    cpl: 0,
    qualifiedLeads: 0,
    conversions: 0,
    revenue: 0,
    ownerId: effectiveOwnerId,
    ownerName: effectiveOwnerName,
    createdAt: new Date().toISOString().split('T')[0],
  };
  dbCampaignsStore.unshift(newCmp);
  await recordAuditLog(dbPool, {
    actorId: effectiveOwnerId,
    actorEmail: ownerEmail || 'admin@markops.io',
    action: 'CAMPAIGN_CREATED',
    entityType: 'Campaign',
    entityId: id,
    newState: { name: newCmp.name, budget: newCmp.budget },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return res.status(201).json(newCmp);
});

router.get('/ads', (req, res) => {
  return res.json(dbAdsStore);
});

router.post('/ads/sync', async (req, res) => {
  const syncTimestamp = new Date().toISOString();
  dbAdsStore.forEach((ad) => {
    ad.lastSyncedAt = syncTimestamp;
    ad.impressions += Math.floor(Math.random() * 500) + 100;
    ad.clicks += Math.floor(Math.random() * 20) + 5;
  });
  await recordAuditLog(dbPool, {
    actorId: 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'DIGITAL_ADS_SYNCED',
    entityType: 'AdAccount',
    entityId: 'act_20268841',
    newState: { recordsProcessed: dbAdsStore.length, status: 'SUCCESS' },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  emitRealtimeEvent('ads:sync_completed', { syncedCount: dbAdsStore.length, timestamp: syncTimestamp });
  return res.json({ message: 'Digital Ad accounts successfully synchronized.', syncedCount: dbAdsStore.length, timestamp: syncTimestamp });
});

module.exports = router;
