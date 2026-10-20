import { withPersistence } from '../middlewares/withPersistence';
import { touchTestCase } from '../services/TestCaseRevision';
import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { instrumentStore, testCaseStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ApplicableTests, TestCase } from '../types/domain';
import { WorkflowService } from '../services/WorkflowService';
import { AuditService } from '../services/AuditService';
import { RepositoryService } from '../services/RepositoryService';
import { requireTestCaseAccess, requireCurrentRevision } from '../middlewares/testCaseAccess';
import { finiteDecimal } from '../calculations/unitConversion';
import { evaluationSupport, MasterDataError, validateInstrument } from '../services/MasterDataService';
import { manufacturerStore } from '../repositories';
import { randomUUID } from 'crypto';

export const testCaseRoutes = Router();

testCaseRoutes.get('/', requireRole(['Technician', 'Reviewer', 'Administrator']), withPersistence(async (req, res) => {
  const user = (req as any).user;
  const allTests = (await testCaseStore.findAll());

  res.json({ success: true, data: allTests.filter(tc => RepositoryService.userHasAccess(tc, user)) });
}));

testCaseRoutes.use('/:id', requireTestCaseAccess(req => req.params.id));

testCaseRoutes.post(
  '/',
  requireRole(['Technician']),
  body('instrumentId').notEmpty(),
  validateRequest,
  withPersistence(async (req: Request, res: Response) => {
    const { instrumentId } = req.body;
    const instrument = (await instrumentStore.findById(instrumentId));
    if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
    const manufacturer = (await manufacturerStore.findById(instrument.manufacturerId));
    try {
      if (!instrument.declaredSpecifications) throw new MasterDataError('Legacy instrument metadata must be explicitly validated before creating a new case', 409);
      const checked = (await validateInstrument({ manufacturerId: instrument.manufacturerId, name: instrument.name, model: instrument.model, serialNumber: instrument.serialNumber,
        isWeighing: instrument.isWeighing, isManual: instrument.isManual, isElectronic: instrument.isElectronic, isSingleRange: instrument.isSingleRange,
        accuracyClass: instrument.accuracyClass, maxCapacity: instrument.declaredSpecifications.maxCapacity,
        minCapacity: instrument.declaredSpecifications.minCapacity, e: instrument.declaredSpecifications.e, d: instrument.declaredSpecifications.d,
        weighingUnit: instrument.declaredSpecifications.unit, hasTare: instrument.hasTare, hasAuxiliaryIndication: instrument.hasAuxiliaryIndication,
        isGrading: instrument.isGrading, softwareControlled: instrument.softwareControlled, softwareIdentification: instrument.softwareIdentification }));
      if ((['maxCapacity', 'minCapacity', 'e', 'd', 'n'] as const).some(key => checked[key] !== instrument[key])) throw new MasterDataError('Saved canonical and declared instrument specifications differ', 409);
    } catch (error) {
      return res.status(409).json({ success: false, error: error instanceof Error ? error.message : 'Invalid instrument metadata' });
    }
    const support = evaluationSupport(instrument);
    if (!support.supported) return res.status(409).json({ success: false, error: support.reasons.join('; ') });

    const userRole = (req as any).user?.role || 'Technician';
    const userId = (req as any).user?.id || 'sys-tech';

    const testConfiguration: ApplicableTests = {
      weighing: 'NOT STARTED',
      eccentricity: 'NOT STARTED',
      repeatability: 'NOT STARTED',
      tare: instrument.hasTare ? 'NOT STARTED' : 'NOT APPLICABLE',
      zeroSetting: 'NOT STARTED'
    };

    const newTestCase: TestCase = {
      id: `tc_${randomUUID()}`,
      instrumentId: instrument.id,
      technicianId: userId,
      status: 'DRAFT',
      revision: 0,
      testConfiguration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      masterDataSnapshot: { version: 'W8LAB-MASTER-1', capturedAt: new Date().toISOString(),
        instrument: JSON.parse(JSON.stringify(instrument)), manufacturer: JSON.parse(JSON.stringify(manufacturer)) }
    };

    (await testCaseStore.saveItem(newTestCase));

    (await AuditService.recordEvent({
      testCaseId: newTestCase.id,
      actorId: userId,
      actorRole: userRole,
      action: 'CREATE_TEST',
      newState: 'DRAFT'
    }));

    res.status(201).json({ success: true, data: newTestCase });
  })
);

testCaseRoutes.put(
  '/:id/laboratory-conditions',
  requireRole(['Technician']),
  body('temperature').custom(value => { finiteDecimal(value, 'Temperature'); return true; }),
  body('humidity').custom(value => { const parsed = finiteDecimal(value, 'Humidity'); return parsed.gte(0) && parsed.lte(100); }).withMessage('Humidity must be a decimal from 0 to 100%'),
  body('pressure').custom(value => finiteDecimal(value, 'Pressure').gt(0)).withMessage('Pressure must be a positive decimal in hPa'),
  validateRequest,
  withPersistence(async (req: Request, res: Response) => {
    const testCase = (await testCaseStore.findById(req.params.id));
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });

    const user = (req as any).user;
    if (user.role === 'Technician' && testCase.technicianId !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify test case assigned to another technician' });
    }

    // Lock condition
    if (testCase.status !== 'DRAFT' && testCase.status !== 'TESTING') {
      return res.status(403).json({ success: false, error: 'Cannot modify a test case in this state' });
    }

    const previousConditions = testCase.laboratoryConditions;
    testCase.laboratoryConditions = {
      temperature: req.body.temperature,
      humidity: req.body.humidity,
      pressure: req.body.pressure,
    };
    (await touchTestCase(testCase));
    (await AuditService.recordEvent({
      testCaseId: testCase.id, actorId: user.id, actorRole: user.role,
      action: 'LABORATORY_CONDITIONS_UPDATED',
      metadata: { previousConditions, conditions: testCase.laboratoryConditions }
    }));
    res.json({ success: true, data: testCase });
  })
);

// Workflow state changes
testCaseRoutes.post('/:id/workflow/submit', requireRole(['Technician']), requireCurrentRevision, withPersistence(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = (await WorkflowService.submitForReview(req.params.id, user.id, user.role));
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
}));

testCaseRoutes.post('/:id/workflow/start-review', requireRole(['Reviewer', 'Administrator']), requireCurrentRevision, withPersistence(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = (await WorkflowService.startReview(req.params.id, user.id, user.role));
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
}));

testCaseRoutes.post(
  '/:id/workflow/return',
  requireRole(['Reviewer', 'Administrator']),
  body('reason').isString().bail().trim().notEmpty(),
  validateRequest,
  requireCurrentRevision,
  withPersistence(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = (await WorkflowService.returnForCorrection(req.params.id, user.id, user.role, req.body.reason));
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
}));

testCaseRoutes.post('/:id/workflow/approve', requireRole(['Reviewer', 'Administrator']), requireCurrentRevision, withPersistence(async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = (await WorkflowService.approve(req.params.id, user.id, user.role));
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
}));

testCaseRoutes.put(
  '/:id/status',
  requireRole(['Technician']),
  body('status').isString().bail().isIn(['TESTING']),
  validateRequest,
  requireCurrentRevision,
  withPersistence(async (req: Request, res: Response) => {
    try {
      const testCase = (await WorkflowService.startTesting(req.params.id, req.user!.id, req.user!.role));
      res.json({ success: true, data: testCase });
    } catch (err: any) {
      res.status(err.status || 400).json({ success: false, error: err.message });
    }
  })
);

testCaseRoutes.get('/:id/audit', requireRole(['Technician', 'Reviewer', 'Administrator']), withPersistence(async (req: Request, res: Response) => {
  const history = (await AuditService.getHistoryForTest(req.params.id));
  res.json({ success: true, data: history });
}));

