import fs from "fs";
import path from "path";
import { currentDemoWorkspace } from "../services/demoScope";

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../../../data");
export class JsonStore<T extends { id: string }> {
  private collections = new Map<string, Map<string, T>>();
  constructor(private filename: string) {}

  private location(): string {
    const workspace = currentDemoWorkspace();
    const folder = workspace ? path.join(DATA_DIR, "evaluator-demo", workspace) : DATA_DIR;
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    return path.join(folder, this.filename);
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
    } catch {
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
