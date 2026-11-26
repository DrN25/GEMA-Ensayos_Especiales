"""Image metadata in SQL; optimized files in private Google Drive folders."""
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid5

from fastapi import HTTPException
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.reportes.image_storage import inspect_jpeg, photo_filename, storage


class ImageBase(DeclarativeBase):
    pass


class ReportImage(ImageBase):
    __tablename__ = 'reporte_ensayo_imagen'
    __table_args__ = {'schema': 'dbo'}
    id_imagen: Mapped[str] = mapped_column(String(36), primary_key=True)
    codigo_muestra: Mapped[str] = mapped_column(String(150))
    posicion: Mapped[str] = mapped_column(String(10))
    usuario_id: Mapped[int] = mapped_column(Integer)
    id_reporte: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proveedor: Mapped[str] = mapped_column(String(20), default='google_drive')
    # Keep the existing schema: bucket = assay folder ID, objeto = Drive file ID.
    bucket: Mapped[str] = mapped_column(String(100))
    objeto: Mapped[str] = mapped_column(String(250))
    bytes: Mapped[int] = mapped_column(Integer)
    ancho: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alto: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(12), default='pendiente')
    fecha_registro: Mapped[datetime] = mapped_column(DateTime)


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def owned_image(db, image_id, user, *, lock=False):
    if not user or not getattr(user, 'id', None):
        raise HTTPException(401, 'Se requiere una sesión para gestionar fotografías.')
    query = select(ReportImage).where(ReportImage.id_imagen == str(image_id))
    if lock:
        query = query.with_hint(ReportImage, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql').with_for_update()
    image = db.scalar(query)
    if image is None or image.usuario_id != user.id:
        raise HTTPException(404, 'La fotografía no existe o no pertenece a esta sesión.')
    return image


def issue_upload(db, user, code, position, request_id, stream, *, assay_kind):
    size, width, height, digest = inspect_jpeg(stream)
    image_id = str(uuid5(UUID(str(request_id)), f'{user.id}:{position}'))
    image = db.get(ReportImage, image_id)

    def check(row):
        if (row.usuario_id != user.id or row.codigo_muestra.casefold() != code.casefold()
                or row.posicion != position or row.bytes != size or row.sha256 != digest
                or row.proveedor != 'google_drive'):
            raise HTTPException(409, 'La solicitud ya contiene otra fotografía. Vuelve a seleccionar las fotografías para iniciar una nueva emisión.')

    if image:
        check(image)
        if image.estado == 'lista':
            return {'id_imagen': image_id, 'estado': 'lista'}
        if image.fecha_registro < now()-timedelta(hours=24):
            raise HTTPException(410, 'La carga pendiente expiró. Vuelve a seleccionar las fotografías.')
    # Finish SQL reads before network I/O. A pending record reserves the Drive
    # file ID so a lost response can be retried without duplicate Drive files.
    db.commit()
    store = storage()
    if image is None:
        folder, file_id = store.folder_for(assay_kind), store.reserve_id()
        image = ReportImage(id_imagen=image_id, codigo_muestra=code, posicion=position,
                            usuario_id=user.id, proveedor=store.provider, bucket=folder, objeto=file_id,
                            bytes=size, ancho=width, alto=height, sha256=digest,
                            estado='pendiente', fecha_registro=now())
        db.add(image)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            image = owned_image(db, image_id, user)
            check(image)
    folder, file_id, registered = image.bucket, image.objeto, image.fecha_registro
    db.commit()
    store.upload(file_id, folder, photo_filename(code, position, str(request_id), registered),
                 stream, size, digest, image_id)
    image = owned_image(db, image_id, user, lock=True)
    check(image)
    image.estado = 'lista'
    db.commit()
    return {'id_imagen': image_id, 'estado': 'lista'}


def references(db, user, code, ids, *, lock=False):
    result, rows = {}, []
    for position, image_id in sorted(ids.items()):
        image = owned_image(db, image_id, user, lock=lock)
        if image.estado != 'lista' or image.codigo_muestra.casefold() != code.casefold() or image.posicion != position:
            raise HTTPException(422, 'La fotografía no está confirmada para esta muestra y posición.')
        if image.proveedor != 'google_drive':
            raise HTTPException(409, 'Esta fotografía es de las pruebas anteriores de R2. Selecciona una nueva copia para Google Drive.')
        if image.id_reporte is not None:
            raise HTTPException(409, 'La fotografía ya pertenece a una emisión. Selecciona una nueva copia.')
        result[position] = {'id': image.id_imagen, 'proveedor': image.proveedor, 'bucket': image.bucket,
                            'objeto': image.objeto, 'bytes': image.bytes, 'ancho': image.ancho,
                            'alto': image.alto, 'sha256': image.sha256}
        rows.append(image)
    return result, rows


def photo_urls(data):
    result = {}
    for position, image in data.get('imagenes', {}).items():
        if position not in ('antes', 'despues'):
            raise HTTPException(409, 'La posición de la fotografía no es compatible.')
        if image.get('local'):
            result[position] = f'/api/reportes/imagenes/locales/{position}'
        elif image.get('proveedor') == 'google_drive':
            result[position] = f"/api/reportes/imagenes/{UUID(image['id'])}"
        else:
            raise HTTPException(409, 'Este reporte de prueba usa R2. Limpia el historial local anterior o emite un nuevo reporte con Google Drive.')
    return result


def download_image(db, image_id, *, owner_id=None):
    image = db.get(ReportImage, str(image_id))
    if (image is None or image.estado != 'lista' or image.id_reporte is None
            or (owner_id is not None and image.usuario_id != owner_id)):
        raise HTTPException(404, 'La fotografía no está asociada a un reporte emitido.')
    if image.proveedor != 'google_drive':
        raise HTTPException(409, 'Esta fotografía pertenece al almacenamiento anterior.')
    file_id, folder, size, digest = image.objeto, image.bucket, image.bytes, image.sha256
    db.commit()
    return storage().download(file_id, folder, size, digest), size


def photo_layout(data):
    ratios = {}
    for position, image in data.get('imagenes', {}).items():
        width, height = image.get('ancho'), image.get('alto')
        ratios[position] = width / height if width and height and width > 0 and height > 0 else 2 / 3
    if not ratios:
        return {}
    height = min(66.0, 72.0 / max(ratios.values()))
    return {position: {'ancho': round(height * ratio + 3.7, 4), 'alto': round(height + 3, 4)}
            for position, ratio in ratios.items()}
