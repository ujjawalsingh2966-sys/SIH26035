import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { observationStore, testCaseStore, instrumentStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ObservationRecord, ObservationEvaluation } from '../types/domain';
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
  body('sequence').isInt({ min: 1 }),
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

    const existingObservations = observationStore.findAll().filter(
      o => o.testCaseId === data.testCaseId && o.testType === data.testType
    );
    const seqNum = Number(data.sequence);
    if (existingObservations.some(o => Number(o.sequence) === seqNum)) {
      return res.status(400).json({ success: false, error: `Sequence ${seqNum} already exists for ${data.testType}` });
    }

    const instrument = instrumentStore.findById(testCase.instrumentId);
    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found for this test case' });
    }

    // Live pipeline: Calculation -> Rule -> Compliance. Any failure here (e.g. missing
    // instrument metrological parameters) rejects the observation rather than persisting
    // an unevaluated row, since an unevaluated observation must not silently count as
    // evaluated later.
    let evaluation: ObservationEvaluation;
    try {
      evaluation = EvaluationService.evaluateObservation(
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

    const newObservation: ObservationRecord = {
      id: `obs_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      testCaseId: data.testCaseId,
      testType: data.testType,
      sequence: seqNum,
      load: data.load,
      indication: data.indication,
      additionalWeights: data.additionalWeights,
      unit: data.unit,
      zeroError: data.zeroError,
      evaluation
    };

    observationStore.saveItem(newObservation);

    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId: user.id,
      actorRole: user.role,
      action: 'OBSERVATION_EVALUATED',
      metadata: {
        observationId: newObservation.id,
        testType: newObservation.testType,
        sequence: newObservation.sequence,
        verdict: evaluation.compliance.verdict
      }
    });

    res.status(201).json({ success: true, data: newObservation });
  }
);

observationRoutes.delete(
  '/:id',
  requireRole(['Technician']),
  (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const observation = observationStore.findById(req.params.id);
      if (!observation) {
        return res.status(404).json({ success: false, error: 'Observation not found' });
      }

      const testCase = testCaseStore.findById(observation.testCaseId);
      if (!testCase) {
        return res.status(404).json({ success: false, error: 'Parent test case not found' });
      }

      // Role-based IDOR prevention
      if (user.role === 'Technician' && testCase.technicianId !== user.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot delete observations for test cases assigned to others' });
      }

      if (testCase.status !== 'TESTING') {
        return res.status(403).json({ success: false, error: 'Cannot delete observations unless test case is in TESTING status' });
      }

      observationStore.deleteItem(observation.id);

      AuditService.recordEvent({
        testCaseId: testCase.id,
        actorId: user.id,
        actorRole: user.role,
        action: 'OBSERVATION_DELETED',
        metadata: {
          observationId: observation.id,
          testType: observation.testType,
          sequence: observation.sequence,
          deletedObservation: observation
        }
      });

      res.json({ success: true, message: 'Observation deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Failed to delete observation: ${err.message}` });
    }
  }
);
