'use client'
import { useParams } from 'next/navigation'
import { ManufacturerRecord } from '@/components/ManufacturerViews'
export default function Page() { return <ManufacturerRecord id={useParams<{ id: string }>().id} /> }
