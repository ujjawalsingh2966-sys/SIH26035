import { testCaseStore } from '../repositories';
import { TestCase, TestCaseStatus } from '../types/domain';
import { AuditService } from './AuditService';

export class WorkflowService {
  
  static submitForReview(testCaseId: string, actorId: string, actorRole: string): TestCase {
    // Technician submits for review
    if (actorRole !== 'Technician') throw new Error('Unauthorized');
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new Error('TestCase not found');
    
    if (testCase.status !== 'TESTING' && testCase.status !== 'RETURNED_FOR_CORRECTION') {
      throw new Error(`Invalid transition from ${testCase.status} to READY_FOR_REVIEW`);
    }

    if (testCase.technicianId !== actorId) {
       throw new Error('Only the assigned Technician can submit this test');
    }

    // TODO: We could add gate logic here around test completeness
    
    const previousState = testCase.status;
    testCase.status = 'READY_FOR_REVIEW';
    testCase.updatedAt = new Date().toISOString();
    
    testCaseStore.saveItem(testCase);
    
    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId,
      actorRole,
      action: 'SUBMIT_FOR_REVIEW',
      previousState,
      newState: testCase.status
    });
    
    return testCase;
  }

  static startReview(testCaseId: string, actorId: string, actorRole: string): TestCase {
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new Error('Unauthorized');
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new Error('TestCase not found');
    
    if (testCase.status !== 'READY_FOR_REVIEW') {
      throw new Error(`Invalid transition from ${testCase.status} to UNDER_REVIEW`);
    }

    // Negative checking: Tech cannot approve own test. A Reviewer who IS the Tech of this test shouldn't approve.
    if (testCase.technicianId === actorId) {
      throw new Error('Reviewer cannot review their own test case');
    }

    const previousState = testCase.status;
    testCase.status = 'UNDER_REVIEW';
    testCase.reviewerId = actorId;
    testCase.updatedAt = new Date().toISOString();
    
    testCaseStore.saveItem(testCase);
    
    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId,
      actorRole,
      action: 'START_REVIEW',
      previousState,
      newState: testCase.status
    });
    
    return testCase;
  }

  static returnForCorrection(testCaseId: string, actorId: string, actorRole: string, reason: string): TestCase {
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new Error('Unauthorized');
    if (!reason || reason.trim() === '') throw new Error('Reason required for return');

    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new Error('TestCase not found');
    
    if (testCase.status !== 'UNDER_REVIEW') {
      throw new Error(`Invalid transition from ${testCase.status} to RETURNED_FOR_CORRECTION`);
    }

    if (testCase.reviewerId !== actorId) {
      throw new Error('Only the assigned Reviewer can return this test case');
    }
    
    const previousState = testCase.status;
    testCase.status = 'RETURNED_FOR_CORRECTION';
    testCase.reviewNotes = reason;
    testCase.updatedAt = new Date().toISOString();
    
    testCaseStore.saveItem(testCase);
    
    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId,
      actorRole,
      action: 'RETURN_FOR_CORRECTION',
      previousState,
      newState: testCase.status,
      metadata: { reason }
    });
    
    return testCase;
  }

  static approve(testCaseId: string, actorId: string, actorRole: string): TestCase {
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new Error('Unauthorized');
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new Error('TestCase not found');
    
    if (testCase.status !== 'UNDER_REVIEW') {
      throw new Error(`Invalid transition from ${testCase.status} to APPROVED`);
    }

    if (testCase.reviewerId !== actorId) {
      throw new Error('Only the assigned Reviewer can approve this test case');
    }
    
    const previousState = testCase.status;
    testCase.status = 'APPROVED';
    testCase.approvalDate = new Date().toISOString();
    testCase.updatedAt = new Date().toISOString();
    
    testCaseStore.saveItem(testCase);
    
    AuditService.recordEvent({
      testCaseId: testCase.id,
      actorId,
      actorRole,
      action: 'APPROVE',
      previousState,
      newState: testCase.status
    });
    
    return testCase;
  }
}
