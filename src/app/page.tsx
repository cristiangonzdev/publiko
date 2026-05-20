import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-brand">Agency OS</p>
      <h1 className="mt-4 font-serif text-5xl text-ink-900">
        El sistema operativo de tu agencia de redes sociales.
      </h1>
      <p className="mt-6 text-lg text-ink-600">
        Brand Brain por cliente, generación de ideas con Claude, coordinación de grabadores y
        editores, publicación automatizada y reporting semanal. Todo bajo un único panel.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
        >
          Entrar
        </Link>
        <a
          href="https://github.com/"
          className="rounded-md border border-ink-200 bg-white px-5 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
        >
          Documentación
        </a>
      </div>

      <footer className="mt-16 text-xs text-ink-400">
        © {new Date().getFullYear()} · Construido con Next.js + Supabase + Claude.
      </footer>
    </main>
  )
}
