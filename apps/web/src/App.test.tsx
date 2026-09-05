import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import App from './App'

const demoUser = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'eren',
  displayName: 'Eren',
  role: 'member',
  team: 'graphic',
} as const

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function mockUnauthenticatedSession() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ user: null }))
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText('Kullanıcı adı'), {
    target: { value: 'eren' },
  })
  fireEvent.change(screen.getByLabelText('Şifre'), {
    target: { value: 'guvenli-deneme-parolasi' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BereCat authentication akışı', () => {
  it('login ekranını kullanıcı adı ve şifre alanlarıyla gösterir', async () => {
    mockUnauthenticatedSession()

    renderApp('/login')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Kullanıcı adı')).toHaveAttribute(
      'autocomplete',
      'username',
    )
    expect(screen.getByLabelText('Şifre')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(screen.getByRole('img', { name: 'BereCat' })).toHaveAttribute(
      'src',
      '/brand/berecat-logo.png',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('şifreyi gösterip yeniden gizler', async () => {
    mockUnauthenticatedSession()

    renderApp('/login')

    const passwordInput = await screen.findByLabelText('Şifre')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi gizle' }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('hatalı girişte yalnızca genel mesajı gösterir', async () => {
    mockUnauthenticatedSession()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Kullanıcı adı veya şifre hatalı.' }, 401),
    )

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kullanıcı adı veya şifre hatalı.',
    )
  })

  it('başarılı girişten sonra korumalı çalışma ekranını açar', async () => {
    mockUnauthenticatedSession()
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))

    renderApp('/login')

    await screen.findByLabelText('Kullanıcı adı')
    fillLoginForm()
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(
      await screen.findByRole('heading', { name: 'BereCat Çalışma Alanı' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Hoş geldin, Eren')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('session yokken kök adresinden login ekranına yönlendirir', async () => {
    mockUnauthenticatedSession()

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'BereCat Çalışma Alanı' }),
    ).not.toBeInTheDocument()
  })

  it('geçerli session ile login adresinden çalışma ekranına yönlendirir', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))

    renderApp('/login')

    expect(
      await screen.findByRole('heading', { name: 'BereCat Çalışma Alanı' }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Kullanıcı adı')).not.toBeInTheDocument()
  })

  it('çıkış işlemi sonrasında login ekranına döner', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: demoUser }))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    renderApp('/')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Çıkış Yap' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'BereCat Girişi' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
    })
  })
})
