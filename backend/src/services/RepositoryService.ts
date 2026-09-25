import { testCaseStore, instrumentStore, manufacturerStore, auditStore } from '../repositories';
import { TestCase, Instrument, Manufacturer, TestCaseStatus } from '../types/domain';

export interface SearchFilters {
  query?: string; // Search across testId, instrument model, manufacturer
  testId?: string;
  manufacturer?: string;
  model?: string;
  status?: TestCaseStatus[];
  dateFrom?: string; // ISO date
  dateTo?: string;   // ISO date
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface RepositoryListing {
  testCase: TestCase;
  instrument: Instrument | null;
  manufacturer: Manufacturer | null;
}

export interface DashboardMetrics {
  totalActiveTests: number;
  pendingReview: number;
  returned: number;
  approved: number;
  reportsGenerated: number;
}

export class RepositoryService {
  /**
   * Search across the entire operational repository
   */
  public static search(filters: SearchFilters, pagination: Pagination, user: { id: string; role: string }): { data: RepositoryListing[], total: number } {
    const allTestCases = testCaseStore.findAll();

    let filtered = allTestCases.filter(tc => this.userHasAccess(tc, user));

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(tc => filters.status!.includes(tc.status));
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(tc => new Date(tc.updatedAt).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      filtered = filtered.filter(tc => new Date(tc.updatedAt).getTime() <= to);
    }

    if (filters.testId) {
      filtered = filtered.filter(tc => tc.id.toLowerCase().includes(filters.testId!.toLowerCase()));
    }

    // Join Instrument and Manufacturer mapping to filter further
    let listings: RepositoryListing[] = filtered.map(tc => {
      const instrument = instrumentStore.findById(tc.instrumentId) || null;
      const manufacturer = instrument ? (manufacturerStore.findById(instrument.manufacturerId) || null) : null;
      return { testCase: tc, instrument, manufacturer };
    });

    if (filters.manufacturer) {
      const mfgLower = filters.manufacturer.toLowerCase();
      listings = listings.filter(l => l.manufacturer?.name.toLowerCase().includes(mfgLower) || l.manufacturer?.id.toLowerCase().includes(mfgLower));
    }

    if (filters.model) {
      const mdlLower = filters.model.toLowerCase();
      listings = listings.filter(l => l.instrument?.model.toLowerCase().includes(mdlLower));
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      listings = listings.filter(l =>
        l.testCase.id.toLowerCase().includes(q) ||
        (l.instrument && l.instrument.model.toLowerCase().includes(q)) ||
        (l.manufacturer && l.manufacturer.name.toLowerCase().includes(q))
      );
    }

    // Define default sort (newest first)
    listings.sort((a, b) => new Date(b.testCase.updatedAt).getTime() - new Date(a.testCase.updatedAt).getTime());

    const total = listings.length;
    const startIndex = (pagination.page - 1) * pagination.limit;
    const paginated = listings.slice(startIndex, startIndex + pagination.limit);

    return { data: paginated, total };
  }

  /**
   * Retrieves dashboard metrics for a user
   */
  public static getDashboardMetrics(user: { id: string; role: string }): DashboardMetrics {
    const allTestCases = testCaseStore.findAll();
    const accessible = allTestCases.filter(tc => this.userHasAccess(tc, user));

    const totalActiveTests = accessible.filter(tc => ['DRAFT', 'TESTING'].includes(tc.status)).length;
    const pendingReview = accessible.filter(tc => ['READY_FOR_REVIEW', 'UNDER_REVIEW'].includes(tc.status)).length;
    const returned = accessible.filter(tc => tc.status === 'RETURNED_FOR_CORRECTION').length;
    const approved = accessible.filter(tc => tc.status === 'APPROVED').length;

    const allAudits = auditStore.findAll();
    const generatedAuditEvents = allAudits.filter(a => a.action === 'REPORT_GENERATED');
    const accessibleGenerated = generatedAuditEvents.filter(a => accessible.some(tc => tc.id === a.testCaseId));

    // Unique test cases that have had a report generated
    const uniqueTestCasesGenerated = new Set(accessibleGenerated.map(a => a.testCaseId)).size;

    return {
      totalActiveTests,
      pendingReview,
      returned,
      approved,
      reportsGenerated: uniqueTestCasesGenerated
    };
  }

  /**
   * Determines if a user has baseline access to a test case based on their role
   */
  public static userHasAccess(testCase: TestCase, user: { id: string; role: string }): boolean {
    if (user.role === 'Administrator') return true;

    if (user.role === 'Technician') {
      return testCase.technicianId === user.id;
    }

    if (user.role === 'Reviewer') {
      if (['READY_FOR_REVIEW', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'APPROVED'].includes(testCase.status)) {
        return true;
      }
      return false;
    }

    return false;
  }
}
