import { auditStore } from '../repositories';
import { AuditRecord } from '../types/domain';

export class AuditService {
  static recordEvent(params: {
    testCaseId: string;
    actorId: string;
    actorRole: string;
    action: string;
    previousState?: string;
    newState?: string;
    metadata?: Record<string, any>;
  }): AuditRecord {
    const record: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      testCaseId: params.testCaseId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      previousState: params.previousState,
      newState: params.newState,
      timestamp: new Date().toISOString(),
      metadata: params.metadata
    };
    
    auditStore.saveItem(record);
    return record;
  }

  static getHistoryForTest(testCaseId: string): AuditRecord[] {
    return auditStore.findAll().filter(r => r.testCaseId === testCaseId).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}
