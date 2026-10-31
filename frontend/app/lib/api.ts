export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  demo?: boolean;
  demoId?: string;
  demoExpiresAt?: string;
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("nawi_token") : null;
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    if (
      res.status === 401 &&
      !path.startsWith("/auth/login") &&
      typeof window !== "undefined"
    ) {
      localStorage.removeItem("nawi_token");
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : body.error?.message ||
          body.errors?.map((e: any) => `${e.path}: ${e.msg}`).join("; ") ||
          "Request failed",
    );
  }
  return body.data;
}
export function post<T = any>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
