# User Management Module

Enterprise-ready user module with authentication, soft delete, audit logs, and activity tracking.

## Structure

- **controllers/** – HTTP handlers (thin)
- **services/** – Business logic (userService, authService, auditService, activityService)
- **routes/** – REST routes and middleware wiring
- **validations/** – express-validator rules
- **middleware/** – auth (JWT), rate limiting
- **models/** – Prisma client and constants
- **seeds/** – Super admin seed
- **tests/** – API tests

## Environment

- `DATABASE_URL` – PostgreSQL connection (or set via PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT, DB_SSL)
- `JWT_SECRET` – Secret for JWT signing (required in production)
- `JWT_EXPIRES_IN` – Token expiry (default: 7d)
- `LOGIN_RATE_LIMIT_MAX` – Max login attempts per window (default: 10)
- `SENSITIVE_RATE_LIMIT_MAX` – Max sensitive requests per minute (default: 30)
- `SUPER_ADMIN_EMAIL` – Super admin login email (required in production; in dev defaults to `superadmin` if unset)
- `SUPER_ADMIN_PASSWORD` – Super admin login password (set by seed; required in production; in dev defaults to `superadmin` if unset)

## Setup

1. Run migrations: `npm run db:migrate`
2. Seed super admin: `npm run db:seed` (uses `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from env; in production set these before seeding).

## APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/users/login | No | Login (rate limited) |
| POST | /api/users/logout | Optional | Logout |
| GET | /api/users | Yes | List users (paginated) |
| GET | /api/users/:id | Yes | Get user by ID |
| POST | /api/users | Admin | Create user |
| PATCH | /api/users/:id | Yes | Update user |
| DELETE | /api/users/:id | Admin | Soft delete user |
| POST | /api/users/:id/change-password | Yes | Change password |
| POST | /api/users/:id/assign-role | Admin | Assign role |
| POST | /api/users/:id/assign-permissions | Admin | Assign permissions |

Use header: `Authorization: Bearer <token>` for protected routes.

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT for sessions
- Rate limiting on login and sensitive endpoints
- Input validation on all payloads
- Super admin cannot be deleted or role changed
