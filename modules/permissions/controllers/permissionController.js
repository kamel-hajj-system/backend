const permissionService = require('../services/permissionService');

async function list(req, res, next) {
  try {
    const { module: moduleFilter } = req.query;
    const permissions = await permissionService.getPermissions({ module: moduleFilter });
    return res.json(permissions);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const permission = await permissionService.getPermissionById(req.params.id);
    if (!permission) return res.status(404).json({ error: 'Permission not found' });
    return res.json(permission);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const permission = await permissionService.createPermission(req.body);
    return res.status(201).json(permission);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Permission name already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const permission = await permissionService.updatePermission(req.params.id, req.body);
    if (!permission) return res.status(404).json({ error: 'Permission not found' });
    return res.json(permission);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Permission name already exists' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await permissionService.deletePermission(req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Permission not found' });
    next(err);
  }
}

async function getDefaults(req, res, next) {
  try {
    const { userType } = req.query;
    if (!userType) {
      const byType = await permissionService.getDefaultsByUserType();
      return res.json(byType);
    }
    const list = await permissionService.getDefaultPermissions(userType);
    return res.json(list);
  } catch (err) {
    next(err);
  }
}

async function setDefaults(req, res, next) {
  try {
    const { userType, permissionIds } = req.body;
    const list = await permissionService.setDefaultPermissions(userType, permissionIds || []);
    return res.json(list);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getDefaults,
  setDefaults,
};
