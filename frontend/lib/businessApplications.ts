export type BusinessApplicationStatus = 'SUBMITTED'

export interface BusinessInstrument {
  id: string
  manufacturerId: string
  name: string
  model: string
  serialNumber: string
  accuracyClass: 'II' | 'III' | 'IIII'
  maxCapacity: string
  minCapacity: string
  e: string
  d: string
  hasTare: boolean
  isWeighing: true
  isManual: true
  isElectronic: true
  isSingleRange: true
}

export interface BusinessApplication {
  id: string
  ownerId: string
  businessName: string
  address: string
  instrument: BusinessInstrument
  type: 'INITIAL'
  status: BusinessApplicationStatus
  createdAt: string
  updatedAt: string
  history: Array<{ action: 'SUBMITTED'; actorId: string; at: string }>
}

export interface BusinessApplicationList {
  applications: BusinessApplication[]
  alerts: unknown[]
}

export interface NewBusinessApplication {
  submissionKey: string
  businessName: string
  address: string
  instrument: Omit<BusinessInstrument, 'id' | 'manufacturerId'>
}

function errorMessage(result: unknown, status: number) {
  if (!result || typeof result !== 'object') return `Request failed (${status})`
  const payload = result as {
    error?: string | { message?: string }
    errors?: Array<{ path?: string; msg: string }>
  }
  if (typeof payload.error === 'string') return payload.error
  if (payload.error?.message) return payload.error.message
  if (payload.errors?.length) {
    return payload.errors.map(error => `${error.path || 'Request'}: ${error.msg}`).join('; ')
  }
  return `Request failed (${status})`
}

export async function businessApplicationApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nawi_token')
  if (!token) throw new Error('Please sign in to continue.')

  let response: Response
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1${path}`, {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
    })
  } catch {
    throw new Error('W8LAB could not reach the service. Check your connection and try again.')
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error(response.ok ? 'W8LAB received an unreadable response.' : `Request failed (${response.status})`)
  }

  const envelope = result as { success?: boolean; data?: T }
  if (!response.ok || envelope.success !== true) throw new Error(errorMessage(result, response.status))
  return envelope.data as T
}
