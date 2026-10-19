'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { laboratoryApi } from '@/lib/laboratory'
import { useDashboardSession } from '@/lib/dashboardSession'
import type { RegisteredInstrument } from '@/lib/masterData'
import { NewInstrumentForm } from '@/components/InstrumentRegistration'
export default function Page() {
  const { id } = useParams<{ id: string }>(), session = useDashboardSession()
  const [data, setData] = useState<{ instrument: RegisteredInstrument; linked: boolean }>(), [error, setError] = useState('')
  useEffect(() => { laboratoryApi<NonNullable<typeof data>>(`/instruments/${id}`).then(setData).catch(error => setError(error.message)) }, [id])
  if (error) return <p role="alert">{error}</p>
  if (!data || !session) return <p role="status">Loading instrument…</p>
  if (data.linked || !(session.role === 'Administrator' || session.role === 'Technician' && session.id === data.instrument.createdBy)) return <p role="alert">This registration is protected from editing.</p>
  return <NewInstrumentForm technicianId={session.id} existing={data.instrument} />
}
