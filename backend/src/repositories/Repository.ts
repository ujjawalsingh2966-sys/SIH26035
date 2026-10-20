/** Persistence ports. Values crossing this boundary are detached copies. */
export interface ReadRepository<T extends { id: string }> {
  findById(id: string): Promise<T | undefined>;
  findAll(): Promise<T[]>;
}

export interface Repository<T extends { id: string }> extends ReadRepository<T> {
  saveItem(item: T, requireDurable?: boolean): Promise<T>;
  deleteItem(id: string): Promise<void>;
}

export interface UnitOfWork {
  read<T>(operation: () => Promise<T>): Promise<T>;
  write<T>(operation: () => Promise<T>): Promise<T>;
}
