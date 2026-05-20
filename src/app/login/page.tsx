import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-xs font-medium uppercase tracking-widest text-brand">
        ← Agency OS
      </Link>
      <h1 className="mt-4 font-serif text-3xl text-ink-900">Entrar al panel</h1>
      <p className="mt-2 text-sm text-ink-600">
        Pantalla de autenticación. Conectar con Supabase Auth en el siguiente paso.
      </p>

      <form className="mt-8 space-y-4" action="#" method="post">
        <div>
          <label className="block text-sm font-medium text-ink-700">Email</label>
          <input
            type="email"
            name="email"
            required
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700">Contraseña</label>
          <input
            type="password"
            name="password"
            required
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <button
          type="submit"
          disabled
          className="w-full rounded-md bg-ink-900 px-4 py-2.5 text-sm font-medium text-white opacity-50"
        >
          Entrar (pendiente)
        </button>
      </form>
    </main>
  )
}
