// Test what happens immediately after creating a club:
// - GET /api/auth/me (should return user with membership)
// - GET /api/me (should return 200 with dashboard data)
// - GET /api/clubs (should return 200 with clubs list)
// - GET /api/notifications (should return 200)
//
// This simulates the requests that fire when the user lands on /app or /app/me
// after creating a club. If any of these 401, the global recoverFrom401 would
// kick in and potentially redirect to /login.

const http = require('http')

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
  const email = `after-club-${Date.now()}@example.edu`
  const password = 'test1234'

  console.log('=== Signup', email, '===')
  const signup = await req('/api/auth/signup', 'POST', {
    name: 'After Club Test',
    email,
    password,
  })
  if (signup.status !== 201) {
    console.log('  FAIL: signup returned', signup.status, signup.body)
    return
  }
  const cookie = signup.sessionCookie.split(';')[0]
  console.log('  PASS: signup returned 201')

  console.log('\n=== Create club ===')
  const club = await req('/api/clubs', 'POST', {
    name: 'After Club Test Club',
    category: 'ACADEMIC',
    modules: ['members', 'events', 'attendance'],
  }, cookie)
  console.log('  status:', club.status)
  if (club.status !== 200) {
    console.log('  FAIL:', club.body.slice(0, 200))
    return
  }
  console.log('  PASS: club created')

  console.log('\n=== Immediately after club creation, test all endpoints ===')

  // 1. /api/auth/me (this is what refresh() calls)
  const me = await req('/api/auth/me', 'GET', null, cookie)
  console.log('  GET /api/auth/me:', me.status)
  if (me.status === 200) {
    const meData = JSON.parse(me.body)
    console.log('    user:', meData.user?.name, '| memberships:', meData.user?.memberships?.length || 0)
    if (!meData.user) {
      console.log('    FAIL: /api/auth/me returned null user right after club creation!')
    }
  }

  // 2. /api/me (this is what /app/me page fetches)
  const meApi = await req('/api/me', 'GET', null, cookie)
  console.log('  GET /api/me:', meApi.status)
  if (meApi.status === 401) {
    console.log('    FAIL: /api/me returned 401 right after club creation!')
    console.log('    body:', meApi.body.slice(0, 200))
  }

  // 3. /api/clubs (this is what /app page fetches)
  const clubs = await req('/api/clubs', 'GET', null, cookie)
  console.log('  GET /api/clubs:', clubs.status)
  if (clubs.status === 401) {
    console.log('    FAIL: /api/clubs returned 401 right after club creation!')
  }

  // 4. /api/notifications (fetched on /app mount)
  const notifs = await req('/api/notifications', 'GET', null, cookie)
  console.log('  GET /api/notifications:', notifs.status)
  if (notifs.status === 401) {
    console.log('    FAIL: /api/notifications returned 401 right after club creation!')
  }

  // 5. /api/analytics (fetched on /app dashboard)
  const analytics = await req('/api/analytics?view=overview', 'GET', null, cookie)
  console.log('  GET /api/analytics?view=overview:', analytics.status)
  if (analytics.status === 401) {
    console.log('    FAIL: /api/analytics returned 401 right after club creation!')
  }

  // 6. /api/events (fetched on /app dashboard)
  const events = await req('/api/events?upcoming=true&limit=5', 'GET', null, cookie)
  console.log('  GET /api/events?upcoming=true:', events.status)
  if (events.status === 401) {
    console.log('    FAIL: /api/events returned 401 right after club creation!')
  }

  console.log('\n=== Cleanup ===')
  // Clean up by logging out (deletes the session)
  await req('/api/auth/logout', 'POST', null, cookie)
  console.log('  Done')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
