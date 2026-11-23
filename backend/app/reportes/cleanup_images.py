"""Manual maintenance. Default is dry-run; --apply is explicitly destructive.

Only unassociated image records older than 24 hours are eligible. Never run
against a database/bucket different from the intended environment.
"""
import argparse
from datetime import timedelta

from sqlalchemy import select
from fastapi import HTTPException

from app.database import SessionLocal
from app.reportes.images import ReportImage, now
from app.reportes.image_storage import storage


def main():
    parser = argparse.ArgumentParser(description='Limpiar fotografías no asociadas a reportes, de más de 24 horas.')
    parser.add_argument('--apply', action='store_true', help='Eliminar archivos de Drive sin reporte y sus metadatos. Sin esta opción solo enumera candidatos.')
    args = parser.parse_args()
    cutoff = now()-timedelta(hours=24)
    with SessionLocal() as db:
        ids = list(db.scalars(select(ReportImage.id_imagen).where(
            ReportImage.id_reporte.is_(None), ReportImage.proveedor == 'google_drive',
            ReportImage.fecha_registro < cutoff).limit(100)))
        print(f'Candidatos en este lote: {len(ids)}. Modo: {"APLICAR" if args.apply else "SIMULACIÓN"}.')
        if not args.apply:
            return
        store = storage()
        folders = store.existing_folder_ids()
        # Apply only to this configured root, across every supported assay type.
        ids = list(db.scalars(select(ReportImage.id_imagen).where(
            ReportImage.id_reporte.is_(None), ReportImage.proveedor == store.provider,
            ReportImage.bucket.in_(folders), ReportImage.fecha_registro < cutoff).limit(100)))
        db.commit()
        for image_id in ids:
            query = select(ReportImage).where(ReportImage.id_imagen == image_id).with_hint(
                ReportImage, 'WITH (UPDLOCK, ROWLOCK)', dialect_name='mssql').with_for_update()
            image = db.scalar(query)
            if image is None or image.id_reporte is not None or image.fecha_registro >= cutoff:
                db.rollback()
                continue
            if image.proveedor != store.provider or image.bucket not in folders:
                db.rollback()
                print('Omitida fotografía de otro almacenamiento.')
                continue
            try:
                store.delete(image.objeto)
            except HTTPException as error:
                if error.status_code != 410:
                    raise
            db.delete(image)
            db.commit()
        print('Lote completado. Repetir si quedan candidatos.')


if __name__ == '__main__':
    main()
