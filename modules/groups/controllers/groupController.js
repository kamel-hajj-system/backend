const groupService = require('../services/groupService');

async function list(req, res, next) {
  try {
    const options = {};
    if (req.query.locationId) options.locationId = req.query.locationId;
    const groups = await groupService.getGroups(options);
    return res.json(groups);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const group = await groupService.getGroupById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    return res.json(group);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const group = await groupService.createGroup(req.body);
    return res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const group = await groupService.updateGroup(req.params.id, req.body);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    return res.json(group);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await groupService.deleteGroup(req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Group not found' });
    next(err);
  }
}

async function setPermissions(req, res, next) {
  try {
    const group = await groupService.setGroupPermissions(
      req.params.id,
      req.body.permissionIds || []
    );
    return res.json(group);
  } catch (err) {
    next(err);
  }
}

async function setUsers(req, res, next) {
  try {
    const group = await groupService.setGroupUsers(req.params.id, req.body.userIds || []);
    return res.json(group);
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
  setPermissions,
  setUsers,
};
