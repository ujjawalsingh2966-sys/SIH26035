export type PersistenceFailure = 'unavailable' | 'conflict' | 'invalid-record' | 'context' | 'commit-unknown' | 'cleanup';

/** Never retain raw driver errors, their causes, SQL or parameter values. HTTP status is route-owned. */
export class PersistenceError extends Error {
  constructor(public readonly kind: PersistenceFailure = 'unavailable') {
    const messages: Record<PersistenceFailure, string> = {
      unavailable: 'Storage is unavailable. Refresh before retrying.',
      conflict: 'The stored record has changed. Refresh before retrying.',
      'invalid-record': 'Stored record could not be represented safely.',
      context: 'Persistence context is unavailable or does not permit this operation.',
      'commit-unknown': 'Storage commit could not be confirmed. Refresh before retrying.',
      cleanup: 'Storage cleanup could not be confirmed. Refresh before retrying.',
    };
    super(messages[kind]); this.name = 'PersistenceError';
  }
}
