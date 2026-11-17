import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react';
import { API_BASE, responseError, useAuth } from './AuthContext';
import { authInputClass, authPrimaryClass } from './AuthFields';

export default function ProfileMenu({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) {
  const { user, authFetch, endSession } = useAuth();
  const menu = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<'password' | 'logout'>('password');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!user) return null;

  function open(nextAction: typeof action) {
    if (menu.current) menu.current.open = false;
    setAction(nextAction);
    setError('');
    dialog.current?.querySelector('form')?.reset();
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('new') ?? '').trim();
    if (action === 'password' && newPassword !== String(data.get('confirm') ?? '').trim()) {
      setError('Las contraseñas nuevas deben coincidir.');
      return;
    }
    setPending(true);
    try {
      const response = await authFetch(API_BASE + '/api/auth/' + (action === 'logout' ? 'logout' : 'change-password'), {
        method: 'POST',
        ...(action === 'password' && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_password: data.get('current'), new_password: newPassword }),
        }),
      });
      if (!response.ok) throw await responseError(response, 'No se pudo completar la acción.');
      dialog.current?.close();
      endSession(action === 'password' ? 'Contraseña actualizada. Inicia sesión nuevamente.' : undefined);
    } catch (failure) {
      if (action === 'logout') {
        dialog.current?.close();
        endSession();
        return;
      }
      setError(failure instanceof Error ? failure.message : 'No se pudo completar la acción.');
    } finally {
      setPending(false);
    }
  }

  const menuItemClass = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-navy-900';
  const name = user.nombre_completo || user.usuario;

  return (
    <>
      <details ref={menu} className="group relative shrink-0" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }} onKeyDown={event => {
        if (event.key === 'Escape') {
          event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}>
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-navy-800 bg-navy-900 px-2 py-1.5 hover:border-sky-500/60 [&::-webkit-details-marker]:hidden"
          aria-label={'Opciones de perfil de ' + name} title={name + ' · ' + user.rol_nombre}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <UserRound size={15} aria-hidden="true" />
          </span>
          <span className="min-w-0 max-w-24 sm:max-w-40">
            <span className="block truncate text-xs font-bold text-slate-100">{name}</span>
            <span className="block truncate text-[10px] font-semibold capitalize text-slate-400">{user.rol_nombre}</span>
          </span>
          <ChevronDown size={14} className="text-slate-400 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-navy-800 bg-navy-950 p-1 shadow-xl">
          <button type="button" className={menuItemClass} onClick={() => open('password')}><KeyRound size={15} /> Cambiar contraseña</button>
          <button type="button" className={menuItemClass} onClick={() => open('logout')}><LogOut size={15} /> Cerrar sesión</button>
        </div>
      </details>

      <dialog ref={dialog} aria-labelledby="profile-dialog-title" onCancel={event => { if (pending) event.preventDefault(); }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-navy-800 bg-navy-950 p-5 text-slate-100 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm">
        <form onSubmit={submit} className="space-y-4">
          <h2 id="profile-dialog-title" className="font-bold">{action === 'logout' ? 'Cerrar sesión' : 'Cambiar contraseña'}</h2>
          {error && <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{error}</p>}
          {action === 'logout' ? (
            <p className="text-sm text-slate-300">
              {hasUnsavedChanges ? 'Hay cambios sin sincronizar con el servidor. ¿Deseas cerrar sesión?' : '¿Deseas cerrar sesión en Ensayos Especiales?'}
            </p>
          ) : (
            <div className="space-y-3">
              {[
                { name: 'current', label: 'Contraseña actual', autocomplete: 'current-password' },
                { name: 'new', label: 'Contraseña nueva', autocomplete: 'new-password', min: 4 },
                { name: 'confirm', label: 'Confirmar contraseña', autocomplete: 'new-password', min: 4 },
              ].map(field => (
                <label key={field.name} className="block space-y-1 text-sm font-semibold">
                  <span>{field.label}</span>
                  <input type="password" name={field.name} required minLength={field.min} maxLength={72} autoComplete={field.autocomplete} className={authInputClass} />
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-xl border border-navy-800 px-4 py-2 text-sm font-semibold hover:bg-navy-900"
              disabled={pending} onClick={() => dialog.current?.close()}>Cancelar</button>
            <button type="submit" className={authPrimaryClass} disabled={pending}>
              {pending ? 'Procesando…' : action === 'logout' ? 'Cerrar sesión' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
