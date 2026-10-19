const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const baseUrl = process.env.W8LAB_FRONTEND_URL || 'http://127.0.0.1:3014'
const outputDir = path.resolve('artifacts/browser-review/production-shell-20261017')

function tokenFor(role, email) {
  const payload = Buffer.from(JSON.stringify({
    id: `${role.toLowerCase()}-browser-check`,
    role,
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  return `eyJhbGciOiJub25lIn0.${payload}.browser-check`
}

async function useSession(page, role, email) {
  const token = tokenFor(role, email)
  await page.addInitScript((value) => localStorage.setItem('nawi_token', value), token)
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const errors = []
  const results = []

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  desktop.on('pageerror', (error) => errors.push(`desktop pageerror: ${error.message}`))
  await useSession(desktop, 'Reviewer', 'reviewer@example.test')
  await desktop.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await desktop.getByRole('link', { name: 'W8LAB home' }).waitFor()
  const overviewCurrent = await desktop.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')
  await desktop.getByRole('button', { name: 'Collapse navigation' }).click()
  await desktop.getByRole('button', { name: 'Expand navigation' }).waitFor()
  await desktop.screenshot({ path: path.join(outputDir, 'precision-rail-desktop.png'), fullPage: true })
  results.push({ desktop: overviewCurrent === 'page' ? 'PASS' : 'FAIL', collapse: 'PASS' })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  mobile.on('pageerror', (error) => errors.push(`mobile pageerror: ${error.message}`))
  await useSession(mobile, 'Technician', 'technician@example.test')
  await mobile.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await mobile.getByRole('button', { name: 'Open navigation' }).click()
  await mobile.getByRole('button', { name: 'Close navigation' }).first().waitFor()
  await mobile.screenshot({ path: path.join(outputDir, 'precision-rail-mobile-open.png'), fullPage: true })
  await mobile.keyboard.press('Escape')
  const mobileExpanded = await mobile.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded')
  results.push({ mobile: mobileExpanded === 'false' ? 'PASS' : 'FAIL', escapeClose: mobileExpanded === 'false' ? 'PASS' : 'FAIL' })

  const business = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  await useSession(business, 'Business', 'operations@example.test')
  await business.goto(`${baseUrl}/account`, { waitUntil: 'networkidle' })
  const accountVisible = await business.getByRole('link', { name: 'Account' }).isVisible()
  const instrumentsVisible = await business.getByRole('link', { name: 'Instruments' }).count()
  results.push({ businessRoleVisibility: accountVisible && instrumentsVisible === 0 ? 'PASS' : 'FAIL' })

  await browser.close()
  const report = { baseUrl, results, pageErrors: errors }
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (errors.length || JSON.stringify(results).includes('FAIL')) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
