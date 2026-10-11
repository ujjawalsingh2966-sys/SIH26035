import "../config/env";
import { createAccount } from "../services/AccountService";
const {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME = "Administrator",
} = process.env;
if (
  !ADMIN_EMAIL ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL) ||
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD.length < 12 ||
  ADMIN_PASSWORD.length > 128
) {
  throw new Error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (12–128 characters) in the environment before running this command",
  );
}
const account = createAccount(
  ADMIN_NAME,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  "Administrator",
);
console.log(
  `Created administrator ${account.email}. Remove ADMIN_PASSWORD from your environment now.`,
);
