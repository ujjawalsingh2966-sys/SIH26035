import type { NativeProgramme, NativeTestRecord, NativeSubmission, NativeReading, ProcedureDecision, PerformanceProfile } from '../../backend/src/types/native'
import type { TestCase } from './laboratory'
export type { NativeProgramme, NativeTestRecord, NativeSubmission, NativeReading, ProcedureDecision, PerformanceProfile }
export interface NativeState {
  testCase: TestCase & { masterDataSnapshot?: { instrument: { hasTare?: boolean } } }; programme: NativeProgramme | null; programmeError?: string; tests: NativeTestRecord[];
  assessment: { complete: boolean; overallVerdict: string; observedOutcome: string; issues: string[];
    native?: { procedures: (ProcedureDecision & { status: string; observations: number })[] } }
}
export const blankNativeReading = (sequence: number, unit: string): NativeReading => ({ sequence, unit, load: '', indication: '', additionalWeights: '', unloadedIndication: '', unloadedAtRest: false, resetToZero: false })
export function nativeFormIssue(submission: NativeSubmission, repeat: boolean): string | undefined {
  if (!submission.evidenceReference.trim()) return 'Record an observation/equipment evidence reference.'
  if (!submission.readings.length) return 'Add at least one reading.'
  for (const row of submission.readings) {
    if (!['mg','g','kg','t'].includes(row.unit)) return 'Select a supported mass unit.'
    for (const key of ['load','indication','additionalWeights', ...(repeat ? ['unloadedIndication'] : [])] as const) {
      const value = row[key as keyof NativeReading]
      if (typeof value !== 'string' || value.length > 40 || !/^-?\d+(?:\.\d+)?$/.test(value)) return `Reading ${row.sequence}: ${key} must be a finite decimal without exponent notation.`
      if ((key === 'load' || key === 'additionalWeights') && value.startsWith('-')) return `Reading ${row.sequence}: ${key} cannot be negative.`
    }
  }
}
export function emptyPerformanceProfile(hasTare: boolean): PerformanceProfile {
  return { selfIndicating:null,devices:null,tareKind:hasTare?'UNKNOWN':'NONE',maximumTareG:null,tareWeighingDevice:hasTare?null:false,combinedZeroTare:hasTare?null:false,mobile:null,adjacentSupports:null,rollingSections:null,rollingReverse:null,rollingLoadG:null,initialZeroRangeG:null,stabilityFunctions:null,stabilityDocumentation:'',stabilityWorstCase:'',stabilityLoadsG:{} }
}
export function blankPerformanceReading(sequence:number, unit:string, procedure:string, plan?:NonNullable<NonNullable<ProcedureDecision['samples']>[number]['plan']>[number], devices=1): NativeReading {
  const row:NativeReading={sequence,unit,load:'',indication:'',additionalWeights:'',...(plan?.phase?{phase:plan.phase}:{}),...(plan?.position?{position:plan.position}:{})}
  const zero=()=>({load:'',indication:'',additionalWeights:''})
  if(['ECCENTRICITY','TARE_COMPARISON'].includes(procedure))row.zero=zero()
  if(['TARE','TARE_ACCURACY','TARE_COMPARISON'].includes(procedure))row.tareLoad=''
  if(['SUPPLEMENTARY_WEIGHING','EQUILIBRIUM'].includes(procedure))row.baseLoad=''
  if(procedure==='MULTIPLE_INDICATORS')row.deviceIndications=Array.from({length:devices},()=>({indication:'',additionalWeights:''}))
  if(procedure==='TARE_COMPARISON')row.deviceIndications=[{indication:'',additionalWeights:'',zero:zero()}]
  if(['CREEP','ZERO_RETURN'].includes(procedure)){row.timestamp='';row.temperatureC=''}
  if(procedure==='DISCRIMINATION'){row.initialIndication='';row.decreasedIndication='';row.restoredWeight='';row.addedLoad=''}
  return row
}
