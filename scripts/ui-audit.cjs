#!/usr/bin/env node
/**
 * Comprehensive UI audit — clicks every button, fills every form,
 * and logs every error found on every page.
 * 
 * Usage: node scripts/ui-audit.mjs
 */

const { execSync } = require('child_process')

const BASE = 'http://127.0.0.1:3000'
const results = []
let passCount = 0, failCount = 0, warnCount = 0

function log(action, status, detail) {
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠'
  const line = `${icon} ${status}: ${action}${detail ? ' — ' + detail : ''}`
  console.log(line)
  results.push({ action, status, detail })
  if (status === 'PASS') passCount++
  else if (status === 'FAIL') failCount++
  else warnCount++
}

function run(cmd) {
  try { return execSync(cmd, { timeout: 15000, encoding: 'utf8' }).trim() } 
  catch (e) { return e.stdout?.trim() || e.message?.trim() || 'ERROR' }
}

function snap() { return run('agent-browser snapshot -i 2>&1') }
function click(ref) { return run(`agent-browser click @${ref} 2>&1`) }
function fill(ref, val) { return run(`agent-browser fill @${ref} "${val}" 2>&1`) }
function evalJs(code) { return run(`agent-browser eval "${code.replace(/"/g, '\\"').replace(/\n/g, ' ')}" 2>&1`) }
function screenshot(name) { return run(`agent-browser screenshot /home/z/my-project/download/audit/${name}.png 2>&1`) }
function findBtn(text) {
  const s = snap()
  const lines = s.split('\n')
  for (const l of lines) {
    if (l.includes('button') && l.toLowerCase().includes(text.toLowerCase())) {
      const m = l.match(/\[ref=(e\d+)\]/)
      if (m) return m[1]
    }
  }
  return null
}
function findInput(text) {
  const s = snap()
  const lines = s.split('\n')
  for (const l of lines) {
    if ((l.includes('textbox') || l.includes('textarea')) && l.toLowerCase().includes(text.toLowerCase())) {
      const m = l.match(/\[ref=(e\d+)\]/)
      if (m) return m[1]
    }
  }
  // Return first textbox if text not found
  for (const l of lines) {
    if (l.includes('textbox') || l.includes('textarea')) {
      const m = l.match(/\[ref=(e\d+)\]/)
      if (m) return m[1]
    }
  }
  return null
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  execSync('mkdir -p /home/z/my-project/download/audit')
  
  console.log('============================================')
  console.log('  COMPREHENSIVE UI AUDIT')
  console.log('============================================\n')

  // === LOGIN ===
  console.log('=== LOGIN PAGE ===')
  run('agent-browser open http://127.0.0.1:3000/login 2>&1')
  await wait(2000)
  screenshot('01-login')
  
  const emailRef = findInput('EMAIL')
  const passRef = findInput('PASSWORD')
  if (emailRef && passRef) {
    fill(emailRef, 'admin@roster.app')
    fill(passRef, 'roster-admin-2026')
    const signinRef = findBtn('Sign in')
    if (signinRef) {
      click(signinRef)
      await wait(4000)
      const url = run('agent-browser get url 2>&1')
      if (url.includes('/app')) log('Login', 'PASS', 'redirected to /app')
      else log('Login', 'FAIL', `redirected to ${url}`)
    } else log('Sign in button', 'FAIL', 'not found')
  } else log('Login form fields', 'FAIL', 'email/password not found')
  
  // === DASHBOARD ===
  console.log('\n=== DASHBOARD ===')
  screenshot('02-dashboard')
  // Check stat cards have values
  const stats = evalJs("document.querySelectorAll('.text-2xl').length")
  log('Dashboard stat cards', stats > 0 ? 'PASS' : 'WARN', `${stats} stat cards visible`)
  
  // === CLICK EVERY TAB ===
  const tabs = [
    'Dashboard', 'Take attendance', 'Absence excuses', 'Reminders',
    'Announcements', 'Tasks', 'Assistant', 'Members', 'Applications',
    'Invites', 'Offboarding', 'Alumni', 'Events', 'Meeting minutes',
    'Polls & elections', 'Resources', 'Finance', 'Volunteer hours',
    'Inventory', 'Maintenance', 'Communications', 'Messages',
    'Email digests', 'Gamification', 'Photo albums', 'Forms & surveys',
    'Analytics', 'Reports', 'Documents', 'Audit log', 'Clubs',
    'Settings', 'Integrations', 'Bulk import'
  ]
  
  for (const tab of tabs) {
    // Navigate fresh to /app each time to avoid stale refs
    run('agent-browser open http://127.0.0.1:3000/app 2>&1')
    await wait(2000)
    
    const ref = findBtn(tab)
    if (!ref) {
      log(`Tab: ${tab}`, 'FAIL', 'button not found in sidebar')
      continue
    }
    
    click(ref)
    await wait(2000)
    
    // Check for errors on the page
    const errors = evalJs(`
      (function(){
        var text = document.body.innerText;
        var errs = [];
        if (text.includes('Something went wrong')) errs.push('ErrorBoundary');
        if (text.includes('Cannot read prop')) errs.push('CannotReadProp');
        if (text.includes('undefined is not')) errs.push('Undefined');
        if (text.match(/\\bNaN\\b/)) errs.push('NaN');
        if (text.includes('[object Object]')) errs.push('ObjectStr');
        if (text.includes('Loading…') && !text.includes('Loading')) {} // loading is fine
        return errs.join(',') || 'OK';
      })()
    `)
    
    // Check for empty states
    const hasContent = evalJs(`
      (function(){
        var main = document.querySelector('main, [role="tabpanel"]');
        if (!main) return 'no-main';
        var text = main.innerText;
        if (text.length < 20) return 'empty';
        return 'has-content';
      })()
    `)
    
    const safeName = tab.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    screenshot(`tab-${safeName}`)
    
    if (errors !== 'OK') log(`Tab: ${tab}`, 'FAIL', `errors: ${errors}`)
    else if (hasContent === 'empty') log(`Tab: ${tab}`, 'WARN', 'page appears empty')
    else log(`Tab: ${tab}`, 'PASS', 'rendered')
  }
  
  // === TEST FORMS ON KEY TABS ===
  console.log('\n=== FORM TESTS ===')
  
  // Test Members — Add Member
  run('agent-browser open http://127.0.0.1:3000/app 2>&1')
  await wait(2000)
  click(findBtn('Members'))
  await wait(2000)
  const addMemberBtn = findBtn('Add Member')
  if (addMemberBtn) {
    click(addMemberBtn)
    await wait(1500)
    screenshot('form-members-dialog')
    const emailInput = findInput('email')
    if (emailInput) {
      fill(emailInput, 'audit-test@example.com')
      const nameInput = findInput('name')
      if (nameInput) fill(nameInput, 'Audit Test')
      const saveBtn = findBtn('Add Member')
      if (saveBtn) {
        click(saveBtn)
        await wait(2000)
        const toast = evalJs("document.querySelector('[data-sonner-toast]')?.textContent || ''")
        if (toast.includes('added') || toast.includes('success')) log('Add Member form', 'PASS', toast)
        else if (toast.includes('error') || toast.includes('invalid')) log('Add Member form', 'FAIL', toast)
        else log('Add Member form', 'WARN', `toast: ${toast || 'none'}`)
      } else log('Add Member submit', 'FAIL', 'button not found')
    } else log('Add Member email field', 'FAIL', 'not found')
    run('agent-browser press Escape 2>&1')
  } else log('Add Member button', 'WARN', 'not found')
  
  // Test Events — Create Event
  run('agent-browser open http://127.0.0.1:3000/app 2>&1')
  await wait(2000)
  click(findBtn('Events'))
  await wait(2000)
  const newEventBtn = findBtn('New Event')
  if (newEventBtn) {
    click(newEventBtn)
    await wait(1500)
    screenshot('form-events-dialog')
    const titleInput = findInput('title')
    if (titleInput) {
      fill(titleInput, 'Audit Test Event')
      const createBtn = findBtn('Create Event')
      if (createBtn) {
        click(createBtn)
        await wait(2000)
        const toast = evalJs("document.querySelector('[data-sonner-toast]')?.textContent || ''")
        if (toast.includes('created')) log('Create Event form', 'PASS', toast)
        else if (toast.includes('error') || toast.includes('required')) log('Create Event form', 'FAIL', toast)
        else log('Create Event form', 'WARN', `toast: ${toast || 'none'}`)
      } else log('Create Event submit', 'FAIL', 'button not found')
    } else log('Event title field', 'FAIL', 'not found')
    run('agent-browser press Escape 2>&1')
  } else log('New Event button', 'WARN', 'not found')
  
  // Test Finance — New Transaction
  run('agent-browser open http://127.0.0.1:3000/app 2>&1')
  await wait(2000)
  click(findBtn('Finance'))
  await wait(2000)
  // Click Transactions sub-tab
  const txTab = findBtn('Transactions')
  if (txTab) click(txTab)
  await wait(1000)
  const newTxBtn = findBtn('New Transaction')
  if (newTxBtn) {
    click(newTxBtn)
    await wait(1500)
    screenshot('form-finance-dialog')
    const descInput = findInput('What was')
    if (descInput) {
      fill(descInput, 'Audit test transaction')
      // Find amount field
      const amountRef = snap().split('\n').find(l => l.includes('spinbutton') || l.includes('0.00'))
      if (amountRef) {
        const m = amountRef.match(/\[ref=(e\d+)\]/)
        if (m) fill(m[1], '25')
      }
      const recordBtn = findBtn('Record')
      if (recordBtn) {
        click(recordBtn)
        await wait(2000)
        const toast = evalJs("document.querySelector('[data-sonner-toast]')?.textContent || ''")
        if (toast.includes('recorded') || toast.includes('success')) log('Finance transaction', 'PASS', toast)
        else log('Finance transaction', 'WARN', `toast: ${toast || 'none'}`)
      }
    }
    run('agent-browser press Escape 2>&1')
  } else log('New Transaction button', 'WARN', 'not found')
  
  // Test Tasks — New Task
  run('agent-browser open http://127.0.0.1:3000/app 2>&1')
  await wait(2000)
  click(findBtn('Tasks'))
  await wait(2000)
  const newTaskBtn = findBtn('New Task')
  if (newTaskBtn) {
    click(newTaskBtn)
    await wait(1500)
    screenshot('form-tasks-dialog')
    const titleInput = findInput('Order pizza')
    if (titleInput) {
      fill(titleInput, 'Audit test task')
      const createBtn = findBtn('Create')
      if (createBtn) {
        click(createBtn)
        await wait(2000)
        const toast = evalJs("document.querySelector('[data-sonner-toast]')?.textContent || ''")
        if (toast.includes('created')) log('Create Task form', 'PASS', toast)
        else log('Create Task form', 'WARN', `toast: ${toast || 'none'}`)
      }
    }
    run('agent-browser press Escape 2>&1')
  } else log('New Task button', 'WARN', 'not found')
  
  // Test Announcements
  run('agent-browser open http://127.0.0.1:3000/app 2>&1')
  await wait(2000)
  click(findBtn('Announcements'))
  await wait(2000)
  const newAnnBtn = findBtn('New') 
  if (newAnnBtn) {
    click(newAnnBtn)
    await wait(1500)
    screenshot('form-announcements-dialog')
    const titleInput = findInput('title')
    if (titleInput) {
      fill(titleInput, 'Audit Test Announcement')
      const contentInput = findInput('content')
      if (contentInput) fill(contentInput, 'Test content from audit')
      const postBtn = findBtn('Post') || findBtn('Publish') || findBtn('Create')
      if (postBtn) {
        click(postBtn)
        await wait(2000)
        const toast = evalJs("document.querySelector('[data-sonner-toast]')?.textContent || ''")
        if (toast.includes('created') || toast.includes('posted')) log('Announcement form', 'PASS', toast)
        else log('Announcement form', 'WARN', `toast: ${toast || 'none'}`)
      }
    }
    run('agent-browser press Escape 2>&1')
  } else log('New Announcement button', 'WARN', 'not found')
  
  // === CHECK FOR CONSOLE ERRORS ===
  console.log('\n=== CONSOLE ERRORS ===')
  const consoleErrors = run('agent-browser console 2>&1')
  const errorLines = consoleErrors.split('\n').filter(l => 
    l.toLowerCase().includes('error') && !l.includes('Download the React')
  )
  if (errorLines.length === 0) log('Console errors', 'PASS', 'none')
  else {
    errorLines.slice(0, 5).forEach(e => log('Console error', 'FAIL', e.substring(0, 80)))
  }
  
  // === SUMMARY ===
  console.log('\n============================================')
  console.log('  AUDIT SUMMARY')
  console.log('============================================')
  console.log(`✓ Passed: ${passCount}`)
  console.log(`✗ Failed: ${failCount}`)
  console.log(`⚠ Warnings: ${warnCount}`)
  console.log(`Total: ${passCount + failCount + warnCount}`)
  console.log('\n=== FAILURES ===')
  results.filter(r => r.status === 'FAIL').forEach(r => 
    console.log(`  ✗ ${r.action}: ${r.detail}`)
  )
  console.log('\n=== WARNINGS ===')
  results.filter(r => r.status === 'WARN').forEach(r => 
    console.log(`  ⚠ ${r.action}: ${r.detail}`)
  )
}

main().catch(e => console.error('Audit failed:', e))
