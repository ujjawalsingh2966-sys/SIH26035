import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'W8LAB — Instrument verification workspace',
  description: 'OIML R76-guided weighing instrument testing, evaluation and prototype reporting.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
