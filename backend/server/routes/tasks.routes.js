const express = require('express');
const { dbPool, dbTasksStore, saveTasksToFile, dbUsersStore, dbNotificationsStore } = require('../db');
const { recordAuditLog } = require('../services/audit.service');
const { emitRealtimeEvent } = require('../events');

const router = express.Router();

function formatDueDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

async function findTask(taskId) {
  if (taskId === undefined || taskId === null) return null;
  const targetIdStr = String(taskId).trim();
  
  let task = dbTasksStore.find((t) => String(t.id).trim() === targetIdStr);
  if (task) return task;

  if (dbPool) {
    try {
      const [rows] = await dbPool.query(`
        SELECT t.*, u.full_name as assignee_full_name, c.full_name as creator_full_name, COALESCE(cr.code, 'ADMINISTRATOR') as creator_role
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN users c ON t.created_by = c.id
        LEFT JOIN roles cr ON c.role_id = cr.id
        WHERE t.id = ?
        LIMIT 1
      `, [taskId]);
      
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        const safeDueDate = formatDueDate(row.due_date);
        const detectedRole = row.creator_role || (row.creator_full_name && row.creator_full_name.toLowerCase().includes('bdm') ? 'BDM' : 'ADMINISTRATOR');
        
        task = {
          id: row.id,
          title: row.title || 'Untitled Task',
          packageName: row.package_name || '',
          description: row.description || '',
          content: row.content || '',
          attachmentUrl: row.attachment_url || '',
          attachmentName: row.attachment_name || '',
          reviewerFeedback: row.reviewer_feedback || '',
          status: row.status || 'ASSIGNED',
          priority: row.priority || 'MEDIUM',
          createdBy: row.created_by || 1,
          creatorName: row.creator_full_name || 'Manager',
          creatorRole: detectedRole,
          assignedTo: row.assigned_to || '',
          assigneeName: row.assignee_full_name || 'Designer',
          dueDate: safeDueDate,
          progressPercent: row.status === 'APPROVED' || row.status === 'COMPLETED' ? 100 : (row.status === 'IN_PROGRESS' ? 50 : 10),
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          versions: [],
          statusHistory: [],
          comments: [],
        };
        dbTasksStore.push(task);
        saveTasksToFile(dbTasksStore);
        return task;
      }
    } catch (e) {
      console.error('[MySQL DB Error] findTask failed:', e?.message || e);
    }
  }

  return null;
}

// GET /api/tasks - Retrieve task list with status/assignee filters
router.get('/tasks', async (req, res) => {
  const { status, assignedTo } = req.query;

  if (dbPool) {
    try {
      const [rows] = await dbPool.query(`
        SELECT t.*, u.full_name as assignee_full_name, c.full_name as creator_full_name, COALESCE(cr.code, 'ADMINISTRATOR') as creator_role
        FROM tasks t
        LEFT JOIN users u ON t.assigned_to = u.id
        LEFT JOIN users c ON t.created_by = c.id
        LEFT JOIN roles cr ON c.role_id = cr.id
        ORDER BY t.created_at DESC
      `);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const existing = dbTasksStore.find((t) => String(t.id) === String(row.id));
          const safeDueDate = formatDueDate(row.due_date);
          const detectedRole = row.creator_role || (row.creator_full_name && row.creator_full_name.toLowerCase().includes('bdm') ? 'BDM' : 'ADMINISTRATOR');
          if (!existing) {
            dbTasksStore.push({
              id: row.id,
              title: row.title,
              packageName: row.package_name || '',
              description: row.description || '',
              content: row.content || '',
              attachmentUrl: row.attachment_url || '',
              attachmentName: row.attachment_name || '',
              reviewerFeedback: row.reviewer_feedback || '',
              status: row.status,
              priority: row.priority,
              createdBy: row.created_by,
              creatorName: row.creator_full_name || 'Manager',
              creatorRole: detectedRole,
              assignedTo: row.assigned_to || '',
              assigneeName: row.assignee_full_name || 'Designer',
              dueDate: safeDueDate,
              progressPercent: row.status === 'APPROVED' || row.status === 'COMPLETED' ? 100 : (row.status === 'IN_PROGRESS' ? 50 : 10),
              createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
              versions: [],
              statusHistory: [],
              comments: [],
            });
          } else {
            existing.status = row.status;
            if (row.assignee_full_name) existing.assigneeName = row.assignee_full_name;
            if (row.creator_full_name) existing.creatorName = row.creator_full_name;
            if (detectedRole && !existing.creatorRole) existing.creatorRole = detectedRole;
            if (safeDueDate) existing.dueDate = safeDueDate;
          }
        }
        saveTasksToFile(dbTasksStore);
      }
    } catch (e) {
      console.error('[MySQL DB Error] Failed to load tasks from DB:', e?.message || e);
    }
  }

  let filtered = [...dbTasksStore];

  if (status && status !== 'ALL') {
    filtered = filtered.filter((t) => t.status === status);
  }
  if (assignedTo) {
    filtered = filtered.filter((t) => String(t.assignedTo) === String(assignedTo));
  }

  return res.json(filtered);
});

// GET /api/tasks/:id - Retrieve single task detail with versions, history, and comments
router.get('/tasks/:id', async (req, res) => {
  const task = await findTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task record not found.' });
  }
  return res.json(task);
});

// POST /api/tasks - Manager & BDM Task Creation flow
router.post('/tasks', async (req, res) => {
  const userRole = String(req.headers['x-user-role'] || req.body.creatorRole || '').toUpperCase();
  if (userRole && !['ADMINISTRATOR', 'MARKETING_MANAGER', 'BDM'].includes(userRole)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin, Marketing Manager, and BDM can create tasks.' });
  }

  const { title, description, content, attachmentUrl, attachmentName, campaignId, campaignName, priority, assignedTo, dueDate, creatorId, creatorName, creatorEmail, packageName } = req.body;
  if (!title || !priority) {
    return res.status(400).json({ error: 'Task Title and Priority are required fields.' });
  }

  const taskId = `task_${Math.random().toString(36).substring(2, 11)}`;
  const now = new Date().toISOString();

  const targetUser = dbUsersStore.find((u) => String(u.id) === String(assignedTo));
  const assigneeName = targetUser ? targetUser.fullName : (req.body.assigneeName || 'Assigned User');

  const newTask = {
    id: taskId,
    title: String(title).trim(),
    packageName: packageName || req.body.packageName || '',
    description: description ? String(description).trim() : '',
    content: content ? String(content).trim() : '',
    attachmentUrl: attachmentUrl || '',
    attachmentName: attachmentName || '',
    campaignId: campaignId || '',
    campaignName: campaignName || '',
    status: assignedTo ? 'ASSIGNED' : 'DRAFT',
    priority: String(priority),
    createdBy: creatorId || req.headers['x-user-id'] || 'usr_admin_01',
    creatorName: creatorName || req.headers['x-user-name'] || 'System Administrator',
    creatorRole: userRole || 'ADMINISTRATOR',
    assignedTo: assignedTo || '',
    assigneeName,
    progressPercent: 0,
    dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
    versions: [],
    statusHistory: [
      {
        id: `hist_${Math.random().toString(36).substring(2, 9)}`,
        taskId,
        actorId: creatorId || req.headers['x-user-id'] || 'usr_admin_01',
        actorName: creatorName || req.headers['x-user-name'] || 'System Administrator',
        previousStatus: null,
        newStatus: assignedTo ? 'ASSIGNED' : 'DRAFT',
        remark: `Task created and assigned to ${assigneeName}.`,
        createdAt: now,
      },
    ],
    comments: [],
  };

  dbTasksStore.unshift(newTask);
  saveTasksToFile(dbTasksStore);
  emitRealtimeEvent('task:assigned', newTask);

  if (assignedTo) {
    const assignNotif = {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      userId: assignedTo,
      title: 'New Creative Task Assigned',
      message: `Assigned task: "${newTask.title}". Due date: ${newTask.dueDate}.`,
      type: 'INFO',
      isRead: false,
      createdAt: now,
    };
    dbNotificationsStore.unshift(assignNotif);
    emitRealtimeEvent('notification:created', assignNotif);
  }

  if (dbPool) {
    try {
      const numericCreatorId = typeof newTask.createdBy === 'number' ? newTask.createdBy : (parseInt(newTask.createdBy, 10) || 1);
      const numericAssignedTo = typeof newTask.assignedTo === 'number' ? newTask.assignedTo : (parseInt(newTask.assignedTo, 10) || null);
      await dbPool.query(
        `INSERT INTO tasks (title, description, status, priority, created_by, assigned_to, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          newTask.title,
          newTask.description || newTask.content || null,
          newTask.status,
          newTask.priority,
          numericCreatorId,
          numericAssignedTo,
          newTask.dueDate || null,
        ]
      );
    } catch (e) {
      console.error('[MySQL DB Error] Task INSERT failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: creatorId || 'usr_admin_01',
    actorEmail: creatorEmail || 'admin@markops.io',
    action: 'TASK_CREATED',
    entityType: 'Task',
    entityId: taskId,
    newState: { title: newTask.title, status: newTask.status, assignedTo: newTask.assignedTo },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.status(201).json(newTask);
});

// Status Transition Handler
async function handleStatusTransition(req, res) {
  const { status, remark, actorId, actorName, actorEmail } = req.body;
  const taskId = req.params.id;

  const task = await findTask(taskId);
  if (!task) {
    return res.status(404).json({ error: `Task #${taskId} not found.` });
  }

  const previousStatus = task.status;
  const newStatus = String(status);
  const now = new Date().toISOString();

  task.status = newStatus;
  task.updatedAt = now;
  if (remark) {
    task.reviewerFeedback = remark;
  }

  if (newStatus === 'ACCEPTED') task.progressPercent = 10;
  if (newStatus === 'IN_PROGRESS') task.progressPercent = 40;
  if (newStatus === 'SUBMITTED' || newStatus === 'RESUBMITTED' || newStatus === 'UNDER_REVIEW') task.progressPercent = 85;
  if (newStatus === 'REVISION_REQUIRED') task.progressPercent = 70;
  if (newStatus === 'APPROVED' || newStatus === 'PUBLISHED' || newStatus === 'COMPLETED') task.progressPercent = 100;

  const effectiveActorId = actorId || req.headers['x-user-id'] || 'usr_admin_01';
  const effectiveActorName = actorName || req.headers['x-user-name'] || 'System Administrator';

  const historyEntry = {
    id: `hist_${Math.random().toString(36).substring(2, 9)}`,
    taskId,
    actorId: effectiveActorId,
    actorName: effectiveActorName,
    previousStatus,
    newStatus,
    remark: remark || `Transitioned status from ${previousStatus} to ${newStatus}`,
    createdAt: now,
  };

  if (!task.statusHistory) task.statusHistory = [];
  task.statusHistory.unshift(historyEntry);
  saveTasksToFile(dbTasksStore);

  emitRealtimeEvent(`task:${newStatus.toLowerCase()}`, task);
  emitRealtimeEvent('task:progress_updated', { taskId, progressPercent: task.progressPercent });

  if (newStatus === 'REVISION_REQUIRED') {
    const revNotif = {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      userId: task.assignedTo || effectiveActorId,
      title: 'Revision Requested on Creative Design',
      message: `Revision requested on "${task.title}". Feedback: "${remark}".`,
      type: 'WARNING',
      isRead: false,
      createdAt: now,
    };
    dbNotificationsStore.unshift(revNotif);
    emitRealtimeEvent('notification:created', revNotif);
  } else if (newStatus === 'APPROVED') {
    const appNotif = {
      id: `notif_${Math.random().toString(36).substring(2, 11)}`,
      userId: task.assignedTo || effectiveActorId,
      title: 'Creative Design Approved!',
      message: `Design approved for "${task.title}". Status updated to APPROVED.`,
      type: 'SUCCESS',
      isRead: false,
      createdAt: now,
    };
    dbNotificationsStore.unshift(appNotif);
    emitRealtimeEvent('notification:created', appNotif);
  }

  if (dbPool) {
    try {
      const numericTaskId = typeof taskId === 'number' ? taskId : (parseInt(taskId, 10) || null);
      const numericActorId = typeof effectiveActorId === 'number' ? effectiveActorId : (parseInt(effectiveActorId, 10) || 1);
      if (numericTaskId) {
        await dbPool.query(
          `UPDATE tasks SET status = ?, reviewer_feedback = ?, updated_at = NOW() WHERE id = ?`,
          [newStatus, remark || null, numericTaskId]
        );
        await dbPool.query(
          `INSERT INTO task_status_history (task_id, actor_id, previous_status, new_status, remark, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [numericTaskId, numericActorId, previousStatus, newStatus, remark || null]
        );
      }
    } catch (e) {
      console.error('[MySQL DB Error] Task status UPDATE failed:', e?.message || e);
    }
  }

  await recordAuditLog(dbPool, {
    actorId: effectiveActorId,
    actorEmail: actorEmail || 'admin@markops.io',
    action: `TASK_STATUS_${newStatus}`,
    entityType: 'Task',
    entityId: taskId,
    previousState: { status: previousStatus },
    newState: { status: newStatus, remark },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.json(task);
}

// POST /api/tasks/:id/status, PUT /api/tasks/:id/status, PATCH /api/tasks/:id/status
router.post('/tasks/:id/status', handleStatusTransition);
router.put('/tasks/:id/status', handleStatusTransition);
router.patch('/tasks/:id/status', handleStatusTransition);

// POST /api/tasks/:id/versions - Upload/Submit Creative Version
router.post('/tasks/:id/versions', async (req, res) => {
  const { fileName, changelog, fileSize, filePath, fileContent, submittedBy, submittedByName, submittedByEmail } = req.body;
  const taskId = req.params.id;

  const task = await findTask(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (!task.versions) task.versions = [];
  const newVersionNumber = task.versions.length + 1;
  const now = new Date().toISOString();

  const effectiveUser = submittedBy || req.headers['x-user-id'] || 'usr_admin_01';
  const effectiveUserName = submittedByName || req.headers['x-user-name'] || 'System Administrator';

  const newVersion = {
    id: `ver_${Math.random().toString(36).substring(2, 9)}`,
    taskId,
    versionNumber: newVersionNumber,
    submittedBy: effectiveUser,
    submittedByName: effectiveUserName,
    fileName: fileName || `creative_version_v${newVersionNumber}.png`,
    filePath: filePath || `/uploads/creatives/${fileName || `version_${newVersionNumber}.png`}`,
    fileSize: fileSize || 2048000,
    changelog: changelog || `Version ${newVersionNumber}.0 creative asset submission.`,
    fileContent: fileContent || changelog || '',
    createdAt: now,
  };

  task.versions.unshift(newVersion);

  const uploadNotif = {
    id: `notif_${Math.random().toString(36).substring(2, 11)}`,
    userId: task.createdBy || 'usr_admin_01',
    title: 'New Design Version Submitted',
    message: `${effectiveUserName} uploaded version v${newVersionNumber}.0 (${newVersion.fileName}) for task: "${task.title}".`,
    type: 'INFO',
    isRead: false,
    createdAt: now,
  };
  dbNotificationsStore.unshift(uploadNotif);
  emitRealtimeEvent('notification:created', uploadNotif);

  const previousStatus = task.status;
  const nextStatus = previousStatus === 'REVISION_REQUIRED' ? 'RESUBMITTED' : 'SUBMITTED';
  task.status = nextStatus;
  task.progressPercent = 85;
  task.updatedAt = now;

  if (!task.statusHistory) task.statusHistory = [];
  task.statusHistory.unshift({
    id: `hist_${Math.random().toString(36).substring(2, 9)}`,
    taskId,
    actorId: effectiveUser,
    actorName: effectiveUserName,
    previousStatus,
    newStatus: nextStatus,
    remark: `Uploaded Creative Version ${newVersionNumber}.0 (${newVersion.fileName})`,
    createdAt: now,
  });
  saveTasksToFile(dbTasksStore);

  await recordAuditLog(dbPool, {
    actorId: effectiveUser,
    actorEmail: submittedByEmail || 'admin@markops.io',
    action: 'TASK_VERSION_SUBMITTED',
    entityType: 'Task',
    entityId: newVersion.id,
    newState: { versionNumber: newVersionNumber, fileName: newVersion.fileName },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res.status(201).json({ task, version: newVersion });
});

// POST /api/tasks/:id/comments - Add Comment / Reviewer Remark
router.post('/tasks/:id/comments', async (req, res) => {
  const { comment, userId, userName, userRole } = req.body;
  const taskId = req.params.id;

  const task = await findTask(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  if (!comment) {
    return res.status(400).json({ error: 'Comment body cannot be empty.' });
  }

  const newComment = {
    id: `comm_${Math.random().toString(36).substring(2, 9)}`,
    taskId,
    userId: userId || req.headers['x-user-id'] || 'usr_admin_01',
    userName: userName || req.headers['x-user-name'] || 'System Administrator',
    userRole: userRole || req.headers['x-user-role'] || 'ADMINISTRATOR',
    comment: String(comment).trim(),
    createdAt: new Date().toISOString(),
  };

  if (!task.comments) task.comments = [];
  task.comments.push(newComment);
  saveTasksToFile(dbTasksStore);

  return res.status(201).json(newComment);
});

// DELETE /api/tasks/:id - Delete Task Permanently
router.delete('/tasks/:id', async (req, res) => {
  const userRole = String(req.headers['x-user-role'] || req.query.role || '').toUpperCase();
  if (userRole && !['ADMINISTRATOR', 'MARKETING_MANAGER', 'BDM'].includes(userRole)) {
    return res.status(403).json({ error: 'Permission Denied: Only Admin, Marketing Manager, and BDM can delete tasks.' });
  }

  const taskId = req.params.id;
  const index = dbTasksStore.findIndex((t) => String(t.id) === String(taskId));
  let deletedTask = null;
  if (index !== -1) {
    deletedTask = dbTasksStore.splice(index, 1)[0];
    saveTasksToFile(dbTasksStore);
  }

  if (dbPool) {
    try {
      await dbPool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
      await dbPool.query('DELETE FROM task_status_history WHERE task_id = ?', [taskId]);
    } catch (e) {
      console.error('[MySQL DB Error] Task DELETE failed:', e?.message || e);
    }
  }

  if (!deletedTask && !dbPool) {
    return res.status(404).json({ error: 'Task record not found.' });
  }

  emitRealtimeEvent('task:deleted', { id: taskId });
  return res.json({ success: true, message: 'Task deleted successfully.', deletedTaskId: taskId });
});

// GET /api/designer/dashboard-metrics - Designer Dashboard Real-time Analytics
router.get('/designer/dashboard-metrics', (req, res) => {
  const targetUserId = req.query.userId || req.headers['x-user-id'];
  const designerTasks = targetUserId
    ? dbTasksStore.filter((t) => String(t.assignedTo) === String(targetUserId))
    : dbTasksStore;
  const todayStr = new Date().toISOString().split('T')[0];

  const assignedToday = designerTasks.filter((t) => (t.createdAt && t.createdAt.startsWith(todayStr)) || t.status === 'ASSIGNED');
  const inProgress = designerTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED');
  const dueToday = designerTasks.filter((t) => t.dueDate === todayStr);
  const overdue = designerTasks.filter((t) => t.dueDate && t.dueDate < todayStr && t.status !== 'COMPLETED' && t.status !== 'APPROVED');
  const submittedWaiting = designerTasks.filter((t) => t.status === 'SUBMITTED' || t.status === 'RESUBMITTED' || t.status === 'UNDER_REVIEW');
  const revisionRequired = designerTasks.filter((t) => t.status === 'REVISION_REQUIRED');
  const completed = designerTasks.filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED' || t.status === 'COMPLETED');

  let totalRevisions = 0;
  designerTasks.forEach((t) => {
    if (t.versions && t.versions.length > 1) {
      totalRevisions += t.versions.length - 1;
    }
  });

  const totalEvaluated = completed.length + revisionRequired.length;
  const approvalRatePct = totalEvaluated > 0 ? Math.round((completed.length / totalEvaluated) * 100) : 0;

  const recentSubmissions = [];
  designerTasks.forEach((t) => {
    if (t.versions && t.versions.length > 0) {
      const latestVer = t.versions[0];
      const lastHistory = t.statusHistory && t.statusHistory.length > 0 ? t.statusHistory[0] : null;
      recentSubmissions.push({
        id: latestVer.id,
        taskTitle: t.title,
        versionNumber: latestVer.versionNumber,
        fileName: latestVer.fileName,
        submittedAt: latestVer.createdAt,
        status: t.status,
        reviewerRemark: lastHistory?.remark || 'Awaiting managerial review.',
      });
    }
  });

  const activityTimeline = [];
  designerTasks.forEach((t) => {
    if (t.statusHistory) {
      t.statusHistory.forEach((h) => {
        activityTimeline.push({
          id: h.id,
          action: `${h.previousStatus ? `${h.previousStatus} ➔ ` : ''}${h.newStatus}`,
          taskTitle: t.title,
          actorName: h.actorName || 'User',
          timestamp: h.createdAt,
        });
      });
    }
  });
  activityTimeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return res.json({
    assignedTodayCount: assignedToday.length,
    inProgressCount: inProgress.length,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
    submittedWaitingReviewCount: submittedWaiting.length,
    revisionRequiredCount: revisionRequired.length,
    completedThisMonthCount: completed.length,
    avgCompletionHours: 0,
    approvalRatePct,
    totalRevisionsCount: totalRevisions,
    activityTimeline: activityTimeline.slice(0, 8),
    recentSubmissions: recentSubmissions.slice(0, 5),
  });
});

module.exports = router;
