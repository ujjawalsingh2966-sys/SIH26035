import { WorkflowService } from '../../src/services/WorkflowService';
import { AuditService } from '../../src/services/AuditService';
import { testCaseStore, observationStore } from '../../src/repositories';
import { TestCase, ObservationRecord } from '../../src/types/domain';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 9 Workflow and RBAC Integration', () => {

  const setupMockTest = async (status: any = 'TESTING', technicianId = 'tech-1') => {
    const tc: TestCase = {
      id: `tc_test_${Date.now()}_${Math.random()}`,
      instrumentId: 'inst-1',
      technicianId,
      status,
      testConfiguration: {
        weighing: 'NOT STARTED',
        eccentricity: 'NOT STARTED',
        repeatability: 'NOT STARTED',
        tare: 'NOT APPLICABLE',
        zeroSetting: 'NOT STARTED'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    (await testCaseStore.saveItem(tc));
    return tc;
  };

  // Phase 8 wiring: submitForReview now requires every observation on the test case
  // to carry a completed evaluation. This helper satisfies that gate for tests that
  // only exercise WorkflowService's own transition/RBAC logic.
  const setupEvaluatedObservation = async (testCaseId: string) => {
    const obs: ObservationRecord = {
      id: `obs_test_${Date.now()}_${Math.random()}`,
      testCaseId,
      testType: 'WEIGHING',
      sequence: 1,
      load: '5000',
      indication: '5005',
      additionalWeights: '3',
      evaluation: {
        calculation: { P: { value: '5004.5', unit: 'g' }, E: { value: '4.5', unit: 'g' }, Ec: { value: '4.5', unit: 'g' }, m: '1000', traces: [] },
        rulePackage: { status: 'APPLICABLE', mpeLimit: { value: '5', unit: 'g' }, mpeMultiplier: '1.0' },
        compliance: { verdict: 'PASS' },
        evaluatedAt: new Date().toISOString()
      }
    };
    (await observationStore.saveItem(obs));
    return obs;
  };

  beforeAll(() => {
    // clean stores if needed
  });

  describe('Happy Path Workflow', () => {
    it('allows review but blocks final approval when the programme is undetermined', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-1'));
      (await setupEvaluatedObservation(tc.id));

      // Submit
      const submitted = (await WorkflowService.submitForReview(tc.id, 'tech-1', 'Technician'));
      expect(submitted.status).toBe('READY_FOR_REVIEW');

      // Start Review
      const underReview = (await WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer'));
      expect(underReview.status).toBe('UNDER_REVIEW');
      expect(underReview.reviewerId).toBe('rev-1');

      await expect(async () => (await WorkflowService.approve(tc.id, 'rev-1', 'Reviewer'))).rejects.toThrow('INCOMPLETE');
      const persisted = (await testCaseStore.findById(tc.id))!;
      expect(persisted.status).toBe('UNDER_REVIEW');
      expect(persisted.approvalDate).toBeUndefined();

      // Check Audit Trail
      const history = (await AuditService.getHistoryForTest(tc.id));
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('SUBMIT_FOR_REVIEW');
      expect(history[1].action).toBe('START_REVIEW');
      expect(history.some(event => event.action === 'APPROVE')).toBe(false);
    });

    it('Should allow return for correction and resubmission', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-2'));
      (await setupEvaluatedObservation(tc.id));
      (await WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician'));
      (await WorkflowService.startReview(tc.id, 'rev-2', 'Reviewer'));

      // Return
      const returned = (await WorkflowService.returnForCorrection(tc.id, 'rev-2', 'Reviewer', 'Missing observations'));
      expect(returned.status).toBe('RETURNED_FOR_CORRECTION');
      expect(returned.reviewNotes).toBe('Missing observations');

      // Explicitly resume testing before resubmission.
      (await WorkflowService.startTesting(tc.id, 'tech-2', 'Technician'));
      // Resubmit
      const resubmitted = (await WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician'));
      expect(resubmitted.status).toBe('READY_FOR_REVIEW');
    });
  });

  describe('RBAC and Permission Negative Tests', () => {
    it('Should deny Reviewer from submitting a test', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-1'));
      await expect(async () => {
        (await WorkflowService.submitForReview(tc.id, 'rev-1', 'Reviewer'));
      }).rejects.toThrow('Unauthorized');
    });

    it('Should deny Technician from starting review or approving', async () => {
      const tc = (await setupMockTest('READY_FOR_REVIEW', 'tech-1'));
      await expect(async () => {
        (await WorkflowService.startReview(tc.id, 'tech-1', 'Technician'));
      }).rejects.toThrow('Unauthorized');

      const tc2 = (await setupMockTest('UNDER_REVIEW', 'tech-1'));
      await expect(async () => {
        (await WorkflowService.approve(tc2.id, 'tech-1', 'Technician'));
      }).rejects.toThrow('Unauthorized');
    });

    it('Should deny Technician from returning for correction', async () => {
      const tc = (await setupMockTest('UNDER_REVIEW', 'tech-1'));
      await expect(async () => {
        (await WorkflowService.returnForCorrection(tc.id, 'tech-1', 'Technician', 'Reason'));
      }).rejects.toThrow('Unauthorized');
    });

    it('Should deny Reviewer from approving their own test', async () => {
      const tc = (await setupMockTest('READY_FOR_REVIEW', 'rev-3'));
      await expect(async () => {
        // Technically, a user who is a Reviewer might act as a Tech.
        // The startReview function should prevent a Reviewer who created the test from reviewing.
        (await WorkflowService.startReview(tc.id, 'rev-3', 'Reviewer'));
      }).rejects.toThrow('Reviewer cannot review their own test case');
    });
  });

  describe('State Transition Constraints', () => {
    it('Should not allow submit from DRAFT or APPROVED', async () => {
      const tcDraft = (await setupMockTest('DRAFT', 'tech-1'));
      await expect(async () => (await WorkflowService.submitForReview(tcDraft.id, 'tech-1', 'Technician'))).rejects
        .toThrow('Invalid transition');

      const tcApproved = (await setupMockTest('APPROVED', 'tech-1'));
      await expect(async () => (await WorkflowService.submitForReview(tcApproved.id, 'tech-1', 'Technician'))).rejects
        .toThrow('Invalid transition');
    });

    it('Should not allow start review from TESTING', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-1'));
      await expect(async () => (await WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer'))).rejects
        .toThrow('Invalid transition');
    });

    it('Should not allow approve from READY_FOR_REVIEW', async () => {
      const tc = (await setupMockTest('READY_FOR_REVIEW', 'tech-1'));
      await expect(async () => (await WorkflowService.approve(tc.id, 'rev-1', 'Reviewer'))).rejects
        .toThrow('Invalid transition');
    });
  });

  describe('Ownership Overrides', () => {
    it('Should not allow a different technician to submit', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-1'));
      await expect(async () => (await WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician'))).rejects
        .toThrow('Only the assigned Technician can submit this test');
    });

    it('Should not allow a different reviewer to approve or return', async () => {
      const tc = (await setupMockTest('TESTING', 'tech-1'));
      (await setupEvaluatedObservation(tc.id));
      (await WorkflowService.submitForReview(tc.id, 'tech-1', 'Technician'));
      (await WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer'));

      await expect(async () => (await WorkflowService.approve(tc.id, 'rev-2', 'Reviewer'))).rejects
        .toThrow('Only the assigned Reviewer can approve this test case');

      await expect(async () => (await WorkflowService.returnForCorrection(tc.id, 'rev-2', 'Reviewer', 'reason'))).rejects
        .toThrow('Only the assigned Reviewer can return this test case');
    });
  });

});
