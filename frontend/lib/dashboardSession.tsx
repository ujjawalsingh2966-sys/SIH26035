'use client'
import { createContext, useContext } from 'react'
import type { Session } from './laboratory'

// Share the dashboard layout's existing authenticated session with creation UI.
export const DashboardSessionContext = createContext<Session | null>(null)
export const useDashboardSession = () => useContext(DashboardSessionContext)
