export type TestCaseStatus = 'DRAFT' | 'TESTING' | 'READY_FOR_REVIEW' | 'UNDER_REVIEW' | 'RETURNED_FOR_CORRECTION' | 'APPROVED'
export type ObservationType = 'WEIGHING' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE' | 'ZERO_SETTING'
export interface Session { id: string; role: string; email: string; exp: number }
export interface TestCase {
  id: string; instrumentId: string; technicianId: string; status: TestCaseStatus; revision?: number
  reviewerId?: string; reviewNotes?: string; approvalDate?: string; createdAt: string; updatedAt: string
  laboratoryConditions?: { temperature: string; humidity: string; pressure: string }
  testConfiguration: Record<string, string>; isInitialVerification?: boolean
}
export interface Instrument {
  id: string; name: string; model: string; serialNumber: string; accuracyClass?: string
  maxCapacity?: string; minCapacity?: string; e?: string; d?: string
  n?: string; softwareIdentification?: string; typeApprovalMark?: string
}
interface Quantity { value: string; unit: string }
export interface Observation {
  id: string; testCaseId: string; testType: ObservationType; sequence: number
  load: string; indication: string; additionalWeights: string; unit?: string; zeroError?: string
  evaluation?: {
    calculation: { E: Quantity; Ec: Quantity }
    rulePackage: { status: string; mpeLimit?: Quantity; reason?: string; traceability?: { ruleVersion: string; explanation: string[] } }
    compliance: { verdict: string; trace?: { resolutionComparison: string; applicableRequirement: string } }
    evaluatedAt: string
  }
}
export interface AuditRecord {
  id: string; timestamp: string; actorId: string; actorRole: string; action: string
  previousState?: string; newState?: string; metadata?: Record<string, unknown>
}
export interface Evidence {
  id: string; testType: string; description: string; fileName: string; mimeType: string
  sizeBytes: number; uploadedBy: string; uploadedAt: string; fileData?: string
}
export interface LaboratoryRecord {
  testCase: TestCase; instrument?: Instrument; manufacturer?: { name: string; address?: string; identifier?: string }
  metadataSource?: 'SNAPSHOT' | 'LEGACY_LIVE_REFERENCE'
  history: AuditRecord[]; evidence: Evidence[]
  programme?: {
    complete: boolean; applicability: 'DETERMINED' | 'UNDETERMINED'
    overallVerdict: 'PASS' | 'FAIL' | 'INCOMPLETE'; observedOutcome: string; issues: string[]
    tests: Record<ObservationType, { status: string; reason?: string; observations: number }>
  }
}

export const statusLabel = (status: string) => status.replace(/_/g, ' ')

// UI hints only. Every API request independently verifies its signed token and permissions.
export function getSession(): Session | null {
  try {
    const token = localStorage.getItem('nawi_token')
    if (!token) return null
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const session = JSON.parse(atob(part)) as Session
    return session.id && session.exp * 1000 > Date.now() ? session : null
  } catch { return null }
}

// Matches POST /api/v1/instruments: requireRole(['Technician']). UI guidance only;
// the backend independently authenticates and authorizes every creation request.
export const canCreateInstrument = (session: Session | null | undefined) => session?.role === 'Technician'

export async function laboratoryApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nawi_token')
  if (!token) throw new Error('Please sign in to continue.')
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1${path}`, {
    ...options,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
  })
  if (response.status === 401) {
    localStorage.removeItem('nawi_token')
    window.dispatchEvent(new Event('w8lab-session-invalid'))
    throw new Error('Your session has ended. Please sign in again.')
  }
  const result = await response.json()
  if (!response.ok || !result.success) {
    throw new Error(result.error || result.errors?.map((error: { path?: string; msg: string }) => `${error.path || 'Request'}: ${error.msg}`).join('; ') || `Request failed (${response.status})`)
  }
  return result.data as T
}
