import { afterEach, describe, expect, it, vi } from 'vitest';
import { embedReportPhotos, optimizePhoto, uploadReportPhoto, photoPairError, previewPhotoDimensions } from '../reportPhotos';

afterEach(() => { vi.unstubAllGlobals(); });

describe('Photographs for UCS reports', () => {
  it('requires either no photos or the complete pair with matching orientation', () => {
    const portrait={blob:new Blob(),name:'v',width:400,height:600};
    const landscape={...portrait,width:600,height:400};
    expect(photoPairError({})).toBeNull();
    expect(photoPairError({antes:portrait})).toContain('Antes y Después');
    expect(photoPairError({despues:portrait})).toContain('Antes y Después');
    expect(photoPairError({antes:portrait,despues:portrait})).toBeNull();
    expect(photoPairError({antes:landscape,despues:landscape})).toBeNull();
    expect(photoPairError({antes:portrait,despues:landscape})).toContain('misma orientación');
  });
  it('does not accept unsupported images or oversized originals', async () => {
    await expect(optimizePhoto(new File(['GIF89a'], 'photo.gif'))).rejects.toThrow('JPEG o PNG');
    await expect(optimizePhoto({ size: 10 * 1024 * 1024 + 1 } as File)).rejects.toThrow('10 MiB');
  });

  it('resizes without distortion, paints white and releases decoded pixels', async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage };
    const canvas = { width: 0, height: 0, getContext: () => context,
      toBlob: (callback: (b: Blob) => void) => callback(new Blob(['optimized'], { type: 'image/jpeg' })) };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 3200, height: 1600, close }));
    vi.stubGlobal('document', { createElement: () => canvas });
    const photo = await optimizePhoto(new File([new Uint8Array([255,216,255,217])], 'camera.jpg'));
    expect([photo.width,photo.height]).toEqual([1600,800]);
    expect(photo.blob.type).toBe('image/jpeg');
    expect(context.fillStyle).toBe('#ffffff');
    expect(drawImage).toHaveBeenCalledWith(expect.anything(),0,0,1600,800);
    expect(close).toHaveBeenCalledOnce();
    expect([canvas.width,canvas.height]).toEqual([0,0]);
  });

  it('sends an optimized photo only to the authenticated GEMA endpoint and reuses a successful retry', async () => {
    const direct = vi.fn();
    vi.stubGlobal('fetch', direct);
    const request = vi.fn().mockResolvedValue({ id_imagen: 'image-1', estado: 'lista' });
    const photo = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), name: 'a.jpg', width: 10, height: 10 };
    expect(await uploadReportPhoto(photo, 'antes', 'DH-UCS-M01', 'request-1', request)).toBe('image-1');
    expect(request).toHaveBeenCalledWith('/imagenes/cargas?codigo_muestra=DH-UCS-M01&posicion=antes&solicitud_id=request-1', {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: photo.blob,
    });
    expect(direct).not.toHaveBeenCalled();
    request.mockClear();
    const cached = { ...photo, id: 'image-1', uploadRequest: 'request-1' };
    expect(await uploadReportPhoto(cached, 'antes', 'DH-UCS-M01', 'request-1', request)).toBe('image-1');
    expect(request).not.toHaveBeenCalled();
    await uploadReportPhoto(cached, 'antes', 'DH-UCS-M01', 'request-2', request);
    expect(request).toHaveBeenCalledOnce();
  });

  it('keeps upload errors retryable and builds preview metadata without sending bytes', async () => {
    const photo = { blob: new Blob(['jpeg']), name: 'a', width: 400, height: 600 };
    const request = vi.fn().mockRejectedValue(new Error('Drive no disponible'));
    expect(previewPhotoDimensions({ antes: photo, despues: photo })).toEqual({
      antes: { ancho: 400, alto: 600 }, despues: { ancho: 400, alto: 600 },
    });
    expect(request).not.toHaveBeenCalled();
    await expect(uploadReportPhoto(photo, 'antes', 'CODE', 'request-1', request)).rejects.toThrow('Drive no disponible');
  });

  it('leaves old reports untouched without loading resources', async () => {
    const direct=vi.fn(); vi.stubGlobal('fetch',direct);
    expect(await embedReportPhotos('<html><div class="espacio-foto"></div></html>')).toBe('<html><div class="espacio-foto"></div></html>');
    expect(direct).not.toHaveBeenCalled();
  });
});

function fakePhotoDocument(paths: string[]) {
  const images = paths.map((path, index) => ({
    src: path,
    getAttribute(name: string) { return name === 'src' ? path : index === 0 ? 'antes' : 'despues'; },
  }));
  vi.stubGlobal('DOMParser', class {
    parseFromString() {
      return { querySelectorAll: () => images, documentElement: { get outerHTML() { return images.map(image => image.src).join('|'); } } };
    }
  });
  vi.stubGlobal('FileReader', class {
    result = 'data:image/jpeg;base64,LOCAL';
    onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  });
  return images;
}

describe('Local preview and private history photographs', () => {
  it('embeds the local pair for preview without any download or upload', async () => {
    fakePhotoDocument(['/api/reportes/imagenes/locales/antes', '/api/reportes/imagenes/locales/despues']);
    const load = vi.fn();
    const photo = { blob: new Blob(['jpeg'], { type: 'image/jpeg' }), name: 'a', width: 400, height: 600 };
    const html = await embedReportPhotos('<html data-report-photo></html>', load, { antes: photo, despues: photo });
    expect(html.match(/data:image\/jpeg/g)).toHaveLength(2);
    expect(load).not.toHaveBeenCalled();
  });

  it('retrieves saved photos through GEMA without exposing Drive credentials', async () => {
    const path = '/api/reportes/imagenes/12345678-1234-1234-1234-123456789012';
    fakePhotoDocument([path]);
    const load = vi.fn().mockResolvedValue(new Response(new Blob(['jpeg'], { type: 'image/jpeg' })));
    expect(await embedReportPhotos('<html data-report-photo></html>', load)).toContain('data:image/jpeg');
    expect(load).toHaveBeenCalledExactlyOnceWith(path);
  });

  it('rejects external or missing local image references before requesting resources', async () => {
    const load = vi.fn();
    fakePhotoDocument(['https://drive.google.com/file/d/anything/view']);
    await expect(embedReportPhotos('<html data-report-photo></html>', load)).rejects.toThrow('referencia de GEMA');
    fakePhotoDocument(['/api/reportes/imagenes/locales/antes']);
    await expect(embedReportPhotos('<html data-report-photo></html>', load)).rejects.toThrow('Selecciona nuevamente');
    expect(load).not.toHaveBeenCalled();
  });

  it('rejects oversized stored photos', async () => {
    fakePhotoDocument(['/api/reportes/imagenes/12345678-1234-1234-1234-123456789012']);
    const load = vi.fn().mockResolvedValue(new Response('', { headers: { 'Content-Length': String(1024 * 1024 + 1) } }));
    await expect(embedReportPhotos('<html data-report-photo></html>', load)).rejects.toThrow('tamaño permitido');
  });
});
