import fs from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';

// Tests must never open the application's data directory, even when DATA_DIR is set.
const DATA_DIR = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'nawi-jest-'))
  : path.resolve(process.env.DATA_DIR || path.resolve(__dirname, '../../../data'));

export class JsonStore<T extends { id: string }> {
  private collection: Map<string, T> = new Map();
  private filePath: string;

  constructor(filename: string, private strictPersistence = false, private storageName = 'Account') {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.filePath = path.join(DATA_DIR, filename);
    this.load();
  }

  private load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        for (const item of data) {
          this.collection.set(item.id, item);
        }
      } catch (err) {
        if (this.strictPersistence) throw new Error(`${this.storageName} storage is unavailable`);
        console.error(`Failed to load ${this.filePath}`, err);
      }
    }
  }

  private save(requireDurable = false) {
    const strict = this.strictPersistence || requireDurable;
    try {
      const data = Array.from(this.collection.values());
      if (strict) {
        // Strict records must not appear saved after a failed write. Keep the
        // existing laboratory persistence behavior unchanged.
        const temporaryPath = `${this.filePath}.tmp`;
        fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
        fs.renameSync(temporaryPath, this.filePath);
      } else {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (err) {
      if (strict) {
        // Log only the operation/error code, never collection contents or credentials.
        const failure = err as NodeJS.ErrnoException;
        console.error(`${this.storageName} persistence failed: ${failure.syscall || 'write'} ${failure.code || 'ERROR'}`);
        throw new Error(`${this.storageName} storage is unavailable`);
      }
      console.error(`Failed to save ${this.filePath}`, err);
    }
  }

  findAll(): T[] {
    return structuredClone(Array.from(this.collection.values()));
  }

  findById(id: string): T | undefined {
    return structuredClone(this.collection.get(id));
  }

  saveItem(item: T, requireDurable = false): T {
    const previous = this.collection.get(item.id);
    this.collection.set(item.id, structuredClone(item));
    try {
      this.save(requireDurable);
    } catch (err) {
      if (previous) this.collection.set(item.id, previous);
      else this.collection.delete(item.id);
      throw err;
    }
    return structuredClone(item);
  }

  /** Internal adapter hooks. Persist first, publish only after the UoW commits. */
  persistItems(items: T[]): void {
    const previous = this.collection;
    this.collection = new Map(items.map(item => [item.id, structuredClone(item)]));
    try { this.save(true); }
    finally { this.collection = previous; }
  }

  publishItems(items: T[]): void {
    this.collection = new Map(items.map(item => [item.id, structuredClone(item)]));
  }

  deleteItem(id: string): void {
    this.collection.delete(id);
    this.save();
  }

  clear(): void {
    this.collection.clear();
    this.save();
  }
}
