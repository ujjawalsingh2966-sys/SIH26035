const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')

const baseUrl = process.env.W8LAB_PROTOTYPE_URL || 'http://127.0.0.1:3014/prototypes/navigation'
const outputDir = path.resolve(process.env.W8LAB_PROTOTYPE_ARTIFACTS || 'artifacts/browser-review/navigation-prototype-20261017')
const variants = ['precision-rail', 'command-deck', 'workflow-atlas']

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []
  const errors = []

  for (let index = 0; index < variants.length; index += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: 'light' })
    const page = await context.newPage()
    page.on('pageerror', error => { const finding = { variant: variants[index], type: 'pageerror', message: error.message }; errors.push(finding); console.error('BROWSER_ERROR', finding) })
    page.on('console', message => { if (message.type() === 'error') { const finding = { variant: variants[index], type: 'console', message: message.text() }; errors.push(finding); console.error('BROWSER_ERROR', finding) } })
    await page.goto(`${baseUrl}?v=${index + 1}`, { waitUntil: 'networkidle' })
    await page.getByText('Prototype · Sample data', { exact: false }).waitFor()
    const activePicker = page.locator('.proto-picker-item[data-active]')
    if ((await activePicker.textContent())?.trim() === '') throw new Error(`Variant ${index + 1} has no active picker item`)

    await page.getByRole('button', { name: /^Evaluation queue/ }).click()
    await page.getByRole('heading', { name: 'Evaluation queue', exact: true, level: 1 }).waitFor()
    await page.screenshot({ path: path.join(outputDir, `${variants[index]}-desktop-light.png`), fullPage: true })

    await page.getByRole('button', { name: 'Use dark theme' }).click()
    await page.locator('[data-theme="dark"]').waitFor()
    const collapseNames = [
      /Collapse navigation/,
      /Enter focus mode/,
      /Collapse navigation/,
    ]
    await page.getByRole('button', { name: collapseNames[index] }).click()
    await page.screenshot({ path: path.join(outputDir, `${variants[index]}-desktop-dark-collapsed.png`), fullPage: true })

    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    results.push({ variant: variants[index], desktop: 'PASS', focusedTag })
    await context.close()

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', reducedMotion: 'reduce' })
    const mobilePage = await mobile.newPage()
    mobilePage.on('pageerror', error => { const finding = { variant: `${variants[index]}-mobile`, type: 'pageerror', message: error.message }; errors.push(finding); console.error('BROWSER_ERROR', finding) })
    mobilePage.on('console', message => { if (message.type() === 'error') { const finding = { variant: `${variants[index]}-mobile`, type: 'console', message: message.text() }; errors.push(finding); console.error('BROWSER_ERROR', finding) } })
    await mobilePage.goto(`${baseUrl}?v=${index + 1}`, { waitUntil: 'networkidle' })
    const menu = mobilePage.getByRole('button', { name: 'Open navigation' })
    await menu.click()
    if ((await menu.getAttribute('aria-expanded')) !== 'true') throw new Error(`${variants[index]} mobile menu did not open`)
    await mobilePage.getByRole('button', { name: 'Use dark theme' }).click()
    await mobilePage.locator('[data-theme="dark"]').waitFor()
    await mobilePage.screenshot({ path: path.join(outputDir, `${variants[index]}-mobile-dark-menu.png`), fullPage: false })
    await mobilePage.keyboard.press('Escape')
    if ((await menu.getAttribute('aria-expanded')) !== 'false') throw new Error(`${variants[index]} mobile menu did not close with Escape`)
    const pickerDuration = await mobilePage.locator('.proto-picker-highlight').evaluate(element => getComputedStyle(element).transitionDuration)
    results.push({ variant: variants[index], mobile: 'PASS', reducedMotionPickerDuration: pickerDuration })
    await mobile.close()
  }

  const keyboard = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const keyboardPage = await keyboard.newPage()
  await keyboardPage.goto(`${baseUrl}?v=1`, { waitUntil: 'networkidle' })
  await keyboardPage.keyboard.press('ArrowRight')
  if (!keyboardPage.url().includes('v=2')) throw new Error('ArrowRight did not switch picker variant')
  await keyboardPage.keyboard.press('3')
  if (!keyboardPage.url().includes('v=3')) throw new Error('Number key did not switch picker variant')
  await keyboardPage.getByLabel('Preview role').selectOption('Business')
  await keyboardPage.getByRole('button', { name: /^Business account/ }).waitFor()
  results.push({ pickerKeyboard: 'PASS', roleVisibility: 'PASS' })
  await keyboard.close()

  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify({ baseUrl, results, errors }, null, 2))
  if (errors.length) throw new Error(`Browser console contained ${errors.length} error(s)`)
  console.log(JSON.stringify({ baseUrl, outputDir, results, errors }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
