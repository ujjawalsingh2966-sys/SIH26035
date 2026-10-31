import path from "path";
import { JsonStore } from "./JsonStore";
import { currentDemoId } from "../services/DemoScope";

/**
 * Keeps all ordinary records in the existing store and sends demo requests to
 * their own persistent directory. A role switch never changes the directory.
 */
export class ScopedJsonStore<T extends { id: string }> {
  private readonly regular: JsonStore<T>;
  private readonly demos = new Map<string, JsonStore<T>>();

  constructor(private readonly filename: string) {
    this.regular = new JsonStore<T>(filename);
  }

  private active(): JsonStore<T> {
    const id = currentDemoId();
    if (!id) return this.regular;
    let store = this.demos.get(id);
    if (!store) {
      const root = process.env.DATA_DIR || path.resolve(__dirname, "../../../data");
      store = new JsonStore<T>(this.filename, path.join(root, "demo-sandboxes", id));
      this.demos.set(id, store);
    }
    return store;
  }

  findAll(): T[] { return this.active().findAll(); }
  findById(id: string): T | undefined { return this.active().findById(id); }
  saveItem(item: T): T { return this.active().saveItem(item); }
  deleteItem(id: string): boolean { return this.active().deleteItem(id); }
  clear(): void { this.active().clear(); }
}
