import fs from "fs";
import os from "os";
import path from "path";
// Every suite owns an isolated disposable store; tests never touch pilot records.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "w8lab-test-"));
process.env.DATA_DIR = directory;
const { accountStore } = require("../src/services/AccountService");
for (const [id, role, email] of [
  ["tech-1", "Technician", "t1@example.com"],
  ["tech-2", "Technician", "t2@example.com"],
  ["tech123", "Technician", "tech@example.com"],
  ["rev123", "Reviewer", "rev@example.com"],
  ["tech-eval-1", "Technician", "tech-eval@example.com"],
  ["rev-eval-1", "Reviewer", "rev-eval@example.com"],
])
  accountStore.saveItem({
    id,
    role,
    email,
    name: id,
    active: true,
    passwordHash: "",
    createdAt: new Date().toISOString(),
  });
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));
