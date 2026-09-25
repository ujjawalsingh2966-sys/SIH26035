import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { observationStore, testCaseStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ObservationRecord } from '../types/domain';

export const observationRoutes = Router();

observationRoutes.get('/:testCaseId', (req, res) => {
  const all = observationStore.findAll();
  const filtered = all.filter(o => o.testCaseId === req.params.testCaseId);
  res.json({ success: true, data: filtered });
});

observationRoutes.post(
  '/',
  requireRole(['Technician']),
  body('testCaseId').notEmpty(),
  body('testType').isIn(['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'TARE', 'ZERO_SETTING']),
  body('sequence').isNumeric(),
  body('load').isString().notEmpty(),
  body('indication').isString().notEmpty(),
  body('additionalWeights').isString().notEmpty(),
  validateRequest,
  (req: Request, res: Response) => {
    const data = req.body;
    const user = (req as any).user;

    const testCase = testCaseStore.findById(data.testCaseId);
    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' });
    }

    // Role-based IDOR prevention
    if (user.role === 'Technician' && testCase.technicianId !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot manipulate observations for test cases assigned to others' });
    }

    if (testCase.status !== 'TESTING') {
      return res.status(403).json({ success: false, error: 'Cannot modify observations unless test case is in TESTING status' });
    }

    const newObservation: ObservationRecord = {
      id: `obs_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      testCaseId: data.testCaseId,
      testType: data.testType,
      sequence: data.sequence,
      load: data.load,
      indication: data.indication,
      additionalWeights: data.additionalWeights
    };

    observationStore.saveItem(newObservation);
    res.status(201).json({ success: true, data: newObservation });
  }
);
