const http = require('http')
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
  const email = `analytics-test-${Date.now()}@example.edu`
  const signup = await req('/api/auth/signup', 'POST', { name: 'Analytics Test', email, password: 'test1234' })
  console.log('signup status:', signup.status)
  console.log('signup setCookies:', signup.setCookies?.length || 0)
  const cookie = signup.sessionCookie ? signup.sessionCookie.split(';')[0] : ''
  console.log('cookie:', cookie ? cookie.slice(0, 30) + '...' : 'NOT SET')
  
  // Create a club first
  const club = await req('/api/clubs', 'POST', { name: 'Analytics Test Club', category: 'ACADEMIC', modules: ['members','events','attendance'] }, cookie)
  console.log('club:', club.status)
  const clubData = JSON.parse(club.body)
  const clubId = clubData.club?.id
  console.log('clubId:', clubId)
  
  // Test analytics with clubId
  const a1 = await req(`/api/analytics?view=overview&clubId=${clubId}`, 'GET', null, cookie)
  console.log('analytics overview with clubId:', a1.status)
  console.log('  body:', a1.body.slice(0, 300))
  
  // Test analytics without clubId
  const a2 = await req('/api/analytics?view=overview', 'GET', null, cookie)
  console.log('analytics overview without clubId:', a2.status)
  console.log('  body:', a2.body.slice(0, 300))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
