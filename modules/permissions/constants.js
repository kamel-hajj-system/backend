/**
 * Permission names used for access control. Backend and frontend must use the same names.
 * See docs/PERMISSIONS_REFERENCE.md for full reference.
 */
const Permissions = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_ASSIGN_ROLE: 'users.assign_role',
  USERS_ASSIGN_PERMISSIONS: 'users.assign_permissions',
  LOCATIONS_VIEW: 'locations.view',
  LOCATIONS_MANAGE: 'locations.manage',
  SHIFTS_VIEW: 'shifts.view',
  SHIFTS_MANAGE: 'shifts.manage',
  PERMISSIONS_VIEW: 'permissions.view',
  PERMISSIONS_MANAGE: 'permissions.manage',
  TEST_PERMISSION_ROLE: 'test.permission_role',
});

/** All permission names as array. */
const ALL_PERMISSION_NAMES = Object.values(Permissions);

/** Default permissions for userType Company (employees). */
const DEFAULT_PERMISSIONS_COMPANY = [
  Permissions.DASHBOARD_VIEW,
  Permissions.LOCATIONS_VIEW,
  Permissions.SHIFTS_VIEW,
];

/** Default permissions for userType ServiceCenter. */
const DEFAULT_PERMISSIONS_SERVICE_CENTER = [
  Permissions.DASHBOARD_VIEW,
  Permissions.LOCATIONS_VIEW,
  Permissions.SHIFTS_VIEW,
];

/** Full permission definitions for seeding (name, module, description). */
const PERMISSION_SEED = [
  { name: Permissions.DASHBOARD_VIEW, module: 'Portal', description: 'View portal dashboard' },
  { name: Permissions.USERS_VIEW, module: 'Super Admin', description: 'View users list and details' },
  { name: Permissions.USERS_CREATE, module: 'Super Admin', description: 'Create new users' },
  { name: Permissions.USERS_UPDATE, module: 'Super Admin', description: 'Update users' },
  { name: Permissions.USERS_DELETE, module: 'Super Admin', description: 'Soft delete users' },
  { name: Permissions.USERS_ASSIGN_ROLE, module: 'Super Admin', description: 'Assign role to user' },
  { name: Permissions.USERS_ASSIGN_PERMISSIONS, module: 'Super Admin', description: 'Assign permissions to user' },
  { name: Permissions.LOCATIONS_VIEW, module: 'Super Admin', description: 'View locations list' },
  { name: Permissions.LOCATIONS_MANAGE, module: 'Super Admin', description: 'Create, edit, activate/deactivate locations' },
  { name: Permissions.SHIFTS_VIEW, module: 'Super Admin', description: 'View shifts list' },
  { name: Permissions.SHIFTS_MANAGE, module: 'Super Admin', description: 'Create and edit shifts' },
  { name: Permissions.PERMISSIONS_VIEW, module: 'Super Admin', description: 'View permissions and defaults' },
  { name: Permissions.PERMISSIONS_MANAGE, module: 'Super Admin', description: 'Create, edit, delete permissions; set defaults' },
  { name: Permissions.TEST_PERMISSION_ROLE, module: 'Portal', description: 'Test page: Permission and Role (for testing access control)' },
];

module.exports = {
  Permissions,
  ALL_PERMISSION_NAMES,
  DEFAULT_PERMISSIONS_COMPANY,
  DEFAULT_PERMISSIONS_SERVICE_CENTER,
  PERMISSION_SEED,
};
