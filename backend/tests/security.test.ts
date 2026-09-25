import request from 'supertest';
import app from '../src/app';
import { testCaseStore, instrumentStore, manufacturerStore } from '../src/repositories';
import { Instrument, Manufacturer, TestCase } from '../src/types/domain';
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
  });

  describe('4. Privilege Escalation', () => {
    it('should FORBID Technician from approving tests', async () => {
      await request(server)
        .post(`/api/v1/test-cases/${tcTech1.id}/workflow/approve`)
        .set('Authorization', `Bearer ${technician1Token}`)
        .expect(403);
    });
  });
});
