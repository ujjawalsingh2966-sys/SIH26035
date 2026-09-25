import { EvidenceRecord } from '../types/evidence';
import { JsonStore } from '../repositories/JsonStore';

const evidenceStore = new JsonStore<EvidenceRecord>('evidence.json');

export class EvidenceService {
  public static addEvidence(
    testCaseId: string,
    testType: 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING' | 'GENERAL',
    description: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    uploadedBy: string,
    fileData?: string
  ): EvidenceRecord {
    const evidence: EvidenceRecord = {
      id: `ev_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      testCaseId,
      testType,
      description,
      fileName,
      mimeType,
      sizeBytes,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      fileData
    };

    evidenceStore.saveItem(evidence);
    return evidence;
  }

  public static getEvidenceForTestCase(testCaseId: string): EvidenceRecord[] {
    const all = evidenceStore.findAll();
    return all.filter(e => e.testCaseId === testCaseId);
  }

  public static getEvidenceById(evidenceId: string): EvidenceRecord | null {
    return evidenceStore.findById(evidenceId) || null;
  }
}
