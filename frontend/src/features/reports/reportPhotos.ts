export const MAX_PHOTO_BYTES = 1024 * 1024;
export type PhotoPosition = 'antes' | 'despues';
export type ReportPhoto = { blob: Blob; name: string; width: number; height: number; id?: string; uploadRequest?: string };
export type ReportPhotos = Partial<Record<PhotoPosition, ReportPhoto>>;

export function photoPairError(photos: ReportPhotos): string | null {
  if (Boolean(photos.antes) !== Boolean(photos.despues)) return 'Adjunta Antes y Después, o quita ambas fotografías.';
  if (photos.antes && photos.despues && (photos.antes.width >= photos.antes.height) !== (photos.despues.width >= photos.despues.height)) {
    return 'Ambas fotografías deben tener la misma orientación: verticales u horizontales.';
  }
  return null;
}

export async function optimizePhoto(file: File): Promise<ReportPhoto> {
  if (file.size > 10 * 1024 * 1024) throw new Error('La fotografía original supera 10 MiB. Reduce su tamaño antes de seleccionarla.');
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = signature[0] === 255 && signature[1] === 216;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => signature[i] === v);
  if (!jpeg && !png) throw new Error('Selecciona una fotografía JPEG o PNG. Convierte HEIC antes de cargarla.');
  // Decode one image at a time, honor EXIF orientation, then retain only the
  // optimized JPEG. No original file is sent to the backend or object storage.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  try {
    for (const side of [1600, 1200, 960]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo preparar la fotografía.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.82, 0.74]) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
          value => value ? resolve(value) : reject(new Error('No se pudo optimizar la fotografía.')), 'image/jpeg', quality));
        if (blob.type !== 'image/jpeg') throw new Error('El navegador no pudo convertir la fotografía a JPEG.');
        if (blob.size <= MAX_PHOTO_BYTES) return { blob, name: file.name, width: canvas.width, height: canvas.height };
      }
    }
    throw new Error('No se pudo reducir la fotografía a 1 MiB conservando el formato.');
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}

type Request = (path: string, options?: RequestInit) => Promise<any>;

export function previewPhotoDimensions(photos: ReportPhotos) {
  return Object.fromEntries((['antes', 'despues'] as const).flatMap(position => {
    const photo = photos[position];
    return photo ? [[position, { ancho: photo.width, alto: photo.height }]] : [];
  }));
}

export async function uploadReportPhoto(photo: ReportPhoto, position: PhotoPosition, code: string, requestId: string, request: Request): Promise<string> {
  if (photo.id && photo.uploadRequest === requestId) return photo.id;
  const params = new URLSearchParams({ codigo_muestra: code, posicion: position, solicitud_id: requestId });
  // Only called by Guardar reporte. Google credentials never reach the browser.
  const result = await request('/imagenes/cargas?' + params, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: photo.blob,
  });
  return result.id_imagen;
}

export async function embedReportPhotos(html: string, load?: (path: string) => Promise<Response>, localPhotos: ReportPhotos = {}): Promise<string> {
  if (!html.includes('data-report-photo')) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const image of doc.querySelectorAll<HTMLImageElement>('img[data-report-photo]')) {
    const position = image.getAttribute('data-report-photo');
    if (position !== 'antes' && position !== 'despues') throw new Error('La posición de la fotografía no es válida.');
    const path = image.getAttribute('src') || '';
    const localPath = '/api/reportes/imagenes/locales/' + position;
    if (path !== localPath && !/^\/api\/reportes\/imagenes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) {
      throw new Error('La fotografía no tiene una referencia de GEMA válida.');
    }
    let blob = localPhotos[position]?.blob;
    if (!blob) {
      if (path === localPath || !load) throw new Error('Selecciona nuevamente las fotografías para ver la vista previa.');
      const response = await load(path);
      if (!response.ok) throw new Error('No se pudo recuperar una fotografía desde Google Drive. Reintenta desde el historial.');
      const length = Number(response.headers.get('Content-Length') || 0);
      if (length > MAX_PHOTO_BYTES) throw new Error('La fotografía supera el tamaño permitido.');
      blob = await response.blob();
    }
    if (blob.size > MAX_PHOTO_BYTES || blob.type.split(';')[0] !== 'image/jpeg') throw new Error('La fotografía no tiene el formato esperado.');
    image.src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo preparar la fotografía para el PDF.'));
      reader.readAsDataURL(blob);
    });
  }
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
