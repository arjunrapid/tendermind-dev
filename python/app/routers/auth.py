"""POST /api/auth/login, GET /api/auth/me.

Replaces the client-side localStorage demo auth (lib/auth.tsx) with a
proper server-side JWT flow. The two demo accounts (tmadmin / tmanalyst)
are seeded automatically in the `users` table on first startup; their
passwords are controlled by AUTH_ADMIN_PASSWORD and AUTH_ANALYST_PASSWORD
environment variables.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.auth import CurrentUser, create_access_token, verify_password

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/api/auth/login")
async def login(body: LoginRequest):
    if not body.username or not body.password:
        raise HTTPException(status_code=400, detail="username and password are required")

    user = await db.get_user_by_username(body.username.strip().lower())
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(
        user_id=str(user["id"]),
        username=user["username"],
        role=user["role"],
        name=user["name"],
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["id"]),
            "username": user["username"],
            "role": user["role"],
            "name": user["name"],
        },
    }


@router.get("/api/auth/me")
async def me(user: CurrentUser):
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "name": user["name"],
    }
