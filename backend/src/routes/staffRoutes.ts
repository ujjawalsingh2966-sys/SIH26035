import { Router } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { createStaff, publicStaff, staffStore, StaffError, updateStaff } from '../services/StaffService';
import { DuplicateAccountError } from '../services/AccountService';

export const staffRoutes = Router();
staffRoutes.use(requireRole(['Administrator']));
function failure(res: import('express').Response, error: unknown) {
  const status = error instanceof StaffError ? error.status : error instanceof DuplicateAccountError ? 409 : 503;
  return res.status(status).json({ success: false, error: status === 503 ? 'Staff change could not be saved. Refresh before retrying.' : (error as Error).message });
}
staffRoutes.get('/', (_req, res) => res.json({ success: true, data: staffStore.findAll().map(publicStaff) }));
staffRoutes.post('/', async (req, res) => {
  try {
    if (Object.keys(req.body).some(key => !['name', 'email', 'password', 'role', 'adoptLegacyIdentity'].includes(key))
      || req.body.adoptLegacyIdentity !== undefined && typeof req.body.adoptLegacyIdentity !== 'boolean') throw new StaffError('Unsupported staff provisioning fields');
    const account = await createStaff(req.body, req.user!.id);
    return res.status(201).json({ success: true, data: publicStaff(account) });
  } catch (error) { return failure(res, error); }
});
staffRoutes.patch('/:id', async (req, res) => {
  try { return res.json({ success: true, data: publicStaff(await updateStaff(req.params.id, req.body, req.user!.id)) }); }
  catch (error) { return failure(res, error); }
});
staffRoutes.post('/:id/revoke-sessions', (req, res) => {
  const account = staffStore.findById(req.params.id);
  if (!account) return res.status(404).json({ success: false, error: 'Staff account not found' });
  try {
    staffStore.saveItem({ ...account, credentialVersion: account.credentialVersion + 1, updatedAt: new Date().toISOString(),
      securityHistory: [...(account.securityHistory || []), { action: 'SESSIONS_REVOKED', actorId: req.user!.id, timestamp: new Date().toISOString() }] });
    return res.json({ success: true });
  } catch (error) { return failure(res, error); }
});
