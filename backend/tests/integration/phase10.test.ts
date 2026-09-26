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

    it('should expose the real persisted P/E/Ec/m/MPE/verdict for the evaluated observation', () => {
      const data = ReportService.generateReportData(testCaseId, 'Administrator');
      expect(data.observationEvaluations).toHaveLength(1);

      const ev = data.observationEvaluations[0];
      expect(ev.observationId).toBe('OBS_PHASE10_1');
      expect(ev.testType).toBe('WEIGHING');

      // These values are read straight off the persisted evaluation (see beforeAll:
      // load=100, indication=100, additionalWeights=5, e=10 -> P = 100 + 5 - 5 = 100,
      // E = P - L = 0, Ec = E - E0 = 0, m = L / e = 10).
      expect(ev.appliedLoad).toEqual({ value: '100', unit: 'g' });
      expect(ev.indication).toEqual({ value: '100', unit: 'g' });
      expect(ev.additionalWeights).toEqual({ value: '5', unit: 'g' });
      expect(ev.P.value).toBe('100');
      expect(ev.E.value).toBe('0');
      expect(ev.Ec.value).toBe('0');
      expect(ev.m).toBe('10');
      expect(ev.mpe).toBeDefined();
      expect(ev.verdict).toBe('PASS');
      expect(ev.ruleVersion).toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
      expect(ev.explainability).toContain('<=');
      expect(ev.evaluatedAt).toBeDefined();
    });

    it('should surface the Metrological Evaluation section with real values in the HTML report', () => {
      const html = ReportService.generateHtmlReport(testCaseId, 'Administrator');
      expect(html).toContain('Metrological Evaluation');
      // The real calculated Ec (0) and MPE (from the persisted rule package) must appear,
      // not a placeholder or hardcoded string.
      expect(html).toMatch(/<td>0 g<\/td>/); // Ec = 0 g
      expect(html).toContain('WEIGHING #1');
    });

    it('should surface the same real evaluation values in the PDF text stream', () => {
      const pdfBuffer = ReportService.generatePdfReport(testCaseId, 'Administrator');
      const pdfText = pdfBuffer.toString('latin1');
      expect(pdfText).toContain('Metrological Evaluation');
      expect(pdfText).toContain('WEIGHING #1');
      expect(pdfText).toContain('Verdict: PASS');
    });

    it('REGRESSION: overallVerdict is not a hardcoded APPROVED/constant - a FAIL observation must surface as FAIL', () => {
      // Distinct instrument/test case from the shared beforeAll fixture to avoid interference.
      const failInstrument = {
        id: 'INST-PHASE10-FAIL',
        manufacturerId: 'MFG-TEST',
        name: 'Fail Fixture Instrument',
        model: 'T-FAIL',
        serialNumber: 'SN-FAIL',
        isWeighing: true,
        isManual: true,
        isElectronic: true,
        isSingleRange: true,
        accuracyClass: 'III' as const,
        maxCapacity: '15000',
        minCapacity: '100',
        e: '5',
        d: '5',
        hasTare: false
      };
      instrumentStore.saveItem(failInstrument);

      const failTc: TestCase = {
        id: 'TC_PHASE10_FAIL',
        instrumentId: failInstrument.id,
        technicianId: 'TECH-1',
        status: 'APPROVED',
        testConfiguration: {
          weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED',
          tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED'
        },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      testCaseStore.saveItem(failTc);

      // Same values as GT-02-FAIL-III-NOR: Ec=10.5g > MPE(Class III, m=1000)=5g -> FAIL
      const failObs: ObservationRecord = {
        id: 'OBS_PHASE10_FAIL_1',
        testCaseId: failTc.id,
        testType: 'WEIGHING',
        sequence: 1,
        load: '5000',
        indication: '5010',
        additionalWeights: '2'
      };
      failObs.evaluation = EvaluationService.evaluateObservation(failInstrument, failObs, true);
      expect(failObs.evaluation.compliance.verdict).toBe('FAIL'); // sanity check on the fixture itself
      observationStore.saveItem(failObs);

      const data = ReportService.generateReportData(failTc.id, 'Administrator');
      expect(data.complianceSummary.overallVerdict).toBe('FAIL');
      expect(data.complianceSummary.weighing).toBe('FAIL');
      expect(data.observationEvaluations[0].verdict).toBe('FAIL');
    });

    it('REGRESSION: ruleEngineVersion is read from persisted evaluation data, not a hardcoded literal', () => {
      // Directly persist an observation whose evaluation carries a rule version different
      // from the app-wide MVP constant. If ReportService were still hardcoding the version
      // (as it did before this wiring), this test would see the old literal instead.
      const versionInstrument = {
        id: 'INST-PHASE10-VER',
        manufacturerId: 'MFG-TEST',
        name: 'Version Fixture Instrument',
        model: 'T-VER',
        serialNumber: 'SN-VER',
        isWeighing: true,
        isManual: true,
        isElectronic: true,
        isSingleRange: true,
        accuracyClass: 'III' as const,
        maxCapacity: '15000',
        minCapacity: '100',
        e: '5',
        d: '5',
        hasTare: false
      };
      instrumentStore.saveItem(versionInstrument);

      const versionTc: TestCase = {
        id: 'TC_PHASE10_VER',
        instrumentId: versionInstrument.id,
        technicianId: 'TECH-1',
        status: 'APPROVED',
        testConfiguration: {
          weighing: 'NOT STARTED', eccentricity: 'NOT STARTED', repeatability: 'NOT STARTED',
          tare: 'NOT APPLICABLE', zeroSetting: 'NOT STARTED'
        },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      testCaseStore.saveItem(versionTc);

      const versionObs: ObservationRecord = {
        id: 'OBS_PHASE10_VER_1',
        testCaseId: versionTc.id,
        testType: 'WEIGHING',
        sequence: 1,
        load: '5000',
        indication: '5005',
        additionalWeights: '3',
        evaluation: {
          calculation: { P: { value: '5004.5', unit: 'g' }, E: { value: '4.5', unit: 'g' }, Ec: { value: '4.5', unit: 'g' }, m: '1000', traces: [] },
          rulePackage: {
            status: 'APPLICABLE',
            mpeLimit: { value: '5', unit: 'g' },
            mpeMultiplier: '1.0',
            traceability: {
              ruleId: 'TEST-RULE',
              ruleVersion: 'TEST-RULE-VERSION-DISTINCT-9.9.9',
              sourceDocument: 'Test Fixture',
              sourceReference: 'n/a',
              explanation: []
            }
          },
          compliance: { verdict: 'PASS', trace: { instrumentIdentity: versionInstrument.id, appliedLoad: { value: '5000', unit: 'g' }, internalMath: { P: { value: '5004.5', unit: 'g' }, E: { value: '4.5', unit: 'g' }, Ec: { value: '4.5', unit: 'g' } }, activeMpeCeiling: { value: '5', unit: 'g' }, applicableRequirement: 'test', ruleEngineVersion: 'TEST-RULE-VERSION-DISTINCT-9.9.9', resolutionComparison: 'Absolute(Ec: 4.5 g) <= MPELimit(5 g) -> TRUE' } },
          evaluatedAt: new Date().toISOString()
        }
      };
      observationStore.saveItem(versionObs);

      const data = ReportService.generateReportData(versionTc.id, 'Administrator');
      expect(data.meta.ruleEngineVersion).toBe('TEST-RULE-VERSION-DISTINCT-9.9.9');
      expect(data.meta.ruleEngineVersion).not.toBe('OIML-R76-1-2006-CORE-V1.0.0-MVP');
      expect(data.observationEvaluations[0].ruleVersion).toBe('TEST-RULE-VERSION-DISTINCT-9.9.9');

      const html = ReportService.generateHtmlReport(versionTc.id, 'Administrator');
      expect(html).toContain('TEST-RULE-VERSION-DISTINCT-9.9.9');
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
