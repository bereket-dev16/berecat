import { Navigate, Route, Routes } from 'react-router'
import {
  AuthenticatedRoute,
  UnauthenticatedRoute,
} from './features/auth/auth-guards'
import { AuthProvider } from './features/auth/auth-provider'
import { useAuth } from './features/auth/use-auth'
import { ArchivePage } from './pages/archive-page'
import { LoginPage } from './pages/login-page'
import { WorkItemDetailPage } from './pages/work-item-detail-page'
import { WorkspacePage } from './pages/workspace-page'

function AppRoutes() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#20201f] px-6 text-zinc-100">
        <p aria-live="polite" className="text-sm font-medium text-zinc-300">
          Oturum kontrol ediliyor…
        </p>
      </main>
    )
  }

  const fallbackPath = status === 'authenticated' ? '/' : '/login'

  return (
    <Routes>
      <Route element={<UnauthenticatedRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<AuthenticatedRoute />}>
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/arsiv" element={<ArchivePage />} />
        <Route path="/isler/:workItemId" element={<WorkItemDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to={fallbackPath} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
