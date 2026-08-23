"""POST /api/upload - ported from app/api/upload/route.ts."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from agents.tools import get_document_store
from app.pdf_extract import extract_text_from_file

router = APIRouter()


@router.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    content_type = file.content_type or ""
    if "pdf" not in content_type and "text" not in content_type and not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF and text files are supported")

    data = await file.read()
    try:
        extracted_text = extract_text_from_file(data, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Failed to process file") from exc

    # Stored so agents can (re-)extract the same document deterministically
    # via the shared `extract_document_text` tool instead of text being
    # pasted into their prompt as the only source of truth.
    document_id = get_document_store().save(data, file.filename)

    return {
        "fileName": file.filename,
        "extractedText": extracted_text,
        "documentId": document_id,
        "size": len(data),
    }
