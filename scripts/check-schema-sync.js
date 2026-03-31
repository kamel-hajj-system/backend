const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function changedFiles() {
  try {
    const againstMain = run('git diff --name-only origin/main...HEAD');
    if (againstMain) return againstMain.split('\n').filter(Boolean);
  } catch (_) {
    // Fallback for environments without origin/main.
  }

  try {
    const againstPrev = run('git diff --name-only HEAD~1');
    if (againstPrev) return againstPrev.split('\n').filter(Boolean);
  } catch (_) {
    // Initial commit or shallow history.
  }

  return [];
}

function hasRequiredDbPlan(files) {
  return files.some((f) => {
    return (
      f.startsWith('prisma/sql/') ||
      f.startsWith('prisma/migrations/') ||
      f === 'docs/db-change-plan.md'
    );
  });
}

function main() {
  const files = changedFiles();
  const schemaChanged = files.includes('prisma/schema.prisma');

  if (!schemaChanged) {
    console.log('DB guard: prisma/schema.prisma not changed.');
    process.exit(0);
  }

  if (!hasRequiredDbPlan(files)) {
    console.error(
      [
        'DB guard failed: prisma/schema.prisma changed without a DB rollout plan.',
        'Add at least one of these in the same change:',
        '- docs/db-change-plan.md',
        '- prisma/sql/*',
        '- prisma/migrations/*',
        '',
        'Reason: production auto-deploy can crash with P2021 if DB sync is missed.',
      ].join('\n'),
    );
    process.exit(1);
  }

  console.log('DB guard: schema change includes DB rollout plan artifacts.');
}

main();
