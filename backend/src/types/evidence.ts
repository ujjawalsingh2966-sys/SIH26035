export interface EvidenceRecord {
  id: string;
  testCaseId: string;
  testType: 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING' | 'GENERAL';
  description: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  fileData?: string; // base64 encoded for MVP
}
