import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleAlert, Pencil, Plus, Trash2, UserCheck, UserMinus, Users } from 'lucide-react';
import { API_BASE, responseError, useAuth } from './AuthContext';
import type { User } from './AuthContext';
import { AuthPasswordField, authFilledInputClass, authInputClass, authPrimaryClass } from './AuthFields';

type Role = { rol_id: number; nombre: string };
type Status = User['estado'];
const adminUrl = API_BASE + '/api/admin';
const columns = ['Usuario', 'Nombre completo', 'Correo', 'Rol', 'Estado', 'Último acceso', 'Acciones'];
const statuses = {
  A: { label: 'Activo', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-500/30' },
  I: { label: 'Inactivo', tone: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-500/30' },
  '*': { label: 'Eliminado', tone: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-500/30' },
};
const rowAction = 'inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50';
const actionTone = {
  edit: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/20',
  activate: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20',
  deactivate: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20',
  remove: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20',
};
const requiredMark = <span aria-hidden="true" className="ml-1 text-rose-700 dark:text-rose-200">*</span>;
const lastAccessFormat = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
});

function LastAccess({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400">Sin acceso</span>;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z');
  if (Number.isNaN(date.getTime())) return <span className="text-slate-400">—</span>;
  return <time dateTime={date.toISOString()}>{lastAccessFormat.format(date)}</time>;
}
const secondary = 'rounded-lg border border-navy-800 px-3 py-2 text-xs font-semibold hover:bg-navy-900 disabled:opacity-50';

export default function UsersPage() {
  const { user, authFetch } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(['/usuarios', '/roles'].map(async resource => {
      const response = await authFetch(adminUrl + resource, { signal: controller.signal });
      if (!response.ok) throw await responseError(response, 'No se pudo cargar la gestión de usuarios.');
      return response.json();
    })).then(([accounts, availableRoles]) => {
      setUsers(accounts);
      setRoles(availableRoles);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [authFetch]);

  function open(account: User | null) {
    setEditing(account);
    setFormVersion(version => version + 1);
    setDialogError('');
    dialog.current?.showModal();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '').trim();
    const confirmation = String(form.get('confirmPassword') ?? '').trim();
    const name = String(form.get('nombre') ?? '').trim();
    const username = String(form.get('usuario') ?? editing?.usuario ?? '').trim();
    if (!username || (!editing && (!name || !password))) {
      setDialogError('Completa todos los campos obligatorios para continuar.');
      return;
    }
    if (password !== confirmation) {
      setDialogError('Las contraseñas deben coincidir.');
      return;
    }
    const data = {
      usuario: username,
      email: String(form.get('email') ?? editing?.email ?? ''),
      nombre_completo: name,
      rol_id: Number(form.get('role') ?? editing?.rol_id),
      ...(password && { password }),
    };
    setSaving(true);
    setDialogError('');
    try {
      const response = await authFetch(adminUrl + '/usuarios' + (editing ? '/' + editing.usuario_id : ''), {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!response.ok) throw await responseError(response, 'No se pudo guardar la cuenta.');
      const saved: User = await response.json();
      setUsers(previous => editing ? previous.map(account => account.usuario_id === saved.usuario_id ? saved : account) : [...previous, saved]);
      setNotice(editing ? 'Cuenta actualizada.' : 'Cuenta creada.');
      dialog.current?.close();
    } catch (failure) {
      setDialogError(failure instanceof Error ? failure.message : 'No se pudo guardar la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(account: User, next: Status) {
    const action = next === '*' ? 'eliminar' : next === 'I' ? 'inactivar' : 'activar';
    if (saving || !window.confirm(`¿Deseas ${action} la cuenta ${account.usuario}?`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await authFetch(adminUrl + '/usuarios/' + account.usuario_id + '/estado', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: next }),
      });
      if (!response.ok) throw await responseError(response, 'No se pudo cambiar el estado.');
      const saved: User = await response.json();
      setUsers(previous => previous.map(item => item.usuario_id === saved.usuario_id ? saved : item));
      setNotice('Estado actualizado.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el estado.');
    } finally {
      setSaving(false);
    }
  }

  const term = filter.trim().toLowerCase();
  const visible = users.filter(account => (!status || account.estado === status) &&
    [account.usuario, account.email, account.nombre_completo].some(value => value?.toLowerCase().includes(term)));

  return (
    <section className="space-y-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-black"><Users size={21} className="text-sky-600 dark:text-sky-400" /> Gestión de usuarios</h1>
        <button type="button" className={authPrimaryClass} disabled={loading || saving || !roles.length} onClick={() => open(null)}><Plus size={16} /> Nuevo usuario</button>
      </div>
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-800 dark:text-rose-200">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <input aria-label="Buscar usuarios" placeholder="Buscar por nombre, usuario o correo" value={filter}
          onChange={event => setFilter(event.target.value)} className={authInputClass + ' sm:max-w-80'} />
        <select aria-label="Filtrar por estado" value={status} onChange={event => setStatus(event.target.value as Status | '')}
          className={authInputClass + ' sm:max-w-44'}>
          <option value="">Todos los estados</option>
          {Object.entries(statuses).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950">
        <table className="w-full text-left text-xs">
          <thead className="bg-navy-900 text-slate-300">
            <tr>{columns.map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-navy-800">
            {visible.map(account => (
              <tr key={account.usuario_id}>
                <td className="whitespace-nowrap px-4 py-3 font-bold">{account.usuario}</td>
                <td className="px-4 py-3">{account.nombre_completo || '—'}</td>
                <td className="px-4 py-3">{account.email}</td>
                <td className="px-4 py-3 capitalize">{account.rol_nombre}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={'inline-flex rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset ' + statuses[account.estado].tone}>
                    {statuses[account.estado].label}
                  </span>
                  {account.protegido && <span className="mt-1 block text-[10px] text-slate-400">Cuenta protegida</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums"><LastAccess value={account.ultimo_acceso} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" disabled={saving} onClick={() => open(account)} className={rowAction + ' ' + actionTone.edit}>
                      <Pencil size={13} aria-hidden="true" /> Editar
                    </button>
                    {!account.protegido && account.usuario_id !== user?.usuario_id && (
                      <>
                        {account.estado === 'A' ? (
                          <button type="button" disabled={saving} onClick={() => changeStatus(account, 'I')} className={rowAction + ' ' + actionTone.deactivate}>
                            <UserMinus size={13} aria-hidden="true" /> Inactivar
                          </button>
                        ) : (
                          <button type="button" disabled={saving} onClick={() => changeStatus(account, 'A')} className={rowAction + ' ' + actionTone.activate}>
                            <UserCheck size={13} aria-hidden="true" /> Activar
                          </button>
                        )}
                        {account.estado !== '*' && (
                          <button type="button" disabled={saving} onClick={() => changeStatus(account, '*')} className={rowAction + ' ' + actionTone.remove}>
                            <Trash2 size={13} aria-hidden="true" /> Eliminar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && <tr><td colSpan={columns.length} className="px-4 py-5 text-slate-400">{loading ? 'Cargando usuarios…' : 'Sin usuarios para mostrar.'}</td></tr>}
          </tbody>
        </table>
      </div>

      <dialog ref={dialog} aria-labelledby="user-editor-title" onCancel={event => { if (saving) event.preventDefault(); }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-navy-800 bg-navy-950 p-5 text-slate-100 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm">
        <form key={formVersion} onSubmit={save} className="space-y-4">
          <div className="border-b border-navy-800 pb-3">
            <h2 id="user-editor-title" className="text-base font-bold">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            {!editing && <p className="mt-1 text-xs text-slate-400">Todos los campos son obligatorios.</p>}
          </div>
          {dialogError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-400/10 dark:text-rose-200">
              <CircleAlert size={17} aria-hidden="true" className="mt-0.5 shrink-0" /> {dialogError}
            </p>
          )}
          <label className="block space-y-1.5 text-sm font-semibold"><span>Usuario{!editing && requiredMark}</span>
            <input required name="usuario" defaultValue={editing?.usuario} maxLength={50} readOnly={editing?.protegido}
              placeholder="Ej. ANA_ESPECIALES" className={authFilledInputClass} />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold"><span>Nombre completo{!editing && requiredMark}</span>
            <input required={!editing} name="nombre" defaultValue={editing?.nombre_completo ?? ''} maxLength={150}
              placeholder="Ej. Ana Pérez" className={authFilledInputClass} />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold"><span>Correo electrónico{!editing && requiredMark}</span>
            <input required type="email" name="email" defaultValue={editing?.email} maxLength={200} readOnly={editing?.protegido}
              placeholder="Ej. ana@empresa.com" className={authFilledInputClass} />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold"><span>Rol{!editing && requiredMark}</span>
            <select required name="role" defaultValue={editing?.rol_id ?? ''}
              disabled={Boolean(editing && (editing.protegido || editing.usuario_id === user?.usuario_id))} className={authFilledInputClass}>
              <option value="" disabled>Selecciona un rol</option>
              {roles.map(role => <option key={role.rol_id} value={role.rol_id}>{role.nombre}</option>)}
            </select>
          </label>
          {!editing?.protegido && (
            <div className="grid gap-3 sm:grid-cols-2">
              <AuthPasswordField name="password" label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
                autoComplete="new-password" minLength={4} required={!editing} markRequired={!editing} />
              <AuthPasswordField name="confirmPassword" label="Confirmar contraseña"
                autoComplete="new-password" minLength={4} required={!editing} markRequired={!editing} />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-navy-800 pt-3">
            <button type="button" disabled={saving} className={secondary} onClick={() => dialog.current?.close()}>Cancelar</button>
            <button type="submit" disabled={saving} className={authPrimaryClass}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
