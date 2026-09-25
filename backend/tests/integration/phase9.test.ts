import { WorkflowService } from '../../src/services/WorkflowService';
import { AuditService } from '../../src/services/AuditService';
import { testCaseStore } from '../../src/repositories';
import { TestCase } from '../../src/types/domain';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 9 Workflow and RBAC Integration', () => {

  const setupMockTest = (status: any = 'TESTING', technicianId = 'tech-1') => {
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
    testCaseStore.saveItem(tc);
    return tc;
  };

  beforeAll(() => {
    // clean stores if needed
  });

  describe('Happy Path Workflow', () => {
    it('Should complete a full transition cycle successfully', () => {
      const tc = setupMockTest('TESTING', 'tech-1');
      
      // Submit
      const submitted = WorkflowService.submitForReview(tc.id, 'tech-1', 'Technician');
      expect(submitted.status).toBe('READY_FOR_REVIEW');
      
      // Start Review
      const underReview = WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer');
      expect(underReview.status).toBe('UNDER_REVIEW');
      expect(underReview.reviewerId).toBe('rev-1');
      
      // Approve
      const approved = WorkflowService.approve(tc.id, 'rev-1', 'Reviewer');
      expect(approved.status).toBe('APPROVED');
      expect(approved.approvalDate).toBeDefined();

      // Check Audit Trail
      const history = AuditService.getHistoryForTest(tc.id);
      expect(history.length).toBe(3);
      expect(history[0].action).toBe('SUBMIT_FOR_REVIEW');
      expect(history[1].action).toBe('START_REVIEW');
      expect(history[2].action).toBe('APPROVE');
    });

    it('Should allow return for correction and resubmission', () => {
      const tc = setupMockTest('TESTING', 'tech-2');
      WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician');
      WorkflowService.startReview(tc.id, 'rev-2', 'Reviewer');
      
      // Return
      const returned = WorkflowService.returnForCorrection(tc.id, 'rev-2', 'Reviewer', 'Missing observations');
      expect(returned.status).toBe('RETURNED_FOR_CORRECTION');
      expect(returned.reviewNotes).toBe('Missing observations');
      
      // Resubmit
      const resubmitted = WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician');
      expect(resubmitted.status).toBe('READY_FOR_REVIEW');
    });
  });

  describe('RBAC and Permission Negative Tests', () => {
    it('Should deny Reviewer from submitting a test', () => {
      const tc = setupMockTest('TESTING', 'tech-1');
      expect(() => {
        WorkflowService.submitForReview(tc.id, 'rev-1', 'Reviewer');
      }).toThrow('Unauthorized');
    });

    it('Should deny Technician from starting review or approving', () => {
      const tc = setupMockTest('READY_FOR_REVIEW', 'tech-1');
      expect(() => {
        WorkflowService.startReview(tc.id, 'tech-1', 'Technician');
      }).toThrow('Unauthorized');

      const tc2 = setupMockTest('UNDER_REVIEW', 'tech-1');
      expect(() => {
        WorkflowService.approve(tc2.id, 'tech-1', 'Technician');
      }).toThrow('Unauthorized');
    });

    it('Should deny Technician from returning for correction', () => {
      const tc = setupMockTest('UNDER_REVIEW', 'tech-1');
      expect(() => {
        WorkflowService.returnForCorrection(tc.id, 'tech-1', 'Technician', 'Reason');
      }).toThrow('Unauthorized');
    });

    it('Should deny Reviewer from approving their own test', () => {
      const tc = setupMockTest('READY_FOR_REVIEW', 'rev-3');
      expect(() => {
        // Technically, a user who is a Reviewer might act as a Tech.
        // The startReview function should prevent a Reviewer who created the test from reviewing.
        WorkflowService.startReview(tc.id, 'rev-3', 'Reviewer');
      }).toThrow('Reviewer cannot review their own test case');
    });
  });

  describe('State Transition Constraints', () => {
    it('Should not allow submit from DRAFT or APPROVED', () => {
      const tcDraft = setupMockTest('DRAFT', 'tech-1');
      expect(() => WorkflowService.submitForReview(tcDraft.id, 'tech-1', 'Technician'))
        .toThrow('Invalid transition');

      const tcApproved = setupMockTest('APPROVED', 'tech-1');
      expect(() => WorkflowService.submitForReview(tcApproved.id, 'tech-1', 'Technician'))
        .toThrow('Invalid transition');
    });

    it('Should not allow start review from TESTING', () => {
      const tc = setupMockTest('TESTING', 'tech-1');
      expect(() => WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer'))
        .toThrow('Invalid transition');
    });

    it('Should not allow approve from READY_FOR_REVIEW', () => {
      const tc = setupMockTest('READY_FOR_REVIEW', 'tech-1');
      expect(() => WorkflowService.approve(tc.id, 'rev-1', 'Reviewer'))
        .toThrow('Invalid transition');
    });
  });

  describe('Ownership Overrides', () => {
    it('Should not allow a different technician to submit', () => {
      const tc = setupMockTest('TESTING', 'tech-1');
      expect(() => WorkflowService.submitForReview(tc.id, 'tech-2', 'Technician'))
        .toThrow('Only the assigned Technician can submit this test');
    });

    it('Should not allow a different reviewer to approve or return', () => {
      const tc = setupMockTest('TESTING', 'tech-1');
      WorkflowService.submitForReview(tc.id, 'tech-1', 'Technician');
      WorkflowService.startReview(tc.id, 'rev-1', 'Reviewer');

      expect(() => WorkflowService.approve(tc.id, 'rev-2', 'Reviewer'))
        .toThrow('Only the assigned Reviewer can approve this test case');

      expect(() => WorkflowService.returnForCorrection(tc.id, 'rev-2', 'Reviewer', 'reason'))
        .toThrow('Only the assigned Reviewer can return this test case');
    });
  });

});
