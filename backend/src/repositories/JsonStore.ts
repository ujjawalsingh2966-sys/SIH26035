import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../../data');

export class JsonStore<T extends { id: string }> {
  private collection: Map<string, T> = new Map();
  private filePath: string;

  constructor(filename: string) {
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
        console.error(`Failed to load ${this.filePath}`, err);
      }
    }
  }

  private save() {
    try {
      const data = Array.from(this.collection.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed to save ${this.filePath}`, err);
    }
  }

  findAll(): T[] {
    return Array.from(this.collection.values());
  }

  findById(id: string): T | undefined {
    return this.collection.get(id);
  }

  saveItem(item: T): T {
    this.collection.set(item.id, item);
    this.save();
    return item;
  }

  clear(): void {
    this.collection.clear();
    this.save();
  }
}
