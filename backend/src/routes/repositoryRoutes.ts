import { Router, Request, Response } from 'express';
import { requireRole } from '../middlewares/authResolver';
import { RepositoryService, SearchFilters, Pagination } from '../services/RepositoryService';
import { AuditService } from '../services/AuditService';
import { EvidenceService } from '../services/EvidenceService';
import { testCaseStore, instrumentStore, manufacturerStore } from '../repositories';
import { ReportService } from '../services/ReportService';

export const repositoryRoutes = Router();

// GET /api/v1/repository/dashboard
repositoryRoutes.get('/dashboard', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const metrics = RepositoryService.getDashboardMetrics(user);
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/repository/search
repositoryRoutes.get('/search', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const filters: SearchFilters = {
      query: req.query.q as string,
      testId: req.query.testId as string,
      manufacturer: req.query.manufacturer as string,
      model: req.query.model as string,
      status: req.query.status ? (req.query.status as string).split(',') as any : undefined,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    };

    const pagination: Pagination = {
      page: parseInt(req.query.page as string || '1', 10),
      limit: parseInt(req.query.limit as string || '20', 10)
    };

    if (pagination.page < 1) pagination.page = 1;
    if (pagination.limit > 100) pagination.limit = 100; // prevent excessive query

    const result = RepositoryService.search(filters, pagination, user);
    res.json({ success: true, data: result.data, total: result.total, page: pagination.page, limit: pagination.limit });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/v1/repository/records/:testCaseId
repositoryRoutes.get('/records/:testCaseId', requireRole(['Technician', 'Reviewer', 'Administrator']), (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const testCaseId = req.params.testCaseId;
    const testCase = testCaseStore.findById(testCaseId);

    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    if (!RepositoryService.userHasAccess(testCase, user)) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this record' });
    }

    const instrument = instrumentStore.findById(testCase.instrumentId);
    const manufacturer = instrument ? manufacturerStore.findById(instrument.manufacturerId) : null;

    // Historical contexts from Audit
    const history = AuditService.getHistoryForTest(testCaseId);

    // Evidence associated with the report
    const evidence = EvidenceService.getEvidenceForTestCase(testCaseId);

    // If APPROVED, we can also generate a summary of the compliance report
    let complianceSummary = null;
    if (testCase.status === 'APPROVED') {
      try {
        const reportData = ReportService.generateReportData(testCaseId, user.role);
        complianceSummary = reportData.complianceSummary;
      } catch (e) {
        // Fallback or ignore if generation fails
      }
    }

    res.json({
      success: true,
      data: {
        testCase,
        instrument,
        manufacturer,
        history,
        evidence,
        complianceSummary
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
