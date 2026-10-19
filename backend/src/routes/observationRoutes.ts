import { touchTestCase } from '../services/TestCaseRevision';
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { observationStore, testCaseStore, instrumentStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ObservationRecord } from '../types/domain';
import { EvaluationService } from '../services/EvaluationService';
import { AuditService } from '../services/AuditService';
import { requireTestCaseAccess } from '../middlewares/testCaseAccess';
import { caseMasterData } from '../services/MasterDataService';
import { nativeProgrammeIssue } from '../services/NativeApplicability';

export const observationRoutes = Router();

observationRoutes.get('/:testCaseId', requireTestCaseAccess(req => req.params.testCaseId), (req, res) => {
  const all = observationStore.findAll();
  const filtered = all.filter(o => o.testCaseId === req.params.testCaseId);
  res.json({ success: true, data: filtered });
});

observationRoutes.post(
  '/',
  requireRole(['Technician']),
  body('testCaseId').notEmpty(),
  body('testType').isString().bail().isIn(['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'TARE', 'ZERO_SETTING']),
  body('sequence').isInt({ min: 1 }).toInt(),
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
    const programmeError = testCase.nativeProgramme === undefined ? undefined : nativeProgrammeIssue(testCase.nativeProgramme);
    if (programmeError) return res.status(409).json({ success: false, error: programmeError });

    const { instrument } = caseMasterData(testCase);
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
    touchTestCase(testCase);

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

// Corrections are allowed only after the owning technician resumes TESTING.
// Keep a complete prior snapshot (including evaluation) in the append-only audit.
observationRoutes.put('/:id', requireRole(['Technician']),
  body('load').isString().notEmpty(),
  body('indication').isString().notEmpty(),
  body('additionalWeights').isString().notEmpty(),
  validateRequest,
  (req, res) => {
    const previous = observationStore.findById(req.params.id);
    if (!previous) return res.status(404).json({ success: false, error: 'Observation not found' });
    const testCase = testCaseStore.findById(previous.testCaseId);
    if (!testCase || testCase.technicianId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Observation belongs to another technician' });
    }
    if (testCase.status !== 'TESTING') {
      return res.status(403).json({ success: false, error: 'Corrections require TESTING status' });
    }
    const programmeError = testCase.nativeProgramme === undefined ? undefined : nativeProgrammeIssue(testCase.nativeProgramme);
    if (programmeError) return res.status(409).json({ success: false, error: programmeError });
    const { instrument } = caseMasterData(testCase);
    if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
    const updated: ObservationRecord = {
      ...previous,
      load: req.body.load, indication: req.body.indication, additionalWeights: req.body.additionalWeights,
      unit: req.body.unit === undefined ? previous.unit : req.body.unit,
      zeroError: req.body.zeroError === undefined ? previous.zeroError : req.body.zeroError
    };
    try {
      updated.evaluation = EvaluationService.evaluateObservation(instrument, updated, testCase.isInitialVerification !== false);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: `Evaluation failed: ${err.message}` });
    }
    AuditService.recordEvent({
      testCaseId: testCase.id, actorId: req.user!.id, actorRole: req.user!.role,
      action: 'OBSERVATION_UPDATED', metadata: { observationId: previous.id, previous, updated }
    });
    observationStore.saveItem(updated);
    touchTestCase(testCase);
    res.json({ success: true, data: updated });
  }
);

observationRoutes.delete('/:id', requireRole(['Technician']), (req, res) => {
  const previous = observationStore.findById(req.params.id);
  if (!previous) return res.status(404).json({ success: false, error: 'Observation not found' });
  const testCase = testCaseStore.findById(previous.testCaseId);
  if (!testCase || testCase.technicianId !== req.user!.id) {
    return res.status(403).json({ success: false, error: 'Forbidden: Observation belongs to another technician' });
  }
  if (testCase.status !== 'TESTING') {
    return res.status(403).json({ success: false, error: 'Corrections require TESTING status' });
  }
  const programmeError = testCase.nativeProgramme === undefined ? undefined : nativeProgrammeIssue(testCase.nativeProgramme);
  if (programmeError) return res.status(409).json({ success: false, error: programmeError });
  AuditService.recordEvent({
    testCaseId: testCase.id, actorId: req.user!.id, actorRole: req.user!.role,
    action: 'OBSERVATION_DELETED', metadata: { observationId: previous.id, previous }
  });
  observationStore.deleteItem(previous.id);
  touchTestCase(testCase);
  res.json({ success: true });
});
