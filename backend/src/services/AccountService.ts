import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { ScopedJsonStore } from "../repositories/ScopedJsonStore";

export const roles = [
  "Business",
  "LMO",
  "GATC",
  "Technician",
  "Reviewer",
  "Administrator",
] as const;
export type Role = (typeof roles)[number];
export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}
export const accountStore = new ScopedJsonStore<Account>("accounts.json");
export const publicAccount = ({ passwordHash, ...account }: Account) => account;
export function createAccount(
  name: string,
  email: string,
  password: string,
  role: Role,
): Account {
  const normalized = email.trim().toLowerCase();
  if (accountStore.findAll().some((a) => a.email === normalized))
    throw new Error("An account with this email already exists");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  return accountStore.saveItem({
    id: randomUUID(),
    name: name.trim(),
    email: normalized,
    role,
    passwordHash,
    active: true,
    createdAt: new Date().toISOString(),
  });
}
export function checkPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === actual.length && timingSafeEqual(buffer, actual);
}
