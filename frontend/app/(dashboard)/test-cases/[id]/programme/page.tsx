'use client'
import NativeProgramme from '@/components/NativeProgramme'
export default function Page({ params }: { params:{id:string} }) { return <NativeProgramme id={params.id} /> }
