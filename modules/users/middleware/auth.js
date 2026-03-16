const authService = require('../services/authService');
const { prisma } = require('../models');

/**
 * Require valid JWT. Attach req.user (sanitized) and req.userId.
 */
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
        createdAt: true,
        updatedAt: true,
        userPermissions: {
          select: {
            permission: { select: { id: true, name: true, module: true } },
          },
        },
        userGroups: {
          select: {
            group: {
              select: {
                permissions: {
                  select: {
                    permission: { select: { id: true, name: true, module: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    .then((user) => {
      if (!user || user.isDeleted) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      const direct = (user.userPermissions || []).map((up) => up.permission?.name).filter(Boolean);
      const fromGroups = (user.userGroups || []).flatMap((ug) =>
        (ug.group?.permissions || []).map((gp) => gp.permission?.name).filter(Boolean)
      );
      const permissionNames = [...new Set([...direct, ...fromGroups])];
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
      req.isSuperAdmin = user.isSuperAdmin === true;
      req.permissionNames = permissionNames;
      req.user.permissionNames = permissionNames;
      next();
    })
    .catch((err) => {
      next(err);
    });
}

/**
 * Require Admin role (or super admin).
 */
function requireAdmin(req, res, next) {
  if (req.isSuperAdmin || req.userRole === 'Admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

/**
 * Require Super Admin (management of locations, shifts, etc.).
 */
function requireSuperAdmin(req, res, next) {
  if (req.isSuperAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Super Admin access required' });
}

/**
 * Require at least one of the given permissions (or Super Admin).
 * Use after requireAuth. Backend source of truth for access control.
 * @param {string|string[]} permissionOrList - Single permission name or array (any one required).
 */
function requirePermission(permissionOrList) {
  const list = Array.isArray(permissionOrList)
    ? permissionOrList
    : [permissionOrList];
  return (req, res, next) => {
    if (req.isSuperAdmin) {
      return next();
    }
    const names = req.permissionNames || [];
    const hasAny = list.some((p) => names.includes(p));
    if (hasAny) {
      return next();
    }
    return res.status(403).json({
      error: 'Insufficient permissions',
      code: 'FORBIDDEN_PERMISSION',
    });
  };
}

/**
 * Allow if req.userId === req.params.id (self) OR has one of the permissions.
 * Use for GET /users/:id so user can load own profile.
 * @param {string|string[]} permissionOrList - Permission(s); any one required when not self.
 */
function allowSelfOrPermission(permissionOrList) {
  const list = Array.isArray(permissionOrList)
    ? permissionOrList
    : [permissionOrList];
  return (req, res, next) => {
    if (req.isSuperAdmin) return next();
    if (req.userId && req.params.id && req.userId === req.params.id) {
      return next();
    }
    const names = req.permissionNames || [];
    const hasAny = list.some((p) => names.includes(p));
    if (hasAny) return next();
    return res.status(403).json({
      error: 'Insufficient permissions',
      code: 'FORBIDDEN_PERMISSION',
    });
  };
}

/**
 * Optional auth: attach user if token present, otherwise continue without req.user.
 */
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
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  allowSelfOrPermission,
  optionalAuth,
};
