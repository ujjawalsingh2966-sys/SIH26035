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

export const testCaseRoutes = Router();

testCaseRoutes.get('/', requireRole(['Technician', 'Reviewer', 'Administrator']), (req, res) => {
  const user = (req as any).user;
  const allTests = testCaseStore.findAll();

  res.json({ success: true, data: allTests.filter(tc => RepositoryService.userHasAccess(tc, user)) });
});

testCaseRoutes.use('/:id', requireTestCaseAccess(req => req.params.id));

testCaseRoutes.post(
  '/',
  requireRole(['Technician']),
  body('instrumentId').notEmpty(),
  validateRequest,
  (req: Request, res: Response) => {
    const { instrumentId } = req.body;
    const instrument = instrumentStore.findById(instrumentId);
    if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
    
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
      id: `tc_${Date.now()}`,
      instrumentId: instrument.id,
      technicianId: userId,
      status: 'DRAFT',
      revision: 0,
      testConfiguration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    testCaseStore.saveItem(newTestCase);
    
    AuditService.recordEvent({
      testCaseId: newTestCase.id,
      actorId: userId,
      actorRole: userRole,
      action: 'CREATE_TEST',
      newState: 'DRAFT'
    });

    res.status(201).json({ success: true, data: newTestCase });
  }
);

testCaseRoutes.put(
  '/:id/laboratory-conditions',
  requireRole(['Technician']),
  body('temperature').isString(),
  body('humidity').isString(),
  body('pressure').isString(),
  validateRequest,
  (req: Request, res: Response) => {
    const testCase = testCaseStore.findById(req.params.id);
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
    touchTestCase(testCase);
    AuditService.recordEvent({
      testCaseId: testCase.id, actorId: user.id, actorRole: user.role,
      action: 'LABORATORY_CONDITIONS_UPDATED',
      metadata: { previousConditions, conditions: testCase.laboratoryConditions }
    });
    res.json({ success: true, data: testCase });
  }
);

// Workflow state changes
testCaseRoutes.post('/:id/workflow/submit', requireRole(['Technician']), requireCurrentRevision, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.submitForReview(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post('/:id/workflow/start-review', requireRole(['Reviewer', 'Administrator']), requireCurrentRevision, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.startReview(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post(
  '/:id/workflow/return',
  requireRole(['Reviewer', 'Administrator']),
  body('reason').isString().bail().trim().notEmpty(),
  validateRequest,
  requireCurrentRevision,
  (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.returnForCorrection(req.params.id, user.id, user.role, req.body.reason);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post('/:id/workflow/approve', requireRole(['Reviewer', 'Administrator']), requireCurrentRevision, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.approve(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.put(
  '/:id/status',
  requireRole(['Technician']),
  body('status').isIn(['TESTING']),
  validateRequest,
  requireCurrentRevision,
  (req: Request, res: Response) => {
    try {
      const testCase = WorkflowService.startTesting(req.params.id, req.user!.id, req.user!.role);
      res.json({ success: true, data: testCase });
    } catch (err: any) {
      res.status(err.status || 400).json({ success: false, error: err.message });
    }
  }
);

testCaseRoutes.get('/:id/audit', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  const history = AuditService.getHistoryForTest(req.params.id);
  res.json({ success: true, data: history });
});

