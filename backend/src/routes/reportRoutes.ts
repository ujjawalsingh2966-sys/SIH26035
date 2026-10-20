import { withPersistence } from '../middlewares/withPersistence';
import { Router, Request, Response } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { requireTestCaseAccess } from '../middlewares/testCaseAccess';
import { ReportService } from '../services/ReportService';
import { AuditService } from '../services/AuditService';

export const reportRoutes = Router();

// Apply the shared record policy before any representation is generated or audited.
reportRoutes.use(
  '/:testCaseId',
  requireRole(['Technician', 'Reviewer', 'Administrator']),
  requireTestCaseAccess(req => req.params.testCaseId)
);

reportRoutes.get('/:testCaseId/data', withPersistence(async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const data = (await ReportService.generateReportData(req.params.testCaseId, userRole));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}, (res, error) => res.status(400).json({ success: false, error: error.message })));

reportRoutes.get('/:testCaseId/html', withPersistence(async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const userId = (req as any).user?.id || 'system';
    const html = (await ReportService.generateHtmlReport(req.params.testCaseId, userRole));

    // Track report generation in audit log
    (await AuditService.recordEvent({
      testCaseId: req.params.testCaseId,
      action: 'REPORT_GENERATED',
      actorId: userId,
      actorRole: userRole,
      metadata: { details: 'HTML report artifact generated and downloaded' }
    }));

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}, (res, error) => res.status(400).json({ success: false, error: error.message })));

reportRoutes.get('/:testCaseId/pdf', withPersistence(async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const userId = (req as any).user?.id || 'system';
    const pdfBuffer = (await ReportService.generatePdfReport(req.params.testCaseId, userRole));

    // Track report generation in audit log
    (await AuditService.recordEvent({
      testCaseId: req.params.testCaseId,
      action: 'REPORT_GENERATED',
      actorId: userId,
      actorRole: userRole,
      metadata: { details: 'PDF report artifact generated and downloaded' }
    }));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.testCaseId}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}, (res, error) => res.status(400).json({ success: false, error: error.message })));
