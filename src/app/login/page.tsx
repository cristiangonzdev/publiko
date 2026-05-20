import Link from 'next/link'

import { signIn } from './actions'

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brand">
        ← Agency OS
      </Link>
      <h1 className="mt-4 font-serif text-3xl text-ink-900">Entrar al panel</h1>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      <form action={signIn} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? '/dashboard'} />

        <div>
          <label className="block text-sm font-medium text-ink-700">Email</label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700">Contraseña</label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-ink-800 active:bg-ink-700"
        >
          Entrar
        </button>
      </form>
    </main>
  )
}
