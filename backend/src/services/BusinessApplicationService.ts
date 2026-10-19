import { randomUUID } from 'crypto';
import { JsonStore } from '../repositories/JsonStore';
import type { Instrument } from '../types/domain';

export type BusinessApplicationStatus = 'SUBMITTED';

export interface ApplicationHistoryEntry {
  action: 'SUBMITTED';
  actorId: string;
  at: string;
}

export interface BusinessApplication {
  id: string;
  ownerId: string;
  submissionKey: string;
  businessName: string;
  address: string;
  instrument: Instrument;
  type: 'INITIAL';
  status: BusinessApplicationStatus;
  createdAt: string;
  updatedAt: string;
  history: ApplicationHistoryEntry[];
}

export interface ApplicationActor {
  id: string;
  role: string;
}

export type NewBusinessApplication = Pick<BusinessApplication, 'businessName' | 'address'> & {
  submissionKey: string;
  instrument: Omit<Instrument, 'id' | 'manufacturerId'>;
};

export class ApplicationHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export const businessApplicationStore = new JsonStore<BusinessApplication>('applications.json', true, 'Application');

function requireBusiness(actor: ApplicationActor) {
  if (actor.role !== 'Business') throw new ApplicationHttpError(403, 'Only Business accounts can access applications');
}

export function listOwnApplications(actor: ApplicationActor) {
  requireBusiness(actor);
  return businessApplicationStore.findAll()
    .filter(application => application.ownerId === actor.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getOwnApplication(id: string, actor: ApplicationActor) {
  requireBusiness(actor);
  const application = businessApplicationStore.findById(id);
  if (!application || application.ownerId !== actor.id) throw new ApplicationHttpError(404, 'Application not found');
  return application;
}

export function submitBusinessApplication(actor: ApplicationActor, input: NewBusinessApplication) {
  requireBusiness(actor);
  const existing = businessApplicationStore.findAll().find(application =>
    application.ownerId === actor.id && application.submissionKey === input.submissionKey,
  );
  if (existing) return { application: existing, created: false };
  const now = new Date().toISOString();
  const application: BusinessApplication = {
    id: randomUUID(),
    ownerId: actor.id,
    submissionKey: input.submissionKey,
    businessName: input.businessName,
    address: input.address,
    instrument: {
      ...input.instrument,
      id: randomUUID(),
      manufacturerId: '',
    },
    type: 'INITIAL',
    status: 'SUBMITTED',
    createdAt: now,
    updatedAt: now,
    history: [{ action: 'SUBMITTED', actorId: actor.id, at: now }],
  };

  try {
    return { application: businessApplicationStore.saveItem(application), created: true };
  } catch {
    throw new ApplicationHttpError(503, 'Application could not be saved. Your form is unchanged; please try again.');
  }
}
