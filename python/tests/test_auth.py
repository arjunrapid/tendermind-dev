"""Unit tests for app.auth - JWT creation and verification (no DB needed)."""

import os
import time

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-only")

from app.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    plain = "supersecret123"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_token():
    token = create_access_token("user-id-1", "tmadmin", "admin", "Tender Admin")
    payload = decode_token(token)
    assert payload["sub"] == "user-id-1"
    assert payload["username"] == "tmadmin"
    assert payload["role"] == "admin"
    assert payload["name"] == "Tender Admin"
    assert payload["exp"] > int(time.time())
