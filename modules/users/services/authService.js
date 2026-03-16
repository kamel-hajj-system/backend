const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models');
const { SUPER_ADMIN_EMAIL } = require('../models/constants');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Hash a plain password.
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain password with hash.
 */
async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Generate JWT for a user (exclude passwordHash from payload).
 */
function generateToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin ?? false,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT and return decoded payload.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Find user by email (including soft-deleted for login check to reject deleted users).
 * Includes userPermissions and userGroups with group permissions so login response can merge permission names.
 */
async function findByEmail(email) {
  if (email == null) return null;
  return prisma.user.findFirst({
    where: { email: String(email).trim().toLowerCase() },
    include: {
      userPermissions: { include: { permission: true } },
      userGroups: {
        select: {
          group: {
            select: {
              permissions: {
                select: { permission: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Authenticate by email/password. Returns user + token or null.
 * Rejects inactive or soft-deleted users.
 */
async function authenticate(email, password) {
  const user = await findByEmail(email);
  if (!user || user.isDeleted || !user.isActive) {
    return null;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return null;
  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

/**
 * Super admin login: email must match SUPER_ADMIN_EMAIL from env, password from DB (set by seed).
 * In production, set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in the environment.
 */
async function authenticateSuperAdmin(email, password) {
  if (email == null || password == null) return null;
  const expectedEmail = (SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!expectedEmail || String(email).trim().toLowerCase() !== expectedEmail) return null;
  const user = await prisma.user.findFirst({
    where: { isSuperAdmin: true, email: { equals: SUPER_ADMIN_EMAIL.trim(), mode: 'insensitive' } },
  });
  if (!user || user.isDeleted) return null;
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return null;
  const token = generateToken(user);
  return { user: sanitizeUser(user), token };
}

/**
 * Remove sensitive fields from user object.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  findByEmail,
  authenticate,
  authenticateSuperAdmin,
  sanitizeUser,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
