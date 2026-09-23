const express = require('express');
const { dbPool, dbLeadsStore, dbUsersStore, dbCallActivitiesStore, dbFollowUpsStore } = require('../db');
const { recordAuditLog } = require('../services/audit.service');
const { emitRealtimeEvent } = require('../events');
const router = express.Router();
router.get('/leads', (req, res) => {
  return res.json(dbLeadsStore);
});
router.post('/leads', async (req, res) => {
  const { firstName, lastName, email, phone, source, campaignId, campaignName, creatorId, creatorEmail, creatorRole } = req.body;
  const effectiveRole = String(creatorRole || req.headers['x-user-role'] || '').toUpperCase();

  if (effectiveRole === 'TELECALLER') {
    return res.status(403).json({ error: 'Access Denied: Telecallers are not authorized to create leads.' });
  }

  const fName = String(firstName || '').trim();
  const lName = String(lastName || '').trim();
  const em = String(email || '').trim();
  const ph = String(phone || '').trim();
  const src = String(source || '').trim();

  if (!fName || !lName || !em || !ph || !src) {
    return res.status(400).json({
      error: 'Validation Error: All 5 fields (First Name, Last Name, Email, Phone, Source) are strictly required.',
    });
  }

  const newLead = {
    id: `lead_${Math.random().toString(36).substring(2, 10)}`,
    firstName: fName,
    lastName: lName,
    email: em,
    phone: ph,
    source: src,
    campaignId: campaignId || '',
    campaignName: campaignName || 'General Intake',
    adId: '',
    status: 'NEW',
    assignedTo: null,
    assigneeName: 'Unassigned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  dbLeadsStore.unshift(newLead);
  emitRealtimeEvent('lead:created', newLead);
  await recordAuditLog(dbPool, {
    actorId: creatorId || req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: creatorEmail || 'admin@markops.io',
    action: 'LEAD_CREATED',
    entityType: 'Lead',
    entityId: newLead.id,
    newState: { name: `${newLead.firstName} ${newLead.lastName}`, phone: newLead.phone },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return res.status(201).json(newLead);
});

router.post('/leads/:id/assign', async (req, res) => {
  const { assignedTo, assigneeName, actorId, actorEmail } = req.body;
  const lead = dbLeadsStore.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });

  lead.assignedTo = assignedTo || null;
  lead.assigneeName = assigneeName || 'Assigned User';
  if (lead.status === 'NEW') lead.status = 'ASSIGNED';
  lead.updatedAt = new Date().toISOString();
  emitRealtimeEvent('lead:assigned', lead);

  await recordAuditLog(dbPool, {
    actorId: actorId || req.headers['x-user-id'] || 'usr_admin_01',
    actorEmail: actorEmail || 'admin@markops.io',
    action: 'LEAD_ASSIGNED',
    entityType: 'Lead',
    entityId: lead.id,
    newState: { assignedTo: lead.assignedTo, status: lead.status },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
  return res.json(lead);
});

router.get('/calls', (req, res) => {
  return res.json(dbCallActivitiesStore);
});

router.post('/calls', async (req, res) => {
  const { leadId, outcome, durationSeconds, remarks, nextAction, followUpDate, telecallerId, telecallerName, telecallerEmail } = req.body;
  const lead = dbLeadsStore.find((l) => l.id === leadId);

  const effectiveCallerId = telecallerId || req.headers['x-user-id'] || 'usr_admin_01';
  const effectiveCallerName = telecallerName || req.headers['x-user-name'] || 'System User';

  const newCall = {
    id: `call_${Math.random().toString(36).substring(2, 10)}`,
    leadId: leadId || '',
    leadName: lead ? `${lead.firstName} ${lead.lastName || ''}`.trim() : 'Lead Customer',
    telecallerId: effectiveCallerId,
    telecallerName: effectiveCallerName,
    outcome: outcome || 'CONNECTED',
    durationSeconds: Number(durationSeconds) || 120,
    remarks: remarks || 'Call logged.',
    nextAction: nextAction || 'Follow up as required',
    calledAt: new Date().toISOString(),
  };

  dbCallActivitiesStore.unshift(newCall);
  emitRealtimeEvent('call:completed', newCall);
  if (lead) {
    emitRealtimeEvent('lead:status_changed', { leadId: lead.id, status: lead.status });
  }

  if (lead) {
    if (outcome === 'QUALIFIED') lead.status = 'QUALIFIED';
    else if (outcome === 'INTERESTED') lead.status = 'INTERESTED';
    else if (outcome === 'NOT_INTERESTED') lead.status = 'NOT_INTERESTED';
    else lead.status = 'CONTACTED';
    lead.updatedAt = new Date().toISOString();
  }

  if (followUpDate) {
    dbFollowUpsStore.unshift({
      id: `fol_${Math.random().toString(36).substring(2, 10)}`,
      leadId: newCall.leadId,
      leadName: newCall.leadName,
      leadPhone: lead ? lead.phone : '',
      telecallerId: effectiveCallerId,
      telecallerName: effectiveCallerName,
      dueDate: followUpDate,
      status: 'PENDING',
      notes: remarks,
      createdAt: new Date().toISOString(),
    });
  }

  await recordAuditLog(dbPool, {
    actorId: effectiveCallerId,
    actorEmail: telecallerEmail || 'telecaller@markops.io',
    action: `TELECALL_LOGGED_${outcome}`,
    entityType: 'CallActivity',
    entityId: newCall.id,
    newState: { outcome, leadId },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.status(201).json({ call: newCall, lead });
});

router.get('/followups', (req, res) => {
  return res.json(dbFollowUpsStore);
});

// POST /api/leads/batch-import - Batch Excel/CSV upload with Equal Auto-Assignment among Telecallers
router.post('/leads/batch-import', async (req, res) => {
  const { leads, selectedTelecallerIds, campaignId, campaignName, source, uploaderId, uploaderEmail, uploaderRole } = req.body;
  const effectiveRole = String(uploaderRole || req.headers['x-user-role'] || '').toUpperCase();
  
  if (effectiveRole === 'TELECALLER') {
    return res.status(403).json({
      error: 'Access Denied: Telecallers are not authorized to upload lead files. Upload is strictly restricted to Digital Marketing role.',
    });
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'No lead array provided in request payload.' });
  }

  // Validate that all 5 fields exist for every lead in the array
  for (let i = 0; i < leads.length; i++) {
    const raw = leads[i];
    const fName = String(raw.firstName || raw['First Name'] || raw['first_name'] || '').trim();
    const lName = String(raw.lastName || raw['Last Name'] || raw['last_name'] || '').trim();
    const em = String(raw.email || raw['Email'] || raw['email_address'] || '').trim();
    const ph = String(raw.phone || raw['Phone'] || raw['Mobile'] || '').trim();
    const src = String(raw.source || raw['Source'] || source || '').trim();

    if (!fName || !lName || !em || !ph || !src) {
      return res.status(400).json({
        error: `Validation Error on row #${i + 1}: All 5 fields (First Name, Last Name, Email, Phone, Source) are strictly required. Missing values detected.`,
      });
    }
  }

  // 1. Determine active telecallers to distribute leads among (STRICTLY TELECALLER role only)
  let telecallers = dbUsersStore.filter((u) => u.role === 'TELECALLER' && u.isActive !== false);

  // Sync any telecallers supplied from frontend payload if not already in store
  if (Array.isArray(req.body.telecallersList) && req.body.telecallersList.length > 0) {
    req.body.telecallersList.forEach((reqTc) => {
      if (!telecallers.some((t) => t.id === reqTc.id)) {
        const syncedTc = {
          id: reqTc.id,
          fullName: reqTc.fullName || 'Telecaller User',
          email: reqTc.email || `${reqTc.id}@markops.io`,
          role: 'TELECALLER',
          isActive: true,
        };
        telecallers.push(syncedTc);
        if (!dbUsersStore.some((u) => u.id === reqTc.id)) {
          dbUsersStore.push(syncedTc);
        }
      }
    });
  }

  if (Array.isArray(selectedTelecallerIds) && selectedTelecallerIds.length > 0) {
    const selectedSet = new Set(selectedTelecallerIds);
    const filteredSelected = telecallers.filter((u) => selectedSet.has(u.id));
    if (filteredSelected.length > 0) {
      telecallers = filteredSelected;
    }
  }

  // Fallback default telecallers if no telecallers are present
  if (telecallers.length === 0) {
    telecallers = [
      { id: 'usr_telecaller_01', fullName: 'Ananya Sharma', email: 'ananya@markops.io' },
      { id: 'usr_telecaller_02', fullName: 'Rohan Verma', email: 'rohan@markops.io' },
      { id: 'usr_telecaller_03', fullName: 'Priya Gupta', email: 'priya@markops.io' },
    ];
  }

  const createdLeads = [];
  const allocationSummary = {};
  telecallers.forEach((tc) => {
    allocationSummary[tc.id] = { id: tc.id, fullName: tc.fullName, email: tc.email, count: 0 };
  });

  // 2. Perform Round-Robin Equal Assignment
  for (let i = 0; i < leads.length; i++) {
    const raw = leads[i];
    const assignedTelecaller = telecallers.length > 0 ? telecallers[i % telecallers.length] : null;

    const firstName = String(raw.firstName || raw['First Name'] || raw['first_name'] || raw['Name'] || `Lead ${i + 1}`).trim();
    const lastName = String(raw.lastName || raw['Last Name'] || raw['last_name'] || '').trim();
    const email = String(raw.email || raw['Email'] || raw['email_address'] || '').trim();
    const phone = String(raw.phone || raw['Phone'] || raw['Mobile'] || raw['Contact'] || `+91 ${9000000000 + i}`).trim();

    const newLead = {
      id: `lead_${Math.random().toString(36).substring(2, 10)}`,
      firstName,
      lastName,
      email,
      phone,
      source: String(raw.source || raw['Source'] || raw['source'] || raw['Lead Source'] || source || 'Excel Import').trim(),
      campaignId: campaignId || raw.campaignId || 'cmp_default',
      campaignName: campaignName || raw.campaignName || 'Digital Ad Campaign',
      adId: raw.adId || '',
      status: assignedTelecaller ? 'ASSIGNED' : 'NEW',
      assignedTo: assignedTelecaller ? assignedTelecaller.id : null,
      assigneeName: assignedTelecaller ? assignedTelecaller.fullName : 'Unassigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (assignedTelecaller) {
      allocationSummary[assignedTelecaller.id].count++;
    }

    dbLeadsStore.unshift(newLead);
    createdLeads.push(newLead);
  }

  // 3. Emit Realtime Events & Record Audit Log
  emitRealtimeEvent('leads:batch_imported', { total: createdLeads.length, allocationSummary });
  
  await recordAuditLog(dbPool, {
    actorId: uploaderId || req.headers['x-user-id'] || 'usr_digital_01',
    actorEmail: uploaderEmail || 'digital@markops.io',
    action: 'LEADS_EXCEL_BATCH_UPLOAD',
    entityType: 'LeadBatch',
    entityId: `batch_${Date.now()}`,
    newState: { totalUploaded: createdLeads.length, telecallersCount: telecallers.length, allocationSummary },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.status(201).json({
    success: true,
    message: `Successfully uploaded ${createdLeads.length} leads and assigned equally among ${telecallers.length} active telecallers!`,
    totalUploaded: createdLeads.length,
    telecallersCount: telecallers.length,
    leadsPerTelecaller: telecallers.length > 0 ? Math.floor(createdLeads.length / telecallers.length) : 0,
    allocationSummary: Object.values(allocationSummary),
    leads: createdLeads,
  });
});

// GET /api/leads/telecalling-summary - Summary Dashboard metrics for Digital Marketing Head & Admin
router.get('/leads/telecalling-summary', (req, res) => {
  const totalLeads = dbLeadsStore.length;
  const assignedLeads = dbLeadsStore.filter((l) => l.assignedTo).length;
  const unassignedLeads = totalLeads - assignedLeads;

  const statusBreakdown = {
    NEW: 0,
    ASSIGNED: 0,
    CONTACTED: 0,
    INTERESTED: 0,
    NOT_INTERESTED: 0,
    QUALIFIED: 0,
    CONVERTED: 0,
    LOST: 0,
  };

  dbLeadsStore.forEach((l) => {
    if (statusBreakdown[l.status] !== undefined) {
      statusBreakdown[l.status]++;
    }
  });

  // Telecallers performance summary (STRICTLY TELECALLER role)
  const telecallers = dbUsersStore.filter((u) => u.role === 'TELECALLER' && u.isActive !== false);

  const telecallerMetrics = telecallers.map((tc) => {
    const assigned = dbLeadsStore.filter((l) => l.assignedTo === tc.id);
    const calls = dbCallActivitiesStore.filter((c) => c.telecallerId === tc.id);

    const attendedCalls = calls.filter((c) => ['CONNECTED', 'INTERESTED', 'QUALIFIED', 'NOT_INTERESTED'].includes(c.outcome));
    const notAttendedCalls = calls.filter((c) => ['NO_ANSWER', 'BUSY', 'WRONG_NUMBER'].includes(c.outcome));
    const interestedCalls = calls.filter((c) => ['INTERESTED', 'QUALIFIED'].includes(c.outcome));
    const notInterestedCalls = calls.filter((c) => c.outcome === 'NOT_INTERESTED');

    const totalDurationSeconds = calls.reduce((acc, c) => acc + (Number(c.durationSeconds) || 0), 0);
    const avgDurationSeconds = calls.length > 0 ? Math.round(totalDurationSeconds / calls.length) : 0;

    return {
      id: tc.id,
      fullName: tc.fullName,
      email: tc.email,
      department: tc.department || 'Telecalling Sales',
      assignedLeadsCount: assigned.length,
      callsLoggedCount: calls.length,
      attendedCount: attendedCalls.length,
      notAttendedCount: notAttendedCalls.length,
      interestedCount: interestedCalls.length,
      notInterestedCount: notInterestedCalls.length,
      totalDurationSeconds,
      avgDurationSeconds,
      conversionRate: assigned.length > 0 ? Math.round((interestedCalls.length / assigned.length) * 100) : 0,
    };
  });

  return res.json({
    totalLeads,
    assignedLeads,
    unassignedLeads,
    totalCallsLogged: dbCallActivitiesStore.length,
    statusBreakdown,
    telecallerMetrics,
  });
});

module.exports = router;
