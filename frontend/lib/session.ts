const origin = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
export function clearSession() {
  localStorage.removeItem('nawi_token')
  window.dispatchEvent(new Event('w8lab-session-invalid'))
}
export async function verifySession() {
  const token = localStorage.getItem('nawi_token')
  if (!token) throw new Error('Please sign in to continue.')
  const response = await fetch(`${origin}/api/v1/auth/me`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
  if (response.status === 401) { clearSession(); throw new Error('Your session has ended. Please sign in again.') }
  if (!response.ok) throw new Error('W8LAB could not verify your session. Please retry.')
  const result = await response.json()
  return result.data as { id: string; email: string; role: string; name?: string }
}
export async function logout() {
  const token = localStorage.getItem('nawi_token')
  if (token) {
    const response = await fetch(`${origin}/api/v1/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok && response.status !== 401) throw new Error('Sign out could not be confirmed. Please retry.')
  }
  clearSession()
}
