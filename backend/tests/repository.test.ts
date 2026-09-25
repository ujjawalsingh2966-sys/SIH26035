import request from 'supertest';
import app from '../src/app';
import { testCaseStore, instrumentStore, manufacturerStore, auditStore } from '../src/repositories';
import { Instrument, Manufacturer, TestCase } from '../src/types/domain';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';
import { AuditService } from '../src/services/AuditService';

let server: any;

const technicianToken = jwt.sign({ id: 'tech123', role: 'Technician', email: 'tech@example.com' }, config.jwtSecret);
const reviewerToken = jwt.sign({ id: 'rev123', role: 'Reviewer', email: 'rev@example.com' }, config.jwtSecret);

beforeAll((done) => {
  server = app.listen(0, () => {
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('Operational Dashboard and Repository API', () => {
  let m1: Manufacturer;
  let i1: Instrument;
  let tc1: TestCase;
  let tc2: TestCase;

  beforeEach(() => {
    testCaseStore.clear();
    instrumentStore.clear();
    manufacturerStore.clear();
    auditStore.clear();

    m1 = manufacturerStore.saveItem({
      id: 'mfg-1',
      name: 'RepoManufacturer',
      address: '123 Repo St',
      identifier: 'MFG-ID-1'
    });

    i1 = instrumentStore.saveItem({
      id: 'inst-1',
      manufacturerId: m1.id,
      name: 'Test Instrument',
      model: 'ModelRepo-X',
      serialNumber: 'SN-X',
      isWeighing: true,
      isElectronic: true,
      isManual: true,
      isSingleRange: true,
      accuracyClass: 'II',
      maxCapacity: '10',
      minCapacity: '0.1',
      e: '0.01',
      d: '0.01',
      hasTare: true
    });

    tc1 = testCaseStore.saveItem({
      id: 'tc-repo-1',
      instrumentId: i1.id,
      technicianId: 'tech123',
      reviewerId: undefined,
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testConfiguration: {
        weighing: 'PASS' as any,
        eccentricity: 'PASS' as any,
        repeatability: 'PASS' as any,
        tare: 'PASS' as any,
        zeroSetting: 'NOT APPLICABLE' as any
      }
    });

    tc2 = testCaseStore.saveItem({
      id: 'tc-repo-2',
      instrumentId: i1.id,
      technicianId: 'tech-other', // different tech
      reviewerId: undefined,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testConfiguration: {
        weighing: 'NOT STARTED',
        eccentricity: 'NOT STARTED',
        repeatability: 'NOT STARTED',
        tare: 'NOT STARTED',
        zeroSetting: 'NOT STARTED'
      }
    });

    // Mock a generated report audit
    AuditService.recordEvent({
      testCaseId: tc1.id,
      action: 'REPORT_GENERATED',
      actorId: 'tech123',
      actorRole: 'Technician',
      metadata: { details: 'Generated PDF' }
    });
  });

  describe('GET /api/v1/repository/dashboard', () => {
    it('should return metrics according to technician role (only their test cases)', async () => {
      const response = await request(server)
        .get('/api/v1/repository/dashboard')
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const data = response.body.data;
      expect(data.approved).toBe(1);
      expect(data.totalActiveTests).toBe(0);
      expect(data.reportsGenerated).toBe(1);
    });

    it('should return metrics for reviewer (all test cases >= READY_FOR_REVIEW)', async () => {
      const response = await request(server)
        .get('/api/v1/repository/dashboard')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .expect(200);

      const data = response.body.data;
      expect(data.approved).toBe(1);
      expect(data.reportsGenerated).toBe(1);
      expect(data.totalActiveTests).toBe(0); 
    });
  });

  describe('GET /api/v1/repository/search', () => {
    it('should allow searching by instrument model fuzzy', async () => {
      const response = await request(server)
        .get('/api/v1/repository/search?model=Repo')
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].testCase.id).toBe(tc1.id);
      expect(response.body.data[0].instrument.model).toBe('ModelRepo-X');
    });

    it('should filter by specific status array parameter', async () => {
      const response = await request(server)
        .get('/api/v1/repository/search?status=APPROVED,READY_FOR_REVIEW')
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/v1/repository/records/:testCaseId', () => {
    it('should return 403 trying to view record not accessible by role (tech trying to view other tech draft)', async () => {
      await request(server)
        .get(`/api/v1/repository/records/${tc2.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(403);
    });

    it('should return detailed record for permitted test case including audit history and compliance summary', async () => {
      const response = await request(server)
        .get(`/api/v1/repository/records/${tc1.id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .expect(200);

      const data = response.body.data;
      expect(data.testCase.id).toBe(tc1.id);
      expect(data.instrument.model).toBe('ModelRepo-X');
      expect(data.history).toBeDefined();
      expect(data.history.length).toBeGreaterThan(0);
      expect(data.history.some((a: any) => a.action === 'REPORT_GENERATED')).toBe(true);
      // For approved, it calculates complianceSummary
      expect(data.complianceSummary).toBeDefined();
    });
  });
});
