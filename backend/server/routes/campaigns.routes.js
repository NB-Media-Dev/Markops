const express = require('express');
const { dbPool, dbCampaignsStore, dbAdsStore } = require('../db');
const { recordAuditLog } = require('../services/audit.service');
const { emitRealtimeEvent } = require('../events');

const router = express.Router();

// ==========================================
// CAMPAIGNS CRUD
// ==========================================

// GET /api/campaigns
router.get('/campaigns', (req, res) => {
  return res.json(dbCampaignsStore);
});

// POST /api/campaigns - Create Campaign
router.post('/campaigns', async (req, res) => {
  const {
    name,
    objective,
    status,
    startDate,
    endDate,
    budget,
    targetLeads,
    targetCpl,
    targetQualifiedPct,
    targetConversionPct,
    spend,
    leadsCount,
    cpl,
    qualifiedLeads,
    conversions,
    convRate,
    revenue,
    ownerId,
    ownerName,
    ownerEmail,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Campaign Name is required.' });
  }

  const id = `cmp_${Math.random().toString(36).substring(2, 10)}`;
  const effectiveOwnerId = ownerId || req.headers['x-user-id'] || 'usr_admin_01';
  const effectiveOwnerName = ownerName || req.headers['x-user-name'] || 'Digital Marketer';

  const numericSpend = Number(spend) || 0;
  const numericLeads = Number(leadsCount) || 0;
  const computedCpl = cpl !== undefined && cpl !== null ? Number(cpl) : (numericLeads > 0 ? Number((numericSpend / numericLeads).toFixed(2)) : 0);
  const numericConversions = Number(conversions) || 0;
  const computedConvRate = convRate !== undefined && convRate !== null ? Number(convRate) : (numericLeads > 0 ? Number(((numericConversions / numericLeads) * 100).toFixed(1)) : 0);

  const newCmp = {
    id,
    name: String(name).trim(),
    objective: String(objective || 'LEAD_GENERATION'),
    status: status || 'ACTIVE',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || null,
    budget: Number(budget) || (numericSpend > 0 ? numericSpend * 1.5 : 50000),
    targetLeads: Number(targetLeads) || (numericLeads > 0 ? numericLeads * 1.2 : 300),
    targetCpl: Number(targetCpl) || 50,
    targetQualifiedPct: Number(targetQualifiedPct) || 60,
    targetConversionPct: Number(targetConversionPct) || 15,
    spend: numericSpend,
    leadsCount: numericLeads,
    cpl: computedCpl,
    qualifiedLeads: Number(qualifiedLeads) || 0,
    conversions: numericConversions,
    convRate: computedConvRate,
    revenue: Number(revenue) || numericConversions * 3000,
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
    newState: { name: newCmp.name, status: newCmp.status, budget: newCmp.budget },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('campaign:created', newCmp);
  return res.status(201).json(newCmp);
});

// PUT /api/campaigns/:id - Update Campaign
router.put('/campaigns/:id', async (req, res) => {
  const { id } = req.params;
  const index = dbCampaignsStore.findIndex((c) => String(c.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ error: `Campaign #${id} not found.` });
  }

  const existing = dbCampaignsStore[index];
  const {
    name,
    objective,
    status,
    startDate,
    endDate,
    budget,
    targetLeads,
    targetCpl,
    targetQualifiedPct,
    targetConversionPct,
    spend,
    leadsCount,
    cpl,
    qualifiedLeads,
    conversions,
    convRate,
    revenue,
  } = req.body;

  const numericSpend = spend !== undefined ? Number(spend) : existing.spend;
  const numericLeads = leadsCount !== undefined ? Number(leadsCount) : existing.leadsCount;
  const computedCpl = cpl !== undefined ? Number(cpl) : (numericLeads > 0 ? Number((numericSpend / numericLeads).toFixed(2)) : existing.cpl);
  const numericConversions = conversions !== undefined ? Number(conversions) : existing.conversions;
  const computedConvRate = convRate !== undefined ? Number(convRate) : (numericLeads > 0 ? Number(((numericConversions / numericLeads) * 100).toFixed(1)) : existing.convRate);

  const updatedCmp = {
    ...existing,
    name: name !== undefined ? String(name).trim() : existing.name,
    objective: objective !== undefined ? String(objective) : existing.objective,
    status: status !== undefined ? String(status) : existing.status,
    startDate: startDate !== undefined ? startDate : existing.startDate,
    endDate: endDate !== undefined ? endDate : existing.endDate,
    budget: budget !== undefined ? Number(budget) : existing.budget,
    targetLeads: targetLeads !== undefined ? Number(targetLeads) : existing.targetLeads,
    targetCpl: targetCpl !== undefined ? Number(targetCpl) : existing.targetCpl,
    targetQualifiedPct: targetQualifiedPct !== undefined ? Number(targetQualifiedPct) : existing.targetQualifiedPct,
    targetConversionPct: targetConversionPct !== undefined ? Number(targetConversionPct) : existing.targetConversionPct,
    spend: numericSpend,
    leadsCount: numericLeads,
    cpl: computedCpl,
    qualifiedLeads: qualifiedLeads !== undefined ? Number(qualifiedLeads) : existing.qualifiedLeads,
    conversions: numericConversions,
    convRate: computedConvRate,
    revenue: revenue !== undefined ? Number(revenue) : existing.revenue,
    updatedAt: new Date().toISOString(),
  };

  dbCampaignsStore[index] = updatedCmp;

  // Also update associated ads' campaignName if campaign name changed
  if (name && name !== existing.name) {
    dbAdsStore.forEach((ad) => {
      if (String(ad.campaignId) === String(id)) {
        ad.campaignName = updatedCmp.name;
      }
    });
  }

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: req.body.ownerEmail || 'admin@markops.io',
    action: 'CAMPAIGN_UPDATED',
    entityType: 'Campaign',
    entityId: id,
    newState: { name: updatedCmp.name, status: updatedCmp.status, spend: updatedCmp.spend },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('campaign:updated', updatedCmp);
  return res.json(updatedCmp);
});

// DELETE /api/campaigns/:id - Delete Campaign
router.delete('/campaigns/:id', async (req, res) => {
  const { id } = req.params;
  const index = dbCampaignsStore.findIndex((c) => String(c.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ error: `Campaign #${id} not found.` });
  }

  const [deleted] = dbCampaignsStore.splice(index, 1);

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'CAMPAIGN_DELETED',
    entityType: 'Campaign',
    entityId: id,
    newState: { deletedCampaignName: deleted.name },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('campaign:deleted', { id });
  return res.json({ success: true, message: `Campaign "${deleted.name}" deleted successfully.`, id });
});

// ==========================================
// ADS & AD METRICS CRUD
// ==========================================

// GET /api/ads
router.get('/ads', (req, res) => {
  return res.json(dbAdsStore);
});

// POST /api/ads - Create Ad / Metric
router.post('/ads', async (req, res) => {
  const {
    name,
    campaignId,
    campaignName,
    platform,
    status,
    spend,
    leadsCount,
    cpl,
    ctr,
    impressions,
    clicks,
    cpc,
    platformAdId,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Ad Name is required.' });
  }

  const id = `ad_${Math.random().toString(36).substring(2, 10)}`;
  const numericSpend = Number(spend) || 0;
  const numericLeads = Number(leadsCount) || 0;
  const computedCpl = cpl !== undefined && cpl !== null ? Number(cpl) : (numericLeads > 0 ? Number((numericSpend / numericLeads).toFixed(2)) : 0);
  const numericClicks = Number(clicks) || (numericLeads > 0 ? numericLeads * 8 : 100);
  const numericImpressions = Number(impressions) || (numericClicks > 0 ? numericClicks * 30 : 3000);
  const computedCtr = ctr !== undefined && ctr !== null ? Number(ctr) : (numericImpressions > 0 ? Number(((numericClicks / numericImpressions) * 100).toFixed(2)) : 2.5);
  const computedCpc = cpc !== undefined && cpc !== null ? Number(cpc) : (numericClicks > 0 ? Number((numericSpend / numericClicks).toFixed(2)) : 5.0);

  // Match campaign name if campaignId provided
  let matchedCampaignName = campaignName;
  if (campaignId && !matchedCampaignName) {
    const matched = dbCampaignsStore.find((c) => String(c.id) === String(campaignId));
    if (matched) matchedCampaignName = matched.name;
  }

  const newAd = {
    id,
    name: String(name).trim(),
    campaignId: campaignId || '',
    campaignName: matchedCampaignName || 'General Digital Funnel',
    platform: platform || 'Meta',
    status: status || 'ACTIVE',
    spend: numericSpend,
    impressions: numericImpressions,
    reach: Math.round(numericImpressions * 0.72),
    clicks: numericClicks,
    ctr: computedCtr,
    cpc: computedCpc,
    leadsCount: numericLeads,
    cpl: computedCpl,
    platformAdId: platformAdId || `ad_ext_${Math.floor(100000 + Math.random() * 900000)}`,
    lastSyncedAt: new Date().toISOString(),
  };

  dbAdsStore.unshift(newAd);

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'AD_CREATED',
    entityType: 'AdAccount',
    entityId: id,
    newState: { name: newAd.name, platform: newAd.platform, spend: newAd.spend },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('ad:created', newAd);
  return res.status(201).json(newAd);
});

// PUT /api/ads/:id - Update Ad / Metric
router.put('/ads/:id', async (req, res) => {
  const { id } = req.params;
  const index = dbAdsStore.findIndex((a) => String(a.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ error: `Ad record #${id} not found.` });
  }

  const existing = dbAdsStore[index];
  const {
    name,
    campaignId,
    campaignName,
    platform,
    status,
    spend,
    leadsCount,
    cpl,
    ctr,
    impressions,
    clicks,
    cpc,
  } = req.body;

  const numericSpend = spend !== undefined ? Number(spend) : existing.spend;
  const numericLeads = leadsCount !== undefined ? Number(leadsCount) : existing.leadsCount;
  const computedCpl = cpl !== undefined ? Number(cpl) : (numericLeads > 0 ? Number((numericSpend / numericLeads).toFixed(2)) : existing.cpl);
  const numericClicks = clicks !== undefined ? Number(clicks) : existing.clicks;
  const numericImpressions = impressions !== undefined ? Number(impressions) : existing.impressions;
  const computedCtr = ctr !== undefined ? Number(ctr) : (numericImpressions > 0 ? Number(((numericClicks / numericImpressions) * 100).toFixed(2)) : existing.ctr);
  const computedCpc = cpc !== undefined ? Number(cpc) : (numericClicks > 0 ? Number((numericSpend / numericClicks).toFixed(2)) : existing.cpc);

  let matchedCampaignName = campaignName !== undefined ? campaignName : existing.campaignName;
  if (campaignId && campaignId !== existing.campaignId && !campaignName) {
    const matched = dbCampaignsStore.find((c) => String(c.id) === String(campaignId));
    if (matched) matchedCampaignName = matched.name;
  }

  const updatedAd = {
    ...existing,
    name: name !== undefined ? String(name).trim() : existing.name,
    campaignId: campaignId !== undefined ? campaignId : existing.campaignId,
    campaignName: matchedCampaignName,
    platform: platform !== undefined ? String(platform) : existing.platform,
    status: status !== undefined ? String(status) : existing.status,
    spend: numericSpend,
    impressions: numericImpressions,
    reach: Math.round(numericImpressions * 0.72),
    clicks: numericClicks,
    ctr: computedCtr,
    cpc: computedCpc,
    leadsCount: numericLeads,
    cpl: computedCpl,
    lastSyncedAt: new Date().toISOString(),
  };

  dbAdsStore[index] = updatedAd;

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'AD_UPDATED',
    entityType: 'AdAccount',
    entityId: id,
    newState: { name: updatedAd.name, status: updatedAd.status, spend: updatedAd.spend },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('ad:updated', updatedAd);
  return res.json(updatedAd);
});

// DELETE /api/ads/:id - Delete Ad
router.delete('/ads/:id', async (req, res) => {
  const { id } = req.params;
  const index = dbAdsStore.findIndex((a) => String(a.id) === String(id));

  if (index === -1) {
    return res.status(404).json({ error: `Ad record #${id} not found.` });
  }

  const [deleted] = dbAdsStore.splice(index, 1);

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: 'admin@markops.io',
    action: 'AD_DELETED',
    entityType: 'AdAccount',
    entityId: id,
    newState: { deletedAdName: deleted.name },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  emitRealtimeEvent('ad:deleted', { id });
  return res.json({ success: true, message: `Ad "${deleted.name}" deleted successfully.`, id });
});

// POST /api/ads/sync - Sync Metrics
router.post('/ads/sync', async (req, res) => {
  const syncTimestamp = new Date().toISOString();
  dbAdsStore.forEach((ad) => {
    ad.lastSyncedAt = syncTimestamp;
    ad.impressions += Math.floor(Math.random() * 500) + 100;
    ad.clicks += Math.floor(Math.random() * 20) + 5;
    ad.reach = Math.round(ad.impressions * 0.72);
    if (ad.impressions > 0) {
      ad.ctr = Number(((ad.clicks / ad.impressions) * 100).toFixed(2));
    }
  });

  await recordAuditLog(dbPool, {
    actorId: req.headers['x-user-id'] || 'usr_admin_01',
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
