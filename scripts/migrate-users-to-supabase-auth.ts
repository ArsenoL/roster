/**
 * migrate-users-to-supabase-auth.ts
 *
 * Creates auth.users entries in Supabase Auth for existing User rows that
 * have a passwordHash but no supabaseAuthId. Links the auth.users.id back
 * to the User.supabaseAuthId column.
 *
 * Existing passwords CANNOT be migrated (we only have scrypt hashes, not
 * plaintext). Users will need to use "Forgot password" to set a new password
 * via Supabase Auth. The script sets email_confirm: true so they don't need
 * to re-verify their email.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts
 *
 * Safe to re-run — skips users that already have a supabaseAuthId.
 */

import { db } from '../src/lib/db'
import { createServiceClient } from '../src/lib/supabase-server'

async function main() {
  const supabase = createServiceClient()

  // Find all users without a supabaseAuthId
  const users = await db.user.findMany({
    where: { supabaseAuthId: null },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  })

  console.log(`Found ${users.length} users to migrate.`)

  let migrated = 0
  let failed = 0

  for (const user of users) {
    try {
      // Create the user in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role },
      })

      if (error || !data.user) {
        // If the user already exists in auth.users (e.g., from a prior run),
        // try to find them by email
        if (error?.message?.includes('already')) {
          const { data: existing } = await supabase.auth.admin.listUsers()
          const found = existing?.users?.find((u: any) => u.email === user.email)
          if (found) {
            await db.user.update({
              where: { id: user.id },
              data: { supabaseAuthId: found.id },
            })
            console.log(`  ✓ Linked existing: ${user.email} → ${found.id}`)
            migrated++
            continue
          }
        }
        console.error(`  ✗ Failed: ${user.email} — ${error?.message}`)
        failed++
        continue
      }

      // Link the supabaseAuthId to the User row
      await db.user.update({
        where: { id: user.id },
        data: { supabaseAuthId: data.user.id },
      })

      console.log(`  ✓ Migrated: ${user.email} → ${data.user.id}`)
      migrated++
    } catch (e: any) {
      console.error(`  ✗ Error: ${user.email} — ${e.message}`)
      failed++
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`)
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error('Migration failed:', e)
  await db.$disconnect()
  process.exit(1)
})
