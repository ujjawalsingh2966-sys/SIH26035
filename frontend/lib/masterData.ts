import Decimal from 'decimal.js'
Decimal.set({ precision: 100 })

export interface Manufacturer {
  id: string; name: string; address: string; identifier: string; active?: boolean; revision?: number; createdBy?: string;
}
/** Early form feedback only. The backend independently enforces the registration contract. */
export function registrationIssue(input: Record<string, unknown>): string | undefined {
  for (const key of ['manufacturerId', 'name', 'model', 'serialNumber']) {
    if (typeof input[key] !== 'string' || !(input[key] as string).trim() || (input[key] as string).length > 160) return `${key} is required (maximum 160 characters).`
  }
  const factors: Record<string, string> = { mg: '0.001', g: '1', kg: '1000', t: '1000000' }
  if (typeof input.weighingUnit !== 'string' || !Object.hasOwn(factors, input.weighingUnit)) return 'Select a supported weighing unit: mg, g, kg or t.'
  for (const key of ['isWeighing', 'isManual', 'isElectronic', 'isSingleRange', 'hasTare', 'hasAuxiliaryIndication', 'isGrading', 'softwareControlled']) {
    if (typeof input[key] !== 'boolean') return `${key} must be explicitly declared.`
  }
  if (![input.isWeighing, input.isManual, input.isElectronic, input.isSingleRange].every(value => value === true)) return 'This automatic, mechanical or multi-range profile is not supported.'
  if (!['I', 'II', 'III', 'IIII'].includes(String(input.accuracyClass))) return 'Select a supported accuracy class.'
  const quantities: Record<string, Decimal> = {}
  for (const key of ['maxCapacity', 'minCapacity', 'e', 'd']) {
    const value = input[key]
    if (typeof value !== 'string' || value.length > 40 || !/^\d+(?:\.\d+)?$/.test(value)) return `${key} must be a positive decimal without exponent notation.`
    quantities[key] = new Decimal(value).times(factors[input.weighingUnit])
    if (!quantities[key].gt(0)) return `${key} must be greater than zero.`
  }
  const { maxCapacity: max, minCapacity: min, e, d } = quantities
  if (!min.lt(max) || d.gt(e)) return 'Require 0 < Min < Max and 0 < d ≤ e.'
  if (![e, d].every(value => /^[125](?:\.0+)?e[+-]?\d+$/.test(value.toExponential()))) return 'Scale intervals must be 1, 2 or 5 times a power of ten.'
  if (!max.mod(e).isZero()) return 'Max must be an integer multiple of e.'
  const n = max.div(e), cls = input.accuracyClass
  let minN: number, maxN: number | undefined, minFactor: number
  if (cls === 'I') { if (e.lt('0.001')) return 'Class I below 1 mg requires an unsupported specialist profile.'; minN = 50000; minFactor = 100 }
  else if (cls === 'II') { if (e.lt('0.001')) return 'Class II e must be at least 0.001 g.'; minN = e.lte('0.05') ? 100 : 5000; maxN = 100000; minFactor = e.lte('0.05') ? 20 : 50 }
  else if (cls === 'III') { if (e.lt('0.1')) return 'Class III e must be at least 0.1 g.'; minN = e.lte(2) ? 100 : 500; maxN = 10000; minFactor = 20 }
  else { if (e.lt(5)) return 'Class IIII e must be at least 5 g.'; minN = 100; maxN = 1000; minFactor = 10 }
  if (input.hasAuxiliaryIndication) {
    if (!['I', 'II'].includes(String(cls)) || !d.lt(e) || !/^1e[+-]?\d+$/.test(e.toExponential()) || e.gt(d.times(10))) return 'Auxiliary indication requires class I/II and power-of-ten e with d < e ≤ 10d.'
  } else if (!d.eq(e)) return 'Graduated instruments without auxiliary indication require e = d.'
  if (n.lt(minN) || maxN !== undefined && n.gt(maxN)) return 'n is outside the supported accuracy-class range.'
  if (input.isGrading && cls !== 'III' && cls !== 'IIII') return 'This grading profile is not supported.'
  if (min.lt((input.hasAuxiliaryIndication ? d : e).times(input.isGrading ? 5 : minFactor))) return 'Min is below the declared-profile lower limit.'
  if (input.softwareControlled && (typeof input.softwareIdentification !== 'string' || !input.softwareIdentification.trim())) return 'Software identification is required.'
  if (!input.softwareControlled && input.softwareIdentification) return 'Remove software identification or declare software control.'
}
export interface RegisteredInstrument {
  id: string; manufacturerId: string; name: string; model: string; serialNumber: string; accuracyClass?: string;
  maxCapacity?: string; minCapacity?: string; e?: string; d?: string; n?: string; hasTare?: boolean;
  isWeighing: boolean; isManual: boolean; isElectronic: boolean; isSingleRange: boolean;
  hasAuxiliaryIndication?: boolean; isGrading?: boolean; softwareControlled?: boolean;
  softwareIdentification?: string; typeApprovalMark?: string; technicalNotes?: string; revision?: number; createdBy?: string;
  declaredSpecifications?: { unit: string; maxCapacity: string; minCapacity: string; e: string; d: string };
}
export const masterField = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
export const masterButton = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-500'
