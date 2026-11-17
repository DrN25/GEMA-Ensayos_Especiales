import { useState } from 'react';
import type { FormEvent } from 'react';
import { Boxes, CircleAlert, Info, Loader2, Moon, Sun } from 'lucide-react';
import { getStoredDarkMode, persistTheme } from '../utils/theme';
import { useAuth } from './AuthContext';
import { AuthPasswordField, authFilledInputClass, authPrimaryClass } from './AuthFields';

export function LoginPage() {
  const { login, checking, message } = useAuth();
  const [dark, setDark] = useState(getStoredDarkMode);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState({ identifier: false, password: false });
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const identifier = String(fields.get('identifier') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    const emptyFields = { identifier: !identifier, password: !password.trim() };
    setMissing(emptyFields);
    if (emptyFields.identifier || emptyFields.password) {
      setError('Completa el usuario o correo y la contraseña para iniciar sesión.');
      const firstMissing = form.elements.namedItem(emptyFields.identifier ? 'identifier' : 'password');
      if (firstMissing instanceof HTMLInputElement) firstMissing.focus();
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-navy-950 px-4 py-12 text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <button type="button" className="absolute right-4 top-4 rounded-xl border border-navy-800 bg-navy-900 p-3 text-slate-200"
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={() => { persistTheme(!dark); setDark(!dark); }}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="glass-panel relative w-full max-w-md rounded-2xl px-6 py-8 sm:px-9">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white">
            <Boxes size={24} aria-hidden="true" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-sky-700 dark:text-sky-400">GEMA SIGEG</p>
          <h1 className="mt-1 text-2xl font-black">Ensayos Especiales</h1>
        </div>
        {checking ? <p role="status" className="flex items-center justify-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Verificando sesión…</p> : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {error ? (
              <p id="login-notice" role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> {error}
              </p>
            ) : message && (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
                <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" /> {message}
              </p>
            )}
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>Usuario o correo electrónico</span>
              <input name="identifier" autoComplete="username" autoFocus required maxLength={200} placeholder="Ej. usuario@empresa.com"
                aria-invalid={missing.identifier || undefined} aria-describedby={missing.identifier ? 'login-notice' : undefined}
                className={authFilledInputClass} />
            </label>
            <AuthPasswordField name="password" label="Contraseña" autoComplete="current-password" required
              invalid={missing.password} describedBy={missing.password ? 'login-notice' : undefined} />
            <button type="submit" disabled={loading} className={authPrimaryClass + ' w-full'}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>
        )}
        <p className="mt-7 border-t border-navy-800 pt-4 text-center text-xs text-slate-400">
          GEMA-Ensayos Especiales &copy; 2026
        </p>
      </div>
    </main>
  );
}
