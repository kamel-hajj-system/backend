const authService = require('../services/authService');
const { prisma } = require('../models');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token || null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = authService.verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  prisma.user
    .findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        fullName: true,
        fullNameAr: true,
        email: true,
        phone: true,
        userType: true,
        role: true,
        jobTitle: true,
        shiftId: true,
        locationId: true,
        supervisorId: true,
        serviceCenterId: true,
        isActive: true,
        isDeleted: true,
        isSuperAdmin: true,
        isHr: true,
        createdAt: true,
        updatedAt: true,
        shiftLocation: { select: { id: true, name: true, locationAr: true } },
        shift: { select: { id: true, name: true, shiftAr: true } },
        accessGrants: { select: { code: true } },
        tokenVersion: true,
        _count: { select: { delegatedVisibilityAsViewer: true } },
      },
    })
    .then((user) => {
      if (!user || user.isDeleted) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      if (!user.isActive) {
        return res.status(403).json({
          error: 'Account is not active. Contact HR or your administrator if you need access.',
          code: 'ACCOUNT_INACTIVE',
        });
      }
      if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      }
      const { _count, ...rest } = user;
      req.user = {
        ...rest,
        hasDelegatedTeamAccess: (_count?.delegatedVisibilityAsViewer ?? 0) > 0,
      };
      req.user.accessCodes = (rest.accessGrants || []).map((g) => g.code).filter(Boolean);
      req.userId = user.id;
      req.userRole = user.role;
      req.isSuperAdmin = user.isSuperAdmin === true;
      next();
    })
    .catch((err) => {
      next(err);
    });
}

function requireSuperAdmin(req, res, next) {
  if (req.isSuperAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Super Admin access required' });
}

function requireHr(req, res, next) {
  if (req.user?.isHr) {
    return next();
  }
  return res.status(403).json({ error: 'HR access required' });
}

function requireHrCanEdit(req, res, next) {
  if (!req.user?.isHr) {
    return res.status(403).json({ error: 'HR access required' });
  }
  if (req.user.role === 'Supervisor' || req.user.role === 'EmpManage') {
    return next();
  }
  return res.status(403).json({ error: 'HR edit access required' });
}

function requireCompanySupervisor(req, res, next) {
  if (req.user?.userType !== 'Company') {
    return res.status(403).json({ error: 'Company access required' });
  }
  if (req.user?.role !== 'Supervisor') {
    return res.status(403).json({ error: 'Supervisor access required' });
  }
  return next();
}

/**
 * Company supervisor, or company user granted at least one of the ACCESS_TREE codes (Super Admin → Access Control).
 */
function requireCompanySupervisorOrAccessCodes(...codes) {
  const list = codes.flat().filter(Boolean);
  return (req, res, next) => {
    if (req.user?.userType !== 'Company') {
      return res.status(403).json({ error: 'Company access required' });
    }
    if (req.user?.role === 'Supervisor') {
      return next();
    }
    const granted = req.user?.accessCodes || [];
    if (list.some((c) => granted.includes(c))) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  };
}

/** Any of the given access grant codes (or Super Admin). */
function requireAccessCode(codes) {
  const list = (Array.isArray(codes) ? codes : [codes]).flat().filter(Boolean);
  return (req, res, next) => {
    if (req.isSuperAdmin) {
      return next();
    }
    const granted = req.user?.accessCodes || [];
    if (list.some((c) => granted.includes(c))) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  };
}

/** Alias for permission routes (same as requireAccessCode). */
const requirePermission = requireAccessCode;

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.query.token || null;

  if (!token) {
    return next();
  }

  let decoded;
  try {
    decoded = authService.verifyToken(token);
  } catch {
    return next();
  }

  prisma.user
    .findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        fullName: true,
        fullNameAr: true,
        email: true,
        role: true,
        isActive: true,
        isDeleted: true,
        isSuperAdmin: true,
      },
    })
    .then((user) => {
      if (user && !user.isDeleted && user.isActive) {
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        req.isSuperAdmin = user.isSuperAdmin === true;
      }
      next();
    })
    .catch(() => next());
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requireHr,
  requireHrCanEdit,
  requireCompanySupervisor,
  requireCompanySupervisorOrAccessCodes,
  requireAccessCode,
  requirePermission,
  optionalAuth,
};
