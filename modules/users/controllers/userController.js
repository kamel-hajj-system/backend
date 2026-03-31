const userService = require('../services/userService');
const authService = require('../services/authService');
const { logAudit } = require('../services/auditLogService');

async function login(req, res, next) {
  try {
    const email = req.body?.email;
    const password = req.body?.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    let result = await authService.authenticateSuperAdmin(email, password);
    if (!result) {
      result = await authService.authenticate(email, password);
    }
    if (result?.pendingApproval) {
      return res.status(403).json({
        error:
          'Your account is not active. If you just registered, wait until HR activates it; otherwise contact your administrator.',
        code: 'ACCOUNT_INACTIVE',
      });
    }
    if (!result) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await logAudit({ req, userId: result.user?.id, action: 'auth.login', entity: 'user', entityId: result.user?.id, meta: { isSuperAdmin: !!result.user?.isSuperAdmin } });
    // Set refresh token in httpOnly cookie
    if (result.refreshToken) {
      res.cookie('kamel_refresh', result.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/api/users/refresh',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    const { refreshToken, ...safe } = result;
    return res.json(safe);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  const token = req.cookies?.kamel_refresh;
  if (token) await authService.revokeRefreshToken(token);
  res.clearCookie('kamel_refresh', { path: '/api/users/refresh' });
  await logAudit({ req, userId: req.user?.id, action: 'auth.logout', entity: 'user', entityId: req.user?.id });
  return res.json({ message: 'Logged out' });
}

async function getMe(req, res) {
  return res.json(req.user);
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.kamel_refresh;
    const result = await authService.rotateRefreshToken(token);
    if (!result) return res.status(401).json({ error: 'Invalid refresh session' });
    await logAudit({ req, userId: result.user?.id, action: 'auth.refresh', entity: 'user', entityId: result.user?.id });
    res.cookie('kamel_refresh', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/users/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    const { refreshToken, ...safe } = result;
    return res.json(safe);
  } catch (err) {
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const { page, limit, isActive, role, locationId, userType, q } = req.query;
    const options = { page, limit, role, userType, q, locationId: locationId || undefined };
    if (isActive !== undefined) {
      options.isActive = isActive === true || isActive === 'true';
    }
    if (req.path.startsWith('/hr/')) {
      options.excludeSuperAdmin = true;
    }
    const result = await userService.getUsers(options);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function bulkAssignSupervisor(req, res, next) {
  try {
    const result = await userService.bulkAssignSupervisor(req.body);
    return res.json(result);
  } catch (err) {
    if (err.code === 'SUPERVISOR_INVALID') return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    next(err);
  }
}

async function registerEmployee(req, res, next) {
  try {
    const user = await userService.registerEmployee(req.body);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    if (err.code === 'INVALID_SUPERVISOR') return res.status(400).json({ error: err.message });
    if (err.code === 'INVALID_SHIFT' || err.code === 'INVALID_SHIFT_FOR_LOCATION') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function listSupervisorsForSignup(req, res, next) {
  try {
    const { locationId } = req.query || {};
    const data = await userService.listSupervisorsForEmployeeSignup(locationId);
    return res.json({ data });
  } catch (err) {
    next(err);
  }
}

async function registerServiceCenter(req, res, next) {
  try {
    const user = await userService.registerServiceCenter(req.body);
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    if (err.code === 'INVALID_SERVICE_CENTER' || err.code === 'SERVICE_CENTER_REQUIRED') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    await logAudit({ req, userId: req.user?.id, action: 'user.create', entity: 'user', entityId: user?.id });
    return res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await logAudit({ req, userId: req.user?.id, action: 'user.update', entity: 'user', entityId: user?.id });
    return res.json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
    next(err);
  }
}

async function softDeleteUser(req, res, next) {
  try {
    const user = await userService.softDeleteUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await logAudit({ req, userId: req.user?.id, action: 'user.delete', entity: 'user', entityId: user?.id });
    return res.json({ message: 'User deleted', user });
  } catch (err) {
    if (err.code === 'SUPER_ADMIN_PROTECTED') return res.status(403).json({ error: err.message });
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.params.id, currentPassword, newPassword);
    await userService.bumpTokenVersion(req.params.id);
    await authService.revokeUserRefreshSessions(req.params.id);
    await logAudit({ req, userId: req.user?.id, action: 'user.change_password', entity: 'user', entityId: req.params.id });
    return res.json({ message: 'Password changed' });
  } catch (err) {
    if (err.code === 'INVALID_PASSWORD') return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function hrResetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    await userService.resetPassword(req.params.id, newPassword);
    await userService.bumpTokenVersion(req.params.id);
    await authService.revokeUserRefreshSessions(req.params.id);
    await logAudit({ req, userId: req.user?.id, action: 'user.reset_password', entity: 'user', entityId: req.params.id });
    return res.json({ message: 'Password reset' });
  } catch (err) {
    if (err.code === 'SUPER_ADMIN_PROTECTED') return res.status(403).json({ error: err.message });
    next(err);
  }
}

async function setAccessGrants(req, res, next) {
  try {
    const { userIds, codes } = req.body || {};
    const result = await userService.setUserAccessGrants(userIds || [], codes || []);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAccessGrants(req, res, next) {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const codes = await userService.getUserAccessGrants(userId);
    return res.json({ userId, codes });
  } catch (err) {
    next(err);
  }
}

async function getSupervisorsTree(req, res, next) {
  try {
    const { locationId, q, includeInactive } = req.query || {};
    const list = await userService.getSupervisorsTree({
      locationId: locationId || undefined,
      q,
      includeInactive: includeInactive === undefined ? true : includeInactive === true || includeInactive === 'true',
    });
    return res.json({ data: list });
  } catch (err) {
    next(err);
  }
}

async function getMyEmployees(req, res, next) {
  try {
    const { q, includeInactive } = req.query || {};
    const result = await userService.getMyEmployees(req.user.id, {
      q,
      includeInactive: includeInactive === undefined ? true : includeInactive === true || includeInactive === 'true',
    });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function patchMyEmployeeRole(req, res, next) {
  try {
    const { role } = req.body || {};
    const user = await userService.updateMyEmployeeRole(req.user.id, req.params.id, role);
    return res.json(user);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'INVALID_ROLE') return res.status(400).json({ error: err.message, code: err.code });
    next(err);
  }
}

async function listPendingRegistrations(req, res, next) {
  try {
    const list = await userService.listPendingRegistrations(req.user);
    return res.json({ data: list });
  } catch (err) {
    next(err);
  }
}

async function approvePendingUser(req, res, next) {
  try {
    const { role } = req.body || {};
    const user = await userService.approvePendingUser(req.user, req.params.id, role);
    return res.json(user);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'OUT_OF_SCOPE' || err.code === 'ALREADY_APPROVED' || err.code === 'INVALID_ROLE') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function listSupervisorPendingRegistrations(req, res, next) {
  try {
    const list = await userService.listPendingRegistrationsForSupervisor(req.user.id);
    return res.json({ data: list });
  } catch (err) {
    next(err);
  }
}

async function approveSupervisorPendingUser(req, res, next) {
  try {
    const { role } = req.body || {};
    const user = await userService.approvePendingUserForSupervisor(req.user, req.params.id, role);
    return res.json(user);
  } catch (err) {
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'OUT_OF_SCOPE' || err.code === 'ALREADY_APPROVED' || err.code === 'INVALID_ROLE') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

async function listDelegatedVisibility(req, res, next) {
  try {
    const result = await userService.listDelegatedVisibilityGrouped();
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function setDelegatedVisibility(req, res, next) {
  try {
    const { visibleUserIds } = req.body || {};
    const result = await userService.setDelegatedVisibilityForViewer(req.params.viewerId, visibleUserIds);
    await logAudit({
      req,
      userId: req.user?.id,
      action: 'delegated_visibility.set',
      entity: 'user',
      entityId: req.params.viewerId,
      meta: { count: result.updated },
    });
    return res.json(result);
  } catch (err) {
    if (err.code === 'INVALID_VIEWER' || err.code === 'INVALID_VISIBLE_USERS') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

module.exports = {
  login,
  logout,
  refresh,
  getMe,
  registerEmployee,
  listSupervisorsForSignup,
  registerServiceCenter,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  softDeleteUser,
  changePassword,
  hrResetPassword,
  setAccessGrants,
  getAccessGrants,
  bulkAssignSupervisor,
  getSupervisorsTree,
  getMyEmployees,
  patchMyEmployeeRole,
  listPendingRegistrations,
  approvePendingUser,
  listSupervisorPendingRegistrations,
  approveSupervisorPendingUser,
  listDelegatedVisibility,
  setDelegatedVisibility,
};
