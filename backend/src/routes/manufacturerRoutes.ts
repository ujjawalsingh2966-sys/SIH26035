import { Router } from 'express';
import { manufacturerStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { archiveManufacturer, MasterDataError, saveManufacturer } from '../services/MasterDataService';

export const manufacturerRoutes = Router();

export function masterDataFailure(res: import('express').Response, error: unknown) {
  return res.status(error instanceof MasterDataError ? error.status : 503).json({ success: false, error: error instanceof MasterDataError ? error.message : 'Master data could not be saved. Refresh before retrying.' });
}
manufacturerRoutes.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().slice(0, 160) : '';
  res.json({ success: true, data: manufacturerStore.findAll().filter(item => (req.query.includeArchived === 'true' || item.active !== false)
    && [item.name, item.identifier, item.address].some(value => value.toLowerCase().includes(q))) });
});
manufacturerRoutes.get('/:id', (req, res) => {
  const data = manufacturerStore.findById(req.params.id);
  return data ? res.json({ success: true, data }) : res.status(404).json({ success: false, error: 'Manufacturer not found' });
});
manufacturerRoutes.post('/', requireRole(['Technician', 'Administrator']), (req, res) => {
  try { return res.status(201).json({ success: true, data: saveManufacturer(req.body, req.user!) }); }
  catch (error) { return masterDataFailure(res, error); }
});
manufacturerRoutes.put('/:id', requireRole(['Technician', 'Administrator']), (req, res) => {
  try { return res.json({ success: true, data: saveManufacturer(req.body, req.user!, req.params.id) }); }
  catch (error) { return masterDataFailure(res, error); }
});
manufacturerRoutes.delete('/:id', requireRole(['Technician', 'Administrator']), (req, res) => {
  try { return res.json({ success: true, data: archiveManufacturer(req.params.id, req.body.expectedRevision, req.user!) }); }
  catch (error) { return masterDataFailure(res, error); }
});
