import { Router } from 'express';
import { instrumentStore, manufacturerStore, testCaseStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { evaluationSupport, saveInstrument } from '../services/MasterDataService';
import { masterDataFailure } from './manufacturerRoutes';
import { RepositoryService } from '../services/RepositoryService';

export const instrumentRoutes = Router();
instrumentRoutes.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().slice(0, 160) : '';
  res.json({ success: true, data: instrumentStore.findAll().filter(item => (!req.query.manufacturerId || item.manufacturerId === req.query.manufacturerId)
    && [item.name, item.model, item.serialNumber, manufacturerStore.findById(item.manufacturerId)?.name || ''].some(value => value.toLowerCase().includes(q))) });
});
instrumentRoutes.get('/:id/history', (req, res) => {
  if (!instrumentStore.findById(req.params.id)) return res.status(404).json({ success: false, error: 'Instrument not found' });
  const data = testCaseStore.findAll().filter(tc => tc.instrumentId === req.params.id && RepositoryService.userHasAccess(tc, req.user!))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, data });
});
instrumentRoutes.get('/:id', (req, res) => {
  const instrument = instrumentStore.findById(req.params.id);
  if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
  return res.json({ success: true, data: { instrument, manufacturer: manufacturerStore.findById(instrument.manufacturerId),
    evaluationSupport: evaluationSupport(instrument), linked: testCaseStore.findAll().some(tc => tc.instrumentId === instrument.id) } });
});
instrumentRoutes.post('/', requireRole(['Technician']), (req, res) => {
  try { return res.status(201).json({ success: true, data: saveInstrument(req.body, req.user!) }); }
  catch (error) { return masterDataFailure(res, error); }
});
instrumentRoutes.put('/:id', requireRole(['Technician', 'Administrator']), (req, res) => {
  try { return res.json({ success: true, data: saveInstrument(req.body, req.user!, req.params.id) }); }
  catch (error) { return masterDataFailure(res, error); }
});
