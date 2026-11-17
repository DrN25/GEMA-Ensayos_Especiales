import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-navy-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500';
export const authInputClass = inputClass + ' bg-navy-950';
export const authFilledInputClass = inputClass + ' bg-navy-900 placeholder:text-slate-400 aria-[invalid=true]:border-rose-600';
export const authPrimaryClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800 dark:bg-sky-500 dark:text-navy-950 dark:hover:bg-sky-400 disabled:opacity-50';

export function AuthPasswordField({ name, label, autoComplete, required, minLength, invalid, describedBy, markRequired }: {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
  invalid?: boolean;
  describedBy?: string;
  markRequired?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}{markRequired && <span aria-hidden="true" className="ml-1 text-rose-700 dark:text-rose-300">*</span>}
      </label>
      <div className="relative">
        <input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
          required={required} minLength={minLength} maxLength={72} placeholder="••••••••"
          aria-invalid={invalid || undefined} aria-describedby={describedBy} className={authFilledInputClass + ' pr-12'} />
        <button type="button" className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 hover:text-slate-100"
          aria-label={(visible ? 'Ocultar' : 'Mostrar') + ' el valor de «' + label + '»'} aria-controls={id}
          onClick={() => setVisible(previous => !previous)}>
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
