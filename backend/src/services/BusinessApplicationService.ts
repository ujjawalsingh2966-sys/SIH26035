import { unitOfWork } from '../repositories/persistence';
import { randomUUID } from 'crypto';
import { businessApplicationStore } from '../repositories';
import type { ApplicationActor, BusinessApplication, NewBusinessApplication } from '../types/businessApplication';
export { businessApplicationStore } from '../repositories';
export type { BusinessApplicationStatus, ApplicationHistoryEntry, BusinessApplication, ApplicationActor,
  NewBusinessApplication } from '../types/businessApplication';

export class ApplicationHttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}


function requireBusiness(actor: ApplicationActor) {
  if (actor.role !== 'Business') throw new ApplicationHttpError(403, 'Only Business accounts can access applications');
}

export async function listOwnApplications(actor: ApplicationActor) {
  return unitOfWork.read(async () => {
    requireBusiness(actor);
    return (await businessApplicationStore.findAll())
      .filter(application => application.ownerId === actor.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  });
}

export async function getOwnApplication(id: string, actor: ApplicationActor) {
  return unitOfWork.read(async () => {
    requireBusiness(actor);
    const application = (await businessApplicationStore.findById(id));
    if (!application || application.ownerId !== actor.id) throw new ApplicationHttpError(404, 'Application not found');
    return application;
  });
}

export async function submitBusinessApplication(actor: ApplicationActor, input: NewBusinessApplication) {
  return unitOfWork.write(async () => {
    requireBusiness(actor);
    const existing = (await businessApplicationStore.findAll()).find(application =>
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
      return { application: (await businessApplicationStore.saveItem(application)), created: true };
    } catch {
      throw new ApplicationHttpError(503, 'Application could not be saved. Your form is unchanged; please try again.');
    }
  });
}
