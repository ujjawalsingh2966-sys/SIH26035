import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { config } from '../src/config/env';
import { testSession } from './helpers/persistedIdentity';
import { auditStore, instrumentStore, testCaseStore } from '../src/repositories';
import { ReportService } from '../src/services/ReportService';
import { TestCaseStatus } from '../src/types/domain';

const auth = testSession;
const owner = auth('listing-owner', 'Technician');
const other = auth('listing-other', 'Technician');
const reviewer = auth('listing-reviewer', 'Reviewer');
const admin = auth('listing-admin', 'Administrator');
const url = '/api/v1/repository/search?status=APPROVED';
let generators: jest.SpyInstance[];

beforeEach(() => {
  // JsonStore uses fresh temporary storage under Jest, never application data.
  testCaseStore.clear(); instrumentStore.clear(); auditStore.clear();
  for (const [id, technicianId, status] of [
    ['own-approved-a', 'listing-owner', 'APPROVED'],
    ['own-approved-b', 'listing-owner', 'APPROVED'],
    ['other-approved', 'listing-other', 'APPROVED'],
    ['own-draft', 'listing-owner', 'DRAFT'],
    ['other-review', 'listing-other', 'READY_FOR_REVIEW'],
  ] as [string, string, TestCaseStatus][]) {
    const instrument = instrumentStore.saveItem({
      id: `instrument-${id}`, manufacturerId: 'listing-manufacturer', name: id,
      model: `model-${id}`, serialNumber: `serial-${id}`,
      isWeighing: true, isManual: true, isElectronic: true, isSingleRange: true,
    });
    testCaseStore.saveItem({
      id, technicianId, instrumentId: instrument.id, status,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      testConfiguration: { weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED' },
    });
  }
  generators = [
    jest.spyOn(ReportService, 'generateReportData'),
    jest.spyOn(ReportService, 'generateHtmlReport'),
    jest.spyOn(ReportService, 'generatePdfReport'),
  ];
});
afterEach(() => jest.restoreAllMocks());

describe('Reports index uses the existing authorized repository listing', () => {
  it.each([
    ['owning technician', owner, ['own-approved-a', 'own-approved-b']],
    ['unrelated technician', other, ['other-approved']],
    ['reviewer', reviewer, ['own-approved-a', 'own-approved-b', 'other-approved']],
    ['administrator', admin, ['own-approved-a', 'own-approved-b', 'other-approved']],
  ])('returns only authorized approved rows and totals for %s', async (_label, token, ids) => {
    const before = JSON.parse(JSON.stringify(testCaseStore.findAll()));
    const response = await request(app).get(url).set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.data.map((row: any) => row.testCase.id).sort()).toEqual([...ids].sort());
    expect(response.body.total).toBe(ids.length);
    expect(response.body.data.every((row: any) => row.testCase.status === 'APPROVED')).toBe(true);
    for (const generator of generators) expect(generator).not.toHaveBeenCalled();
    expect(auditStore.findAll()).toEqual([]);
    expect(testCaseStore.findAll()).toEqual(before);
  });

  it('does not disclose another technician through a targeted query or total count', async () => {
    const response = await request(app).get(`${url}&q=model-other-approved`).set('Authorization', `Bearer ${owner}`).expect(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.text).not.toContain('serial-other-approved');
  });

  it('paginates after authorization, with an authorized total', async () => {
    const pages = await Promise.all([1, 2].map(page => request(app).get(`${url}&limit=1&page=${page}`).set('Authorization', `Bearer ${owner}`).expect(200)));
    expect(pages.map(page => page.body.total)).toEqual([2, 2]);
    expect(pages.flatMap(page => page.body.data.map((row: any) => row.testCase.id)).sort()).toEqual(['own-approved-a', 'own-approved-b']);
  });

  it.each([
    ['missing authentication', undefined, 401],
    ['invalid authentication', 'invalid-token', 401],
    ['unsupported role', auth('listing-unsupported', 'Unsupported'), 403],
  ])('rejects %s without invoking report generation', async (_label, token, status) => {
    const call = request(app).get(url);
    if (token) call.set('Authorization', `Bearer ${token}`);
    const response = await call.expect(status);
    expect(response.body.success).toBe(false);
    expect(response.text).not.toContain('model-own-approved');
    for (const generator of generators) expect(generator).not.toHaveBeenCalled();
    expect(auditStore.findAll()).toEqual([]);
  });
});
