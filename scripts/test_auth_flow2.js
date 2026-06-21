// Test the auth flow with a fresh login - sign up a new user, then try
// to create a club, simulating exactly what the user does in the browser.

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
        const sessionCookie = setCookies
          .find((c) => c.startsWith('roster_session='))
        resolve({
          status: res.statusCode,
          body: data,
          setCookies,
          sessionCookie,
        })
      })
    })
    r.on('error', reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

async function main() {
  const email = `audit-flow-${Date.now()}@example.edu`
  const password = 'test1234'

  console.log('=== Step 1: Sign up', email, '===')
  const signup = await req('/api/auth/signup', 'POST', {
    name: 'Audit Flow Test',
    email,
    password,
  })
  console.log('  status:', signup.status)
  if (signup.status !== 201) {
    console.log('  body:', signup.body)
    return
  }
  console.log('  sessionCookie set:', !!signup.sessionCookie)
  if (!signup.sessionCookie) {
    console.log('  set-cookie headers:', signup.setCookies)
    return
  }
  const cookie = signup.sessionCookie.split(';')[0]
  console.log('  cookie name=value:', cookie.slice(0, 60) + '...')

  console.log('\n=== Step 2: GET /api/auth/me with this cookie ===')
  const me1 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me1.status)
  console.log('  body:', me1.body.slice(0, 250))

  console.log('\n=== Step 3: POST /api/clubs (create club) ===')
  const club = await req('/api/clubs', 'POST', {
    name: 'Auth Flow Test Club',
    category: 'ACADEMIC',
    modules: ['members', 'events', 'attendance'],
  }, cookie)
  console.log('  status:', club.status)
  console.log('  body:', club.body.slice(0, 250))

  console.log('\n=== Step 4: GET /api/auth/me again (should show new membership) ===')
  const me2 = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me2.status)
  console.log('  body:', me2.body.slice(0, 400))

  console.log('\n=== Step 5: Re-issue same request with STALE cookie path ===')
  // What if cookie path doesn't match? Test by deleting path attribute
  // Simulate a cookie with path=/app instead of path=/
  const staleCookie = cookie + '; Path=/app'
  const me3 = await req('/api/auth/me', 'GET', null, staleCookie)
  console.log('  status:', me3.status)
  console.log('  body:', me3.body.slice(0, 250))

  console.log('\n=== Step 6: What if cookie is missing entirely? ===')
  const me4 = await req('/api/auth/me', 'GET', null, '')
  console.log('  status:', me4.status)
  console.log('  body:', me4.body.slice(0, 250))

  console.log('\n=== Step 7: What if cookie has invalid signature? ===')
  const badCookie = 'roster_session=' + cookie.split('=')[1].slice(0, -5) + 'XXXXX'
  const me5 = await req('/api/auth/me', 'GET', null, badCookie)
  console.log('  status:', me5.status)
  console.log('  body:', me5.body.slice(0, 250))

  // Clean up
  await prisma.user.deleteMany({ where: { email } }).catch(() => {})
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
