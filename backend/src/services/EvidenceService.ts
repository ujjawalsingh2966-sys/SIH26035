import { unitOfWork } from '../repositories/persistence';
import { EvidenceRecord } from '../types/evidence';
import { evidenceStore } from '../repositories';
export { evidenceStore } from '../repositories';

export class EvidenceService {
  public static async addEvidence(
    testCaseId: string,
    testType: 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING' | 'GENERAL',
    description: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    uploadedBy: string,
    fileData?: string
  ): Promise<EvidenceRecord> {
    return unitOfWork.write(async () => {
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

      (await evidenceStore.saveItem(evidence));
      return evidence;
    });
  }

  public static async getEvidenceForTestCase(testCaseId: string): Promise<EvidenceRecord[]> {
    return unitOfWork.read(async () => {
      const all = (await evidenceStore.findAll());
      return all.filter(e => e.testCaseId === testCaseId);
    });
  }

  public static async getEvidenceById(evidenceId: string): Promise<EvidenceRecord | null> {
    return unitOfWork.read(async () => {
      return (await evidenceStore.findById(evidenceId)) || null;
    });
  }
}
