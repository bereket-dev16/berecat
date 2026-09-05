import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../features/auth/use-auth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, sessionError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const visibleError = formError ?? sessionError

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setFormError(null)
    setIsSubmitting(true)

    const result = await login({ username, password })

    if (result.ok) {
      setPassword('')
      navigate('/', { replace: true })
      return
    }

    setFormError(result.message)
    setIsSubmitting(false)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#20201f] px-6 py-10 text-zinc-100">
      <section className="flex w-full max-w-[360px] flex-col items-center">
        <h1 className="sr-only">BereCat Girişi</h1>

        <img
          src="/brand/berecat-logo.png"
          alt="BereCat"
          className="h-auto w-[210px] max-w-[62vw] object-contain"
        />

        <form className="mt-9 w-full" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-zinc-200"
            >
              Kullanıcı adı
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={50}
              disabled={isSubmitting}
              placeholder="Kullanıcı Adınızı Girin"
              className="h-12 w-full rounded-[3px] border border-[#68685d] bg-[#f7f6f0] px-3 text-[0.9375rem] text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-[#f26a18] focus:ring-2 focus:ring-[#f26a18]/35 disabled:cursor-wait disabled:opacity-75"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-zinc-200"
            >
              Şifre
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                placeholder="Şifrenizi Girin"
                className="h-12 w-full rounded-[3px] border border-[#68685d] bg-[#f7f6f0] px-3 pr-20 text-[0.9375rem] text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-[#f26a18] focus:ring-2 focus:ring-[#f26a18]/35 disabled:cursor-wait disabled:opacity-75"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                disabled={isSubmitting}
                aria-label={
                  isPasswordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'
                }
                className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-[#8c390b] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a18] disabled:cursor-wait disabled:opacity-60"
              >
                {isPasswordVisible ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </div>

          <div
            role={visibleError ? 'alert' : undefined}
            aria-live="polite"
            className="mt-3 min-h-11 text-center text-sm leading-5 text-[#ffad7d]"
          >
            {visibleError}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="mx-auto mt-2 block min-h-12 w-40 rounded-[2px] bg-[#c94b05] px-5 text-base font-semibold text-white outline-none hover:bg-[#b64000] focus-visible:ring-2 focus-visible:ring-[#ffb487] focus-visible:ring-offset-2 focus-visible:ring-offset-[#20201f] disabled:cursor-wait disabled:bg-[#783a18]"
          >
            {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <p className="mt-9 text-xs text-zinc-400">
          Powered by{' '}
          <span className="font-semibold text-[#ef681c]">BereTech</span>
        </p>
      </section>
    </main>
  )
}
