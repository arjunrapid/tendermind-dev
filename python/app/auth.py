"""Server-side authentication for the Tendermind API.

Replaces the client-side localStorage demo auth (lib/auth.tsx) with a
proper server-issued JWT. Credentials are stored in the `users` table
(bcrypt-hashed passwords). Two built-in accounts are seeded on first
startup for backwards compatibility with the demo; the seeded passwords
are read from environment variables (AUTH_ADMIN_PASSWORD,
AUTH_ANALYST_PASSWORD) so they are never hardcoded in source.

Usage in routers:
    from app.auth import CurrentUser, AdminUser, get_current_user

    @router.get("/protected")
    async def protected(user: CurrentUser):
        ...

    @router.post("/admin-only")
    async def admin_only(user: AdminUser):
        ...
"""

from __future__ import annotations

import os
import time
from typing import Annotated, Any

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_JWT_SECRET = os.environ.get("JWT_SECRET", "")
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_SECONDS = int(os.environ.get("JWT_EXPIRY_SECONDS", str(60 * 60 * 8)))  # 8 h

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _require_secret() -> str:
    if not _JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is not set. Set it to a long random string in your .env / environment."
        )
    return _JWT_SECRET


def create_access_token(user_id: str, username: str, role: str, name: str) -> str:
    secret = _require_secret()
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + _JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    secret = _require_secret()
    return jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])


# ---------------------------------------------------------------------------
# FastAPI dependency: authenticated user
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict[str, Any]:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise exc
    return {
        "id": payload["sub"],
        "username": payload["username"],
        "role": payload["role"],
        "name": payload["name"],
    }


async def get_admin_user(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# FastAPI Depends aliases used in routers.
CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]
AdminUser = Annotated[dict[str, Any], Depends(get_admin_user)]
