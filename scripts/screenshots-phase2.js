// Screenshot script — captures Phase 2 pages via Playwright
const { chromium } = require('playwright')

async function shot(page, url, name, fullPage = true) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `/home/z/my-project/download/phase2-${name}.png`, fullPage })
  console.log(`  ✓ phase2-${name}.png`)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // Get first club ID
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/home/z/my-project/download/phase2-main.png', fullPage: false })
  console.log('  ✓ phase2-main.png (main dashboard)')

  // Click through new tabs via sidebar — they're buttons with text labels
  const tabs = [
    { name: 'finance', label: 'Finance' },
    { name: 'volunteer', label: 'Volunteer Hours' },
    { name: 'polls', label: 'Polls & Elections' },
    { name: 'forms', label: 'Forms & Surveys' },
    { name: 'tasks', label: 'Tasks' },
    { name: 'resources', label: 'Resources' },
    { name: 'inventory', label: 'Inventory' },
    { name: 'documents', label: 'Documents' },
    { name: 'insights', label: 'AI Insights' },
    { name: 'alumni', label: 'Alumni' },
    { name: 'applications', label: 'Recruitment' },
    { name: 'reports', label: 'Reports' },
  ]

  for (const tab of tabs) {
    try {
      // Find and click the nav button by its label text
      const btn = page.locator(`button:has-text("${tab.label}")`).first()
      if (await btn.count() > 0) {
        await btn.click()
        await page.waitForTimeout(2500)
        await page.screenshot({ path: `/home/z/my-project/download/phase2-${tab.name}.png`, fullPage: false })
        console.log(`  ✓ phase2-${tab.name}.png`)
      }
    } catch (e) {
      console.log(`  ✗ ${tab.name}: ${e.message.slice(0, 100)}`)
    }
  }

  // Public portal screenshot
  try {
    const resp = await page.goto('http://localhost:3000/api/clubs')
    const data = await resp.json()
    const slug = data.clubs[0].slug
    await page.goto(`http://localhost:3000/portal/${slug}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/home/z/my-project/download/phase2-portal.png', fullPage: true })
    console.log('  ✓ phase2-portal.png (public recruitment portal)')
  } catch (e) {
    console.log('  ✗ portal:', e.message.slice(0, 100))
  }

  await browser.close()
  console.log('\nAll screenshots saved to /home/z/my-project/download/')
}

main().catch(e => { console.error(e); process.exit(1) })
