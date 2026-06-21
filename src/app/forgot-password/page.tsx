'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MailQuestion } from 'lucide-react'

/**
 * Password-reset landing page. The reset-by-email flow isn't built yet —
 * this is a stub so the "Forgot?" link on /login doesn't 404.
 *
 * For now, directs the user to contact their club admin or use /signup
 * with a new email if they truly cannot recover access.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="h-1 w-16 bg-[var(--vibrant)] mb-6" />
          <div className="mb-6">
            <div className="label-mono mb-2">Forgot password</div>
            <h1 className="text-2xl font-semibold tracking-tight">Password reset</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Automated password reset emails aren&apos;t available yet. If you can&apos;t sign
              in, ask your club leader or advisor to reset your password from their admin
              panel, or contact your school&apos;s Roster administrator.
            </p>
          </div>

          <div
            className="panel-teal p-4 mb-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <MailQuestion className="h-4 w-4" style={{ color: 'var(--vibrant-2)' }} />
              <span className="label-mono" style={{ color: 'var(--vibrant-2)' }}>
                Coming soon
              </span>
            </div>
            <p className="text-sm text-foreground">
              Self-serve password reset is on the roadmap. For now, an admin can reset your
              password from <code className="px-1 py-0.5 text-xs" style={{ background: 'var(--muted)' }}>/app/admin/users</code>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" className="h-11">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost" className="h-11">
                Create a new account
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
