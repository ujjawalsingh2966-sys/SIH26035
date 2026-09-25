import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { requireRole } from '../middlewares/authResolver';
import { validateRequest } from '../middlewares/validateRequest';
import { EvidenceService } from '../services/EvidenceService';

export const evidenceRoutes = Router();

evidenceRoutes.post(
  '/',
  requireRole(['Technician', 'Administrator']),
  body('testCaseId').isString().notEmpty(),
  body('testType').isIn(['WEIGHING', 'ECCENTRICITY', 'REPEATABILITY', 'TARE', 'ZERO_SETTING', 'GENERAL']),
  body('description').isString().notEmpty(),
  body('fileName').isString().notEmpty(),
  body('mimeType').isString().notEmpty(),
  body('sizeBytes').isNumeric(),
  validateRequest,
  (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const data = req.body;

      const evidence = EvidenceService.addEvidence(
        data.testCaseId,
        data.testType,
        data.description,
        data.fileName,
        data.mimeType,
        data.sizeBytes,
        user.id,
        data.fileData
      );

      res.status(201).json({ success: true, data: evidence });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

evidenceRoutes.get('/:testCaseId', requireRole(['Technician', 'Reviewer', 'Administrator']), (req, res) => {
  try {
    const records = EvidenceService.getEvidenceForTestCase(req.params.testCaseId);
    res.json({ success: true, data: records });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
