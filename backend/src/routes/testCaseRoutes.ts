import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { instrumentStore, testCaseStore } from '../repositories';
import { requireRole } from '../middlewares/authResolver';
import { ApplicableTests, TestCase } from '../types/domain';

export const testCaseRoutes = Router();

testCaseRoutes.get('/', (req, res) => {
  res.json({ success: true, data: testCaseStore.findAll() });
});

testCaseRoutes.post(
  '/',
  requireRole(['Technician']),
  body('instrumentId').notEmpty(),
  (req: Request, res: Response) => {
    const { instrumentId } = req.body;
    const instrument = instrumentStore.findById(instrumentId);

    if (!instrument) {
      return res.status(404).json({ success: false, error: 'Instrument not found' });
    }

    // Phase 2 Applicability Matrix rules mapping
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
      technicianId: (req as any).user?.id || 'sys-tech', // Sourced from JWT
      status: 'DRAFT',
      testConfiguration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    testCaseStore.saveItem(newTestCase);
    res.status(201).json({ success: true, data: newTestCase });
  }
);

testCaseRoutes.put(
  '/:id/laboratory-conditions',
  requireRole(['Technician']),
  body('temperature').isString(),
  body('humidity').isString(),
  body('pressure').isString(),
  (req: Request, res: Response) => {
    const testCase = testCaseStore.findById(req.params.id);
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });

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

testCaseRoutes.put(
  '/:id/status',
  requireRole(['Technician', 'Reviewer']),
  body('status').isIn(['DRAFT', 'TESTING', 'SUBMITTED_FOR_REVIEW']),
  (req: Request, res: Response) => {
    const testCase = testCaseStore.findById(req.params.id);
    if (!testCase) return res.status(404).json({ success: false, error: 'Test case not found' });

    testCase.status = req.body.status;
    testCase.updatedAt = new Date().toISOString();

    testCaseStore.saveItem(testCase);
    res.json({ success: true, data: testCase });
  }
);
