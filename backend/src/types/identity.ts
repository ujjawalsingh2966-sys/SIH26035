export interface Account {
  id: string; name: string; email: string; role: 'Business'; passwordHash: string;
  active: boolean; createdAt: string;
}

export const STAFF_ROLES = ['Technician', 'Reviewer', 'Administrator'] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export interface StaffAccount {
  id: string; name: string; email: string; role: StaffRole; active: boolean;
  passwordHash: string; credentialVersion: number; createdAt: string; updatedAt: string; createdBy: string;
  securityHistory?: { action: string; actorId: string; timestamp: string }[];
}

export interface SessionRecord {
  id: string; accountId: string; kind: 'staff' | 'business'; role: string; email: string;
  credentialVersion: number; createdAt: string; expiresAt: string; revokedAt?: string;
}
