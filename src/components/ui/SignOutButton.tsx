'use client'

import { signOut } from '@/app/login/actions'

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
      >
        Cerrar sesión
      </button>
    </form>
  )
}
