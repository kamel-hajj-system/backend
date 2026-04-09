const { prisma } = require('../users/models');

const TASK_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
const MAX_TASKS = 50;
const MIN_TASKS = 1;

function parseReportDate(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks)) return { ok: false, error: 'tasks must be an array' };
  if (tasks.length < MIN_TASKS || tasks.length > MAX_TASKS) {
    return { ok: false, error: `Between ${MIN_TASKS} and ${MAX_TASKS} tasks required` };
  }
  const normalized = [];
  for (let i = 0; i < tasks.length; i += 1) {
    const t = tasks[i] || {};
    const taskName = String(t.taskName ?? '').trim();
    const status = String(t.status ?? '').trim();
    const details = t.details != null ? String(t.details) : '';
    if (!taskName) return { ok: false, error: `Task ${i + 1}: name is required` };
    if (!TASK_STATUSES.has(status)) {
      return { ok: false, error: `Task ${i + 1}: invalid status` };
    }
    normalized.push({ taskName, status, details });
  }
  return { ok: true, tasks: normalized };
}

function serialize(row) {
  const u = row.createdBy;
  const editorName = u?.fullNameAr || u?.fullName || u?.email || '';
  const tasks = Array.isArray(row.tasksJson) ? row.tasksJson : [];
  return {
    id: row.id,
    locationId: row.locationId,
    reportDate: row.reportDate.toISOString().slice(0, 10),
    tasks,
    taskCount: tasks.length,
    updatesToday: row.updatesToday,
    ministryInstructionsReceived: row.ministryInstructionsReceived,
    ministryInstructionsText: row.ministryInstructionsText,
    seniorManagementNeeds: row.seniorManagementNeeds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editorName,
    editorEmail: u?.email || '',
    createdById: row.createdById,
  };
}

async function createReport({ locationId, userId, body }) {
  const reportDate = parseReportDate(body.reportDate);
  if (!reportDate) {
    const err = new Error('Invalid reportDate (use YYYY-MM-DD)');
    err.statusCode = 400;
    throw err;
  }
  const updatesToday = String(body.updatesToday ?? '').trim();
  if (!updatesToday) {
    const err = new Error('updatesToday is required');
    err.statusCode = 400;
    throw err;
  }
  const seniorManagementNeeds = String(body.seniorManagementNeeds ?? '').trim();
  const ministryReceived = Boolean(body.ministryInstructionsReceived);
  let ministryText = body.ministryInstructionsText != null ? String(body.ministryInstructionsText).trim() : '';
  if (ministryReceived && !ministryText) {
    const err = new Error('ministryInstructionsText is required when ministry instructions are received');
    err.statusCode = 400;
    throw err;
  }
  if (!ministryReceived) ministryText = '';

  const tv = validateTasks(body.tasks);
  if (!tv.ok) {
    const err = new Error(tv.error);
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.dailyCompanyReport.findUnique({
    where: {
      createdById_reportDate: { createdById: userId, reportDate },
    },
  });
  if (existing) {
    const err = new Error('A report for this date already exists. Edit is not available yet.');
    err.statusCode = 409;
    throw err;
  }

  const row = await prisma.dailyCompanyReport.create({
    data: {
      locationId,
      createdById: userId,
      reportDate,
      tasksJson: tv.tasks,
      updatesToday,
      ministryInstructionsReceived: ministryReceived,
      ministryInstructionsText: ministryText || null,
      seniorManagementNeeds,
    },
    include: {
      createdBy: { select: { fullName: true, fullNameAr: true, email: true } },
    },
  });
  return serialize(row);
}

async function listMine({ locationId, userId, from, to }) {
  const where = {
    locationId,
    createdById: userId,
  };
  if (from || to) {
    where.reportDate = {};
    const fd = from ? parseReportDate(from) : null;
    const td = to ? parseReportDate(to) : null;
    if (fd) where.reportDate.gte = fd;
    if (td) where.reportDate.lte = td;
  }
  const rows = await prisma.dailyCompanyReport.findMany({
    where,
    orderBy: { reportDate: 'desc' },
    take: 365,
    include: {
      createdBy: { select: { fullName: true, fullNameAr: true, email: true } },
    },
  });
  return rows.map(serialize);
}

async function listMonitoring({ locationId, q, from, to }) {
  const where = { locationId };
  if (from || to) {
    where.reportDate = {};
    const fd = from ? parseReportDate(from) : null;
    const td = to ? parseReportDate(to) : null;
    if (fd) where.reportDate.gte = fd;
    if (td) where.reportDate.lte = td;
  }
  const search = q && String(q).trim();
  if (search) {
    where.OR = [
      { updatesToday: { contains: search, mode: 'insensitive' } },
      { seniorManagementNeeds: { contains: search, mode: 'insensitive' } },
      { ministryInstructionsText: { contains: search, mode: 'insensitive' } },
      {
        createdBy: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { fullNameAr: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }
  const rows = await prisma.dailyCompanyReport.findMany({
    where,
    orderBy: { reportDate: 'desc' },
    take: 500,
    include: {
      createdBy: { select: { fullName: true, fullNameAr: true, email: true } },
    },
  });
  return rows.map(serialize);
}

async function getById(id) {
  const row = await prisma.dailyCompanyReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { fullName: true, fullNameAr: true, email: true } },
    },
  });
  if (!row) return null;
  return serialize(row);
}

async function summaryForLocation(locationId, { userId, mode }) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [totalLocation, thisMonthLocation, mineAll] = await Promise.all([
    prisma.dailyCompanyReport.count({ where: { locationId } }),
    prisma.dailyCompanyReport.count({
      where: { locationId, reportDate: { gte: startOfMonth } },
    }),
    prisma.dailyCompanyReport.count({ where: { locationId, createdById: userId } }),
  ]);

  return {
    totalLocation,
    thisMonthLocation,
    myReportsTotal: mineAll,
  };
}

module.exports = {
  createReport,
  listMine,
  listMonitoring,
  getById,
  summaryForLocation,
  TASK_STATUSES: Array.from(TASK_STATUSES),
};
