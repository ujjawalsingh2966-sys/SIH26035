import fs from "fs";
import path from "path";
import { assertDemoWorkspaceActive, currentDemoWorkspace, demoWorkspaceFolder } from "../services/demoScope";

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../../../data");

export class JsonStore<T extends { id: string }> {
  // Stores are long lived; expired workspace caches must be evicted after cleanup.
  private static instances = new Set<JsonStore<any>>();
  private collections = new Map<string, Map<string, T>>();

  constructor(private filename: string) {
    JsonStore.instances.add(this);
  }

  static evictDemoWorkspace(id: string): void {
    const folder = demoWorkspaceFolder(id);
    for (const store of JsonStore.instances) {
      store.collections.delete(path.join(folder, store.filename));
    }
  }

  private location(): string {
    const workspace = currentDemoWorkspace();
    if (workspace) {
      // Revalidate on EVERY store operation. Do not create a folder for an expired
      // or deleted workspace, even if a request was authenticated just before expiry.
      assertDemoWorkspaceActive(workspace);
      return path.join(demoWorkspaceFolder(workspace), this.filename);
    }
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    return path.join(DATA_DIR, this.filename);
  }

  private collection(): Map<string, T> {
    const location = this.location();
    const cached = this.collections.get(location);
    if (cached) return cached;
    const map = new Map<string, T>();
    if (fs.existsSync(location)) {
      try {
        const parsed: T[] = JSON.parse(fs.readFileSync(location, "utf8"));
        if (!Array.isArray(parsed)) throw new Error("Expected array");
        for (const item of parsed) map.set(item.id, item);
      } catch { throw new Error(`Cannot read data store ${location}`); }
    }
    this.collections.set(location, map);
    return map;
  }

  private save(): void {
    const location = this.location();
    const temp = `${location}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(Array.from(this.collection().values()), null, 2), { mode: 0o600 });
      fs.renameSync(temp, location);
    } catch (error) {
      try { fs.rmSync(temp, { force: true }); } catch {}
      throw new Error(`Cannot persist data store ${location}`);
    }
  }

  findAll(): T[] { return structuredClone(Array.from(this.collection().values())); }
  findById(id: string): T | undefined { return structuredClone(this.collection().get(id)); }

  saveItem(item: T): T {
    const collection = this.collection();
    const prior = collection.get(item.id);
    collection.set(item.id, structuredClone(item));
    try { this.save(); } catch (error) {
      if (prior) collection.set(item.id, prior); else collection.delete(item.id);
      throw error;
    }
    return item;
  }

  deleteItem(id: string): boolean {
    const collection = this.collection();
    const prior = collection.get(id);
    if (!prior) return false;
    collection.delete(id);
    try { this.save(); } catch (error) { collection.set(id, prior); throw error; }
    return true;
  }

  clear(): void {
    const collection = this.collection();
    const previous = new Map(collection);
    collection.clear();
    try { this.save(); } catch (error) { this.collections.set(this.location(), previous); throw error; }
  }
}
