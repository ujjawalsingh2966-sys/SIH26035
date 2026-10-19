const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const frontend = process.env.W8LAB_BROWSER_FRONTEND || 'http://127.0.0.1:3014'
const expectUnavailable = process.env.W8LAB_EXPECT_BACKEND_UNAVAILABLE === '1'
const outputDir = path.resolve('artifacts/browser-review/login-20261017')

async function openLogin(browser, options = {}) {
  const page = await browser.newPage(options)
  await page.goto(`${frontend}/login`)
  await page.getByRole('heading', { name: 'W8LAB' }).waitFor()
  return page
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []

  if (expectUnavailable) {
    const page = await openLogin(browser)
    const failed = []
    page.on('requestfailed', request => {
      if (request.url().includes('/api/v1/auth/login')) failed.push(request.failure()?.errorText || 'request failed')
    })
    await page.getByRole('button', { name: 'Sign In' }).click()
    const expectedMessage = 'Unable to reach the W8LAB server. Check your connection and try again.'
    await page.getByText(expectedMessage, { exact: true }).waitFor()
    const alert = await page.getByText(expectedMessage, { exact: true }).innerText()
    const retryEnabled = await page.getByRole('button', { name: 'Sign In' }).isEnabled()
    results.push({
      backendUnavailable: alert === expectedMessage && failed.length >= 1 ? 'PASS' : 'FAIL',
      retryEnabled: retryEnabled ? 'PASS' : 'FAIL',
    })
    await browser.close()
    console.log(JSON.stringify({ frontend, results }, null, 2))
    if (JSON.stringify(results).includes('FAIL')) process.exitCode = 1
    return
  }

  const desktop = await openLogin(browser, { viewport: { width: 1440, height: 960 } })
  let successfulPosts = 0
  desktop.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/auth/login')) successfulPosts += 1
  })
  await desktop.getByRole('button', { name: 'Sign In' }).click()
  await desktop.waitForURL('**/dashboard')
  const hasSession = await desktop.evaluate(() => Boolean(localStorage.getItem('nawi_token')))
  results.push({ technicianLogin: hasSession && successfulPosts === 1 ? 'PASS' : 'FAIL', destination: new URL(desktop.url()).pathname })

  const reviewer = await openLogin(browser)
  await reviewer.getByText('Reviewing Officer', { exact: true }).click()
  await reviewer.getByRole('button', { name: 'Sign In' }).click()
  await reviewer.waitForURL('**/dashboard')
  await reviewer.getByRole('link', { name: 'W8LAB home' }).waitFor()
  const reviewerRole = await reviewer.evaluate(() => {
    const token = localStorage.getItem('nawi_token')
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role
  })
  results.push({ reviewerLogin: reviewerRole === 'Reviewer' ? 'PASS' : 'FAIL', destination: new URL(reviewer.url()).pathname })

  const invalid = await openLogin(browser)
  await invalid.getByLabel('Password', { exact: true }).fill('invalid-browser-check')
  let invalidPosts = 0
  invalid.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/auth/login')) invalidPosts += 1
  })
  await invalid.locator('form').evaluate(form => {
    form.requestSubmit()
    form.requestSubmit()
  })
  await invalid.getByText('Invalid email or password.', { exact: true }).waitFor()
  const invalidMessage = await invalid.getByText('Invalid email or password.', { exact: true }).innerText()
  const emailPreserved = await invalid.getByLabel('Email Address').inputValue()
  const retryEnabled = await invalid.getByRole('button', { name: 'Sign In' }).isEnabled()
  results.push({
    invalidCredentials: invalidMessage === 'Invalid email or password.' ? 'PASS' : 'FAIL',
    duplicateSubmissionGuard: invalidPosts === 1 ? 'PASS' : 'FAIL',
    inputAndRetry: emailPreserved.length > 0 && retryEnabled ? 'PASS' : 'FAIL',
  })

  const mobileDark = await openLogin(browser, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const title = await mobileDark.title()
  await mobileDark.screenshot({ path: path.join(outputDir, 'w8lab-login-mobile-dark.png'), fullPage: true })
  results.push({ mobileDarkBrand: title === 'W8LAB' && await mobileDark.getByRole('heading', { name: 'W8LAB' }).isVisible() ? 'PASS' : 'FAIL' })

  const business = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await business.goto(`${frontend}/business/login`)
  results.push({ businessBrand: await business.getByLabel('W8LAB').isVisible() ? 'PASS' : 'FAIL' })

  await desktop.screenshot({ path: path.join(outputDir, 'w8lab-dashboard-desktop.png'), fullPage: true })
  await browser.close()
  const report = { frontend, results }
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  if (JSON.stringify(results).includes('FAIL')) process.exitCode = 1
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
