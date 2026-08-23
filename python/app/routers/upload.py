"""POST /api/upload - ported from app/api/upload/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from agents.tools import get_document_store
from app.auth import CurrentUser
from app.pdf_extract import extract_text_from_file

router = APIRouter()

# Hard cap on incoming file size: anything larger than this is almost
# certainly an accidental upload of the wrong file (full CAD exports, video
# recordings, archive bundles) rather than a tender document, and would push
# well past LLM context limits anyway.
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/api/upload")
async def upload(_user: CurrentUser, file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    content_type = file.content_type or ""
    if "pdf" not in content_type and "text" not in content_type and not (file.filename or "").endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF and text files are supported")

    data = await file.read()

    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data) / 1_048_576:.1f} MB). Maximum allowed size is {MAX_FILE_SIZE_BYTES // 1_048_576} MB.",
        )

    try:
        extracted_text = extract_text_from_file(data, file.filename or "upload")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Failed to extract text: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to process file") from exc

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the file. Ensure it is a text-based PDF (not a scanned image-only PDF).",
        )

    # Stored so agents can (re-)extract the same document deterministically
    # via the shared `extract_document_text` tool instead of text being
    # pasted into their prompt as the only source of truth.
    document_id = get_document_store().save(data, file.filename or "upload")

    return {
        "fileName": file.filename,
        "extractedText": extracted_text,
        "documentId": document_id,
        "size": len(data),
    }
