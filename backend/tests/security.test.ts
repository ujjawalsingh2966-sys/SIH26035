import request from 'supertest';
import app from '../src/app';
import { testCaseStore, instrumentStore, manufacturerStore, observationStore, auditStore } from '../src/repositories';
import { Instrument, Manufacturer, TestCase, ObservationRecord } from '../src/types/domain';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';

let server: any;

const technician1Token = jwt.sign({ id: 'tech-1', role: 'Technician', email: 't1@example.com' }, config.jwtSecret);
const technician2Token = jwt.sign({ id: 'tech-2', role: 'Technician', email: 't2@example.com' }, config.jwtSecret);
const reviewerToken = jwt.sign({ id: 'rev123', role: 'Reviewer', email: 'rev@example.com' }, config.jwtSecret);

beforeAll((done) => {
  server = app.listen(0, () => {
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('Security and Access Control Test Suite', () => {
  let m1: Manufacturer;
  let i1: Instrument;
  let tcTech1: TestCase;

  beforeEach(() => {
    testCaseStore.clear();
    instrumentStore.clear();
    manufacturerStore.clear();
    observationStore.clear();
    auditStore.clear();

    m1 = manufacturerStore.saveItem({
      id: 'mfg-sec',
      name: 'Secured Manufacturer',
      address: '123 Secure St',
      identifier: 'SEC-01'
    });

    i1 = instrumentStore.saveItem({
      id: 'inst-sec',
      manufacturerId: m1.id,
      name: 'Sec Instrument',
      model: 'Model-<script>alert("XSS")</script>',
      serialNumber: 'SN-SEC',
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

    tcTech1 = testCaseStore.saveItem({
      id: 'tc-sec-1',
      instrumentId: i1.id,
      technicianId: 'tech-1',
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
      },
      laboratoryConditions: {
        temperature: '20',
        humidity: '50',
        pressure: '1013'
      }
    });
  });

  describe('1. Authentication Validation', () => {
    it('should reject requests with missing token', async () => {
      await request(server).get('/api/v1/test-cases').expect(401);
    });

    it('should reject requests with invalidly signed token', async () => {
      const badToken = jwt.sign({ id: 'tech-1', role: 'Technician' }, 'WRONG_SECRET_123');
      await request(server).get('/api/v1/test-cases').set('Authorization', `Bearer ${badToken}`).expect(401);
    });
  });

  describe('2. Input Validation & XSS Defense', () => {
    it('should reject missing fields for Evidence utilizing validateRequest', async () => {
      const response = await request(server)
        .post('/api/v1/evidence')
        .set('Authorization', `Bearer ${technician1Token}`)
        .send({
          testCaseId: tcTech1.id
          // Missing testType, description, fileName, mimeType, sizeBytes
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should escape XSS payloads in HTML artifacts', async () => {
      // Force test case into APPROVED status to allow report generation
      tcTech1.status = 'APPROVED';
      testCaseStore.saveItem(tcTech1);

      // Tech-1 generated HTML report
      const response = await request(server)
        .get(`/api/v1/reports/${tcTech1.id}/html`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(200);

      const html = response.text;
      // Expect that <script> is escaped
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('3. Object-Level Authorization (IDOR)', () => {
    it('should allow Tech-1 to modify their own Test Case', async () => {
      await request(server)
        .put(`/api/v1/test-cases/${tcTech1.id}/laboratory-conditions`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .send({ temperature: '22', humidity: '55', pressure: '1010' })
        .expect(200);
    });

    it('should FORBID Tech-2 from modifying Tech-1s Test Case (IDOR Prevention)', async () => {
      await request(server)
        .put(`/api/v1/test-cases/${tcTech1.id}/laboratory-conditions`)
        .set('Authorization', `Bearer ${technician2Token}`)
        .send({ temperature: '25', humidity: '60', pressure: '1013' })
        .expect(403);
    });

    it('should allow Tech-1 to read their own Test Case via GET /:id', async () => {
      const res = await request(server)
        .get(`/api/v1/test-cases/${tcTech1.id}`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(tcTech1.id);
    });

    it('should FORBID Tech-2 from reading Tech-1s Test Case via GET /:id (IDOR Prevention)', async () => {
      await request(server)
        .get(`/api/v1/test-cases/${tcTech1.id}`)
        .set('Authorization', `Bearer ${technician2Token}`)
        .expect(403);
    });

    it('should allow Reviewer to read any Test Case via GET /:id', async () => {
      const res = await request(server)
        .get(`/api/v1/test-cases/${tcTech1.id}`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(tcTech1.id);
    });

    it('should return 404 for nonexistent Test Case via GET /:id', async () => {
      await request(server)
        .get('/api/v1/test-cases/nonexistent_id')
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(404);
    });
  });

  describe('4. Privilege Escalation', () => {
    it('should FORBID Technician from approving tests', async () => {
      await request(server)
        .post(`/api/v1/test-cases/${tcTech1.id}/workflow/approve`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(403);
    });
  });

  describe('5. Observation Deletion Lifecycle & Metrological Traceability', () => {
    let obs1: ObservationRecord;

    beforeEach(() => {
      tcTech1.status = 'TESTING';
      testCaseStore.saveItem(tcTech1);

      obs1 = observationStore.saveItem({
        id: 'obs-sec-1',
        testCaseId: tcTech1.id,
        testType: 'WEIGHING',
        sequence: 1,
        load: '1.0',
        indication: '1.0',
        additionalWeights: '0.00',
        unit: 'kg',
        zeroError: '0.00',
        evaluation: {
          calculation: {
            P: { value: '1.0', unit: 'kg' },
            E: { value: '0.0', unit: 'kg' },
            Ec: { value: '0.0', unit: 'kg' },
            m: '1000',
            traces: []
          },
          rulePackage: {
            status: 'APPLICABLE',
            mpeLimit: { value: '0.01', unit: 'kg' },
            mpeMultiplier: '1.0'
          },
          compliance: {
            verdict: 'PASS'
          },
          evaluatedAt: new Date().toISOString()
        }
      });
    });

    it('should allow owning technician to delete an observation when testCase is in TESTING', async () => {
      const response = await request(server)
        .delete(`/api/v1/observations/${obs1.id}`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Observation deleted successfully');

      expect(observationStore.findById(obs1.id)).toBeUndefined();
    });

    it('should record statutory audit event with full observation snapshot upon deletion', async () => {
      await request(server)
        .delete(`/api/v1/observations/${obs1.id}`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(200);

      const events = auditStore.findAll().filter(
        e => e.testCaseId === tcTech1.id && e.action === 'OBSERVATION_DELETED'
      );
      expect(events.length).toBe(1);
      expect(events[0].actorId).toBe('tech-1');
      expect(events[0].metadata?.observationId).toBe(obs1.id);
      expect(events[0].metadata?.testType).toBe('WEIGHING');
      expect(events[0].metadata?.sequence).toBe(1);
      expect(events[0].metadata?.deletedObservation).toBeDefined();
      expect(events[0].metadata?.deletedObservation.id).toBe(obs1.id);
    });

    it('should return 404 for deleting a nonexistent observation', async () => {
      await request(server)
        .delete('/api/v1/observations/nonexistent-obs')
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(404);
    });

    it('should FORBID another technician from deleting observation (IDOR Prevention)', async () => {
      await request(server)
        .delete(`/api/v1/observations/${obs1.id}`)
        .set('Authorization', `Bearer ${technician2Token}`)
        .expect(403);

      expect(observationStore.findById(obs1.id)).toBeDefined();
    });

    it('should FORBID non-technician roles (Reviewer) from deleting observations', async () => {
      await request(server)
        .delete(`/api/v1/observations/${obs1.id}`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .expect(403);

      expect(observationStore.findById(obs1.id)).toBeDefined();
    });

    it('should REJECT deletion in locked or non-testing states (DRAFT, READY_FOR_REVIEW, UNDER_REVIEW, RETURNED_FOR_CORRECTION, APPROVED)', async () => {
      const nonTestingStatuses: TestCase['status'][] = [
        'DRAFT',
        'READY_FOR_REVIEW',
        'UNDER_REVIEW',
        'RETURNED_FOR_CORRECTION',
        'APPROVED'
      ];

      for (const status of nonTestingStatuses) {
        tcTech1.status = status;
        testCaseStore.saveItem(tcTech1);

        const obsForStatus = observationStore.saveItem({
          ...obs1,
          id: `obs-status-${status}`
        });

        await request(server)
          .delete(`/api/v1/observations/${obsForStatus.id}`)
          .set('Authorization', `Bearer ${technician1Token}`)
          .expect(403);

        expect(observationStore.findById(obsForStatus.id)).toBeDefined();
      }
    });

    it('should reject observation creation with duplicate sequence number', async () => {
      await request(server)
        .post('/api/v1/observations')
        .set('Authorization', `Bearer ${technician1Token}`)
        .send({
          testCaseId: tcTech1.id,
          testType: 'WEIGHING',
          sequence: 1,
          load: '2.0',
          indication: '2.0',
          additionalWeights: '0.00',
          unit: 'kg',
          zeroError: '0.00'
        })
        .expect(400);
    });

    it('should allow adding new observation with next monotonic sequence after deletion', async () => {
      await request(server)
        .delete(`/api/v1/observations/${obs1.id}`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(200);

      await request(server)
        .post('/api/v1/observations')
        .set('Authorization', `Bearer ${technician1Token}`)
        .send({
          testCaseId: tcTech1.id,
          testType: 'WEIGHING',
          sequence: 2,
          load: '2.0',
          indication: '2.0',
          additionalWeights: '0.00',
          unit: 'kg',
          zeroError: '0.00'
        })
        .expect(201);
    });
  });
});
