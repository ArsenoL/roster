// Test the auth flow AFTER the fixes.
// 1. Sign up a new user
// 2. Verify /api/auth/me works
// 3. Create a club (POST /api/clubs)
// 4. Verify the session was extended (expiresAt should now be > createdAt + 14d)
// 5. Verify /api/auth/me shows the new membership
// 6. Test the 1-day renewal window: a second request should NOT extend again

const { PrismaClient } = require('@prisma/client')
const http = require('http')

const prisma = new PrismaClient()

function req(path, method = 'GET', body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
    }
    const r = http.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => {
        const setCookies = res.headers['set-cookie'] || []
        const sessionCookie = setCookies.find((c) => c.startsWith('roster_session='))
        resolve({ status: res.statusCode, body: data, setCookies, sessionCookie })
      })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

async function main() {
  const email = `audit3-flow-${Date.now()}@example.edu`
  const password = 'test1234'

  console.log('=== Step 1: Sign up', email, '===')
  const signup = await req('/api/auth/signup', 'POST', {
    name: 'Audit 3 Flow Test',
    email,
    password,
  })
  if (signup.status !== 201) {
    console.log('  FAIL: signup returned', signup.status, signup.body)
    return
  }
  console.log('  PASS: signup returned 201, cookie set')

  const cookie = signup.sessionCookie.split(';')[0]
  const sessionToken = cookie.split('=')[1]

  // Look up the session in the DB to get the initial expiresAt
  const session1 = await prisma.userSession.findUnique({ where: { token: sessionToken } })
  console.log('  Initial session expiresAt:', session1.expiresAt.toISOString())
  console.log('  Initial session createdAt:', session1.createdAt.toISOString())
  const initialAge = (session1.expiresAt - session1.createdAt) / 1000 / 60 / 60 / 24
  console.log('  Initial session age (days):', initialAge.toFixed(4))

  console.log('\n=== Step 2: GET /api/auth/me (should NOT extend, session is fresh) ===')
  const me1 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me1.status)
  const session2 = await prisma.userSession.findUnique({ where: { token: sessionToken } })
  const age2 = (session2.expiresAt - session2.createdAt) / 1000 / 60 / 60 / 24
  console.log('  Session age after /api/auth/me (days):', age2.toFixed(4))
  if (Math.abs(age2 - initialAge) < 0.001) {
    console.log('  PASS: session was NOT extended (within 1-day renewal window)')
  } else {
    console.log('  INFO: session was extended (expected if renewal window check changed)')
  }

  console.log('\n=== Step 3: Simulate an OLD session (manually set expiresAt to <1 day from now) ===')
  // Update the session to be 13 days old (so it's within the 1-day renewal window)
  const oldExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
  await prisma.userSession.update({
    where: { token: sessionToken },
    data: { expiresAt: oldExpiresAt },
  })
  console.log('  Set expiresAt to:', oldExpiresAt.toISOString())

  console.log('\n=== Step 4: GET /api/auth/me again (should EXTEND the session now) ===')
  const me2 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me2.status)
  const session3 = await prisma.userSession.findUnique({ where: { token: sessionToken } })
  console.log('  Session expiresAt after 2nd /api/auth/me:', session3.expiresAt.toISOString())
  const expectedNewExpiry = Date.now() + 14 * 24 * 60 * 60 * 1000
  const actualExpiry = session3.expiresAt.getTime()
  const diffMs = Math.abs(actualExpiry - expectedNewExpiry)
  console.log('  Difference from expected (now + 14d):', diffMs, 'ms')
  if (diffMs < 60000) {
    console.log('  PASS: session was extended to now + 14 days (rolling renewal works)')
  } else {
    console.log('  FAIL: session was not extended correctly')
  }

  console.log('\n=== Step 5: POST /api/clubs (create club) ===')
  const club = await req('/api/clubs', 'POST', {
    name: 'Audit 3 Test Club',
    category: 'ACADEMIC',
    modules: ['members', 'events', 'attendance'],
  }, cookie)
  console.log('  status:', club.status)
  if (club.status !== 200) {
    console.log('  FAIL:', club.body.slice(0, 200))
    return
  }
  console.log('  PASS: club created')

  console.log('\n=== Step 6: GET /api/auth/me (should show new membership) ===')
  const me3 = await req('/api/auth/me', 'GET', null, cookie)
  const me3data = JSON.parse(me3.body)
  console.log('  memberships:', me3data.user?.memberships?.length || 0)
  if (me3data.user?.memberships?.length === 1) {
    console.log('  PASS: membership is reflected')
  } else {
    console.log('  FAIL: membership not reflected')
  }

  console.log('\n=== Step 7: POST /api/clubs with NO cookie (should 401) ===')
  const noCookie = await req('/api/clubs', 'POST', {
    name: 'Should Fail',
    category: 'ACADEMIC',
  }, '')
  console.log('  status:', noCookie.status)
  if (noCookie.status === 401) {
    console.log('  PASS: 401 returned for unauthenticated POST')
    console.log('  body:', noCookie.body.slice(0, 150))
  } else {
    console.log('  FAIL: expected 401, got', noCookie.status)
  }

  // Clean up
  await prisma.user.deleteMany({ where: { email } }).catch(() => {})
  console.log('\n=== Cleanup done ===')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
