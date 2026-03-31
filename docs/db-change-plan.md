# DB Change Plan

Use this file whenever `prisma/schema.prisma` changes.

## Change summary

- Date:
- Author:
- Branch/commit:
- Why this schema change is needed:

## Change type

- [ ] Add columns
- [ ] Add tables
- [ ] Rename columns/tables (via staged rollout)
- [ ] Remove columns/tables (only after cutover)

## Safety checklist (no data loss default)

- [ ] Change is additive or staged (expand -> migrate data -> contract).
- [ ] No `--accept-data-loss` required.
- [ ] Existing reads/writes remain compatible during rollout.
- [ ] Backup/snapshot plan exists before production deploy.

## Rollout steps (Dokploy)

1. Deploy backend code to `main`.
2. Run in backend container:

   ```bash
   cd /app
   npx prisma db push
   ```

3. Verify:
   - [ ] `/api/health` OK
   - [ ] Endpoints using new schema return 200
   - [ ] No `P2021` / Prisma table missing errors in logs

## Data migration / backfill (if needed)

- Script/SQL:
- Validation query:
- Rollback approach:

## Post-deploy

- [ ] Remove old columns/tables only in a later release after verification.
- [ ] Update this file for next schema change.
