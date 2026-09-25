import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { observationStore, testCaseStore, instrumentStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ObservationRecord } from '../types/domain';
import { EvaluationService } from '../services/EvaluationService';
import { AuditService } from '../services/AuditService';

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

    const instrument = instrumentStore.findById(testCase.instrumentId);
    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found for this test case' });
    }

    const newObservation: ObservationRecord = {
      id: `obs_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      testCaseId: data.testCaseId,
      testType: data.testType,
      sequence: data.sequence,
      load: data.load,
      indication: data.indication,
      additionalWeights: data.additionalWeights,
      unit: data.unit,
      zeroError: data.zeroError
    };

    // Live pipeline: Calculation -> Rule -> Compliance. Any failure here (e.g. missing
    // instrument metrological parameters) rejects the observation rather than persisting
    // an unevaluated row, since an unevaluated observation must not silently count as
    // evaluated later.
    try {
      newObservation.evaluation = EvaluationService.evaluateObservation(
        instrument,
        {
          testType: data.testType,
          load: data.load,
          indication: data.indication,
          additionalWeights: data.additionalWeights,
          unit: data.unit,
          zeroError: data.zeroError
        },
        testCase.isInitialVerification !== false
      );
    } catch (err: any) {
      return res.status(400).json({ success: false, error: `Evaluation failed: ${err.message}` });
    }

    observationStore.saveItem(newObservation);

    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId: user.id,
      actorRole: user.role,
      action: 'OBSERVATION_EVALUATED',
      metadata: {
        observationId: newObservation.id,
        testType: newObservation.testType,
        verdict: newObservation.evaluation.compliance.verdict
      }
    });

    res.status(201).json({ success: true, data: newObservation });
  }
);
