"""Text extraction from uploaded files. Ported from lib/pdf.ts."""

from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if not text:
        raise ValueError("PDF contained no extractable text (it may be a scanned image without OCR)")
    return text


def extract_text_from_file(data: bytes, file_name: str) -> str:
    if file_name.endswith(".pdf"):
        return extract_text_from_pdf(data)

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Unsupported file format") from exc
