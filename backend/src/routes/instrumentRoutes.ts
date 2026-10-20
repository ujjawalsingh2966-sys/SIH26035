import { withPersistence } from '../middlewares/withPersistence';
import { Router } from 'express';
import { instrumentStore, manufacturerStore, testCaseStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { evaluationSupport, saveInstrument } from '../services/MasterDataService';
import { masterDataFailure } from './manufacturerRoutes';
import { RepositoryService } from '../services/RepositoryService';

export const instrumentRoutes = Router();
instrumentRoutes.get('/', withPersistence(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase().slice(0, 160) : '';
  const manufacturers = new Map((await manufacturerStore.findAll()).map(item => [item.id, item]));
  res.json({ success: true, data: (await instrumentStore.findAll()).filter(item => (!req.query.manufacturerId || item.manufacturerId === req.query.manufacturerId)
    && [item.name, item.model, item.serialNumber, manufacturers.get(item.manufacturerId)?.name || ''].some(value => value.toLowerCase().includes(q))) });
}, masterDataFailure));
instrumentRoutes.get('/:id/history', withPersistence(async (req, res) => {
  if (!(await instrumentStore.findById(req.params.id))) return res.status(404).json({ success: false, error: 'Instrument not found' });
  const data = (await testCaseStore.findAll()).filter(tc => tc.instrumentId === req.params.id && RepositoryService.userHasAccess(tc, req.user!))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ success: true, data });
}, masterDataFailure));
instrumentRoutes.get('/:id', withPersistence(async (req, res) => {
  const instrument = (await instrumentStore.findById(req.params.id));
  if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
  return res.json({ success: true, data: { instrument, manufacturer: (await manufacturerStore.findById(instrument.manufacturerId)),
    evaluationSupport: evaluationSupport(instrument), linked: (await testCaseStore.findAll()).some(tc => tc.instrumentId === instrument.id) } });
}, masterDataFailure));
instrumentRoutes.post('/', requireRole(['Technician']), withPersistence(async (req, res) => {
  try { return res.status(201).json({ success: true, data: (await saveInstrument(req.body, req.user!)) }); }
  catch (error) { return masterDataFailure(res, error); }
}, masterDataFailure));
instrumentRoutes.put('/:id', requireRole(['Technician', 'Administrator']), withPersistence(async (req, res) => {
  try { return res.json({ success: true, data: (await saveInstrument(req.body, req.user!, req.params.id)) }); }
  catch (error) { return masterDataFailure(res, error); }
}, masterDataFailure));
