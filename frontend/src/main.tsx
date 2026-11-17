import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { applyStoredTheme } from './utils/theme'

// Aplicar el tema guardado ANTES del primer render para evitar parpadeo
applyStoredTheme()

function SessionGate() {
  const { user } = useAuth()
  return user ? <App key={user.usuario_id} /> : <LoginPage />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider><SessionGate /></AuthProvider>
  </StrictMode>,
)

