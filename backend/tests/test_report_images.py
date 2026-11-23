import hashlib
import json
from datetime import date
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from tests.test_reportes_ucs import report_db
from app.models import RegistroMaestro
from app.auth.router import current_user
from app.database import get_db
from app.reportes import images
from app.reportes.image_storage import ImageStorage, MAX_IMAGE_BYTES, PHOTO_FOLDERS, inspect_jpeg, jpeg_dimensions, photo_filename
from app.reportes.router import (Emission, PreviewEmission, SaveEmission, ImageUpload, Report, preview, save,
                                get_report, store_uploaded_image, router, FORMATS, sample)

JPEG = b'\xff\xd8\xff\xc0\x00\x0b\x08\x00\x64\x00\xc8\x01\x01\x11\x00\xff\xd9'


class MemoryDrive:
    provider = 'google_drive'
    bucket = 'root-dev'

    def __init__(self):
        self.objects, self.names, self.file_folders = {}, {}, {}
        self.allocations, self.calls, self.fail_once = 0, 0, False

    def folder_for(self, kind):
        assert kind in PHOTO_FOLDERS
        return 'folder-' + kind

    def reserve_id(self):
        self.allocations += 1
        return 'drive-file-' + str(self.allocations)

    def upload(self, file_id, folder, name, stream, size, digest, image_id):
        self.calls += 1
        assert folder in {'folder-' + kind for kind in PHOTO_FOLDERS}
        stream.seek(0)
        content = stream.read(MAX_IMAGE_BYTES+1)
        assert len(content) == size and hashlib.sha256(content).hexdigest() == digest
        if file_id in self.objects:
            assert self.objects[file_id] == content
        self.objects[file_id], self.names[file_id], self.file_folders[file_id] = content, name, folder
        if self.fail_once:
            self.fail_once = False
            raise HTTPException(503, 'Respuesta de Drive interrumpida después de guardar.')

    def download(self, file_id, folder, size, digest):
        content = self.objects[file_id]
        assert folder == self.file_folders[file_id] and len(content) == size
        assert hashlib.sha256(content).hexdigest() == digest
        return BytesIO(content)


@pytest.fixture
def photo_setup(report_db, monkeypatch):
    db = report_db
    images.ImageBase.metadata.create_all(db.get_bind())
    db.add(RegistroMaestro(idd=1, codigo_muestra='DH-UCS-M01', tipo_ensayo='UCS', sondaje='DH'))
    db.add(RegistroMaestro(idd=2, codigo_muestra='DH-UCS-M02', tipo_ensayo='Determinación de constantes elásticas', sondaje='DH'))
    db.commit()
    store = MemoryDrive()
    monkeypatch.setattr(images, 'storage', lambda: store)
    return db, SimpleNamespace(id=42, usuario='TEST_PHOTOS'), store


def uploaded(setup, position='antes', request_id=None, content=JPEG):
    db, actor, _ = setup
    payload = ImageUpload(codigo_muestra='DH-UCS-M01', posicion=position, solicitud_id=request_id or uuid4())
    return UUID(store_uploaded_image(payload, BytesIO(content), db, actor)['id_imagen'])


def test_preview_uses_local_photos_without_storage_or_sql_writes(photo_setup, monkeypatch):
    db, actor, store = photo_setup
    monkeypatch.setattr(images, 'storage', lambda: pytest.fail('Preview must not contact Drive'))
    emission = PreviewEmission(codigo_muestra='DH-UCS-M01', numero_informe='PREVIEW', fecha_emision=date.today(),
                               fotografias_locales={'antes': {'ancho': 400, 'alto': 600}, 'despues': {'ancho': 800, 'alto': 1200}})
    html = preview(emission, db, actor)['html']
    assert html.count('data-report-photo=') == 2
    assert '/api/reportes/imagenes/locales/antes' in html
    assert 'class="firmas firmas-comunes"' in html
    assert db.scalar(select(func.count()).select_from(images.ReportImage)) == 0
    assert db.scalar(select(func.count()).select_from(Report)) == 0
    assert store.calls == 0
    for fields in ({'antes': {'ancho': 10, 'alto': 20}},
                   {'antes': {'ancho': 10, 'alto': 20}, 'despues': {'ancho': 20, 'alto': 10}}):
        with pytest.raises(HTTPException) as error:
            preview(emission.model_copy(update={'fotografias_locales': PreviewEmission(**{**emission.model_dump(), 'fotografias_locales': fields}).fotografias_locales}), db, actor)
        assert error.value.status_code == 422


def test_save_history_and_retry_keep_one_file_per_slot(photo_setup):
    db, actor, store = photo_setup
    request_id = uuid4()
    before = uploaded(photo_setup, request_id=request_id)
    after = uploaded(photo_setup, 'despues', request_id)
    assert uploaded(photo_setup, request_id=request_id) == before
    assert store.calls == 2
    emission = SaveEmission(codigo_muestra='DH-UCS-M01', numero_informe='PHOTO-1', fecha_emision=date.today(),
                            solicitud_id=request_id, imagenes={'antes': before, 'despues': after})
    issued = save(emission, db, actor)
    stored = db.get(Report, issued['id_reporte'])
    assert stored.version_plantilla == 'ucs-v2'
    assert 'google_drive' in stored.datos_emitidos
    assert 'data:image' not in stored.datos_emitidos and 'Bearer' not in stored.datos_emitidos
    assert save(emission, db, actor)['id_reporte'] == issued['id_reporte']
    assert len(store.objects) == 2
    assert all(name.startswith('DH-UCS-M01_') and name.endswith('.jpg') for name in store.names.values())
    assert all(str(request_id)[:12] in name for name in store.names.values())
    assert any('_ANTES_' in name for name in store.names.values())
    assert any('_DESPUES_' in name for name in store.names.values())
    stream, size = images.download_image(db, before)
    assert stream.read() == JPEG and size == len(JPEG)
    stream.close()
    db.get(RegistroMaestro, 1).ucs_resistencia = 999
    db.flush()
    assert get_report(issued['id_reporte'], db)['html'] == issued['html']
    with pytest.raises(HTTPException) as error:
        save(emission.model_copy(update={'solicitud_id': uuid4()}), db, actor)
    assert error.value.status_code == 409


def test_interrupted_upload_can_be_retried_without_duplicate_files(photo_setup):
    db, _, store = photo_setup
    request_id = uuid4()
    store.fail_once = True
    with pytest.raises(HTTPException):
        uploaded(photo_setup, request_id=request_id)
    pending = db.scalar(select(images.ReportImage))
    assert pending.estado == 'pendiente' and pending.id_reporte is None
    file_id = pending.objeto
    uploaded(photo_setup, request_id=request_id)
    assert store.allocations == 1 and list(store.objects) == [file_id]
    assert db.scalar(select(images.ReportImage)).estado == 'lista'
    with pytest.raises(HTTPException) as conflict:
        uploaded(photo_setup, request_id=request_id, content=JPEG.replace(b'\x00\xc8', b'\x00\xc9'))
    assert conflict.value.status_code == 409


def test_type_ownership_pairs_and_unissued_download_are_checked(photo_setup):
    db, actor, _ = photo_setup
    before = uploaded(photo_setup)
    with pytest.raises(HTTPException) as error:
        images.download_image(db, before)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException):
        images.owned_image(db, before, SimpleNamespace(id=99))
    db.add(RegistroMaestro(idd=3, codigo_muestra='DH-PF-M01', tipo_ensayo='Propiedades físicas'))
    db.flush()
    with pytest.raises(HTTPException) as wrong_type:
        store_uploaded_image(ImageUpload(codigo_muestra='DH-PF-M01', posicion='antes', solicitud_id=uuid4()), BytesIO(JPEG), db, actor)
    assert wrong_type.value.status_code == 422
    base = dict(codigo_muestra='DH-UCS-M01', numero_informe='P', fecha_emision=date.today(), solicitud_id=uuid4())
    with pytest.raises(HTTPException) as pair:
        save(SaveEmission(**base, imagenes={'antes': before}), db, actor)
    assert pair.value.status_code == 422
    after = uploaded(photo_setup, 'despues')
    db.get(images.ReportImage, str(after)).ancho = 50
    with pytest.raises(HTTPException) as orientation:
        save(SaveEmission(**base, imagenes={'antes': before, 'despues': after}), db, actor)
    assert orientation.value.status_code == 422
    db.rollback()
    with pytest.raises(HTTPException):
        preview(PreviewEmission(codigo_muestra='DH-UCS-M01', numero_informe='P', fecha_emision=date.today(), imagenes={'antes': before}), db, actor)


def test_optional_images_keep_template_and_signatures(photo_setup):
    db, actor, _ = photo_setup
    issued = save(SaveEmission(codigo_muestra='DH-UCS-M01', numero_informe='P2', fecha_emision=date.today(),
                               ejecutor='Ana Pérez', supervisor='Carlos García', solicitud_id=uuid4()), db, actor)
    assert db.get(Report, issued['id_reporte']).version_plantilla == 'ucs-v2'
    assert '<figure' not in issued['html'] and '<figcaption' not in issued['html']
    for text in ('Ana Pérez', 'Ejecutor del Ensayo', 'Carlos García', 'Supervisor de Laboratorio'):
        assert text in issued['html']
    assert issued['html'].count('class="firma-trazo"') == 2


@pytest.mark.parametrize('dimensions', [((400,600),(800,1200)), ((600,400),(1200,800)), ((400,600),(600,800)), ((1200,800),(1600,900))])
def test_frames_follow_aspect_ratio_and_align_captions(dimensions):
    data = {'imagenes': {position: {'ancho': width, 'alto': height} for position, (width, height) in zip(('antes', 'despues'), dimensions)}}
    layout = images.photo_layout(data)
    assert layout['antes']['alto'] == layout['despues']['alto']
    for position, (width, height) in zip(('antes', 'despues'), dimensions):
        box = layout[position]
        assert abs((box['ancho']-3.7)-(box['alto']-3)*width/height) < 0.001
        assert box['alto']-3 <= 66.001 and box['ancho']-3.7 <= 72.001
    assert sum(box['ancho'] for box in layout.values())+20 <= 171.401


def test_encoded_validation_limits_size_and_never_reads_unbounded():
    class BoundedReader(BytesIO):
        def read(self, size=-1):
            assert 0 < size <= 65536
            return super().read(size)
    assert inspect_jpeg(BoundedReader(JPEG)) == (len(JPEG), 200, 100, hashlib.sha256(JPEG).hexdigest())
    for content in (JPEG[:-2], b'<html>bad</html>', b'\xff\xd8BAD\xff\xd9', b'x'*(MAX_IMAGE_BYTES+1)):
        with pytest.raises(HTTPException):
            inspect_jpeg(BoundedReader(content))
    with pytest.raises(HTTPException):
        jpeg_dimensions(JPEG.replace(b'\x00\xc8', b'\x20\x00'))
    assert images.photo_layout({}) == {}


def test_google_adapter_streams_private_files_and_detects_changes():
    files, names = {}, []
    def transport(request):
        assert request.headers['authorization'] == 'Bearer private-test-token'
        path = request.url.path
        if path.endswith('/files/root-dev'):
            return httpx.Response(200, json={'id': 'root-dev', 'mimeType': 'application/vnd.google-apps.folder', 'capabilities': {'canAddChildren': True}})
        if path.endswith('/files/generateIds'):
            return httpx.Response(200, json={'ids': ['photo-1']})
        if path == '/drive/v3/files' and request.method == 'GET':
            return httpx.Response(200, json={'files': []})
        if path == '/drive/v3/files':
            assert json.loads(request.content)['parents'] == ['root-dev']
            return httpx.Response(200, json={'id': 'folder-ucs'})
        if path == '/upload/drive/v3/files':
            content = request.read()
            assert 'multipart/related' in request.headers['content-type']
            assert b'photo-1' in content and b'"parents": ["folder-ucs"]' in content
            assert JPEG in content
            names.append(content)
            exists = 'photo-1' in files
            files['photo-1'] = JPEG
            return httpx.Response(409 if exists else 200, json={'id': 'photo-1'})
        if path.endswith('/files/photo-1'):
            if request.url.params.get('alt') == 'media':
                return httpx.Response(200, content=files['photo-1'])
            return httpx.Response(200, json={'id': 'photo-1', 'size': str(len(JPEG)), 'mimeType': 'image/jpeg', 'parents': ['folder-ucs']})
        raise AssertionError(str(request.url))
    with httpx.Client(transport=httpx.MockTransport(transport)) as client:
        store = ImageStorage(client, 'root-dev', lambda: 'private-test-token')
        assert store.folder_for('ucs') == 'folder-ucs'
        assert store.folder_for('ucs') == 'folder-ucs'
        assert store.reserve_id() == 'photo-1'
        digest = hashlib.sha256(JPEG).hexdigest()
        for _ in range(2):
            store.upload('photo-1', 'folder-ucs', 'DH_ANTES.jpg', BytesIO(JPEG), len(JPEG), digest, 'uuid')
        assert len(files) == 1
        with pytest.raises(HTTPException) as error:
            store.download('photo-1', 'folder-ucs', len(JPEG), 'changed-hash')
        assert error.value.status_code == 409
        files['photo-1'] = JPEG[:-2]
        with pytest.raises(HTTPException):
            store.download('photo-1', 'folder-ucs', len(JPEG), digest)
    filename = photo_filename('../DH/UCS:M01', 'antes', '12345678-1234-5678', images.now())
    assert '/' not in filename and ':' not in filename and '_ANTES_' in filename


def test_http_upload_bounds_body_before_contacting_drive(monkeypatch):
    import app.reportes.router as routes
    calls = []
    def store(payload, stream, db, user):
        calls.append((payload, stream.read()))
        return {'id_imagen': str(uuid4()), 'estado': 'lista'}
    monkeypatch.setattr(routes, 'store_uploaded_image', store)
    app = FastAPI()
    app.include_router(router, dependencies=[Depends(current_user)])
    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=42)
    path = f'/api/reportes/imagenes/cargas?codigo_muestra=DH-UCS-M01&posicion=antes&solicitud_id={uuid4()}'
    with TestClient(app) as client:
        assert client.post(path, content=JPEG, headers={'Content-Type': 'image/jpeg'}).status_code == 201
        assert len(calls) == 1
        assert client.post(path, content=b'x'*(MAX_IMAGE_BYTES+1), headers={'Content-Type': 'image/jpeg'}).status_code == 413
        assert client.post(path, content=iter([b'x'*65536]*17), headers={'Content-Type': 'image/jpeg'}).status_code == 413
        assert client.post(path, content=JPEG, headers={'Content-Type': 'text/plain'}).status_code == 415
        assert len(calls) == 1
        for _ in range(2):
            assert routes._photo_transfers.acquire(blocking=False)
        try:
            assert client.post(path, content=JPEG, headers={'Content-Type': 'image/jpeg'}).status_code == 429
        finally:
            for _ in range(2):
                routes._photo_transfers.release()


def test_oauth_configuration_loads_only_the_private_authorization_file(tmp_path, monkeypatch):
    pytest.importorskip('google.oauth2.credentials')
    from google.auth.exceptions import RefreshError
    from app.reportes.image_storage import storage
    import google.oauth2.credentials
    token_file = tmp_path / 'google-drive-token.json'
    token_file.write_text(json.dumps({
        'type': 'authorized_user', 'client_id': 'fake-client', 'client_secret': 'fake-secret',
        'refresh_token': 'fake-refresh', 'token': 'fake-access',
        'token_uri': 'https://oauth2.googleapis.com/token', 'expiry': '2099-01-01T00:00:00Z',
    }), encoding='utf-8')
    monkeypatch.setenv('GOOGLE_DRIVE_ROOT_FOLDER_ID', 'root-folder-test')
    monkeypatch.setenv('GOOGLE_DRIVE_TOKEN_FILE', str(token_file))
    storage.cache_clear()
    store = storage()
    try:
        assert store.provider == 'google_drive' and store.token() == 'fake-access'
    finally:
        store.client.close()
        storage.cache_clear()
    data = json.loads(token_file.read_text())
    data['expiry'] = '2000-01-01T00:00:00Z'
    token_file.write_text(json.dumps(data), encoding='utf-8')
    def expired(*args, **kwargs):
        raise RefreshError('test authorization expired')
    monkeypatch.setattr(google.oauth2.credentials.Credentials, 'refresh', expired)
    store = storage()
    try:
        with pytest.raises(HTTPException) as error:
            store.token()
        assert error.value.status_code == 503 and 'expiró' in error.value.detail
    finally:
        store.client.close()
        storage.cache_clear()


def test_http_history_photo_is_private_and_releases_transfer_limit(monkeypatch):
    calls = []
    def download(db, image_id):
        calls.append(image_id)
        return BytesIO(JPEG), len(JPEG)
    monkeypatch.setattr(images, 'download_image', download)
    app = FastAPI()
    app.include_router(router, dependencies=[Depends(current_user)])
    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[current_user] = lambda: SimpleNamespace(id=42)
    path = '/api/reportes/imagenes/' + str(uuid4())
    with TestClient(app) as client:
        response = client.get(path)
        assert response.status_code == 200 and response.content == JPEG
        assert response.headers['cache-control'] == 'private, no-store'
        assert response.headers['content-type'] == 'image/jpeg'
        assert len(calls) == 1
        def unauthorized():
            raise HTTPException(401, 'Se requiere una sesión.')
        app.dependency_overrides[current_user] = unauthorized
        assert client.get(path).status_code == 401
        assert len(calls) == 1
    from app.reportes.router import _photo_transfers
    acquired = 0
    try:
        for _ in range(2):
            assert _photo_transfers.acquire(blocking=False)
            acquired += 1
    finally:
        for _ in range(acquired):
            _photo_transfers.release()


@pytest.mark.parametrize('kind,code,folder_key,abbreviation,version', [
    ('UCS', 'MULTI-UCS-M01', 'ucs', 'UCS', 'ucs-v2'),
    ('Corte directo', 'MULTI-CD-M01', 'corte-directo', 'CD', 'corte-directo-v1'),
    ('Compresión triaxial', 'MULTI-TX-M01', 'compresion-triaxial', 'TX', 'compresion-triaxial-v1'),
    ('Tracción indirecta', 'MULTI-TI-M01', 'traccion-indirecta', 'TI', 'traccion-indirecta-v1'),
    # CE uses UCS in its code but must keep its own template and Drive folder.
    ('Determinación de constantes elásticas', 'MULTI-UCS-M02', 'constantes-elasticas', 'CE', 'constantes-elasticas-v1'),
])
def test_complete_photo_flow_for_each_assay_type(photo_setup, monkeypatch, kind, code, folder_key, abbreviation, version):
    db, actor, store = photo_setup
    report_format = FORMATS[kind.casefold()]
    result_values = {field: '1' if field in {'ucs_rotura', 'triaxial_rotura', 'traccion_vacia_28', 'corte_tipo_fractura'} else 12.5
                     for field in report_format.result_fields}
    db.add_all(RegistroMaestro(idd=idd, codigo_muestra=code, tipo_ensayo=kind, sondaje='MULTI', **result_values)
               for idd in (10, 11))
    db.commit()
    assert sample(codigo_muestra=code, db=db)['fotografias_habilitadas'] is True
    common = dict(codigo_muestra=code, numero_informe='FOTOS-' + abbreviation, fecha_emision=date.today(),
                  ejecutor='Ana Pérez', supervisor='Carlos García')
    # Ordinary reports omit the whole photo section in every assay type.
    empty = preview(PreviewEmission(**common), db, actor)['html']
    assert '<figure' not in empty and '<figcaption' not in empty
    assert empty.count('class="firmas firmas-comunes"') == 1
    local = dict(antes={'ancho': 200, 'alto': 100}, despues={'ancho': 200, 'alto': 100})
    monkeypatch.setattr(images, 'storage', lambda: pytest.fail('Preview must not connect to Drive'))
    preview_html = preview(PreviewEmission(**common, fotografias_locales=local), db, actor)['html']
    assert preview_html.count('data-report-photo=') == 2
    assert preview_html.count('class="fotos"') == 1
    assert preview_html.index('class="fotos"') < preview_html.index('class="firmas firmas-comunes"')
    with pytest.raises(HTTPException) as incomplete:
        preview(PreviewEmission(**common, fotografias_locales={'antes': local['antes']}), db, actor)
    assert incomplete.value.status_code == 422
    monkeypatch.setattr(images, 'storage', lambda: store)
    request_id, refs = uuid4(), {}
    for position in ('antes', 'despues'):
        upload = ImageUpload(codigo_muestra=code, posicion=position, solicitud_id=request_id)
        refs[position] = UUID(store_uploaded_image(upload, BytesIO(JPEG), db, actor)['id_imagen'])
        row = db.get(images.ReportImage, str(refs[position]))
        assert row.bucket == 'folder-' + folder_key
        assert row.codigo_muestra == code
    payload = SaveEmission(**common, solicitud_id=request_id, imagenes=refs)
    issued = save(payload, db, actor)
    report = db.get(Report, issued['id_reporte'])
    assert issued['sigla_ensayo'] == abbreviation and report.version_plantilla == version
    snapshot = json.loads(report.datos_emitidos)
    assert set(snapshot['corridas'][0]) == {'idd', *report_format.result_fields}
    assert len(snapshot['corridas']) == 2
    assert {value['bucket'] for value in snapshot['imagenes'].values()} == {'folder-' + folder_key}
    assert issued['html'].count('data-report-photo=') == 2
    assert issued['html'].count('class="firmas firmas-comunes"') == 1
    assert get_report(report.id_reporte, db)['html'] == issued['html']
    for position in ('antes', 'despues'):
        stream, size = images.download_image(db, refs[position])
        try:
            assert stream.read() == JPEG and size == len(JPEG)
        finally:
            stream.close()
    assert save(payload, db, actor)['id_reporte'] == report.id_reporte
    assert len(store.objects) == 2


def test_cleanup_discovers_existing_assay_folders_without_creating_any():
    requests = []
    def transport(request):
        requests.append(request)
        assert request.method == 'GET'
        assert "'configured-root' in parents" in request.url.params['q']
        if request.url.params.get('pageToken') == 'page-2':
            return httpx.Response(200, json={'files': [
                {'id': 'folder-ce', 'appProperties': {'gema_tipo': 'constantes-elasticas'}},
                {'id': 'unknown', 'appProperties': {'gema_tipo': 'unknown'}},
            ]})
        return httpx.Response(200, json={'nextPageToken': 'page-2', 'files': [
            {'id': 'folder-ucs', 'appProperties': {'gema_tipo': 'ucs'}},
            {'id': 'folder-cd', 'appProperties': {'gema_tipo': 'corte-directo'}},
            {'id': 'unrelated-folder'},
        ]})
    with httpx.Client(transport=httpx.MockTransport(transport)) as client:
        store = ImageStorage(client, 'configured-root', lambda: 'test')
        assert store.existing_folder_ids() == {'folder-ucs', 'folder-cd', 'folder-ce'}
    assert len(requests) == 2
