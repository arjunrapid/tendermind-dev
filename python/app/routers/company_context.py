"""POST/GET /api/company-context, DELETE /api/company-context/{id}.

Lets an admin upload curated reference material (plain text, Markdown, or
PDF), stored in Postgres (`company_context` table) and injected into every
matching agent's analysis - see app/company_context.py and agents/nodes.py.
Category (legal/engineering/accounting/risk) is auto-detected from the
content itself (app.company_context.classify_category) rather than picked
by the admin.
"""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import db
from app.auth import AdminUser, CurrentUser
from app.company_context import CATEGORIES, classify_category
from app.pdf_extract import extract_text_from_file

router = APIRouter()


@router.get("/api/company-context")
async def list_company_context(_user: CurrentUser, category: str | None = None):
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category '{category}'. Must be one of {CATEGORIES}.")
    try:
        items = await db.get_company_context(category=category)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to fetch company context") from exc
    return {"categories": CATEGORIES, "items": items}


@router.post("/api/company-context")
async def upload_company_context(
    _admin: AdminUser,
    title: str = Form(...),
    content: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    if not title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    file_name: str | None = None
    if file is not None and file.filename:
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        try:
            extracted = extract_text_from_file(data, file.filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        source_type = "pdf" if file.filename.endswith(".pdf") else "markdown" if file.filename.endswith(".md") else "text"
        file_name = file.filename
        final_content = extracted
    elif content and content.strip():
        source_type = "text"
        final_content = content
    else:
        raise HTTPException(status_code=400, detail="Provide either pasted content or a file to upload")

    # Classified from title + content together - a short/generic body
    # ("See attached") still has a decent shot at a correct category if the
    # title itself is descriptive.
    category = classify_category(f"{title}\n{final_content}")

    try:
        saved = await db.save_company_context(category, title.strip(), final_content, source_type, file_name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to save company context") from exc

    return saved


@router.delete("/api/company-context/{context_id}")
async def delete_company_context(context_id: str, _admin: AdminUser):
    try:
        deleted = await db.delete_company_context(context_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to delete company context") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Company context entry not found")
    return {"success": True}
