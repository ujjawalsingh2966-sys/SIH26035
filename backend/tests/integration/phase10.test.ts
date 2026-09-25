import { Instrument, TestCase, ObservationRecord } from '../../src/types/domain';
import { instrumentStore, testCaseStore, observationStore } from '../../src/repositories';
import { EvidenceService } from '../../src/services/EvidenceService';
import { ReportService } from '../../src/services/ReportService';
import { EvaluationService } from '../../src/services/EvaluationService';

describe('Phase 10: Controlled Report Generation & Evidence Implementation', () => {
  let testCaseId: string;
  let mockInstrument: Instrument;

  beforeAll(async () => {
    // Manually push test instrument and test case
    mockInstrument = {
      id: 'INST-PHASE10',
      manufacturerId: 'MFG-TEST',
      name: 'Test Instrument',
      model: 'T1000',
      serialNumber: 'SN-P10',
      isWeighing: true,
      isManual: true,
      isElectronic: true,
      isSingleRange: true,
      accuracyClass: 'III',
      maxCapacity: '100',
      minCapacity: '1',
      e: '10',
      d: '10',
      hasTare: true
    };
    instrumentStore.saveItem(mockInstrument);

    // Draft a test case and approve it immediately
    const tc: TestCase = {
      id: 'TC_PHASE10',
      instrumentId: mockInstrument.id,
      technicianId: 'TECH-1',
      status: 'APPROVED',
      testConfiguration: {
        weighing: 'PASS' as any,
        eccentricity: 'PASS' as any,
        repeatability: 'PASS' as any,
        tare: 'PASS' as any,
        zeroSetting: 'NOT APPLICABLE' as any
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    testCaseStore.saveItem(tc);
    testCaseId = tc.id;

    // Phase 8 wiring: report compliance data is now sourced from real, persisted
    // observation evaluations rather than the testConfiguration literal above.
    // Provide one real, live-pipeline-evaluated WEIGHING observation (Ec = 0, well
    // within the Class III / m=10 MPE of 5g) so the report has a real PASS to show.
    const observation: ObservationRecord = {
      id: 'OBS_PHASE10_1',
      testCaseId,
      testType: 'WEIGHING',
      sequence: 1,
      load: '100',
      indication: '100',
      additionalWeights: '5', // 0.5 * e, cancels the +0.5e term in P = I + 0.5e - deltaL
      zeroError: '0'
    };
    observation.evaluation = EvaluationService.evaluateObservation(mockInstrument, observation, true);
    observationStore.saveItem(observation);
  });

  describe('Evidence Management', () => {
    it('should add evidence to a valid test case', () => {
      const evidence = EvidenceService.addEvidence(
        testCaseId,
        'WEIGHING',
        'Load test setup photo',
        'setup.jpg',
        'image/jpeg',
        15400,
        'TECH-1',
        'base64data...'
      );
      expect(evidence.id).toMatch(/^ev_/);
      expect(evidence.testCaseId).toBe(testCaseId);
    });

    it('should fetch evidence for a test case', () => {
      const records = EvidenceService.getEvidenceForTestCase(testCaseId);
      expect(records.length).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should return HTML report', () => {
      const html = ReportService.generateHtmlReport(testCaseId, 'Administrator');
      expect(html).toContain('OIML R76 Test Report');
      expect(html).toContain('Prototype / Pending Official Template Confirmation');
      expect(html).toContain(testCaseId);
    });

    it('should return PDF report buffer', () => {
      const pdfBuffer = ReportService.generatePdfReport(testCaseId, 'Administrator');
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      const pdfHeader = pdfBuffer.toString('utf8', 0, 5);
      expect(pdfHeader).toBe('%PDF-');
    });

    it('should return JSON report data sourced from the real persisted evaluation', () => {
      const data = ReportService.generateReportData(testCaseId, 'Administrator');
      expect(data.testCaseId).toBe(testCaseId);
      // Phase 8 wiring: overallVerdict is now the real Compliance Engine verdict
      // aggregated from persisted observation evaluations, not a hardcoded literal.
      expect(data.complianceSummary.overallVerdict).toBe('PASS');
      expect(data.complianceSummary.weighing).toBe('PASS');
      expect(data.meta.cryptographicSeal).toBeDefined();
      // Rule version is read from the persisted evaluation trace, not a literal -
      // it happens to equal the same MVP string because that's what RuleEngine emits today.
      expect(data.meta.ruleEngineVersion).toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
    });

    it('should fail if requested for a DRAFT test case', () => {
      const dTc: TestCase = {
          id: 'TC_DRAFT',
          instrumentId: mockInstrument.id,
          technicianId: 'TECH-1',
          status: 'DRAFT',
          testConfiguration: {
            weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED', tare: 'NOT STARTED', zeroSetting: 'NOT STARTED'
          },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      testCaseStore.saveItem(dTc);

      expect(() => {
        ReportService.generateHtmlReport(dTc.id, 'Administrator');
      }).toThrow('Final test reports can only be generated from test cases in APPROVED status');
    });
  });
});
