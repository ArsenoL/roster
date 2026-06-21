// Reproduce the session-expiring bug end-to-end.
// Picks a real session from the DB, then exercises /api/auth/me and /api/clubs
// POST with that cookie to see what the server actually returns.

const { PrismaClient } = require('@prisma/client')
const http = require('http')

const prisma = new PrismaClient()

function cookieReq(path, method = 'GET', body = null, cookie = '') {
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
    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', (c) => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, body: data, setCookie: res.headers['set-cookie'] }))
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  // 1. Find a real, non-expired session for amogh.r.bandekar@gmail.com
  const session = await prisma.userSession.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      user: { email: 'amogh.r.bandekar@gmail.com' },
    },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  if (!session) {
    console.log('No active session for the user. Available sessions:')
    const all = await prisma.userSession.findMany({
      where: { expiresAt: { gt: new Date() } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    for (const s of all) console.log('  -', s.user.email, s.token.slice(0, 30) + '...')
    return
  }

  console.log('=== Test session ===')
  console.log('  user:', session.user.email)
  console.log('  token length:', session.token.length)
  console.log('  token starts:', session.token.slice(0, 60))
  console.log('  expires:', session.expiresAt)
  console.log('  is expired:', session.expiresAt < new Date())

  const cookie = `roster_session=${session.token}`
  console.log('\n=== Step 1: GET /api/auth/me with this cookie ===')
  const me1 = await cookieReq('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me1.status)
  console.log('  body:', me1.body.slice(0, 300))

  console.log('\n=== Step 2: POST /api/clubs with this cookie ===')
  const club = await cookieReq('/api/clubs', 'POST', {
    name: 'TEST CLUB FROM AUDIT ' + Date.now(),
    category: 'ACADEMIC',
    modules: ['members', 'events', 'attendance'],
  }, cookie)
  console.log('  status:', club.status)
  console.log('  body:', club.body.slice(0, 300))

  console.log('\n=== Step 3: GET /api/auth/me AGAIN (after POST) ===')
  const me2 = await cookieReq('/api/auth/me', 'GET', null, cookie)
  console.log('  status:', me2.status)
  console.log('  body:', me2.body.slice(0, 300))

  // Check the session in the DB after these requests
  const sessionAfter = await prisma.userSession.findUnique({
    where: { token: session.token },
  })
  console.log('\n=== Session state after requests ===')
  console.log('  still exists:', !!sessionAfter)
  if (sessionAfter) {
    console.log('  expires:', sessionAfter.expiresAt)
    console.log('  is expired:', sessionAfter.expiresAt < new Date())
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
