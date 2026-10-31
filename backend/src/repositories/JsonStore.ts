import fs from "fs";
import path from "path";

const DATA_DIR =
  process.env.DATA_DIR || path.resolve(__dirname, "../../../data");

export class JsonStore<T extends { id: string }> {
  private collection: Map<string, T> = new Map();
  private filePath: string;

  constructor(filename: string, directory: string = DATA_DIR) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    this.filePath = path.join(directory, filename);
    this.load();
  }

  private load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(raw);
        for (const item of data) {
          this.collection.set(item.id, item);
        }
      } catch (err) {
        throw new Error(`Cannot read data store ${this.filePath}`);
      }
    }
  }

  private save() {
    try {
      const data = Array.from(this.collection.values());
      const temporaryPath = `${this.filePath}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), {
        encoding: "utf-8",
        mode: 0o600,
      });
      fs.renameSync(temporaryPath, this.filePath);
    } catch (err) {
      throw new Error(`Cannot persist data store ${this.filePath}`);
    }
  }

  findAll(): T[] {
    return structuredClone(Array.from(this.collection.values()));
  }

  findById(id: string): T | undefined {
    return structuredClone(this.collection.get(id));
  }

  saveItem(item: T): T {
    const previous = this.collection.get(item.id);
    this.collection.set(item.id, structuredClone(item));
    try {
      this.save();
    } catch (err) {
      if (previous) this.collection.set(item.id, previous);
      else this.collection.delete(item.id);
      throw err;
    }
    return item;
  }

  deleteItem(id: string): boolean {
    const previous = this.collection.get(id);
    if (!previous) return false;
    this.collection.delete(id);
    try {
      this.save();
    } catch (err) {
      this.collection.set(id, previous);
      throw err;
    }
    return true;
  }

  clear(): void {
    this.collection.clear();
    this.save();
  }
}
