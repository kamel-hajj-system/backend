const userService = require('../services/userService');
const authService = require('../services/authService');
const activityService = require('../services/activityService');
const { ActivityAction } = require('../models/constants');

/**
 * POST /users/login
 */
async function login(req, res, next) {
  try {
    const email = req.body?.email;
    const password = req.body?.password;
    if (email == null || password == null || String(email).trim() === '' || String(password) === '') {
      return res.status(400).json({ error: 'email and password are required' });
    }
    let result = await authService.authenticateSuperAdmin(email, password);
    if (!result) {
      result = await authService.authenticate(email, password);
    }
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const u = result.user;
    const direct = (u.userPermissions || []).map((up) => up.permission?.name).filter(Boolean);
    const fromGroups = (u.userGroups || []).flatMap((ug) =>
      (ug.group?.permissions || []).map((gp) => gp.permission?.name).filter(Boolean)
    );
    const permissionNames = [...new Set([...direct, ...fromGroups])];
    result.user = { ...u, permissionNames };
    try {
      await activityService.logActivity({
        userId: result.user.id,
        action: ActivityAction.LOGIN,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
      });
    } catch (logErr) {
      console.error('Activity log failed (login still succeeds):', logErr);
    }
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /users/logout (optional: can be client-side token discard; we only log if authenticated)
 */
async function logout(req, res, next) {
  try {
    if (req.userId) {
      await activityService.logActivity({
        userId: req.userId,
        action: ActivityAction.LOGOUT,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
      });
    }
    return res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/me — current user with permissions (for frontend auth state).
 */
async function getMe(req, res, next) {
  try {
    return res.json(req.user);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users
 */
async function getUsers(req, res, next) {
  try {
    const { page, limit, isActive, role, locationId } = req.query;
    const options = { page, limit, role, locationId: locationId || undefined };
    if (isActive !== undefined) {
      options.isActive = isActive === true || isActive === 'true';
    }
    const result = await userService.getUsers(options);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/:id
 */
async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /users/register/employee — public; role=Employee, userType=Company.
 */
async function registerEmployee(req, res, next) {
  try {
    const user = await userService.registerEmployee(req.body);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    if (err.code === 'SHIFT_NOT_FOUND') return res.status(400).json({ error: err.message });
    if (err.code === 'SHIFT_NOT_FOR_EMPLOYEE') return res.status(400).json({ error: err.message });
    if (err.code === 'LOCATION_INVALID') return res.status(400).json({ error: err.message });
    next(err);
  }
}

/**
 * POST /users/register/service-center — public; role=Supervisor, userType=ServiceCenter.
 */
async function registerServiceCenter(req, res, next) {
  try {
    const user = await userService.registerServiceCenter(req.body);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    next(err);
  }
}

/**
 * POST /users — Super Admin only.
 */
async function createUser(req, res, next) {
  try {
    const actorId = req.userId || null;
    const user = await userService.createUser(req.body, actorId);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    next(err);
  }
}

/**
 * PATCH /users/:id
 */
async function updateUser(req, res, next) {
  try {
    const actorId = req.userId || null;
    const user = await userService.updateUser(req.params.id, req.body, actorId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    next(err);
  }
}

/**
 * DELETE /users/:id (soft delete)
 */
async function softDeleteUser(req, res, next) {
  try {
    const actorId = req.userId || null;
    const user = await userService.softDeleteUser(req.params.id, actorId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ message: 'User deleted', user });
  } catch (err) {
    if (err.code === 'SUPER_ADMIN_PROTECTED') {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * POST /users/:id/change-password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const actorId = req.userId || null;
    await userService.changePassword(
      req.params.id,
      currentPassword,
      newPassword,
      actorId
    );
    return res.json({ message: 'Password changed' });
  } catch (err) {
    if (err.code === 'INVALID_PASSWORD') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * POST /users/:id/assign-role
 */
async function assignRole(req, res, next) {
  try {
    const actorId = req.userId || null;
    const user = await userService.assignRole(req.params.id, req.body.role, actorId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    if (err.code === 'SUPER_ADMIN_PROTECTED') {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * POST /users/:id/assign-permissions
 */
async function assignPermissions(req, res, next) {
  try {
    const actorId = req.userId || null;
    const user = await userService.assignPermissions(
      req.params.id,
      req.body.permissionIds || [],
      actorId
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  logout,
  getMe,
  registerEmployee,
  registerServiceCenter,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  softDeleteUser,
  changePassword,
  assignRole,
  assignPermissions,
};
