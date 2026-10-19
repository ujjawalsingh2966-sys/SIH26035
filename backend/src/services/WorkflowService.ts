import { testCaseStore, observationStore, nativeTestStore } from '../repositories';
import { TestCase } from '../types/domain';
import { AuditService } from './AuditService';
import { touchTestCase } from './TestCaseRevision';
import { assessStoredProgramme } from './ProgrammeAssessment';
import { requireNativeProgramme } from './NativeApplicability';

class WorkflowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export class WorkflowService {
  static startTesting(testCaseId: string, actorId: string, actorRole: string): TestCase {
    if (actorRole !== 'Technician') throw new WorkflowError('Unauthorized', 403);
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new WorkflowError('TestCase not found', 404);
    if (testCase.technicianId !== actorId) throw new WorkflowError('Only the assigned Technician can resume this test', 403);
    if (testCase.status !== 'DRAFT' && testCase.status !== 'RETURNED_FOR_CORRECTION') {
      throw new WorkflowError('Invalid start testing condition', 409);
    }
    if (testCase.nativeProgramme !== undefined) requireNativeProgramme(testCase.nativeProgramme);
    const previousState = testCase.status;
    testCase.status = 'TESTING';
    touchTestCase(testCase);
    AuditService.recordEvent({ testCaseId, actorId, actorRole, action: 'START_TESTING', previousState, newState: 'TESTING' });
    return testCase;
  }
  
  static submitForReview(testCaseId: string, actorId: string, actorRole: string): TestCase {
    // Technician submits for review
    if (actorRole !== 'Technician') throw new WorkflowError('Unauthorized', 403);
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new WorkflowError('TestCase not found', 404);
    
    if (testCase.status !== 'TESTING') {
      throw new WorkflowError(`Invalid transition from ${testCase.status} to READY_FOR_REVIEW`, 409);
    }

    if (testCase.technicianId !== actorId) {
       throw new WorkflowError('Only the assigned Technician can submit this test', 403);
    }

    if (testCase.nativeProgramme !== undefined) requireNativeProgramme(testCase.nativeProgramme);

    // Evaluation completeness gate: at least one observation must have been recorded,
    // and every recorded observation must carry a completed Calculation -> Rule ->
    // Compliance evaluation before the test case can move to review.
    const observations = observationStore.findAll().filter(o => o.testCaseId === testCaseId);
    const nativeTests = nativeTestStore.findAll().filter(row => row.testCaseId === testCaseId);
    if (nativeTests.some(row => !row.result.complete)) throw new WorkflowError('Cannot submit incomplete native series for review; finish the recorded sampling/conditions first', 409);
    if (observations.length === 0 && nativeTests.length === 0) {
      throw new Error('Cannot submit for review: no observations have been recorded for this test case');
    }
    const unevaluated = observations.filter(o => !o.evaluation);
    if (unevaluated.length > 0) {
      throw new Error(
        `Cannot submit for review: ${unevaluated.length} observation(s) have not completed evaluation`
      );
    }

    const previousState = testCase.status;
    testCase.status = 'READY_FOR_REVIEW';
    
    touchTestCase(testCase);
    
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
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new WorkflowError('TestCase not found', 404);
    
    if (testCase.status !== 'READY_FOR_REVIEW') {
      throw new WorkflowError(`Invalid transition from ${testCase.status} to UNDER_REVIEW`, 409);
    }

    // Negative checking: Tech cannot approve own test. A Reviewer who IS the Tech of this test shouldn't approve.
    if (testCase.technicianId === actorId) {
      throw new WorkflowError('Reviewer cannot review their own test case', 403);
    }

    const previousState = testCase.status;
    testCase.status = 'UNDER_REVIEW';
    testCase.reviewerId = actorId;
    
    touchTestCase(testCase);
    
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
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);
    if (typeof reason !== 'string' || reason.trim() === '') throw new Error('Reason required for return');
    reason = reason.trim();

    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new WorkflowError('TestCase not found', 404);
    
    if (testCase.status !== 'UNDER_REVIEW') {
      throw new WorkflowError(`Invalid transition from ${testCase.status} to RETURNED_FOR_CORRECTION`, 409);
    }

    if (testCase.technicianId === actorId) throw new WorkflowError('Reviewer cannot review their own test case', 403);
    if (testCase.reviewerId !== actorId) {
      throw new WorkflowError('Only the assigned Reviewer can return this test case', 403);
    }
    
    const previousState = testCase.status;
    testCase.status = 'RETURNED_FOR_CORRECTION';
    testCase.reviewNotes = reason;
    
    touchTestCase(testCase);
    
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
    if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);
    
    const testCase = testCaseStore.findById(testCaseId);
    if (!testCase) throw new WorkflowError('TestCase not found', 404);
    
    if (testCase.status !== 'UNDER_REVIEW') {
      throw new WorkflowError(`Invalid transition from ${testCase.status} to APPROVED`, 409);
    }

    if (testCase.technicianId === actorId) throw new WorkflowError('Reviewer cannot review their own test case', 403);
    if (testCase.reviewerId !== actorId) {
      throw new WorkflowError('Only the assigned Reviewer can approve this test case', 403);
    }

    const programme = assessStoredProgramme(testCase);
    if (!programme.complete) {
      throw new WorkflowError(`Final approval blocked: programme is INCOMPLETE. ${programme.issues.join(' ')}`, 409);
    }
    
    const previousState = testCase.status;
    testCase.status = 'APPROVED';
    testCase.approvalDate = new Date().toISOString();
    
    touchTestCase(testCase);
    
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
