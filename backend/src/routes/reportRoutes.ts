import { Router, Request, Response } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { ReportService } from '../services/ReportService';
import { AuditService } from '../services/AuditService';

export const reportRoutes = Router();

reportRoutes.get('/:testCaseId/data', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const data = ReportService.generateReportData(req.params.testCaseId, userRole);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

reportRoutes.get('/:testCaseId/html', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const userId = (req as any).user?.id || 'system';
    const html = ReportService.generateHtmlReport(req.params.testCaseId, userRole);

    // Track report generation in audit log
    AuditService.recordEvent({
      testCaseId: req.params.testCaseId,
      action: 'REPORT_GENERATED',
      actorId: userId,
      actorRole: userRole,
      metadata: { details: 'HTML report artifact generated and downloaded' }
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

reportRoutes.get('/:testCaseId/pdf', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const userId = (req as any).user?.id || 'system';
    const pdfBuffer = ReportService.generatePdfReport(req.params.testCaseId, userRole);

    // Track report generation in audit log
    AuditService.recordEvent({
      testCaseId: req.params.testCaseId,
      action: 'REPORT_GENERATED',
      actorId: userId,
      actorRole: userRole,
      metadata: { details: 'PDF report artifact generated and downloaded' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.testCaseId}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
