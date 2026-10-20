import type { Repository } from '../../src/repositories/Repository';

/** No production clear port. Existing JSON filesystem tests retain their real clear/failure path. */
export async function clearRepository(repository: Repository<{ id: string }>): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || !process.env.JEST_WORKER_ID) throw new Error('Isolated Jest fixture access required');
  const json = repository as Repository<{ id: string }> & { clear?: () => Promise<void> };
  if (!json.clear) throw new Error('This fixture helper is JSON-only; use an explicitly isolated PostgreSQL fixture');
  await json.clear();
}
