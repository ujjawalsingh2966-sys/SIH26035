import { Request, Response, NextFunction } from 'express';
import { testCaseStore } from '../repositories';
import { RepositoryService } from '../services/RepositoryService';

export function requireTestCaseAccess(id: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const testCase = await testCaseStore.findById(id(req));
      if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });
      if (!req.user || !RepositoryService.userHasAccess(testCase, req.user)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot access this test case' });
      }
      next();
    } catch (error) { next(error); }
  };
}

// Mandatory for transitions: an old browser tab must not act on a later review cycle.
export async function requireCurrentRevision(req: Request, res: Response, next: NextFunction) {
  try {
    const testCase = await testCaseStore.findById(req.params.id);
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });
    if (!Number.isInteger(req.body?.expectedRevision) || req.body.expectedRevision < 0) {
      return res.status(400).json({ success: false, error: 'expectedRevision is required; refresh the record first' });
    }
    if (req.body.expectedRevision !== (testCase.revision ?? 0)) {
      return res.status(409).json({ success: false, error: 'This record has changed. Refresh before trying again.' });
    }
    req.recheckRevision = true;
    next();
  } catch (error) { next(error); }
}
