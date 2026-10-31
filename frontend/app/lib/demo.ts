import { API_BASE_URL } from "./api";

export type EvaluatorRole = "Technician" | "Reviewer" | "Administrator";
export interface DemoAccess {
  token: string;
  user: { id: string; name: string; email: string; role: EvaluatorRole;
    demo: true; demoId: string; demoExpiresAt: string };
  demo: { id: string; role: EvaluatorRole; availableRoles: EvaluatorRole[];
    createdAt: string; expiresAt: string };
}

async function decodeResponse(response: Response): Promise<DemoAccess> {
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(typeof result.error === "string" ? result.error :
      result.error?.message || "Unable to access evaluator demo.");
  }
  if (!result.data?.token || !result.data?.demo?.id)
    throw new Error("Invalid demo response.");
  return result.data as DemoAccess;
}

function saveDemoAccess(access: DemoAccess) {
  // A browser profile keeps one signed session token; a role switch updates
  // the existing session, never allocates a second demo ID.
  localStorage.setItem("w8lab_demo_access", access.token);
  localStorage.setItem("nawi_token", access.token);
}

export async function startEvaluatorDemo(): Promise<DemoAccess> {
  const previous = localStorage.getItem("w8lab_demo_access");
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/demo/start`, {
    method: "POST",
    credentials: "include",
    headers: previous ? { "X-W8LAB-Demo-Token": previous } : {},
  });
  const access = await decodeResponse(response);
  saveDemoAccess(access);
  return access;
}

export async function switchEvaluatorRole(role: EvaluatorRole): Promise<DemoAccess> {
  const token = localStorage.getItem("nawi_token");
  if (!token) throw new Error("Demo session is unavailable.");
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/demo/switch`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  const access = await decodeResponse(response);
  saveDemoAccess(access);
  return access;
}
