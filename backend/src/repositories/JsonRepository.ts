import { JsonStore } from './JsonStore';
import { jsonUnitOfWork, JsonParticipant, JsonUnitOfWork } from './JsonUnitOfWork';
import type { Repository } from './Repository';

/** Async application adapter; existing JSON filenames and record formats remain. */
export class JsonRepository<T extends { id: string }> implements Repository<T> {
  private readonly store: JsonStore<T>;
  private readonly participant: JsonParticipant;

  constructor(filename: string, strictPersistence = false, storageName = 'Account',
    private readonly unitOfWork: JsonUnitOfWork = jsonUnitOfWork) {
    this.store = new JsonStore<T>(filename, strictPersistence, storageName);
    this.participant = {
      snapshot: () => new Map(this.store.findAll().map(item => [item.id, item])),
      persist: snapshot => this.store.persistItems(Array.from((snapshot as Map<string, T>).values())),
      publish: snapshot => this.store.publishItems(Array.from((snapshot as Map<string, T>).values())),
    };
  }

  async findAll(): Promise<T[]> {
    return this.unitOfWork.read(async () => structuredClone(Array.from(this.items().values())));
  }

  async findById(id: string): Promise<T | undefined> {
    return this.unitOfWork.read(async () => structuredClone(this.items().get(id)));
  }

  async saveItem(item: T, _requireDurable = false): Promise<T> {
    // Keep the legacy argument for callers. Every application commit now uses
    // strict replacement/error propagation; this is not fsync/crash atomicity.
    const detached = structuredClone(item);
    return this.unitOfWork.write(async () => {
      this.unitOfWork.changed(this.participant);
      this.items().set(detached.id, detached);
      return structuredClone(detached);
    });
  }

  async deleteItem(id: string): Promise<void> {
    return this.unitOfWork.write(async () => {
      this.unitOfWork.changed(this.participant);
      this.items().delete(id);
    });
  }

  /** Fixture maintenance only: no HTTP endpoint exposes collection clearing. */
  async clear(): Promise<void> {
    return this.unitOfWork.write(async () => {
      this.unitOfWork.changed(this.participant);
      this.items().clear();
    });
  }

  private items(): Map<string, T> { return this.unitOfWork.state(this.participant); }
}
