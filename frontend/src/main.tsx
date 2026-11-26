import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { API_BASE, AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { applyStoredTheme } from './utils/theme'

// Aplicar el tema guardado ANTES del primer render para evitar parpadeo
applyStoredTheme()

function SessionGate() {
  const { user, testAccess } = useAuth()
  if (testAccess) return <App key="test-access" />
  return user ? <App key={user.usuario_id} /> : <LoginPage />
}

function AccessGate() {
  const [mode, setMode] = useState<'loading' | 'login' | 'test' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(API_BASE + '/api/auth/mode', {
          cache: 'no-store', signal: controller.signal,
        })
        // During a rolling deployment, an older backend still requires login.
        if (response.status === 404) {
          if (!controller.signal.aborted) setMode('login')
          return
        }
        if (!response.ok) throw new Error('No se pudo consultar el modo de acceso.')
        const config = await response.json()
        if (typeof config?.login_required !== 'boolean') throw new Error('Modo de acceso inválido.')
        if (!controller.signal.aborted) setMode(config.login_required ? 'login' : 'test')
      } catch {
        if (!controller.signal.aborted) setMode('error')
      }
    })()
    return () => controller.abort()
  }, [attempt])

  if (mode === 'test' || mode === 'login') {
    return <AuthProvider testAccess={mode === 'test'}><SessionGate /></AuthProvider>
  }
  return (
    <main className="grid min-h-screen place-content-center gap-3 bg-navy-950 p-6 text-center text-slate-100">
      {mode === 'error' ? (
        <>
          <p role="alert">No se pudo comprobar el acceso a Ensayos Especiales.</p>
          <button type="button" className="mx-auto rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => { setMode('loading'); setAttempt(previous => previous + 1) }}>
            Reintentar
          </button>
        </>
      ) : <p role="status">Comprobando acceso…</p>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccessGate />
  </StrictMode>,
)

