import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../features/auth/use-auth'

export function WorkspacePage() {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) {
    return null
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)
    const result = await logout()

    if (result.ok) {
      navigate('/login', { replace: true })
      return
    }

    setIsLoggingOut(false)
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#20201f] px-6 py-10 text-zinc-100">
      <section className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          BereCat Çalışma Alanı
        </h1>
        <p className="mt-4 text-base text-zinc-300">
          Hoş geldin, {user.displayName}
        </p>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          className="mt-8 min-h-11 rounded-[3px] bg-[#c94b05] px-6 font-semibold text-white outline-none hover:bg-[#b64000] focus-visible:ring-2 focus-visible:ring-[#ffb487] focus-visible:ring-offset-2 focus-visible:ring-offset-[#20201f] disabled:cursor-wait disabled:bg-[#783a18]"
        >
          Çıkış Yap
        </button>
      </section>
    </main>
  )
}
