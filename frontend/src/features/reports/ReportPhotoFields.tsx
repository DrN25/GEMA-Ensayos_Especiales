import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { optimizePhoto, type PhotoPosition, type ReportPhoto, type ReportPhotos as Photos } from './reportPhotos';

function PhotoCard({ position, photo, disabled, processing, onSelect, onRemove }: {
  position: PhotoPosition; photo?: ReportPhoto; disabled: boolean; processing: boolean;
  onSelect: (file: File) => void; onRemove: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo?.blob]);
  return <div className="min-w-0 space-y-3 rounded-xl border border-navy-800 bg-navy-900/40 p-3">
    <p className="text-sm font-bold">{position === 'antes' ? 'Antes del ensayo' : 'Después del ensayo'}</p>
    <div className="grid h-44 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-500/40 bg-white/5">
      {processing ? <LoaderCircle size={28} className="animate-spin text-sky-500" /> : preview
        ? <img src={preview} alt={position === 'antes' ? 'Muestra antes del ensayo' : 'Muestra después del ensayo'} className="h-full w-full object-contain" />
        : <Camera size={30} className="text-slate-400" aria-hidden="true" />}
    </div>
    {photo && <p className="break-words text-xs text-slate-400">{photo.name} · {photo.width} × {photo.height} px · {Math.ceil(photo.blob.size / 1024)} KB</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={disabled}
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-500/20 disabled:opacity-50 dark:text-sky-300">
        <ImagePlus size={15} /> {photo ? 'Reemplazar' : 'Seleccionar fotografía'}
      </button>
      {/* display:none keeps native file-input focus out of the scrollable app.
          A label + sr-only input can scroll clipped ancestors on picker open. */}
      <input ref={fileInput} type="file" accept="image/jpeg,image/png" hidden style={{ display: 'none' }} disabled={disabled}
        tabIndex={-1} aria-label={'Seleccionar fotografía ' + position}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onSelect(file); }} />
      {photo && <button type="button" disabled={disabled} onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-rose-700 hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-300"><Trash2 size={14} /> Quitar</button>}
    </div>
  </div>;
}

export default function ReportPhotos({ photos, disabled, onChange, onProcessing }: {
  photos: Photos; disabled: boolean; onChange: (photos: Photos) => void; onProcessing: (value: boolean) => void;
}) {
  const [processing, setProcessing] = useState<PhotoPosition | null>(null);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function select(position: PhotoPosition, file: File) {
    setError(''); setProcessing(position); onProcessing(true);
    try {
      const photo = await optimizePhoto(file);
      if (mounted.current) onChange({ ...photos, [position]: photo });
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : 'No se pudo preparar la fotografía.');
    } finally {
      if (mounted.current) { setProcessing(null); onProcessing(false); }
    }
  }
  return <fieldset className="space-y-3 rounded-xl border border-navy-800 px-4 pb-4 pt-2">
    <legend className="px-2"><span className="flex items-center gap-2 text-sm font-bold"><Camera size={17} className="text-sky-600 dark:text-sky-400" /> Registro fotográfico · Opcional</span></legend>
    <p className="text-xs text-slate-400">Puedes emitir sin fotografías. Si las agregas, selecciona Antes y Después, ambas verticales o ambas horizontales. JPEG/PNG hasta 10 MiB; se conserva solo la versión optimizada, de hasta 1600 px y 1 MiB. Las fotografías se suben a Google Drive únicamente al guardar el reporte.</p>
    <div className="grid gap-4 sm:grid-cols-2">{(['antes', 'despues'] as const).map(position => <PhotoCard key={position}
      position={position} photo={photos[position]} disabled={disabled || Boolean(processing)} processing={processing === position}
      onSelect={file => void select(position, file)} onRemove={() => { const next = { ...photos }; delete next[position]; onChange(next); }} />)}</div>
    {error && <p role="alert" className="rounded-lg bg-rose-500/10 p-2 text-xs font-semibold text-rose-800 dark:text-rose-300">{error}</p>}
  </fieldset>;
}
