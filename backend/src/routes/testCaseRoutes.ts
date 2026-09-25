import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { instrumentStore, testCaseStore, auditStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { ApplicableTests, TestCase } from '../types/domain';
import { WorkflowService } from '../services/WorkflowService';
import { AuditService } from '../services/AuditService';

export const testCaseRoutes = Router();

testCaseRoutes.get('/', (req, res) => {
  const user = (req as any).user;
  const allTests = testCaseStore.findAll();

  if (user && user.role === 'Technician') {
    return res.json({ success: true, data: allTests.filter(tc => tc.technicianId === user.id) });
  }

  res.json({ success: true, data: allTests });
});

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
    if (testCase.status === 'APPROVED' || testCase.status === 'UNDER_REVIEW' || testCase.status === 'READY_FOR_REVIEW') {
      return res.status(403).json({ success: false, error: 'Cannot modify a test case in this state' });
    }

    testCase.laboratoryConditions = {
      temperature: req.body.temperature,
      humidity: req.body.humidity,
      pressure: req.body.pressure,
    };
    testCase.updatedAt = new Date().toISOString();

    testCaseStore.saveItem(testCase);
    res.json({ success: true, data: testCase });
  }
);

// Workflow state changes
testCaseRoutes.post('/:id/workflow/submit', requireRole(['Technician']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.submitForReview(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post('/:id/workflow/start-review', requireRole(['Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.startReview(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post(
  '/:id/workflow/return',
  requireRole(['Reviewer', 'Administrator']),
  body('reason').notEmpty(),
  validateRequest,
  (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.returnForCorrection(req.params.id, user.id, user.role, req.body.reason);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.post('/:id/workflow/approve', requireRole(['Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCase = WorkflowService.approve(req.params.id, user.id, user.role);
    res.json({ success: true, data: testCase });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

testCaseRoutes.put(
  '/:id/status',
  requireRole(['Technician']),
  body('status').isIn(['TESTING']),
  validateRequest,
  (req: Request, res: Response) => {
    // Allow DRAFT -> TESTING manually, or RETURNED_FOR_CORRECTION -> TESTING
    const testCase = testCaseStore.findById(req.params.id);
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });

    const user = (req as any).user || {id: 'sys-tech', role: 'Technician'};

    if (user.role === 'Technician' && testCase.technicianId !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (testCase.status !== 'DRAFT' && testCase.status !== 'RETURNED_FOR_CORRECTION') {
      return res.status(400).json({ success: false, error: 'Invalid start testing condition' });
    }

    const previousState = testCase.status;
    testCase.status = 'TESTING';
    testCase.updatedAt = new Date().toISOString();
    testCaseStore.saveItem(testCase);

    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId: user.id,
      actorRole: user.role,
      action: 'START_TESTING',
      previousState,
      newState: 'TESTING'
    });

    res.json({ success: true, data: testCase });
  }
);

testCaseRoutes.get('/:id/audit', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  const history = AuditService.getHistoryForTest(req.params.id);
  res.json({ success: true, data: history });
});

