const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models');
const { SUPER_ADMIN_EMAIL } = require('../models/constants');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_EXPIRES_DAYS || '30', 10);

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
    tv: user.tokenVersion ?? 0,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT and return decoded payload.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function findByEmail(email) {
  if (email == null) return null;
  return prisma.user.findFirst({
    where: { email: String(email).trim().toLowerCase() },
  });
}

/**
 * Authenticate by email/password. Returns user + token or null.
 * Rejects inactive or soft-deleted users.
 */
async function authenticate(email, password) {
  const user = await findByEmail(email);
  if (!user || user.isDeleted) {
    return null;
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return null;
  /** Password OK but account not active (pending HR or deactivated). */
  if (!user.isActive) {
    return { pendingApproval: true };
  }
  const token = generateToken(user);
  const refresh = await createRefreshSession(user.id);
  return { user: sanitizeUser(user), token, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
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
  const refresh = await createRefreshSession(user.id);
  return { user: sanitizeUser(user), token, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

const crypto = require('crypto');

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function createRefreshSession(userId, replacesSessionId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const created = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      replacedById: null,
    },
    select: { id: true },
  });

  if (replacesSessionId) {
    await prisma.refreshSession.updateMany({
      where: { id: replacesSessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
  }

  return { token, expiresAt };
}

async function rotateRefreshToken(token) {
  if (!token) return null;
  const tokenHash = hashRefreshToken(token);
  const session = await prisma.refreshSession.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          isDeleted: true,
          isActive: true,
          tokenVersion: true,
          email: true,
          role: true,
          isSuperAdmin: true,
        },
      },
    },
  });
  if (!session?.user || session.user.isDeleted || !session.user.isActive) return null;
  const accessToken = generateToken(session.user);
  const refresh = await createRefreshSession(session.userId, session.id);
  return { user: sanitizeUser(session.user), token: accessToken, refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

async function revokeRefreshToken(token) {
  if (!token) return;
  const tokenHash = hashRefreshToken(token);
  await prisma.refreshSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeUserRefreshSessions(userId) {
  if (!userId) return;
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
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
  rotateRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshSessions,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
