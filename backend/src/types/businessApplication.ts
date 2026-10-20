import type { Instrument } from './domain';

export type BusinessApplicationStatus = 'SUBMITTED';
export interface ApplicationHistoryEntry { action: 'SUBMITTED'; actorId: string; at: string }
export interface BusinessApplication {
  id: string; ownerId: string; submissionKey: string; businessName: string; address: string;
  instrument: Instrument; type: 'INITIAL'; status: BusinessApplicationStatus;
  createdAt: string; updatedAt: string; history: ApplicationHistoryEntry[];
}
export interface ApplicationActor { id: string; role: string }
export type NewBusinessApplication = Pick<BusinessApplication, 'businessName' | 'address'> & {
  submissionKey: string; instrument: Omit<Instrument, 'id' | 'manufacturerId'>;
};
