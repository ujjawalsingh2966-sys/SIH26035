import fs from 'fs';
import path from 'path';

// Reuse the existing development-only default without publishing it in fixtures.
export function developmentStaffPassword(): string {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/routes/auth.routes.ts'), 'utf8');
  const match = source.match(/if\s*\(password !== '([^']+)'\)/);
  if (!match) throw new Error('Development staff login changed; update the local test fixture setup');
  return match[1];
}
