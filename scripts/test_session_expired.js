// Test that an actually-expired session still redirects to /login.
// 1. Sign up
// 2. Manually delete the session from the DB (simulate expiry)
// 3. Try to POST /api/clubs → should 401
// 4. recoverFrom401 should retry /api/auth/me → null user → retry → null user → redirect to /login

const { PrismaClient } = require('@prisma/client')
const http = require('http')
const prisma = new PrismaClient()

function req(path, method = 'GET', body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3000, path, method, headers: { Cookie: cookie, 'Content-Type': 'application/json' } }
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
  const email = `expired-test-${Date.now()}@example.edu`
  console.log('=== Signup', email, '===')
  const signup = await req('/api/auth/signup', 'POST', { name: 'Expired Test', email, password: 'test1234' })
  if (signup.status !== 201) { console.log('FAIL: signup', signup.status); return }
  const cookie = signup.sessionCookie.split(';')[0]
  const token = cookie.split('=')[1]
  console.log('  PASS: signup returned 201')
  
  // Verify session works
  const me1 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  /api/auth/me:', me1.status, me1.body.slice(0, 80))
  
  // Delete the session from the DB (simulate expiry/logout in another tab)
  console.log('\n=== Deleting session from DB ===')
  const deleted = await prisma.userSession.deleteMany({ where: { token } })
  console.log('  deleted:', deleted.count, 'sessions')
  
  // Now try /api/auth/me — should return null user
  const me2 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('\n=== /api/auth/me after session deleted ===')
  console.log('  status:', me2.status)
  const me2data = JSON.parse(me2.body)
  console.log('  user:', me2data.user)
  if (me2data.user === null) {
    console.log('  PASS: server correctly returns null user for deleted session')
  } else {
    console.log('  FAIL: server should return null user')
  }
  
  // Try POST /api/clubs — should 401
  const club = await req('/api/clubs', 'POST', { name: 'Should Fail', category: 'ACADEMIC' }, cookie)
  console.log('\n=== POST /api/clubs with deleted session ===')
  console.log('  status:', club.status)
  if (club.status === 401) {
    console.log('  PASS: 401 returned for deleted session')
  } else {
    console.log('  FAIL: expected 401')
  }
  
  // Cleanup
  await prisma.user.deleteMany({ where: { email } }).catch(() => {})
  console.log('\n=== Cleanup done ===')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
