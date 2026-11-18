import base64
import json
from tempfile import TemporaryFile
from threading import BoundedSemaphore

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.revision_excel.service import MAX_FILE_BYTES, ReviewError, write_review


router = APIRouter(prefix="/api/revision-excel", tags=["Revisión de Excel"])
active_review = BoundedSemaphore(1)
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("")
def review_excel(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".xlsx"):
        raise HTTPException(422, "Selecciona un archivo Excel en formato .xlsx.")
    if file.size is not None and file.size > MAX_FILE_BYTES:
        raise HTTPException(413, "El archivo supera los 25 MiB admitidos por revisión.")
    if not active_review.acquire(blocking=False):
        raise HTTPException(429, "Hay una revisión de Excel en curso. Intenta nuevamente cuando termine.")

    output = None
    try:
        output = TemporaryFile(mode="w+b")
        summary = write_review(file.file, output)
        output.seek(0)
    except ReviewError as error:
        if output is not None:
            output.close()
        raise HTTPException(422, str(error)) from error
    except BaseException:
        if output is not None:
            output.close()
        raise
    finally:
        active_review.release()

    def chunks():
        try:
            while block := output.read(64 * 1024):
                yield block
        finally:
            output.close()

    metadata = base64.b64encode(json.dumps(summary, ensure_ascii=False).encode()).decode("ascii")
    return StreamingResponse(chunks(), media_type=XLSX_MEDIA_TYPE, background=BackgroundTask(output.close), headers={
        "Content-Disposition": 'attachment; filename="Ensayos_Especiales_Auditado.xlsx"',
        "X-Resumen-Revision": metadata,
        "Cache-Control": "no-store",
    })
