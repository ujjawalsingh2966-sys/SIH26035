'use client'
import { useParams } from 'next/navigation'
import { InstrumentRecord } from '@/components/InstrumentRecord'
export default function Page() { return <InstrumentRecord id={useParams<{ id: string }>().id} historyOnly /> }
