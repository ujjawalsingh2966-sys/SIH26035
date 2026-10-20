// Offline operator command. Never exposes or accepts a password as a CLI argument.
import { createStaff, staffStore } from '../services/StaffService';

async function main() {
  if ((await staffStore.findAll()).length) throw new Error('Bootstrap is disabled once staff accounts exist. Use an authorized Administrator.');
  if (process.argv.length > 2) throw new Error('Use environment input, not command-line credentials.');
  await createStaff({ name: process.env.W8LAB_BOOTSTRAP_NAME, email: process.env.W8LAB_BOOTSTRAP_EMAIL,
    password: process.env.W8LAB_BOOTSTRAP_PASSWORD, role: 'Administrator',
    adoptLegacyIdentity: process.env.W8LAB_BOOTSTRAP_ADOPT_LEGACY === '1' }, 'offline-bootstrap', true);
  delete process.env.W8LAB_BOOTSTRAP_PASSWORD;
  process.stdout.write('Initial Administrator provisioned. Sign in and use Staff accounts to provision laboratory staff.\n');
}
main().catch(() => {
  process.stderr.write('Bootstrap refused. Use an empty staff store, valid name/email and a private 12–128 character password; stop the backend first. Existing staff require administrator provisioning.\n');
  process.exitCode = 1;
});
