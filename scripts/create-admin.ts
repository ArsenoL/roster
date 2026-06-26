import { createServiceClient } from '../src/lib/supabase-server'
import { db } from '../src/lib/db'

async function main() {
  const supabase = createServiceClient()

  // Create admin user in Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'admin@roster.app',
    password: 'roster-admin-2026',
    email_confirm: true,
    user_metadata: { name: 'Roster Admin', role: 'SUPER_ADMIN' },
  })

  let authId = data?.user?.id
  if (error) {
    if (error.message.includes('already')) {
      const { data: list } = await supabase.auth.admin.listUsers()
      const found = list?.users?.find((u: any) => u.email === 'admin@roster.app')
      authId = found?.id
      console.log('Admin already exists:', authId)
    } else {
      console.error('Error:', error.message)
      process.exit(1)
    }
  } else {
    console.log('Created admin:', authId)
  }

  if (!authId) { console.error('No auth ID'); process.exit(1) }

  // Update the existing superadmin User row
  const updated = await db.user.update({
    where: { email: 'superadmin@roster.local' },
    data: {
      supabaseAuthId: authId,
      email: 'admin@roster.app',
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Updated User:', updated.email, '| supabaseAuthId:', updated.supabaseAuthId)

  await db.$disconnect()
}
main()
