import { unitOfWork } from '../repositories/persistence';
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
  static async startTesting(testCaseId: string, actorId: string, actorRole: string): Promise<TestCase> {
    return unitOfWork.write(async () => {
      if (actorRole !== 'Technician') throw new WorkflowError('Unauthorized', 403);
      const testCase = (await testCaseStore.findById(testCaseId));
      if (!testCase) throw new WorkflowError('TestCase not found', 404);
      if (testCase.technicianId !== actorId) throw new WorkflowError('Only the assigned Technician can resume this test', 403);
      if (testCase.status !== 'DRAFT' && testCase.status !== 'RETURNED_FOR_CORRECTION') {
        throw new WorkflowError('Invalid start testing condition', 409);
      }
      if (testCase.nativeProgramme !== undefined) requireNativeProgramme(testCase.nativeProgramme);
      const previousState = testCase.status;
      testCase.status = 'TESTING';
      (await touchTestCase(testCase));
      (await AuditService.recordEvent({ testCaseId, actorId, actorRole, action: 'START_TESTING', previousState, newState: 'TESTING' }));
      return testCase;
    });
  }

  static async submitForReview(testCaseId: string, actorId: string, actorRole: string): Promise<TestCase> {
    return unitOfWork.write(async () => {
      // Technician submits for review
      if (actorRole !== 'Technician') throw new WorkflowError('Unauthorized', 403);

      const testCase = (await testCaseStore.findById(testCaseId));
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
      const observations = (await observationStore.findAll()).filter(o => o.testCaseId === testCaseId);
      const nativeTests = (await nativeTestStore.findAll()).filter(row => row.testCaseId === testCaseId);
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

      (await touchTestCase(testCase));

      (await AuditService.recordEvent({
        testCaseId: testCase.id,
        actorId,
        actorRole,
        action: 'SUBMIT_FOR_REVIEW',
        previousState,
        newState: testCase.status
      }));

      return testCase;
    });
  }

  static async startReview(testCaseId: string, actorId: string, actorRole: string): Promise<TestCase> {
    return unitOfWork.write(async () => {
      if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);

      const testCase = (await testCaseStore.findById(testCaseId));
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

      (await touchTestCase(testCase));

      (await AuditService.recordEvent({
        testCaseId: testCase.id,
        actorId,
        actorRole,
        action: 'START_REVIEW',
        previousState,
        newState: testCase.status
      }));

      return testCase;
    });
  }

  static async returnForCorrection(testCaseId: string, actorId: string, actorRole: string, reason: string): Promise<TestCase> {
    return unitOfWork.write(async () => {
      if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);
      if (typeof reason !== 'string' || reason.trim() === '') throw new Error('Reason required for return');
      reason = reason.trim();

      const testCase = (await testCaseStore.findById(testCaseId));
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

      (await touchTestCase(testCase));

      (await AuditService.recordEvent({
        testCaseId: testCase.id,
        actorId,
        actorRole,
        action: 'RETURN_FOR_CORRECTION',
        previousState,
        newState: testCase.status,
        metadata: { reason }
      }));

      return testCase;
    });
  }

  static async approve(testCaseId: string, actorId: string, actorRole: string): Promise<TestCase> {
    return unitOfWork.write(async () => {
      if (actorRole !== 'Reviewer' && actorRole !== 'Administrator') throw new WorkflowError('Unauthorized', 403);

      const testCase = (await testCaseStore.findById(testCaseId));
      if (!testCase) throw new WorkflowError('TestCase not found', 404);

      if (testCase.status !== 'UNDER_REVIEW') {
        throw new WorkflowError(`Invalid transition from ${testCase.status} to APPROVED`, 409);
      }

      if (testCase.technicianId === actorId) throw new WorkflowError('Reviewer cannot review their own test case', 403);
      if (testCase.reviewerId !== actorId) {
        throw new WorkflowError('Only the assigned Reviewer can approve this test case', 403);
      }

      const programme = (await assessStoredProgramme(testCase));
      if (!programme.complete) {
        throw new WorkflowError(`Final approval blocked: programme is INCOMPLETE. ${programme.issues.join(' ')}`, 409);
      }

      const previousState = testCase.status;
      testCase.status = 'APPROVED';
      testCase.approvalDate = new Date().toISOString();

      (await touchTestCase(testCase));

      (await AuditService.recordEvent({
        testCaseId: testCase.id,
        actorId,
        actorRole,
        action: 'APPROVE',
        previousState,
        newState: testCase.status
      }));

      return testCase;
    });
  }
}
