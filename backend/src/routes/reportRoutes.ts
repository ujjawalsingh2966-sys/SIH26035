import { Router, Request, Response } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { ReportService } from '../services/ReportService';

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
    const html = ReportService.generateHtmlReport(req.params.testCaseId, userRole);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

reportRoutes.get('/:testCaseId/pdf', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'Technician';
    const pdfBuffer = ReportService.generatePdfReport(req.params.testCaseId, userRole);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=report-${req.params.testCaseId}.pdf`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
