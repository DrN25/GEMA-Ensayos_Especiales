"""Private Google Drive storage. JPEG bytes are bounded; pixels/PDF stay in the browser."""
import hashlib
import json
import os
import re
import threading
from functools import lru_cache
from tempfile import SpooledTemporaryFile
from uuid import uuid4

import httpx
from fastapi import HTTPException

MAX_IMAGE_BYTES = 1024 * 1024
MAX_IMAGE_SIDE = 1600
BLOCK_SIZE = 64 * 1024
DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
DRIVE_API = 'https://www.googleapis.com/drive/v3'
PHOTO_FOLDERS = {
    'ucs': 'UCS',
    'constantes-elasticas': 'Constantes elásticas',
    'compresion-triaxial': 'Compresión triaxial',
    'corte-directo': 'Corte directo',
    'traccion-indirecta': 'Tracción indirecta',
}


def jpeg_dimensions(data):
    if not data.startswith(b'\xff\xd8'):
        raise HTTPException(422, 'La fotografía optimizada debe ser JPEG.')
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 255:
            break
        while pos < len(data) and data[pos] == 255:
            pos += 1
        if pos >= len(data):
            break
        marker = data[pos]
        pos += 1
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        length = int.from_bytes(data[pos:pos+2], 'big')
        if length < 2 or pos + length > len(data):
            break
        if marker in (0xC0, 0xC1, 0xC2):
            height = int.from_bytes(data[pos+3:pos+5], 'big')
            width = int.from_bytes(data[pos+5:pos+7], 'big')
            if length >= 8 and 0 < width <= MAX_IMAGE_SIDE and 0 < height <= MAX_IMAGE_SIDE:
                return width, height
            raise HTTPException(422, 'La fotografía supera las dimensiones admitidas (1600 píxeles).')
        if marker in (0xDA, 0xD9):
            break
        pos += length
    raise HTTPException(422, 'La cabecera JPEG no es válida o es demasiado grande.')


def inspect_jpeg(stream):
    """Validate encoded bytes with a 64 KiB header, never decoding an image."""
    stream.seek(0)
    size, prefix, ending = 0, b'', b''
    digest = hashlib.sha256()
    while block := stream.read(BLOCK_SIZE):
        size += len(block)
        if size > MAX_IMAGE_BYTES:
            raise HTTPException(413, 'La fotografía optimizada supera 1 MiB.')
        digest.update(block)
        if len(prefix) < BLOCK_SIZE:
            prefix += block[:BLOCK_SIZE-len(prefix)]
        ending = (ending + block)[-2:]
    if not size or ending != b'\xff\xd9':
        raise HTTPException(422, 'La fotografía JPEG está incompleta.')
    width, height = jpeg_dimensions(prefix)
    stream.seek(0)
    return size, width, height, digest.hexdigest()


def photo_filename(code, position, image_id, registered):
    safe = re.sub(r'[^\w.-]+', '_', code, flags=re.UNICODE).strip('._')[:150] or 'MUESTRA'
    return f'{safe}_{position.upper()}_{registered:%Y%m%dT%H%M%SZ}_{image_id[:12]}.jpg'


class ImageStorage:
    provider = 'google_drive'

    def __init__(self, client, root_folder, token):
        self.client, self.bucket, self.token = client, root_folder, token
        self._folders = {}
        self._folder_lock = threading.Lock()

    def _request(self, method, url, *, allow_conflict=False, **kwargs):
        try:
            response = self.client.request(method, url, headers={
                'Authorization': 'Bearer ' + self.token(), **kwargs.pop('headers', {})}, **kwargs)
        except httpx.HTTPError as exc:
            raise HTTPException(503, 'No se pudo conectar con Google Drive. Puedes reintentar el guardado.') from exc
        if response.status_code == 409 and allow_conflict:
            return response
        self.check_response(response)
        return response

    @staticmethod
    def check_response(response):
        if response.is_success:
            return
        if response.status_code == 404:
            raise HTTPException(410, 'No se encontró la fotografía o carpeta en Drive. Revisa si fue eliminada o si cambió el acceso.')
        if response.status_code in (401, 403):
            raise HTTPException(503, 'Google Drive rechazó el acceso. Revisa la autorización, los permisos de la carpeta y el espacio disponible.')
        raise HTTPException(503, 'Google Drive no pudo completar la operación. Reintenta en unos momentos.')

    def folder_for(self, kind):
        if kind not in PHOTO_FOLDERS:
            raise HTTPException(422, 'El tipo de ensayo no admite fotografías.')
        with self._folder_lock:
            if kind in self._folders:
                return self._folders[kind]
            root = self._request('GET', f'{DRIVE_API}/files/{self.bucket}', params={
                'fields': 'id,mimeType,trashed,capabilities(canAddChildren)', 'supportsAllDrives': 'true'}).json()
            if root.get('trashed') or root.get('mimeType') != 'application/vnd.google-apps.folder' or not root.get('capabilities', {}).get('canAddChildren'):
                raise HTTPException(503, 'La carpeta raíz de Drive no existe o no permite guardar fotografías.')
            query = (f"'{self.bucket}' in parents and trashed = false "
                     "and mimeType = 'application/vnd.google-apps.folder' "
                     f"and appProperties has {{ key='gema_tipo' and value='{kind}' }}")
            matches = self._request('GET', f'{DRIVE_API}/files', params={
                'q': query, 'fields': 'files(id)', 'pageSize': 100,
                'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true'}).json().get('files', [])
            if len(matches) > 1:
                raise HTTPException(409, 'Hay carpetas duplicadas para este ensayo. Revisa la configuración de Drive.')
            folder = matches[0] if matches else self._request('POST', f'{DRIVE_API}/files', params={
                'fields': 'id', 'supportsAllDrives': 'true'}, json={
                    'name': PHOTO_FOLDERS[kind], 'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [self.bucket], 'appProperties': {'gema_tipo': kind}}).json()
            self._folders[kind] = folder['id']
            return folder['id']

    def existing_folder_ids(self):
        """Read only: cleanup must not create unused assay folders."""
        folders, page_token = set(), None
        while True:
            params = {
                'q': (f"'{self.bucket}' in parents and trashed = false "
                      "and mimeType = 'application/vnd.google-apps.folder'"),
                'fields': 'nextPageToken,files(id,appProperties)', 'pageSize': 100,
                'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true',
            }
            if page_token:
                params['pageToken'] = page_token
            result = self._request('GET', f'{DRIVE_API}/files', params=params).json()
            folders.update(item['id'] for item in result.get('files', [])
                           if item.get('appProperties', {}).get('gema_tipo') in PHOTO_FOLDERS)
            page_token = result.get('nextPageToken')
            if not page_token:
                return folders

    def reserve_id(self):
        return self._request('GET', f'{DRIVE_API}/files/generateIds', params={
            'count': 1, 'space': 'drive', 'type': 'files'}).json()['ids'][0]

    def upload(self, file_id, folder, name, stream, size, sha256, image_id):
        # A pre-generated Drive ID is persisted before upload. Repeated POSTs get
        # 409 rather than creating duplicate photographs after a lost response.
        boundary = 'gema_' + uuid4().hex
        metadata = json.dumps({'id': file_id, 'name': name, 'parents': [folder],
                               'mimeType': 'image/jpeg', 'appProperties': {'gema_imagen': image_id}}).encode()
        prefix = (f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'.encode()
                  + metadata + f'\r\n--{boundary}\r\nContent-Type: image/jpeg\r\n\r\n'.encode())
        suffix = f'\r\n--{boundary}--\r\n'.encode()

        def body():
            stream.seek(0)
            yield prefix
            while block := stream.read(BLOCK_SIZE):
                yield block
            yield suffix

        self._request('POST', 'https://www.googleapis.com/upload/drive/v3/files',
                      params={'uploadType': 'multipart', 'supportsAllDrives': 'true', 'fields': 'id'},
                      headers={'Content-Type': f'multipart/related; boundary={boundary}',
                               'Content-Length': str(len(prefix)+size+len(suffix))},
                      content=body(), allow_conflict=True)
        # Verify the stored content, including recovery from an interrupted POST.
        verified = self.download(file_id, folder, size, sha256)
        verified.close()

    def download(self, file_id, folder, size, sha256):
        info = self._request('GET', f'{DRIVE_API}/files/{file_id}', params={
            'fields': 'id,size,mimeType,parents,trashed', 'supportsAllDrives': 'true'}).json()
        if (info.get('trashed') or info.get('mimeType') != 'image/jpeg'
                or int(info.get('size', -1)) != size):
            raise HTTPException(409, 'La fotografía de Drive fue modificada o ya no corresponde al reporte.')
        output = SpooledTemporaryFile(max_size=BLOCK_SIZE, mode='w+b')
        try:
            with self.client.stream('GET', f'{DRIVE_API}/files/{file_id}', params={
                    'alt': 'media', 'supportsAllDrives': 'true'}, headers={
                    'Authorization': 'Bearer ' + self.token()}) as response:
                self.check_response(response)
                total = 0
                for block in response.iter_bytes(BLOCK_SIZE):
                    total += len(block)
                    if total > MAX_IMAGE_BYTES or total > size:
                        raise HTTPException(409, 'La fotografía almacenada supera el tamaño del reporte.')
                    output.write(block)
            actual_size, _, _, actual_hash = inspect_jpeg(output)
            if actual_size != size or actual_hash != sha256:
                raise HTTPException(409, 'La fotografía de Drive cambió desde la emisión del reporte.')
            return output
        except Exception as exc:
            output.close()
            if isinstance(exc, httpx.HTTPError):
                raise HTTPException(503, 'No se pudo descargar la fotografía desde Google Drive. Reintenta desde el historial.') from exc
            raise

    def delete(self, file_id):
        self._request('DELETE', f'{DRIVE_API}/files/{file_id}', params={'supportsAllDrives': 'true'})


@lru_cache(maxsize=1)
def storage():
    folder = os.environ.get('GOOGLE_DRIVE_ROOT_FOLDER_ID', '').strip()
    token_file = os.environ.get('GOOGLE_DRIVE_TOKEN_FILE', '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,150}', folder) or not token_file:
        raise HTTPException(503, 'Configura GOOGLE_DRIVE_ROOT_FOLDER_ID y GOOGLE_DRIVE_TOKEN_FILE en el backend. Consulta IMAGENES_UCS.md.')
    try:
        from google.oauth2.credentials import Credentials
        credentials = Credentials.from_authorized_user_file(token_file, scopes=[DRIVE_SCOPE])
    except ImportError as exc:
        raise HTTPException(503, 'Instala las dependencias actualizadas para Google Drive.') from exc
    except (OSError, ValueError, KeyError) as exc:
        raise HTTPException(503, 'No se pudo leer la autorización de Google Drive. Ejecuta de nuevo la configuración local.') from exc
    # Never trust a token endpoint supplied by an edited JSON credentials file.
    if credentials.token_uri != 'https://oauth2.googleapis.com/token':
        raise HTTPException(503, 'La autorización de Google Drive tiene un servidor OAuth no admitido.')
    token_lock = threading.Lock()

    def token():
        from google.auth.transport.requests import Request
        from google.auth.exceptions import GoogleAuthError
        with token_lock:
            try:
                if not credentials.valid:
                    request = Request()
                    def refresh_request(*args, **kwargs):
                        kwargs.setdefault('timeout', 15)
                        return request(*args, **kwargs)
                    credentials.refresh(refresh_request)
            except GoogleAuthError as exc:
                raise HTTPException(503, 'La autorización de Google Drive expiró o fue revocada. Ejecuta nuevamente la configuración local.') from exc
            return credentials.token

    return ImageStorage(httpx.Client(timeout=httpx.Timeout(30, connect=8),
                                     limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
                                     follow_redirects=False), folder, token)
